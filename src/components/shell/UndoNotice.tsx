import { Button } from "./Button";
import { Icon } from "./Icon";

/**
 * WHAT JUST HAPPENED, AND THE ONE SECOND CHANCE IT COMES WITH (ADR 0195).
 *
 * THERE IS NO TOAST SURFACE IN THIS SHELL AND THIS IS NOT ONE.
 * `components/ui/toast.tsx` is mounted nowhere, and mounting it for this would
 * bring a stacking, timing and placement system into the product for one
 * sentence. A toast also floats over the surface it is about, which is exactly
 * wrong here: the reader is looking at the LIST, and the fact worth telling them
 * is about a row that has just left it. So the notice stands where the row was —
 * in the flow, at the head of the list, pushing it down by one line.
 *
 * IT IS THE ONLY THING ON EITHER SCREEN THAT IS NOT STANDING STATE. History's
 * foot lost its recited sentence in ADR 0184 for exactly that reason, and this
 * obeys the same rule: it appears when there is something to report and is
 * absent the rest of the time.
 *
 * NO COLOURED EDGE BAR AND NO TONE. A delete somebody asked for is not a
 * warning, and a strip painted in `--accent` at the head of a list would be the
 * loudest thing on the screen for six seconds — the same defect ADR 0193 took
 * off the delivery badges one screen over. The ground plus the icon tile is the
 * differentiation this shell already uses.
 *
 * `role="status"` RATHER THAN `alert`. It is polite: a screen reader announces
 * it at the next pause instead of interrupting whatever the reader is doing,
 * which is right for a thing that reports a completed action.
 */
export function UndoNotice({
  what,
  onUndo,
}: {
  /** The row's own title, so the sentence names the record. */
  what: string;
  onUndo: () => void;
}) {
  return (
    <div className="ws-undo" role="status">
      <span className="ws-undo-tile" aria-hidden>
        <Icon name="trash" />
      </span>
      {/* THE TITLE IS TRUNCATED BY THE STYLESHEET AND NOT BY A SLICE. A record
          named by the model runs to a full line, and cutting it here would put a
          second opinion of "too long" in the tree — the list itself already
          answers that question one line below. */}
      <span className="ws-undo-text">
        Deleted <b>{what}</b>
      </span>
      <Button variant="ghost" icon={<Icon name="restore" />} onClick={onUndo}>
        Undo
      </Button>
    </div>
  );
}
