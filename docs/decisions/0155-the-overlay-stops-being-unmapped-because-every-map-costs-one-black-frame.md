# 0155: The overlay stops being unmapped, because every map costs one black frame

Date: 2026-08-15
Status: Accepted

## Context

The owner reported that starting a recording flashes the whole overlay window
black for a fraction of a second before it turns transparent and only the pill
remains. Reported as "maybe you just have to live with it".

It reproduced on every recording start, not only the first after app start.
That distinction is what located it: a per-session flash follows the per-session
park→reveal cycle, and every reveal ends in `window.show()` — which under
XWayland (`main.rs` forces `GDK_BACKEND=x11`) is a fresh X11 map. KWin
composites a newly mapped window before WebKitGTK has delivered its first frame
with alpha, so for exactly one frame the uninitialised backing store is
presented: the full 480×60 rectangle, black.

Everything the reveal path already did against black surfaces aims at a
different moment and could not catch this one. The three
`set_background_color(0,0,0,0)` calls answer the documented WebKitGTK resize
behaviour (the newly exposed area of a resized transparent window stays black),
and GTK's own paint is transparent regardless — tao fills with alpha 0 under
`auto_transparent`, which is on for `transparent: true` windows. The black
arrives after GTK, in the compositor, at map time.

Two attempts, in order:

**Opacity gate around the map** (park sets GTK window opacity to 0, a
generation-gated timer restores 1.0 two frames after the reveal). The owner
measured it as *better but still there*, and — the deciding observation — still
the full window rectangle, still **before** the pill appears. So it was still
the map frame: KWin does not reliably apply the `_NET_WM_WINDOW_OPACITY`
property GTK sets to the very first frame of a window it is only just starting
to manage. Against the map itself, no timing helps.

**Not mapping.** The map is not required. `park_overlay_window` called `hide()`
for a reason that turns out not to depend on the unmap.

## Decision

**On Linux the overlay window is mapped exactly once, at setup, and never
unmapped again. Parking is opacity 0 plus click-through.**

1. Setup maps it offscreen at opacity 0 with `set_ignore_cursor_events(true)`.
   That spends the one unavoidable map frame once per process, offscreen, behind
   opacity 0 — where nobody is looking.
2. `park_overlay_surface` (Linux) sets opacity 0, then click-through, then the
   offscreen move. It runs on the GTK main thread because that order has to
   hold: opacity is set on the GtkWindow directly and takes effect at once,
   while the move is queued behind it. The reverse order drags a still-visible
   pill across the screen on every session end.
3. The reveal restores opacity and click-through together, through the same
   generation-gated timer. It now covers the `set_size` rather than the map, and
   keeps the pill from eating clicks while it cannot be seen.
4. **Windows and macOS keep `hide()` unchanged.** The map frame is an X11/KWin
   behaviour; there is no reason to hand the other platforms an untested parking
   mechanism for a problem they do not have.

**What made `hide()` look load-bearing, and why it is not.** Parking had to
clear visibility so the next reveal runs the hidden→visible branch that places
the window — without that, the drag-snap guard skips repositioning and the
overlay vanishes from the second transcription onward. But that guard reads
`OVERLAY_WINDOW_SHOWN`, not the native map state, and has done since the tracker
was introduced because `window.is_visible()` lies on XWayland. Park still clears
the tracker. The placement path, ADR 0022's stranded rescue included, is
untouched by dropping the unmap.

The Linux-only access needs the `gtk` crate named directly in `Cargo.toml`
(target-gated), because tao exposes no window opacity. It was already in the
tree transitively; the version must track tauri's on every upgrade, or
`gtk_window()` returns an `ApplicationWindow` from the other one and the call
stops compiling.

## Consequences

- **The flash is structurally impossible on a recording start**, rather than
  timed against. Confirmed by the owner on KDE Plasma 6 / XWayland.
- **A parked overlay is now mapped-but-invisible, which is exactly the state
  [known-issues/overlay-stranded-off-screen.md](../known-issues/overlay-stranded-off-screen.md)
  warned about**: "on a layout whose bottom-right corner *is* on a monitor, a
  parked-but-not-hidden pill would be visible there." It is invisible because
  opacity carries the parking now. If opacity ever fails to apply on some
  compositor, the failure mode is a permanently visible pill between sessions —
  loud and immediately diagnosable, not silent.
- **The park move becomes effective for the first time, and that is an open
  risk.** The same document measured all 482 parks as landing somewhere other
  than requested — GTK does not move a hidden window — and found 31 of them at
  the dead-zone corner `(3840,1507/1508)`, calling that clamp the strongest
  candidate for the 65 strandings. A mapped window actually moves. The next
  reveal overwrites the position through the hidden→visible branch, and the
  tracker fix means that branch is now reliably taken, so the exposure is
  smaller than when those strandings were measured — but the move went from
  never effective to always effective, and whether it should simply be deleted
  is a question this ADR opens rather than answers.
- **A crash on the way is worth recording, because the next person will write
  the same line.** `set_ignore_cursor_events(true)` was ordered before `show()`
  in setup. tao answers that request with `window.window().unwrap()` on the
  GdkWindow, which exists only once the widget is realized — on a window that
  has never been mapped, the unwrap aborts the process at startup. Both requests
  travel the same FIFO queue, so ordering click-through after `show()` is enough.
  Opacity must stay in front of it: it is set on the widget directly and has to
  be in place before the map.
- **The 40 ms restore delay is added to every reveal**, hotkey to visible pill.
  It buys the resize coverage that the opacity gate contributed and is kept for
  that; it is not needed for the map any more.
- This supersedes the durable constraint in
  [archive/handoffs/overlay-linux-black-block.md](../archive/handoffs/overlay-linux-black-block.md)
  ("native parking now calls `hide()`, ensuring the next reveal follows the
  hidden-to-visible placement path"). The goal it names still holds; the
  mechanism that reaches it changed.
