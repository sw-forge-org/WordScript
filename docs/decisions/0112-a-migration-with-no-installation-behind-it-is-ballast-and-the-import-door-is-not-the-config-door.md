# 0112: A migration with no installation behind it is ballast, and the import door is not the config door

Date: 2026-08-11
Status: Accepted (planning direction; not implemented). Scoped by the owner on
2026-08-11, after
[ADR 0105](0105-a-credential-is-resolved-per-role-and-a-job-never-inherits-one-its-role-cannot-use.md)
added a third compatibility layer to the same secret.

## Context

Stage A3 re-keyed the stored credential to `(provider, role, kind)` and, to do
it safely, had to carry **three** compatibility layers over one API key at once:
the retired bundle identifier `io.github.swbench.wordscript`, the pre-role entry
name `groq_api_key`, and `AppConfig.legacy_groq_api_key` — the plaintext key a
much older build wrote into the config file. The adoption logic that keeps those
three from destroying each other is the most delicate code in that step, and
`docs/handoffs/PLAN_speech-track-implementation.md` records it as *the bug that
is not in the records*.

**The owner's answer, on the same day: there is nothing behind any of it.** This
is a developer install; the stored keys and `config.json` on this machine are
disposable, and a migration does not have to rescue them.

**Two facts in the tree make that more than a preference.**
`docs/STATUS.md` states **no published versioned releases**, and it says the
same thing from the other side: *`check_app_update` honestly reports that no
published releases exist*. Two tags exist (`v0.0.1-alpha`, `v0.2.0-alpha`) and
nothing was distributed from them. So every compatibility path below is carrying
a case that exists on **exactly one machine**, and that machine's owner has
written it off.

**What is being carried.** In `core/config.rs`: `legacy_groq_api_key` (aliased
`groq_api_key`) with `has_pending_legacy_secret`, `try_migrate_legacy_secret`,
`reconcile_legacy_secret_before_save` and the deferred-rewrite branch in
`load_from_disk_impl`; the millisecond timeout fields `result_actions_timeout_ms`
and `mode_select_timeout_ms`; the global `auto_paste` shadow field;
`shortcut_schema_version` with `migrate_shortcut_schema` and
`LEGACY_MODE_HOTKEYS`; `TextProfile::schema_version` with
`migrate_vocabulary_hints`, `migrate_lexical_context_seed` and
`migrate_vocabulary_origin`; `LegacyTextRules` with
`apply_legacy_text_rules_from_value`; `should_reseed_curated_text_profiles`,
which reads raw JSON for profiles written before the work-mode rollout; and
`migrate_global_settings_to_active_profile`. In `core/providers/groq.rs`:
`LEGACY_GROQ_KEY_SERVICES`, `LEGACY_GROQ_KEY_USER`, `read_legacy_api_key`,
`adopt_legacy_api_key` and `clear_legacy_api_keys_in`. In `core/shortcut.rs`:
`parse` accepting pynput tokens (`ctrl_l+f9`), a form only the removed Python
sidecar ever produced (ADR 0091). On the frontend:
`migrateLegacyBiasPolicyToVocabularyHints` and the `auto_detect_mode` fallback
in `src/lib/textProfiles.ts`.

**But "legacy" names three different things in this tree, and only one of them
is this record's subject.** A sweep that matched the word would take the other
two with it, and one of those is a product capability.

## Decision

**A path that exists only to read an older *local* on-disk form is removed
rather than carried.** Not deprecated, not gated behind a version check —
removed, together with the field it reads and the tests that hold it.

**Three kinds of code that look like this and are not, stated so the sweep does
not take them:**

- **Normalization is not migration.** `normalize_provider_value`,
  `normalize_local_profile_id`, `normalize_text_profiles` and their neighbours
  canonicalize *every* value, including one this build wrote a second ago. They
  stay, and a value they correct is not evidence of an old install.
- **A boundary where something foreign arrives keeps its tolerance.** An
  imported archive comes from another machine and another build; an IPC payload
  crosses a process boundary; a shortcut string arrives from the UI. Those are
  not this machine's disk, and their tolerance is a feature rather than a
  residue.
