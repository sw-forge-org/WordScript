# AGENTS.md -- WordScript

Canonical agent instruction for this repository; `CLAUDE.md` is a filename
symlink to this file. The global agent instruction (language, output, workflow,
documentation maintenance, security, staging, the four-layer model) lives in
`dotfiles/.agents/AGENTS.md` and applies here unchanged. This file carries only
the repo-specific delta.

## Purpose

WordScript is a Tauri v2 desktop product with a React/TypeScript UI and a
native Rust runtime for trigger, capture, transform, insert and updates. It is
built under SW forge, the open-source brand of SW labs, as an open desktop
dictation app that is faster and more honest for heavy writers than generic
voice tools.

## Language

All repository documentation is written in **American English** -- no German in
docs. Chat replies follow the global instruction.

## Setup Commands

- Install: `npm install`
- Dev: `npm run tauri dev`
- Test: `npm test` (frontend/Vitest) and `cd src-tauri && cargo test` (Rust)
- Build: `npm run build` (frontend) or `npm run tauri build` (full release)
- Lint/Typecheck: frontend tests + `cd src-tauri && cargo check`

Bootstrap once per machine: `bash setup-tauri.sh` (macOS/Linux) or
`powershell -ExecutionPolicy Bypass -File .\setup-tauri.ps1` (Windows).

These commands are the eval-loop basis for agentic runs: without a working
test/lint/build command an agent has no success signal and cannot iterate.

## Code Style

- No comments unless explicitly requested.
- Rust owns trigger, capture, provider, transform, insert and recovery. React
  displays, configures and explains that native state; it must never reinvent
  it semantically.
- Typed contracts between UI and runtime are mandatory; do not introduce
  untyped JSON intermediate layers that blur Rust ownership.
- shadcn/ui + Tailwind CSS (v4 on `@theme inline` tokens). No generic fonts
  (Inter, Roboto, Arial, Open Sans, system-ui).
- Native window decorations (`decorations: true`) on every OS; do not build
  fake traffic lights.

## Runtime Rules for Agents

- Do not add product logic to the old sidecar or glue paths; the active path is
  Tauri/Rust. The Python sidecar is not a reference implementation.
- Do not render fake states or fake readiness; show runtime truth, and when the
  runtime is not ready, show the next action instead.
- Do not reimplement hotkeys, capture, session orchestration or insert
  reliability in React; they stay Rust-owned. React may display, configure and
  diagnostically explain them.
- Guard async runtime results (provider, transform, insert) against the active
  `processing` session id. Discard late results after abort or a new capture
  and note them in the runtime log only.
- A session ends in exactly one reducer commit, together with the surface that
  reports it -- on EVERY path, the timeout fallback included, and once ended its
  surface is never re-decided. The `wordscript-native-event` channel mirrors
  session status but must never set `status`, `pendingResult`, `previewStaged`
  or `resultSurfaceOpen` -- it arrives one commit before the authoritative
  `wordscript-event` transcription. See ADR 0018 and ADR 0019.
- Never commit or hardcode secrets; use the OS secret store or env vars. The
  Groq API key lives in the OS secret store and the JSON config is scrubbed on
  save.
- Never bypass the Husky pre-commit hooks with `--no-verify`.
- Run `npm audit` after dependency changes.
- Add an ADR in `docs/decisions/` after architecture decisions, and update
  `docs/VISION.md` when scope moves.
- New bias filters belong in the corpus at
  `src-tauri/tests/fixtures/regression_transcripts.json` (loader:
  `core::regression_corpus`) and in matching synthetic tests.
- A model id belongs in `shared/model_catalogue.json` and nowhere else
  (ADR 0115). Both runtimes read that file and name a row by its slug, not by
  the model name; a row needs a source and a read-date. A test walks `src/` and
  fails on a catalogued id spelled outside it.

## Validation

- After UI changes: at least `npm run build`.
- After native changes: at least `cd src-tauri && cargo test`.
- For larger slices validate both sides: `npm test`, `npm run build` and
  `cd src-tauri && cargo test`.
- For shell/window/Tauri-bound changes, check in the native host rather than
  browser preview only (`invoke()` and event bridges need the host).
- For release-build-up changes additionally `npm run tauri build`.

## Reference Map

`docs/spec/SPEC.md` is the authoritative contract. The living overview docs
expand on it but never override it; when they conflict, the spec wins and the
overview doc is the one that drifted. Decisions are append-only ADRs -- add a
new one, never edit an existing one.

Detail lives in the owning document. Read it before changing the area rather
than relying on this file, which deliberately carries no detail.

| Read this | Before touching |
| --- | --- |
| `docs/spec/SPEC.md` | Any runtime contract, session semantics or delivery mode |
| `docs/ARCHITECTURE.md` | Module boundaries or the UI/runtime seam |
| `docs/DEVELOPMENT.md` | Setup, or when unsure which validation a change needs |
| `docs/PLATFORMS.md` | Insert, recovery, shortcuts, capture, audio devices, Wayland, the Windows vendor patch |
| `docs/PROVIDERS.md` | Any provider, lane, credential shape or model name -- what a vendor serves, per row and per date |
| `docs/REFERENCE.md` | Overlay sizes and CSS invariants, provider lanes, mode semantics |
| `docs/DESIGN_SYSTEM.md` | Settings UI, tokens, motion, scroll and compositing behavior |
| `docs/known-issues/` | Areas with failure history: overlay placement, ghosting, shortcuts, transcription |
| `docs/decisions/` | A rule that looks arbitrary -- the ADR carries the derivation |
| `docs/STATUS.md` | Reporting what works today, what is open, what is release-ready |
| `docs/RELEASE_RUNBOOK.md` | Release build-up, `check_app_update`, AppImage packaging |

Code areas: `src/` (overlay, settings, rebuild lab, UI state),
`src-tauri/src/` (native runtime core), `shared/` (data both runtimes read --
the model catalogue and its schema), `packaging/` and `vendor/` (platform
packaging, vendored patches). Further docs (`ROADMAP`, `VISION`,
`UI_UX_OVERHAUL_PLAN`, `handoffs/`, `donors/`, `templates/`) live under
`docs/`. No project-specific skills exist; see `.agents/README.md` if one is
ever needed in more than one harness.

## Documentation Maintenance

Beyond the global rules: when product reality changes, keep README, VISION,
ARCHITECTURE, DEVELOPMENT, DESIGN_SYSTEM, STATUS, PLATFORMS, REFERENCE,
CHANGELOG and SPEC in sync. Product state belongs in `docs/STATUS.md` and the
spec drift date in the `Status:` line of `docs/spec/SPEC.md` -- neither belongs
in this file, which must not accumulate a changelog. Drift check runs via the
`spec-sync` skill.

## staging/

Principle and rules are global; repo-specific notes in `staging/README.md`.
