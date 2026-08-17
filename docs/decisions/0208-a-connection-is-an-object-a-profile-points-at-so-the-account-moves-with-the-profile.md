# 0208: A connection is an object a profile points at, so the account moves with the profile

Date: 2026-08-17
Status: Accepted. Implements speech-track step B14, and finishes the axis
[ADR 0094](0094-the-provider-contract-is-a-trait-with-a-registry-and-the-axis-splits-per-role.md)
opened, [ADR 0203](0203-the-model-a-record-names-is-the-one-the-profile-sent-and-a-lane-that-sent-none-names-none.md),
[ADR 0206](0206-the-corrections-model-belongs-to-the-corrections-lane-and-the-choice-is-made-where-the-job-is-resolved.md)
and [ADR 0207](0207-a-model-belongs-to-the-profile-for-the-same-reason-its-vendor-does-and-the-controls-do-not-move.md)
carried one field at a time. Rescopes
[ADR 0167](0167-a-plan-belongs-to-a-credential-so-it-is-keyed-by-the-vendor-that-sold-it.md)'s
key and moves the two fields
[ADR 0165](0165-may-and-must-are-two-questions-and-the-lane-that-answers-them-differently-is-the-one-you-type-a-url-into.md)
had to leave machine-wide.

## Context

A profile decides which vendor each job runs on (ADR 0094) and which model it
uses (0203, 0206, 0207). **What stayed machine-wide is the part that makes a
lane usable**: the server whose URL you type, and the credential that pays for
the call. So a profile could switch from Cloud to `Your server` and bring
neither its own server nor its own account.

The owner settled *whether* on 2026-08-17, with the reason:

> Ja, das muss wirklich pro Profil sein. Das ist ja auch ein großer Nutzen der
> Profile dann letztendlich, wenn das gut umgesetzt ist.

What was open is *how*, and B14 stated two shapes: **A**, the profile carries
the connection and the store's entry user grows a profile component; **B**, a
connection is an object profiles point at.

**The trade-off is not about code.** Both shapes cost the same plumbing — a
scope through `JobProvider::credential`, through the capture snapshot and
through four trait methods across five adapters. The difference is what a
reader is asked to fill in twice.

The first recommendation put to the owner was **A with a machine-wide
fallback**, on the reading that profiles are mostly writing styles and a fresh
install seeds six of them, so a per-profile credential turns one key entry into
six. **The owner corrected both halves**: the seeded set is being reworked, and
a profile is meant to carry connections rather than only a style. That removed
the argument for the fallback and with it the reason to prefer A, and the
owner's own counter-proposal — *several keys, labelled, visible under each
profile* — is B stated from the surface.

**What decided it, on the recommendation's own terms:**

- **A new profile costs a secret under A.** You cannot create a profile and
  start dictating; you first fetch a key from a password manager. Under B it is
  a pick from a list.
- **The unit a reader names is the account**, not the copy. A stores one account
  once per profile and the product never learns that the copies are the same, so
  rotation is N tasks and the one that is forgotten fails at dictation time
  rather than at setup time.
- **A deleted profile takes its key with it under A.** Under B the account is an
  object and outlives every profile that pointed at it — which is the property
  the owner asked about directly.

## Decision

**A connection is a stored object; a profile names one per job.**

```rust
pub struct Connection { id, label, provider, base_url, model, plan }
```

- **The vendor lives on the connection and nowhere else.** A profile names a
  connection, the connection names the vendor, so the two cannot disagree —
  storing both would be one fact in two places (ADR 0123).
- **`ProfileProviderSettings::resolve` takes the connection list** and returns
  `JobProvider { job, connection, provider, overridden }`. `provider` is
  derived; empty means the profile names a connection this machine no longer
  holds.
- **The credential's scope is the connection.** `credential_store::entry_user`
  is unchanged in shape — `{scope}.{role}.{kind}` — and the scope that used to
  be the vendor id is the connection id. Every credential method on the
  `Provider` trait takes it first.
