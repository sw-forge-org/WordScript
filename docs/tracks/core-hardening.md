# Kick-off — Core hardening, third pass

Paste this to the next agent. It is a **different track from the GUI port
relay**: that one is numbered by Legs and lives in
`docs/tracks/gui-port-relay.md`; this one follows the cluster in
`docs/known-issues/` where the damage is invisible. The two ran concurrently on
2026-08-10 and again on 2026-08-11 without colliding, and can again — but see
**Sharing main** below, because the second pass nearly did.

---

You are picking up WordScript's core loop after two hardening passes. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. `src-tauri/` is open.

**Read all seven records before touching any of them.** They are one failure
class — output that is fluent, grammatical, plausible and wrong, with nothing
downstream carrying evidence that a substitution happened:
`capture-loses-half-the-recording.md`, `transcription-accuracy.md`,
`stt-prompt-leaks-into-the-transcript.md`, `singular-address-becomes-plural.md`,
`cleanup-invents-tokens-on-broken-input.md`, — added 2026-08-13 —
`cleanup-flips-the-grammatical-person.md`, and — added 2026-08-16 —
`dictation-comes-back-in-english.md`. Then ADRs 0079, 0080, 0081, 0083
and 0084, and `CLAUDE.md`.

**Two more joined the cluster on 2026-08-16 and they are about the instruments
rather than the pipeline** — `heard-and-written-do-not-say-which-stage-changed-what.md`
and `the-record-names-the-connection-model-not-the-one-that-listened.md`. Read
them before quoting any number from `history.json`: the first one caused a defect
to be reported against the wrong stage, and the second means every per-model rate
on this track names a model no request used.

`transcript-stops-before-the-audio-does.md` has always been read alongside the
prompt-leak record rather than listed beside it; since its fourth event on
2026-08-16 it has a row of its own in the table below, so read it too.

## Where the cluster actually stands

**None of the six records is closed, and two of them never will be in the
ordinary sense** — the rule is that lost content is reported, never replaced.
What two passes bought is that the cluster went from invisible to instrumented.

| Record | Still occurring? | What exists now |
|---|---|---|
| Capture loses audio | **Yes, cause still unlocated** | Reported (0079); a callback cadence and a named signature (0083); the soak ran 2026-08-12 and returned **zero events in 8 h** (0084), which moved the suspicion into the app, and a live event on 2026-08-13 then refuted that too. **The instrument half now belongs to the runtime ownership track** (ADR 0133) — read that record before appending to it |
| Prompt leak | **Yes in the recogniser, 12.5 % of raw — and 2026-08-16 one leaked term reached the delivery through the strip** | Removed from the delivery (0080); displaced words stay gone. The strip is not a floor: a one-term echo cannot clear `MIN_DISTINCTIVE_MATCHES`, so `prompt_echo_stripped` on a record does not mean the echo is gone. Step 8 |
| Pluralized address | **Yes, one of three shapes** | Two repaired (0081), third out of reach by design |
| Mishearings at large | **Yes, unmeasured** | One instance in the corpus; still no WER, no rate |
| Cleanup invents tokens | **Yes, groups A and C** | No new guardrail; rate unchanged |
| **Cleanup flips the person** | **Yes, 1 in 200, found 2026-08-13** | Nothing. The corpus carries the case and both negative directions; **no rule was written on purpose** — see step 6 |
| **Dictation comes back in English** | **Yes, 7 of 50, found 2026-08-16** | Nothing. Three causes ruled out — the fourth, *not prompt bias*, **was withdrawn the same evening**: a 65-byte, entirely English initial prompt was sent, resolved to the character from the log. The language is never pinned because the control is drawn and unwired, and **the detected language is discarded**. Step 9 |
| **The transcript stops before the audio does** | **Yes — a fourth event 2026-08-16, four days after the third** | Instrumented 2026-08-12, nothing reacts. The new event **passed every instrument**, `last_segment_avg_logprob=-0.192` included, which removes confidence as a detector and leaves text density as the only proposal that would have caught it. The ten-second test the record asks for — delete the learned terms — has still not been run. Steps 8 and 9 |
| **The panel names the wrong stage** | **No — fixed 2026-08-17** (ADR 0204) | The foot names what WordScript's own rules did and derives the rest from the diff: *nothing was added or reworded* is a subsequence test, not a rule id. `post_corrected` is no longer read as a rewrite — on the record that produced the report its whole effect was two spaces. Five cases hold it |
| **The record names the wrong model** | **No for new records — fixed 2026-08-17** (ADR 0203) | One resolver, `AppConfig::speech_model()`, asked by the request, the record and the capture ceiling; a lane that sent no id records none. **The records written before the fix keep the wrong value and are not migrated**, so no per-model rate may cross 2026-08-17 |

