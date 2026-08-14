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
  most recent leg records, and the open leg's brief. **Leg 13b is open** — Leg 13
  split on 2026-08-14 when its first item, the caller sweep, closed as 13a.
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
- [`speech-track.md`](speech-track.md) — stage one's account: the six findings
  the later stages are built on, and what a review of its own first pass found
  false in it. Not updated by later work.
- [`runtime-ownership.md`](runtime-ownership.md) — opened 2026-08-13 as
  *measurement integrity*, renamed and re-scoped the same day. `CLAUDE.md` gives
  the runtime trigger, capture, transform, **insert** and recovery; it does not
  own the insert, and the instruments cannot see where it does not. Step 1 is
  silent data loss — a finished dictation is discarded when its window does not
  come back, because the session's completion is an `invoke` from the overlay.
  Seven steps; 1, 2, 3, 5 and 7 are unblocked. Both the orientation page and the
  sequence. **Shares `capture-loses-half-the-recording.md` with core hardening** —
  that track holds the loss, this one holds the instrument.
- [`context-objects.md`](context-objects.md) — opened 2026-08-14, nothing built.
  ADR 0045 declared one object with five states and five origins; no track built
  it, and the drawing sits in `src/screens/Context.tsx` over a fixture. Five
  stages: the object on disk, the four tabs over real data, the three ways in,
  retention, and the meeting behind roadmap gate 3. **Named for the object and
  not for meetings** — the meeting is one origin of five and the only gated one.
  Both the orientation page and the sequence.
- [`activation-gestures.md`](activation-gestures.md) — open, nothing built. Why
  one set of shortcut defaults cannot serve three activation modes, and the
  decisions still owed.

## Convention

- **A track's sequence is a living document**; its records are append-only.
  Do not edit a record to match what happened later — file the correction where
  the sequence carries state.
- **A kick-off page is spent when its unit closes.** Overwrite the live one; the
  spent ones are collected in the archive, not kept as a numbered pile.
- **A track states which ADR range it owns** on the board, so a concurrent track
  can tell whose number a citation is.
- **Give a new track a descriptive filename**, never a version suffix.
