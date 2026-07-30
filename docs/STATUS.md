# WordScript -- Status

Status: 2026-07-25

> Meta structure: bug documentation lives in `docs/known-issues/`,
> architecture decisions in `docs/decisions/` (ADRs), the contribution
> workflow in `CONTRIBUTING.md`. This file stays the current product state.
> Per-commit histories belong in `CHANGELOG.md`, not here.

## Product state

- Release line: `0.2.2-alpha`
- Active product path: Tauri/React UI plus native Rust core
- Usable today: dev build from the repo via `npm run tauri dev`
- Active windows: overlay, settings and the diagnostics pop-out
- UI state: settings surface is a native-macOS-inspired **WordScript shell**
  (grouped 232px sidebar, shadcn/ui + Tailwind v4 on v2 tokens, native title
  bar on every OS, immediate area changes and automatic settings persistence).
- Active areas: WORKSPACE (Home, History, Profiles) -- ENGINE (Speech & AI,
  Modes, Capture, Overlay) -- SYSTEM (Insert & Recovery, Diagnostics, About)
  -- MORE (Chat, Upload, Notes, Account). The first three groups are
  runtime-backed product surfaces. MORE contains visible, explicitly labeled
  layout previews with sample or component-local state only.
- Settings IA restructuring (2026-06-21): the tab structure was audited for
  redundancy and findability and re-ordered. Insert/Recovery/Diagnostics data
  was duplicated up to 4x and is now consolidated: **Insert & Recovery** is
  the only recovery surface; **Overlay** was extracted from Input;
  **About** was slimmed to version + release path; History is now the only
  history surface; Diagnostics got internal sub-tabs. Profile work-mode
  defaults are editable in Profiles; Modes shows an effective-mode
  precedence indicator. Storybook and Glass prototypes were removed; the
  MORE areas are built in the settings kit, not the isolated Glass kit.

## Implemented core features

- native start/stop, pause/resume and abort hotkeys
- one Rust-owned shortcut contract (`core::shortcut`, ADR 0006): a single token
  vocabulary, canonical storage form, human display strings and validity rules,
  consumed by config, trigger and UI alike. Clearing a shortcut disables it, a
  single bare modifier or bare letter can no longer become a desktop-wide grab,
  and a value that cannot register is surfaced instead of silently rewritten
- shortcut recording as an explicitly ended state: chord accumulation with
  confirm, cancel, blur and timeout, the runtime's full key vocabulary, real
  release of the OS grabs while recording (Capture and Modes), and manual token
  entry as a local draft that only reaches the runtime on commit
- per-shortcut registration truth in Settings: registered versus configured,
  persistent failure reasons, observed press/release counts and a platform line
  naming the session type and the keys the desktop swallows
- permanent structured trigger logging (`[trigger]` in the runtime log): every
  received shortcut event, the decision taken, every registration outcome and
  every stranded hold ended by the watchdog
- three activation modes with defined edge cases: tap, double tap (the default,
  ADR 0008 — two taps within `double_tap_window_ms`, so a modifier-only trigger
  no longer acts on every single press) and hold to talk, which is strictly
  momentary (ADR 0013): a press below `hold_arm_ms` is discarded rather than
  extended into a recording, the microphone still opens on the press edge so no
  word is lost, and a release that never arrives is ended by the watchdog
- modifier-only shortcuts are observed rather than grabbed (ADR 0009): the raw
  key stream is watched without consuming the keystroke, so a trigger like
  `Ctrl+Super` no longer takes that combination away from every other
  application. A shortcut with a real key is still grabbed, which is what it
  should be. Implemented for Linux/X11; Windows and macOS still need the same
  routing in their platform implementations
- a per-session shortcut capability matrix (`shortcut_capabilities`, ADR 0007):
  session facts plus the trigger lane's measured press/release evidence decide
  which activation modes and key classes are available, conditional or
  unavailable. Settings gates the activation selector on it and never rewrites a
  stored mode that becomes unavailable