## What the second pass did

1. **A capture reports the cadence of its own input stream** (ADR 0083).
   `CallbackCadence` counts every cpal callback and every stretch over 200 ms
   with no samples. Each gap carries the sample count of the callback that ended
   it, which separates the three hypotheses: an ordinary period on resume means
   the audio is gone (`stream_suspended`), a catch-up-sized one means it only
   arrived late (`late_delivery`), and **no gap at all on a capture that is
   still short** (`no_gaps_but_audio_missing`) means starvation. Written on every
   capture, healthy ones included. Nothing is logged from the audio callback.
2. **The input level is kept per transcription** (ADR 0083), now with a mean.
   A peak is set by one sample, so a cough sets it as well as speech does.
   Reported, not acted on.
3. **The first genuine mishearing is in the corpus.** `tmux` spoken, `D-Max`
   transcribed, with `overlay_edit` on the record making the owner's own retyped
   word the ground truth rather than a guess.
4. **Both measurements re-run, and the invention harness was wrong first.** It
   counted `translate` and `prompt_enhance` (whose outputs are new by
   construction, exactly the argument that already excluded `agent`), snippet
   expansions, and one record the user had retyped himself. Corrected the rate is
   **4.4 % against 6.1 %** — on 6 events against 12, not a movement.

## What is blocked, and do not spend the leg re-deriving it

Three questions now wait on **population**, not on code. Nothing has to be built
for any of them and building something would be the mistake:

- **the short-capture / mishearing correlation** — needs one short capture
  recorded under ADR 0079. 7 of 138 records carry a verdict; all are `intact`.
- **the invention rate split by `capture_integrity`** — same empty group. The
  harness prints `answerable: false` rather than a `0.0 %` somebody could read as
  a finding.
- **the input-level rate** — the field exists as of today; the population starts
  at zero.

An empty group is a population fact. It is not evidence that short captures are
clean, and the harness is written to refuse that reading. Leave it refused.

## The order

Items 1 to 5 are the third pass as it was written; 6 and 7 were added on
2026-08-13 with the two records that landed that day. Item 1 has since been
answered and its capture half has moved to another track — the numbering is kept
rather than compacted, because the items are cited by number elsewhere.

