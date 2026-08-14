# WordScript -- Status

Status: 2026-08-14

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
- **The sidebar has two widths as of 2026-08-11** (ADR 0111): 232 px, or a
  56 px rail of icons. Its toggle sits at the top of the column in both states
  and the choice is remembered in `AppConfig.workspace_nav_rail`; a window
  narrower than 760 CSS px rails on its own and does not write that down. Every
  responsive rule in the shell is an `@container ws-column` query against the
  column the content is drawn in, which is the window minus a sidebar of one of
  two widths — three tiers, at 620 px and 460 px. This is the answer to
  ADR 0104's closing finding that the workspace had no width breakpoint at all.
- Active views and sections: WORKSPACE (Home, History, Profiles, Context) and,
  in the sheet, APP (General, Hotkeys, Notes & Meetings) -- AI (AI Models,
  Agents, Integrations) -- SYSTEM (Delivery & Insert, Privacy & Data,
  Diagnostics, About & Updates). Fourteen flat areas became four views and ten
  sections; the longest list anybody scans dropped from 14 to 4.
- **What is wired, as of 2026-08-11: ten of the fourteen mounted surfaces.**
  The shell reads the runtime — the status strip states the session status, the
  lane and the delivery target; the profile row switches the active profile and
  refuses during a session because the runtime does; the overlay's deep link
  resolves. **Fully wired:** About & Updates, Diagnostics, General, Delivery &
  Insert, Hotkeys, History, Privacy & Data, **Profiles**. **Wired in part, each
  stating on itself exactly what it cannot read:** AI Models (one integrated
  lane of four), Home (two of the decision inbox's three sources have no
  receiver). **Not wireable at all**, and carrying a banner for that reason
  rather than for a missing commit: Context (V2), Notes & Meetings (V2), Agents
  (Phase 8, ADR 0030), Integrations (Phase 8).
- **The profile health flag acts, and Profiles lost its banner with it**
  (ADR 0085, 2026-08-11). The click had no destination because the four flag
  kinds point at three tabs, so it opens the flags themselves: one row per flag
  with its sentence and the door to the tab holding its cause — Context,
  Replacements, or **Defaults** for `bias_policy_weak`, whose only settable half
  is the processing mode. Each row acknowledges, through a per-profile set the
  runtime has read since before the port and nothing had written since Leg 3
  deleted `PromptsTab.tsx`; the flag carries the resulting `level` as its tone.
  An acknowledged flag stays in the list and in the count, because it is still
  true — it just stops colouring the profile.
- **AI Models names the model call nobody could see** (ADR 0088, 2026-08-11).
  ADR 0077 spends a chat-model call on every dictation to title the transcript
  file, and no surface said so. Titles is now a row in the Writing group that
  states which model runs it — the assistant's, via `chat_model_for_provider` —
  and offers no setting, because there is none. It does not open: a `<details>`
  onto an empty body is the affordance that opens nothing. It is the one row on
  that list which runs a model without setting one.
- **Six registered commands with no caller were removed** (ADR 0089,
  2026-08-11). A sweep of the `invoke_handler` list against every `invoke(` in
  `src/` found fourteen, not the two the leg was sent for, and they triage by
  why they lost a caller rather than by whether they have one. Gone: both
  `*acknowledge_profile_health_flag` (the config seam does that write and these
  could not emit `ready`), `get_workspace_context`, `app_config_file_path`, and
  both overlay resize commands — the dynamic sizing path this codebase
  abandoned, whose return is the ghosting in `known-issues/overlay-ghosting.md`.
  Kept and listed instead of deleted: `preview_prompt_enhance` (ADR 0065 defers
  it), the text-rules import/export pair (a capability the port dropped), and
  the session command shells the Rust trigger path drives directly.
- **The sweep that found fourteen had missed three** (ADR 0093, 2026-08-11).
  `read_diag_log`, `clear_diag_log` and `overlay_open_devtools` lost their caller
  in the same commit as the text rules — `8f9077e` deleted `OverlayDiagPanel.tsx`
  — and were invisible to the sweep because their names survive as `case` arms in
  `OverlayWindow.test.tsx`'s invoke mock, so a name-grep finds them and a
  call-grep does not. `append_diag_log` still has a live caller, so the overlay
  writes `/tmp/kilo/overlay-diag.log` in dev builds and **no surface can read
  it**; read it with `tail -f`. Nothing deleted: the devtools door has no shell
  substitute and the other two do. The disposition is open.
