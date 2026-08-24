import { useEffect, useState } from "react";
import type { DroppedSegment, TranscriptionHistoryEntry } from "../types/history";

/** The two texts of one record, whole — never the row's 160-character cut. */
export interface WholeTranscript {
  id: string;
  heard: string;
  written: string;
  /** What the confidence gate removed from `heard` before the transform saw it
   *  (ADR 0249). Empty on every record it left alone, which is the ordinary
   *  case — and empty on every record written before the removal was stored,
   *  where nothing can be said about it either way. It is on the WHOLE record
   *  rather than on the row for the reason the texts are: the row carries what
   *  a list needs, and this is read in the panel. */
  dropped: DroppedSegment[];
}

/**
 * THE WHOLE TEXT OF THE ONE ROW THAT IS OPEN (ADR 0240).
 *
 * A list row carries a preview of each transcript, which is the whole text for
 * most records — the median delivered text on the reporting machine is 135
 * characters. The panel opens on the preview IMMEDIATELY and fills in when the
 * record arrives, rather than waiting on a round trip: a spinner over text that
 * is already correct in half the cases is worse than a paragraph that grows
 * once.
 *
 * **BOTH SCREENS THAT DRAW THAT PANEL GET IT, WHICH IS WHY IT IS A HOOK.** Home
 * lists the same records on History's own builders (`rawOf`, `badgesFor`,
 * `titleOf`), and the first build of ADR 0240 fetched the record on History and
 * not on Home — so the same disclosure showed the whole dictation on one screen
 * and 160 characters of it on the other, with nothing saying it had been cut.
 * That is the drift `TranscriptRow` exists to prevent, one layer up.
 *
 * `null` while nothing is open, and `null` where the store no longer holds the
 * record: a row can be pressed after its record was deleted or pruned, and the
 * preview it was drawn from is then the honest thing to leave standing.
 */
export function useWholeTranscript(
  id: string | null,
  record: (id: string) => Promise<TranscriptionHistoryEntry | null>,
): WholeTranscript | null {
  const [whole, setWhole] = useState<WholeTranscript | null>(null);

  useEffect(() => {
    if (!id) {
      setWhole(null);
      return;
    }

    let live = true;
    void record(id).then((found) => {
      if (!live || !found) return;
      /* THE SAME TWO TEXTS THE RUNTIME PREVIEWED, on the same fallback:
         `TranscriptionHistorySummary::of` reads `written` as the transformed
         text where a mode wrote one and the heard text otherwise. A second
         rule here would put a different pair in the panel than in the row. */
      const heard = found.raw_transcript ?? "";
      setWhole({
        id,
        heard,
        written: found.transformed_transcript ?? heard,
        dropped: found.confidence_gate?.dropped ?? [],
      });
    });

    return () => {
      live = false;
    };
  }, [id, record]);

  /* THE ID TRAVELS WITH THE TEXT because the fetch outlives the row that asked
     for it: opening B while A is still in flight would otherwise draw A's
     dictation under B's heading. Every caller matches it against the row it is
     drawing. */
  return whole;
}