1. ~~**Run the soak overnight.**~~ **Done 2026-08-12, and it returned nothing:**
   8 h, 96 segments, every one `Intact` with `no_gaps`, where roughly eight
   events were expected.
   [ADR 0084](../decisions/0084-the-defect-that-needed-no-dictation-gets-a-binary-that-needs-no-app.md)
   registered that outcome in advance, so it is a result rather than a
   disappointment: it does not exonerate PipeWire, it moves the suspicion into
   the app. A live event on 2026-08-13 then refuted the app-side hypothesis as
   well and exposed the instrument's own blind spot, which is why **the capture
   half of this record now runs on the runtime ownership track**
   (`tracks/runtime-ownership.md`, ADR 0133). The reasoning below is kept
   because it is what made the run cheap and what the next unattended run
   inherits:

   ```text
   cargo run --release --bin capture-soak -- --hours 8
   PIPEWIRE_DEBUG=3 journalctl --user -u pipewire -f     # step 4, same night
   ```

   Each 300 s segment writes a cadence line, an integrity verdict and
   `epoch_ms_at_start`, which is what a journal window is correlated against.
   **A night that produces nothing is a result** — it moves the suspicion from
   PipeWire to the app's own per-callback work — and the record says so in
   advance so it cannot be quietly reinterpreted afterwards. The reasoning that
   made it cheap:

   - **Nobody has to speak.** All three diagnostic lines are written in
     `stop_native_capture` *before* the `if samples.is_empty() || !has_voice_activity`
     branch. A silent recording is discarded as empty and leaves the complete
     measurement behind.
   - **One event per hour of open input stream** — 11 events across ~9 h of
     total stream runtime. It looks rare per capture only because the average
     capture is under a minute. A night yields roughly eight.

   What the binary does, so you can judge whether it measures what you need: it
   opens the same stream (ALSA `default`, 44100/2/f32, confirmed identical to
   all 497 capture starts in the log), carries the existing `CallbackCadence`
   and `CaptureIntegrity` rather than copies of them, does the same per-callback
   work minus the `app.emit`, and rotates its books into 300 s segments from
   inside a callback so the segments tile the run without seams. Step 4 folds in
   at **`PIPEWIRE_DEBUG=3`**, because the retrospective check at default level
   found nothing and that is weak evidence rather than a refutation.

   **The first real gap is a corpus entry.** Nothing in the corpus describes an
   observed dropout — the cadence assertions run over a synthetic timeline, which
   pins the arithmetic and not the phenomenon.

   **The soak fabricated a total loss on its first real run**, and the synthetic
   tests were green while it did. A 3 ms rotation remainder was reported as
   `missing_ratio=1.0000`. Read the soak log by hand before trusting a number
   out of it — this cluster's own failure class is fully capable of appearing in
   the tool built to detect it.

2. **The candidate-length floor does not distinguish an LLM from a human, and
   should.** This is the sharpest finding of the second pass and its record
   states it too softly. `HAND_EDIT_WEIGHT` is 2, so a hand-corrected term
   promotes **on sight** — *"when the user retypes the word themselves … nothing
   a second sighting could add."* Promotion puts the term in the profile
   vocabulary and from there into the recogniser bias, which is precisely the
   mechanism that stops a mishearing recurring. It did not fire for `tmux`
   because `MIN_CANDIDATE_CHARS = 5` is checked in `is_acceptable_candidate`
   **before the source is ever consulted**.

   The floor's justification — a close match on a four-letter word is not
   evidence — is an argument about inferring from an LLM rewrite. It does not
   transfer to a word the user typed with their own hands. **Measure before
   changing it**, as the repo's own rule demands: run `detect_candidates` over
   every `overlay_edit` record with the floor lowered on the hand-edit path only,
   and count what else comes in. Today that population is one record, which is
   itself an argument about how small the risk is — and about how thin the
   evidence is. If it changes, it is an ADR.

3. **Measure the hand corrections.** `overlay_edit` pairs are the only
   human-labelled channel in the product and the closest thing to a WER available
   without labelling effort: raw transcript beside the user's own wording. A
   harness beside the other two turns each one into an accuracy datum. It also
   answers a question worth knowing early — the channel holds **one record in
   138**, because people paste into the target document and correct there
   (ADR 0035 says so). If it stays that thin, `transcription-accuracy.md` will
   never get its rate this way, and that is worth establishing rather than
   assuming.

4. **Per-form leak rates. This is the second time it has been deferred.** It was
   item 5 of the previous kick-off and did not get done. `Likely phrases` leaked
   in 10 of 17 leaking records and is the unbounded form; ADR 0017 already
   records that a longer initial prompt causes repetition loops and drift. The
   raw-transcript counts exist; the **per-send** rate does not, and it needs the
   sent form logged per transcription. The prompt is already carried through the
   pipeline for ADR 0080 (`recognizer_prompt` in `lib.rs`), so this is small.
   Option 2 in `stt-prompt-leaks-into-the-transcript.md`.

5. If you have room: **the local lane is unmeasured everywhere.** Every number in
   this cluster is Groq `whisper-large-v3`. The leak record says it plainly —
   *"The local lane is unmeasured, not exonerated."* The address repair depends
   on the profile's language setting there, because `json` carries no detected
   one.

