import { useParams } from "react-router-dom";
import { AskPopout, ActionsPopout } from "@/screens/Context";
import { MeetingHud } from "@/screens/Meeting";
import type { PopoutSurface } from "./popout";

/**
 * THE ROUTE THE THREE WINDOWS OPEN ON.
 *
 * It renders the window's contents and nothing around them: no `ViewTop`, no
 * preview banner, no page padding. A window is its content — the frame is the
 * compositor's (ADR 0003), and this route is the first place in the port where
 * that is literally true rather than stood in for.
 *
 * WHICH IS WHY THE STAND-IN STRIP IS GONE HERE. `HudDeco` and `ChatWinDeco`
 * exist because a box inside the workspace has no frame and needs to show where
 * one would be. A real window has one, and drawing both would be two title bars
 * — the fake-traffic-lights defect `CLAUDE.md` forbids, arrived at from the
 * other direction.
 *
 * NOTHING HERE IS WIRED, and the window does not pretend otherwise. It is the
 * same drawn specimen the gallery shows; what is new is that you can put it
 * beside a real call and find out whether 330 px is enough.
 */
export default function PopoutWindow() {
  const { surface } = useParams<{ surface: PopoutSurface }>();

  return (
    <div className="ws-popout-root" data-surface={surface}>
      {surface === "meeting" && <MeetingHud tab="Summary" bare />}
      {surface === "ask" && <AskPopout bare />}
      {surface === "actions" && <ActionsPopout bare />}
    </div>
  );
}
