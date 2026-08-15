# WordScript — the implementation board

Status: 2026-08-14

**This page answers one question: what is being built right now, by whom, and
where does its sequence live.** It is the entry point for a session that is
about to write code. Nothing here is a contract — the contract is
[`spec/SPEC.md`](spec/SPEC.md) — and nothing here is a product state report,
which is [`STATUS.md`](STATUS.md). This is the order of work.

## What a track is

A track is one line of implementation that runs across many sessions, carries
its own sequence document, and files its own ADRs. Tracks run **concurrently on
`main`**, in the same working tree, with no feature branches. That is a
deliberate choice and it has a cost, stated under *Sharing `main`* below.

A track has three kinds of document and they are not interchangeable:

| Kind | What it is | Who writes it |
| --- | --- | --- |
| **Sequence** | The ordered steps, what each requires, what validates it, and what *done* observably means | The track, updated as steps land |
| **Kick-off** | The page pasted into a fresh session to start the next unit of work | The session before it |
| **Record** | What a closed unit actually did, found, and deliberately did not do | The session that closed it |

Only the sequence is a living document. A record is written once and not
updated; a kick-off is spent when its unit closes.

## The live tracks

| Track | Opened | State | Sequence | Start a session with |
| --- | --- | --- | --- | --- |
| **GUI port** | 2026-08-04 | **Leg 14 open**; Legs 0–13b closed. Leg 13 split 2026-08-14 and both halves closed | [`tracks/gui-port-relay.md`](tracks/gui-port-relay.md) | [`tracks/gui-port-relay-kickoff.md`](tracks/gui-port-relay-kickoff.md) |
| **Core hardening** | 2026-08-10 | **Third pass open**; two passes closed. Two steps added 2026-08-13 with a sixth record | [`tracks/core-hardening.md`](tracks/core-hardening.md) | the same file — it is both |
| **Speech** | 2026-08-11 | **Stage A closed, Stage B running**; 11 of ~26 steps done, and the first adapter has landed | [`tracks/speech-track-plan.md`](tracks/speech-track-plan.md) | [`tracks/speech-track.md`](tracks/speech-track.md) for orientation, then the plan |
| **Runtime ownership** | 2026-08-13 | **Six of seven done 2026-08-14.** Only step 6 is open, and it waits on one natural capture event and nothing else | [`tracks/runtime-ownership.md`](tracks/runtime-ownership.md) | the same file — it is both |
| **Context objects** | 2026-08-14 | **Open, five stages, none started**; A–D are unblocked, E waits on one roadmap gate | [`tracks/context-objects.md`](tracks/context-objects.md) | the same file — it is both |
| **Activation gestures** | 2026-07-29 | **Open, nothing built** — blocked on three capability gaps and the decisions they owe | [`tracks/activation-gestures.md`](tracks/activation-gestures.md) | the same file |

### GUI port

Moves the settings rework from prototype to product as a **relay**: one leg per
session, each leg reading the chain document, doing its leg completely, and
writing the next leg's brief into it before it stops. Rests on ADR 0054 (the
port overwrites, it does not migrate) and ADR 0055 (the gallery is the
acceptance surface).

Owns ADR 0054–0064, 0074–0077, 0082, 0085–0093, 0103, 0104, 0111, 0153, 0156.

**Leg 13 split on 2026-08-14 and both halves are closed.** Its first item — the
caller sweep in both directions over the whole tree — closed as **Leg 13a**; the
second closed as **Leg 13b** on 2026-08-15: the row classes no instrument had
reached, the panel plane where the port designs rather than carries.

**13b measured the plane and found one defect, and its shape is the interest.**
55 samples at 800 × 608 CSS px: everything draws one or two lines except the
sample answer's foot, which printed `dictionary:<entry id>` across **four lines
of a 241 px foot** under a comment reading *the rules that fired, BY NAME*. The
ids are the runtime's correct answer — `rule_label` returns an entry's id
whenever it has one — so the join to the reader's words is the screen's
(ADR 0156), and an id with no entry behind it is printed unchanged rather than
given an invented name. **The panel plane also turned out to carry the narrowest
text column on the surface**, 241–292 px against ADR 0092's 436 px for a stacked
row, which is a budget nobody had written down. **Two classes are still
unmeasured** — `.ws-edit-issues p` and `.ws-flag-what p` need runtime state the
owner's profile does not have, and that is a population fact rather than a clean
bill. **13b also adopted the two commits with no leg behind them**, `b330815`
and `f1b2497`, after three legs had been asked about them.

