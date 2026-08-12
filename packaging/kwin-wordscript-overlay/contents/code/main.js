// WordScript Overlay Pin — force the overlay window onto KWin's OverlayLayer.
//
// Background: on KDE Plasma 6 / Wayland, `alwaysOnTop` (EWMH /
// gtk_window_set_keep_above) is compositor policy and KWin ignores it for
// xdg_toplevel clients. The only reliable always-on-top path on Wayland is to
// place the window on KWin's OverlayLayer (above fullscreen), which is only
// reachable via the KWin scripting API. See docs/STATUS.md ("Linux Wayland –
// Overlay Click-Through nicht loesbar") and docs/archive/handoffs/overlay-linux-black-block.md.
//
// Match: a WordScript window WITH skipTaskbar — that is the transparent overlay
// only. The Settings and Diagnostics windows keep their normal layer.
//
// `client.layer` may be read-only on some KWin 6 builds; the try/catch keeps the
// script safe and falls back to keepAbove (weaker, but still a stacking hint).

const WM_CLASS = "wordscript";

function pin(client) {
    const cls = (client.resourceClass || "").toLowerCase();
    if (cls !== WM_CLASS || !client.skipTaskbar) {
        return;
    }
    try {
        client.layer = 4; // KWin WindowLayer.OverlayLayer
    } catch (_) {
        // layer not settable on this KWin build — keepAbove is the fallback.
    }
    client.keepAbove = true;
}

function pinAll() {
    for (const client of workspace.windows) {
        pin(client);
    }
}

workspace.windowAdded.connect(pin);

// Re-apply after an output reconfiguration.
//
// The pin used to be applied on windowAdded only, i.e. exactly once per window
// lifetime. A monitor change (hotplug, resolution or DPI switch, dock, wake)
// makes KWin re-evaluate window placement and stacking, and nothing restored
// the OverlayLayer afterwards — so the overlay silently lost always-on-top for
// the rest of the session. Screen changes are also the trigger of the
// stranded-overlay failure the Rust side now recovers from
// (docs/known-issues/overlay-stranded-off-screen.md); handling both on the same
// event keeps the two halves of that recovery together.
//
// Signal names differ across Plasma 6 point releases, so every known spelling
// is connected defensively; a missing one is not an error worth failing on.
const screenSignals = [
    workspace.screensChanged,
    workspace.virtualScreenSizeChanged,
    workspace.virtualScreenGeometryChanged,
    workspace.outputAdded,
    workspace.outputRemoved,
];

for (const signal of screenSignals) {
    if (signal && typeof signal.connect === "function") {
        signal.connect(pinAll);
    }
}

// Re-apply to already-existing windows (script reload / KWin reconfigure).
pinAll();
