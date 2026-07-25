# WordScript -- Reference

Status: 2026-07-25

> The consolidated spec lives at `docs/spec/SPEC.md`; this file bundles
> project-wide constants that do not belong in a single architecture, status
> or platform file: brand/product context, provider/runtime limits, mode
> semantics, external API limits and later sync planning.

## License

- AGPL-3.0 (since 2026-06-17, see ADR `docs/decisions/0004-agpl-3-0-lizenz.md`)
- Contributions: see `CONTRIBUTING.md`; security reports: see `SECURITY.md`

## Overlay constants (Linux)

- Fixed window sizes: 440x60 (flat) / 460x164 (edit)
- `resizable: true` in `tauri.conf.json` (GTK ignored `set_size` with
  `resizable: false`)
- XWayland default: `GDK_BACKEND=x11`, native-Wayland opt-in:
  `WORDSCRIPT_NATIVE_WAYLAND=1`
- KDE Plasma 6 always-on-top: `packaging/kwin-wordscript-overlay/`
- CSS variables: `--ov-shadow: none`, `--ov-shadow-recording: none` in
  `overlay-pill.css`
- `pointer-events: auto` on `.ov-scope` (not `none` on overlay-roots)

## Project context

- SW forge: open-source brand of SW labs
- WordScript: the active desktop dictation path within SW forge
- Product goal: a genuine, serious alternative to paid AI voice-dictation
  apps

## Provider and runtime limits

### Provider lanes today

- `groq` is the cloud-first production path.
- `local_preview` is the internal compatibility id for the local runtime
  lane with `whisper-cli` for STT and Ollama for cleanup.
- The user stores their own Groq API key locally in the OS secret store.
- The JSON config is scrubbed on save; old JSON Groq secrets are migrated
  natively into the secret store.
- `ProviderStatus` carries typed modes (`fast`, `quality`, `local`, later
  `self_hosted`) and capabilities for Transcription, Chat-Cleanup, Local,
  API-Key-Required, Prompt-Bias, Language, Segments and model management.
- `ProviderCommandError` carries text plus `kind`, HTTP status, Retry-After,
  `retryable` and a `user_action`; settings and runtime events must relay
  this semantics, not build their own error categories.
- There is no WordScript proxy or hosted mode.

### Mode semantics today

- `fast` and `quality` describe quality/latency presets within the same
  provider lane.
- `local` means a local or on-device runtime path without a WordScript
  backend; at WordScript this is currently the `local_preview` lane with a
  local runner, local model path and local cleanup endpoint.
- `self_hosted` is not an active product lane yet; the term stays reserved
  for later user-run remote or LAN services that would not be WordScript's
  own hosted mode.
- these terms must not be conflated in UI and docs while the second
  production lane and the guided setup path are still missing.

### Processing modes (processing contract)

These modes are **orthogonal** to the provider modes above and describe what
happens to the dictated text:

- `auto`: meta-mode; per transcription an LLM-based routing picks among
  cleanup, prompt enhance and agent (from transcript text, agent name and
  optional workspace context).
- `cleanup`: standard correction over the active provider; the default for
  most dictations.
- `rewrite`: polishing style with stronger reformulation; corresponds to the
  legacy option `polished`; only manually selectable (not auto-detected).
- `agent`: dictation is interpreted as a command to the agent; intent
  classification confirms before execution.
- `prompt_enhance`: dictation is understood as a prompt, structured or
  expanded via `prompt_enhance` and given to the provider with a `PromptTarget`.
- `verbatim`: raw text without cleanup, with a `clipboard_only` preview
  before commit.

The effective mode is resolved per session by
`mode_router::resolve_processing_mode`:
1. manual override (mode picker / mode cycle / per-mode hotkey)
2. active `TextProfile.work_mode.processing_mode`
3. legacy global `AppConfig.processing_mode` only when the active profile
   cannot be resolved; its default is `auto`

When the effective mode is `auto`, `mode_router::resolve_auto_mode` resolves
a concrete mode per transcription once the transcript text is available.
Signals: agent name + imperative verb -> `agent`; imperative + IDE workspace
context -> `prompt_enhance`; otherwise -> `cleanup`.

The workspace context is only a probability signal, not a deterministic
mapping (`workspace_app_map` was removed).

### Local runtime prerequisites

- `whisper-cli` in `PATH` or `WORDSCRIPT_LOCAL_WHISPER_CLI`
- `WORDSCRIPT_LOCAL_MODEL_PATH` for a ggml file or `WORDSCRIPT_LOCAL_MODEL_DIR`
  for `ggml-<model>.bin` and common variants like quantized or `.en` files
