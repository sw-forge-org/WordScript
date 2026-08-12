# 0131: Every surface that starts a job names where it runs, and the drawing already decided more than was read

Date: 2026-08-13

Status: Accepted

## Context

ADR 0129 moved the provider choice to the point of use and named two surfaces —
the upload intake and `Translate.tsx`. ADR 0130 then filed two questions as open
and owed to the owner: *is a meeting live-transcribed at all*, and *what happens
to the audio of a meeting nobody keeps*.

**Both were already drawn, and reading the prototype rather than reasoning about
it would have found them.** That is the rule
`docs/prototypes/settings-rework/README.md` exists to enforce and it was broken
twice in two days:

- `demo.js:4614`, on the `Meetings` job row of `AI Models`: **`Live transcript`,
  `toggle(true)`** — *text arrives while you are still talking, which is what
  makes the meeting HUD worth looking at during a call.* Live transcription is
  drawn, defaulted on, and belongs to a job row rather than to a gate.
- `demo.js`, Meeting capture: **`Keep the audio`**, badge `Open decision`,
  `Until the note is saved | 7 days | Never`. The retention question is drawn
  *with its options and its default*, and the default ties retention to a
  lifecycle event rather than to a timer — which is better than the proposal
  that was about to be made for it.

**Two further things the drawing carries that no record here mentions.**

**Diarization.** `Separate speakers` — *labelled as the call runs and
re-clustered when it ends* — with `Expected speakers` beside it, on by default
for `Meetings` and off for `Upload`. The screen states three stages and that
only the first two are audio: source separation (microphone is you, system audio
is everyone else), clustering into Speaker 1 and Speaker 2, and a **name**,
which never comes from audio at all. A name the user set is locked against the
re-clustering pass. ADR 0130 said a meeting wants a lane that streams; the
drawing has said since 2026-08-03 that it wants one that **streams and separates
them**, which is a third requirement.

**The copilot.** One strip above the bar in the meeting HUD, ADR 0047's: it
never speaks, it never hints without a citation, it replaces rather than stacks,
and it may notice exactly three kinds of thing. Its cost row is drawn
`Open decision` with the toggle **off**: *it compares the running transcript
against the index continuously, which is inference for the length of the call
rather than once at the end.*

**The donor reading was also incomplete and is corrected here.** The claim that
`openwhispr` was the only donor with a meeting implementation was wrong.
`donors/app/linux-dictation/voxtype` carries a full one **in Rust** —
`src/meeting/` with `chunk.rs`, `diarization/{simple,ml,subprocess}.rs`,
`summary/{local,remote}.rs` and `export/` — and the prototype's own Speakers
section cites it by path. Both donors are MIT; this repository is AGPL-3.0, so
neither direction is obstructed.

## Decision

**Every surface that starts a job states the resolved provider and model, and
lets that job's provider be changed there.** ADR 0129 established this for two
surfaces by naming them; it generalises, and the general form is the rule. A
surface that begins work without saying where it is about to send the audio or
the text is the fake-state rule applied to an action rather than to a badge.

**It holds on all four lanes, not on Cloud.** `Follows` already renders three
different shapes — a provider row on Cloud and Enterprise, *Runs on* for Local,
*Endpoint* plus a free-typed model for Self-hosted — and a constraint has a
different answer on each: Local and Self-hosted have no upload ceiling because
nothing is uploaded, Cloud has the vendor's, and **Enterprise has its own per
lane member** (Azure OpenAI transcribes, Bedrock and Vertex do not). An
implementation that handles Cloud and treats the rest as a fallback has built
the thing this record exists to prevent.

**The drawn answers stand and are not re-decided.** Live transcript is a toggle
on the `Meetings` row, defaulted on. Retention is `Until the note is saved`,
with its two alternatives, and it keeps its `Open decision` badge until somebody
answers it. Diarization is a requirement of the meeting lane beside streaming.

**What replaces ADR 0130's first open question is narrower and is not a product
question.** *What does the `Live transcript` toggle say when the connection
cannot stream?* Groq is batch only, so the toggle is drawn on and would be
inoperable on the default connection. That is ADR 0128's second rule applied to
a toggle: it stays visible, it goes inert, and it names the reason — **a lane
that cannot stream**, which is a fourth `InertReason` kind beside no-adapter,
role-denied and no-credential.

**The context-window answer is map-reduce over semantic boundaries, and it is
the same principle as the audio side.** Cut where a seam already exists.
Published practice converges on chunking at **topic and speaker-turn
boundaries** rather than at token counts, summarising per chunk and combining —
each chunk carrying the previous one's summary so a decision spanning a boundary
survives. **The audio is cut on silence and the transcript is cut on topic**;
both refuse the arbitrary cut for the same reason ADR 0130 refused
ten-minute windows.

**And no donor in this tree solves it.** `voxtype`'s `summary/mod.rs:153`
concatenates every segment into one prompt and sends it — no truncation, no
chunking, no ceiling; `local.rs` logs the character count on the way out.
`openwhispr` sends long files to its own backend. **The most complete Rust
meeting implementation available to this repository has the same gap this
repository has**, which is worth recording so the next reader does not go
looking for an answer that is not there.

## Consequences

**B7 grows a surface inventory rather than two names**, and it is in the plan
rather than here because it is sequence: the upload intake and `Translate.tsx`
exist and are B7's; the meeting HUD, the translation window, Live subtitles,
the agent overlay and Client conversations do not exist yet and carry the
obligation into the step that builds each.

**A fourth `InertReason` kind lands with whichever step first draws a control
that a non-streaming lane cannot operate.** It is not B7's — B7's constraint is
size — but the two are the same mechanism and the second one should not invent
a second.

**`Meetings` and `Upload` are drawn job rows with no runtime path** (A4 recorded
this), and the copilot is a fourth consumer of a model that no axis carries: it
is neither transcription nor the notes pass but a continuous retrieval against
an index for the length of a call. **It is not `JobKey`'d.** Whether it becomes
a job or rides the assistant's resolution is open, and ADR 0040's *one model for
all four* is the argument that it rides.

**Two candidate donors are worth adding and neither is added by this record**,
because pulling a repository into `donors/` is a provenance decision with an
owner: **Meetily** (Zackriya Solutions) is the closest stack — Rust,
whisper.cpp, Parakeet, diarization, Ollama summarisation, fully local — and
**Anarlog**, formerly Hyprnote, is Tauri and GPL-3.0, which this project's
AGPL-3.0 accommodates. Both are cited from a web reading on 2026-08-13 and
**neither has been verified against its source tree**; that verification is the
precondition for adding either.

**What this does not do:** answer the retention question, decide the copilot's
cost, or settle what a picker looks like mid-conversation. All three stay the
owner's, and all three are drawn with an `Open decision` badge already, which is
where they should stay until answered.
