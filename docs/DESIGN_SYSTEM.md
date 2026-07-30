# WordScript Design System

Status: 2026-07-25

> The product contract is [SPEC.md](spec/SPEC.md). Native window decorations
> are established by [ADR 0003](decisions/0003-native-fensterdekorationen.md).
> This document defines current UI rules, not speculative implementation plans.

## Product Principles

- Prefer a focused desktop utility over a dashboard.
- Make runtime truth more visible than decorative motion.
- Use small, readable surfaces with a clear active task.
- Explain errors and recovery actions rather than merely displaying them.
- Never hide platform limits behind reassuring but false UI states.
- Build the native feel through content design, not imitation OS chrome.

## Visual Direction

WordScript is a dark, calm voice-workstation utility with an SW forge orange
accent. It uses hierarchy, grouped forms, precise status, and restrained motion
instead of generic dark-dashboard styling. Orange identifies primary capture and
intentional attention; it is not a default decoration for every control.

The active technical stack is Tailwind CSS v4 with shadcn/ui patterns. Tokens in
`src/styles/globals.css` exposed through `@theme inline` remain the single
source of truth. Do not create parallel color, spacing, or component token sets.

## Sonic Identity

Sound is a second status channel, not decoration. The user is usually looking
at another application while dictating, so the cues carry state the overlay
cannot deliver.

Everything derives from one G-major theme. The startup signature states it in
full (G3 -> D4 -> G4 with a quiet B4 on the arrival); every operational cue is
a fragment of it. That shared derivation is the recognisability — not any
single sound.

- **Cues report runtime truth, exactly like the overlay.** `Handoff` fires when
  capture stops and must not sound conclusive, because the work is still
  running. `Done` is the only cue that reports a finished round trip, and it
  fires on a successful insert. Never sound completion the runtime has not
  reached.
- **Loudness is a hierarchy, not a volume war.** Cues are normalised to a
  common peak and then trimmed: `Done` is the quietest because it is the most
  frequent, and `Error` distinguishes itself by interval and damping rather
  than by being louder.
- **Register stays low.** Fundamentals sit below 500 Hz with damped harmonics.
  Bare high sine tones read as a hearing test, which is what the previous
  implementation sounded like.
- **Timbre is configurable, the motif is not.** The four packs (`timber`,
  `glass`, `air`, `tap`) change the voice; all of them play the same score.
- Cues never overlap. A new cue replaces the running one.

Judge cues by ear in a real dictation loop, not in isolation:
`cargo run --example audition_cues -- --out /tmp/ws-cues --sequence`.

## Surface Model

### Overlay

The overlay is a native status instrument. It reports ready, recording, paused,
processing, error, recovery, and real result actions. Waveform, mute state, and
session state come from guarded native events; it must never estimate audio or
completion itself.

- The transparent overlay window is always-on-top, undecorated, and absent from
  the taskbar. This is distinct from the decorated main window.
- Idle overlays are parked and hidden by the native host; CSS invisibility is
  insufficient on Linux.
- Use faux glass: solid or semi-transparent designed surfaces with a hairline
  highlight, never `backdrop-filter` or blur.
- The Linux host uses fixed surfaces: 480x60 for flat states and 460x164 for
  edit states. Keep Rust dimensions and UI invoke paths aligned.
- A real user drag, not a programmatic host move, is the only source of
  remembered placement. All overlay surfaces share the same remembered top-left
  position.
- `clipboard_only` may stop for its native processing preview. Do not imply a
  full controlled-commit flow for other modes until it exists.
- Result actions use the same native insert, history, retry, restore, and
  session contracts as the standard runtime path.

### Settings

Settings are the primary product surface. Runtime-backed areas are Home,
History, Profiles, Speech & AI, Modes, Capture, Overlay, Insert & Recovery,
Diagnostics and About. Chat, Upload, Notes and Account are visible preview
layouts without native runtime behavior. Every area must state that boundary
honestly and keep one dominant content surface.

Use native window decorations on every platform. Do not add fake traffic lights,
frameless main-window chrome, or custom title-bar controls. Diagnostics uses the
same rule when opened as a pop-out.

The shell uses grouped sidebar navigation, a concise header for runtime and
auto-save state, and card-based content. A sidebar is for orientation, not a
second application. The active profile can be globally visible, while deep
editing remains in Profiles.

