# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- Template for new releases:

## [X.Y.Z] - YYYY-MM-DD

### Added
- New features or capabilities

### Changed
- Changes to existing functionality

### Deprecated
- Features that will be removed in upcoming releases

### Removed
- Features removed in this release

### Fixed
- Bug fixes

### Security
- Security patches and vulnerability fixes

-->

## [Unreleased]

### Added

- **A communication style per profile**, in Settings -> Modes, read by Agent and
  Rewrite. A register — Authority, Client, Colleague, Friend, Quick message —
  plus a length, your own rules, and a sample of your own writing. The register
  is named after who you are writing to rather than by a formality adjective,
  because four adjectives from one semantic field cannot be told apart in a
  select.

  **The register sets form, never wording.** Formality and youth language are
  different dimensions, and a model's own slang is measurably misaligned with how
  people actually use it — wrong slang reads as parody, where none merely reads
  as plain. So Friend and Quick message carry an explicit ban on the agent
  supplying slang from its own memory or translating it from another language;
  the only sources are your rules and your writing sample. A dated starter
  lexicon (German, English, Spanish, French) can be loaded into your rules, where
  you can read and edit it — never into a hidden layer.

  Precedence is fixed and written into the prompt: preset, then your rules, then
  your sample, with the sample subordinate for form and authoritative for
  wording. Default is off, at which every prompt is byte-identical to before.
  See ADR 0023.

### Changed

- **Every prompt is now written in English**, whatever language you dictate in.
  English instructions are followed more reliably. Each prompt states explicitly
  that the *output* language is the dictated one, so this does not change what
  comes back — the agent prompt forbids answering in the language of its own
  instructions, and the German `um`-is-a-preposition guard is unchanged because
  it is about the dictated language, not the prompt's.

### Fixed

- **Agent mode writes the thing you asked for instead of answering you.**
  Reported from live use: "Hey WordScript, schreib eine E-Mail an Jürgen, er
  soll das und jenes machen" came back as "Ja, das sollte Jürgen auf jeden Fall
  machen … bis heute Abend um 8 Uhr" — a reply to the dictation, with a deadline
  nobody dictated.

  Every rule in the agent prompt was a negative one — no preamble, no invented
  facts, no profile content — and a conversational reply satisfies all of them.
  Nothing said what the output *is*, and nothing fixed the addressee, so with a
  transcript that is formally a message to an assistant the nearest addressee
  was the user. The prompt now opens with what it owes: the transcript is
  dictated speech and never a message to answer, the output is the artifact
  alone, the addressee is the person the instruction names, and an instruction
  that cannot be carried out comes back as plain text rather than a question.

  The Expansive length was the accelerant, not the cause: "spell out context and
  reasoning" is an invitation to narrate the task, and it now describes the
  result instead — develop the instruction's background and framing inside the
  result, never your own reasoning, never facts the instruction does not
  contain. That wording is shared with Rewrite, where it is the same defect
  under another name. See ADR 0026.

- **Three direction decisions are recorded; none of them is implemented.**
  Documentation only — no runtime behaviour changes with this entry, and the
  features below do not exist yet.

  **The mode formerly called `agent` carries out an instruction; it does not
  act** (ADR 0029). Text in, text out, one call, and no tool-calling surface —
  stated as a contract rather than left as a current limit, because "agent" now
  generally means something this mode deliberately is not. Side-effecting tools
  stay out of the dictation path: a tool loop has no single session end (ADR
  0018/0019), the delivery architecture presupposes a text result (ADR 0011a),
  and speech is a low-confidence channel that must not drive actions (ADR 0016).
  MCP splits into three questions — WordScript as a server is in scope, as a
  client in the dictation path is rejected, and as a vocabulary source is
  rejected as a distinct feature because it is the profile context with a remote
  origin. The mode will be **renamed to `draft`**, which says what comes out of
  it, and the name `Agents` goes to the settings area for coding agents; a
  config written by an older version keeps working. `docs/ROADMAP.md` and
  `docs/VISION.md` are corrected accordingly: they fenced MCP wholesale, which
  is now wrong in one direction.

  **Working with coding agents by voice is planned** (ADR 0030, ROADMAP Phase
  8): an agent asks you out loud when it needs a decision, and you start work by
  speaking instead of opening a repository. One configured orchestrator is the
  only party WordScript talks to — it drives the coding agents, answers what it
  can, and reaches you only for what it cannot. That is the whole point: an
  agent cannot judge what is worth interrupting a person for, and a voice channel
  without that filter would be worse than the terminal, because terminal output
  can be skimmed and speech cannot. The channel is built so a monologue cannot
  travel through it — one short spoken field, everything else silent in the
  thread. It shares capture and transcription and then returns the transcript to
  the caller rather than inserting it, so it is not a processing mode; the mode
  axis stays the transform axis (ADR 0020).

  That record was **revised on 2026-08-01**, before any of it was built, after
  every external claim in it was checked against primary sources. Two arguments
  turned out to rest on things that were not true — a client timeout that is
  documented nowhere and a specification change that never happened — and both
  were replaced; where a claim is only plausible, the word now appears. The
  revision also settles what the first version left open: the orchestrator may
  compose a question but returns your answer **verbatim**, because you can hear a
  wrongly put question and cannot see a wrongly relayed answer. Asking and waiting
  are split into two calls, so nothing ever blocks on a person. Everything
  configurable — model, permissions, profile — hangs on the target you set up
  once, so speech carries intent only and never configuration. Starting a run with
  write permissions is confirmed on screen with a key, never by voice. Questions
  are spoken one at a time, closed questions can be answered with one word, and a
  misheard answer is never forwarded to the agent as a guess. Voices are picked by
  how fast they start speaking rather than by price, and the measured value is
  shown to you. Bridge answers stay out of the transcript history and are not run
  through your text rules, which exist for text that lands in a document.

  **A voice nudge is planned as one shot on known text** (ADR 0031, ROADMAP
  Phase 9): revise what was just produced without dictating it again. The
  assumption going in was that conversational state was missing; no competitor
  ships multi-turn editing and one publicly retreated from it, so it is not
  built. Entry is explicit and never inferred, because inferring it is where
  shipped products break.

- **Switching the active profile during a recording is refused instead of
  half-applied.** The profile decides the recognizer settings, and those are
  committed the moment recording starts — but the pipeline resolved the profile
  again once the audio was ready. A mid-recording switch therefore produced a
  transform built from two profiles at once (label and terms from the new one,
  context and dictionary from the old) on top of a transcription that had
  already run under the old one. The runtime now refuses the switch, in both the
  explicit command and a settings save that would change it, and the switcher
  says why before you try.

  Alongside it, the agent name and the communication style moved into the
  capture snapshot, where the profile text and vocabulary already lived. One
  rule holds now: **during a recording only the processing mode still changes
  anything; everything else applies from the next recording.** Previously the
  agent name and style applied mid-recording while the profile text did not.
  See ADR 0025.

- **The processing mode in Settings and the mode on the overlay no longer drift
  apart.** Reported as: change the mode while recording and the overlay keeps
  showing the old one — sometimes. The "sometimes" was the clue. Two causes:

  A process-global runtime override was set by every mode-change path (overlay
  tap, mode hotkeys) and cleared by none — `clear_processing_mode_override` had
  no caller, because its only consumer was a hook nothing imported. It outranked
  the profile, so the first tap after a start pinned the mode for the rest of
  the process and every later change in Settings was resolved away. With no tap
  since launch it worked; after one tap it never did again. This was not only
  cosmetic: the pipeline reads the same resolver, so it also kept *processing*
  under the stale value.

  The override is gone. Every path that changes the mode already persists it to
  the profile, and the pipeline loads its config after the recording ends — so
  a mode changed mid-recording is on disk before it is read. The profile is now
  the only source.

  Second: saving in Settings emitted no mode signal at all, and the overlay's
  150 ms fetch guard *discarded* calls inside its window instead of deferring
  them, so a save landing in that window was lost with no retry. Every writer
  now emits `wordscript-mode-event`, and the guard coalesces to the last
  request. See ADR 0024.

