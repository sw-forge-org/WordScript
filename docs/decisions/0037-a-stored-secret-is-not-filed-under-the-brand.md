# 0037: A Stored Secret Is Not Filed Under the Brand

Date: 2026-08-03
Status: Accepted

## Context

The GitHub organization was renamed from `SW-Bench` to `sw-forge-org` in June
(`7eeb552`). That commit updated the documentation, the About tab and
`src/lib/appMeta.ts`, and it touched no file under `src-tauri/`. Four references
to the retired name survived, and they were not the four nobody noticed — they
were the four with a migration cost attached:

| Location | Value |
| --- | --- |
| `tauri.conf.json` | `identifier: io.github.swbench.wordscript` |
| `core/providers/groq.rs` | `WORDSCRIPT_APP_IDENTIFIER`, aliased to `GROQ_KEY_SERVICE` |
| `core/providers/groq.rs` (test) | the same literal, asserted |
| `core/updates.rs` | `api.github.com/repos/SW-Bench/WordScript/releases/latest` |

Two of those four are cosmetic and one is not.

**The update endpoint was live on borrowed time.** GitHub answers the retired
path with a 301 to the repository's numeric id, and `reqwest` follows redirects
by default, so the release check worked. It works only as long as nobody
registers the now-free `SW-Bench` organization name; the day someone does, an
in-product update check starts resolving against a stranger's repository. That
is not a cosmetic string.

**The bundle identifier could not be renamed on its own.** `GROQ_KEY_SERVICE`
was defined as the bundle identifier, and `Entry::new(GROQ_KEY_SERVICE, ...)`
is the keyring lookup for the user's Groq API key. Changing the identifier
therefore orphaned the stored key. The app would not have reported an error — it
would have reported *no key configured*, because that is what an absent keyring
entry means, and the user would have been told to go get a key they already
had. A rebrand that presents itself as a missing credential is the exact defect
class the "show runtime truth, and when the runtime is not ready show the next
action" rule exists to prevent.

What is *not* affected is worth stating, because it is what made the change
affordable: `core::paths::user_data_dir` derives `~/.config/WordScript` from the
product name, not from the identifier. Config, history and the runtime log do
not move.

## Decision

**The keyring service name is its own constant.** `GROQ_KEY_SERVICE` is no
longer an alias of the bundle identifier; `WORDSCRIPT_APP_IDENTIFIER` is deleted
because nothing else in the runtime read it. The two strings happen to be equal
today and are free to diverge, which is the point: a brand decision must not be
able to reach into the OS secret store by accident. The identifier moves to
`io.github.sw-forge-org.wordscript` — the literal organization login, and legal
in both the Tauri v2 config schema and `CFBundleIdentifier`, which permit
hyphens.

**A retired service name is migrated, not abandoned.** `LEGACY_GROQ_KEY_SERVICES`
lists the names the key may still sit under. A read that finds nothing under the
current name walks that list, and on a hit copies the secret forward, deletes
the old entry and records the move in the runtime log. Only the service names
are logged, never the secret.

**The migration is on read, and every write purges the legacy names.** Placing
it on read is what makes it invisible to the user: the first call to
`credential_status` after the update already reports the key as configured, so
there is no screen that has to explain the rename. Purging on write is not
tidiness — without it, clearing the key deletes the current entry, leaves the
legacy one, and the next read faithfully migrates the deleted key back. A
credential the user removed must stay removed.

**The store sits behind a trait so the migration is testable.** The keyring is
process-global OS state; a test that exercises the real one writes into the
developer's own secret store, which is the same hazard already recorded for the
runtime log and history. `SecretStore` has three methods, `OsSecretStore`
implements them over `Entry`, and the tests drive an in-memory fake. All five
migration cases — legacy only, both present, neither, clear, save — are asserted
without an OS call.

## Consequences

The first launch after this change re-asks for macOS microphone and
accessibility permission. TCC keys its grants to the bundle identifier, so a new
identifier is a new application to the system. There is no way to carry those
grants across and no reason to pretend otherwise; the changelog says so plainly.

On Windows the installer's upgrade code derives from the identifier, so a build
from before this change is not upgraded in place but installed alongside. This
is acceptable only because there is no public installer yet — `RELEASE_RUNBOOK`
states the usable build is `npm run tauri dev`, and the installed base is
developer machines. The same change after a public release would have needed an
uninstall step in the release notes. Doing it now is the cheap moment, and the
cheap moment does not come back.

`LEGACY_GROQ_KEY_SERVICES` is permanent, not scaffolding. It is one string in a
slice and it costs a single extra keyring read on the path where no key is
configured. Deleting it later would silently strand the key of anyone who
skipped the intervening versions, which is precisely the population least likely
to be watching.

## Related

- ADR 0002 — cloud-first Groq BYOK, which put the key in the OS secret store in
  the first place. This record does not change where the key lives, only what it
  is filed under.
- `docs/known-issues/rust-test-global-state-isolation.md` — the reason the
  secret store is reached through a trait rather than tested directly.