- **A name is not a format.** `insert_transcription_from_legacy` describes an
  insert running from a *legacy session state*, not a stored file shape, and it
  is on the live path. `capture.rs`'s "legacy payload" tests hold event-payload
  compatibility at the IPC seam. Neither is in scope.

**The import door is not the config door, and that is where this record earns
its keep.** `core::backup::import_full_backup` accepts an archive written
elsewhere, and `text_rules.rs` still honours the `stt_hints` string for exactly
that case — its own test says so: *an imported document predates the per-entry
opt-in and carries its phrases nowhere else*. **`stt_hints` therefore stays**,
as a field a foreign document may carry, while the *migration* that rewrote this
machine's profiles into `vocabulary_hints` goes. Deleting the reader because the
migration went is the mistake this paragraph exists to prevent: they are two
different questions about one field.

**The schema counters stay; their migration bodies go.**
`TEXT_PROFILE_SCHEMA_VERSION` and `shortcut_schema_version` cost a `u32` each
and are what makes the *next* migration a gate rather than a rewrite on every
save (D6's defect). Removing the counter would buy nothing and would make the
first migration after this one more expensive than the ones being deleted.

**The price is stated rather than discovered.** After this, a `config.json`
written by an earlier build reads partly as defaults: a pre-seconds timeout, a
global `auto_paste`, a pre-work-mode profile set and a plaintext API key are all
silently ignored instead of converted. **Nobody has such a file but the
developer, and they decided this.** No user-facing sentence is owed, because
there is no user to say it to.

**The window closes at the first published release.** This is cheap exactly
once. From the first distributed build onward, a config on somebody else's disk
is a fact rather than a hypothesis, and the same deletion stops being a cleanup
and becomes a data loss. **So this is not a precedent for deleting migrations
later** — it is the last moment where the cost is zero, taken deliberately
because it was noticed.

**And from here on, a new compatibility path needs a reason.** A field added for
a shape that never shipped is the thing this record is removing; adding another
one during the provider build-out would recreate it. Rename freely before a
release, and carry nothing.

## Consequences

- **`AppConfig::without_secrets()` loses the only field it scrubs.** It clears
  `legacy_groq_api_key` and nothing else, so after this it is an identity
  function — and it is called on every disk write, on every export, and on the
  config-changed event ADR 0108 plans. **It must not be deleted with its
  contents.** The promise it carries is *nothing leaving this runtime holds a
  secret*, the promise outlives its current implementation, and a later field
  that does hold one has to land inside a function that already exists. Deleting
  it would make that field's author invent the rule again.
- **`backup::snapshot_config` loses the caller A3 gave it.**
  `try_migrate_legacy_secret` is the only user outside export, import and reset,
  and it was why the helper became `pub(crate)`. Either A4's config migration
  becomes the next caller and the visibility stays, or it goes back to private
  in the same step — an unused wider visibility is the same defect class as a
  registered command with no caller (ADR 0089, ADR 0103).
- **A3's per-role rules are untouched.** `(provider, role, kind)`, the fan-out
  across registered roles, the refusal of an inadmissible kind and *clearing one
  role does not clear another* are the contract (ADR 0105, ADR 0102). What goes
  is only the adoption of a pre-role entry that no longer exists anywhere. The
  tests that hold the *rules* stay; the tests that hold the *migration* go with
  it, and the difference is which sentence the test name makes.
- **`ARCHIVE_VERSION` does not move.** The archive format is not what changes
  here, and bumping it would refuse this machine's own exports for no reason.
- **This is cheapest before ADR 0094's config half** (plan step A4). That step
  rewrites the provider axis in the same file; doing it after this one is a
  smaller edit against a smaller file, and it inherits the owner's licence to
  fall back to defaults rather than build a rescue path.
- **It schedules itself nowhere.** ADRs decide shape; the sequence is
  `docs/handoffs/PLAN_speech-track-implementation.md`, which carries this as
  step A5.
