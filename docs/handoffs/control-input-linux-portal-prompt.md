# Hand-Off: Linux Portal Control-Input Prompt

Status: **Implemented historical record**

## Problem

KDE Plasma, GNOME Mutter, Hyprland, Sway, and KDE Plasma 5 could repeatedly
show a "Remote Control / Control input devices" prompt even after pure-Wayland
auto-paste had been disabled. Native fallback drivers and XWayland `xdotool`
could still trigger portal behavior, while the runtime had no useful diagnosis.

## Delivered Contract

- `core::portal` detects compositor, session, portal capabilities, daemon
  status, and restore-token availability.
- Insertion classifies portal-prompt stderr from `xdotool`, `wtype`, `ydotool`,
  and `enigo`, records the driver and reason, and falls back to clipboard-only
  with a precise next step.
- KDE Plasma 6 and GNOME can request a RemoteDesktop session through the session
  bus and persist a restore token under `$XDG_RUNTIME_DIR/wordscript/`.
- Settings surfaces show compositor, portal state, session status, and the last
  prompt signal rather than a generic insertion failure.

## Guardrails

Pure Wayland must not retry privileged input drivers blindly. `local` automatic
paste support remains desktop-environment dependent; clipboard recovery is the
safe fallback. See [PLATFORMS.md](../PLATFORMS.md) for current support behavior.