- native microphone capture with waveform, level events, silence timeout and
  max-duration autostop
- single capture stream rebuild after a transient cpal stream error
  (matching-gate on sample rate/channels/format; one attempt per session;
  persistent runtime log + classified error pill)
- pipeline hardening against backend aborts: a hard-deadline watchdog, a
  single transcription retry (retryable only), and a persistent runtime log
  file so abort errors no longer fall out of the ring buffer
- Groq BYOK with OS secret-store storage
- `local_preview` as a full local runtime lane over external `whisper-cli`,
  local ggml models and local Ollama cleanup (STT plus cleanup, not STT-only)
- Provider & Models preflight for the local runtime lane with native runner,
  STT-model, cleanup-endpoint and cleanup-model readiness
- bounded STT prompt bias for Groq and `local_preview` from active profile
  context, dictionary spellings and likely phrases; **the bias policy and every
  local decode setting reach the provider for the first time since 2026-07-29**
  (ADR 0015) -- they had been dropped between the capture event and the
  transcription request, so no profile could affect a real recording and the
  preview was the only place the configuration was visible
- a speech gate trims leading and trailing silence and rejects captures below
  200ms of remaining audio with an explicit overlay message; a segment
  confidence gate drops what Whisper's own metrics mark as invented on the cloud
  lane; capability-probed whisper.cpp flags harden the local lane; a
  repetition/artifact detection stage runs before AI cleanup (ADR 0016)
- an optional per-profile language pin that never discards text on a language
  mismatch alone -- inline code-switching such as anglicisms in German or a
  quoted Spanish phrase in English is left byte-identical and untranslated
- the automatic bias path is now more conservative: generic profile
  categories are no longer forwarded to STT and cleanup; included profiles
  start without prefilled snippet-like `stt_hints`
- Text Rules shows this conservative bias contract and warns when profile or
  hint lines are ignored by the automatic path or when no concrete STT hints
  remain
- hallucination filter and optional AI cleanup with conservative preserve
  hints from active profile context and dictionary spellings; local and
  cloud use separate model slots
- local text profiles for transcription context, dictionary, snippets and
  work-mode defaults in the native transform/insert/history path
- explicit processing modes (`auto`, `cleanup`, `rewrite`, `agent`,
  `prompt_enhance`, `verbatim`) with `mode_router` resolution from manual
  override and profile work-mode; `auto` is resolved per transcription via
  `resolve_auto_mode` (agent name + imperative -> agent; imperative + IDE
  context -> prompt_enhance; else cleanup); the renderer queries the
  effective mode via `resolve_current_processing_mode`; overlay side label
  and profile dock show the active mode
- `workspace_context` with foreground-app detection on macOS, Windows and
  Linux via `run_with_timeout` with dedicated pipe-drain threads
- `prompt_enhance` mode with `enhance`/`expand` sub-mode and `PromptTarget`
  (system/developer/user) plus a guardrail chain (empty, prompt_executes,
  language_mismatch, length_budget, semantic_drift)
- compact live overlay stage with one decision surface per delivery mode
  (ADR 0011a): a real `clipboard_only` processing preview with copy, edit and
  abort before commit, and an `auto_paste` result surface with copy, edit,
  insert and dismiss after delivery; plus remembered manual placement or preset
  display anchor, movement-threshold dragging, native offscreen parking in idle,
  and state-specific right-side spacing
- Linux overlay with fixed window sizes (480x60 flat / 460x164 edit),
  `set_background_color` on every reveal, `park_overlay_window` with
  `hide()`, XWayland default with native-Wayland opt-in, KWin script for
  always-on-top on KDE Plasma 6
- atomic overlay state swap on new triggers (recording starts in the same
  render that the previous epoch disappears) and on session end: the native
  completion event only mirrors the transcript text, so `status`, `lastResult`
  and the result surface flip in one commit and no render passes without a
  surface owning the pill (ADR 0018)
