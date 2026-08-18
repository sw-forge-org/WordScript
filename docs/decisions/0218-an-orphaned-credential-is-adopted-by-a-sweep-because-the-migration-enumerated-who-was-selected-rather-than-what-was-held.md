# 0218 — An orphaned credential is adopted by a sweep, because the migration enumerated who was *selected* rather than what was *held*

Date: 2026-08-18
Status: accepted. Repairs the gap in
[ADR 0208](0208-a-connection-is-an-object-a-profile-points-at-so-the-account-moves-with-the-profile.md)'s
one-shot migration.
Track: Speech (B20)

## Context

ADR 0208 moved the credential scope from the vendor to the account and made
`credential_store::rekey` **move** rather than copy, on its own argument: *a key
left behind under a name nothing points at is a secret no surface can show and no
reader can clear.*

Listing the OS secret store on the reporting machine on 2026-08-17 found one
anyway:

```
connection-default.chat.api_key      created 2026-08-17 11:00
connection-default.speech.api_key    created 2026-08-17 11:00
self_hosted.speech.api_key           created 2026-08-16 13:11
```

The third is keyed by **vendor**. It is a bearer token the account row cannot
display, `Remove` cannot clear, and no reader can discover without `secret-tool`
— so whatever server it authenticates against, revoking it from inside the
product is impossible. The entry was deleted by hand the same day on the owner's
instruction; that cleared the symptom and left the code path untouched.

**Why the migration missed it is measured rather than guessed.** The machine's
own pre-migration snapshot, `config.backup-connection-axis-1786964429877.json`
(2026-08-17 13:00), carries `connections: null` and **all six profiles on
`groq`**. Reading the two functions against that file:

- `adopt_connection_axis` builds its vendor list from the ids the **profiles**
  name — `providers.default` and each override — plus the default vendor. With
  every profile on Groq it produced exactly one connection.
- `rekey_connection_credentials` then walks the connections that lift produced,
  so it re-keyed `groq` and nothing else.

`self_hosted.speech.api_key`, written the day before while the vendor was
configured and no profile had selected it, was in neither list.
`connection-self_hosted` and `connection-openai` in today's config were created
from the UI **afterwards** — and the migration is one-shot (`if
lifting_connections`), so nothing ever looked at that entry again.

**The same gap has a second, unrecorded consequence.** `adopt_connection_axis`
`take()`s `migrated_self_hosted_base_url` and `migrated_self_hosted_model` off
the config and then spends them only where a profile named the self-hosted lane.
A machine that typed a server URL and went on dictating in the cloud had that URL
read off the file, dropped, and stopped being written — silently. The lift's own
test covers only the case where a profile names the lane.

One sentence covers both: **the enumeration asked who was SELECTED where it
should have asked what was HELD.**

## Decision

**A vendor-scoped credential is adopted onto its account by a sweep that runs
while one is still there to find, not by a migration that runs once.**

`providers::adopt_vendor_scoped_credentials` walks the registry — the same table
`rekey_connection_credentials` walks, so a vendor that stores no credential is
skipped by construction and an id no adapter claims could never have been a
scope — and answers per `(role, kind)` with one of three outcomes:

| Accounts on that vendor | Outcome | Why |
| --- | --- | --- |
| exactly one | **Adopted** — `rekey` onto it | the only unambiguous target there is |
| two or more | **Ambiguous** — reported, nothing moved | picking one would put a key on an account it may not have been issued for, which is the crossing `refuse_foreign_account` exists to refuse |
| none | **Stranded** — reported, nothing moved | there is nothing to move it onto, and deleting a bearer token nobody asked about is destroying a secret to tidy a name |

Three answers rather than a count, because the three need different things from a
reader and a number cannot tell them apart.

**It is not gated on the migration**, and that is the decision rather than an
implementation detail. The reporting machine created the self-hosted account the
day *after* its one-shot lift ran; a sweep that only ran with the lift would have
missed it for the same reason the lift did. Running on every launch is what makes
the late-created account the case it handles rather than the case it misses — and
what makes `Stranded` converge, since the launch after an account appears adopts
the entry.

**And the lift keeps a server nobody selected.** Where the machine-wide endpoint
fields carry anything, a self-hosted connection is created for them even when no
profile names the lane. It creates no empty account where the machine held
nothing, and it repoints no profile: what was held is not what was chosen, and
the lift decides neither.

## Consequences

**Once per process, not once per `load_from_disk`.** That function is called on
many paths — `refuse_foreign_account` calls it on every credential write — and
the sweep reads the OS secret store. A `std::sync::Once` at the call site keeps
it to one pass per launch; the function itself is pure over a store and a
connection list, which is what makes all four cases testable against
`MemorySecretStore`.

**Silent when there is nothing to say**, which is every launch on every machine
that never carried one. A sweep whose quiet case is noisy is one that gets
switched off.

**It does not delete.** `Stranded` is the case where the tidy answer and the safe
answer disagree, and the owner's standing ruling that local data is disposable is
about **data this product wrote and can see** — not about a token that may still
authenticate against a live server the product cannot name. It is written to the
runtime log so a reader can act on it, which is the minimum ADR 0208 asked for:
*no entry keyed by anything but an account id, or one is and the surface can show
it.* Showing it in the UI is not done here and is the honest limit of this
record.

**+7 Rust cases (950 → 957), two of them made to fail first** by restoring the
lift's old vendor enumeration. Four hold the sweep's three outcomes and its quiet
case; two hold the lift against a server no profile points at, and against
inventing one where the machine held none; one is ADR 0217's guard, which landed
in the same pass.

**The reproduction is a fixture and not this disk.** The entry was deleted before
this work started, so nothing here was verified against the machine that produced
it. That is stated rather than glossed: the argument for the fix is the backup
file and the two functions, not an observation of the repair.
