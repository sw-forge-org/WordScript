# 0020 -- The processing mode is the only transform axis

Date: 2026-07-30
Status: accepted

## Context

Settings -> Modes carried a "Cleanup settings" card with three toggles -- AI
cleanup, Remove fillers, Rewrite phrasing -- captioned *"Global parameters for
the cleanup and rewrite transform pipeline. These apply whenever the effective
mode is Cleanup or Rewrite."* The caption was false in both directions.

Two of the three values were discarded on read. `effective_filter_fillers` and
`effective_professionalize` in `config.rs` each took the stored value as a
parameter and opened with `let _ = fallback;`, then derived the result purely
from `processing_mode`. The per-profile fields the UI wrote --
`ProfileModesSettings.filter_fillers` and `.professionalize` -- were never
dereferenced anywhere in `src-tauri/src/`. The third, `post_process`, was read,
and then overwritten per mode in the pipeline. So all three controls were
unobservable to the runtime.

The live evidence agrees. Across 1586 correction calls in two runtime logs only
three flag combinations ever occurred: `(filter_fillers, professionalize)` =
`(true, false)` 1570 times, `(true, true)` 7 times, `(false, false)` 9 times.
Exactly the three the modes produce, never a fourth from a toggle. The
`(false, true)` arm of `correction_system_prompt` had no producer at all: only
Rewrite sets `professionalize`, and it always sets `filter_fillers` with it.

`docs/DESIGN_SYSTEM.md` already answers this: *"A setting that does not affect
runtime belongs in neither the UI nor the design system."*

Beyond the dead flags, two of the toggles were **redundant with the mode axis
even if they had worked**. Cleanup with AI cleanup off is Verbatim. Cleanup with
Rewrite phrasing on is Rewrite. Two axes described one state, which is why every
arrangement of the card felt wrong -- including nesting the toggles per mode.

The market splits two ways. superwhisper and VoiceInk treat a mode as a closed
preset (voice model, AI instructions, context, output, trigger) with no global
cleanup switches, and express raw transcription as its own mode rather than a
toggle inside another. Wispr Flow instead exposes one ordinal "Auto Cleanup"
scale (None/Light/Medium/High) -- and publicly named an over-aggressive cleanup
default as its biggest accuracy-complaint driver.

A third defect sat next to these. Two further per-profile fields were editable
and never read: `auto_detect_mode`, which the runtime took from the global
`AppConfig` field while the UI wrote the per-profile one, so the workspace-context
toggle did nothing; and `agent_name`, where the name shown in Settings and the
name the detection heuristic matched against could differ.

## Decision

**The processing mode is the only axis that decides what happens to dictated
text.** Modes are fixed presets, superwhisper-style. All six stay
(Auto / Verbatim / Cleanup / Rewrite / Agent / Prompt Enhance), the cycle order
and all six hotkeys stay, and the "Cleanup settings" card is gone.

`ProcessingMode::transform_preset()` is the single producer of the three
correction switches. It takes no profile input, so there is no value a config can
hold that changes it. `NativeTransformConfig::from_capture_config` takes the
preset as an argument rather than reading it off the capture config, because only
the caller knows the *effective* mode -- an override or an Auto resolution can
differ from the mode stored on the profile, and the capture config is loaded
before either has run.

`rewrite_style` becomes derived rather than stored, for the same reason: the live
config held `rewrite_style: "polished"` on a profile running
`processing_mode: "auto"`, so the profile summary described a mode the runtime
was not in.

**Auto resolves to exactly one entry of the flat mode list, at one commit
point.** `resolve_auto_mode` stays synchronous and pure and returns either a
decision or `NeedsClassifier`; the caller makes at most one classifier call and
then commits. The Agent branch no longer re-classifies: reaching it already means
the mode is Agent.

**Auto never selects Verbatim or Rewrite.** Rewrite is a deliberate stylistic
choice. Verbatim was investigated as a candidate and rejected on measurement --
see below. Both invariants are enforced by tests rather than only stated here.

**Workspace context reaches every mode as one bounded hint**, read per profile,
detected once per session.

**The profile's text rules are the pipeline's final stage and run for every
mode.** Dictionary replacements and snippet expansions are deterministic string
operations that belong to the profile's vocabulary, not to a mode: the mode
decides how text is produced, the vocabulary decides how the user's own terms are
spelled. `finalize_with_text_rules` is that stage and sits at the single pipeline
exit, after the mode branch, so no branch can bypass it.

This was a real gap, not a restatement. The call previously sat *inside*
`apply_native_transform`, which Agent and Prompt Enhance never call — so those two
modes silently skipped the user's dictionary and snippets entirely. Agent half
hid it by passing dictionary and snippet entries into its prompt as context, which
asks the model to honor them rather than applying them; Prompt Enhance did neither.
Verbatim was never affected: the call already sat outside the `post_process`
branch, so raw dictation always got its text rules.

