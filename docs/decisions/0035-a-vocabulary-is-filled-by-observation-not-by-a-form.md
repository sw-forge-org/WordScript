# 0035: A Vocabulary Is Filled by Observation, Not by a Form

Date: 2026-08-02
Status: Accepted

## Context

ADR 0032 and ADR 0033 built the per-profile vocabulary: terms reach every LLM
stage as granular context, drive `core::vocabulary_repair`, and — with a
per-entry switch — bias the recognizer's initial prompt. ADR 0034 made the
limits visible on each row.

**The list stays empty, so all of it is worth nothing in daily use.** To fill it
you have to predict which words the recognizer will get wrong. Nobody knows that
in advance. You find out in the second the text comes out wrong — and in that
second you are inside a task and will not open Settings. The knowledge walks
past the form every single time.

Two consequences follow, and both were confirmed with the product owner.

**The recognizer switch is not merely unusable; its intuitive use is wrong.** A
user switches on their most important terms, which are the long product names.
Those are exactly the ones `vocabulary_repair` restores reliably after the fact.
The terms that actually need a recognizer slot are the *short* ones: `Tauri` is
five characters, sits below `MIN_TERM_CHARS`, and is unrecoverable once the
transcript exists. Operating the switch the obvious way spends all four slots on
the terms that needed them least.

**Profile context is a different case and stays a form.** Topics are few,
stable, and knowable in advance. A form fits that. It does not fit a set that
grows with every new project.

**The teacher already exists.** For every dictation in an AI mode WordScript
holds two texts: what the recognizer heard (`raw_transcript`) and what came out
(`transformed_transcript`). Both are already persisted per session in
`TranscriptionHistoryEntry`, with no new storage and no new privacy trade-off.
When the cleanup LLM turns "cuber netties" into "Kubernetes", that is a complete
proof: the recognizer cannot spell the word, the word belongs to this person's
vocabulary, and the sentence was enough to identify it.

This is not circular even though the LLM already fixed the text:

- Verbatim runs no LLM at all — nothing happens there today.
- The LLM is unreliable about it. Sometimes it recognizes the term, sometimes
  not. A learned term makes the repair deterministic.
- Only a populated list can fill the four recognizer slots sensibly, which
  *prevents* the error instead of repairing it.
- Deterministic repair is free and instant; every LLM correction costs tokens
  and latency.

The LLM teaches the system what it can then do without the LLM.

A separate defect surfaced while reading the same area: **Prompt Enhance never
received the profile's terms at all.** ADR 0033 states a term reaches every LLM
stage; `PromptEnhanceConfig` had no `vocabulary` field, so the one mode whose
output travels straight into another tool was the one mode that could respell a
profile's own names. That is a correction to ADR 0033's mode table, recorded
here rather than by editing 0033.

## Decision

**A vocabulary is filled by observation.** `core::vocabulary_learning` diffs the
raw transcript against the delivered text and reads the replacements the
correction stage made. A replacement is a candidate when it looks like a
misrecognized name rather than a rewording: one word out, one to three words in,
within a relative edit distance on the same normalization `vocabulary_repair`
uses, long enough that a close match is evidence, and of a shape the recognizer
channel could carry. Everything else — a reworded verb, a stripped filler, a
shortened sentence, a sentence-initial capital — yields nothing, and the corpus
asserts that in both directions.

The distance budget is **looser** than `vocabulary_repair`'s, deliberately,
because the consequence differs. There, accepting too much rewrites a word the
user said. Here, accepting too much writes a row into a side store that needs a
second sighting before it becomes anything.

The candidate floor sits at five characters — *below* the repair floor, not on
it. The short terms are the ones this whole feature exists for.

**Promotion needs two sightings in two deliveries.** One can be coincidence; the
correction stage rephrases too. Two is a pattern. The store records the delivery
each observation came from, so "two sightings" means two occasions rather than
two code paths. A hand correction in the overlay counts as two and promotes on
sight: the user saw the wrong text and wrote the right one, and there is no
ambiguity left for a second sighting to resolve.

**The system allocates the recognizer slots.** `use_as_prompt_hint` stops being
read and survives as a migration remnant, the way `stt_hints` already does.
`select_recognizer_slots` orders terms by the rule intuition gets backwards:
terms below `vocabulary_repair::min_repairable_chars()` first, then by how often
the correction stage was seen repairing them, filtered by the same form rules
the recognizer path uses and capped at the same budget. Everything in the
vocabulary still reaches every transform stage unconditionally — the selection
is an addition, never a filter.

**Words & names becomes a display.** The per-row checkbox, the capacity badge
and the move buttons are removed: all three operated a decision that is no
longer the user's. Manual add and remove stay — knowing a term the system has
not seen yet is legitimate, and a wrong learned term is removed rather than
corrected, because a term has no left-hand side to fix (ADR 0033). Each row says
where it came from, how often it has repaired something, and whether the
recognizer carries it. The last one is stated, never chosen, and it is resolved
from the runtime's analysis rather than recomputed — the rule ADR 0034
established.

**The overlay says when it learned something.** A tab slides out of the pill's
left edge naming the term, holds for about 1.4 seconds, and withdraws — 1.9
seconds end to end, one shot, nothing to dismiss.

