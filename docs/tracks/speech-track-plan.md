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

**After B5 the Rust suite reads 833 passed / 6 ignored and the frontend 582
across 45 files.** Both are +20 and +26 on what this tree carried the morning of
2026-08-15, and neither number continues the line above it: the last figure this
page recorded is B1's, and 22 Rust cases plus 39 frontend ones landed between
then and here from the Runtime ownership and GUI port tracks (ADR 0154, 0155,
0156 and the two adopted commits). **A step measures its own delta, not the
distance to the last paragraph** — the sixth ignored test is B5's network
acceptance, which is why that count moved too. `cargo check` stays at 15.

**After B8: `cargo test` 838 passed / 6 ignored — 844 counting the ignored, so
+5 on B5's 839 — and frontend 590 across 45 files (+8). `cargo check` still 15,
and `port:diff` unmoved on both states of `models`.** The +5 is four new cases
in `model_install` and one in `local`, plus one rewrite that nets zero:
`the_environment_outranks_what_the_installer_put_there` became
`every_source_is_offered_and_the_environment_wins_the_tie`, because it asserted
the defect. A step that grows a surface
and moves the port by zero is reporting the threshold working, not an absence of
work.

**After B12: frontend 608 across 45 files (+6), `cargo test` untouched, and
`port:diff` unmoved on both states of `models`.** The +6 are all in
`Models.test.tsx` and all this step's; the distance to B8's 590 is B9, B10 and
B11's twelve, which their own rows carry. The Rust suite cannot have moved —
`git status` names two frontend files and nothing under `src-tauri/` — and that
is the proof rather than a run.

**How the before-number was taken, since this page forbids the obvious way.**
`git show HEAD:src/screens/data.ts` swapped into the tree for one `port:diff`
run and swapped back out — the running dev server picks the file up, the
measurement is honest, and nothing of anybody else's went near a stash. That is
the technique the paragraph below asks for, written down now that a second step
has needed it.

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

**Three donors carry the meeting stack, and one of them leads** (ADR 0131). For
anything in Stage C or the meeting work, read **`anarlog`** first —
`donors/app/meeting-notetakers/anarlog`, MIT, Rust, and it carries `aec`,
`agc`, `denoise`, `vad`/`vad-ext`/`vad-masking`, `audio-chunking`,
`segmentation`, `pyannote-local`/`pyannote-cloud`/`voiceprint`,
`listener-core/src/live_transcript` and `overlay-kit` as crates. **`meetily`**
(same directory, MIT) is the only worked answer to the transcript half;
`openwhispr` and `voxtype` are the secondary reads. **Mechanism, not
structure** — anarlog is a 616 MB monorepo with mobile, web and billing in it.

**The rules no step may break**, restated from the records because a plan is
where they get quietly dropped: no partial result reaches the session reducer
(ADR 0018, 0019, 0095) — **and a partial may still paint a surface, which is a
second path D2 owes rather than an exception** (ADR 0132); no generic resize
command returns (ADR 0089, 0100);
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

**Built 2026-08-15. What it took and what this page got wrong is
[ADR 0158](../decisions/0158-a-model-is-installable-until-it-is-on-the-disk-and-the-instrument-only-knew-one-spelling.md)**,
not repeated here. Three things a reader of this section should carry away:
the command count was three and is five; `resolve_local_model_path` needed the
managed directory as much as discovery did, and that half is on neither this
page nor ADR 0122; and the step changed the GUI port's `command-sweep.mjs`,
because that instrument resolved a channel constant on one side of the seam and
not on the other.

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

### B7. The provider picker at the point of use (ADR 0129)

**Added 2026-08-13**, from the owner's reading of the donor's upload screen and
the question ADR 0128 left open in its own last paragraph — whether `upload`
should default to OpenAI at all. The answer is neither of the obvious two: **ask
where the question can be answered**, with the file in hand and its size known.

- **Requires** — B6 (the writable override and the reason-carrying option list
  are what this draws in a second place). Nothing else; **not** gated on D1a.
- **Touches** — **two surfaces that exist**: the upload surface, and
  `Translate.tsx`, which today says *"chosen on AI Models like the rest"* and
  sends the user away with an *Open AI Models* button. Both gain the rows
  `Follows` already renders, behind a collapsed `Transcription settings`
  disclosure, with the resolved answer above them as one line — *Using Groq ·
  whisper-large-v3*. A second `InertReason` kind for a constraint the runtime
  can compute, and `capture_limits` asked in the other direction: **which
  `(provider, model, tier)` pairs accept N bytes**, against
  `capture_budget.rs`'s existing `seconds_for_upload_limit` and
  `CaptureCeilingReason::upload_limit`. `Cloud.upload` loses its drawn
  `override`, and `screens.test.tsx`'s three-overridden-jobs case moves to two.
- **All four lanes, and this is not a detail** (ADR 0131). `Follows` renders
  three shapes already — a provider row on Cloud and Enterprise, *Runs on* for
  Local, *Endpoint* plus a free-typed model for Self-hosted — and the size
  constraint answers differently on each: Local and Self-hosted have **no
  ceiling because nothing is uploaded**, Cloud has the vendor's, and Enterprise
  has one per member (Azure OpenAI transcribes; Bedrock and Vertex do not).
  Handling Cloud and treating the rest as a fallback is the failure mode.
- **Not in this step, and each is an obligation rather than an omission.** The
  rule is general (ADR 0131): *every surface that starts a job names where it
  runs*. B7 does the two that exist; the rest carry it into the step that builds
  them.

