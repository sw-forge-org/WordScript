# 0210: A removed account takes its credential with it, and the ask replaces an undo window that was never there

Date: 2026-08-17
Status: Accepted. Speech track
([`../tracks/speech-track-plan.md`](../tracks/speech-track-plan.md)), Stage B row
B14b. Turns
[ADR 0208](0208-a-connection-is-an-object-a-profile-points-at-so-the-account-moves-with-the-profile.md)'s
own rule on the surface that broke it, and applies
[ADR 0082](0082-an-editor-is-a-panel-that-unfolds-under-its-own-row.md)'s
*deleting always asks* where
[ADR 0195](0195-a-transcript-delete-gets-an-undo-window-instead-of-a-confirm.md)
does not reach.

## Context

`buildConnectionRemovalPatch` wrote `connections` and nothing else. The
credential stored under `{connection}.{role}.{kind}` **stayed in the OS secret
store**, under a scope no surface can show and no reader can clear.

That is word for word the state ADR 0208 refused to let its own migration
create. `rekey` MOVES a key rather than copying it, and the record gives the
reason: *a key left behind under a name nothing points at is a secret the
product can no longer show you or clear.* The migration was careful about it
from one end; the delete button then produced it from the other.

**The plan expected a different question here.** B14b was written assuming the
account deletion carried ADR 0195's undo notice, which would have made the real
decision *when* to clear — a cleared key cannot be put back, so the clear would
have had to wait for the window to close rather than race it.

**It does not carry one.** `useUndoableDelete` belongs to the transcript rows it
was written for; `AccountRow`'s *Remove* patched the config on one press, with no
window and no ask. So the question is not when to clear. It is whether a press
that now destroys a secret may still act unasked.

## Decision

**Three parts, and the order is one of them.**

1. **The clear is a runtime call over the whole account, not a loop on the
   surface.** `clear_connection_credentials_in` walks the registry — every role
   the vendor registers, every kind it accepts — exactly as
   `rekey_connection_credentials` does. The same table that decided what there
   was to move decides what there is to forget, so a vendor that registers a
   second role tomorrow is covered without a line of new code.

2. **The credential goes first and the config second.** A config write that
   landed while the keyring call failed would orphan the key with nothing left
   naming it: the account's id is the only handle onto its entries. So a secret
   store that does not answer keeps the account, the row states what happened,
   and nothing was destroyed.

3. **The row asks first** (ADR 0082). An account is the object that rule was
   written for — deleted rarely, where the ask is read *because* it is unusual.
   ADR 0195 departed from the rule for transcript rows on the opposite property:
   they are deleted in runs, and a confirm on the third one stops being read. The
   question unfolds under the row, so the account, its vendor and its key preview
   are all still on screen behind it, and it names what is lost rather than
   reassuring: the key is deleted from the OS store and cannot be put back, and
   the other profiles that keep naming this account stop working.

**The question names the object.** A first account on a vendor is labelled with
the vendor's name, so `Remove Groq?` reads as removing the vendor — the same
collision between *account* and what a reader hears in it that B15 exists to
settle.

## Consequences

- An account removed leaves no entry under its scope, and a Rust case against
  `MemorySecretStore` says so rather than a session having checked once. A second
  account on the same vendor keeps its key, which is ADR 0208's rule stated where
  a removal is the loudest possible way to break it.
- `clear_stored` is `clear_in` plus two things: the answer *was there one*, which
  is what makes a removal countable, and the in-process cache invalidation both
  existing callers of `clear_in` remember to do by hand.
- An empty connection id clears nothing. `{scope}` leads every entry name, so an
  empty scope is a prefix rather than an account, and a loop over it would delete
  entries belonging to nobody.
- **`Remove` on the credential row still does not ask**, and should not: it
  removes a key the reader can type again, from an account that stays.
- The undo window this step was expected to wait for does not exist for accounts.
  If one is ever added, this clear is what has to move behind it — the ask can go
  then, on ADR 0195's argument, but not before.
