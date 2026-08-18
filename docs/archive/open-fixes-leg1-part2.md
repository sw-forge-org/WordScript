# Record — Leg 1 part 2: the two leftovers, three owner reports, and four things that were inert

> **Addendum 2026-08-18 — the owner settled the one item this record left to
> them, and `configure_native_capture` is gone.** The body below is left exactly
> as it was written, per this directory's rule that a record is not retconned.
>
> Removed with it: `ConfigureNativeCaptureRequest`, `NativeCaptureState::configure`,
> the `config` field those two wrote, the `load` constructor that existed only to
> seed it, the registration in `lib.rs`, and the frontend's
> `invoke("configure_native_capture", …)` plus its test stub. The reasoning is
> item 6 below; the decision is
> [ADR 0232](../decisions/0232-a-command-that-configures-nothing-is-removed-and-the-capture-ceiling-keeps-one-source.md).
>
> **No behaviour changed, and the suite says so:** `cargo test` **975 passed,
> 0 failed**; `npm test -- --run` **895 passed, 0 failed**; `npm run build`
> clean — the same three numbers as this record's close, which is what a removal
> of a path that decided nothing has to look like. `cargo check --tests`
> introduced no warning; the nine it still reports are all present at `HEAD` and
> belong to other code.

Closed 2026-08-18, same day as [Leg 1](open-fixes-leg1.md). Opened on that
record's own two leftovers; the owner added the shortcut diagnosis and then three
reports from the shipped build, and a fourth arrived mid-session.

Validated at close: `cargo test` **975 passed, 0 failed**; `npm test -- --run`
**895 passed, 0 failed**; `npm run build` clean. Leg 1 closed at 973 / 893. The
Rust count moves by +3 cases and −1: two new, one that had never run because its
`#[test]` was missing, and one phantom that a duplicated `#[test]` had been
counting twice.

**The shape of this leg is one sentence.** Six of its items were *a thing written
to hold a fact that could not hold it* — a gate that could not gate, a test with
no attribute, an attribute counted twice, a command that configures nothing, a
resolver that dropped the fields it was read for, and an event loop that spun
silently on a dead connection. None of them failed loudly. Four were found by
reading the file the owner's report pointed at rather than by reproducing the
report.

## 1. The two delivery switches could not be operated

**The owner's report was exact and the cause was one function.**
`cloneTextProfileWorkMode` in `src/lib/textProfiles.ts` enumerated six of the ten
fields `core::config::TextProfileWorkMode` carries and dropped `bias_mode`,
`manual_bias`, `keep_on_clipboard` and `clipboard_immediately`. All four are
optional on the TypeScript type, so omitting them was not a type error.

That resolver is **both** the read behind a control's `checked` **and** the base
of every `work_mode` write on Profiles. So the two [ADR 0231](../decisions/0231-each-delivery-mode-gets-one-switch-and-off-is-what-that-mode-always-did.md)
switches were inoperable in the shipped build — a controlled value that read
`false` forever — and any unrelated edit to the same block erased whatever was
stored, which is the round trip that ADR states as guaranteed. `Delivery.tsx`
reads them off the same resolver, so its four-sentence hint never followed the
switch either.

**Why the suite was green.** `Profiles.test.tsx` asserts on the PATCH, and the
write literal supplies the field being toggled. The defect was entirely on the
read.

Fixed by spreading the object and then normalizing the three fields that have a
normalizer, so a field added to the type arrives by construction. Held by
`the work mode resolver (ADR 0231)` in `textProfiles.test.ts`, which reads the
field list out of `core/config.rs` — the same technique as the schema-version case
beside it — and fails at 6 keys against 10.

## 2. The reveal instrument went in, and refuted the hypothesis it was built for

`[ov-reveal]` now carries its `OverlaySurface` on both halves of the trace. Leg 1
recorded that this "becomes a measurement the moment `[ov-reveal]` logs its
surface — one field". It did, on the first start of the rebuilt host, and the
leading explanation did not survive it:

- both reveals of the app-start pair name **`Compact`** — they did not carry
  different surfaces;
- they are **108 ms** apart, not 13, so `OVERLAY_REVEAL_SETTLE_MS` (30) is not
  failing, it is out of range;
- **one** `[ov-sched] flush` precedes the pair, so the second reveal never came
  from the frontend serializer — it entered from a native route.

The question moved rather than closing, and it is recorded with the numbers in
[`../known-issues/overlay-ghosting.md`](../known-issues/overlay-ghosting.md).
Still not fixed, on that file's standing rule: no ghosting is observed.

**Nothing needed building for the interval.** The frontend copy of the trace in
`/tmp/kilo/overlay-diag.log` was already stamped, so the 108 ms came out of the
existing instrument once the surface was on it.

## 3. The gate that could not gate, and two more beside it

`feature = "devtools"` was named at two `cfg` sites in `lib.rs` and declared
nowhere, so the arm could never be true and two `unexpected_cfg_value` warnings
named the lines. **Declared** rather than deleted — the arm states the real Tauri
rule, and a release build handed `--features devtools` now actually gets the
inspector.

Reading the trigger tests to add a case found the same class twice more:

- `registration_failure_reason_names_the_shortcut_and_the_likely_cause` had **no
  `#[test]`** and had therefore never run. The only one in the module without it.
- `the_idempotency_guard_only_covers_the_startup_burst` had **two**, one above its
  doc comment and one below, which is what the `duplicated attribute` warning
  named and what had been inflating the suite count by one.

Both were pre-existing warnings nobody had read. All four warnings are gone.

