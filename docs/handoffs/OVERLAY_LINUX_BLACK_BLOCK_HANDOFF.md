# Hand-Off: Linux Overlay Stabilization

Status: **Implemented 2026-06-20**

This historical hand-off records the Linux overlay fixes validated on KDE Plasma
6 under Wayland and XWayland. Click-through to applications below the overlay
remains a layer-shell limitation.

## Resolved Issues

- **Black blocks:** WebKitGTK painted outer shadows on transparent windows as
  opaque black. `--ov-shadow` and `--ov-shadow-recording` are disabled; depth
  comes from border and inset highlight.
- **No input:** `pointer-events: none` made the WebKitGTK overlay deaf. The
  active overlay scope uses `pointer-events: auto`.
- **Always on top:** KWin ignores the client keep-above request under Wayland.
  `packaging/kwin-wordscript-overlay/` sets the WordScript window to overlay
  layer 4. Install with `kpackagetool6` and reconfigure KWin.
- **Invisible next session:** native parking now calls `hide()`, ensuring the
  next reveal follows the hidden-to-visible placement path.
- **Clipping:** Rust and UI use fixed 440x60 flat and 460x164 edit surfaces;
  GTK requires the overlay to remain resizable for programmatic sizing.

## Durable Constraints

- Reassert native background color on every reveal.
- Use XWayland by default; `WORDSCRIPT_NATIVE_WAYLAND=1` opts into native
  Wayland.
- Do not restore dynamic pill measurement or blur/shadow effects.
- Validate all overlay changes in the native Linux host.
