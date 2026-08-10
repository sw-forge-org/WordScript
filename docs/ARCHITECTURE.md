# WordScript -- Architecture

Status: 2026-07-25

> This file is the living architecture overview. Hard architecture decisions
> (e.g. Tauri/Rust as runtime owner, native window decorations, cloud-first
> BYOK) live as append-only ADRs in `docs/decisions/` -- see
> `docs/decisions/README.md`. A consolidated machine-facing spec lives in
> `docs/spec/SPEC.md`. An ARCHITECTURE.md used as the sole overview drifts
> from code; ADRs keep the individual decisions immutable, SPEC keeps the
> contracts, this file keeps the narrative.

## Purpose

This document describes the active system architecture of WordScript: where
behavior is really decided today and where new work must be located.

The old Python sidecar is no longer the reference path (ADR 0001).

## Guiding principles

- Rust is the runtime owner for trigger, capture, provider, transform, insert
  and recovery.
- React displays, configures and explains the same native state.
- WordScript is cloud-first in the current product path (ADR 0002).
- Typed contracts between UI and runtime are mandatory.
- Recovery and support limits are part of the architecture, not just
  accompanying text.

## Active layers

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

## UI layer

Three windows in the Tauri config:

- `overlay`: transparent compact stage with a pill for recording/processing
  state. Each delivery mode has exactly one decision surface (ADR 0011a):
  `clipboard_only` work modes hold a real processing preview
  (`copy`/`edit`/`abort`) before commit and close afterwards; `auto_paste`
  delivers first and then shows the result surface
  (`copy`/`edit`/`insert`/`dismiss`) within the same area. Which surface is
  shown follows from `RuntimeState.resultSurfaceOpen`, set in the same reducer
  commit that ends the session. Idle is parked offscreen natively; placement
  comes from a remembered manual position or a preset display anchor.
- `settings`: native-decorated shell with grouped Workspace, Engine, System
  the workspace: four views (Home, History, Profiles, Context) in a `.ws-nav`
  sidebar, the active-profile row at its foot, a status strip along the bottom
  edge, and **settings as a modal sheet laid over it at its own scale**
  (`Cmd+,`, Escape to close). Restructured 2026-08-05 by Leg 3 of the port
  relay; the fourteen flat areas it replaced were deleted in the same commit
  (ADR 0054). Every view and section is the ported drawing and says so on
  itself — the shell reads the runtime, the content does not, until Leg 4.
- `rebuild-lab`: native-decorated diagnostics pop-out mounting the **same**
  Diagnostics section the sheet does, rather than a second implementation of it.

Key frontend building blocks:

- `src/windows/OverlayWindow.tsx`
- `src/windows/WorkspaceWindow.tsx` and `src/windows/workspace/`
- `src/windows/RebuildLabWindow.tsx`
- `src/screens/` — the 25 ported screens, mounted by the product and displayed
  by the gallery. One implementation, two sets of props (ADR 0055)
- `src/components/shell/` and `src/styles/shell.css` — the productive library
- `src/hooks/useRuntime.ts`
- `src/hooks/useProvider.ts`
- `src/hooks/useNativeInsertion.ts`
- `src/hooks/useRuntimeLogs.ts`

The UI is responsible for: displaying runtime status, waveform and errors;
the guarded in-pill action state after a run; config maintenance; the global
manual profile switch in the sidebar plus included profiles, preview,
validation and import/export in Text Rules; tab-specific orientation via the
compact header; the About release build-up explanation (strictly separating
public release visibility from workflow-internal draft handoffs); Text Rules
as a workspace with a short process summary, compact profile library and
pinned stage navigation; visible recovery actions and diagnostics; separate
rendering of transient runtime logs and durable native transcript history
with filters, export and the visible history store path.

The UI is **not** responsible for: global shortcut registration, microphone
capture, session state machine, insert decisions.

## Tauri host

