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

- Fixed window sizes: 480x60 (flat) / 460x164 (edit)
- `resizable: true` in `tauri.conf.json` (GTK ignored `set_size` with
  `resizable: false`)
- XWayland default: `GDK_BACKEND=x11`, native-Wayland opt-in:
  `WORDSCRIPT_NATIVE_WAYLAND=1`
- KDE Plasma 6 always-on-top: `packaging/kwin-wordscript-overlay/`. The pin is
  re-applied on output changes, not only on `windowAdded` — a screen change
  otherwise drops it for the rest of the session
- Placement is recomputed on hidden→visible **and** whenever the window
  intersects no monitor work area; during a capture the existing 200 ms monitor
  loop rechecks every `OVERLAY_STRANDED_CHECK_INTERVAL_TICKS` (10 ticks = 2 s).
  Intersection, not containment, so a pill hanging over an edge keeps its
  dragged position (ADR 0022)
- The park move is best-effort: X11/KWin clamps an off-screen position back onto
  the screen edge, so parking is carried by `hide()`. Requested and applied
  positions are logged
- CSS variables: `--ov-shadow: none`, `--ov-shadow-recording: none` in
  `overlay-pill.css`
- `pointer-events: auto` on `.ov-scope` (not `none` on overlay-roots)
- No `will-change: opacity`; it bloats the layer cache and causes state
  overlays
- No dynamic pill-based resize; ResizeObserver with `offsetWidth` measuring is
  unreliable on GTK and was removed
- The fixed sizes must stay consistent between `OverlaySurface::dimensions()`
  and both invoke paths (base surface sync and `useLayoutEffect`)
- Two side tabs, one per side, so neither has to yield to the other:
  `.ov-learned-tab` on the **left** (one-shot, retracts, nothing to click) and
  `.ov-limit-tab` on the **right** (the auto-stop, open for the whole recording,
  clickable). Both stay out of the pill's flex flow — a wider pill has its
  rounded ends clipped by the 480px window — and both animate `width`, never
  `transform`/`opacity`, which is what keeps them clear of the WebKitGTK
  ghosting in `docs/known-issues/overlay-ghosting.md`
- The limit tab is **absent** for most of a recording, then shows a stop mark
  and a bare `m:ss` countdown until the end: `data-tone` warning, turning danger
  with a pulsing mark near zero. There is no quiet state — a tab with nothing
  urgent to say is not on screen. The mark is a square, not a dot: the pill's
  own timer counts *up* a few pixels away, so a bare number is ambiguous, and
  minutes are unpadded here (`1:59`) where the timer is padded (`01:59`)
- The thresholds are **a quarter of the auto-stop**, capped at 120 s (appear)
  and 30 s (urgent). Fixed thresholds break at the short end: with a 1-minute
  auto-stop, "two minutes left" is true from the first second and the tab would
  never leave the screen. *When* to speak is the overlay's call; the number it
  speaks is `resolve_capture_budget`'s (ADR 0034, ADR 0038)
- Both tabs are sized by measuring their inner element against the side strip
  `(480 - pillWidth) / 2`, and paint nothing when they do not fit — a tab that
  is clipped is worse than no tab, and a tab that paints nothing is not
  announced either. Two things that measurement must respect: round the layout
  width **up** (`offsetWidth` truncates, and one pixel short clips the rounded
  end), and re-measure after `document.fonts.ready` (metrics taken before the
  webfont lands size the shutter for the fallback face)

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
- The Segments capability is load-bearing, not informational: a provider that
  declares it returns typed `TranscriptionSegment` values with `avg_logprob`,
  `no_speech_prob` and `compression_ratio`, and the confidence gate uses them to
  drop invented segments before AI cleanup (ADR 0016). `local_preview` declares
  `supports_segments: false` and is defended by the silence trim and the
  whisper.cpp decode flags instead.
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

### Transcript delivery modes (delivery contract)

Set per text profile as `work_mode.insert_behavior`; the settings label is
"Transcript delivery" under *Insert & Recovery*. The legacy tokens `"clipboard"`
and `"manual"` normalize to `clipboard_only`, unknown values to `auto_paste`,
and the normalized form is persisted rather than recomputed on every load — if
it is not, a legacy token pins the profile to clipboard-only forever (ADR 0019,
[known-issues/insert-behavior-reverts.md](known-issues/insert-behavior-reverts.md)).

| Value | UI label | Decision surface | Edit means |
|---|---|---|---|
| `auto_paste` | Copy and insert at cursor | result surface, *after* delivery | the original is already at the cursor and cannot be retracted, so confirming puts the correction on the clipboard |
| `clipboard_only` | Copy to clipboard only | processing preview, *before* delivery | confirming delivers the corrected text through the commit |