- **The copy budget was measured for the first time** (ADR 0092, 2026-08-11).
  One line on a row holds between **12 and 73 characters** depending on the
  control beside it, not the `≤ 90` four documents asserted. Three port-authored
  rows on `General` and `About` were printing the runtime text their own control
  displays; the prototype's own two-line rows are the drawing's norm and are
  untouched. `docs/DESIGN_SYSTEM.md` carries the measured table.
- **Profiles can be edited, not only read** (ADR 0082, 2026-08-11). Add and Edit
  on Replacements and Snippets, rename, duplicate and delete a profile, and both
  calls to `analyze_text_rules` all open a panel that unfolds under the row or
  card they act on — the five controls that had been drawn and inert since
  Leg 4c. Both rule lists reorder, because the runtime folds one entry's output
  into the next. **One shape per job across both pane screens:** adding is `+`
  in the list head, a row's actions are a right-click, and deleting always asks
  at the row. Context's rail carries the same gesture, drawn only.
- **Every transcript is a Markdown file** under `~/WordScript/transcripts`
  (ADR 0074), written at the moment its record is, with the frontmatter §11.23
  specifies. `history.json` stays the index and carries the path; Delete, Clear
  and the retention sweep take the file with the entry, and the runtime removes
  only paths an entry named. The filename is a title the chat model writes
  (ADR 0077), falling back to the first words when no model answers — on every
  processing mode including Verbatim, which the owner ruled deliberate on
  2026-08-11 (ADR 0087). Since 2026-08-11 the frontmatter is complete: the last
  key with no source, `duration_ms`, is the capture's `recorded_seconds`
  (ADR 0086), and is absent rather than zero on a retry, an upload and every
  record older than the measurement. `Show transcripts in file manager` acts on
  History, on Home and in the palette.
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
  deleted** (ADR 0065, ADR 0067): three of four provider lanes, **five of seven
  Cloud provider chips** (Groq and OpenAI can be picked since D1, 2026-08-12),
  the profile-list editors, and every per-job model override.
  Every one carries its reason. **The per-job PROVIDER override left this list
  on 2026-08-12** (B6, ADR 0128) and the model override did not — the provider
  a job runs on is stored and writable, what model it runs there is still
  drawing. **A vendor with no adapter stays on the list deliberately**: it is
  offered, disabled and carries its reason, because an inherited drawing is the
  inventory of what the product still owes.
  **Four things left that list on 2026-08-10.**
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
  port:diff`), and as of 2026-08-10 **every screen that can be wired is**. A
  wired screen then RETIRES from the gallery and stops being measured (ADR 0057),
  so the diff shrinks as the product grows: **25 measurements as of 2026-08-11,
  24 of them at structural 0 | style 0**, `profiles` having left with its
  banner. The one recorded departure is `models` at **structural 6 | style 6**,
  which is the Titles row (ADR 0088) — a deliberate addition to the drawing, in
  its own commit with its own before-and-after. The
  two surfaces the port never carried landed the same day — the search field
  with the command palette behind it, and Help (ADR 0069) — together with the
  communication style, which had been running in the runtime with no surface
  anywhere (ADR 0068). What is left is the runtime contracts and four features
  that do not exist yet. With the last screen standing, the
  prototype turned from source into provenance (ADR 0057) and the gallery is the
  source. The wiring and the runtime contracts are later legs — see
  `docs/tracks/gui-port-relay.md` for what is done and what is next,
  including the list of facts the drawn screens state that the runtime cannot
  yet answer, and the six surfaces whose behaviour nobody has decided.

## Implemented core features

- a provider contract that is three role traits over one registry (ADR 0094,
  2026-08-11): `core/providers/registry.rs` holds `Provider`, `SpeechProvider`,
  `ChatProvider` and `VoiceProvider`, an entry names an id and the
  implementations behind it, and the eight capability functions resolve an entry
  rather than match an enum. Adding a provider is a module plus an entry, and a
  provider that cannot serve a role does not implement it — `VoiceProvider` is
  declared and implemented by nobody, because nothing in this runtime speaks. It
  registered no new adapter and changed no behaviour: 740 Rust tests and 474
  frontend tests unchanged
- capability answers on two axes (ADR 0110, 2026-08-11): *which roles does this
  vendor serve* is the provider's question and now carries `speech_synthesis`
  beside transcription and chat; *does this model stream, does it name the
  language it heard, does its voice stream* is the model's, answered per
  `(provider, model)` and never from a provider alone. Each model field is
  `supported`, `unsupported` or **`unknown`**, because one drawn lane's model
  list belongs to the vendor and a capability nobody has looked up is not a
  capability that is absent. A registry test holds every entry's role claims to
  the implementations it registered, so no lane can state a voice it has none
  for. **The model axis stopped being vacuous on 2026-08-12** (D1): Groq's
  speech endpoint takes a file and returns a result and the local lane echoes
  back the language it was told, so both answer `unsupported` everywhere — but
  OpenAI answers `supported` for `gpt-4o-transcribe` and `unsupported` for
  `whisper-1` on one key at one URL, which is the pair ADR 0110 was written
  from. **The provider axis is read by `AI Models` since 2026-08-12**
  (ADR 0106, ADR 0124); the model axis is answered by the runtime and still read
  by no drawn row
- the capability seam between the drawing and the runtime (ADR 0106 and
  ADR 0124, 2026-08-12): `AI Models` asks the runtime whether a drawn row can be
  operated instead of reading the hand-maintained `PROVIDERS` table for it, and
  **a row that cannot says which of four things stopped it** — no adapter
  exists, the lane denies that role, the role has no credential, or the answer
  came back incomplete. `registered_providers()` answers for the whole registry
  in one call and reads no credential, so **a vendor's absence from that list is
  how *no adapter* is stated**; the alternative was ten `provider_status` calls
  and ten secret-store reads for a screen that merely opened. The drawn table
  stays the drawing. ADR 0094's first draft called the TypeScript mirror the
  guard that stops a surface over-claiming and ADR 0106 corrected it; **the
  guard exists now and is two tests**, both made to fail before they were
  trusted
- a credential resolved per `(provider, role)` (ADR 0105 and ADR 0102's storage
  half, 2026-08-11): the secret-store entry is keyed `(provider, role, kind)`,
  so **clearing the chat credential leaves the speech one standing**, and a role
  with no credential says which one it is missing instead of spending another
  role's. A save that names no role reaches every role the kind can pay for —
  the one drawn key row sits on the connection, and a key is a way into an
  account rather than into a job — while a subscription is filtered out of that
  fan-out for every role but chat, in the type. `provider_status` answers per
  role and folds the answers into the one connection block conservatively:
  configured means every role has one. The single key a previous build stored is
  adopted onto both of Groq's roles on first read, and the config migration
  copies the file aside first. **No vendor accepts a subscription yet** — a
  registry test holds that kind to OpenAI, and that vendor's adapter refuses one
  at the door because D3 has not built the sign-in that acquires it
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
- Groq and OpenAI BYOK with OS secret-store storage, one entry per
  `(provider, role, kind)`, and a connection the user picks on `AI Models`
  (ADR 0126, ADR 0127, 2026-08-12). OpenAI serves recognition and chat; the
  transport and the credential store behind both cloud lanes are one
  implementation and every vendor policy is the adapter's own
- `local` as a full local runtime lane over external `whisper-cli`,
  local ggml models and local Ollama cleanup (STT plus cleanup, not STT-only)
- AI Models preflight for the local runtime lane with native runner,
  STT-model, cleanup-endpoint and cleanup-model readiness
- bounded STT prompt bias for Groq and `local` from active profile
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
- Profiles shows this conservative bias contract and warns when profile or
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
- profile rule validation, preview and conflict handling on Profiles.
  Import and export lost their caller to Leg 3's shell overwrite and had a
  complete runtime reachable from nothing for six legs (ADR 0089); **both have a
  surface again since 2026-08-11** — `Export rules` on the profile's row menu,
  import on Privacy & Data as a new profile (ADR 0090). The full backup is still
  a different artifact, not a replacement
- profile health and bias policy: automatic detection of systemic behavioral
  distortion in a profile (length bias in dictionary, contradictory style
  instructions, cleanup-suppressing prompt patterns) with a traffic-light
  display on Profiles and a dot in the profile dock; a flag opens a panel
  listing every flag with a door to the tab that holds its cause (ADR 0085).
  **Acknowledging a flag DOES change config** — it writes the persistent
  `profile_health_acknowledged_flags` map through the config seam, and until
  Leg 8 nothing wrote it at all, so `derive_health_level` was computing a level
  from a set no surface could reach
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
- scratchpad recovery in Delivery & Insert, diagnostic preview transcripts in
  Diagnostics and the persistent history store are three separate native data
  surfaces
- overlay, Delivery & Insert and Diagnostics read the same native platform
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

- **the config still carries compatibility with shapes nothing writes**, and the
  decision to stop is recorded rather than done (ADR 0112, plan stage A5). A
  legacy plaintext key field, millisecond timeout fields, a global `auto_paste`,
  two schema gates with their migration bodies, a pre-profile text-rules reader
  and two retired secret-store entry names all serve a case that exists on one
  developer machine, because **no published versioned release exists**. The
  record separates them from the three things that look identical and stay --
  normalization, tolerance at a boundary where something foreign arrives, and a
  name that says *legacy* about a state rather than a format
- **the speech stack is one lane wide, and that lane cannot stream.** Groq is
  the only integrated cloud provider and its recognition path takes a file and
  returns a result -- no websocket, no partials, no automatic language
  detection. `local` exists beside it and shells out to `whisper-cli`,
  which also takes a file. The capability survey is `docs/PROVIDERS.md`
  (2026-08-11); the decision to build the rest out is ADR 0096. **Nothing of
  that build-out is implemented**, and until an adapter lands the surface keeps
  saying so
- **there is no speech synthesis anywhere in the runtime**, no output-device
  enumeration, and one output stream bound to the OS default (ADR 0010). Three
  drawn surfaces depend on all three -- the translation window, the agent
  window's voice and its notification cue. ADR 0097 records the shape; nothing
  is built. **And until 2026-08-11 the role had no contract either**:
  `VoiceProvider` carried zero methods, so every synthesis vendor was
  unexpressible rather than merely unimplemented. ADR 0114 writes that contract
  from fourteen surveyed candidates -- one method, `synthesize_speech`, with
  streaming grown beside it later. Designed; still not built, and the method
  lands with its first implementation rather than ahead of it
- **the cue output stream is held open, and that is why sound cues stick to one
  device** (found 2026-08-14, reported as "the sound is gone"). The cues were
  playing at full volume into the HDMI monitor while the owner listened on the
  Bluetooth default -- nothing muted, nothing corked. A permanently open stream
  acquires an output device at process start and keeps it, and PipeWire's
  `module-stream-restore` re-applies that route on every restart, so the symptom
  appears after a restart rather than at a device switch. The HDMI sink was
  `RUNNING` with WordScript as its only stream: this app holds a device awake
  for nothing, and moving the stream to Bluetooth would keep *that* device awake
  instead. A stream opened per cue is routed when it plays and could not have
  this symptom. The same lifecycle question is owed by the speech track's second
  output stream (F2), so it should be decided once:
  [known-issues/sound-output-underruns-and-reopens.md](known-issues/sound-output-underruns-and-reopens.md)
- **the machine cannot speak while listening without hearing itself.** ADR 0098
  records the third capture state that would fix it, and the finding that the
  existing `muted` flag is a *level* mute and does not stop recording. Echo
  cancellation is a separate component that also does not exist (ADR 0063)
- **four drawn windows have no runtime host.** Three windows are declared
  statically and there is no `WebviewWindowBuilder`; the translation pop-out,
  the meeting HUD, the agent window and ADR 0043's notification all wait on the
  window class ADR 0100 defines
- **a cloud credential is still only an API key, and now it is one per role.**
  ADR 0102 admits a second kind for OpenAI -- an OAuth token set against the
  user's ChatGPT plan -- for the five chat jobs only, because the backend it
  reaches serves no transcription and no synthesis. **The storage half is built
  and the acquisition half is not**: the kind exists in the type and is
  inadmissible for speech and voice by construction, but there is no OAuth flow,
  no PKCE, no loopback listener and no `tauri-plugin-oauth` in the tree, and a
  registry test holds the subscription kind to a vendor this build does not
  register. Speech stays billed per use on every vendor, and no other vendor
  gets a subscription path at all -- Anthropic and Google both forbade theirs in
  February 2026. What a second kind forces is done (ADR 0105); what pays for it
  is stage D3
- **the model axis is read by no surface; the provider axis now is.** Closed for
  `ProviderCapabilities` on 2026-08-12 by stage B1 (ADR 0106, ADR 0124):
  `AI Models` reads it, `Models.test.tsx` can no longer mock capabilities as
  `{}` and pass, and a drawn row states which of four things stops it being
  operated instead of one blanket sentence. ADR 0094's first draft called the
  mirror the guard that stops a surface over-claiming and ADR 0106 corrected
  that; the guard exists now and is two tests. **`ModelCapabilities` is still
  read nowhere** -- *will this row stream* is a model question no drawn row asks
  yet, and it arrives with the lane that streams (stage D2). The `PROVIDERS`
  table in `src/screens/data.ts` stays the drawing, and the three open
  disagreements `docs/PROVIDERS.md` runs against it stay open
- **the runtime announces no setting change.** `AppConfig::save_to_disk` writes
  and `save_config` returns to its caller; no event channel carries a config
  change. It has never mattered with one settings window, and ADR 0100's window
  class plus ADR 0097's machine-wide routing drawn inside a pop-out that may
  stand three times make it necessary. ADR 0108 records the shape; nothing is
  built
- **a turn cannot be cut out of a running capture.** `start_native_capture`
  couples the cpal stream to the recording, samples land in one buffer bounded
  by `max_samples`, and `stop_native_capture` takes it whole. A conversation is
  nothing but segments, so ADR 0107 separates the stream from the recording and
  makes a turn a recording -- keeping `CaptureIntegrity`, `capture_budget` and
  `transcribe_audio_file` applicable per turn unchanged. Planned; not built
- **`voice` is drawn and is not a job in the type.** `JobKey` carries eight
  entries and four records write contracts against a ninth. ADR 0109 adds it,
  and gates a voice adapter on a drawn row that can operate it -- the drawn
  `Speaking` row offers two presets, neither of them the vendor ADR 0096
  schedules second. **Widened 2026-08-11: it is two jobs, not one** (ADR 0119).
  `voice` for the desk and `translation_voice` for the conversation, because
  they pick different models -- and the drawn `Speaking` group has one row while
  `Translate.tsx` already sends the user there for a voice it does not carry.
  The drawing question that gated the adapter is answered; drawing the second
  row is not
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
  [tracks/activation-gestures.md](tracks/activation-gestures.md)
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
  captures, nothing moved. **The soak night ran 2026-08-12 and produced
  nothing**: 96 segments, 8.00 h of open stream, all `Intact` with `no_gaps`,
  against a rate that predicted about eight events. ADR 0084 registered that
  outcome in advance — the suspicion moves into the app, not away from the
  defect. **Then the defect occurred live on 2026-08-13 and the log held it
  whole** (`native-18`, 15.5 % missing, seven gaps of 202–366 ms), which
  answered Route B by ordinary use and changed the picture twice over: it
  **refutes the app-side delta ADR 0084 pointed at** — `slowest_emit_ms` is 0
  and 5 ms in two of the three detailed failures, so `app.emit` is fast while
  the audio disappears — and it shows **the instrument cannot see the cause it
  names**, because the cadence timestamps itself after taking the app's own
  mutex and prints `stream_suspended` regardless. Load and memory were re-tested
  against the new event and stay refuted (40.3 % free, with 90 healthy captures
  under equal or worse pressure). ADR 0133 fixes the instrument; the fix for the
  defect deliberately waits for one more event:
  [known-issues/capture-loses-half-the-recording.md](known-issues/capture-loses-half-the-recording.md)
- **the dev server rebuilt all three windows about 1,389 times in 2.5 days**,
  **fixed 2026-08-14** (runtime-ownership step 2): `server.watch.ignored` and
  `test.exclude` now read one `NON_SOURCE_DIRS` constant, which is what the
  duplication had made impossible. Measured on the running server: **20,393
  inotify watches before, 576 after**, with `src/` hot reload unchanged. Before
  that, `vite.config.ts` excluded `donors/**` and `vendor/**` only under
  `test.exclude`, which the dev server never reads — so it watched 36,000 files
  including 577 `tsconfig.json`/`package.json`, each one a forced full reload.
  That was the white GUI window and the vanishing overlay, and 33 captures had a
  reload inside them while recording. Dev-only, one edit away, and it reopened
  the overlay-freeze record: a reload destroys the heartbeat rather than
  delaying it, so every instrument here read it as silence:
  [known-issues/dev-server-reloads-the-app-mid-session.md](known-issues/dev-server-reloads-the-app-mid-session.md)
- **a finished dictation was discarded when its window did not come back**, and
  it was the most damaging open item on the product path. **The runtime finishes
  the session itself since 2026-08-14** (ADR 0134, runtime-ownership step 1):
  staging a `clipboard_only` preview arms a 10 s deadline that commits it —
  clipboard, history record, transcript file — through the same body a window
  commit takes, guarded so that a deadline armed for one staging can never
  commit another. The runtime log names the path that completed the session
  (`Native session completed path=frontend|deadline`), so deadline commits can
  be counted rather than inferred. **The native-host acceptance run passed the
  same evening, under the hardest available condition**: two dictations landed
  in the clipboard, in `history.json` and as Markdown files 10.0 s after their
  preview, in a run where the overlay rendered **no frames at all** — the
  overlay diagnostic log has zero lines for it. One half is still owed, a
  healthy session logging `path=frontend`, and the epoch guard has still never
  run in the wild. **What it left open** is one case ADR 0134 did not weigh: an edit that
  takes longer than ten seconds loses to the deadline and the unedited text is
  committed — coherently (the edit surface closes rather than erroring), but the
  in-progress correction is gone. The record below is the pre-fix statement of
  the defect. `CLAUDE.md` gives the
  runtime the insert; the runtime did not have it. Every insert call site is an
  `invoke` from `OverlayWindow.tsx`, and after `preview ready` there was no
  deadline and no fallback — while the clipboard write, the `history.json`
  record and the Markdown transcript are **all created inside that insert**. So
  a destroyed, frozen or stranded overlay did not hide the text, it stopped it
  from ever being written. Measured across 277 `clipboard_only` previews:
  **1.12 s median, 11.45–115.11 s in the 13 whose webview was destroyed
  mid-preview**, and one transcript lost outright to an application restart.
  With the deadline in, the three overlay mechanisms stop being data-loss bugs
  and stay surface bugs in their own records:
  [decisions/0134](decisions/0134-a-session-ends-in-the-runtime-not-in-the-window-that-shows-it.md)
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
- the AI stage can change who a sentence is addressed to (found 2026-08-13). A
  question dictated as *"wie genau würdest du das lösen"* was delivered as *"wie
  genau würde ich das lösen"* — six second-person forms and their agreement at
  once, on a correct raw transcript and an intact capture. The counterpart of the
  entry above on the other lane: there the recogniser damages the address, here
  the transform does. No guardrail sees it, because every one of them reads
  length, sentence start or word overlap, and a person flip moves none of the
  three. 1 in 200 records and no repair — the corpus carries the case and the
  same construction handled correctly two days earlier, which is deliberately not
  enough evidence for a rule:
  [known-issues/cleanup-flips-the-grammatical-person.md](known-issues/cleanup-flips-the-grammatical-person.md)
- a subtitle closing phrase can arrive attached to a real sentence and ship with
  it: *"Da hab ich hier drüber gesprochen Thank you"* was delivered unchanged
  (2026-08-13). The hallucination filters carry the words but not this shape —
  one tests the whole transcript as a single string, the other matches per
  sentence but its patterns are subtitle credits and music markers. Adding the
  words to a per-sentence list is not the fix: *Vielen Dank* is ordinary German
  and would be stripped out of a dictated sign-off. Addendum in
  [known-issues/transcription-hallucination.md](known-issues/transcription-hallucination.md)
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

**The phase list lives in [ROADMAP.md](./ROADMAP.md) and only there.** A second
copy stood here until 2026-08-12 and had drifted to six phases while the roadmap
carried nine — Phases 7, 8 and 9 were missing entirely, and the two closed
phases were the only rows still true.

What this file reports is the product state above: what is wired, what is drawn
and not wired, and what is open. Which phase a piece of that belongs to is the
roadmap's question.

**Which of it is being worked on right now** — three concurrent tracks, their
stages and what each owns — is
[IMPLEMENTATION.md](./IMPLEMENTATION.md).

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
