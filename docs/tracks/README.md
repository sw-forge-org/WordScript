# Live implementation tracks

**Only tracks that are still running live here.** When a track closes, its
documents move to [`../archive/`](../archive/README.md) and its row moves to the
closed table in [`../IMPLEMENTATION.md`](../IMPLEMENTATION.md).

The board — which track is at which stage, and the rules for sharing `main` —
is [`../IMPLEMENTATION.md`](../IMPLEMENTATION.md). This page is only the
contents of the directory.

## Contents

- [`gui-port-relay.md`](gui-port-relay.md) — the GUI port's chain document: the
  two decisions it rests on, the rules every leg obeys, the leg log, the four
  most recent leg records, and the open leg's brief. **Leg 14 is open** — Leg 13
  split on 2026-08-14 and both halves closed: 13a the caller sweep, 13b the
  panel plane.
- [`gui-port-relay-kickoff.md`](gui-port-relay-kickoff.md) — the page you paste
  into a fresh session to start the open leg. It is orientation; the brief is
  the relay's `## The prompt for Leg N` section. **Replace this file when a leg
  closes** rather than adding a numbered one beside it.
- [`core-hardening.md`](core-hardening.md) — the third pass on the invisible
  failure cluster. Both the orientation page and the sequence.
- [`speech-track-plan.md`](speech-track-plan.md) — the speech track's sequence:
  seven stages from the runtime contract to the conversation surface, each step
  carrying what it requires, what it touches, what validates it and what *done*
  observably means. Its `## Status` table is the state of the track. **This is
  the page a speech session starts on.**
- [`connection-per-profile-kickoff.md`](connection-per-profile-kickoff.md) — the
  page you paste into a fresh session to start the speech track's **B14**, where
  the last machine-wide half of a connection — the server's URL and the
  credential — moves onto the profile that uses it. Orientation only; the brief
  is B14 in the plan, and the one design decision it opens is the owner's to
  confirm.
- [`speech-track.md`](speech-track.md) — stage one's account: the six findings
  the later stages are built on, and what a review of its own first pass found
  false in it. Not updated by later work. **Its H1 still reads *Kick-off*,
  because it was one when it was written and a record is not retconned** — the
  classification is this line and the dated addendum at its head, not the title.
- [`runtime-ownership.md`](runtime-ownership.md) — opened 2026-08-13 as
  *measurement integrity*, renamed and re-scoped the same day. `CLAUDE.md` gives
  the runtime trigger, capture, transform, **insert** and recovery; it does not
  own the insert, and the instruments cannot see where it does not. It opened on
  silent data loss — a finished dictation discarded when its window did not come
  back, because the session's completion was an `invoke` from the overlay — and
  that is step 1 (ADR 0134). Its step state is the track's own `## Status` table
  and the board; this line does not restate it (ADR 0123). Both the orientation page and the
  sequence. **Shares `capture-loses-half-the-recording.md` with core hardening** —
  that track holds the loss, this one holds the instrument.
- [`context-objects.md`](context-objects.md) — opened 2026-08-14, nothing built.
  ADR 0045 declared one object with five states and five origins; no track built
  it, and the drawing sits in `src/screens/Context.tsx` over a fixture. Five
  stages: the object on disk, the four tabs over real data, the three ways in,
  retention, and the meeting behind roadmap gate 3. **Named for the object and
  not for meetings** — the meeting is one origin of five and the only gated one.
  Both the orientation page and the sequence.
- [`home-activity.md`](home-activity.md) — opened 2026-08-16. Home opens on a
  drawing of a keyboard, and an instruction is read exactly once. Its opening
  block became either an activity calendar or four counter tiles, on the same
  dot-matrix palette as the readout, with the reader choosing. **Stage A is
  closed, A1 to A11.** Stage B is four things other tracks owe, three still
  open. **Stage C opened 2026-08-17 from an owner brief and is unblocked in
  full** — the calendar's left arrow and two marker days, Home's turnaround unit
  and its standing-facts line, and the dictation list Home and History share.
  Two of its rows reverse a standing ADR and say so. Both the orientation page
  and the sequence.
- [`activation-gestures.md`](activation-gestures.md) — open, nothing built. Why
  one set of shortcut defaults cannot serve three activation modes, and the
  decisions still owed.
- [`v1-release.md`](v1-release.md) — opened 2026-08-17. **A measuring
  instrument, not a build queue.** One question: can somebody who did not build
  WordScript get it, install it and dictate with it. Thirteen gates with a state,
  a last-measured date and the command that re-reads each one — three of them
  measured as *not started* rather than assumed, and three that the runbook's
  own gate list does not carry at all. The gate list moves here from
  [`../RELEASE_RUNBOOK.md`](../RELEASE_RUNBOOK.md), which now links to it. **One
  gate it closes with its own hands**: Developer Mode, the runtime preview
  filter behind one registry. Both the orientation page and the sequence.

## Convention

- **A track's sequence is a living document**; its records are append-only.
  Do not edit a record to match what happened later — file the correction where
  the sequence carries state.
- **A kick-off page is spent when its unit closes.** Overwrite the live one; the
  spent ones are collected in the archive, not kept as a numbered pile.
- **A track states which ADR range it owns** on the board, so a concurrent track
  can tell whose number a citation is.
- **Give a new track a descriptive filename**, never a version suffix.
