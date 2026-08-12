# Implementation plan — the speech track

Opened 2026-08-11, after stage one closed with fifteen records and no code.
**This is the sequence the records do not carry.** ADR 0096 fixes the order of
the *adapters* and names two preconditions; it does not order the preconditions
themselves, and six further records carry no position at all. That gap is what
this page closes.

**It is a living document.** Each step gets its status here as it lands. The
records stay append-only and are not edited to match progress
(`speech-track.md` is stage one's account and is not updated by this
work either).

---

## How to read a step

Every step carries four things, and a step missing one of them is not ready to
start:

- **Requires** — what must be true before it begins. A step whose requirement is
  an owner decision is blocked, not slow.
- **Touches** — which side of the seam moves. This decides the validation.
- **Validates** — the commands that must pass, plus the assertion specific to
  this step. *Suite unchanged* means the baseline below, not "green".
- **Done when** — the observable fact, never "the code is written".

**The baseline every step measures against:** 474 frontend tests across 39
files, `cargo test` 740 passed / 3 ignored, `cargo check` 15 warnings (read the
summary line, not a count of `^warning` matches — it is always one high). A step
that changes a count says by how much and why, in its commit.

**The baseline moves as steps land, and only for what they moved.** After A2:
`cargo test` **748 passed / 3 ignored**, and the frontend suite reads **480
across 39 files** — the six extra cases are `b330815`'s sidebar work, not this
track's. `cargo check` stays at 15. A step compares against the last line here,
not against the opening one. After A3: `cargo test` **760 passed / 3 ignored**,
frontend **480 across 39 files** unmoved, `cargo check` still 15. **After A5 the
Rust baseline goes down for the first time**: `cargo test` **742 passed / 3
ignored** (−18, every one a case that held a migration), frontend **480 across
39 files** unmoved, `cargo check` still 15. Then **747** (`69f8c75`'s
transcription-coverage instrument, +5 — another track, measured here so the
next step does not read it as its own). After A4: `cargo test` **755 passed / 3
ignored** (+8), frontend **480 across 39 files** unmoved, `cargo check` still
15, `npm run port:diff` `ALL EXACT`. **After A6 not one of the four moved**,
which for a rename is the whole signal. After B3: `cargo test` **767 passed / 3
ignored** (+12), frontend **492 across 40 files** (+12), `cargo check` still 15,
and `port:diff` moved on one screen — see the paragraph below, which is where a
step that moves it has to say what it moved. After B1: `cargo test` **770 passed
/ 3 ignored** (+3), frontend **517 across 42 files** (+25 in two new files),
`cargo check` still 15, and `port:diff` **unmoved** at B3's
`structural 6 | style 213 | text 12` — the seam changes why a wired control is
inert and the gallery has no runtime, so a moved count there would have been the
warning rather than the deliverable.

After D1: `cargo test` **787 passed / 3 ignored** (+17), frontend **521 across
42 files** (+4), `cargo check` 15, `port:diff` unmoved. **After B6 the frontend
reads 530 across 42 files** (+9) with `cargo test` untouched at 787 — the step
is frontend-only and a moved Rust count would have meant it did something it did
not say it would. **B6 is also the first step on this page to move `port:diff`
deliberately**, and it reports the two halves separately because they separate:
see its entry.

**Do not measure a baseline by stashing this tree.** B1 did, to get the
before-number honestly, and `git stash push -u` swept the owner's live
`shell.css`, `Nav.tsx` and `useConfigDraft.ts` edits in with the step's own; the
pop then aborted on `shell.css`, which the owner's editor had written again in
the meantime, and left every tracked change of the step in the stash while the
tree looked merely clean. What recovered it was `git checkout stash@{0} -- ` and
an explicit path list. **Three tracks share one working tree** — read the
before-number off `git show HEAD:<file>` or a scratchpad copy instead.

**The frontend suite flakes under load on this machine, and it is not a step's
doing.** A full run that starts cold can drop one to three cases to `waitFor`
timeouts, in different files each time; measured on the clean tree at A4's
baseline as three failures across `WorkspaceWindow`, `Profiles` and `screens`,
and on A4's own tree as two in `WorkspaceWindow` — both green on every rerun.
A step reporting a frontend failure should rerun before reading it as a
finding.

**`models` does not read `6 | 6` any more, and B3 is not why.** ADR 0088's
figure is structural and style; measured on a stashed tree at `HEAD` before this
step's files existed, the screen reads **structural 6 | style 191 | text 6**,
twice, with 107 width, 43 padding, 29 height and 12 min-width differences and
the two content columns 60 px apart after the harness's own compensation. B3
left it at **structural 6 | style 213 | text 12**, and that movement is its own:
the corrected Anthropic ids are shorter than the drawn ones, so they lay out
narrower. **A step that quotes `6 | 6` from a record rather than measuring it is
quoting a number that stopped being true**, and the structural half — the one
ADR 0088, 0096 and 0109 each pin — is the half that has held.

