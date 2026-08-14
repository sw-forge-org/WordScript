# Track — Runtime ownership

Opened 2026-08-13, as *measurement integrity*; **renamed and re-scoped the same
day** when the last finding turned out not to be a measurement problem at all.
This file is both the sequence and the kick-off; paste it to the next agent.

Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. See **Sharing main** below.

## The thesis

`CLAUDE.md` states the seam: *"Rust owns trigger, capture, provider, transform,
insert and recovery. React displays, configures and explains that native
state."* **The runtime does not own everything that sentence gives it, and the
instruments cannot see where it does not.**

- **The session end belongs to a window.** Every insert call site is an `invoke`
  from `OverlayWindow.tsx`. After `preview ready` the runtime does nothing on
  its own — no deadline, no fallback. The clipboard write, the history record
  and the transcript file all happen inside that insert, so a window that never
  comes back **silently discards a finished dictation**. Measured: normal commit
  1.12 s median, but 11–115 s in the 13 sessions whose webview was destroyed
  mid-preview, and one transcript lost outright to an app restart.
- **The capture cadence times itself after taking the app's own mutex**, so "the
  stream stopped" and "we blocked our own callback" are one number — and it
  prints the first as a verdict, naming PipeWire for something the app may be
  doing to itself.
- **The overlay heartbeat reports a *late* interval**, so a reload that
  *destroys* the interval reads as silence. Every dev-only cause of that shape
  was structurally invisible to it.
- **The app's own dev server destroys its windows**, about 1,389 times in
  2.5 days, because the watcher covers 36,000 files it has no reason to watch.
  Every capture measurement in the record was taken inside that.

One sentence: **the app is its own environment, and it does not measure itself
as one.** The track's job is to give the runtime back what it is documented to
own, then make the next event decidable.

## The records this track carries

| Record | State | This track's part |
|---|---|---|
| [`overlay-leave-hold-dead-actions.md`](../known-issues/overlay-leave-hold-dead-actions.md) | fixed for its own mechanism; carries the three-mechanism table | Step 1 |
| [`dev-server-reloads-the-app-mid-session.md`](../known-issues/dev-server-reloads-the-app-mid-session.md) | open, cause located, fix known | Step 2 |
| [`capture-loses-half-the-recording.md`](../known-issues/capture-loses-half-the-recording.md) | open, 3 detailed events, cause not located | Steps 3, 5, 6 |
| [`overlay-recording-freeze.md`](../known-issues/overlay-recording-freeze.md) | **reopened 2026-08-13** | Steps 1, 2, 4 |
| [`sound-output-underruns-and-reopens.md`](../known-issues/sound-output-underruns-and-reopens.md) | **half fixed 2026-08-14**; the underrun class is gone, the routing half is the Speech track's F2 | Step 7 |

Adjacent, do not re-derive:
[`overlay-stranded-off-screen.md`](../known-issues/overlay-stranded-off-screen.md)
owns the second cause of "invisible mid-recording" and carries the log
discriminator table. Reopened, not this track's to fix.

Owns **ADR 0133, 0134 and 0150 onward** for these records. ADRs 0079–0081, 0083,
0084 and 0100 belong to **Core hardening**; 0133 continues that line and says so
in its own References. 0132 is the Speech track's — it landed in `2d5bead` while
this track was being written, which is why the rule below says to check the
ranges too. **0135–0149 are the Context objects track's**, claimed as a range on
2026-08-14 while this track held 0134 — which is why step 7's ADR is 0150 and
not 0138, and is the rule below working rather than failing.

## Status

This table is the state of the track. Update it as steps land.

