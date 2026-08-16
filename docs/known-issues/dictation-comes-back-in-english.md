# German dictation comes back translated into English

Status: **open, reported and measured 2026-08-16.** Nothing is fixed. The
control that would address it is drawn but not wired, which is the finding.

Reported by the owner after `Auto` produced a fully English text from German
speech, with the hypothesis that anglicisms in the dictation are what triggers
it. **The hypothesis is right about the trigger and wrong about where it acts.**
Nothing in the transform stages translated anything; the recognizer returned
English, and the mode faithfully cleaned up English.

## Symptom

A dictation spoken in German comes back as fluent English. Two shapes:

**A — the whole dictation.** Every sentence is English. Observed once in the
50-record window, the case that produced the report
(`history-1786892965394-50`, 2026-08-16 17:09, 86 s, `whisper-large-v3`,
`Founder ops notes`, `processing_mode: auto` resolving to `cleanup`):

> I had the problem that some badge appeared on, probably because some word
> learned, exactly, it was the word commit learned and… The announcement period
> was very strange, very different, it was not gone, but it was also cut out…

The German that was actually spoken is recoverable from the text: *Ankündigungs­periode*
came back as *announcement period*, *Commits* survived capitalized, *ausgeschnitten*
became *cut out*. This is a translation, not a mishearing.

**B — one stretch of it.** The transcript is German, then a passage is English,
then it is German again. This is the "sometimes only the last sentence" half of
the report, and it is the more common shape:

| Record | Where | The English passage |
| --- | --- | --- |
| Struktur von Tabs und Inhalten | 78 % in, to the end | `I think it makes sense, but I'm not sure. Oh now something to change, what do you say?` |
| Dateiwahl und Ordnerverwaltung | 78 % in, to the end | `just that it works under WordScript. So I would say both options must work. … Or will you do it with me?` |
| Eiweißpulver mit besten Eigenschaften | 82 % in, to the end | `If there are not only one, but several alternatives, you can also present them.` |
| Klimawandel und Bildung | 70 % in | `Bildung löst viele Probleme And then you can see that you can see the same thing` |
| AfD Bewertung und Kritik | 38 % in | `Let's year 2025 was the first year in which worldwide the first time more energy from renewable energy was oder nur Solarstrom im Vergleich zur Kohlekraftenergie hergestellt wurde` |
| UI und UX Probleme | 17 % in | `We have a card called speech models and a card called language models. For speech models, it says locally…` |

The last two flip back into German mid-sentence, which is what makes the
mechanism visible: it is not one decision about the recording, it is a decision
that is re-made as the audio is decoded.

## The measurement

Source: `~/.config/WordScript/history.json`, the 50 records it retains
(2026-08-15 16:54 to 2026-08-16 17:11), every one `groq` /
`whisper-large-v3` on the `Founder ops notes` profile, `processing_mode: auto`.
Classified by reading the raw transcripts, not by a language detector.

| | count | share |
| --- | --- | --- |
| Records measured | 50 | |
| **Affected** | **7** | **14 %** |
| — shape A, wholly English | 1 | 2 % |
| — shape B, an English stretch | 6 | 12 % |
| Excluded as legitimate code-switching | 1 | |

The exclusion matters, because it is the thing a naive detector would count:
in *Datenschutz und Transkripteinstellungen* the owner **reads English UI copy
aloud** — `the oldest is dropped when the cap is reached` — inside a German
sentence. That is correct output. Any future automatic rate has to survive this
case, and a rule that flags it is worse than no rule.

**No shape-B passage begins in the first 17 % of a transcript**, and four of the
six are in the final quarter. The recognizer starts in the right language and
drifts out of it; it does not choose wrongly up front. Shape A is the separate
case where the very first window is already English.

## What it is not

Four plausible causes, each ruled out on this record rather than by argument:

- **Not Auto routing into Translate by mistake**, which was the owner's second
  hypothesis and is worth answering structurally rather than from one record.
  `resolve_auto_mode` (`mode_router.rs:126`) has exactly four exits: Agent on
  the name heuristic, Prompt Enhance on an imperative in an IDE,
  `NeedsClassifier`, and Cleanup as the default. The classifier branch
  (`lib.rs:1877`) is binary — `detect_agent_intent` answers yes or no, and the
  two outcomes are Agent and Cleanup. **Translate is on no Auto path.** On the
  affected record `effective_mode` is `cleanup` and the transform confirms it:
  the text was corrected, not rendered into another language.

  One thing is missing all the same: `auto_never_resolves_to_verbatim_or_rewrite`
  (`mode_router.rs:551`) pins Verbatim and Rewrite and **says nothing about
  Translate**. The behaviour is correct today and nothing enforces it, so a
  future router change could introduce exactly the defect this bullet rules out.
- **Not the AI stage.** `transformed_transcript` differs from `raw_transcript`
  only by punctuation and capitalization. The English is already in
  `raw_transcript`, which is the provider's response before any transform.
- **Not the translations endpoint.** Every lane posts to
  `/audio/transcriptions`; `/audio/translations` appears nowhere in the tree.
- **Not prompt bias**, which is the hypothesis this repo has already paid for
  once (`stt-prompt-leaks-into-the-transcript.md`, ADR 0032). On the affected
  record the profile is `bias_mode: conservative`,
  `manual_bias.cloud_include_profile_terms: false`, and **all five
  `vocabulary_hints` have `use_as_prompt_hint: false`** — including `Commit`,
  the term the owner suspected. No initial prompt was sent at all.