`src-tauri/src/lib.rs` is the product shell. It holds: window setup for
overlay and settings; native visibility and positioning for the overlay
(bottom-center reveal, offscreen parking in idle via `window.hide()` in
`park_overlay_window`); monitor- and anchor-based overlay placement plus
persistence of the last manual drag position (host repositions for
reveal/hide/surface changes must not overwrite the remembered position as
new user intent); Linux overlay specifics (fixed sizes 480x60 flat /
460x164 edit, `set_background_color` on every reveal, XWayland default with
native-Wayland opt-in); KDE Plasma 6 always-on-top via KWin script
(`packaging/kwin-wordscript-overlay/`); tray menu and window opening;
command registration; event emission for `wordscript-event` and
`wordscript-native-event`; coarse orchestration between trigger effect,
capture end, provider call and runtime feedback.

The host is the bridge, not the business logic.

## Rust core modules

The active product core lives in `src-tauri/src/core/`.

### Config and status

- `config.rs`: config lifecycle, disk I/O, scrubbing of sensitive values,
  local text-profile model. Config writes are lock-serialized
  (`CONFIG_FILE_LOCK`) so overlapping commands cannot clobber each other.
- `runtime_log.rs`: buffered structured runtime logs for the diagnostics UI,
  plus a persistent ring-rotated file (`~/.config/WordScript/logs/wordscript-runtime.log`).
- `history.rs`: persistent native history with raw vs transformed
  transcript, insert outcome, server-side filters, export, retention policy,
  retry.
- `paths.rs`: product paths (config, scratchpad, logs).

### Capture and session

- `trigger.rs`: global start/stop, pause/resume and abort hotkeys.
- `capture.rs`: audio capture, level/waveform events, silence/max-duration
  autostop, single stream rebuild after a transient cpal stream error
  (matching-gate on sample rate/channels/format; one attempt per session).
- `capture_budget.rs`: what a recording may cost. Resolves the processing limit
  (the longest capture the current provider, account plan and model can process
  at all), the auto-stop in force, the safety margin between them, the
  transcription wait and the pipeline watchdog deadline. Providers declare their
  own limits through `providers::capture_limits`, so this module knows the two
  *shapes* a limit can take -- request size and decode time -- and no individual
  lane. Everything else reads from here; nothing recomputes it (ADR 0038).
- `sessions.rs`: runtime status and shared session transitions for trigger,
  commands and native pipeline completion.
- `capture.rs`: also measures the input level across every capture
  (`InputLevelSummary`, `InputLevelVerdict`) so a discarded capture can name
  its own cause. Read-only -- the OS input volume is per device, not per app,
  and is never written (see PLATFORMS.md).
- `capture.rs`: and measures whether the capture kept the audio its own clock
  says it ran for (`CaptureIntegrity`, ADR 0079). Untrimmed samples against the
  effective wall clock -- paused stretches subtracted, a stream rebuild
  deliberately not -- with a `short` verdict past 10 % missing and no verdict at
  all under two seconds. It travels on `AudioReadyEvent` to the history record
  and to the overlay's result surface. It reports the defect in
  `known-issues/capture-loses-half-the-recording.md`; it does not fix it.
- `sound/`: startup signature plus listen/handoff/done/abort/error cues.
  `cue.rs` owns the score, `pack.rs` the timbre, `synth.rs` renders at the
  device sample rate, `engine.rs` owns the one persistent output stream
  (see ADR 0010).

### Provider and text processing

- `providers/mod.rs`: shared provider contract, dispatch and typed
  command surface (modes, capabilities, errors).
- `providers/groq.rs`: cloud-first production implementation (BYOK, secret
  store, Groq-specific HTTP errors).
- `providers/local_preview.rs`: local runtime lane with `whisper-cli` for
  STT, local Ollama cleanup, native model discovery, probe-based runner
  health, selected-model/cleanup setup truth over the same response
  contract.
- `confidence_gate.rs`: drops transcription segments Whisper's own metrics mark
  as invented (`no_speech_prob` combined with `avg_logprob`, or
  `compression_ratio` alone). Cloud lane only; `whisper-cli` returns no
  segments. Thresholds are constants, not settings (ADR 0016).
- `hallucination_detect.rs`: post-transcription detection stage. Collapses
  character, word and phrase repetition, filters broadcaster subtitle
  boilerplate by pattern, and observes language switches. A language mismatch is
  never on its own a reason to discard text -- the unit of analysis is a whole
  sentence, so inline code-switching is structurally out of reach, and a strip
  requires independent corroboration from the confidence gate, the artifact
  filter or a repetition collapse (ADR 0016).
