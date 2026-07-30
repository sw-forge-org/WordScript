# WordScript Roadmap

Status: 2026-07-25

> This is the canonical phase detail. [STATUS.md](STATUS.md) reports the
> current state; [VISION.md](VISION.md) defines the product direction.

The V1 goal is simple: trigger, speak, receive usable text, recover safely,
and continue working. Each phase must make that path more dependable or more
honest, not merely broader.

## Phase Status

- [x] **Phase 1 - Transcription Bias, Profile Health, Corpus**
- [x] **Phase 2 - Settings Shell Polish**
- [ ] **Phase 3 - Live Preview and Controlled Commit**
- [ ] **Phase 4 - Provider Stack Expansion**
- [ ] **Phase 5 - Local Runtime as a Product Option**
- [ ] **Phase 6 - Guided Setup and Packaging**
- [ ] **Phase 7 - Profile Catalogue and Settings Surface Rework**

Outside this pipeline are Notes, Search, Sync, MCP, assistant identities,
accounts, hosted workspaces, and browser or computer use. They are V2 or later
work and must not dilute V1. Visible Chat, Upload, Notes and Account settings
layouts are previews only and do not change this phase boundary.

Unscheduled work with an open decision gate is filed below the phases, not
inside them — currently one item, a second paste mechanism on Wayland.

## Phase 1 - Transcription Bias, Profile Health, Corpus

**Status:** completed

**Goal:** Prevent profile-driven transcription drift by making bias explicit,
capturing real failures as regression data, and exposing profile health.

**Delivered:**

- `BiasMode` with conservative, manual, and off behavior plus migration.
- Per-profile manual bias controls and a native/UI transcription-bias preview.
- `ProfileHealthFlag::BiasPolicyWeak` and persisted acknowledgements.
- The regression corpus and loader at
  `src-tauri/tests/fixtures/regression_transcripts.json`.
- A Text Rules bias-policy stage that shows effective cloud and local prompts.

**Success measure:** profile bias is inspectable, regression-tested, and does
not silently turn broad context or snippets into transcription prompts.

## Phase 2 - Settings Shell Polish

**Status:** completed

**Goal:** Make the native utility surfaces calmer and clearer without adding
new runtime heuristics.

**Delivered:**

- Tailwind v4, shadcn/ui components, and shared shell primitives.
- Grouped settings navigation, stable content surfaces, and native window
  decorations on every platform.
- Three background layers, a five-step type scale, standard spacing, and
  focused status primitives.
- WebKitGTK performance work: no card shadows or backdrop filters, contained
  scroll surfaces, fixed background attachment, and a slower history refresh.
- Fixed Linux overlay surfaces, KWin support for KDE Plasma 6, and compositor
  reliability fixes.

**Success measure:** settings, diagnostics, and overlay states remain readable
and stable in the native host on supported platforms.

## Phase 3 - Live Preview and Controlled Commit

**Status:** planned

**Goal:** Let a speaker inspect raw and transformed text, the active mode, and
the delivery decision before final insertion.

**Scope:**

- Extend the current `clipboard_only` preview stop to every insert mode.
- Use one native state path: `idle -> capturing -> processing -> preview ->
  commit | cancel`.
- Use `commit_pending_transcription_preview` as the single commit action.
- Show raw versus transformed text and meaningful guardrail interventions.
- Route commit, retry, restore, cancel, and copy actions through native events
  and history.

**Out of scope:** new auto-commit heuristics, a second insertion implementation,
or changed clipboard restoration rules.

**Success measure:** users can make a delivery decision without duplicating the
native insert or recovery path.

## Phase 4 - Provider Stack Expansion

**Status:** planned

**Goal:** Evolve from one production adapter to clear `fast`, `quality`,
`local`, and future `self_hosted` semantics.

**Scope:**

- Add a second production provider through the shared Rust provider contract.
- Reserve `self_hosted` for user-operated remote or LAN services; it is not
  another name for on-device `local`.
- Drive UI capability, setup, and error copy from `ProviderStatus` and
  `ProviderCommandError`.

**Out of scope:** runtime provider switching without save, account binding, or
a WordScript proxy.

**Success measure:** at least two production providers work through the same
settings, diagnostics, history, capability, and error contracts.

## Phase 5 - Local Runtime as a Product Option

**Status:** planned

**Goal:** Turn `local_preview` from expert environment configuration into a
guided on-device runtime lane.

**Scope:**

- Guided readiness and remediation for the runner, STT model, cleanup endpoint,
  and cleanup model.
- Explicit model download or pull actions from approved sources.
- Profile-owned decode and prompt-bias controls with truthful preview.
- Clear fast-versus-quality tradeoffs.

**Out of scope:** non-Whisper engines, distributed local pipelines, and custom
model training.

**Success measure:** a first-time user can configure and use local dictation
without assembling the full runtime from terminal-only instructions.

## Phase 6 - Guided Setup and Packaging

**Status:** planned

**Goal:** Connect installation, permissions, provider setup, and first useful
dictation into one honest path.

**Scope:**

- Ordered onboarding for microphone, accessibility, provider key or local
  setup, trigger, and a test dictation.
- Settings hints that explain the next blocking action while diagnostics retain
  detail.
- Honest release and update status that distinguishes internal drafts from
  published releases.

**Out of scope:** a shipped auto-updater, signing infrastructure, and app-store
delivery.

**Success measure:** an installer-to-first-dictation path works without asking a
new user to discover Diagnostics first.

## Phase 7 - Profile Catalogue and Settings Surface Rework

