# Architecture Decision Records

Architecture Decision Records (ADRs) are small, dated, immutable records of
individual decisions. They complement the living [architecture overview](../ARCHITECTURE.md)
and [product direction](../VISION.md); neither overview replaces ADRs.

## When to Create an ADR

Create one for a consequential, difficult-to-reverse decision: a runtime or
data contract change, provider strategy, licensing, hosting, window-chrome
strategy, authentication, or sync direction. Do not create ADRs for routine
code style or small implementation details.

## Format

Use `NNNN-short-title.md`, in ascending order. Never renumber an existing ADR.

```md
# NNNN: Title

Date: YYYY-MM-DD
Status: Proposed | Accepted | Superseded by NNNN

## Context

## Decision

## Consequences
```

## Rules

- ADRs are never rewritten retroactively.
- A changed decision requires a new ADR that marks the prior one as superseded.
- `spec-sync` may identify a decision that needs human review, but it does not
  create an ADR without explicit confirmation.

## Existing ADRs

- [0001](0001-tauri-rust-als-runtime-owner.md): Tauri/Rust owns product runtime behavior.
- [0002](0002-cloud-first-groq-byok.md): cloud-first Groq BYOK provider strategy.
- [0003](0003-native-fensterdekorationen.md): native window decorations on every platform.
- [0004](0004-agpl-3-0-lizenz.md): AGPL-3.0 licensing.
- [0005](0005-local-first-sync-richtung.md): optional WordScript-owned local-first sync direction.
- [0006](0006-rust-owns-the-shortcut-contract.md): one Rust module owns the
  shortcut token vocabulary, display strings and validity rules; the UI carries
  no key table.
- [0007](0007-capability-matrix-is-measured-not-assumed.md): the shortcut
  capability matrix is derived from session facts plus measured press/release
  evidence, never from a per-OS assumption about hold to talk.
- [0008](0008-double-tap-is-the-default-activation-mode.md): `double_tap` is the
  default activation mode, because the default triggers are modifier-only;
  existing configs keep their chosen value.
- [0009](0009-modifier-only-shortcuts-are-observed-not-grabbed.md): a
  modifier-only shortcut is observed through the raw key stream instead of
  grabbed, so the modifier keeps working for everyone else; a shortcut with a real
  key is still grabbed.
- [0010](0010-audio-cues-are-a-synthesised-motif-on-one-persistent-stream.md):
  audio cues are synthesised from one G-major theme -- a startup signature the
  operational cues quote fragments of -- and play on a single persistent output
  stream instead of a device opened per cue.
- [0011a](0011a-one-decision-surface-per-delivery-mode.md): each delivery mode has
  exactly one surface on which the user decides -- `clipboard_only` before
  delivery, `auto_paste` after it -- and the overlay derives it from runtime
  state set in one reducer commit instead of per-mode bridge predicates.
- [0011b](0011b-the-mode-lane-sits-on-alt-not-on-ctrl.md): the mode lane -- mode
  select plus the six per-mode jumps -- moves from `Ctrl` to `Alt`, because a
  modifier-plus-key shortcut is still a global grab and `Ctrl+S` /
  `Ctrl+1`-`Ctrl+6` are taken away from every other application.
- [0012](0012-cues-are-anchored-to-the-delivery-point.md): audio cues are emitted
  by the session lifecycle next to the event that tells the UI the same thing,
  not from inside the insert helper.
- [0013](0013-hold-to-talk-is-strictly-momentary.md): hold to talk discards a
  press below `HOLD_ARM_MS` instead of extending it to that length, and gains no
  latch gesture -- the two toggle modes already own latching. The microphone
  still opens on the press edge, so committing later loses no word.
- [0014](0014-every-modifier-only-binding-is-decided-at-the-release-edge.md):
  pause and abort follow the rule start/stop already followed -- a modifier-only
  binding is decided at the release edge, where the interruption signal is
  knowable, and an interrupted chord acts on nothing. In hold mode the deferred
  action fires on the release rather than on the arm timer; the threshold is
  unchanged.
- [0015](0015-the-runtime-transcription-request-has-one-resolved-source.md): the
  capture config crosses the event boundary as one flattened value and exactly
  one function derives a provider request from it. The two hand-maintained JSON
  schemas had drifted, so per-profile bias policy and every local decode setting
  were silently dropped on every real recording.
- [0016](0016-a-speech-gate-and-confidence-gate-sit-before-ai-cleanup.md): a
  silence trim, a segment-confidence gate, capability-probed whisper.cpp decode
  flags and a repetition/artifact detection stage all run before AI cleanup.
  Thresholds are constants, not settings, and a language mismatch is never on
  its own a reason to discard anything.
- [0017](0017-vocabulary-moves-out-of-the-whisper-prompt.md): profile vocabulary
  is applied deterministically after transcription; only entries the user opts
  into per item reach Whisper's initial prompt. The `BiasMode` enum and its
  `ManualBias` flags are replaced by one per-entry toggle, dictionary terms
  leave the prompt entirely, and the four Profiles panels become three.
- [0018](0018-the-end-of-a-session-belongs-to-exactly-one-event.md): the native
  event channel mirrors session status but does not end a session. `status`,
  `pendingResult`, `previewStaged` and `resultSurfaceOpen` change only in the
  authoritative `wordscript-event` transcription commit, so the atomic swap of
  ADR 0011a holds against the event ordering too; a bounded fallback covers an
  authoritative event that never arrives.
- [0019](0019-every-path-that-ends-a-session-owes-the-surface-that-reports-it.md):
  every path that ends a session also commits the surface that reports it,
  including the timeout fallback, and once ended a surface is never re-decided.
- [0020](0020-the-processing-mode-is-the-only-transform-axis.md): the processing
  mode is the only input to transform behavior. Modes are fixed presets, the three
  cleanup toggles are removed because the runtime discarded them, Auto resolves to
  exactly one entry of the flat mode list at one commit point, and neither
  Verbatim nor Rewrite is reachable from Auto. Carries the measurement that
  rejected Auto->Verbatim.
- [0021](0021-profile-context-has-one-shape-in-every-mode.md): the profile
  context reaches every mode at one width and in one shape, produced by
  `core::profile_context`; the mode decides the framing, never the width. The
  recognizer's word-shape filter stays on the recognizer path. Carries the
  96-transcript replay that licensed widening Cleanup.
- [0022](0022-a-window-on-no-monitor-is-never-a-position-the-user-chose.md): a
  stored window position that lands on no monitor is discarded rather than
  restored, because it cannot be a position the user chose.
- [0023](0023-profile-context-is-a-reading-aid-and-a-register-sets-form-not-lexis.md):
  the profile context is a reading aid for the instruction, never a source of
  content -- it moves into the Agent system prompt behind an explicit
  restriction, the user turn carries only the transcript, and snippets
  contribute trigger without expansion. Adds a per-profile communication style
  whose register sets form only: slang and youth language come from the user's
  rules and writing sample, never from the model's memory. Every prompt is now
  written in English.

- [0024](0024-the-processing-mode-has-one-source-and-every-writer-announces-it.md):
  the active profile's work mode is the only source of the effective processing
  mode. The process-global `MODE_OVERRIDE` is removed -- it was set by every
  mode-change path, cleared by none, and therefore made each later settings
  change invisible to both the overlay and the pipeline. Every writer now emits
  `wordscript-mode-event` alongside `ready`, and the overlay's fetch debounce
  coalesces to the last request instead of dropping it.

- [0025](0025-a-session-belongs-to-the-profile-it-started-in.md): the active
  profile is fixed for the duration of a session and everything derived from it
  is snapshotted at capture start; the processing mode is the single exception.
  Switching profiles mid-session is refused by the runtime, because it produced
  a transform assembled from two profiles on top of a transcription that had
  already run under the first.

- [0026](0026-the-agent-produces-an-artifact-not-an-answer.md): the agent prompt
  opens by naming what its output is and who it is addressed to, ahead of the
  profile context and the style block. Every rule it carried before was
  negative, and a conversational reply satisfied all of them -- the mode
  answered the user where it had been told to write to a third party, and
  supplied invented detail along the way.

- [0029](0029-the-agent-mode-carries-out-an-instruction-it-does-not-act.md): the
  mode is text in, text out, one call, and gains no tool-calling surface.
  Side-effecting tools stay out of the dictation path -- latency, the
  one-commit session model, the insert contract and the low confidence of a
  speech channel each rule them out. MCP is split into three questions: server
  in scope, client in the dictation path rejected, client for vocabulary
  rejected as a distinct feature. The mode is renamed to `draft`, because ADR
  0030 gives the product a settings area named `Agents`.

- [0030](0030-one-orchestrator-speaks-for-every-agent.md): one orchestrator is
  WordScript's only client, and coding agents are configured for nothing -- for
  them the orchestrator is the human. It answers what it can and reaches the user
  only for what it cannot, which replaces a judgement no coding agent can make
  ("is this worth interrupting a person") with two it can. It may compose the
  question; it returns the answer verbatim. The channel cannot carry a monologue:
  one spoken field, length limited, and exactly one model-generated spoken path.
  Two tools -- `ask` returns immediately, `await` blocks on an event stream --
  which is what keeps "no client ever waits on a human" literally true. Server-
  initiated requests were abolished on 2026-07-28, so nothing reaches a running
  agent through MCP unprompted; harness channels beside MCP can, and are named
  rather than denied. Starting work is the same primitive: a target with roles,
  carrying all configuration so the utterance carries only intent, launched
  headless with a visible keyed confirmation. Revised 2026-08-01 before it was
  first committed, after every external claim was checked against primary
  sources; the revision withdrew an invented timeout and an invented
  specification change, and closed seven of nine open questions (authentication,
  port and lifecycle, TTS, VAD, history, profile, text rules).

