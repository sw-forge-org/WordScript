# AGENTS.md -- WordScript

Canonical agent instruction for this repository. `CLAUDE.md` is a filename
symlink to this file so that harnesses looking for `CLAUDE.md` read the same
instruction.

The GLOBAL agent instruction (language, output, workflow, documentation
maintenance, security, the staging principle, the four-layer model, etc.)
lives outside this repo in the sw-labs master under
`dotfiles/.agents/AGENTS.md` and is rolled out to all harnesses. It applies
here unchanged. This file contains only repo-specific content -- primarily
Layer 1 (Spec) and Layer 2 (project-specific workflows) of the four-layer
model.

## Purpose

WordScript is a Tauri v2 desktop product with a React/TypeScript UI and a
native Rust runtime for trigger, capture, transform, insert and updates. It
is built under SW forge, the open-source brand of SW labs, as an open desktop
dictation app that is faster and more honest for heavy writers than generic
voice tools.

## Language

- Agent replies (chat output): see the global `AGENTS.md` language section.
- All repository documentation (this file, `docs/**`, `README.md`,
  `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, ADRs, known-issues,
  handoffs, donors, staging, `.agents/`, `.github/`) is written in
  **American English** so it is legible to any contributor. No German in
  docs. Technical terms, API names and CLI commands stay in English.

## Spec-Layer

- Mode: **Lean** -- a single consolidated spec lives at `docs/spec/SPEC.md`.
  The living overview docs (`docs/ARCHITECTURE.md`, `docs/VISION.md`,
  `docs/REFERENCE.md`, `docs/STATUS.md`) expand on it but do not replace it.
- Current state: Spec created 2026-07-24; last drift check 2026-07-29 (hold to
  talk made strictly momentary: a press below `hold_arm_ms` is discarded instead
  of extended, the microphone still opens on the press edge, and the threshold
  gates all three capture-lane bindings, ADR 0013; and pause/abort moved to the
  release edge for modifier-only bindings so an interrupted chord acts on
  nothing, ADR 0014).
- Decisions: see `docs/decisions/` (append-only ADRs).
- Drift check/sync: the `spec-sync` skill (global, see dotfiles -- not
  duplicated in this repo).

## Setup-Commands

- Install: `npm install`
- Dev: `npm run tauri dev`
- Test: `npm test` (frontend/Vitest) and `cd src-tauri && cargo test` (Rust)
- Build: `npm run build` (frontend) or `npm run tauri build` (full release)
- Lint/Typecheck: frontend tests + `cd src-tauri && cargo check`

These commands are the eval-loop basis for autonomous/agentic runs: without
a working test/lint/build command an agent has no success signal and cannot
iterate on its own.

Bootstrap once per machine:

- macOS/Linux: `bash setup-tauri.sh`
- Windows PowerShell: `powershell -ExecutionPolicy Bypass -File .\setup-tauri.ps1`

## Code-Style

- No comments unless explicitly requested.
- Rust is the runtime owner for trigger, capture, provider, transform,
  insert and recovery. React displays, configures and explains the same
  native state -- it must never reinvent it semantically.
- Typed contracts between UI and runtime are mandatory; no untyped JSON
  intermediate layers that blur Rust ownership.
- shadcn/ui + Tailwind CSS (v4 on `@theme inline` tokens). No generic fonts
  (Inter, Roboto, Arial, Open Sans, system-ui). Native window decorations
  (`decorations: true`) on every OS -- no fake traffic lights.

## Source Of Truth

- Spec (consolidated): `docs/spec/SPEC.md`
- Architecture: `docs/ARCHITECTURE.md`
- Working mode and validation: `docs/DEVELOPMENT.md`
- Product goal and scope: `docs/VISION.md`
- Current product state, open gaps, release status: `docs/STATUS.md`
- Platform support and insert/recovery diagnostics: `docs/PLATFORMS.md`
- Provider limits and mode semantics: `docs/REFERENCE.md`
- Design tokens and UI patterns: `docs/DESIGN_SYSTEM.md`
- UI overhaul plan: `docs/UI_UX_OVERHAUL_PLAN.md`
- Phase roadmap: `docs/ROADMAP.md`
- Release build-up path: `docs/RELEASE_RUNBOOK.md`
- Decisions: `docs/decisions/`
- Completed implementation specs: `docs/handoffs/`
- Frozen donor references: `docs/donors/`
- Living bug documentation: `docs/known-issues/`

## Working Areas

- `src/` for overlay, settings, rebuild lab and UI state
- `src-tauri/src/` for the native runtime core (trigger, capture, provider,
  transform, insert, recovery, sound, config, history)
- `docs/` for the intentionally small documentation base
- `docs/spec/` for the consolidated spec (Layer 1)
- `docs/handoffs/` for completed implementation specs
- `docs/donors/` for frozen donor references
- `docs/known-issues/` for living bug documentation
- `packaging/` for platform-specific packaging (e.g. KWin script)
- `vendor/` for vendored third-party patches (e.g. global-hotkey)

## Project-Specific Skills/Rules

No project-specific skills are needed right now. Global skills
(`spec-sync`, `shadcn-ui`, `frontend-design`, `ui-ux-pro-max`, `web-perf`,
`VibeSec-Skill`) cover the needs. If a skill is needed in more than one
harness, see `.agents/README.md` for the duplication-free pattern.

## Important Notes for Agents

- Do not move new product logic into old sidecar or glue paths. The active
  path is Tauri/Rust; the Python sidecar is no longer the reference.
- The UI must show runtime truth; no fake states, no fake readiness.
- Hotkeys, capture, session orchestration and insert reliability stay Rust
  ownership. React may display, configure and diagnostically explain, but
  must not reinvent semantics.
- Async runtime results (provider, transform, insert) must be guarded to the
  active `processing` session id; late results after abort or a new capture
  are discarded and only noted in the runtime log.
- Never commit or hardcode secrets; use the OS secret store or env vars. The
  Groq API key lives in the OS secret store; the JSON config is scrubbed on
  save.
- Run `npm audit` after dependency changes.
- Update `docs/VISION.md` and add an ADR in `docs/decisions/` after
  architecture decisions.
- Husky pre-commit hooks are active; never bypass with `--no-verify`.
- Linux hotkeys can be intercepted by the desktop environment; enter Win/Super
  manually if needed.
- Linux overlay: fixed window sizes (440x60 flat / 460x164 edit),
  `set_background_color` on every reveal, `park_overlay_window` with
  `hide()`, XWayland default (`GDK_BACKEND=x11`) with
  `WORDSCRIPT_NATIVE_WAYLAND=1` opt-in.
- KDE Plasma 6 always-on-top via KWin script
  (`packaging/kwin-wordscript-overlay/`).
- Corpus at `src-tauri/tests/fixtures/regression_transcripts.json` plus loader
  in `core::regression_corpus`; new bias filters belong in the corpus and in
  matching synthetic tests.

## Validation

- After UI changes: at least `npm run build`.
- After native changes: at least `cd src-tauri && cargo test`.
- For larger slices validate both sides: `npm test`, `npm run build` and
  `cd src-tauri && cargo test`.
- For shell/window/Tauri-bound changes, check in the native host rather than
  only browser preview (`invoke()` and event bridges need the host).
- For release-build-up changes additionally `npm run tauri build`.

## Gotchas

- Husky pre-commit hooks are active; never bypass with `--no-verify`.
- Linux hotkeys can be intercepted by the desktop environment; enter Win/Super
  manually if needed.
- `npm run tauri build` is a build-up check, not proof of a finished public
  release path. `check_app_update` intentionally stays restricted to published
  GitHub releases; internal draft handoffs are not a public release channel.
- Linux AppImage packaging can still fail at `linuxdeploy` (known packaging
  finding).
- cpal 0.17 breaking change: `SampleRate` is now a `u32` type alias (was a
  struct) -- `.0` accesses in `capture.rs` were adjusted.
- The `vendor/global-hotkey` patch for Windows (windows-sys 0.59 pointer
  parameters) must survive vendor updates.
- Overlay placement: a remembered manual position may only come from real
  user drag moves; programmatic host moves are not new user intent. Compact,
  preview and result surfaces share one remembered top-left position; a
  surface switch must not recompute to a different internal drag anchor. On a
  monitor identity miss (reconnect/sleep/driver re-enumeration) the restore
  rederives the target monitor from the saved logical drag reference against
  all work areas via `resolve_overlay_monitor`; only preset mode without an
  identity match falls back to primary. Click suppression for overlay buttons
  must run until the real drag end, not only at drag begin (a longer window
  drop would otherwise be misread as a button click).
- Linux overlay CSS: `--ov-shadow: none` and `--ov-shadow-recording: none` in
  `overlay-pill.css` are required (WebKitGTK paints outer `box-shadow`
  opaque); `pointer-events: auto` on `.ov-scope` is required (`none` on
  overlay-roots makes the pill deaf on WebKitGTK); `will-change: opacity` was
  removed (it bloats the layer cache and causes state overlays); fixed sizes
  440x60 flat / 460x164 edit must stay consistent between
  `OverlaySurface::dimensions()` and both invoke paths (base surface sync +
  `useLayoutEffect`); no dynamic pill-based resize (ResizeObserver +
  offsetWidth measuring is unreliable on GTK and was removed).
- Linux settings scroll: GPU compositing is enabled by default
  (`WEBKIT_DISABLE_COMPOSITING_MODE` was removed because it made scrolling
  CPU-bound and janky); opt-out via `WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING=1`
  for hardware where the overlay still shows black blocks;
  `WEBKIT_DISABLE_DMABUF_RENDERER=1` stays active (prevents GBM buffer
  errors). Settings cards use no drop shadows, no `backdrop-filter` on
  `.material`, `background-attachment: fixed` on the body gradient, `contain`
  on scroll containers and a 5s history refresh interval.
- Local decode and prompt-bias values are profile-bound. A UI or migration
  that writes only `local_beam_size`/`local_best_of` (or
  `local_prompt_strength`/`local_prompt_carry`) without updating the profile
  collection brings back stale decoder or bias state on the next profile
  switch. History and diagnostics for a local run without `provider_profile`,
  prompt-bias or decode metadata is a contract break, not a UI detail.
- `workspace_context::run_with_timeout` must keep dedicated pipe-drain
  threads for `stdout` and `stderr`; without the drain the child blocks on a
  full pipe buffer and `Output.stdout`/`stderr` come back empty, which breaks
  foreground-app detection on every platform.

## Documentation Maintenance

- Never write architecture decisions into a growing `ARCHITECTURE.md` (it is
  a living overview document). Instead, add small, dated entries in
  `docs/decisions/` (ADR principle: append-only, never edit retroactively).
- After every larger change: update `CHANGELOG.md`, `README.md` and inline
  comments of the affected project.
- When product reality changes, at least the relevant core docs must be
  kept in sync (README, VISION, ARCHITECTURE, DEVELOPMENT, DESIGN_SYSTEM,
  STATUS, PLATFORMS, REFERENCE, CHANGELOG, and SPEC).
- All documentation is US English (see the Language section).
- Drift check/sync runs via the `spec-sync` skill, not by hand.

## staging/

This repo keeps a `staging/` (consolidation staging area). Principle and rules
are in the global agent instruction (`dotfiles/.agents/AGENTS.md`, section
`staging/`). Repo-specific: see `staging/README.md`.
