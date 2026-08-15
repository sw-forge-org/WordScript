import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import type { LocalProviderSetupStatus, ProviderStatus } from "@/types/providers";

/**
 * WHAT THE TWO LOCAL RUNNERS ARE, ASKED FOR THE TAB THAT SHOWS THEM (ADR 0160).
 *
 * **Not `useProviderSeam`, and the difference is the lane.** That hook asks
 * about the vendors *the selected lane draws* — with the connection on Cloud,
 * which is where it opens, `local` is not among them and its answer is absent.
 * *On this machine* is not a lane view: it is true regardless of which lane the
 * connection sits on, so it asks for itself.
 *
 * **One call, and it is the one that already exists.** `local_setup` on
 * `provider_status` carries `resolved_runner`, `runner_ready` and the chat
 * endpoint's half — everything the runner card states. Nothing new crosses the
 * seam for this; the tab was simply never asking.
 *
 * **A failure is `null`, not a runner that is missing.** The provider probing
 * `Err` and WordScript failing to ask are different sentences, and the card
 * says *not read* for the second rather than claiming a binary is absent from a
 * disk nobody looked at — the defect ADR 0106 recorded one layer up.
 */
export function useLocalSetup(enabled = true) {
  const [setup, setSetup] = useState<LocalProviderSetupStatus | null>(null);
  const [asked, setAsked] = useState(false);
  const disposed = useRef(false);

  const read = useCallback(async () => {
    try {
      const status = await invoke<ProviderStatus>("provider_status", {
        request: { provider: "local", model: null, correction_model: null },
      });
      if (disposed.current) return;
      setSetup(status?.local_setup ?? null);
    } catch {
      if (disposed.current) return;
      setSetup(null);
    } finally {
      if (!disposed.current) setAsked(true);
    }
  }, []);

  useEffect(() => {
    disposed.current = false;
    if (enabled) void read();
    return () => {
      disposed.current = true;
    };
  }, [enabled, read]);

  return { setup, asked, refresh: read };
}