- Ollama locally at `http://127.0.0.1:11434` or `WORDSCRIPT_LOCAL_CHAT_BASE_URL`
- a local cleanup model selected via `local_correction_model` or
  `WORDSCRIPT_LOCAL_CHAT_MODEL`
- Provider & Models shows these prerequisites as a native preflight
  checklist, not just as env text; the checklist reads `local_setup`, not
  its own UI heuristics.
- the lane is no longer STT-only; AI cleanup runs locally over the separate
  cleanup model and only falls back to the raw local transcript when the
  cleanup model is unavailable or a guardrail rejects.

### Audio and upload relevance

- Capture files are normalized to 16 kHz mono WAV for Groq.
- The runtime path uses a short interactive timeout of `18_000` to `35_000`
  milliseconds.
- The active transcription request has exactly one retry (`max_retries = 1`,
  since pipeline hardening 2026-07-03; only for retryable status
  429/5xx/Timeout/Network, respects `Retry-After`).
- Async provider, transform and insert results are bound to the active
  `processing` session id; stale results after abort, a new capture or an
  already-finalized session are discarded and only noted in the runtime log.

Relevant external Groq limit for the product path:

- `413 request_too_large` relates to upload size, not only duration.
- Documented reference values from the current integration: Free `25 MiB`,
  Dev `100 MiB` per upload.

These values are only part of the product reference insofar as they affect
the active desktop flow.

## Shortcut contract

`src-tauri/src/core/shortcut.rs` is the single owner of the shortcut token
vocabulary, the canonical storage form, the human display string and every
validity rule (see [ADR 0006](decisions/0006-rust-owns-the-shortcut-contract.md)).
The UI carries no key table: it reads the vocabulary over
`shortcut_vocabulary`, sends browser `event.code` values unchanged and asks
`validate_shortcut` for validity and display.

### Token vocabulary

- Modifiers: `Ctrl`, `Alt`, `Shift`, `Super`. `Super` covers Win, Cmd and Meta;
  it is displayed as `Cmd` on macOS and `Win` on Windows.
- Letters `A`-`Z` and digits `0`-`9`, stored in short form, accepted in both
  short and `event.code` form (`M` and `KeyM` both parse).
- Function keys `F1`-`F24`.
- Editing: `Space`, `Enter`, `Tab`, `Backspace`, `Escape`, `Insert`, `Delete`,
  `Home`, `End`, `PageUp`, `PageDown`, `CapsLock`.
