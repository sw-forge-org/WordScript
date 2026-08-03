# 0052: The item carries the inset, so the separator reaches the group edge

Date: 2026-08-04
Status: Accepted

## Context

A card in the settings surface is a group of rows with hairline separators
between them. As long as the card carried its own horizontal padding, every
separator started 20 px in from the left edge and stopped 20 px short of the
right one: twenty pixels of card above the line, twenty below, and a divider
floating between them attached to nothing. The rows read as items dropped into
a box rather than as one grouped list.

macOS runs the separator to the group's edge. That is what makes a System
Settings group read as a single object with divisions instead of a container
with contents, and it is the register the rework is aimed at.

The obvious fix — remove the card's horizontal padding — is the one that broke
the surface. The card holds more than row stacks: heads, paragraphs, footer
actions, badges. Those have no separator to run to any edge and need the inset,
so removing it from the card put them flush against the rounded corner.

The eleventh pass moved the padding onto `.row` and added a guard exempting the
stacks from the card's inset:

```css
.card > :not(.rows):not(.list):not(.lane):not(.check-list):not(.disc) {
  padding-left: var(--pad-card);
  padding-right: var(--pad-card);
}
```

Five stacks were exempted and only one of them was finished. `.row` took the
padding itself; `.list`, `.lane`, `.check-list` and `.disc` never did, so their
children had no horizontal inset from anywhere. Every list item, lane row,
check and disclosure in the prototype started flush against the rounded corner
— plainest on Home's Recent list, where the transcript text began exactly on
the card's left edge. This was the owner's first complaint against the second
pass.

## Decision

**The item carries the horizontal inset. The stack carries none. The card
exempts every stack that draws separators.**

- A row stack spans the card's full width, so its separators reach both edges
  of the group.
- Each item inside it pays `--pad-card` left and right, so its content sits on
  the same vertical line as everything else in the card.
- The card's guard lists every separated stack by class. Adding a stack that
  draws separators means adding it to that list; that is the maintenance cost
  of the arrangement and it is deliberate — the alternative is a blanket rule
  that puts heads and footers on the corner.

Three stacks joined the list for the rule rather than for a bug: `.owed-list`,
`.legend` and the type scale all draw separators, and a separator stopping
20 px short of the group is the exact shape the eleventh pass set out to
remove.

**A stack whose rows carry a ground of their own owns the vertical padding
too.** Dropping the first row's top padding works for rows because a row has no
background — the card's 20 px stands as the group's top inset and nothing
paints in it. A tinted row paints, so the same arrangement leaves 20 px of
untinted card above the first row's color and the tint reads as a band floating
inside the group rather than as one row of it. There the stack runs to the
card's edge, each row keeps its own vertical padding, and the card's
`overflow: hidden` clips the result to the corner radius.

Verification is mechanical, not visual: for each card, compare the left content
edge of every row against `--pad-card`. The measurement across all 23 screens
after the change is zero deviations, and the script is cheap enough to re-run
on any change to the guard.

## Consequences

- No screen carries an inline horizontal padding to patch a card. Three
  different ad-hoc paddings had grown in `demo.js` before this rule existed;
  they are gone, and a new one is a signal that a stack is missing from the
  guard rather than that a screen is special.
- Nothing inside a card needs to know it is at an edge.
- The density variants (`--pad-card` and `--row-py` at tight, standard and
  roomy) were tuned against the previous grammar. They still resolve
  correctly under this one, but they have not been re-judged as *values* and
  are not blessed by this record.
- A component vendored from elsewhere arrives with its own padding assumptions
  and must be re-fitted to this grammar at integration time, exactly as it must
  be re-fitted to WordScript tokens.
