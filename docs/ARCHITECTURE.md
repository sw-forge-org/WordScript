# WordScript -- Architecture

Status: 2026-08-11 — read against the shipped product by Leg 9; the UI layer
section had described the pre-port shell since before Leg 3's overwrite. The
provider section was rewritten the same day by stage A1 of the speech track,
which replaced the enum dispatch with the role registry in code; nothing else
in this file was re-read for it

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
- `settings`: **the window label, not its job.** It is the workspace: four
  views (Home, History, Profiles, Context) in a `.ws-nav` sidebar, the
  active-profile row at its foot, a status strip along the bottom edge, and
  **settings as a modal sheet laid over it at its own scale** (`Cmd+,`, Escape
  to close) holding ten sections in three groups. Restructured 2026-08-05 by
  Leg 3 of the port relay; the fourteen flat areas it replaced were deleted in
  the same commit (ADR 0054). Ten of the fourteen surfaces now read the runtime
  and eight of those write it; the four that do not, plus the two that read
  half of what they draw, each carry a banner saying so (rule 7). The
  `tauri.conf.json` label and the `#/settings` route keep the pre-port name —
  six Rust call sites and the window-state persistence key hang on it.
- `rebuild-lab`: native-decorated diagnostics pop-out mounting the **same**
  Diagnostics section the sheet does, rather than a second implementation of it.

**All three are declared statically in `tauri.conf.json`, and there is no
`WebviewWindowBuilder` anywhere in the Rust tree.** Windows are fetched with
`get_webview_window(label)`, revealed with `.show()`, and hidden rather than
destroyed — `install_hide_on_close` intercepts `CloseRequested`, calls
`prevent_close()` and hides. The `/gallery` route has no window at all and opens
inside one that is already there.

