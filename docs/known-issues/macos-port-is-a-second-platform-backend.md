# macOS Is a Second Backend, Not a Port — Open

Status: **Open, recorded 2026-08-03.** Nothing on this page has been executed on
macOS. It is a scope record, not a measurement.

## The claim

Raised from outside the repo, in the form it was raised:

> The real blocker is a different one: WordScript is Wayland-first. On macOS
> there is no Wayland, no wlr-layer-shell, no ydotool/wtype injection. Overlay
> positioning, global hotkeys and text injection would have to be rebuilt from
> scratch — Accessibility API for injection, and for that the user needs
> explicit TCC permissions, which the app has to request cleanly in the first
> place. That is closer to a second backend than to a port. If the core (audio
> capture, STT pipeline, state handling) is cleanly separated from the platform
> layer, it is doable. If not, it becomes a refactor.

The conclusion holds. Two of its premises do not, and the mismatch matters,
because it moves the blocker from where the claim puts it to where it actually
sits.

Claims below are tagged the way
[cross-platform-shortcut-verification.md](cross-platform-shortcut-verification.md)
tags them: **[code]** — read from this repository. **[unverified]** — reasoning,
not evidence.

## What holds

### The overlay is the subsystem with no macOS path at all — **[code]**

This is the genuine blocker, and it is the one the claim names first.

- The overlay runs on **XWayland by default** (`GDK_BACKEND=x11`), with native
  Wayland as an opt-in (`WORDSCRIPT_NATIVE_WAYLAND=1`) — see
  [PLATFORMS.md](../PLATFORMS.md). Always-on-top on KDE Plasma 6 is bought with
  a **KWin script** shipped in `packaging/kwin-wordscript-overlay/`.
- Click-through was attempted and reverted: a cursor-position poller toggling
  `set_ignore_cursor_events` had no effect on the tested setup, and the recorded
  way forward is layer-shell (`src-tauri/src/lib.rs:2540`).
- Placement, parking, monitor work-area resolution and reveal live in
  `src-tauri/src/lib.rs`, and that file contains **no `target_os = "macos"`
  branch at all**. All 16 macOS branches in the runtime sit in `core/`
  (`paths.rs`, `shortcut.rs`, `workspace_context.rs`, `capture.rs`,
  `insertion.rs`) and are path, label and message strings plus a Cmd/Ctrl
  choice.

So the compositor-specific work is real, and none of it transfers: a KWin script
and a layer-shell plan have no macOS counterpart. The macOS equivalent is window
level and collection behavior on `NSWindow` (`NSFloatingWindowLevel`,
`canJoinAllSpaces`, `ignoresMouseEvents`), reached through the Tauri window
handle. Which of the overlay's invariants survive that — the placement rules and
CSS invariants in [REFERENCE.md](../REFERENCE.md), the parking behavior, the
dead-zone corner in
[overlay-stranded-off-screen.md](overlay-stranded-off-screen.md) — is
**[unverified]** and cannot be answered from Linux.

### Permissions are described but never requested or checked — **[code]**

The sharpest point in the claim, and it is correct.

- Accessibility and Input Monitoring appear only as **strings**:
  `core/insertion.rs:1441`, `core/shortcut.rs:789` and `:965`. There is no
  `AXIsProcessTrusted` call, no permission request, and no runtime probe of
  whether the grant exists.
- `src-tauri/tauri.conf.json` has a `dmg` bundle target but **no `bundle.macOS`
  block**: no entitlements, no usage-description strings, no signing or
  notarization configuration.
- Consequence for the honest-state rule this product is built on: the insert
  surface reports macOS as `Tier1` with `DirectPaste` whenever `auto_paste` is
  configured (`core/insertion.rs:1421`, `:1621`), independent of any grant. An
  ungranted macOS session is therefore expected to render "ready" and paste
  nothing **[unverified]** — the same failure class as the Windows
  registers-and-never-fires finding in the shortcut record, which the capability
  matrix was written to prevent.

Microphone access has the same shape one layer down: `core/capture.rs:1714`
tells the user where the setting is, after the failure.

### It is a backend, not a port

Agreed, for the two subsystems above. The overlay needs a second window strategy
written against AppKit semantics, and permissions need an acquisition path that
does not exist in any form today.

## What does not hold

### `ydotool`/`wtype` are not the Linux injection path either — **[code]**

Both are **deliberately skipped** on Linux ([PLATFORMS.md](../PLATFORMS.md),
"Linux Wayland -- deliberate default choice"). The Linux chain is `xdotool` over
XWayland, otherwise clipboard-only; `enigo` is reachable only when `xdotool` is
absent. So nothing is lost on macOS by their absence.

### Injection and hotkeys exist in code — untested, not missing — **[code]**

- **Insert:** macOS takes `arboard` for the clipboard and `enigo` for Cmd+V
  (`core/insertion.rs:1050`, `:1115`, `:1750`). That is the Accessibility path
  the claim asks for, one abstraction removed. It has never been run.
- **Hotkeys:** the vendored `global-hotkey` crate has a macOS backend (Carbon
  `RegisterEventHotKey`, `CGEventTap` as fallback). It has never been compiled
  for macOS on this machine, and until 2026-07-29 it did not compile at all
  (E0063, three `GlobalHotKeyEvent` literals). The modifier-only capture
  defaults are predicted to fail registration there. Full account and run sheet:
  [cross-platform-shortcut-verification.md](cross-platform-shortcut-verification.md).

"Rebuild from scratch" therefore overstates two of the three named subsystems and
understates the fourth, which the claim does not name: **the overlay's window
strategy is the only one with nothing written for macOS.**

### The core is separated, and it is separated in the right place — **[code]**

The claim's conditional resolves favorably. Capture (`cpal`), the STT lanes, the
transform stage, session orchestration and the reducer contract carry no
platform branches; the 16 macOS `cfg` sites are strings, a path root and one
modifier choice. The seam the repo already enforces — Rust owns the runtime,
React displays it — is not the seam at risk.

The seam that *is* missing is one layer lower: there is no platform-window
abstraction. Overlay window handling was written directly against the Linux
reality in `lib.rs`, with the compositor workaround pushed out into
`packaging/`. That is where a macOS build would first hit a refactor rather than
an addition, and it is a much narrower refactor than "core versus platform
layer" suggests.

## What would settle it, cheaply

Ordered by cost, all of it answerable without owning a Mac except the last:

1. **Build on `macos-latest`.** Compile the runtime and the vendored crate for
   macOS. This is the step that caught the E0063 class on Windows, and it has
   never run for macOS.
2. **Items 1–4 of the macOS run sheet** in
   [cross-platform-shortcut-verification.md](cross-platform-shortcut-verification.md)
   — registration outcomes, permission prompts, display strings — on a rented
   Mac. They decide the default rotation for every macOS first launch.
3. **Decide the overlay window strategy** against Tauri's macOS window API, and
   record which overlay invariants it can hold.
4. **Decide whether the permission state becomes runtime truth** — a probe the
   capability matrix and the insert readiness surface can read, instead of
   prose. Without it, macOS ships a "ready" state the product's own rules forbid.
5. Items 5–7 of the run sheet — key delivery with and without the grants — need
   real hardware.

Until at least 1 and 4 exist, the Tier 1 row for macOS in
[PLATFORMS.md](../PLATFORMS.md) describes implemented code and not a supported
platform, which is what its caveat already says.
