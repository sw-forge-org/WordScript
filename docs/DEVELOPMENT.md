# WordScript Development

Status: 2026-07-25

> The consolidated product contract is [SPEC.md](spec/SPEC.md). Architecture
> decisions are append-only ADRs in [decisions/](decisions/); repository
> behavior lives in [AGENTS.md](../AGENTS.md).

## Purpose

This guide describes how to work on the active WordScript product path. It is
workflow documentation, not a substitute for the specification or architecture
overview.

WordScript is a Tauri v2 application. Rust owns trigger handling, capture,
provider execution, transformation, insertion, recovery, and their session
semantics. React and TypeScript render, configure, and diagnose that native
truth. The retired Python sidecar is not a reference implementation.

## Stack and Ownership

| Area | Technology | Primary location |
| --- | --- | --- |
| Desktop UI | React 18, TypeScript, Vite, Vitest | `src/` |
| Native host | Tauri v2 | `src-tauri/` |
| Runtime | Rust, `cpal`, `hound`, `reqwest`, `keyring`, `rodio`, `arboard`, `enigo` | `src-tauri/src/` |
| Local speech | external `whisper-cli` and ggml models | native provider path |
| Local cleanup | Ollama or a configured local endpoint | native provider path |
| Documentation | Markdown | `docs/` |

Do not add product logic to obsolete sidecar or glue paths. Do not replace a
native contract with renderer-only state or untyped JSON. A UI label without a
matching native runtime effect is a product defect.

## Setup

### Prerequisites

- Node.js `^20.19.0` or `>=22.12.0`
- Rust and Cargo
- macOS: Xcode Command Line Tools; Homebrew is recommended for bootstrap
- Windows: Visual Studio Build Tools with the C++ workload and WebView2 Runtime
- Linux: WebKitGTK 4.1, AppIndicator, libxdo, ALSA, librsvg and OpenSSL
  development packages; `setup-tauri.sh` installs the distro-specific set

Bootstrap once per machine:

```bash
bash setup-tauri.sh
```

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-tauri.ps1
```

Start the native product path:

```bash
npm install
npm run tauri dev
```

The development build is the usable product today. Release workflows build
internal review artifacts; they do not establish a public installer or updater
channel.

### Local Runtime

The `local` identifier names the full local runtime lane (ADR 0121).
It requires an STT runner, an STT model, a cleanup endpoint, and a cleanup
model. Configure the path only when working on this lane:

- `whisper-cli` in `PATH`, or `WORDSCRIPT_LOCAL_WHISPER_CLI`
- `WORDSCRIPT_LOCAL_MODEL_PATH` for one ggml model, or
  `WORDSCRIPT_LOCAL_MODEL_DIR` for a model directory
- Ollama at `http://127.0.0.1:11434`, or `WORDSCRIPT_LOCAL_CHAT_BASE_URL`
- a local cleanup model selected in settings or through
  `WORDSCRIPT_LOCAL_CHAT_MODEL`

Never treat a non-empty environment variable as readiness. The native provider
status probes the selected runner and model and reports typed `issue_code`
values. Settings must render its `local_setup` contract rather than infer setup
state from paths, model names, or stale UI state.

## Working Method

### Start at the Owning Surface

- UI work starts in `src/windows/`, `src/components/settings/`, or `src/hooks/`.
- Runtime work starts in `src-tauri/src/core/`.
- Provider work starts in `src-tauri/src/core/providers/` and uses the common
  provider contract.
- Product scope comes from [VISION.md](VISION.md); boundaries and data flow
  come from [ARCHITECTURE.md](ARCHITECTURE.md).
- Platform behavior belongs in [PLATFORMS.md](PLATFORMS.md), not in UI guesses.

Implement small, testable slices. Preserve typed boundaries and keep an active
session identifier through asynchronous provider, transform, and insert work.
Late results after an abort or a new capture are discarded and only recorded in
the native runtime log.

### Runtime Contract Rules

- Rust owns hotkeys, capture, sessions, insertion, and recovery.
- `ProviderCommandError` remains the provider error contract; it carries
  `kind`, `retryable`, and `user_action`.
- Provider capabilities come from native `ProviderStatus`, never model-name
  heuristics in the UI.
- Overlay actions use the same native event payload and commands as the normal
  session path. Do not introduce a second frontend commit path.
- Settings changes auto-save immediately. Diagnostics may briefly identify an
  in-flight form/runtime difference, but the persisted native runtime snapshot
  remains authoritative.
- History and diagnostics for a local run must retain provider profile,
  prompt-bias, decode, and cleanup metadata.

### Profiles and Transcription Bias

Text profiles are persistent user data. Included profiles are seeded once and
then behave as ordinary profiles; `curation` is origin metadata, not a second
catalog or visibility rule.

Profile, dictionary, `stt_hints`, and prompt-bias changes require checks against
`General Writing` or no profile. A profile that causes multilingual fragments,
garbage tokens, or topic drift is a launch blocker, not harmless tuning.

The regression corpus is
`src-tauri/tests/fixtures/regression_transcripts.json`, loaded by
`core::regression_corpus`. New bias filters require a representative corpus
case and matching synthetic coverage in transcription-hint and text-rule tests.
When changing bias policy, update the preview, runtime request construction,
UI analysis, and migration together.