- [0031](0031-a-voice-nudge-is-one-shot-on-known-text-and-entered-explicitly.md):
  a voice nudge is one shot on WordScript's own last output, entered explicitly
  and never inferred, committed through the existing preview surface and guarded
  against drift. Conversational state was the assumption going in; no competitor
  has shipped it and one retreated from it, so it is not built.
- [0032](0032-the-profile-context-is-topics-and-the-recognizer-never-reads-it.md):
  the profile context holds topics and reaches the LLM stages only;
  `vocabulary_hints` is the sole profile path to the recognizer. The recognizer
  had kept reading the context field after ADR 0017 built its replacement, so
  correctly written topics were filtered there and reported as rejected — on a
  path no reachable configuration still used. Also: a measurement names the data
  it ran against. ADR 0021's report described a shipped seed and measured a local
  copy two months out of date.
- [0033](0033-a-term-has-no-left-hand-side.md): a term carries no spoken form,
  because a recognizer mangles a name differently every time. Words & names holds
  the term alone and reaches every LLM stage; Replacements keeps its left column
  but is scoped to shorthand the user says on purpose. Repair is layered with the
  deterministic pass as the floor, since it is the only one that runs in Verbatim,
  and it declines wherever it cannot decide. A term switched on past the
  recognizer's slot budget is reported instead of dropped.
- [0034](0034-a-limit-belongs-to-the-control-that-spends-it.md): a limit is
  stated where it is spent. Reporting the over-limit terms in a card of their own
  left the switch that caused the loss showing no change at all, so each row now
  states its own fate and the two distant cards are gone. Per-row status is
  resolved from the runtime's analysis, never recomputed — hence
  `VocabularyRepairCoverage`, which lets the panel name the repair floor without
  restating it. Words & names gets reordering, because there order decides which
  terms travel at all. Also: the preview now runs the repair pass the transform
  runs, and the copy that still taught the pre-0033 habit is corrected.
- [0035](0035-a-vocabulary-is-filled-by-observation-not-by-a-form.md): a
  vocabulary is filled by observation, not by a form — the knowledge of which
  word the recognizer gets wrong only exists in the second the text comes out
  wrong, which is a second nobody spends in Settings. The correction LLM is the
  teacher and its output is the training signal; promotion needs two sightings,
  a hand correction counts as two. The recognizer's slots are allocated by the
  system because the intuitive allocation is systematically wrong: it spends
  every slot on the long terms deterministic repair already recovers. Words &
  names becomes a display. Also: Prompt Enhance never received the profile's
  terms at all, and ADR 0033's claim that learning was blocked on new storage
  was wrong.
- [0036](0036-correctness-holds-without-a-configured-profile.md): correctness
  holds at zero configuration — the dictionary and the vocabulary are
  personalization, and a fix that presupposes a maintained profile only helps
  someone who has already been bitten. The recognizer therefore gets a constant
  register floor instead of no initial prompt at all, in both lanes and visible
  in the preview, while a channel the user switched off stays off. Where a
  deterministic rule can hold the line it does: a correction may not fuse a run
  of spelled-out single letters into a token the original never had, and that
  guardrail repairs the token rather than discarding the whole correction. Gated
  on a measurement fixed in advance (12 of 197 shipped pairs, 6.1 %), not on a
  choice between plausible options — which is how the last two prompt rules got
  their wrong justification.
- [0037](0037-a-stored-secret-is-not-filed-under-the-brand.md): a stored secret
  is not filed under the brand — the June rebrand stopped at the UI because the
  keyring service name was defined as the bundle identifier, so renaming the
  brand would have orphaned the user's Groq key and reported it as *no key
  configured*. The two constants are separated, retired service names are
  migrated on read and purged on every write (without the purge, clearing a key
  lets the next read migrate it back), and the store sits behind a trait so the
  migration is tested without touching the developer's real secret store. The
  update endpoint stops depending on GitHub's org-rename redirect, which any
  stranger can break by claiming the freed name.
- [0038](0038-a-recording-the-app-permits-is-one-the-pipeline-can-finish.md): a
  recording the app permits is one the pipeline can finish — the capture limit
  is derived from what the provider will accept rather than chosen, and stated
  where it is spent.
- [0039](0039-a-failed-recording-keeps-its-audio-until-the-retry-or-the-sweep.md):
  a failed recording keeps its audio until the retry or the sweep, so a
  transcription that failed is retryable rather than lost.
- [0040](0040-the-assistant-is-one-thing-with-three-doors.md): the assistant is
  one thing with three doors — Draft, the Ask window and the actions on a note
  were being built as two assistants with two models, and the split could not
  serve "write the mail from Tuesday's meeting". One model, one name, one set of
  rules, and a single bounded read of your own notes. Narrows exactly one clause
  of ADR 0029 and answers its four reasons; side-effecting tools stay
  prohibited.
- [0041](0041-translation-is-a-mode-not-a-switch-on-cleanup.md): translation is
  a mode, not a switch on cleanup — a flag that turns the smallest transform
  into the largest one makes the mode indicator lie (ADR 0024), and translation
  needs the profile's words left alone in a way cleanup never did. Auto never
  selects it: it may choose how text reads, never what language it is in.
- [0042](0042-one-surface-owns-every-model-choice.md): one surface owns every
  model choice — a model could be set in five places and the answer to "which
  model is doing this" took four screens. One connection, one row per job,
  grouped by what the job does, plus one tab for what is installed on this
  machine. Records the wrong fix too: a sixth screen for credentials, which made
  it worse.
- [0043](0043-the-orchestrator-has-one-voice-and-that-voice-has-a-body.md): the
  orchestrator has one voice and that voice has a body — the agent window read
  as three agents talking, which argues against ADR 0030. One orb, singular by
  construction, plus an always-on-top notification because Focus and screen
  sharing suppress OS ones. Its sound is a cue on ADR 0010's existing stream.
- [0044](0044-the-effect-line-and-the-handoff-across-it.md): the effect line,
  and the handoff across it — the assistant and the orchestrator cannot merge
  (one ends in a single reducer commit, the other runs for days; one is ours,
  the other is a foreign process), but their surface can. "Write the mail" and
  "send the mail" are one verb apart, so the assistant hands over visibly and by
  key rather than failing. Renames the orchestrator `the desk`, and extends
  ADR 0041's rule: Auto may choose how text reads, never whether something
  happens.
- [0045](0045-everything-recorded-is-one-object.md): everything recorded is one
  object — a dictation, a meeting, an upload, a link and a calendar entry were
  four models of the same thing, and the user had to know the route to find the
  result. One type with `origin` and `state`; `scheduled` is what lets a meeting
  exist before it happens. Upload becomes a state rather than a place, and the
  workspace drops from five entries to four.