- Linux/XWayland transition state bleeding is resolved through opaque pill
  surfaces and compositor guards. A separate mode-cycling artifact is in an
  accepted residual state: a small black flash or faint horizontal line can
  still appear during rapid mode changes.
- the `auto_paste` unmount gap that let the result surface stack on a
  processing surface is closed on both axes: the effect ordering (ADR 0011a)
  and the event ordering (ADR 0018). Two further re-entry points into the same
  gap class are closed as well (ADR 0019): the 1.5 s completion fallback now
  ends a session together with its surface and a late authoritative event
  updates that surface in place, and the delivery-dependent chrome of the
  processing preview now forces a native repaint.
  A third re-entry point was found by measurement on 2026-07-30 and closed: the
  edit surface left its own leave hold at the instant the fade started, in 4 of 5
  edit closes, because the hold was keyed on the live `editText` that the
  interaction-reset effect clears. It now paints from a frozen frame.
  **Not resolved:** the exact stacking reported on 2026-07-29 is still not
  reproduced — nine instrumented sessions produced no frame with two surfaces.
  A stalled-leave hypothesis was measured and disproved; the transition runs at
  241-246 ms in 9 of 9 closes, and the apparent stall was the trace's own
  rAF-based flush, since corrected to a microtask. The mode axis also stays open
  (absent in `Auto`, present in the other five processing modes — no code path
  links `ProcessingMode` to the surface decision, and the preview surface has no
  ModeChip geometry at all, so the mode is most likely a visibility modifier)
  ([known-issues/overlay-ghosting.md](known-issues/overlay-ghosting.md))
- the delivery mode reverting itself to clipboard-only has a second mechanism
  found and fixed (ADR 0019): a normalized `work_mode` was corrected in memory
  on every config load and never written back, so a legacy `insert_behavior`
  token on disk forced that profile to clipboard-only on every start. Open is
  whether a writer of the non-canonical token exists; the P1 diagnostic is the
  instrument
  ([known-issues/insert-behavior-reverts.md](known-issues/insert-behavior-reverts.md))
- persistent native transcription history with retry, delete/clear,
  server-side filters, JSON export and a separate diagnostics view from
  transient runtime logs
- Text Rules validation, preview, import/export and conflict handling
- profile health and bias policy: automatic detection of systemic behavioral
  distortion in a profile (length bias in dictionary, contradictory style
  instructions, cleanup-suppressing prompt patterns) with a traffic-light
  display in the Text Rules tab and a dot in the profile dock; individual
  flags can be acknowledged without changing config; persistent
  `profile_health_acknowledged_flags` map
- native insertion with multiple fallback levels
- scratchpad and last-transcript restore
- input preflight for the first dictation with trigger and microphone status
  from native truth; insert and recovery status live in the Insert &
  Recovery area
- native sound cues: a startup signature plus listen, handoff, done, abort and
  error, with four selectable timbre packs, a volume slider and per-cue preview
- microphone input-level diagnosis: an empty capture names its own cause with
  the measured peak in dBFS, plus a live input meter in Settings
- buffered runtime logs in diagnostics
- native release status check for the About area with an honest
  GitHub-release signal

## Text Rules and profile state

### Active today

- local text profiles with active `Transcription Context`
- work-mode defaults for processing mode, insert behavior and recovery
  behavior; `rewrite_style` is only a migration input now and is mapped to
  the primary `ProcessingMode` contract via `migrate_legacy_processing_mode`
- profile-owned personal dictionary
- profile-owned snippet list
- global switches for AI cleanup, filler filter and rewrite phrasing only as
  a fallback for profiles without an explicit work mode
- a dedicated Modes tab in settings exposing the active mode, sub-mode,
  prompt target, the `auto_detect_mode` switch and seven mode shortcuts
  (one picker/cycler plus six direct modes) with platform-specific defaults

### Not active today

- no prompt library as a product function
- no assistant identities
- no team or sync model

### Profile reality today

- profiles are kept locally in the native config
- the old global rule state is migrated into a standard profile on load
- the settings sidebar shows the active profile name globally and allows
  manual switching or quick creation of new profiles