- **The endpoint and the credential are one object on purpose.** A key typed for
  one host must never be sent to another (ADR 0094's one security rule). Keeping
  the URL beside the token makes that structural rather than a rule to remember:
  *this server with that key* is unrepresentable, because there is no way to
  name the pair separately.
- **The plan rides on the connection** (ADR 0167 rescoped). That record keyed
  the plan by vendor on the argument that a plan belongs to a credential, and
  named what it was reaching for. Two accounts on one vendor is the case its key
  could not answer; the object it was reaching for is this one.
- **The lane is the account's vendor read backwards.** Picking a lane picks an
  account, creating one for that vendor when the machine holds none — which is
  what keeps the chip row meaning exactly what it meant before.

**A deleted connection is named, not replaced.** A profile keeps naming what it
named and its jobs go inert with that name in the refusal. Repointing it would
be this build deciding who pays. Overrides are dropped instead, because an
absent override already has a meaning — *follow the connection* — and an absent
default does not.

**The migration lifts, and it moves the secret.** One connection per vendor any
profile actually names, plus the default vendor's so the seeded id exists;
`provider_plans`, `self_hosted_base_url` and `self_hosted_model` land on the
connections they belong to and leave the file on the next save. The stored
credentials are re-keyed from `{vendor}.{role}.{kind}` to
`{connection}.{role}.{kind}` — **moved, not copied**: a key left behind is a
secret in the OS store that no surface can show and no reader can clear.

**The lift is pure and the re-key is not.** `adopt_connection_axis` runs in
every test that normalizes a config; the keyring is touched once, on the load
path, reading its pairs back off the list the lift just wrote. A failure is
logged and never blocks the load — ADR 0112's licence covers a key the reader
re-types.

**The surface is one row, and no new screen.** The connection card grows an
`Account` row between the vendor and its credential — a picker, `Rename`, `New`
and `Remove` — and every credential row below it is scoped to what that row
selects. This is the owner's own framing (*visible under each profile in the
Models tab*) and it is what keeps ADR 0067 satisfied: the object ships operable
in the step that creates it.

## Consequences

**The sentence the step exists for is checked in two places.**
`switching_the_profile_moves_the_credential` puts two profiles on two accounts
of ONE vendor and reads the entry each resolves to; the surface half asserts
that a key typed while one account is selected is stored under that account.
Both were proven by breaking what they guard — and one of the five mutations
ran green first, against the wrong save door, which is why the mutation was
repeated against the right one.

**Two profiles can share an account, and that is now expressible.** It is the
case shape A could not state at all: two writing styles on one employer account
are one key, rotated once. `two_profiles_on_one_connection_spend_one_key` holds
it.

**`AppConfig::speech_model` stops being inconsistent.** It read the machine-wide
self-hosted model on that lane and the profile's on every other, and ADR 0207
recorded the inconsistency as honest-but-unfixable. The id is the connection's
now, so every lane reads one object.

**The edge to machine facts is unmoved.** `local_model_dirs`, the audio device,
the sample rate, the hotkeys, the overlay, retention and the log level stay in
`AppConfig`. The three environment variables stay machine-wide too, because an
environment is: what is typed still outranks them (ADR 0165 rule 2).

**A vendor with no account answers `configured: false`, and that is the truth**
rather than a missing state: there is no key because there is nothing to hold
one. `provider_status` therefore takes a connection beside the provider, and an
empty one is legitimate — it is what the local lane's probe sends, since that
lane authenticates against nothing.

**`port:diff` on `models` moves for the first time in four steps**, from
`26 | 248 | 20` to `28 | 248 | 20`. The two structural differences are the
`Account` row: the prototype draws no such row because the prototype has no
accounts. `models#1` is unmoved at `262 | 30 | 16`.

**What this does not do:** offer a second account per vendor *per job* within
one profile. A job overrides to a connection like any other reference, so the
shape allows it; no surface offers it, because the drawn per-job row asks about
vendors and nobody has asked for two accounts of one vendor in one profile.

**+9 Rust (936) and +4 frontend (840).**
