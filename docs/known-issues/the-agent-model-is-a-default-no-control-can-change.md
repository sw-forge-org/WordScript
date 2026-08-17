# The chat model that titles, classifies and answers is a default no control can change

Status: **Open, found 2026-08-17.** Nothing is fixed. Not an attribution defect
and deliberately not filed as one — see *Why this is not the ADR 0206 shape*.

Found while checking whether `chat_model_for_job` had the same split-brain the
correction model did (ADR 0206). It does not. What it has instead is a field
that looks like a per-profile override and is read by nothing, over a value no
surface writes.

## What is true today

**Three readers, one answer, and they agree.** `AppConfig::chat_model_for_job`,
`mode_router`'s `chat_model` closure and the Auto classifier in `lib.rs` each
resolve the job's lane and then take the **connection-wide** `agent_model` /
`local_agent_model`. There is no second path to disagree with.

**Nothing writes either field.**

- Per profile: `textProfiles.ts` puts `agent_model` and `local_agent_model` into
  every new profile's speech block as copies of the runtime defaults. **No Rust
  path reads them.** The only reader of `speech.local_agent_model` anywhere is
  `model_install`'s *is this file in use* check.
- Connection-wide: no screen writes `agent_model` or `local_agent_model` at all.
  `Models.tsx`'s `Use` button writes `local_model` for a speech row and
  `local_correction_model` for a language row, into the **active profile's**
  speech block. The agent's model is not among its two destinations.

So the value is whatever `shared/model_catalogue.json` names in
`runtime_defaults`: `groq-chat-versatile` on the cloud lane,
`local-chat-ollama-llama32` — `llama3.2:latest` — on the local one.

**What spends it** is not rare. Every record's title goes through
`transcript_store::describe` on the `Assistant` job, from three call sites; the
Auto classifier asks the same job whether a dictation was an instruction; Agent
mode runs on it.

## The consequence, and it is a lane apart

**On the cloud lane there is no failure, only no choice.** The default is a
model Groq serves, so titles and Agent work; a reader who wants a different one
has nowhere to say so.

**On the local lane it silently degrades.** A user who pulled a model and
pressed `Use` has set their *correction* model. Their agent model is still
`llama3.2:latest`, and if that tag is not on the machine the request has nothing
to answer it: `describe` returns no title and the record falls back to its first
words — a fallback that looks exactly like *the model could not name this*, not
like *the model does not exist*. Agent mode fails outright. **One control exists
for one of the two local chat models and none for the other.**

## Why this is not the ADR 0206 shape

That record's defect was two live paths reading two different objects, so the
same session could be transformed on one model and retried on another. Here
there is one reading, consistent everywhere, over a field nobody sets. **The
distinction decides the fix**: 0206 needed a resolver, this needs either a
control or the field's removal — and writing it down as the same thing would
send the next reader looking for a divergence that is not there.

**The per-profile copy is this directory's documented trap.**
`use_as_prompt_hint` is a field nothing has read since ADR 0035 and it has
produced two recorded wrong turns —
[`dictation-comes-back-in-english.md`](dictation-comes-back-in-english.md) and
[`transcript-stops-before-the-audio-does.md`](transcript-stops-before-the-audio-does.md)
— because a reader assumed a stored field meant something. `speech.agent_model`
is the same object waiting for the third.

## What a fix has to answer

- **One axis or two.** ADR 0094 made the *vendor* per job and per profile. If the
  chat model follows it, the per-profile fields get wired and the connection-wide
  ones become the fallback — the shape ADR 0203 and ADR 0206 both landed on. If
  it does not, the per-profile fields go, because a stored value nothing reads is
  worse than an absent one.
- **Where the control goes.** `Models.tsx`'s `Use` button maps a row's role to
  one destination, and a language model can legitimately serve correction, the
  agent, or both. That is a surface question with a real answer in the drawing,
  not an implementation detail.
- **The local lane is the one that fails**, so it is the one that decides
  whether this is worth building. The cloud lane can wait behind it.
- **A test that the two chat models cannot drift apart** the way the correction
  model did, if the fields are wired rather than removed.

No fix is written here.

## Related

- ADR 0206 — the correction model, which *was* the divergence this looked like.
- ADR 0203 — the same question for the recogniser.
- [`tracks/speech-track-plan.md`](../tracks/speech-track-plan.md) step **B13** —
  where the work is queued. The Models surface is that track's.
