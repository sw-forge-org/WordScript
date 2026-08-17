# 0199: A link in the product opens something, and an ADR number is not a destination

Date: 2026-08-17
Status: Accepted. Owner brief of 2026-08-17. Applies to `DocLink` the rule
[ADR 0067](0067-local-preview-is-treated-as-an-unpublished-provider-everywhere-it-is-offered.md)
and the port's rule 7 already applied to buttons, and supersedes the
`Open the profile` link
[ADR 0068](0068-the-communication-style-is-a-tab-in-the-profile-and-the-legend-states-its-scope.md)
specified as prose.

## Context

`DocLink` (`src/components/shell/Note.tsx`) renders `<a href="#">` with
`preventDefault()` and an optional `onClick`. Without a handler it is an anchor
that consumes the click and does nothing.

Of sixteen call sites in `src/screens/`, **one** had a handler — History's
`Privacy & Data`. The other fifteen were anchors over dead air. Seven of them
stood on surfaces mounted in the shipped settings sheet. Eight of them had an
ADR number as their link text: `ADR 0043`, `ADR 0010`, `ADR 0041`, `ADR 0045`,
`ADR 0029`, `ADR 0006`, `ADR 0030`.

The link text promised a document. The document is in this repository. The
reader is in a compiled desktop application and has no repository — so the best
case was a link that did nothing, and the honest description of it is a
reference to a file the reader cannot obtain, rendered as an affordance.

`props.ts` had already written the rule down, about a different control:

> A button that opens nothing is the fake affordance rule 7 forbids — the same
> rule that keeps the sidebar's search field unmounted while there is no command
> palette.

It was applied to buttons, to the sidebar's search field, to the nav row that
would open a fifth view, and to `ScopeTag`'s door. It was never applied to a
link, because a link reads as prose and prose is not audited as a control.

Three further findings from the same sweep:

**A note repeated its own card.** General's microphone card carries the standing
description *"A change applies to the next capture, not the one running."* A
`Note` under the same card said *"Current capture is still using \<device\>. A
new selection applies to the next recording."* Two copies of one fact on one
screen, which is the drift
[ADR 0123](0123-a-fact-has-one-list-and-a-track-is-a-directory-not-a-naming-convention.md)
is about, with
a device name as the only addition — offered mid-dictation, when the reader is
speaking and not reading settings.

**A settings fact was delivered as a footnote.** *"Set the level itself in your
system sound settings"* is the answer to "where is the gain slider". It stood in
a `Note` below the meter with a `Why not here` link after it, instead of in the
`hint` of the row it is about.

**ADR numbers had also reached prose that is not a link** — a provider tooltip,
two section banners, a preview tag, a row hint.

## Decision

**A `DocLink` without a destination does not exist.** Every call site either
gets a handler or loses the link.

**Where the destination is a surface of this application, the link is wired**
with `runtime.open`, the same door `ScopeTag` and History already use, and it is
rendered only when a runtime handed one over — absent in the gallery, where
there is nowhere to go. Five links became doors:

| Surface | Link | Opens |
| --- | --- | --- |
| General | `Open Profiles` | Profiles |
| AI Models · Rewrite | `Open Profiles` | Profiles |
| AI Models · The assistant | `Open Agents` | Agents |
| Notes & Meetings · note | `Open AI Models` | AI Models |
| Notes & Meetings · engine row | `AI Models` button | AI Models |

`NoteSettingsScreen` moves from `ScreenProps` to `PartlyWiredScreenProps` for
this and no other reason. It stays a drawn screen with its banner; what it gains
is that the two places it points at AI Models can reach it.

**Where there is no destination, the link goes and the sentence carries what it
promised.** `Why`, `How context reaches the model` and `Why not here` were
questions whose answers are one clause long, so the clause is in the sentence.

**No ADR number, plan section or track stage appears in text a user can read** —
not as link text, not as badge content, not as a parenthetical in prose. The
statement stays and is stated in full; the citation goes. The derivation stays
where it was always readable to the people who need it: the code comment above
the thing, and the ADR itself.

**Roadmap vocabulary stays.** `Preview`, `Wired in part`, `Planned for Phase 8`,
`ROADMAP Phase 5`, `V2`, `Withdrawn` are readable statements about what is built,
and marking unbuilt UI is a standing rule, not a defect. They are also the
material that moves into a developer mode later, and deleting them now would
throw away the thing that mode displays. Only the ADR number beside them fell.

**A note that repeats its card is deleted, not reworded.** The card's standing
description is the surviving copy.

## Consequences

**The prototype now says something the product does not.**
`docs/prototypes/settings-rework/demo.js` carries these notes and these dead
`docLink()` calls — lines 2697, 3746, 3812 and 4649. It is the port's source of
truth and read-only, so it keeps them. This ADR is what a later reader is meant
to find when the prototype and the screen disagree here: the product diverged on
purpose, and re-porting the note would reintroduce the defect.

`npm run port:diff` reports geometry and text differences on `general`, `models`
and `profiles` for exactly this reason. That is a recorded divergence, not a
regression, and it is the second one the port has taken deliberately.

**The exceptional microphone state stays.** *"Saved microphone is not available
right now, WordScript falls back to \<device\>"* survives the sweep. It is not a
factoid about the product, it is a fact about this machine at this moment, it
names the device the runtime will actually use, and it disappears when the
condition does. `native_capture_status` is still read, because that condition
needs to know whether a capture is running — the sweep did not orphan the
command.

**One instance of the defect is left standing and is not one.** The fictional
meeting transcript on the Context screen contains the line *"Not this week. It
needs its own ADR."* — sample content from the prototype, spoken by a fictional
speaker. It is not a control and not a claim about the product.

`ENTRY_POINT_HOLES` in `windows/workspace/ia.tsx` keeps its ADR citations. It is
data read by a test and by whoever builds those doors; nothing renders it.
