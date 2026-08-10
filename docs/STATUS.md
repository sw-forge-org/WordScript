# WordScript -- Status

Status: 2026-08-11

> Meta structure: bug documentation lives in `docs/known-issues/`,
> architecture decisions in `docs/decisions/` (ADRs), the contribution
> workflow in `CONTRIBUTING.md`. This file stays the current product state.
> Per-commit histories belong in `CHANGELOG.md`, not here.

## Product state

- Release line: `0.2.2-alpha`
- Active product path: Tauri/React UI plus native Rust core
- Usable today: dev build from the repo via `npm run tauri dev`
- Active windows: overlay, the workspace and the diagnostics pop-out
- UI state: **one window** as of 2026-08-05 (Leg 3). The main window is the
  workspace -- four views, Home / History / Profiles / Context -- and settings
  is a modal sheet laid over it at its own scale (plan §11.22), opened with
  `Cmd+,` / `Ctrl+,` and closed with Escape, the scrim or its close control.
  The ported shell grammar throughout: `.ws-nav` sidebar, native title bar on
  every OS, the status strip along the bottom edge.
- Active views and sections: WORKSPACE (Home, History, Profiles, Context) and,
  in the sheet, APP (General, Hotkeys, Notes & Meetings) -- AI (AI Models,
  Agents, Integrations) -- SYSTEM (Delivery & Insert, Privacy & Data,
  Diagnostics, About & Updates). Fourteen flat areas became four views and ten
  sections; the longest list anybody scans dropped from 14 to 4.
