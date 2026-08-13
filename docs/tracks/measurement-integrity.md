# Track — Measurement integrity

Opened 2026-08-13. This file is both the sequence and the kick-off; paste it to
the next agent.

Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. See **Sharing main** below.

## The thesis

Three long-open records were investigated with instruments that cannot see the
cause they name, inside an environment nobody had measured.

- The capture cadence timestamps itself **after** taking the app's own mutex, so
  "the stream stopped" and "we blocked our own callback" are one number — and it
  prints the first as a verdict.
- The overlay heartbeat reports a *late* interval, so a reload that **destroys**
  the interval reads as silence. Every dev-only cause of that shape was invisible
  to it.
- `npm run tauri dev` issued about **1,389 full page reloads in 2.5 days**,
  rebuilding all three webviews, because the dev server watches 36,000 files it
  has no reason to watch. Every capture measurement in the record was taken
  inside that.

None of these is the bug. All three are why the bugs could not be found. The
track's job is to make the next event decidable, then decide it.

## The records this track carries

Read all four before touching any of them.

| Record | State | This track's part |
|---|---|---|
| [`known-issues/dev-server-reloads-the-app-mid-session.md`](../known-issues/dev-server-reloads-the-app-mid-session.md) | Open, cause located, fix known | Step 1 |
| [`known-issues/capture-loses-half-the-recording.md`](../known-issues/capture-loses-half-the-recording.md) | Open, 3 detailed events, cause not located | Steps 2, 5, 6 |
| [`known-issues/overlay-recording-freeze.md`](../known-issues/overlay-recording-freeze.md) | **Reopened 2026-08-13** | Steps 1, 3 |
| [`known-issues/sound-output-underruns-and-reopens.md`](../known-issues/sound-output-underruns-and-reopens.md) | Open, measured not diagnosed | Step 4 |

Adjacent, read before Step 3, do not re-derive:

- [`overlay-stranded-off-screen.md`](../known-issues/overlay-stranded-off-screen.md)
  — owns the *other* cause of "invisible mid-recording" and carries the
  log discriminator table. Reopened, not this track's to fix.
- [`overlay-leave-hold-dead-actions.md`](../known-issues/overlay-leave-hold-dead-actions.md)
  — **fixed, and stays fixed.** It carries the reason Step 3 is a product
  question: `clipboard_only` gives a transcript exactly one door, and this is
  the third mechanism to remove it.

Owns **ADR 0133** onward for these records. ADRs 0079-0081, 0083, 0084 and 0100
belong to **Core hardening** and are not re-opened here — 0133 continues that
line and says so in its own References. 0132 is the Speech track's; it landed in
`2d5bead` while this track was being written, which is exactly why the rule
below says to grep the whole tree for a free number.

## Status

This table is the state of the track. Update it as steps land; it is the first
thing a resuming session reads.

| Step | What | State | Blocked on |
|---|---|---|---|
| 1 | the dev-server watcher | **open, unblocked** | nothing — one edit |
| 2 | the cadence instrument (ADR 0133) | **open, unblocked** | nothing |
| 3 | a transcript needs more than one door | open | a design answer, see the step |
| 4 | the cue output stream | **open, unblocked** | nothing |
| 5 | `native-18` into the regression corpus | open | nothing |
| 6 | read the next event, then fix | open | step 2, then one natural `Short` capture |

Opened with all six open and nothing started, 2026-08-13.

## The order

Each step is independently shippable. Steps 1, 4 and 5 have no dependencies; do
not batch them behind 2.

### Step 1 — the watcher (do this first, it is free)

`vite.config.ts:23`, extend `server.watch.ignored` with `**/donors/**`,
`**/vendor/**`, `**/target/**`, `**/.kilo/**`. The same list already exists at
`:46-47` under `test.exclude`, which the dev server never reads — derive both
from one constant so a future addition cannot land in only one copy.

**Why first:** until it lands, every overlay sighting has two candidate causes
and every capture measurement has an unmeasured confound. It costs one edit.