| Surface | Prototype | Whose step |
| --- | --- | --- |
| Import intake (upload) | `contextintake`, the `Import` way | **B7** |
| Translate settings | `translate` | **B7** |
| Meeting HUD (`Record`) | `meeting` | ROADMAP *Meeting capture* |
| Translation window | pop-out drawn, the tab is not | **G2** |
| Live subtitles | `subtitles` | ROADMAP *Live subtitles* |
| Agent overlay | `agentoverlay` | its own |
| Client conversations | `conversation` — reuses the meeting window | ROADMAP |

**`Record` is deliberately almost empty in `contextintake`** and the prototype
says why: *putting a second copy of those controls here would make this the
place a meeting is configured and the HUD the place it is watched, which is one
decision in two rooms.* That is a constraint on **where** the picker goes for a
meeting — the HUD, not the intake — not an exception to the rule.
- **Validates** — `cargo test` for the byte-direction limit, `npm test`,
  `npm run build`, and **`port:diff` moves on `models`** — the gallery's own
  inventory changes here, unlike B6's override half. Say by how much and why.
- **Done when** — a file too large for the connection greys that vendor with the
  reason, offers the one that fits, and **never reroutes the audio by itself**;
  and the same picker on two surfaces writes one stored value.

**Nothing new is stored.** `providers.overrides[job]` is A4's map, writable
since B6; this is that value drawn a second time. `resolveConfigJobProvider`
stays the one door, which is the rule A4 wrote when it refused to let call sites
reach into the map.

**B7, as it landed 2026-08-15.** Four things the step decided that this entry
did not, all of them in [ADR 0157](../decisions/0157-the-size-outranks-a-missing-key-and-the-ladder-stops-being-one-screens-internals.md):

- **The ladder was extracted rather than copied.** `Follows`, the two contexts
  and the `Drawn*` wrappers moved to `src/components/jobProvider.tsx`; the
  connection card, the lane segment and the model library stayed on `AI Models`.
  The line is *what configures a lane* against *what states where one job runs*.
  **The move measured zero on `port:diff`**, proven by reverting the override
  and re-measuring back to `9 | 217 | 12` exactly.
- **The size beats a missing credential.** ADR 0106 usually prefers the
  credential sentence — one action from working — but no key makes a file
  smaller, so the constraint that cannot be fixed is the one stated. It still
  yields to no-adapter, role-denied, not-answered and pending.
- **`Unbounded` and `Unknown` are two answers.** `capture_limits` folds them and
  is right to for the budget; `capture_limits_if_known` keeps them apart for the
  picker, or a vendor with no adapter reads as one that accepts anything.
- **The drop zone gained a real file picker**, reading `size` and nothing else.
  Without it the guard could never fire. Reading, sending and producing an
  object is the context object track's C2 and was not built here.

**And one placement finding worth carrying to the next step that adds to a
ported screen.** The translation window's picker was first placed where the
information architecture wants it, mid-screen, which renumbered every section
after it: `port:diff` went `0 | 0 | 9` → `187 | 80 | 33` with **not one of the
187 a fidelity loss**. Moved to the end of the screen it measures `63 | 0 | 9`,
63 being exactly the nodes it adds. An addition to a ported screen goes last
unless the drawing itself is being revised.

**It closes open disagreements 6 and 12**, both of which live on the `upload`
row: 12 dissolves with the override, and 6 shrinks to which model upload takes
on the connection.

**The refusal to auto-switch is load-bearing** and the donor is the precedent,
not a preference: `transcriptionFallback.js` has a fallback target of `skip` so
that a signed-out user's audio is not diverted.

---

### B8. The library at scale, and the model that is not in the catalogue (ADR 0159)

**Added and done 2026-08-15, on the owner's instruction**, after B5 shipped a
tab that lists the catalogue and calls the result *what is on this machine*.

- **Requires** — B5. Nothing else.
- **Touches** — `local_model_sources()` and a union discovery in
  `core::providers::local`; `AppConfig::local_model_dirs`; `origin` and `folder`
  on `ManagedModelRow`; four commands (`import_model_file`, `add_model_folder`,
  `remove_model_folder`, `pull_model_tag`); the `Toolbar`/`ToolbarSearch` pair
  the port has carried unused since Leg 2.
- **Validates** — `cargo test`, `npm test`, `npm run build`,
  `npm run sweep:commands`, and **`port:diff` unmoved on both `models` and
  `models#1`**, which is the whole point of the threshold rather than a
  coincidence.
- **Done when** — a model the catalogue never heard of is listed, usable and
  removable; a folder somebody points at is read and never written to; and the
  drawn nine rows still render as the drawing.

**Two defects B5 left, and the second is the one worth remembering.** The tab
did not list a file the runtime would happily transcribe with. And *an expert's
checkout is never overridden* had been implemented as an early return, so with
`WORDSCRIPT_LOCAL_MODEL_DIR` set an in-app install was on the disk, resolvable
and **never offered** — the feature quietly did nothing for the users most
likely to have that variable set. Overriding is a tie-break: the listing unions,
the rank decides.

**The donor routing this plan did not carry.** For anything model-management,
read **`Handy`** first — `donors/app/desktop-shells/Handy`, Tauri, Rust, `sha2`,
a cancel flag and a `.partial` file, and the only donor with a bring-your-own
path (`is_custom`, discovered from the folder). **`openwhispr`** is the read for
*scale*: provider tabs, and a plain list that becomes searchable and grouped
above twelve rows. Neither answers both halves.


### B12. A locked lane says why it is locked, and what this machine has (ADR 0067 rule 1, ROADMAP Phase 5)

