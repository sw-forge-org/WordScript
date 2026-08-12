# Hand-Off: Overlay Phase 1

Status: **Historical implementation record**

`OverlayPill` is render-only and receives a discriminated-union state. It owns
no session semantics; interactions are callback props that route to native
runtime commands.

## States

- recording, including muted and paused variants
- processing, including preview
- result actions, including the `clipboard_only` variant
- edit mode, error, and action-pending variants

## Locked Principles

- Actions use accessible icon controls with `title` and `aria-label`.
- The overlay renders actual native state and does not create frontend recovery
  or insertion semantics.
- Transparent Linux overlays use faux glass only: no `backdrop-filter`.
- Result and preview surfaces remain compact; a broader controlled-commit UI is
  deferred until the native contract exists.
- Native host behavior, fixed sizing, parking, and placement rules are part of
  overlay correctness, not optional styling.

See [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md) and [AGENTS.md](../../../AGENTS.md) for
the active rules that supersede detailed historical implementation notes.