- **Agent mode no longer writes profile context into what it generates.**
  Reported as: dictate "write an email to X, content Y" and the email comes back
  carrying material from the profile that was never dictated. Three causes in one
  prompt — only one of six context blocks carried any restriction, the system
  prompt actively said to "take the context into account" with nothing on the
  other side, and the whole block sat in the *user* turn one line above the
  instruction, where it was formally indistinguishable from it.

  The context stays, because it is what lets the agent spell your terms and names
  correctly. What changed is its job: it is a reading aid for the instruction, it
  moved into the system prompt behind an explicit prohibition on deriving content
  from it, and the user turn now carries the transcript and nothing else. Snippets
  contribute their trigger without their expansion — an expansion is finished text,
  and it was already applied deterministically at the end of the pipeline, so
  listing it was a second, generative path for the same data. See ADR 0023.

- **The agent name is visible in every mode.** It used to render only while Agent
  was the selected mode — but the name is also the first thing Auto routes on,
  and Auto is the default, so in the default configuration the field deciding
  whether Auto ever reaches Agent was not on screen. The name itself always
  worked; only the surface was missing. Its placeholder now shows the global
  fallback rather than a hardcoded "WordScript".

- **The overlay is no longer placed where no monitor is.** Reported as "the
  overlay becomes completely invisible mid-recording although the recording
  keeps running, and the stop hotkey brings it back". It was never a freeze:
  reveals only ever positioned the window on the hidden→visible transition, so a
  monitor topology change during a session left stale coordinates behind — and
  the union bounding box of a staggered multi-monitor layout has corners no
  monitor covers. Measured on the reporting machine: 18.3% of a 4320x1568 box is
  dark, and the overlay sat at (3840,1508), on nothing. Stop "fixed" it only
  because ending a session parks and hides the window, so the next reveal
  recomputed placement.

  A rectangle intersecting no monitor work area is now treated as a position the
  user cannot have chosen, and is corrected — on every reveal, and on a 2 s
  cadence inside the existing capture monitor loop, because a long recording
  produces no reveals at all. The drag-snap protection is unchanged for every
  position that is actually visible: the check uses intersection, so a pill
  hanging over an edge is left alone, and it reports nothing when no monitors
  can be enumerated (ADR 0022).

- **The end of a clipboard-only session no longer shows buttons that do
  nothing.** For 240 ms after a session ended, the leave hold replayed the
  preview surface from a snapshot with Copy, Edit and Abort wired to handlers
  that had already bailed on the nulled `pendingResult`. The buttons rendered
  fully enabled and correctly labelled, and did nothing — in `clipboard_only`,
  where that surface is the only route to the transcript, that reads as the app
  eating the dictation. The hold is now inert the way the edit-mode branch
  beside it already was, `handleEditOpen` got the guard it never had, and an
  absent handler renders the button disabled.

- **The overlay layer is visible in the runtime log.** Across 755 captures it
  previously carried zero lines about placement, park, monitor choice or work
  area, which is why a misplacement left nothing to read afterwards. Placement
  decisions, stranded-overlay rescues and parks (including the
  requested-vs-applied position, since X11/KWin clamps an off-screen park back
  onto the screen edge) are now recorded in every build.

- **The KWin overlay pin survives a screen change.** It was applied on
  `windowAdded` only, i.e. once per window lifetime, so an output
  reconfiguration silently dropped always-on-top for the rest of the session.

- **`cargo test` no longer writes into the developer's live data.**
  `core::paths::user_data_dir()` had no test seam and always resolved to the
  real `~/.config/WordScript`, so the suite appended its own lines to the real
  runtime log and wrote synthetic entries into the real history — corrupting
  exactly the evidence the runtime log exists to provide. Test builds are now
  diverted to a per-process temp directory, and a `WORDSCRIPT_DATA_DIR` override
  works in every build.

### Changed

- **Profile context now reaches every mode at the same width.** The same field,
  `TextProfile.prompt`, arrived in three different shapes: Cleanup and Rewrite
  pushed it through the *transcription* hint filter (a line survived only at ≤4
  words and with a capital, digit or punctuation in it), while Agent and Prompt
  Enhance took it raw, untruncated and uncapped. On the curated
  `Product and engineering` profile that meant 2 of 8 lines for Cleanup and all 8
  for Agent. The split was never decided — `git log -L` shows the filter arriving
  in `transform.rs` as a side effect of a commit about STT bias, two months
  before ADR 0017 documented the reasoning for the recognizer path it was
  actually built for. `core::profile_context` is now the single producer for all
  modes: normalized, deduplicated, 80 chars per line, and the block bounded by a
  600-character budget. The mode decides the framing — corrective for Cleanup and
  Rewrite, generative for Agent — never the width. The recognizer filter is
  untouched and stays recognizer-only (ADR 0021).

  Verified by replaying 96 real history transcripts twice through the production
  correction path (192 provider calls): widening Cleanup from 2 lines to 8 left
  74% of outputs identical, produced **zero** occurrences of the six previously
  dropped context lines, and did not increase divergence from the transcript.
  The change is safe and simplifying, not an improvement — recorded that way on
  purpose.

- **Agent's prompt is bounded.** Its dictionary, snippet and `stt_hints` blocks
  grew with the profile and had no cap; they now use the same limits as the
  correction prompt.

- **The context field is now called "Profile context", not "Transcription
  context".** The old name described the minority consumer: the field goes to
  every mode's transform prompt in full, and only a filtered subset reaches the
  recognizer. The card now shows how much of the 600-character budget the profile
  spends and names any line that exceeds it, because a bound the user cannot see
  is indistinguishable from a bug.

- **Two UI strings stopped overclaiming.** The Text Rules warning and the
  Profiles panel said broad context lines "are not forwarded automatically".
  That is true only of the recognizer, so both now say so and add that the lines
  still reach the transform prompt.

### Fixed

- **The recognizer preview showed an initial prompt the provider never
  received.** ADR 0017 made `use_as_prompt_hint` the single per-entry control
  over what reaches Whisper, and the capture path honours it
  (`prompt_hint_phrases`). The Settings panel did not: it sent the legacy
  `stt_hints` free-text field — which migration copies from but never clears —
  into `analyze_text_rules`. With every vocabulary toggle off, the panel
  displayed `Likely phrases: triage summary; release note; qa handoff; incident
  update` while the request carried no initial prompt at all, and flipping a
  toggle changed nothing on screen. `AnalyzeTextRulesRequest` now carries
  `vocabulary_hints` and the analysis derives the phrases the way the capture
  path does. Imported documents, which predate the per-entry opt-in, still fall
  back to the legacy field.

- **The Profiles tab stopped using three names for the same place.** The tab
  said "Vocabulary", its panel header said "Context & Preview", and the
  replacements card said "Personal dictionary" under a tab labelled
  "Replacements". Panel titles now match their tabs. "Step 1 of 4" is gone — the
  three lists are independent, not a sequence, and the fourth step it counted
  (Bias policy) stopped existing with ADR 0017. "Words & names" moved out of the
  "Profile context" card into its own, which is why the difference between a
  free-text topic list and a per-term recognizer opt-in was hard to see. A
  three-column note grid, a four-line paragraph on prompt length and a trailing
  note about team sharing were removed.

### Removed