### Diagnostics

Diagnostics is technical but uses the same product vocabulary as settings.
Separate durable transcription history, transient runtime logs, diagnostic
preview, and scratchpad recovery. Pipeline cards expose native `capture`,
`provider`, `transform`, and `insert` state, duration, and stable error code.
Do not recreate provider labels or local metadata from model-name heuristics.

## Layout and Tokens

| Rule | Current standard |
| --- | --- |
| Background hierarchy | `--bg-base`, `--bg-surface`, `--bg-elevated` |
| Type scale | 12, 14, 16, 20, 28 px |
| Spacing | 4 px rhythm; 20 px card padding; 32 px between major sections |
| Card shape | 12 px radius, border and background elevation |
| Card elevation | background and hairline border; no drop shadow |
| Sidebar | 232 px, grouped and vertically scrollable when required |
| Long lists | `content-visibility: auto` and intrinsic-size utilities |

The universal CSS reset belongs inside Tailwind's `@layer base`. Unlayered reset
rules override layered utility classes and can silently break layout spacing.

## Component Rules

- Reuse shell primitives such as `Sidebar`, `FormCard`, `FormRow`, `Inspector`,
  `SegmentControl`, `StatusBadge`, `Toggle`, and `ProfileSwitcher`.
- Form cards group one decision and its supporting explanation. Avoid nested
  cards, duplicate borders, and visual lift on hover.
- Use `StatusDot` and status badges for compact runtime truth. Green means a
  real validated state, not a merely saved credential.
- Controls expose the native contract. A setting that does not affect runtime
  belongs in neither the UI nor the design system. This rule removed the Modes
  tab's "Cleanup settings" card: three toggles the runtime discarded on read
  (ADR 0020). Enforcing it means checking that the runtime *reads* the field a
  control writes -- a control whose value happens to match the runtime default is
  indistinguishable from one that works.
- A control must not restate an axis the UI already has. Two of those three
  toggles duplicated the mode selector: cleanup with AI cleanup off is Verbatim,
  cleanup with rewrite phrasing on is Rewrite. When one state is reachable two
  ways, no arrangement of the controls reads correctly.
- Labels and action names must use the same terms as native history, recovery,
  and provider status.

## Provider, Text Rules, and Privacy UX

Provider & Models renders capabilities and setup from native status. For
`local_preview`, it shows the speech runner, STT model, cleanup endpoint, and
cleanup model as a native preflight checklist. It does not infer readiness from
environment variables or paths.

Text Rules treats profiles as explicit work modes. Context is conservative STT
assistance; short explicit `stt_hints` are separate from snippets. Dictionary
rules run before snippets. Preview and validation use the same native analysis
path. Included profiles are normal persisted profiles with visible origin, not a
hidden second catalog.

Groq remains BYOK. UI copy says that credentials are stored locally in the OS
secret store. Never return or reveal a saved full API key to the renderer. Local
runtime setup is not authentication and must use readiness and remediation copy,
not API-key language.

## Motion and Performance

- Motion must communicate state; do not animate for decoration.
- Animate only `transform` and `opacity`; respect `prefers-reduced-motion`.
- Tab changes are immediate. Do not restore CSS crossfades that regress
  WebKitGTK scrolling.
- Do not use `backdrop-filter` in the shell or overlay.
- Settings cards have no drop shadows; scroll containers use containment and
  stable gutters; the page gradient uses fixed attachment.
- The history refresh interval is five seconds, with a manual refresh action.
- `WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING=1` is a hardware opt-out when GPU
  compositing still produces black blocks. Keep the DMABUF renderer disabled.

## Platform Boundaries

Platform constraints are product information. macOS development builds can need
Accessibility and Input Monitoring; elevated Windows targets can reject
synthetic paste; Wayland often requires clipboard-only recovery. Present the
native status and the next action. Do not invent readiness or conceal a fallback.

## References

- [UI_UX_OVERHAUL_PLAN.md](UI_UX_OVERHAUL_PLAN.md): enduring design rationale
- [ARCHITECTURE.md](ARCHITECTURE.md): UI/runtime ownership and contracts
- [PLATFORMS.md](PLATFORMS.md): platform-specific behavior
- [OVERLAY_PHASE1_HANDOFF.md](handoffs/OVERLAY_PHASE1_HANDOFF.md): historical
  overlay implementation notes
