# Settings Surface Rework Plan

Status: 2026-08-03 — **Stage 0 done and accepted; revised 2026-08-02 by a third
pass over the prototype (§11.7–§11.12). Stage 1 is the next task and splits
(§11.13): Stage 1a is unblocked, Stage 1b waits on a palette look that needs a
native host. Nothing has been implemented yet.**

> **2026-08-03 — the recording limits changed under this plan.** ADR 0038 and
> ADR 0039 shipped outside the rework and touched two things it owns. The
> prototype was updated with them and is still the target shape:
>
> - Profiles → Defaults now carries **three** rows, not two: *Processing limit*
>   (read-only, the runtime's number), *Auto-stop* (renamed from "Max
>   recording"), *Stop after silence*. Settings → Language Models gains
>   *Account plan*, which is what the processing limit follows.
> - The overlay deep-links into the auto-stop control via a **semantic anchor**
>   (`capture.auto_stop`, `src/lib/settingsAnchors.ts`), not an area id. Stage 3
>   and Stage 4 must keep that anchor resolvable when the control moves —
>   updating the mapping in that one file is the whole obligation. This is the
>   real mechanism the prototype's dead `docLink` stands in for, and the rework
>   can adopt it for the other cross-surface links.
>
> §1's "the overlay is out of scope" still holds: no overlay token, size or CSS
> rule is part of the rework, and the dependency runs the other way.

> This is the working plan for [ROADMAP.md](ROADMAP.md) Phase 7, second half:
> *"Rework the settings surface completely. The information architecture is
> usable but the presentation is not."* The profile-catalogue half of Phase 7 is
> separate work and is not planned here.
>
> Current rules live in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md); enduring rationale
> for the shipped shell lives in [UI_UX_OVERHAUL_PLAN.md](UI_UX_OVERHAUL_PLAN.md).
> Neither is superseded until this plan ships and an ADR records the change.

## 0. Start here

**If you are picking this plan up: read this section, then §11.7–§11.14, then
§12, then start Stage 1a.** Everything above §8 is the derivation and is still
accurate except where §11 records a correction. Do not re-derive it.

The one correction that changes how the whole plan is read is **§11.7**:
*Settings means this machine.* Half the shipped settings are per-profile in the
runtime and were presented as global; §4.2's table sorts by where a control is
found, and has to be read with the scope rule on top of it.

**The prototype is mandatory reading and must not be deleted.**
[`prototypes/settings-rework/`](prototypes/settings-rework/README.md) — open
`index.html` in a browser. It is the accepted shape of the target: 20 screens,
the proposed design system on its own screen, and the switches that settled the
calibration. It is not imported by `src/`, ships nothing, and is the reference
Stage 1 through Stage 5 build against.

**Settled by review on 2026-08-02, do not reopen:**

| Question | Answer |
| --- | --- |
| Palette | The proposed side of the switch — §5.1 values, verified |
| Copy | The budget side — §5.2 |
| Density and accent reach | **Standard** of the three variants |
| Information architecture | §4.2 as built in the prototype, with the §11 deltas |
| The prototype itself | Kept, handed forward, not deleted |

**Still open:** §9, plus the MCP-server question recorded in §10.1, which is new
and is not a settings problem — it is an architecture problem this plan
surfaced. Open in a different sense: the palette has never been seen on a real
panel (§11.13). That does not reopen the decision — it is the one check the
prototype could not perform, and it moves into Stage 1b rather than blocking it.

## 1. Scope

**In scope:** the settings surface — window shell, navigation, information
architecture, copy, color tokens, and the render/scroll performance of that
surface.

**Out of scope, explicitly:**

- **The overlay.** Confirmed unchanged. No token, size, or CSS change in
  `overlay*.css` or `OverlayWindow.tsx` is part of this plan. Where a shared
  token moves, the overlay keeps its current computed value.
- **Native runtime semantics.** No change to session, insert, recovery,
  provider, or mode contracts. ADR 0018, 0019, 0020, 0024 and 0025 bind this
  work; the redesign moves controls, it does not move ownership.
- **Feature implementation.** Previews are built as previews. No roadmap phase
  is pulled forward by this plan.

**Delivery order:** a standalone browser visualization first, discussed and
agreed, before any change lands in `src/`.

---

## 2. Evidence

Every number below is measured against the current tree, not estimated.

### 2.1 The navigation carries two different verbs

`src/windows/SettingsWindow.tsx:83-99` defines **14 areas in 4 groups** (13 in
production, 14 with the dev-only overlay diagnostics entry). They mix two
unrelated activities:

| Activity | Areas |
| --- | --- |
| **Work** — things the user does or authors | Home, History, Profiles, Chat, Upload, Notes |
| **Configure** — things the user sets once | Speech & AI, Modes, Capture, Overlay, Insert & Recovery, Diagnostics, About, Account |

The sidebar groups (`Workspace / Engine / System / More`) cut across that line
rather than along it: Profiles (authoring) sits in Workspace next to History
(reading), while Account (configuration) sits in More next to Chat (a preview of
work). There is no position in the current list where a user can predict whether
a thing is a place to work or a place to configure.

### 2.2 The surface carries an essay

Measured across `src/components/settings/` and `src/components/areas/`
(excluding tests), counting string literals of 25+ characters:

| Area | Words of prose | Cards |
| --- | ---: | ---: |
| Profiles (`PromptsTab`) | 524 | 10 |
| Diagnostics (`RebuildLabTab`) | 514 | 8 |
| Speech & AI (`ApiModelsTab`) | 436 | 6 |
| Modes (`ModesTab`) | 435 | 7 |
| Insert & Recovery | 252 | 6 |
| Account | 159 | 3 |
| Notes | 143 | 1 |
| Capture (`InputTab`) | 135 | 2 |
| Upload | 97 | 2 |
| Overlay | 96 | 2 |
| Chat | 86 | 1 |
| all remaining | 191 | — |
| **Total** | **3068** | **52** |

(Card count is `<FormCard>` occurrences across the fourteen areas actually
routed by `SettingsWindow.tsx`. Noted in passing: `PermissionsArea.tsx` — 163
lines, 4 cards — is exported and imported by nothing. It duplicates four cards
of `InsertRecoveryArea` and is dead code from the 2026-06-21 consolidation.
Re-verified 2026-08-03 with the provenance, so Stage 1a does not have to derive
it again: `afe600f` added the file *and* routed it on 2026-06-11; `527276c`
created `InsertRecoveryArea` on 2026-06-21, dropped the route, and left the file
behind. Its four cards — *Insert readiness*, *Driver chain*, *Prerequisites &
limits*, *Recovery* — are a strict subset of the six `InsertRecoveryArea`
renders, off the same `useNativeInsertion` hook. There is no barrel in
`src/components/areas/`; the only remaining occurrence of the name in `src/` is
its own `export function` line. Delete it in Stage 1a.)

68 `hint=` / `description=` strings are 20 characters or longer. The longest
five:

- 394 chars — `InputTab`, silence-threshold hint
- 374 chars — `PromptsTab`, Replacements description
- 351 chars — `ModesTab`, workspace-context description
- 308 chars — `PromptsTab`, Words & names description
- 294 chars — `InsertRecoveryArea`, volume hint

`ModesTab.tsx:586-593` renders a five-line paragraph *inside* a settings card
explaining why the agent will not invent slang. It is good writing in the wrong
place: it is documentation, and it is not findable when it is needed and not
skippable when it is not.

For calibration, the equivalent OpenWhispr row descriptions run one line:
*"Play a tone when recording starts and stops."* / *"Automatically pause music
when dictation starts."*

