# 0156: A readout names a rule with the reader's own words, and an id it cannot resolve stays an id

Date: 2026-08-15
Status: Accepted

## Context

The panel plane — `EditorPanel`, `ConfirmPanel`, `FlagPanel`, `AnswerPanel` and
the row menu (ADR 0082, ADR 0085) — is the surface the GUI port **designs**
rather than carries: the prototype draws no editor and no answer anywhere. It
is also the only row class no instrument had ever reached. Leg 11 built the row
instrument for ADR 0092 and Leg 12 rebuilt it; both walked views, sections,
sub-tabs and `<details>` jobs, and neither ever opened a panel, so
`.ws-edit-question`, `.ws-edit-issues p` and `.ws-flag-what p` returned zero
samples — not because they were clean but because nothing on the walk rendered
them.

Leg 13b's instrument opens them. Measured in the native host at **800 × 608 CSS
px, `devicePixelRatio` 1.25** — the window Leg 12 recorded, and the window this
plane is normally read at — across every panel Profiles can open: 55 samples,
six sub-tabs, both answers, the head menu and the row menus.

**The plane is at most two lines everywhere, except one node.** Two lines is
the drawing's norm (ADR 0092), `.ws-edit-note` sits at exactly that with 50–59
characters in a 249 px column, and every question, label and issue line draws
one. The exception is the answer panel's foot, and its content is the reason:

```
dictionary:curated-founder-ops-dict-wordscript      4 lines in a 241 px foot
```

That is one fired rule, printed under a comment reading *"THE RULES THAT FIRED,
BY NAME"*. `transform.rs`'s `rule_label` returns the entry's **id** whenever an
entry has one and only slugifies the phrase when it does not, so
`preview.applied_rules` is a list of `dictionary:<id>` and `snippet:<id>`, and
the screen printed it verbatim. It is **a comment asserting a control**
(ADR 0090) one plane below where Leg 12 found the last one, and it is
ADR 0092's defect class turned around: there the row printed the string its own
control's width was set by; here the readout prints an identifier that was never
meant for a reader, and the width is the consequence rather than the cause.

**The width is not the fault and shortening the id would not have fixed it.**
The same panel measured at a 992 px window draws the same string on one line,
because the owner widened the window mid-measurement — which is the second
finding: this plane's text column is **241–292 px**, the narrowest on the
surface, well below the 436 px ADR 0092 measured for a stacked row, and it
changes with the pane rather than with the window alone.

## Decision

**A readout names a rule with the words the reader wrote, and prints an
unresolvable id unchanged.**

- `dictionary:<id>` is drawn as the entry's **phrase**, `snippet:<id>` as its
  **label, or its trigger when the label is empty** — the same identity the
  row's own delete question uses (*Delete the replacement for "p and l"?*), so
  one rule is called one thing on this screen.
- **An id with no entry behind it is printed as it came.** The analysis is a
  request over a draft, so a rule can fire from an entry that is no longer in
  the profile being read. Inventing a name for it — de-slugging the id, or
  calling it "a deleted rule" — is exactly the fluent-and-wrong this
  cluster exists against, and the id at least names something greppable.
- The join lives on the screen that holds the entries. **No runtime change**:
  the ids are the runtime's correct answer to a different question, and
  `applied_rules` is also read by the overlay and the history, where an id is
  what is wanted.

## Consequences

- **The comment is now true**, and the fix was verified in both directions: the
  new case in `Profiles.test.tsx` fails against the old code with the exact
  string the native host produced — `dictionary:d1 · snippet:s1 ·
  dictionary:gone-with-another-profileClose` — and passes with the join.
- **The panel plane has a measured text column for the first time**: 241–292 px,
  and the numbers are in the Leg 13b record. A copy budget written for this
  plane is quoted against that, not against `Card`'s 436 px.
- **The instrument manufactured a finding before it measured one, for the third
  time in this repository.** Its first line count read `height / line-height` on
  a box with padding and a border, and reported a one-line foot as two. Leg 11
  and 12 measured `.ws-row-hint`, which has neither, so the arithmetic they
  handed down was right for their class and wrong for this one. It is corrected
  to the content box, and it was calibrated against a known short and a known
  long string before any number out of it was believed.
- **A conditional width is priced by cloning, never by resizing the window.**
  The owner widened the window between two runs, so the narrow case is measured
  by cloning the node into a 241 px box — ADR 0092's technique, and the reason
  the finding survives a window that has since changed size. The geometry itself
  stays ADR 0100's.