- `recognizer_repair.rs`: deterministic repairs to what the recogniser returned,
  run **before the mode branch** so Agent, Translate and Prompt Enhance receive
  them too (ADR 0081). Removes an echo of the initial prompt this request sent
  (ADR 0080) and restores a pluralized German form of address. The raw
  transcript is cloned before the stage, so the record keeps what the recogniser
  produced and the defects stay measurable. The echo strip is language-agnostic
  by construction; the address repair is German morphology and runs only over
  text whose language is established as German.
- `transform.rs`: runs `hallucination_detect` ahead of the exact-string
  hallucination filter, then optional AI cleanup (correction guardrail stack),
  dictionary and snippet resolution.
- `agent.rs`: hybrid intent detection (heuristic + LLM classifier) and agent
  execution; sits as a routing layer before `transform.rs`.
- `text_rules.rs`: analysis, preview, import/export, conflict handling and
  profile health analysis of Text Rules.

### Mode routing and workspace

- `mode_router.rs`: resolves the effective `ProcessingMode` per session from
  the active profile work-mode, its only source; when the effective mode is
  `auto`, `resolve_auto_mode` picks a concrete mode per transcription
  (agent/prompt_enhance/cleanup) from transcript text, agent name and
  optional workspace context; exposes the `resolve_current_processing_mode`
  Tauri command.
- `workspace_context.rs`: foreground-app detection on macOS, Windows and
  Linux; uses `run_with_timeout` with dedicated pipe-drain threads (otherwise
  `Output.stdout`/`stderr` come back empty). IDE-framework and
  browser-domain detection are currently macOS-only; cross-platform paths
  stay behind `#[allow(dead_code)]` until the next slice turns them on.
- `prompt_enhance.rs`: prompt structuring/expansion over the active LLM lane,
  guardrail chain (empty, prompt_executes, language_mismatch, length_budget,
  semantic_drift) and routing of the cleaned result into `transform.rs`.

### Insertion and recovery

- `insertion.rs`: paste strategies, clipboard restore, scratchpad and
  platform status.

`NativeInsertionPlatformStatus` is the support contract of this path. It
carries label, support tier, insert strategy, free text, concrete
prerequisites and honest limits for the UI. For Linux it also carries an
explicit driver chain for clipboard and paste helpers including the active
lane and missing helpers.

## Session flow

1. Hotkey recognized in the native trigger.
2. `capture.rs` starts recording and emits level/waveform events.
3. Recording ends via stop hotkey, silence timeout, max duration or abort.
4. Audio is prepared as 16 kHz mono WAV for the provider. Leading and trailing
   silence is trimmed off first; a capture with less than `MIN_SPEECH_MS` of
   remaining audio never reaches a provider and ends as
   `InputLevelVerdict::TooShort` with an explicit overlay message (ADR 0016).
4b. `NativeCaptureConfig::resolve_transcription_request` derives the provider
   request. It is the single source: the capture config crosses the event
   boundary flattened and typed, so bias policy and local decode settings cannot
   be lost on the way (ADR 0015).
5. `mode_router.rs` resolves the effective `ProcessingMode` before transform
   from the active profile work-mode, with the legacy global
   `AppConfig.processing_mode` used only if the active profile cannot be
   resolved. There is no override layer: every writer persists the profile, and
   the pipeline config is loaded after the recording ends (ADR 0024). An
   effective `auto` value becomes a concrete mode per
   transcription via `resolve_auto_mode`. The renderer can query the effective
   mode via `resolve_current_processing_mode`.
6. `providers/mod.rs` resolves the active provider and dispatches today to
   `providers/groq.rs` or `providers/local_preview.rs`.
6b. `confidence_gate.rs` drops segments the provider's own metrics mark as
   invented, before any downstream stage sees the text (cloud lane only).
6c. `recognizer_repair.rs` strips an echo of the prompt this request sent and
   restores a pluralized German address, **before the mode branch** so every
   mode receives the repaired text. The unrepaired text is kept for the record.
