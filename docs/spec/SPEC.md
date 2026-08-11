# Spec -- WordScript

Status: created 2026-07-24, last drift check 2026-08-11 (Leg 10, and it read
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
- `providers/local_preview.rs` -- local runtime lane (whisper-cli STT, Ollama cleanup, native model discovery, probe-based runner health)
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
- `native_insertion_status` (platform support contract)
- `check_app_update` (restricted to published GitHub releases)
- `transcript_store_status`, `reveal_transcript_in_file_manager` (the Markdown
  transcript store; the reveal refuses any path outside the store's root)
- `acknowledge_transcription_fallback` (Home's decision inbox, ADR 0076)
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
- `wordscript-native-insert` carries `NativeInsertResult`, including insertion
  and recovery truth.

Frontend reducer action names such as `NATIVE_TRANSCRIPTION_SYNC` are internal
UI implementation details, not Rust event names or Tauri channels.

### Provider contract

- `ProviderStatus`: typed modes (`fast`, `quality`, `local`, later
  `self_hosted`), capabilities (Transcription, Chat-Cleanup, Local,
  API-Key-Required, Prompt-Bias, Language, Segments), `local_setup` typed
  status for the local lane.
- `ProviderCommandError`: `kind`, HTTP status, `retryable`, `Retry-After`,
  `user_action`. UI must relay this, never invent its own error categories.
- `local` (on-device, current `local_preview` lane) and `self_hosted`
  (user-run remote/LAN, reserved, not active) are not interchangeable labels.
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
  and implemented by nobody. **ADR 0094's other half is not built** — the
  provider axis in the config is still one `provider` field per profile, not a
  resolved default plus a sparse override per job.
- **Capability axes split between provider and model** (ADR 0110). `speech_synthesis`
  is a provider-level role question and joins `transcription` and
  `chat_completion` on `ProviderCapabilities`; **`transcription_streaming`,
  `reports_detected_language` and `synthesis_streaming` are model-level**,
  because one OpenAI key serves `gpt-4o-transcribe` (streams) and `whisper-1`
  (does not), and the local lane repeats the split across Parakeet's online and
  offline models. A job asks its resolved `(provider, model)` pair, never its
  lane's name. Planned; not built.
- **The four fields ADR 0094 named land on those two axes** rather than all on
  the provider struct. The struct is mirrored into `src/types/providers.ts`
  and travels on `provider_status`. **It is not read by any surface**: no field
  of `status.capabilities` is consumed in `src/`, and `AI Models` draws its
  capability answers from the hand-maintained `PROVIDERS` table in
  `src/screens/data.ts`. The mirror is a precondition for a guard, not a guard;
  ADR 0106 makes building that seam a step before the first adapter, asserted by
  a test rather than by a sentence. Planned; not built.
- **`voice` is the ninth `JobKey`** (ADR 0109). The union carries eight and four
  records already write contracts against the ninth; the drawn `Speaking` job
  sits outside the lane axis and that is the shape the type follows. Where the
  translation voice sits on `AI Models` is an open owner question and is not
  decided by the type. Planned; not built.
- **A provider may carry more than one credential kind, and the kind is per
  role.** A credential is one opaque string today
  (`SaveProviderApiKeyRequest { provider, api_key }`); the registry must carry
  credential *shape* alongside role, because self-hosted needs a base URL plus a
  model id, the enterprise three each need something different, and OpenAI takes
  either an API key or an OAuth token set. ADR 0102 fixes the one case that is a
  policy question rather than a shape question: the **subscription** credential
  is admissible for the five chat jobs (`cleanup`, `rewrite`, `translate`,
  `enhance`, `assistant`) and inadmissible for `dictation`, `meetings`, `upload`
  and `voice`, because the backend it reaches serves no recognition and no
  synthesis. The restriction lives in the type, as ADR 0094's role rule does --
  it is not a runtime "unsupported" error. **No vendor other than OpenAI carries
  this kind.** Planned; not built.
- **The credential resolves from `(provider, role)`, and "follow the connection"
  follows the provider only** (ADR 0105). ADR 0094 states its credential rule
  for the *overriding* job; the following job is the case a per-role credential
  kind breaks, because a speech job on a subscription-paid connection would
  otherwise inherit a credential its role cannot use. A role with no credential
  makes the job **inert and named** -- never a silent fall back to the other
  kind the same provider holds, which is the role-shaped version of the host
  mistake ADR 0094's security rule prevents. The secret-store entry is keyed
  `(provider, role, kind)` so clearing one role's credential cannot clear
  another's. Planned; not built.
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
  `ProviderCapabilities` rather than the lane's name.
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
(`ProfileModesSettings.collect_workspace_context`, legacy key
`auto_detect_mode`), and reaches every mode: Auto routing as a category signal,
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
and style block, fixing the addressee to the person the instruction names and
returning the dictated content as plain text when the instruction cannot be
carried out. It holds at every register, `off` included. See ADR 0026.

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
  file once, never edits one, and deletes only paths a history entry named.**
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
  analysis rather than recomputed (ADR 0034). `schema_version` is 4; each
  migration guards on its own version, so bumping the constant cannot re-run an
  earlier step, and the version-4 step rewrites no entry -- the frontend mirror
  writes profiles back at a lower version, so an unconditional rewrite there
  would relabel learned rows as hand-typed. `stt_hints` and `use_as_prompt_hint`
  remain migration-only remnants read by nothing. `bias_mode` and `manual_bias`
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
  (`mode_router::apply_mode_transform`, ADR 0075).
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
   calls its speech role -- `groq` or `local_preview` today. The request comes
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
  `core::sound` runs one persistent output stream bound to the OS default by
  decision (ADR 0010). ADR 0097 adds a second, named stream for speech on a
  selectable device and leaves every cue rule intact.
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
- **No surface reads a runtime capability.** `provider_status` returns
  `ProviderCapabilities` and no field of it is consumed anywhere in `src/`;
  `Models.test.tsx` mocks it as `{}` and the suite passes. `AI Models` draws
  every capability answer from the hand-maintained `PROVIDERS` table in
  `src/screens/data.ts`, whose `stt`/`llm` booleans are a drawing and are the
  subject of three open disagreements in `docs/PROVIDERS.md`. The seam that
  makes a drawn row inert when the runtime denies its role is ADR 0106 and is a
  step before the first adapter, asserted by a test.
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
    the Groq connection is real, the other three lanes and every job override
    are drawn and inert (ADR 0065, ADR 0067).
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
  `docs/handoffs/HANDOFF_gui-port-relay.md`. **A drawn surface may not be read
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