| Step | What | State | Blocked on |
|---|---|---|---|
| 1 | the runtime finishes the session (ADR 0134) | **done 2026-08-14 — acceptance run passed in the native host.** One half of the check still owed: a healthy session logging `path=frontend` | — |
| 2 | the dev-server watcher | **done 2026-08-14** | — |
| 3 | the cadence instrument (ADR 0133) | **done 2026-08-14 — and its new field fabricated a loss before it measured one; a 12 s soak against real hardware is what caught it** | — |
| 4 | the overlay restores itself on mount | open | — (step 1 done) |
| 5 | `native-18` into the regression corpus | **done 2026-08-14** | — |
| 6 | read the next capture event, then fix | **open, and now the only thing between this record and a located cause** | one natural `Short` capture (step 3 done) |
| 7 | the cue output stream (ADR 0150) | **done 2026-08-14 — and the record's own explanation of the symptom turned out to be wrong; the underrun half is fixed, the routing half is the speech track's** | — |

Opened with all seven open and nothing started, 2026-08-13.

### What landed on 2026-08-14

**Step 1 passed its acceptance run the same evening, and it passed under the
hardest condition available: the overlay rendered no frames at all.** The
owner's own test dictation is the evidence — it reached him through the
deadline, and the sentence he sent to report the missing overlay *is* the
transcript the deadline committed.

| | `native-2` | `native-3` |
|---|---|---|
| preview ready | +883.504 | +930.818 |
| deadline expired | +893.541 (**10.037 s**) | +940.819 (**10.001 s**) |
| clipboard | `wl-copy verified via wl-paste (13 bytes)` | `(102 bytes)` |
| history | `history-1786671065645-200` | `history-1786671112919-200` |
| transcript | `14-0331-time-discussion.md` | `14-0331-test-des-overlay-systems.md` |
| log | `path=deadline` | `path=deadline` |

`/tmp/kilo/overlay-diag.log` ends in the *previous* app run: **zero `[ov-dom]`,
`[ov-repaint]` or `[ov-reveal]` lines for the entire run these three sessions
happened in.** Both dictations landed anyway. That is the whole point of
ADR 0134, observed rather than argued.

**Two caveats on that run, because it was not a clean-room.**

**The `path=frontend` half is still owed.** Every session in that run committed
by deadline, which is explained by the dead overlay and not by the deadline
being sized wrong — but *explained* is not *measured*. One ordinary dictation
committed on the pill closes it.

**The binary in that run was one build behind.** `target/debug/wordscript`
started 03:16:03 while the current build was written at 03:16:11, so the running
app came from the source state during the falsification test — with the epoch
guard temporarily disabled. It changes nothing about what was measured: the
deadline, its timing, its commit path and its three artifacts are identical in
both versions. **What it does mean is that the epoch guard has still never run
in the wild.** It came within 1.1 s of mattering: `native-1` staged a preview at
+872.396, a new capture cleared it at +879.597, and the stale deadline woke at
+882.4 — 1.1 s before `native-2` staged the preview it would have committed ten
seconds early.

### What the run cost, and it was self-inflicted

**The overlay was invisible because this session edited `vite.config.ts` while
the owner's `npm run tauri dev` was running.** Vite watches its own config and
restarts the server in place; all three webviews lose their page, and the parked
overlay never asks for it again. The app had come up at 03:16:03 and the config
was written at 03:23:12. A restart of the dev host fixed it completely.

It is worth stating plainly because it is this track's own thesis with the agent
in the loop: **the app is its own environment, and an edit to that environment
is a change to the running app.** The rule now stands in `AGENTS.md` under
*Validation*. The first thing ADR 0134 ever saved was a dictation from a window
this session had destroyed.

`core/sessions.rs`: the command body became
`commit_pending_preview(app, text, path, expected_epoch)`, which the window and
the deadline both call, so there is one commit body and ADR 0018's one-commit
rule holds across both. `stage_pending_transcription_preview` arms a task that
sleeps `PREVIEW_COMMIT_DEADLINE_MS` (10 s) and then commits. There is **no
cancellation channel on purpose**: the staged preview *is* the cancellation
state, and a task that wakes to find it taken does nothing.