7. `hallucination_detect.rs` collapses repetition and filters artifact patterns,
   then `transform.rs` checks and cleans the transcription output using the same
   provider contract for AI cleanup; for `prompt_enhance` mode the cleaned
   text additionally runs the `prompt_enhance` guardrail chain.

For diagnostics, persisted config alone is no longer a sufficient source of
truth: `v1_slice_status` must combine the persisted provider/profile contract
with real runtime sources -- `provider_status` for local setup readiness and
resolved runner/model paths, `native_capture_status` for running capture
state and active device.

8. `insertion.rs` chooses and runs the insert mode.
9. `history.rs` writes raw vs transformed transcript, active text profile,
   effective `ProcessingMode`, insert outcome, errors, and what the capture
   measured about itself -- `capture_integrity` (ADR 0079) and `input_level`
   (ADR 0083). Both are `None` on a retry, which makes no capture of its own.
10. `sessions.rs` finalizes exactly once (`completed`/`aborted`/`error`) and
    accepts async pipeline results only for the active `processing`
    session id.
11. UI receives status, last transcript, effective mode, history and any
    recovery data.

## Session state machine

```text
idle -> capturing -> processing -> completed
    |         |             |
    |         v             v
    |      aborted        error
    +-------------------------------
```

`paused` is not its own stage name but a capture sub-state within
`capturing`.

Provider, transform and insert results continue asynchronously after
capture end, but may only change runtime state while their session id still
matches the active `processing` session. Late results after abort, a new
capture or an already-finalized session are marked stale in the runtime log
and no longer reach overlay or settings.

The completion is announced on two channels: `wordscript-native-event` mirrors
the session stage, `wordscript-event` carries the authoritative result. They are
two IPC messages, so they land in two UI commits. Only the authoritative one
ends the session in the reducer — `status`, `pendingResult`, `previewStaged` and
`resultSurfaceOpen` change there and only there, together with the surface that
reports the result. The mirror updates the transcript text and nothing else, so
no render passes in which the session is over and no overlay surface owns the
pill (ADR 0018). A bounded fallback ends the session if the authoritative event
never arrives, so a dropped emit cannot leave the UI showing `processing`; it
commits the surface with it and builds its result from the mirrored transcript,
because every path that ends a session owes the surface that reports it, and a
session that has already ended never has its surface re-decided (ADR 0019).

## Transform order

Text processing is intentionally not a black box. The order is fixed:

1. Reject or flag hallucination patterns.
2. If the effective mode is Agent: call `apply_agent_transform` and skip
   correction. The mode was already decided; nothing here re-decides it.
   Prompt Enhance likewise runs its own transform instead of the correction step.
3. AI cleanup, unless the mode's preset disables it (Verbatim).
4. Apply dictionary.
5. Apply snippets.

Steps 4 and 5 are `transform::finalize_with_text_rules` and are **mode-independent**:
they sit at the single pipeline exit, after the mode branch, so every mode passes
through them. The mode decides how the text is produced; the profile's vocabulary
decides how the user's own terms are spelled. This is why the stage lives outside
`apply_native_transform` — Agent and Prompt Enhance never call that function, and
while the call sat inside it they skipped the user's dictionary and snippets
entirely (ADR 0020).

### Intent detection

Intent detection is part of resolving `Auto`, not a layer in front of correction.
It runs once, while Auto picks one concrete mode, and its result *is* the mode.
A concrete mode — Agent included — never passes through it, so a user who selects
Agent by hotkey gets the agent (ADR 0020).

```text
heuristic score >= 0.75  ->  Auto commits to Agent, no LLM call needed
heuristic score < 0.20   ->  Auto continues with its remaining rules
score 0.20 - 0.74        ->  uncertain zone -> one LLM classifier call decides
                             between Agent and Cleanup
```

Heuristic signals (O(n), no API call): agent name in words 1-4 (+0.55),
words 5-10 (+0.35), later (+0.15); imperative verb as first word (+0.45),
words 2-10 (+0.25); text length > 60 words (-0.15). The agent name comes from the
active profile, falling back to the global one. Because it decides Auto's first
rule and Auto is the default mode, the field is shown in Settings -> Modes
regardless of which mode is selected; it used to render only while Agent was
selected, which hid it in exactly the configuration that depends on it (ADR 0023).