**13a swept a channel no ADR had asked about and it is the reason it owns 0153.**
ADR 0089, 0093 and 0103 are all about `invoke`, the frontend calling the runtime;
an event is the runtime calling the frontend, the same seam turned around. The
`invoke` half came back clean — 72 registered, 72 defined, the lists identical,
zero callers with no command, and the same five orphans already on record. The
event half found `wordscript-native-insert`: emitted from three sites, listened
to by nothing, and carried in `spec/SPEC.md` as contract. **Dead weight rather
than a gap** — every emitter sat beside a path already delivering the same
result — and the disposition went to the Runtime ownership track because the
insert is its. **It was taken on 2026-08-15 and the channel is removed** (ADR
0154), so all four defect directions of the sweep now report zero. The sweep is
`npm run sweep:commands`.

**The two commits with no leg behind them were adopted by Leg 13b** on
2026-08-15 — `b330815` (the sidebar's second width, ADR 0111) and `f1b2497` (the
2026-08-14 `Context.tsx` wiring). Neither gets a retroactive leg row, because a
row is a session. `f1b2497`'s decision half stays the context objects track's:
the relay owns the surface, that track owns ADR 0137.

### Core hardening

Follows the cluster in [`known-issues/`](known-issues/) where the damage is
invisible — output that is fluent, grammatical, plausible and wrong, with
nothing downstream carrying evidence that a substitution happened. Six records
are one failure class; **none of them is closed and two never will be in the
ordinary sense**, because the rule is that lost content is reported, never
replaced.

Owns ADR 0079–0081, 0083, 0084, 0100.

What two passes bought is that the cluster went from invisible to instrumented.
The third pass's own page carries where each of the six records stands.

**The sixth landed 2026-08-13 and it is the first one on the cleanup lane that
damages a correct transcript**: the AI stage rewrote a question dictated to an
addressee into a question about the speaker
([`known-issues/cleanup-flips-the-grammatical-person.md`](known-issues/cleanup-flips-the-grammatical-person.md)).
Every guardrail declines, the two prompt lines that forbid answering and acting
were obeyed, and the one guard that reads grammatical person is gated on a mode
this did not run in. **No rule was written**, on this track's own evidence
standard — the corpus carries the case and the same construction handled
correctly two days earlier, which is one flip and one non-flip. Steps 6 and 7 of
the sequence carry it and the closing-phrase artifact found beside it.

### Speech

The capability layer four drawn surfaces wait on: providers, streaming
recognition, the spoken output path, and the windows that carry them.

Owns ADR 0094–0102, 0105–0110, 0113–0122, 0124, 0126–0132.

**Its first stage was documentation only** — [`PROVIDERS.md`](PROVIDERS.md) and
fifteen records, no code — and the plan exists because those records order the
*adapters* and not the work in front of them. The plan is the page a session
starts on; [`tracks/speech-track.md`](tracks/speech-track.md) is stage one's
account and is not updated by later work.

Done: A1–A6 (the runtime contract), B1 (the capability seam), B3 (the model
catalogue), C3 (the soak night, which returned zero), **D1 (OpenAI — the first
adapter, and the connection that can now be chosen)**, and **B6 (what it means
to wire a drawing inherited from the demo GUI)**.

Next unblocked: **B2**, **B4**, **B5**, **B7**, **E1**, **D3** — whose
`Requires` line has read D1 and A3 since it was written, both now done — and
**D1a**, which since B6 spent its drawing half is the adapter alone and the
cheapest step in Stage D.

**C1 was on that list until 2026-08-14 and came off it, on a measurement rather
than on a dependency.** It rewrites `core::capture`, which the Runtime ownership
track is measuring until its step 6 has read one natural `Short` capture — and a
rewrite of the file under measurement makes that event unattributable, which is
the same rule that already defers the realtime-violation fixes. C2 requires C1
and inherits the wait. The reason and its cost are on C1 in the plan; closing
step 6 releases both.

