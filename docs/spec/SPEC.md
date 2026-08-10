# Spec -- WordScript

Status: created 2026-07-24, last drift check 2026-08-04

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
  natively.
- `settings`: native-decorated shell. Grouped 232px sidebar (profile dock +
  areas), compact toolbar, one dominant content surface, immediate auto-save
  and a footer status bar.
- `rebuild-lab`: native-decorated diagnostics pop-out reusing the same
  Rebuild Lab panel.

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
- `providers/mod.rs` -- shared provider contract, dispatch, typed modes/capabilities/errors
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

- `start_native_session`, `stop_native_session`, `abort_native_session`
- `reveal_overlay_window`, `park_overlay_window`, `sync_overlay_window_visibility`
- `load_app_config`, `save_config` (config load/normalize/write paths are
  serialized by the config-file lock)
- `resolve_current_processing_mode` (effective mode source of truth)
- `switch_active_text_profile`, `set_active_profile_processing_mode`
- `acknowledge_profile_health_flag`, `unacknowledge_profile_health_flag`
- `commit_pending_transcription_preview` (clipboard_only commit; optional
  `text` replaces the preview text for an overlay edit before delivery)
- `native_insertion_status` (platform support contract)
- `check_app_update` (restricted to published GitHub releases)

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
`off`, at which every prompt is byte-identical to the pre-style build.

Every prompt WordScript sends is written in English regardless of dictation
language, and each states explicitly that the output language is the dictated
one.

## Data Model

No Tenant/User/Profile (multi-tenant) split. WordScript is local-first with
no account. Entities:

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
  transformed transcript, active profile name, effective `ProcessingMode`,
  insert outcome, server-side filters, and `audio_path` for a capture the
  runtime kept. Retry re-processes from the stored raw transcript, or
  re-transcribes from the kept capture when there is no transcript -- the
  timeout case, where the audio is the only surviving artifact (ADR 0039).
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
6. `providers/mod.rs` dispatches to `groq` or `local_preview`. The request comes
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
  model is not yet a real multi-provider system.
- No guided setup/packaging path from install to first useful dictation.
- Chat, Upload, Notes and Account are visible layout previews backed only by
  local component state. They have no runtime-backed chat, batch
  transcription, meeting-note, account or sync behavior.
- A 25-screen accepted design now stands in full at the design-time route
  `/gallery`, on the productive component library, and **none of it is wired**
  (ADR 0055: a screen is *ported* when it stands there and *shipped* when it is
  wired). It states facts this spec's Contracts and Data Model sections do not
  have -- a context object with an `origin` and five states, folders that are
  directories on disk, four speaker-confidence statuses, actions as files in
  `_actions/`, a second capture window, a spoken agent channel, and per-language
  audio routing. The full list is §2.5 of
  `docs/handoffs/HANDOFF_gui-port-relay.md`, split between what is wiring and
  what is a new runtime contract. **Nothing in that design may be read as
  implemented**, and the shipped surface above is unchanged by it.
- Sync/accounts/cloud workspaces are planned (ADR 0005, local-first,
  WordScript-owned) but not built. Docs and UI must not present them as
  active product reality outside clearly labeled preview surfaces.
