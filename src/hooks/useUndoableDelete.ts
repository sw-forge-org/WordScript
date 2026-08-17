import { useCallback, useEffect, useRef, useState } from "react";

/**
 * DELETE, HELD BACK FOR A FEW SECONDS SO IT CAN BE TAKEN BACK (ADR 0195).
 *
 * THIS DEPARTS FROM ADR 0082'S *DELETING ALWAYS ASKS*, and the departure is the
 * whole point rather than an oversight. That rule was written for objects you
 * delete one at a time and rarely — a profile, a folder, a replacement rule —
 * where a confirm is read because it is unusual. A transcript row is the other
 * case: it is deleted often and in runs, and a dialog on every row of a list
 * somebody is clearing stops being read by the third one. A confirm that is
 * clicked through is not a safety net, it is a delay with a safety net's
 * reputation. An undo window is read exactly when it matters — after the mistake
 * — and costs nothing when there was none.
 *
 * THE RUNTIME'S DELETE IS HARD AND TAKES THE FILE WITH IT.
 * `delete_transcription_history_entry` removes the entry AND calls
 * `remove_transcript_files`, and there is no restore. So the window cannot be
 * "delete, then put it back": it is the FRONTEND holding the row back, and the
 * `invoke` fires when the window closes. Nothing is destroyed until the reader
 * has stopped being able to change their mind.
 *
 * THREE CASES NEEDED AN ANSWER RATHER THAN A DEFAULT, and here they are:
 *
 *  1. **Leaving the screen with one pending** — it is flushed. A row that is
 *     hidden on one screen and present on another is one record with two
 *     answers; the reader asked for it gone and stopped looking, which is the
 *     end of the window rather than a reason to abandon it.
 *  2. **Closing the window with one pending** — it is flushed on the way out,
 *     from `pagehide` and `beforeunload` both. The promise is deliberately not
 *     awaited and does not need to be: `invoke` posts the message to the IPC
 *     channel synchronously, and the runtime outlives the webview. What must not
 *     happen is the row coming back on the next launch as though the delete had
 *     never been asked for.
 *  3. **A second delete inside the first one's window** — the first is committed
 *     immediately and the second starts its own window. One pending row, never a
 *     queue: a stack of undos is a stack of decisions the reader has to keep in
 *     their head, and the notice can only name one row at a time. Deleting three
 *     rows in a row is then exactly what it looks like — three deletes, the last
 *     of which can still be undone.
 */

/** How long the row is held back.
 *
 *  SIX SECONDS, WHICH IS THE TIME TO NOTICE RATHER THAN THE TIME TO DECIDE. The
 *  mistake this exists for — the wrong row — is seen the instant the row leaves,
 *  because what the eye checks is the row that is now where the old one was.
 *  Long enough to read the notice and reach it; short enough that a reader
 *  clearing a list is not dragging a tail of undecided deletes behind them. */
export const UNDO_WINDOW_MS = 6000;

export interface PendingDelete {
  id: string;
  /** What the notice calls it — the row's own title, so the sentence names the
   *  record rather than counting one. */
  title: string;
}

export function useUndoableDelete(commit: (id: string) => unknown) {
  const [pending, setPending] = useState<PendingDelete | null>(null);
  const timer = useRef<number | null>(null);
  /* THE COMMIT AND THE PENDING ROW ARE BOTH READ FROM REFS, and that is not
     ceremony. The teardown effect below must run exactly once — an effect that
     re-ran whenever `commit` changed identity would flush a live window on every
     render of the screen that owns it, which is the undo silently not working
     rather than a crash. */
  const held = useRef<PendingDelete | null>(null);
  const act = useRef(commit);
  act.current = commit;

  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  /** End the window by carrying it out. Safe to call with nothing pending. */
  const flush = useCallback(() => {
    clearTimer();
    const row = held.current;
    held.current = null;
    setPending(null);
    if (row) act.current(row.id);
  }, []);

  /** Ask for a row to go, in a few seconds' time. */
  const request = useCallback(
    (id: string, title: string) => {
      /* Case 3. The one already pending is carried out before this one starts,
         so there is never more than one window open. */
      flush();
      held.current = { id, title };
      setPending({ id, title });
      timer.current = window.setTimeout(flush, UNDO_WINDOW_MS);
    },
    [flush],
  );

  /** End the window by abandoning it. The runtime was never told. */
  const undo = useCallback(() => {
    clearTimer();
    held.current = null;
    setPending(null);
  }, []);

  useEffect(() => {
    const onLeave = () => {
      const row = held.current;
      held.current = null;
      if (row) act.current(row.id);
    };
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
      clearTimer();
      /* Case 1, and it is the unmount rather than a route change because this
         shell keeps every visited view mounted — so the screen going away IS the
         component going away. */
      onLeave();
    };
  }, []);

  return {
    pending,
    /** Whether a row is being held back and must not be drawn. */
    hides: useCallback((id: string) => pending?.id === id, [pending]),
    request,
    undo,
  };
}