**Adding or renaming a model is a row in `shared/model_catalogue.json`, and
nowhere else** (ADR 0115). Both runtimes read that file — `core::model_catalogue`
through `include_str!`, `src/lib/modelCatalogue.ts` by import — and both name a
row by its slug rather than by its model id, so a vendor's next generation is
one edited `model_id`. A row needs a source and a read-date or the suite fails,
and a source may be a path in this repo when the row's provenance is this repo's
own drawing or runtime. A test walks `src/` and fails if any file outside the
catalogue spells a catalogued id. What a row says about streaming is what the
vendor documents; what this build can operate is
`providers::model_capabilities`, and the two are deliberately allowed to
disagree.

Local decode and prompt-bias settings are profile-bound. Update the profile
collection together with active mirror fields, or a profile switch will restore
stale values.

### Native Host Verification

Use the native host for Tauri, shell, window, hotkey, overlay, and diagnostics
work. Browser preview cannot validate `invoke()` bridges, permissions, window
decorations, compositor behavior, or insertion.

For detailed Linux overlay, placement, and WebKitGTK constraints, use
[REFERENCE.md](REFERENCE.md) (overlay constants and CSS invariants),
[overlay-placement-persist.md](known-issues/overlay-placement-persist.md)
(placement and drag persistence) and [PLATFORMS.md](PLATFORMS.md) (runtime and
compositor behavior). They are intentionally not duplicated here. In particular, fixed overlay sizes,
native parking, background repainting, drag persistence, and compositor-safe
CSS are runtime constraints rather than styling preferences.

### Overlay Tracing

The overlay writes `[ov-*]` trace lines to `/tmp/kilo/overlay-diag.log` in dev
builds; the `overlay_diag` tab in Settings displays the tail live and can open
the overlay webview's DevTools.

Per-render tracing (`[ov-render]`) is **opt-in**, because it fires on every
commit — during a capture that is one extra IPC round trip per `audio_level`
event, enough load to distort what it is measuring:

```
VITE_WORDSCRIPT_OVERLAY_RENDER_TRACE=1 npm run tauri dev
```

The `[ov-beat]` main-thread heartbeat needs no flag and logs only when an
interval lands late, so a quiet log means a healthy main thread. Runtime and
overlay log lines share an epoch-millisecond prefix and can be lined up against
each other and against `journalctl`; convert one with `date -d @<seconds>`.
Interpretation of a heartbeat gap against the per-capture level-emit accounting
is in
[known-issues/overlay-recording-freeze.md](known-issues/overlay-recording-freeze.md).

## Validation

Run the smallest relevant validation first, then broaden it for cross-cutting
changes.

| Change | Minimum validation |
| --- | --- |
| UI-only | `npm test` and `npm run build` |
| Native Rust | `cd src-tauri && cargo test` |
| UI and runtime contract | `npm test`, `npm run build`, and `cd src-tauri && cargo test` |
| Release build-up | prior checks plus `npm run tauri build` |
| A screen in the settings-rework port | the above plus `npm run port:diff` |

Run local behavior in the native host whenever a change crosses the webview or
operating-system boundary. Do not claim platform support based only on a browser
preview.

### The settings-rework port has its own check

While the port runs (see `docs/tracks/gui-port-relay.md`), a screen in
`/gallery` → Screens is accepted by **measurement**, not by eye. `npm run
port:diff` opens the running prototype and the running gallery in one headless
Chromium, walks both block trees and prints every structural and computed-style
difference. A screen is ported when it reports `structural 0 | style 0 | text 0`;
a unit test cannot see a pixel, so nothing else is evidence.

```bash
python3 -m http.server 8791 --directory docs/prototypes/settings-rework
npm run dev
npm run port:diff models onboarding agents        # add --text to compare copy
npm run port:diff models#1 onboarding#4           # a sub-tab or a wizard step
```

`#n` drives both surfaces into a screen's other state before measuring — a
screen checked only in its default state is a screen half checked. The script's
own header documents the five measurement false positives found so far and the
divergences that are deliberate.

## Repository Workflow

- Keep changes focused and avoid unrelated rewrites.
- Use a branch or worktree for independent slices. Prefer descriptive branch
  names such as `fix/<slug>` or `feat/<slug>`.
- Keep build caches outside the worktree when several worktrees are active;
  use `npm run clean:dev` only when a stale local build is the confirmed cause.
- Never bypass Husky hooks. Dependency changes require `npm audit`.
- Do not commit secrets, `.env` files, generated credentials, or local
  overrides. API keys stay in the OS secret store or environment.

## Documentation Set

[README.md](README.md) is the map: every document, what kind it is, and what to
read before touching an area.

## Current Focus

**What is being built right now, and in what order, is
[IMPLEMENTATION.md](IMPLEMENTATION.md)** — three tracks run concurrently on
`main`, and that page carries which one owns what, plus the rules for sharing
the tree.

V1 work prioritizes trustworthy transcription, controlled delivery and
recovery, clear provider semantics, a first-class local path, and guided setup
and packaging. Broader notes, sync, account, and assistant scope remain future
work until the core dictation path is dependable. MCP is filed separately (ADR
0029): as a server it is scheduled as ROADMAP Phase 8, as a client inside the
dictation path it is rejected outright.
