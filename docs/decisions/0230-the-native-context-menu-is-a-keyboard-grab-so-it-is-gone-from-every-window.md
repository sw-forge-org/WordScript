# 0230 - The native context menu is a keyboard grab, so it is gone from every window

Date: 2026-08-18
Status: Accepted

## Context

Holding the capture key and clicking ended the dictation. The suspicion carried
into this leg was a **synthetic `KeyRelease`**: on X11 the core key path is
delivered through the passive grab and depends on focus, so the server can
fabricate a release for every key it believes to be down when focus moves. The
XInput2 raw stream cannot do that — it reports what the device did.

The vendored `global-hotkey` patch handles both paths side by side and the two
were indistinguishable downstream, so the first step was to tell them apart:
`GlobalHotKeyEvent` now carries `origin` (`Grab` | `RawDevice`), and the trigger
log prints `origin=grab` / `origin=raw` on every shortcut event.

**The measurement disproved the hypothesis.** Across the owner's session,
**44 shortcut events, 44 `origin=raw`, 0 `origin=grab`.** Not one release came
from the fabricable path.

What the owner's own reproduction found instead is sharper than the theory:

- **Left-click no longer aborts.** Right-click still does.
- **Only on a WordScript window.** Right- or left-clicking any foreign window
  does neither.
- **The menu outlives the overlay.** Right-clicking the overlay leaves the GTK
  popup on screen after the pill is gone, and **no new capture can start until
  it is dismissed** — the owner found this within a minute of the first test.

That last observation is the finding. WordScript **hides** its overlay rather
than closing it, so WebKitGTK's context-menu popup survives the surface that
spawned it. A GTK menu holds a keyboard grab for as long as it is open, and a
grab over an invisible window is a grab nobody can see to dismiss.

## Decision

**No WordScript window opens a native context menu, in any build.** A
document-level `contextmenu` handler calls `preventDefault()` before WebKitGTK
can show its popup.

**A DOM menu replaces it where there is room** — `Cut`, `Copy`, `Paste`,
`Select all` in editable fields, `Copy` on a plain text selection. It is a
`<div>` inside the webview: it holds no X grab and cannot outlive its window.

**The overlay gets suppression without a replacement.** Its window is pinned to
the pill's size (`min == max`), so a menu drawn inside it would be clipped by
the window bounds. `Ctrl+V` is untouched — the keyboard path never went through
a menu.

**A dev build keeps `Ctrl`+right-click as a door to the native menu**, so Inspect
Element stays reachable. Release builds need no such door and have no inspector
behind it: `wry` sets `enable_developer_extras` only when Tauri asks for
devtools, which it does under `debug_assertions`.

## Why not keep it in text fields

That was the owner's first instruction and they withdrew it themselves within
the same message: the defect is the menu, so a menu kept anywhere keeps the
defect there. Splitting it would have left the abort reproducible in exactly the
places a user types.

## Consequences

- The `contextmenu` handler yields to `event.defaultPrevented`, so a component
  that wants its own menu can still claim one; nothing does today.
- `Paste` needs `navigator.clipboard.readText()` and is drawn disabled where the
  webview does not offer it. A runtime rejection inserts nothing and says so in
  the console rather than reporting a paste that did not happen.
- Editing goes through `document.execCommand`, not `.value` assignment, so a
  controlled React input receives a real `input` event and undo history holds.
- **This is not proof that the grab is what ends the dictation.** The measured
  facts are that no release came from the fabricable path and that the menu holds
  the input until dismissed. The fix does not depend on separating those: it
  removes the menu, and with it the grab.

## References

- [ADR 0227](0227-every-route-into-a-native-reveal-goes-through-the-coalescer-and-a-driver-that-cannot-reach-its-target-says-so.md)
- [`known-issues/capture-shortcut-recording.md`](../known-issues/capture-shortcut-recording.md)