Exactly one of these surfaces is shown per session (ADR 0011a). `clipboard_only`
never shows a result surface after its commit.

Do not confuse the delivery mode with the delivery *outcome*: every
`transcription` event carries `delivery` (`inserted` | `clipboard`) derived from
`NativeInsertMode`. An `auto_paste` run whose paste failed reports
`delivery: "clipboard"` and still gets the result surface -- that is the case
where the Insert retry affordance matters most.

### Processing modes (processing contract)

These modes are **orthogonal** to the provider modes above and describe what
happens to the dictated text:

Each mode is a **fixed preset**. The mode alone decides what the transform does;
there are no per-mode or per-profile cleanup switches, and
`ProcessingMode::transform_preset()` is the single producer of `post_process`,
`filter_fillers` and `professionalize` (ADR 0020).

What a mode does **not** decide: the profile's dictionary replacements and snippet
expansions. Those run in every mode, including `verbatim`, as the pipeline's final
stage (`transform::finalize_with_text_rules`) after the mode branch. Modes sit on
top of the profile's vocabulary, not around it. The preset column below therefore
describes the correction step only.

- `auto`: meta-mode; per transcription a deterministic pass picks among cleanup,
  prompt enhance and agent (from transcript text, agent name and optional
  workspace context), consulting one LLM classifier call only in the uncertain
  zone. Never picks `verbatim` or `rewrite`.
- `cleanup`: filler removal plus typo, grammar and punctuation correction,
  staying close to the original phrasing; the default for most dictations.
  Preset `(post_process, filter_fillers, professionalize) = (true, true, false)`.
- `rewrite`: cleanup plus stronger reformulation; corresponds to the legacy
  option `polished`; only manually selectable, never auto-detected.
  Preset `(true, true, true)`.
- `translate`: the dictation is rendered in another language instead of being
  tidied, through `translate::apply_translate` and its own prompt rather than
  the correction prompt, which forbids translating (ADR 0041). Never
  auto-selected: Auto may choose how text reads, never what language it is in.
  No communication style applies -- a register on top of a translation changes
  the text twice (ADR 0023). Four settings, resolved by
  `AppConfig::active_text_profile_translate_settings` and snapshotted at capture
  start: target language and `keep the profile's words` per profile, the
  same-language behaviour and the address form per machine. It runs on the chat
  model rather than the correction model, and ships ahead of its roadmap phase
  (ADR 0071). Preset as for `agent`, used only by the history re-transform,
  which does not route by mode -- a retried translation comes back cleaned up.
- `agent`: dictation is executed as an instruction to the agent. Reaching this
  mode is itself the decision — there is no second intent check that can fall
  back to a cleanup. The output is the artifact the instruction asks for, never
  a reply to the user (`agent::AGENT_OUTPUT_CONTRACT`, ADR 0026).
  Preset `(true, false, false)`, used only by the history re-transform.
- `prompt_enhance`: dictation is understood as a prompt, structured or
  expanded via `prompt_enhance` and given to the provider with a `PromptTarget`.
  Preset as for `agent`.
- `verbatim`: raw text without cleanup, with a `clipboard_only` preview
  before commit; only manually selectable. Preset `(false, false, false)`.

The effective mode is resolved per session by
`mode_router::resolve_processing_mode`:
1. active `TextProfile.work_mode.processing_mode`
2. legacy global `AppConfig.processing_mode` only when the active profile
   cannot be resolved; its default is `auto`

The mode picker, the mode cycle and the per-mode hotkeys all write and persist
the profile, so there is no separate override layer for them to sit in. Every
one of those writers, plus `save_config` and `switch_active_text_profile`,
emits `wordscript-mode-event` so the overlay and the Settings form re-resolve
(ADR 0024).

**What may change while a recording runs:** the processing mode, and nothing
else. The active profile is locked for the duration of a session -- switching it
is refused by the runtime, because it sets the recognizer and that is committed
at capture start. Every other profile-derived value is snapshotted into
`NativeCaptureConfig` then too, so edits to the profile text, vocabulary,
dictionary, snippets, agent name or communication style apply from the next
recording (ADR 0025).

When the effective mode is `auto`, `mode_router::resolve_auto_mode` resolves one
concrete mode per transcription once the transcript text is available. It stays
synchronous and pure and returns either a decision or `NeedsClassifier`, so the
single LLM call the uncertain zone needs is made by the caller at the one point
that commits to a mode. Order, first match wins:

1. agent name addressed with a task (heuristic >= `HEURISTIC_CERTAIN_THRESHOLD`)
   -> `agent`
2. imperative + IDE workspace context -> `prompt_enhance`
3. heuristic in `[HEURISTIC_UNCERTAIN_THRESHOLD, HEURISTIC_CERTAIN_THRESHOLD)`
   -> one classifier call -> `agent` or `cleanup`
4. otherwise -> `cleanup`

`verbatim` and `rewrite` are unreachable from Auto by construction, enforced by
`auto_never_resolves_to_verbatim_or_rewrite`. For why Verbatim is excluded despite
looking like a free win, see
[known-issues/auto-mode-verbatim-routing.md](known-issues/auto-mode-verbatim-routing.md).

The profile's context (`TextProfile.prompt`) reaches every mode at the same
width and in the same shape, produced by `core::profile_context`: whitespace
normalized, deduplicated case-insensitively, each line truncated at 80
characters, and the whole block bounded by a 600-character budget. Lines that do
not fit are reported, never silently dropped — `TextRulesAnalysis.profile_context`
carries the spend and the rejected lines to the Profiles panel, which shows both.
**The mode decides the framing, never the width** (ADR 0021). Cleanup and
Rewrite wrap the lines in "use them only where they fit the input; never
hallucinate", because a correction must stay near its input; Prompt Enhance
keeps a weak "take into account where relevant" next to its sub-mode
instruction. There is no word-shape filter on this path — the recognizer's
filter (`transcription_hints::filter_profile_hint_lines`, ADR 0017) asks whether
Whisper could mis-hear a line and stays on the recognizer path only. A line
rejected there still reaches the transform prompt.

**In Agent mode the block is a reading aid, never material** (ADR 0023). It sits
in the *system* prompt behind an explicit restriction — "it exists solely to help
you read the instruction correctly … never carry any of it into the result. All
content comes from the user's instruction alone" — and the user turn carries the
transcript and nothing else. Snippets contribute label and trigger without their
expansion, because the expansion is finished text and
`transform::finalize_with_text_rules` applies it deterministically anyway. It was
previously framed as "the domain the output lives in", sat in the user turn one
line above the instruction, and carried a restriction on only one of its six
blocks; instructions came back containing profile lines the user never dictated.

**The agent prompt opens with what its output is** (ADR 0026). Every other rule
it carries is negative, and a conversational reply satisfies all of them, so
`AGENT_OUTPUT_CONTRACT` sits first — before the profile context and before the
style block: the user turn is a transcript and never a message to answer, the
output is the artifact alone, the addressee is the person the instruction names
and never the user, and an instruction that cannot be carried out returns its
content as plain text rather than a question back. It exists at every register,
`off` included. Without it Agent mode returned "Ja, das sollte Jürgen auf jeden
Fall machen" for an instruction to write Jürgen an email — with an invented
deadline attached, because a model that has decided it is in a conversation
supplies conversational filler.

Every prompt WordScript sends is written in English, whatever the dictation
language. English instructions are followed more reliably, and each prompt states
explicitly that the *output* language is the dictated one — the agent prompt
("never answer in the language of these instructions"), the correction prompt
("these instructions are in English — the output never is unless the user
dictated in English") and the style block ("never switch the language or the
language mix"). The German `um`-is-a-preposition guard is about the dictated
language and survives verbatim.

### Communication style

Per profile, in `ProfileModesSettings`, read by **Agent and Rewrite only**
(ADR 0023). One producer for both: `core::communication_style`.

- `communication_register`: `off` (default) | `authority` | `client` |
  `colleague` | `friend` | `quick`. Named after the addressee, or the medium for
  the lowest step; a ladder of formality adjectives is four near-synonyms in a
  select. Each active level emits three blocks — form rules (only properties
  countable in the output), a forbidden zone (what the level does *not* mean,
  against style-prompt overshoot) and a lexis source.
- `communication_length`: `terse` | `normal` (default, emits nothing) | `full`.
  `full` describes the result, not the task — develop the instruction's
  background and framing *inside* the result, never explain your own reasoning,
  never add facts the instruction does not contain. It previously read "spell
  out context and reasoning", which is an invitation to narrate the task
  (ADR 0026).
- `style_instructions`: the user's rules, budgeted as a list (400 chars, per line,
  deduplicated). They **outrank the register** where they touch it.
- `style_sample`: the user's own writing, budgeted as prose (400 chars, structure
  intact, cut tail reported). **Subordinate to the register for form,
  authoritative for wording.**