**The guard is an epoch, not a session id**, and that is the one thing here
worth remembering. An abort inside the deadline window frees the session for a
new capture, and that capture can stage its own preview before the first
deadline expires — so a deadline that only checked "is a preview pending" would
commit somebody else's, several seconds early. A session id does not separate
them on every path either, because `force_processing_for_active_capture` reuses
one. `preview_counter` counts stagings. Three tests, two of which were made to
fail first; the failing assertion in the third-party case is the interesting
one, because it commits the *second* dictation's text.

**Step 2 is one constant, `NON_SOURCE_DIRS`, read by both consumers.** Measured
on the running dev server rather than argued: **20,393 inotify watches before,
576 after**, `src/App.tsx` still hot-reloads, and touching `donors/`, `vendor/`
or `.kilo/` produces nothing. Vitest discovers the same 42 files and 533 tests
as before, so the exclude rewrite moved no test.

**What could not be reproduced, stated so nobody re-runs it expecting a
result:** a `touch` of a donor `tsconfig.json` did **not** produce a full
reload, under the new config or the old one. The record's quoted
`changed tsconfig file detected` line is real; what this session verified is the
watch surface, not the per-file reload mechanism. An mtime-only touch is
probably not what vite acts on.

### Steps 5 and 3 landed 2026-08-14, in that order

**Step 5 first, and the ordering paid off exactly as written.** `native-18` was
encoded against today's field set and then the field set widened underneath it;
encoding it after step 3 would have meant inventing lock-wait values for an
event that has none. It replays with zero lock wait, which is the condition
under which its `stream_suspended` has to survive ADR 0133's decision 4 — and
when `LOCK_WAIT_DOMINATES_AT` was set to zero as a falsification, that entry was
one of the three tests that caught it. **The corpus entry defends a past reading
against the instrument that replaced the one which produced it**, which is the
whole reason step 5 exists.

Its recorded numbers turned out to be mutually consistent, which is what made a
replay possible rather than a retelling: 1203 callbacks × 1024 samples ÷ 88200
is 13.967 s, exactly `recorded_seconds`. **Two of the entry's assertions are
tautologies of the reconstruction** — `callbacks` and each gap's `at_ms` are
inputs to it — and the test says so and earns them against the code instead.

**Step 3's `lost_below_threshold` was wrong on its first implementation, and the
soak found it in twelve seconds.** Clamping each interval's shortfall at zero
counted the late side of ALSA's burst delivery and discarded the early side:
**0.292 s of loss reported on a four-second segment that had recorded more audio
than its own clock ran.** Every synthetic test passed while it did, because
`PERIOD_MS = 23` in the test module against a true 23.2199 ms — a rounding that
was harmless for every assertion about gap counts and became a phantom the
moment anything summed the intervals. The sum is signed now and reported signed;
the same three segments read 0.005, −0.006 and 0.007 s. Full table in the
record.

**This is the second time this cluster's failure class has come out of the
instrument built to detect it**, after the soak's rotation remainder reported
`missing_ratio=1.0000`. Both were found by reading a real run rather than by a
test. *Check your own instrument before believing it* is not a slogan on this
track; it has now cost two implementations.

Also measured, and it is a result of its own: the soak reports
`slowest_lock_wait_ms=0` and `lock_wait_total_ms=0`. ADR 0084's premise is that
the soak is the app minus a *known* delta, and the app's lock contention sat
outside that delta until now.

**What is not covered by a test, stated so it is not assumed:** that
`arrived_at` is taken before `shared.lock()` — ADR 0133's first decision — is
held by construction and review. `process_samples` needs an `AppHandle` and no
test in this repo drives it. The half that lives in `CallbackCadence`, that a
long lock wait is not a gap, is asserted.

### Step 7 landed 2026-08-14, and the refutation is the part worth reading

**The cheap half first.** The callback logs `Audio output stream error:`. That
was the whole of item 1 and it was always going to be one line.

