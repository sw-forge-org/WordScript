# 0226 — The accounts are the machine's, and the screen says so where it is true instead of in a paragraph

Date: 2026-08-18
Status: accepted. Withdraws the `Note` added by
[ADR 0212](0212-ai-models-is-organised-by-task-and-the-lane-is-how-accounts-are-grouped-rather-than-a-mode-the-screen-is-in.md)
and completes
[ADR 0223](0223-an-account-is-one-object-on-screen-so-its-key-its-plan-and-who-bills-to-it-are-on-its-own-card.md).
Track: Speech (B27)

## Context

The owner, on 2026-08-18, with a screenshot of the two elements circled — the
profile chip in the sheet header and the note under the tabs: *hier checkt der
User nicht ganz auf den ersten Blick, dass das Ganze profilagnostisch ist, und
die aktuelle UI-Umsetzung ist UX-technisch Bullshit.*

**They are right about the fact, and the fact is the whole finding.**
`connections` is a top-level `AppConfig` field. An account's name, its vendor,
its API key, its plan and its endpoint are the MACHINE's: every profile on the
machine reads the same list, the same keys and the same plans. Read off the code
rather than estimated:

| On the screen | Scope | Where the value lives |
| --- | --- | --- |
| Name, vendor, rename, remove | machine | `AppConfig.connections[]` |
| API key | machine | OS secret store, keyed by `connection.id` |
| Account plan | machine | `connection.plan` |
| Server URL, token, model id | machine | `connection.base_url` / `.model` |
| **Which account is picked** | **profile** | `providers.default` |
| Job override *Runs on* | profile | `providers.overrides{}` |
| Model per job | profile | `providers.models{}` |

**Seven of the eight facts on an account card are the machine's.** The eighth —
the radio — is the profile's, and it was the one whose owner was written nowhere
a reader looks: the profile's name sat in the button's `title`, which is a
tooltip.

**And the note claimed the opposite of all of it.** *Setting General writing —
the accounts and models below are this profile's.* True of the models, false of
the accounts, over a card whose key is shared by every profile on the machine.
ADR 0212 added it in good faith to answer *in welchem Profil wähle ich gerade
was aus*; what it answered was a question about the job list, printed above the
inventory.

**A paragraph is also the wrong instrument.** The report it was answering is
that a reader cannot work the screen out at a glance, and the standing ruling
since ADR 0216 is that a banner explaining a confusing screen is more reading,
not less.

## Decision

**The note is deleted, and three things say it instead — each where it is true.**

1. **The lead names both owners.** *Accounts belong to this machine. What each
   job runs on belongs to `<profile>`.* It replaces a sentence that was true and
   silent about ownership, in the one place a reader already looks first. With no
   runtime it says *the open profile* rather than inventing a name.
2. **The Accounts head names its own.** *On this machine. Every profile sees the
   same list.*
3. **The picked card wears the profile whose pick it is.** One card, because one
   card is the answer; an unpicked card still says it in its own tooltip, and the
   same word on four cards is furniture.

**And the count is the limit.** A first build also put a `ScopeTag` on the *What
runs what* head and left the one in `This profile bills to`. The owner read the
shipped screen and struck both: with the switcher in the sheet header, the
profile in the lead and the name on the picked card, those were the third and
fourth copies of one word on one view — the noise this step set out to remove,
arrived at by adding. **A `ScopeTag` belongs on a control that WRITES the
profile** (ADR 0209); both of those state, and every writing control inside a job
row keeps its own.

**No control moves and no ADR is reversed.** ADR 0212's split between inventory
and assignment, ADR 0223's account-as-one-object with the pick on its card, and
ADR 0123's single profile switcher in the sheet header all stand. This step takes
a paragraph away and names owners.

## Consequences

- **The chip is on the line under the name, and the host is why.** The first
  build put it in the header strip beside the account's name and the real app at
  625 px reported `nameClipped: true` — six things on a 345 px line, and the name
  is the one that loses, so `Groq` drew as a sliver beside an intact chip. The
  docblock written with it claimed *it shrinks before the name does*; the code
  did the opposite, which is the class of defect this track keeps closing. The
  line below already stacks and already holds the vendor. Re-measured:
  `nameClipped: false` on all three of the reporting machine's accounts, with a
  17-character profile name.
- **The Accounts description is one line and not two.** It first read *…— pick
  which one this profile bills to*, which measured 2 lines at 345 px and said
  what the chip below it now says. 268 px, one line.
- **`port:diff` moves by three and the tool names them itself**: `models`
  `182 | 294 | 49` → **`182 | 297 | 49`**, `models#1` `262 | 30 | 17` →
  **`262 | 33 | 17`**. The same three nodes on both tabs — `view-top`,
  `view-head` and its `p` — because the lead now wraps to two lines where the
  prototype's is one. Text does not move: the gallery has no runtime, so it takes
  the plain-string fallback and gains no node. `ledger` `style 0`, unmoved.
- **+1 frontend (877)**, proved to fail against the defect: with the chip removed
  the case cannot find the profile on the picked card. It asserts the deletion
  too, because prose is the cheapest thing to put back — a screen that grows a
  second explanation of its own scope has undone this step whatever else it says.

## Alternatives considered

- **Accounts on their own screen.** The cleanest separation on paper, and the
  radio is a per-profile WRITE — it would then sit inside an area called *this
  machine*, so the scope mismatch moves one level down rather than going away.
  ADR 0223 put the pick on the card deliberately: a reader cannot see what an
  account is FOR without it.
- **Tabs, *This profile* against *This machine*.** Makes scope the top-level
  choice and cuts the one relationship the screen exists to show — which account,
  beside which job runs on it — with the same radio contradiction underneath.
- **Correct the note's wording.** One line of work that answers none of the
  report: more prose is not an answer to *I cannot work out how this functions*.
