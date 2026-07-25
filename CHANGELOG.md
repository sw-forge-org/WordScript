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

- New default shortcut rotation, identical on Linux, Windows and macOS:
  `Ctrl+Super` start/stop, `Ctrl+Space` pause, `Ctrl+Alt` abort, `Ctrl+S` mode
  select and `Ctrl+1`-`Ctrl+6` for the six processing modes. The per-OS
  branching is gone — divergent defaults are what let the legacy migration
  rewrite the Windows default on every save — and the set is asserted in tests
  to parse, register, not collide and survive normalization unchanged.

### Fixed

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
