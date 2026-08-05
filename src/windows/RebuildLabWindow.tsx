import { PreviewBanner, WindowShell } from "@/components/shell";
import { DiagnosticsScreen } from "@/screens/Diagnostics";

/**
 * DIAGNOSTICS, POPPED OUT — the second window, and it is the SAME section.
 *
 * Plan §4.2 keeps Diagnostics' pop-out, and ADR 0054 forbids the old and the
 * new coexisting. `RebuildLabTab` satisfied neither after this leg: it was the
 * pre-port area, the ported screen replaced it in the settings sheet, and
 * leaving it here would have put two implementations of one section on two
 * surfaces of one product with no rule for which is right. So the pop-out
 * mounts the section, exactly as the sheet does — one implementation, two
 * mounts, which is what ADR 0055 means by props rather than copies.
 *
 * WHAT THAT COSTS, SAID PLAINLY. `RebuildLabTab` ran real checks against the
 * native runtime and this window is a drawing of them now. It is the largest
 * single thing Leg 3 gave up, it is Leg 4's to put back, and it is why the
 * banner here is longer than the sheet's: this window has no masthead of its
 * own to qualify it.
 *
 * IT HAS NO CHROME OF ITS OWN EITHER. `WindowChrome` drew a title and a
 * subtitle inside the window, under the title bar the OS already draws. ADR
 * 0003 gives every window native decorations, so the name is the window
 * manager's to state — and stating it twice is exactly what the prototype's
 * `.win-deco` placeholder exists to say nobody should do.
 */
export default function RebuildLabWindow() {
  return (
    <WindowShell>
      <div className="ws-content">
        <div className="ws-content-inner">
          <DiagnosticsScreen
            banner={
              <PreviewBanner>
                Drawn, not wired — the checks, the preview and the log are sample data. The
                real runtime diagnostics this window ran before the port are Leg 4&apos;s to
                restore.
              </PreviewBanner>
            }
          />
        </div>
      </div>
    </WindowShell>
  );
}
