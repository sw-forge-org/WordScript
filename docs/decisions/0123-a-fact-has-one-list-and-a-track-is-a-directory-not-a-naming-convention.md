# 0123: A fact has one list, and a track is a directory rather than a naming convention

Date: 2026-08-12

Status: Accepted

## Context

The documentation set reached 208 files and 43,196 lines, and the owner's report
was that **the implementation track could no longer be made out** — not that any
one document was wrong, but that nothing said which work was running.

Four things were true at once.

**There was no index.** `docs/` had no `README.md`. In its place, five documents
each carried their own list of the documentation set — `README.md`,
`docs/REFERENCE.md`, `docs/DEVELOPMENT.md`, `AGENTS.md` and the sub-READMEs —
and they disagreed. `REFERENCE.md` was the only one still naming
`docs/templates/`; `DEVELOPMENT.md` did not name `PROVIDERS.md` at all.

**There was no board.** Three tracks were running concurrently on `main` — the
GUI port relay at Leg 13, core hardening at its third pass, the speech track in
Stage B — plus a fourth intake landing model-catalogue work. The only place that
said so was a prose paragraph in `docs/handoffs/README.md`. Nothing stated which
track owned which ADR range, what stage each was at, or what blocked what.
`PLAN_speech-track-implementation.md` did exactly this for one track, which is
what made its absence for the other two visible.

**`docs/handoffs/` held four unrelated kinds of document**: three live track
documents, nine spent leg kick-off pages that nothing linked to, nine closed
historical records, and two explicitly superseded ones. The folder was named for
a convention (`HANDOFF_`, `KICKOFF_`, `PLAN_` prefixes) rather than for a
lifecycle, so nothing about a file's name said whether it was live.

**The relay had grown to 6,081 lines**, of which about 2,400 were leg briefs
marked *spent — kept for the chain's record* and another 2,600 were closed leg
records. It is the first page a new leg reads. Its own header had said "Leg 6 is
CLOSED, Leg 7 is next" for six legs after Leg 7 closed, and its rule 3 had named
`0060` as the next free ADR number for sixty-three records.

The duplication was not cosmetic — it had already produced wrong statements.
`STATUS.md` carried its own phase list showing six phases while `ROADMAP.md`
carried nine; Phases 7, 8 and 9 were missing from it entirely. The speech plan's
status table listed C3 as *not started* eleven paragraphs after the step itself
recorded **Done 2026-08-12**.

## Decision

**A fact has exactly one list, and every other mention is a link.**

- The documentation map is `docs/README.md`. The four other copies are replaced
  by pointers.
- The phase list is `docs/ROADMAP.md`. `STATUS.md`'s copy is removed; `VISION.md`
  stops naming the phases in prose.
- The track state is `docs/IMPLEMENTATION.md`, which is new: what is being built
  right now, by which track, at what stage, owning which ADR range, and the
  rules for sharing one tree between concurrent tracks.

**A document's directory states its lifecycle, and the name carries no
convention.**

- `docs/tracks/` holds only tracks that are still running. Files are named for
  their subject, in kebab-case like the rest of the tree — the `HANDOFF_`,
  `KICKOFF_` and `PLAN_` prefixes are dropped.
- `docs/archive/` holds closed tracks, spent plans, spent briefs and closed
  hand-off records. Moving a document there is what closing a track means.
- A track keeps **one** live kick-off page at a stable filename, overwritten
  when a unit closes, rather than a numbered pile beside it.

**A chain document keeps only what the next session needs.** The relay keeps its
rules, a complete leg-log index, the four most recent leg records and the open
brief; closed records, spent briefs and spent kick-offs move to the archive.
Four is the depth the briefs themselves reference.

**Links are corrected across the whole tree, including inside ADRs.** The
append-only rule protects a record's reasoning, not the resolvability of a path
it cites; a citation that no longer resolves is not the record its author wrote
either. `docs/prototypes/` is the exception and keeps its original citations,
because ADR 0055 makes it read-only and it is provenance rather than reference.

`docs/templates/` is deleted. Each of its four files stated in its own header
that WordScript does not use it.

## Consequences

- `docs/` goes from 208 files to 190, and from no index to one. The relay goes
  from 6,081 lines to 877 with nothing deleted.
- **Two contradictions were found by doing this rather than by reading.**
  `STATUS.md`'s phase list was three phases behind; the speech plan called a
  finished step *not started*. Both are corrected.
- **One commit was found to belong to no leg.** `b330815` — the sidebar's second
  width, ADR 0111 — landed on 2026-08-11 while Leg 13 was open and is neither of
  its two items. It is now recorded as unattributed on the relay rather than
  silently absent, and Leg 13's close has to resolve it.
- Nine spent kick-off pages become one archive document. They were orphans;
  nothing in the tree linked to any of them.
- A future track pays a cost the previous ones did not: it must state its ADR
  range on the board, and it must move its documents when it closes. That is the
  price of the board being true.
- This does not change any runtime contract. Six source files change one comment
  each, all of them a documentation path.
