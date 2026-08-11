# 0099: The direction of a turn is read off the recogniser, never off a button

Date: 2026-08-11
Status: Accepted (planning direction; not implemented). The reliability half is
a measurement and stays open.

## Context

The translation window's drawn `Conversation` tab carries one sentence that is
the whole feature: *"German heard, switching by itself."* The roadmap says the
same thing twice and calls it the real gate -- **a button per turn is a demo**,
and whether the switch detects reliably enough to take no button is *"a
measurement, and the one that decides whether a conversation at a table works or
only demonstrates."*

Nobody had checked whether the signal exists. It does, on several lanes
([PROVIDERS.md](../PROVIDERS.md), read 2026-08-11):

- **OpenAI** -- the transcription completion event *"also includes detected
  languages"*, plural.
- **xAI** -- the response carries a `language` field, and the API detects
  automatically. Its `language` *parameter* does something else entirely: it
  formats numbers, currencies and units into written form.
- **ElevenLabs** `scribe_v2_realtime` -- automatic language detection across
  90+ languages.
- **Azure OpenAI** -- the same OpenAI stack, 100+ languages.
- **Groq** -- no. Language is a hint that improves accuracy and latency;
  automatic detection is not documented. **The lane the product runs on today is
  the one lane that cannot answer this.**

The response type the runtime already has carries the field:
`TranscriptionResponse.language`.

## Decision

**A turn's direction is whatever the recogniser said it heard, matched against
the session's language pair.** No button, no per-turn gesture, and no separate
language-identification model where the recogniser answers it.

The rule, in full:

1. The session holds a **pair** -- a from and a to. Both are real languages; the
   pair is not a source plus "auto".
2. Each turn's recognised language is compared against both members.
3. **A match assigns the direction.** The turn is rendered into the other member
   of the pair.
4. **No match leaves the direction where it was**, on the turn's most recent
   assignment, and the line says so on itself. The window does not silently
   turn a mis-detected turn around, and it does not drop it.
5. A swapped pair takes effect from the next utterance. Lines already produced
   keep the languages they were produced in; nothing is retranslated
   retroactively, because a record of what was said is a record (ADR 0064).

**Rule 4 is the one that carries the feature.** A detector that is right most of
the time and visibly uncertain the rest is usable at a table; a detector that is
right most of the time and confidently wrong the rest is not. The failure mode
this forbids is a turn arriving in the wrong column with nothing marking it.

**This is not `hallucination_detect.rs`'s language switch, and the two must not
see each other.** That stage observes a language change *inside one finished
batch transcript* as one signal among several for discarding invented text, and
ADR 0016 constrains it: *"A language mismatch is never on its own a reason to
discard anything."* It is quality control on one recognition. This is routing
between two of them. Wiring either to the other would make a conversation's
normal behaviour -- two languages alternating -- look like a hallucination.

**The reliability half is a measurement and is not decided here.** What this
record fixes is *where the answer comes from*. Whether the answer is good enough
to take no button is a number this repo does not have. The instrument is the one
it already uses for recognition behaviour: bilingual turn fixtures in
`src-tauri/tests/fixtures/regression_transcripts.json`, loaded by
`core::regression_corpus`, with synthetic tests beside them. **A feature that
ships before that measurement ships on a guess.**

## Consequences

- **The lane decides whether the surface can exist.** On Groq the recogniser
  does not name what it heard, so a conversation there needs either a button per
  turn -- which the roadmap already calls a demo -- or a second call whose only
  job is identifying the language, which is latency spent on every turn. This is
  a scheduling fact for the translation window and an argument for the order in
  ADR 0096.
- **`ProviderCapabilities.reports_detected_language`** (ADR 0094) is what a
  surface asks before offering a switch-free conversation. It exists so the
  answer is read rather than assumed per lane.
- **The pair is a config shape the runtime does not have.**
  `TranslateSettings` holds a `target_language` and
  `keep_profile_words`; a pair is two languages held for a session, and the
  eight-entry `TRANSLATE_LANGUAGES` table is the vocabulary it draws from.
- **`ProcessingMode::Translate` is untouched.** Its rule stands exactly as
  ADR 0041 wrote it -- *Auto may choose how text reads, never what language it
  is in* -- and this record does not give Auto a language decision. A
  conversation is not Auto; it is two languages a user named.
- **Whether the window needs a processing mode of its own beyond ADR 0041's is
  still open**, named by the owner when the lifecycle was decided (ADR 0064),
  and this record does not settle it. Detecting a direction is not the same
  question as which prompt renders the turn.