It is presentation and travels on `wordscript-learning-event`, its own channel:
per ADR 0018 and ADR 0019 a session ends in exactly one reducer commit, and
nothing here may set `status`, `pendingResult`, `previewStaged` or
`resultSurfaceOpen`.

Three properties of the implementation are decisions rather than styling:

- **It animates `width`, not `transform` or `opacity`.** Those two are
  composited, and a compositor layer on an element that outlives a surface swap
  is precisely what WebKitGTK fails to invalidate — the ghosting mechanism
  `docs/known-issues/overlay-ghosting.md` records. A width animation drives
  layout, which forces a repaint per frame instead of caching a raster. It is
  the more expensive property and the correct one here.
- **It never calls `set_size`.** A resize per reveal is what the 1px height
  oscillation exists to work around. The tab lives in the transparent strip
  beside the centred pill, absolutely positioned, so it changes no measured
  geometry — in the pill's flex flow it would widen the pill, and a pill wider
  than the window has its rounded ends clipped.
- **It degrades rather than truncates.** The strip is `(480 − pillWidth) / 2`
  and the pill's width swings by over a hundred pixels between surfaces. Where
  the term fits it is named; where it does not, the marker dot appears alone;
  where even that does not fit, nothing does. Truncating the term to `Kuber…`
  was rejected: it carries less than the marker and reads as a rendering fault
  rather than as a deliberate short form.

The widths are measured on the mounted element at width 0, where the shutter
paints nothing, so the decision is made on the real thing and a tab that does
not fit is never seen. Two coordinate spaces are kept apart deliberately:
`offsetWidth` is layout pixels inside the shell's `zoom: 0.87`, which is what a
CSS `width` must be written in; `getBoundingClientRect()` is painted pixels,
which is what "does this fit in the window" must be asked in. Reading the wrong
one costs 13% and hides the tab on exactly the surface a delivery lands on.

**Prompt Enhance receives the terms**, through the same `profile_context_line`
helper every other mode uses, so it inherits the shared budget. Its framing
stays as weak as its context line's, for the same reason: its output leaves the
product.

## Consequences

`TEXT_PROFILE_SCHEMA_VERSION` goes to 4. `VocabularyHintEntry` gains `origin`,
`learned_at_ms`, `hit_count` and `observation_count`.

The version-3-to-4 migration deliberately rewrites nothing. Serde's default
already lands an entry written before the field existed on `origin: user`, which
is correct, and an unconditional loop would be a defect: the frontend mirror in
`textProfiles.ts` writes profiles back at the version *it* can reproduce, so
this step also runs over configs that already hold learned rows. Overwriting
there would quietly relabel every learned term as hand-typed on the next load.

Candidates live in `vocabulary-candidates.json` beside the history file, not in
the config: a candidate is short-lived runtime bookkeeping, and putting it in
`config.json` would make every dictation rewrite the file the settings form
owns. Promotion writes into the profile through
`with_config_file_lock` → `load_from_disk_within_lock` → `save_to_disk` →
`emit_ready_event`, the pattern `set_active_profile_processing_mode` documents.
A naive load-modify-save races a concurrent settings save, and this path runs at
the end of every dictation — exactly when someone is likely to be in Settings.

`emit_ready_event` fires on a promotion only, never on a `hit_count` bump. The
frontend answers `ready` by re-running `configure_native_trigger`, which
re-registers the shortcut lane; a hit count moves on every dictation that
repaired something, and re-registering the trigger that often is a far larger
change than a counter is worth. The count is persisted either way and the panel
reads it on its next load.

Learning hooks in after the insert has completed, so nothing here is in a
latency-critical path. Every failure is logged and swallowed: a store that
cannot be written or a profile that vanished mid-session must never fail a
delivery the user already has.

**ADR 0033 said learning was blocked on recording the pre-edit text. That was
wrong twice over.** History already holds the raw/final pair for every session,
and the overlay's `apply_edited_preview_text` holds both texts live at the same
moment. Neither needed new storage.

**Verbatim-only users learn nothing.** With no LLM there is no teacher, and the
overlay-edit path is rare by the owner's own account — people paste into their
target document and correct there. This is an honest limitation, not one to
paper over: those users still have manual entry, and a term they add there works
exactly as before.

Candidates are scoped to the profile that was active. Sharing terms between
profiles is a separate question about what a profile means, and it is not
answered here.

## Related

- ADR 0033 — a term has no left-hand side. This ADR keeps that and corrects two
  of its statements: Prompt Enhance did not in fact receive terms, and learning
  was not blocked on new storage.
- ADR 0034 — a limit belongs to the control that spends it. Its per-row rule
  survives; the controls it placed the limits beside are removed, because the
  limits are no longer spent by the user.
- ADR 0032 — the profile context is topics and the recognizer never reads it.
  Unchanged: that field stays a form, for the reason given above.
- ADR 0018 / ADR 0019 — one reducer commit per session. The learning event is on
  its own channel precisely so it cannot become an exception to that.
- ADR 0025 — a session refers to the profile as it was when recording started.
  The known-term list a candidate is judged against comes from the session
  snapshot, not from disk at delivery time.