- Navigation: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`.
- Punctuation: `Backquote`, `Minus`, `Equal`, `BracketLeft`, `BracketRight`,
  `Backslash`, `Semicolon`, `Quote`, `Comma`, `Period`, `Slash`.
- Numpad: `Numpad0`-`Numpad9`, `NumpadAdd`, `NumpadSubtract`,
  `NumpadMultiply`, `NumpadDivide`, `NumpadDecimal`, `NumpadEnter`, `NumLock`.
- System: `PrintScreen`, `ScrollLock`, `Pause`.

Legacy pynput spellings (`ctrl_l`, `alt_l`, `win`, `cmd`, `esc`) are accepted on
read and rewritten to the canonical form on save. Parts are separated by `+`;
a comma is accepted and converted.

### Validity rules

- An empty value means **disabled**, for capture and mode shortcuts alike. It is
  never replaced by a platform default.
- A single bare modifier is rejected. A modifier-only shortcut requires at least
  two modifiers, so no registration can produce a grab with no modifier.
- A bare letter or digit is rejected. A bare function key is accepted and
  carries a warning naming it as a desktop-wide grab.
- One non-modifier key per shortcut.
- A value that cannot be parsed is stored unchanged and surfaced as "not
  registerable" — it is never rewritten into something that merely looks valid.
- Normalization runs before collision validation. Legacy rewrites are gated on
  `shortcut_schema_version` and run once.

### Default rotation

One rotation on every platform. The previous per-OS branching is gone: divergent
defaults are what let the legacy persist-time migration silently rewrite the
Windows default on every save, and a single set is easier to keep honest.
`Super` renders as `Cmd` on macOS and `Win` on Windows.

| Binding | Default |
| --- | --- |
| Start / stop capture | `Ctrl+Super` |
| Pause / resume | `Ctrl+Space` |
| Abort | `Ctrl+Alt` |
| Mode select | `Ctrl+S` |
| Auto | `Ctrl+1` |
| Verbatim | `Ctrl+2` |
| Cleanup | `Ctrl+3` |
| Rewrite | `Ctrl+4` |
| Agent | `Ctrl+5` |
| Prompt Enhance | `Ctrl+6` |

Two properties of this set are asserted in `cargo test`
(`every_default_shortcut_satisfies_the_contract`,
`defaults_survive_normalization_unchanged`): every default parses and is
registerable, no two collide, and a fresh config survives normalization
byte-identically.

Note that the capture and abort defaults are modifier-only, which the contract
allows from two modifiers upward. A modifier-only trigger acts on key **release**
rather than press, so it depends on the release event whose delivery is not
guaranteed on every platform — see the activation-mode section below.

Because these are global grabs, they are taken away from every other
application: `Ctrl+S`, `Ctrl+1`-`Ctrl+6` and `Ctrl+Space` are widely used
in-app shortcuts (save, tab switching, completion), and `Ctrl+Alt` fires on the
leading edge of every `Ctrl+Alt+…` combination the desktop uses. This is a
deliberate product decision, not an oversight; users who need those keys back
reassign them in Settings.

### Activation modes

- **Tap to toggle**: the same shortcut starts and stops. Repeated presses of the
  same kind within `debounce_ms` (300) are debounced. A modifier-only shortcut
  acts on release rather than press.
- **Hold to talk**: recording runs while the shortcut is held. A hold shorter
  than `hold_min_ms` (300) is extended to that length before stopping. A hold
  whose key release never arrives is ended by the watchdog after
  `hold_watchdog_seconds` (config, default 120, `0` disables) with reason
  `native_hold_watchdog`, logged rather than left to the silence timeout.
  Whether the platform delivers a key release at all is not guaranteed — the
  runtime counts presses and releases per binding and the UI states what it has
  observed. See
  [known-issues/capture-shortcut-recording.md](known-issues/capture-shortcut-recording.md).

### Trigger observability

The trigger lane logs to the runtime log under the `[trigger]` prefix:
`event=shortcut` for every received event (shortcut id, binding, pressed or
released), `event=decision` for what the state machine did with it (`start`,
`stop`, `abort`, `toggle_pause`, `mode_select`, `set_mode`, `debounced`,
`ignored_*`, `hold_start`, `hold_stop`, `no_binding`), `event=register` and
`event=unregister` for registration outcomes, and `event=hold_watchdog` when a
stranded hold is ended. This is permanent infrastructure, not a debug patch.

## Planning state for later sync topics

These points describe no active function, only the current direction for
later expansion:

- WordScript stays local-first; an account would be additive, not a
  prerequisite for the product core.
- if sync comes later it is a WordScript-owned service for WordScript data,
  not a mandatory dependency on an external product hub.
- the primary expansion path is not a peer-to-peer or client-to-client
  primary model.
- early sync candidates are profiles, dictionary, snippets, selected
  settings and later optionally history or workspaces.
- provider credentials like the Groq API key stay local in the OS secret
  store and are not an implicit sync part.

## Documentation set

The intentionally small documentation set is:

- `README.md` for project overview
- `AGENTS.md` (canonical agent instruction; `CLAUDE.md` is a symlink to it)
- `CONTRIBUTING.md` for the contribution workflow
- `SECURITY.md` for security reports and secret handling
- `CHANGELOG.md` for published changes
- `docs/spec/SPEC.md` for the consolidated spec (Layer 1)
- `docs/VISION.md` for product goal and V1/V2 scope
- `docs/ARCHITECTURE.md` for system truth and ownership
- `docs/DEVELOPMENT.md` for working mode and validation
- `docs/DESIGN_SYSTEM.md` for UI rules
- `docs/STATUS.md` for current product state, implemented core features,
  insertion/recovery model, open gaps, release status
- `docs/PLATFORMS.md` for the platform support matrix and
  insert/recovery diagnostics
- `docs/REFERENCE.md` for project-wide constants, provider/runtime limits,
  mode semantics (this file)
- `docs/ROADMAP.md` for the V1 consolidation phases
- `docs/RELEASE_RUNBOOK.md` for the current release build-up path
- `docs/UI_UX_OVERHAUL_PLAN.md` for the UI overhaul plan
- `docs/decisions/` for Architecture Decision Records (append-only)
- `docs/known-issues/` for living bug documentation (open and resolved)
- `docs/handoffs/` for completed implementation specs and historical
  hand-offs
- `docs/donors/` for frozen donor references and slice planning
- `docs/templates/` for reference templates (SPEC, VISION, DATA-MODEL,
  DESIGN-SYSTEM)
- `staging/` for the consolidation staging area of unstructured material
- `.agents/`, `.claude/`, `.githooks/`, `.github/` for meta structure

Any further file needs a narrower purpose than these entry points.
