# 0209: A status names the account it answered about, and a deletion repoints only the profile that ordered it

Date: 2026-08-17
Status: Accepted. Corrects three consequences of
[ADR 0208](0208-a-connection-is-an-object-a-profile-points-at-so-the-account-moves-with-the-profile.md),
all found by the owner operating the row it built, on the day it landed.
Extends the answer shape [ADR 0124](0124-the-registry-answers-for-the-whole-table-at-once-and-a-vendors-absence-from-it-is-the-answer.md)
settled and the *not read* vocabulary
[ADR 0128](0128-a-drawing-inherited-from-the-demo-gui-is-an-inventory-and-the-config-is-the-answer.md)
introduced.

## Context

ADR 0208 made an account an object a profile points at, and gave `AI Models` one
new row to point with. The owner used it and found three faults in one sitting:

> wenn ich zum Beispiel, egal bei welcher Lane, jetzt einen Account auswähle,
> und einen neuen erstellen möchte, dann ist dem neuen Account immer noch der
> alte API Key untergeordnet und wenn ich dann den neuen Account lösche sieht es
> auf einmal so aus wie in meinem Screenshot. Und ich muss erst alles wieder neu
> laden, damit die Ansicht wieder normal aussieht.

And a fourth question, which turned out to be about a missing label rather than a
missing feature:

> Und dann frage ich mich auch, okay, wie kann ich einen Account einem Profil
> zuordnen?

Each of the three is a rule that was right about the thing it was written for and
wrong one step over.

## Decision

### 1. A status echoes the account it was asked about

`ProviderStatus` grows `connection`, stamped by `provider_status` from the
request rather than filled in by an adapter.

**The status is keyed by vendor and the rows that read it are scoped to an
account.** ADR 0124 settled the first for a good reason — ten `provider_status`
calls is ten keyring reads for a screen that merely opened — and ADR 0208 made
the second true. So one vendor with two accounts had one answer and two rows: the
badge described whichever account was read and the field below it wrote whichever
was selected.

`useProviderSeam` also asked the wrong account. It sent
`connectionForVendor` — the FIRST account on each vendor — which is correct for a
vendor nothing points at yet, because a chip click and a job override both land
there (`buildVendorConnectionPatch`), and wrong for the one vendor the active
profile holds a second account on. `statusConnectionFor` is the corrected rule:
the active account answers for its own vendor, the first answers for every other.

**Both halves are needed and neither is redundant.** Asking the right account
fixes the steady state; the echo fixes the frame after every switch, because
`patch` is optimistic and the re-read is a round trip. Without the echo the
surface cannot even detect that it is holding a stale answer — and a green *Set*
over an account that has never held a key is the fake-readiness rule with a
secret behind it. Where the two disagree the row reads **Not read**, which is a
third answer and not a missing key.

### 2. Removing an account repoints the profile that ordered the removal, and no other

ADR 0208: *a deleted account is named, never replaced, because choosing who pays
for somebody is not a migration's decision.* That is right, and it is about
**another** profile.

Applied to the active profile it produced a surface with nothing on it. The row
is scoped to the account, so with the pointer dangling there was no vendor: an
empty select over an empty list, no rename, no remove, and an *Add* that returned
early on the vendor it could not name — a live button that did nothing, which is
the false affordance this card spent two records removing. The way back was a
vendor chip, and nobody would think to look there.

**Nobody chose that; it fell out of a rule aimed one profile over.** The reader
who pressed *Remove* is standing in front of the row. Moving their own pointer is
not deciding for anybody, and the button only exists with a second account on the
vendor, so there is always a successor. Every other profile keeps ADR 0208's
treatment, and the button's own sentence now names them: *General writing moves to
another account with this vendor. 2 other profiles keep naming this one and their
jobs stop until you point them somewhere else.*

Only the default moves. A per-job override is a decision made on a job row.

### 3. An override naming a deleted account stays named, and dropping it was repointing it

`ProfileProviderSettings::normalize` dropped every override whose connection had
gone. Its own comment argued against repointing:

> An override that resolves to nothing is dropped rather than repointed at the
> default: silently rewriting it would make the row read *follow the connection*
> while the reader's own choice disappeared.

**Dropping it is exactly what makes the row read *follow the connection*.** An
absent override is the stored form of that option (ADR 0094: the absence is the
value), so the code did the thing the comment forbade — quietly, on load, to a
choice the reader had made by hand. The rule ADR 0208 states for the default now
covers the override: the name stays, `resolve` leaves the vendor empty, and the
job goes inert under the name that is gone.

It also ends a drift. `resolveJobProvider` in `src/lib/textProfiles.ts` never
pruned, so one config was read by the surface as *overridden, unresolved* and by
the runtime as *following the connection*. An empty override is still dropped:
whitespace names nothing a reader picked, so there is no decision in it to keep.

### 4. The row names the profile it writes

The Account select writes `providers.default` on the **active** profile and said
so nowhere, which is why *how do I assign an account to a profile* had no answer
on the screen that answers it. It carries a `ScopeTag` with the profile's name and
the door to Profiles now — the idiom every other per-profile row here already
uses.

**The premise the question came with is worth recording as corrected**, because
it is the natural reading and it is not the model: an account is not coupled to
one profile. It is an object several profiles may point at, which is the whole
argument for the shape (a company key exists once rather than once per writing
style, and is rotated once rather than per copy). So a default label naming the
creating profile was rejected — it would be false the moment a second profile
points at the account. The label stays `{Vendor} {n}` and is the reader's to
change from the moment it exists.

## Consequences

- One row can no longer show another account's credential, and the check is
  structural rather than careful: the badge is rendered from
  `credentialForConnection`, which returns nothing when the answer names a
  different account. `Not read` is the word this screen already uses for a
  runtime that did not answer (`WiredCeilingBadge`, ADR 0128).
- The `Your server` token row gains the same guard and a third state. A token is
  optional, so `None` is a resting state a reader is meant to believe — which is
  precisely why it may not be printed for an account nothing was read about.
- The adapters cannot get the echo wrong, because they do not write it. The stamp
  is one line in `provider_status`, and a registry-walking test asserts that
  every registered vendor answers about the account it was asked about — so an
  adapter added later is covered without a line being added here.
- A config already holding a dangling default is not repaired on load, and must
  not be: that is ADR 0208's rule, and every build before this one could write
  the state. The row states it by name and offers every account as the way out,
  which is the only list that can contain the answer when there is no vendor to
  scope to.
- A job whose override names a deleted account now goes inert instead of silently
  running on the profile's default. That is the intended behaviour and it is a
  behaviour change for any config in that state: the job stops rather than
  quietly billing another account.
