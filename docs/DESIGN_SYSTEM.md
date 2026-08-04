# WordScript Design System

Status: 2026-08-04 — the token write of the GUI port's Leg 1 has landed
(`src/styles/globals.css` and `src/styles/shell.css`). The rules below are the
product's, and `/gallery` renders them live.

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

WordScript is a calm voice-workstation utility with an SW forge orange accent,
in three colour schemes: light, dark and system. Dark was the only scheme until
2026-08-03 and was never a decision — [ADR 0048](decisions/0048-a-light-mode-is-not-the-dark-one-inverted.md)
records why a product used from inside someone else's bright document window
cannot ship dark-only, and why the light ladder is rebuilt rather than
inverted. The light accent is `#b45c00`, not `#ff9c2b`; the identity value
measures 2.1:1 on white and is unusable as text there. It uses hierarchy, grouped forms, precise status, and restrained motion
instead of generic dark-dashboard styling. Orange identifies primary capture and
intentional attention; it is not a default decoration for every control.

The active technical stack is Tailwind CSS v4 with shadcn/ui patterns. Tokens in
`src/styles/globals.css` exposed through `@theme inline` remain the single
source of truth. Do not create parallel color, spacing, or component token sets.

**Where the system is judged: [`/gallery`](../src/windows/GalleryWindow.tsx).**
One design-time route, five sections — Foundations · Components · Motion ·
Overlay · Screens ([ADR 0055](decisions/0055-the-gallery-is-where-the-port-is-judged-and-it-is-one-route.md)).
Foundations renders the tokens in all three schemes and **measures** contrast at
render time rather than printing stored figures, because a number typed beside a
colour stops being true the moment the colour moves — which is how the light
scheme's muted step carried the dark scheme's figure for a whole pass while
failing AA ([ADR 0056](decisions/0056-the-light-schemes-muted-step-was-measured-for-the-first-time-and-missed-aa.md)).
The gallery imports the product's components and never copies them; if a
primitive looks right there and wrong in the product, the gallery is what lied.

**The prototype at `docs/prototypes/settings-rework/` is the design.** It is
read-only, and where it and a shipped surface disagree the prototype wins — that
is the point of the port. Read `demo.js` for the screen you are building and
`demo.css` for the rule; do not reconstruct from what this document implies. A
design rebuilt from its description loses the detail that was decided on
purpose, and the loss is invisible until somebody puts the two side by side.

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
  highlight. The overlay renders in a transparent window with no desktop behind
  it, so there is nothing for a blur to sample — Frost does not apply here and
  `overlay-pill.css` stays outside it ([ADR 0051](decisions/0051-frost-is-a-pair-and-it-is-not-backdrop-filter.md)).
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

The surface model above is what ships today. The port replaces it with a
**workspace window and a settings sheet over it at its own scale** — the sheet
is 1000 × 680 with `--nav-w` 196, `--nav-row-h` 28, `--content-max` 640,
`--pad-card` 16 and `--row-py` 11, over a scrim, closing on Escape, on the scrim
and on its close control. Type does not scale: 13 px body in a sheet and 13 px
body in a window is the same reading task; structure scales, type does not. That
is Leg 3 of the port relay and is not built yet; every value it moves is already
a token here, which is why no component has to change for it.

Use native window decorations on every platform. Do not add fake traffic lights,
frameless main-window chrome, or custom title-bar controls. Diagnostics uses the
same rule when opened as a pop-out.

The shell uses grouped sidebar navigation, a concise header for runtime and
auto-save state, and card-based content. A sidebar is for orientation, not a
second application. The active profile can be globally visible, while deep
editing remains in Profiles.

### Frost

Frost is the fourth surface class and the only one that is a pair.
`--bg-base`, `--bg-surface` and `--bg-elevated` are three planes of one stack:
each names a layer and each is a flat colour. Frost is what a floating surface
and the window under it do *together* — the panel goes translucent, the window
recedes behind it — and neither half is the material on its own.

- **It is `filter: blur()` on the layer behind, never `backdrop-filter` on the
  panel.** `backdrop-filter` does nothing in the shipped engine and cannot be
  feature-guarded; the full measurement is in
  [ADR 0051](decisions/0051-frost-is-a-pair-and-it-is-not-backdrop-filter.md).