- **The three "Cleanup settings" toggles, because none of them reached the
  runtime.** AI cleanup, Remove fillers and Rewrite phrasing sat in Settings ->
  Modes under a caption promising they applied to Cleanup and Rewrite.
  `effective_filter_fillers` and `effective_professionalize` took the stored value
  as an argument and opened with `let _ = fallback;`, deriving the result purely
  from the mode; the per-profile fields the UI wrote were dereferenced nowhere in
  the runtime. `post_process` was read and then overwritten per mode. Across 1586
  live correction calls only the three mode-derived flag combinations ever
  occurred — never one produced by a toggle. Two of the three were also redundant
  with the mode axis even had they worked: Cleanup with AI cleanup off is
  Verbatim, Cleanup with Rewrite phrasing on is Rewrite. The processing mode is
  now the only transform axis and each of the six modes is a fixed preset
  (ADR 0020).

### Fixed

- **The workspace-context toggle had no effect.** Settings wrote
  `ProfileModesSettings.auto_detect_mode` on the active profile while the runtime
  read the global `AppConfig.auto_detect_mode` at both of its call sites. Nothing
  connected them, so turning the switch off changed nothing. The runtime now reads
  the per-profile value, with the global as fallback for profiles predating the
  block. The key is renamed to `collect_workspace_context` because the context no
  longer applies only to Auto; the old key is accepted as an alias on both sides.
- **A manually chosen Agent mode could be overridden by the runtime.** After the
  mode resolved to Agent, the Agent branch ran the intent classifier a *second*
  time and, on "no", silently fell through to a cleanup — with flags derived from
  the profile's stored mode rather than the mode the session was running in. Intent
  is now classified only while resolving Auto, at one commit point; reaching the
  Agent branch is itself the decision.
- **The history re-transform mixed flag sources.** It took `post_process` from the
  global field and the other two from the profile, a combination no live session
  could produce. All three now come from one preset.
- **A profile could display a rewrite style it was not running.** `rewrite_style`
  was stored independently of `processing_mode`, and the live config held
  `"polished"` on a profile running `"auto"`. It is now derived from the mode.
- **The per-profile agent name was editable but never read** — the runtime always
  used the global one, so the name shown in Settings and the name the detection
  heuristic matched against could differ. The runtime now reads the profile value
  with the global as fallback.
- **Agent and Prompt Enhance ignored the profile's dictionary and snippets.** The
  text-rule stage sat inside `apply_native_transform`, and neither of those modes
  calls it — so a dictionary replacement the user configured simply did not happen
  there. Agent half hid it by listing dictionary and snippet entries in its prompt,
  which asks the model to honor them instead of applying them; Prompt Enhance did
  neither. Text rules are now a separate final stage
  (`transform::finalize_with_text_rules`) at the single pipeline exit, so every mode
  passes through them. Verbatim was never affected — that call already sat outside
  the `post_process` branch.
- **German `um` was exposed to filler stripping.** It is an English interjection
  and a German preposition, and appears as a preposition in real transcripts. The
  cleanup instruction now states that a filler is stripped only where it stands
  alone as an interjection, and names German `um` explicitly. Guarded by a
  regression-corpus case.

### Added

- **Workspace context reaches every mode**, not just Prompt Enhance: as a category
  signal in Auto routing and as exactly one bounded hint line in the cleanup,
  rewrite and agent prompts, carrying its own instruction never to derive content
  from it. It is detected once per session instead of twice on two paths. This is a
  new input into the correction prompt and therefore a new hallucination surface —
  bounded and corpus-guarded, but the first thing to check if cleanup output starts
  drifting toward the app it was dictated in.
- **An `expected_correction_prompt` block in the regression corpus** with a driver
  test. Prompt shape is the only lever the product has over the cleanup LLM, so the
  guards belong next to the transcripts they protect.
- **Auto routing invariants are enforced by test** rather than stated in prose:
  neither `verbatim` nor `rewrite` can be reached from Auto, and no mode can produce
  the `(filter_fillers=false, professionalize=true)` prompt arm.

### Changed

- **The agent instruction is a working file again instead of a growing
  archive.** `AGENTS.md` had reached 236 lines; a file loaded into context on
  every request costs tokens on every request, and the measured convention puts
  the useful ceiling at 100–150 lines, beyond which the hard rules get buried
  in the volume. It is now 132 lines. Three kinds of weight came out: a spec
  changelog that grew with every ADR (the same anti-pattern the project
  forbids for `ARCHITECTURE.md`), 51 lines of gotchas that were already
  documented in `docs/`, and two rules that had drifted into the file twice.
  No fact was dropped without its owning document being checked first — the
  overlay size and layer-cache invariants moved to `docs/REFERENCE.md`, the
  Windows `vendor/global-hotkey` patch rule to `docs/PLATFORMS.md`,
  `resolve_overlay_monitor` to
  `docs/known-issues/overlay-placement-persist.md`, and the spec drift date to
  `docs/spec/SPEC.md`, which now carries its own `Status:` line like every
  other document. The cpal 0.17 `SampleRate` note was retired outright: it
  described a migration that had already been completed in `capture.rs`.
- **The reference map says when to read a document, not only that it exists.**
  Shortening the file first went one step too far: the rule that the spec
  outranks the living overview docs on conflict was dropped because
  `docs/spec/SPEC.md` states it in its own header. That is the one place it
  cannot help — an agent that opens `ARCHITECTURE.md` first never learns it is
  outranked. Routing rules have to fire before a document is picked, so
  precedence and the append-only ADR rule are back in `AGENTS.md`, and the
  reference map gained a "before touching" column that names the code areas
  which should trigger each read. The separate gotchas list is gone: once the
  map carries triggers, it was a second routing table pointing at the same
  documents.

### Documentation

- **The Linux paste lane is documented by mechanism instead of by symptom.**
  `PLATFORMS.md` grouped `wtype`, `ydotool` and `enigo` under one reason — the
  KDE portal prompt. That is right for the first two and wrong for `enigo`, which
  is pulled with its default `x11rb` backend and drives input through the X11
  XTEST extension: on pure Wayland it is not skipped but inapplicable, and on
  hybrid XWayland it is the *same* request `xdotool` already made, which is why
  `paste_with_enigo` refuses while `xdotool` is in `PATH`. Stated plainly now:
  hybrid sessions have exactly one paste mechanism and pure Wayland has none, so
  a refused XTEST grant has nothing independent behind it. A second mechanism
  (libei) is filed in `ROADMAP.md` as a candidate with an open decision gate —
  deliberately not as scheduled work, because the reliability problem that
  motivated it measured clean (37 real pastes, zero portal denials) and is far
  better explained by the config revert above.
- **`cargo test` writes into the developer's real runtime log**, which cost one
  wrong analysis: 116 lines reading `xdotool blocked by portal ... Authorization
  denied` looked like a 30% XTEST failure rate and were all test fixtures. Real
  sessions have zero. Recorded with the discriminator (the elapsed offset in the
  line prefix) and the fix the repo already uses for `history.json` — a
  `#[cfg(test)]` path override — in
  `known-issues/rust-test-global-state-isolation.md`, whose status is corrected
  from "fixed" to one case still open.

### Fixed

- **The 1.5 s completion fallback no longer ends a session without a surface.**
  The fallback introduced with ADR 0018 set the session to idle but left
  `resultSurfaceOpen` untouched, so an authoritative transcription arriving
  after it flipped the result surface on one commit later — the exact
  two-commit gap ADR 0018 had removed, reachable again through the mechanism
  ADR 0018 added. The fallback now ends the session together with the surface
  that reports it, built from the transcript the native channel actually
  mirrored and with every field the authoritative event owns left null rather
  than guessed. A session that has already ended never has its surface
  re-decided: a late authoritative event updates the open surface in place
  instead of mounting a second one. ADR 0019.
