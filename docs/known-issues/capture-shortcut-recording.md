# Capture Shortcut Recording and Registration

Status: **Resolved for the activation modes (2026-07-29). S0-S8 implemented. D11
is closed: hold to talk delivers and acts on both edges; the real defect was its
threshold semantics, corrected under ADR 0013 — see [Second physical result
(2026-07-29)](#second-physical-result-2026-07-29-hold-to-talk-acts-on-both-edges)
below. One open item remains: the physical half of the S0 measurement.**

## Current State (2026-07-25)

Slices S0-S8 from the plan below were implemented on branch
`worktree-shortcut-lane-rebuild`. What changed:

| Defect | State |
| --- | --- |
| D1 recorder commits on first key release | Fixed — recording ends only on confirm, cancel, blur or timeout |
| D2 single modifier becomes a bare OS-wide grab | Fixed — a single bare modifier is rejected; modifier-only needs two |
| D3 `pause_native_trigger` does not release grabs | Fixed — it unregisters every capture and mode grab; Modes calls it too |
| D4 manual entry destroyed by instant save | Fixed — the field edits a local draft, committed on blur/Enter |
| D5 two divergent normalizers | Fixed — `core::shortcut` is the single owner (ADR 0006) |
| D6 persist-time truncation of three combinations | Fixed — truncation removed, legacy rewrites version gated |
| D7 collision validation before normalization | Fixed — normalize first, then validate |
| D8 recorder vocabulary smaller than the runtime's | Fixed — the UI reads the runtime vocabulary and has no key table |
| D9 physical key codes shown as US labels | Improved — human display strings everywhere, physical-key caveat stated |
| D10 no test coverage for the recorder | Fixed — `HotkeyRecorder.test.tsx` covers the lifecycle rules |
| D11 hold to talk not supported in practice | **Closed (2026-07-29)** — both edges arrive and both act. The 2026-07-25 reading was wrong about the symptom: the mode was not doing nothing, it was doing the same thing for every press length, because `hold_min_ms` extended a short hold instead of discarding it. Fixed under ADR 0013; see the second physical result below |
| D12 trigger lane has no observability | Fixed — every event, decision and registration outcome is logged |

What S6 and S7 delivered:

- **S6 Activation modes.** A hold that exceeds `hold_watchdog_seconds` (default
  120) is ended explicitly with reason `native_hold_watchdog` instead of drifting
  into the silence timeout. A hold shorter than `hold_min_ms` becomes a
  `DeferredStop` so a short tap in hold mode has defined behavior instead of
  producing an empty capture. `hold_min_ms`, `debounce_ms`,
  `hold_watchdog_seconds` and `double_tap_window_ms` are reported in
  `native_trigger_status` and stated in the Settings row, so the timing constants
  are no longer invisible. Double-tap activation is implemented and is now the
  default (ADR 0008). The activation selector is gated on the capability matrix:
  an option this session cannot honor is unselectable with the runtime's reason.
- **S7 Per-OS capability matrix.** `core::shortcut::capability_matrix` derives,
  per session, a state (`available` / `conditional` / `unavailable`) and a reason
  for each activation mode and key class. It is a pure function of the session
  facts from `shortcut_platform` plus the `ReleaseEvidence` measured from the
  trigger lane's own counters, exposed to the UI as `shortcut_capabilities` and
  asserted in tests across all five session kinds and all three evidence states.
  The human-readable rendering is in
  [PLATFORMS.md](../PLATFORMS.md#shortcut-capability-matrix).

**The design decision that matters here**, recorded as ADR
[0007](../decisions/0007-capability-matrix-is-measured-not-assumed.md): the
matrix does not contain a per-OS verdict on hold to talk. Writing "hold works on
Windows, not on Linux Wayland" would have encoded a guess — nothing has been
measured on Windows or macOS, and on Linux the XTEST run below found
nondeterminism rather than a clean negative. Instead hold follows the evidence on
every platform, and the session type contributes only a caveat sentence naming a
plausible cause. Consequently **the physical measurement can only tighten the
matrix, never invalidate it**: if physical keys lose releases on XWayland as
reliably as XTEST did, the change is one branch (`LinuxXWayland` gets a hard
`unavailable` for hold regardless of the counters).

### S0 measurement, run 1 (2026-07-25, KDE Plasma 6 / Wayland session, app on XWayland)

Method: the rebuilt dev build running in the native host, keys injected through
XTEST (`xdotool`) on the mode-select shortcut `Ctrl+F11`, which is harmless — it
opens the overlay selector and starts no capture. Evidence read from the
`[trigger]` lines in the runtime log.

**Established:**

- **Registration is observable and complete.** All ten bindings registered with
  the OS on this session:

  ```
  [trigger] event=register binding=capture       shortcut=F1        id=160    outcome=ok
  [trigger] event=register binding=pause         shortcut=Ctrl+F10  id=524457 outcome=ok
  [trigger] event=register binding=abort         shortcut=F4        id=163    outcome=ok
  [trigger] event=register binding=mode_picker   shortcut=Ctrl+F11  id=524458 outcome=ok
  [trigger] event=register binding=auto          shortcut=Ctrl+F6   id=524453 outcome=ok
  … (verbatim, cleanup, rewrite, agent, prompt_enhance all outcome=ok)
  ```

- **The migration preserves the reporter's escaped state.** `hotkey = "f1"` and
  `abort_hotkey = "f4"` became `F1` and `F4` — canonicalized, not replaced by a
  platform default — and `shortcut_schema_version = 1` plus
  `hold_watchdog_seconds = 120` were stamped once.

- **Press events reach the app through the XWayland grab.** Every injected press
  produced `event=shortcut … state=pressed` and the matching decision line.

**The decisive negative result: release delivery is nondeterministic.** Holding
the shortcut for a fixed duration and counting the events per run:

| Hold duration | `state=pressed` | `state=released` |
| --- | --- | --- |
| atomic tap | 1 | 1 |
| 1 s | 4 | 4 |
| 2 s | 1 | 0 |
| 3 s | 2 | 2 |
| 6 s | 2 | 0 |

Two distinct failure modes, both reproduced more than once:

1. **Extra press/release pairs arrive during a hold.** A hold that should be one
   press and one release delivered two or four of each. In hold mode the first
   spurious release would stop a capture while the key is still down.
2. **The release is lost entirely.** The 2 s and 6 s runs produced a press with
   no matching release, leaving the vendored crate's `state.pressed` — and, in
   hold mode, `hotkey_active` — stuck. This is exactly the stranded hold D11
   describes, and it is the state the new watchdog now ends with a stated
   reason instead of letting it drift into the silence timeout.

The counts do not scale with hold duration, so this is not plain auto-repeat.

**Limit of this measurement, stated honestly:** XTEST injects through a
different path than physical hardware input, so a negative XTEST result does not
prove that physical keys behave the same way. What it does establish is that the
delivery is not deterministic on this path, and that the stranded-hold state is
reachable in practice rather than hypothetical.

### First physical result (2026-07-25): double tap works, hold to talk does not

Reported from a live session on the observation path (ADR 0009), with a single
`Shift` as the capture trigger:

- **Double tap works.** Two clean taps start and stop a capture; `Shift` pressed
  while typing does not trigger, so the interruption filter does what it was built
  for.
- **Hold to talk does not work at all.**

**What this already establishes**, without any further measurement: on this
session, **key delivery is not the problem**. Double tap on a modifier-only
trigger counts *release* edges, and a release edge is only counted for a binding
whose *press* edge set it pressed. Working double tap therefore proves both edges
arrive, and arrive reliably enough to be counted. That is the first piece of
evidence that separates the two halves of D11: delivery versus state machine.

The failure is consequently in the hold path itself or in what it starts. Open
candidates, none of them confirmed — **do not treat any of these as the cause
until the log says so**:

1. **The stop is dropped as "release without press".** The Released branch
   requires `hotkey_active`, and `sync_trigger_state_with_session` clears that flag
   on every event where the session stage is not `Capturing`. A release that
   arrives while the session is still starting, or already processing, would clear
   the flag first and then be discarded as `ignored_release_without_press`. This
   would read as "starts and never stops", not as "nothing happens".
2. **The start never happens.** `start_session` returning an error would surface
   through `fail_from_native_error` rather than silently.
3. **The press is discarded before the hold branch.** `ignored_disabled`,
   `ignored_suspended_for_recording`, `ignored_paused`, `debounced` or
   `ignored_already_active` each name themselves in the log.
4. **The capture starts and ends immediately.** A hold shorter than `hold_min_ms`
   becomes a `DeferredStop`; a mis-set `hold_min_ms` would make every hold look
   like a short tap.

Each of the four writes a different `[trigger] event=decision` line, so one hold
attempt with the log running distinguishes them:

```
tail -f ~/.config/WordScript/logs/wordscript-runtime.log | grep trigger
```

Press and hold the trigger for ~3 s, speak, release. Record the full block of
`event=shortcut` and `event=decision` lines here. Until then this stays an open
symptom with a narrowed cause, not a diagnosed defect.

### Second physical result (2026-07-29): hold to talk acts on both edges

Reported from a live session, superseding the reading above. The 2026-07-25
entry stays as written — this is what was learned since, not a correction of
what was observed then.

- **The press starts a capture** and **the release stops it.** A ten-second hold
  records for ten seconds and ends when the key comes up. Neither edge is lost.
- **The hold duration changes nothing about the outcome.** A one-millisecond
  press produces a recording and a transcript exactly like a deliberate hold
  does. That is what made the mode read as "not working": it behaved like tap to
  toggle, so nothing about holding the key appeared to matter.

This resolves candidate 4 from the list above and closes D11. The cause was not
a mis-set `hold_min_ms` but the meaning of the constant. It never gated a hold —
it *extended* one: a release below the threshold scheduled a `DeferredStop` that
fired once the recording had reached 300 ms, so every press produced a session.
Candidates 1-3 are ruled out by the observation that both edges act.

The fix and its reasoning are ADR
[0013](../decisions/0013-hold-to-talk-is-strictly-momentary.md).

**Still to record here: the log block from a native session with the fix in
place.** The behavior above was observed by using the app; the `[trigger]` lines
themselves have not been captured yet, so this section carries no transcript.
The decision tokens changed with the fix, so the run is worth taking on its own
terms rather than reusing the old ones. A committed hold should produce
`hold_provisional_start`, then a `hold_arm` line with `outcome=committed`, then
`hold_stop`; a press below the threshold should produce
`hold_provisional_start` followed by `hold_discarded_below_arm` and **no**
`hold_arm` line at all. If a run disagrees with that, the disagreement belongs
here and the fix is not finished.

```
tail -f ~/.config/WordScript/logs/wordscript-runtime.log | grep trigger
```

### Smaller open points from the same lane

Recorded here because the hand-off that used to carry them is archived once the
branch merges, and none of them is worth its own record:

- **Abort and pause act on the press edge**, so the interruption flag cannot gate
  them. `Ctrl+Alt` arms the abort double tap even when the user is heading for
  `Ctrl+Alt+T`. Arming is harmless — firing needs a second press inside the window
  — and this is unchanged behavior rather than a regression, but it is the reason
  the press edge is not safe by construction the way the release edge now is.
- **`MODIFIER_TOKENS` is side-agnostic**, so `Shift` covers both keys and "right
  Shift only" cannot be expressed. Wispr Flow's default works precisely because
  right Shift is rare in typing, so this is worth having; it touches the
  vocabulary, the recorder's chord serialization and the display strings.
- **Observation does not close the Wayland gap.** XInput2 raw events cover what
  the X server sees, so on a Wayland session a keystroke delivered to a native
  Wayland client is still invisible. That needs the
  `org.freedesktop.portal.GlobalShortcuts` path.
- **`workspace_context` has a flaky test pair.**
  `resolve_project_root_reads_env_var` and
  `resolve_project_root_falls_back_to_cwd_for_invalid_env` both mutate the
  process-global `WORDSCRIPT_PROJECT_ROOT` and run in parallel, so either can
  lose. Unrelated to this lane; the fix is to serialize them.

### S0 measurement, run 2 — physical keys (open, needs a person)

XTEST injects through a different path than a hardware keyboard, so run 1 cannot
answer whether physical keys behave the same way. This run is the missing half.
It is deliberately written out in full so it can be executed once, without
re-deriving the procedure.

**Setup.** With the dev build from this branch running in the native host, in a
terminal:

```
tail -f ~/.config/WordScript/logs/wordscript-runtime.log | grep trigger
```

Use the **mode-select** shortcut (default `Alt+S`, shown in Settings -> Modes)
as the probe. It is harmless: it opens the overlay mode selector and starts no
capture, so a stranded state costs nothing. Do not use the capture trigger for
the hold table — a lost release there starts a real recording.

Count the `[trigger] event=shortcut … state=pressed` and `state=released` lines
per run. One press and one release per hold is the correct result.

**Part 1 — hold durations.** Hold the probe physically for each duration, then
release. Leave two seconds between runs so the lines are unambiguous.

| Hold duration | `state=pressed` | `state=released` | Notes |
| --- | --- | --- | --- |
| atomic tap | | | |
| 1 s | | | |
| 2 s | | | |
| 3 s | | | |
| 6 s | | | |

Compare against the XTEST table above. The question is not "does it work once"
but whether press and release come in matched pairs *every* time — run 1 failed
by producing extra pairs in some runs and none in others.

**Part 2 — focus dependency.** Press the probe once for each focus case. This is
the half XTEST structurally cannot reach: it cannot deliver to a
Wayland-focused client.

| Focused application | `state=pressed`? | `state=released`? |
| --- | --- | --- |
| XWayland client (e.g. the WordScript settings window itself) | | |
| Native Wayland client (e.g. a GNOME/KDE app started without `GDK_BACKEND=x11`) | | |

Verify which one a candidate app actually is before recording the row —
`xdotool getactivewindow` failing on the focused window is a practical indicator
that it is a native Wayland client. Do not report a row you could not classify.

**Part 3 — what to do with the result.** Record the filled tables here as
"run 2", dated, and then:

- **Matched pairs in every row:** hold to talk is sound on this session type.
  Nothing in the matrix needs to change — the evidence path will report
  `available` after the first press, which is already the intended behavior.
- **Releases lost or duplicated with physical keys too:** give
  `SessionKind::LinuxXWayland` a hard `unavailable` for hold in
  `core::shortcut::capability_matrix`, independent of the counters, with this
  measurement as the stated reason. One branch, one test.
- **Delivery depends on the focused client:** that is a finding about the grab
  path, not about hold alone. It belongs in
  [PLATFORMS.md](../PLATFORMS.md#linux----global-shortcut-reality) as a named
  consequence, and it is the argument for implementing the
  `org.freedesktop.portal.GlobalShortcuts` path.

Until this run exists, the matrix reports `conditional` for hold before the first
press and follows the counters afterwards. That is honest but weaker than a
measurement: it describes this session, not the platform.

---

## Original Record (2026-07-25)

Scope of this record: the whole shortcut lane in Settings -> Capture (Input)
and Settings -> Modes -- key recording, manual entry, normalization,
persistence, OS registration and the activation modes (tap to toggle / hold to
talk) that consume the registered shortcut. Both the recorder widget and the
runtime contract behind it are affected. This is not a cosmetic UI complaint; the
current behavior can leave the desktop in a state where a single modifier or a
bare letter is grabbed system-wide.

## Reported Symptom (2026-07-25)

On a KDE Plasma 6 Wayland session:

1. In the shortcut recorder, pressing `Ctrl` registers `Ctrl` -- and after that
   no further key can be added. `Ctrl+A` and `Ctrl+Space` never appear.
2. The Windows/Super key is never captured at all.
3. The manual text field below the recorder cannot be used either: typing a
   combination separated by `+` does not survive; the field fights back and the
   value snaps away while typing.
4. Net effect: the user cannot assign a working shortcut through either path.
   The workflow was described as unusable.

The reporter's own framing of the core problem: from the Settings capture
surface the shortcuts cannot be configured at all, because the keys are never
really intercepted. That is the primary symptom to design against -- the
recorder appears to listen while the keys go somewhere else (D1, D3) or are
consumed by the desktop before the window sees them (Super on KDE).

The reporter's persisted state confirms the escape route taken instead of a
real combination:

```
hotkey            = "f1"        # bare F1, no modifier
abort_hotkey      = "f4"        # bare F4, no modifier
pause_hotkey      = "ctrl_l+f10"
activation_mode   = "tap"
```

A bare `F1` with `tap` activation means every `F1` press anywhere on the
desktop starts or stops a dictation. That is a residue of the broken assignment
flow, not a deliberate configuration.

## Environment

- `XDG_SESSION_TYPE=wayland`, `XDG_CURRENT_DESKTOP=KDE` (Plasma 6)
- App windows run on XWayland by default (`GDK_BACKEND=x11`)
- Global registration goes through the vendored `global-hotkey` crate
  (X11 passive grabs via XWayland in this session)

## Confirmed Code Defects

Each item below was verified in the current tree, with the responsible
location. They are independent defects; fixing only one does not repair the
flow.

### D1 -- The recorder commits on the first key release

`src/components/settings/HotkeyRecorder.tsx:113` finalizes as soon as the held
set becomes empty. `src/components/settings/InputTab.tsx:183` passes
`allowModifierOnly={true}` for all three capture shortcuts, so a modifier alone
is a valid result. Tapping `Ctrl` therefore commits `ctrl_l` and closes the
recording immediately. Building a chord is only possible if every key is held
down simultaneously, and nothing in the UI states that. This is the direct
cause of symptom 1: "Ctrl is registered and then no other key can be pressed"
-- the recorder is no longer listening.

### D2 -- A single modifier becomes a bare OS-wide grab

`build_modifier_only_shortcuts` (`src-tauri/src/core/trigger.rs:946`) expands a
modifier-only value into one shortcut per part. For the single-part value
`ctrl_l` it produces `Shortcut::new(None, Code::ControlLeft)`: a grab on `Ctrl`
with no modifier. Consequences:

- Every `Ctrl` press desktop-wide is consumed by WordScript, which breaks
  `Ctrl`-based shortcuts in other applications and, with `tap` activation,
  toggles dictation.
- Because grabs are not released while the recorder is open (see D3), the
  recorder can no longer observe `Ctrl` either. The failed assignment makes the
  next assignment attempt harder -- a self-reinforcing trap that plausibly
  explains why `Ctrl+A` and `Ctrl+Space` stopped registering after the first
  accidental `Ctrl` commit.

### D3 -- `pause_native_trigger` does not release OS grabs

`src-tauri/src/core/trigger.rs:337` only sets `state.paused = true`. The
registered shortcuts stay grabbed at the OS level. A grabbed combination is
delivered to the grab owner, not to the focused WebKitGTK window, so any
currently registered shortcut is invisible to the DOM recorder. Re-recording the
shortcut you already use is structurally impossible. `ModesTab`
(`src/components/settings/ModesTab.tsx:351` and `:359`) does not even call the
soft pause, so pressing a live mode shortcut while recording fires the mode
action instead of being captured.

### D4 -- Manual entry is destroyed by instant save plus strict validation

`SettingsWindow.tsx:177` persists every patch immediately, and the manual
`Input` (`InputTab.tsx:202`) patches on every keystroke. `save_config`
(`src-tauri/src/core/config.rs:1150`) runs `validate_hotkey_collisions` first,
which normalizes through the strict trigger normalizer
(`config.rs:1105` -> `trigger.rs:993`) and rejects anything unparsable. Typing
`ctrl_l+f9` therefore walks through intermediate states that are hard errors
(`c`, `ct`, `ctr`, ...). On rejection `SettingsWindow.tsx:246` reverts the form
to the previous value, so the field snaps back mid-typing. Worse, some
intermediate states *are* valid single-key shortcuts (`c`, `a`, `f`): they get
persisted and registered as bare-letter global grabs, which then swallow the
very letters being typed. This is symptom 3.

### D5 -- Two divergent normalizers own the same string

- `config.rs:1367` `normalize_shortcut_value`: lossy. Unknown tokens pass
  through lowercased (`config.rs:1422`), an empty value silently becomes the
  platform default (`config.rs:1375`).
- `trigger.rs:993` `normalize_shortcut`: strict. Unknown tokens are errors.

Effects: a value can be persisted that can never register (config accepts,
registration fails, the failure survives only as a transient toast); a shortcut
cannot be cleared or disabled, because an empty capture *or* mode shortcut is
rewritten to the default on save even though `ModeHotkeys`
(`trigger.rs:20`) documents empty as "disabled". Display strings also differ
between the two layers (`win`/`cmd` versus `Super`).

### D6 -- Persist-time normalization silently truncates three combinations

`config.rs:1379` drops the trailing key of `ctrl_l+win+space`,
`ctrl_l+cmd+space` and `ctrl_l+alt_l+space`, turning them into modifier-only
shortcuts (which then hit D2). This is an ungated legacy migration, so those
three combinations can never be chosen deliberately -- and
`ctrl_l+alt_l+space` is the Windows default (`config.rs:1250`), meaning the
Windows default hotkey is rewritten to `ctrl_l+alt_l` on every save.
`is_legacy_autofilled_space_shortcut` (`config.rs:1399`) is unreachable for the
`allow_modifier_only` path because the truncation above already matched.

### D7 -- Collision validation runs before normalization

`save_config` validates the raw incoming values (`config.rs:1150`) and then
normalizes (`config.rs:843`). Because normalization can mutate values (D6), two
fields that pass validation can collide on disk -- for example capture
`ctrl_l+alt_l+space` (truncated to `ctrl_l+alt_l`) next to a mode shortcut
`ctrl_l+alt_l`. Registration then fails for a state the validator approved.

### D8 -- The recorder's key vocabulary is far smaller than the runtime's

`CODE_TO_PYNPUT` / `codeToKey` (`HotkeyRecorder.tsx:6-22`) only maps modifiers,
`Space`, `F1`-`F12`, letters and digits. Everything else is dropped silently:
`Enter`, `Tab`, `Backspace`, arrows, `Insert`/`Delete`/`Home`/`End`/`PageUp`/
`PageDown`, the numeric keypad, punctuation, `F13`+. The Rust side already
accepts `escape`, `enter`, `tab` and `backspace` (`trigger.rs:1026`), so the UI
is strictly weaker than the contract. `Escape` is additionally hardwired to
"cancel" (`HotkeyRecorder.tsx:96`) before any modifier is considered, so the
default abort shortcut `ctrl_l+alt_l+escape` (`config.rs:1256`) cannot be
reproduced with the recorder that is supposed to manage it.

### D9 -- Physical key codes are displayed as US labels

Capture uses `event.code`, which is layout independent (correct for
registration, since the Rust side also registers by `Code`). But the value is
rendered as if it were a label: on a German keyboard the key printed `Z`
reports `KeyY`, so the pill shows `Y` for the key the user actually pressed.
The manual field and the summary tile (`InputTab.tsx:161`) additionally show
raw internal tokens (`ctrl_l+f9`) instead of a human shortcut. Nothing in the
UI explains this dual identity.

### D10 -- No test coverage for the widget that carries the whole flow

There is no `HotkeyRecorder.test.tsx`; the component is mocked out where it
would be exercised (`InputTab.test.tsx:12`). The Rust normalizers and collision
validation have tests, the interaction layer has none.

### D11 -- "Hold to talk" is not a supported activation mode in practice

Reported as not working at all. The state machine itself is plausible
(`trigger.rs:656` start on `Pressed`, `trigger.rs:680` stop on `Released`, with
`DeferredStop` wired at `lib.rs:896`), so the defect is not one missing branch
-- it is that hold mode depends on guarantees the lane never establishes:

- **It depends entirely on a `Released` event.** The vendored crate does emit
  one on X11 (`vendor/global-hotkey/src/platform_impl/x11/mod.rs:277`), Windows
  synthesizes it from a low-level keyboard hook
  (`platform_impl/windows/mod.rs:176`) and macOS from hot-key/flags events
  (`platform_impl/macos/mod.rs:409`). Three different mechanisms with three
  different edge cases, and nothing in WordScript verifies that a release
  actually arrives.
- **A missed release strands the capture.** `hotkey_active` stays `true`
  (`trigger.rs:667` then ignores further presses), so the recording only ends
  through the silence timeout or the maximum-length cap. It self-heals once the
  session ends (`sync_trigger_state_with_session`, `trigger.rs:920`), which is
  why the symptom reads as erratic rather than permanently dead. There is no
  watchdog and no user-visible "still holding?" state.
- **X11 tracks the release per keycode of the grabbed key only.** Releasing the
  modifier first while holding the main key produces no release; the release
  fires whenever the main key goes up, regardless of modifier order.
- **Windows keeps a single `ACTIVE_ID`/`ACTIVE_VK` pair**
  (`platform_impl/windows/mod.rs:160`), so two overlapping hold shortcuts lose
  the release of the first.
- **The timing constants are invisible and hardcoded.** `hold_min_ms` and
  `debounce_ms` are both 300 ms (`trigger.rs:17-18`), not configurable and not
  explained. A short push-to-talk tap is turned into a deferred stop, and the
  following press can be swallowed by the debounce -- push-to-talk in quick
  succession feels dead.
- **No tests cover hold mode on a real platform**; `activation_mode` is a
  string in config with no UI feedback about whether the mode is actually
  functional in the current session.

Until the release guarantee is established per OS, "Hold to talk" must not be
offered as an equal choice next to "Tap to toggle" -- an option that silently
does nothing violates the runtime-truth rule.

### D12 -- The trigger lane has no observability at all

34,070 lines of the current runtime log contain zero trigger events: no line
for a received shortcut event, its `Pressed`/`Released` state, the resolved
activation mode, or a rejected/debounced press. Capture, provider, transform
and insert all log their state transitions; the layer that decides whether a
dictation starts logs nothing. Consequently neither the user nor an agent can
distinguish "the key never arrived", "the shortcut is not registered", "the
event was debounced" and "the release was missed" -- which is why this whole
class of bug has been diagnosed by reading code rather than evidence.

## Cross-Platform Coverage Gap

The reporter also notes that the lane is not reliable in normal production use
and not thought through across Linux, Windows and macOS. The code supports that
assessment:

- Three different platform mechanisms deliver shortcut events with different
  press/release semantics (see D11), and the differences are neither abstracted
  nor tested.
- Platform defaults differ (`config.rs:1246`) and one of them is actively
  corrupted by persist-time normalization (D6).
- Modifier-only shortcuts are expanded into per-part grabs (D2) that behave
  differently per OS and per desktop environment.
- macOS additionally requires Accessibility/Input-Monitoring grants for
  low-level key observation; nothing in the shortcut surface states or verifies
  this.

The rebuild therefore needs an explicit per-OS capability matrix -- which
activation modes, key classes and modifier-only combinations are supported and
verified where -- instead of one UI that offers every option everywhere.

## Platform Constraints (not defects, but part of the target design)

- KWin consumes `Meta`/`Super` before the focused window sees it, so a DOM
  recorder cannot capture the Super key on KDE. Any design that expects the
  browser layer to observe every physical key is wrong on Linux.
- Wayland has no unprivileged global-hotkey API. Global grabs work in this
  session only because the app runs through XWayland; a native Wayland session
  (`WORDSCRIPT_NATIVE_WAYLAND=1`) would need the
  `org.freedesktop.portal.GlobalShortcuts` portal. The current lane has no
  portal path and no honest "not available here" state.
- Desktop-reserved combinations exist on every OS; the runtime already knows
  registration success per shortcut (`registered_hotkey` in
  `trigger.rs:164`) but Settings does not make that truth prominent.
- The X11 backend connects to the display server that is present
  (`vendor/global-hotkey/src/platform_impl/x11/mod.rs:230`), which in this
  session is XWayland. Passive X11 grabs are honored by KWin depending on what
  currently holds keyboard focus, so the same shortcut can work while an
  XWayland application is focused and do nothing while a native Wayland
  application is focused. If that is what happens here, it explains both the
  "works sometimes" impression during normal dictation and hold mode appearing
  entirely broken (a `Released` that never arrives). This is the single most
  important thing to measure before anything is rebuilt.

## Impact

- Users cannot reliably assign capture or mode shortcuts on Linux, and the
  failure modes push them toward bare keys such as `F1`.
- A single mis-recorded modifier can grab `Ctrl` for the whole desktop.
- Bare-key grabs created by intermediate manual-entry states can steal
  keystrokes from other applications.
- Persisted configuration and OS registration can disagree, with the
  disagreement visible only in a transient toast.
- "Hold to talk" is offered as an equal activation mode but does not work
  (D11); a stranded hold ends only through the silence timeout or the
  maximum-length cap.
- Nothing about any of this is visible in the runtime log (D12), so every
  report degrades into guesswork.

## Target Contract for the Rebuild

- **T1 Explicit capture lifecycle.** Recording is a modal, explicitly ended
  state: it stops on `Enter`/confirm, on `Escape`/cancel, on a timeout or on a
  deliberate second click -- never implicitly on the first key release.
  Recording accumulates the largest chord seen, shows it live, and requires
  confirmation before it is written anywhere.
- **T2 One normalizer, one source of truth.** A single Rust-side shortcut
  parser owns tokens, display strings and validity. The UI must not carry a
  second key table; the TypeScript layer only maps browser events to the
  canonical token vocabulary exposed by the runtime, and every token it can
  produce must be registerable.
- **T3 Modifier-only is opt-in and never a single bare modifier.** A
  modifier-only shortcut requires at least two modifiers. A single bare
  modifier and a single bare letter/digit are rejected with a stated reason.
  Bare function keys require an explicit confirmation because they are global.
- **T4 Real grab release while recording.** Entering the recorder unregisters
  the OS grabs (all capture and mode shortcuts) and re-registers them
  afterwards -- for the recorder in Capture *and* in Modes. `paused` as a soft
  flag is not sufficient.
- **T5 Draft state for manual entry.** The manual field edits a local draft.
  Nothing is persisted, validated destructively or registered until commit
  (blur/Enter). Validation is shown inline while typing; intermediate states
  never reach `save_config`.
- **T6 Validate after normalization, never mutate silently.** Normalization
  happens first, collision validation second. Legacy migrations are version
  gated and never rewrite a value the user just chose; when a value must be
  changed, the UI says so.
- **T7 Clearing means disabled.** An empty shortcut disables that binding for
  capture and mode shortcuts alike, with a visible "disabled" state instead of
  a silent revert to the default.
- **T8 Honest registration state and platform truth.** Each row shows whether
  the shortcut is actually registered with the OS, and a persistent (not
  transient) error when it is not, including the reason: desktop-reserved,
  collision, unsupported token, or "no global shortcut API in this session".
  Keys the desktop swallows (Super on KDE) are named as such at the point of
  failure, with manual entry offered as the deliberate alternative.
- **T9 Human display, canonical storage.** Pills and summaries render a human
  shortcut (`Ctrl + F9`) derived from the canonical token, with the physical-key
  caveat handled explicitly. Raw tokens appear only where the user opts into
  manual editing.
- **T10 Activation modes are capability gated.** Hold to talk is offered only
  where a `Released` event is verified for the selected shortcut on the current
  platform and session; otherwise the option is disabled with a stated reason
  instead of silently doing nothing. A hold that loses its release is ended by
  an explicit watchdog with a visible reason in history and the runtime log, not
  by the silence timeout. `hold_min_ms` and the debounce become part of the
  contract (configurable or at least documented and surfaced), and a short tap
  in hold mode has defined behavior.
- **T11 The trigger lane is observable.** Every received shortcut event is
  logged with shortcut id, display string, `Pressed`/`Released`, activation
  mode, and the decision taken (started, stopped, debounced, ignored because
  already active, no matching binding). Registration and unregistration log
  their outcome per shortcut. This is permanent infrastructure, not a temporary
  debug patch -- the same principle as the dev-only overlay diagnostics.
- **T12 Per-OS capability matrix.** One documented matrix -- key classes,
  modifier-only, activation modes, session types (X11, XWayland, native
  Wayland, Windows, macOS with and without input-monitoring grants) -- drives
  both the UI's offered options and what the tests assert. Options the current
  platform cannot honor are not shown as available.

## Planned Work Slices

Each slice is independently testable; the order matters because later slices
depend on the measurement from S0 and on the single normalizer from S1.

0. **S0 Trigger observability and key probe.** Permanent structured logging in
   the trigger lane (T11) plus a development-only key probe in the recorder that
   records `event.code`, `event.key` and the modifier state for every
   keydown/keyup. Deliverable is evidence, not a fix: which keys reach the
   window, whether `Released` arrives for the configured shortcut, and whether
   delivery depends on the focused application being XWayland or native Wayland
   (test with a native Wayland app and an XWayland app focused). This slice
   decides the shape of S3 and whether hold to talk is fixable on Linux at all
   or has to be capability gated (T10, T12).
1. **S1 Runtime shortcut contract.** Consolidate normalization, the token
   vocabulary, modifier-only rules and clear/disable semantics into one Rust
   module; expose the vocabulary and a `validate_shortcut` command to the UI;
   move collision validation after normalization; version gate the legacy
   space migration. Tests: normalizer table tests (D5, D6, D7), collision
   ordering, empty-means-disabled.
2. **S2 Grab lifecycle.** Real unregister/re-register around recording, shared
   by Capture and Modes, with a guaranteed restore on window close, error or
   crash-safe drop. Tests: registration state transitions in `trigger.rs`.
3. **S3 Recorder rebuild.** Explicit lifecycle (T1), full token vocabulary from
   S1 (D8), chord accumulation, confirm/cancel affordances, live conflict and
   reserved-key feedback, keyboard accessibility. Tests: a real
   `HotkeyRecorder.test.tsx` covering tap-modifier, chord, release order,
   Escape-in-chord, unsupported key, cancel-on-blur.
4. **S4 Manual entry as draft.** Local draft state, inline validation via the
   S1 command, commit on blur/Enter, no per-keystroke save (D4). Tests:
   `InputTab` typing test asserting no save until commit.
5. **S5 Honest state surfaces.** Registered-versus-configured per row,
   persistent failure reason, platform capability line (XWayland/portal),
   human display strings (T8, T9, D9).
6. **S6 Activation modes.** Release-guarantee handling per platform, hold
   watchdog with a visible reason, capability gating of the mode selector,
   defined short-tap behavior, `hold_min_ms`/debounce surfaced (T10, D11).
   Tests: hold start/stop, missed release, short tap below `hold_min_ms`,
   debounced repeat press.
7. **S7 Per-OS capability matrix.** Derive the matrix (T12) from the S0
   evidence, drive the UI's available options from it, and assert it in tests
   for every branch that differs per platform.
8. **S8 Documentation and decision.** ADR in `docs/decisions/` for the
   shortcut contract ownership, updates to `REFERENCE.md` (token vocabulary and
   mode semantics), `PLATFORMS.md` (Linux shortcut reality plus the capability
   matrix), `STATUS.md` and `CHANGELOG.md`.

## Validation Required

- `npm test`, `npm run build` and `cd src-tauri && cargo test` for every slice
  that touches both sides.
- Manual verification in the native host (grabs and key delivery cannot be
  validated in a browser preview): KDE Plasma 6 Wayland/XWayland at minimum;
  Windows and macOS before the lane is called done.
- A migration check that the reporter's current state (`hotkey = "f1"`,
  `abort_hotkey = "f4"`) is either preserved deliberately or surfaced as a
  warning about global bare keys, not silently rewritten.
- Activation modes must be validated per platform in the native host, with the
  focused application varied between XWayland and native Wayland on Linux: tap
  start, tap stop, hold start, hold stop, short tap in hold mode, and a
  deliberately missed release.

## Already Ruled Out

- No competing global key listener steals the events: the only
  `window` keydown/keyup listeners in the settings tree are the recorder's own
  (`HotkeyRecorder.tsx:118`) plus the development-only inspector
  (`src/components/shell/Inspector.tsx:34`). The "keys are not intercepted"
  symptom is therefore not a DOM listener-ordering problem.
- The recorder does start: the pill switches to the recording state and shows
  the first modifier, which is why the failure reads as "the first key works,
  nothing after it does" rather than "nothing happens".

## Open Questions -- Runtime Evidence Still Needed

- Whether `Ctrl+A` / `Ctrl+Space` keydowns reach the WebKitGTK window at all in
  this session once no conflicting grab is held. D1 alone explains the report,
  but a temporary development-only key-event probe (log `event.code`,
  `event.key`, modifier state for every keydown/keyup in the recorder) should
  confirm it before S3 is designed around it.
- Which combinations KWin swallows beyond `Meta` in this configuration
  (Plasma global shortcuts may already own candidates the user would pick).
- Whether the vendored `global-hotkey` crate reports a distinguishable error
  for "reserved by the desktop" versus "already grabbed", which T8 needs to
  give a precise reason.
- Whether a `Released` event arrives for the configured shortcut in this
  session, and whether press and release delivery depend on the focused
  application being an XWayland or a native Wayland client. This is the
  measurement that decides whether hold to talk can exist on Linux without the
  GlobalShortcuts portal (D11, S0).
- Whether normal-use unreliability during ordinary dictation is the same
  focus-dependent delivery problem rather than a capture or provider issue --
  S0 logging should make the two distinguishable for the first time.

## Split-Off Records

Two findings from this lane have their own records rather than growing this one
further:

- [pause-abort-interrupted-chord.md](pause-abort-interrupted-chord.md)
  (2026-07-29): pause and abort act on the press edge and never read
  `event.interrupted`, so the shipped `Ctrl+Alt` abort default fires under an
  unrelated chord. It concerns the trigger's decision logic rather than
  recording, normalization or registration, which is what this record is about.
- [../tracks/activation-gestures.md](../tracks/activation-gestures.md)
  (2026-07-29): the plan for per-mode activation gestures and defaults, and the
  three capability gaps beneath it.

## Scope

This record documents the problem and the intended contract. It does not
authorize the implementation. The rebuild starts as an explicitly approved
slice sequence (S0 onward) with the ADR from S8 written when the contract
ownership is decided.