- **The receding layers nest.** The shell recedes behind the settings sheet;
  the shell plus the sheet recede behind the command palette. Opening the
  palette from inside settings takes both back one step.
- **Each blurred layer repeats its own opaque ground**, or the blur's edge
  falloff draws a soft rim inside the window and eats the corner radius.
- **One strength, the settings sheet's:** `blur(2px) saturate(0.8)` behind a
  50% black scrim on the dark ladder. The light scheme rebuilds rather than
  inverts it (ADR 0048): the fill goes up (82% → 92%), the sheen goes almost
  away, and the scrim becomes `rgba(24, 20, 14, 0.26)`.
- **Where it applies: a surface that floats and is transient.** The command
  palette and the settings sheet today; a popover if one earns it. Never on a
  card, never on the sidebar, never on the overlay. A surface that is always on
  screen has nothing to recede from.
- **Under `prefers-reduced-transparency` the fill goes opaque and the window
  behind it stays sharp.** The material is a refinement of a panel that already
  reads without it, so nothing else changes. Under `prefers-reduced-motion` the
  filter transition is dropped and the state is taken without the transit.

Judge it in the native host — `/gallery` → Foundations carries the pair with a
control that takes the blur off the layer behind. A browser preview cannot show
whether this material is running, which is how the sheet shipped a plain black
scrim for several passes while its stylesheet asked for a blur.

### Diagnostics

Diagnostics is technical but uses the same product vocabulary as settings.
Separate durable transcription history, transient runtime logs, diagnostic
preview, and scratchpad recovery. Pipeline cards expose native `capture`,
`provider`, `transform`, and `insert` state, duration, and stable error code.
Do not recreate provider labels or local metadata from model-name heuristics.

## Layout and Tokens

### The ladder

Five surfaces, one ladder, and the scheme moves the whole thing rather than its
spacing. L\* and contrast below are the dark scheme, measured on the card.

| Token | Dark | L\* | Light | For |
| --- | --- | ---: | --- | --- |
| `--bg-sidebar` | `#141416` | 6.4 | `#eceae7` | Sidebar, below the window |
| `--bg-inset` | `#161617` | 7.3 | `#eae7e3` | Inputs, wells, code, logs |
| `--bg-base` | `#1c1c1e` | 10.3 | `#f5f3f0` | Window |
| `--bg-surface` | `#2e2e31` | 19.0 | `#ffffff` | Card |
| `--bg-elevated` | `#3a3a3e` | 24.6 | `#f2efeb` | Hover, active, segment thumb |

| Token | Dark | On card | Light | On card | For |
| --- | --- | ---: | --- | ---: | --- |
| `--fg` | `#f2efe9` | 11.80:1 | `#1a1815` | 17.72:1 | Primary text |
| `--fg-dim` | `#c2bfb8` | 7.37:1 | `#55504a` | 7.98:1 | Row hints, descriptions |
| `--fg-muted` | `#9b9892` | 4.71:1 | `#7a736a` | 4.68:1 | Labels and counts only |
| `--accent` | `#ff9c2b` | 6.47:1 | `#b45c00` | 4.70:1 | Primary action, selection |

**`--fg-muted` is confined to the card plane.** It is 4.71:1 on the card and
3.94:1 on `--bg-elevated` in dark, 4.68:1 and 4.08:1 in light — the same shape on
both sides. That is also *why* a row carrying muted text does not change ground
on hover, which is the fix for the hover repaint in the plan's §6 P7.

**The window is one flat colour.** The two-layer viewport-fixed gradient left
with the palette: it was two literal dark hexes and could not be carried into the
light scheme at all.

### The rest