- **A delivery-mode change on the processing preview forces a native repaint.**
  `previewClipboardOnly` swaps the preview's primary button between Copy and
  Insert and toggles `pill--clipboard`, but it only entered `pillVisualEpoch`
  for the result surface. The preview could therefore change its visual identity
  with no native repaint behind it, which on WebKitGTK is the condition under
  which the previous raster stays. ADR 0019.
- **A normalized `work_mode` is written back to disk instead of being
  recomputed forever.** `should_save` did not count a profile normalization, so
  the legacy `insert_behavior` token `"clipboard"` survived on disk and forced
  that profile to clipboard-only on every single load, regardless of what the
  user had selected — the reported "the delivery mode switches itself back".
  The P1 diagnostic recorded that correction 183 times across two runtime logs,
  which is the same statement as "never persisted". A canonical config still
  reports no rewrite, so this does not trade a silent revert for a config
  written on every load. ADR 0019,
  `docs/known-issues/insert-behavior-reverts.md`.
- **The edit surface keeps painting through its own fade.** The leave hold
  required the live `editText` to be non-empty, but a confirmed edit ends the
  session, the new result fires the interaction-reset effect, and that clears
  `editText` — so the surface was pulled out from under its own hold at the
  instant the fade started, measured in 4 of 5 edit closes. The hold now paints
  from a frozen frame captured while the surface was live, the same pattern the
  processing hold already used. ADR 0019.
- **The overlay diagnostics no longer lose lines silently, and no longer go
  quiet where they are being read.** `[ov-*]` output was one fire-and-forget
  `invoke` per line, and concurrent Tauri commands are not ordered against each
  other — so a missing `[ov-repaint]` next to its `[ov-sched]` was
  indistinguishable from an effect that never ran, which is the one distinction
  that log exists to make. Lines now carry a monotonic `#n` and are flushed on a
  microtask. Not `requestAnimationFrame`: WebKitGTK pauses that for the
  not-visible overlay, which buffered every line emitted during the leave until
  the next wake and made a healthy 243 ms transition read as a 258-second stall.
  The `[ov-beat]` heartbeat now also covers the leave window, so a suspended
  main thread there is observable instead of inferred.
- **The result overlay no longer stacks on a processing overlay that never went
  away.** A finished dictation is announced twice — first the native session
  mirror, then the authoritative transcription — as two IPC messages and
  therefore two React commits. The first one already flipped the session to
  idle, so for one render the session was over and no surface owned the pill:
  it unmounted, and on WebKitGTK that orphans the processing pill's compositor
  layers for the result surface to mount on top of. The native channel now only
  mirrors the transcript text; the session ends in exactly one commit, together
  with the surface that reports it, with a bounded 1.5 s fallback in case the
  authoritative event never arrives. Structurally exclusive to "Copy and insert
  at cursor" — "Copy to clipboard only" stops on the processing preview, which
  the leave hold already covered. ADR 0018,
  `docs/known-issues/overlay-ghosting.md`. The reported mode dependence (clean
  in `Auto`, visible in the other five processing modes) is a separate, still
  open axis; it is to be measured with the existing `[ov-*]` diagnostics.

- **Curated profiles no longer lose the delivery mode you chose.** Every profile
  except `General writing` delivered through the wrong pipeline: the overlay
  showed the auto-paste surface while the setting read "Copy to clipboard only".
  `refresh_unedited_curated_text_profile_metadata` reset `work_mode` from the
  shipped template on every save, and its "edited" signal — `curation.curated =
  false` — was only cleared by one of the three UI write paths. `General
  writing` is the one non-curated profile, which is exactly why it was the only
  one unaffected. The refresh now touches presentation only (audience, summary,
  highlights) and never behaviour, and the Modes and Insert & Recovery write
  paths detach a profile from its template like the Profiles tab already did.
  Requiring three call sites to remember one call was the same shape of defect
  as the transcription wiring gap below.

- **Text profiles now actually affect transcription.** Per-profile bias policy
  (`bias_mode`, `manual_bias`) and every local decode setting
  (`local_prompt_strength`, `local_prompt_carry`, `local_beam_size`,
  `local_best_of`, `local_profile`) were written to the config, rendered
  correctly in the Profiles preview, and then dropped before the provider call.
  `capture.rs` hand-built the `audio_ready` payload and `lib.rs` hand-parsed it
  back with per-key lookups; the two schemas had drifted, so every recording ran
  Conservative bias with preset decode defaults regardless of configuration. The
  capture config now crosses the boundary as one flattened value and
  `NativeCaptureConfig::resolve_transcription_request` is the only place a
  request is derived (ADR 0015). Configured profiles will visibly change
  transcripts for the first time — that is the fix, not a regression.

### Changed

- **Profile vocabulary is applied after transcription, not whispered into the
  recognizer** (ADR 0017). Copying vocabulary into Whisper's initial prompt is
  itself a documented cause of repetition loops and language drift, which is why
  the old bias path had to default to "conservative" — and why profiles felt
  like they did nothing. Dictionary terms now leave the prompt entirely
  (`apply_dictionary_entries` already replaced them deterministically, so the
  prompt copy was redundant risk), and the prompt caps drop from 896/480 to
  320/200 characters.
- The four Profiles panels become three: **Vocabulary** (context plus words &
  names), **Replacements** (the dictionary, renamed to what it does) and
  **Snippets**. The **Bias policy** panel is gone. `BiasMode` and its two
  `ManualBias` flags are replaced by a single per-entry "Hint the recognizer"
  toggle, off by default — the only question left is per word, and it is phrased
  as what it does rather than as what it is.
- `TextProfile.stt_hints` (a free-text blob governed by a profile-wide policy)
  becomes `vocabulary_hints: VocabularyHintEntry[]`, separating "teach a word"
  from "replace X with Y" the way Wispr Flow does. `TextProfile.schema_version`
  migrates existing profiles once on load; lines the hint filter would have
  rejected are logged rather than dropped silently, and Manual opt-ins are
  preserved per entry. `bias_mode` / `manual_bias` stay one release as
  migration-only remnants that nothing reads at runtime.

- **The default branch is now `main`.** The repository ran on `master` while
  `CONTRIBUTING.md`, `docs/RELEASE_RUNBOOK.md` and the `ref` inputs of both
  GitHub workflows already named `main` as the target ref. The branch was
  renamed rather than the documentation rewritten, which closes the mismatch in
  the direction of the wider convention. GitHub redirects the old name, so
  existing clones keep fetching; realign one with `git fetch --prune`,
  `git branch -m master main` and `git branch -u origin/main main`. Historical
  records in `docs/handoffs/` that name `master` stay unedited under the
  append-only documentation rule.

### Added

- A speech gate before transcription (ADR 0016). Leading and trailing silence is
  trimmed off the capture, and anything shorter than 200ms of remaining audio
  ends as `InputLevelVerdict::TooShort` with an explicit overlay message rather
  than a silent nothing. The threshold sits far below a real word ("Ja." runs
  400-600ms) because a swallowed dictation is worse than a filtered
  hallucination; `WORDSCRIPT_MIN_SPEECH_MS` overrides it for development.
- A confidence gate on the cloud lane (ADR 0016). The runtime asks for
  `verbose_json` again — it had been overridden to plain `json`, discarding
  Whisper's own per-segment metrics. `core::confidence_gate` drops a segment on
  `no_speech_prob > 0.6` combined with `avg_logprob < -1.0`, or on
  `compression_ratio > 2.4` alone.
- Capability-probed whisper.cpp hallucination controls on the local lane. The
  existing `whisper-cli --help` health probe now also reports which flags the
  installed build understands; `--max-context 0`, `--logprob-thold`,
  `--no-speech-thold` and the `--vad*` family are passed when supported and
  logged when skipped. VAD additionally needs a Silero model via
  `WORDSCRIPT_LOCAL_VAD_MODEL_PATH`. An unsupported flag never fails a run.
