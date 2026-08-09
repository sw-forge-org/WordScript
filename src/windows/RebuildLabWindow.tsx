import { WindowShell } from "@/components/shell";
import { useConfigDraft } from "@/hooks/useConfigDraft";
import { useRuntime } from "@/hooks/useRuntime";
import { DiagnosticsScreen } from "@/screens/Diagnostics";

/**
 * DIAGNOSTICS, POPPED OUT — the second window, and it is the SAME section.
 *
 * Plan §4.2 keeps Diagnostics' pop-out, and ADR 0054 forbids the old and the
 * new coexisting. `RebuildLabTab` satisfied neither after Leg 3: it was the
 * pre-port area, the ported screen replaced it in the settings sheet, and
 * leaving it here would have put two implementations of one section on two
 * surfaces of one product with no rule for which is right. So the pop-out
 * mounts the section, exactly as the sheet does — one implementation, two
 * mounts, which is what ADR 0055 means by props rather than copies.
 *
 * WHAT THAT COST IS PAID BACK. Leg 3 gave up about a thousand lines of real
 * checks against the native runtime and left this window a drawing with a
 * banner saying so. `DiagnosticsScreen` reads the runtime now — the slice, the
 * pipeline, the log — so the banner is gone and this window states what the
 * runtime states, on both of its mounts.
 *
 * IT READS THE RUNTIME FOR ITSELF, and that is not a second opinion of one
 * config: this is a separate webview with its own JavaScript context, so its
 * `useRuntime` is the one reader in ITS window. What must not happen — and does
 * not — is two readers inside one window.
 *
 * IT HAS NO CHROME OF ITS OWN. `WindowChrome` drew a title and a subtitle
 * inside the window, under the title bar the OS already draws. ADR 0003 gives
 * every window native decorations, so the name is the window manager's to state
 * — and stating it twice is exactly what the prototype's `.win-deco`
 * placeholder exists to say nobody should do.
 */
export default function RebuildLabWindow() {
  const { state, saveConfig } = useRuntime();
  const { form, patch, patchText, flushText } = useConfigDraft(state.config, saveConfig);

  if (!form) {
    return (
      <WindowShell>
        <div className="ws-content">
          <div className="ws-content-inner">Connecting to runtime…</div>
        </div>
      </WindowShell>
    );
  }

  return (
    <WindowShell>
      <div className="ws-content">
        <div className="ws-content-inner">
          {/* Always active: this window IS the section, so there is no state in
              which it is mounted and not being looked at. */}
          <DiagnosticsScreen
            runtime={{ config: form, state, patch, patchText, flushText, active: true }}
          />
        </div>
      </div>
    </WindowShell>
  );
}