| Rule | Current standard |
| --- | --- |
| Schemes | Light, Dark, System. `System` is a deferral resolved against `prefers-color-scheme` and re-resolved when the OS changes, never a third palette. `<html data-theme>` always carries the RESOLVED value; with no attribute the ladder is dark ([ADR 0048](decisions/0048-a-light-mode-is-not-the-dark-one-inverted.md), `hooks/useColorScheme.ts`) |
| Frost | A pair, on floating transient surfaces only. Not a fourth plane — see below |
| Typeface | Archivo (UI and display), IBM Plex Mono (measurement and code). Self-hosted woff2 in `assets/fonts/`, both SIL OFL |
| Type scale | `--t-micro` 11, `--t-label` 12, `--t-note` 13, `--t-body` 14, `--t-lead` 16, `--t-title` 20, `--t-hero` 28 px. 13 is a named step: it lets a card title sit below body size and still outrank it, on weight rather than on size |
| Optical size | Width, tracking and weight vary per step: 104% / +0.012em at 11 px through 96% / −0.026em at 28 px |
| Radius ladder | `--r-window` 10, `--r-card` 8, `--r-control` 6, `--r-small` 4 — assigned by what a thing **is**, not by how big it is. See below |
| Card material | One 1px inset highlight on the top edge only, `--edge-light`. Never on the bottom — that is a bevel. In light it inverts to a soft downward shading, because white cannot get whiter |
| Elevation | `--elev-raised`, `--elev-pop`, `--elev-window`, `--elev-sheet`. Floating surfaces only; a card never casts |
| Focus | 1.5px accent core flush to the control, plus a wide low-alpha halo. Never an offset ring |
| Spacing | 4 px rhythm (`--s1`…`--s8`). Structure reads `--pad-card`, `--row-py`, `--gap-row`, `--gap-block`, `--content-max`, `--nav-w` — never a literal, so the settings sheet can redeclare the scale in its own scope |
| Row grammar | The item carries the horizontal inset; the stack spans the card so its separators reach the group edge ([ADR 0052](decisions/0052-the-item-carries-the-inset-so-the-separator-reaches-the-edge.md)) |
| Card elevation | Background step plus the top-edge highlight. No drop shadow, no hairline in the proposed palette, and no hover transition on a card border |
| Scrollbars | Not drawn anywhere, and nothing replaces them. The edge fade was built and removed: a static mask dims every scroller's first and last 20 px permanently, and the scroll-driven variant keeps the surface animating |
| Sidebar | 232 px (`--nav-w`), grouped, its icons in rounded tiles |
| Long lists | `content-visibility: auto` and intrinsic-size utilities |

### The radius ladder

| Token | Value | For |
| --- | ---: | --- |
| `--r-window` | 10 px | A window or a sheet — the outermost object on its layer |
| `--r-card` | 8 px | A grouping surface — card, panel, stage, well |
| `--r-control` | 6 px | Something you operate — button, input, select, tab bar |
| `--r-small` | 4 px | A label, and anything sitting inside a control |

The surface had twelve radius values and no rule, and the aggregate read soft to
the point of unseriousness: a badge, a status tag, a segmented control, a sub-tab
row, a chip and a profile flag were all capsules, so every label-shaped thing on
screen was a pill. **Capsules survive only where the object is physically a
capsule** — a switch track and its knob, a level bar, a count bubble, an avatar,
a status dot, a radio, a round mic button. Everything that is a rectangle with
text in it is a rectangle.

**The overlay is exempt and stays exempt.** It keeps its own
`--ov-radius-compact: 999px` and `--ov-radius-tall: 14px`: it is a capsule by
design, it is outside the rework's scope, and it references no token from
`globals.css` at all — which is why the guard for it is a look in the native
host rather than a pinning job.

The universal CSS reset belongs inside Tailwind's `@layer base`. Unlayered reset
rules override layered utility classes and can silently break layout spacing. The
shell grammar in `src/styles/shell.css` is in `@layer components` for the same
reason: a Tailwind utility at a call site still has to win over it.

## The rules that live in a primitive, never in a screen

These four came out of the prototype's eleventh pass, which found it patching
each of them screen by screen with a different inline value. They belong in
`components/shell/` and `styles/shell.css`; a screen that restates one of them
is a signal that the primitive is missing it.