- the Text Rules UI can create, duplicate, select and delete profiles;
  included profiles appear in the same profile library and can be used or
  edited like normal profiles
- the Text Rules UI is organized as a workspace: profile library left,
  active context/preview cards top, separated dictionary/snippet work areas
  below
- history stores the active profile name and active work mode as part of the
  transcript record
- automatic app- or hotkey-based profile activation does not exist yet

Documentation rules:

- `Transcription Context` stays an STT aid.
- profiles are implemented but stay local and manually activated.
- included profiles are local baselines for central ICPs, not a server-side
  prompt library.

## Insertion and recovery model

The insert path can end in four visible modes today:

- `direct_paste`
- `clipboard_only`
- `clipboard_fallback`
- `scratchpad_fallback`

Additional rules:

- successful direct insert best-effort restores the previous clipboard content
- scratchpad and last-transcript restore stay visible in the Insert &
  Recovery UX (the only recovery surface; Home keeps only a quick-restore
  button linking there)
- current insert results carry `recovery_action`, `recovery_message` and
  `clipboard_restore` so settings and diagnostics can clearly distinguish no
  action, manual paste, scratchpad recovery and clipboard-restore signal
- persisted history entries and history exports carry the same recovery
  fields so retry, export and diagnostics keep the same insert truth
- scratchpad recovery in Insert & Recovery, diagnostic preview transcripts in
  Diagnostics and the persistent history store are three separate native data
  surfaces
- overlay, Insert & Recovery and Diagnostics read the same native platform
  status; About no longer shows platform status
- overlay visibility itself follows the native host contract: active
  sessions are revealed bottom-center, idle states are parked offscreen
- overlay placement also follows the native host contract: drag stores the
  last manual position, settings can switch to preset display anchors, both
  stay part of the same `AppConfig`
- on Linux the paste lane has exactly one mechanism where it has any: XTEST via
  `xdotool` on hybrid XWayland, and nothing at all on pure Wayland. `enigo` is
  the same XTEST request through another binding, not an independent fallback.
  Measured 2026-07-30 on Plasma 6 XWayland: 37 real pastes, zero portal denials
  — the mechanism is reliable where it exists, the gap is that it does not exist
  everywhere. A second, genuinely independent mechanism (libei) is a candidate
  with an open decision gate in [ROADMAP.md](ROADMAP.md), not scheduled work

## Known open product gaps

- transcription reliability outside `General Writing` or no profile is still
  not robust enough; individual curated profiles like `Customer Success
  Replies` can still visibly worsen raw transcripts with multilingual
  fragments, fantasy tokens and topic drift
- the AI cleanup step no longer answers dictated questions; an explicit
  guardrail in `normalize_correction` catches cases where the model removes a
  question mark from the output; regression tests for this path exist
- real regression cases from failed dictations now run through the corpus at
  `src-tauri/tests/fixtures/regression_transcripts.json` plus the loader in
  `core::regression_corpus`: schema validation, bias-path assertions,
  text-rules analysis assertions, profile-health init tests and dictionary
  structure tests; initial examples cover `cs_profile_multilingual_topic_drift`,
  `cs_profile_length_explosion_via_english_boilerplate` and
  `cs_profile_question_answered_german`; more real examples are added
  manually and must each flow into the corpus and matching synthetic tests
- the profile-wide bias policy is retired as a user-facing concept (ADR 0017).
  `TextProfileWorkMode.bias_mode` and `manual_bias` were a knob about whether
  vocabulary gets pushed into Whisper's initial prompt -- a question that needs
  Whisper internals to answer, and whose only safe setting (Conservative) was
  also the one with no effect. Vocabulary is now applied deterministically after
  transcription; a single per-entry "Hint the recognizer" toggle, off by
  default, is the only remaining way into the prompt. Dictionary terms left the
  prompt entirely. The Profiles tab is three panels (Vocabulary, Replacements,
  Snippets) instead of four
