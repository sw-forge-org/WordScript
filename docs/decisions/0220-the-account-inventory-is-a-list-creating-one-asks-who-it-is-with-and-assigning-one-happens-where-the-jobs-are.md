# 0220 — The account inventory is a list, creating one asks who it is with, and assigning one happens where the jobs are

Date: 2026-08-18
Status: accepted. Finishes
[ADR 0212](0212-ai-models-is-organised-by-task-and-the-lane-is-how-accounts-are-grouped-rather-than-a-mode-the-screen-is-in.md)
at the row level, where it was applied at the lane level.
Track: Speech (B17)

## Context

ADR 0208 made the account an object and ADR 0212 made the Accounts card an
inventory of them — *what this machine holds*, against *what runs where* in the
list below. The drawing stayed a single `Account` row: a select over the lane's
accounts, a `ScopeTag`, and Rename / New / Remove beside it.

The owner read the finished screen on 2026-08-17: *"die UI von Account sieht
scheiße aus. Die Breakpoints sind absoluter Bullshit. Man kann hier nichts
lesen."*

**Measured in the native host at 625 CSS px** — the width this workspace
permanently renders at, a display-scale fact about the reporting machine rather
than a preference — the settings sheet's `ws-column` is **379 px**. That is below
the 460 px tier, so every row is already stacked. The `Account` row is then:

| | |
| --- | --- |
| row height | **171 px**, for one setting |
| accounts visible | **one**, and which one was `accountForLane`'s derivation |
| controls | five, carrying **489 px** of intrinsic width, wrapping onto two lines inside a 313 px column |
| hint | 158 characters, wrapping onto three lines at ~53 characters each |

**So the tier is not what is wrong, and the complaint is still exactly right.**
Stacking is the correct answer to a narrow column and the wrong answer to five
controls: the responsive rule fires, does what it says, and produces a 171 px
ribbon. Nothing is clipped and nothing overflows; what fails is that a card
headed *what this machine can bill jobs to* spends 171 px saying one thing.

Four faults, and they are four rather than one:

1. **One account was visible and which one was a derivation.**
   `accountForLane` picks the profile's where it is on this lane and the first
   otherwise. That is a good rule for *where do the credential rows open* and no
   rule at all for *what does this machine hold* — and a reader looking at a key
   row could not tell which of two accounts on one vendor it belonged to, because
   nothing on the screen said and nothing let them say.
2. **Five controls in one `ws-rowflex`.** `.ws-row-ctl` is `flex: none`, so on an
   inline row every pixel a control takes comes out of the text column beside it
   (ADR 0092); stacked, they wrap. Rename and Remove belong to **one** account
   and were sitting on a row that is about the lane.
3. **Creating one picked no vendor.** `+ New` used the shown account's vendor and
   `AddAccountRow` used a fixed `runtimeIdFor(LANES.Cloud.provider)` — so on
   Cloud the button always made a Groq account whatever the reader wanted, and
   the chip row above was the only route onto a second vendor. That is the duty
   ADR 0212 wanted the chip row to lose and had nowhere else to put.
4. **The assignment sat in the inventory.** The select wrote `providers.default`
   on the active profile — the one control that decides who pays, inside the one
   card that is not about the profile. Worse, `+ New` created an account **and**
   repointed the profile on one press, while `AddAccountRow`'s own docblock three
   components away already said adding and assigning are two acts.

## Decision

**The card lists every account the shown lane holds, one block each**, carrying
its name, its vendor, its key state, who uses it, and its own Rename and Remove.
The block is a stacked body rather than a row's control slot, so the hint is
never squeezed by a control cluster.

**Which account the credential rows open on is a choice.** `accountForLane` is
still the opening state and is no longer the whole of it: picking a name in the
inventory is what the rows below follow. The selection is held above both, and an
id belonging to another lane self-heals through the same fallback — which is what
makes switching lanes safe without an effect.

**Creating one asks who it is with.** `AddAccountPanel` asks for a vendor and a
name before the account exists. The vendor list is the registry's answer
(`selectableProviderNames`), not the drawing's, because a vendor with no adapter
cannot hold an account that could run a job. **A lane that *is* a vendor does not
ask** — `Your server` and `Local` are a place rather than a company, so there the
question would offer a list of one. **And it does not assign.**

**Assigning happens at the head of *What runs what*.** `This profile bills to`
offers every account this machine holds, grouped lane → vendor by
`accountChoices`, with the profile named on a `ScopeTag`. It leads the job list
because that is what it is: every row below follows it unless it carries an
override of its own.

**The chip row states and no longer sets.** Under a runtime it marks the vendor
of the account the inventory is open on and writes nothing. Re-pointing an
existing account at another vendor would leave its stored key addressed to a
company that never issued it, so that control was offering something that must
not happen; both things it actually did have an honest home now. The gallery
keeps the picker.

## Consequences

**`port:diff` did not move.** `models` `65 | 281 | 33` and `models#1`
`262 | 30 | 17`, unchanged. Nothing in the inventory renders without a runtime —
the gallery has no config and therefore no accounts — so the port measures the
same tree it did before. **The brief expected this movement to have to be
explained**; the reason it did not happen is worth more than the explanation
would have been, and it generalises: a step that rebuilds a wired surface costs
the port nothing as long as the drawn branch is untouched.

**Read at 625 px after the suite was green**, which is the rule this screen keeps
proving. Three accounts visible at once, 90–108 px each, no horizontal overflow
anywhere in the sheet. **And the reading found one defect the tests had not**:
the vendor badge drew `Groq Groq` on the account almost every machine has,
because `buildNewConnectionPatch` names a first account after its vendor. One
fact stated twice six pixels apart — the furniture rule this file cites three
times, and the confirm panel below it already knew about the collision. The badge
draws only where the name and the vendor differ, which is the case it exists for.

**ADR 0209's repoint-on-delete is deliberately untouched.** Removing the account
the reader is on still repoints the active profile and nobody else. The reason
that record gave — that the row it landed on could not state a dangling pointer
or get out of one — is answered elsewhere now, by `This profile bills to`. The
ruling is not thereby wrong, and re-deciding a record because its motivating
example moved is how a contract turns into a preference.

**Each account block carries its own id in the DOM**, and that is a fact about
the surface before it is a fact about its tests: two accounts on one vendor make
every control in there ambiguous by name — two `Remove`s, two `Rename`s — and an
assertion that has to guess which one it pressed is the same guess a reader
makes.

**+8 frontend (870 → 874), and fifteen cases were rewritten rather than
deleted.** Every rule they held survives; what changed is where it lives. Two of
the rewrites are the decision itself stated as a test — the chip row writes
nothing, and creating an account does not assign it.

**What this record does not do.** The chip row is still the second tallest thing
on the card at 187 px and now states a vendor each account block already carries;
it survives because it also carries ADR 0106's capability sentence, which nothing
else does. The 460 px tier is untouched: the measurement says it fires correctly,
so moving it would be changing a number because a card that used it badly has
been repaired.