**Item 2 was already decided in 2026-07.** ADR 0010 chose the persistent stream
*and wrote down the condition that would overturn it*: *"If this proves unstable
on real hardware, the fallback is closing the stream after ~60 s idle."* The
record's 283 errors against 256 reopens is that condition, met. So step 7 is a
decision executing its own pre-registered fallback rather than a new preference
— which is the cheapest kind of decision this repo has, and it exists because
somebody wrote the falsifier down eleven ADRs before the evidence arrived.

Measured, because that is what item 2 asked for: **cold open 14.2–20.1 ms across
six fresh processes, one outlier at 44.5 ms, warm opens 9.6–15.7 ms — against
the 40 ms of warm-up silence the engine already prepends at every open.** The
open fits inside a budget that was already being paid. The outlier is in the
record rather than averaged out of it, and what it costs is a late cue, not a
missing one. **Stated limitation: the default sink was a virtual loopback, so a
suspended Bluetooth sink is unmeasured** — F2 owes `PLATFORMS.md` that number
anyway.

**Verified in the running app, not argued:** `[+60.043] Audio output closed
after idle`, HDMI `RUNNING → SUSPENDED`, and WordScript's sink input gone. Before
it, the check from the record's first addendum still held — WordScript was the
**only sink input in the entire system**, holding a monitor's audio path awake
for an app making no sound. The owner's own session then produced the whole
cycle without being asked to: closed at +60.058, opened at +265.355 for a
dictation's Listen cue, closed again at +332.091, opened at +445.646 for the
next one. **The zero errors in that window are not a result** — the base rate is
5.2 per hour and under half an error was expected in it; a day of use is what
would make the count mean anything.

**And then the record's explanation of its own symptom was refuted.** The
2026-08-14 addendum reasoned that a per-cue stream *"would be routed at the
moment it plays … the symptom could not exist"*. It can. WirePlumber persists
`Output/Audio:application.name:WordScript={"target":"…hdmi-stereo"}`, and a
fresh stream carrying that name lands on HDMI while a control name lands on the
default. Worse for the record: **`pactl move-sink-input` — the relief it
recommends — is what writes that rule.** The product then confirmed the whole
thing without being asked: after the change the stream closed, and the next cue
reopened it on HDMI with the default elsewhere.

**So step 7 fixed the half it owned and disproved the half it was credited
with.** Where a cue plays needs the app to *choose* an output device, which is
`list_native_output_devices` and is F2's. This is the third time in this cluster
that reading the real system beat reasoning about it.

**Counts, because a test total is a shared measurement.** `cargo test` 799 → 801
passing and 3 → 5 ignored: two synthetic tests for the budget rule, and two
`#[ignore]`d ones that need the real device — the open-latency measurement and
the lifecycle check. `cargo check` 15 warnings, unchanged. No frontend file was
touched, so no frontend count moved.

**What it cost, and it is the same self-inflicted class as step 1's.** Editing a
Rust file restarts `npm run tauri dev`; this session's edits — including the
falsification and its restore — rebuilt and **restarted the owner's running app
about four times**, once while he was dictating. The `vite.config.ts` rule in
`AGENTS.md` covers the frontend half of this; the native half is the same
sentence with `cargo` in it.

### What step 1 leaves open, and it is the owner's call

**An edit that takes longer than ten seconds loses to the deadline.** The edit
surface is frontend-local until confirm — the preview stays staged the whole
time — so at 10 s the runtime commits the *unedited* text. The surface then
closes correctly rather than erroring: `editSourceAvailable` reads
`isProcessing && pendingPreviewResult`, both of which the commit clears, so the
edit box disappears mid-typing and the leave hold replays it. Nothing is
inconsistent and nothing is lost that was not already delivered — but the
user's in-progress correction is gone, and typing for more than ten seconds is
not exotic.

