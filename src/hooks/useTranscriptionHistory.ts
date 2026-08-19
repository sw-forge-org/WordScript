import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { BackendEvent } from "../types/ipc";
import type {
  ExportTranscriptionHistoryResponse,
  TranscriptionHistoryEntry,
  TranscriptionHistoryQuery,
  TranscriptionHistoryStorageStatus,
  TranscriptionHistorySummary,
  TranscriptStoreStatus,
} from "../types/history";

/**
 * THE INDEX IS READ WHEN IT CHANGES, NOT ON A TIMER (ADR 0240).
 *
 * This hook polled `transcription_history_entries` every five seconds, with no
 * limit, and compared the answer to the last one by `JSON.stringify` per entry.
 * On the reporting machine that is 435 records and 1.27 MB over the bridge and
 * through two full serialisations, twelve times a minute, for a file that only
 * changes when somebody dictates. Home hangs on the same hook and needs four
 * figures and a three-row list.
 *
 * The runtime already says when a record lands, on the channel `useRuntime`
 * has listened to since the beginning. The events below are the ones that write
 * one; a refresh too many is free, and an event this list does not know about
 * would show up as a stale row rather than as a wrong one.
 *
 * AND A LOST EVENT MAY NOT STRAND THE LIST. `visibilitychange` is the second
 * trigger — coming back to the window re-reads — which covers a dropped emit
 * without reintroducing a clock. Every mutation this hook performs itself
 * (delete, clear, retry, acknowledge) already refreshes on its own answer.
 */
const RECORD_WRITING_EVENTS = new Set(["transcription", "error", "empty"]);

/**
 * WHETHER THE LIST CHANGED, WITHOUT SERIALISING IT TWICE (ADR 0240).
 *
 * This compared every row by `JSON.stringify(entry) === JSON.stringify(next)`,
 * which on the reporting machine is two full serialisations of 1.2 MB on every
 * read — done for no other purpose than to decide whether to call `setEntries`.
 *
 * A ROW IS ITS ID AND THE THREE THINGS THAT CAN CHANGE UNDER IT. An id is minted
 * from the moment it was written and never reused, so a list whose ids match in
 * order is the same list of records; `fallback_acknowledged` moves when somebody
 * dismisses, `title` when the naming call lands after the record, and `status`
 * on a retry. Everything else on a summary is written once with the record. A
 * field this misses would show as a stale row until the next event, not as a
 * wrong one — and the previous version paid 1.2 MB a read to catch a case that
 * has never happened.
 */
function areHistoryEntriesEqual(
  current: TranscriptionHistorySummary[],
  next: TranscriptionHistorySummary[],
) {
  if (current.length !== next.length) return false;

  return current.every((entry, index) => {
    const other = next[index];
    return (
      entry.id === other.id &&
      entry.status === other.status &&
      entry.title === other.title &&
      entry.fallback_acknowledged === other.fallback_acknowledged
    );
  });
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
  const [entries, setEntries] = useState<TranscriptionHistorySummary[]>([]);
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
      const next = await invoke<TranscriptionHistorySummary[]>("transcription_history_summaries", {
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
      await invoke<TranscriptionHistorySummary[]>("clear_transcription_history_entries");
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
      await invoke<TranscriptionHistorySummary[]>("delete_transcription_history_entry", {
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

  /**
   * ONE WHOLE RECORD, BY ID (ADR 0240).
   *
   * The list carries a 160-character preview of each transcript; the three
   * places that need the text itself — the raw panel, Copy, Restore — ask for
   * the one record they are about, at the moment somebody asks for it. At most
   * one record over the bridge at a time, against a list that used to ship all
   * of them twelve times a minute.
   *
   * `null` where the store no longer holds it, which is a stale row rather than
   * a fault: the record may have been deleted or pruned between the row being
   * drawn and the button being pressed.
   */
  const record = useCallback(async (id: string) => {
    try {
      const found = await invoke<TranscriptionHistoryEntry | null>(
        "transcription_history_record",
        { id },
      );
      return found ?? null;
    } catch (cause) {
      setError(String(cause));
      return null;
    }
  }, []);

  /** The delivered text of one record, whole. What Copy puts on the clipboard
   *  and what Restore places — never the preview, which is cut. */
  const deliveredText = useCallback(
    async (id: string) => {
      const found = await record(id);
      if (!found) return null;
      return found.transformed_transcript ?? found.raw_transcript ?? "";
    },
    [record],
  );

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

    /* THE CATCH IS ATTACHED HERE, NOT IN THE CLEANUP. `listen` rejects
       synchronously-ish wherever the Tauri bridge is absent — a browser preview,
       a test that stubs `invoke` and nothing else — and a rejection first handled
       on unmount is an unhandled rejection for as long as the component lives.
       Resolving to a no-op unsubscribe keeps the cleanup path shapeless. */
    const unlisten = listen<BackendEvent>("wordscript-event", ({ payload }) => {
      if (!RECORD_WRITING_EVENTS.has(payload?.event)) return;
      void refresh(undefined, { background: true });
    }).catch(() => () => {});

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refresh(undefined, { background: true });
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      void unlisten.then((off) => off());
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isActive, refresh, refreshStorageStatus]);

  return {
    entries,
    record,
    deliveredText,
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