**Added 2026-08-15**, out of the owner reading the finished B5/B8/B9-B11
surface and asking what the next unit of work should be. The finding that
produced it: **the tab installs models for a lane that cannot be selected.**
B5 closed ADR 0042's gate — *until in-app installation exists, the local lane
is expert configuration* — and `docs/STATUS.md` now lists `local` under
**Implemented core features** as a full lane over `whisper-cli`, ggml models and
Ollama cleanup. `Models.tsx` still disables it.

**That is not a bug, and the step exists because reading it as one would be the
mistake.** ADR 0067 rule 1 is explicit: *a surface that OFFERS a lane makes it
inoperable*, because a control that accepts a click and then asks for a
credential is the worst possible false affordance. The record even names its own
expiry — *it expires by being reversed, not by drifting; when the local lane is
finished, `selectable` grows a name*. **The lane is not finished**: Phase 5
still owes the acceleration probe, the bundling decision and local streaming
(F3), and two of those became recorded intents only on 2026-08-15 (ADR 0161).

**So the step is not the reversal.** What is wrong today is narrower and
entirely fixable: **the lock is silent about itself.** The segment greys out and
says nothing about why, nothing about what is missing, and nothing about the
fact that this machine may already have every piece. B10 put a `Preview` tag on
the lane row, which states *this is drawn* — it does not state *this is
withheld, and here is where you stand*.

- **Requires** — B5, B8, B10. **No Rust**: `local_setup` on `provider_status`
  already carries `readiness`, `runner_ready`, `model_ready`, `chat_ready`,
  `issue_code` and `guidance`, and `useLocalSetup` (B9) already reads it. This
  step spends a reader that exists.