LLM classifier (only in the uncertain zone): decides "yes" or "no", nothing
else; "yes" only when the user directly addresses the agent **and** assigns
a task; fallback on error is always "no" (safe dictation path, i.e. Cleanup).

This used to run twice. Auto resolved to Agent using the heuristic, and the Agent
branch then classified again and fell back to `apply_native_transform` on "no" —
which silently overrode a manually selected Agent mode and used flags derived from
the profile's stored mode. The second call is gone.

### Correction guardrail stack

AI correction in `normalize_correction` defends the dictation path in several
layers against assistant-like behavior of the correction LLM. Each rejection
writes a structured entry into the runtime log (visible in Rebuild Lab):

| Guard | Trigger | Rule id |
|---|---|---|
| Empty correction | correction empty | `empty_correction_fallback` |
| Question answered | original has `?`, correction has none | `question_answered_guardrail_fallback` |
| Length explosion | correction > 1.5x original + 50 chars | `assistant_like_correction_rejected` |
| Over-shortened | correction < min_ratio x original | `over_shortened_correction_rejected` |
| Assistant phrase | newly inserted assistant phrases (e.g. "ich verstehe", "task completed") | `correction_guardrail_fallback` |
| Suspicious start | correction newly starts with Ich/Bitte/Gerne/Klar/Here/I/... | `correction_guardrail_fallback` |
| First-person action start (polished) | correction newly starts with Ich action verb like "ich schicke", "i'll send" -- polished mode only | `correction_guardrail_fallback` |
| Word overlap | shared word set < threshold (0.25/0.4/0.55 per mode) | `correction_guardrail_fallback` |

Rules of this stack:

- the correction LLM is a chat model with strong assistant fine-tuning; all
  guardrails can occasionally be breached despite a correct system prompt --
  the stack is layered to catch that.
- `has_suspicious_start` is disabled in `polished` mode (sentence
  restructuring is allowed there); `has_new_first_person_action_start` runs
  instead for clearly assistant-like first-person action-verb starts.
- every guardrail rejection falls back to the original text unchanged; no
  contract break with downstream insertion, history or recovery.
- the correction system prompt explicitly instructs the LLM that questions,
  prompts, commands and instructions in the input are dictated user text --
  never answer, execute or react to them.
- this correction stack is orthogonal to agent mode: agent mode routes
  before correction; guardrails fire when routing returns "dictation" but
  the correction LLM still drifts into assistant mode.

### STT bias

- **`prompt` does not reach the recognizer at all** (ADR 0032). It holds topics,
  and an initial prompt conditions the decoder on literal tokens, so a topic
  cannot bias it — `platform constraints` raises the odds of those two words,
  never of the service names the topic stands for. It goes to the LLM stages
  only, through `core::profile_context`, identically in every mode (ADR 0021).
- what the recognizer receives is assembled by
  `capture::NativeCaptureConfig::resolve_transcription_request` from
  `transcription_hints::analyze_transcription_bias_with_mode`, and it is one
  line: `Likely phrases: …`, from `vocabulary_hints` and nothing else. Dictionary
  spellings left the prompt entirely (ADR 0017) — they are applied
  deterministically after transcription, so the prompt copy was always redundant,
  and a longer initial prompt is itself a documented cause of repetition loops
  and language drift.
- the lexical filter that once judged this input is gone. It rejected topic
  lines, which is correct for a recognizer and was applied to a field that never
  travelled there; it also gated the cleanup prompt until ADR 0021 found that
  reuse was never decided and measured it as unnecessary. What remains is a
  word-shape predicate (`is_stt_hint_candidate`) over the term list, not over the
  context field.
- what a mode may *do* with that context is not identical. Cleanup and Rewrite
  use it to stay near their input; Agent may only use it to read the instruction
  — spellings, proper nouns, domain — and is explicitly forbidden from deriving
  content from it. The Agent block therefore lives in the system prompt, the user
  turn carries the transcript alone, and snippets contribute trigger without
  expansion (ADR 0023).
