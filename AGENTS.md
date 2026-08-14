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
- **A dev host is a running app, and editing its inputs restarts it.** Two
  halves of one rule:
  - **Do not write `vite.config.ts` while a dev host is running.** Vite watches
    its own config and restarts in place; every webview loses its page, and the
    parked overlay never asks for it again -- it goes silently invisible while
    the runtime keeps working. Land config changes before starting the host, or
    restart the host after them.
  - **Writing any file under `src-tauri/` rebuilds and restarts the whole app.**
    Not a reload: the process dies, the hotkeys go with it, and a dictation in
    flight is a dictation interrupted. One session did this about four times in
    an afternoon, once while the owner was mid-sentence. Before touching Rust,
    check whether a host is running (`pgrep -af "tauri dev"`) and say so; batch
    the edits rather than landing them one at a time.
- **No heavy builds while an audio or capture measurement is running.** PipeWire
  runs at no realtime priority on the reporting machine, so a 20-core
  `cargo test` can fabricate a callback gap that lands in the log as a finding.
  During a measurement, code may be written but not validated. The derivation is
  in [`docs/tracks/runtime-ownership.md`](docs/tracks/runtime-ownership.md).
- For release-build-up changes additionally `npm run tauri build`.

## Reference Map

`docs/spec/SPEC.md` is the authoritative contract. The living overview docs
expand on it but never override it; when they conflict, the spec wins and the
overview doc is the one that drifted. Decisions are append-only ADRs -- add a
new one, never edit an existing one.

Detail lives in the owning document. Read it before changing the area rather
than relying on this file, which deliberately carries no detail.

`docs/README.md` is the map of the whole set. This table is only the routing
that matters most often.

| Read this | Before touching |
| --- | --- |
| `docs/IMPLEMENTATION.md` | **Starting any implementation session.** Three tracks run concurrently on `main`; it says which owns what, and the rules for sharing the tree |
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
| `docs/ROADMAP.md` | Asking which phase something belongs to. The phase list lives there and nowhere else |
| `docs/RELEASE_RUNBOOK.md` | Release build-up, `check_app_update`, AppImage packaging |

Code areas: `src/` (overlay, settings, rebuild lab, UI state),
`src-tauri/src/` (native runtime core), `shared/` (data both runtimes read --
the model catalogue and its schema), `packaging/` and `vendor/` (platform
packaging, vendored patches). Under `docs/`: `tracks/` for live implementation
tracks, `archive/` for closed ones and spent plans, `donors/` and `prototypes/`
for frozen reference. No project-specific skills exist; see `.agents/README.md`
if one is ever needed in more than one harness.

## Documentation Maintenance

Beyond the global rules: when product reality changes, keep README, VISION,
ARCHITECTURE, DEVELOPMENT, DESIGN_SYSTEM, STATUS, PLATFORMS, REFERENCE,
CHANGELOG and SPEC in sync. Product state belongs in `docs/STATUS.md` and the
spec drift date in the `Status:` line of `docs/spec/SPEC.md` -- neither belongs
in this file, which must not accumulate a changelog. Drift check runs via the
`spec-sync` skill.

**One list per fact** (ADR 0123). The documentation map lives in
`docs/README.md`, the phase list in `docs/ROADMAP.md`, the track state in
`docs/IMPLEMENTATION.md`. Each of those three had between three and five copies
that had drifted apart. If you find a second copy of one, it is drift: replace
it with a link rather than updating both.

## staging/

Principle and rules are global; repo-specific notes in `staging/README.md`.