- **The card owns its inset, and the item carries the horizontal half.** The
  card pays its vertical padding, a separated stack spans the card's full width
  so its hairlines reach both edges of the group, and each item inside the stack
  pays `--pad-card` left and right. Nothing inside a card needs to know it is at
  an edge ([ADR 0052](decisions/0052-the-item-carries-the-inset-so-the-separator-reaches-the-edge.md)).
  **The action that acts on a card's content is a footer component**, not a flex
  row with a padding guessed per screen.
- **A control that must look centred is drawn on integers.** 16 / 2 / 8, never
  17 px with a 1.5 px border: an odd box has no integer centre, and a fractional
  border snaps to different device pixels on each side.
- **A stat tile carries a number that changes and summarises more rows than fit
  on screen.** Otherwise it is a row. Three tiles across the top had become a
  habit — nine of them stood on three screens, six carrying words that never
  change, all restating the banner beneath them.
- **No coloured edge bar, ever.** A vertical accent rule down the side of a
  notice is a web convention that reads as a rendering defect at this scale.
  Emphasis is the ground plus an icon tile.

Three more of the same kind:

- **A badge is for a status that is not expected.** An expected status is a dot
  and a word, or nothing. In a list, badges live in a fixed right-aligned column
  and not in the flow, or a row carrying two of them starts its actions at a
  different x from every other row.
- **A list and its detail are one surface, not two cards.** Two cards side by
  side state no relationship between themselves; the `pane` primitive puts the
  list on the sidebar plane behind a hairline.
- **One control per kind of value.** A bounded number with a unit is a stepper,
  a proportion is a slider, a measurement with a decision threshold is a meter
  with the threshold drawn in, and a text field is what is left.

## Copy budget

Not a preference. Facts that do not fit move to `docs/` and are linked from the
control that needs them.

| Element | Budget |
| --- | --- |
| Section header | 1–4 words |
| Section description | ≤ 90 characters, one line |
| Row label | 1–4 words |
| Row hint | ≤ 90 characters, one line |
| Empty state | 1 line + 1 action |
| Anything longer | → `docs/`, reached by a link |

## Component Rules

**The component library is `src/components/shell/` plus `src/styles/shell.css`.**
It holds the design components, ported 1:1 from the prototype, and it is what
the product renders. `/gallery` **displays** that library; it never defines it.
A screen in the gallery and the same screen in the product are one
implementation with two sets of props, and a component that exists only under
`src/windows/gallery/` has already made the gallery a second product.

- The ported shell kit is `Card`, `CardFooter`, `CardRows`, `Row`, `LaneCard`,
  `SubTabs`, `SectionHeader`, `PreviewBanner`, `EmptyState`, `DangerRow`,
  `Toolbar` and `ScopeTag`, plus `Stepper`, `VolumeSlider`, `InputLevelMeter`,
  `DisclosureRow`, `SegmentControl`, `StatusBadge`, `StatusDot`, `Select`,
  `Toggle`, `Inspector` and `ProfileSwitcher`. `FormCard`, `FormRow` and
  `Sidebar` are the **pre-port** shell that the shipped settings areas still
  render; nothing new may use them, and they are deleted with the last screen
  that reads them.
- The kit has since grown by what the ported screens actually needed, and the
  authority is `src/components/shell/index.ts` rather than this list: every
  control of `demo.css` §6, the nav and content column, the icon set, the orb,
  the provider marks and their sprite, the list row and its raw panel, the
  decision inbox, the pane, the connection block, the runtime log and the diff
  (Leg 2b); `Job` / `JobList` / `JobModel`, `ModelRow`, `OnboardingRail`,
  `McpList` and `Thread` (Leg 2c); and the note grammar, the window family, the
  intake, the overlay drawing and the four preview families (Leg 2d, below).
- **THE WINDOW FAMILY IS FIVE MEMBERS AND ONE CHROME.** Ask, Actions, the
  meeting HUD, the agent window and the translation window all take
  `ChatWinDeco` — a decoration strip standing in for the one the OS draws (ADR
  0003) — and the same corner resize grip. None of them invents a header, none
  of them draws traffic lights, and the differences between them are width,
  height and content. A sixth window that reaches for its own header is the
  defect this family exists to prevent.