### 2.3 The palette sits at the bottom of the range

From `src/styles/globals.css:9-35`:

| Token | Value | L\* | Contrast on card |
| --- | --- | ---: | ---: |
| `--bg` (window) | `#0a0d11` | 3.5 | — |
| `--surface-elevated` (card) | `#1c2127` | 12.5 | — |
| `--surface-strong` (hover) | `#28333d` | 20.7 | — |
| `--fg` | `#f4f1ea` | — | 14.36:1 |
| `--fg-dim` | `#a4b1bd` | — | 7.41:1 |
| `--fg-muted` | `#707e8b` | — | **3.89:1** |

Two consequences — and the first is not the one it looks like:

1. **The layer separation is fine; the whole ladder sits too low.**
   Window-to-card is 9.0 L\* points, which is ample. The problem is absolute
   position: a window at L\* 3.5 is inside the range where panel black crush and
   WebKit dithering flatten everything above it, so an adequate delta stops
   reading as one. Lifting the ladder is the fix; widening it is not.
2. **`--fg-muted` on a card is 3.89:1.** It carries every 12 px `hint` and
   `description` in the app, which is below WCAG AA (4.5:1) for text at that
   size. `--fg-dim` at 7.41:1 is healthy and must not regress when the ground
   gets lighter.

macOS System Settings in dark mode sits around `#1e1e1e` window / `#2c2c2e`
grouped card. WordScript's window is roughly three L\* points below the darkest
surface macOS uses at all.

### 2.4 The scroll jank is mostly not CSS

[SETTINGS_SCROLL_PERFORMANCE_HANDOFF.md](handoffs/SETTINGS_SCROLL_PERFORMANCE_HANDOFF.md)
is marked *"Implemented and validated 2026-06-21"* and addressed compositing
cost. The jank that remains has different causes, ranked by expected impact:

**P1 — Every keystroke is an IPC round trip and a disk write.**
`SettingsWindow.tsx:177-255` — `patch()` calls `saveConfig(next)`
unconditionally, with no debounce. `ModesTab.tsx:483,557,581` bind
`agent_name`, `style_instructions` and `style_sample` directly to `patch`. So
one typed character produces: `invoke("save_config")` → Rust config lock → JSON
write → `ready` event → `setForm({ ...state.config })` → full re-render of a
643-line component. At ordinary typing speed that is roughly five config writes
per second. This is the single largest interaction cost in the surface and no
CSS change can touch it.

**P2 — Every navigation remounts the whole area.**
`SettingsWindow.tsx:449` wraps the rendered area in `<div key={active}>`. The
key forces React to discard and rebuild the subtree on every sidebar click —
against components of 1085, 1019 and 1720 lines.

**P3 — The scroll container fights itself.**
`SettingsWindow.tsx:447-448`: `[will-change:scroll-position]` permanently
promotes a compositing layer, and `[contain:content]` sits on the *growing*
content column rather than on its children. On WebKitGTK at large window sizes
both raise per-frame cost instead of lowering it. Needs measurement, not
assumption.