- **Touches** — the lane segment's `disabled` rule in `Models.tsx` keeps its
  behaviour and gains its reason; the `Connection` card, when a locked lane is
  selected, states what the runtime found on this machine rather than only what
  the lane would look like. `Onboarding.tsx` renders the same `LANES` table and
  the same `selectable` list (ADR 0067's second consequence), so whatever is
  built has to reach it or deliberately not.
- **The rule it is measured against** is `CLAUDE.md`'s: *do not render fake
  states; show runtime truth, and when the runtime is not ready, show the next
  action instead.* Today the surface does neither — it withholds without
  reporting. **And the distinction this step must not blur**: *not published* is
  a product decision and *not ready* is a fact about this disk. A machine with
  `whisper-cli`, a ggml model and Ollama running is READY and still not offered,
  and saying so plainly is the deliverable.
- **Validates** — `npm test`, `npm run build`, `port:diff` on `models` (the lane
  renders only off `Cloud`, so the Cloud default should not move; if it does, an
  assumption is wrong and the figure belongs in the record). **And the rendered
  gallery** — four separate defects in the 2026-08-15 session survived green
  tests and were caught by looking, three of them on this exact card.
- **Done when** — selecting a locked lane answers three questions without
  leaving the screen: why it cannot be chosen, what this machine already has,
  and what would still be needed. **Not done by** removing `disabled` — that is
  ADR 0067's reversal and belongs to the gate below.

**B12, as it landed 2026-08-16.** Four things the step decided that this entry
did not, all of them in [ADR 0163](../decisions/0163-a-withheld-lane-states-what-the-product-owes-and-separately-what-this-disk-already-has.md):

- **Two rows rather than one, because there are two reasons.** `Local` is built,
  installable and withheld; `Your server` and `Enterprise` have no adapter at
  all. One row for both would have said the same nothing about a lane you could
  finish and two you cannot, which is the conflation the step exists to end one
  level up.
- **The reason had to be text, and the mechanism is why.** A disabled
  `<button>` fires no mouse events, so the segment can carry neither a tooltip
  nor a hint. That is not a styling detail — it is the reason the lock stayed
  silent through four legs, and it is why `disabled` keeps its behaviour while
  the card grows rows.
- **Wired-only, so `port:diff` is unmoved by construction rather than by luck**
  — `models` at `26 | 248 | 20` and `models#1` at `262 | 30 | 16`, measured on
  this tree and on `git show HEAD:` back to back rather than quoted. The
  gallery has no runtime, so it has no lock and no disk to report on. The cost
  is B8's and is stated rather than avoided: the grown state is held by tests.
- **`local_setup` moved up to `ModelsScreen`.** Both tabs state the same disk
  now and `inspect_local_setup` spawns `whisper-cli --help` and probes Ollama
  to answer, so two hooks would be two probes for one fact — the cost ADR 0124
  already refused once at ten.

**And one finding for any track, not just this one.** ADR 0161's `Preview` tag
on the lane row is conditioned on the selected lane not being `Cloud` — and
with a runtime present, this very lock makes that state unreachable. **The tag
renders only in the gallery.** The expression is not wrong; what is wrong is
that a marker whose only reachable state is one the product never enters is a
marker the product does not have. Worth checking wherever a marker is
conditioned on a state a guard elsewhere forbids.

**`Onboarding.tsx` was deliberately not reached, and it carries the defect.**
It is an entry-point hole (`ia.tsx`), never mounted outside the gallery and
wired to no runtime, so there is no lock to explain and no disk to report on.
But its `Local` branch still states `Bundled`, `CPU only` and `32 GB RAM` as
facts about the reader's hardware — exactly what ADR 0161 corrected on this
screen — and its lane row carries no `Preview` tag at all. One unit of work for
whoever wires the flow.

**The release itself is a gate, not a step** — the shape F4 already uses. Making
`selectable` grow the name `Local` reverses ADR 0067 and requires the lane to be
*finished*, which is ROADMAP Phase 5's list and not one unit of work: the
acceleration probe, the bundling decision, guided remediation, and F3's
streaming shape. **Whoever closes that gate writes the ADR that reverses 0067**,
in the commit that finishes the lane, exactly as 0067 asks.

## Stage C — capture

**Independent of A, B and D.** It can run concurrently with the whole provider
build-out and shares no file with it. It is scheduled here because everything in
G waits on it.

### C1. Separate the stream from the recording (ADR 0107)

- **Requires** — nothing. **Waits anyway, and on a measurement rather than on a
  dependency**: see *Why this step is not next* below.
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

**Why this step is not next, added 2026-08-14.** `core::capture` is under
measurement by the runtime ownership track, whose
[step 6](runtime-ownership.md) is waiting for one natural `Short` capture — at
about 1.5 % of captures — to read against ADR 0133's pre-registered reading.
That track's own rule is *do not fix the realtime violations before step 6,
because fixing them now makes the next event unattributable*, and this step is
a larger edit to the same file than any of those fixes.

**The claim that saves it is the one not to trust.** C1 promises the dictation
path is byte-identical and offers the existing capture tests as the guard. That
promise may well hold — but this cluster has twice produced an instrument that
reported a loss it had fabricated, green synthetic tests and all (the soak's
3 ms rotation remainder, and step 3's clamped elapsed field). A green suite is
not evidence that the next `Short` capture is still attributable to what it was
attributable to yesterday.

**So the order is: step 6 first, C1 after.** This is a scheduling constraint and
not a dependency — nothing in C1 needs anything step 6 produces, and if the
owner wants C1 sooner, the cost is stated rather than hidden: the wait for a
readable event restarts, and the events already in the record cannot be re-read.
**C2 inherits the wait** because it requires C1. Every other unblocked step in
this plan (B2, B4, B5, B7, D1a, D3, E1) is free of `core::capture` and is free
to run now.

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

### C4. What a two-hour recording costs (ADR 0130)

**Added 2026-08-13**, on the owner's question about long meetings — and the
finding is that the repository had no answer at all. `docs/ROADMAP.md`'s
*Meeting capture* names system audio, echo cancellation, content protection and
the window, and **never mentions transcribing the recording.**

- **Requires** — C1 for the capture half. The two ceilings below are readable
  now and need no code to establish.
- **Touches** — nothing in capture that C1 does not already do. **A meeting is
  C1's turns, not a chunker** (ADR 0130): segmented on silence, not on a clock,
  so there is no overlap to stitch and therefore no seam at which a stitcher can
  duplicate or drop a word. What this step adds is the two limits nobody has
  written down, and a catalogue column for one of them.
- **Validates** — for the catalogue half, the rule B3 already enforces: every
  row carries a source and a read-date, and the column arrives as a
  `CATALOGUE_VERSION` bump.
- **Done when** — a surface can say why a two-hour meeting cannot be live
  transcribed on this connection, and the notes pass over a long transcript has
  a ceiling it can read rather than a failure it discovers.

**The three limits, in the order they bind — and the upload size is the least
of them.**

1. **The default lane does not stream.** The catalogue records Groq speech as
   `streaming: "unsupported"`, *batch only, no websocket, no `stream=true`*.
   Live transcription during a meeting is **impossible on the connection this
   product ships with**; it needs D2 and a streaming lane. No surface and no
   roadmap entry says this today.
2. **The notes pass hits a context window.** Two hours of speech is roughly
   twenty thousand words, and that is a ceiling on the *chat* job expressed in
   tokens. `capture_budget` bounds audio and has nothing to say about it.
   **Nothing in this repo records a context window** — not `ModelCapabilities`,
   not the catalogue. It belongs in the catalogue beside `streaming`, because it
   is what a vendor documents per model rather than what an adapter asserts
   (ADR 0115).
3. **The per-turn request count** is already answered — ADR 0107 took the
   donor's global in-flight ceiling for exactly this. Named here so it is not
   rediscovered as a third problem.

**The donor is not the reference for the file half, and that is worth stating
once.** `UploadAudioView.tsx` refuses anything over 25 MB on a third-party key
and says its own cloud handles *splitting, parallel processing, and reassembly*.
That answer is a backend, and `docs/ROADMAP.md` rules one out.

**Corrected 2026-08-13 by ADR 0131, on three counts.**

**Two of the questions this step filed as open were already drawn.** Live
transcription is a `toggle(true)` on the `Meetings` job row, and retention is
`Keep the audio` with `Until the note is saved | 7 days | Never` and its own
`Open decision` badge. Neither was an owner question; both were a prototype
nobody read. **What replaces the first is narrower and is not a product
question**: what the toggle says when the connection cannot stream — ADR 0128's
second rule applied to a toggle, and a **fourth `InertReason` kind**, *this lane
does not stream*, beside no-adapter, role-denied and no-credential.

**Diarization is a third requirement of the meeting lane** and this step did not
carry it. The drawing has said since 2026-08-03 that a meeting wants a lane that
streams **and separates speakers**, with three stages of which only two are
audio and a name that never comes from a recording at all.

**And the donor survey was wrong.** `voxtype` carries a complete meeting
implementation **in Rust** — `src/meeting/` with `chunk.rs`,
`diarization/{simple,ml,subprocess}.rs`, `summary/{local,remote}.rs` — which the
prototype's own Speakers section cites by path. Its `chunk.rs` defaults to
`chunk_duration_secs: 30` behind VAD with a silence hangover, which is the same
figure openwhispr's Silero reaches by a different route: **two independent
donors converge on ~30 s with a VAD**, which is the strongest confirmation this
plan has that ADR 0130 cut it in the right place.

**The context-window answer, corrected 2026-08-13 after reading an
implementation instead of a marketing page** (ADR 0131). `voxtype` does not
solve it — `summary/mod.rs:153` concatenates every segment into one prompt. What
**`meetily`** does is map-reduce with a **sentence** boundary, not a topic one:
`rough_token_count` is characters × 0.35, a window of `token_threshold - 300`
with 100 tokens of overlap, each window snapped back to the last `". "`, and a
combine pass over the chunk summaries. **The principle survives — cut where a
seam already exists — but *topic* was an aspiration and *sentence* is what
exists.**

**And meetily's one shape WordScript may not copy**: `processor.rs:369` takes
the single-pass branch for every non-local provider **regardless of length**.
That is a bet that a cloud context window is always big enough, not a guard.
ADR 0115 already makes a documented model property a catalogue row, so here the
ceiling is knowable per `(provider, model)` and the bet is unnecessary.

**A fourth consumer of a model exists and no axis carries it: the copilot.**
ADR 0047's strip above the HUD bar compares the running transcript against the
index. It is neither transcription nor the notes pass. Whether it becomes a
`JobKey` or rides the assistant's resolution is open — ADR 0040's *one model for
all four* is the argument that it rides.

**Priced 2026-08-14 by [ADR 0135](../decisions/0135-retention-is-a-guard-rather-than-a-timer-the-copilot-runs-on-turns-and-the-picker-is-a-sentence-with-a-sheet-behind-it.md),
and it is not continuous.** It runs **once per finished turn** — the same seam
C1 cuts the audio on and `meetily` cuts the transcript on — and the comparison
against the index is an **embedding plus a nearest-neighbour lookup**, not a
model call. A language model is spent only when a candidate clears the
threshold, which is rare by construction because the strip replaces rather than
stacks. **So the copilot is two consumers, not one, and the second has no axis
at all**: `JobKey`, `ProviderRole` and the catalogue describe transcription,
chat and speech synthesis, and none of them describes an embedding. This step
does not add the axis. It records that the row must name both, which is what
will make the gap visible before the surface is built.

**Retention is C4-adjacent and now has a definition** (ADR 0135, `ROADMAP.md`
gate 2): the audio goes when the session has ended, a transcript with content
exists, and no job still holds the recording — the notes pass, the re-clustering
pass and a running re-transcribe each counting as a holder. The part that lands
on this track is that **`Never` requires a lane that streams**, so it is the
**second caller** for the fourth `InertReason` kind below rather than a separate
mechanism.

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
- **Validates** — `cargo test`, and **two tests rather than one** (ADR 0132).
  (a) **No partial result reaches the session reducer** — ADR 0095 requires this
  to be held by a test rather than a comment, and this is the step that owes it.
  (b) **A partial reaches a surface anyway.** The echo on the dictation overlay
  renders partials, so the contract owes a display path beside the result path;
  an implementation that renders by pushing partials through the reducer breaks
  (a) while appearing to satisfy the feature. `wordscript-native-event` is the
  precedent for a channel that mirrors without deciding (ADR 0019) — **it may
  paint and it may never commit.**
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
- **Read before designing the lifecycle** —
  [`../known-issues/sound-output-underruns-and-reopens.md`](../known-issues/sound-output-underruns-and-reopens.md),
  2026-08-14 addendum. The cue stream is held open, and on 2026-08-14 that
  produced a user-visible symptom: it acquires an output device at process
  start and keeps it, so cues stick to whatever was current then instead of
  following the user's default. *"Its own lifecycle"* above is the right
  instinct and this is the evidence for it. ~~A stream opened per utterance is
  routed when it plays.~~ Runtime-ownership step 7 owns the decision for the cue
  stream; do not decide it a second time here.
- **It landed 2026-08-14 as
  [ADR 0150](../decisions/0150-the-cue-stream-closes-when-it-is-idle-and-closing-it-does-not-answer-where-it-plays.md),
  and it hands F2 two things rather than settling them.** The lifecycle is
  settled: open on demand, close after 60 s idle, and the open costs 14–20 ms
  against 40 ms of warm-up silence already prepended — inherit that shape, not
  the held-open one. **The routing is yours, and the struck sentence above is
  why**: WirePlumber pins a target by application name, so a stream that closes
  and reopens comes back on the *remembered* device rather than the current
  default. Proven with a control probe and then confirmed in the product.
  `list_native_output_devices` plus an explicit choice is the only thing that
  answers it, and this step is the one that has it. **And the open latency was
  measured against a virtual loopback sink — a suspended Bluetooth sink is
  unmeasured**, which is one of the numbers `PLATFORMS.md` owes.

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

  **It carries the provider and model picker, and that is settled rather than
  optional** (ADR 0129, owner's instruction 2026-08-13). The window is where a
  translation is actually run, so it is a point of use in the sense that record
  means, and B7 covers only the two surfaces that exist today. **Build it with
  the picker; do not retrofit one** — the drawn-ahead-of-the-runtime gap that
  ADR 0127 spent a step closing is cheaper to avoid than to repair.

  **What form it takes is part of the open surface question, not separate from
  it.** A table mid-conversation is the worst moment to open a credential
  ladder, so the window may well want the resolved line plus a compact switch
  rather than upload's full disclosure — and ADR 0064 already puts the *route*
  per language, so the two controls sit on one row and must not be confused.
  **That is a drawing decision and it belongs to whoever answers ADR 0064's
  first open point**; B7 settles the obligation, not the shape.
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

B1 + D1 ── B6 (the inherited drawing) ── B7 (the picker at the point of use)

C1 ── C4 (what two hours costs) ── needs D2 for the streaming half
```

**C4 is drawn hanging off C1 and reaching for D2, because that is exactly its
finding**: the capture half is C1's turns and needs nothing new, and the half
that is genuinely blocked is live transcription, which needs a lane that
streams. The context-window ceiling hangs off neither and can be catalogued
today.

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
inherits it rather than writing it again. **B5 landed first and did inherit it**:
`installed_local_chat_tags` is a `pub(crate)` reader over the blocking half of
that same call, so what B4 adds for this lane is now nothing at all.

**One owner question is live, and it blocks no step in A through F.** *Whether a
view plus a pop-out is enough at a table* blocks G2's surface (ADR 0064).
**Open disagreement 13 was the second and lasted a day**: ADR 0128 answered it
with a rule rather than with either of the two options it posed, and closed 10
and 11 with the same rule.

**ADR 0064's open point gained a second half on 2026-08-13 and lost it again on
2026-08-14.** It was *whether a view plus a pop-out is enough interaction at a
table*; the owner's instruction that the translation window carries the provider
and model picker meant that question also had to answer **what a picker looks
like mid-conversation**. ADR 0135 answered the second half — a sentence in the
chrome, a collapsed ladder behind it, effective from the next turn, and a
per-line provider on the produced record. **The first half is still open and is
still the owner's**: whether a view plus a pop-out is enough at a table is a
question about the table, not about the picker.

~~**Two more are live as of 2026-08-13, and both come from C4.**~~
**Withdrawn the same day by ADR 0131: neither was an owner question.** Both were
drawn in the prototype and this plan had not read it — live transcription is a
`toggle(true)` on the `Meetings` row, and retention is `Keep the audio` with
three options and a default of *Until the note is saved*. The retention row does
still carry an `Open decision` badge, so **that one is genuinely the owner's** —
but it is the drawing's own open point rather than something C4 discovered, and
it is `docs/ROADMAP.md` gate 2.

~~**Two that are real, and both are drawn `Open decision` already.**~~
**All three closed 2026-08-14 by [ADR 0135](../decisions/0135-retention-is-a-guard-rather-than-a-timer-the-copilot-runs-on-turns-and-the-picker-is-a-sentence-with-a-sheet-behind-it.md)**,
against a full reading of `donors/app/meeting-notetakers/anarlog` rather than
against a preference. In the order they were open:

- **Retention** keeps the drawn default and gains a definition: *the session has
  ended, a transcript with content exists, and nothing still holds the
  recording* — where the notes pass, the re-clustering pass and a running
  re-transcribe each count as a holder. Meeting audio takes a second namespace
  and a second sweep budget under ADR 0039 rather than sharing its numbers, and
  **`Never` means never written**, which makes it a second caller for the
  fourth `InertReason` kind below. `docs/ROADMAP.md` gate 2 is closed with it.
- **What the copilot costs** stops being *continuous* and becomes **one
  embedding per finished turn, and a model call only on a hit**. The seam is the
  turn — the same rule C1 already applies to audio and `meetily` applies to the
  transcript. The row names **two** models rather than one, which is ADR 0131's
  rule applied to a control that starts two kinds of work, and the embedding
  stage is a consumer no axis in this track carries.
- **What a picker looks like mid-conversation** is ADR 0129's resolved sentence
  in the window's chrome with the collapsed ladder behind it, **effective from
  the next turn** (ADR 0064's rule for the language pair, inherited rather than
  reinvented), and **a produced line carries the provider that produced it**.
  B7's surface inventory gains that last item for the surfaces that do not exist
  yet.

**The donor answered the copilot question by not having one.** anarlog runs no
inference during a call: its two AI tasks are `enhance` and `title`, both behind
`postCaptureAction` in `stt/capture-lifecycle.ts`, and chat is on demand. That
does not make the copilot wrong; it means it is not table stakes, so the row
prices itself rather than justifying a category.

~~**And one that is a research decision rather than a design one.**~~
**Closed 2026-08-13**: both were cloned on the owner's instruction into
`donors/app/meeting-notetakers/`, **both are MIT**, and verifying them corrected
two claims — Anarlog is not GPL-3.0, and the topic-boundary chunking nobody
implements. `anarlog` leads for the meeting work; see the routing paragraph at
the head of this page.

**A third running-text surface exists and neither C4 nor B7 knew it** (ADR
0132). `Live subtitles` in the prototype is **two** features that share only the
word: **Captions** read somebody else's audio onto their own always-on-top strip
and are blocked on system audio, and the **Echo** reads your own voice under the
dictation pill and is blocked on partial results. Neither is *the meeting live
transcript*, which is what ADR 0130 and ADR 0131 meant by the phrase. The echo
is why D2 now validates two things instead of one.
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
| B5 | **done** 2026-08-15 — the installation ADR 0042 drew on 2026-08-03 and never got, and that record's gate closes with it (ADR 0158). `CATALOGUE_VERSION` 2 with an additive `install` block on nine local rows; `core::model_install` with five commands, not the three this page estimated; `wordscript-model-event` on its own channel. `fallback_provider_profiles` returns **nothing** where it used to invent four rows for files that may not exist, and the managed directory is the third source in both `discover_local_provider_profiles` **and** `resolve_local_model_path` — the second half is not in ADR 0122's `Touches` line and without it an install is a profile that is dead at first capture. Six drawn sizes were wrong and are corrected (ADR 0128): five were binary units under decimal names, and `gemma-3-4b-it` was a plausible figure for a pull that costs 3.3 GB. **+20 Rust across three modules and +26 frontend across two new files, every one made to fail first**; one further acceptance is `#[ignore]`d and downloads the real 148 MB file — it passed in 19.3 s. `port:diff`: `models` unmoved at `structural 26 \| style 242 \| text 19`, `models#1` `0\|0\|1` → `0\|0\|7` and the six are the corrections. Free space is answered on unix and **unanswered on Windows**, which is the one clause of ADR 0122 this step did not discharge |
| B8 | **done** 2026-08-15 — the library at scale (ADR 0159). The listing unions every source and the rank decides which file runs, which corrects B5's early return; `AppConfig::local_model_dirs` is a folder list the user sets from the screen; two ways in (`import_model_file` copies, `add_model_folder` does not) plus `pull_model_tag` for the language half. **The search appears only above twelve rows**, openwhispr's own number, so the drawn nine still render as the drawing and `port:diff` is unmoved on `models` (26 \| 242 \| 19) and `models#1` (0 \| 0 \| 7). **+5 Rust and +8 frontend** (844 and 590 total), every one made to fail first. A row the drawing has no sentence for used to crash the tab; the first test written against a user's own model found it |
| B9 | **done** 2026-08-15 — the naming correction the owner asked for after reading B5/B8 (ADR 0160). *On this machine* closed on a section called **The server** whose endpoint is `127.0.0.1`, while the lane row one tab over spends four lines saying a server is another machine; and **Where models come from** sat at the foot of the tab, which by reading order answered for the language card above it — whose files are in a store that list has never described. The section becomes **Runners on this machine** and both its rows are read (`local_setup` on `provider_status`, which the tab was simply never asking for); provenance moves inside each card; `Self-hosted` reads as **Your server** through `LANE_LABEL` and is stored unchanged. **No Rust, and that was the constraint** — a dev host was running and a write under `src-tauri/` restarts the app. **+6 frontend** (596 total), one made to fail first by restoring the old wording. `port:diff`: `models` `26 \| 242 \| 19` → `26 \| 248 \| 20` (the label is one text difference plus the widths that follow it); **`models#1` moves `0 \| 0 \| 7` → `261 \| 30 \| 16`, and ~246 of that is renumbering** — the same tree with the card placed last measures `15 \| 41 \| 18`. The B7 finding arriving as a bill, and the cost the owner accepted |
| B10 | **done** 2026-08-15 — the second half of the owner's read (ADR 0161). **`Acceleration` was claiming the reader has no GPU**: `grep -rn "cuda\|rocm\|Metal" src-tauri/src/` returns nothing, so `no CUDA, ROCm or Metal device found` was a literal making a checkable false claim about the machine it ran on — found by an owner with an Nvidia card. **The fix is not deletion**: the sketch is a deliverable and stays, and it declares itself. `PreviewTag` plus a `tag` slot on `Row` — 15 px, ground, at the LABEL because a marker at the control is read after the value it warns about. Three rows on the machine tab carry it, and the lane row carries it off `Cloud`, **which is ADR 0067's badge rule reaching the screen that offers the lane** for the first time. **242 → 163 visible words on the tab** (−33%), the long sentences moved into tooltips. **+3 frontend** (599 total). `port:diff`: `models` unchanged at `26 \| 248 \| 20`, `models#1` `261 \| 30 \| 16` → `262 \| 30 \| 16`. **And the same three defects had a second copy in `LaneRows`' `Local` branch** — the *server* wording, the GPU literal, and *speech and language share one disk*, which ADR 0122 retired — found by looking at the rendered gallery after the tab was edited, tested and green. **Both regression cases were themselves green for the wrong reason first**: rendered with a runtime, every lane but Cloud is `disabled`, so the clicks moved nothing and the assertion measured Cloud four times. They render in the gallery now and were re-proven by restoring the literal. **+4 frontend** (600 total). `port:diff`: `models` `26 \| 248 \| 20`, `models#1` `262 \| 30 \| 16` |
| B11 | **done** 2026-08-15 — the owner asked why the screen has two tabs at all, and the answer was worth a record (ADR 0162). **ADR 0042's justification is half dead**: ADR 0122 retired *speech and language sit on the same disk*, leaving only the memory argument. **The argument that holds was written nowhere**: a lane is a stored value and an inventory is not, so putting the model library behind `Local` would mean editing the configuration in order to look at the disk. What was actually wrong is that **four of the `Local` lane's five rows restated the tab** — and the cost is measured, not argued: ADR 0160 and ADR 0161 each had to be applied to that branch twice, the second time found by a screenshot after the tests were green. Lane is three rows now, `Manage →` is wired (drawn with no handler since Leg 6), and `Bundled \| Yours` left the lane too — **that one survived the first pass of this very record** and was caught the same way. **+2 frontend** (602 total), both proven by restoring what they forbid. `port:diff` unmoved on both ids, as predicted before the run |
| B12 | **done** 2026-08-16 — added 2026-08-15 out of the owner's *what next*. **The tab installs models for a lane that cannot be selected**: B5 closed ADR 0042's gate and `STATUS.md` lists `local` under implemented features, while `Models.tsx` still disables it. **Not a bug** — ADR 0067 rule 1 makes an offered-but-unfinished lane inoperable on purpose. What is wrong is that **the lock is silent about itself**: no reason, no statement of what this machine already has. **No Rust** — `local_setup` carries the readiness and `useLocalSetup` (B9) already reads it. The distinction it must not blur: *not published* is a product decision, *not ready* is a fact about this disk, and a machine with everything installed is the first case and not the second. **Releasing the lane is a gate, not this step** — that reverses ADR 0067 and needs Phase 5 whole. **As it landed (ADR 0163): two rows, not one**, because `Local` is built-and-withheld while `Your server` and `Enterprise` have no adapter, and one row would have said the same nothing about both. The product's half is a constant with one owner; the disk's half is composed from `runner_ready`, `model_ready` and `chat_ready` forwards and backwards — `Ready` / `2 of 3 ready` / `Not read`. **Wired-only, so `port:diff` is unmoved by construction** (`models` 26 \| 248 \| 20, `models#1` 262 \| 30 \| 16, measured against `git show HEAD:` back to back) and the grown state is held by tests, which is B8's known cost. `local_setup` moved up to `ModelsScreen` and both tabs share one read, because the probe spawns `whisper-cli --help` — two hooks would be the cost ADR 0124 refused at ten. **+6 frontend** (608 total), each proven by five mutations before it was trusted. **And the finding for any track**: ADR 0161's `Preview` tag on the lane row is conditioned on a lane other than `Cloud` being selected, which the lock forbids — so it renders only in the gallery. A marker whose only reachable state is one the product never enters is a marker the product does not have |
| D1a | **not started** — added 2026-08-11 (ADR 0113); **not gated**, and now genuinely the cheapest step in Stage D: D1 extracted the helper it reaches with a second base URL |
| F4 | **not started** — added 2026-08-11 (ADR 0118); a measurement gate, no product code |
| F5 | **not started** — added 2026-08-11 (ADR 0118); the four modules OpenRouter does not cover |
| C3 | **done** 2026-08-12 — the soak night ran 8.00 h and the number is **zero**: 96 segments, every one `Intact`, against a rate that predicted about eight events. The gate asked for a measurement, not a cause, so it is satisfied and Stage G is unblocked. Route B — the real app, silent — is the next measurement |
| B1 | **done** 2026-08-12 — `registered_providers()` answers for the whole table in one call, `src/lib/providerSeam.ts` is the third thing ADR 0106 named, five states rather than three, the two tests that record required both exist and both were made to fail before they were trusted (ADR 0124). +3 Rust tests, +25 frontend across 2 new files, `port:diff` unmoved at `structural 6 \| style 213 \| text 12` |
| D1 | **done** 2026-08-12 — `core/providers/openai.rs` plus one registry line, on a transport and a credential store extracted from `groq.rs` in the same commit (ADR 0113, ADR 0126). `verbose_json` turned out to be `whisper-1`-only on this vendor, so the response format is per model and `ModelCapabilities` is non-vacuous for the first time. **The connection became writable** (ADR 0127) — the chip row, the credential row and every job row read one stored answer, so *a second lane can be operated* is a fact rather than a registry entry. +17 Rust tests, +3 frontend, `port:diff` **unmoved** at `structural 6 \| style 213 \| text 12`, no dependency moved |
| B6 | **done** 2026-08-12 — added the same day on the owner's instruction. The override reads the config in the product and the drawn literal in the gallery, so `port:diff` is unmoved at `structural 6 \| style 213 \| text 12` for that half; the `stt` correction moves it to `structural 9 \| style 217 \| text 12` and that movement **is** the correction. The literal `Set` badge is gone, an unbuilt vendor is offered and disabled with its reason, and the provider select escapes its own inert reason. +6 frontend cases in `Models.test.tsx`, +3 in `providerSeam.test.ts`, all nine made to fail first. `PROVIDERS.md` disagreements 10, 11 and 13 closed |
| B7 | **done** 2026-08-15 — the picker at the point of use, on both surfaces that exist. `src/components/jobProvider.tsx` is the ladder extracted out of `Models.tsx` (ADR 0055's one-implementation rule, not a second copy), and **the extraction moved `port:diff` by zero**, proven by putting the removed override back and re-measuring. `resolve_upload_capacity` answers which `(provider, model, tier)` accepts N bytes; `capture_limits_if_known` keeps *this lane is unbounded* apart from *this build cannot answer*, which is ADR 0106's missing-field rule one axis over; and the sixth `InertReason` kind **outranks a missing credential and yields to every other reason** — a key can be added and a file will not get smaller (ADR 0157). `DropZone` gained `onFile` because a size constraint with no file is a guard nobody can ever watch work. **+6 Rust, +14 frontend across 3 files**, every one made to fail before it was trusted. `port:diff`: `models` 9\|217\|12 → 26\|242\|19 (the override alone), `translate` 0\|0\|9 → 63\|0\|9 (its own 63 nodes and nothing shifted), `contextintake` unmoved — the picker sits behind the `Import` way. Disagreements 6 and 12 closed. **ADR 0135's form for surfaces that run longer than one request is owed by the surfaces that do not exist yet**; the upload intake is the degenerate case it names — one request, so no next turn |
| C4 | **not started** — added 2026-08-13 (ADR 0130), corrected the same day (ADR 0131), extended 2026-08-14 (ADR 0135). The capture half is C1. What is real: the default lane cannot stream, nothing records a context window, and diarization is a third requirement. Two of its "open questions" were withdrawn — the prototype had already answered them. **The fourth `InertReason` kind now has two callers** (`Live transcript`, and `Never` retention), and the copilot is **two** consumers — an embedding per turn plus a model call on a hit — of which the first has no axis |
| D3 | **not started, and not blocked** — its `Requires` line reads D1 and A3, both done. The graph below draws a `B2` line into its column that no `Requires` line supports; the line is decorative and the `Requires` is the contract |
| C1–C2 | **not started, and deliberately not next** — no dependency blocks C1, but `core::capture` is under measurement until runtime-ownership step 6 has read one natural `Short` capture. The reason and its cost are on C1 itself; C2 requires C1 and inherits the wait |
| B2, D2, E1–E2, F1–F3, G1–G3 | **not started** |

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
