# 0180: The lane that most dictations take never names a language, so the language is measured on the text

Date: 2026-08-16
Status: Accepted. Tenth record of the home activity track
([`../tracks/home-activity.md`](../tracks/home-activity.md)). Wires the
`Languages` tile, which
[ADR 0161](0161-a-drawn-row-says-so-beside-its-own-label-and-the-sketch-is-the-deliverable.md) had drawn with a
`PreviewTag` and no figure, and replaces the track's step B1.

## Context

The tile carried a tag reading *the record stores the configured language, not
the recognised one*, and the plan was step B1: pass `response.language` through
onto the record and count it.

**Measured against the lanes this product runs on, B1 delivers nothing.**

| Lane | `reports_detected_language` |
| --- | --- |
| Groq (`whisper-large-v3`, the default) | `Unsupported` — language is a request hint and the response never names one |
| Local runtime | `Unsupported` — returns `json`, which has no field for it |
| OpenRouter | per model, mostly `Unknown` |
| OpenAI (`whisper-1`) | `Supported` |

Every dictation on the reporting machine goes through Groq. A measurement that
only works on the lane nobody here uses is not a measurement, and the tile would
have stayed dark while looking wired.

Counting `entry.language` instead is worse, and that is what the tag already
said: it is `optional_non_empty(&app_config.language)` — the CONFIGURED language.
A tile counting it would count how often somebody changed a dropdown, and it
would be exactly wrong in the one case anybody cares about. The known defect in
[`../known-issues/dictation-comes-back-in-english.md`](../known-issues/dictation-comes-back-in-english.md)
is a German dictation returning English text; the config still says German
throughout.

## Decision

### The language is read off the delivered text, in the runtime, offline

`core::language_detect::detect` runs `whatlang` over the text that reached the
cursor and answers an ISO 639-1 code or nothing. The ledger keeps a tally per
code; the record keeps none, and no transcript text leaves the runtime for this
— it is trigram statistics on a string already in memory.

It works on every lane, including the local one, and it keeps
[ADR 0174](0174-all-time-figures-need-a-record-that-does-not-forget-so-the-ledger-is-counts-per-day-and-never-text.md)'s
promise that the ledger holds counts: the one thing stored that is not a number
is a two-letter tag.

### Seventy languages and no allow-list

The first implementation ran against the eight in `TRANSLATE_LANGUAGES`, which is
measurably more accurate on short text and is the wrong trade. Whisper
transcribes some ninety languages, so a Swedish dictation is a thing that really
happens — and against an allow-list it would have been counted as **Dutch**. A
tile that answers confidently for a language the reader does not speak is worse
than one that says nothing.

The detector is still narrower than the recogniser. A language `whatlang` does
not know is not folded into one it does know; it is simply not counted.

### Two refusals, and a refused run is counted in nothing

- **Too short.** Under eight words — or twenty characters, which is what carries
  scripts that do not space their words — trigram statistics are a coin flip with
  a decimal point.
- **Not reliable.** `whatlang`'s own judgement about the margin between its top
  two candidates, rather than a threshold picked by hand: `confidence` is a
  margin and not a probability, so a hand-picked floor would be a number nobody
  could defend. Measured here, ordinary dictations come back at full confidence
  — eleven words of German and fifteen of Swedish both cleared it — while a
  sentence about German written in English did not, and is therefore counted in
  neither.

So the tally sums to less than the dictations behind it. That is the point rather
than a gap: the close pairs (Bokmål against Danish, Serbian against Croatian) are
where trigram detection is weakest, and a refusal there is the correct outcome.

### The tile shows a count, and the foot names the one you work in

The figure is how many languages have been measured. Every name on one line was
fine at two and a smear at ten, so the foot reads `mostly German · +2` and the
hover names the top three with their counts. Names come from `Intl.DisplayNames`
rather than a third list in this repository.

## Consequences

- The tile reports a measurement, and no tile on that row is a drawing any more.
- The known English-drift defect becomes **countable**: a reader whose German
  dictations come back in English will see a second language appear that they did
  not dictate in. That is the measurement working.
- The recogniser's reach and this detector's reach are different numbers, and the
  surface says nothing that implies otherwise.
- **Language breadth elsewhere is a different job.** The per-profile dictation
  language (`SpeechSettings::language`, drawn but unwired — see the known issue
  above) and Translate's eight-entry `TRANSLATE_LANGUAGES` both need their own,
  wider lists, on the speech track. Nothing here changes either, and the table in
  `core::language_detect` is not the list those two should adopt: it covers what
  can be DETECTED, not what can be dictated or translated into.