- the per-profile communication style (`core::communication_style`) is read by
  Agent and Rewrite only. Its register sets form, never wording: slang and youth
  language come from the user's rules and writing sample, never from the model.
  Default `off` leaves every prompt byte-identical.
- which vocabulary terms reach the initial prompt is decided by
  `config::select_recognizer_slots`, not by a per-entry switch (ADR 0035). Terms
  below `vocabulary_repair::min_repairable_chars()` lead, then the most often
  mangled, filtered by the recognizer's own form rules and capped at
  `MAX_TRANSCRIPTION_STT_HINTS`. `use_as_prompt_hint` survives as a migration
  remnant read by nothing. The selection is an addition to the vocabulary, never
  a filter on it: every term still reaches repair and every LLM stage.
- `core::vocabulary_learning` is the only writer of learned terms. It sits after
  the insert in both delivery paths, diffs the raw transcript against the
  delivered text, and promotes a candidate into the profile on its second
  sighting. It owns `vocabulary-candidates.json` and reuses
  `vocabulary_repair`'s normalizer, tokenizer and distance so a term it proposes
  is one that layer can act on.
- `TextProfileWorkMode.bias_mode` and `manual_bias` are still consulted by
  `BiasRequestContext::from_work_mode` on the capture path, but no reachable
  configuration sets anything other than the `Conservative` default: ADR 0017
  removed the bias-policy panel and nothing replaced it. Treat them as a
  migration remnant with a live read, not as a control — a surface that offers
  them again would be reintroducing the knob ADR 0017 retired.
- `text_rules::analyze_document_with_context` builds the same preview the
  capture path sends, through the same
  `analyze_transcription_bias_with_mode`, into
  `transcription_bias.cloud_prompt_preview` and `local_prompt_preview`. The
  settings panel renders both, and it asks `config::select_recognizer_slots`
  for the term selection rather than reproducing the rule — a preview that
  recomputes the rule is a preview that eventually promises an initial prompt
  the provider never received.
- if the recognizer's term line still produces worse raw transcripts than
  `General Writing`, that is a contract break of this path; multilingual
  fragments, fantasy tokens or topic drift are then a core problem of the
  dictation lane, not "just profile noise".
- dictionary and snippet matches are literal and case-insensitive.
- snippet triggers never enter the recognizer's prompt. A short spoken cue that
  the recognizer keeps mangling belongs in Words & names, which is also where
  the runtime puts one it has learned; `stt_hints` is a migration remnant and
  editing it changes nothing.
- local text profiles encapsulate `prompt`, optional `stt_hints`, dictionary,
  snippets and work-mode defaults; the primary work-mode contract is
  `processing_mode` (`cleanup`/`rewrite`/`agent`/`prompt_enhance`/`verbatim`)
  plus optional `enhance_sub_mode` and `target`; the legacy
  `rewrite_style` field is only a migration input mapped via
  `migrate_legacy_processing_mode`.
- AI cleanup must conservatively preserve language mixing, colloquial
  speech, Germanized borrowings and technical tokens; unsafe or
  assistant-like rewrites fall back to the raw transcript via guardrails.
- the current local preview lane is no longer STT-only; if AI cleanup stays
  active, `transform.rs` falls back to the raw local transcript when the
  local model is unavailable or returns unsafe text.

## Insertion modes

`insertion.rs` decides among several real modes, not just a single paste
attempt:

```text
if direct paste succeeds
    -> direct_paste
else if clipboard write succeeds but direct paste is not possible
    -> clipboard_only
else if fallback paste was attempted through helper paths
    -> clipboard_fallback
else
    -> scratchpad_fallback
```

Rules of this path:

- successful direct insert best-effort restores the previous clipboard content.
- scratchpad and last-transcript restore are part of the product path.
- every insert outcome carries a machine-readable recovery action, a
  recovery message and the clipboard-restore status; UI and history must not
  guess recovery from free-text fallbacks.
- the same recovery semantics are carried through persisted history, history
  export and diagnostics cards; these surfaces must not form a second
  recovery truth.
