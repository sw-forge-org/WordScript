# 0129: The provider choice belongs where the file is, and it is the same stored value

Date: 2026-08-13

Status: Accepted

## Context

ADR 0128 closed open disagreement 13 by making the per-job override read the
config in the product, and left one question explicitly open in its own final
paragraph: **whether `upload` should default to OpenAI at all.** It removed the
surface's claim that it already did, and said the drawn literal stays as the
record of an unanswered product question.

The analysis that followed argued for dropping the default outright, on three
grounds that still hold: nothing in `docs/PROVIDERS.md` backs it (there is a
recorded file ceiling for Groq and none for OpenAI, and no source anywhere
claims OpenAI transcribes an upload better); it is a structural dead end,
because only `whisper-1` accepts `verbose_json` on that vendor and the coverage
check `TranscriptionCoverage` performs is the one this row needs most
(ADR 0126); and it costs a second credential on a fresh install for a job that
would otherwise run.

**The owner's answer reframed it, and the donor confirms the reframing.** The
right correction is not *pick a better default* but *ask at the moment the
question can actually be answered* — with the file in hand and its size known.

`donors/app/desktop-shells/openwhispr` does exactly this, and it was read rather
than remembered:

- `src/components/notes/UploadAudioView.tsx` carries the whole provider stack
  inline on the upload screen — lane segment, vendor chips, API key, model list
  — behind a `Transcription Settings` disclosure, with the resolved answer
  standing above the drop zone as one line of prose: *Using Groq ·
  whisper-large-v3*.
- The same file gates on size before anything is sent: local and self-hosted
  have no ceiling, a third-party key is capped at 25 MB and **refused** above
  it, and their own cloud carries the large-file path.
- The settings screens do the per-job split the other way, as tabs —
  `Dictation | Note Recording` for speech, `Dictation Cleanup | Voice Agent |
  Note Formatting | Chat` for language. That is `INFERENCE_SCOPES`, whose
  flat-key cost A4 already declined to inherit.

## Decision

**A job's provider is chosen where the job is started, and the choice writes the
same stored value the settings row writes.**

`providers.overrides[job]` is already per job and per profile (A4) and writable
since B6. A picker on the upload surface is that value drawn a second time, not
a second axis. **Nothing new is stored, and no second resolution path exists** —
`resolveConfigJobProvider` remains the one door, which is the rule A4 wrote when
it refused to let call sites reach into the map.

**The resolved answer is stated as a sentence before the work starts.** *Using
Groq · whisper-large-v3*, above the drop zone, from the same resolution the
runtime will spend. A surface that begins a long, expensive, irreversible
operation without naming where it is about to send the audio is the fake-state
rule one level up from a badge.

**The full stack lives behind a disclosure, collapsed.** Lane, vendor,
credential, model — the rows `Follows` already renders. Most uploads take the
connection; the person who needs to change it needs the whole ladder, not a bare
dropdown that names a vendor whose key is missing.

**A constraint the runtime can compute greys the option and says why.** The
capability is half-built: `capture_budget.rs` has `seconds_for_upload_limit`,
`CaptureCeilingReason::upload_limit` and the sentence *the 25 MiB upload size on
your free plan*, and `capture_limits` already takes `(provider, model, tier)`.
What is missing is the same table asked in the other direction — *which pairs
accept N bytes* — and a second `InertReason` kind. `ProviderChoice` already
disables an option and carries its reason on `title` (ADR 0128).

**A blocked constraint never silently reroutes the audio.** The option is
greyed, the one that would work is offered, and the user chooses. The donor's
precedent points the same way and is stronger than a preference:
`transcriptionFallback.js` has a fallback target of `skip` so that *a signed-out
user's audio is not diverted*. Sending a recording to a vendor the user did not
pick is a data decision wearing the costume of a convenience.

**`upload` loses its drawn override**, and this is the record that answers
ADR 0128's open paragraph. It goes in the step that adds the picker, not before
it — because after B6 the literal has no product effect at all and removing it
touches only the gallery's inventory, which is a drawing change and belongs with
the drawing that replaces it.

## Consequences

**This is a Stage B step (B7) and it requires B6**, whose writable override and
reason-carrying option list it builds on directly.

**`npm run port:diff` moves, and this time on the gallery's own inventory.**
Removing `override: "OpenAI"` from `Cloud.upload` takes the drawn overridden-job
count from three to two; `screens.test.tsx`'s *marks an overridden job and names
where it went* asserts three and must be updated with the drawing rather than
around it. That test failing is the correct signal and was confirmed by making
the change and reverting it.

**Open disagreements 6 and 12 are B7's to close.** Both live on the `upload`
row: 6 is the dated default behind the override, 12 is the Groq model id offered
under it. Removing the override dissolves 12 outright and reduces 6 to *which
model does upload take on the connection*, which the catalogue answers.

**Translate gets the same treatment and it is the same code.** ADR 0064 keeps
the route per language; this is the model provider, which is a different axis
and already has `translate` as its own `JobKey`.

**What this does not do:** widen the axis. Two surfaces write one value. It also
does not decide `translate` and `assistant`'s drawn Anthropic override — those
name a vendor with no adapter at all, so they are a G3 question, and under
ADR 0128's second rule the literal stays as the record of the intent.

**The one thing not adopted from the donor** is its settings-side per-job tabs.
A4 declined `INFERENCE_SCOPES`' flat-key shape on purpose — five jobs across
eight keys each, with a helper to fan one change back across four of them — and
the sparse override map exists so ten jobs do not become eighty keys.
