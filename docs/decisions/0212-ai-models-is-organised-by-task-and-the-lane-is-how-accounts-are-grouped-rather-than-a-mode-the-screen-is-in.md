# 0212: AI Models is organised by task, and the lane is how accounts are grouped rather than a mode the screen is in

Date: 2026-08-17
Status: Accepted. Speech track
([`../tracks/speech-track-plan.md`](../tracks/speech-track-plan.md)), Stage B row
B15, second half. Builds on
[ADR 0211](0211-a-model-is-stored-on-the-same-key-as-the-account-because-a-model-id-is-only-meaningful-for-a-vendor.md)'s
axis and moves two rules recorded elsewhere rather than reversing them:
[ADR 0128](0128-a-drawing-inherited-from-the-demo-gui-is-an-inventory-and-the-config-is-the-answer.md)'s
*a vendor stays listed and disabled with its reason*, and B12's lane lock
([ADR 0067](0067-local-preview-is-treated-as-an-unpublished-provider-everywhere-it-is-offered.md)).

## Context

The owner operated the account row B14 shipped and B14a corrected, and reached a
conclusion neither step had: **the screen is not badly laid out, it is organised
around the wrong object.** Six layout directions were drawn at the real 569 px
column and all six were rejected in one sentence — *which of these solves the
problem rather than prettifying it* — because all six kept the lane as the spine.

The finding behind it: **`Account` names a credential and the reader hears a
bundle.** What the owner means by the word — per task a lane, a provider and a
model, switchable as a whole — already existed and is called a text profile. And
the capability they asked for was already storable: a profile names a connection
per job (ADR 0094 + ADR 0208), a connection carries its vendor, so *dictation on
Cloud, cleanup on your own server* is a state the config accepts. **Three locks
in the surface forbade it**, and all three were the lane being treated as a mode.

## Decision

**The task is the spine. The lane groups.**

1. **A job row picks an account, not a vendor on one lane.** The picker offers
   every account this machine holds, grouped lane → provider → account — the
   hierarchy the owner asked for — and the lane it lands in is read off the
   account rather than filtering the list. `setJobAccount` writes a connection id;
   the vendor-named `setJobOverride`, which had to CREATE an account to point at,
   is no longer how a job is routed.

2. **The lane segment writes nothing.** It used to write
   `buildVendorConnectionPatch` plus `buildProfileProvidersPatch`, so the screen's
   topmost control created an account and repointed a profile the reader was never
   shown: one click, two decisions, neither stated. It now decides which lane's
   accounts the card configures, and it opens on the lane the profile's own
   account is on so the screen still starts where the reader dictates from.

3. **Assigning and adding are two actions with two rows.** The `Account` row
   assigns an account to the active profile and carries that profile's name
   (ADR 0209). A lane this machine holds no account on gets a row that says so and
   offers *Add account*, which adds and does not assign — the creation the chips
   used to do invisibly, made explicit and split from the decision it was fused
   to.

4. **The card is named for what it holds.** `Connection`, singular, became
   `Accounts`: what this machine can bill jobs to, with the keys and plans that
   belong to them, and a **used-by read-out** derived from the profiles rather
   than stored on the account (ADR 0123 — the pointer lives on the profile, and a
   second copy could disagree). The profile the screen is setting is stated once,
   at the top, before the first row that writes it.

5. **A job row carries no credential editor.** It states `Key set` / `No key` /
   `Not read` for the account it runs on and stops there. A key field scoped to a
   job is how a credential came to look like the thing a job runs on, which is the
   confusion this step exists to end.

**The profile is stated, not switched, and that is a deliberate reading of the
brief.** Which profile is active is a workspace-wide fact with one control
already — the switcher in the nav foot — and it has mid-session semantics that
control handles. A second switcher here would be a second answer to one question
(ADR 0123). What was missing was never a way to switch; it was the sentence
saying whose accounts and whose models these are.

## Two rules moved rather than went away

- **ADR 0128's list.** *An unbuilt vendor stays visible and disabled with its
  reason* was written about a control that picked vendors. The job row picks
  accounts now, so that rule holds per account — an account on a vendor with no
  adapter is offered and refused with the sentence — and the question *which
  vendors exist at all* belongs to the inventory, which still shows every one of
  them.
- **B12's lane lock.** `laneWithheld` is now the one list of why a lane is
  withheld by the product, read by the segment, by the withheld rows and by the
  account picker. Without that third reader, an account picker over every account
  would have let a job be routed to a lane the segment above it refuses to
  select — reversing a recorded decision by omission. The sentences are the ones
  the rows already carried, to the word.

## What looking at it found, and green tests had not

Rendered headless at the real 625 px workspace width, three times:

- **The collapsed job row lied.** Its badge read the LANE's drawn catalogue entry,
  so a cleanup routed to OpenAI with a model of its own summarised itself as
  Groq's `llama-3.1-8b-instant` — the *surface names one model, the request
  carries another* defect this step exists to end, on the one line a reader takes
  in without opening anything. It reads the resolution now, with the account's own
  mark and `default` said out loud where the row follows.
- **A missing credential greyed the option the job already ran on**, which reads
  as a broken control rather than as a missing key — and ADR 0128 says in as many
  words that a missing credential does not disable an option. Only *no adapter*,
  *a withheld lane*, *a role the vendor does not serve* and *a file too large*
  (ADR 0129) do.
- **`Your server · Your server`** on the one lane whose label is its vendor's
  name.
- Three claims in the copy had gone false under their own card: the screen's lead
  (*One connection…*), the workspace banner (*every job override … drawn and
  inert*) and the lane row's hint (*Where this runs*).

## Consequences

- **`port:diff` moved, and less than expected**: `models` goes
  `28 | 248 | 20` → `28 | 257 | 24`, structural unmoved, +9 style and +4 text —
  the renamed section, its description, the screen's lead and the lane's hint.
  `models#1` goes `262 | 30 | 16` → `262 | 30 | 17`. Structural did not move
  because the **gallery still draws the prototype's lane-shaped rows**: the
  task-first pair needs a config to name accounts and models, and the drawing has
  none. That is ADR 0127's arrangement — the drawing is the inventory of what is
  intended, the product shows what is stored — and it means the prototype's own
  spine is now one step behind the product's. The next `gui-port` pass owns
  closing that.
- **The reachable variety is two lanes, not three**, and both limits are
  elsewhere: `Local` is withheld until Phase 5 (B12), and `self_hosted` registers
  speech and not chat (`registry.rs`), so the assistant cannot be pointed at
  somebody's own server today. The row offers the account and refuses it with the
  reason, which is the honest version of a capability the adapter has not grown
  yet.
- The 569 px column against the 760 px the sheet is designed for is untouched and
  still a `gui-port` finding: a job row's description wraps to nine lines at that
  width, which this step did not make better or worse.
- `Account` keeps its name. The collision the owner heard was between a credential
  and a bundle, and it is resolved by the credential stopping being the screen's
  spine rather than by renaming it — the word is right for *which of your accounts
  pays for this*, which is exactly what the row now asks.