- [0046](0046-intake-bridge-reach.md): intake, bridge, reach — one question
  sorts every connector, *does it write anywhere?* WordScript reads what makes a
  context object exist (the calendar, read-only, and it is the only source of a
  speaker's name); everything that writes runs in the desk, which is already an
  MCP client with its own permission model. We build the door into its
  directory, not a second connector surface.
- [0047](0047-a-speakers-name-is-never-in-the-audio.md): a speaker's name is
  never in the audio — source attribution is free, clustering produces a count
  and a separation, and a name comes from the invite, a saved voice or a click.
  `locked` survives the end-of-call re-cluster, or every name typed during a
  call changes after it. Also fixes the meeting copilot's rules: it writes and
  never speaks, and never hints without a citation.
- [0048](0048-a-light-mode-is-not-the-dark-one-inverted.md): a light mode is not
  the dark one inverted — three settings, and `System` is the honest third: not
  a palette but a deferral, resolved against `prefers-color-scheme` at render
  time and re-resolved when the OS changes. The ladder is rebuilt rather than
  flipped, because a dark UI raises a surface by lightening it and a light UI
  cannot (the card is already white). The accent moves to `#b45c00`; the
  identity orange measures 2.1:1 on white and is unusable as text there.
- [0049](0049-the-orb-has-four-states-and-a-pulse-is-none-of-them.md): the orb
  has four states — idle, listening, thinking, speaking — each moving the way
  that state behaves, and none of them pulses. `thinking` is the state the
  pulse was lying about: there is no amplitude there to represent, so a fixed
  period invents one.
- [0050](0050-the-keyboard-layer-and-what-only-rust-can-grant-it.md): the
  keyboard layer and what only Rust can grant it — the shortcut assignment is
  settled in the record so the native work implements rather than invents, and
  the menu bar must mirror what the renderer handles, because a shortcut that
  exists only as a `keydown` handler is invisible where macOS users look.
- [0051](0051-frost-is-a-pair-and-it-is-not-backdrop-filter.md): frost is a
  pair, and it is not `backdrop-filter` — the property is inert in WebKitGTK
  2.52.4 while `@supports` reports it as supported, so it cannot be
  feature-guarded and it fails silently on Linux while looking correct in a
  Chromium preview. The material is `filter: blur()` on the layer behind, the
  receding layers nest, and it applies only to a surface that floats and is
  transient. Carries the measurement that replaced the old ban's wrong reason.
- [0052](0052-the-item-carries-the-inset-so-the-separator-reaches-the-edge.md):
  the item carries the horizontal inset and the stack spans the card, so a
  group's separators reach its edge instead of floating between two margins.
  The guard names every separated stack, which is the maintenance cost of the
  arrangement and is deliberate.
- [0053](0053-a-level-readout-belongs-next-to-what-it-measures.md): a level
  readout appears where the thing it measures is happening and nowhere else —
  it leaves Home, taking its card with it. `wave(n, seed)` is deleted because a
  frozen bar row on a surface claiming to be listening is a fake state. The
  matrix is ported whole rather than as the subset the product uses, with three
  deviations from upstream marked at the point of change.
- [0054](0054-the-rework-lands-as-an-overwrite-because-there-is-nobody-to-migrate.md):
  the settings rework overwrites the shipped surface instead of migrating it —
  no alias map, no coexistence, a replaced area deleted in the commit that
  replaces it. `0.2.2-alpha` has no users, so the continuity machinery the plan
  specified has nobody to serve. The semantic anchors survive because they are a
  runtime contract with a native caller. The decision expires at the first
  distributed build.
- [0055](0055-the-gallery-is-where-the-port-is-judged-and-it-is-one-route.md):
  one design-time route `/gallery` is the acceptance surface for the port, and
  it absorbs the two unlinked routes that already exist. A screen is *ported*
  when it stands in the gallery and *shipped* when it is wired — which is what
  lets a settled 25-screen design land against a runtime that cannot yet answer
  half of it. The gallery imports the product's components and never copies
  them.
- [0056](0056-the-light-schemes-muted-step-was-measured-for-the-first-time-and-missed-aa.md):
  the light scheme's `--fg-muted` measured 4.48:1 on the card the first time
  anybody computed it, and moves to `#7a736a` at 4.68:1 — the dark side's
  distance above AA, not an arbitrary darker value. ADR 0048 asked for this
  measurement and nothing had taken it; the other five light foregrounds are
  confirmed by the same pass. A contrast figure that is stored rather than
  computed stops being true when the colour moves.
- [0057](0057-the-prototype-has-an-expiry-date-and-the-gallery-has-two-halves.md):
  the four surfaces the port runs at once are a state of the port, not the
  steady state. The prototype turns from source into provenance at the end of
  Leg 2 — it is read-only and already overtaken by ADR 0056, so a reader
  treating it as current is reading a document that grows wrong. The gallery's
  Foundations, Components, Motion and Overlay are permanent; its Screens section
  is scaffolding and retires per screen as Leg 4 wires them.
- [0058](0058-a-display-surface-does-not-open-a-device.md): a moving instrument
  is a claimed measurement. A gallery screen draws a waveform, a VU meter or a
  level readout at rest or on one frame of sample data, and never passes
  `active` to a component that would open a microphone. Listed here on
  2026-08-05 by Leg 3; it was filed by Leg 2a and this index missed it.
- [0059](0059-the-gallery-gets-a-chord-because-four-legs-paid-for-a-rebuild-instead.md):
  the gallery is reachable in a built application by
  `Ctrl`/`Cmd`+`Shift`+`Alt`+`G`. ADR 0055's *"one `npm run tauri build` and a
  walk"* does not hold — no window opens `#/gallery` and `tauri.conf.json` is out
  of scope — so four legs paid for a temporary route edit and a full rebuild
  instead. The chord is not a link: nothing names it and no affordance leads to
  it. It is deleted when the gallery gets a window of its own.
- [0060](0060-onboarding-runs-when-the-runtime-cannot-answer-and-it-is-re-runnable.md):
  onboarding is a routing branch in the one window, ahead of the workspace. It
  runs automatically when the runtime reports no usable connection and the flow
  has not been completed or closed, and it is re-runnable from `Settings →
  General`. It stores nothing but that one timestamp: the resume point is
  **derived** from the first step whose precondition the runtime does not
  satisfy, which is what makes it idempotent against a half-configured machine.
  No Skip on steps 1–5; the window's own close is the exit, and a quit at step 4
  leaves steps 1–3 applied because they applied when they were made.
- [0061](0061-the-tab-is-a-state-the-notification-is-the-question-and-neither-replaces-the-other.md):
  the agent overlay's three surfaces are not alternatives. The tab is a state —
  *something is waiting* — and appears whenever a pill exists and a question is
  open; the notification is the question itself and appears when it is not
  already on a focused surface; both may stand at once, and the notification
  offsets above the pill rather than replacing it. Dismissing is *not now*,
  never *no*: nothing is sent to the agent. The resting place a dismissal falls
  to is ADR 0030's tray state, which is decided and drawn nowhere.
- [0062](0062-the-effect-verb-stage-runs-before-the-mode-router-and-a-refusal-is-counted-against-the-verb-that-caused-it.md):
  the handoff's effect-verb stage is Rust, on the transcript, after
  transcription and before the mode router, lexical before it is ever a model
  call, skipped entirely when no desk is configured. Its refusals are counted
  locally and **keyed by the verb that fired**, because "the fix is fewer
  offers" means removing an entry and a single ratio does not say which. Shown
  on Diagnostics, sent nowhere, and the product counts while a person cuts the
  list.
- [0063](0063-a-meeting-has-four-ways-in-one-of-them-watches-the-microphone-and-only-a-press-ends-it.md):
  meeting capture has four ways in — its own hotkey, a calendar offer shortly
  before, a detected call, and `Context → New → Record`. Detection watches
  **which process holds the microphone**, not which applications are running,
  and therefore needs no system-audio capture; the prompt is ADR 0043's
  notification window with a different payload, so it is not a third surface.
  Only an explicit stop ends a capture. Blocked on system audio and echo
  cancellation: Leg 4 skips it.
- [0064](0064-the-translation-window-is-a-view-with-a-pop-out-and-a-conversation-is-kept-only-if-you-say-so.md):
  the live-translation surface is a workspace **view** whose pop-out is the
  drawn window, and a conversation is a context object only if the session opts
  in — opt-in and consent are one field, and opting out leaves no file. One live
  conversation at a time, because there is one microphone. ADR 0041's mode is
  untouched; the workspace grows a fifth view the day this ships and not before.
- [0065](0065-groq-is-the-only-integrated-lane-and-every-other-one-stays-drawn-and-disabled.md):
  Groq is the only provider WordScript integrates. `AI Models` keeps every lane,
  row and field it draws — nothing is deleted, moved or reworded — and Local,
  Self-hosted and Enterprise are disabled with the `disabled` / `plan` /
  `preview` vocabulary the surface already has, rather than left looking
  settable. A scope decision, not a capability claim. **One point is left open
  on purpose**: `local_preview` exists in the runtime and the status strip reads
  it, so whether the Local lane is disabled only on this screen or everywhere is
  asked before anything is greyed out.
- [0066](0066-help-is-a-small-modal-with-three-links-which-is-what-finally-mounts-the-row.md):
  the sidebar's `Help` row opens a small modal with Discord, GitHub and the
  documentation, and is mounted in the commit that builds it. Three legs refused
  to mount it because there was nothing behind it; this is that something. The
  search field beside it stays unmounted — the prototype's `Cmd`+`K` palette was
  never ported and that is separate work.
- [0068](0068-the-communication-style-is-a-tab-in-the-profile-and-the-legend-states-its-scope.md):
  ADR 0023's per-profile communication style — register, length, style rules,
  writing sample — is running in the runtime and has no surface anywhere: the
  prototype points at the profile for it three times and never draws it, so the
  port carried a faithful absence and one profile on the owner's machine has a
  non-default register nobody can see. It becomes a sixth profile tab, `Style`,
  in second position, carrying one card `Communication style`, and the Legend on
  Defaults gains a fifth row stating its scope — which supersedes the placement
  half of `../archive/plans/settings-rework.md` §11.4 while meeting what §11.4 protected.
  Rejected: beside the Rewrite job on AI Models, which is machine-scope for a
  profile-scope value (ADR 0024).
- [0067](0067-local-preview-is-treated-as-an-unpublished-provider-everywhere-it-is-offered.md):
  answers the point 0065 left open, asked of the owner before anything was
  greyed out. `local_preview` is treated like every other unpublished provider
  **everywhere it comes up**, because it is not finished — so a surface that
  OFFERS it makes it inoperable (the lane segment, the provider chips), a
  surface that REPORTS what is running states it and marks it (`Local runtime ·
  <model> · preview`), and a diagnostic prints the runtime identifier unchanged.
  Nothing is removed from the runtime.
- [0069](0069-help-is-a-popover-over-its-own-row-and-it-carries-four-addresses.md):
  supersedes the FORM and the COUNT of 0066. Help is a popover anchored to its
  own sidebar row rather than a modal, and it carries four addresses instead of
  three. Everything else 0066 decided still holds, including the rule that a URL
  which does not resolve yet may not be drawn as a working link -- the
  documentation entry is drawn with `No address yet`, because leaving it out
  would teach the reader that WordScript has no documentation.
- [0070](0070-history-switches-which-of-a-records-two-texts-its-rows-carry.md):
  a history row carries one of the record's two texts and a segment in the
  toolbar says which. `Written` is the delivered text, `Heard` is the
  recogniser's own words; 92 of the owner's 174 records differ between the two,
  so the pair carries signal rather than duplication. It is the second recorded
  departure in `npm run port:diff`.
- [0071](0071-translate-ships-ahead-of-its-phase-on-the-lane-the-product-already-runs.md):
  ADR 0041's Translate mode is built now, before the Phase 4 it is filed under,
  on the chat model the product already runs. Two screens were shipping a
  control that could not act, and a mode with a mediocre model beats one that
  does not exist -- the quality argument in Phase 4 is an argument for a better
  model, not for no mode. The four settings take the scope the drawing gives
  them literally: target language and the profile-words switch are the profile's,
  the same-language behaviour and the address form are the machine's.
- [0072](0072-the-target-language-is-set-in-the-profile-and-only-stated-on-ai-models.md):
  corrects 0071's placement. The two per-profile Translate settings are edited on
  `Profiles -> Defaults`, under the mode select that makes them apply, and only
  stated on AI Models with the `Per profile` tag as the door -- which is the rule
  0068 had already set for the communication style and 0071 followed the drawing
  past. They are hidden rather than disabled under another mode: a target
  language under Cleanup is not un-ready, it is irrelevant, and that is the one
  place ADR 0065 does not apply.
- [0073](0073-the-overlay-names-the-target-language-in-two-letters-beside-the-mode.md):
  the overlay states the Translate target language as a two-letter chip beside
  the mode chip, pressable to step through the languages. `Translate` is the one
  mode name that is half an instruction, and two letters are the other half.
  Inside the pill's flex flow rather than as a third side tab -- the left slot is
  the one-shot learned-word tab and the right is the auto-stop, and the rule
  those two were built on is one per side so neither yields. Affordable in the
  flow because every offered language has a two-letter code, which makes the
  width fixed rather than content-dependent; the width itself is a native-host
  measurement. A deliberate, owner-directed exception to relay rule 5.
- [0074](0074-a-transcript-is-a-markdown-file-and-the-history-record-is-its-index.md):
  the drawing's promise is kept -- every transcript that produced text is also a
  Markdown file under `~/WordScript/transcripts`, written from the one funnel
  every history record already passes through, so "on every path" is structural
  rather than a rule five callers obey. `history.json` stays the index and
  carries the path; delete, clear and retention take the file with the entry, and
  the runtime deletes only paths an entry named. One file per transcript rather
  than one per day, because the runtime then creates a file once and never edits
  one. The case for retiring the promise is stated and answered in full.
- [0075](0075-a-retry-re-runs-the-mode-the-record-ran-and-the-dispatch-has-one-implementation.md):
  the mode dispatch moves out of the pipeline closure into
  `core::mode_router::apply_mode_transform`, and the history retry uses it -- so
  a retried Agent, Prompt Enhance or Translate record re-runs its own job instead
  of coming back as a conservative cleanup. The record grows `effective_mode`,
  what actually ran, because the stored work mode keeps `auto` for an Auto record
  and could not answer. An Auto record has its Auto resolved again rather than
  repeated.
- [0076](0076-the-decision-inbox-receives-the-one-question-the-runtime-can-already-ask.md):
  Home's decision inbox receives the one of ADR 0044's three sources the runtime
  can already ask about -- a delivery that fell back to the clipboard or to the
  scratchpad -- and draws nothing when none is standing, which is the drawing's
  own rule. Dismissing is recorded on the RECORD rather than in the window, so a
  question answered once does not come back with the next launch. The desk
  (Phase 8) and a meeting's open questions (V2) still have no receiver and the
  banner says so.
- [0077](0077-a-transcripts-filename-is-a-title-the-model-writes.md):
  answers the objection 0074 raised against itself. The chat model already
  configured writes a two-to-six word title for each transcript and that becomes
  the filename, so the folder can be scanned rather than only walked. The call
  is made after delivery, once, with a four-second timeout, and any failure
  falls back to the first-words slug -- the title decides what a file is called,
  never whether it exists. Passed into the history funnel as an argument, so the
  one synchronous place a file is created stays the only writer.
- [0078](0078-a-history-row-opens-with-what-the-record-is-called.md):
  ADR 0070's segment gains a third reading, `Title`, and it is the default -- a
  list of 174 rows each opening mid-sentence cannot be scanned, and 0077 had
  already produced the name. `Heard` stays because the job it was added for has
  not gone away. The title is stored on the record rather than read from the
  file, so a list render never touches the disk. `Title` falls back to the
  written text and `Heard` still does not, which is one rule stated twice.
- [0079](0079-a-capture-states-how-much-of-its-own-clock-it-kept.md):
  a capture computes how much of its own clock it kept and travels with the
  answer. Untrimmed audio against the effective wall clock, with paused
  stretches subtracted and a stream rebuild deliberately not excused; the
  threshold is 10 %, derived from a gap in 634 measured captures that runs from
  7.0 % to 12.0 %. Reported in the runtime log, on the history record, and as a
  tab beside the result pill at delivery time -- a statement, not a control,
  because audio that was never captured cannot be recovered. `not_measured` is
  kept distinct from `intact`. It reports the defect; it does not fix it.
- [0080](0080-wordscript-removes-its-own-prompt-from-the-transcript-and-never-restores-what-it-displaced.md):
  the one hallucination class that can be removed with certainty, because we
  know the string we sent. Matching is a normalised in-order subsequence rather
  than a literal, since the echo turned out to be a paraphrase; the unit is the
  sentence, which is what separates a leak from the owner quoting the leak. It
  never restores the displaced words -- a wholly-echoed transcript comes back
  empty -- and `raw_transcript` keeps the leak so the rate stays measurable.
  Does not revert ADR 0036's floor, which would trade a measured defect for an
  argued one.
- [0081](0081-the-recogniser-output-is-repaired-before-any-mode-sees-it.md):
  both recogniser-side repairs live in one stage ahead of the MODE BRANCH,
  because Agent, Translate and Prompt Enhance branch away from the cleanup path
  and the case that made it urgent reached an agent. The address repair reads
  grammatical mood against a closed table -- the suffix rule it replaces flags
  45 tokens of which 3 are the defect -- and is **German-only by declaration**,
  gated on the detected language, while the echo strip is language-agnostic by
  construction. An unestablished language declines the repair.
- [0082](0082-an-editor-is-a-panel-that-unfolds-under-its-own-row.md):
  the five controls that had been drawn, disabled and carrying *"no editor is
  drawn for this yet"* since Leg 4c get one, and it is the panel `RawPanel`
  already opens under a list row rather than a dialog over a surface that is
  already a modal sheet. The record also settles the shape those actions are
  reached in, across BOTH pane screens after the owner named the inconsistency
  in the running app: adding is `+` in the head of the list it adds to, a row's
  actions are a right-click with a compact menu of verbs, an icon on a row is
  only for what you repeat positionally, and **deleting always asks at the
  row** -- a rule used to go on one click while the profile holding it asked
  twice. A swipe-to-reveal was raised and rejected with reasons. Costs
  `profiles` two measured differences and `context` none.
- [0083](0083-a-capture-reports-the-cadence-of-its-own-input-stream-and-the-level-it-was-given.md):
  filed by the core-hardening track, and **missing from this index until
  2026-08-11** — added by the speech track, which found the gap while checking
  its own entries resolved. ADR 0079 made a short capture say so and
  deliberately not why; this is the *why* instrumentation. `CallbackCadence`
  counts every callback and every stretch over **200 ms** in which the stream
  delivered nothing — roughly ten missed ALSA periods, far outside scheduling
  jitter and far below the multi-second gaps the defect implies. **Nothing
  writes to the log from the audio callback**: gaps accumulate under the lock
  the callback already takes and flush at `stop_native_capture`.
- [0084](0084-the-defect-that-needed-no-dictation-gets-a-binary-that-needs-no-app.md):
  filed by the core-hardening track. `capture-soak` opens the device WordScript
  opens and holds it open for hours, so the loss in
  `capture-loses-half-the-recording.md` can be reproduced without anybody
  speaking into it.
- [0085](0085-a-count-that-points-at-three-tabs-opens-the-list-instead.md):
  the profile health flag's click had no destination because its four kinds
  point at three tabs, so it opens the flags themselves -- one row per flag with
  its sentence and the door to the tab holding its cause, `bias_policy_weak` to
  **Defaults** rather than the Words the Leg 7 record named. Each row
  acknowledges through a per-profile set the runtime has read since before the
  port and nothing had written since Leg 3 deleted `PromptsTab.tsx`, and the flag
  carries the resulting `level` as its tone. **Profiles leaves the gallery in the
  same commit** (ADR 0057): 26 measurements become 25, all at structural 0 |
  style 0.
- [0086](0086-the-field-that-was-waiting-for-a-measurement-got-one-three-legs-ago.md):
  `duration_ms` was the one §11.23 frontmatter key with no source, and its own
  note said it would go in when the record grew a duration. ADR 0079 gave it one
  three legs earlier. It is `capture_integrity.recorded_seconds` -- the audio
  rather than the clock -- and absent rather than zero wherever nothing measured
  one.
- [0087](0087-the-title-call-is-a-job-and-belongs-on-the-job-list.md):
  ADR 0077 spends a model call per dictation and no screen says so. It belongs on
  AI Models' job list by that screen's own rule, and is **not drawn yet** because
  a ninth row was measured at **structural 18 | style 6** on a screen that stands
  at 0 | 0. The owner ruled the call deliberate in every mode, Verbatim included.

- [0088](0088-the-row-that-states-is-a-flat-row-and-costs-a-third-of-what-was-priced.md):
  the row ADR 0087 owed, drawn. A row that states rather than sets does not open,
  because `<details>` onto an empty body is the affordance that opens nothing —
  so it is a flat `JobNone` and costs `models` **structural 6 | style 6**, not
  the 18 | 6 priced for the `LaneJobRow` shape that trial had measured. An
  appended flat row shifts no sibling path.

- [0089](0089-a-registered-command-with-no-caller-is-triaged-by-why-it-lost-one.md):
  the sweep of `invoke_handler` against `invoke(` found **fourteen** caller-less
  commands, not two. They triage into superseded (deleted — six, including the
  two overlay resize commands that would reintroduce the ghosting), owed a
  surface (kept — ADR 0065 defers it), lost capability (kept and listed — the
  text-rules import/export a shell overwrite orphaned) and command shell only
  (kept — the function is alive). Corrects Leg 8's premise: the acknowledge
  commands never had a caller in any commit.

- [0090](0090-export-acts-on-a-thing-import-creates-one-so-they-are-not-drawn-as-a-pair.md):
  the lost text-rules capability gets its surface, and the pair is split because
  **export acts on a thing and import creates one**. `Export rules` is the fourth
  verb on the profile's row menu, where it writes the row the menu opened on;
  import is on Privacy & Data and lands as a new profile, because the profile it
  makes does not exist yet and has no row to act on. Also: the ≤ 90-character
  one-line copy budget is a function of the control's width — a row with a
  `Select` plus a button has roughly thirty characters, and 79 drew three lines.

- [0091](0091-the-session-commands-are-the-sidecars-contract-and-the-sidecar-is-gone.md):
  the four caller-less session commands are the **Python sidecar's IPC command
  set**, carried into the Tauri rewrite by the same commit that made them
  unnecessary. Removed; `abort_native_session` stays because abort is the one
  lifecycle transition a user makes. `complete_native_session` also emitted only
  the mirror channel and dropped the session-id guard, so any caller would have
  hung the overlay until ADR 0018's fallback fired.

- [0092](0092-a-copy-budget-belongs-to-a-row-and-a-row-does-not-know-its-own-width.md):
  the one-line budget **measured** in WebKitGTK across 123 rows, not asserted.
  One line holds between 12 and 73 characters depending on the control, `≤ 90`
  is wrong for every case, and 62 of the 74 over-length rows are the prototype's
  own copy — two lines is the drawing's norm. Three rows were port-authored and
  share one mistake: **a row must not print the runtime text its own control
  displays**, because `.ws-sel` is `width: auto`, so that text sets the width it
  then has to fit inside.

- [0093](0093-the-sweep-that-found-fourteen-missed-three-because-it-looked-for-the-wrong-absence.md):
  `read_diag_log`, `clear_diag_log` and `overlay_open_devtools` lost their caller
  in the same commit as the text rules and were **not** among ADR 0089's
  fourteen, because a command whose name survives in a test mock looks called to
  a name-grep. `append_diag_log` still writes a log nothing can read. Recorded,
  not deleted: the devtools door has no shell substitute and the other two do.

- [0094](0094-the-provider-contract-is-a-trait-with-a-registry-and-the-axis-splits-per-role.md):
  the closed `enum ProviderId` dispatch does not survive ten providers — two
  arms in eight functions becomes eighty. Three traits plus a registry;
  a provider that cannot serve a role **does not implement it**, so the absence
  is where the compiler can see it. And the provider axis splits per role: a
  resolved default plus a sparse override per job, because Anthropic
  transcribes nothing and one `provider` field cannot say so.

- [0095](0095-a-streaming-recogniser-stands-beside-the-batch-one-and-its-first-implementation-is-a-turn.md):
  streaming sits **beside** batch and never reaches the session reducer, so
  ADR 0018/0019 are untouched. `Partial`* then exactly one `Final` per
  utterance — and the **first implementation emits no partials**: a segmenter
  marks the turn, the adapter transcribes it as a file. Turn boundaries and
  partial results are separate requirements, and the two waiting surfaces need
  different ones.

- [0096](0096-every-drawn-lane-gets-an-adapter-and-groq-stops-being-the-only-one.md):
  supersedes ADR 0065. Every drawn lane gets a real adapter, documented before
  it is written. The three terms that carry over: the UI does not change, an
  un-integrated lane stays inert **and says so**, and the screen keeps its
  banner until it is whole. ADR 0065's open `local_preview` point is
  **dissolved rather than answered** — and returns as written if the build-out
  stalls with Local unbuilt.

- [0097](0097-speech-gets-a-second-output-stream-on-a-device-the-user-picks.md):
  extends ADR 0010 without weakening it. A second, named output stream for
  speech on a device selected by name, because a cue is 300 ms and pre-empts
  while an utterance is seconds and must not be cut. Output enumeration mirrors
  `list_native_input_devices`; the enumeration is the small part and the routing
  is not.

- [0098](0098-the-recogniser-goes-deaf-while-the-machine-speaks-and-that-stretch-is-not-a-shortfall.md):
  a runtime mute is a **third state**, beside the user's mute and the user's
  pause. The obvious primitive is the wrong one: `muted` is a *level* mute and
  does not stop recording — `paused` does, and is also what `effective_elapsed`
  subtracts. A deliberate deaf stretch must come off that clock, or every spoken
  reply pushes a conversation toward ADR 0079's `short` verdict.

- [0099](0099-the-direction-of-a-turn-is-read-off-the-recogniser-never-off-a-button.md):
  a turn's direction is whatever the recogniser said it heard, matched against
  the session's pair; **no match leaves the direction where it was and says so**
  rather than silently turning the turn around. Not to be confused with
  `hallucination_detect.rs`'s language switch, which is quality control on one
  finished batch — wiring them together would make a conversation's normal
  behaviour look like a hallucination. The reliability half stays a measurement.

- [0100](0100-the-window-family-is-a-class-with-user-owned-geometry.md):
  `DESIGN_SYSTEM.md` names a five-member window family and **none of the five
  exists** — three windows are declared statically and there is no
  `WebviewWindowBuilder` in the tree. The class is defined by who owns the
  geometry: the user, by dragging, remembered. That is not the path ADR 0089
  abandoned, which was *content height driving repeated `set_size`* — and no
  generic resize command returns.

- [0101](0101-the-translation-window-runs-the-translate-mode-and-gains-no-mode-of-its-own.md):
  closes the **second** of ADR 0064's two open points, answered by the owner:
  the window runs `ProcessingMode::Translate` and there is no eighth mode,
  because a second one would be redundant. What the surface changes is its
  inputs — the target language comes from the session's pair rather than the
  profile — not its transform. The cycle keeps seven entries; a window is not a
  mode. ADR 0064's **first** point, whether a view plus a pop-out is enough
  interaction at a table, stays open.

- [0102](0102-a-subscription-is-a-second-way-to-pay-for-openai-text-and-openai-is-the-only-vendor-left-where-it-is-allowed.md):
  OpenAI's Cloud row accepts a **second credential kind** — an OAuth token set
  against the user's ChatGPT plan — beside the API key, which stays the default.
  The upstream that credential reaches serves no transcription and no synthesis,
  so it is admissible for the five chat jobs and inadmissible for the three
  speech jobs and `voice`. **No other vendor gets it**: Anthropic forbade it on
  2026-02-19 and enforced on 2026-04-04, Google suspended paying accounts in
  February 2026, and the rest sell no subscription. Auth is a native Rust
  OAuth + PKCE flow, not a bundled sidecar.
- [0103](0103-the-sweep-only-ever-asked-which-command-has-no-caller-and-the-other-direction-is-the-one-that-breaks.md):
  The caller sweep has always asked which registered command has no `invoke(`,
  and every answer is dead weight. Run in **the other direction** it found
  `load_transcription_history` — invoked by the overlay's *Retry from the
  recording*, registered nowhere, and never registered: the control has rejected
  on every press since `1fda91d`, the commit that kept the audio so a failed
  dictation could be retried. The sweep is now two directions, the caller one
  first, and **it must span lines** — a line-based grep reported five live
  commands as orphans because their name sits on the line after `invoke(`.
- [0104](0104-the-window-is-a-thousand-pixels-the-layout-gets-eight-hundred-and-the-minimum-is-never-reached.md):
  The workspace lays out at **800 CSS px** while `tauri.conf.json` declares 1000
  and a minimum of 880, because the display scale is 1.25. The config's pixels
  and the stylesheet's are different units and the scale is between them, so the
  declared minimum is never reached. Every copy budget in ADR 0092 and after it
  is a budget at a CSS viewport, which is what a measurement is now quoted with.
  Also: ADR 0092's defect class is narrower than its sentence — the prototype
  itself prints a badge's text in the hint beside it.

- [0105](0105-a-credential-is-resolved-per-role-and-a-job-never-inherits-one-its-role-cannot-use.md):
  ADR 0094 states its credential rule for the *overriding* job, so a following
  job inherits the default's — which ADR 0102 broke the same day by making the
  kind per role. **"Follow the connection" follows the provider, never the
  credential.** A role with no credential makes the job inert and names what is
  missing, rather than borrowing the other kind the same provider holds: that is
  the role-shaped version of the host mistake ADR 0094's security rule forbids.
  The store is keyed `(provider, role, kind)`, so clearing chat cannot clear
  speech.

- [0106](0106-the-drawn-matrix-states-an-intent-the-runtime-answers-a-capability-and-the-seam-between-them-is-not-built.md):
  corrects a claim ADR 0094 made and `SPEC.md` repeated. `ProviderCapabilities`
  is mirrored and returned and **read by nothing** — `Models.test.tsx` mocks it
  as `{}` and the suite passes, while every capability answer on the screen comes
  from the hand-maintained table in `data.ts`. The drawing states an intent, the
  runtime answers a capability, and the code making the second govern the first
  is a step **before** the first adapter, **asserted by a test rather than by a
  sentence**.

- [0107](0107-an-utterance-is-a-recording-and-the-stream-that-carries-a-conversation-outlives-every-one-of-them.md):
  supplies the capture half ADR 0095 assumed and did not price.
  `start_native_capture` couples the cpal stream to the recording and
  `stop_native_capture` takes one `max_samples`-bounded buffer whole, so no
  segment can be lifted out of a running capture. **The stream is held for the
  session and a turn is a recording** — which keeps `CaptureIntegrity`,
  `capture_budget` and `transcribe_audio_file` applying per turn unchanged, and
  makes `max_samples` a turn ceiling rather than a session one.

- [0108](0108-a-machine-wide-setting-drawn-on-a-surface-that-stands-more-than-once-needs-an-echo-the-runtime-does-not-have.md):
  ADR 0097's routing is machine-wide and is drawn inside a window ADR 0064 lets
  stand several times, in webviews that share no state. The config is the only
  holder, **a write is announced on a channel the runtime does not have**, and
  the card states its own scope. The event is scrubbed by `without_secrets()`
  like every disk write, because a second path out of the runtime is how a
  secret leaks.

- [0109](0109-voice-is-the-ninth-job-and-no-adapter-lands-before-the-row-that-operates-it.md):
  `voice` becomes the ninth `JobKey` — bookkeeping, since ADR 0042, 0064, 0094
  and 0102 all already write contracts against it. **Where** the translation
  voice sits on `AI Models` stays the owner's question. And the rule the
  build-out order needed and did not have: **no adapter lands before the row
  that operates it**, which gates ADR 0096's second step and moves Local up if
  the answer is not there when OpenAI lands.

- [0110](0110-streaming-is-a-property-of-a-model-not-of-a-provider-and-openrouter-was-never-the-exception.md):
  corrects ADR 0094's capability axes. It called OpenRouter *"the exception that
  proves the axes are per provider"* — **it is a constant nowhere.** One OpenAI
  key serves `gpt-4o-transcribe` (streams) and `whisper-1` (documented as not
  streaming); the local lane repeats it with `runtime: "online"` on two of four
  Parakeet models. **The role is the provider's and the shape is the model's**:
  `speech_synthesis` stays provider-level, `transcription_streaming`,
  `reports_detected_language` and `synthesis_streaming` move to the model. This
  repo's own survey held the evidence before the axis was chosen.

- [0111](0111-the-sidebar-has-two-widths-and-the-layout-measures-the-column-it-is-drawn-in.md):
  answers the finding ADR 0104 closed with — *"the workspace has no width
  breakpoint at all"*. The sidebar gains a **56 px rail** beside its 232 px
  column, chosen by its toggle (a preference, stored in
  `AppConfig.workspace_nav_rail`) or by a window narrower than **760 CSS px**
  (state, stored nowhere). And because the content column is now the window
  minus a sidebar of one of two widths, **every responsive rule measures the
  column it is drawn in** — `@container ws-column`, carried by `.ws-content`,
  the sheet's scroller and a pane's detail column, nearest one winning. Three
  tiers: 620 px drops the inset, 460 px stacks the row and collapses
  fixed-track grids, because **a fixed grid track does not degrade, it
  collides**.

- [0112](0112-a-migration-with-no-installation-behind-it-is-ballast-and-the-import-door-is-not-the-config-door.md):
  removes the on-disk compatibility layer instead of carrying it. Stage A3 had
  to hold **three** layers over one API key at once to re-key it safely, and
  `docs/STATUS.md` says there is nothing behind any of them — **no published
  versioned releases**, which `check_app_update` reports honestly. So a path
  that exists only to read an older *local* stored shape goes, together with its
  field and the tests that hold it. **Three lookalikes stay**: normalization,
  which canonicalizes every value including a fresh one; tolerance at a boundary
  where something foreign arrives — an imported archive, an IPC payload, a
  shortcut string from the UI; and a name that says *legacy* about a state
  rather than a format. **The import door is not the config door**, which is why
  `stt_hints` survives as a field a foreign document may carry while the
  migration that rewrote this machine's profiles does not. The window closes at
  the first published release, and the record says so rather than becoming a
  precedent.
- [0113](0113-the-openai-compatible-audio-shape-is-already-in-the-tree-and-it-reaches-two-more-lanes-for-a-base-url.md):
  makes the OpenAI-compatible audio and chat shape one implementation
  parameterized by base URL rather than one per vendor, and gives the
  Self-hosted lane the three listening jobs. The finding is in this repo's own
  code: `GROQ_API_BASE` is `https://api.groq.com/openai/v1` and `groq.rs:407`
  posts to `{GROQ_API_BASE}/audio/transcriptions` — **the one integrated cloud
  adapter is the OpenAI shape with a Groq host.** Two claims in
  `docs/PROVIDERS.md` were corrected to get here, both the same mistake: a page
  read correctly and a *"not"* written from it. A free base URL takes the
  donor's `isSecureEndpoint` rule — HTTPS **or** a private host. Self-hosted
  *synthesis* was not read and is not claimed.
- [0114](0114-a-voice-provider-synthesises-through-one-method-and-streaming-grows-beside-it.md):
  gives `VoiceProvider` its first method. ADR 0094 declared it empty because no
  vendor shape had been read; fourteen have now been, across four protocol
  shapes, and they agree that synthesis takes text plus an identifier plus a
  format and returns audio. So **one method, `synthesize_speech`**, and
  streaming grows beside it when a transport and a caller exist — the order
  ADR 0095 already set for recognition. The voice is an optional field because
  Azure puts it inside the model id and ElevenLabs beside it. The method
  produces audio; ADR 0097 and ADR 0098 own what plays it.
- [0115](0115-a-model-name-is-a-dated-row-in-one-catalogue-and-neither-runtime-spells-it-alone.md):
  moves model identity into one versioned data file that Rust reads through
  `include_str!` and TypeScript imports, held by a test — the shape
  `regression_transcripts.json` plus `core::regression_corpus` already has.
  Today a model id lives in three uncoordinated places and open disagreement 5
  records that they have drifted. **Every lane keeps a free-typed id** beside
  the list, because a catalogue is a snapshot. **The catalogue is not
  `ModelCapabilities`**: one records what a vendor documents, the other what an
  adapter asserts, and a catalogued-but-unadapted model answers `unknown`.
- [0116](0116-a-vendor-comes-in-because-it-serves-a-job-better-and-its-own-module-needs-a-reason.md):
  the admission rule for vendors. Only five of the ten drawn vendors transcribe,
  and the four best at it were an aside headed *"for completeness"* — while
  `known-issues/stt-prompt-leaks-into-the-transcript.md` stays open because
  **Whisper's only bias channel is prompt text in the decoder context**, the
  limitation ADR 0017, ADR 0080 and ADR 0081 all exist to contain. Deepgram,
  ElevenLabs and AssemblyAI bias through a parameter that never becomes decoder
  text. So they come in — and **a vendor gets its own module only for a reason
  OpenRouter cannot already answer.** Surveying is not drawing is not building.
- [0117](0117-azure-speech-is-a-cloud-credential-not-a-second-ladder-on-azure-openais-enterprise-row.md):
  files Azure Speech (MAI-Voice-2) on **Cloud**, not on the Enterprise row Azure
  OpenAI owns. Different host, header, body format, resource and key; no
  deployment and no tenant, which is what this repo's own lane definition makes
  the deciding test. It is the same relationship Polly has to Bedrock, and the
  shared brand is what makes the wrong answer look right. The direct adapter is
  **optional** — OpenRouter already serves `microsoft/mai-voice-2` — and buys
  exactly one thing: SSML, and the eighteen emotion styles the two German voices
  carry.
- [0118](0118-the-speaking-set-is-complete-and-the-four-vendors-openrouter-does-not-carry-get-their-own-modules.md):
  answers ADR 0116's test per vendor and ADR 0117's *optional*, on the owner's
  instruction that the palette is offered whole — **the second time *no half
  measures* has widened a scope**, after ADR 0096 did it for the lanes.
  Cartesia, Bland and MiniMax get modules because OpenRouter does not carry
  them; **Azure Speech gets one because OpenRouter carries it flattened**, and
  SSML is where `mstts:express-as` and the eighteen German styles live. The
  build order follows a **measurement on this machine**, not the vendors' pages,
  because not one of them publishes a figure this repo will repeat. Cartesia's
  3000 ms default buffer is named in advance as the trap it is.
- [0119](0119-the-speaking-group-has-two-rows-because-a-persona-and-a-channel-are-not-the-same-job.md):
  answers the drawing question ADR 0109 left with the owner, who delegated it.
  **Two rows**: the desk speaks *as* WordScript (ADR 0043's one voice, one
  body), the translation speaks somebody else's words in a language that is by
  definition not the user's — different personas, different languages
  (8 to 70+ across the candidates), different latencies, different budgets. So
  `JobKey` gains `voice` **and** `translation_voice`, both on the `Voice` role
  and one credential. **One row for translation, not one per language**: the
  route is per language (ADR 0064), the model is not. It also names a defect —
  `Translate.tsx` already sends the user to a group whose only row is about
  coding agents.
- [0120](0120-a-vendor-serves-its-model-ids-and-the-catalogue-keeps-the-columns-no-endpoint-answers.md):
  answers the owner's maintenance objection to ADR 0115 — eighteen vendors
  renaming on their own calendar is not worth curating by hand — and finds the
  objection right about volume and wrong about substitution. **`/models` serves
  the id and none of the other columns**: not role (`groq.rs:774` already says
  it), not streaming (ADR 0110 put it on the model axis), not languages. Azure
  has no listing endpoint by construction. So the catalogue keeps the typed
  columns and **shrinks to what the build has a position on**, a live fetch
  merges the long tail on settings-open, and a fetched id with no row answers
  `Unknown`. A failed fetch falls back to the catalogue, never to an empty
  picker.
- [0121](0121-the-local-lane-is-named-for-what-it-does-and-its-release-status-stays-on-the-badge.md):
  renames `local_preview` to `local` everywhere it is spelled, including the
  serialized provider id and the `local-preview-*` profile prefix. **A release
  status belongs on the badge, not in an identifier** — ADR 0067 stated it once
  with the preview badge, and stating it a second time inside a serialized
  string is why the id would have to change when the status does. The badge
  stays until Phase 5; ADR 0067's presentation rule is untouched. No
  compatibility alias, on the owner's instruction and because A5 removed every
  on-disk compatibility path days earlier.
- [0122](0122-in-app-model-installation-is-two-mechanisms-behind-one-surface-and-only-one-set-of-files-is-ours.md):
  builds the installation ADR 0042 drew and never got, and finds that its
  *same disk, same runtime* reasoning holds for only one of the two halves.
  **The local chat lane talks to Ollama** (`127.0.0.1:11434`, `/api/tags`,
  `/api/chat`), which owns its own store, so a `.gguf` placed beside it is
  invisible to it. One tab, kept for the memory argument that survives, and
  **two mechanisms**: WordScript downloads the speech weights, and asks the
  user's server to pull the language ones. The catalogue grows an optional
  install block, `fallback_provider_profiles` stops naming files that do not
  exist, progress travels on its own channel rather than a session one, and a
  download is checksummed before it is renamed into place.
- [0123](0123-a-fact-has-one-list-and-a-track-is-a-directory-not-a-naming-convention.md):
  the documentation set had grown to 208 files with **no index and no board** —
  five disagreeing copies of the doc map, three of the phase list, and nothing
  that said which of three concurrent tracks was running. A fact now has exactly
  one list (`docs/README.md` for the map, `ROADMAP.md` for the phases,
  `IMPLEMENTATION.md` for the tracks) and every other mention is a link. A
  document's **directory** states its lifecycle — `tracks/` for live work,
  `archive/` for closed — so the `HANDOFF_`/`KICKOFF_`/`PLAN_` prefixes are
  dropped. The relay keeps its rules, its index, four leg records and the open
  brief; the other 5,200 lines move to the archive. Paths are corrected inside
  ADRs too, because the append-only rule protects a record's reasoning and not
  a citation that has stopped resolving. Doing it surfaced two live
  contradictions and one commit that belongs to no leg.
- [0124](0124-the-registry-answers-for-the-whole-table-at-once-and-a-vendors-absence-from-it-is-the-answer.md):
  builds the seam ADR 0106 required and takes the command-surface decision that
  record left open. **One `registered_providers()` for the whole table**, rather
  than ten `provider_status` calls that would each read the OS secret store and
  answer eight of ten with an error — and **a vendor's absence from that list is
  how *no adapter* is stated**. The drawn-name-to-runtime-id correspondence
  lives in the seam with a three-direction test as its keeper, because
  `data.ts` may not carry a runtime id and the catalogue may not carry a vendor
  without model rows. Five states rather than three: `pending` claims nothing
  and keeps the surface's own reason, `not_answered` is loud, and an incomplete
  capability block is never nine quiet `false`s. `Models.test.tsx` can no longer
  mock `capabilities: {}` and pass.

- [0125](0125-the-sidebar-transition-is-a-clip-and-a-save-adopts-its-own-answer.md):
  the sidebar juddered on every press, and four faults produced the one symptom.
  **A settled save adopts the config that save returned**, not the last one the
  event channel delivered — `save_config` emits `ready` and then returns on two
  racing channels, so the form was being set back to a config the write had not
  reached yet, and the rail closed, re-opened and closed again inside one 180 ms
  transition. That half reaches every discrete control. **The transition is a
  clip**: the column's children are pinned to the width of the state they are in,
  the head is a fixed band, both marks are mounted and crossfade, and the words
  the rail withholds fade instead of being removed — so the column's edge and the
  toggle riding it are the only things that move. Measured before and after, per
  animation frame.

- [0126](0126-the-second-adapter-shares-a-transport-and-a-store-and-shares-no-policy-at-all.md):
  the first adapter the registry was built for, and where the line between two
  cloud vendors falls. **The transport and the credential store are one
  implementation** — `groq.rs` was already the OpenAI request shape with a Groq
  host, and the keyring differed only by the id in front of the entry name.
  **Every policy stays with the vendor**, and the reason is not tidiness:
  OpenAI documents `verbose_json` for `whisper-1` alone, so a shared default
  would have made every request on its newer models a 400 with no Groq test able
  to catch it. `ModelCapabilities` stops being vacuous here. A model id
  belonging to another lane is substituted onto this one's default; one nobody
  catalogued is a typed override and survives.

- [0127](0127-the-connection-is-a-stored-value-and-every-row-that-names-a-vendor-reads-it.md):
  A4 built a provider axis no surface could set and said so; B1 named it as
  D1's to use. **The Cloud connection is now read from the active profile and
  written back to it**, and the chip row, the credential row and every job row
  read that one answer instead of three literals that agreed only while one
  vendor was registered. The runtime id is stored, never the drawn name; the
  gallery keeps its own state and reads no config. **The per-job override stays
  unwritable on purpose** — the drawn `override` literal decides a row's shape
  and A4 decided a fresh profile overrides nothing, which cannot both drive the
  same branch. Recorded as open disagreement 13 rather than settled.

- [0128](0128-a-drawing-inherited-from-the-demo-gui-is-an-inventory-and-the-config-is-the-answer.md):
  what it means to wire a screen taken whole from the demo GUI, after three
  steps in a row stepped around the same wall. **The drawing is an inventory of
  intent, not a claim about what works** — it was drawn before anyone knew how
  these things would be implemented, so it cannot answer a representation
  question the runtime only just made answerable. Four rules: what works is
  stated from the config; what is unbuilt stays visible and inert with its
  reason, because that list is what the build is steered by; a false sentence is
  corrected; what is missing is added. **The line is what is being claimed** —
  greyed with a sentence shows a possibility and is required, a green `Set`
  badge asserts a stored state and is forbidden. Closes open disagreements 10,
  11 and 13. `port:diff` moves by exactly the one corrected boolean, and the
  ADR 0057 gate turns out to be *write it down*, not *do not touch*.

- [0129](0129-the-provider-choice-belongs-where-the-file-is-and-it-is-the-same-stored-value.md):
  ADR 0128 removed the surface's claim that `upload` overrides to OpenAI and
  left open whether it should. **Neither obvious answer wins: the question is
  asked where it can be answered**, with the file in hand and its size known.
  The donor's upload screen carries the whole stack inline behind a disclosure
  with the resolved answer above the drop zone — *Using Groq ·
  whisper-large-v3* — and refuses a file its lane cannot take. **Nothing new is
  stored**: `providers.overrides[job]` drawn a second time, one resolution door.
  A constraint the runtime can compute greys the option and says why, and
  **never reroutes the audio by itself** — the donor's own fallback target is
  `skip`, so a signed-out user's audio is not diverted. Closes open
  disagreements 6 and 12.

- [0130](0130-a-long-recording-is-a-sequence-of-turns-and-the-ceiling-that-binds-it-is-not-the-upload-size.md):
  how a two-hour meeting is actually transcribed, asked by the owner and
  answered nowhere in the repo — `ROADMAP.md`'s meeting chapter names system
  audio, echo cancellation and the window, and never mentions transcribing the
  recording. **The donor is not the reference for the file half**, because its
  answer is a backend WordScript rules out; **it is the reference for the live
  half**, and its Silero constants are the decision: cut on silence, not on a
  clock. Ten-minute windows with overlap were proposed and refused — a stitcher
  duplicates or drops words at every seam, which is the exact failure class the
  hardening track exists for. **A meeting is C1's turns, not a chunker.** And
  the ceiling that binds it is neither: the default lane cannot stream at all,
  and the notes pass hits a context window nothing in this repo records.

- [0131](0131-every-surface-that-starts-a-job-names-where-it-runs-and-the-drawing-already-decided-more-than-was-read.md):
  ADR 0129's rule generalises — **every surface that starts a job names where it
  runs**, and on all four lanes, not on Cloud with three fallbacks. The rest of
  the record is a correction: **two questions ADR 0130 filed as the owner's were
  already drawn** — live transcription is a `toggle(true)` on the `Meetings`
  row, retention is `Keep the audio` with three options and a lifecycle default
  — and reading the prototype rather than reasoning about it would have found
  both. **Diarization is a third requirement** of the meeting lane beside
  streaming, and **the copilot is a fourth consumer of a model** that no axis
  carries. The donor survey was wrong too: `voxtype` has a complete Rust meeting
  stack, and **two donors converge on ~30 s VAD chunks**, which confirms
  ADR 0130's cut. The context-window answer is **map-reduce over semantic
  boundaries** — the audio is cut on silence, the transcript on topic, both
  refusing the arbitrary cut — and **no donor in this tree implements it**.

- [0132](0132-live-subtitles-are-two-features-and-the-echo-needs-a-partial-that-never-reaches-the-reducer.md):
  the prototype's `Live subtitles` is **two features sharing one word**, and the
  screen says the owner said so. **Captions** read somebody else's audio onto
  their own opaque always-on-top strip — never frosted (ADR 0051 excludes
  exactly this case), two lines rolling, no history — and are blocked on system
  audio. The **Echo** reads your own voice under the dictation pill as a trace
  rather than a surface, one line of tail at two weights, off by default, with
  the only colour in this product that is measured rather than themed. Neither
  is *the meeting live transcript*, which is what ADR 0130 and ADR 0131 meant.
  **The consequence reaches the runtime**: the echo renders partials, and no
  partial may reach the session reducer — compatible, but only if D2 delivers a
  display path beside its result path. **It may paint and it may never commit.**
- [0133](0133-the-gap-was-measured-on-the-far-side-of-our-own-lock.md):
  the capture cadence (ADR 0083) calls `observe` **inside** the mutex guard, so
  the interval it reports begins after lock acquisition — "the callback was
  never called" and "the callback waited on our own lock" are the same number,
  and `signature()` prints the first as `stream_suspended`. Found when the
  defect occurred live on 2026-08-13 and refuted the delta ADR 0084 had pointed
  at: `slowest_emit_ms` is 0 and 5 ms in two of the three failures, so
  `app.emit` is fast while the audio disappears. The cadence now timestamps
  **callback arrival**, reports the lock wait as its own quantity, and
  attributes the loss below the 200 ms threshold — a third of the missing audio
  sat there unaccounted. `capture_soak.rs` takes the same change, because ADR
  0084's premise is that the soak is the app minus a *known* delta. **Nothing is
  fixed by this**: three realtime violations in the callback are named and
  deliberately left in place, because fixing them now makes the next event
  unattributable. The reading is registered in advance, as 0084 did.

- [0134](0134-a-session-ends-in-the-runtime-not-in-the-window-that-shows-it.md):
  **the insert belongs to a window, and `CLAUDE.md` says it belongs to Rust.**
  Every insert call site is an `invoke` from `OverlayWindow.tsx`; after
  `preview ready` the runtime has no deadline and no fallback. The clipboard
  write, the `history.json` record and the Markdown transcript are all created
  inside that insert, so **a window that never returns silently discards a
  finished dictation** — the record id and its file's `created:` stamp are the
  same millisecond as `Native insert event emit done`. Measured across 277
  `clipboard_only` previews: 1.12 s median, p90 2.27 s, but **11.45–115.11 s in
  the 13 whose webview was destroyed mid-preview**, and one transcript lost
  outright to an app restart. The runtime now commits on a **10 s deadline** —
  a safety net, not an abort window, sized so it never fires while the window
  works — and a late frontend commit is a no-op through ADR 0018's existing
  one-commit guard. Stated cost: an abort after the deadline becomes a delete
  rather than a nothing; one of the two aborts on record (at 15.4 s) would now
  land that way. Accepted, because a deleted record is one action to recover and
  an unwritten transcript is none. This also supplies the fallback ADR 0018
  named and owes a reported surface under ADR 0019.

- **0135, 0136 and 0137 have no entry here yet.** They are the Context objects
  track's founding records and its window decision, filed 2026-08-14. Noted
  rather than written for that track, because an index entry summarising a
  record its own track has not finished reading is how a summary drifts from
  what it summarises.

- [0150](0150-the-cue-stream-closes-when-it-is-idle-and-closing-it-does-not-answer-where-it-plays.md):
  **the cue stream was held open for the process lifetime, and ADR 0010 had
  already written down what would overturn that.** Its fallback — *"closing the
  stream after ~60 s idle"* — was registered in 2026-07 against evidence that
  arrived in 2026-08: 283 stream errors against 256 reopens in 2.5 days, many at
  a fixed `:35` offset, plus an app holding a monitor's audio path awake as the
  only sink input in the system. The engine now opens on demand and closes after
  60 s idle; a cold open measures **14–20 ms against the 40 ms of warm-up
  silence it already prepends**, so the open fits a budget that was already
  being paid. The reopen budget counts failures rather than opens, because an
  idle close spending it would silence the app after four dictations in a
  minute. **The second half is a refutation and it is why the ADR exists in this
  shape**: the record had reasoned that a per-cue stream would follow the user's
  default device, and WirePlumber pins a target by application name, so it does
  not — shown with a control probe, and confirmed when the reopened stream came
  back on the wrong device in the product. `pactl move-sink-input`, the relief
  the record recommended, is what *writes* that pin. Where a cue plays is
  therefore named as unfixed and handed to the speech track's F2, which is the
  only step that has `list_native_output_devices`.

## Resolved: the number 0011 was used twice

Recorded 2026-07-29, resolved the same day. Both
`0011-one-decision-surface-per-delivery-mode.md` and
`0011-the-mode-lane-sits-on-alt-not-on-ctrl.md` were filed on 2026-07-27 under
the same number; only the first was listed here until the defect was found,
which is why the collision went unnoticed. Both are accepted and neither is
wrong, so neither could simply be withdrawn.

**Resolution: a disambiguating suffix, not a new number.** The delivery-surface
record is now `0011a`, the mode-lane record `0011b`. Renumbering the second one
to the next free number was the alternative and was rejected: it would have
broken the rule above -- *never renumber an existing ADR* -- and a reader
meeting a bare "ADR 0011" in an older commit, issue or handoff would silently
land on the wrong record with no signal that anything had moved. The suffix
keeps both numbers where they were filed, so an old bare reference still points
at the right pair and merely needs one letter of disambiguation.

Both files were renamed and their title headings changed from `0011` to `0011a`
and `0011b`. That heading edit is the only change made inside either record —
the decision text itself is untouched, because *never rewrite retroactively*
governs the content, not the identifier the record is filed under, and a record
whose heading contradicts its own filename is worse than either.

This is a one-time exception for a filing accident. It is **not** a licence to
file two ADRs under one number: 0018, 0019 and 0020 are filed, the next decision
takes 0021. (As of 2026-08-11 this commit files through **0093**, and **0094
through 0100 are already claimed** by the core-hardening track in the same
working tree — they were sitting there untracked while this leg's checks ran, so
the next decision takes **0101** and this line was stale within the hour it was
written. 0082 through 0100 were filed on one day by two tracks
running concurrently on `main` — the GUI port relay and the core-hardening pass
— which is why a leg claims its number early rather than at the end, and why a
handoff sentence naming "the next free number" is the first thing to go stale.
Grep the tree, not this line: a number is cited in source before its file
lands.)

Reference state after the fix, re-checked 2026-07-29 across the whole repo. The
earlier audit in this section was incomplete -- it claimed every "ADR 0011"
outside the decisions meant the delivery-surface record, and two of them do not:

- **0011a** (delivery surface): `ARCHITECTURE.md`, `REFERENCE.md`, `STATUS.md`
  (two places), `spec/SPEC.md` (two places), `known-issues/overlay-ghosting.md`,
  `CHANGELOG.md` (the overlay surface entry).
- **0011b** (mode lane): `CHANGELOG.md` (the `Ctrl`-to-`Alt` entry) and
  `../tracks/activation-gestures.md` (the migration
  pattern it cites as precedent).

All of them now carry the letter. Cite these two by number **with** the suffix.