- A post-transcription detection stage (`core::hallucination_detect`, ADR 0016)
  that collapses character, word and phrase repetition and filters broadcaster
  subtitle boilerplate by pattern. The previous filter matched exact strings
  only, so it caught `"untertitel von"` as a whole output and missed
  `"Untertitelung des ZDF, 2020"` appended to a real sentence.
- An optional per-profile language pin (`language_locked`, off by default).
  It never makes a language mismatch sufficient on its own to discard text; it
  only lowers the corroboration the drift check requires from two independent
  signals to one. Speaking several languages inside one sentence — anglicisms in
  German, a quoted Spanish phrase in English — is legitimate transcription and
  is left untranslated and byte-identical either way, pinned by two corpus
  entries.
- Editing a transcript before it is delivered. The `clipboard_only` processing
  preview now carries an Edit action next to Copy and Abort — the one surface
  where the text has not left the app yet, so a correction there changes what
  actually gets delivered. Confirming goes through
  `commit_pending_transcription_preview` (new optional `text` argument) rather
  than a separate insert, so the delivered text, the completed session and the
  history entry can never describe different wording; the edit clears the
  machine-corrected flag and records an `overlay_edit` rule. Edit on the
  `auto_paste` result surface is unchanged in behaviour but honest in wording
  now: the button reads "Copy corrected text", because a text already pasted at
  the cursor cannot be retracted.
- Every `transcription` event carries `delivery` (`inserted` | `clipboard`) from
  the new `NativeInsertMode::delivery_label`. Previously only the `auto_paste`
  pipeline emitted it, so the commit and history-retry paths left the UI
  inferring what had happened to the text.
- Diagnostics for the overlay freeze reported during long captures
  (`docs/known-issues/overlay-recording-freeze.md`). Runtime log lines now carry
  an epoch-millisecond and a monotonic timestamp, overlay diagnostic lines carry
  the matching epoch stamp, and every capture records its `audio_level` emit
  accounting on stop (`expected` / `attempted` / `failed` / `shortfall_ratio` /
  `slowest_emit_ms`). A dev-only `[ov-beat]` main-thread heartbeat in the
  overlay reports intervals that land late. Together these separate a genuine
  freeze from the overlay legitimately not re-rendering during silence, which
  the previous telemetry could not distinguish.
- A complete audio-feedback rework (ADR 0010). Cues are synthesised from one
  G-major theme: a startup signature (G3 -> D4 -> G4) that every operational
  cue quotes a fragment of. New `Done` cue on a successful insert — the first
  audible confirmation that a round trip actually finished. Four selectable
  timbre packs (`timber`, `glass`, `air`, `tap`), a volume slider, a startup
  toggle and per-cue preview buttons in Settings. New config:
  `sound_volume`, `sound_pack`, `play_startup_sound`; new command
  `preview_sound_cue`.
- `cargo run --example audition_cues -- --out DIR [--sequence]` renders every
  pack and cue to WAV so the sound can be judged by ear without building the
  app.
- WordScript now names itself in the system volume mixer on Linux
  (`application.name=WordScript` via `PIPEWIRE_ALSA`, `PIPEWIRE_PROPS` and
  `PULSE_PROP`) instead of appearing twice as "PipeWire ALSA [wordscript]" —
  once for the sound cues and once for the microphone. `PIPEWIRE_ALSA` names
  the client object, which is what the KDE applet shows; `PIPEWIRE_PROPS` names
  the stream node, which is what the remembered volume is keyed on. PipeWire keys the remembered per-application volume
  on that name, so the system-mixer setting is now both findable and durable.
  Windows already names packaged builds from `productName`, and macOS has no
  per-application mixer to name.
- Microphone input-level diagnosis. A capture whose loudest moment never
  crosses the speech threshold used to be discarded in silence, so a microphone
  set too quietly was indistinguishable from a broken app. The runtime now
  measures peak and clipping across every capture and reports the verdict
  (`ok`, `too_quiet`, `silent`, `clipping`) with the measurement in dBFS and
  the next concrete step. Settings gained a live input meter with the speech
  threshold drawn in, under the microphone selector. Read-only throughout:
  WordScript never writes the OS input volume, which is per device rather than
  per application and shared with every other app on that microphone.
- A single Rust-owned shortcut contract (`core::shortcut`, ADR 0006) covering
  the token vocabulary, canonical storage form, human display strings and every
  validity rule. The UI no longer carries a key table: it reads the vocabulary
  from the runtime, so every token it can produce is registerable by
  construction. New commands: `validate_shortcut`, `shortcut_vocabulary`,
  `shortcut_platform`.
- Permanent structured trigger observability. Every received shortcut event,
  the decision taken (`start`, `stop`, `debounced`, `ignored_*`, `hold_start`,
  …), every registration and unregistration outcome and every stranded hold
  ended by the watchdog are logged to the runtime log under `[trigger]`, plus
  press/release counters per binding in `native_trigger_status`.
- Per-shortcut runtime truth in Settings: registered versus configured with a
  persistent reason when registration failed, observed press/release evidence,
  and a platform line naming the session type, the backend and the keys the
  desktop swallows.
- A hold-to-talk watchdog (`hold_watchdog_seconds`, default 120, `0` disables).
  A hold whose key release never arrives is ended explicitly with reason
  `native_hold_watchdog` instead of drifting into the silence timeout, and the
  activation-mode selector states whether a key release has actually been
  observed for the configured shortcut in this session.
- A per-session shortcut capability matrix (`shortcut_capabilities`, ADR 0007).
  `core::shortcut::capability_matrix` derives a state (`available`,
  `conditional`, `unavailable`) and a user-facing reason for every activation
  mode and key class, from the session facts plus the press/release evidence the
  trigger lane measured — never from a per-OS assumption about hold to talk.
  Settings gates the activation selector on it: an option this session cannot
  honor is unselectable with the reason stated, and a stored mode that becomes
  unavailable stays selected rather than being silently swapped.
- Modifier-only shortcuts are observed instead of grabbed (ADR 0009). A grab
  delivers the key to WordScript instead of the focused window, which is right for
  `Ctrl+F9` and wrong for `Ctrl+Super`: the combination was taken from every other
  application. Modifier-only shortcuts now go through XInput2 raw key events on
  Linux, which do not consume the keystroke. `validate_shortcut` reports which of
  the two mechanisms applies in `delivery`. The vendored `global-hotkey` crate
  carries the new observation path; Windows and macOS still need the same routing.
- A **single modifier** can be the capture trigger where the session supports it —
  double-tap Shift, or push-to-talk on one key, the idiom the mainstream dictation
  tools use. It rests on an `interrupted` flag the observation path now reports
  with each key edge: tap and double tap discard an interrupted edge, so `Shift`
  pressed to type a capital and `Ctrl+Alt` on the way to `Ctrl+Alt+T` no longer
  count as taps, while hold to talk ignores it and still ends on release. The
  two-modifier minimum became a session property rather than a fixed rule; where a
  platform cannot report interruption it still applies, and the stated reason names
  the missing signal. Linux reports it today; Windows and macOS do not yet.
- A cross-platform verification record for the shortcut lane
  (`docs/known-issues/cross-platform-shortcut-verification.md`): executable run
  sheets for Windows and macOS, the per-platform release mechanisms read from the
  vendored `global-hotkey` source, and an assessment of which questions a VM or a
  CI runner can answer instead of owned hardware. It records that the
  modifier-only capture defaults are expected to fail registration on macOS,
  because that platform implementation maps no modifier as a main key.
- A development-only key probe in the shortcut recorder that logs `event.code`,
  `event.key`, the modifier state and whether the code mapped to a registerable
  token, for diagnosing which keys a desktop actually delivers.
