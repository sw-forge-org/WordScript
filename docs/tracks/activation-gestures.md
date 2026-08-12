# Hand-Off: Per-Mode Activation Gestures and Shortcut Defaults

Status: **Open. Nothing of this is built yet.** Written 2026-07-29 to carry the
work into a fresh session.
Date: 2026-07-29

This is a planning hand-off, not a record of finished work. It exists because a
small question — "why is there one set of default shortcuts for three
activation modes?" — turned out to sit on top of three missing capabilities.
Setting new default values first would produce a redistribution of the same
two-key combinations, which is precisely the thing that felt wrong.

Read [known-issues/capture-shortcut-recording.md](../known-issues/capture-shortcut-recording.md)
and ADRs [0007](../decisions/0007-capability-matrix-is-measured-not-assumed.md),
[0008](../decisions/0008-double-tap-is-the-default-activation-mode.md),
[0009](../decisions/0009-modifier-only-shortcuts-are-observed-not-grabbed.md)
and [0013](../decisions/0013-hold-to-talk-is-strictly-momentary.md) before
touching anything here. They contain the reasoning this plan builds on.

---

## What already shipped, so it is not redone

Immediately before this hand-off, in the same session:

- **Hold to talk was made strictly momentary** (ADR 0013). A press below
  `HOLD_ARM_MS` (300 ms) is discarded instead of extended into a recording.
  The microphone opens on the press edge and the session is withheld until the
  threshold, so committing loses no word. `hold_min_ms` and
  `TriggerEffect::DeferredStop` are gone; `StartCaptureProvisional`,
  `CommitHold`, `DiscardProvisional` and `DeferredHoldAction` replace them.
- **D11 was closed.** Hold to talk delivers and acts on both edges. The
  2026-07-25 record claiming it did nothing was wrong about the symptom.
- **A race introduced by the provisional window was fixed.** `HoldPhase`
  (`Idle`/`Provisional`/`Committed`) is explicit, and
  `sync_trigger_state_with_session` leaves a provisional hold alone. Before that
  it cleared `hotkey_active` mid-hold, the release was dropped as a release
  without a press, and the capture was stranded with the microphone open —
  surfacing as "A native audio capture is already active" and "No speech
  detected".

The threshold gates all three capture-lane bindings in hold mode. Tap and double
tap were deliberately left untouched.

---

## The goal

Each activation mode should ship with a gesture that suits it, and each gesture
should be one the user can actually perform without strain.

| Mode | The gesture that suits it | Why |
| --- | --- | --- |
| Tap to toggle | One press of a combination containing a **real key** | Every single press acts, so a modifier-only value takes that combination away from the whole desktop — the ADR 0008 argument |
| Double tap to toggle | Two taps of a **single modifier** | Two taps inside 400 ms practically never happen while typing. This is what macOS, Wispr Flow and superwhisper do |
| Hold to talk | Holding **one key that is never held during work** | `Ctrl`, `Alt`, `Super` and `Shift` are all held past 300 ms in ordinary use (multi-select, window drag, overview, text selection) |

Today none of the three can be expressed except the first, and the shipped
defaults are one set for all three: `Ctrl+Super` / `Ctrl+Space` / `Ctrl+Alt`
(`config.rs:1296-1306`).

Felix's judgement, and the reason this is not cosmetic: **holding or
double-tapping a two-key combination is exhausting.** Double tap and hold both
want a single key. Tap to toggle is the one mode where a combination is right.

---

## The three capability gaps

### A. The modifier-only minimum ignores the activation mode

`build_modifier_only` (`src-tauri/src/core/shortcut.rs:318-353`) requires two
modifiers unless `policy.interruption_signal` is set, and applies that rule
identically to all three activation modes.

