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

### Fixed

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
