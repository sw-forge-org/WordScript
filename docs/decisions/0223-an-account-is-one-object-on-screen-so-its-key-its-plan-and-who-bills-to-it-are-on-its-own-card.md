# 0223 — An account is one object on screen, so its key, its plan and who bills to it are on its own card

Date: 2026-08-18
Status: accepted. Completes
[ADR 0208](0208-a-connection-is-an-object-a-profile-points-at-so-the-account-moves-with-the-profile.md)
on the surface, and **reverses one half of**
[ADR 0220](0220-the-account-inventory-is-a-list-creating-one-asks-who-it-is-with-and-assigning-one-happens-where-the-jobs-are.md)
and one half of
[ADR 0222](0222-the-account-inventory-is-drawn-with-the-products-own-list-row-and-the-name-is-the-pick.md).
Track: Speech (B25)

## Context

The owner read the shipped AI Models screen and reported, in one breath: the
provider chips at the top do nothing when clicked, so the reader concludes the
clicks have no effect; adding an account shows no logos while the logos that ARE
shown cannot be picked; the API key sits under the account list and reads as one
key that applies to every account on the machine; *This profile bills to* sits
far below instead of being integrated into the account card at the top;
changing a provider low on the screen changes the logo card at the top; and the
sentences are too long throughout. Their summary: **the screen never makes clear
which thing is which.**

**All seven check out against the code, and they have one cause.** ADR 0208 made
an account an object. The surface kept that object in four pieces:

| Fact about one account | Where it was drawn |
| --- | --- |
| Which vendor it is with | a chip row at the top of the screen |
| Its name | a row in a list under that |
| **Its API key** | a `Row` **beside** the list, not inside an entry |
| **Its plan** | the next `Row`, same place |
| Which profiles bill to it | a `Select` in a different `SectionHeader` |

Two of those are worth stating precisely, because the code makes them exact
rather than impressionistic:

- **The chip row was inert by design.** `ProviderChips` received
  `onChange={wiredHere ? undefined : setDrawnValue}` — under a runtime, nothing.
  ADR 0220 did that deliberately and for a good reason (pressing a chip used to
  create an account AND repoint the profile on one press). The result is a row of
  logos that accepts a click and does nothing, which is ADR 0067 rule 1's false
  affordance arrived at from the safe end. And because its `value` followed the
  account the list had open, changing an account low on the screen moved the
  marked chip at the top — the "spooky" behaviour in the report.
- **The logos were on the one control that could not be used**, while
  `AddAccountPanel` — the one place a vendor is actually chosen — asked with a
  plain text `<Select>`. Recognition on the inert thing, prose on the live one.

## Decision

**Every account this machine holds is one card, and the card carries everything
about that account.** Header: a `role="radio"` strip with the vendor mark, the
name, and the key state. Body: that account's own key, plan, or — on the
self-hosted lane — URL, reachability and token. Foot: who bills to it, Rename,
Remove.

`CloudCredentialRows` and `SelfHostedRows` both already took the account they
configure (that was ADR 0209's fix), so this is a **move** rather than a rewrite,
which is why a change this large is mostly deletion.

**The lane is gone from this card.** It grouped the list, so a card headed *what
this machine holds* showed a quarter of it and two of its four segments were
disabled. Every account is here, on every lane; its lane is legible from its mark
and from the rows it carries. What cannot hold an account yet — Local,
Enterprise — is `LockedLanes` under the list, which already carried one row and
one reason per lane. `lane` is still what the job rows read and is now **derived**
from the account the profile bills to, so it follows the config instead of being
state a segment set.

**The pick is the assignment, and there is only one pick now.** There were two
selections on this screen: which account the key rows were open on, and which
account the profile bills to. The first existed only because the key rows were
outside the accounts; with every card carrying its own, it has nothing left to
answer. The radio writes `providers.default`.

**The chips moved into `AddAccountPanel`**, where pressing one means something —
and it still does not assign, which is the rule ADR 0212 established and every
drawing since has had to carry. They list every vendor the drawing names, not
only the ones with an adapter, so *why can I not make an Anthropic account* is
answered rather than hidden; that is ADR 0124's rule and a first draft of this
panel lost it.

**The capability sentence moved onto the card** and prints only where it is a
LIMIT. *Speech and language* on a vendor that does both is furniture on a screen
the owner has just called too wordy.

## What this reverses, and why the reversed records were not wrong

**ADR 0220 moved the assignment OUT of this card**, on the argument that *which
account a profile bills to is the head of what runs what, not a select inside the
card that lists what the machine holds*. The argument is sound and the drawing it
produced was not: a reader cannot see what an account is FOR without it. The row
at the head of *What runs what* stays and **states** — the job rows below say
*follow the profile*, and a reader has to be able to see what that resolves to —
but it no longer sets, because two controls over one field is what
[ADR 0123](0123-a-fact-has-one-list-and-a-track-is-a-directory-not-a-naming-convention.md) is about.

**ADR 0222 made the account a list row**, one day before this. That is not
reversed so much as outgrown: 0222 fixed a drawing with no separators and a
filled primary button for the pick, and both fixes survive here. What a list row
has nowhere to put is the account's own settings, which is the whole of this
record.

## Consequences

- **`port:diff` moved, deliberately**: `models` goes `65 | 281 | 33` (700 nodes)
  → `178 | 276 | 33` (665 nodes). This is the second deliberate structural
  divergence from the prototype on this screen after ADR 0216's, and it is
  recorded rather than avoided: the prototype draws a lane segment over a chip
  row over a credential block, and this build does not. `models#1` is unmoved at
  `262 | 30 | 17`, and `ledger` at `style 0`.
- **Thirty-three cases moved and none was deleted silently.** Each was rescoped
  to a card, rewritten to the new subject, or retired with the reason named.
  Three retired: the drawn chip row, the chip row that stated-without-writing
  (which this record removes on purpose), and ADR 0162's Local-lane row count —
  Local has no card now, so the duplication it guarded against is impossible
  rather than watched for. Frontend 876 → 875; the one net loss is that retirement.
- **The radio drew empty on both cards until a render caught it.**
  `.ws-radio::after` was keyed to `.ws-lane-row[aria-checked]` alone, so the one
  element that states the pick said nothing. Third defect in three days found by
  looking at the screen after the suite was green, and the third that no
  assertion would have caught.

## What is still owed

**The copy pass is started and not finished.** The owner's report — **the
sentences are far too long and far too laboured** — is about the whole screen;
the account card's own strings were cut and the job rows below were not. It is
its own sweep, with that sentence as the test.

**The insets are derived and not measured.** `.ws-acct-head` is exempted from the
card guard on the same reasoning ADR 0222 used for `.ws-list`, and neither has
been read in the native host — the isolated harness parses `shell.css`
incompletely and is not evidence about layout. One screenshot settles both.