The rule exists to separate "a deliberate tap of `Shift`" from "`Shift` pressed
to type a capital". **That question does not arise in double-tap mode**: two
taps of the same key inside `double_tap_window_ms` are themselves the
disambiguation. This is exactly why macOS can offer "double Command", "double
Control" and "double Option" as built-in Dictation presets without observing
anything, and why `KeyCombo(doubledCocoaModifiers:)` exists in libraries such as
[Magnet](https://github.com/DivineDominion/Magnet).

**Work:** make the minimum depend on the activation mode. Double tap accepts a
single modifier on every platform; tap and hold keep the stricter rule, where
the confusion with typing is real.

**Size:** small. It is a policy change plus the `Policy` plumbing to carry the
mode into `shortcut::parse`, and it needs the capability matrix (ADR 0007) to
report it honestly.

**Watch out:** `Policy` is currently derived from the session only
(`shortcut.rs:131-141`). Adding the activation mode to it touches every caller,
including validation and the recorder. The matrix must not start claiming a
single modifier is available in tap or hold mode.

### B. Modifiers cannot be told apart by side

`MODIFIER_TOKENS` (`src-tauri/src/core/shortcut.rs:14`) is
`["Ctrl", "Alt", "Shift", "Super"]` — side-agnostic. `ctrl_l` normalizes to
`Ctrl` and then grabs both keys. "Right Option" and "right Shift", the keys the
competition uses precisely because they are never held while typing, cannot be
expressed at all.

This is what makes hold to talk hard. Every key we *can* name is a key the user
holds during ordinary work.

**Work:** extend the token vocabulary with sided variants, keep the unsided
tokens meaning "either side", and make the recorder able to capture and display
the difference. `event.code` already distinguishes `ControlLeft` from
`ControlRight`, so the recorder side has the information; it is being discarded.

**Size:** medium. Vocabulary, normalization, display strings, the recorder, the
platform mapping in the vendored crate, and migration for existing values.

**Watch out:** ADR 0006 makes `core::shortcut` the single owner of the token
vocabulary. The UI must not grow a key table.

### C. The observation path exists only on Linux

`session_has_interruption_signal` (`src-tauri/src/core/shortcut.rs:131`) returns
`false` for `Windows` and `MacOs`. This has been read — including in this
session, wrongly — as a platform limitation. **It is not.** It is an
unimplemented path.

The observation lives in the **vendored crate**, not in our own source:

- `vendor/global-hotkey/src/platform_impl/x11/mod.rs` — implements raw-key
  observation and is the only place that ever sets `interrupted: true`
  (lines ~417, ~433).
- `vendor/global-hotkey/src/platform_impl/windows/mod.rs:183` — hardcodes
  `interrupted: false`.
- `vendor/global-hotkey/src/platform_impl/macos/mod.rs:407,413` — hardcodes
  `interrupted: false`.

The platform equivalents exist and are ordinary: `WH_KEYBOARD_LL` on Windows,
`CGEventTap` / `NSEvent.addGlobalMonitorForEvents(matching: .flagsChanged)` on
macOS (Accessibility permission, which PLATFORMS.md already documents as needed
for hold).

**Work:** extend the vendored crate on both platforms to observe modifier-only
shortcuts instead of grabbing them, and to report interruption, the way the x11
implementation does.

**Size:** large, and it carries a standing maintenance cost.

**Watch out:** the repo already keeps a vendored Windows patch that "must
survive vendor updates" (AGENTS.md). This adds two more. Decide deliberately
whether the patches go upstream instead — the alternative is carrying a fork of
a platform backend indefinitely.

**Note the dependency:** A alone already unlocks the single-modifier double tap
on all three systems, because double tap needs no interruption signal. C is
required for a single modifier in **tap** and **hold** mode, and for honest
capability reporting on Windows and macOS generally. C is not a prerequisite for
the double-tap gesture.

---

## The defaults, once A, B and C exist

Not decided. This is the shape the discussion had reached, to be confirmed
rather than implemented as-is:

| Mode | Start/Stop | Pause/Resume | Abort |
| --- | --- | --- | --- |
| Tap to toggle | combination with a real key | `Ctrl+Space` | combination with a real key |
| Double tap | single modifier | `Ctrl+Space` | single modifier |
| Hold to talk | a key never held at work (needs B) | `Ctrl+Space` | see the bug below |

`Ctrl+Space` is deliberately constant: it contains a real key, so it is
unproblematic in all three modes. Pause was the one binding with no genuine
mode dependency.

Per-OS equivalents were requested (`Super` → `Cmd` on macOS). Precedent exists
(commit `f2dde92` did per-OS defaults) but ADR 0008 warns that per-OS branching
in the defaults is what let a legacy migration corrupt the Windows default (D6).
If per-OS defaults return, they belong in **one** place in `core::config`, with
`core::trigger` delegating — never branched at both ends.

### Open questions that still need Felix

1. **Which concrete keys**, once B makes sided modifiers expressible. Right
   Option / right Shift are the competition's answer for hold; confirm before
   building.
2. **What a mode switch does to existing shortcuts.** Three candidates were on
   the table: rewrite only slots still holding another mode's untouched default
   (the pattern the Ctrl→Alt migration already uses, ADR 0011b); never touch
   anything automatically; or propose the values in Settings with an apply
   button. Unanswered. This decides whether the new defaults ever reach an
   existing installation — they otherwise apply only to a fresh config.
3. **Collision research.** Not done. What is actually bound on KDE Plasma 6,
   GNOME, Windows and macOS for each candidate, and what VoiceInk, Whispering
   and superwhisper ship as their per-OS defaults.

---

## Bugs found while planning, not yet fixed

- **Pause and abort act on an interrupted chord.** **Fixed on 2026-07-29 (ADR
  [0014](../decisions/0014-every-modifier-only-binding-is-decided-at-the-release-edge.md)),
  unobserved, and still open on Windows and macOS.** Recorded in full in
  [known-issues/pause-abort-interrupted-chord.md](../known-issues/pause-abort-interrupted-chord.md).
  Found by reading `core::trigger`, not measured. `event.interrupted` is read
  only in the `Released if is_hotkey` branch, never for pause or abort — and the
  press edge cannot know it in the first place, because the vendored crate only
  sets the flag on the *later* raw press.
  Writing the record corrected this hand-off's first version twice: the defect
  is **not hold-only**, and double tap is **not harmless**. In tap mode the
  shipped `Ctrl+Alt` abort fires the instant both modifiers are down, before the
  third key is pressed at all; in double-tap mode `double_tap_gate` counts an
  interrupted press like any other, so two `Ctrl+Alt+…` chords inside 400 ms
  abort. Hold is the slowest of the three, not the only one.
  **Fix direction:** put pause and abort on the same release-edge rule
  start/stop already uses for modifier-only shortcuts. Unlike start/stop, which
  has already opened a microphone and must be able to end it (ADR 0009), pause
  and abort have started nothing and can be withdrawn safely. Fixing this in the
  default value alone is not enough: it would still misfire for anyone who
  assigns `Ctrl+Alt` themselves.
- **The `[trigger]` log block for hold to talk has still not been captured.**
  The known-issues record asks for it and states what it should contain. The
  behaviour was observed by using the app; the transcript was not recorded, and
  the decision tokens changed with ADR 0013.

## Unrelated defects noticed in passing

Neither is caused by the work above; both are pre-existing and small.

- **Rust tests mutate process globals and fail at random.** Recorded in
  [known-issues/rust-test-global-state-isolation.md](../known-issues/rust-test-global-state-isolation.md).
  `record_appends_to_in_memory_ring_buffer` and
  `recorded_entries_carry_an_epoch_and_monotonic_timestamp` clear a shared
  global ring buffer other tests write into. Same class as the
  `workspace_context` pair around `WORDSCRIPT_PROJECT_ROOT`. The "two of five
  runs" figure in this hand-off's first version was a load-dependent snapshot:
  a 22-run measurement on 2026-07-29 failed twice.
  **Fixed 2026-07-29:** both sites assert through a seam instead of the global —
  a local `VecDeque` for the ring buffer, an argument for the project-root
  lookup. Ten consecutive parallel runs and `--test-threads=1` green.
- **ADR number 0011 is used twice**, by `0011-one-decision-surface-per-delivery-mode.md`
  and `0011-the-mode-lane-sits-on-alt-not-on-ctrl.md`. Both are now listed in
  `docs/decisions/README.md`, together with the reference audit and why the
  obvious cleanup is not free — the format rules there forbid renumbering.
  **Resolved 2026-07-29** by a disambiguating suffix rather than a new number:
  the delivery-surface record is `0011a`, the mode-lane record `0011b`. The
  reference audit recorded here and in `docs/decisions/README.md` was incomplete
  — it missed that the `Ctrl`-to-`Alt` entry in `CHANGELOG.md` and the migration
  precedent cited at "What a mode switch does to existing shortcuts" below both
  mean the mode-lane record, not the delivery surface. Cite these two with the
  suffix.

---

## Verification

Per the repo's rules, and because this lane cannot be judged from a browser
preview:

- `cd src-tauri && cargo test` and `cargo check` for the runtime.
- `npm test` and `npm run build` for the contract and the Settings surface.
- **A native session** (`npm run tauri dev`) for anything touching the trigger
  lane — `invoke()` and the event bridges need the host.
- For A: prove that a single modifier is accepted in double-tap mode and still
  rejected in tap and hold mode, on a session where
  `session_has_interruption_signal` is false. The capability matrix must report
  the same thing the parser enforces.
- For B: a sided value must survive a round trip through record → normalize →
  persist → register → display, and an existing unsided value must keep meaning
  "either side".
- For C: the press/release counters per binding are the existing evidence
  mechanism (ADR 0007). Windows and macOS must move from `unobserved` to
  `release_observed` on a real session before any capability is claimed.
- Windows and macOS have **never run this lane at all**
  ([known-issues/cross-platform-shortcut-verification.md](../known-issues/cross-platform-shortcut-verification.md)).
  C cannot be closed from a Linux machine.