**The rules no step may break**, restated from the records because a plan is
where they get quietly dropped: no partial result reaches the session reducer
(ADR 0018, 0019, 0095); no generic resize command returns (ADR 0089, 0100);
nothing mounts (ADR 0057, and `ia.test.tsx`'s last case asserts it); no drawing
grows outside the gallery (ADR 0057, 0088); no adapter lands before the row that
operates it (ADR 0109); never `--no-verify`; never `pkill -f`.

---

## Stage A — the runtime contract

**No vendor, no drawing, no migration of anything a user typed.** This stage
exists so that everything after it has one shape to land in. It is also the
cheapest stage to get wrong late: every later step multiplies its mistakes by
ten providers.

### A1. Traits and registry (ADR 0094)

**The first session.** It is the only precondition with no precondition of its
own, and both of the others need what it produces.

- **Requires** — nothing.
- **Touches** — `src-tauri/src/core/providers/` only. `mod.rs`'s eight top-level
  functions become thin resolvers over a registry; `groq.rs` and
  `local_preview.rs` move behind `SpeechProvider` / `ChatProvider`;
  `VoiceProvider` is declared and implemented by nobody.
- **Validates** — `cargo test` at **740 / 3 ignored, unchanged**, `cargo check`
  at 15 warnings. **Nothing in `src/` changes**, so `npm test` and
  `npm run build` are unchanged by construction; run them anyway, because "I did
  not touch the frontend" is a claim and the suite is the check. Every `invoke(`
  in `src/` still resolves against `invoke_handler`.
- **Done when** — the `ProviderId` enum is gone, adding a provider is a module
  plus a registry line, and **a provider that does not serve a role does not
  implement it** — `local_preview` and `groq` both compile without a
  `VoiceProvider` stub.

**Why it is a pure refactor and must stay one:** two providers in three traits
is more code than two arms in eight functions, and buys nothing today. Its whole
value is that A2, A3 and every adapter have somewhere to attach. **If this step
changes behaviour, it has failed** — 740 unchanged tests are the proof, and the
temptation to "fix one small thing while in here" is what makes a refactor
unreviewable.

### A2. Capability axes (ADR 0110)

- **Requires** — A1.
- **Touches** — `ProviderCapabilities` gains `speech_synthesis`; a **model-level**
  capability type appears carrying `transcription_streaming`,
  `reports_detected_language`, `synthesis_streaming`. `src/types/providers.ts`
  mirrors both.
- **Validates** — `cargo test`, and a test that the two axes answer differently
  for one provider: **OpenAI is not integrated yet, so use the fixture that
  proves the shape** rather than waiting for the vendor. `npm run build` for the
  mirror.
- **Done when** — asking "does this stream" requires a `(provider, model)` pair
  and cannot be answered from a provider alone.

**The precedent is already in the tree:** `capture_limits(provider, model,
tier_id)` in `providers/mod.rs:189` already takes both. This step generalizes an
existing shape rather than inventing one.

### A3. Credential per role (ADR 0105, ADR 0102's storage half)

- **Requires** — A1 (roles must exist to key on).
- **Touches** — `SaveProviderApiKeyRequest` and `clear_provider_api_key` grow
  role and kind; the `SecretStore` entry becomes `(provider, role, kind)`;
  `provider_status` answers per role; **a config migration with a backup path**
  (`core::backup` is the pattern — a migration without a snapshot is not
  written).
- **Validates** — `cargo test`; a migration test that an existing single-string
  credential lands on the right `(provider, role, kind)` and that **clearing one
  role does not clear another**; `invoke_handler` against every `invoke(` in
  `src/`, because two command signatures change.
- **Done when** — "follow the connection" resolves the provider and looks the
  credential up per role, and a role with no credential returns *inert plus the
  name of what is missing* rather than another role's credential.

**Not in this step:** the OAuth flow. A3 is the shape a token set will be stored
in; acquiring one is D3.

### A4. The provider axis in the config (ADR 0094's second half)

**Added 2026-08-11, while A3 was being planned.** It is the one record this page
carried no position for and did not notice: ADR 0094 splits the provider axis in
the config as well as in the dispatch, `docs/spec/SPEC.md` has said *not built*
about it since A1, and no step here claimed it. A3's *config migration* line
reads as if it did, and it does not — A3 re-keys a **credential**, which is a
different thing in a different store.

- **Requires** — A1, A3. The credential resolution has to exist first, because
  an override is exactly the case where a job's provider and the connection's
  differ, and resolving a credential across that difference is the security rule
  (ADR 0094). **A5 is not a precondition and still runs first** — see its own
  entry for why.
- **The migration may fall back to defaults.** The owner scoped this on
  2026-08-11 (ADR 0112): this machine's `config.json` is disposable, so a stored
  value that does not map cleanly onto the new shape is dropped rather than
  rescued. The `core::backup` snapshot stays anyway; it costs two lines and the
  record requires it.
- **Touches** — a profile stops holding one `provider` field and starts holding
  a resolved default plus a **sparse override per job**; the resolver returns
  the provider and, through A3, which credential answers for it. Every call site
  that reads `config.provider` today — `transform`, `translate`, `agent`,
  `prompt_enhance`, `transcript_store`, `history`, `lib.rs`'s transcription —
  asks for its job's provider instead. A config migration, therefore a
  `core::backup` snapshot.
- **Validates** — `cargo test`; a migration test that a config holding one
  provider lands on the same resolved default with no override; a test that an
  overriding job takes its own credential and **never the default's**.
- **Done when** — *recognize with Groq, transform with something stronger* is
  expressible, and a job that overrides names both its provider and its
  credential.

**Not in this step:** the drawing. `Models.tsx` already draws the override and
the per-job key row (`Follows`, the `override && ...` branch) — this is the
runtime catching up to a drawing that has been ahead of it since Leg 6.

**Where it sits:** it blocks nothing scheduled before D1 and D1 does not need
it — one connection is enough for one adapter. It is a precondition for the
*second* adapter being useful, which is where "one provider per profile" stops
expressing what the user has.

### A5. Drop the on-disk compatibility layer (ADR 0112)

**Added 2026-08-11, and it runs before A4.** A3 had to carry three
compatibility layers over one API key to re-key it safely; the owner's answer
was that nothing is behind any of them. `docs/STATUS.md` says it in the tree —
**no published versioned releases**, and `check_app_update` reports the same —
so every one of these paths serves a case that exists on one machine whose owner
has written it off.

- **Requires** — A3. The adoption of a pre-role credential entry is one of the
  paths being removed, so removing it first would have meant re-keying without
  one.
- **Touches** — `core/config.rs` loses the legacy secret field and its three
  helpers, the millisecond timeout fields, the global `auto_paste`, the shortcut
  and profile migration bodies, `LegacyTextRules`,
  `should_reseed_curated_text_profiles` and
  `migrate_global_settings_to_active_profile`; `providers/groq.rs` loses the
  retired service names, the pre-role entry and the adoption path;
  `core/shortcut.rs` stops accepting pynput tokens, a form only the removed
  sidecar produced (ADR 0091); `src/lib/textProfiles.ts` loses its bias-policy
  migration and the `auto_detect_mode` fallback. **The schema counters stay**
  and so does `without_secrets()` — read ADR 0112's consequences before deleting
  either.
- **Validates** — `cargo test` and `npm test`, both **down** by the cases that
  held a migration and unchanged in every case that holds a rule; the difference
  is which sentence the test name makes, and the step states the count and the
  reason per suite. `npm run build`. A test that a config written by *this*
  build still round-trips, because that is the shape the removal must not touch.
- **Done when** — no field exists whose only purpose is to read a shape this
  build does not write, and `stt_hints` still applies to an imported document
  (ADR 0112's import door).

**Not in this step:** any tolerance at a boundary where something foreign
arrives — the archive import, IPC payloads, a shortcut string typed into the UI
— and any name that says *legacy* about a state rather than a format
(`insert_transcription_from_legacy` is on the live path). A sweep matching the
word takes all three; ADR 0112 separates them and is the brief.

**Why before A4:** A4 rewrites the provider axis in `core/config.rs`, the same
file this step shrinks. Doing it second is a smaller edit against a smaller
file, and A4 then inherits the licence this step establishes — fall back to
defaults rather than build a rescue path.

### A6. `local_preview` becomes `local` (ADR 0121)

**Added 2026-08-12.** A rename, not a behaviour change — and it belongs in
Stage A because the provider id *is* the runtime contract A1 built the registry
around.

- **Requires** — nothing. **Independent of A4**, which rewrites the provider
  axis in `core/config.rs` while this renames a value moving through it. Doing
  A4 first means one fewer string to rename; doing this first means A4 is
  written against the final name. Either order works, neither blocks.
- **Touches** — 177 references across 43 files: the registry id (the existing
  `aliases: &["local"]` becomes the id and the alias list empties), the
  `local_preview` module and its `LOCAL_PREVIEW` static, `ProviderId` in
  `src/types/providers.ts`, the `local-preview-{model}-{preset}` profile prefix
  in `local_profile_selection_from_id` and its emitter, and the living docs.
  **The ADRs keep the old name** — records are append-only and correct as of
  their dates.
- **Validates** — `cargo test`, `npm test`, `npm run build`. The rename is
  mechanical, so the signal is that no count moves.
- **Done when** — no live path spells `local_preview`, and the preview badge is
  exactly where ADR 0067 put it.

**No compatibility alias and no dual profile prefix**, on the owner's
instruction: this is a development install and the stored data does not matter.
A5 removed every on-disk compatibility path, so adding one back here would
reverse that decision within the same plan. A stale profile id resolves to
`None` and falls through to `"base"` at the default preset; a stale
`provider` value is re-picked once.

**What this step does not do:** publish the lane. ADR 0067's presentation rule
is untouched and the badge stays until Phase 5. The point of the rename is that
when Phase 5 lands, the badge comes off and **nothing gets renamed**.

---

## Stage B — the seam and the ninth job

First frontend contact. **Every step here that grows the drawing goes through
the gallery** (ADR 0057) and `npm run port:diff` moves with it. **B5 is the
exception and it is worth naming**: its surface was drawn in Leg 6 and has been
inert since, so it makes a drawing live rather than growing one — there, a moved
`port:diff` count is the warning rather than the deliverable.

### B1. The capability seam (ADR 0106)

- **Requires** — A1, A2.
- **Touches** — `AI Models` starts reading `provider_status().capabilities`
  instead of inferring from `src/screens/data.ts`'s `PROVIDERS` table. The drawn
  table stays; it stops being the answer to *can this be operated*.
- **Validates** — **two tests, and the step is not done with one**: (a) a
  provider whose capability denies a role produces a row that cannot be operated
  and says why; (b) the TypeScript mirror still matches the Rust struct. `npm
  test`, `npm run build`, `npm run port:diff` reading `models` at 6 | 6.
- **Done when** — `Models.test.tsx` can no longer mock `capabilities: {}` and
  pass. **That failing mock is the deliverable** — it is the first moment the
  mirror carries load.

**Three inert reasons, three sentences.** A row may be inert because no adapter
exists (0096), because the runtime denies the role (this step), or because a
credential is missing for that role (A3). One greyed control with one hint
conflates them, and the surface has drawn vocabulary for all three.

### B2. `voice` and `translation_voice` become the ninth and tenth jobs (ADR 0109, ADR 0119)

**Widened 2026-08-11.** It was one job; ADR 0119 answered the drawing question
it deferred and the answer is two.

- **Requires** — nothing technical. **Independent of A and B1** and can run in
  parallel.
- **Touches** — `JobKey` gains **`voice` and `translation_voice`**; `LANES`'s
  `Record<JobKey, LaneJob>` either gains entries per lane or the type says these
  jobs are off the lane axis. **The `Speaking` group is already drawn off-axis,
  so the type follows the drawing** — inventing four lane rows apiece is the
  failure mode. Both resolve the `Voice` role, so **one credential per provider
  serves both** (ADR 0105) and neither is admissible for a subscription
  (ADR 0102) — those rules need no change, only a second name to hold.
- **Validates** — `npm test`, `npm run build`, `port:diff` at 6 | 6 **until the
  second row is drawn**, and at whatever the gallery settles on after.
- **Done when** — ADR 0094's `VoiceProvider`, ADR 0102's inadmissibility rule
  and ADR 0105's role resolution all name jobs that exist, and
  `Translate.tsx`'s *Open AI Models* button has a row to point at.

**Where the translation voice sits is no longer open** (ADR 0119): two rows in
the `Speaking` group, because a persona and a channel need different languages,
different latencies and different budgets. **The route stays per language; the
model does not** — one connection serves both directions of one conversation,
and the per-language voice is chosen on that row because on some lanes the voice
*is* the model id.

**Not in this step:** the drawing. Two rows is a decision; two rows on a screen
is a gallery change (ADR 0057), and the preset select outgrows two options the
moment it carries seven providers.

### B3. The model catalogue (ADR 0115)

**Added 2026-08-11 by the vendor-intake pass.** It is the step open disagreement
5 has been asking for since the survey was written, and the one no record had a
position for.

- **Requires** — A1 (provider ids to key rows on), A2 (`ModelCapabilities`'s
  vocabulary exists, so the schema does not invent a second one). **Independent
  of B1 and B2** — runs beside either.
- **Touches** — one versioned data file carrying `(provider, role, model_id,
  documented streaming, languages, source, read_date)`; a Rust loader over
  `include_str!` behind a version constant — **the shape
  `core::regression_corpus` already has, including the schema file beside it**;
  the frontend importing the same file so `LANES[lane].jobs[job].models` stops
  being a literal array. Every lane keeps its free-typed model id **beside** the
  catalogue list, not instead of it. `core/config.rs`'s
  `DEFAULT_CORRECTION_MODEL` and its neighbours resolve from the catalogue.
- **Validates** — `cargo test`: every row's provider resolves against the
  registry; **every row carries a non-empty source and read-date**, which is the
  rule `docs/PROVIDERS.md` states in prose and nothing enforces; a model absent
  from the catalogue still round-trips as a typed override rather than being
  refused. `npm test`, `npm run build`. `npm run port:diff` moves with the
  drawing, at whatever count the gallery settles on.
- **Done when** — no Rust adapter and no `data.ts` entry spells a model id as a
  literal outside that file, and adding a model to a lane is a data row rather
  than an edit in two languages.

**Why Stage B and not Stage A.** Stage A is the runtime contract, and none of
A1–A5 names a real vendor's model. This step names dozens, and it changes
`LANES` — so it is drawing-adjacent and grows in the gallery, which is what
Stage B is for. **Why not later:** D1 is the first step that would otherwise
hardcode a vendor's model ids the old way, and a catalogue landing after D1 is a
retrofit of the thing the catalogue exists to prevent.

**The trap this step must not fall into.** The catalogue is not
`ModelCapabilities` and must not be derived from it or into it. One records what
a vendor documents, the other what an adapter asserts; a catalogued model with
no adapter answers `unknown`. ADR 0115 states the distinction and ADR 0106 is
the record of what happens when a mirror gets described as a guard.

**Scope narrowed 2026-08-12 by ADR 0120.** The catalogue is no longer *every id
a vendor serves* but *every id this build routes to, defaults to, or makes a
statement about*. The long tail arrives live in B4 instead. **The file format,
the loader and the source/date test are unchanged** — this is fewer rows at
landing, not a different step.

**Built 2026-08-12, and four choices this page left open were taken.**

- **The file is `shared/model_catalogue.json`, outside both trees.** It has two
  readers and neither owns it; putting it under `src-tauri/` would have had the
  frontend importing across the seam, and under `src/` the reverse. The schema
  sits beside it, as the regression corpus does.
- **A row is named by a slug, never by its model id.** `anthropic-chat-sonnet`,
  not `claude-sonnet-5`. Naming rows by the id would have moved the rename
  problem instead of solving it: a vendor's next generation would still be an
  edit in every referring file. This is the property that makes *adding a model
  is a data row* true, and it is what let the stale Anthropic ids be corrected
  in one place.
- **`every row's provider resolves against the registry` was implemented in the
  only direction that holds.** A catalogue that could name only registered
  vendors could not carry the rows an adapter is written against, and ADR 0115
  requires catalogued-but-unadapted to be expressible — three of the six vendors
  in the file are exactly that. So: every row names a vendor the file declares,
  every declared vendor carries rows, **every registered vendor carries a row
  for every role it serves**, and every row on an unregistered vendor is
  asserted to answer `ModelSupport::Unknown`.
- **The drawing's half is validated in Rust as well as in TypeScript**, because
  the file is compiled into the binary: a lane offering a row that does not
  exist should fail `cargo test` rather than an npm run.

**What it did not absorb.** The local speech *stem* — `base`, resolved by
`core::providers::local` to `ggml-{stem}.bin` — stays a literal, because a file
on this disk is not a vendor's model id. The drawn library's sizes and
quantizations moved from JSX into `data.ts` beside the slug each row names and
are B5's to take (ADR 0122, `CATALOGUE_VERSION` 2). Model ids in test
assertions stay: a literal in an assertion is a check on what a surface renders,
and one that breaks when a row moves generation is doing its job.

### B4. The live model fetch (ADR 0120)

**Added 2026-08-12** on the owner's objection that curating eighteen vendors by
hand is stress for no gain. It is the layer above B3, not a replacement for it.

- **Requires** — **B3** (there has to be something to merge into), A1 (the
  registry to ask per provider), A3 (the credential the call carries).
- **Touches** — an optional listing method on `Provider`, implemented only by
  the lanes that have an endpoint; the settings surface calling it on open; the
  merge that unions fetched ids over catalogue rows.
- **Validates** — `cargo test`: a fetched id absent from the catalogue answers
  `ModelSupport::Unknown` and never `supported`; an empty, failed or
  unauthenticated fetch leaves the catalogue list standing; a late result is
  discarded against the surface that asked. `npm test`, `npm run build`.
- **Done when** — a lane with an endpoint shows ids this repo never typed, a
  lane without one is unchanged, and no lane shows an empty picker because a
  call failed.

**What has no endpoint is not a gap.** Azure OpenAI serves no model list by
construction — the deployment name is the model id — and Bedrock and Vertex need
cloud SDK credentials. Those rows show the catalogue plus the typed field, which
is what ADR 0115 already specified for them.

**The precedent is the local lane, and all of it is adopted.**
`local_preview.rs` fetches, then reconciles the request against what came back
(`resolve_local_chat_model`), then falls back. The reconcile step is the part
that is easy to drop and the part that makes the fetch safe.

### B5. In-app model installation for the local lane (ADR 0122)

**Added 2026-08-12 on the owner's instruction**, which moved it out of
`docs/ROADMAP.md`'s Phase 5 and into this track directly behind B3. It is the
one step here whose surface is already finished: `Models.tsx`'s `MachineTab` and
the `Onboarding.tsx` first-run step have drawn sizes, a `downloading` state with
a percentage, an installed total and *Open the model folder* since Leg 6, with
nothing behind any of it.

- **Requires** — **B3** (the catalogue the install block grows on). **B4 is not
  a precondition**: the Ollama listing it would add for this lane is already in
  the tree as `fetch_local_chat_models_async`, so what the language half adds on
  top is the pull, not the list.
- **The two halves do not share a disk, and that is the step's whole shape**
  (ADR 0122). The local chat role talks to Ollama — `127.0.0.1:11434`,
  `GET /api/tags`, `POST /api/chat`, the failure text that says *Start Ollama* —
  and Ollama owns its store. So WordScript **downloads** the speech weights into
  a directory it manages and **asks the server to pull** the language ones,
  never placing a file beside them. One tab, kept for the memory argument that
  survives ADR 0042's reasoning; two mechanisms inside it, each named on its own
  card.
- **Touches** — `CATALOGUE_VERSION` 1 → 2 for an additive
  `install: Option<InstallSource>` with `Download { url, size_bytes, sha256 }`
  and `ServerPull { runtime, tag, size_bytes, quantization }` — **the pull tag
  beside `model_id`, not derived from it**, because `qwen2.5:7b-instruct` and
  `qwen2.5-7b-instruct` are not the same string. A managed directory off
  `core::paths::user_data_dir`, so it inherits `WORDSCRIPT_DATA_DIR` and the test
  redirection. A new installer module. Three commands. A **new**
  `wordscript-model-event` channel — never the two session channels (ADR 0018,
  0019). `discover_local_provider_profiles` gains the managed directory as a
  third source **after** both environment variables, and
  `fallback_provider_profiles` stops naming files that do not exist. The drawn
  size and quantization literals in `Models.tsx` and `Onboarding.tsx` resolve
  from the catalogue — the last entries on ADR 0115's own inventory.
- **Validates** — `cargo test`: a checksum mismatch removes the part file and
  installs nothing; an install completing after its cancel is discarded and
  reaches the runtime log only; an installed model is found with no environment
  variable set; a catalogued model with no file is *installable* and never
  *available*; removing a model a profile resolves to is refused **and names the
  profile**; every `Download` row carries a size and a checksum. `npm test`,
  `npm run build`. `npm run port:diff` **at whatever count B3 leaves it** — the
  rows come alive, they do not change shape, so a moved count is the warning
  here rather than the deliverable. **The native host, not jsdom** — progress is
  `invoke()` plus an event bridge, and four legs have found a defect exactly
  there. The advisory sweep, because `reqwest` gains `stream` (this build has
  `default-features = false`) and `sha2` is new.
- **Done when** — a model chosen in the drawn list downloads with progress, is
  found afterwards without any environment variable, and no row anywhere claims
  a model that is not on the disk.

**Not in this step:** publishing the lane. ADR 0067's preview badge stays until
Phase 5 and ADR 0121 renamed the identifier so that nothing gets renamed when it
comes off. Nor the *bundled versus yours* server question — that is Phase 5 and
F3's decision one level down, taken once (ADR 0096); this step commits only to
talking to the server the user runs.

**ADR 0042's gate closes here and not before.** *Until in-app installation
exists, the local lane is expert configuration and the surface says so* — that
sentence has been live since 2026-08-03 and this is the step that owes it.

### B6. What it means to wire an inherited drawing (ADR 0128)

**Added and done 2026-08-12, on the owner's instruction**, after three steps in
a row reached the same wall and stepped around it. B1 declined to give a job row
a config target; D1 wired the connection and left the override select dead; and
two false drawn sentences sat on `docs/PROVIDERS.md`'s list because correcting
them read as a drawing change nobody was allowed to make.

- **Requires** — B1 (the seam supplies the reasons) and D1 (a second vendor is
  what makes the disagreement visible). Both done.
- **Touches** — `Models.tsx`'s `Follows`, which stops reading `data.ts`'s
  `override` literal in the product and reads `providers.overrides[job]`
  instead; a writable select through `buildProfileProvidersPatch`;
  `credentialStateFor` in the seam; the three Self-hosted `none:` sentences and
  `OpenRouter`'s `stt` boolean in `data.ts`.
- **Validates** — `npm test`, `npm run build`, `npm run port:diff`, and the
  override half must leave `models` **unmoved** while the `stt` correction moves
  it by exactly one option per row.
- **Done when** — no control on this screen claims a state nothing stored, and
  an unbuilt vendor is still visible with its reason rather than deleted.

**The gate was misread, and that is the finding.** *The gallery owns the
drawing* (ADR 0057) had hardened into *nothing inherited may be corrected*. That
record says the opposite in its own decision: after Leg 2 the product wins over
the prototype and a difference is **either an ADR or a bug**. Leg 13 is open.

**The rule this step establishes, and the reason it is not local to one screen:**
the demo GUI was drawn before anyone knew how any of it would be implemented, so
it cannot answer a representation question the runtime only just made
answerable. It is an inventory of intent. What works is stated from the config;
what is unbuilt stays visible and inert with its reason, because that list is
what the build is steered by; a false sentence is corrected; what is missing is
added. **The line between the second rule and fake readiness is what is being
claimed** — greyed with a sentence shows a possibility, a green `Set` badge
asserts a stored state.

**As it landed.** `port:diff` separated cleanly, which is what makes the two
halves reportable apart: the override rework leaves `models` at
`structural 6 | style 213 | text 12`, exactly where B3 left it, because the
gallery has no config and keeps rendering the drawn literal. The `stt`
correction moves it to `structural 9 | style 217 | text 12` — one option on each
of three rows — and the movement was verified by reverting the single boolean
and watching the count return exactly.

Three things the plan did not ask for and the implementation owed anyway. **The
provider select escapes its own row's inert reason**, because a row inert for
want of an adapter is a row whose fix is that select, and it was disabled by the
sentence explaining the problem. **A missing credential does not disable an
option** while a missing adapter does — ADR 0106's distinction, load-bearing in
a control for the first time. And **`credentialStateFor` is three-valued**:
`registered_providers` reads no keyring, so a badge resolving absence to either
*set* or *not set* invents one of them.

**Six frontend cases were each made to fail before they were trusted**
(ADR 0124), in two passes, because three of them assert a shape and three assert
a capability that did not previously exist: reverting the shape source failed
the first three, removing the writer and the reason-carrying options failed the
other three.

**D1a loses its drawing half**, which this step spent. It is now the adapter
alone, and that ordering is ADR 0109's — the row comes before the adapter.

---

## Stage C — capture

**Independent of A, B and D.** It can run concurrently with the whole provider
build-out and shares no file with it. It is scheduled here because everything in
G waits on it.

### C1. Separate the stream from the recording (ADR 0107)

- **Requires** — nothing.
- **Touches** — `core::capture`. Session open/close as a third and fourth entry
  point beside `start_native_capture` / `stop_native_capture`, which **stay
  exactly as they are** for dictation. A recording window per turn.
  `max_samples` becomes a turn ceiling.
- **Validates** — `cargo test`; a test that a session produces N recordings with
  N integrity verdicts; **and the dictation path is byte-identical** — the
  existing capture tests are the guard and must not be edited to accommodate
  this.
- **Done when** — a turn is a recording that `CaptureIntegrity`,
  `capture_budget` and `transcribe_audio_file` accept unchanged.

**Which of `started_at`, `accumulated_paused` and the mute accumulator reset per
turn and which accumulate per session is the first real decision**, and getting
it wrong makes every verdict after the first wrong in the same direction.

### C2. The runtime mute (ADR 0098)

- **Requires** — C1 (it must hold the segmenter, which C1 introduces).
- **Touches** — a third capture state beside `muted` and `paused`, its own
  accumulator, `is_recording()` as a derivation over both writers.
- **Validates** — `cargo test`; a test that the mute stretch comes off
  `effective_elapsed` so a spoken reply does not push a conversation toward
  ADR 0079's `short` verdict; and that **the user-facing mute is untouched**.
- **Done when** — the machine can stop listening without the overlay showing a
  paused state the user did not ask for.

### C3. The soak night (ADR 0084)

- **Requires** — nothing. **Can start tonight and should.**
- **Touches** — no code. `capture-soak` exists and has never run longer than
  seconds.
- **Done when** — there is a number for the open 12–52 % loss across a
  multi-hour hold.

**Done 2026-08-12. The number is zero.** 96 segments, 8.00 h of open stream,
every one `Intact` with `signature=no_gaps`, worst segment 0.01 %, against a
rate that predicted about eight events. Per ADR 0084 this moves the suspicion
into the app rather than clearing PipeWire, and Route B — the real app, silent —
is the next step. **The gate is satisfied: it asked for a measurement, not a
cause.** Stage G is unblocked and still ships on a stream with an unexplained
failure history, which is a different sentence from an unmeasured one and has to
be said that way on the surface.

**This is a gate, not a step.** Stage G ships a conversation surface on the
input stream that carries
[known-issues/capture-loses-half-the-recording.md](../known-issues/capture-loses-half-the-recording.md).
Shipping it before this measurement is the fake-readiness defect one layer down,
and ADR 0098 says so in its own consequences.

---

## Stage D — the first adapter

### D1. OpenAI, batch speech and chat (ADR 0096 step 1)

- **Requires** — A1, A2, A3, B1, **B3** (its model ids are catalogue rows, not
  literals — added 2026-08-11).
- **Touches** — one new provider module plus one registry line. **If it touches
  anything else, stage A was incomplete** and the fix belongs there. **One
  addition from ADR 0113:** the request building for
  `/audio/transcriptions`, `/audio/speech` and `/chat/completions` lands as a
  helper parameterized by base URL and credential rather than inline, because
  `groq.rs` already builds the same three paths against `GROQ_API_BASE` and D1a
  needs the third and fourth caller. **Extracting it here costs a parameter;
  extracting it after D1a costs a refactor of three call sites.**
- **Validates** — `cargo test`, `npm run audit` after the dependency change, and
  the surface still says what is true for every lane that is still inert. **Plus
  one from ADR 0113:** a test that Groq and OpenAI reach the shared helper
  rather than each building the request themselves.
- **Done when** — a second lane can be operated, and `AI Models` **keeps its
  banner**, because the screen is whole only when the last lane lands.

### D1a. OpenRouter and Self-hosted speech, on the shape D1 extracted (ADR 0113)

**Added 2026-08-11.** It is not a new adapter shape. It is D1's shape reaching
two more lanes for a base URL, which is what ADR 0113 found in `groq.rs:407`.

- **Requires** — D1 (the shared helper), A3 (both resolve a credential per
  role), B3 (both lanes' model ids are catalogue rows). **Not gated on a drawing
  answer** — unlike F1.
- **Touches** — two registry entries: `openrouter`, and the Self-hosted lane
  gaining `SpeechProvider`. Both call D1's helper with a different base URL.
  OpenRouter's is `https://openrouter.ai/api/v1`; Self-hosted's is the URL the
  user typed, gated by `isSecureEndpoint` — HTTPS **or** a private host.
  **Their operational ceilings are not shared**: OpenRouter documents a
  60-second upstream timeout and 25 MB multipart, which `capture_limits` already
  answers per provider and model and must keep answering separately.
  `src/screens/data.ts`'s Self-hosted `none:` sentences on `dictation`,
  `meetings` and `upload`, and `OpenRouter`'s `stt: false`, are corrected in the
  same commit — **a drawing, so the gallery first** (ADR 0057, open
  disagreements 10 and 11).
- **Validates** — `cargo test`: a fixture per lane proving the helper is called
  rather than copied; a test that a self-hosted URL failing `isSecureEndpoint`
  is refused **before** a token is attached to it. `npm run port:diff` at the
  settled count.
- **Done when** — two lanes the drawn matrix currently calls deaf can
  transcribe, and a third OpenAI-compatible vendor after them costs a base URL
  and a registry line.

**Why this step matters more than its size.** ADR 0096 pins OpenAI, Groq voice
and Local, and leaves the rest unordered; this recommends where OpenRouter's and
Self-hosted's *speech* role lands inside that remainder. **If F1 stays gated on
the owner's drawing answer, this is the ungated path to a second and third
working speech lane** — and through OpenRouter it is also the path to four
vendors' synthesis without a module each. It does not touch their *chat* role,
which stays in G3, and it does not amend ADR 0096.

**Not in this step:** self-hosted *synthesis*. ADR 0113 is scoped to
`/v1/audio/transcriptions` because that is what was read; whether a user-run
server answers `/v1/audio/speech` as reliably is unverified, and a `voice` role
on that lane needs its own reading first.

### D2. The streaming contract (ADR 0095)

- **Requires** — D1, C1.
- **Touches** — `Partial` / `Final` beside `transcribe_audio_file`, a websocket
  transport (`reqwest` does not carry one — a dependency decision), OpenAI
  Realtime as the first true-streaming implementation, resampling **inside the
  adapter** (24 kHz against `TRANSCRIPTION_SAMPLE_RATE`'s 16 kHz).
- **Validates** — `cargo test`, and **a test that no partial result reaches the
  session reducer** — ADR 0095 requires this to be held by a test rather than a
  comment, and this is the step that owes it.
- **Done when** — one contract serves a lane that streams and a lane that does
  not, and the caller cannot tell which without asking the `(provider, model)`
  pair.

**Take the donor's three operational facts as given, not as discoveries:**
sessions die at 60 minutes and get rotated at 55; a cold-start buffer is not
optional because speech begins before the connection does; the dial is bounded
and a socket resolving after the deadline is closed, not leaked.

### D3. Subscription credential (ADR 0102)

- **Requires** — D1, A3.
- **Touches** — a native OAuth 2.0 + PKCE flow, a loopback listener on
  `127.0.0.1:1455`, a capability entry, `tauri-plugin-opener` for the browser.
  **A token set needs the generation guard** — a refresh that lost the race
  against a `clear()` must not restore a revoked credential (ADR 0105).
- **Validates** — `cargo test`, `npm audit`, and the surface states which
  credential pays, that it reaches text jobs only, and that the vendor licenses
  it for interactive use.
- **Done when** — an account can hold a key for recognition and a subscription
  for chat at the same time, and choosing the subscription makes the speech jobs
  say what they now need.

---

## Stage E — what a second window needs

Both were filed *unscheduled* in the roadmap because stage one had no sequence,
**not because they are optional**. They are scheduled here: after the provider
work has a shape and before any surface tries to use a window.

### E1. The config echo (ADR 0108)

- **Requires** — nothing. Small, general, and **E2 needs it.**
- **Touches** — a config-changed channel every window re-reads from; scoped or
  debounced so three windows do not re-read everything per keystroke; scrubbed
  by `without_secrets()` because an event is a second path out of the runtime.
- **Validates** — `cargo test`; a test that the event carries no secret.
- **Done when** — a machine-wide value changed in one window is visible in
  another without either knowing the other exists.

### E2. The window class (ADR 0100)

- **Requires** — E1.
- **Touches** — either `WebviewWindowBuilder` or a fixed pool of declared
  labels — **the first real implementation choice the record leaves open**.
  Geometry is read and persisted, never pushed from content. Per-member
  obligations (content protection, always-on-top, what closing means) are
  declared, not inherited.
- **Validates** — `cargo test`, `npm run build`, **and the native host** — a
  second window class is exactly the change that behaves in jsdom and fails on
  WebKitGTK, and four consecutive legs have found a defect that way.
- **Done when** — a member can be opened, dragged, resized and reopened where it
  was left. **Nothing mounts in it yet**; a class with no member is a capability
  with no door, not a fake affordance.

---

## Stage F — voice and the local lane

### F1. Groq voice (ADR 0096 step 2) — **ungated 2026-08-11**

**It was gated on an owner question and no longer is.** ADR 0119 answers where
the translation voice sits: two rows. What remains is drawing them, which is a
gallery step rather than a question waiting on somebody.

- **Requires** — B2, **B3** (Orpheus's ids are catalogue rows), plus the gallery
  growing the two rows ADR 0119 decided. **ADR 0109's rule is untouched** — no
  adapter before the row that operates it — so the row is still a precondition;
  it is simply a known one now.
- **Touches** — one addition from ADR 0114: **`VoiceProvider` grows its first
  method here**, `synthesize_speech`, and gets its first implementation in the
  same step. The contract is designed — ADR 0114 wrote it from fourteen vendors'
  documented request shapes — but a trait method with no implementation behind
  it is the defect ADR 0089 and ADR 0103 each swept for, so the signature lands
  with its first caller rather than ahead of it.
- **Validates** — `cargo test`; a test that a provider registering `voice:
  Some(..)` is the only kind that can answer `speech_synthesis: true`, which is
  the registry-wide invariant A2 already holds and this is the first step that
  makes it non-vacuous.
- **Done when** — the desk can speak on the lane the product already runs, and
  `VoiceProvider` has one method and one implementation rather than neither.

**Groq voice is a first implementation, not a recommendation.** It serves
English and Saudi Arabic and nothing else, so it cannot carry
`translation_voice` for any pair this product realistically translates. **It
proves the contract; F4 and F5 fill the palette.**

### F2. The second output stream (ADR 0097)

- **Requires** — E1 (the routing is machine-wide and drawn in a window that may
  stand several times).
- **Touches** — `list_native_output_devices` mirroring the input side; a named
  speech stream with its own lifecycle and its own reopen budget; `Silent` opens
  no stream rather than muting one.
- **Validates** — `cargo test`, the native host, and `docs/PLATFORMS.md` grows
  its measured section — **it currently says "nothing here is measured yet"**
  and this is the step that owes the measurements.

### F3. Local, with streaming (ADR 0096 step 3)

- **Requires** — C1, D2 (the streaming contract must exist before a second
  implementation of it).
- **Touches** — one of four shapes, and **this step picks it**: whisper.cpp's
  `stream` example, `whisper-server`, linking the C API, or the fourth option
  the second donor pass found — sherpa-onnx with a Parakeet online model, whose
  streaming server is what upstream ships and which reports a detected language.
- **Note** — this is the same decision Phase 5 carries as *does WordScript ship
  an OpenAI-compatible server*. **Take it once** (ADR 0096).

### F4. The time-to-first-byte measurement — **a gate, not a step**

**Added 2026-08-11 (ADR 0118).** Both voice rows are chosen on TTFB, and
`docs/PROVIDERS.md` records that **not one of the fourteen candidates publishes
a figure this product will repeat as fact.** Cartesia's own API reference
carries none, and the `240 ms` on the agent window has no source behind it.

- **Requires** — F1 (something has to speak) and F2 (it has to come out of a
  device this product opened).
- **Touches** — no product code. A measurement across the candidates already
  reachable: Groq Orpheus, and through D1a's OpenRouter entry
  `openai/gpt-4o-mini-tts-2025-12-15`, `google/gemini-3.1-flash-tts-preview`,
  `mistralai/voxtral-mini-tts-2603` and `microsoft/mai-voice-2`.
- **Done when** — the `Not measured` badge on `AI Models` can be replaced by a
  number this machine produced, and F5's order is justified by it rather than by
  a datasheet.

**This is why it is a gate.** F5 builds four modules chosen on latency. Building
them before the measurement is picking four vendors by reading their marketing
pages, which is the failure `docs/PROVIDERS.md` exists one layer up to prevent.
**Cartesia's 3000 ms default buffer is the specific trap** — configurable 0 to
5000, defaulting to 3000, and shipped unchanged it puts three seconds in front
of every spoken reply.

### F5. The four modules OpenRouter does not cover (ADR 0118)

- **Requires** — F4 (which orders them), B2 and B3, and the two rows drawn.
- **Touches** — four provider modules, **in the order F4's measurement
  justifies**, each one module plus a registry line:
  - **Cartesia** (S6/S4) — `sonic-3.5`, `sonic-3` over
    `wss://api.cartesia.ai/tts/websocket`, `cartesia_version` required. It is
    the drawn default for the desk, so the one voice this product already names
    has no other door.
  - **MiniMax** (S4/S6) — `speech-2.8-hd` and `speech-2.8-turbo`, 40 languages,
    an HD/turbo pair that can answer a quality row and a latency row from one
    vendor. **Region-scoped**: `api-uw.minimax.io` or `api.minimaxi.chat`, a
    constant per deployment, and the credential is issued against one of them.
  - **Bland** (S6) — `POST /v1/speak`, bearer, chunked **and** websocket, PCM16
    at 44,1 kHz. **It publishes neither a language list nor a latency figure**,
    so it lands with a measurement or it does not land.
  - **Azure Speech** (S5, ADR 0117) — the one entrant needing a new credential
    ladder: region plus subscription key, SSML body,
    `Ocp-Apim-Subscription-Key`. **What it buys is `mstts:express-as`** and the
    eighteen styles on `de-DE-Klaus` and `de-DE-Mia`; without SSML, OpenRouter
    already serves the model. **Public preview, no SLA** — the row says so.
- **Validates** — `cargo test` and `npm audit` **per module, not once at the
  end**; a test per vendor that the voice-vs-model-id split is read from the
  catalogue rather than hardcoded (ADR 0115); and for Azure, a test that its
  credential is resolved separately from Azure OpenAI's and cannot be borrowed
  from it (ADR 0117, ADR 0105).
- **Done when** — every candidate in `docs/PROVIDERS.md`'s voice table is
  reachable, either through OpenRouter or through its own module, and the
  `Speaking` rows offer a picker rather than two options.

**The palette is complete here and the rule that governs the next vendor is
not suspended.** ADR 0116's test still applies: a module needs a reason
OpenRouter cannot already answer.

---

## Stage G — the conversation

**Gated on C3.** Every step here runs on the input stream with the open loss
defect, for longer than any other capture this product performs.

- **G1. Turn direction (ADR 0099)** — requires C1, D2 and a lane that reports a
  detected language. `TranslateSettings` grows a pair. **Rule 4 is the feature**:
  no match leaves the direction where it was and the line says so. The
  reliability half is a measurement against bilingual fixtures in
  `src-tauri/tests/fixtures/regression_transcripts.json` — **a feature that
  ships before that measurement ships on a guess.**
- **G2. The translation window (ADR 0101, ADR 0064)** — requires E2, G1, F2.
  Runs `ProcessingMode::Translate`; the cycle keeps seven entries. An empty
  translation preserves its input; a turn whose detected language already equals
  the target skips the step. **ADR 0064's first open point — whether a view plus
  a pop-out is enough interaction at a table — is still the owner's** and gates
  the surface, not the runtime beneath it.
- **G3. The remaining adapters.** **Rewritten 2026-08-11** — it was one bullet
  naming nine adapters, which is a list rather than a route. Grouped by
  `docs/PROVIDERS.md`'s adapter-shape table, because that is what decides the
  cost:
  - **Costs nothing further** — every vendor OpenRouter serves, once D1a has
    landed. That includes `microsoft/mai-voice-2`,
    `google/gemini-3.1-flash-tts-preview`, `mistralai/voxtral-mini-tts-2603`
    and `openai/gpt-4o-mini-tts-2025-12-15`. **Four vendors' synthesis, zero
    modules.**
  - **Chat, one module each** — Anthropic (S2 in the survey's numbering:
    `x-api-key` plus `anthropic-version`), Gemini (`generateContent`),
    OpenRouter's and Self-hosted's chat role.
  - **Speech, one module each, no new credential shape** (S3) — Deepgram,
    ElevenLabs, AssemblyAI, Speechmatics, xAI, Mistral. **Read AssemblyAI and
    Speechmatics against their own documentation first**; they entered the
    survey on secondary sources and ADR 0116 forbids drawing them until then.
  - **Streaming, one transport then one module each** (S4) — the transport is
    already owed to D2 for OpenAI Realtime, so a streaming vendor added after
    D2 is a module, not an infrastructure project.
  - **Synthesis moved out of this bullet on 2026-08-11.** Cartesia, Bland,
    MiniMax and Azure Speech are **F5**, because the owner scoped the palette
    whole (ADR 0118) and four modules ordered by a measurement is a step rather
    than a line in a list of leftovers.
  - **The enterprise three** — Bedrock's three-rung ladder, Vertex's
    service-account JSON, Azure OpenAI's endpoint-plus-deployment. Chat only,
    except Azure OpenAI, which is the one enterprise lane that transcribes.

  `npm audit` and the Rust advisory sweep run **per adapter**, not once at the
  end. `AI Models` loses its banner when the last one lands, not before.

  **What this list is not.** It is not an order and not a commitment to build
  every row. ADR 0116 admits a vendor to the survey; the drawing decides which
  earn a row, and ADR 0109 keeps every adapter behind the row that operates it.

---

## What blocks what, at a glance

```
A1 ──┬── A2 ──┬── B1 ──┐
     │        │        │
     │        └── B3 ──┤
     │                 │
     └── A3 ──┴────────┼── D1 ──┬── D1a
          ├── A5       │        │
          └── A4       │        ├── D2 ──┬── F3
                       │        │        │
              B2 ──────┴────────┴── D3   │
                                         │
C1 ── C2                                 │
 └───────────────────────────────────────┴── G1 ── G2
C3 (soak, gates all of G)
E1 ── E2 ────────────────────────────────────┘
E1 ── F2 ──┬─────────────────────────────────┘
           │
B2 + B3 ── F1 ──┴── F4 (measure) ── F5 (the four modules)

B3 ──┬── B4 (the live fetch)
     └── B5 (the installation)

B1 + D1 ── B6 (the inherited drawing)
```

**A5 and A4 are drawn as siblings because that is the truth: A5 blocks
nothing.** It runs first anyway — both rewrite `core/config.rs`, and doing the
subtraction before the addition is a smaller edit against a smaller file.

**B3 sits under A2 rather than under A1 alone**, because the catalogue's schema
borrows `ModelCapabilities`' vocabulary rather than inventing a second one. It
blocks D1, which is the point: D1 is the first step that would otherwise write a
vendor's model ids as literals.

**D1a hangs off D1 and nothing hangs off D1a.** That is what makes it the
cheapest step in Stage D and the one to reach for when F1 is stuck.

**B4 and B5 are siblings on B3 and neither blocks the other**, drawn in their
own stanza because threading them through the main block hides that. They meet
in one place only — the Ollama listing B4 would add for the local lane is
already `fetch_local_chat_models_async` in the tree, so whichever lands second
inherits it rather than writing it again.

**One owner question is live, and it blocks no step in A through F.** *Whether a
view plus a pop-out is enough at a table* blocks G2's surface (ADR 0064).
**Open disagreement 13 was the second and lasted a day**: ADR 0128 answered it
with a rule rather than with either of the two options it posed, and closed 10
and 11 with the same rule.
**The other was answered on 2026-08-11**: where the translation voice sits is
ADR 0119, two rows, delegated by the owner and decided against ADR 0043's one
voice, ADR 0064's per-language route and the language coverage the survey
measured. F1 lost its gate with it.

**One recommendation is not a decision.** D1a's placement inside ADR 0096's
unordered *rest* is this page's suggestion, not that record's instruction.
ADR 0096 permits it — it pins only OpenAI, Groq voice and Local — but a plan
quietly reordering a record is the thing ADR 0109 refused to do about the
Speaking row, so it is flagged rather than assumed.

## Status

| Step | State |
| --- | --- |
| A1 | **done** 2026-08-11 — `core/providers/registry.rs`, the enum gone, four counts unchanged |
| A2 | **done** 2026-08-11 — `ModelCapabilities` per `(provider, model)`, `speech_synthesis` on the provider, +8 Rust tests |
| A3 | **done** 2026-08-11 — the secret-store entry keyed `(provider, role, kind)`, `provider_status` per role, the pre-role key adopted onto both roles, +12 Rust tests |
| A5 | **done** 2026-08-11 — every on-disk compatibility path removed, both schema counters kept, the import door kept, −18 Rust tests |
| A4 | **done** 2026-08-12 — a profile holds a resolved default plus a sparse override per job, `JobKey` bridges to `ProviderRole`, the machine-wide `provider` field is gone, schema 5 lifts the per-profile one behind a snapshot, +8 Rust tests, `port:diff` `ALL EXACT` |
| A6 | **done** 2026-08-12 — `core/providers/local.rs`, the id `local`, the alias list empty, the profile prefix `local-*`, four counts unchanged |
| B3 | **done** 2026-08-12 — `shared/model_catalogue.json` plus its schema, `core::model_catalogue` and `src/lib/modelCatalogue.ts` on the same bytes, rows named by slug, twelve places stopped spelling a model id and a test walks `src/` for the thirteenth, +12 Rust tests and +12 frontend cases, `PROVIDERS.md` disagreement 5 closed and 12 opened |
| B4 | **not started** — added 2026-08-12 (ADR 0120); the live fetch above the catalogue, gated on B3 |
| B5 | **not started** — added 2026-08-12 (ADR 0122) on the owner's instruction, out of ROADMAP Phase 5; the installation ADR 0042 drew and never got. Gated on B3 only — **B4 is not a precondition** |
| D1a | **not started** — added 2026-08-11 (ADR 0113); **not gated**, and now genuinely the cheapest step in Stage D: D1 extracted the helper it reaches with a second base URL |
| F4 | **not started** — added 2026-08-11 (ADR 0118); a measurement gate, no product code |
| F5 | **not started** — added 2026-08-11 (ADR 0118); the four modules OpenRouter does not cover |
| C3 | **done** 2026-08-12 — the soak night ran 8.00 h and the number is **zero**: 96 segments, every one `Intact`, against a rate that predicted about eight events. The gate asked for a measurement, not a cause, so it is satisfied and Stage G is unblocked. Route B — the real app, silent — is the next measurement |
| B1 | **done** 2026-08-12 — `registered_providers()` answers for the whole table in one call, `src/lib/providerSeam.ts` is the third thing ADR 0106 named, five states rather than three, the two tests that record required both exist and both were made to fail before they were trusted (ADR 0124). +3 Rust tests, +25 frontend across 2 new files, `port:diff` unmoved at `structural 6 \| style 213 \| text 12` |
| D1 | **done** 2026-08-12 — `core/providers/openai.rs` plus one registry line, on a transport and a credential store extracted from `groq.rs` in the same commit (ADR 0113, ADR 0126). `verbose_json` turned out to be `whisper-1`-only on this vendor, so the response format is per model and `ModelCapabilities` is non-vacuous for the first time. **The connection became writable** (ADR 0127) — the chip row, the credential row and every job row read one stored answer, so *a second lane can be operated* is a fact rather than a registry entry. +17 Rust tests, +3 frontend, `port:diff` **unmoved** at `structural 6 \| style 213 \| text 12`, no dependency moved |
| B6 | **done** 2026-08-12 — added the same day on the owner's instruction. The override reads the config in the product and the drawn literal in the gallery, so `port:diff` is unmoved at `structural 6 \| style 213 \| text 12` for that half; the `stt` correction moves it to `structural 9 \| style 217 \| text 12` and that movement **is** the correction. The literal `Set` badge is gone, an unbuilt vendor is offered and disabled with its reason, and the provider select escapes its own inert reason. +6 frontend cases in `Models.test.tsx`, +3 in `providerSeam.test.ts`, all nine made to fail first. `PROVIDERS.md` disagreements 10, 11 and 13 closed |
| D3 | **not started, and not blocked** — its `Requires` line reads D1 and A3, both done. The graph below draws a `B2` line into its column that no `Requires` line supports; the line is decorative and the `Requires` is the contract |
| B2, C1–C2, D2, E1–E2, F1–F3, G1–G3 | **not started** |

Stage one (documentation) closed 2026-08-11: `docs/PROVIDERS.md`, ADR 0094–0102
and ADR 0105–0110, no code.

**Stage one had a second pass, the same day, and it moved three things.** The
vendor-intake pass re-read `docs/PROVIDERS.md` against the vendors and found two
of its own claims wrong — that OpenRouter has no audio endpoint, and that speech
has no OpenAI-compatible shape for the Self-hosted lane. Both were the same
mistake: a page read correctly and a *"not"* written from it, the second one
contradicting this same file eleven paragraphs earlier. The finding underneath
is in the tree: **`GROQ_API_BASE` is `https://api.groq.com/openai/v1`, so the
one integrated cloud adapter is already the OpenAI shape with a Groq host**
(`groq.rs:25,407`). Seven vendors joined the survey, an adapter-shape table was
added, ADR 0113–0117 landed, and this page gained B3 and D1a. **No code**, and
the counts below are the proof: `cargo test` 760 passed / 3 ignored and
`cargo check` 15 warnings, both unchanged, because a documentation stage that
moves a test count has done something it did not say it would.

**And a third pass, the same day, on the owner's instruction.** *The full
palette, no half measures* — the second time that sentence has widened a scope,
after ADR 0096 did it for the lanes. ADR 0118 makes Cartesia, Bland, MiniMax and
Azure Speech committed modules rather than options, and adds F4 (a measurement
gate) and F5 (the four modules). **The owner also delegated the open drawing
question**, which ADR 0119 answers: two rows in the `Speaking` group, so
`JobKey` gains `translation_voice` beside `voice` and **F1 loses its gate**. The
decision was taken against ADR 0043's one voice, ADR 0064's per-language route
and the 8-to-70 language spread the survey measured — not against a preference.
Counts unchanged again.

**A1, as it landed.** Three role traits plus a fourth (`Provider`) for what is
not a role today — status and the credential — because ADR 0105 is where that
half splits per role, and putting it on the three role traits now would be the
same edit in three places later. `SpeechProvider` carries the account plans and
the capture ceiling beside recognition: a plan is today entirely a statement
about how much audio may be uploaded, so a provider with no speech role has none
to choose between. `capture_limits` takes **both** model and tier on the trait,
because a cloud lane is bound by the plan and a local one by the model and the
caller knows which least of all — the shape `providers/mod.rs:189` already had.
The registry is a `&'static [ProviderEntry]` table rather than accessor methods
on a base trait, so "a module plus a registry line" is literally one line, and
the donor's many-to-one shape is two entries pointing at one static. Futures are
boxed (`ProviderFuture<T>`) because an `async fn` in a trait is not
dyn-compatible and no new dependency was worth a pure refactor.

**A2, as it landed.** Four choices the records leave open, and the reasoning
each turned on.

**The model answer is three-valued.** `supported`, `unsupported`, `unknown`
rather than a `bool`, because ADR 0110 requires OpenRouter's per-model answer to
be *a lookup whose values cannot be enumerated ahead of time* and says the
surface must state unknown rather than assume. A `bool` resolves that case at
the point where the value is written, and every reader downstream then treats a
guess as a measurement; the enum makes the mistake need a `match` arm. Adding
the third state later would be a contract change touching every adapter and the
mirror — which is what this stage exists to prevent.

**Both trait methods sit on `Provider`, not on the three role traits.** A model
capability spans roles — synthesis streaming is a voice question and
`VoiceProvider` still carries no method — and a provider that serves one role
lists the models of that role. `capabilities()` is separate from `status()`
because `status()` reads the OS secret store and probes the local runtime, and
**a registry-wide test must be able to ask what a lane can do without touching a
developer's keyring.** That test is the one that holds `speech_synthesis` to
`voice.is_some()` for every entry, which is the property ADR 0094 wanted from
the type and could not get from a struct field.

**The answer travels on `provider_status`, not on a command of its own.**
`ProviderStatusRequest` already carries `model`, so the pair is already there;
and a registered command with no caller is the defect ADR 0089 and ADR 0103
each swept for. A caller asking about a second model asks again with that model.

**Neither registered lane needed a table, and that is the finding.** Groq
answers `unsupported` for every id including ids it does not ship, because the
endpoint decides the matter — batch only, no socket to open. The local lane
answers the same because it shells out to `whisper-cli` and puts the *requested*
language back on the response; ADR 0094 defines `reports_detected_language` as
naming the language heard *rather than echoing the one it was told*, and that
line is `local_preview.rs`'s literal behaviour. So the (provider, model) pair
differentiates nothing yet, and the fixture in `registry.rs` is what proves the
shape — one vendor reached one way, whose `gpt-4o-transcribe` streams and whose
`whisper-1` does not. It stands in for D1 rather than waiting for it.

**What A2 deliberately did not do:** list Groq's Orpheus voices. A model answer
is the wrong place to say a lane has no adapter — ADR 0106 keeps *no adapter*,
*role denied* and *credential missing* as three separate sentences, and folding
one into a model field is how they get conflated. The voices land with F1.

Counts: `cargo test` 748 passed / 3 ignored (**+8**, all new: three in
`registry.rs`, two each in `groq.rs` and `local_preview.rs`, one in `mod.rs`),
`cargo check` 15 warnings unchanged. Nothing in `src/` changed but
`types/providers.ts`, which is types only; `npm run build` passes and the
frontend suite is unmoved by this step. **Its absolute number is no longer the
baseline's 474**: the sidebar work that landed the same day (`b330815`, ADR
0111) added six cases to `WorkspaceWindow.test.tsx`, so the tree reads 480
across 39 files with or without A2 — a change from another track, measured here
so the next step does not read it as this one's.

**A3, as it landed.** Two choices the records leave to whoever implements them,
and both were decided on what the alternative would do to somebody using this.

**A save that names no role reaches every role the kind can pay for.** The
records fix the key shape and say nothing about what the command means without
one, and the surface sends none: `Models.tsx` draws one key row per connection.
The everyday act is *I gave WordScript my Groq key*, not *I paid for
recognition but not for cleanup* — a key is a way into an account, and the jobs
are downstream of that. A save landing on one role would leave the user having
done everything the screen asked while half the jobs stayed silently inert,
which is the fake-state defect with the user's own action as its cause.
Requiring an explicit role instead would force the UI to send one it has no
control for, which is a drawing question settled quietly (ADR 0057). So `role:
None` fans out across `ProviderEntry::roles()` **intersected with what the kind
can pay for** — which is where ADR 0102 does its work without a special case: a
subscription reaches chat and stops, said once, whether or not the caller named
a role. `kind: None` means `api_key` for save and clear alike, so *remove the
key* cannot become *sign out* once a second kind exists.

**The connection block stays and is folded conservatively.** A provider holding
a key for recognition and none for chat is genuinely half usable, and a `bool`
cannot say so — the same shape A2 answered with a third value. But a third state
here would need a drawing that does not exist, so the fold says configured only
when **every** role has one: the cost is a connection that reads not-ready while
dictation would have run, which is visible and correctable, against a connection
that reads ready and drops a transform silently, which is not. Which role is
missing is answered by `role_credentials` beside it, not by widening the block
— `Models.tsx`, `WorkspaceWindow` and the v1 slice read the fold unchanged, and
the unfolded answer waits for the row that draws it (ADR 0106's three sentences).

**The bug that is not in the records: a pre-role key is adopted before it is
touched.** The single string on disk is what *both* Groq roles were spending. A
save for chat that simply wrote the chat entry, or a clear that simply deleted
the old one, would take the speech credential with it — and the user's next
dictation would fail with no action of theirs to explain it. So `write_api_key_to`
and `clear_api_key_in` both adopt the old entry onto every role first, and only
then act on the one they were asked about. The writes precede the deletes, so an
interrupted migration re-runs rather than losing the key.

**A kind a lane cannot authenticate with is refused where it would be stored.**
ADR 0102 puts the restriction in the type rather than in a runtime error, and
that holds for jobs: no speech call is reachable with a subscription. A command
is a different surface — it takes a kind from outside — so it is refused at the
door, with the vendor and the reason named. Two tests hold the two halves: the
type answers `is_admissible_for` and the registry holds the subscription kind to
OpenAI, so the vendor a later reader adds cannot inherit ADR 0102's exception by
omission.

**What A3 deliberately did not do:** touch a drawing, add the `role`/`kind`
arguments to `useProvider` (a parameter no caller passes is the defect ADR 0089
and ADR 0103 swept for — it arrives with the row that needs it), introduce a job
type in Rust (that is B2 and A4), or acquire a token set (D3). The role at each
call site is known statically inside the adapter — `transcribe_audio_file` loads
the speech credential, `create_chat_completion` the chat one — so nothing needed
a job enum to route correctly.

**And the finding: A4 did not exist.** ADR 0094's config half has been marked
*not built* in the spec since A1 and had no step on this page. A3's own
*config migration with a backup path* reads as though it covered it; it does
not, and it was the last place the gap could have hidden. A4 is written above
rather than folded into A3, because a credential migration and a settings
migration are different files, different stores and different risks.

Counts: `cargo test` 760 passed / 3 ignored (**+12**: three in `registry.rs`,
four in `mod.rs`, four in `groq.rs`, one in `local_preview.rs` — and two
existing `groq.rs` cases were rewritten onto the per-role store rather than
added to). `cargo check` 15 warnings unchanged. In `src/` only
`types/providers.ts` moved, types only, so the frontend suite reads 480 across
39 files and `npm run port:diff` is `ALL EXACT` — no drawing moved, which for
this step is the point rather than a side effect.

**A5, as it landed.** Three things the record leaves to whoever implements it,
and one finding.

**How far "stops accepting pynput tokens" reaches.** Only the six `_l`/`_r`
modifier spellings. `cmd`, `win`, `command`, `meta`, the browser `event.code`
names and the key abbreviations (`esc`, `pgup`, `del`) stay, because none of
them is a sidecar form: `cmd` is what a Tauri accelerator and a macOS user
write, `ControlLeft` is what the recorder sends, and `parse` is exactly the
boundary whose tolerance ADR 0112 protects in the same breath as it removes the
dialect. What is gone is the one spelling nothing living produces. A value still
holding it now stores unchanged and reads as *not registerable*, which is the
answer every other unparsable string already gets.

**The `auto_detect_mode` serde alias went too, and it is not on the record's
inventory.** ADR 0112 lists the frontend fallback in `textProfiles.ts`; that
fallback's own comment says it exists *because Rust accepts the alias*. Removing
one half would have left a pair where the surviving side is justified only by
the side that went. Both go. The frontend half was already dead either way —
`load_app_config` returns a Rust-serialized struct, so the canonical key is the
only one a window ever sees.

**The conversion moved rather than went.** The frontend migration and the import
door were one function, and the plan's *done when* keeps `stt_hints` applying to
an imported document. So `textProfileFromRulesDocument` converts the newline
string itself now, and the migration wrapper is gone. This does put a second
copy of the recognizer's limits (48 characters, four words, four slots) in the
frontend — a cost paid knowingly, because the runtime still resolves what
actually reaches the recognizer (`select_recognizer_slots`), so a drift here
changes what an import creates and never what a capture sends.

**And the finding: the subtraction cost this machine nothing at all.** ADR 0112
argues from *no published releases*, which makes the developer's own config the
one file at risk. It was already in the current shape — six profiles, each
carrying `speech`, `modes` and `capture`, all at schema 4, `shortcut_schema_version`
2, and not one removed key on disk. So the paths deleted here were not merely
serving one machine; they were serving no state that machine still holds.

Counts: `cargo test` 742 passed / 3 ignored (**−18**). Deleted: three
mode-lane migration cases, two `LegacyTextRules` cases, two reseed cases, the
`auto_paste` roundtrip, six vocabulary and context migration cases, two
schema-rerun cases, the `auto_detect_mode` alias case, and five pre-role
credential cases in `groq.rs`. Kept and re-pointed at the rule rather than the
migration: the disk payload never carrying a credential field, a chosen
shortcut surviving a schema bump, the stored opt-in deciding no recognizer slot,
an entry without an origin loading as the user's, a role reading only its own
entry, and — new, because ADR 0112 asks for it — that a config *this* build
writes round-trips unchanged. `cargo check` 15 warnings unchanged. The frontend
suite is unmoved at 480 across 39 files and `npm run port:diff` is `ALL EXACT`.

**A4, as it landed.** Five choices the records leave open, and one finding that
was sitting in the tree the whole time.

**The finding first, because it changes what the step was for: there were two
`provider` fields, and they could disagree.** `ProfileSpeechSettings::provider`
per profile, which `capture.rs` read and therefore what every live dictation
and every transform in that session spent; and `AppConfig::provider`
machine-wide, which `history.rs`'s retry, `mode_router`, the v1 slice and the
transcript title spent. Nothing in the UI wrote either — `Models.tsx` draws its
lane picker out of `screens/data.ts` and persists nothing — so on this machine
both read `groq` and the divergence was invisible. It is still a real defect: a
config where they differed sent a dictation to one vendor and a **retry of that
same record** to another, with no surface saying so. ADR 0094 names one field
and `docs/spec/SPEC.md` said *one `provider` field per profile*; neither
account had two. Collapsing them is most of what this step does, and the
per-profile one wins because it is the one the pipeline was actually running
on.

**The axis is its own block, not a field inside `speech`.** `speech` is the
Speech tab, and the axis governs the five chat jobs as well as the three
listening ones; filing the assistant's vendor under the recogniser's settings
is how the next reader concludes the connection is a speech setting.
`TextProfile::providers` sits beside `speech`, `modes` and `capture`, and an
absent block reads as the default connection with nothing overriding it — the
same answer a fresh profile gives, which is what lets the migration leave a
profile alone when the value it would lift is already the default.

**The override map is sparse, and the absence is the value.** ADR 0094 fixes
this and the donor is the argument: `INFERENCE_SCOPES` maps five jobs onto
eight flat keys each, and `buildReasoningScopePatches` exists to fan one change
back across four of them. Ten jobs on that shape is eighty keys. A job absent
from `overrides` is not a job without an answer — its answer is *follow the
connection*, which is the drawn select's first option, and it resolves at read
time rather than being baked in at write time so *Use the default* has
something to write back to.

**`JobKey::role()` is the only bridge between the two axes, and each call site
names its own job rather than deriving one.** The role decides which credential
is spent (ADR 0105); the job decides which vendor. One mapping, in one place —
and at the call sites the arm already knows what it is running, so
`mode_router`'s Agent arm asks for `JobKey::Assistant` outright instead of
looking a job up from the mode beside a `match` that just decided it. The one
caller that genuinely holds a mode and not a job is the history retry, and it
goes through `ProcessingMode::job_key()`, which answers `None` for Verbatim
(reaches no model, which is its whole contract) and for an unresolved Auto.

**The correction's job is read off the preset, not carried beside it.**
`professionalize` *is* the distinction between Cleanup and Rewrite, so
`TransformPreset::correction_job()` derives it and nothing stores a second
copy. It also gives the retry path the right answer for free: a retried Agent,
Translate or Prompt Enhance record runs the conservative arm, which is a
cleanup, and the resolution says Cleanup instead of routing it to a job it is
not running.

**Two of the eight jobs have no runtime path, and they are variants anyway.**
There is one transcription path and it is `Dictation`; `Meetings` and `Upload`
are drawn columns. They are in the enum because the axis is the drawing's and
an override stored against one has to survive the build that grows its path —
the opposite call from ADR 0089's *a registered command with no caller*, because
this is a data axis rather than a surface, and dropping a stored override on
load is worse than carrying a variant nothing dispatches on. **Titles is not a
variant**: ADR 0087 settled that its row states rather than sets, so it rides
the assistant's resolution and gains an override when that row is drawn.

**The migration is schema 5, and it is the first thing to use the place A5 kept
open.** `TextProfile::migrate_to_current_schema` guards on
`PROVIDER_AXIS_SCHEMA_VERSION` rather than on the constant, which is D6's
defect: a migration keyed to the constant fires again on every later bump and
rewrites what the user chose in between. `speech.provider` becomes a
read-once door (`#[serde(rename = "provider", skip_serializing)]`) and leaves
the file on the next save. **This is not the ballast ADR 0112 removed** — that
record argues from *no installation carries this shape*, and this shape is the
one every installation carries right now, one save old. `AppConfig::provider`
is dropped without a rescue under the licence A4 inherited: it maps onto no
per-profile answer when two profiles disagree with it and with each other.

**And the migration ran end to end on real data before anything asked it to.**
`npm run tauri dev` was running throughout, so the app rebuilt on each edit and
loaded the developer's own `config.json` under the new code at 13:29. It did
exactly what the step specifies, in the order `core::backup` requires: snapshot
first (`config.backup-provider-axis-1786534196728.json`, logged), then six
profiles v4 to v5, `speech.provider: "groq"` to
`providers: {default: "groq", overrides: {}}`, the machine-wide `provider` key
gone, and no other key touched. An unplanned verification is still a
verification, and it is a better one than the fixtures because the input was
not written to be migrated.

Counts: `cargo test` 755 passed / 3 ignored (**+8**, all new and all in
`config.rs`: three on the resolution and the security rule, one on the role
map, four on the migration). `cargo check` 15 warnings unchanged. `npm test`
480 across 39 files unmoved, `npm run build` passes, and `npm run port:diff` is
`ALL EXACT` — the drawing has been ahead of this since Leg 6 and stays exactly
where it was.

**What A4 deliberately did not do:** draw anything. `Models.tsx` still writes
no provider, so the axis is a shape the runtime honours and the surface cannot
yet set — which is B1's seam and the row that ADR 0106 describes. It also did
not widen `provider_tier`, still machine-wide: a plan belongs to a credential
and two profiles on two vendors now share one field. That was already true when
the provider was per profile, so this step neither introduces nor fixes it, and
the tier's own axis waits for a surface that draws more than one.

**A6, as it landed.** A rename is only mechanical while nobody has to decide
anything, and three things needed deciding.

**The old id resolves to nothing, and a test says so out loud.** The registry
entry already carried `aliases: &["local"]`, so the new name has been resolving
all along and the alias list simply emptied when the id took its place. What
that leaves is the other direction: `local_preview` is now as unknown as
`openai`, and `normalize_provider_value` substitutes the default for it the way
it does for any unresolvable value. The mod.rs case that used to assert the
alias now asserts the retired id landing on `groq` — the same number of
assertions, pointed at the decision instead of at the compatibility path. It is
the **only** live-code line left in the tree that spells the old name, and it is
there to hold ADR 0121's *no alias* rather than to serve one.

**The prose about the lane stopped saying *preview* about itself.** ADR 0121
names identifiers, and six guidance strings were outside that list — *Local
preview runner was not found*, *Local preview model file was not found* — while
every other message in the same module already said *Local runtime*. They were
inconsistent before the rename and would have read as a leftover after it, so
they follow. What did **not** follow is the badge: `Local runtime · {model} ·
preview` in `WorkspaceWindow` is ADR 0067's mechanism, and `port:diff` is
`ALL EXACT` because nothing drawn moved.

**Three living docs called it a *compatibility id*, and after the rename that
was false.** `README.md`, `DEVELOPMENT.md`, `ARCHITECTURE.md` and `REFERENCE.md`
each described `local_preview` as an identifier kept for compatibility;
substituting the new name into that sentence would have produced a claim the
registry now contradicts. They say what the lane is instead, and `REFERENCE.md`
carries the one line a reader coming from an older config needs: it was
`local_preview` until ADR 0121, and nothing resolves the old id.

**The one thing the survey undercounted.** ADR 0121 priced it at 177 references
across 43 files; the commit moves 197 lines across 32, and the two numbers
disagree in both directions for the same reason — a line can carry two
references, and the ADRs, the donor plan and `gui-port-relay.md` are
records rather than living documents and keep the old name by rule.

Counts: `cargo test` 755 passed / 3 ignored, `cargo check` 15 warnings,
`npm test` 480 across 39 files, `npm run build` passes, `npm run port:diff`
`ALL EXACT`. **Four unchanged counts is the deliverable** — a rename that moves
one of them has done something it did not say it would.

**B1, as it landed.** The record left one question open by name and four more by
omission, and the reasoning each turned on is below. The command-surface
decision is ADR 0124.

**One command for the whole table, not ten for one screen.** ADR 0106 posed it
and declined to answer it. Three facts in the tree decide it: `capabilities()`
was split from `status()` in A1 precisely so a capability question costs no
keyring read, `resolve_entry` refuses an unknown id so eight of ten answers
would arrive as errors, and a screen that merely opened would have paid ten
secret-store reads and a local-runtime probe for it. `registered_providers()`
takes no argument — a filtered list would be the caller's drawing deciding what
the runtime may admit to registering — and **absence from its answer is how *no
adapter* is stated**, which is what lets that sentence be told apart from *the
lane denies this role*.

**The drawn name and the runtime id needed a third home, and both obvious ones
were closed.** `data.ts` may not carry a runtime id: ADR 0106 says in its own
consequences that it does not move that file, and a field the gallery has no
copy of is one the next paste drops. `shared/model_catalogue.json` may not carry
one either, and the reason is a test rather than a preference —
`every_row_names_a_vendor_the_file_declares_and_every_vendor_carries_rows`
requires a declared vendor to carry model rows, and Gemini, Mistral, xAI,
OpenRouter, Azure OpenAI and GCP Vertex carry none. Editing that test to admit
them would be accommodating a guard to a new step. So the correspondence is
restated in the seam with a test as its keeper, which is the arrangement
ADR 0106 endorses in its own consequences and attributes to the donor. **The
third guard direction is the one that will bite**: every id the registry answers
with must be reachable from a drawn name, so `openai` landing under a spelling
nothing points at fails here rather than reading as a vendor with no adapter
forever.

**Five states, because three of them are about the vendor and two are about the
read.** ADR 0106 named three reasons a row may be inert. A read that has not
come back is not one of them — it claims nothing, so the surface keeps whatever
reason it had, and a `pending` that replaced ADR 0065's blanket sentence would
make every screen open flicker through *not read* on its way to the truth. A
read that came back malformed is loud, and has to be: JavaScript reads a missing
field as falsy, so an incomplete block without an explicit completeness check
makes every lane read as denied and no test notices. **That is exactly the state
ADR 0106 found**, and reproducing it one layer down while claiming to have fixed
it was the failure this step was most at risk of.

**Two defects the tests found, and both were real.** The first: the reason
initially governed the whole job row, and the Translate row draws `override:
"Anthropic"` — a vendor with no adapter — so its two acting settings stopped
writing. Those four rows are the mode's own and have had a config home since
ADR 0041; a job whose *model provider* has no adapter has not stopped having a
target language. The reason now governs the vendor and model rows and stops
there, which is this record's own conflation one axis over. The second: the
Rust test asserting the capability answer carries no credential searched the
payload for `api_key` and failed on `requires_api_key`, which is a capability.
It asserts the serialized **keys** now, and pins the whole wire shape as a side
effect — the nine fields the mirror reads, named once more where the wire is.

**The chip row is inert until the runtime answers, and that is correct.** It was
live at first paint because the answer was the literal `["Groq"]`. Two existing
cases now await it. A chip enabled before the runtime has said anything is the
fake readiness this screen's own comment calls the single worst place on the
surface to imply a provider works.

**The credential row stopped reading its own status.** Once the seam asked
`provider_status` for the connection, `CloudCredentialRows` doing the same was
two reads of one OS secret store on one screen open and two components with two
opinions of one credential — the drift this step exists to remove, one layer up.
It reads the seam's answer and refreshes through it; the account plans stay,
being a speech question it is the only reader of.

**What B1 deliberately did not do:** correct a drawn row (ADR 0106 forbids it,
and `docs/PROVIDERS.md`'s open disagreements stay open), give a job row a config
target (that is A4's shape and D1's use of it), touch `ProviderId`'s two-member
union in `src/types/providers.ts` — it is `useProvider`'s parameter type, the
seam names ids as strings and never needed it, and widening it on the way past
would be a change with no caller — or add a surface element. **No new DOM**: the
reason travels on `title`, where it already travelled, and on the connection
row's `hint`.

**The mirror may now be called a guard**, and `docs/spec/SPEC.md` says so for
the first time. ADR 0106 forbade that until two tests existed. Both were made to
fail before they were trusted: a field deleted from the TypeScript mirror failed
the field comparison and the parser's own sanity case, and the empty capability
block failed the screen.

Counts: `cargo test` **770 passed / 3 ignored** (+3, all new in
`providers/mod.rs`), `cargo check` **15 warnings** unchanged, frontend **517
across 42 files** (+25: 19 in `lib/providerSeam.test.ts`, 6 in
`types/providers.test.ts`, and `Models.test.tsx` net +4 with two existing cases
made to await), `npm run build` passes, `npm run port:diff` on `models`
**unmoved** at `structural 6 | style 213 | text 12`, and every `invoke(` in
`src/` resolves to a registered handler (56 commands checked).

**D1, as it landed.** The step the track exists for, and the shortest list of
surprises of any so far — which is the report on Stage A rather than on this
step. Nothing in `core/providers/registry.rs`'s contract, `ModelCapabilities`,
the credential resolution, the seam or the catalogue had to move to admit a
second vendor. Five things were decided; the records are ADR 0126 and ADR 0127.

**The one thing that could not be inherited is the response format, and it
would have failed silently in review.** `groq.rs` sets
`response_format=verbose_json` unconditionally, and copying that into the new
module reads as obviously correct — same shape, same endpoint path, same bearer
token. OpenAI documents `verbose_json` and `timestamp_granularities[]` for
`whisper-1` **alone**; the `gpt-*-transcribe` family refuses them
(`developers.openai.com/api/docs/guides/speech-to-text`, read 2026-08-12). Every
request on a newer model would have been a 400, and no Groq test could have
caught it because on that lane the default is right. So the shared client takes
the format as an argument and holds no opinion, which is where the line between
transport and policy fell for everything else too.

**And the consequence reaches further than one parameter.** `verbose_json` is
what carries `duration` and `segments`, which is what `TranscriptionCoverage`
reads. On this lane the model decides whether the *transcript stopped before the
audio did* check can answer at all — so `whisper-1` is the default profile, not
because it is the best recogniser but because it is the only one that reports
its own coverage, and picking another writes a line in the runtime log rather
than letting the verdict quietly become `unknown`.

**The credential store was extracted too, and ADR 0113 does not ask for it.**
That record is scoped to the request shape; the keyring half was the same
duplication one file over, and writing a second hundred-line copy of it in
`openai.rs` would have been the defect the extraction exists to prevent, one
axis across. The entry names did not move — `entry_user("groq", role, kind)`
produces A3's string byte for byte, and a test asserts the literal rather than
deriving it, because a refactor claiming to change nothing is exactly where an
orphaned keyring happens unseen.

**Six Rust tests failed and every one was right to.** They spelled `openai` as
their example of a vendor the registry does not carry — twice in `config.rs`,
four times in `providers/mod.rs`. That made them assertions about which vendors
happened to be registered on the day they were written rather than about the
fallback they were testing. They now name a synthetic id no adapter will ever
claim, and three frontend cases got the same treatment: the *no adapter*
example moved to Anthropic, and *reads the provider status once* became *once
per vendor and never twice for one*, which is what it always meant and what
survives the third adapter.

**The door is the half the plan under-specified, and B1's record is where it
was written down.** D1's *Touches* line says one module plus one registry line;
its *Done when* says **a second lane can be operated**. Those could not both be
true. `Models.tsx` wrote three things — a key, the account plan, two Translate
settings — and the connection was `selected="Groq"` with the chip held in local
state, the credential row spelled `"groq"` five times, and every job row read
`LANES[lane].provider`. With one registered vendor none of that was wrong. With
two, it is three components naming a vendor the runtime is not using, and one of
them would have written an OpenAI key into Groq's secret-store entry. ADR 0127
is the record; `buildProfileProvidersPatch` is the door, beside the three
per-profile patch helpers that already existed.

**What D1 deliberately did not do: wire the per-job override.** It is one
`onChange` away and it is a drawing decision, which an adapter may not take
(ADR 0057). The drawn `override` literal decides the row's *shape* — three rows
get a provider mark, a *Use the default* button and their own key row — while
A4 decided a fresh profile overrides nothing. Driving that branch from the
config changes three rows structurally at the default state; leaving the literal
in charge means a row displaying an override that is not stored. Both are
decisions and neither is this step's. It is `docs/PROVIDERS.md` open
disagreement 13, and **it is the first entry on that list whose resolution
blocks a control rather than a sentence.**

**`port:diff` unmoved is the deliverable, not a side effect.** `models` reads
`structural 6 | style 213 | text 12`, exactly where B3 left it: the controls
that came alive are the ones Leg 6 drew and that have been inert since, which is
the same shape B1 had and B5 is named for. A moved count would have been the
warning.

**One edge D1 did not create and did make visible.** `provider_tier` is
machine-wide (A4 left it so, deliberately), so a profile switched to OpenAI can
still hold Groq's `dev` — and a select whose value matches no option renders
blank, which reads as a setting nobody made rather than one that does not apply.
The runtime already answers this: `capture_limits` falls back to the vendor's
default for an id it does not recognise. The surface now says the same thing.

Counts: `cargo test` **787 passed / 3 ignored** (+17, all new: 5 in
`credential_store.rs`, 3 in `openai_compatible.rs`, 9 in `openai.rs`), `cargo
check` **15 warnings** unchanged, frontend **521 across 42 files** (+4, all in
`Models.test.tsx`'s new *choosing the connection* block; three existing cases
were repointed rather than added to), `npm run build` passes, `npm run port:diff`
on `models` unmoved, and every `invoke(` in `src/` resolves to a registered
handler (65 commands checked against 70 registered). **No dependency moved**, so
no advisory sweep was owed — `reqwest`, `keyring`, `serde` and `tokio` were
already carrying this lane, which is what ADR 0094 promised a second vendor
would cost.

**Not verified in the native host, and it is the one gap.** The key round trip
needs a real OpenAI key and a running app; the suite covers the command
payloads and the config patch, not the keyring write on this machine.
