import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ExportTranscriptionHistoryResponse,
  TranscriptionHistoryEntry,
  TranscriptionHistoryQuery,
  TranscriptionHistoryStorageStatus,
  TranscriptStoreStatus,
} from "../types/history";

const REFRESH_INTERVAL_MS = 5000;

function areHistoryEntriesEqual(current: TranscriptionHistoryEntry[], next: TranscriptionHistoryEntry[]) {
  if (current.length !== next.length) return false;

  return current.every((entry, index) => JSON.stringify(entry) === JSON.stringify(next[index]));
}

interface RefreshOptions {
  background?: boolean;
}

function sanitizeQuery(query?: TranscriptionHistoryQuery): TranscriptionHistoryQuery {
  if (!query) return {};

  return {
    limit: query.limit,
    provider: query.provider?.trim() || undefined,
    status: query.status,
    source: query.source,
    active_profile: query.active_profile?.trim() || undefined,
    search: query.search?.trim() || undefined,
    include_errors_only: query.include_errors_only || undefined,
  };
}

export function useTranscriptionHistory(isActive: boolean) {
  const [entries, setEntries] = useState<TranscriptionHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [transcriptRoot, setTranscriptRoot] = useState<string | null>(null);
  const activeQueryRef = useRef<TranscriptionHistoryQuery>({});

  const refreshStorageStatus = useCallback(async () => {
    /* Two stores and both are read here, because History's foot states both:
       the index it reads and the folder the transcripts are in (ADR 0074).
       Independently, so a runtime that answers one and not the other still
       states the half it has. */
    void invoke<TranscriptStoreStatus>("transcript_store_status")
      .then((next) => setTranscriptRoot(next?.root ?? null))
      .catch(() => setTranscriptRoot(null));

    try {
      const next = await invoke<TranscriptionHistoryStorageStatus>("transcription_history_storage_status");
      setStoragePath(next.path);
      return next;
    } catch {
      setStoragePath(null);
      return null;
    }
  }, []);

  /** Open the file manager on a record's own file, or on the folder when no
   *  path is given. The runtime refuses anything outside its own root. */
  const reveal = useCallback(async (path?: string | null) => {
    try {
      await invoke("reveal_transcript_in_file_manager", { request: { path: path ?? null } });
      return true;
    } catch (cause) {
      setError(String(cause));
      return false;
    }
  }, []);

  const refresh = useCallback(async (query?: TranscriptionHistoryQuery, options?: RefreshOptions) => {
    const showLoading = !options?.background;

    if (showLoading) {
      setIsLoading(true);
    }

    try {
      const nextQuery = sanitizeQuery(query ?? activeQueryRef.current);
      activeQueryRef.current = nextQuery;
      const next = await invoke<TranscriptionHistoryEntry[]>("transcription_history_entries", {
        query: nextQuery,
      });
      /* A RUNTIME THAT ANSWERS WITH ANYTHING BUT A LIST HAS NOT ANSWERED, and
         it is not a machine with no history. A command the host does not know
         resolves `undefined` — which is exactly what `WorkspaceWindow.test.tsx`
         mocks — and the comparison below then reads `.length` off it and takes
         the whole window down with it. Leg 4b filed this as finding 4 against
         the enumeration commands; the same rule reaches every list read. */
      if (!Array.isArray(next)) return null;
      setEntries((current) => (areHistoryEntriesEqual(current, next) ? current : next));
      setError((current) => (current === null ? current : null));
      return next;
    } catch (cause) {
      const message = String(cause);
      setError((current) => (current === message ? current : message));
      return null;
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  /** Mark a fallen-back delivery as dealt with, so Home stops asking for it
   *  (ADR 0076). Restoring the text does it too — the question is answered
   *  either way. */
  const acknowledgeFallback = useCallback(async (id: string) => {
    try {
      await invoke("acknowledge_transcription_fallback", { request: { id } });
      await refresh(undefined, { background: true });
    } catch (cause) {
      setError(String(cause));
    }
  }, [refresh]);

  const clear = useCallback(async () => {
    setIsLoading(true);
    try {
      await invoke<TranscriptionHistoryEntry[]>("clear_transcription_history_entries");
      const next = await refresh(undefined, { background: true });
      setError(null);
      return next;
    } catch (cause) {
      setError(String(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      await invoke<TranscriptionHistoryEntry[]>("delete_transcription_history_entry", {
        request: { id },
      });
      const next = await refresh(undefined, { background: true });
      setError(null);
      return next;
    } catch (cause) {
      setError(String(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [refresh]);

  const retry = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const next = await invoke<TranscriptionHistoryEntry>("retry_transcription_history_entry", {
        request: { id },
      });
      await refresh(undefined, { background: true });
      setError(null);
      return next;
    } catch (cause) {
      setError(String(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [refresh]);

  const exportEntries = useCallback(async (path: string, query?: TranscriptionHistoryQuery) => {
    setIsLoading(true);
    try {
      const nextQuery = sanitizeQuery(query ?? activeQueryRef.current);
      activeQueryRef.current = nextQuery;
      const response = await invoke<ExportTranscriptionHistoryResponse>("export_transcription_history", {
        request: {
          path,
          query: nextQuery,
        },
      });
      setError(null);
      return response;
    } catch (cause) {
      setError(String(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;

    void refreshStorageStatus();
    void refresh(undefined, { background: true });
    const timer = window.setInterval(() => {
      void refresh(undefined, { background: true });
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [isActive, refresh, refreshStorageStatus]);

  return {
    entries,
    storagePath,
    transcriptRoot,
    reveal,
    acknowledgeFallback,
    error,
    isLoading,
    refresh,
    clear,
    remove,
    retry,
    exportEntries,
  };
}