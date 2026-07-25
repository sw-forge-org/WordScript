# Hand-Off: Settings Scroll Performance

Status: **Implemented and validated 2026-06-21**

## Problem

Settings scrolling was severely janky, especially on large Linux WebKitGTK
windows and long history, profile, and rule surfaces.

## Root Causes

- `WEBKIT_DISABLE_COMPOSITING_MODE=1` forced Cairo software rendering.
- Card shadows, `backdrop-filter`, animated color transitions, and a scrolling
  page gradient multiplied per-frame compositor cost.
- Frequent history refresh and broad re-renders compounded the cost.

## Resolution

- GPU compositing is enabled by default; use
  `WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING=1` only for affected hardware.
- Keep `WEBKIT_DISABLE_DMABUF_RENDERER=1`.
- Remove card shadows and `backdrop-filter`; use background elevation and
  borders instead.
- Use fixed background attachment, scroll/container containment, stable gutters,
  and content visibility for long lists.
- Remove tab crossfades and transition-heavy scroll controls.
- Refresh history every five seconds while retaining a manual refresh action.

## Guardrail

Validate scrolling in the native host. Do not restore blur or shadow-heavy
surfaces without a measured platform-safe replacement.