- `TextProfile.schema_version` migrates existing profiles once on load: the
  `stt_hints` blob becomes `vocabulary_hints` entries, Manual opt-ins are
  preserved per entry, and rejected lines are logged rather than lost
- a *single* modifier as a trigger (double-tap Shift, push-to-talk on one key)
  works on Linux and not on Windows or macOS. It depends on the interruption
  signal that comes with the observed key edges, and only the Linux path reports
  it so far; the other two say so instead of offering it. `Shift` also cannot be
  narrowed to the right-hand key yet, because the token vocabulary is
  side-agnostic (ADR 0009)
- the shortcut lane has never been executed on Windows or macOS. It is
  implemented and unit-tested for all three platforms, but only Linux
  (KDE Plasma 6 / Wayland, app on XWayland) has ever run it. One consequence is
  already known from the vendored crate's source: the modifier-only capture
  defaults (`Ctrl+Super`, `Ctrl+Alt`) are expected to fail registration on macOS,
  because that platform implementation maps no modifier as a main key. Run sheets
  and the source-level findings are in
  [known-issues/cross-platform-shortcut-verification.md](known-issues/cross-platform-shortcut-verification.md)
- **one set of shortcut defaults serves all three activation modes**, and the
  gesture each mode actually wants cannot be expressed yet: a single modifier is
  rejected outside Linux, modifiers cannot be told apart by side, and the
  observation path exists only in the x11 backend of the vendored crate. The
  full plan is in
  [handoffs/HANDOFF_activation-mode-gestures-and-defaults.md](handoffs/HANDOFF_activation-mode-gestures-and-defaults.md)
- the fix that stops the shipped abort default from discarding a capture under
  an unrelated `Ctrl+Alt+<key>` chord is **in code but unobserved**. Pause and
  abort now follow start/stop's rule — a modifier-only binding is decided at the
  release edge, where the interruption signal exists (ADR 0014) — and seven unit
  tests cover it, but neither the defect nor the fix has been seen in a running
  app. On Windows and macOS the defect is untouched, because those backends
  report no interruption at all. Run sheet in
  [known-issues/pause-abort-interrupted-chord.md](known-issues/pause-abort-interrupted-chord.md)
- the `[trigger]` log block for hold to talk **has not been captured yet**. The
  mode was corrected on 2026-07-29 (ADR 0013) after a live session showed it
  acting on both edges but treating every press length alike; the behavior was
  observed by use, the log transcript was not recorded, and the decision tokens
  changed with the fix. The run and what it should show are written out in
  [known-issues/capture-shortcut-recording.md](known-issues/capture-shortcut-recording.md)
- the capability matrix that gates `hold to talk` reports **this session**, not
  the platform. Hold follows the measured press/release evidence per session and
  per shortcut, which is honest but weaker than a platform statement: the
  physical half of the S0 measurement (real keys rather than XTEST-injected ones,
  and delivery with a native Wayland client focused) has not been taken yet, so
  no session type carries a hard verdict. The procedure is written out ready to
  execute in
  [known-issues/capture-shortcut-recording.md](known-issues/capture-shortcut-recording.md)
- no `org.freedesktop.portal.GlobalShortcuts` path: in a native Wayland session
  (`WORDSCRIPT_NATIVE_WAYLAND=1`) global shortcuts are unavailable and are named
  as unavailable rather than silently failing. Both points are tracked in
  [known-issues/capture-shortcut-recording.md](known-issues/capture-shortcut-recording.md)
- the recording overlay is reported to freeze mid-capture at irregular
  intervals — pill, seconds timer and all input at once — while capture and
  pipeline continue and the transcription completes normally. Observed only
  under `npm run tauri dev` so far, never checked against a release build, and
  the telemetry available at the time could not separate a real freeze from the
  overlay legitimately not re-rendering during silence. Timestamped logs, level-
  emit accounting per capture and an `[ov-beat]` main-thread heartbeat are now
  in place to decide it; the measurement order is in
  [known-issues/overlay-recording-freeze.md](known-issues/overlay-recording-freeze.md)
