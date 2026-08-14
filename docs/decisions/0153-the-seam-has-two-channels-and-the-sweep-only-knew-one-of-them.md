# 0153: The seam has two channels and the sweep only knew one of them

Date: 2026-08-14
Status: Accepted

## Context

ADR 0089 made the caller sweep a standing check, ADR 0093 gave it a third
question, and ADR 0103 found that it had only ever been run in the direction
whose answers are harmless — and that the other direction produced a live defect
on its first run. All three are about `invoke`.

`invoke` is the frontend calling the runtime. **An event is the runtime calling
the frontend.** It is one seam with two channels, and only one of them had ever
been swept. The asymmetry is the same shape as the one ADR 0103 named: an
emitter with no listener compiles, runs, delivers to nobody, and warns nowhere.

Leg 13a ran the sweep in both `invoke` directions over the whole tree and then
extended it to the event channel.

**The `invoke` seam is clean, and the number is checkable.** 72 commands
registered, 72 defined by `#[tauri::command]`, the two lists identical; 67 called
from non-test `src/`; **zero callers with no command**; five commands with no
caller, and they are the same five ADR 0089 and ADR 0093 already recorded —
`preview_prompt_enhance`, `transcribe_audio_file`, `read_diag_log`,
`clear_diag_log`, `overlay_open_devtools`. Nothing new became dead weight and
nothing previously dead came back to life.

**The event channel had one finding.** `wordscript-native-insert` is emitted from
three sites in `core/insertion.rs` and **no surface in `src/` listens to it** —
not the overlay, not the workspace, not even a test mock. `docs/spec/SPEC.md:297`
carries it as part of the runtime→frontend event contract: *"carries
`NativeInsertResult`, including insertion and recovery truth."*

**It is dead weight rather than a gap, and the difference had to be measured
rather than assumed.** All three emitters sit beside a path that already delivers
the same `NativeInsertResult` by another route:

- `insert_text_native` emits, then returns `result` to its `invoke` caller.
- `restore_last_transcript` emits, then returns `Ok(result)`.
- `insert_transcription_from_legacy` — the runtime-driven path, called from
  `lib.rs:1965`, `sessions.rs:664` and `history.rs:762`, with no frontend caller
  to return to — emits, and its result reaches the frontend folded into the
  authoritative `wordscript-event` as the `insertion` field (`src/types/ipc.ts:144`,
  `:168`).

So no surface is missing truth it needs. What exists is a second, unordered
channel carrying session truth that the authoritative one already carries.

## Decision

**The sweep covers both channels of the seam, and `wordscript-native-insert` is
recorded rather than deleted.**

1. The check is `scripts/command-sweep.mjs` and it reports five sections:
   caller with no command, command with no caller, unresolvable call sites,
   **listener with no emitter**, and **emitter with no listener**. It exits
   non-zero on the two that are defects rather than triage questions — a caller
   that rejects at runtime, and a surface listening for an event nothing sends.
2. **`wordscript-native-insert` is not deleted on a grep**, per ADR 0093's rule.
   The disposition is the owner's and the finding is what this ADR files. What
   can be said without a decision is that ADR 0018/0019 argues against it: a
   session ends in exactly one reducer commit, and a second channel carrying the
   same result out of band is the defect `CLAUDE.md` already forbids for
   `wordscript-native-event`. If it stays, the SPEC line says what consumes it;
   if it goes, the SPEC line goes with it.
3. **The insert is the runtime ownership track's area**, so the disposition is
   filed there rather than acted on here.

## Consequences

- **Every direction of this sweep has now been observed to report a true defect,
  and that is a property of the check rather than of this leg.** Direction 1 was
  pointed at `git archive 4445423^ src` and named `load_transcription_history` at
  `OverlayWindow.tsx:1380` — Leg 12's defect, in the historical tree that had it.
  Direction 4 was made to fire by deleting a listener from a copy of `src/`.
  `--frontend <dir>` exists for exactly this and is documented in the file. A
  sweep that has never been seen to report anything is a sweep nobody has tested,
  which is ADR 0103's lesson about the retry button applied to the instrument.
- **The instrument reproduced this cluster's own failure class three times while
  being built, and each one is in the file as a comment beside the code that
  fixes it.** A first draft abandoned any `invoke<...>` whose generic contained
  `{` or `;`, which reported all five of `Privacy.tsx`'s backup commands as
  orphans — *the exact five ADR 0103 recorded as false* — and would have passed a
  direction-1 defect written in the same shape. A second used a non-greedy
  `<[\s\S]*?>` for the event half and matched `listen<BackendEvent>(RUNTIME_EVENT_CHANNEL, …)`
  against an `invoke` string further down the file, reporting two commands as
  events nothing emits. A third dropped the newlines inside block comments while
  stripping them, so the regression run reported line 1345 for a call on 1380.
  **Three passes, three false findings, all three from the tool built to detect
  false findings.**
- **A channel name in a constant is invisible to a name-grep.**
  `listen<BackendEvent>(RUNTIME_EVENT_CHANNEL, …)` is how the overlay subscribes
  to `wordscript-event`, so the literal never appears at the call site. The sweep
  resolves frontend string constants; without that it reported the product's main
  event channel as reaching nobody.
- **`tauri://` is the framework's namespace and is not swept.**
  `tauri://theme-changed` has no emitter in this repository and never will.
- The three `never used` Rust warnings are unchanged and still nobody's:
  `should_oscillate_flat_reveal`, `NativeInsertionState::configure`,
  `ModeHotkeys::for_mode`.
