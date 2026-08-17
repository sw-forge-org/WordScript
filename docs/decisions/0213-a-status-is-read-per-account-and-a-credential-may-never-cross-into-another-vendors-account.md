# 0213: A status is read per account, and a credential may never cross into another vendor's account

Date: 2026-08-17
Status: Accepted. Speech track
([`../tracks/speech-track-plan.md`](../tracks/speech-track-plan.md)), Stage B row
B16. Completes what
[ADR 0209](0209-a-status-names-the-account-it-answered-about-and-a-deletion-repoints-only-the-profile-that-ordered-it.md)
started on one surface, and closes a hole
[ADR 0212](0212-ai-models-is-organised-by-task-and-the-lane-is-how-accounts-are-grouped-rather-than-a-mode-the-screen-is-in.md)
opened while it was fixing a different one.

## Context

**Three reads were still keyed by vendor after the config had stopped being.**
ADR 0208 made an account an object; ADR 0209 found the first consequence — a
status keyed by vendor reporting one account's key under another — and fixed it
by making the runtime echo the account it answered about and having the
connection card refuse an answer that named a different one.

That closed the surface the owner was looking at. It did not close the shape.
`RuntimeAnswers.statuses` remained `Record<vendorId, ProviderStatus>`, which
**cannot represent what the config stores**: a vendor holds as many accounts as
the reader made, and that map has one slot for all of them. Everything built on
it inherited the limit.

Then ADR 0212 demoted the lane from a mode to a grouping. The card now shows
whichever lane the reader is looking at; three things underneath it kept
following the *profile*. While every self-hosted fixture in the suite put the
profile on the server, the two agreed by accident and nothing failed.

**What the disagreement produced, measured rather than reasoned about:**

- `AccountRow` read the literal `"Cloud"` while `WiredSelfHostedRows` rendered
  it, so the `Your server` card named the Groq account. *Rename* renamed Groq,
  *New* created a Groq account, *Remove* deleted one — on a card showing the
  server's URL one row below.
- The Cloud card's credential rows were scoped to `connectionId` from the
  `Wired` context, which is the account the profile dictates on. On a machine
  whose profile is on its own server, a key typed into a field placeheld
  `gsk_…` was saved as `{provider: "self_hosted", connection: "connection-self_hosted"}`.
  **The secret store keys an entry by `{connection}.{role}.{kind}` and carries no
  vendor** (`credential_store::entry_user`), so the Groq key landed in the slot
  the self-hosted adapter reads its bearer token from: sent to the reader's own
  machine on the next transcription, with the token that had been there
  overwritten. That is ADR 0094's one security rule — *a key typed for one host
  must never be sent to another* — reached through a lane switch.
- `credentialStateFor` took a vendor's drawn name, so a job row running on an
  employer's keyless account badged a green `Key set` off the private account
  beside it. ADR 0128 forbids exactly that badge; it arrived through the
  argument list rather than through a literal.

## Decision

**1. `provider_status` is read once per account, and the map is keyed by the
account.** `useProviderSeam` takes the config rather than a lane and asks about
every connection the machine holds; `RuntimeAnswers.statuses` becomes
`Record<connectionId, ProviderStatus>`.

**This is not ADR 0124 reversed.** That record refused ten `provider_status`
calls for a screen that merely opened, on the argument that eight would answer
`Err` for vendors nobody had configured — ten keyring reads for nothing. An
account exists because somebody made it. A fresh install reads one; the case
this whole axis was built for reads two. The cost now scales with what the
reader owns rather than with what the drawing names.

**The key is the runtime's echo, not the id the surface asked with.** ADR 0209
made `provider_status` stamp `status.connection`; filing the answer under that
value is what makes it structurally impossible for one account's answer to be
found under another's name. An answer echoing nothing is dropped rather than
filed under a guess.

**2. A capability is the vendor's and a credential is the account's, and they
now come from two reads.** `resolveProviderAnswer` takes an optional connection
id: without one it answers about the adapter and the role and **says nothing
about a credential**, because a caller with no account in hand — the vendor chip
row — has not asked a question about one. It used to answer anyway, off whichever
account the vendor's single slot held.

**3. Every row on the connection card reads its own lane's account.**
`AccountRow` takes the lane as a prop; `CloudCredentialRows`, `ServerTokenRow`
and `ReachabilityRow` take the account the card is configuring. What is left on
the context is renamed `profileAccountId` and means what it says: the account the
active profile follows, for the job rows that state *Follow the profile · X*.

**4. The runtime refuses a crossed pair.** `save_provider_api_key`,
`clear_provider_api_key` and `clear_connection_credentials` load the config and
reject a `(provider, connection)` whose connection this machine holds **for a
different vendor**, before anything is written.

**A rule the surface has to remember is a rule that gets broken.** Point 3 is the
surface no longer asking for the crossing; point 4 is the runtime refusing it
whatever asks. The store cannot make the distinction on its own — an entry is
keyed by account precisely because a credential belongs to one — so the check
belongs where the config is readable.

**An id no connection carries is let through, and that is not a hole.** `patch`
is optimistic: the surface writes a new account into its own copy of the config
and lets the disk catch up, so the first key typed into a freshly created account
legitimately names an id the file has not seen. What is refused is the case that
can destroy something: an id this machine holds, and holds for somebody else.

## Consequences

- A machine with two accounts on one vendor gets two answers, and every surface
  that states a key states the right one. The job row is the visible half.
- The seam is no longer scoped to a lane, which also repaired something nobody
  had reported: a job pointed at an account on another lane (ADR 0211 made that
  storable and pickable) had no status of its own and read *Not read* forever.
- `statusConnectionFor` is gone. It elected one account per vendor, which was
  the best a vendor-keyed map could do and is meaningless once there is no
  election to make. `accountsToRead` replaces it and excludes `local`, whose
  status probes the disk that `useLocalSetup` already probes once (ADR 0124).
- A fixture answering `provider_status` must echo the account it was asked
  about, or its answer is dropped. Two existing cases in `Models.test.tsx` did
  not, and both were asserting things that only held because the answer was
  filed under a vendor.
- **The credential rows on the Cloud card are still one row for one account.**
  Which account a card shows is `accountForLane`'s answer, and that function
  prefers the active profile's account where it is on the lane and takes the
  first otherwise. A reader holding three Groq accounts still configures them one
  at a time through the account select. Making the inventory visible as an
  inventory is the next step's decision, not this one's.