- the overlay post-run snapshot may only show quick actions triggered from
  the same native history/insert truth; `retry` needs the real
  `history.entry_id`, and `insert`/`restore` may only call existing native
  commands.
- the processing preview for `clipboard_only` profiles stays the same runtime
  truth: transform provides the preview text, the session stays in
  `processing`, and the later commit runs through the same native
  insert/history/session path. An overlay edit on that preview goes through the
  same commit with its corrected text, so the delivered text, the completed
  session and the history entry can never describe different wording.
- every `transcription` event carries `delivery` from
  `NativeInsertMode::delivery_label` (`inserted` for a completed paste,
  `clipboard` for every fallback), so the UI reads what happened to the text
  instead of inferring it from the configured mode.
- audio cues are emitted by the session lifecycle next to the event that tells
  the UI the same thing, never from inside the insert helper (ADR 0012).
- overlay, input and About use the same native platform status as source.
- About shows prerequisites and limits from this native contract instead of
  inventing per-platform UI side-truths.
- Linux/X11/Wayland are modeled as explicit driver chains; `wl-copy`,
  `xdotool`, `wtype`, `ydotool`, `enigo` and scratchpad are no longer just
  implicit in the code.
- Rebuild Lab diagnostics shows a native step timeline for `capture`,
  `provider`, `transform` and `insert` including `state`, `duration_ms` and
  a stable `error_code`.
- the same V1 slice contract also carries an explicit `provider_profile`;
  diagnostics, preview and tests must not guess cloud or local modes from
  model names or local disk config.

## Platform model

WordScript models platform limits explicitly:

- macOS and Windows are the Tier 1 target paths.
- Linux X11 is Preview.
- Linux Wayland is compositor-specific: KDE Plasma 6 and GNOME Mutter reach
  direct auto-paste via a one-time `xdg-desktop-portal` RemoteDesktop grant
  (status `Preview-lite`); hybrid X11+Wayland sessions stay on `xdotool type`
  over XWayland, classify the KDE Plasma portal prompt and fall back to
  clipboard-only on detection; pure Wayland sessions (no `DISPLAY`) stay
  clipboard-only because `wtype`/`ydotool`/`enigo` would still trigger the
  "Control input devices" dialog; Hyprland, Sway and KDE Plasma 5 have no
  stable portal grant and stay experimental. Overlay on Linux: XWayland
  default with native-Wayland opt-in; always-on-top on KDE Plasma 6 via KWin
  script (`packaging/kwin-wordscript-overlay/`).

This is not marketing language but part of the insert and support model.

## Provider model

Two clearly separated provider lanes are active:

- `groq`: cloud-first production path for BYOK, secret store and AI cleanup.
- `local_preview`: compatibility id for the local runtime lane with external
  `whisper-cli` runner for STT, local ggml models and local Ollama cleanup.

Rules:

- Groq runs as BYOK; the API key lives in the OS secret store; the JSON
  config is scrubbed on save; legacy JSON Groq secrets are migrated natively
  into the secret store.
- `ProviderStatus` carries typed modes (`fast`, `quality`, `local`, later
  `self_hosted`) and capabilities (Transcription, Chat-Cleanup, Prompt-Bias,
  Language, Segments, Local, API-Key-Required).
- `local` and `self_hosted` are not interchangeable labels: `local` is the
  current on-device path, `self_hosted` is reserved for later user-run
  remote/LAN services and is not an active lane today.
- `ProviderCommandError` carries error kind, status, Retry-After,
  `retryable` and a `user_action` so runtime events and settings use the same
  recovery semantics.
- `local_preview` uses no API keys but visible local runtime prerequisites in
  settings and diagnostics, over a typed `local_setup` contract with
  `readiness`, stable `issue_code`, resolved runner/model paths and resolved
  cleanup endpoint/model; the contract is evaluated against the currently
  selected local STT and cleanup models and must not reconstruct local
  readiness from `credential.configured` or copy.
- Provider & Models renders the same contract as a preflight checklist for
  speech runner, STT model, cleanup endpoint and cleanup model; this UI is
  display and guidance, not a second setup source.
