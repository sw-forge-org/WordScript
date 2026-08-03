# Hand-Off Documents Archive

Completed implementation specifications and hand-offs live here after their
branch has merged. They are historical references for code, tests, and follow-up
slices, not active product contracts.

Naming: `HANDOFF_<branch-or-slug>.md`

## Contents

- [GUI Port Relay](HANDOFF_gui-port-relay.md): **active, opened 2026-08-04.**
  The chain document for moving the settings rework from prototype to product.
  Carries the two decisions it rests on (ADR 0054, ADR 0055), the rules every
  leg obeys, the six-leg map, the active leg's full specification, the leg log,
  and the prompt for the next leg. Each leg works on `main`, ends green, pushes,
  and writes the next prompt into it. Supersedes
  [GUI_REWORK_THIRD_PASS.md](GUI_REWORK_THIRD_PASS.md), whose work is done.
- [Per-Mode Activation Gestures and Shortcut Defaults](HANDOFF_activation-mode-gestures-and-defaults.md):
  **open — nothing built yet**, written 2026-07-29. The only forward-looking
  document in this folder. Why one set of shortcut defaults cannot serve three
  activation modes, the three capability gaps that block a per-mode gesture
  (mode-aware modifier minimum, sided modifier tokens, the observation path on
  Windows and macOS), and the decisions still owed.
- [Capture Shortcut Lane Rebuild](HANDOFF_shortcut-lane-rebuild.md): merged
  2026-07-25 — the shortcut contract rebuild (S0-S8), the invariants it
  established and the decisions behind them. The work it left open did not stay
  in this file; it is indexed at the top of it.
- [Overlay Mode-Cycling Ghosting - Accepted State](OVERLAY_MODE_CYCLING_GHOSTING_ACCEPTED.md): accepted operational state with permanent development-only diagnostics.
- [Overlay Mode-Cycling Ghosting - Residual](OVERLAY_MODE_CYCLING_GHOSTING_RESIDUAL.md): predecessor investigation that reduced residual artifacts.
- [Hotkey Cross-Platform Fix](HOTKEY_HANDOFF_easy-wins-hotkey-hygiene.md): historical cross-platform hotkey work, superseded by current per-mode hotkey behavior.

## Convention

- Move a completed specification here when its branch merges.
- Record supersession at the top of the affected hand-off, not in the changelog.
- Give an active follow-up specification a new descriptive filename rather than
  a version suffix.
