# Kick-off — Core hardening, second pass

Paste this to the next agent. It is a **different track from the GUI port
relay**: that one is numbered by Legs and lives in
`docs/tracks/gui-port-relay.md`; this one follows the cluster in
`docs/known-issues/` where the damage is invisible. The two ran concurrently on
2026-08-10 without colliding, and can again.

---

You are picking up WordScript's core loop after the first hardening pass. Work
in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. `src-tauri/` is open.

**Read all five records before touching any of them.** They are one failure
class — output that is fluent, grammatical, plausible and wrong, with nothing
downstream carrying evidence that a substitution happened:
`capture-loses-half-the-recording.md`, `transcription-accuracy.md`,
`stt-prompt-leaks-into-the-transcript.md`, `singular-address-becomes-plural.md`,
`cleanup-invents-tokens-on-broken-input.md`. Then ADRs 0079, 0080 and 0081, and
`CLAUDE.md`.

## What the first pass did

**Three deterministic things ship, and one measurement came back negative.**

1. **A capture states how much of its own clock it kept** (ADR 0079). Reported
   in the runtime log, on the history record as `capture_integrity` with an
   `Audio missing` badge, and as a tab beside the result pill at delivery time.
   Threshold 10 %, derived from a gap in 634 measured captures running from
   7.0 % to 12.0 %. The pause artifact in `shortfall_ratio` is fixed with it.
2. **WordScript's own prompt is stripped from the transcript** (ADR 0080),
   deterministically, against the prompt the request itself sent — normalised
   and in-order, because the echo is a paraphrase, and sentence-scoped, because
   the owner once said the prompt text out loud while complaining about it.
3. **A pluralized address is restored to the singular** (ADR 0081), gated on
   grammatical mood and on the language being German.

Both repairs live in `core::recognizer_repair`, a stage **before the mode
branch** — the case that made it urgent reached an *agent*, not a cleanup — and
the retry path runs it too. The corpus went from 26 entries to 44.

**The negative result is the most useful thing here.** The measurement that
would join the cluster — does a short capture also produce more mishearings? —
was attempted and is **not answerable on today's data**. The join works (136 of
136 records paired) but 9 of the 11 short captures had outlived their
transcripts, because the runtime log and `history.json` have different
retentions. Reporting that as "no correlation found" would have closed the
question with an answer nobody measured. ADR 0079 removes the need for the join.

## The order, and the first item is a debt

1. **Re-run the two measurements and see whether anything moved.** Both spend
   nothing:

   ```text
   cargo test measure_capture_integrity_against_transcripts -- --ignored --nocapture
   cargo test measure_invented_tokens_in_shipped_corrections -- --ignored --nocapture
   ```

   The first now reports how many records answer for themselves. **Once enough
   short captures have been recorded under ADR 0079, the correlation becomes
   answerable and nothing has to be built for it.** The second is the invention
   rate, and it is now splittable by `capture_integrity` — if group A
   concentrates on short captures, its cause is upstream of the corrector and no
   cleanup-side guardrail was ever going to reach it.

2. **Locate the capture defect.** This is the one that has never been
   attempted, and everything above only reports it. Step 2 of the record: log
   the cpal callback cadence — the gap between callbacks and their sample counts,
   with a line whenever a gap exceeds a threshold. That separates a suspended
   stream (hypothesis 1) from callback starvation (hypothesis 2) directly, and a
   `verdict=short` line in the runtime log now names a window to look at.
   Step 3 is watching PipeWire from the other side during a long capture.

3. **Persist the input level per transcription.** The cheapest remaining step in
   `transcription-accuracy.md`: peak and mean are already computed and emitted
   on the `empty` event and kept nowhere. It is what separates "the recogniser
   is wrong" from "the microphone is quiet", and it needs no new capability.

4. **A mishearing that is neither identified cause has still never been captured
   as a corpus entry.** The sample the accuracy record opened with turned out to
   be the prompt leak. Until a genuine substitution is in the corpus, the
   headline complaint has no measurement of its own.

5. If you have room: the second option in the prompt-leak record — per-form leak
   rates, and shortening what leaks most. `Likely phrases` leaked in 10 of 17
   leaking records, and it is the unbounded form.

## Rules you are measured on

**Measure before you fix, and fix in the corpus.** Every real case goes into
`src-tauri/tests/fixtures/regression_transcripts.json` with a matching synthetic
test. This is the repo's own rule and it is why one of three categories in
`cleanup-invents-tokens` has a guardrail and two do not.

**Both directions, always.** Every rule added this pass carries corpus entries
for what it must NOT do, drawn from the owner's live history — `Macht das Sinn?`
against `Macht dir wirklich mal Gedanken`, the owner quoting the prompt artifact
against the recogniser leaking it. A rule with only positive cases is a rule
whose false-positive rate nobody has looked at, and in this cluster a false
positive *is* the defect: fluent, plausible text that is wrong.

**A negative measurement is a result. Report it as one.** Do not convert "the
data cannot answer this" into "the answer is no".

**Never restore what was lost.** A short capture is reported and never repaired;
a stripped prompt echo leaves the transcript visibly short rather than plausibly
complete. Anything that fills a gap with plausible content is the defect this
whole cluster is about, committed by the fix.

**A rule that encodes one language says so.** The address repair is German
morphology and is gated on the detected language; the echo strip is
language-agnostic by construction and says that too. The next rule of this kind
— mood, case and agreement are all German-shaped problems — has a gate to hang
itself on.

## Not this track

Overlay placement and ghosting, `insert-behavior-reverts`, cross-platform
shortcut verification, the macOS port, dependency advisories, the diag-log write
surface, the release build-up. **`overlay-recording-freeze.md` is a neighbour
and stays closed to you** — the freeze was attributed to this cluster on
2026-08-03 and its only open part is a residual signature no measurement has
reproduced. And **Context in any direction**: another agent owns that contract.

The GUI port relay is a separate track with its own kick-off. Check
`git log --oneline -5` before you start — it moves under you, as it did during
the first pass.

## Checks

```text
cd src-tauri && cargo test    # 711 passing, 3 ignored, after the first pass
npm test                      # 451 passing across 39 files
npm run build
```

**Run the suite twice before believing a failure** — `OverlayWindow.test.tsx`'s
drag test flaked once during the first pass and passed on both re-runs — and
**watch the TOTAL, not the colour**: a silently shrunk test file has cost this
repo a leg before.

For anything shell-, window- or Tauri-bound, check in the native host rather
than browser preview. **A `npm run tauri dev` host is usually already running
and it may be the owner's own session** — do not kill it and do not raise its
window. During the first pass it was, and it produced the best evidence of the
leg: five records written by the running build, carrying verdicts in the
0.1–3.0 % band.