**A register sets form, never lexis.** Formality and youth language are different
dimensions — diaphasic and diastratic — and a model's own slang is measurably
misaligned with human use, so `friend` and `quick` carry an explicit ban on
supplying any from memory or translating it from another language. The only
sources are the two user fields. `src/data/styleLexicons.json` seeds them per
language; it is opt-in, dated, and loaded into the user's own rules where they
can read and edit it, never into a hidden runtime layer.

With `register = off` every prompt is byte-identical to before. Cleanup, Verbatim
and Prompt Enhance never carry a style block. On Rewrite the "preserve the tone"
clause is *replaced* rather than extended, since both would order opposite things
about the same property; meaning, language mix and terminology stay untouchable.

The workspace context is only a probability signal, not a deterministic
mapping (`workspace_app_map` was removed). It is collected once per session when
the active profile allows it and then reaches every mode: as a category signal in
Auto routing, and as exactly one bounded hint line in the cleanup, rewrite and
agent prompts, carrying its own instruction never to derive content from it. The
toggle lives per profile
(`ProfileModesSettings.collect_workspace_context`; older configs store it as
`auto_detect_mode`, accepted as a serde alias), with the global
`AppConfig.auto_detect_mode` as fallback for profiles predating the block.

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
One stored value carries the right platform spelling on its own: `Super` renders
as `Cmd` on macOS and `Win` on Windows, `Alt` renders as `Option` on macOS and
stays `Alt` on Windows and Linux.

| Binding | Default |
| --- | --- |
| Start / stop capture | `Ctrl+Super` |
| Pause / resume | `Ctrl+Space` |
| Abort | `Ctrl+Alt` |
| Mode select | `Alt+S` |
| Auto | `Alt+1` |
| Verbatim | `Alt+2` |
| Cleanup | `Alt+3` |
| Rewrite | `Alt+4` |
| Agent | `Alt+5` |
| Prompt Enhance | `Alt+6` |

The whole mode lane sits on `Alt`, which macOS shows as `Option` — mode select
reads `Option+S` there, the per-mode keys `Option+1`-`Option+6`.

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
application: `Ctrl+Space` is a widely used in-app shortcut (completion, input
source switching), `Ctrl+Alt` is observed on the leading edge of every
`Ctrl+Alt+…` combination the desktop uses — WordScript sees those events and
discards them as an interrupted chord (ADR
[0014](decisions/0014-every-modifier-only-binding-is-decided-at-the-release-edge.md)),
but it is still the same physical gesture — and on the `Alt` lane `Alt+letter` is a menu
mnemonic in some applications while `Alt+1`-`Alt+9` switches tabs in Firefox on
Linux and Windows. This is a deliberate product decision, not an oversight;
users who need those keys back reassign them in Settings.

The mode lane moved off `Ctrl` for exactly that reason: `Ctrl+S` is save and
`Ctrl+1`-`Ctrl+6` is tab switching in every browser, which made those the
collisions of the rotation users hit daily. The `Alt` lane is not free of
collisions either, but it costs less on all three platforms. Configs written
before shortcut schema version 2 are moved once, per slot, and only where the
slot still holds its untouched `Ctrl` default — a value the user chose stays,
an empty slot stays disabled, and a slot is skipped when its new value is
already assigned elsewhere.

### Activation modes

The default is **double tap** (ADR
[0008](decisions/0008-double-tap-is-the-default-activation-mode.md)), because the
default capture triggers are modifier-only. The default applies to a config that
does not record an `activation_mode`; an existing config keeps the value it has,
and no migration rewrites the field.

The release rule applies to all three capture-lane bindings, in every mode: a
modifier-only shortcut is decided when it comes up, because that is the only
moment the interruption signal exists — a press cannot yet know that a third key
is about to follow (ADR
[0014](decisions/0014-every-modifier-only-binding-is-decided-at-the-release-edge.md)).
An interrupted release acts on nothing and counts toward nothing. A binding that
contains a real key is unaffected and acts on the press.

- **Tap to toggle**: the same shortcut starts and stops. Repeated presses of the
  same kind within `debounce_ms` (300) are debounced. A modifier-only shortcut
  acts on release rather than press.
- **Double tap to toggle** (default): two taps within `double_tap_window_ms` (config,
  default 400, clamped to 150-1000) start or stop the capture; a single tap does
  nothing. This is the mode the mainstream dictation tools use — Wispr Flow
  double-taps right Shift, macOS Dictation double-taps Fn — and the reason is
  not comfort. A modifier-only trigger in tap mode acts on *every* single press,
  so `Ctrl+Alt` as the trigger also fires when the user meant `Ctrl+Alt+T`.
  Requiring two taps leaves the single press to the rest of the desktop.
  The counted edge is the same one tap mode uses: the release for a
  modifier-only shortcut, the press otherwise. The gate covers all three
  capture-lane triggers — start/stop, pause and abort — each with its own
  window, so one binding cannot complete another's double tap. Mode hotkeys stay
  single-press: a stray mode switch costs a mode, not a recording.
