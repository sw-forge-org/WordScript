# 0217 — A credential scope is an account id, and the empty string is not one

Date: 2026-08-18
Status: accepted. Completes
[ADR 0208](0208-a-connection-is-an-object-a-profile-points-at-so-the-account-moves-with-the-profile.md)
and applies
[ADR 0209](0209-a-status-is-read-per-account-and-a-credential-may-never-cross-into-another-vendors-account.md)
to the one surface it had not reached.
Track: Speech (B23)

## Context

The owner reported on 2026-08-17 that the workspace status strip reads
**`Needs key`** while the connection card six rows away shows the key present,
and the speech track's own brief filed it as *one open report, unreproduced*,
listing everything it had ruled out: both credential entries exist in the OS
secret store, they are the same 56-character key, it answers `HTTP 200` against
`api.groq.com/openai/v1/models`, and nothing in the running host's log shows a
credential error. The brief's two hypotheses were *the strip is asking about a
different connection than the one the reader is looking at* or *the runtime
answered something the keyring contents do not explain*.

The first is right, and the answer is sharper than the brief allowed for: **the
strip asks about no connection at all.**

`WorkspaceWindow.tsx` derives the account four lines above the call and then
omits it:

```ts
const connectionAccount = providerSource ? activeConnectionOf(providerSource) : undefined;
const connectionProvider = connectionAccount?.provider ?? DEFAULT_PROVIDER_ID;
…
const { status, lastError } = useProvider(
  providerSource ? connectionProvider : null,
  selectedModel,
  selectedCleanupModel,          // ← and the fourth argument, which is the account
);
```

`useProvider`'s fourth parameter defaults to `""`. `credential_store::entry_user`
formats `{scope}.{role}.{kind}`, so the runtime read the entry **`.speech.api_key`**
— a name no writing door can produce, because every save carries the account the
reader typed into. `role_credential_status` answered *nothing stored*,
`connectionReadiness` read `configured === false`, and the strip said `Needs key`.

**So this was never a state of this machine.** ADR 0208's migration MOVES a key
from the vendor scope onto the account; from the commit that landed it, the
workspace strip has reported `Needs key` on **every machine, on every launch,
with the key present**. It is the same defect ADR 0209 closed on the Models card
— a credential asked for by a name that stopped being the scope — standing on the
one surface that is never scrolled away.

**Two things kept it invisible for as long as it stood.**

The suite could not have caught it. The `useProvider` double in
`WorkspaceWindow.test.tsx` took one argument and ignored the rest, so a caller
that dropped the scope got the vendor's answer from the mock and an empty keyring
entry from the runtime. That double's own docblock records the previous repair of
exactly this shape — *`asked` is half the point: until this commit the mock was a
constant, so the case that the chip asks about the connection the strip names
could not be written* — and it went one argument short. **A seam double that is
kinder than the seam turns green cases into no evidence at all.**

And the runtime accepted the question. `refuse_foreign_account` returns `Ok(())`
for an empty connection, correctly — a read of the wrong slot destroys nothing —
but nothing anywhere refused a read that could only ever answer *missing*.

## Decision

**A credential scope is an account id. The empty string is not one, and a status
asked without one is refused rather than answered.**

The surface half is the argument the caller had in hand: `connectionAccount?.id`.

The runtime half is `refuse_unscoped_credential_read`, checked in
`provider_status` before any adapter is reached. It fires exactly when the
provider registers at least one credential kind and the connection is blank.
**The lane that stores no credential is exempt by construction rather than by
name**: `credential_kinds()` is empty for `local`, which authenticates against
nothing, and that is precisely the lane whose callers legitimately name no
account.

It refuses instead of answering because *no account was named* and *this account
holds no key* are different facts with different next actions, and only the
second is the reader's. `connectionReadiness` already has the branch for a
refusal — `Needs attention`, carrying the runtime's own sentence.

## Consequences

**A machine whose profile points at an account it no longer holds now reads
`Needs attention` rather than `Needs key`.** That is the improvement, not a
regression: a dangling pointer is not a missing key, and sending the reader to a
credential row would not have helped.

**The guard is dead code on every path that exists today**, which is what makes
it a guard. Both callers of `provider_status` pass a real id — `useProviderSeam`
always has, `useProvider` now does, and `runtime_contract_for_app` reads the
dictation job's connection. It can only fire on a regression.

**+1 frontend case, +1 Rust case, both made to fail first** by restoring the
defect. The frontend one clears the vendor-keyed default from the mock on
purpose: with it in place the case passes against the very defect it exists to
hold, which is how the defect survived.

**The mock now answers per account** (`provider@connection`), falling back to the
vendor key so the file's other 36 cases keep measuring what they measured. The
fallback is a deliberate limit: it keeps this repair small, and it means a future
caller that drops the scope is caught by the new case rather than by all of them.

**This was not a step in any plan.** It was found by reading the brief's
*unreproduced* report against the code rather than by reproducing it, which is
the fourth time on this surface that reading beat running (ADR 0215 found four
that way). It is filed as B23 so that the finding has an owner rather than living
in a commit message.