6. **The person flip needs a second instance before it needs a rule.** Added
   2026-08-13 with the record
   ([`known-issues/cleanup-flips-the-grammatical-person.md`](../known-issues/cleanup-flips-the-grammatical-person.md)).
   The corpus already carries the case and both negative directions, so the work
   here is **population, not code** — and the reason is in the corpus itself:
   `cleanup_keeps_the_second_person_address` is the *same construction* handled
   correctly two days earlier, on the same lane in the same mode. One flip and
   one non-flip of one sentence shape is not a rule's worth of evidence, and this
   track's own history says what happens when a surface rule is written on less
   (ADR 0081: 45 tokens flagged to find 3).

   Two things are cheap and worth doing before any rule:

   - **A scan, not a guess.** The detector is a pronoun-and-agreement count over
     `raw_transcript` / `transformed_transcript` pairs, which is the same join
     the other harnesses use. Today it returns 1 of 200. Run it again when
     history has turned over, and report the count even when it is 1.
   - **Ask whether the prompt can carry it at all.** The two anti-answering
     lines were obeyed by the model that flipped the sentence. A third line
     about perspective is the cheapest possible intervention and also the one
     this repo has the least reason to trust — ADR 0036's whole argument is that
     a prompt line is not enforcement. If it is tried, it is tried **as a
     measurement** against these three corpus entries, not as a fix.

   Out of scope here and stated so it is not re-derived: `Agent` and
   `Prompt Enhance` do not run this transform, and what they do with a
   second-person dictation is a different question in a different owner's area.

7. **The closing-phrase artifact has a shape nothing reaches.** Added 2026-08-13
   as an addendum to
   [`known-issues/transcription-hallucination.md`](../known-issues/transcription-hallucination.md),
   which is the sixth record's neighbour on the recogniser side. `is_hallucination`
   tests the whole transcript as one string, so an artifact appended to a real
   sentence never matches; `artifact_patterns` matches per sentence but does not
   carry the closing phrases at all. **The obvious fix is the one this cluster
   forbids**: adding `vielen dank` to a per-sentence pattern list strips a real
   sign-off out of a dictated email. What separates artifact from sign-off is
   position, language and decoder confidence — and `DriftCorroboration` already
   exists for exactly that kind of two-signal rule. Corpus entry
   `recognizer_appends_a_closing_phrase` pins today's behaviour, which is that
   nothing fires.

8. **One leaked term survived the strip, and the obvious fix is forbidden.**
   Added 2026-08-16 from a single annotated screenshot of the History panel; the
   evidence is in
   [`known-issues/stt-prompt-leaks-into-the-transcript.md`](../known-issues/stt-prompt-leaks-into-the-transcript.md).
   The echo arrived as `Likely phrases:" Commit.` — **with** its colon and
   **with** slot 1 of the prompt — and `strip_prompt_echo` removed the marker
   and stopped. What remained is one sentence carrying one word, and the
   sentence pass requires `MIN_DISTINCTIVE_MATCHES = 2`.

   **Do not lower that floor.** It is the guard this record's own 2026-08-10
   finding demanded, and `Commit` is live vocabulary the owner dictates. What
   separates the two cases is **adjacency to the marker just removed** and
   **slot order in the prompt we sent** — both available at the strip, because
   ADR 0080 carries the prompt from the request, and neither used. One event, so
   corpus first.

9. **The English prompt is the leading candidate for the English drift, and the
   exclusion that stood against it was false.** Added 2026-08-16;
   [`known-issues/dictation-comes-back-in-english.md`](../known-issues/dictation-comes-back-in-english.md)
   carries the correction. *Not prompt bias* was argued from
   `use_as_prompt_hint: false` — a field nothing has read since ADR 0035, and
   the **second** time that boolean has produced a wrong turn in this
   directory. The affected record was sent
   `"Likely phrases: Commit; decision log; weekly update; action items"`,
   65 characters, matching the logged `prompt_chars=65` exactly.

   `BLANK_STATE_RECOGNIZER_PROMPT` is bilingual on purpose *because a prompt
   biases the decoder toward its own language*. `Likely phrases: …` is not, so a
   profile with vocabulary sends a wholly English prefix ahead of German speech
   and a blank profile does not. **This step is a measurement, not a fix:**
   `prompt_chars` is in the log for all fifty records, and 7 affected against 43
   clean is a comparison that needs no code. Run it before proposing anything.

