import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ActivityLedger } from "@/lib/activity";
import type { BackendEvent } from "@/types/ipc";

/**
 * THE ALL-TIME RECORD, READ ONCE PER VISIT AND AGAIN WHENEVER ONE LANDS.
 *
 * `core::activity_ledger` keeps one row per day, folds a day into its month when
 * it ages out and never prunes the months — which is the whole reason Home's
 * counters can say *all time* at all. History cannot: it is swept by age on
 * every read.
 *
 * IT IS NOT LIVE, AND IT DOES NOT NEED TO BE. The figures are lifetime
 * aggregates: one more dictation moves an all-time rate by nothing a reader
 * could see, and a window that repolled would spend a file read a second to
 * animate the fourth decimal place. It loads when the surface becomes active and
 * again when a dictation lands, which is the only moment the numbers change in a
 * way anybody is watching for.
 *
 * **IT LISTENS FOR THAT MOMENT RATHER THAN INFERRING IT (ADR 0243).** This hook
 * took a `reloadKey` and Home passed `entries.length` — the number of rows in
 * the history list. A derived key is a guess about when something changed, and
 * that guess has a blind spot: the length does not move when a dictation lands
 * in the same read that retention drops one, so the ledger is not re-read and
 * the tiles keep the previous answer until the next activation. It is rare on a
 * young index and it is the NORMAL case on a saturated one — arrivals and
 * expiries balance, and a reader on the seven-day retention Privacy & Data
 * offers reaches that state in a week.
 *
 * So there is no key. The runtime already says when it wrote a record, on the
 * channel `useRuntime` and `useTranscriptionHistory` have both listened to since
 * ADR 0240; this listens to the same events, and `visibilitychange` covers a
 * dropped emit without reintroducing a clock. A refresh too many is one file
 * read.
 *
 * The read also SEEDS the ledger from whatever history still holds, once, on the
 * runtime side — so an existing installation does not start its all-time figures
 * at zero on the day this shipped. See the command's own note.
 */
const RECORD_WRITING_EVENTS = new Set(["transcription", "error", "empty"]);

export function useActivityLedger(active: boolean): ActivityLedger | null {
  const [ledger, setLedger] = useState<ActivityLedger | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const read = () => {
      void invoke<ActivityLedger>("read_activity_ledger")
        .then((next) => {
          if (!cancelled) setLedger(next ?? null);
        })
        .catch(() => {
          /* No ledger is NO READING, and the surface draws that as a dark
             display rather than as a zero. A failed read must not become a
             count. */
          if (!cancelled) setLedger(null);
        });
    };

    read();

    /* THE CATCH IS ATTACHED HERE AND NOT IN THE CLEANUP, for the reason the
       history hook's note gives: `listen` rejects wherever the bridge is absent
       — a browser preview, a test that stubs `invoke` and nothing else — and a
       rejection first handled on unmount is an unhandled rejection for as long
       as the component lives. */
    const unlisten = listen<BackendEvent>("wordscript-event", ({ payload }) => {
      if (!RECORD_WRITING_EVENTS.has(payload?.event)) return;
      read();
    }).catch(() => () => {});

    const onVisible = () => {
      if (document.visibilityState === "visible") read();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      void unlisten.then((off) => off());
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active]);

  return ledger;
}