- `react-router-dom` 6.30.4 carries an open advisory with no patch in the 6.x
  line; the app has no `<Link>` or `useNavigate` call site the advisory could
  act on, but the move to v7 is still owed. Two further transitive advisories
  (`postcss` at build time, `undici` in the test environment) have non-breaking
  fixes, four Dependabot alerts are stale, and the Rust tree has no advisory
  coverage because `cargo audit` is not part of the checks yet. All of it is in
  [known-issues/dependency-advisories.md](known-issues/dependency-advisories.md)
- the overlay diagnostic log writes to a predictable path in the world-writable
  `/tmp`, and its three commands are registered in release builds although only
  dev code calls them. A hardening finding rather than an observed failure, with
  the measures in
  [known-issues/diag-log-write-surface.md](known-issues/diag-log-write-surface.md)
- no published versioned releases
- no signed in-place auto-updater
- release and signing validation with real secrets is not a routine path yet
- Linux Wayland is compositor-specific: KDE Plasma 6 / GNOME Mutter reach
  direct auto-paste via a one-time xdg-desktop-portal RemoteDesktop grant;
  Hyprland, Sway and KDE Plasma 5 stay experimental without a stable portal
  path
- Linux Wayland auto-paste behavior per compositor: KDE Plasma 6 and GNOME
  Mutter request a RemoteDesktop portal session via `busctl`, persist the
  restore token under `$XDG_RUNTIME_DIR/wordscript/remote-desktop.token` and
  reuse it so the "Control input devices" dialog appears only once; pure
  Wayland sessions without an active XWayland bridge stay clipboard-only;
  hybrid sessions use `xdotool type`, classify stderr at runtime and
  degrade to clipboard-only on a detected portal prompt
- Linux Wayland overlay click-through to apps beneath the overlay is not
  solvable with current tooling (needs Tauri layer-shell support or a
  compositor-specific protocol path); drag, button-click and clipping are
  reliable
- Linux settings scroll performance was fixed by enabling GPU compositing by
  default and reducing CSS cost (shadows, backdrop-filter, background-attachment,
  contain, transition-colors, history refresh interval); opt-out via
  `WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING=1`
- a full guided setup, permissions and packaging path from install to the
  first useful dictation is not implemented yet; local runtime and Input
  already have preflight surfaces for the most important first steps
- the local runtime lane still needs automatic model management, pull/install
  actions and a user-friendly first-run path beyond the current env-based
  runtime wiring
- multiple full production providers beyond Groq are not implemented yet;
  the typed `fast`/`quality`/`local`/`self_hosted` provider-mode contract
  exists, but it is not yet backed by a real multi-provider production stack
- settings still need native-host polish and clearer boundaries around the
  visible MORE previews; the runtime-backed information architecture is
  usable and the overlay is not the primary UI work site
- a comprehensive profile summary/detail view is open: the user does not yet
  fully see what a text profile contains (work-mode defaults, capture
  settings, modes settings, speech settings, dictionary, snippets) and what
  stays global (hotkeys, overlay placement, display timeouts, sound)
- the shipped profile catalogue needs to be rebuilt from real daily use rather
  than from plausible job titles, and `General writing` should become a curated
  blank profile instead of the only non-curated one -- that asymmetry is what
  made it the only profile unaffected by the delivery-mode reset. Planned as
  Phase 7 in [ROADMAP.md](ROADMAP.md)
- the settings surface needs a complete visual rework. The runtime-backed
  information architecture is sound and per-profile behaviour is verified
  working in the native host (2026-07-29: cleanup settings, processing modes
  and workspace context all resolve per profile); the presentation is not, and
  the profile panels only became coherent enough to redesign against once the
  bias policy was retired (ADR 0017). Also Phase 7
- overlay monitor restore with identity-miss rederivation is implemented
  (manual mode rederives the target monitor from saved coordinates against
  all work areas; primary is only the last fallback)