- **THE HANDOFF CARD IS DELIBERATELY NOT A MEMBER OF IT.** No title bar, no
  close control, no resize grip: it is one question with two answers, on screen
  for about four seconds. Window chrome would invite the user to move it, which
  would mean remembering where they put it, which would mean it has a life. It
  does not.
- **THE OVERLAY IS DRAWN, NEVER RE-DERIVED.** `OverlayPillDrawing` reproduces
  the shipped pill from `overlay-pill.css` and `tauri.conf.json` — 40 px tall,
  `width: max-content`, the composition mic · bars · divider · mode · divider ·
  timer, and the shell's own `zoom: 0.87`, because at 1.0 a preview shows a
  pill 15% larger than the one on the user's screen. It is a copy of a
  measurement: if the shipped pill moves, this moves with it. Nothing in
  `overlay*.css` or `OverlayPill.tsx` may change to serve a preview.
- **Two base rules travel with the shell**, both from `demo.css` and both fenced
  to `.ws-content` / `.ws-nav` until the leg that owns the window root:
  `svg { flex: none }`, and a **default icon size of 16 px**. The second one
  BEATS a component's own `width` on specificity — in the prototype exactly as
  here — so a mark that declares 14 px still draws at 16 unless something more
  specific says otherwise. A component that needs another size overrides the
  rule, never the markup.
- **A preview says so on the surface, every time.** `PreviewBanner` is a chip and
  one line, 26 px. Its withdrawn variant keeps a box and a border, because a stop
  is exactly the case that has to interrupt.
- **A row states its scope when its value is not the window's.** *Settings means
  this machine*; anything a profile owns carries a `ScopeTag` naming the profile
  and linking to it.
- The accent means primary action, active selection, or live capture. It does
  not mean "this row is interesting". A disabled control drops the accent
  entirely rather than dimming it: at reduced opacity an accent surface is
  still the most saturated thing in its row, so the eye is drawn to the one
  control that cannot be operated.
- A measurement in its normal range carries no colour. The input meter's fill
  is neutral and only its verdict line tones, because a permanently coloured
  moving surface is a status light that never turns off.
- A level readout appears where the thing it measures is happening, and nowhere
  else ([ADR 0053](decisions/0053-a-level-readout-belongs-next-to-what-it-measures.md)).
  Never a frozen bar row standing in for a live signal: a still meter on a
  surface that claims to be listening is a fake state. Where there is room, the
  waveform; where there is not, the quantised matrix.
- Motion primitives live once, in `src/lab/`, and are shown in `/gallery` →
  Motion. The orb has four states and no periodic pulse
  ([ADR 0049](decisions/0049-the-orb-has-four-states-and-a-pulse-is-none-of-them.md));
  a level-driven component smooths at one end only, never in both JS and CSS.
- Form cards group one decision and its supporting explanation. Avoid nested
  cards, duplicate borders, and visual lift on hover.
- Use `StatusDot` and status badges for compact runtime truth. Green means a
  real validated state, not a merely saved credential.
- A limit is stated on the control that spends it, and it is the runtime's
  number (ADR 0034, ADR 0038). The overlay's auto-stop tab sharpens neutral →
  warning → danger through `data-tone`, mapping onto the overlay's own
  `--ov-accent` / `--ov-red`; it does not import the settings palette, because
  the overlay renders in a transparent window with its own compositing rules.
- A deadline appears when it becomes actionable and stays until it passes.
  Announcing it once and retracting leaves the moment it matters silent;
  showing it from the start spends permanent space on something that is
  irrelevant for most of a recording, and for most recordings entirely. The
  auto-stop tab is absent until two minutes remain, then present and sharpening.
- A signal that names a setting links to it. The overlay's auto-stop tab opens
  the control it just quoted, through a semantic anchor rather than an area id
  (`src/lib/settingsAnchors.ts`) so the link survives the settings rework. The
  target row flashes briefly on arrival -- a pointer, not a state; a permanent
  highlight reads as a warning.
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
- Never use `backdrop-filter`. It is inert in WebKitGTK 2.52.4 and `@supports`
  reports it as supported, so it cannot be feature-guarded and it fails
  silently on Linux while looking correct in a Chromium preview. Frost is built
  from `filter: blur()` on the layer behind instead (ADR 0051).
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