- Test coverage for the shortcut recorder (`HotkeyRecorder.test.tsx`), which
  previously had none and was mocked out wherever it would have been exercised.
- Repository documentation now follows the SW labs template: canonical
  `AGENTS.md` with `CLAUDE.md` symlink, `.editorconfig`, `.claude` examples,
  `.agents` guidance, contribution and security policies, staging guidance,
  GitHub issue and pull-request templates, and `.githooks/pre-commit` with
  secret scanning and legacy build-artifact cleanup.
- A lean consolidated product specification at `docs/spec/SPEC.md`, five
  initial ADRs, reference templates, an indexed living known-issues area, and
  a fully English documentation set.
- Permanent development-only overlay diagnostics: native DevTools and
  diagnostic-log commands plus a development settings panel and frontend event
  traces.
- Cross-platform CI repairs: `cpal` 0.17 and `rodio` 0.22 updates for
  Send-safe macOS capture streams, and the vendored Windows global-hotkey
  pointer fix for `windows-sys` 0.59.
- One-shot native capture-stream rebuild after a transient stream error, with
  format matching, runtime logging, and regression coverage.
- Persistent runtime-log diagnostics for capture error classification and
  selected audio device details.
- A KDE Plasma 6 KWin overlay-layer script and the
  `WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING=1` hardware opt-out.
- Native provider capabilities, setup diagnostics, local `fast` and `quality`
  profiles, profile-bound decode and prompt-bias persistence, and a local
  runtime snapshot for Diagnostics and history.
- Profile work-mode contracts, typed insertion-recovery metadata, server-side
  history filters, JSON export, and a native capture/provider/transform/insert
  timeline.
- Text-profile STT hints, one-time persisted included profiles, a global active
  profile switcher, and a staged Text Rules workspace.
- Internal release build-up aggregation with platform archives, checksums,
  metadata, and optional maintainer draft releases.

### Changed

- Hold to talk is strictly momentary (ADR 0013). A press shorter than
  `hold_arm_ms` (300 ms, fixed) is now **discarded** — no session, no overlay, no
  cue, no history entry. The old `hold_min_ms` did not gate a hold, it extended
  one: a release below the threshold scheduled a deferred stop that fired once
  the recording had reached 300 ms, so every press produced a transcript and the
  hold duration changed nothing. The mode behaved like tap to toggle with a
  floor. The microphone still opens on the press edge and the audio is kept, so
  a hold that commits loses no word; what waits for the threshold is the
  session, not the stream. The listen cue therefore moves from the press to the
  commit, and the watchdog arms there too. No latch gesture was added, to hold
  or to tap: the two toggle modes already own latching, and a hybrid branch
  would make the three options overlap. The threshold gates all three
  capture-lane bindings — start/stop, pause and abort — the way the double-tap
  window already does. `NativeTriggerStatus.hold_min_ms` is renamed to
  `hold_arm_ms`; `TriggerEffect::DeferredStop` is removed and replaced by
  `StartCaptureProvisional`, `CommitHold`, `DiscardProvisional` and
  `DeferredHoldAction`. This also closes D11 in the known-issues record, which
  had hold to talk down as doing nothing at all: both edges arrive and both act,
  and the defect was in what they meant.

### Fixed

- The Windows and macOS builds were broken and had been for as long as the
  vendored `global-hotkey` patch has existed. Three `GlobalHotKeyEvent` literals
  were never updated when the patch added the `interrupted` field
  (`windows/mod.rs:165`, `macos/mod.rs:466` and `:519`), which is E0063 — a
  missing field in a struct literal. The patch had only ever been compiled on
  Linux. Fixed by supplying the contract-correct `false` at each site (press
  edge, grabbed real key, media key).
- Modifier-only shortcuts now exist on Windows. They previously registered and
  then never fired: the low-level hook returned early for every modifier virtual
  key, so a shortcut whose main key is itself a modifier never reached the
  matcher. The shared state machine behind it — held-modifier tracking, the
  exact-match rule, and what marks a held trigger interrupted — moved into a new
  platform-neutral `modifier_only` module with ten unit tests that compile and
  run on Linux, so the logic is checkable even though the target is not. Windows
  registers modifier main keys with the observer, feeds it every key event, and
  still passes modifier keys on rather than consuming them (ADR 0009). This also
  makes the release-edge pause/abort fix effective there, since `interrupted` is
  now computed rather than absent. The x11 backend is untouched: it is the
  reference implementation and the only one that has actually run.
  **Not compiled for Windows or macOS** — there is no cross toolchain on the
  development machine. `session_has_interruption_signal` therefore still returns
  false for Windows, so a single bare modifier stays rejected there until
  hardware confirms the signal. macOS remains unimplemented, with its
  requirements written into the known-issues record instead of guessed at in
  code, because `objc2-app-kit` could not be read to verify the API.
- Two ADRs filed on 2026-07-27 shared the number 0011 — the delivery-surface
  record and the mode-lane record. Both are accepted and neither could be
  withdrawn, so they gained a disambiguating suffix instead of a new number:
  `0011a-one-decision-surface-per-delivery-mode.md` and
  `0011b-the-mode-lane-sits-on-alt-not-on-ctrl.md`. Renumbering the second to
  the next free number was rejected because it breaks the "never renumber an
  existing ADR" rule and would silently send an older bare "ADR 0011" reference
  to the wrong record. Every citation across the docs now carries the letter;
  the reference audit was redone in the process and had been wrong about two of
  them. The next decision takes 0015.
- `cargo test` is reliably green again on a clean tree. Three tests mutated
  process-wide state and therefore raced their own siblings under the parallel
  default: two `core::runtime_log` tests cleared the shared ring buffer before
  recording into it, and the `core::workspace_context` pair set and removed the
  same `WORDSCRIPT_PROJECT_ROOT` variable. Measured at 2 failures in 22
  consecutive runs, load dependent, and always a false negative — the assertions
  and the code under test were correct. Both sites now assert through a seam
  rather than a lock: the ring-buffer tests compose `formatted_entry` and
  `push_bounded` against a local `VecDeque`, and the project-root tests call
  `resolve_configured_project_root` with the value they want instead of touching
  the environment. Serialising the suite was explicitly not the fix; the
  parallel default stays the normal case and `--test-threads=1` stays green.
  Two behaviours gained coverage on the way — ring-buffer eviction at the cap,
  and project-root resolution with no variable set — and `std::env::set_var` is
  gone from the test module ahead of the Rust 2024 edition bump.
- Reaching for `Ctrl+Alt+<key>` while dictating no longer discards the capture.
  The shipped abort default `Ctrl+Alt` is modifier-only, and pause and abort
  acted on its press edge — a moment at which the interruption signal cannot
  exist yet, because the third key has not been pressed. All three activation
  modes misfired: tap the instant both modifiers were down, double tap on the
  second such chord inside the window, hold once its arm timer passed
  `hold_arm_ms` underneath the still-held chord. Pause and abort now follow the
  rule start/stop already followed (ADR 0014): a modifier-only binding is decided
  at the release edge, and an interrupted chord acts on nothing and counts toward
  nothing. In hold mode the threshold is unchanged but measured at the release,
  because a timer that fires mid-hold fires before the interruption is knowable.
  A binding containing a real key — the shipped `Ctrl+Space` pause — is
  unaffected and still acts on the press. Fixing the default alone would not have
  helped: any modifier-only value a user assigns hits the same path.
