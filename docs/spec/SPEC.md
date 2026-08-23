# Spec -- WordScript

Status: created 2026-07-24, last drift check 2026-08-22 (**a wait is two
stages**: the runtime stamps `heard_ms` when the provider returns, so the model
cut of the turnaround carries the hearing and the mode cut carries the
rewriting, each on its own histogram and each absent rather than nought where
no split was measured; the metric detail states its reading in one lead line
and draws one table with named columns instead of two tables of the same
number under two headings (ADR 0247); before it **a draft does the work
its instruction asks for**: the output contract stops reading "never answer"
as "never derive", so an instruction that asks the mode to solve, find, rank or
answer gets the worked-out result rather than its own words back; an echo is
detected in the runtime and reported as `corrected: false` with a warning rather
than delivered as a result; and the overlay pill reads the mode's name from the
one map that holds it, so the chip says `Draft` like every other surface
(ADR 0245); before it **there is no legacy in
a developer build**: the ledger's opaque `retired` tier, its prehistory
stamp, its schema migrations and the duplicate lifetime language counter are
deleted rather than maintained, and a share is stated against the runs it was
measured over (ADR 0244); before it **a reading that lasts
forever is a mergeable accumulator per period**: the activity ledger grows a
month tier that is never pruned, so a pruned day keeps its shape as well as its
figures and a chart on Home reaches as far back as the installation does; every
median, rate and share is derived at read time, every field records the day it
started being measured, the turnaround gains a second one-dimensional cut by
mode, and the file is written minified through a rename (ADR 0243); before it
**a bound on stored
dictations is a bound in bytes**: the index is an append-only journal, the record
ceiling is deleted rather than raised, both collections get a 5 GB warning and a
10 GB ceiling of their own, and the archive shards to day level so a ceiling
stated in bytes is one the layout can reach (ADR 0241, ADR 0242); before it the
history index's two shapes: **the list shape is not the record** -- `TranscriptionHistorySummary`
carries what a row draws with the two transcripts cut to 160 characters, the
whole entry is fetched by id, nothing polls either, and the turnaround causes
moved into the activity ledger as an all-time term (ADR 0240); before it the
record's provenance clause: **a record names what the request carried** -- `provider`,
`model` and `language` are resolved through the pipeline's own functions and are
absent rather than invented where the adapter chose, which closed a case where a
profile-wide speech model belonging to another vendor was substituted on the wire
and stored as if sent (ADR 0225); before it the account row's four
corrections, which read the provider and credential clauses: **a status names the
account it answered about** and a deletion repoints only the profile that ordered
it (ADR 0209); the connection axis before it,
which read the provider and credential clauses: **a connection is an object a
profile points at** — the vendor, the endpoint, the plan and the credential are
one stored object, a profile names one per job, and the secret-store scope that
was the vendor id is the connection's, so two accounts on one vendor are two
keys and a profile switch moves which one pays (ADR 0208); the input-level axis
before it,
which read the events clause: **the runtime measures the microphone before
there is a capture** — `input_monitor_level` is its own discriminator so
`audio_level` keeps meaning "a capture is producing this", the monitor is
leased and a capture always takes the device back (ADR 0170); the account-plan
axis before it read the provider clause: **a plan is keyed by the vendor that sold it**
— `provider_plans` replaces the one machine-wide `provider_tier`, both readers
look their own vendor up, and the settings row states a ceiling it cannot offer
a choice between rather than drawing a control that decides nothing (ADR 0167,
ADR 0168); the stage D1b pass before it read
the lane clause and the port inventory: **`Your server` is configured on the
screen that offers it and is no longer withheld** — a URL and a model id in
`AppConfig`, an optional bearer token in the OS secret store, what is typed
outranking the environment, and ADR 0067 rule 1 reversed for that lane on its
own terms, so two lanes are withheld rather than three; the stage D1a pass
before it read
the capability-seam clause and the port inventory: *no adapter* and *the lane
denies this role* are now decided per role rather than per vendor, because
OpenRouter is the first entry to register fewer roles than its drawn row claims,
and the three withheld lanes are withheld for three different reasons rather
than two — `Your server` had an adapter and nowhere to type its endpoint; the
stage B12 pass before it read
only the two clauses that say what an inert control on `AI Models` states —
the surface-truth clause, which now covers a withheld LANE and not only a
vendor without an adapter, and the screen's entry in the port inventory, which
called all three unoffered lanes *drawn* when one of them is built; the stage
B5 pass before it read
only the event-channel section, which gained `wordscript-model-event` — a
channel that carries an install and may never set session state; the stage B7
pass before it read
only the capability-seam clause it extends — the inert-reason list, which gained
a sixth entry — and the per-job override clause B6 left; the stage B6 pass
before it read
only the provider-axis clause it made false — *the per-job override is still
writable by no surface* — plus the surface-truth clause beside it; the stage B1
pass before it read only the capability-seam clauses and the deviation entry
that denied them; the
stage B3 pass before it read only the model-catalogue entry, the stage A4 pass
before that only the provider axis, and the previous whole-section pass is
Leg 10's, below)

Amended 2026-08-15 by GUI-port Leg 13a's sweep and the decision it produced
(ADR 0153, ADR 0154), which **removed** the `wordscript-native-insert` clause
from the event surface because nothing had ever listened to that channel. **It
read the event-surface section and `core/insertion.rs` against each other, and
nothing else** — it is not a drift check on this file. The check that found it
is `npm run sweep:commands` and it now reports zero in all four defect
directions.

Amended 2026-08-14 by runtime-ownership step 1, which added the runtime commit
deadline to *Clipboard-only commit*. **It read `core/sessions.rs` and the
session-lifecycle section against what they claim, and nothing else** — it is
not a drift check on this file and does not inherit the date above for the
parts it did not read. The clause it added is implemented and its acceptance run
has since passed on both paths ([`../tracks/runtime-ownership.md`](../tracks/runtime-ownership.md)).

Amended 2026-08-14 by runtime-ownership step 4 (ADR 0151) and the decision that
followed it (ADR 0152), which added the restore snapshot and the edit-surface
deferral to *Clipboard-only commit* and two commands to the command surface.
**It read `core/sessions.rs`, `hooks/useRuntime.ts` and the two clauses it
touched, and nothing else.** Both clauses are implemented and both were
exercised in the native host the same day — the deferral is in the runtime log
with its renewal cadence readable from the deferral lines, the restore rests on
the owner's report.

Amended 2026-08-14 by runtime-ownership step 7 (ADR 0150), which rewrote the
cue-stream clause in the deviation list: the stream is no longer persistent, and
the clause said *bound to* the OS default where the truth is that it *asks for*
it and the OS answers from memory. **It read `core/sound/engine.rs` and that one
clause, and nothing else** — same rule as above, it inherits no date for what it
did not read.

Leg 10's line, kept because it is what the sections below were last measured
against: last drift check 2026-08-11 (Leg 10, and it read
only what it changed: the Contracts command list against `invoke_handler`, and
the two deviation-list entries it closed. The whole-file check against the
shipped product is Leg 9's, the same day — the first since Leg 3's shell
overwrite, and it found the Architecture and Contracts sections and the
deviation list all still describing the pre-port surface)

Amended 2026-08-11 by the speech track, which added the streaming-recognition
contract, widened the provider contract and added six deviation entries. **It
read `core/providers/mod.rs`, `core/capture.rs`, `core/sound/engine.rs`,
`core/config.rs`, `tauri.conf.json`, `src/types/providers.ts`,
`src/screens/data.ts` and `src/screens/Models.tsx` against what those sections
claim, and nothing else** — it is not a drift check on this file and does not
inherit Leg 10's date for the parts it did not read. Every clause it added is a
planned contract and says so; none of it is implemented.

Amended 2026-08-11 by stage A1 of that track, which is the first of its steps to
change code. **It read `core/providers/` and moved the two clauses in this file
that described the enum dispatch**, plus the pipeline step that named it; it
read nothing else and does not inherit any earlier date for the rest. ADR 0094's
other half — the provider axis in the config — is still planned and still says
so.

**Re-read the same day under review, which found one claim in the first pass
false**: that `ProviderCapabilities` is read by `AI Models` and therefore stops
a surface claiming a capability its lane lacks. Nothing reads it. The clause is
corrected below and ADR 0106 carries the derivation — recorded rather than
quietly fixed, because asserting a capability the runtime does not have is the
defect class this file exists to prevent.

Amended 2026-08-11 by stage A2, which built the capability axes (ADR 0110). **It
read `core/providers/` and `src/types/providers.ts` and moved only the two
clauses that said the axes were planned**; it read nothing else. The model axis
now exists and is answered per `(provider, model)`, and **the seam is still not
built** — no surface reads either axis, which is ADR 0106 and stage B1.

Amended 2026-08-11 by stage A3, which built the per-role credential (ADR 0105
and ADR 0102's storage half). **It read `core/providers/`, `core/config.rs`,
`core/backup.rs` and `src/types/providers.ts` and moved only the two clauses
that said the credential work was planned**; it read nothing else. A credential
is now keyed `(provider, role, kind)` and clearing one role leaves the others
standing. **ADR 0094's other half is still not built** — the provider half of a
resolution is still the connection's single field — and ADR 0102's acquisition
half (the OAuth flow) is stage D3, so no vendor accepts a subscription today.

Amended 2026-08-11 by stage A5, which removed the on-disk compatibility layers
(ADR 0112). **It read `core/config.rs`, `core/providers/groq.rs`,
`core/shortcut.rs`, `core/backup.rs` and `src/lib/textProfiles.ts` and moved
only the clauses that described a migration**; it read nothing else. Every path
that existed to read an older *local* on-disk form is gone — the plaintext key
in `config.json`, the pre-role and retired-service secret entries, the
millisecond timeouts, the global `auto_paste`, the shortcut and profile
migration bodies, the pynput shortcut dialect, the `auto_detect_mode` alias.
**The two schema counters stay and stamp**, and so does `without_secrets()`,
which now scrubs nothing and carries a promise instead. **A boundary where
something foreign arrives kept its tolerance**: `stt_hints` still reaches an
imported document. The window for this is one release wide and it closed here.

Amended 2026-08-12 by stage A4, which built ADR 0094's other half — the
provider axis in the config. **It read `core/config.rs`, `core/providers/`,
`core/capture.rs`, `core/transform.rs`, `core/history.rs`, `core/backup.rs`,
`src/types/ipc.ts` and `src/lib/textProfiles.ts` and moved only the clauses
that said the config half was unbuilt**; it read nothing else. A profile now
holds a resolved default plus a sparse override per job, every call site names
its own job, and the credential resolves from the provider that job actually
runs on. **The drawing did not move** — `npm run port:diff` is `ALL EXACT` —
because `AI Models` has drawn the override since Leg 6 and this is the runtime
catching up to it.

Amended 2026-08-12 by stage A6, which renamed the local lane's identifier from
`local_preview` to `local` (ADR 0121). **It read every live spelling of the old
id and moved only those**; it read nothing else and no behaviour changed. The
registry alias is gone with the old name, so a stored `local_preview` resolves
to nothing rather than to the lane. **ADR 0067's presentation rule is
untouched** — the lane is still offered as unpublished and still badged, which
is the half a release status belongs in.

Amended 2026-08-12 by stage B1, which built the capability seam (ADR 0106) and
took the command-surface decision that record left open (ADR 0124). **It read
`core/providers/`, `src/screens/Models.tsx`, `src/types/providers.ts` and the
two clauses that said no surface reads a capability**; it read nothing else.
**The correction at the top of this file is now spent**: the mirror is a guard,
held by the two tests ADR 0106 required rather than by this sentence, and both
were made to fail before they were trusted. The model axis is still read by no
surface and still says so.

Amended 2026-08-12 by stage D1, the first adapter (ADR 0096 step 1, ADR 0126,
ADR 0127). **It read `core/providers/`, `shared/model_catalogue.json`,
`src/screens/Models.tsx`, `src/lib/textProfiles.ts` and the clauses that said
Groq is the only integrated lane**; it read nothing else. **WordScript
integrates two cloud vendors.** OpenAI serves recognition and chat on an API
key; the transport and the credential store behind both are one implementation,
and every policy — response format, upload ceiling, key prefix, model
resolution — is the adapter's own. `ModelCapabilities` differentiates two models
on one connection for the first time, which is what ADR 0110 was written for.
**The connection is a stored value the surface writes** (`providers.default` on
the active profile), so the chip row, the credential row and every job row read
one answer. **The per-job override is writable since B6** (ADR 0128): the row's
shape comes from `providers.overrides[job]` in the product and from `data.ts`'s
drawn literal in the gallery, which is what closed open disagreement 13 without
either side losing. A job with no stored override follows the connection, and
*Use the default* deletes the key rather than storing the connection's id.
**A model choice still writes nowhere** (ADR 0042).

**No control on `AI Models` claims a state nothing stored.** The overriding
job's key row read a literal `Set` from Leg 6 until 2026-08-12; it reads the
runtime in three values now, because a vendor the screen never asked about has
not been found to be without a key. A vendor with no adapter stays offered and
disabled with its reason — an inherited drawing is an inventory of intent, and
what is unbuilt stays visible rather than tidied away (ADR 0128).

**And a lane that is withheld states two things apart** (ADR 0163, 2026-08-16).
`Local` and `Enterprise` cannot be selected while a runtime is present, which is
ADR 0067 rule 1. **`Your server` could not either until D1b gave it somewhere to
type its endpoint** (ADR 0165, 2026-08-16): that rule says a lane which is
offered must be operable, so the lane is offered in the commit that makes it
operable and `LockedLanes` drops the row whose reason is spent. What the
Connection card
now adds is the reason, as rows rather than as an attribute a disabled button
could never carry: **what the product still owes** — for `Local`, ROADMAP
Phase 5's remaining list; for the other two, that neither has an adapter — and,
separately, **what this disk already has**, read from `local_setup` as `Ready`,
`N of 3 ready` or `Not read`. The two are never folded: *not published* is a
decision that moves when Phase 5 closes, *not ready* is a fact that moves when
something is installed, and a machine with every piece installed is the first
case and not the second.

Consolidated spec (Layer 1, Lean mode). This is the authoritative
machine-facing summary of what WordScript is and how its parts fit together.
The living overview docs (`ARCHITECTURE.md`, `VISION.md`, `REFERENCE.md`,
`STATUS.md`) expand on the sections below but never override them; when they
conflict, this file wins and the overview doc is the one that drifted.

## Architecture

WordScript is a Tauri v2 desktop product. One native runtime (Rust) owns
trigger, capture, provider dispatch, transform, insert and recovery. One
frontend (React/TypeScript) displays, configures and diagnostically explains
the same native state -- it must not reinvent it.

```text
React UI
  overlay + settings + diagnostics tab
            |
            | invoke() + events
            v
Tauri host
  windows + tray + commands + event bridge
            |
            v
Rust core
  config + trigger + capture + sessions + providers + transform + insertion + sound
```

Three windows:

- `overlay`: transparent compact stage. Recording/processing/result/error
  states share one fixed-size pill. Each delivery mode has exactly one decision
  surface (ADR 0011a): `clipboard_only` stops on a real processing preview
  (Copy / Edit / Abort) before delivery and closes after the commit;
  `auto_paste` delivers first and then shows the result surface
  (Copy / Edit / Dismiss). Which surface is shown follows from runtime state set
  in one reducer commit, not from per-mode predicates. Idle is parked offscreen
  natively. Its size is fixed per surface (`OverlaySurface::dimensions`): one
  `set_size` on first reveal and no dynamic resizing, because `set_size` is
  asynchronous on WebKitGTK and a second resize path is where the ghosting came
  from (ADR 0089).
- `settings`: **the label is the window's, not its job.** Since Leg 3's shell
  overwrite this window is the WORKSPACE — four views (Home, History, Profiles,
  Context) in a sidebar, the active-profile row at its foot, a status strip
  along the bottom edge — and settings is a modal sheet laid over it at its own
  scale (`Cmd+,`, Escape to close), holding ten sections in three groups. The
  fourteen flat areas it replaced were deleted in the same commit (ADR 0054).
  The `tauri.conf.json` label and the URL `#/settings` still say the old name
  because six Rust call sites and the window-state persistence key are on it;
  renaming is a runtime change nobody has asked for, not a doc fix.
- `rebuild-lab`: native-decorated diagnostics pop-out mounting the same
  Diagnostics section the sheet does, rather than a second implementation.

A fourth route exists and ships no window: `/gallery` is the design-time
acceptance surface for the port (ADR 0055), reached only by a chord (ADR 0059),
named by no surface and linked from none.

Rust core modules in `src-tauri/src/core/`:

- `config.rs` -- config lifecycle, disk I/O, scrubbing, local text-profile model
- `runtime_log.rs` -- buffered structured runtime logs (ring buffer + persistent file)
- `history.rs` -- persistent native history: raw vs transformed transcript, insert outcome, server-side filters, export, retention, retry
- `paths.rs` -- product paths (config, scratchpad, logs)
- `shortcut.rs` -- single owner of the shortcut contract (ADR 0006): token vocabulary, canonical form, display strings, validity rules, and the per-session capability matrix (ADR 0007)
- `trigger.rs` -- global start/stop, pause/resume, abort hotkeys, activation modes (tap / double tap / hold, the latter strictly momentary per ADR 0013 and gating all three capture-lane bindings), grab lifecycle and `[trigger]` observability. Every modifier-only capture-lane binding -- start/stop, pause and abort -- is decided at the release edge, where the interruption signal exists; an interrupted chord acts on nothing (ADR 0014)
- `capture.rs` -- audio capture, level/waveform events, silence/max-duration autostop, single stream rebuild after transient error, retained-capture sweep
- `capture_budget.rs` -- what a recording may cost: the processing limit (the longest capture the current provider, plan and model can process at all), the auto-stop in force, the safety margin between them, the transcription wait and the pipeline watchdog deadline. One source for the capture monitor, the settings surface and the overlay; nothing recomputes it (ADR 0038)
- `sessions.rs` -- runtime status and shared session transitions
- `sound/` -- one synthesised G-major theme: startup signature plus listen,
  handoff, done, abort and error cues, four timbre packs, played on a single
  persistent output stream (see ADR 0010)
- `providers/mod.rs` -- shared provider contract, thin resolvers over the registry, typed modes/capabilities/errors
- `providers/registry.rs` -- the role traits (`Provider`, `SpeechProvider`, `ChatProvider`, `VoiceProvider`) and the frozen id-to-implementation table; adding a provider is a module plus one entry (ADR 0094)
- `providers/groq.rs` -- cloud-first production lane (BYOK, secret store, Groq HTTP errors)
- `providers/local.rs` -- local runtime lane (whisper-cli STT, Ollama cleanup, native model discovery, probe-based runner health)
- `confidence_gate.rs` -- drops segments Whisper's own metrics mark as invented; cloud lane only, thresholds are constants (ADR 0016)
- `hallucination_detect.rs` -- repetition collapse, artifact-pattern filter, language-switch observation; a language mismatch alone never discards text (ADR 0016)
- `transform.rs` -- detection stage, exact-string hallucination filter, optional AI cleanup (correction guardrail stack), dictionary, snippets
- `agent.rs` -- hybrid intent detection (heuristic + LLM classifier), agent execution; routing layer before `transform.rs`
- `text_rules.rs` -- text-rules analysis, preview, import/export, conflict handling, profile health
- `mode_router.rs` -- resolves effective `ProcessingMode` per session; `resolve_auto_mode` for auto routing; exposes `resolve_current_processing_mode` command
- `workspace_context.rs` -- foreground-app detection (macOS/Windows/Linux), browser-domain and IDE-framework classification
- `prompt_enhance.rs` -- prompt structuring/expansion over the active LLM lane, guardrail chain, routing into `transform.rs`
- `insertion.rs` -- paste strategies, clipboard restore, scratchpad, `NativeInsertionPlatformStatus` support contract

## Contracts

### Tauri commands (UI -> Rust), key surface

- `abort_native_session`, and it is the **only** session command, because abort
  is the only lifecycle transition a user makes: the overlay draws it, and start,
  stop and completion are transitions the runtime derives from a hotkey, an
  auto-stop or a provider answering. `start_native_session`,
  `stop_native_session`, `native_session_status` and `complete_native_session`
  were removed in Leg 10 (ADR 0091). They were the Python sidecar's IPC command
  set, carried into `febc452` by the rewrite that made them unnecessary, and no
  commit in the repository's history invoked any of them from `src/`. The
  operations live on as Rust: `start_from_native`, `processing_from_native`,
  `complete_processing_session`.
- `sync_overlay_window_visibility`. `reveal_overlay_window` and
  `park_overlay_window` are **not commands** and never were: they are
  Rust-internal functions in `lib.rs`, listed here in error until Leg 9.
- `load_app_config`, `save_config` (config load/normalize/write paths are
  serialized by the config-file lock). `save_config` carries the whole config
  and is the seam every discrete control writes through, including the profile
  health acknowledgement (ADR 0085) — the two targeted
  `*acknowledge_profile_health_flag` commands were removed in Leg 9, having had
  no caller in any commit (ADR 0089).
- `resolve_current_processing_mode` (effective mode source of truth)
- `switch_active_text_profile`, `set_active_profile_processing_mode`
- `commit_pending_transcription_preview` (clipboard_only commit; optional
  `text` replaces the preview text for an overlay edit before delivery)
- `defer_pending_transcription_preview_commit` (an open edit surface asking the
  runtime for another deadline, epoch-guarded; ADR 0152)
- `native_session_snapshot` (what is running, for a window that mounted into a
  session already in progress; ADR 0151). It answers nothing about a session
  that has ended, and `useRuntime` is its only caller
- `native_insertion_status` (platform support contract)
- `check_app_update` (restricted to published GitHub releases)
- `transcript_store_status`, `reveal_transcript_in_file_manager` (the Markdown
  transcript store; the reveal refuses any path outside the store's root)
- `acknowledge_transcription_fallback` (Home's decision inbox, ADR 0076)
- **The history index answers in two shapes, and the list shape is not the
  record** (ADR 0240). `transcription_history_summaries` returns
  `TranscriptionHistorySummary` — the fields the two list screens draw, with
  `heard_preview` and `written_preview` cut to 160 characters and
  `transcripts_identical` saying whether the two differ at all. The whole
  `TranscriptionHistoryEntry` is fetched one at a time by
  `transcription_history_record(id)`, which answers `None` for an id the store
  does not hold rather than erroring. `acknowledge_transcription_fallback`,
  `clear_transcription_history_entries` and `delete_transcription_history_entry`
  answer in the summary shape too, because they answer with the list.
  **A preview is for drawing a row and never for a claim about the dictation.**
  Every surface that places, copies or reasons about the TEXT fetches the record
  first: Copy and Restore on the press, and the raw panel on both list screens
  when a row is opened. A derivation about the whole text -- the raw panel's
  *the AI stage removed words and added none* -- is withheld until the record is
  in hand, because a rewrite past the cut is invisible to both previews.
  `transcripts_identical` is the exception and is why it exists: the runtime
  decides it against the full pair and sends the answer.
  **Nothing polls this.** The frontend re-reads on the three `wordscript-event`
  payloads that write a record — `transcription`, `error`, `empty` — and on
  `visibilitychange`; the five-second interval was removed with the same ADR.
- `export_full_backup`, `import_full_backup`, `reset_all_settings` (both
  destructive ones snapshot the config first and answer with its path)
- `system_color_scheme`, `set_window_color_scheme` (the native half of the
  colour scheme; the overlay window is deliberately not a caller)

### Events (Rust -> UI)

Tauri event channels and their payload discriminators are separate contracts:

- `wordscript-event` carries the typed `BackendEvent` union. Its
  `preview_ready` payload is emitted only for
  `insert_behavior == "clipboard_only"`; `transcription` is the authoritative
  completed result and owns `lastResult`. Every `transcription` payload carries
  `delivery` (`inserted` | `clipboard`, from `NativeInsertMode::delivery_label`)
  so the UI never has to infer what happened to the text.
- `audio_level` on that same union means **a capture is producing this** and is
  emitted only from inside one. The microphone measured with no capture running
  is `input_monitor_level` (`level`, `rms`, every 42 ms) from
  `core::input_monitor`, ended by `input_monitor_stopped` (`reason`) -- a
  separate discriminator precisely so a surface that draws `audio_level` never
  reports a recording that is not happening. The monitor is started and stopped
  by whichever surface displays it, holds a renewable 45 s lease, and is stopped
  unconditionally by `start_native_capture` (ADR 0170).
- `wordscript-native-event` carries native session-status snapshots with
  payload event names such as `recording_started`, `recording_stopped`,
  `processing`, `transcription`, `transcription_corrected`, `empty`, `aborted`
  and `error`. The transcription variants synchronize status and
  `lastTranscription`; they do not replace the authoritative
  `wordscript-event` result.
- `wordscript-mode-event` carries `ProcessingModeEvent` (`mode`,
  `auto_detected`) and is emitted by **every** path that writes the effective
  mode -- the mode hotkeys, the overlay cycler, `save_config` and
  `switch_active_text_profile` -- prompting listeners to re-fetch. It is owed
  alongside the `wordscript-event` `ready` payload, not instead of it: `ready`
  carries the whole config for the Settings form, the mode event is the named
  signal the overlay listens on. Settings saves used to emit only `ready` and
  reached the overlay through a config-identity side effect (ADR 0024).
- `wordscript-model-event` carries `ModelInstallEvent` (`install_id`, `row`,
  `phase`, `received_bytes`, `total_bytes`, `detail`) for an in-app model
  install, where `phase` is one of `started`, `progress`, `verifying`,
  `installed`, `failed`, `cancelled` (ADR 0122, ADR 0158). **It is deliberately
  not one of the session channels and may never set session state**: a download
  is not a session, and ADR 0018/0019's rule that a session ends in exactly one
  reducer commit is enforced here by the channel simply not having the door. An
  install that completes after its cancel is discarded, reported as `cancelled`,
  and recorded in the runtime log.

There is no separate insert event. `wordscript-native-insert` was emitted from
three sites in `core::insertion` and listened to by nothing; the same
`NativeInsertResult` already reaches the frontend as the `insertion` field of
`wordscript-event`, and as the return value of `insert_text_native` and
`restore_last_transcript`. Removed 2026-08-15 (ADR 0154), on the rule that a
session ends in exactly one reducer commit — a second channel carrying the same
result out of band is what ADR 0018/0019 forbids.

Frontend reducer action names such as `NATIVE_TRANSCRIPTION_SYNC` are internal
UI implementation details, not Rust event names or Tauri channels.

### Provider contract

- `ProviderStatus`: typed modes (`fast`, `quality`, `local`, `self_hosted`),
  capabilities (Transcription, Chat-Cleanup, Speech-Synthesis, Local,
  API-Key-Required, Prompt-Bias, Language, Segments), the model-axis answer for
  the model the request named, `local_setup` typed status for the local lane,
  and `self_hosted_endpoint` for the user-run one — the base URL in force, which
  of the two doors supplied it (`config` / `environment` / `unset`), why it was
  refused if it was, and the same pair for the model id (ADR 0165). Both are
  lane-specific blocks and are `null` for every other lane.
- **API-Key-Required answers *must*, and the accepted credential kinds answer
  *may*** (ADR 0165). They were held equal until `self_hosted`, which accepts a
  bearer token because speaches and LocalAI may issue one and requires none
  because `whisper-server` issues none at all. The registry holds them as an
  implication — a lane demanding a key accepts one — plus a behavioural claim: a
  lane accepting no kind refuses to store one.
- `ProviderCommandError`: `kind`, HTTP status, `retryable`, `Retry-After`,
  `user_action`. UI must relay this, never invent its own error categories.
- `local` (on-device, the lane this build runs) and `self_hosted` (user-run
  remote/LAN, **active for speech since 2026-08-16**) are not interchangeable
  labels: one reads a file where it lies, the other posts an upload to a machine
  that is not this one, which is why its base URL is a security boundary and its
  capability block says `local: false`.
- **Dispatch is a registry over three role traits** (ADR 0094), built
  2026-08-11. `core/providers/registry.rs` declares `Provider` (status and
  credential), `SpeechProvider` (recognition, plans, capture ceiling),
  `ChatProvider` (completions) and `VoiceProvider` (synthesis); a
  `ProviderEntry` names one id, its aliases and the implementations behind it,
  and the eight top-level functions in `providers/mod.rs` resolve an entry and
  call a role. The closed `enum ProviderId` is gone. **A provider that cannot
  serve a role does not implement it**: the absence is `voice: None` on the
  entry, never a stub returning "unsupported", and `Some(..)` does not compile
  without an implementation the compiler has seen. `VoiceProvider` is declared
  and implemented by nobody.
- **A connection is a stored object and a profile points at one per job**
  (ADR 0208), built 2026-08-17. `AppConfig::connections` holds
  `{ id, label, provider, base_url, model, plan }` per account: the vendor lives
  there and nowhere else, the endpoint sits beside the credential it may be sent
  with, and the OS-store scope is the connection's id. A profile whose
  connection was deleted keeps naming it and its jobs go inert with that name —
  repointing it would be the build deciding who pays. **The profile that ORDERS
  the removal is repointed, and it alone** (ADR 0209): its reader is standing in
  front of the row, the button only appears with a second account on the vendor,
  and applying the never-repoint rule to it left the row with no vendor, no
  account list and a live *Add* that did nothing. Only the default moves; a
  per-job override is a decision made on a job row and keeps the rule. **A
  dangling default is not repaired on load and a dangling override is no longer
  dropped there** (ADR 0209) — dropping an override IS repointing it at the
  default, because an absent override is the stored form of *follow the
  connection*. The Account row states a pointer that resolves to nothing, names
  the profile holding it, and offers every account as the way out. The lift makes one
  connection per vendor any profile names, moves `provider_plans`,
  `self_hosted_base_url` and `self_hosted_model` onto it, and **moves** the
  stored keys from `{vendor}.{role}.{kind}` to `{connection}.{role}.{kind}`
  rather than copying them.
- **The provider axis in the config is per job** (ADR 0094's other half), built
  2026-08-12. A profile holds `providers: { default, overrides }` — a resolved
  default plus a **sparse** map keyed by `JobKey`, where an absent job is not a
  job without an answer but one whose answer is *follow the connection*. **Both
  values are connection ids since ADR 0208**, and the vendor is read off the
  connection rather than stored twice. That
  absence is the stored form of the drawn select's first option, and it
  resolves at read time rather than being baked in at write time. `JobKey` is
  the eight drawn columns (`dictation`, `meetings`, `upload`, `cleanup`,
  `rewrite`, `translate`, `enhance`, `assistant`) and `JobKey::role()` is the
  single bridge to `ProviderRole`, so which credential a job spends follows
  from which job it is. **`meetings` and `upload` have no runtime path** —
  there is one transcription path and it is `dictation` — and they are variants
  so an override stored against one survives the build that grows its path.
  **Two fields meant "the provider" before this** and could disagree:
  `speech.provider` per profile, which the live pipeline spent, and a
  machine-wide `AppConfig::provider`, which the retry and history paths spent.
  The machine-wide one is gone; the schema-5 profile migration lifts the
  per-profile one onto the axis behind a `core::backup` snapshot. Titles ride
  the assistant's resolution and carry no override, because ADR 0087 settled
  that its row states rather than sets. **The account plan rides on the connection**:
  it was machine-wide, then keyed by vendor on the argument that a plan belongs
  to a credential (ADR 0167), and the object that argument was reaching for is
  the connection — two accounts on one vendor do not share a ceiling.
  `AppConfig::plan_for` takes a connection id; the lift off the old per-vendor
  map lands each plan on the account it was bought for, behind a `core::backup`
  snapshot (ADR 0208).
- **`VoiceProvider`'s contract is designed and its method is not written**
  (ADR 0114). The trait carried no methods because no vendor shape had been
  read; fourteen synthesis candidates across four protocol shapes have now been
  surveyed, and they agree that synthesis takes text, a model or voice
  identifier and a format, and returns audio. The contract is therefore **one
  method, `synthesize_speech`**, with the voice as an optional field because
  Azure Speech puts it inside the model id and ElevenLabs beside it; streaming
  synthesis grows beside it later, the order ADR 0095 set for recognition. The
  signature lands with its first implementation (plan step F1), not ahead of it.
  Planned; not built.
- **Speech synthesis is two jobs, not one** (ADR 0119). `JobKey` gains `voice`
  for the desk and `translation_voice` for the conversation, because a job is
  the unit at which a provider, a model and a credential resolve, and the two
  rows pick different models: the desk speaks **as** WordScript in the user's
  language (ADR 0043's one voice, one body), the translation speaks somebody
  else's words in a language that is by definition not the user's, at
  conversational tempo. Both resolve the `Voice` role, so **one credential per
  provider serves both** (ADR 0105) and neither admits a subscription
  (ADR 0102). The output route stays per language and per machine (ADR 0064);
  the model does not. Planned; not built.
- **The synthesis palette is committed, not surveyed** (ADR 0118). Cartesia,
  Bland and MiniMax get their own modules because OpenRouter does not carry
  them; Azure Speech gets one because OpenRouter carries it without SSML, which
  is where its emotion styles live. The build order follows a
  time-to-first-byte measurement taken on this machine, because no candidate
  publishes one this repo will repeat. Planned; not built.
- **The OpenAI-compatible audio shape is one implementation, not one per
  vendor** (ADR 0113). `GROQ_API_BASE` is `https://api.groq.com/openai/v1` and
  the speech call posts to `{GROQ_API_BASE}/audio/transcriptions`, so the one
  integrated cloud adapter is already this shape with a Groq host. Parameterized
  by base URL and credential it also serves OpenAI, OpenRouter and a user-run
  server, which is why **the Self-hosted lane gains `dictation`, `meetings` and
  `upload`** rather than refusing them. A free base URL is gated on HTTPS **or**
  a private host. Self-hosted *synthesis* was not read and is not claimed.
  **Built 2026-08-16** (ADR 0164 for the adapters, ADR 0165 for the
  configuration) and **moved onto the connection 2026-08-17** (ADR 0208): the
  endpoint and the model id are fields of the account that names the server,
  typed on the connection card and outranking
  `WORDSCRIPT_SELF_HOSTED_BASE_URL` and `_MODEL`, which stay machine-wide
  because an environment is; the optional bearer token is in the OS secret store
  under `{connection}.speech.api_key`, beside the URL it may be sent to; and the lane never asks a server for
  `verbose_json`, because it claims no segments and a server that does not know
  the spelling answers 400 to the whole request.
- **A model id resolves from one dated catalogue** (ADR 0115, scoped by
  ADR 0120), built 2026-08-12. `shared/model_catalogue.json` carries one row per
  model this build routes to, defaults to or makes a statement about —
  `(provider, role, model_id, documented streaming, languages, source,
  read_date)` — with `shared/model_catalogue.schema.json` beside it.
  `core::model_catalogue` loads it through `include_str!` behind
  `CATALOGUE_VERSION`, the shape `core::regression_corpus` already has;
  `src/lib/modelCatalogue.ts` imports the same file. **A consumer names a row by
  a stable slug, never by the model name** (`anthropic-chat-sonnet`, not
  `claude-sonnet-5`), so a vendor's next generation is a change to one
  `model_id` and to nothing else. The runtime's five defaults resolve through
  `runtime_defaults`; the `AI Models` matrix's per-lane lists resolve through
  `lanes`. **It is not `ModelCapabilities`**: one records what a vendor
  documents, the other what an adapter asserts, and a catalogued model with no
  adapter answers `unknown` — the local rows are the live case, documented as
  streaming while `core::providers::local` answers `Unsupported`. **It is not a
  whitelist either**: a model absent from the file round-trips through the
  config as a typed override, which is what Azure's deployment name and a
  self-hosted server's model id depend on.
- **Capability axes split between provider and model** (ADR 0110), built
  2026-08-11. `speech_synthesis` is a provider-level role question and joins
  `transcription` and `chat_completion` on `ProviderCapabilities`;
  **`transcription_streaming`, `reports_detected_language` and
  `synthesis_streaming` live on `ModelCapabilities`**, because one OpenAI key
  serves `gpt-4o-transcribe` (streams) and `whisper-1` (does not), and the local
  lane repeats the split across Parakeet's online and offline models. The
  `Provider` trait answers both — `capabilities()` and
  `model_capabilities(model)` — and `providers::model_capabilities(provider,
  model)` is the resolver, taking **both arguments always**, on the shape
  `capture_limits` already had. A job asks its resolved `(provider, model)`
  pair, never its lane's name.
- **A model answer is three-valued**, not a boolean: `supported`,
  `unsupported`, `unknown`. A model list that belongs to the vendor cannot be
  enumerated ahead of time, and **a model whose capability is unknown is not a
  model that streams**; an unresolvable provider answers `unknown` on every
  field rather than lending the default lane's answer. Both registered lanes
  answer `unsupported` on every field today — Groq because its speech endpoint
  is batch only, the local lane because it shells out to `whisper-cli` and
  echoes the language it was told. **A provider cannot claim a role it did not
  register**: a registry test holds `speech_synthesis` to `voice.is_some()`
  across the whole table, so a lane with no `VoiceProvider` cannot state a voice.
- **The four fields ADR 0094 named land on those two axes** rather than all on
  the provider struct. Both structs are mirrored into `src/types/providers.ts`
  and travel on `provider_status`.
- **A status names the account it answered about** (ADR 0209), 2026-08-17.
  `ProviderStatus::connection` is the request's own value, stamped once in
  `provider_status` rather than by each adapter, and a registry-walking test holds
  every registered vendor to it. The status is keyed by VENDOR (ADR 0124) while
  the rows that render a credential are scoped to an ACCOUNT (ADR 0208), so
  without the echo one vendor with two accounts had one answer and two rows: the
  badge described whichever account was read and the field wrote whichever was
  selected. A surface renders a credential only from an answer naming the account
  it is rendering, and reads **Not read** otherwise — a third answer, not a
  missing key. `useProviderSeam` asks about the ACTIVE account for the vendor the
  profile is on and about the first for every other, which is the account each of
  those would be reached with.
- **The capability seam is built** (ADR 0106, ADR 0124), 2026-08-12, and the
  mirror may be called a guard for the first time — the two tests that record
  required both exist and both were made to fail before they were trusted.
  `AI Models` reads `status.capabilities` for *can this be operated*; the
  `PROVIDERS` table in `src/screens/data.ts` stays the drawing and has stopped
  being a runtime claim. **`registered_providers()` answers for the whole
  registry in one call**, reads no credential, and **a vendor's absence from it
  is how *no adapter* is stated** — which is what lets that sentence be told
  apart from *the lane denies this role* (the roles the entry registered) and
  from *the role has no credential* (`role_credentials`, ADR 0105). **The first
  two are decided per role since 2026-08-16** (D1a, ADR 0164): a registered
  vendor missing a role reads as *no adapter for that role* where the drawn
  `stt`/`llm` says the vendor serves it, and as *the lane denies it* only where
  the drawing agrees. Registering fewer roles than a drawn row claims is a fact
  about this build, and OpenRouter is the first entry where the two differ.
  Two further
  states are about the read rather than the vendor: a read that has not come
  back claims nothing and leaves the surface's own reason standing, and **an
  incomplete capability block is reported, never read as nine `false`s**. The
  drawn-name-to-runtime-id correspondence lives in `src/lib/providerSeam.ts`
  with a three-direction test as its keeper, because `data.ts` may not carry a
  runtime id and the model catalogue may not declare a vendor without model
  rows. Built.
- **A job's provider is chosen where the job starts** (ADR 0129, ADR 0131,
  ADR 0157), 2026-08-15. Two surfaces do it today — the import intake and the
  translation window — and each states the resolved provider and model as a
  sentence before the work begins, with the same ladder `AI Models` renders
  behind a collapsed disclosure. **Nothing new is stored**:
  `providers.overrides[job]` is the same per-profile map, and
  `resolveConfigJobProvider` is still the only resolution path. A **sixth**
  reason a row can be inert joins the five above — *the file is past what this
  vendor accepts in one request* — and it is the first that depends on the thing
  being sent rather than on the vendor alone, which is why it cannot be answered
  by a settings table. `resolve_upload_capacity` answers which
  `(provider, model, tier)` accepts a given number of bytes, reading the plan off
  the config so a surface cannot answer against one the pipeline is not on; it
  reports *unbounded* and *unknown* as different answers, and **never reroutes
  the audio** — the option greys, the reason is stated, and the vendor that fits
  is offered. Built for the two surfaces that exist; the meeting HUD, the
  translation window's own picker, Live subtitles and the agent overlay carry the
  same obligation into the step that builds each.
- **`voice` is the ninth `JobKey`** (ADR 0109). The union carries eight and four
  records already write contracts against the ninth; the drawn `Speaking` job
  sits outside the lane axis and that is the shape the type follows. Where the
  translation voice sits on `AI Models` is an open owner question and is not
  decided by the type. Planned; not built.
- **A provider may carry more than one credential kind, and the kind is per
  role** (ADR 0102's storage half), built 2026-08-11. `CredentialKind` is
  `api_key` or `subscription`, and **admissibility is decided in the type**, as
  ADR 0094's role rule is: `CredentialKind::is_admissible_for(role)` answers
  false for a subscription against `speech` and `voice`, so the five chat jobs
  (`cleanup`, `rewrite`, `translate`, `enhance`, `assistant`) are the only ones
  it can pay for and there is no runtime "unsupported" error, because there is
  no call to make. `Provider::credential_kinds()` states what a vendor accepts
  and a kind absent from it is refused where it would be stored, with the vendor
  named; **a registry test holds the subscription kind to OpenAI alone**, which
  is ADR 0102's refusal enforced by the table rather than by a sentence. Groq
  accepts an API key and nothing else; the local lane accepts none at all, which
  is what that lane *is* rather than a lane missing one. Still open: credential
  *shape* — self-hosted's base URL plus model id, the enterprise three's three
  ladders, and the OAuth token set itself, which is ADR 0102's acquisition half.
- **The credential resolves from `(connection, role)`, and "follow the
  connection" follows the provider only** (ADR 0105, rescoped by ADR 0208),
  built 2026-08-11 and moved 2026-08-17. `ProviderRole` is `speech`, `chat` or
  `voice` — the three traits as a value. The secret-store entry is keyed
  `(scope, role, kind)` where the scope was the vendor id and is now the
  connection's, so an employer's account and a private one on one vendor are two
  entries; **clearing one role's credential cannot clear another's, and clearing
  one account's cannot clear another account's**; a role with no credential answers `configured:
  false` and names what is missing, never the other kind the same provider
  holds. Which roles exist is `ProviderEntry::roles()`, so a credential cannot
  be stored for a role with no implementation. A save that names no role reaches
  every role the kind can pay for, because the one drawn key row sits on the
  connection and a key is a way into an account rather than into a job; a
  subscription is filtered out of that fan-out for every role but chat. The
  command surface is `SaveProviderApiKeyRequest { provider, api_key, role?,
  kind? }` and `ClearProviderApiKeyRequest { provider, role?, kind? }`, both
  optional so no surface has to send a role it has no control for, and both
  carry the `connection` the credential belongs to. An empty connection is
  legitimate and means *no account named* — it is what the local lane's probe
  sends, since that lane authenticates against nothing.
  `ProviderStatus` answers per role in `role_credentials` and folds them into
  the one `credential` block **conservatively**: configured means every role has
  one, because overstating readiness is the fake-state defect and understating
  it is visible. There is **one entry per `(provider, role, kind)` and no
  second place to look**: the pre-role entry name, the retired bundle
  identifier and the adoption that fanned one string across both roles were
  removed by ADR 0112, together with the plaintext key an older build wrote
  into `config.json`. **The provider half of the resolution is now per job**
  (ADR 0094, built 2026-08-12): `AppConfig::job_provider(job)` answers with a
  `JobProvider { job, provider, overridden }`, and `JobProvider::credential()`
  is the only door from it to a secret — so a job that overrides takes the
  credential of the vendor it runs on and never the connection's, which is that
  record's one security rule expressed as a type rather than as a convention.
- Which vendor serves which role is surveyed in `docs/PROVIDERS.md`, dated per
  row. That document is the capability reference; it is not a statement of what
  is integrated.

### Streaming recognition contract

**Planned, not built.** ADR 0095. It stands **beside** the batch contract and
does not alter it: `transcribe_audio_file` remains the dictation path, no
partial result reaches the session reducer, and ADR 0018/0019 are untouched.

- The unit is an **utterance**: zero or more `Partial { text, language,
  confidence }` followed by exactly one `Final { text, language, segments }`.
- **Its first implementation emits no partials.** A voice-activity segmenter
  marks the utterance and the adapter transcribes it as a file, so the same
  contract serves a lane that streams and one that does not; a surface asks
  `ModelCapabilities` for its resolved `(provider, model)` pair rather than the
  lane's name (ADR 0095 as ADR 0110 corrects it — the question moved one level
  down, from the provider struct to the model's).
- Every streaming result is guarded against the active `processing` session id,
  per utterance, on the pattern `sessions::is_processing_session_current`
  establishes.
- Turn segmentation and partial results are **separate requirements**. A
  conversation needs the first; a caption strip needs the second.
- **A turn is a recording and the stream is not** (ADR 0107). `core::capture`
  couples the cpal stream's lifetime to one bounded buffer taken whole at
  `stop_native_capture`, and a conversation needs them separated: the stream is
  held for the session, a recording window opens per turn, and
  `CaptureIntegrity`, `capture_budget` and `transcribe_audio_file` all apply per
  turn unchanged. `max_samples` is therefore a turn ceiling, not a session one.
  The runtime mute (ADR 0098) holds the segmenter as well as the recording, so
  the deaf stretch is not a turn boundary. A provider needing a sample rate
  other than `TRANSCRIPTION_SAMPLE_RATE` converts inside its own adapter.

### Insert contract

Insert outcome carries `recovery_action`, `recovery_message`,
`clipboard_restore`. UI, history, export and diagnostics must use this -- they
may not derive recovery from free-text `fallback_reason`.

Insert modes: `direct_paste` -> `clipboard_only` -> `clipboard_fallback` ->
`scratchpad_fallback`.

### Mode contract

`ProcessingMode` (orthogonal to provider modes): `auto` / `cleanup` /
`rewrite` / `translate` / `agent` / `prompt_enhance` / `verbatim`.

Effective mode resolution (per session) via `mode_router::resolve_processing_mode`:
1. active `TextProfile.work_mode.processing_mode`
2. legacy global `AppConfig.processing_mode` only when the active profile
   cannot be resolved; its default is `auto`

There is no runtime override layer. The mode picker, the mode cycle and the
per-mode hotkeys all write the profile and persist it, so the profile is the
single source. The process-global override that used to outrank it was never
cleared and made every later settings change invisible (ADR 0024).

**The active profile is fixed for the duration of a session** (`Capturing` or
`Processing`). `switch_active_text_profile` and any `save_config` that would
change `active_text_profile_id` are refused with
`sessions::PROFILE_LOCKED_DURING_SESSION`, because the profile decides the
recognizer settings and those are committed when recording starts. Everything
derived from the profile -- text, vocabulary, dictionary, snippets, label,
agent name, communication style, translate settings -- is snapshotted into
`NativeCaptureConfig` at capture start. The processing mode is the single exception: it is resolved at
pipeline time and therefore still applies to the recording in progress. One
rule: during a recording only the processing mode changes anything; everything
else applies from the next recording (ADR 0025).

The mode is the ONLY input to transform behavior.
`ProcessingMode::transform_preset()` is the single producer of `post_process` /
`filter_fillers` / `professionalize`; no per-profile or global field can change
it. `rewrite_style` is derived from the mode, not stored as a second axis. See
ADR 0020.

When effective mode is `auto`, `resolve_auto_mode` picks per transcription, first
match wins: agent-name + task (heuristic >= certain threshold) -> `agent`;
imperative + IDE context -> `prompt_enhance`; heuristic in the uncertain zone ->
one LLM classifier call, then `agent` or `cleanup`; else -> `cleanup`. That is the
only place intent is classified and the only commit point -- a concrete mode is
never re-decided downstream.

`verbatim` and `rewrite` are manual-only: `resolve_auto_mode` cannot return
either, enforced by test, not by convention. Rewrite is a deliberate stylistic
choice; Verbatim was measured as an Auto candidate and rejected (see
`known-issues/auto-mode-verbatim-routing.md`).

Workspace context is collected once per session when the active profile allows it
(`ProfileModesSettings.collect_workspace_context`; the pre-rename key
`auto_detect_mode` was accepted as a serde alias until ADR 0112 and is not
any more). It reaches every mode: Auto routing as a category signal,
and the cleanup, rewrite and agent prompts as exactly one bounded hint line that
forbids deriving content from it.

The profile context holds topics, not spellings, and reaches the LLM stages
only. The recognizer never reads it: an initial prompt conditions the decoder on
literal tokens, so a topic cannot bias it. The only profile path to the
recognizer is `vocabulary_hints`, whose slots the runtime allocates (ADR 0017,
narrowed by ADR 0035), and no surface may report a context line as rejected by a
path it does not travel. See ADR 0032. The context field stays a form because
topics are few, stable and knowable in advance; the term list does not, because
it grows with every new project.

**The recognizer is never sent an empty initial prompt.** With no terms to
carry, `build_transcription_prompt` returns `BLANK_STATE_RECOGNIZER_PROMPT`, a
constant register line with no profile content in it, on both lanes and through
the same budget and truncation as any other prompt. An absent prompt is not a
neutral request: the decoder falls back on its training distribution, whose
nearest attractor on quiet or damaged audio is the subtitle corpus. The floor is
not a profile path and does not touch ADR 0032; it also never overrules a
channel the user switched off (`bias_mode=off`, `local_prompt_strength=off`),
because those callers return before it is reached. The recognizer preview shows
it, and the provider's `transcription start` log line carries `prompt_chars` so
what reached the provider is checkable from a real dictation. See ADR 0036.

It reaches every mode it does travel to at one width (ADR 0021), but what a mode
may do with it differs. In `agent` it is a reading aid for the instruction and
nothing else: it sits in the system prompt behind an explicit prohibition on
deriving content from it, the user turn carries the transcript alone, and
snippets contribute trigger without expansion. See ADR 0023.

`agent` output is the artifact the instruction asks for and never a reply to the
user: the prompt opens with `AGENT_OUTPUT_CONTRACT`, ahead of profile context
and style block, and fixes the addressee to the person the instruction names.
**When the instruction asks for something to be worked out -- solved, decided,
chosen, found, ranked, guessed or answered -- the finished result of that work
is the artifact and is produced** (ADR 0245). The prohibition is on addressing
the user and on adding content nobody asked for; it never bounds work the
instruction explicitly asks for. Returning the dictated content as plain text is
the fallback for a transcript that carries no instruction at all, and the
runtime detects a reply that is the instruction, reports `corrected: false` and
a `transform_warning` rather than delivering the echo as a result. It holds at
every register, `off` included. See ADR 0026 and ADR 0245.

**`agent` carries out an instruction; it does not act** (ADR 0029). It is one
chat completion over two messages, and it gains no tool-calling surface, no
execution loop and no ability to produce effects outside the text it returns.
This is a contract, not a current implementation limit: side-effecting tools
stay out of the dictation path because a tool loop has no single session end
(ADR 0018/0019), because the delivery architecture presupposes a text result
(ADR 0011a), and because speech is a low-confidence channel that must not drive
actions (ADR 0016).

The per-profile communication style (`ProfileModesSettings.communication_register`
/ `communication_length` / `style_instructions` / `style_sample`) is read by
`agent` and `rewrite` only, through one producer, `core::communication_style`.
The register sets form, never wording — slang and youth language may come only
from the user's rules and writing sample, never from the model's own memory.
Precedence is fixed and stated in the prompt: preset, then rules, then sample,
with the sample subordinate for form and authoritative for wording. Default is
`off`, at which every prompt is byte-identical to the pre-style build. The two
free-text fields are bounded, and `analyze_communication_style` returns what the
budget accepted, what it dropped and what the result costs -- the surface states
the cost rather than counting the characters in the field, which is a higher
number whenever whitespace collapses, a rule repeats or a rule runs long.

Every prompt WordScript sends is written in English regardless of dictation
language, and each states explicitly that the output language is the dictated
one.

## Data Model

No Tenant/User/Profile (multi-tenant) split. WordScript is local-first with
no account. Entities:

- **Transcript file** (`transcript_store.rs`, ADR 0074): every record that
  produced text is also a Markdown file at
  `~/WordScript/transcripts/<YYYY>/<MM>/<DD-HHMM>-<slug>.md`, with frontmatter
  (`id`, `created`, `profile`, `mode`, `provider`, `model`, `duration_ms`,
  `delivery`, and `audio` while a capture is kept) and the written text as the
  body; the heard text follows under `## Heard` only where the two differ.
  `duration_ms` is the capture's `recorded_seconds` — the audio rather than the
  clock — and is left out rather than written as zero wherever nothing measured
  one, which is a retry, an upload, and any record older than ADR 0079's
  measurement (ADR 0086). The slug comes from a title the chat model writes,
  falling back to the first words (ADR 0077) — asked on every processing mode
  including Verbatim, which is deliberate (ADR 0087).
  Written from `record_entry_with_work_mode`, which is the one place a history
  record comes into existence, so no path can skip it. **The runtime creates a
  file once, never edits one, and deletes only paths a history entry named** --
  with the one exception ADR 0237 names, `purge_transcript_archive`, which walks
  the store's own layout behind a button on Privacy & Data.
  **The archive is its own collection with its own lifetime (ADR 0237, amended by
  ADR 0241).** The index retention (`history_retention_days`) drops entries and
  leaves their files where they are; an intentional delete -- one record, the
  whole history, or the purge -- still takes the file. So a file whose entry has
  been pruned is an orphan by design: History cannot list, reveal or retry it,
  and the count on Privacy & Data (`transcript_store_status`, which reports
  `files` and `bytes`) is the only surface that states it exists.
  **That lifetime stopped being infinite.** ADR 0237 decoupled the files and left
  the answer to *when do they go* as *never*; the archive now has the same byte
  budget the index has, independently -- warning at 5 GB, ceiling at 10 GB,
  oldest first, enforced at startup and in the collection that hit it only. The
  layout is `<root>/<YYYY>/<MM>/<DD>/<DD-HHMM>-<slug>.md` (ADR 0241): a 10 GB
  ceiling under the old `YYYY/MM/` would be about 1.2 million files in one
  directory. Files written before the shard are NOT moved and a month directory
  holding them stays a shard of its own. `transcript_store_status` reads a
  directory stamp per day against a sidecar tally rather than stat-ing every
  file, so a reader deleting files by hand moves exactly one stamp and only that
  shard is recounted.
- **AppConfig** (`config.rs`): persisted app config. Holds global settings,
  the text-profile collection, active mirrors for profile-bound settings,
  provider selection, seven mode shortcuts (picker plus six direct modes),
  overlay placement, `profile_health_acknowledged_flags` map.
- **TextProfile** (local text profile): `prompt`, `vocabulary_hints`
  (`VocabularyHintEntry { id, phrase, use_as_prompt_hint, origin,
  learned_at_ms, hit_count, observation_count }`), `dictionary`, `snippets`,
  `schema_version`, `TextProfileWorkMode` (`processing_mode`,
  `enhance_sub_mode`, `target`, `insert_behavior`) plus optional profile-bound
  `speech`, `modes` and `capture` settings. Profiles are local and manually
  activated; no automatic app-based activation, no team sync.
  `prompt` holds topics and goes to the LLM stages only; `vocabulary_hints`
  holds the individual terms and is the only profile path to the recognizer
  (ADR 0032). A term carries no spoken form, and every entry reaches every LLM
  stage as granular context unconditionally -- Prompt Enhance included (ADR
  0033, corrected by ADR 0035). Terms of at least seven characters also drive
  `core::vocabulary_repair`, a deterministic pass that runs before dictionary
  and snippets in every mode including Verbatim, rewrites spans within a
  normalized edit distance of a term, declines wherever it cannot decide, and
  reports every repair through `applied_rules`. `dictionary` is scoped to
  shorthand the user speaks on purpose, because that is the only case with a
  knowable left-hand side.

  **The list fills itself** (ADR 0035). `core::vocabulary_learning` reads the
  correction stage's own output -- the raw transcript against the delivered text
  -- and records a candidate when a replacement looks like a misrecognized name
  rather than a rewording. Candidates live in `vocabulary-candidates.json`
  beside the history file. A term is promoted into `vocabulary_hints` after two
  sightings in two deliveries; a hand correction in the overlay counts as two
  and promotes on sight. Promotion writes through the config file lock and emits
  `ready` plus `wordscript-learning-event`, which is presentation only and never
  touches session state (ADR 0018/0019). Failures are logged and swallowed:
  learning runs after the insert and must never fail a delivery.

  **The runtime allocates the recognizer's slots**, ordered by terms below
  `vocabulary_repair::min_repairable_chars()` first, then by
  `observation_count`, filtered by the recognizer's own form rules and capped at
  `MAX_TRANSCRIPTION_STT_HINTS`. Short terms lead because they are
  unrecoverable once the transcript exists, while a long term the recognizer
  mangles is restored by repair afterwards -- the order a user picks by hand is
  the reverse, which is why it is no longer a setting. `use_as_prompt_hint` is a
  migration remnant read by nothing. `VocabularyRepairCoverage` reports which
  terms clear the repair floor, so the settings panel names that boundary
  without restating it, and every per-row fact is resolved from the runtime's
  analysis rather than recomputed (ADR 0034). `schema_version` is 4 on both
  sides and **no migration stands behind it**: ADR 0112 removed all four steps
  along with the installations that needed them, and what the counter buys now
  is that the next migration is a one-shot gate rather than a rewrite on every
  save. A load below the current version stamps it and rewrites no field.
  `stt_hints` is no longer read from a config -- it stays because an imported
  `TextRulesDocument` is a v1 payload and the newline string is the only home
  its schema has for terms, which `text_rules.rs` honours and
  `textProfileFromRulesDocument` converts. `use_as_prompt_hint` remains a
  remnant read by nothing. `bias_mode` and `manual_bias`
  are still consulted on the capture path, but no reachable configuration sets
  anything other than the `Conservative` default: ADR 0017 removed the
  bias-policy panel and nothing replaced it.
- **Session** (`sessions.rs`): runtime state machine
  `idle -> capturing -> processing -> completed | aborted | error`. `paused`
  is a capture sub-state within `capturing`. Async provider/transform/insert
  results are guarded to the active `processing` session id; stale results
  after abort or new capture are discarded and logged.
- **TranscriptionHistoryEntry** (`history.rs`): persisted entry with raw vs
  transformed transcript, active profile name, the profile's stored work mode,
  `effective_mode` (what actually ran, which the work mode is not -- it keeps
  `auto` for an Auto record), `transcript_path` (the Markdown file this record
  was written to), `fallback_acknowledged`, insert outcome, server-side filters,
  and `audio_path` for a capture the runtime kept. Retry re-processes from the
  stored raw transcript, or re-transcribes from the kept capture when there is
  no transcript -- the timeout case, where the audio is the only surviving
  artifact (ADR 0039) -- and it re-runs `effective_mode` rather than the cleanup
  transform, through the one dispatch the native pipeline also uses
  (`mode_router::apply_mode_transform`, ADR 0075). **`provider`, `model` and
  `language` name what the REQUEST carried and never what was merely stored**
  (ADR 0203): each is resolved through the one function the pipeline also calls,
  and each is absent rather than invented where the adapter chose -- a role
  default the catalogue attributes to another vendor is neither sent nor
  recorded (ADR 0225), and an empty language means auto-detect.
  **The record holds every field; the wire does not** (ADR 0240). The entry is
  the storage shape and nothing was dropped from it. What reaches a list is
  `TranscriptionHistorySummary`, and sixteen stored fields no screen reads --
  among them `spoken_language`, `provider_profile`, the four `local_*` decoding
  parameters, `recovery_message` and `input_level` -- are simply not on it.
  **The index is an append-only journal** (ADR 0241). `history.jsonl`, one line
  per operation: `{"put": <entry>}` for a record written or edited,
  `{"tombstone": {"id": ...}}` for one deleted. The file is oldest first and the
  store is newest first; a put of an id already held replaces it IN PLACE, so an
  edit never moves a record up the list. A line that will not parse is skipped
  and costs that one record, because an interrupted append leaves a torn last
  line and refusing the file over it would lose every record on the machine.
  A dictation appends one line and the cost does not depend on how many are
  already there -- measured on a release build at 0.006 to 0.012 ms from 1,000
  to 10,000 records, against 3.5 to 38.3 ms for the whole-file write it
  replaced. Compaction rewrites the file compactly through a temporary plus a
  rename, and runs on activation, on a wholesale replacement and past a doubling
  of dead weight -- **never on the dictation path**.
  **There is no ceiling on how many dictations are kept.** `HISTORY_CEILING` and
  `history_limit` are deleted (ADR 0241): a bound on stored dictations is a bound
  in BYTES, and what governs the index is `history_retention_days` with a
  10 GB backstop behind it. An existing `history.json` is read once, converted
  and deleted.
- **ActivityLedger** (`activity_ledger.rs`): the all-time counts Home reads,
  in `activity.json` beside the index. Counts only -- no text, no ids -- so it
  survives every retention rule the index obeys (ADR 0176).
  **Every reading it stores is a fixed-size mergeable accumulator per period,
  and every median, mean, rate and share is derived at read time** (ADR 0243).
  A reading that cannot be expressed that way does not go on Home.
  Two DISJOINT tiers, both of the same row type, and a lifetime figure is their
  sum: `days` rolling at `LEDGER_DAY_ROWS` and `months` never pruned. Pruning
  folds a day into its month, so the figures survive and so does the shape. A
  row carries counts and durations, `turnaround_runs`/`turnaround_ms_sum` for an
  exact mean, a 41-bucket quarter-octave `turnaround_log` for the shape, and the
  language split as `languages` plus `language_refused` -- **the runtime
  increments exactly one of those two on every counted dictation**, so their sum
  is the population a language was asked of and it is what a share is stated
  against (ADR 0244).
  Beside the tiers: `rate_buckets` and `turnaround_buckets`, the two fixed
  400-bucket lifetime histograms the tiles state a median from; `turnaround_causes`,
  keyed `provider/model`, bounded at 64 keys with an `other` row that keeps the
  rows summing (ADR 0240, ADR 0243); and `mode_causes`, the same runs keyed by
  `effective_mode`. The two cause maps are **two one-dimensional cuts of one
  total and never a cross-tab.**
  **Each cut also owns one stage of that total** (ADR 0247): a
  `turnaround_causes` row carries `heard_buckets`, the same 400-bucket axis for
  the hearing alone, and `mode_transform_causes` mirrors `mode_causes` with the
  rewriting alone. The runtime measures the split once per dictation --
  `heard_ms` is stamped the moment the provider returns, the rewriting is the
  remainder up to delivery -- and a stage bucket is written ONLY for a run that
  carried one. **An empty stage histogram means never measured, never nought.**
  A stage median is read from its own histogram; `median(total) -
  median(rewrite)` is not the hearing and no surface may compute it.
  `measured_from` maps a field to the first day it was written, so no series
  draws a zero for a period that predates its field; merging takes the EARLIER
  stamp.
  **The schema stamp converts nothing** (ADR 0244). There is no installed base,
  so a `schema < N` branch would be maintained for this repository alone -- and
  the two that stood here put an arithmetic on a screen that did not add up. A
  ledger this build creates states this build's stamp; the first release is
  where that stamp starts owing users a path.
  Each term is seeded once, idempotently, from whatever the index still holds,
  and two ledgers merge by field-wise maximum (ADR 0179) -- so a seeded term can
  start slightly short of the all-time truth and never double-counts. The file
  is written minified, through a temporary and a rename, on every dictation.
- **CaptureBudget** (`capture_budget.rs`): the resolved recording limits. A
  failure that could survive a second attempt keeps its capture in the temp
  directory until the retry or the seven-day / twenty-file sweep; every other
  path deletes it.
- **NativeInsertionPlatformStatus** (`insertion.rs`): support contract --
  label, support tier, insert strategy, free-text, prerequisites, honest
  limits, Linux driver chain (wl-copy/xdotool/wtype/ydotool/enigo/scratchpad).

## User Flows

### Dictation (primary)

1. Hotkey recognized in native trigger.
2. `capture.rs` starts recording, emits level/waveform events.
3. Recording ends via stop hotkey, silence timeout, max duration or abort.
4. Audio normalized to 16 kHz mono WAV for the provider.
5. `mode_router.rs` resolves effective `ProcessingMode` from the active
   `TextProfile.work_mode`; unresolved profiles use the legacy global
   `AppConfig.processing_mode`. The config is loaded after the recording ends,
   so a mode changed mid-recording is already on disk here. An effective `auto`
   value is resolved to a concrete mode per transcription.
6. `providers/mod.rs` resolves the registry entry the active provider names and
   calls its speech role -- `groq` or `local` today. The request comes
   from `NativeCaptureConfig::resolve_transcription_request`, the single place a
   provider request is derived from a capture (ADR 0015).
6b. `confidence_gate.rs` drops low-confidence segments (cloud lane only).
7. `hallucination_detect.rs` collapses repetition and filters artifact patterns,
   then `transform.rs` filters and cleans (exact-string hallucination guard, then
   AI cleanup via the correction guardrail stack unless the mode's preset
   disables it). `agent` and `prompt_enhance` run their own transform instead of
   the correction step, each with its own guardrail chain.

   Four of the correction guardrails discard the whole reply and return the
   original; the fifth, `spelled_letter_merge_reverted`, repairs one token
   instead. Where the original holds a run of at least three isolated single
   letters, the correction may not fuse them into a token the original does not
   contain -- that turns visible damage into invisible damage, since `c a u d e
   code` is repaired on sight and `CAUDE-Code` has the shape of a real product
   name. Repair rather than discard because exactly one token is wrong, and the
   shape is rare enough that discarding a long dictation costs more than the
   defect. It is deterministic, needs no configured profile, and is gated on a
   measurement rather than on a prompt rule the model demonstrably ignores. See
   ADR 0036.
7b. `transform::finalize_with_text_rules` applies the profile's dictionary and
   snippets. This is the pipeline's final stage and is **mode-independent within
   the insertion path**: it sits at the single exit after the mode branch, so no
   mode can bypass it. The mode decides how the text is produced, the profile's
   vocabulary decides how the user's own terms are spelled (ADR 0020). It does
   not run on output that is not inserted: text rules exist for text that lands
   in a document, and the planned voice bridge returns its transcript to a
   caller, where a replacement rule would make the answer diverge from what the
   user said (ADR 0030). Getting proper nouns spelled right there is the
   recognizer's job (ADR 0017), not finalization's.
8. `insertion.rs` chooses and runs the insert mode; successful direct insert
   best-effort restores the previous clipboard.
9. `history.rs` writes raw vs transformed transcript, active profile,
   effective mode, insert outcome and errors.
10. `sessions.rs` finalizes exactly once (`completed`/`aborted`/`error`),
    accepting async results only for the active `processing` session id.
11. UI receives status, last transcript, effective mode, history, recovery. The
    session end is announced twice — the `wordscript-native-event` mirror first,
    the authoritative `wordscript-event` `transcription` second. Only the
    authoritative one ends the session in the UI reducer; the mirror carries the
    transcript text and nothing else, so `status` and the surface that reports
    it flip in one commit (ADR 0018). A bounded fallback ends the session if the
    authoritative event never arrives — with its surface, and without letting a
    late authoritative event re-decide it (ADR 0019).

### Clipboard-only commit

Same as dictation through step 7, but `insert_behavior == "clipboard_only"`
emits the `preview_ready` payload on `wordscript-event` and stays in
`processing` on a real preview. The user commits, edits or aborts there. Commit
and edit-confirm both go through `commit_pending_transcription_preview`, which
runs the same native insert/history/session path (no frontend-only commit
layer); the edit passes the corrected text as its optional `text` argument, so
session completion, history and the insert result all describe the text that was
actually delivered. The overlay closes after the commit -- this mode has no
result surface (ADR 0011a).

**The window is not the only thing that can end this session.** Staging the
preview arms a runtime deadline of `PREVIEW_COMMIT_DEADLINE_MS` (10 s,
`core/sessions.rs`, not configurable). If nothing has committed, aborted or
asked for more time by then, the runtime commits (ADR 0134) -- everything a user
can later reach
(clipboard, `history.json` row, Markdown transcript) is created inside that
insert, so a window that never comes back would otherwise discard a finished
dictation with nothing reporting it. Both paths run one body,
`commit_pending_preview`, so ADR 0018's one-commit rule holds across them:
whichever arrives second finds the staged preview taken and does nothing. The
deadline names itself in the runtime log
(`Native session completed path=frontend|deadline`), and it may commit only the
staging it was armed for -- an abort frees the session for a new capture, whose
preview a stale deadline must not touch. A committed preview closes the edit
surface with it: the surface reads `isProcessing && pendingResult`, both of
which the commit clears.

**An open edit surface keeps the runtime waiting** (ADR 0152). While the overlay
is editing a staged preview it calls
`defer_pending_transcription_preview_commit` every 3 s, and each call grants a
fresh `PREVIEW_COMMIT_DEADLINE_MS` from that instant. There is no release: a
window that stops asking -- because the surface closed, or because the webview
died -- is finished for on the ordinary deadline, which is the case ADR 0134
exists for and is deliberately not weakened. The request carries the preview
epoch, so one in flight across a session change cannot extend the next
dictation's deadline. A preview nobody is editing keeps its ten seconds: not
answering is a decision the runtime is allowed to make for the user, and the
transcript reaches the clipboard, `history.json` and disk either way.

**A window that mounts mid-session asks what is running** (ADR 0151).
`native_session_snapshot` answers the stage, the session id, when it started,
mute, pause, and the staged preview if one is still waiting; the UI reducer
repaints `capturing` and `processing` from it and **nothing else**. A session
that has already ended is not re-reported -- the path that ended it owed the
surface that reported it (ADR 0019) -- so a preview the deadline committed comes
back as no surface at all, which is what a committed `clipboard_only` preview
looks like anyway. The restore applies only to a state no event has touched, so
an event that arrives while the snapshot is in flight always wins.

## Known Deviations / Open Questions

- Transcription reliability: the mechanical cause is fixed but the result is not
  yet re-measured. Until 2026-07-29 no profile could affect a real recording at
  all -- bias policy and local decode settings were dropped between the capture
  event and the provider request (ADR 0015), so "curated profiles worsen raw
  transcripts" described a path that was never actually taken. Silence trimming,
  a segment-confidence gate, whisper.cpp decode flags and a repetition/artifact
  detection stage now sit before AI cleanup (ADR 0016). Re-assessing per-profile
  reliability against the corrected runtime is the open work; the profile UI
  rework is a separate, still-open slice.
- The language-drift check compares script families and therefore cannot
  separate two Latin-script languages. This is deliberate -- it is what makes
  German with English terms structurally untouchable -- but it also means drift
  between, say, German and French is only ever observed, never acted on.
- No published versioned releases; `check_app_update` honestly reports none.
  Internal draft handoffs are maintainer-internal, not a public channel.
- No signed in-place auto-updater.
- Linux Wayland is compositor-specific: KDE Plasma 6 / GNOME Mutter get
  auto-paste via a one-time RemoteDesktop portal grant; Hyprland/Sway/KDE
  Plasma 5 stay clipboard-only.
- Linux overlay click-through to apps beneath the overlay remains unsolved
  (requires Tauri layer-shell support or a compositor-specific protocol path).
- Full live-preview / controlled-commit overlay across all delivery modes is
  not built (only `clipboard_only` preview exists).
- No second production provider; `fast`/`quality`/`local`/`self_hosted` mode
  model is not yet a real multi-provider system. **Widened to the complete
  build-out on 2026-08-11** (ADR 0096, superseding ADR 0065): every drawn lane
  gets an adapter, speech and voice are built out alongside chat, and the
  capability survey behind it is `docs/PROVIDERS.md`. Until an adapter lands, a
  lane stays drawn and inert and says so.
- **No speech synthesis anywhere in the runtime**, and no output-device
  enumeration — `list_native_input_devices` has no counterpart, and
  `core::sound` runs at most one cue stream, opened on demand and closed after
  60 s idle (ADR 0010, ADR 0150). It **asks for the OS default and does not
  choose**, so which device a cue reaches is whatever the OS has remembered for
  this application; that is a known open defect, not a contract. ADR 0097 adds a
  second, named stream for speech on a selectable device, leaves every cue rule
  intact, and is the step that gains the enumeration.
- **No streaming recognition.** One speech entry point, `transcribe_audio_file`;
  `capture.rs` records to a file, stops and uploads. See the streaming contract
  above for the planned shape, and `docs/PROVIDERS.md` for which lanes could
  serve it — Groq, the lane the product runs on, cannot.
- **The runtime declares three windows statically** (`overlay`, `settings`,
  `rebuild-lab`) and contains no `WebviewWindowBuilder`. Four drawn windows —
  the translation pop-out, the meeting HUD, the agent window and ADR 0043's
  notification — wait on a second window class whose geometry belongs to the
  user (ADR 0100). This does not reopen the overlay's fixed per-surface
  geometry, and no generic resize command returns (ADR 0089).
- **The model axis travels unread, and the provider axis no longer does.**
  Closed for `ProviderCapabilities` on 2026-08-12 by stage B1 (ADR 0106,
  ADR 0124): `AI Models` reads it, `Models.test.tsx` can no longer mock
  capabilities as `{}` and pass, and the `PROVIDERS` table in
  `src/screens/data.ts` is the drawing rather than the answer — its `stt`/`llm`
  booleans stay the subject of three open disagreements in
  `docs/PROVIDERS.md`, and this record did not correct them. **`ModelCapabilities`
  is still consumed by no surface**: *will this row stream* is a model question
  and no drawn row asks it yet, which is the half a seam covering only the
  provider axis leaves open (ADR 0110). It arrives with the lane that streams
  (D2), and until then the mirror carries it without a reader.
- **Nothing announces that a setting changed.** `AppConfig::save_to_disk` writes
  and `save_config` returns to its caller; there is no config-changed channel
  among `wordscript-event`, `wordscript-native-event`, `wordscript-mode-event`,
  `wordscript-audio` and the rest. It has never been needed with one settings
  window. ADR 0100's window class plus ADR 0097's machine-wide routing make it
  necessary, and ADR 0108 records the shape: the config is the only holder, a
  write is announced, and the event carries no secret because it takes the same
  `without_secrets()` scrubbing every disk write does.
- No guided setup/packaging path from install to first useful dictation.
- Chat, Upload and Account are gone from the product's information
  architecture; the pre-port shell's previews of them were deleted with the
  fourteen flat areas in Leg 3 (ADR 0054) and were not re-drawn. Notes survives
  as the `Notes & Meetings` section, drawn and not wired.
- **The port is wired, and this entry says which parts.** ADR 0055's terms: a
  screen is *ported* when it stands in `/gallery` and *shipped* when it is
  wired. The workspace mounts fourteen surfaces:

  - **wired** (eight, carrying no banner, and retired from the gallery as they
    were wired): History, Profiles, General, Hotkeys, Delivery & Insert,
    Privacy & Data, Diagnostics, About & Updates.
  - **wired in part** (two, each stating its own gap on itself): Home — the
    decision inbox receives a fallen-back delivery and nothing else, the desk
    (Phase 8) and a meeting's open questions (V2) have no receiver; AI Models —
    the cloud connections and `Your server` are real, the other two lanes and
    every job override are inoperable, each stating its own reason (ADR 0065,
    ADR 0067, ADR 0163, ADR 0164, ADR 0165).
    **Two lanes are withheld and it was three until 2026-08-16**: `Enterprise`
    has no adapter, and `local` is a runtime lane that installs its own models
    and is not offered until Phase 5 finishes it. `Your server` was the third —
    an adapter with nowhere to type its endpoint — and D1b gave it a URL, a
    model id and an optional token on the card that offers it (ADR 0165), which
    is ADR 0067 rule 1 running forwards rather than an exception to it.
  - **drawn, not wired** (four, each stating why): Context (V2 — the context
    object does not exist in the runtime), Notes & Meetings (V2), Agents
    (Phase 8, ADR 0030), Integrations (Phase 8).

  `npm run port:diff` is 25 measurements, 24 at structural 0 | style 0 with
  `models` the one recorded departure at 6 | 6 (ADR 0088).
- **The design still states facts this spec does not have**, and they remain
  unimplemented: a context object with an `origin` and five states, folders that
  are directories on disk, four speaker-confidence statuses, actions as files in
  `_actions/`, a second capture window, a spoken agent channel, and per-language
  audio routing. The last two now have records — ADR 0097 for the routing and
  the second output stream, ADR 0098 for the mute that lets a machine speak over
  an open microphone without transcribing itself — but a record is not an
  implementation and neither entry leaves this list yet. The full list is §2.5 of
  `docs/tracks/gui-port-relay.md`. **A drawn surface may not be read
  as implemented**; the six undecided surfaces (ADRs 0060-0064 plus the roadmap
  candidate) are mounted in no window at all.
- ~~**Text-rules import and export have a runtime and no caller.**~~ **CLOSED by
  Leg 10** (ADR 0090). `export_text_rules` is the fourth verb on the profile's
  row menu and `import_text_rules` is on Privacy & Data, where it lands as a new
  profile. The two halves are split across two screens because export acts on a
  thing and import creates one — a row menu can target the row it opened on and
  cannot target a profile that does not exist yet.
- Sync/accounts/cloud workspaces are planned (ADR 0005, local-first,
  WordScript-owned) but not built. Docs and UI must not present them as
  active product reality outside clearly labeled preview surfaces.