## Consequences

- Nothing that worked is removed. Three controls that never reached the runtime
  are, plus a fourth (`ProfileModesSettings.agent_name`) that is made real
  instead: the runtime now reads the per-profile name with the global as
  fallback.
- The `(false, false)` prompt arm stops being dead -- it becomes the
  Agent/Prompt-Enhance preset, which the history re-transform can reach. The
  `(false, true)` arm is deleted, and a test asserts no mode can produce it.
- Configs written by older builds still load: the removed keys are ignored (no
  `deny_unknown_fields`) and dropped on the next save. `auto_detect_mode` is
  accepted as a serde alias for `collect_workspace_context`, and the UI honors
  the same alias, otherwise a profile from an older config would render the
  toggle off while the runtime had it on.
- The history re-transform previously mixed sources: `post_process` from the
  global field, the other two from the profile, a combination no live session
  could produce. It now takes all three from one preset, and finalizes with the
  text rules like the live pipeline does.
- `apply_native_transform` is now only the correction step. Every caller must
  finalize; the two productive ones (the pipeline, the history retry) do, and the
  e2e tests were pointed at a helper that runs both stages, because a test that
  calls the correction step alone asserts a path the product does not have.
- Dictionary entries now reach Agent output twice: as prompt context and as a
  replacement afterwards. That is harmless rather than sloppy — a replacement
  rewrites `phrase` to `replace_with`, so text already carrying the target spelling
  no longer matches. `finalizing_twice_does_not_duplicate_a_replacement` pins it.
- Snippet expansions now also apply in Prompt Enhance, i.e. inside a prompt bound
  for another AI tool. Consistency was chosen over special-casing: a snippet is a
  vocabulary expansion the user configured, and a mode that silently dropped it was
  the surprising behavior.
- Workspace context in the correction prompt is a **new hallucination surface**.
  It is mitigated, not eliminated: one line, last in the hint block, carrying its
  own "never derive content from this" instruction, and asserted by a corpus case.
  It is the thing to look at first if cleanup output starts drifting toward the
  app it was dictated in.
- The corpus gains a `expected_correction_prompt` block and a driver test.
  Prompt shape is the only lever the product has over the cleanup LLM, so per
  `AGENTS.md` the guards belong there rather than only in unit tests.
- Not addressed: `v1_slice/runtime.rs` keeps its own `rewrite_style` handling and
  its own filler list. It is the legacy slice and takes no product logic.

## Why Auto does not select Verbatim

Verbatim looked like an obvious Auto candidate -- if there is nothing to clean,
skip the model call, save latency and cost, and avoid the failure mode Wispr Flow
documented. The first proposal keyed it on a `terminal` workspace category, which
is wrong on its face: nobody dictates shell commands.

The second proposal was a "nothing to clean" proxy over the transcript itself: no
fillers, no word doubling, ends in `.!?`. The argument for it was that it is safe
by construction, because a false positive could only occur on text cleanup would
not have changed anyway.

That argument is wrong, and measuring it is what showed it. Against the 75 real
entries in the local history (raw vs. transformed transcript):

- **56 of 75 (75%)** transcripts satisfied the proxy.
- **30 of those 56 (54%)** were still changed materially by cleanup.

What cleanup did there, beyond fillers and a final period: German verb order
(`weil wir müssen diesen Kunden closen` -> `weil wir diesen Kunden closen
müssen`), discourse particles (`Hier ist halt das Problem` -> `Hier ist das
Problem`), capitalization and internal commas (`auf jeden fall … als task` ->
`auf jeden Fall … als Task.`). The proxy detects none of that. A short-utterance
variant fares no better: 13 entries under 5 words, 6 changed (46%).

Whisper's punctuation is also not dependable enough to lean on -- one entry
satisfied the final-punctuation check while being entirely lowercase with no
internal commas.

Whether grammar, word order and capitalization are acceptable cannot be
established without the model. So any cheap Auto->Verbatim proxy silently
discards real corrections in roughly half the cases it fires, and Verbatim stays
a deliberate choice, reachable by hotkey, cycle or profile default.

The measurement is recorded in
[known-issues/auto-mode-verbatim-routing.md](../known-issues/auto-mode-verbatim-routing.md)
so the idea is re-examined against data rather than intuition.

## A note on the filler list

The filler tokens the cleanup prompt names include `um`, which is an English
interjection and a German preposition. It appears 4 times in the 75-entry live
sample, every time legitimately (`Um die zwei anderen Sachen …`). The instruction
now says a filler is only stripped where it stands alone as an interjection, and
names German `um` explicitly. A corpus case guards it. The same token sits in
`v1_slice/runtime.rs`'s `is_filler`, untouched here.
