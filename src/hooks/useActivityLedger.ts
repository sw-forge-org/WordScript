import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ActivityLedger } from "@/lib/activity";

/**
 * THE ALL-TIME RECORD, READ ONCE PER VISIT.
 *
 * `core::activity_ledger` keeps one row per day and never prunes inside the
 * horizon a display can reach, which is the whole reason Home's counters can say
 * *all time* at all — history cannot, because it is pruned by age and by count
 * on every read.
 *
 * IT IS NOT LIVE, AND IT DOES NOT NEED TO BE. The figures are lifetime
 * aggregates: one more dictation moves an all-time rate by nothing a reader
 * could see, and a window that repolled would spend a file read a second to
 * animate the fourth decimal place. It loads when the surface becomes active and
 * again when a dictation lands, which is the only moment the numbers change in a
 * way anybody is watching for.
 *
 * The read also SEEDS the ledger from whatever history still holds, once, on the
 * runtime side — so an existing installation does not start its all-time figures
 * at zero on the day this shipped. See the command's own note.
 */
export function useActivityLedger(active: boolean, reloadKey?: unknown): ActivityLedger | null {
  const [ledger, setLedger] = useState<ActivityLedger | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    void invoke<ActivityLedger>("read_activity_ledger")
      .then((next) => {
        if (!cancelled) setLedger(next ?? null);
      })
      .catch(() => {
        /* No ledger is NO READING, and the surface draws that as a dark display
           rather than as a zero. A failed read must not become a count. */
        if (!cancelled) setLedger(null);
      });

    return () => {
      cancelled = true;
    };
  }, [active, reloadKey]);

  return ledger;
}
