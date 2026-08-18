import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { NativeInsertResult, NativeInsertionStatus } from "../types/nativeInsertion";

export function useNativeInsertion() {
  const [status, setStatus] = useState<NativeInsertionStatus | null>(null);
  const [lastRestore, setLastRestore] = useState<NativeInsertResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await invoke<NativeInsertionStatus>("native_insertion_status");
      setStatus(next);
      setError(null);
      return next;
    } catch (cause) {
      setError(String(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const restoreLastTranscript = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await invoke<NativeInsertResult>("restore_last_transcript");
      setLastRestore(result);
      setError(result.error);
      await refresh();
      return result;
    } catch (cause) {
      setError(String(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [refresh]);

  /* THE ONLY CALLER OF THE ONE COMMAND THAT MAY RAISE A PERMISSION DIALOG.
     It is wired to a button and to nothing else -- not to mount, not to a
     retry, not to a failed insert. The runtime enforces the same rule on its
     side (ADR 0234); this keeps the UI from being the one that breaks it. */
  const requestPortalGrant = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await invoke<NativeInsertionStatus>("request_portal_input_grant");
      setStatus(next);
      setError(null);
      return next;
    } catch (cause) {
      setError(String(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearScratchpad = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await invoke<NativeInsertionStatus>("clear_native_scratchpad");
      setStatus(next);
      setLastRestore(null);
      setError(null);
      return next;
    } catch (cause) {
      setError(String(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    status,
    lastRestore,
    error,
    isLoading,
    refresh,
    restoreLastTranscript,
    clearScratchpad,
    requestPortalGrant,
  };
}