10. ~~**The instruments themselves are now two records.**~~ **Done 2026-08-17**
    — ADR 0203 (the model) and ADR 0204 (the sentence). Both records carry a
    *What was written* section; two things the next reader inherits rather than
    re-derives:

    - **No per-model rate may cross 2026-08-17.** The records written before the
      fix keep `whisper-large-v3` regardless of what ran and are deliberately
      not migrated (the owner's call: this machine's local state is disposable).
      The transcript files keep the same wrong line in their front matter.
    - **`post_corrected` is not evidence of a rewrite** and never was. On the
      record that produced both reports its entire effect was one leading and
      one trailing space, which is also why the panel's new sentence is derived
      from the diff rather than from the rule list.

    Added 2026-08-16, both found on the single record above:
    [`known-issues/heard-and-written-do-not-say-which-stage-changed-what.md`](../known-issues/heard-and-written-do-not-say-which-stage-changed-what.md)
    and
    [`known-issues/the-record-names-the-connection-model-not-the-one-that-listened.md`](../known-issues/the-record-names-the-connection-model-not-the-one-that-listened.md).
    The first misattributed a defect to the wrong stage in the field; the second
    files **all 50 records** under a model no request used, which is the
    attribution every rate on this track carries. Fix the model resolution
    before the next per-model number is quoted.

## The rule the owner stated, 2026-08-16

Reported alongside the screenshot, and it applies to **every processing mode**,
not only Cleanup:

> Es sollte verbessert werden — ein bisschen die Grammatik und so weiter — aber
> nicht der komplette Sinn geändert werden.

It is not a new requirement so much as the sentence this whole cluster is
defending, said plainly by the person the output is for. Two consequences for
work on this track:

- **A guardrail that only reads the cleanup lane is not enough.** ADR 0081 moved
  the recogniser repair ahead of the mode branch for exactly this reason, and
  every mode-scoped guard written since is scoped narrower than the rule.
- **It does not license a rewrite-detector.** The cluster's standing rule is that
  lost or altered content is *reported*, never *replaced* — a stage that decides
  the meaning changed and then repairs it is the defect wearing a badge.

Note for the record that on the report that produced this rule, cleanup was
**innocent**: `transformed_transcript` is `raw_transcript` minus sixteen bytes.
The meaning was already gone when the recogniser handed it over.

## Rules you are measured on

**Measure before you fix, and fix in the corpus.** Every real case goes into
`src-tauri/tests/fixtures/regression_transcripts.json` with a matching synthetic
test. It is the repo's own rule and it is why one of three categories in
`cleanup-invents-tokens` has a guardrail and two do not.

**Both directions, always.** A rule with only positive cases is a rule whose
false-positive rate nobody has looked at, and in this cluster a false positive
*is* the defect: fluent, plausible text that is wrong.

**A negative measurement is a result. Report it as one.** Do not convert "the
data cannot answer this" into "the answer is no". Three questions are blocked on
population right now and every one of them is one careless sentence away from
being reported as closed.

**Check your own instrument before believing it.** The second pass found the
invention rate reporting 8.0 % where the truth was 5.2 %, because the harness was
counting three things that were not cleanup. All three were visible in the flagged
records themselves — reading the nine flagged outputs by hand took minutes and
was what exposed them. Read the instances, not only the number.

**Never restore what was lost.** A short capture is reported and never repaired;
a stripped prompt echo leaves the transcript visibly short rather than plausibly
complete. Anything that fills a gap with plausible content is the defect this
whole cluster is about, committed by the fix.

**A rule that encodes one language says so** (ADR 0081). Mood, case and agreement
are all German-shaped problems and the next rule of this kind has a gate to hang
itself on.

