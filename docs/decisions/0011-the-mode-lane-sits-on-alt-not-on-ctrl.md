# 0011: The Mode Lane Sits On Alt, Not On Ctrl

Date: 2026-07-27
Status: Accepted

## Context

The mode lane — mode select plus the six per-mode jumps — shipped on `Ctrl`:
`Ctrl+S`, `Ctrl+1`-`Ctrl+6`. These are global grabs, so they are taken away from
every other application on the desktop
([0009](0009-modifier-only-shortcuts-are-observed-not-grabbed.md) removed the
grab only for *modifier-only* shortcuts; a modifier-plus-key shortcut is still a
grab, and must be, or it would also reach the focused window).

Taking a combination away from the desktop is the accepted price of a global
shortcut. The question is which combinations are worth that price, and the
`Ctrl` lane picked the two worst candidates a writing tool could pick:

- `Ctrl+S` is **save** in every editor, IDE and browser-based document tool on
  Windows and Linux, and its `Cmd+S` sibling is the same reflex on macOS. A
  dictation product whose users are heavy writers cannot take save away from
  them.
- `Ctrl+1`-`Ctrl+6` is **tab switching** in every browser on Windows and Linux,
  and the same shortcut selects headings in most editors.

Both were documented as a deliberate consequence in `docs/REFERENCE.md` rather
than as an oversight. That framing was honest but wrong on the merits: a default
that collides with a reflex the user performs dozens of times an hour is not a
tradeoff, it is a defect the user has to repair by hand before the product is
usable.

## Decision

The whole mode lane moves to `Alt`:

| Binding | Was | Now |
| --- | --- | --- |
| Mode select | `Ctrl+S` | `Alt+S` |
| Auto | `Ctrl+1` | `Alt+1` |
| Verbatim | `Ctrl+2` | `Alt+2` |
| Cleanup | `Ctrl+3` | `Alt+3` |
| Rewrite | `Ctrl+4` | `Alt+4` |
| Agent | `Ctrl+5` | `Alt+5` |
| Prompt Enhance | `Ctrl+6` | `Alt+6` |

One stored value per binding, on every platform — the single-rotation rule from
the shortcut lane rebuild stands. The platform "pendant" is a rendering
question, not a storage question: `core::shortcut::display_modifier` already
renders `Alt` as `Option` on macOS, so macOS users read `Option+S` and
`Option+1`-`Option+6` while Windows and Linux read `Alt+…`, from the same
canonical `Alt+S`.

Existing configs are moved once, gated on `SHORTCUT_SCHEMA_VERSION` (1 -> 2).
The migration is per slot and conservative: it rewrites a slot only when the
slot still holds exactly its old `Ctrl` default, it skips a slot whose new value
is already assigned to another binding, and it leaves empty slots (meaning
"disabled") alone. A `Ctrl+S` entered by the user after the migration ran is
never touched, because the version gate makes the rule one-shot (the D6 lesson:
a migration that fires on every save rewrites what the user just chose).

## Consequences

- Save and browser tab switching come back to the desktop for every user who
  never customized the lane.
- `Alt` is not free either, and this is not claimed as a collision-free lane:
  `Alt+letter` opens menus by mnemonic in some Windows and Linux applications,
  `Alt+1`-`Alt+9` switches tabs in Firefox on Windows and Linux, and on macOS
  `Option+letter` / `Option+digit` types a special character wherever the grab
  does not apply. The trade is deliberate: these are occasional collisions in
  specific applications, where `Ctrl+S` was a universal one.
- The registerability and collision-freedom of the new rotation are covered by
  the existing default assertions (`every_default_shortcut_satisfies_the_contract`,
  `defaults_survive_normalization_unchanged`); the migration has its own tests
  for the moved lane, the preserved user value and the occupied-target skip.
- Anything that quotes the old defaults as current — the archived handoff
  `docs/handoffs/HANDOFF_shortcut-lane-rebuild.md` in particular — is historical
  record and stays unedited. `docs/REFERENCE.md` is the current source of truth
  for the rotation.