## 4. Why the grabs die is still not diagnosed — one candidate closed by reading

**Candidate 3 of the record was reachable without a reproduction.** The vendored
X11 backend polled with `while let Ok(Some(event)) = conn.poll_for_event()`. The
`Err` arm fails to match, so a broken connection ended the inner loop and the
outer loop went straight back to polling a dead connection, 1 ms apart, forever —
delivering nothing, saying nothing, with the manager thread still alive and the
app's own state still reading *registered*. The three outcomes are separated now
and the thread ends with a reason; the report also reaches stderr, because the
only path it had was compiled out behind a `tracing` feature this tree does not
enable.

**This is not a diagnosis of the bug.** It makes one of three candidates
*reportable*. Nothing shows it is the one that happened.

**The instrument the record asked for exists.** Every registration decision is
now preceded by `event=register_standing`, carrying the age of the standing
registration and the event counters behind it. The reported failure was sixteen
consecutive `skipped_idempotent` lines, none of which said how long the grabs had
stood or whether they had ever delivered anything, so the interval in which they
were already dead was unbounded. It reports counters and not a verdict: zero
events is equally what an unpressed binding looks like.

## 5. Hold mode ends when a window opens, and then behaves like toggle

**Two owner reports, and the code says they are one mechanism seen twice.**
Nothing in the app ends a session on focus loss — verified, there is no such
handler on either side. So both must arrive through the trigger, and Leg 1's
`origin` field is what separates them:

- a release the X server fabricated when the grab broke logs
  `state=released origin=grab` followed by `hold_stop`;
- a release that never arrives logs **nothing**, which the press/release counters
  already make visible.

The second is why hold starts behaving like toggle, and the state machine is
doing what it says: the press that follows a lost release hits
`state.hotkey_active || state.hold_phase != HoldPhase::Idle` and is *ignored*,
and its own release then finds `hold_in_flight` true and stops the session. One
more press to end it, finger already lifted — exactly the report. Leg 1 measured
delayed releases on this machine directly (two holds where the release arrived
4.5 s and 4.2 s after the watchdog had already stopped the session), so the lost
half is established, not assumed.

**Deliberately no code.** Today's log already separates all three causes, and
adding a field on a hypothesis is what this track's own lesson forbids. It needs
one reproduction: open a window mid-hold and read whether a release line appears
and what its `origin` says.

## 6. The 3-minute abort under Insert at cursor is not in any evidence

The owner reported the hold watchdog still cutting a session at about three
minutes, and asked whether the "When a recording stops" card governs all three
activation modes and both delivery modes.

**It does, and that is now pinned.** `start_native_capture` builds its snapshot
from `NativeCaptureConfig::load_from_disk()` — the ACTIVE PROFILE's resolved
capture block — on every capture, and that snapshot carries no activation-mode or
delivery-mode axis for either number to vary on. Held by
`the_capture_ceiling_comes_from_the_active_profile_not_the_machine`.

**The abort itself is not measurable anywhere:**

- `capture_stop_reason` is `null` on **all 369** history records, so no recorded
  session was ended by either ceiling path;
- the only `hold_watchdog` events in any log are **two**, both `after_seconds=120`
  and both from before Leg 1's fix;
- the durations do not establish a wall. `direct_paste` reaches 160.5 s over
  n=65 against a `clipboard_only` base rate of 6.2% over 160 s — about 4 expected,
  1 observed, p≈0.08. Suggestive, not significant, and its p90 is simply lower
  (103 s against 128 s), which is what a different kind of use looks like.

**The delivery-mode correlation is a profile correlation.** The only `auto_paste`
profile on this machine is `curated-founder-ops`; every other profile is
`clipboard_only`. They are different profiles with different capture cards
(1200 s / 50 s silence against 720 s / 30 s), so mode and ceiling move together
in the data without one causing the other.

**Found on the way: a command that configures nothing.**
`configure_native_capture` writes `max_recording_seconds`,
`silence_timeout_seconds` and `audio_device` into `NativeCaptureState::config`,
which has **no reader** — `status()` exposes neither ceiling, a running capture
carries its own snapshot, and `start_native_capture` overwrites the field from
disk. The frontend sends the machine-wide `AppConfig` pair, so it looks like the
configuration path and reaches no decision. Stated at the site and pinned by the
test above; **not removed**, because removing a registered command is a seam
decision and not this pass's to take.

## Deliberately not done

- **The overlay double reveal.** Measured further and still not fixed, for the
  reason Leg 1 gave.
- **Removing `configure_native_capture`.** Dead by measurement, but it is a
  registered command on the UI/runtime seam and the sweep counts it. Owner's call.
- **Rewriting the stale `hold_watchdog_seconds = 120`** in the config on disk.
  Only `== 0` is read, so the value is inert — and ADR 0020 says a setting the
  user made is not the runtime's to edit.
- **Reports 5 and 6's fixes.** Both wait on one reproduction each, now that the
  instruments are in. Neither is guessed at.
- **Leg 2.** Untouched at the time. It has since been built, measured and closed;
  its brief is spent and archived as
  [`insert-delivery-kickoff.md`](insert-delivery-kickoff.md),
  and the track itself is [`insert-delivery.md`](insert-delivery.md).

## Left for whoever picks this up

- **`bias_mode` and `manual_bias` were being erased by the frontend** on every
  `work_mode` write until item 1, and nothing writes them (speech-track B21 has
  the Rust half). They round-trip now, which means B21's cleanup is measuring a
  tree that no longer silently zeroes them.
- **Two reproductions are owed**, and both have a reading key in items 5 and 6.
