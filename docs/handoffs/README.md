# Hand-Off Documents Archive

Completed implementation specifications and hand-offs live here after their
branch has merged. They are historical references for code, tests, and follow-up
slices, not active product contracts.

Naming: `HANDOFF_<branch-or-slug>.md`

## Contents

- [Capture Shortcut Lane Rebuild](HANDOFF_shortcut-lane-rebuild.md): **active**,
  branch `worktree-shortcut-lane-rebuild` not yet merged — all slices S0-S8
  implemented, the invariants to preserve, and the one physical measurement that
  still needs a person at the keyboard.

- [Overlay Mode-Cycling Ghosting - Accepted State](OVERLAY_MODE_CYCLING_GHOSTING_ACCEPTED.md): accepted operational state with permanent development-only diagnostics.
- [Overlay Mode-Cycling Ghosting - Residual](OVERLAY_MODE_CYCLING_GHOSTING_RESIDUAL.md): predecessor investigation that reduced residual artifacts.
- [Hotkey Cross-Platform Fix](HOTKEY_HANDOFF_easy-wins-hotkey-hygiene.md): historical cross-platform hotkey work, superseded by current per-mode hotkey behavior.

## Convention

- Move a completed specification here when its branch merges.
- Record supersession at the top of the affected hand-off, not in the changelog.
- Give an active follow-up specification a new descriptive filename rather than
  a version suffix.