**Two steps were added on 2026-08-13 from a donor reading, and neither needs
code to have been useful.** **B7** (ADR 0129, widened by ADR 0131) moves the
provider choice to the point of use — the file's size is the fact that decides
it, and it is not known in a settings table. **C4** (ADR 0130) answers how a
two-hour meeting is transcribed, which no document in this repo did: it is C1's
turns cut on silence rather than a chunker, and **the ceiling that binds it is
neither the audio nor the upload size** — the default lane cannot stream at all,
and nothing here records a model's context window.

**And the same day's third record is mostly a correction, which is why it is
worth reading.** ADR 0131 generalises B7's rule — *every surface that starts a
job names where it runs*, on **all four lanes** rather than Cloud with three
fallbacks — and then withdraws two questions C4 had filed as the owner's,
because **the prototype had already answered both**: live transcription is a
`toggle(true)` on the `Meetings` row and retention is `Keep the audio` with a
lifecycle default. Reading `docs/prototypes/` rather than reasoning about it
would have found them. It also corrects the donor survey — `voxtype` carries a
complete Rust meeting stack that the first pass missed.

**Then two candidates were cloned and correcting that record twice is the
lesson.** `donors/app/meeting-notetakers/` now holds **anarlog** (MIT, Rust,
formerly Hyprnote) and **meetily** (MIT, Rust). Reading them showed that
anarlog is **not GPL-3.0** as a web summary had said, and that the
topic-boundary chunking the same paragraph called *published practice* is not
what anybody implements — meetily cuts on a **sentence** boundary inside a token
window. **Anarlog is the primary reference for all meeting work** and carries
`aec`, diarization, `audio-chunking`, `segmentation`, `live_transcript` and
`overlay-kit` as crates. Read for mechanism, not structure.

**And a third surface for running text turned up that neither step knew**
(ADR 0132). `Live subtitles` is **two** features that share only the word:
captions over somebody else's audio, and the **echo** of your own voice under
the dictation pill. The echo renders partials, and no partial may reach the
session reducer — so **D2 now owes a display path beside its result path**, and
validates two things instead of one.

**What D1 left for somebody to decide was decided the next morning.** The drawn
per-job override and A4's runtime resolution disagreed about what a fresh
profile overrides; ADR 0128 answers it with a rule rather than with either
option — the config answers in the product, the drawn literal answers in the
gallery — and closes `PROVIDERS.md` disagreements 10, 11 and 13 with it. The
rule generalises past this screen: **an inherited drawing is an inventory of
intent, and what is unbuilt stays visible and inert rather than tidied away.**

### Runtime ownership

Opened 2026-08-13 as *measurement integrity*, **renamed and re-scoped the same
day** when the last finding turned out not to be a measurement problem at all.

`CLAUDE.md` gives the runtime trigger, capture, provider, transform, **insert**
and recovery. It does not own the insert, and the instruments cannot see where
it does not.

Owns ADR 0133, 0134, 0150–0152 for its five records, **0154** for the insert
channel the GUI port's sweep handed it, and **0155** for the overlay that stops
being unmapped (`be74233`, 2026-08-15) — 0135–0149
went to Context objects as a range the same week, which is why step 7's decision
is 0150 and not 0138, and **0153 went to the GUI port on 2026-08-14** because
that leg filed first, as **0156 did on 2026-08-15**. "Onward as they come" is a
direction of travel, not a reservation, and the number line is corrected here by
whoever notices — 0155 landed in `be74233` and stood on neither this board nor
its own track's page until the owner asked for it on 2026-08-15; **the seventh
record is on the track page now**, and 0157 is the next free number.

**A sixth record closed on 2026-08-15 without ever being a step.** The GUI port
swept the event channel and found `wordscript-native-insert` emitted from three
sites in `core::insertion` and heard by nothing, while `spec/SPEC.md` carried it
as contract (ADR 0153). It was dead weight rather than a gap — every emitter sat
beside a path already delivering the same `NativeInsertResult` — and the owner
removed it the next day (ADR 0154), on ADR 0018/0019's rule that a session ends
in exactly one reducer commit.

