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
| [`sound-output-underruns-and-reopens.md`](../known-issues/sound-output-underruns-and-reopens.md) | open, measured not diagnosed | Step 7 |

Adjacent, do not re-derive:
[`overlay-stranded-off-screen.md`](../known-issues/overlay-stranded-off-screen.md)
owns the second cause of "invisible mid-recording" and carries the log
discriminator table. Reopened, not this track's to fix.

Owns **ADR 0133** onward for these records. ADRs 0079–0081, 0083, 0084 and 0100
belong to **Core hardening**; 0133 continues that line and says so in its own
References. 0132 is the Speech track's — it landed in `2d5bead` while this track
was being written, which is why the rule below says to check the ranges too.

## Status

This table is the state of the track. Update it as steps land.

| Step | What | State | Blocked on |
|---|---|---|---|
| 1 | the runtime finishes the session (ADR 0134) | **open, unblocked — do this first** | nothing |
| 2 | the dev-server watcher | **open, unblocked** | nothing — one edit |
| 3 | the cadence instrument (ADR 0133) | **open, unblocked** | nothing |
| 4 | the overlay restores itself on mount | open | step 1 |
| 5 | `native-18` into the regression corpus | **open, unblocked** | nothing |
| 6 | read the next capture event, then fix | open | step 3, then one natural `Short` capture |
| 7 | the cue output stream | **open, unblocked** | nothing |

Opened with all seven open and nothing started, 2026-08-13.

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

### Step 2 — the dev-server watcher

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

### Step 3 — the cadence instrument (ADR 0133)

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

### Step 5 — the first real gap enters the corpus

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

Gated on Step 3 shipping and one natural `Short` capture arriving (3 in 195
captures, roughly one every day or two of the owner's use). Apply ADR 0133's
pre-registered reading, then fix what it names.

**Done when:** the record names a located cause rather than a hypothesis. If the
reading comes back "the callback genuinely was not called", the outcome is a
PipeWire-side investigation with real support for the first time — that is a
result, not a failure of this step.

**Do not** substitute a forced reproduction for the wait without saying so in
the record. Route B exists and is withdrawn as a plan, not as an option.

### Step 7 — the cue output stream

Independent of everything above.

1. Rename the log line to name its stream (`Audio output stream error: …`). It
   currently reads as a capture failure and cost this investigation a detour.
2. Decide whether the sink should be held open at all — see the record.

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