- Holds taken in quick succession no longer strand the microphone. The
  provisional window is the one moment where a key is held without a session,
  and `sync_trigger_state_with_session` treated that as state to repair: it
  cleared `hotkey_active` on the next incoming event, the matching release was
  dropped as a release without a press, and the capture stayed open. The next
  press then failed with "A native audio capture is already active", the leftover
  stream produced "No speech detected", and an abort was needed to clear a
  session that already looked finished. The hold now carries an explicit
  `HoldPhase`, which the session sync leaves alone while it is provisional.
  Alongside it: a release is handled whenever a hold is in flight even if the
  held flag was lost, a failed provisional start cancels the hold so the arm
  timer cannot commit a session with no audio behind it, the capture monitor
  starts with the stream instead of with the session so no capture is ever
  unsupervised, and a monitor autostop that finds no session releases the device
  instead of returning and leaving it open.
- A hold pressed while the previous transcript is still processing is refused at
  the press edge (`ignored_processing`), the way tap mode already refused it,
  instead of opening a microphone for 300 ms and then failing the commit.
- The mode lane moved from `Ctrl` to `Alt` (ADR 0011b): mode select is `Alt+S`
  instead of `Ctrl+S`, and the six per-mode jumps are `Alt+1`-`Alt+6` instead of
  `Ctrl+1`-`Ctrl+6`. The old defaults were global grabs on **save** and on
  **browser tab switching** — the two reflexes a writing tool must not take
  away. One stored value covers every platform: macOS renders the lane as
  `Option+S` and `Option+1`-`Option+6`, Windows and Linux as `Alt+…`. Existing
  configs are migrated once (`SHORTCUT_SCHEMA_VERSION` 1 -> 2), per slot, and
  only where the slot still holds its untouched `Ctrl` default; an assigned
  shortcut, an empty (disabled) slot, and any slot whose new value is already
  taken are left alone.
- The overlay's dev-only per-render trace is now opt-in behind
  `VITE_WORDSCRIPT_OVERLAY_RENDER_TRACE=1` and runs in an effect rather than in
  the render body, and `read_diag_log` returns only the tail of the diagnostic
  log instead of the whole file. The panel polls that command every 500 ms while
  it is open, so the previous behaviour put an unbounded, session-length-
  dependent payload on the main thread — load heavy enough to be a candidate
  cause of the very stall the log exists to diagnose.
- Sound cues no longer open a fresh output device per cue. One stream, owned by
  a dedicated thread, is opened at startup and primed with silence, so cues no
  longer contend with the microphone device and are rendered at the real device
  sample rate instead of being resampled at playback time.
- `SoundCue::Start`/`Stop` became `Listen`/`Handoff`. `Handoff` fires when
  capture stops and is deliberately unresolved: at that point the pipeline is
  still running, so the old conclusive-sounding tone asserted a completion that
  had not happened.
- Documentation was audited against the active Rust, React, Tauri, workflow
  and packaging code. The spec now names the registered session commands,
  distinguishes Tauri channels from payload discriminators and internal UI
  actions, documents profile-bound mode resolution and its legacy fallback,
  automatic settings persistence, the 232px settings sidebar, visible
  preview-only More areas, the accepted overlay residuals and the actual
  Node.js engine requirement.
- Rust package metadata now matches the accepted AGPL-3.0 license and current
  SW forge repository. Bootstrap scripts reject Node.js versions unsupported
  by Vite 8.
- Rust/Tauri remains the runtime owner; React consumes typed native truth.
  Provider configuration uses consistent provider terminology and legacy Groq
  secret migration runs natively before configuration is saved.
- The local runtime now passes transcription context through `whisper-cli`,
  distinguishes `fast` from `quality`, records local prompt/decode/cleanup
  metadata, and conservatively falls back when local cleanup is unavailable.
- Linux insertion uses explicit native driver chains and desktop-aware portal
  diagnostics. Pure Wayland avoids privileged auto-paste attempts and uses
  clipboard-only recovery; KDE Plasma 6 and GNOME can request a persisted
  RemoteDesktop grant.
- Settings now use a calmer native-decorated utility shell with grouped
  navigation, profile context, one dominant content surface, and the same
  Diagnostics pop-out language.
- The overlay uses a compact fixed stage, real processing-time
  `clipboard_only` preview, native result actions, movement-threshold dragging,
  remembered user placement, and clearer speech waveform behavior.
- Linux WebKitGTK performance work enables GPU compositing by default, removes
  card shadows and backdrop filters, adds contained scroll surfaces, uses a
  fixed background gradient, and changes history refresh to five seconds.
- Overlay host behavior uses fixed 440x60 and 460x164 surfaces, XWayland by
  default, per-reveal background color updates, and native hide/parking.
- The universal CSS reset now belongs to Tailwind's `@layer base`; shared
  wordmark, spacing, tokens, and content-visibility utilities support the
  current shell.
- Documentation and About copy accurately distinguish internal build-up from
  published releases and defer broad workspace, sync, MCP, and assistant scope.

### Removed

- The active Python sidecar path, including build scripts, legacy package files,
  and obsolete configuration examples.
- Deprecated isolated settings prototypes and obsolete general-area
  placeholders; the visible Chat, Upload, Notes and Account layouts remain
  explicitly labeled previews. The inactive `show_tray_icon` runtime field and
  obsolete `rebuild-lab.css` were also removed.
- The old `hooks/pre-commit` location and regenerated legacy `BUILD_ID` and
  `build_info.json` behavior.

### Added

- A third activation mode, **double tap to toggle**: two taps within
  `double_tap_window_ms` (default 400) start or stop the capture, a single tap
  does nothing. This is what the mainstream dictation tools do — Wispr Flow
  double-taps right Shift, macOS Dictation double-taps Fn — and it exists for a
  concrete reason: a modifier-only trigger in tap mode acts on every single
  press, so `Ctrl+Alt` as the trigger also fires when the user meant
  `Ctrl+Alt+T`. Requiring two taps leaves the single press to the rest of the
  desktop. The gate covers start/stop, pause and abort, each with its own
  window; mode hotkeys stay single-press. Settings names the trade-off on both
  modes.

### Changed

- The reason a single bare modifier is rejected changed with the mechanism. It is
  no longer "it would be grabbed from every application" — with observation that is
  no longer true. It is that nothing distinguishes a deliberate tap of Shift from
  the Shift pressed to type a capital, and two of those inside the double-tap
  window is ordinary text entry. The stated reason says so, so the restriction does
  not read as arbitrary.
- **`double_tap` is now the default `activation_mode`** (ADR 0008), because the
  default capture triggers are modifier-only and in tap mode every single press
  of `Ctrl+Super` or `Ctrl+Alt` would act — taking that combination away from
  every other application. The default applies to a config that does not record
  an `activation_mode`; existing installations keep the value they have and no
  migration rewrites the field.
- New default shortcut rotation, identical on Linux, Windows and macOS:
  `Ctrl+Super` start/stop, `Ctrl+Space` pause, `Ctrl+Alt` abort, `Ctrl+S` mode
  select and `Ctrl+1`-`Ctrl+6` for the six processing modes. The per-OS
  branching is gone — divergent defaults are what let the legacy migration
  rewrite the Windows default on every save — and the set is asserted in tests
  to parse, register, not collide and survive normalization unchanged.

### Known issues

- The pause/abort interrupted-chord fix below is unobserved: neither the defect
  nor the fix has been seen in a running app, and on Windows and macOS the defect
  is untouched because those backends report no interruption signal at all.
  `docs/known-issues/pause-abort-interrupted-chord.md`.
- `cargo test` is not reliably green on a clean tree: two `core::runtime_log`
  tests and the `core::workspace_context` env-var pair mutate process globals
  and fail at random under parallel execution — 2 of 22 consecutive runs when
  measured. False negatives, not regressions;
  `docs/known-issues/rust-test-global-state-isolation.md`.
