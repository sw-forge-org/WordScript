import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CaptureBudget } from "../types/ipc";

/**
 * What a recording may cost under the current provider and settings.
 *
 * The runtime owns every number here — the recording ceiling, the auto-stop in
 * force, the recommended headroom between them. The overlay states the
 * auto-stop and the settings surface states the limit; neither derives it
 * (ADR 0034: the runtime reports its own boundaries).
 *
 * `refresh` exists because the budget moves with settings the user is editing:
 * switching provider or account plan changes the ceiling under an open panel.
 */
export function useCaptureBudget(dependency?: unknown) {
  const [budget, setBudget] = useState<CaptureBudget | null>(null);

  const refresh = useCallback(async () => {
    try {
      setBudget(await invoke<CaptureBudget>("resolve_capture_budget"));
    } catch (error) {
      // A budget that cannot be read is not a budget to guess at: the surfaces
      // render nothing rather than a number that might be wrong.
      console.error("resolve_capture_budget failed:", error);
      setBudget(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, dependency]);

  return { budget, refresh };
}

/** `mm:ss`, the same shape the overlay timer uses. */
export function formatBudgetDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60).toString().padStart(2, "0");
  const s = (safe % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
