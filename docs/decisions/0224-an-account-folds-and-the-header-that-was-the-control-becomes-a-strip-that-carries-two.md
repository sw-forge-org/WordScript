# 0224 — An account folds, and the header that was the control becomes a strip that carries two

Date: 2026-08-18
Status: accepted. Completes
[ADR 0223](0223-an-account-is-one-object-on-screen-so-its-key-its-plan-and-who-bills-to-it-are-on-its-own-card.md),
which made every account a card and left the card no way to close.
Track: Speech (B26)

## Context

The owner reported on 2026-08-18, in the same breath as the title defect
ADR 0225 answers: **individual accounts should fold open and shut, and that is
missing — past some number of accounts the screen stops being surveyable.**

**It is ADR 0223's own cost, arrived at from the direction that record could not
see.** That step moved the key, the plan, the endpoint, the token and the
used-by line INSIDE the account they belong to, which is what stopped a key from
reading as one key for the whole machine. Every one of those rows is right where
it is. What none of them can do is be absent — so the card that made an account
one object also made an account 300 px tall, and three accounts a screen.

**Measured on the reporting machine's own config**, in the real app at the
625 CSS px this workspace renders at, with the owner's three accounts (Groq,
OpenAI, a server):

| | list height | per card |
| --- | --- | --- |
| Every card open, which is ADR 0223's state | **1217 px** | 323 / 311 / 560 |
| Only the billed one open | **434 px** | 323 / 44 / 44 |

A folded account is 44 px. The three facts B17 asked to be visible at once —
whose it is, what vendor it is with, whether it holds a key — are all in those
44 px, because they are the header's and the header is what stays.

**And the header was a `<button>`.** ADR 0223 made the whole naming strip the
radio, on `.ws-lane-row`'s pattern, which is right for *bill this profile here*
and leaves nowhere to put a control that acts on the same card. It is the rule
`ListItem`'s own pick states one component over: *a row-wide button cannot hold
the buttons that act on the row.*

## Decision

**The header is a strip that carries two controls and is neither of them.**
`.ws-acct-pick` is the radio — the mark, the name, the vendor, `role="radio"`,
`aria-checked` — and takes the card's left inset itself, so the hit area still
reaches the card's edge. Beside it sit the key badge and `.ws-acct-fold`, an
`IconButton` carrying `.ws-disc`'s own chevron and its quarter turn, named after
the account it folds (`Expand Employer`, never a fourth button called *Expand*).

**Open is a set, and it starts as the account the profile bills to.** Not an
accordion: two accounts on one vendor exist precisely so their keys can be
compared, and closing the first to open the second would refuse the comparison.
Billing an account opens it and closes nothing.

**It is screen state and not a setting.** Which card somebody left open is not a
fact about the machine, and writing it into the config would put a disclosure
into a file two runtimes read. Coming back to *the one you bill to* is the same
resting state every time.

## Consequences

- **A collapsed card keeps neither the rule under its header nor the card's
  bottom inset.** A hairline with nothing beneath it reads as a stray edge —
  `.ws-disc`'s own note, one section up — and `--pad-card` under a single line is
  dead ground. Both are `:not([data-open])` rules and both were seen in the
  render, not reasoned about.
- **The gallery twin had to move with it, and `port:diff` is what said so.**
  `DrawnAccountCard` kept the single-element header, so it lost the strip's
  padding to a class it does not have — 18 style differences, which measuring
  attributed to the drawing rather than to the product. The drawn card carries
  the split now, and the two extra spans are the whole of the structural move
  from 178 to 182.
- **Seven cases reached into a card that is now folded, and all seven were
  moved rather than deleted** — each one opens the card first, which is what a
  reader does. `openAccount` is the one helper that does it. **+1 frontend
  (876)**, the case that holds the resting state and holds the fold apart from
  the pick.

## What the same step settled, and it is B25's own handover

**The insets are measured now.** ADR 0222 and ADR 0223 exempted
`.ws-row > .ws-list > .ws-list-item` and `.ws-acct-head` from `.ws-card`'s inset
by derivation from two rules, and the handover recorded that the isolated
harness could not settle either — it parses `shell.css` incompletely and reported
no `.ws-row` padding at all. Driving the REAL app answers it. At 625 px:

- `.ws-acct-head` computes `0px 16px 0px 0px` and starts 1 px from the card's
  edge — its own border — so the hairline reaches both edges and the inset is
  paid once. Every `.ws-row` inside the account card computes `padding-left:
  16px` at the same offset as every `.ws-row` in a card that was never in doubt.
  **The exemption is right.**
- `.ws-row > .ws-list > .ws-list-item` **matches nothing**, and it is removed.
  ADR 0223 took away its only subject one day after ADR 0222 wrote it; every
  `ListRows` in the product — Home, History, Agents, Notes, Profiles twice — is a
  direct child of its card. A rule matching nothing reads as a live invariant to
  whoever finds it next. `.ws-grp` states the same thing for the container that
  does have subjects and stays.

**And the copy sweep is done**, which is the half ADR 0223 did not finish. The
owner's test is their own report — **the sentences are far too long and far too
laboured, and a new user cannot work out how any of this functions** — and the
rule applied is the handover's: lead with the control's own
answer and drop the second clause, never delete the derivation the reader needs
once. Twenty-two strings across *What runs what* and the job rows under it.
Three of them also stopped saying *the connection* about an object the product
has called an account since ADR 0208.

`port:diff` moves and the move is attributed rather than assumed, by putting the
long copy back and re-measuring: with it, `models` reads `182 | 276 | 33` —
ADR 0223's own style and text figures. With the sweep it reads
**`182 | 294 | 49`**. So text +16 and style +18, and every one of those 18 is a
wrapped height or width that a shorter sentence changed. `models#1`
(`262 | 30 | 17`) and `ledger` (`style 0`) do not move.

## Alternatives considered

- **An accordion, one card open at a time.** Shortest possible list and the one
  behaviour that refuses the comparison two accounts on one vendor exist for.
- **Remember the open set in the config.** It would survive a restart and it
  would put a disclosure into the file the runtime reads, for a state nobody
  would miss.
- **Fold on the pick, so billing an account is also opening it and closing the
  rest.** One press, two meanings — the conflation ADR 0212 closed at the lane
  level and ADR 0220 closed at the row level.