**A seventh closed the same day and was missing from every page for a day**
(ADR 0155). The overlay flashed the full rectangle black at every recording
start, because each reveal ended in `show()` — an X11 map under XWayland, which
KWin composites before WebKitGTK has delivered a frame with alpha. On Linux the
window is now mapped once at setup, offscreen at opacity 0, and parking is
opacity plus click-through; Windows and macOS keep `hide()`. **What it hands the
track is an open risk**: the park move became effective for the first time, and
`overlay-stranded-off-screen.md` had measured all 482 parks landing somewhere
other than requested precisely because GTK does not move a hidden window.

**Step 1 was silent data loss and its code landed 2026-08-14.** Every insert
call site is an `invoke` from `OverlayWindow.tsx`; after `preview ready` the
runtime did nothing on its own. The clipboard write, the history record and the
transcript file are all created inside that insert, so a window that never
returned discarded a finished dictation and nothing reported it. Measured across
277 previews: 1.12 s median, but 11–115 s in the 13 whose webview was destroyed
mid-preview, and one transcript lost outright to an app restart. ADR 0134 gives
the runtime a 10 s deadline; the overlay keeps commit and abort. **The
acceptance run passed the same evening in the native host, in a run where the
overlay rendered no frames at all** — two dictations reached all three artifacts
10.0 s after their preview. **Its second half was paid by ordinary use the same
day**: eight healthy sessions logged `path=frontend`, so the deadline is
demonstrably not the path a working window takes. **Step 2 is done**: one
constant for the watcher and the test exclude, 20,393 inotify watches down to
576.

**Step 4 landed the same day, and so did the decision step 1 had left to the
owner.** The overlay asks the runtime what is running when it mounts (ADR 0151)
and repaints a live capture or a staged preview — and deliberately re-reports
nothing about a session that ended while it was away, because the path that
ended it already owed the surface that reported it. **The deadline then fired
under a window that was demonstrably alive**, which the step's own run sheet had
pre-registered as proof of a mis-sized deadline. It was not: the log shows a
window alive and idle, i.e. a user who did not answer in ten seconds, which is a
third reading the sheet did not have. The answer built is ADR 0152 — an open
edit surface renews the deadline every 3 s, with no release, so a window that
dies mid-edit is still finished for on the ordinary schedule. **It ran in the
product the same afternoon**: a session logged `Native preview deadline
deferred` at the exact instant the old code would have committed, and committed
10.0 s after the surface stopped asking.

The rest is why it stayed invisible. The capture cadence timestamps itself
after taking the app's own mutex, so a suspended stream and a self-blocked
callback are one number. The overlay heartbeat reports a *late* interval, so a
reload — which destroys the interval rather than delaying it — reads as silence.
And `npm run tauri dev` issued about 1,389 full reloads in 2.5 days because the
watcher covered 36,000 files it had no reason to watch.

Step 1 outranked the watcher fix even though the watcher is cheaper: the watcher
makes the window die less often, step 1 makes it not matter when it does. Both
landed the same day, in that order.

**Steps 5 and 3 landed the same day too, and the mutex sentence above is now
false in the code and kept here because it is what the record was measured
under.** The cadence is fed the callback's arrival time, the lock wait is its
own field, and `signature()` no longer prints `stream_suspended` over a
self-inflicted stall. **Step 3's new field fabricated a loss before it measured
one** — 0.292 s reported on a soak segment that had recorded more audio than its
own clock ran, because clamping counts the late half of ALSA's burst jitter and
discards the early half. Found by reading a twelve-second run against real
hardware; every synthetic test was green while it did. That is the second time
this cluster's failure class has come out of the instrument built to detect it.

**Step 7 landed the same day and its interest is the refutation, not the fix.**
ADR 0010 had registered the idle-close fallback in 2026-07 and named the
evidence that would trigger it; 283 stream errors in 2.5 days is that evidence,
so the decision was one somebody else had already made. A cold open measures
14–20 ms against 40 ms of warm-up silence the engine already pays, and the app
verified it live — `closed after idle` at +60.043, the monitor's sink
`SUSPENDED`, WordScript's stream gone. **What the record was wrong about is why
it mattered**: it said a per-cue stream would follow the user's default device.
WirePlumber pins a target by application name, so it does not — proven with a
control, and confirmed when the reopened stream came back on the wrong device
anyway. The routing half was never this stream's lifecycle question; it is the
Speech track's F2.