## Sharing main

The GUI port relay runs concurrently and moves under you. Two things bit the
second pass:

- **ADR numbers are claimed in source before the file lands.** The GUI track had
  cited "ADR 0082" in `src/components/shell/EditorPanel.tsx` and `shell.css`
  while `docs/decisions/` still showed 0082 as free. Grep the whole tree —
  `grep -rn "ADR 008[0-9]" src/ src-tauri/src/ docs/` — before claiming one. The
  next free number is **0088** — 0084 was taken by the soak on 2026-08-11, and
  0085, 0086 and 0087 by the GUI track's Leg 8 the same day. This line is the
  thing that goes stale: re-grep rather than trusting it.
- **Stage explicitly, never `git add -A`.** The other track's unfinished files
  sit in the working tree the whole time. Check `git status` before committing
  and add your own paths by name.

Check `git log --oneline -5` before you start.

## Not this track

Overlay placement and ghosting, `insert-behavior-reverts`, cross-platform
shortcut verification, the macOS port, dependency advisories, the diag-log write
surface, the release build-up. **`overlay-recording-freeze.md` is a neighbour
and stays closed to you** — the freeze was attributed to this cluster on
2026-08-03 and its only open part is a residual signature no measurement has
reproduced. And **Context in any direction**: another agent owns that contract.

## Checks

```text
cd src-tauri && cargo test    # 787 passing, 3 ignored, at b9f493e (2026-08-13)
npm test                      # 465 passing across 39 files at 0662d94
npm run build
npx tsc --noEmit
```

**The `npm test` total moves under you and the number above is a commit, not a
promise.** It was 451 at `8d2ae07` and 465 at `0662d94` a few hours later,
because the GUI port relay added tests to `src/screens/Profiles.test.tsx` while
this track was running. Both were verified green. Check the number against
`git log` rather than reading a mismatch as damage.

**The `cargo test` total moved the same way and none of it is this track's.** It
read 739 after the third pass and reads 787 at `b9f493e`; the speech track landed
the difference. The 2026-08-13 documentation step measured 787 before and 787
after adding four corpus entries, which is the expected shape — the corpus tests
are data-driven, so an entry adds assertions inside an existing test rather than
a test. **A corpus addition that moves this number has added a test somebody did
not mention.**

**Run the suite twice before believing a failure.** `npm test` flaked once in ten
runs during the second pass — 2 failures in 2 files, not reproducible in the nine
others, and the previous pass saw the same thing in `OverlayWindow.test.tsx`.

**The third pass captured it.** One serial run of the working tree, five failures
in five files, every one of them `Error: Test timed out in 5000ms` and not a
single assertion; the next run of the same unchanged files was green at 465/465:

- `Diagnostics.test.tsx` → *opens on Checks, with the sub-tab row inside the masthead* (5548 ms)
- `Profiles.test.tsx` → *writes the context textarea through patchText and commits it on blur* (5175 ms)
- `screens.test.tsx` → *Context > opens the Ask window with an answer that names the rows it read* (8125 ms)
- `gallery/Foundations.test.tsx` → *carries the sections of SCREENS.ds, in order* (5084 ms)
- `WorkspaceWindow.test.tsx` → *Help > closes on a press outside it and on Escape* (11370 ms)

It is a timeout under load, not a defect: one test per file, no overlap between
runs, and the same suite finishes in 11 s when nothing competes with it.

**Do not run two suites at once to save time.** The third pass did, and `cargo
test`'s tree reported *13 failures in 7 files* — 8 of them 5000 ms timeouts on
tests taking 12 s — which is a green tree misreported as broken. Serially the
same commit is 451/451 in 11 s against 104 s under contention. That is
*Check your own instrument* one layer up: the harness was fine, the measuring
conditions were not.

**Watch the TOTAL, not the colour**: a silently shrunk test file has cost this
repo a leg before.

For anything shell-, window- or Tauri-bound, check in the native host rather than
browser preview. **A `npm run tauri dev` host is usually already running and it
may be the owner's own session** — do not kill it and do not raise its window.