ADR 0134 weighed the abort case ("delete the record that was written") and did
not weigh this one. It is not a defect against the decision as written, so
nothing here overrides it. The options, if it turns out to matter: the edit
surface extends the deadline while it is open, or the deadline is longer while
an edit is open, or a lost edit is re-offered on the clipboard the way a
post-delivery edit already is. **All three are decisions, not fixes**, and the
last is the one the product's existing semantics already point at.

## The order

Steps 1 and 2 are the ones that reach the user. Step 1 outranks step 2 even
though step 2 is cheaper: the watcher makes the window die less often, step 1
makes it not matter when it does.

### Step 1 — the runtime finishes the session (ADR 0134)

**This is the data-loss step. It is the reason the track was re-scoped.**

The decision, the deadline and what it costs are in
[ADR 0134](../decisions/0134-a-session-ends-in-the-runtime-not-in-the-window-that-shows-it.md).
Do not restate them; implement them. In short: on `preview ready` the runtime
starts a **10 s deadline** and commits when it expires — clipboard, history
record, transcript file — while the overlay keeps commit and abort and a late
frontend commit becomes a no-op through the existing `take_pending_preview()`
guard.

Read [ADR 0018](../decisions/0018-the-end-of-a-session-belongs-to-exactly-one-event.md)
and [ADR 0019](../decisions/0019-every-path-that-ends-a-session-owes-the-surface-that-reports-it.md)
first. The deadline is a new path that ends a session, so it owes the surface
that reports it, and it must not re-decide a surface already decided.

**Done when:** a `clipboard_only` dictation whose overlay window is destroyed
right after the preview still lands in the clipboard, in `history.json` and as a
Markdown file, within roughly ten seconds and without a window ever returning.
And the runtime log names which path completed the session.

**Validates with:** `cd src-tauri && cargo test`, `npm test`, `npm run build`,
then the native host — destroy the overlay webview mid-preview and check all
three artifacts. Browser preview cannot do this.

**Run sheet for the native check** (owed as of 2026-08-14; the code is in). It
needs a spoken dictation, because no other path stages a preview — the history
retry inserts directly and never stages one, so it cannot stand in for this.

1. Active profile on `clipboard_only`. `npm run tauri dev`, and clear the
   clipboard first so a hit cannot be last session's text.
2. Dictate something short and let the preview appear. **Then take the window
   away and leave it away**: close the overlay window, or reload its webview.
3. Do not touch the pill for fifteen seconds.
4. Expect, without a window ever returning: the text in the clipboard, a row in
   `~/.config/WordScript/history.json`, and a Markdown file under
   `~/WordScript/transcripts`.
5. `grep "Native session completed" ~/.config/WordScript/logs/wordscript-runtime.log`
   → `path=deadline`. Run one ordinary dictation too and expect `path=frontend`
   on that one; if a healthy session ever logs `path=deadline`, the deadline is
   sized wrong, which is a finding and not a pass.

The line before it, `Native preview deadline expired … outcome=committing`,
dates the firing. `outcome=not_committed` means the take lost a race — expected
only if a commit or abort landed in the same instant.

### Step 2 — the dev-server watcher — **done 2026-08-14**

`vite.config.ts:23`, extend `server.watch.ignored` with `**/donors/**`,
`**/vendor/**`, `**/target/**`, `**/.kilo/**`. The same list already exists at
`:46-47` under `test.exclude`, which the dev server never reads — derive both
from one constant so a future addition cannot land in only one copy.

**Why it still matters after step 1:** step 1 stops the data loss; this stops
the white window and the vanishing overlay, and removes an unmeasured confound
from every capture measurement in the record.

**Done when:** touching a file under `donors/` produces no reload; touching
`src/App.tsx` still hot-reloads; the `[trigger] event=register
outcome=skipped_idempotent` triple no longer appears outside a real restart.

**Validates with:** `npm run build`, plus the manual dev-server check. No Rust
change.