- **What is wired, as of 2026-08-10: ten of the fourteen mounted surfaces.**
  The shell reads the runtime — the status strip states the session status, the
  lane and the delivery target; the profile row switches the active profile and
  refuses during a session because the runtime does; the overlay's deep link
  resolves. **Fully wired:** About & Updates, Diagnostics, General, Delivery &
  Insert, Hotkeys, History, Privacy & Data. **Wired in part, each stating on
  itself exactly what it cannot read:** Profiles (no drawn editor behind Add,
  Edit and New profile), AI Models (one integrated lane of four), Home (two of
  the decision inbox's three sources have no receiver). **Not wireable at all**,
  and carrying a banner for that reason rather than for a missing commit:
  Context (V2), Notes & Meetings (V2), Agents (Phase 8, ADR 0030), Integrations
  (Phase 8).
- **Every transcript is a Markdown file** under `~/WordScript/transcripts`
  (ADR 0074), written at the moment its record is, with the frontmatter §11.23
  specifies. `history.json` stays the index and carries the path; Delete, Clear
  and the retention sweep take the file with the entry, and the runtime removes
  only paths an entry named. The filename is a title the chat model writes
  (ADR 0077), falling back to the first words when no model answers.
  `Show transcripts in file manager` acts on History, on Home and in the
  palette.
- **Full export, Full import and Reset all settings act** (`core::backup`). The
  archive is the config, the history index and the transcript files; import and
  reset copy the config aside first and answer with where it went. The API key
  is never in an archive — it is in the OS secret store.
- **Home's decision inbox receives a fallen-back delivery** and draws nothing
  when nothing is owed (ADR 0076). The desk and a meeting's open questions still
  have no receiver.
- **The colour scheme survives a restart** (`AppConfig.color_scheme`, light /
  dark / system). It is machine-wide rather than per profile, and `system` is a
  deferral resolved at render time, so `<html data-theme>` always carries
  `light` or `dark` (ADR 0048). Since Leg 6 the HOST answers `system` and the
  native window chrome follows the choice (§15.3). The command palette's three
  theme rows write it;
  before 2026-08-10 they changed the window and persisted nothing.
- **A control the runtime cannot answer for is drawn and inert rather than
  deleted** (ADR 0065, ADR 0067): three of four provider lanes, seven of eight
  provider chips, the profile-list editors, and every per-job model override.
  Every one carries its reason. **Four things left that list on 2026-08-10.**
  Translate is a mode you can select, bind and run (ADR 0041, ADR 0071), so the
  two controls naming its absence act. `Show transcripts in file manager` acts,
  on all three surfaces it is drawn on, because the file it reveals now exists
  (ADR 0074). Full export, Full import and Reset all settings act
  (`core::backup`). In every case the reason was deleted in the commit that made
  it false. The one reveal that stays inert is on a record that produced no
  text: there is no file, and the control says so. The fourteen pre-port areas were deleted in the commit that
  replaced them (ADR 0054), and the runtime behaviour they carried is now back
  on the ported screens.
- Settings IA restructuring (2026-06-21, superseded 2026-08-05): the pre-port
  tab structure was audited for redundancy and findability and re-ordered.
  Recorded here because the consolidations survived the port -- one recovery
  surface, one history surface, Overlay extracted from Input, About slimmed to
  version plus release path -- while the areas that carried them did not.
- **The settings rework is a port in progress. The shell, the wiring and the two
  missing surfaces have landed; the runtime contracts have not.** What exists is the productive component library
  (`src/components/shell/`, `src/styles/shell.css`) ported 1:1 from the
  settings-rework prototype, the 25 screens built on it in `src/screens/`, one
  design-time route `/gallery` where they are displayed and judged (ADR 0055),
  and — as of 2026-08-05 — the product shell that mounts fourteen of them. A
  screen is *ported* when it stands in the gallery and *shipped* when it is
  wired; **all 25 are ported** as of 2026-08-04, each verified by computed-style
  diff against the running prototype in every state it has (`npm run
  port:diff`), and as of 2026-08-10 **every screen that can be wired is**. The
  two surfaces the port never carried landed the same day — the search field
  with the command palette behind it, and Help (ADR 0069) — together with the
  communication style, which had been running in the runtime with no surface
  anywhere (ADR 0068). What is left is the runtime contracts and four features
  that do not exist yet. With the last screen standing, the
  prototype turned from source into provenance (ADR 0057) and the gallery is the
  source. The wiring and the runtime contracts are later legs — see
  `docs/handoffs/HANDOFF_gui-port-relay.md` for what is done and what is next,
  including the list of facts the drawn screens state that the runtime cannot
  yet answer, and the six surfaces whose behaviour nobody has decided.

## Implemented core features

- recording limits that agree with what the pipeline can do (ADR 0038): a
  processing limit resolved per provider, account plan and model; an auto-stop
  the user sets under it with a recommended safety margin; and the silence stop
  as the separate thing it always was. The overlay states the auto-stop at the
  start of a recording and again with two minutes and thirty seconds left, and
  the tab opens the control that sets it. Providers declare their own limits and
  account plans, so a new lane is a declaration rather than a new branch
- recoverable transcription failures keep their recording (ADR 0039): a timeout
  no longer destroys the capture, the history entry points at it, and both the
  overlay error surface and the history list retry by re-transcribing it. Kept
  recordings are swept after seven days or twenty files
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
- explicit processing modes (`auto`, `cleanup`, `rewrite`, `translate`,
  `agent`, `prompt_enhance`, `verbatim`) with `mode_router` resolution from manual
  override and profile work-mode; `auto` is resolved per transcription via
  `resolve_auto_mode` (agent name + imperative -> agent; imperative + IDE
  context -> prompt_enhance; else cleanup); the renderer queries the
  effective mode via `resolve_current_processing_mode`; overlay side label
  and profile dock show the active mode. `translate` owns its own prompt in
  `core::translate` rather than a flag on the correction prompt, is never
  auto-selected, carries no communication style, and takes four settings -- the
  target language and the profile-words switch per profile on
  `Profiles -> Defaults`, the same-language behaviour and the address form per
  machine on AI Models (ADR 0041, ADR 0071, ADR 0072). It ships ahead of its
  roadmap phase and therefore on the chat model. The overlay states its target
  language as a two-letter chip and steps it on press (ADR 0073)
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
- no switches for AI cleanup, filler filter or rewrite phrasing: the processing
  mode is the only transform axis and each mode is a fixed preset (ADR 0020).
  The legacy globals remain only as migration input for configs predating
  per-profile modes
- a dedicated Modes tab in settings exposing the active mode, sub-mode,
  prompt target, the workspace-context switch and eight mode shortcuts
  (one picker/cycler plus seven direct modes) with platform-specific defaults.
  Translate's slot ships empty and is the only one that does: `Alt+1` through
  `Alt+6` are taken, so the seventh mode takes none rather than `Alt+7`
  (ADR 0041)
- the agent name, shown in every mode rather than only while Agent is selected,
  because it is also the first criterion Auto routes on (ADR 0023)
- a per-profile communication style read by Agent and Rewrite: register, length,
  the user's own rules and a writing sample. The register sets form only —
  slang and youth language come from the two user fields, never from the model,
  with an opt-in dated starter lexicon in four languages. Default is off, at
  which every prompt is unchanged. **Verified by shape, not by output**: the
  prompt assertions and the parity test are green, but the provider-backed
  replay that ADR 0021 established for correction-prompt changes has not been
  run, and two changes here touch that path — the English translation and the
  styled-Rewrite arm

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
  fragments, fantasy tokens and topic drift. This gap gains a second site once
  Phase 8 exists: a bridge session takes its profile from the target rather than
  from the focused application (ADR 0030), so profile quality then decides how
  well a spoken answer to an agent is transcribed as well
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
  transcription, and which terms additionally reach the prompt is decided by the
  runtime (ADR 0035) rather than by the per-entry toggle this originally
  shipped with. Dictionary terms left the prompt entirely. The Profiles tab is
  three panels (Vocabulary, Replacements, Snippets) instead of four
- the vocabulary list fills itself (ADR 0035). `core::vocabulary_learning` reads
  the correction stage's own output -- raw transcript against delivered text --
  and records a term when a replacement looks like a misrecognized name rather
  than a rewording. Two sightings in two deliveries promote it into the profile;
  a hand correction in the overlay promotes on sight. Candidates live in
  `vocabulary-candidates.json` beside the history file, promotion writes through
  the config file lock, and a tab slides out of the overlay pill's left edge for
  1.9s naming the term. That tab animates `width` rather than `transform` or
  `opacity` (both composited, both the ghosting path), never calls `set_size`,
  and falls back to a marker dot where the term does not fit rather than
  truncating it. Failures are logged and swallowed -- learning runs after the
  insert and never fails a delivery
- the recognizer's few slots are allocated by the runtime, shortest term first
  and then by observation count, because the intuitive allocation is
  systematically backwards: it spends every slot on the long terms deterministic
  repair already recovers. `use_as_prompt_hint` is a migration remnant read by
  nothing. Words & names is a display -- origin, repair count and whether the
  recognizer carries it, all resolved from the runtime's analysis rather than
  recomputed in React (ADR 0034 rule, ADR 0035 content). Manual add and remove
  stay
- correctness holds without a configured profile (ADR 0036). Two mechanisms
  aimed at correctness -- the replacement dictionary and the vocabulary -- are
  opt-in personalization, and between them there was no floor. The recognizer
  now always receives `BLANK_STATE_RECOGNIZER_PROMPT`, a constant register line
  with no profile content in it, instead of no initial prompt at all; it applies
  to both lanes, passes the same budget and truncation as any other prompt, is
  shown in the recognizer preview, and never overrules `bias_mode=off` or
  `local_prompt_strength=off`. Whether it reduces recognizer hallucination is
  not measured -- it is the documented mitigation for a documented failure mode
- `spelled_letter_merge_reverted` is the fifth guardrail in
  `normalize_correction` and the only one that repairs instead of discarding:
  where the original holds a run of at least three isolated single letters, a
  correction may not fuse them into a token the original does not contain. Gated
  on a measurement fixed in advance -- `classify_invented_tokens` over 197
  shipped raw/output pairs, 12 verified real (6.1 %). Two of the three observed
  categories stay open and no rule that only sees the transcript reaches them;
  see `docs/known-issues/cleanup-invents-tokens-on-broken-input.md`
- `TextProfile.schema_version` is 4 and migrates existing profiles once on load:
  the `stt_hints` blob becomes `vocabulary_hints` entries, rejected lines are
  logged rather than lost, and the version-4 step rewrites no entry, so a
  learned term is never relabelled as hand-typed
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
- **a capture can record only part of what was said, and the cause is still not
  located.** Re-measured 2026-08-10 over 634 paired captures: **11 kept between
  45% and 88% of their wall-clock duration**, three of them new since the first
  measurement, and the worst — 54.6% of a 214 s dictation — is the most recent.
  No stream error, no rebuild and no device change in the log. Ruled out as a
  pause artifact and as a webview stall. **Since ADR 0079 the capture says so**
  rather than delivering a transcript of what was recorded as if complete: the
  runtime log on every capture, an `Audio missing` badge and a sentence on the
  history record, and a tab beside the result pill at delivery time. Verified in
  the native host the same evening — five records carry `intact` verdicts in the
  0.1–3.0% band. **Since ADR 0083 every capture also reports the cadence of its
  own input stream**: the number of cpal callbacks, every stretch over 200 ms in
  which none arrived, and the sample count of the callback that ended it — which
  is what separates a suspended stream from callback starvation from a late
  delivery, and the line names which. Re-run 2026-08-11: still exactly 11 short
  captures, nothing moved, and **no real gap has been recorded yet**, so the
  instrumentation has a hypothesis rather than a cause. The journal carries no
  PipeWire line inside the worst window and memory pressure there was inside the
  healthy band, both on n = 1:
  [known-issues/capture-loses-half-the-recording.md](known-issues/capture-loses-half-the-recording.md)
- **the recogniser echoes WordScript's own initial prompt into the transcript**,
  and one such sentence reached an agent as an instruction on 2026-08-10.
  12.5% of raw transcripts carried prompt text and 6.6% were delivered still
  carrying it. Removed from the delivery since ADR 0080 by a deterministic strip
  against the prompt the request itself sent; the recogniser still produces it,
  the displaced words are still gone, and `raw_transcript` deliberately keeps
  the leak so the rate stays measurable:
  [known-issues/stt-prompt-leaks-into-the-transcript.md](known-issues/stt-prompt-leaks-into-the-transcript.md)
- **the correlation that would join the transcription cluster together is still
  not answerable, and the reason has changed.** Whether a short capture also
  produces more mishearings needs the capture numbers and the transcript in one
  place. On 2026-08-10 the join worked (136 of 136 paired) but 9 of the 11 short
  captures had outlived their transcripts — a retention artifact. ADR 0079 put
  the verdict on the record so no join is needed; on 2026-08-11 **7 of 138
  records answer for themselves and every one is `intact`**, so the blocker is
  now simply that no short capture has been recorded since. Both are population
  facts, neither is a result, and an empty group is not evidence that short
  captures are clean. The same holds for the cleanup invention rate split by
  `capture_integrity`, implemented 2026-08-11 and equally empty on one side:
  [known-issues/transcription-accuracy.md](known-issues/transcription-accuracy.md)
- **the input level is on the record since ADR 0083**, peak and mean, which is
  what separates "the recogniser is wrong" from "the microphone is quiet". The
  mean is the half that was missing: a peak is set by one sample, so a cough
  sets it as well as speech does. Reported, not acted on — the `too_quiet`
  verdict still reads the peak its thresholds were derived against
- **the first genuine mishearing is in the corpus** (2026-08-11): the owner said
  `tmux`, the recogniser produced `D-Max`, and `overlay_edit` on the record makes
  his own retyped word the ground truth. Neither of the two identified causes,
  which is what the accuracy record had been missing. One instance is not a rate:
  [known-issues/transcription-accuracy.md](known-issues/transcription-accuracy.md)
- the recording overlay is reported to freeze mid-capture at irregular
  intervals — pill, seconds timer and all input at once. As of 2026-08-03 the
  freeze is attributed: the pill stops because the capture stream stopped
  delivering samples (previous entry), which is correct behavior for the overlay.
  The main-thread hypotheses are dead — `[ov-beat]` stays empty across every
  measured capture while the other `[ov-*]` diagnostics log normally, and no emit
  has ever failed. What stays open is the residual signature alone: hover, click
  and drag dying while a *live* stream runs, which no measurement has reproduced:
  [known-issues/overlay-recording-freeze.md](known-issues/overlay-recording-freeze.md)
- the overlay is still placed where no monitor is, on a build carrying the
  ADR 0022 fix. The rescue works and fires — 65 of 503 reveals in 82.9 hours
  found an already-visible window on no work area — but it repairs rather than
  prevents, and until the next reveal the user has no overlay. The mid-session
  check meant to cover a long recording fired **zero** times, because it runs
  only during an active native capture while every observed case happened with
  the pill visible and idle. Separately, all 482 park moves landed somewhere
  other than requested (parking works through `hide()` alone) and 31 of them on
  the measured dead-zone corner, which is the leading candidate for the cause:
  [known-issues/overlay-stranded-off-screen.md](known-issues/overlay-stranded-off-screen.md)
- a dictated instruction to one addressee can arrive addressed to several:
  `fix das bitte` ships as `fixt das bitte`. The output is well-formed German, so
  nothing marks it as damaged, and in an AI coding assistant the reader cannot
  detect the change. Located on the recognizer, not on cleanup — in all 3 cases
  found across 167 records the plural already stands in the raw transcript — but
  not scoped:
  [known-issues/singular-address-becomes-plural.md](known-issues/singular-address-becomes-plural.md)
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
  information architecture is sound; the presentation is not, and the profile
  panels only became coherent enough to redesign against once the bias policy
  was retired (ADR 0017). Also Phase 7.
  **Correction (2026-07-30):** this entry previously claimed that "cleanup
  settings, processing modes and workspace context all resolve per profile",
  verified in the native host on 2026-07-29. Only the processing mode did.
  The three cleanup toggles were never read -- `effective_filter_fillers` and
  `effective_professionalize` took the stored value and discarded it, and the
  per-profile fields were dereferenced nowhere in the runtime -- and the
  workspace-context toggle wrote a per-profile value the runtime never read,
  because it took the global field instead. Both are fixed and the dead toggles
  are removed (ADR 0020). What the 2026-07-29 check actually established was
  that the *mode* resolves per profile; it could not have distinguished the rest,
  since a toggle that is ignored looks identical to one that agrees with the
  mode-derived default
- overlay monitor restore with identity-miss rederivation is implemented
  (manual mode rederives the target monitor from saved coordinates against
  all work areas; primary is only the last fallback)
- an overlay that ends up on no monitor at all recovers **on the next reveal**:
  the reposition gate is no longer limited to hidden→visible (ADR 0022), and the
  drag-snap protection is unchanged for any position that is actually visible.
  The 2 s recheck in the capture monitor loop is implemented but has never fired
  in 82.9 measured hours, because it runs only during an active native capture
  and the observed strandings all happen with the pill visible and idle — so
  between a stranding and the next reveal there is no overlay on screen. Neither
  path prevents the stranding; see
  [known-issues/overlay-stranded-off-screen.md](known-issues/overlay-stranded-off-screen.md)
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
topics like notes, search, sync or assistant scope. These stay downstream until
WordScript has become a more personal and trustworthy daily dictation product.
MCP is no longer part of that block: as a server it is scheduled work (ROADMAP
Phase 8, ADR 0029/0030), while as a client inside the dictation path it is
rejected permanently rather than deferred.

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