**P4 — The page background repaints per frame.**
`globals.css:241-247` sets two background layers with
`background-attachment: fixed`. The handoff records this as a fix ("composites
it once instead of every scroll frame"). In WebKitGTK a viewport-fixed
background is repositioned relative to the viewport on every scroll frame, which
is the opposite. **This contradicts a documented decision and must be measured
before it is changed**; if the measurement flips it, the handoff gets a
correction note and an ADR records why.

**P5 — Long-list containment is applied to 3 lists out of many.**
`ws-list-item-*` appears in `HistoryArea`, `HomeRecentList` and the `PromptsTab`
rule cards only. `ModesTab`, `ApiModelsTab`, `RebuildLabTab` and
`InsertRecoveryArea` render comparably long stacks without it.

**P6 — One component owns ten cards.**
`PromptsTab.tsx` is 1720 lines with 33 hook calls. Any state change re-renders
all ten cards. Splitting it is both the IA fix and the performance fix.

**P7 — Cards repaint on pointer transit.**
`.ws-card:hover { border-color }` with a 150 ms transition (`globals.css:325-331`)
fires as the pointer crosses cards during scrolling. DESIGN_SYSTEM.md already
forbids this: *"Avoid ... visual lift on hover."*

### 2.5 The surface contradicts its own rules

Three DESIGN_SYSTEM.md rules are currently broken by the shipped surface:

| Rule | Violation |
| --- | --- |
| *"Do not render fake states or fake readiness"* | Chat, Upload, Notes and Account render sample state as if it were runtime state |
| *"Avoid ... visual lift on hover"* | `.ws-card:hover` |
| *"Do not use `backdrop-filter` in the shell"* | `.ws-pill`, `.glass*`, `.glass-panel`, `ui/card.tsx` `glass` variant, `ui/preflight-card.tsx` |

The `glass*` classes are dead weight from the removed Glass prototype kit but
remain reachable from `ui/card.tsx` and `ui/window.tsx`.

---

## 3. What the donor teaches

Source: `donors/openwhispr donor-screenshots/` (30 screenshots) and the upstream
repository `OpenWhispr/openwhispr`, read at `src/components/ControlPanelSidebar.tsx`,
`SettingsModal.tsx`, `SettingsPage.tsx`, `ui/SidebarModal.tsx`, `ui/SettingsSection.tsx`.

Treated per the reference rules: **borrow the structure, avoid the visual
identity.** OpenWhispr is AGPL-3.0, as is WordScript; no code is copied, and no
asset, wordmark, icon or color is taken. What follows is structural analysis.

### Borrow

1. **Two surfaces, one verb each.** The main window is a workspace: Home, Chat,
   Notes, Upload, Dictionary, Integrations — six flat entries, no groups.
   Settings is a separate surface with its own sidebar: nine sections in four
   groups. `Settings`, `Support` and the account row sit at the *bottom* of the
   workspace sidebar, below a divider, as secondary rows. A user never has to
   decide which of fourteen entries is a setting.

2. **Depth goes inside a section, not into the sidebar.** `Speech-to-Text` holds
   a pill row `[Dictation | Note Recording]`. `Language Models` holds
   `[Dictation Cleanup | Voice Agent | Note Formatting | Chat]`. Their own
   `SettingsModal.tsx` records a prior consolidation in code — four sidebar
   items collapsed into two, with `SECTION_ALIASES` and `LEGACY_SUB_TAB` maps
   keeping old deep links working. That is precedent for exactly the move
   proposed here, including how to keep entry points alive across it.

3. **An exclusive lane is one card of radio rows, not a segment plus cards.**
   Cloud / Cloud Providers / Local / Self-Hosted / Enterprise render as five
   rows in one card: icon tile, name, one-line description, radio at the right,
   and an `Active` badge on the selected row. WordScript's provider lane is the
   same shape of decision and currently spends a `SegmentControl` plus two to
   four separate cards on it.

4. **One line per row, always.** Section header: two to four words plus one
   descriptive line. Row: two to four words plus at most one line. No paragraph
   appears anywhere in their settings surface.

5. **Empty states carry the next action.** *"No transcriptions yet — Press
   `Ctrl+Space` to start."* Not an illustration, not an explanation.

6. **Onboarding is a three-step stepper with a live test.** `Setup →
   Permissions → Activation`, completed steps marked, and the final step ends in
   a text field labeled *"Click here and use your hotkey to dictate…"* — the
   setup proves itself before it claims success.

7. **Destructive actions are visually separate and last.** `System` ends with a
   `Clear Cache` and a red `Reset` on their own rows, under `Data Management`,
   after everything harmless.

### Avoid

- **Their color and accent.** Blue-on-charcoal with `oklch` surfaces. WordScript
  keeps warm neutrals and SW forge orange.
- **Their modal chrome.** Settings opens as a centered dialog with a scrim over
  the main window. ADR 0003 binds WordScript to native window decorations; see
  §4.1 for the resolution.
- **Their commercial furniture.** Upgrade banners, plan cards, workspace/teams,
  referral entries. WordScript has no account model and must not grow the
  affordances for one.
- **Their density in model lists.** Twelve download rows in one card is a lot of
  identical weight; WordScript should collapse to recommended plus a disclosure.

---

## 4. Target architecture

### 4.1 Two surfaces

**Decision to confirm:** OpenWhispr renders settings as a modal dialog. ADR 0003
forbids fake window chrome, and a scrim-backed modal that fills 90 % of the
window is a window pretending not to be one.

**Recommendation: a second native window**, opened with `Cmd+,` / `Ctrl+,` from
a `Settings` row at the bottom of the workspace sidebar. Reasons: it matches
macOS System Settings (a real window, not a sheet); it reuses the existing
`open_rebuild_lab_window` pop-out pattern already in the codebase; it keeps ADR
0003 intact without argument; and it lets settings and workspace be visible at
the same time, which matters while configuring hotkeys or watching diagnostics.
The alternative (in-window modal) is cheaper and stays on one window — flagged
in §9 as an open decision. The browser demo will show the window variant; both
read identically inside the frame.

```
WORKSPACE WINDOW                      SETTINGS WINDOW (Cmd+,)
┌──────────┬────────────────────┐     ┌──────────┬────────────────────┐
│ ⌕ Search │                    │     │ APP      │  Speech-to-Text    │
│ Home     │                    │     │  General │  ────────────────  │
│ History  │      content       │     │  Hotkeys │ [Dictation][Upload]│
│ Profiles │                    │     │ AI       │                    │
│ Notes    │                    │     │  Speech… │   ┌──────────────┐ │
│ Upload   │                    │     │  Models  │   │ lane rows    │ │
│ Chat     │                    │     │  Agents  │   └──────────────┘ │
│ ─────    │                    │     │ SYSTEM   │                    │
│ ⚙ Settings                    │     │  Delivery│                    │
│ ? Help   │                    │     │  Privacy │                    │
│ ─────    │                    │     │  Diag…   │                    │
│ ◉ Profile│                    │     │  About   │                    │
└──────────┴────────────────────┘     └──────────┴────────────────────┘
```

### 4.2 Complete area mapping

Nothing is deleted without a destination. Every card in the current surface
appears exactly once below.

#### Workspace window

| View | Sources | Notes |
| --- | --- | --- |
| **Home** | `HomeArea` + `ModesTab` *Effective mode* | Readiness, effective mode (read-only, ADR 0024), recent dictations, next blocking action |
| **History** | `HistoryArea` *Filters*, *Transcriptions* | *History policy* moves to Settings → Privacy & Data |
| **Profiles** | `PromptsTab` (all 10 cards) + everything §11.7 moves here | List + detail; detail gets sub-tabs `[Defaults · Context · Words · Replacements · Snippets]` |
| **Notes** | `NotesArea` | Preview, labeled |
| **Upload** | `UploadArea` | Preview, labeled |
| **Chat** | `ChatArea` | Preview, labeled |
| **Integrations** | *new* | Preview for Phase 8 MCP server + CLI, labeled |

Sidebar footer: `Settings` · `Help` · active-profile row (today's `ProfileSwitcher`).

#### Settings window

| Group | Section | Sources |
| --- | --- | --- |
| **APP** | **General** | `InputTab` *Microphone*; `InsertRecoveryArea` *Sound*; `OverlayTab` *Overlay placement*, *Result overlay*; `ModesTab` *Workspace context* |
| | **Hotkeys** | `InputTab` *Shortcuts* + activation mode; `ModesTab` *Hotkeys*, *Mode-select overlay* |
| **AI** | **Speech-to-Text** | `ApiModelsTab` key card, *Local runtime setup*, *Speech-to-text*, language, gates |
| | **Language Models** | Sub-tabs `[Cleanup · Rewrite · Agent · Prompt Enhance]`; `ApiModelsTab` *Cleanup model*, *Agent model*; `ModesTab` *Agent*, *Communication style* |
| | **Agents** | *new* — Phase 8 preview, labeled |
| **SYSTEM** | **Delivery & Insert** | `InsertRecoveryArea` *Insert readiness*, *Driver chain*, *Prerequisites & limits*, *Delivery*, *Recovery* |
| | **Privacy & Data** | `HistoryArea` *History policy*; `AccountArea` *Data export & import*; secret-store statement |
| | **Account & Sync** | `AccountArea` *Account*, *Self-hosting sync* — preview, added 2026-08-02 (§11.5) |
| | **Diagnostics** | `RebuildLabTab` unchanged in content, keeps its existing sub-tabs and pop-out |
| | **About & Updates** | `AboutTab` |

Result: **14 flat entries → 7 workspace views + 10 settings sections in 3
groups.** The longest single list a user scans drops from 14 to 7. (Nine
sections when this section was written; Account & Sync was added by §11.5.)

**Corrected 2026-08-02 by §11.7.** The table above sorts by where a control is
*found*; it has to sort by what a value *belongs to*. Settings means this
machine. Every per-profile value — mode, delivery, workspace context, recording
limits — is in Profiles → Defaults, and the two that stay in a settings section
for findability carry a scope tag naming the profile. Read every row of this
table with that rule on top of it.

`AccountArea` *Account* and *Self-hosting sync* describe a product that does not
exist (ROADMAP: "V2 or later"). They are removed from the surface and recorded
in §7 as documented-pending, not rendered as a preview — there is nothing to
preview.

#### Where the three mode-related things live

ADR 0024 requires the processing mode to have exactly one source. Today
`ModesTab` shows an effective-mode indicator, a mode selector, mode hotkeys, and
per-mode model configuration in one place, which is why it reads as four tabs
stacked. They separate cleanly:

| Thing | Kind | Home |
| --- | --- | --- |
| Which mode is effective right now | runtime truth, read-only | Workspace → Home |
| Which mode this profile defaults to | profile content | Workspace → Profiles |
| Which model each mode uses, and how it writes | configuration | Settings → Language Models |
| Which key selects a mode | configuration | Settings → Hotkeys |

**Constraint:** the redesign must not reintroduce a second writable mode control
that can outrank the profile. ADR 0024 exists because that already happened once.

### 4.3 Rules the new structure must obey

1. **One verb per surface.** If a user *does* it, it is in the workspace. If a
   user *sets* it, it is in settings.
2. **Sidebar depth is one level.** New depth goes into a sub-tab row inside the
   section, never into a new sidebar entry.
3. **A section fits without a sub-tab row, or it earns one.** Sub-tabs below
   three entries are a smell; above five they are a sidebar in disguise.
4. **A limit is stated where it is spent** (ADR 0034). Generalized: a
   consequence is reported in sight of the control that causes it.
5. **A preview says so, on the surface, every time.** Not in a tooltip.
6. **Deep links survive.** Every current area id keeps working via an alias map,
   on the `SECTION_ALIASES` pattern the donor uses.

---

## 5. Design direction

The brief is pinned: lighter dark, native macOS register, rounded, more explicit
button affordances, less text. That pins the visual world, so this plan does not
run a direction tournament — it proposes one committed treatment and asks the
demo to settle the calibration. Three variants of *density and accent usage*
within that world ship in the demo (§7), not three different worlds.

### 5.1 Color — lift the whole stack

Confirmed decision: **dark only, lifted.** No light theme.

Proposed starting values, to be validated in the demo and in the native host:

| Token | Today | Proposed | L\* | Role |
| --- | --- | --- | ---: | --- |
| `--bg-sidebar` | `color-mix(bg 80%, black)` | `#141416` | 6.4 | Sidebar, below the window |
| `--bg-base` | `#0a0d11` | `#1c1c1e` | 10.3 | Window |
| `--bg-inset` | — | `#161617` | 7.3 | Text inputs, code, wells |
| `--bg-surface` | `#1c2127` | `#2e2e31` | 19.0 | Card |
| `--bg-elevated` | `#28333d` | `#3a3a3e` | 24.6 | Hover, active, segment chip |
| `--border` | `rgba(255,255,255,.13)` | `rgba(255,255,255,.10)` | — | Hairline |
| `--border-strong` | `rgba(255,255,255,.20)` | `rgba(255,255,255,.16)` | — | Emphasis hairline |
| `--fg` | `#f4f1ea` | `#f2efe9` | — | Primary |
| `--fg-dim` | `#a4b1bd` | `#c2bfb8` | — | Secondary — carries row descriptions |
| `--fg-muted` | `#707e8b` | `#9b9892` | — | Tertiary — labels, counts, never body text |
| `--accent` | `#e68900` | `#ff9c2b` | — | SW forge orange, lifted for the lighter ground |

Measured against the proposed card `#2e2e31`:

| Pair | Today | Proposed |
| --- | ---: | ---: |
| Window → card separation | 9.0 L\* | 8.7 L\* |
| `--fg` on card | 14.36:1 | 11.80:1 |
| `--fg-dim` on card | 7.41:1 | 7.37:1 |
| `--fg-muted` on card | 3.89:1 ✗ | **4.71:1** ✓ |
| `--accent` on card | 6.13:1 | 6.47:1 |

Each column is measured against its own card: `#1c2127` today, `#2e2e31`
proposed. Corrected 2026-08-02 during the Stage 0 build, where every value in
this section was re-computed: the `--accent` cell previously read `5.12:1`,
which is `#e68900` against the *proposed* card, not against today's. That figure
is the one the rationale below uses, and it is why the orange is lifted; it just
does not belong in the "Today" column. Every other value here holds.

Rationale:

- The ladder moves up ~7 L\* points and keeps its spacing. Window at 10.3 is in
  the same band as macOS System Settings; the card at 19.0 reads as a distinct
  layer instead of a slightly-less-black rectangle.
- `--fg-dim` holds at 7.4:1 rather than being spent on the lighter ground, and
  every row description moves onto it. `--fg-muted` clears AA for the first
  time and is restricted to labels and counts.
- The warm cast stays and the neutrals lose the blue tint (`#a4b1bd` → `#c2bfb8`);
  this is a lift and a de-hue, not a new palette. The orange is lifted one step
  because `#e68900` drops to 5.1:1 against the lighter ground.
- The two-layer body gradient is removed (see §6, P4). The window is one flat
  color, like System Settings.

All values above are computed, not sampled, and are a starting point for the
demo — the native host and a real panel are the judges.

**Overlay guard:** overlay CSS must be pinned to its current computed values
before any token moves, and the overlay verified visually unchanged in the
native host. This is a gate, not a check at the end.

### 5.2 Copy — a budget, not a preference

| Element | Budget | Enforcement |
| --- | --- | --- |
| Section header | 1–4 words | — |
| Section description | ≤ 90 chars, one line | lint rule |
| Row label | 1–4 words | — |
| Row hint | ≤ 90 chars, one line | lint rule |
| Empty state | 1 line + 1 action | — |
| Anything longer | → `docs/`, reached by a link | review |

Target: **3068 words → under 900** on the settings surface, without deleting a
single fact. Facts that do not fit move to documentation and are linked from the
control that needs them.

Worked example, `ModesTab.tsx:494` (239 chars):

> *"How this profile writes. Applies to Agent and to Rewrite; Cleanup, Verbatim
> and Prompt Enhance stay untouched. The level sets the form only — it never
> changes the language you dictated in."*

becomes

> **Communication style** — Applies to Agent and Rewrite. *(link: how style is
> applied)*

The precedence rule, the language guarantee and the untouched modes are all
real and all belong in the ADR 0023 derivation, which already states them.

`ModesTab.tsx:586-593` (the slang paragraph) is removed from the card entirely
and becomes one line above the lexicon buttons: *"The agent uses only slang your
rules and sample contain."*

### 5.3 Components

Additions to the shell kit:

| Component | Purpose | Replaces |
| --- | --- | --- |
| `LaneCard` | One card of radio rows: icon tile, name, one line, radio, `Active` badge | `SegmentControl` + separate provider cards |
| `SubTabs` | Pill row under a section header | Ad-hoc `role="tablist"` in `PromptsTab`, `RebuildLabTab` |
| `SectionHeader` | Title + one line, outside the card | Inline `FormCard` header, kept for cards |
| `PreviewBanner` | Standing "not wired to the runtime yet" strip | Ad-hoc prose in preview areas |
| `EmptyState` | Icon, one line, one action | Ad-hoc empty markup |
| `DangerRow` | Destructive action, red, last in its card | Ad-hoc buttons |
| `Toolbar` | Filters on one line above the list they act on | `HistoryArea` *Filters* card |
| `ScopeTag` | Marks a row whose value belongs to the active profile, and links to it | nothing — the scope is currently invisible |

Added 2026-08-02 by §11.9, from the shipped kit rather than new: `Stepper`,
`VolumeSlider`, `InputLevelMeter` and `DisclosureRow` are kept and used
everywhere their value type occurs. They are listed here because the first
Stage 0 build silently substituted a bare text field for all four.

Kept as-is: `FormCard`, `FormRow`, `DisclosureRow`, `StatusBadge`, `StatusDot`,
`StatTiles`, `Stepper`, `VolumeSlider`, `InputLevelMeter`, `SegmentControl`,
`Select`, `Toggle`, `HotkeyRecorder`, `ShortcutField`, `Inspector`,
`ProfileSwitcher`.

Removed: `.glass`, `.glass-elevated`, `.glass-strong`, `.glass-subtle`,
`.glass-panel`, `.ws-pill`, and the `glass` variants of `ui/card.tsx` and
`ui/window.tsx` — all `backdrop-filter`, all forbidden by DESIGN_SYSTEM.md, none
required by the overlay (which uses its own faux-glass in `overlay-pill.css`).

Radii: card `12px` (from 10), control `8px` (unchanged), segment/pill `999px`,
input `8px`. "More buttons" is read as *more explicit affordances*: bare
`<select>` rows become `LaneCard` rows or segmented controls where the option
count allows; hotkey fields become click-to-change targets with visible key
caps, as they already are in `HotkeyRecorder`.

### 5.4 Motion

Unchanged from DESIGN_SYSTEM.md: `transform` and `opacity` only, no tab
crossfade, `prefers-reduced-motion` respected. One addition: **no hover
transition on card borders** (§2.4 P7).

---

## 6. Performance work

Each item ships with a before/after measurement in the native host. No item is
declared fixed on inspection.

| # | Fix | Measure with |
| --- | --- | --- |
| P1 | Local draft state for text inputs; commit on blur or 400 ms debounce. Discrete controls (toggle, select, radio) keep instant save. Mirrors the shortcut recorder's existing draft-then-commit pattern. | Count `save_config` calls in the runtime log while typing a 200-char sample |
| P2 | Drop `key={active}`; keep areas mounted, or reset explicitly where a reset is wanted | React Profiler mount count per navigation |
| P3 | Remove `[will-change:scroll-position]`; move `contain` from the column to the cards | Frame timing on a fullscreen Profiles scroll |
| P4 | Replace the fixed-attachment body gradient with a flat window color | Frame timing, same scroll. **Contradicts the 2026-06-21 handoff — measure first, correct the handoff and add an ADR if it flips.** |
| P5 | Apply `ws-list-item-*` to every list over ~10 rows | Frame timing on Diagnostics logs |
| P6 | Split `PromptsTab` along the new sub-tabs; same for `ApiModelsTab` and `RebuildLabTab` | LOC per component; re-render count on one keystroke |
| P7 | Remove `.ws-card:hover` border transition | Paint-flash during scroll |

P1, P2 and P6 are JavaScript costs. They are why the CSS-only pass of
2026-06-21 improved scrolling without making the surface feel fast.

---

## 7. Previews

Confirmed direction: **build every preview that can be built honestly, and
document the rest.** A preview is a real layout with real vocabulary, sample
data, and a standing label — never a fake readiness state.

### Built as previews

| Preview | Roadmap basis | Content source |
| --- | --- | --- |
| **Account & Sync** | V2 or later (added 2026-08-02, §11.5) | Account mode as a lane, self-hosting sync, no export card — export moved to Privacy & Data and stays there |
| **Onboarding** | Phase 6 — Guided Setup | Three steps: Provider → Permissions → Trigger, ending in a live test field. Steps derive from the real preflight in `ApiModelsTab` and `InsertRecoveryArea`. |
| **Agents** | Phase 8, ADR 0029/0030 | Targets list with roles (`inspect`/`work`/`resume`), thread pane, orchestrator setting, TTS preset with measured TTFB, rate limit and mute. Roadmap Phase 8 names *"its own settings area, named Agents"*. |
| **Live preview & commit** | Phase 3 | Raw vs. transformed text, guardrail interventions, commit/retry/restore/cancel |
| **Notes** | V2 (existing) | Existing `NotesArea`, restyled |
| **Upload** | V2 (existing) | Existing `UploadArea`, restyled |
| **Chat** | V2 (existing) | Existing `ChatArea`, restyled |
| **Integrations** | Phase 8 | MCP server endpoint, token, port file; CLI install; all marked planned |

### Documented as pending, not rendered

| Item | Why not a preview | Where recorded |
| --- | --- | --- |
| ~~Account, sign-in, sync~~ | ~~ROADMAP: V2 or later. No decided data model to lay out.~~ | **Overruled 2026-08-02 — see §11.5. It is a built preview.** |
| Translation mode | **Not in the roadmap.** The donor has `Dictation Translation`; WordScript has not decided it. | New roadmap candidate entry, with an open decision gate — not a promise |
| Meeting mode / diarization | V2, and diarization has no native path | ROADMAP |
| Voice Nudge | Phase 9, ADR 0031 — enters through the existing `clipboard_only` preview, so it needs no new surface yet | ROADMAP |
| Provider stack expansion | Phase 4 — `LaneCard` is built to take more rows; rows are not invented before the providers exist | ROADMAP |

Every preview screen carries `PreviewBanner`: *"Layout preview — not wired to
the runtime. Planned: Phase N."* That is what makes previews compatible with
*"never render fake readiness"*: the readiness claim is explicitly false on the
surface.

---

## 8. Execution

### Stage 0 — Browser demo — **done and accepted 2026-08-02**

Delivered at [`prototypes/settings-rework/`](prototypes/settings-rework/README.md):
**19 product screens plus a Design System screen**, the three switches, and a
screen picker. Nothing landed in `src/`.

Two additions to what is specified below:

- A **Design System** screen. §5 specifies the system rework but scatters it
  across colour, copy, components, radii and motion; a system inferred from
  screens cannot be argued with directly. It puts the whole thing on one page —
  surfaces with measured contrast, type scale, spacing rhythm, the elevation
  rule, the radius rule, the three layout primitives, every component in every
  state, motion durations — and it changes live with the switches.
- **Account & Sync** as a tenth settings section (§11.5), and `Agents` split
  into Orchestrator / Targets / Voice (§11.3).

Measured prose reduction, counted from the demo's own document, both sides
computed on every render so the totals compare like with like: **19 screens
2317 → 1917 words (−17 %)**; the **10 screens carrying shipped copy 1454 → 1054
(−28 %)**. Largest per screen: Language Models −49 %, Upload −42 %, General
−38 %, Diagnostics −29 %, Hotkeys −28 %, Profiles −25 %. These are the demo's
numbers, not the surface's: it reproduces the structure and the worst offenders,
not every card, so they do not certify §5.2's 3068 → under 900 target. They show
whether the reduction reads as lossy.

*(Both columns grew in the third pass, recorded in §11.7–§11.12, because that
pass added product — a second MCP surface, the CLI, the profile Defaults tab.
Screens with no shipped copy to compare against are now written to budget on
both sides, so they no longer report a reduction they cannot have earned. Two
further reductions do not appear in either total because the meter only swaps
prose: History lost a filter card to a toolbar, General lost two rows to
Profiles.)*

Verified across 240 combinations (20 screens × 3 densities × 2 palettes × 2 copy
states) at 1440 px, and 60 more at 920 px: no overflow, no placeholder leaks.
The mechanical design detector is clean.

**Gate: passed.** See §0 for what it settled.

Original specification:

A standalone, self-contained HTML visualization. **Not imported by `src/`, not
routed in `App.tsx`, no Tauri API, no build-system change.** It exists to be
looked at and argued with.

- Location: `docs/prototypes/settings-rework/` with a README stating it does not
  ship. Optionally also published as a hosted page for review on another
  machine.
- Screens: the 7 workspace views, the 9 settings sections, and the 7 previews.
- Real content throughout — actual WordScript labels, real provider names, real
  hotkey tokens, real diagnostics vocabulary. No lorem, no invented capability.
- A **before/after switch** on two axes: the palette, and the copy budget on the
  three worst offenders (Profiles, Modes, Speech & AI). This is what makes the
  reduction arguable rather than asserted.
- Three density/accent variants of the pinned world, so the calibration is a
  choice rather than a default.

**Gate: agreement on IA, palette and copy budget before Stage 1.**
*(Reached 2026-08-02. Palette: proposed. Copy: budget. Density: Standard.)*

### Stage 1 — Tokens and shell primitives

**Split 2026-08-03 by §11.13**, because the palette gate blocks one half of this
stage and none of the other.

**Stage 1a — everything that does not move a color value. Unblocked.**
`glass*` and `ws-pill` removed from `globals.css`, `ui/card.tsx` and
`ui/window.tsx` — those three files are the whole job; the other three matches in
`src/` are a sound pack named "Glass — soft bell", one line of prose in
`OverlayGallery.tsx`, and two comments in `overlay-pill.css` about the overlay's
own faux glass, which stays. `PermissionsArea.tsx` deleted (§2.2). `LaneCard`,
`SubTabs`, `SectionHeader`, `PreviewBanner`, `EmptyState`, `DangerRow`,
`Toolbar` and `ScopeTag` added with tests — eight, matching §5.3; the six named
here before predate §11.7's `ScopeTag` and dropped `Toolbar`.
*Validation:* `npm test`, `npm run build`.

**Stage 1b — the token write. Carries the palette checkpoint.**
The prototype's `[data-palette="after"]` block into `globals.css :root`, with
`--bg-inset` added and the `@theme inline` map extended to match. `--bg-elevated`
is currently declared twice in the same `:root` — once as `#141a20` and again as
`var(--surface-strong)`, so the first is dead; it goes with this step. Then look
at the result and at the overlay beside it in a native host (§11.13, §11.14).
*Validation:* `npm test`, `npm run build`, native host check of overlay and settings.

### Stage 2 — Performance

P1–P7 from §6, each measured. P4 measured before it is touched.
*Validation:* `npm test`, `cd src-tauri && cargo test`, native host frame timing.

### Stage 3 — Split the surfaces

Settings window created; workspace sidebar reduced; `Cmd+,` wired; alias map for
every current area id.
*Validation:* full suite; every old deep link resolves.

### Stage 4 — Section by section

Order by pain: Profiles → Language Models → Speech-to-Text → General → Hotkeys →
Delivery & Insert → Privacy & Data → Diagnostics → About. Each section is one
commit with its copy reduction, its component migration, and its tests.
*Validation per section:* `npm test`, `npm run build`; native host for anything
touching hotkeys, capture, insert or the overlay bridge.

### Stage 5 — Previews

Built in the new kit, each with its `PreviewBanner` and roadmap reference.

### Stage 6 — Documentation

- ADR: the two-surface split and why it does not break ADR 0003
- ADR: the palette lift (supersedes the "dark, calm" paragraph in DESIGN_SYSTEM.md)
- ADR: draft-then-commit for text inputs (P1) — this is a contract change in how
  the UI writes config, not a refactor
- ADR (conditional): the fixed-background correction, if P4's measurement flips it
- `DESIGN_SYSTEM.md`: new tokens, new components, copy budget, the surface model
- `STATUS.md`: new area list
- `ROADMAP.md`: Phase 7 second half marked done; Translation-mode candidate added
- `UI_UX_OVERHAUL_PLAN.md`: IA table updated, or the document retired in favor of
  the ADRs it now duplicates
- `CHANGELOG.md`, `README.md`
- `spec-sync` run at the end

---

## 9. Open decisions

| # | Decision | Status |
| --- | --- | --- |
| 1 | Settings as a second native window or an in-window modal | **Open.** Recommendation stands: native window (§4.1) — ADR 0003, macOS idiom, existing pop-out precedent. The prototype reads identically either way, so it did not settle this. Decide at Stage 3. |
| 2 | Does `Ctrl+,` / `Cmd+,` conflict with a registered global shortcut? | **Open.** Verify against `core::shortcut` before wiring; it is window-scoped, so it should not, but ADR 0006 owns the vocabulary. |
| 3 | Profiles: one view with a detail pane, or list-then-detail navigation? | **Closed 2026-08-02: one view with a detail pane** — the `pane` primitive. Held with three profiles in the prototype; revisit only if the Phase 7 catalogue ships more than roughly a dozen. |
| 4 | Does Diagnostics stay in Settings, or become a workspace view? | **Closed: Settings** — it is inspection, not authoring; the pop-out already covers heavy use. |
| 5 | Search (`Cmd+K`) across settings, as the donor has | **Open, out of scope here.** Follow-up once the IA is stable. The donor puts it at the top of the sidebar; the prototype leaves that space free. |
| 6 | Is Translation mode wanted at all? | **Open.** A roadmap candidate with a gate, not a preview. |
| 7 | Keep `UI_UX_OVERHAUL_PLAN.md` or retire it | **Open.** Decide at Stage 6. |
| 8 | How many MCP servers, and who may call them | **Open — see §10.1.** Needs its own ADR; do not settle it inside this rework. |

---

## 10. Open problems

Not decisions this plan can take. Recorded here because building Stage 0 is
what surfaced them.

### 10.1 How many MCP servers, and who may call them

Raised 2026-08-02 while building the Integrations and Agents previews.

WordScript looks like it needs **more than one MCP surface**, and the plan has
so far only described one:

| Surface | Purpose | Clients | Owning record |
| --- | --- | --- | --- |
| **Agents bridge** | `ask` / `await` — a running agent reaches a human and waits for an answer | One configured orchestrator, plus a CLI | ADR 0030 |
| **Notes and transcripts** | Read what WordScript has recorded, from an external AI tool | Any MCP client the user configures, plus a CLI | *nothing yet* |

**Why this is a problem and not a task.** ADR 0030 states that the orchestrator
is WordScript's *only* client and that coding agents get no MCP entry —
deliberately, because a channel that can speak to the user is a channel that can
interrupt them. A notes server introduces a second class of client that ADR 0030
does not contemplate. Whatever is decided has to answer ADR 0030 rather than
quietly work around it.

The shape of the decision:

- **One server, two tool namespaces.** One port file, one token, one auth path.
  But a client permitted to read notes is then holding a token that also reaches
  `ask`, and the only thing between a note reader and the user's ears is
  server-side tool filtering. Capability separation by convention.
- **Two servers, two ports, two tokens.** A notes reader cannot speak to the
  user by construction, which is the property worth having. Costs a second port
  file, a second token lifecycle, and a second thing to explain in Integrations.
- **Scoped tokens on one server.** One listener, but a token carries its
  namespace. Middle path; needs the token model designed rather than assumed.

Open sub-questions: does the CLI talk MCP or its own local IPC; is the notes
surface read-only forever, or does it eventually write; and does a notes token
survive a restart when the port does not.

**Do not settle this inside the settings rework.** It wants its own ADR, and the
Integrations preview is deliberately built so that either answer fits: it shows
the endpoint, the token and the port file as *one* group today, and a second
group can be added beside it without redesign.

### 10.2 The `agent` → `draft` migration is not scheduled

ADR 0029 decided the rename; nothing in `src-tauri` or `src` has been renamed.
The prototype shows the post-rename vocabulary throughout. Stage 4 will render
mode names, so the rename either lands before it or Stage 4 ships a label that
does not match `ProcessingMode`. It is a config-contract change with a legacy
alias on read, so it deserves its own commit and its own tests, not a drive-by
inside a UI section.

## 11. Corrections to this plan

Found while building Stage 0, against the current tree and the ADRs. Each one is
a place where the plan above was wrong; the plan text has been corrected in
place, and the reasoning is recorded here.

### 11.1 One contrast figure sat in the wrong column

§5.1's comparison table gave `--accent` "Today" as `5.12:1`. That is `#e68900`
against the *proposed* card `#2e2e31`; against today's card `#1c2127` it is
`6.13:1`, and every other cell in that column is measured against today's card.
The rationale below the table was right and the conclusion is unchanged. Fixed
in place. Every other value in §5.1 was recomputed and holds.

### 11.2 The `agent` mode is called `draft`

ADR 0029 renames it, precisely because ADR 0030 gives the product a settings
area named `Agents` for coding agents and two unrelated things cannot both be
called agent. §4.2's *Language Models* row said "`ModesTab` *Agent*"; it means
Draft. `agent` remains a legacy alias on read and `draft` is written back. See
§10.2 — the code rename is not scheduled.

### 11.3 `Agent` is a delivery target, not a processing mode

ADR 0030: a bridge session returns the transcript to its caller and inserts
nothing, so it performs no transform and cannot sit on the mode axis — *"the
pill shows `Agent` where the mode would otherwise stand"*. It therefore belongs
in **Delivery & Insert**, as a third option beside *Insert at cursor* and
*Clipboard only*, and must never appear in a list of modes. The prototype builds
it that way.

### 11.4 The communication style covers two modes, so it stands on two tabs

ADR 0023, *"Scope: Agent and Rewrite"*. §4.2 files *Communication style* under
Language Models without saying that it spans two of its sub-tabs. Placed on one
tab only, the other silently inherits a setting whose cause is nowhere on
screen — the exact failure ADR 0023 was written against. The same card now
stands on both Rewrite and Draft, with its scope named on each.

### 11.5 Account is a preview after all

§7 recorded Account as "documented as pending, not rendered", reasoning that
there is nothing to preview. Overruled by review: `AccountArea.tsx` exists in the
shipped tree, a user reaches it today, and removing it from the surface without
a replacement loses the one place that answers *"do I need an account?"*. It is
now a labelled preview, `Account & Sync`, in Settings under SYSTEM.

Its *Data export & import* card is **not** duplicated there — §4.2 moves that to
Privacy & Data and it stays moved.

**Consequence for §4.2:** the settings window carries **10 sections**, not 9.
The headline result becomes *14 flat entries → 7 workspace views + 10 settings
sections in 3 groups*. The longest list a user scans is still 7.

### 11.6 Three previews were missing content that already ships

The first Stage 0 build laid out Notes, Upload and Chat from their names rather
than from their code, and lost features that exist today. Restored, in the new
design system:

- **Notes** — the three panes (Transcript with speaker separation / Raw notes /
  Enhanced summary), speaker chips, search, pinning with a Pinned group, copy
  and delete, and both empty states.
- **Upload** — the queue counters, the real provider error
  (`413 request_too_large`), per-row copy / retry / remove, and the stated size
  limits (~25 MiB free, ~100 MiB dev, local bounded by memory).
- **Chat** — the local-context statement, per-turn copy, send states including
  failure, the typing indicator, the empty state, and the two boundaries it
  states: voice input reuses the dictation hotkey, and messages are not
  persisted.

**The lesson, which applies to every remaining stage:** a preview is rebuilt
from the component it replaces, not from its name. Read the source area before
redesigning it, and diff the feature list afterwards.

### 11.7 Half the settings surface is per-profile and does not say so

Found 2026-08-02 in the third pass, reading every shipped area against the
prototype. The runtime scopes **delivery behaviour** (`work_mode.insert_behavior`),
the **processing mode**, **language**, **bias**, the **recording limits**
(`buildProfileCapturePatch`) and the **workspace-context switch** to the active
profile. Every one of them is presented in a settings section that reads as
machine-wide, and §4.2 inherited that reading.

This is the shape of the failure ADR 0024 exists because of: a value with one
owner, edited from a place that does not name the owner. It had already produced
one duplicate control; leaving the scope invisible invites the next.

**Resolution — one rule, stated on the surface.** *Settings means this machine.*
Everything a profile owns is gathered into a new **Profiles → Defaults** tab
(mode, delivery, workspace context, recording limits, profile health), which
§4.2 implied by putting "which mode this profile defaults to" in Profiles and
then never giving it a control. The two values that stay in settings for
findability — language and bias strength, which belong beside the model — carry
a **scope tag** naming the profile and linking to it. `Delivery & Insert` keeps
the machine's half (readiness, driver chain, recovery) and states the active
profile's choice as a read-only row.

This also answers ROADMAP Phase 7's success measure directly: *an experienced
user can see at a glance what a profile contains and what stays global.*

**Consequence for §4.2:** the Profiles row gains a fifth sub-tab,
`[Defaults · Context · Words · Replacements · Snippets]`. Five is the limit
§4.3 rule 3 allows.

### 11.8 The wordmark was dropped, and the profile row belongs in both windows

`SettingsWindow.tsx:388-403` renders the wordmark as the sidebar header
(`assets/logos/wordscipt-logo-transparent.png`, capped at 180 px). The first
Stage 0 build opened the sidebar with a nav group and no brand at all. Restored
in all three sidebars, at the same cap, using the shipped file itself — copied
into the prototype folder so it serves standalone. The settings window carries a
`SETTINGS` qualifier beneath it: in a two-window product the sidebar is what
tells the windows apart, because ADR 0003 leaves the title bar to the OS.

The **`ProfileSwitcher` belongs in both footers**, not only the workspace one.
§11.7 makes the active profile the context several settings screens are read in;
a window that names per-profile values through scope tags while never naming the
profile itself is asking the user to hold it in their head. Same control, same
place, both windows.

### 11.9 Four controls existed in the kit and were replaced by worse ones

`shell/Stepper.tsx` is documented as a "macOS-style numeric stepper" and the
first Stage 0 build used a bare text field for every minute and second value.
`VolumeSlider` and `InputLevelMeter` were dropped the same way — the level meter
for a decorative waveform, which states a level and hides the speech threshold
that decides whether a capture is kept at all. `DisclosureRow` was unused, so
the local decode settings carried the same weight as the model choice.

All four are used now. §5.3's "more explicit affordances" was being read as a
licence to add buttons, when the first duty is not to remove the affordances
that already exist.

### 11.10 A preview must not claim a copy reduction it cannot earn

The word meter compares the shipped string against the budget string. Screens
with no shipped counterpart — Integrations, Agents, Onboarding, Live preview &
commit — had been given `{before, after}` pairs anyway, which made the meter
report a reduction measured against a sentence nobody ever shipped. They are now
written to budget on both sides. The total moved down as a result, and that is
the honest number.

### 11.11 Invented vocabulary in three places

Each is a word the product does not use, taught by a prototype that claims its
labels are read from the tree:

- **History** filtered by invented delivery states (`Inserted`, `Clipboard
  only`); the runtime's statuses are `completed · empty · failed`. Rows also
  carried a per-entry **duration**, which `TranscriptionHistoryEntry` does not
  have — a field invented by layout.
- **Diagnostics** offered invented run inputs; the real ones are `Hold to talk ·
  Tap to toggle · Diagnostics demo`, `Developer notes · General writing ·
  Support reply`, and `Editor preview · Clipboard fallback preview`.
- **Live preview & commit** named its interventions itself. The runtime already
  prints a name for every applied rule — *Removed filler words*, *Collapsed a
  repeated word*, *Dictionary replacement applied*, *Hallucination filtered* —
  and the preview now uses those.

### 11.12 Runtime truth the surface was not showing

Not copy problems: facts the shipped areas report and the redesign had dropped.
Whether the OS **accepted each shortcut** (the most expensive silent failure in
the product — nothing happens and nothing says why), **which driver in the chain
is in use**, the platform **support tier**, the **scratchpad path and entry
count**, which **microphone the next capture will use**, and the **portal check**
that explains why a Wayland lane is unavailable. All restored.

Against that, four live things were cut deliberately: the *Filters* card (three
labelled rows for what is one toolbar line), the duplicate provider *Profile*
select that sets the same value as the model select, the Overlay tab's *Display*
and *Anchor* rows in the placement mode where they cannot act, and the
permanently green "Auto-saved" badge with its footer sentence saying the same
thing — replaced by one status strip on the window's bottom edge, which also
gives the settings window the readiness it otherwise loses to Home.

### 11.13 The palette gate cannot be run as it is written

Found 2026-08-03. §12 requires the palette to be confirmed in the native host
before the tokens are written — *"look at the real surface, and only then write
the tokens."* Nothing in the native host renders the proposed palette. Vite
serves `src/`; the prototype is vanilla HTML under `docs/`, outside that root and
not routed in `App.tsx`, whose routes are `/overlay`, `/overlay-gallery`,
`/rebuild-lab` and `/settings`. A native host therefore shows the shipped surface
with the shipped tokens. As written, the gate asks the proposal to be judged by
looking at something that is not the proposal.

A second constraint, recorded so Stage 1 is not planned around an assumption:
**as of 2026-08-03 `npm run tauri dev` is not runnable here.** The production
build is, and it works — which matters, because it is enough for one half of what
the gate is actually for.

The gate is two checks written as one:

| | What it settles | What it needs | Status 2026-08-03 |
| --- | --- | --- | --- |
| **The premise** | Whether §2.3 holds on a real panel: a window at L\* 3.5 inside the crush range, a card at 12.5 that stops separating from it | Today's palette in a native host — the production build already carries it | **Runnable now**, with no code change and no dev server |
| **The proposal** | Whether the lifted ladder reads on that panel | The tokens written first, then a native build | **A checkpoint inside Stage 1b**, not a precondition |

The second row is the correction. The tokens are one declaration set in one file
and a `git checkout` away from gone; treating that as something to be earned in
advance is what made the gate unrunnable. Write them, look, adjust or revert.
Without `tauri dev` the look costs `npm run tauri build`, so batch it with the
rest of Stage 1b rather than iterating through it.

If the premise check fails — if today's surface does not crush on the panel it is
judged on — then §5.1's rationale is weaker than §2.3 claims and the values are
worth arguing again before they are written. That is the one outcome that
reopens a question §0 records as settled, and it is why the check is worth its
one launch.

### 11.14 The overlay is already isolated, so its guard is a check, not a job

§5.1 and §13 treat *"pin `overlay*.css` to its current computed values"* as work
that must happen before any token moves. Verified against the tree on
2026-08-03: it has already happened, by construction.

- `overlay-pill.css` declares its own `--ov-*` set as literals (lines 24–57) and
  references no token from `globals.css`
- `OverlayPill.tsx`, the only overlay component, uses no `var(--…)` and no
  theme-mapped Tailwind utility
- `overlay-shell.css` carries no token reference at all
- `body.overlay-window` is `background: transparent !important`
- `overlay.css` is the only overlay file that reads `--fg`, `--orange`,
  `--shadow-pill` and `--font-display` — and nothing imports it. It is the
  Storybook-era file that `overlay-shell.css:6` records as deliberately kept out
  of the app

No value §5.1 moves can reach the overlay. The guard stays as a
**verification**, in the same native-host look as §11.13 — not as a task, and
not as something that must clear before Stage 1a can start. §13's risk row is
correspondingly smaller.

## 12. Handover

### What exists now

- `docs/prototypes/settings-rework/` — the accepted shape. Four files (the
  fourth is a copy of the shipped wordmark), no build step, nothing imported by
  `src/`. Its README carries the methodology, the measured numbers and the known
  limits.
- This plan, corrected per §11.
- Nothing in `src/` or `src-tauri/` has changed. No ADR has been written yet.

### What Stage 1 is

§8 Stage 1, now split by §11.13. **Stage 1a** removes `glass*` and `ws-pill`,
deletes `PermissionsArea.tsx`, and adds the eight new primitives with tests —
none of it moves a color value, so none of it waits on the gate. **Stage 1b**
writes the new tokens and carries the palette look. The overlay is verified in
that same look, not pinned beforehand (§11.14).

Build the primitives against the prototype's `demo.css`, which is the design
system written out: tokens, type scale, spacing rhythm, the elevation rule
(background groups, a border means the thing accepts input), the concentric
radius rule, and the three layout primitives (`column`, `pane`, `solo`).

Things the prototype learned that are not in §5 and should reach
`DESIGN_SYSTEM.md`:

1. **`--fg-muted` is 4.71:1 on the card but 3.94:1 on the elevated surface.** It
   is therefore confined to the card plane. That is *why* rows carrying muted
   text do not change background on hover — which is also the fix for §6 P7.
2. **A list and its detail are one surface, not two cards.** Two cards side by
   side state no relationship between themselves; the `pane` primitive puts the
   list on the sidebar plane behind a hairline. Profiles, Notes and Chat all
   failed this way in the first build.
3. **One control per kind of value** (§11.9). A bounded number with a unit is a
   stepper; a proportion with no unit worth typing is a slider; a measurement
   with a decision threshold is a meter with that threshold drawn in. A text
   field is what is left when none of those fit.
4. **Standing state belongs on the window's bottom edge, once.** Readiness, lane,
   model and delivery target are true everywhere and news nowhere, so they are
   not repeated per view — and a save confirmation that is permanently green is
   not state, it is furniture (§11.12).
5. **A row states its scope when its value is not the window's.** The scope tag
   is what keeps "Settings means this machine" true without hiding the
   per-profile values a user goes looking for there (§11.7).

### The gate before Stage 1 starts

**Corrected 2026-08-03 by §11.13 and §11.14. It gates Stage 1b only. Stage 1a
starts without it.**

**The premise is checkable today; the proposal is a checkpoint, not a
precondition.** Chromium is not WebKitGTK, and panel black crush — the whole
reason §2.3 gives for lifting the ladder — is exactly what a browser on a good
monitor will not show you. The production build renders today's palette on the
real panel and settles whether §2.3's premise holds; that costs one launch and no
code change, and it is the available path, because `npm run tauri dev` is not
runnable here. Whether the *lifted* ladder reads cannot be judged before it
exists, so it is judged after Stage 1b writes the tokens and before anything is
built on top of them.

**The overlay needs verifying, not pinning.** §11.14: it references no token
from `globals.css`, so the token move cannot reach it. Look at it in the same
native-host session; do not spend Stage 1 pinning values that are already
literals.

## 13. Risks

| Risk | Mitigation |
| --- | --- |
| Token change leaks into the overlay | Cannot happen through a token: the overlay references none of `globals.css` (§11.14). Confirmed by a native-host look once Stage 1b lands |
| Stage 1b writes a palette nobody has seen on the target panel | The premise check runs on the production build first (§11.13); the token write is one reversible declaration set; the look happens before anything is built on top of it |
| Copy reduction deletes a fact a user needed | Every removed sentence has a destination in `docs/`, linked from the control; reviewed per section |
| The two-surface split hides a setting a user reached by habit | Alias map for every area id; `Cmd+,` from anywhere; Home links to the blocking setting |
| P4 measurement confirms the handoff and the gradient must stay | Then it stays; the flat window is a preference, not a requirement |
| Scope creep into roadmap features via previews | A preview is layout only; `PreviewBanner` is mandatory; no runtime wiring in Stage 5 |
| The rework stalls half-migrated | Stage 4 is section-per-commit; old and new sections coexist behind the alias map |

---

## 14. References

- [ROADMAP.md](ROADMAP.md) Phase 7 — the mandate for this work
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) — rules this plan changes
- [SETTINGS_SCROLL_PERFORMANCE_HANDOFF.md](handoffs/SETTINGS_SCROLL_PERFORMANCE_HANDOFF.md) — the prior performance pass
- ADR 0003 (native decorations), 0020 (mode is the only transform axis), 0023
  (register sets form), 0024 (mode has one source), 0025 (session belongs to its
  profile), 0029/0030 (agents), 0031 (voice nudge), 0034 (a limit belongs to the
  control that spends it)
- `donors/openwhispr donor-screenshots/` — structural reference, AGPL-3.0,
  structure borrowed, identity not