*Planned and not built* (ADR 0100): a second window class whose geometry belongs
to the user — moved, resized and remembered — for the four drawn windows that
have no host (the translation pop-out, the meeting HUD, the agent window,
ADR 0043's notification). It does not reopen the overlay's fixed per-surface
geometry and brings back no generic resize command; ADR 0089 removed that path
because `set_size` is asynchronous on WebKitGTK and content-driven resizes clip
the pill.

**Two windows share no state, and the runtime announces no setting change.**
There is no config-changed channel: `AppConfig::save_to_disk` writes and
`save_config` returns to its caller. With one settings window that has never
mattered; several pop-outs drawing one machine-wide value (ADR 0097's
per-language routing) makes it a defect designed in. *Planned and not built*
(ADR 0108): the config is the only holder, a write is announced on a channel
every window re-reads from, and the event is scrubbed by `without_secrets()`
like every disk write.

Key frontend building blocks:

- `src/windows/OverlayWindow.tsx`
- `src/windows/WorkspaceWindow.tsx` and `src/windows/workspace/`
- `src/windows/RebuildLabWindow.tsx`
- `src/screens/` — the ported screens. One implementation, two sets of props
  (ADR 0055): a wired screen takes `WiredScreenProps` and the compiler then
  refuses it a gallery entry, which is what makes "wired" and "retired from the
  gallery" one edit rather than two
- `src/components/shell/` and `src/styles/shell.css` — the productive library
- `src/hooks/useRuntime.ts`
- `src/hooks/useProvider.ts`
- `src/hooks/useNativeInsertion.ts`
- `src/hooks/useRuntimeLogs.ts`
- `src/hooks/useNavRail.ts` — the sidebar's width, and the one place the
  distinction between a preference and window state is enforced: the toggle
  writes `AppConfig.workspace_nav_rail`, a window crossing 760 CSS px changes
  the live value and writes nothing (ADR 0111)

The UI is responsible for: displaying runtime status, waveform and errors;
the guarded in-pill action state after a run; config maintenance; the global
manual profile switch in the sidebar and the sheet's header; **Profiles** as a
two-pane surface with the profile library, its rule lists with editors that
unfold under the row they act on (ADR 0082), the native analysis behind preview
and validation, and the health flags with their acknowledgement (ADR 0085); the
About release build-up explanation (strictly separating public release
visibility from workflow-internal draft handoffs); visible recovery actions and
diagnostics; separate rendering of transient runtime logs and durable native
transcript history with filters, export and the visible history store path.

**Text-rules import and export are among them again as of Leg 10, and the two
halves are on different screens on purpose** (ADR 0090). Export acts on a thing:
`Export rules` is the fourth verb on the profile's own row menu and writes the
profile the menu was opened on. Import creates one: it is on Privacy & Data
beside the full backup, it lands as a **new** profile and replaces nothing, and
the profile it makes does not exist yet — which is why it has no row to act on
and no target to choose. Privacy & Data also carries the export with a profile
picker, for a reader who is there to move data rather than to edit a profile.

For six legs this line claimed the capability while `export_text_rules` and
`import_text_rules` had no caller at all — complete in the runtime, compiled
into every build, and reachable from nothing since Leg 3's shell overwrite. The
full backup was never the replacement: it writes the whole config, the history
index and the transcript files as one archive, which is what you keep rather
than what you send. **A doc asserting a capability the product had lost is how
it stayed invisible** (ADR 0089).

The UI is **not** responsible for: global shortcut registration, microphone
capture, session state machine, insert decisions.

## Tauri host

`src-tauri/src/lib.rs` is the product shell. It holds: window setup for
overlay and settings; native visibility and positioning for the overlay
(bottom-center reveal, offscreen parking in idle via `park_overlay_window` --
opacity 0 plus click-through on Linux, `window.hide()` elsewhere, ADR 0155); monitor- and anchor-based overlay placement plus
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
  (`CONFIG_FILE_LOCK`) so overlapping commands cannot clobber each other. Its
  five model defaults are re-exported from `model_catalogue` rather than spelled
  as constants (ADR 0115).
- `model_catalogue.rs`: the one model catalogue, loaded from
  `shared/model_catalogue.json` through `include_str!` behind
  `CATALOGUE_VERSION` — the shape `regression_corpus` already has, with
  `shared/model_catalogue.schema.json` beside the data. **The file sits outside
  both `src/` and `src-tauri/` because it has two readers**: this module and
  `src/lib/modelCatalogue.ts`, which imports the same bytes rather than
  mirroring them. A row carries `(provider, role, model_id, documented
  streaming, languages, source, read_date)` and is named by a stable slug, so a
  vendor's next generation changes one `model_id` and nothing else in either
  tree. It records what a vendor documents and never what this build can
  operate — that is `providers::model_capabilities`, and the two are held apart
  by a test rather than by a convention (ADR 0115, scoped by ADR 0120).
- `model_install.rs`: in-app model installation for the local lane (ADR 0122,
  built as ADR 0158). **Two mechanisms behind one surface, because the two
  halves do not share a disk**: the speech weights are downloaded into a
  directory this module manages off `paths::user_data_dir` — so it inherits
  `WORDSCRIPT_DATA_DIR` and the test redirection — while the language models
  belong to whatever OpenAI-compatible server the user runs, which is asked to
  pull and never written into. A download lands in `<file>.bin.part`, is checked
  against the catalogue row's SHA256, and is renamed into place only then; free
  space is checked before the first byte, on unix, and answered as *unknown*
  rather than guessed where this build cannot compute it. Progress travels on
  `wordscript-model-event` and on neither session channel — a download must not
  be able to reach the reducer (ADR 0018, ADR 0019). The transfer takes a
  reporter closure rather than an `AppHandle`, which is what lets the one path
  that writes to a user's disk be exercised by a test.
  **`local_model_sources` is where precedence lives** (ADR 0159): four ranked
  places a recogniser may be, unioned for the listing and walked in order for
  the resolution. Two folders holding one name are one model; the rank decides
  which file runs, and the highest-ranked source that FAILED owns the error
  message.
- `runtime_log.rs`: buffered structured runtime logs for the diagnostics UI,
  plus a persistent ring-rotated file (`~/.config/WordScript/logs/wordscript-runtime.log`).
- `history.rs`: persistent native history with raw vs transformed
  transcript, insert outcome, server-side filters, export, retention policy,
  retry. It is also the ONE FUNNEL every finished record passes through, which
  is why the transcript file (ADR 0074) and the activity ledger (ADR 0174) are
  both written from it rather than from their callers.
- `activity_ledger.rs`: the all-time figures behind Home's counters — one row per
  DAY of counts and durations, never text, plus two fixed-width histograms for
  the medians. It exists because `history.json` is pruned by age and by count, so
  a total summed from it grows, sticks at the limit and then runs backwards.
  **Nothing in it subtracts**: a day row past the 800-day horizon is folded into
  `retired` on its way out, so a lifetime figure is monotone by construction and
  not by care (ADR 0176). It travels in the full backup and an import raises it
  field by field rather than replacing it (ADR 0179); the one control that lowers
  it is the reset in Privacy & Data, whose `reset_at_ms` stamp is what stops the
  history seed from quietly undoing the button.
- `language_detect.rs`: which language a delivered transcript came back in,
  measured locally over `whatlang` and answered as ISO 639-1 (ADR 0180). It
  exists because the provider route cannot work here — Groq treats language as a
  request hint and never names one in its response, and the local lane has no
  field for it — and because `entry.language` is the CONFIGURED language, so
  counting it would count how often a dropdown was changed. Refuses anything too
  short or too ambiguous rather than guessing.
- `paths.rs`: product paths (config, scratchpad, logs, and the managed model
  directory `model_install` hangs off it).

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
- **The cpal stream's lifetime *is* the recording.** `start_native_capture`
  opens the device and begins the recording in one call and refuses a second;
  samples accumulate in one `shared.samples` bounded by `max_samples` (derived
  from `max_recording_seconds`); `stop_native_capture` pauses the stream, takes
  the buffer whole and produces one outcome with one integrity verdict. **There
  is no way to lift a segment out of a running capture**, which is the shape a
  conversation is made of.

  *Planned and not built* (ADR 0107): the two are separated -- the stream is
  held for a session, a recording window opens per turn, and `CaptureIntegrity`,
  `capture_budget` and `transcribe_audio_file` all apply per turn unchanged.
  `max_samples` becomes a turn ceiling. The runtime mute (ADR 0098) holds the
  segmenter as well as the recording, so a deaf stretch is not a turn boundary.
- `sound/`: startup signature plus listen/handoff/done/abort/error cues.
  `cue.rs` owns the score, `pack.rs` the timbre, `synth.rs` renders at the
  device sample rate, `engine.rs` owns the output stream — one at a time, on one
  thread, opened on demand and closed after 60 s idle (ADR 0010, ADR 0150).
  **There is no speech synthesis here or anywhere else**, and the stream asks
  for the OS default device — the runtime enumerates input devices only, so
  where a cue actually lands is whatever the OS remembers for this application
  rather than a choice the app makes.

  *Planned and not built* (ADR 0097): a second, named output stream for speech
  on a device selected by name, leaving every cue rule intact. The two differ in
  the rule that matters — a cue pre-empts the running cue, an utterance must not
  be cut.
- **`muted` and `paused` are not two names for one thing**, and the difference
  decides what a duplex mute can reuse. `paused` gates the sample push and is
  subtracted from the effective wall clock in `effective_elapsed`; `muted` gates
  the level statistics, the voice-activity timestamp and the emitted meter, and
  **the audio keeps being recorded**. ADR 0098 adds a third state rather than
  overloading either.

### Provider and text processing

- `providers/mod.rs`: shared provider contract and typed command surface (modes,
  capabilities, errors). The eight top-level capability functions are **thin
  resolvers**: each looks the id up in the registry and calls a role.
- `providers/registry.rs`: the role split (ADR 0094, built 2026-08-11).
  `Provider` carries status and the credential set — per role since ADR 0105;
  `SpeechProvider` carries
  recognition, the account plans and the capture ceiling; `ChatProvider` carries
  completions; `VoiceProvider` carries synthesis and **is implemented by
  nobody** — it is declared so the third role is a role rather than an exception
  bolted on later. A `ProviderEntry` names one id, its aliases and the
  implementations behind it, so **adding a provider is a module plus one entry**
  and nothing in `mod.rs` moves. Several ids may point at one implementation,
  which is how an OpenAI-compatible shape absorbs a column of the drawn matrix.

  **A provider that cannot serve a role does not stub it.** The absence is
  `speech: None` / `chat: None` / `voice: None` on the entry, and the compiler
  is what enforces it: `Some(&GROQ)` in the `voice` slot fails to build, because
  `Groq: VoiceProvider` is not satisfied. There is no "unsupported" error to
  return, because there is no call to make.

  **A capability is asked on one of two axes** (ADR 0110, built 2026-08-11), and
  they are different questions. *Which roles does this vendor serve* is the
  provider's — `Provider::capabilities()`, carrying `speech_synthesis` beside
  `transcription` and `chat_completion`. *What does this model do inside one of
  them* is the model's — `Provider::model_capabilities(model)`, carrying
  `transcription_streaming`, `reports_detected_language` and
  `synthesis_streaming`, resolved through
  `providers::model_capabilities(provider, model)`, which takes **both
  arguments always**. One OpenAI key serves a model that streams and one that
  does not, so a contract answering the second question from the provider alone
  forces a lie on whichever model loses the vote. Each field is three-valued —
  `supported`, `unsupported`, `unknown` — because a model list that belongs to
  the vendor cannot be enumerated ahead of time, and **a model whose capability
  is unknown is not a model that streams**.

  A provider cannot claim a role it did not register: a registry test holds
  `speech_synthesis` to `voice.is_some()` over the whole table, so the role
  axis and the registry cannot drift. Both registered lanes answer
  `unsupported` on every model field today — Groq because its speech endpoint
  takes a file and returns a result, the local lane because it shells out to
  `whisper-cli` and echoes back the language it was told. **The vendor where
  two models disagree is not integrated yet**, so that shape is proved by a
  fixture in `registry.rs` rather than left unproved until D1.

  **A credential is resolved per `(provider, role)`** (ADR 0105, ADR 0102's
  storage half, built 2026-08-11). `ProviderRole` and `CredentialKind` are the
  two axes as values: `Provider` carries `credential_status(role)`,
  `save_api_key(role, kind, key)`, `clear_api_key(role, kind)` and
  `credential_kinds()`, and the secret-store entry is keyed
  `(provider, role, kind)` so **clearing one role cannot clear another's**. The
  roles a save may reach come from `ProviderEntry::roles()` — a credential
  cannot be stored for a role with no implementation, the storage-shaped version
  of the rule above. A save that names no role reaches every role the kind can
  pay for, because a key is a way into an account and the drawn key row sits on
  the connection; a subscription is filtered out of that fan-out for every role
  but chat, in the type rather than at a call (ADR 0102). `ProviderStatus`
  answers per role in `role_credentials` and folds them into the one
  connection-level `credential` block, conservatively: configured means every
  role has one. A pre-role key on disk is adopted onto each role before any
  write or delete touches it, and `try_migrate_legacy_secret` takes a
  `core::backup` snapshot first — **a migration without a snapshot path is not
  written**.

  *Planned and not built* (ADR 0095, ADR 0096): no streaming recognition
  contract stands beside `transcribe_audio_file`, and no adapter beyond these
  two is registered. **The provider axis in the config was the third entry here
  and is built** — A4 landed the resolved default plus the sparse per-job
  override on 2026-08-12 and this sentence outlived it by a stage; corrected
  2026-08-12 by B3, marked rather than edited away, because a paragraph that
  still describes the state before last week is how a document stops being read. What each vendor can actually serve is
  surveyed per row and per date in [PROVIDERS.md](PROVIDERS.md) — that document
  is a capability reference and not a claim about this codebase.

  **Both capability structs cross the seam and nothing on the other side reads
  them.** `ProviderCapabilities` and `ModelCapabilities` are mirrored in
  `src/types/providers.ts` and returned by `provider_status` — the model axis
  answered for the model the request named, since asking without one is half a
  question. **The drawing states an intent and the runtime answers a
  capability**, and the code that makes the second govern the first is
  `src/lib/providerSeam.ts` (ADR 0106, ADR 0124, 2026-08-12) — the third thing,
  neither the drawing nor the runtime. `AI Models` reads
  `status.capabilities` and `role_credentials` for *can this be operated*;
  `registered_providers()` answers the prior question — *does an adapter exist
  at all* — for the whole registry in one call, and a vendor's absence from that
  list is that answer. The drawn `PROVIDERS` table in `src/screens/data.ts`
  stays the drawing and is what `port:diff` measures. **The model axis is still
  consumed by no surface**: *will this row stream* is a model question no drawn
  row asks yet, and it arrives with the lane that streams (ADR 0110, stage D2).
- `providers/openai_compatible.rs`: the OpenAI-compatible transport, once
  (ADR 0113). Three paths, a bearer token, a retry policy and nothing
  vendor-specific — four adapters call it with a base URL. It also holds
  `is_secure_endpoint`, which is the one place a base URL that a user typed
  becomes usable: HTTPS or a private host, ported whole from the donor with its
  dotted-quad parser (ADR 0164).
- `providers/openrouter.rs`: recognition on one key across several upstreams
  (D1a). **Speech only** — the chat role is G3's, and the seam states that gap
  as WordScript's rather than the vendor's.
- `providers/self_hosted.rs`: an OpenAI-compatible endpoint the user operates
  (D1a, configured by D1b). The base URL and the model id are `AppConfig` fields
  typed on the connection card and **outranking**
  `WORDSCRIPT_SELF_HOSTED_BASE_URL` and `_MODEL`, which stay as the door for a
  machine nobody has typed on; the optional bearer token is in the OS secret
  store under `self_hosted.speech.api_key`, because this lane **accepts** a
  credential and **requires** none (ADR 0165). It catalogues no model,
  substitutes no default and states no upload ceiling — three absences that are
  the lane rather than gaps in it — and it downgrades a segment-carrying
  `response_format` to `json`, because it claims no segments and a server that
  does not know the spelling answers 400 to the whole request.
- `providers/groq.rs`: cloud-first production implementation (BYOK, secret
  store, Groq-specific HTTP errors).
- `providers/local.rs`: local runtime lane with `whisper-cli` for
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
  profile health analysis for the profile's rule lists. Import and export are
  complete here and reached by nothing since Leg 3 (ADR 0089).

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
6. `providers/mod.rs` resolves the active provider's registry entry and calls its
   speech role — `providers/groq.rs` or `providers/local.rs` today.
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
- the current local lane is no longer STT-only; if AI cleanup stays
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
- `local`: the local runtime lane with external `whisper-cli` runner for STT,
  local ggml models and local Ollama cleanup.

Rules:

- Groq runs as BYOK; the API key lives in the OS secret store; the JSON
  config is scrubbed on save; legacy JSON Groq secrets are migrated natively
  into the secret store.
- `ProviderStatus` carries typed modes (`fast`, `quality`, `local`,
  `self_hosted`), provider-axis capabilities (Transcription, Chat-Cleanup,
  Speech-Synthesis, Prompt-Bias, Language, Segments, Local, API-Key-Required),
  the model-axis answer for the model the request named, and one lane-specific
  block per lane that has one: `local_setup` for the disk, `self_hosted_endpoint`
  for the user-run server (ADR 0165).
- `local` and `self_hosted` are not interchangeable labels: `local` is the
  on-device path, `self_hosted` is a user-run remote or LAN service and has been
  an active speech lane since 2026-08-16. The difference is not cosmetic — one
  reads a file where it lies, the other posts an upload to a machine this build
  did not install and cannot inspect.
- `ProviderCommandError` carries error kind, status, Retry-After,
  `retryable` and a `user_action` so runtime events and settings use the same
  recovery semantics.
- `local` uses no API keys but visible local runtime prerequisites in
  settings and diagnostics, over a typed `local_setup` contract with
  `readiness`, stable `issue_code`, resolved runner/model paths and resolved
  cleanup endpoint/model; the contract is evaluated against the currently
  selected local STT and cleanup models and must not reconstruct local
  readiness from `credential.configured` or copy.
- AI Models renders the same contract as a preflight checklist for speech
  runner, STT model, cleanup endpoint and cleanup model, under its `On this
  machine` tab; this UI is display and guidance, not a second setup source.
- `local` probes the runner via an active native spawn, not just
  filesystem presence; error codes like `runner_probe_failed` or
  `runner_probe_timed_out` are part of the same product truth.
- local model profiles come natively from `WORDSCRIPT_LOCAL_MODEL_PATH` or
  `WORDSCRIPT_LOCAL_MODEL_DIR`; the UI must not treat a static model list as
  the source of truth for the local lane.
- the local lane separates STT profile and cleanup model explicitly (following
  the donor-oriented structure: `Handy` for runtime ownership, `voxtype` for
  explicit engine/mode paths, `openwhispr` for separated cleanup scopes).
- `local` forwards the active STT prompt as an initial
  `whisper-cli --prompt` and reports prompt bias as a real capability, not a
  UI-only wish; the strength lives explicitly in `off`/`profile`/`profile_and_terms`
  plus optional `carry_initial_prompt`.
- `local` profiles are now real provider profiles with their
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
- native diagnostics and transcription history for `local` must show
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
- `local` is now a full local dictation path for STT plus cleanup
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
  checks beyond the current env-based runtime wiring and the AI Models
  preflight surface
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