## The cause chain

1. `SpeechSettings::language` exists in the config and reaches the provider:
   `capture.rs:438` passes `non_empty(&self.language)` into the request, and
   `groq.rs:277` puts it on the multipart form.
2. **It is empty on this machine and on all six profiles** — machine-wide
   `language: ""`, and `speech.language: ""` in every profile. So no `language`
   field is sent, and Groq is asked to work it out from the audio.
3. **The only surface for it is a sketch, and it points at a screen that does
   not have it.** `Models.tsx:1783` draws the row as a `DrawnSelect` with
   `Auto-detect / German / English` and no handler; `Models.tsx:1794` draws
   *Pin this language* as an `InertToggle`. Beside the select sits a `ScopeTag`
   with `onOpen={useOpenProfiles()}`, so the row reads **Per profile** and
   offers to take the reader there — and `Profiles.tsx` has no dictation-language
   row at all. Its only language control is `translate_target_language`
   (`Profiles.tsx:1317`), which is the Translate mode's *output* language and has
   nothing to do with what the recognizer is told. A reader who follows the tag
   either finds nothing or finds the wrong control under a right-looking name.
   The owner searched Profiles for this setting on 2026-08-16 and reported it
   missing, which is what the screen told them to do.

   The `ScopeTag` doc comment names `language` in its own list of per-profile
   values, so the tag is not a slip — it describes the intended design. The
   field exists in the config (`SpeechSettings::language`) and the runtime reads
   it. Only the two ends are missing: nothing writes it, and no screen offers it.
4. Left to auto-detect, whisper-large-v3 makes a per-window language decision
   over audio that is German carrying dense English technical vocabulary
   (*badge*, *overlay*, *commits*, *flash*, *recording*). When a window resolves
   to English, the model does not stop transcribing — it emits English for
   German speech, and the decoder's own prior context keeps it there for the
   following windows. That is the mechanism the shape-B positions describe.

Step 4 is the part that is inferred rather than measured. What is measured is
that the output is a translation and that the language was never pinned.

## The measurement that cannot be made yet

**The detected language is read and then thrown away.** `lib.rs:1791` takes
`response.language` from the `verbose_json` body, uses it to decide whether the
German-only repairs may run (`recognizer_repair`, ADR 0081), and lets it fall
out of scope. What the history record stores under `language` is
`optional_non_empty(&app_config.language)` (`history.rs:729`) — the language the
user **configured**, which is why all 50 records read `null`.

So there is no way to ask the existing corpus how often Whisper decided `en`,
how often that decision was wrong, or whether shape A and shape B differ in what
the provider reported. Persisting the detected language on the record is the
cheapest instrument this defect needs, and it is a prerequisite for any rate.

The same gap has a second cost: `recognizer_repair`'s German rules are gated on
a language that this defect corrupts. A dictation Whisper calls English gets no
German repair pass, so the two defects compound silently.

## What a fix has to answer

- **Where the control goes is already decided and only half-built.** The
  `ScopeTag` says Profiles, so the row belongs on the profile beside the other
  per-profile speech settings, with the `AI Models` row wired as the findable
  copy that links to it — the arrangement ADR 0024 exists for. The work is a
  Profiles row, a handler on the `Models.tsx` select, and retiring the
  `InertToggle`; it is not a design question. **And it must not land next to
  `translate_target_language` without distinguishing the two by name** — a
  screen offering *Language* and *Target language* one above the other is worse
  than today's absence.
- **Wiring the drawn control is necessary and not sufficient.** Pinning `de`
  would fix shape A and shape B for a German-only user, and would break the
  owner, who dictates in both languages — `speech.language` is per profile, and
  the profile is not switched per sentence. Whether the answer is a pinned
  language, a per-dictation override on the overlay, or a two-language hint is
  an open product question, not an implementation detail.
- **A sent `language` is a hint, not a lock** (speech track, finding 1). It
  makes the wrong decision less likely; it does not make it impossible, and a
  fix that claims otherwise is claiming something the provider does not offer.
- **The detection has to be recorded before the rate can be argued about.** 7 of
  50 is one user, two days, one profile, one model.
- **Legitimate code-switching must survive.** The excluded record is the test:
  German sentences carrying English terms, and English sentences quoted inside
  German, are correct output. This is the same boundary
  `transcription-hallucination.md` pins with
  `raw_german_with_english_terms_is_untouched`, and it is the reason a
  post-processing filter cannot be the fix here.

## Related

- `transcription-hallucination.md` — names "lose the intended language" and
  "language shifts during a sentence" in its symptom list and identifies German
  dictated by an English-writing speaker as the adverse condition. It treats the
  class as an artifact problem and proposes post-STT filters; this record is the
  case where the output is not an artifact but a clean translation, which no
  filter can see.
- `transcription-accuracy.md` — lists "whether language mix is a factor" under
  *What is not known*. This is a partial answer to that line.
- `stt-prompt-leaks-into-the-transcript.md` — the bias path, ruled out above.
- `singular-address-becomes-plural.md` — the repairs that are gated on the
  detected language this defect corrupts.
- ADR 0041 — Translate is a mode, which is why the mode axis is innocent here.
