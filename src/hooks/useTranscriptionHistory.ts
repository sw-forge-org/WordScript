import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ExportTranscriptionHistoryResponse,
  TranscriptionHistoryEntry,
  TranscriptionHistoryQuery,
  TranscriptionHistoryStorageStatus,
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
  const activeQueryRef = useRef<TranscriptionHistoryQuery>({});

  const refreshStorageStatus = useCallback(async () => {
    try {
      const next = await invoke<TranscriptionHistoryStorageStatus>("transcription_history_storage_status");
      setStoragePath(next.path);
      return next;
    } catch {
      setStoragePath(null);
      return null;
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
    error,
    isLoading,
    refresh,
    clear,
    remove,
    retry,
    exportEntries,
  };
}