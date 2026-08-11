# Kick-off — Core hardening, third pass

Paste this to the next agent. It is a **different track from the GUI port
relay**: that one is numbered by Legs and lives in
`docs/handoffs/HANDOFF_gui-port-relay.md`; this one follows the cluster in
`docs/known-issues/` where the damage is invisible. The two ran concurrently on
2026-08-10 and again on 2026-08-11 without colliding, and can again — but see
**Sharing main** below, because the second pass nearly did.

---

You are picking up WordScript's core loop after two hardening passes. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. `src-tauri/` is open.

**Read all five records before touching any of them.** They are one failure
class — output that is fluent, grammatical, plausible and wrong, with nothing
downstream carrying evidence that a substitution happened:
`capture-loses-half-the-recording.md`, `transcription-accuracy.md`,
`stt-prompt-leaks-into-the-transcript.md`, `singular-address-becomes-plural.md`,
`cleanup-invents-tokens-on-broken-input.md`. Then ADRs 0079, 0080, 0081 and
0083, and `CLAUDE.md`.

## Where the cluster actually stands

**None of the five records is closed, and two of them never will be in the
ordinary sense** — the rule is that lost content is reported, never replaced.
What two passes bought is that the cluster went from invisible to instrumented.

| Record | Still occurring? | What exists now |
|---|---|---|
| Capture loses audio | **Yes, 11 events, cause unknown** | Reported (0079); the next one arrives with a callback cadence and a named signature (0083) |
| Prompt leak | **Yes in the recogniser, 12.5 % of raw** | Removed from the delivery (0080); displaced words stay gone |
| Pluralized address | **Yes, one of three shapes** | Two repaired (0081), third out of reach by design |
| Mishearings at large | **Yes, unmeasured** | One instance in the corpus; still no WER, no rate |
| Cleanup invents tokens | **Yes, groups A and C** | No new guardrail; rate unchanged |

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

## The order, and the first item is the whole point

1. **Build the soak and run it overnight.** `capture-loses-half-the-recording.md`
   → *How to reproduce it*. This is the one task that can produce a **cause**
   rather than another description, and the second pass worked out why it is
   cheap:

   - **Nobody has to speak.** All three diagnostic lines are written in
     `stop_native_capture` *before* the `if samples.is_empty() || !has_voice_activity`
     branch. A silent recording is discarded as empty and leaves the complete
     measurement behind.
   - **One event per hour of open input stream** — 11 events across ~9 h of
     total stream runtime. It looks rare per capture only because the average
     capture is under a minute. A night yields roughly eight.

   So: a standalone binary opening the same stream (ALSA `default`, 44100/2/f32,
   identical across all 497 capture starts in the log), carrying the existing
   `CallbackCadence`, doing the same per-callback work, writing its own log,
   running unattended. Fold step 4 of the record into the same night —
   `journalctl --user -u pipewire` with **`PIPEWIRE_DEBUG=3`**, because the
   retrospective check at default level found nothing and that is weak evidence
   rather than a refutation.

   **A soak that finds nothing is a result**: it moves the suspicion from
   PipeWire to the app's own per-callback work. Report it as one.

   **The first real gap is a corpus entry.** Nothing in the corpus describes an
   observed dropout — the cadence assertions run over a synthetic timeline, which
   pins the arithmetic and not the phenomenon.

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
  next free number is **0084**.
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
cd src-tauri && cargo test    # 731 passing, 3 ignored, after the second pass
npm test                      # 451 passing across 39 files
npm run build
npx tsc --noEmit
```

**Run the suite twice before believing a failure.** `npm test` flaked once in ten
runs during the second pass — 2 failures in 2 files, not reproducible in the nine
others, and the previous pass saw the same thing in `OverlayWindow.test.tsx`.
**Capture the output when it does**, which the second pass failed to do and so
cannot name the tests.

**Watch the TOTAL, not the colour**: a silently shrunk test file has cost this
repo a leg before.

For anything shell-, window- or Tauri-bound, check in the native host rather than
browser preview. **A `npm run tauri dev` host is usually already running and it
may be the owner's own session** — do not kill it and do not raise its window.