- `local_preview` probes the runner via an active native spawn, not just
  filesystem presence; error codes like `runner_probe_failed` or
  `runner_probe_timed_out` are part of the same product truth.
- local model profiles come natively from `WORDSCRIPT_LOCAL_MODEL_PATH` or
  `WORDSCRIPT_LOCAL_MODEL_DIR`; the UI must not treat a static model list as
  the source of truth for the local lane.
- the local lane separates STT profile and cleanup model explicitly (following
  the donor-oriented structure: `Handy` for runtime ownership, `voxtype` for
  explicit engine/mode paths, `openwhispr` for separated cleanup scopes).
- `local_preview` forwards the active STT prompt as an initial
  `whisper-cli --prompt` and reports prompt bias as a real capability, not a
  UI-only wish; the strength lives explicitly in `off`/`profile`/`profile_and_terms`
  plus optional `carry_initial_prompt`.
- local `local_preview` profiles are now real provider profiles with their
  own id per model and preset (`...-fast`, `...-quality`); the same selection
  lives in config, settings and the native provider request instead of a
  model-family heuristic.
- the same local runtime config carries explicit decode controls
  (`beam_size`, `best_of`); fast/quality only provide defaults now, the
  actual decoder search depth is part of the persisted AppConfig and
  provider-request contract.
- the same local runtime config carries a separate `local_correction_model`;
  the local cleanup model must not be reconstructed implicitly from the
  cloud cleanup model or a UI fallback.
- native diagnostics and transcription history for `local_preview` must show
  `provider_profile`, prompt-bias strength, carry flag, decode values,
  cleanup endpoint and cleanup model; these belong to the runtime truth of a
  local run.
- decode controls live profile-bound in AppConfig; `local_beam_size` and
  `local_best_of` are only the active mirror of the currently selected
  profile, while persistence is per `local_profile`.
- Rebuild Lab diagnostics must not derive the local runtime contract from the
  window form; the snapshot comes natively from the currently loaded runtime
  config. The UI may report a short-lived difference while an immediate
  auto-save or runtime reconfiguration is still in flight, but it must not
  mix the two sources.
- `local_preview` is now a full local dictation path for STT plus cleanup
  within the same runtime lane; capture, insertion and recovery stay
  deliberately the same product paths as for Groq.
- there is no WordScript proxy or hosted mode.

The current local runtime wiring expects:

- `whisper-cli` in `PATH` or `WORDSCRIPT_LOCAL_WHISPER_CLI`
- `WORDSCRIPT_LOCAL_MODEL_PATH` for a single ggml file or
  `WORDSCRIPT_LOCAL_MODEL_DIR` for `ggml-<model>.bin` and common variants
  like quantized or `.en` files
- Ollama locally at `http://127.0.0.1:11434` or `WORDSCRIPT_LOCAL_CHAT_BASE_URL`
- a local cleanup model selected via `local_correction_model` or
  `WORDSCRIPT_LOCAL_CHAT_MODEL`

When more providers arrive later they go under
`src-tauri/src/core/providers/` and must serve the same error and response
contract.

## What is intentionally not architecture reality yet

These are possible later product stages but not active architecture today:

- automatic model management with download/pull flow and installer-like
  checks beyond the current env-based runtime wiring and the Provider &
  Models preflight surface
- automatic or permission-based app/mode activation for work modes
- a full live-preview / controlled-commit path in the overlay with actions
  before the final commit
- another production provider system with explicit modes like `fast`,
  `quality`, `local` and `self_hosted`
- a guided setup/permissions path from install to the first useful dictation
- a team or sync model
- AI-assistant or screen-context workflows
- a published installer channel and a finished in-place updater

If a sync or workspace path is built later, the current direction is not a
peer-to-peer primary model. The expectation is a WordScript-owned sync layer
on a local data model with an optional account and cloud-workspace layer
(ADR 0005).

This implies for later architecture:

- the local dictation path stays usable without an account
- profiles, history and later voice workspaces stay WordScript-owned
- a later sync service is not a general foreign-hub dependency
- provider traffic is not automatically bound to a WordScript proxy; sync and
  STT transport are separate decisions

If documentation describes any of these topics it must clearly mark them as
planned, not active.
