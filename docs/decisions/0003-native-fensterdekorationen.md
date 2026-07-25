# 0003: Native Window Decorations on Every Platform

Date: 2026-06-20
Status: Accepted

## Context

The initial UI overhaul proposed a frameless main window with custom chrome.
Fake controls and custom chrome caused visual instability and scroll cost on
Linux/WebKitGTK. The choice was between preserving platform imitation or using
native decorations and expressing the product style in content.

## Decision

Use native window decorations (`decorations: true`) on every platform for the
main window and diagnostics pop-out. Do not use frameless main windows,
`titleBarStyle: "Overlay"`, `macOSPrivateApi` for the main window, or fake
traffic lights. The utility feel comes from sidebar rhythm, grouped form cards,
controls, typography, and restrained motion.

The transparent, always-on-top overlay remains a separate window model with
`decorations: false` and `skipTaskbar: true`.

## Consequences

- Settings scroll more reliably on Linux and retain one dominant content surface.
- No platform-fake chrome appears in product content or Diagnostics.
- `macOSPrivateApi`, where needed, is reserved for the transparent overlay.
- This decision supersedes older custom-chrome notes in the UI planning history.