**Done when:** touching a file under `donors/` produces no reload; touching
`src/App.tsx` still hot-reloads; the `[trigger] event=register
outcome=skipped_idempotent` triple no longer appears in the runtime log outside
a real restart.

**Validates with:** `npm run build`, plus the manual dev-server check above. No
Rust change.

### Step 2 — the cadence instrument (ADR 0133)

`src-tauri/src/core/capture.rs` and `src-tauri/src/core/capture_soak.rs`.
The decision, the field list and the pre-registered reading are in
[ADR 0133](../decisions/0133-the-gap-was-measured-on-the-far-side-of-our-own-lock.md).
Do not restate them here; implement them.

**Done when:** an ordinary healthy capture logs `slowest_lock_wait_ms`,
`lock_wait_total_ms` and `lost_below_threshold_seconds`, and
`lost_in_gaps_seconds + lost_below_threshold_seconds` approaches
`wall_seconds - recorded_seconds` instead of leaving a third unexplained.

**Validates with:** `cd src-tauri && cargo test` (extend the synthetic cadence
tests at `capture.rs:2757-2813` and the log-line assertions at `:2882`,
`:2918`), then two real captures in the native host — `invoke()` and the event
bridge need it, browser preview will not do.

**Do not** fix the three realtime violations named in ADR 0133's Consequences.
That is Step 6 and it is gated on the measurement.

### Step 3 — a transcript needs more than one door

**The trigger path is not in question.** The owner confirmed 2026-08-13 that
the stop hotkey ends the session normally and every shortcut works every time.
Do not go looking there.

The damage is narrower and older than it looks. In `clipboard_only` the preview
pill is the only route the mode offers to the transcript, so **losing that
surface by any means loses the transcript**. Three mechanisms have now produced
that one user sentence in six weeks:

| # | Mechanism | Record | State |
|---|---|---|---|
| 1 | handlers dead under the 240 ms leave hold | [`overlay-leave-hold-dead-actions.md`](../known-issues/overlay-leave-hold-dead-actions.md) | fixed 2026-07-30 |
| 2 | window placed where no monitor is | [`overlay-stranded-off-screen.md`](../known-issues/overlay-stranded-off-screen.md) | reopened |
| 3 | webview destroyed by a reload, remounted empty | [`dev-server-reloads-the-app-mid-session.md`](../known-issues/dev-server-reloads-the-app-mid-session.md) | Step 1 |

Two mechanisms were each fixed as a wiring or placement bug and the sentence
came back. **Stop hunting the fourth mechanism; remove the single point of
failure.** Two items:

1. **The overlay restores itself on mount.** It currently remounts with no
   session state while Rust is still recording or holding a staged preview, and
   renders nothing. Rust knows what is active — ask on mount, restore the
   surface.
2. **`clipboard_only` gets a second route to its transcript**, independent of
   the overlay existing.

**Resolve this first, it changes the design:** the runtime already writes the
clipboard unconditionally at insert time on every session in the log
(`insert_mode=ClipboardOnly clipboard_written=true`, `wl-copy clipboard verified
via wl-paste`). So the text does reach the clipboard without the pill, and what
a lost surface removes is the route *back* once the clipboard has moved on. If
that holds, the second door is a recall path (History already lists the record),
not a second write.

Note the freeze and the non-recovery **occur separately as well as together**
(owner, 2026-08-13). So neither item substitutes for Step 1, and none of the
three substitutes for the re-measurement that
[`overlay-recording-freeze.md`](../known-issues/overlay-recording-freeze.md)
asks for after the watcher lands — including the release-versus-dev comparison
that record has had as its first resolution item since 2026-07-27 and that only
becomes meaningful once the reload confound is gone.

**Done when:** reloading the overlay webview mid-capture leaves the pill
restored with the correct elapsed time rather than blank, and a finished
`clipboard_only` transcript is reachable with the overlay window destroyed.

**Validates with:** `npm test`, `npm run build`, `cd src-tauri && cargo test`,
and a native-host run — `invoke()` and the event bridge need the host.