**Step 6 is now the whole track's front line and it cannot be hurried.** It
waits on one natural `Short` capture, at about 1.5 % of captures, and every
earlier event in the record is unreadable by construction: they were measured by
the instrument that could not tell the two hypotheses apart.
`scripts/read-capture-event.sh` applies ADR 0133's pre-registered reading to
whatever the log holds, and refuses the three events already in the record for
exactly that reason — the wait is now one command rather than a procedure
somebody has to remember.

**It shares `capture-loses-half-the-recording.md` with Core hardening.** That
track holds the capture *loss* as one of its five invisible-damage records;
this one holds the capture *instrument*. Re-read the record before appending —
both tracks write to it.

### Context objects

Opened 2026-08-14 out of the meeting-donor reading (ADR 0135, ADR 0136), which
found a gap rather than a feature: **ADR 0045 declared one object with five
states and five origins on 2026-08-03, and no track ever built it.** What exists
is a ported drawing over a fixture, and every route into that object was filed
either as a roadmap candidate or as a step in somebody else's sequence.

Owns ADR 0135–0149. The first two were written before the track existed, out of
the speech track's donor reading, and are filed here because they are about this
subject rather than about a lane.

**It is named for the object and not for meetings on purpose.** The meeting is
one origin of five and the only one behind a capability gate; a track called
*meetings* would file four unblocked origins behind the blocked one.

The seam with the **Speech** track is the one to keep straight: that track
answers *where a job runs and what it can do*, this one answers *what the job
produced*. Speech-track C1, C4 and B7 are requirements here, not duplicates.

Stage E is blocked on roadmap gate 3 (system audio without a per-session
prompt). A through D are not blocked by anything.

### Activation gestures

The only forward-looking document that is not a running track: why one set of
shortcut defaults cannot serve three activation modes, the three capability gaps
that block a per-mode gesture, and the decisions still owed. Nothing is built.
It is listed here so it stops being invisible, not because it is scheduled.

## Sharing `main`

Three tracks work in one tree with no branches. The rules that come from that,
learned the expensive way:

- **Run `git status` and `git log --oneline -5` before you start.** Another
  track's uncommitted prose may be sitting in a document you are about to write
  to. Leg 12 committed only `src/` for exactly this reason, and its
  documentation then sat in the tree for a leg.
- **Stage your own paths. Never `git add -A`.** Whoever commits a file next
  carries whatever else is in it.
- **Never trust a "next free ADR number" written on a page.** Grep the whole
  tree, not just [`decisions/`](decisions/) — a number gets cited in source and
  in a commit message before its file lands. The relay's rule 3 carried a stale
  `0060` for sixty-three records.
- **A test count is a shared measurement.** A step that changes one says by how
  much and why. A count that moved because another track landed is that track's,
  and saying so is the difference between a baseline and a guess.
- **A documentation stage that moves a test count has done something it did not
  say it would.** Prove the suite did not move rather than that it passes.

## Where the sequence for a whole release lives

The tracks are how work is done; they are not what the product owes. That is:

- [`ROADMAP.md`](ROADMAP.md) — the V1 phases, in order, with their gates. The
  canonical phase detail.
- [`STATUS.md`](STATUS.md) — what works today and what is open.
- [`spec/SPEC.md`](spec/SPEC.md) — the authoritative contract. When an overview
  document disagrees with it, the overview is the one that drifted.

A track is not a phase. The speech track spans ROADMAP Phases 4 and 5; the GUI
port is the second half of Phase 7; core hardening serves Phase 1's promise
after Phase 1 closed.

## Closed tracks

Their sequence documents, records and spent briefs are in
[`archive/`](archive/README.md):

| Track | Ran | Outcome |
| --- | --- | --- |
| Settings surface rework (as a plan) | 2026-07 → 2026-08-04 | Spent as an instruction; kept as the derivation of why the surface is shaped the way it is. Superseded by the GUI port relay |
| UI/UX overhaul | → 2026-07-25 | The implemented UI direction and its enduring rationale. Current rules moved to [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) |
| GUI rework, third pass | → 2026-08-04 | Superseded by the GUI port relay |
| Capture shortcut lane rebuild | merged 2026-07-25 | The shortcut contract (S0–S8) and the invariants it established |
| Documentation realignment | 2026-07-24 | Established the current documentation set and American English throughout |