- remembered overlay placement is implemented; the three roots (persist
  debounce ending the drag session too early, reveal-grace suppression
  discarding fast drags, `set_position` before `show()` dropped by GTK) are
  fixed
- later app- or mode-based automatic activation for work modes stays open
- the overlay is not yet a full live-preview/controlled-commit path; every
  delivery mode has exactly one decision surface (ADR 0011a), but only
  `clipboard_only` decides *before* delivery. A pre-commit decision path for
  `auto_paste` as well stays a deliberate non-goal for now: it would add a
  confirmation step to every dictation
- later notes and deeper workflow builds on top of the new history core are
  not implemented

Explicitly not the next work site of this product phase are `openwhispr`
topics like notes, search, sync, MCP or assistant scope. These stay
downstream until WordScript has become a more personal and trustworthy daily
dictation product.

## Phase status (V1 consolidation)

The detailed roadmap with order, conditions and phase scope lives in
[docs/ROADMAP.md](./ROADMAP.md). Here only the current state of each V1
phase:

- [x] **Phase 1 -- Transcription bias, profile health, corpus** (commit
  `a6005ca`, merged 2026-06-10).
- [x] **Phase 2 -- Settings shell polish** (completed 2026-06-20).
- [ ] **Phase 3 -- Live preview and controlled commit in the overlay.**
  Prerequisite: phase 1 (preview needs bias clarity).
- [ ] **Phase 4 -- Provider stack build-up** with honestly separated
  `local` vs `self_hosted` semantics. Prerequisite: stable
  `ProviderCommandError` / `ProviderStatus` contract.
- [ ] **Phase 5 -- Local runtime as a first-class product option.**
  Prerequisite: phase 4 (same provider contract).
- [ ] **Phase 6 -- Guided setup and packaging path.** Comes last on
  purpose, because guided setup is only honest once the underlying paths are
  honest.

## Release build-up status

- the active repo path stays source-first with `tauri dev`, but there is
  again a build-matrix workflow and bundle targets for Linux, macOS and
  Windows
- the current user reality stays the dev build via `npm run tauri dev`
- in parallel an internal cross-platform build-up for Linux, macOS and
  Windows is being maintained; it is not a signal that WordScript is
  release-ready
- the launch blocker was profile-dependent transcription reliability; its
  mechanical cause is fixed (ADR 0015/0016) but the result is not yet
  re-measured against real dictation, and the profile UI rework is still open.
  Together with the still-incomplete guided local setup this remains the
  blocker, not the lack of further packaging mechanics
- `check_app_update` honestly reports that no published releases exist;
  internal draft handoffs intentionally do not change this public truth
- there is no active installer channel and no trusted download handoff for
  end users; the new draft handoff stays maintainer-internal
- PR CI validates frontend tests, frontend build, `cargo check` and
  `cargo test` on Ubuntu, macOS and Windows; the `push: main` trigger is
  temporarily disabled (manual `workflow_dispatch` stays available) to avoid
  repeated red runs during the development phase
- `cargo test` is reliably green again on a clean tree. Two `core::runtime_log`
  tests and the `core::workspace_context` env-var pair used to mutate process
  globals and fail at random under parallel execution (2 of 22 consecutive runs
  on 2026-07-29). Both sites now assert through a seam instead of the global —
  a local `VecDeque` for the ring buffer, an argument for the project-root
  lookup — so no test writes process state any more. Measured after the fix:
  10 consecutive parallel runs green, `--test-threads=1` green, 413 tests.
  Recorded in
  [known-issues/rust-test-global-state-isolation.md](known-issues/rust-test-global-state-isolation.md)
- the manual release build-up workflow runs frontend tests, Rust tests and
  frontend build before bundling, collects bundles into checksummed handoff
  archives and can optionally put them in an internal draft release
- Linux AppImage packaging is not release-stable yet and can fail at
  `linuxdeploy` in the build-up path
- packaging, signing and updater work is in build-up, but not released as a
  live user path