**How it was checked:** on a running server, plus a counter-check with the old
list restored — **20,393 inotify watches before, 576 after**, and `src/App.tsx`
still hot-reloads under the new one. Vitest discovers the same 42 files and 533
tests, so the exclude rewrite moved no test. The register triple is the owner's
to confirm over a day of ordinary use; it needs a log window rather than a
check. **The reload half came out inconclusive:** under both the new config and
the old one, an mtime-only `touch` of a donor `tsconfig.json` produced no reload
at all, so what this session verified is the watch surface and not the per-file
reload mechanism the record quotes.

### Step 3 — the cadence instrument (ADR 0133) — **done 2026-08-14**

`src-tauri/src/core/capture.rs` and `src-tauri/src/core/capture_soak.rs`. The
decision, the field list and the pre-registered reading are in
[ADR 0133](../decisions/0133-the-gap-was-measured-on-the-far-side-of-our-own-lock.md).

**Done when:** an ordinary healthy capture logs `slowest_lock_wait_ms`,
`lock_wait_total_ms` and `lost_below_threshold_seconds`, and
`lost_in_gaps_seconds + lost_below_threshold_seconds` approaches
`wall_seconds - recorded_seconds` instead of leaving a third unexplained.

**Validates with:** `cd src-tauri && cargo test` — extend the synthetic cadence
tests at `capture.rs:2757-2813` and the log-line assertions at `:2882`, `:2918`
— then two real captures in the native host.

**Do not** fix the three realtime violations named in ADR 0133's Consequences.
That is Step 6 and it is gated on the measurement.

### Step 4 — the overlay restores itself on mount

Comfort, not safety: after step 1 a lost window costs a surface, not a
transcript.

The overlay remounts with no session state while the runtime is still recording
or holding a preview, and renders nothing. Rust knows what is active — ask on
mount and restore the surface. ADR 0134 adds a second obligation: if the
deadline already fired, the restored surface must not paint a commit it has
already lost.

**Done when:** reloading the overlay webview mid-capture brings the pill back
with the correct elapsed time rather than blank, and a preview committed by the
deadline comes back as committed rather than as an offer.

**Validates with:** `npm test`, `npm run build`, and a native-host run.

### Step 5 — the first real gap enters the corpus — **done 2026-08-14**

`native-18` (2026-08-13 00:36) is the first observed dropout with full
per-callback detail. The cadence assertions run over a synthetic timeline, which
pins the arithmetic and not the phenomenon. Corpus:
`src-tauri/tests/fixtures/regression_transcripts.json`, loader
`core::regression_corpus`.

Do it **before** Step 3 if both land in one session: encoding the event against
today's field set, then widening it, beats encoding it against a field set that
does not exist yet.

**Done when:** a test is driven by the recorded event rather than a synthetic
timeline.

**Validates with:** `cd src-tauri && cargo test`.

### Step 6 — read the next capture event, then fix

