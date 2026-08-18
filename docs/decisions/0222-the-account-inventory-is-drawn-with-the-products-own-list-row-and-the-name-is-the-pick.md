# 0222 — The account inventory is drawn with the product's own list row, and the name is the pick

Date: 2026-08-18
Status: accepted. Completes
[ADR 0220](0220-the-account-inventory-is-a-list-creating-one-asks-who-it-is-with-and-assigning-one-happens-where-the-jobs-are.md),
which made the card an inventory and drew it in a grammar of its own.
Track: Speech (B24)

## Context

The owner reported on 2026-08-18, with a screenshot of the Accounts card: *die UI
von AI Models und Accounts muss ein bisschen schön gemacht werden. Die
Breakpoints sind nicht so schön anzusehen und nicht so intuitiv zu bedienen.*

**The breakpoints are not what is wrong, and ADR 0220 had already measured
that.** At the 625 CSS px this workspace renders — a display-scale fact about the
reporting machine — the settings column is 379 px, so every row is stacked
already. That record's own words: *stacking is the right answer to a narrow
column and the wrong answer to five controls.* The tier was correct then and is
correct now.

**What is wrong is that the inventory ADR 0220 built is not the product's list.**
That record fixed the fault that one account was visible and one was a
derivation, and it built the replacement out of `ws-stack ws-gap2` — so the card
got its list and the list got a grammar nothing else on the machine uses. Read
off the owner's screenshot, that costs three things:

- **No rule between two accounts.** `ws-gap2` is the gap INSIDE an entry as well
  as between two of them, so Groq and OpenAI run together and where one account
  ends cannot be read.
- **A filled primary button for the picked account.** That is the weight of the
  single strongest action on a screen, spent on *these rows below are about this
  one*. An account read as a call to action while its unpicked neighbour read as
  prose — two accounts drawn as two different kinds of object. It is the same
  fault `.ws-badge`'s *tinted, not filled* note names one screen over.
- **Three stacked lines per account**, two of them chrome: Rename and Remove as
  labelled ghost buttons, permanently on show, on a line of their own.

## Decision

**Each account is a `ListItem` in a `ListRows`** — the row History, Profiles,
Targets, Notes and Uploads already use. Hairline between entries, the card's
inset, name over meta, badges in the fixed right-hand column, actions as icons.
The three facts ADR 0220 asks to be visible at once are exactly its `title`,
`meta` and `badges` slots, so nothing about this row is new except the pick.

`ListItem` gains two optional slots for it, and both are the general shape rather
than a special case for this card:

**A pick.** The title becomes a `<button>` carrying `aria-pressed`, because what
the reader is choosing IS the thing named — which is what the replaced row's own
comment argued and then drew at the wrong weight. A radio would be the right
drawing for a setting with N mutually exclusive values, which is what `LaneCard`
is for; this is disclosure. It is a button INSIDE the item rather than the item
being one, which is what lets the row's own actions exist at all.

**A foot.** A full-width line under the row, beneath the badge column and the
actions rather than beside them. `preview` is a sample — one line of a
transcript, truncated, because the record it samples is one click away. *Used by
General writing, Customer success replies and 3 other profiles* is a fact read
immediately BEFORE pressing Remove: rotating this key touches everything named
there. It may not be cut, and it may not live in the text column either.

**The mark is the name, and the ground only locates it.** `--accent-soft` is the
badge tint at 16% of the accent; across a whole row it renders as a solid warm
slab, louder than the filled button it replaced and reading as a warning band.
The system's own answer to the same question is
`.ws-lane-row[aria-checked="true"]`, which tints a 30 px tile and never the row.
There is no tile here, so the accent goes on the name and the ground drops to 5%.
No edge bar: a rule down the left of a row is the accent stripe this system
refuses everywhere else.

**Rename and Remove name their account.** `Rename Employer`, not a second button
called `Rename`. The replaced row's docblock asked for this in writing — *two
accounts on one vendor make every control in here ambiguous by name … an
assertion that has to guess which one it pressed is the same guess a reader
makes* — and did not do it.

## What the measurement changed

The card was rendered in isolation at the 379 px column before any of this was
called finished, and three of the first draft's decisions did not survive it:

1. The `--accent-soft` ground, above.
2. **The used-by sentence was in `preview`.** Allowed to wrap there it took five
   lines, because the fixed 108 px badge column and the actions leave the text
   column about 170 px — one account taller than the two below it together. That
   is what the `foot` slot exists for.
3. **A list nested in a stacked `Row` pays `--pad-card` twice.** `.ws-row`
   (`shell.css:225`) and `.ws-list-item` (`shell.css:4086`) both spend it, and
   `Row` renders a stacked child directly under `.ws-row`. `.ws-grp` states the
   identical rule one container over (`shell.css:2858`) for the identical
   reason, and this copies it.

**Point 3 is derived from those three rules and not measured**, and the record
says so rather than implying otherwise: the isolated harness parses `shell.css`
incompletely — it reported no `.ws-row` padding at all — so it is not evidence
either way. It is what this record owes a reading in the native host.

## Consequences

- **`port:diff` did not move.** `models` measures `65 | 281 | 33`, ADR 0216's
  recorded triple, because nothing in the inventory renders without a runtime.
  `ledger` — the screen most full of `.ws-list-item` — measures **`style 0`**,
  which is the evidence the new rules reach nothing that already existed.
- Five cases named the ambiguous `Rename` / `Remove` and were rewritten to name
  their account rather than deleted. One case was added, holding the row to
  `.ws-list-item` inside `.ws-list` and the pick to ground plus `aria-pressed`
  rather than to a filled button — so a regression to a hand-rolled stack fails
  rather than passing quietly, which is what ADR 0216 found `port:diff` alone
  cannot do.
- `ListItem`'s two new slots are optional and default to absent, so every
  existing caller renders the same DOM it did.

## What this does not do

**It does not touch the breakpoint tier**, for ADR 0220's reason, restated
because it is the thing the report asked for and the thing that is not wrong.

**It does not make the inventory a `LaneCard`.** That component is a radiogroup
whose row IS the button, which leaves nowhere for Rename and Remove to live —
and a lane is a setting with mutually exclusive values, where this is a
disclosure.
