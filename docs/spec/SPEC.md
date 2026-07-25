# Spec -- WordScript

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
  states share one fixed-size pill. `clipboard_only` profiles stop on a real
  processing preview before commit. Idle is parked offscreen natively.
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
- `trigger.rs` -- global start/stop, pause/resume, abort hotkeys
- `capture.rs` -- audio capture, level/waveform events, silence/max-duration autostop, single stream rebuild after transient error
- `sessions.rs` -- runtime status and shared session transitions
- `sound.rs` -- start/stop/abort/startup/error cues
- `providers/mod.rs` -- shared provider contract, dispatch, typed modes/capabilities/errors
- `providers/groq.rs` -- cloud-first production lane (BYOK, secret store, Groq HTTP errors)
- `providers/local_preview.rs` -- local runtime lane (whisper-cli STT, Ollama cleanup, native model discovery, probe-based runner health)
- `transform.rs` -- hallucination filter, optional AI cleanup (correction guardrail stack), dictionary, snippets
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
- `commit_pending_transcription_preview` (clipboard_only commit)
- `native_insertion_status` (platform support contract)
- `check_app_update` (restricted to published GitHub releases)

### Events (Rust -> UI)

Tauri event channels and their payload discriminators are separate contracts:

- `wordscript-event` carries the typed `BackendEvent` union. Its
  `preview_ready` payload is emitted only for
  `insert_behavior == "clipboard_only"`; `transcription` is the authoritative
  completed result and owns `lastResult`.
- `wordscript-native-event` carries native session-status snapshots with
  payload event names such as `recording_started`, `recording_stopped`,
  `processing`, `transcription`, `transcription_corrected`, `empty`, `aborted`
  and `error`. The transcription variants synchronize status and
  `lastTranscription`; they do not replace the authoritative
  `wordscript-event` result.
- `wordscript-mode-event` carries `ProcessingModeEvent` (`mode`,
  `is_override`, `auto_detected`) after the native hotkey path persists a mode
  change, prompting listeners to re-fetch or update the effective mode. Other
  settings and overlay writes synchronize through the `wordscript-event`
  `ready` payload, the command result and local eager state.
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
`rewrite` / `agent` / `prompt_enhance` / `verbatim`.

Effective mode resolution (per session) via `mode_router::resolve_processing_mode`:
1. manual override (mode picker / cycle / per-mode hotkey)
2. active `TextProfile.work_mode.processing_mode`
3. legacy global `AppConfig.processing_mode` only when the active profile
   cannot be resolved; its default is `auto`

When effective mode is `auto`, `resolve_auto_mode` picks per transcription:
agent-name + imperative -> `agent`; imperative + IDE context -> `prompt_enhance`;
else -> `cleanup`.

## Data Model

No Tenant/User/Profile (multi-tenant) split. WordScript is local-first with
no account. Entities:

- **AppConfig** (`config.rs`): persisted app config. Holds global settings,
  the text-profile collection, active mirrors for profile-bound settings,
  provider selection, seven mode shortcuts (picker plus six direct modes),
  overlay placement, `profile_health_acknowledged_flags` map.
- **TextProfile** (local text profile): `prompt`, optional `stt_hints`,
  `dictionary`, `snippets`, `TextProfileWorkMode` (`processing_mode`,
  `enhance_sub_mode`, `target`, `insert_behavior`, `bias_mode`,
  `manual_bias`) plus optional profile-bound `speech`, `modes` and `capture`
  settings. Profiles are local and manually activated; no automatic app-based
  activation, no team sync.
- **Session** (`sessions.rs`): runtime state machine
  `idle -> capturing -> processing -> completed | aborted | error`. `paused`
  is a capture sub-state within `capturing`. Async provider/transform/insert
  results are guarded to the active `processing` session id; stale results
  after abort or new capture are discarded and logged.
- **TranscriptionHistoryEntry** (`history.rs`): persisted entry with raw vs
  transformed transcript, active profile name, effective `ProcessingMode`,
  insert outcome, server-side filters. Retry re-processes from stored raw.
- **NativeInsertionPlatformStatus** (`insertion.rs`): support contract --
  label, support tier, insert strategy, free-text, prerequisites, honest
  limits, Linux driver chain (wl-copy/xdotool/wtype/ydotool/enigo/scratchpad).

## User Flows

### Dictation (primary)

1. Hotkey recognized in native trigger.
2. `capture.rs` starts recording, emits level/waveform events.
3. Recording ends via stop hotkey, silence timeout, max duration or abort.
4. Audio normalized to 16 kHz mono WAV for the provider.
5. `mode_router.rs` resolves effective `ProcessingMode` (manual override >
   active `TextProfile.work_mode`; unresolved profiles use the legacy global
   `AppConfig.processing_mode`). An effective `auto` value is resolved to a
   concrete mode per transcription.
6. `providers/mod.rs` dispatches to `groq` or `local_preview`.
7. `transform.rs` filters and cleans (hallucination guard, optional AI
   cleanup via correction guardrail stack, dictionary, snippets). For
   `prompt_enhance` mode the cleaned text additionally runs the
   `prompt_enhance` guardrail chain.
8. `insertion.rs` chooses and runs the insert mode; successful direct insert
   best-effort restores the previous clipboard.
9. `history.rs` writes raw vs transformed transcript, active profile,
   effective mode, insert outcome and errors.
10. `sessions.rs` finalizes exactly once (`completed`/`aborted`/`error`),
    accepting async results only for the active `processing` session id.
11. UI receives status, last transcript, effective mode, history, recovery.

### Clipboard-only commit

Same as dictation through step 7, but `insert_behavior == "clipboard_only"`
emits the `preview_ready` payload on `wordscript-event` and stays in
`processing` on a real preview. The user commits via
`commit_pending_transcription_preview`, which runs the same native
insert/history/session path (no frontend-only commit layer).

## Known Deviations / Open Questions

- Transcription reliability outside `General Writing` is still not launch-ready;
  some curated profiles introduce multilingual fragments, fantasy tokens or
  topic drift into raw transcripts. This is the primary launch blocker.
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
- Sync/accounts/cloud workspaces are planned (ADR 0005, local-first,
  WordScript-owned) but not built. Docs and UI must not present them as
  active product reality outside clearly labeled preview surfaces.