~~Gated on Step 3 shipping and~~ **Step 3 shipped 2026-08-14, so this now waits
on nothing but** one natural `Short` capture arriving (3 in 195 captures,
roughly one every day or two of the owner's use). Apply ADR 0133's
pre-registered reading, then fix what it names.

**The next event is the first one that will be readable.** Every `Short` capture
in the record so far was measured by an instrument that could not tell a
suspended stream from a self-inflicted stall, so none of them can be re-read —
the numbers are what they are and the ambiguity is in the numbers, not in how
they were interpreted.

**Done when:** the record names a located cause rather than a hypothesis. If the
reading comes back "the callback genuinely was not called", the outcome is a
PipeWire-side investigation with real support for the first time — that is a
result, not a failure of this step.

**Do not** substitute a forced reproduction for the wait without saying so in
the record. Route B exists and is withdrawn as a plan, not as an option.

### Step 7 — the cue output stream — **done 2026-08-14 (ADR 0150)**

Independent of everything above. The account of what landed and what it refuted
is above, under *Step 7 landed 2026-08-14*; what follows is the brief as it was
written, kept because the refutation only reads as one against it.

1. Rename the log line to name its stream (`Audio output stream error: …`). It
   currently reads as a capture failure and cost this investigation a detour.
2. Decide whether the sink should be held open at all — see the record.

**It stopped being a log-only finding on 2026-08-14.** Reported as *"der Ton ist
weg"*: the cues were playing at full volume into the HDMI monitor while the
owner listened on the Bluetooth default. Nothing muted, nothing corked — the
held-open stream had acquired a route at process start and kept it, and
PipeWire's `module-stream-restore` re-applied that route on every restart. The
HDMI sink was `RUNNING` with WordScript as its only stream, which is this app
holding a device awake for nothing. **Question 2 is therefore no longer only
about the underrun class**: a stream opened per cue is routed when it plays, so
the symptom could not exist. The measurement and the reverse cost — a moved
stream keeps a Bluetooth device permanently awake — are in the record's
2026-08-14 addendum.

**Second consumer, so decide it once:** the speech track's **F2** builds a
second output stream with `list_native_output_devices` and its own lifecycle. If
the cue stream keeps its shape, the voice path inherits the same symptom.

**Done when:** the log distinguishes output from capture at a glance.

**Validates with:** `cd src-tauri && cargo test`.

## Rules you are measured on

- **Do not fix the realtime violations before Step 6.** They are named in ADR
  0133 precisely so that waiting is a decision on the record rather than an
  oversight. Fixing them now makes the next event unattributable.
- **No heavy builds during an audio measurement.** PipeWire runs `SCHED_OTHER`,
  no RT priority, on this machine. A 20-core `cargo test` can fabricate a
  callback gap that lands in the log as a finding. During a measurement, code
  may be written but not validated.
- **One list per fact** (ADR 0123). The documentation map is `docs/README.md`,
  the phase list `docs/ROADMAP.md`, the track state `docs/IMPLEMENTATION.md`.
  If you find a second copy, replace it with a link.
- **ADRs are append-only.** Grep the whole tree for a free number — the filename
  form *and* `grep -nE "Owns ADR" docs/IMPLEMENTATION.md`, because tracks
  reserve numbers as ranges that no filename or prose grep will find.
- Records are living documents and take dated addenda; ADRs do not.

## Sharing main

Three other tracks run concurrently in this tree with no feature branches: GUI
port (Leg 13), Core hardening (third pass), Speech (Stage B). See
[`../IMPLEMENTATION.md`](../IMPLEMENTATION.md).

The collision risk is **Core hardening**, which owns
`capture-loses-half-the-recording.md` as one of its cluster records. This track
holds the capture *instrument*; Core hardening holds the capture *loss* as part
of its invisible-damage class. Before editing that record, re-read it — the
other track appends to it too. `src-tauri/src/core/capture.rs` is the file most
likely to be touched by both.

Step 1 touches `src-tauri/src/core/sessions.rs` and `OverlayWindow.tsx`, which
the **GUI port** also works in. `git status` before you start and before you
append to any shared doc.

## Not this track

- The transcript-side loss
  ([`transcript-stops-before-the-audio-does.md`](../known-issues/transcript-stops-before-the-audio-does.md)).
  Same symptom to a user, other side of the seam, Core hardening's.
- Overlay ghosting, placement persistence, drag sessions. Different failure
  class; see the other overlay records.
- Designing a new surface for `clipboard_only`. ADR 0134 makes History's
  existing `copy` / `restore` / `reveal` reachable without the overlay, which is
  the second route. Do not build a third.
- Anything in `donors/` or `vendor/`. Step 2 makes the dev server ignore them;
  it does not make them ours.

## Checks

- Frontend: `npm test`, `npm run build`
- Native: `cd src-tauri && cargo test`
- Shell/window/Tauri-bound changes: verify in the native host, not browser
  preview
- Never bypass the Husky pre-commit hooks with `--no-verify`