- Hold to talk does not work, observed live on a session where double tap on the
  same trigger does. Since double tap counts release edges that only follow a
  counted press edge, key delivery is ruled out and the fault is in the hold path
  or in what it starts. Narrowed to four candidates in
  `docs/known-issues/capture-shortcut-recording.md`, each of which names itself in
  the `[trigger]` log.

### Fixed

- Switching processing modes in the idle mode picker left the previous mode's
  pill painted underneath the new one. It looked like the compositor artifact
  accepted on 2026-07-20, but it was not: `dragSessionActiveRef` stayed true for
  the rest of the process after the first overlay drag, because the position
  persist handler cancelled the only timeout that ever ends a drag session.
  Both overlay layout effects bail on that ref, so from the first drag onwards
  the per-surface size sync and the visual-epoch repaint were dead — and the
  visual-epoch repaint is the only native repaint trigger for a change that
  keeps the same pill kind, such as a mode cycle. The grace timeout is now
  re-armed instead of cancelled, which keeps the long-drag persistence fix (K1)
  intact. See `docs/known-issues/overlay-drag-session-never-ends.md`.
- In "Copy and insert at cursor", the final result overlay could appear stacked
  on top of the previous overlay, which never went away. The visibility of the
  result surface was set in a React effect one render after the session ended,
  so a six-condition bridge predicate — reachable only on this delivery path —
  had to carry the pill across that render. When it did not hold, the pill
  unmounted for a frame and orphaned the processing pill's WebKitGTK compositor
  layers. The surface is now decided in the same reducer commit that ends the
  session (`RuntimeState.resultSurfaceOpen`), so the gap render no longer
  exists; the bridge, the commit-suppression ref and the sticky suppressed-result
  marker are gone. The overlay also emits a single surface value now, so the
  runtime is never told a different surface than the one being painted — that
  had been harmless only because every flat surface happens to be 480x60.
  (ADR 0011a)
- The "finished" cue in "Copy and insert at cursor" sounded before the result
  overlay appeared, and could fire for a result the runtime then discarded as
  stale. `Done` and `Error` were played from inside the insert helper, which
  three flows call at three different moments and always before their staleness
  gate. Cues now come from the session lifecycle, next to the event that tells
  the UI the same thing, so both delivery modes fire the same cue at the same
  meaning. `Handoff` moved into the branch that actually hands audio to the
  pipeline, after the capture teardown — an empty capture no longer announces
  work in progress and then contradicts itself. The insert-error arm that
  previously played no cue at all now reports one. (ADR 0012)
- Sound cues were sometimes swallowed entirely, started chopped, or fired
  twice. The per-cue device open could fail silently, the device was played
  before it had warmed up, and rapid cue chains overlapped acoustically. A
  failed abort also played `Abort` and then `Error` for one action; it now
  reports only the error.
- A per-mode hotkey now confirms itself on screen. The direct jump set the mode
  in the runtime but revealed nothing, so `Ctrl+1`-`Ctrl+6` looked dead while
  the mode had in fact changed. The overlay opens on the mode-select surface
  showing the new mode and auto-dismisses; it never starts a capture.
- Mode hotkeys changed in Settings are now actually re-registered.
  `configure_native_trigger` preserved them from in-memory state, so a new value
  was written to disk and the OS grab kept firing on the value from the last
  startup: mode select appeared dead no matter what you assigned, and configured
  versus registered disagreed silently.
- Shortcut recording is an explicitly ended state. It no longer commits on the
  first key release, so tapping `Ctrl` no longer writes `ctrl_l` and closes the
  recorder — the reason no further key could be added. The recorder accumulates
  the largest chord seen and requires confirmation.
- A single bare modifier can no longer be registered. It used to be expanded
  into a grab with no modifier at all, which consumed every `Ctrl` press
  desktop-wide and broke `Ctrl` shortcuts in other applications. Modifier-only
  shortcuts now require at least two modifiers.
- Opening a shortcut recorder now really releases the OS grabs, in Capture and
  in Modes. The previous soft pause left every shortcut grabbed, so the
  combination you already use was invisible to the recorder and could never be
  re-recorded; in Modes, pressing a live mode shortcut fired the mode action
  instead.
- Manual shortcut entry edits a local draft and only reaches the runtime on
  commit. Saving on every keystroke walked through intermediate values such as
  `c`, which are themselves valid single-key shortcuts and were registered as
  bare global grabs that then swallowed the very letters being typed.
- Persist-time normalization no longer truncates `Ctrl+Alt+Space`,
  `Ctrl+Super+Space` and `Ctrl+Cmd+Space`. The Windows default hotkey was
  rewritten to a modifier-only shortcut on every save. Legacy rewrites are now
  gated on `shortcut_schema_version` and run once.
- Clearing a shortcut disables it. An empty capture or mode shortcut used to be
  silently rewritten to the platform default, so a shortcut could not be turned
  off.
- Collision validation runs after normalization, not before, so two spellings of
  the same combination can no longer both pass validation and then collide on
  disk.
- A shortcut value that cannot be parsed is stored unchanged and surfaced as
  "not registerable" instead of being lowercased into something that can never
  register, with the failure visible only in a transient toast.
- The recorder accepts the runtime's full key vocabulary — arrows, numpad,
  punctuation, `Insert`/`Delete`/`Home`/`End`/`PageUp`/`PageDown`, `F13`+ — and
  `Escape` held together with a modifier is a chord member, so the default abort
  shortcut `Ctrl+Alt+Escape` can finally be recorded with the recorder that
  manages it.
- Shortcuts render as human strings (`Ctrl + F9`) in pills and summaries;
  raw tokens appear only behind the per-row "Enter manually" affordance.
- Pipeline watchdog and one transient provider retry prevent indefinite
  processing states and make failures visible in persistent logs.
- Native audio handling no longer retains a long-lived `rodio` output stream;
  capture errors terminate safely and buffer growth is capped.
- Duplicate session completion and insertion ownership errors are eliminated.
- Local provider slots, cleanup configuration, retries, profile history, and
  release status now reflect the native runtime contract.
- Linux portal-prompt classification, clipboard fallback, hotkeys, timeout
  handling, and recovery diagnostics now report actionable native truth.
- Overlay ghosting is blocked by opaque pill surfaces; clipboard-only commits
  preserve a safe processing hold instead of briefly mounting invalid result UI.
- Overlay placement persists only actual user drags, resolves monitor changes
  from stored logical placement, reapplies placement after reveal, and suppresses
  action clicks until a drag ends.
- Settings preserve native decorations and usable window minima; sidebar,
  provider selects, utility links, key-validation status, and normalized hotkeys
  behave consistently across supported hosts.

### Security

- Groq keys remain in the OS secret store and are scrubbed from saved JSON.
- Legacy JSON Groq keys migrate to the secret store before sanitized config is
  persisted.

## [0.2.0-alpha]

### Removed

- Debug code from `SettingsWindow.tsx` and `lib.rs`.

### Fixed

- Linux/Wayland startup no longer fails with GDK Error 71; transparent and
  undecorated paths fall back to XWayland where required.
- Overlay `show`, `hide`, and always-on-top crashes on Linux/Wayland were
  removed by using safer visibility and positioning behavior.
- Settings window visibility handling no longer crashes on Linux/Wayland.
- All platforms now use the unified user configuration path, restoring Groq
  configuration and transcription behavior.
- The IPv4 transport path prevents IPv6 connection timeouts from blocking Groq.

## [0.1.6-alpha]

### Fixed

- Groq API calls use forced IPv4 transport to avoid 20- to 60-second IPv6
  connection timeouts on every platform.
- Linux development mode starts the Python sidecar through the project root and
  its `.venv` rather than an uncontrolled system Python.

## [0.1.5-alpha]

### Fixed

- Linux Groq API calls use forced IPv4 transport when IPv6 fallback fails.
