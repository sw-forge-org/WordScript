# 0042 -- One surface owns every model choice

Date: 2026-08-03
Status: Accepted (planning direction; not implemented)

## Context

A model could be selected in five places in the settings prototype, and each
one was individually defensible:

| Where | What it set |
| --- | --- |
| Speech-to-Text | the recognizer, its lane, its key, its language |
| Language Models, five tabs | one model per processing mode |
| Notes & Meetings | the meeting speech engine -- lane, model, and an override |
| Agents → Voice | the speech synthesis preset |
| Speech-to-Text, local checks | named a local model it had no way to install |

The total was not usable. "Which model is doing this" required opening four
screens and knowing which one wins, and the same ten providers were listed on
three of them.

### The wrong fix, recorded because it is the instructive one

This pass first added a **sixth** place: a `Providers & Keys` screen, to hold
the credentials the other screens shared. The reasoning was sound in isolation
-- one Groq account serves both speech and language, so a key repeated on six
tabs is six places to change one secret -- and the result made the problem
worse. Three screens now listed providers instead of two, and the actual gap
was still open: no way to install a local model.

The mistake was treating the credential as the thing that needed a home. **A
key is one row.** It is small, it belongs where the provider is chosen, and it
needs exactly one extra sentence -- which other jobs hold it, so that changing
it warns you. What actually had no home was the *installation*: a server, a
runner, model files, downloads, disk.

### What the donor does, and why we do not copy the shape

OpenWhispr has no provider screen either. `InferenceConfigEditor.tsx` is one
component used by every scope, carrying the whole chain where the decision is
made: lane → provider → model → credential. Its Speech-to-Text section divides
by **consumer** (`dictation`, `noteRecording`, `upload`) and its LLM section by
**scope** (`dictationCleanup`, `dictationAgent`, `dictationTranslation`,
`noteFormatting`, `chatIntelligence`). Neither divides by provider.

It keeps speech and language as two top-level sections, and that is right *for
it*: its speech section carries a local model manager, a VAD panel, GPU
selection and three consumer tabs. Ours does not. Split the same way here, the
speech side is one engine row and a language picker and the language side five
near-identical rows -- two screens whose combined content is one screen's
worth, joined by the fact that they take the same settings from the same
providers. The division earns its keep at the donor's size and does not at
ours.

## Decision

**One section, `AI Models`, owns every model choice in the product.** It
replaces Speech-to-Text, Language Models and the Providers & Keys screen that
had grown between them.

**One connection, stated once.** A lane, a provider, a key and the account
plan. Everything else follows it unless a job says otherwise. Most users set
this and never open anything below it.

**The lane is four, not two.** Cloud, Local, Self-hosted, Enterprise. Cloud and
Local were the two the surface had, which left self-hosted and enterprise with
nowhere to live -- and that homelessness is what produced the extra screen.
Each lane answers "where does this run" and each brings its own credential
shape.

**One row per job, and the row opens into its settings.** Grouped by what the
job does, because that is the question a user arrives with:

| Group | Jobs |
| --- | --- |
| Listening | Dictation · Meetings · Upload |
| Writing | Cleanup · Rewrite · Translate · Prompt Enhance · the assistant |
| Speaking | the orchestrator's voice |
| Runs no model | Verbatim · Auto · Agent |

Closed, a row answers what is running it and whether that is the default or an
override. Open, it is that job's whole settings -- in place, no navigation.

**The last group is on the surface deliberately.** "Why can I not set a model
for Verbatim" is answered by seeing it stated. An absence answers nothing.

**A key is a row, not a screen**, and it names the other jobs that hold it. A
key is shared, so editing it has effects elsewhere, and a consequence is
reported in sight of the control that causes it (ADR 0034). A provider screen
could have listed the key; only the row can warn at the moment it changes.

**The local installation is the second tab, and it is one tab for both kinds.**
Speech models and language models sit on the same disk, under the same runtime,
and compete for the same memory. Split across the jobs that consume them, the
total -- the number that matters when a model is 4 GB -- would be invisible.
Downloads, sizes, removal, the server and the detected acceleration live here.

**Providers are declared once, with capabilities, and pickers filter on them.**
`ProviderCapabilities.transcription` and `.chat_completion` already model the
distinction in the runtime; the surface reads it rather than keeping a second
hand-written list. A provider that recognizes no speech cannot be offered for a
listening job by construction rather than by remembering.

ADR 0037 is untouched: no secret is rendered back, here or anywhere.

## Consequences

- **The settings window drops from 13 sections to 11**, and the AI group from
  five entries to three. The old `stt` and `llm` ids stay as aliases, per
  §4.3's rule that deep links survive.
- **The meeting speech engine moves out of Notes & Meetings.** That screen
  keeps what a meeting *records* -- microphone, system audio, echo cancellation
  -- because that is a capture question. What *transcribes* it is a model and
  is a row here.
- **`Providers & Keys` is withdrawn before it was ever built.** It exists in
  this repository's history for one commit and nowhere else.
- **The local lane stops being a claim.** It could be selected and then not
  populated: four native checks with no way to act on them, and a lane whose
  models did not exist. In-app downloads with sizes, progress and removal are
  now part of what the lane means, which makes ROADMAP Phase 5 a prerequisite
  for the lane being offered at all rather than an improvement to it.
- **A bundled server is now on the roadmap and was not.** Language models on
  the local lane need an OpenAI-compatible server in front of them. The surface
  offers two answers -- WordScript ships and manages one, or it talks to the
  Ollama or LM Studio you already run -- and the first of those is a sidecar
  binary with a lifecycle, a port and a shutdown path. It is drawn here so the
  decision is visible; which server, and whether it is bundled at all, belongs
  to Phase 5.
- **Ten providers means ten adapters, and they land one at a time.** The
  surface lists what is intended so the shape is settled; what ships is what
  has an adapter, and a provider with no key is offered in no picker.
- The risk this record accepts is that one long screen replaces several short
  ones. It is mitigated by the closed row carrying the answer, so the length is
  only paid by someone who is changing something -- but if the list outgrows
  the scroll, the fix is grouping inside it, not a second screen. A second
  screen is what this record exists to undo.
