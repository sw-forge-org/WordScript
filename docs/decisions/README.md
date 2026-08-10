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
  half of `SETTINGS_REWORK_PLAN.md` §11.4 while meeting what §11.4 protected.
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
takes 0021. (As of 2026-08-10 the filed range runs through 0073; the next
decision takes 0074.)

Reference state after the fix, re-checked 2026-07-29 across the whole repo. The
earlier audit in this section was incomplete -- it claimed every "ADR 0011"
outside the decisions meant the delivery-surface record, and two of them do not:

- **0011a** (delivery surface): `ARCHITECTURE.md`, `REFERENCE.md`, `STATUS.md`
  (two places), `spec/SPEC.md` (two places), `known-issues/overlay-ghosting.md`,
  `CHANGELOG.md` (the overlay surface entry).
- **0011b** (mode lane): `CHANGELOG.md` (the `Ctrl`-to-`Alt` entry) and
  `handoffs/HANDOFF_activation-mode-gestures-and-defaults.md` (the migration
  pattern it cites as precedent).

All of them now carry the letter. Cite these two by number **with** the suffix.