- **Hold to talk**: recording runs while the shortcut is held, and only while it
  is held. A press shorter than `hold_arm_ms` (300) is **discarded** — no
  session, no overlay, no cue, no history entry (ADR
  [0013](decisions/0013-hold-to-talk-is-strictly-momentary.md)). The microphone
  still opens on the press edge and the audio is kept, so a hold that goes on to
  commit loses no word; what waits for the threshold is the session, not the
  stream. The mode has no latch gesture — a recording that keeps running without
  a held key is what the two toggle modes are for. Like the double-tap window,
  the threshold covers all three capture-lane triggers: start/stop, pause and
  abort. For a modifier-only pause or abort the threshold is measured at the
  release rather than on an arm timer, so the action fires when the key comes up
  (ADR [0014](decisions/0014-every-modifier-only-binding-is-decided-at-the-release-edge.md));
  the required duration is the same.
  A hold whose key release never arrives is ended by the watchdog after
  `hold_watchdog_seconds` (config, default 120, `0` disables) with reason
  `native_hold_watchdog`, logged rather than left to the silence timeout. The
  watchdog arms at the commit, because below the threshold there is no session
  to strand.
  Whether the platform delivers a key release at all is not guaranteed — the
  runtime counts presses and releases per binding, and the capability matrix
  turns those counters into the state of this option. See
  [known-issues/capture-shortcut-recording.md](known-issues/capture-shortcut-recording.md).

### Delivery: grab versus observe

A shortcut with a real key (`Ctrl+F9`, `F1`) is registered as an OS-level **grab**
— the key is delivered to WordScript instead of the focused window, which is what
a hotkey with a real key should do. A **modifier-only** shortcut is **observed**
instead: the raw key stream is watched without consuming the keystroke, so
`Ctrl+Super` as a trigger no longer takes that combination away from other
applications (ADR
[0009](decisions/0009-modifier-only-shortcuts-are-observed-not-grabbed.md)).
`validate_shortcut` reports which of the two applies in `delivery`.

A **single** modifier is allowed where the session can report an *interrupted*
hold — another key went down while the trigger was held. Tap and double tap
discard an interrupted edge, so `Shift` on the way to a capital and `Ctrl+Alt` on
the way to `Ctrl+Alt+T` stop counting as taps; hold to talk ignores the flag,
because it started on the press edge and still has to end on release. Today Linux
reports it and Windows and macOS do not, so there the minimum stays two and the
rejection names the missing signal rather than asserting an absolute.

`MODIFIER_TOKENS` is side-agnostic, so `Shift` covers both keys and "right Shift
only" cannot be expressed yet.

On Linux the observation path is XInput2 raw key events. It tracks the eight
modifier keycodes and discards every other keycode on arrival. It is still an X11
mechanism, so on a Wayland session a keystroke delivered to a native Wayland
client stays invisible — observation removes the key theft, not the Wayland gap.

### Capability gating

`shortcut_capabilities` reports which activation modes and key classes the
current session can honor, derived in `core::shortcut::capability_matrix` from
the session facts plus this session's measured press/release evidence (ADR
[0007](decisions/0007-capability-matrix-is-measured-not-assumed.md)). The states
are `available`, `conditional` (registerable, with a consequence that is stated)
and `unavailable`.

Settings -> Capture gates the activation selector on it: an unavailable option is
unselectable and carries the runtime's reason. A stored mode that becomes
unavailable stays selected and is explained — the UI never rewrites a chosen
value. The full table per session type is in
[PLATFORMS.md](PLATFORMS.md#shortcut-capability-matrix).

### Trigger observability

The trigger lane logs to the runtime log under the `[trigger]` prefix:
`event=shortcut` for every received event (shortcut id, binding, pressed or
released), `event=decision` for what the state machine did with it (`start`,
`stop`, `abort`, `toggle_pause`, `mode_select`, `set_mode`, `debounced`,
`ignored_*` including `ignored_interrupted_chord`, `hold_start`, `hold_stop`,
`hold_arm_pending`, `hold_released_below_arm`, `double_tap_armed`,
`deferred_to_release_modifier_only`, `no_binding`), `event=register` and
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