### Step 4 — the cue output stream

Independent of everything above.

1. Rename the log line to name its stream (`Audio output stream error: …`).
   It currently reads as a capture failure and cost this investigation a
   detour.
2. Decide whether the sink should be held open at all — see the record.

**Done when:** the log distinguishes output from capture at a glance.

**Validates with:** `cd src-tauri && cargo test`.

### Step 5 — the first real gap enters the corpus

`native-18` (2026-08-13 00:36) is the first observed dropout with full
per-callback detail. The cadence assertions currently run over a synthetic
timeline, which pins the arithmetic and not the phenomenon. Encode it per
`CLAUDE.md`: the corpus is
`src-tauri/tests/fixtures/regression_transcripts.json`, loader
`core::regression_corpus`.

Do it **before** Step 2 if the two are in the same session: encoding the event
against today's field set, then widening it, is easier than encoding it against
a field set that does not exist yet.

**Done when:** a test fails against the pre-ADR-0083 arithmetic and passes
against the current one, driven by the recorded event rather than a synthetic
timeline.

**Validates with:** `cd src-tauri && cargo test`.

### Step 6 — read the next event, then fix

Gated on Step 2 shipping and one natural `Short` capture arriving (rate: 3 in
195 captures, roughly one every day or two of the owner's use). Apply ADR 0133's
pre-registered reading. Then, and only then, fix what it names.

**Done when:** the record names a located cause rather than a hypothesis, and
the fix it points at has landed with a test. If the reading comes back "the
callback genuinely was not called", the outcome is instead a PipeWire-side
investigation with real support for the first time — that is a result, not a
failure of this step.

**Do not** substitute a forced reproduction for the wait without saying so in
the record. Route B exists and is withdrawn as a plan, not as an option.

## Rules you are measured on

- **Do not fix the realtime violations before Step 6.** They are named in ADR
  0133 precisely so that waiting is a decision on the record rather than an
  oversight. Fixing them now makes the next event unattributable.
- **No heavy builds during an audio measurement.** PipeWire runs
  `SCHED_OTHER`, no RT priority, on this machine. A 20-core `cargo test` can
  fabricate a callback gap that lands in the log as a finding. During a
  measurement, code may be written but not validated.
- **One list per fact** (ADR 0123). The documentation map is `docs/README.md`,
  the phase list `docs/ROADMAP.md`, the track state `docs/IMPLEMENTATION.md`. If
  you find a second copy, replace it with a link.
- **ADRs are append-only.** Grep the whole tree for the next free number, not
  just `docs/decisions/` — a number gets cited in source before the file lands.
- Records are living documents and take dated addenda; ADRs do not.

## Sharing main

Three other tracks run concurrently in this tree with no feature branches: GUI
port (Leg 13), Core hardening (third pass), Speech (Stage B). See
[`../IMPLEMENTATION.md`](../IMPLEMENTATION.md).

The collision risk here is **Core hardening**, which owns
`capture-loses-half-the-recording.md` as one of its five cluster records. This
track holds the capture *instrument*; Core hardening holds the capture *loss*
as part of its invisible-damage class. Before editing that record, re-read it —
the other track appends to it too.

`src-tauri/src/core/capture.rs` is the file most likely to be touched by both.
`git status` before you start and before you append to any shared doc.

## Not this track

- The transcript-side loss
  ([`transcript-stops-before-the-audio-does.md`](../known-issues/transcript-stops-before-the-audio-does.md)).
  Same symptom to a user, other side of the seam, Core hardening's.
- Overlay ghosting, placement persistence, drag sessions. Different failure
  class; see the other overlay records.
- Anything in `donors/` or `vendor/`. Step 1 makes the dev server ignore them;
  it does not make them ours.

## Checks

- Frontend: `npm test`, `npm run build`
- Native: `cd src-tauri && cargo test`
- Shell/window/Tauri-bound changes: verify in the native host, not browser
  preview
- Never bypass the Husky pre-commit hooks with `--no-verify`