**Status:** planned

**Goal:** Decide what profiles a person actually needs in daily use, then ship
that catalogue and a settings surface that can carry it.

Recorded 2026-07-29 after the reliability slice (ADR 0015/0016/0017) made
per-profile behaviour observable for the first time. Per-profile cleanup
settings, processing modes and workspace context were verified working in the
native host on the same day; what is left is the *content* of the profiles and
the surface around them, not the mechanism.

**Scope:**

- Rebuild the curated catalogue from scratch. Delete the local profiles and
  reconsider the shipped set from real daily use rather than from plausible job
  titles: which profiles does a heavy writer genuinely switch between, and what
  vocabulary, replacements, snippets and non-profile settings does each one
  actually need.
- Ship `General writing` as a curated blank profile rather than as a purely
  local one. It is currently the only non-curated profile, which made it the
  only one unaffected by the delivery-mode reset — an asymmetry that should not
  exist by accident. A blank curated baseline also gives every install the same
  starting point.
- Rework the settings surface completely. The information architecture is
  usable but the presentation is not, and the profile panels only became
  coherent enough to redesign against once the bias policy was retired
  (ADR 0017).

**Out of scope:** team sync and shared profile catalogues; both stay V2.

**Success measure:** a new user can pick a shipped profile that matches their
work without editing it first, and an experienced user can see at a glance what
a profile contains and what stays global.

## Candidate - A second paste mechanism on Wayland (libei)

**Status:** candidate, not scheduled. Needs the decision gate below before it
becomes scope.

**The honest motivation.** Not "auto-paste is unreliable on the maintainer's
machine". That was measured on 2026-07-30 and does not hold: 37 real `xdotool`
pastes between 2026-07-27 and 2026-07-30, zero portal denials, which
`history.json` confirms independently (19 `direct_paste` entries, all
`pasted: true`, no `fallback_reason`). The 116 denial lines in the runtime log
were `cargo test` fixtures writing into the developer's real log file — see
[known-issues/rust-test-global-state-isolation.md](known-issues/rust-test-global-state-isolation.md).
The perceived unreliability of "Copy and insert at cursor" is far better explained
by the config revert fixed in ADR 0019, which forced profiles back to
clipboard-only on every load.

The real gaps are structural, and they hold regardless of any one machine:

- **Pure Wayland has no auto-paste at all.** The paste chain is empty by design.
- **Hybrid XWayland has exactly one mechanism.** XTEST via `xdotool`. `enigo` is
  the same XTEST request through another binding and refuses while `xdotool` is in
  `PATH`, so there is nothing independent behind it. See
  [PLATFORMS.md](PLATFORMS.md).

**What is already there, and why it cannot carry input.**
`core/portal.rs` requests a RemoteDesktop session (`CreateSession`,
`SelectDevices`, `Start`) and persists the restore token under
`$XDG_RUNTIME_DIR/wordscript/remote-desktop.token`, so the "Control input
devices" dialog should appear only once per user. But every call shells out to
`busctl --user call`, which opens a fresh D-Bus connection per invocation, and a
portal session is bound to the connection that created it. Sequential `busctl`
calls therefore cannot hold a session open, and `execute_insert_request_with_io`
never reads `self.portal_session` at all — the handle only ever feeds the
diagnostics display. This needs verifying against a live session before it is
treated as settled, but if it holds, no amount of wiring on top of the current
transport produces a usable input path.

**Scope, if it goes ahead:**

- A persistent D-Bus connection. This is the actual cost, and both input APIs
  need it: `NotifyKeyboardKeycode` on the RemoteDesktop interface (older, no
  libei) and `ConnectToEIS` + libei (newer). `zbus`, or `ashpd` which wraps it.
- Since `ashpd` is required either way, enigo's `libei_tokio` feature is the
  reasonable form: it brings the input layer too instead of hand-rolling keycode
  mapping. New transitive dependencies: `reis`, `ashpd`, `futures`, `nom`. All
  pinned to exact versions, as with every other dependency here.
- The driver joins `paste_driver_execution_chain` as a genuinely independent
  entry — for pure Wayland as the only entry, for hybrid behind `Xdotool`.
- `docs/PLATFORMS.md` compositor matrix updated with what actually works.

**Decision gate — measure before writing code:** confirm on KDE Plasma 6 that a
restored RemoteDesktop session injects input **without a prompt per paste**.
Prompt-per-paste is precisely why `wtype` and `ydotool` were rejected, and libei
inherits that risk if the restore token does not do its job. If the prompt
returns on every paste, this candidate dies and clipboard-only stays the honest
default.

**Out of scope:** replacing `xdotool` on hybrid sessions, where it is measurably
reliable; and any per-paste privilege prompt, under any mechanism.

**Success measure:** a pure Wayland session on Plasma 6 completes
"Copy and insert at cursor" with at most one authorization dialog for the
lifetime of the restore token.

## Dependencies

Phase 7 depends on the reliability slice, because a profile catalogue can only
be judged once profiles measurably change output. Phase 1 underpins trustworthy
preview and settings work. Phase 4 establishes
the contract needed by Phase 5. Phase 6 comes last because setup cannot be
truthful until the paths it guides are reliable. Phase 3 and Phase 4 can move
independently as long as native provider and session contracts remain stable.

## Maintaining This Roadmap

Update this document when phase order, scope, or completion changes. Keep the
summary in [STATUS.md](STATUS.md) aligned, but do not duplicate phase detail in
other documents. A new architecture decision requires an ADR rather than a
roadmap note.
