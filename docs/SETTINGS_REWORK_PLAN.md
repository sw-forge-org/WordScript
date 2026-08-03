# Settings Surface Rework Plan

Status: 2026-08-04 — **Stage 0 done and accepted through fourteen passes; the
prototype is now read-only. The delivery model changed on 2026-08-04 (§16): the
rework is a port that overwrites rather than a migration (ADR 0054), it is
judged in a new `/gallery` route rather than against the shipped surface (ADR
0055), and it runs as a relay of legs on `main`, tracked in
[`handoffs/HANDOFF_gui-port-relay.md`](handoffs/HANDOFF_gui-port-relay.md).
Stage 1 is the active leg and splits per §11.13: 1a is unblocked, 1b carries the
palette checkpoint. In `src/` only two pieces of Stage 1 have landed — the
`glass*` and `ws-pill` removal, and the Archivo / IBM Plex Mono wiring. Nothing
else has been implemented.**

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

**If you are picking this plan up: read this section, then §11.7–§11.21, then
§12, then start Stage 1a.** Everything above §8 is the derivation and is still
accurate except where §11 records a correction. Do not re-derive it.

**§11.17 is the one Stage 1 must not skip.** It is not a screen correction: it
is four missing design-system rules that the prototype had already been patching
around per screen. They go into `DESIGN_SYSTEM.md` and into the primitives, or
Stage 1 ports the patches instead of the rules.

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
| Information architecture | §4.2 as built in the prototype, with the §11 deltas — including §11.16, which moves Integrations out of the workspace |
| The prototype itself | Kept, handed forward, not deleted |

**Still open:** §9, plus three problems this plan surfaced without being able to
settle any of them — §10.1 (how many MCP servers, and who may call them),
§10.3 (Phase 3 wants a reading surface in a window that must stay small and must
not take focus) and §10.4 (meeting capture wants a second window, which is
**not** the overlay §10.3 is about — read the table there before assuming they
are the same problem). Open in a different sense:
the palette has never been seen on a real panel (§11.13). That does not reopen
the decision — it is the one check the prototype could not perform, and it moves
into Stage 1b rather than blocking it.

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
| **Notes** | `NotesArea` | Preview, labeled. Folder rail, three note tabs, chat panel. See §11.18 and §11.19 |
| **Upload** | `UploadArea` | Preview, labeled |
| ~~**Chat**~~ | ~~`ChatArea`~~ | **Became a panel inside Notes on 2026-08-03 — see §11.19.** Not a view |
| ~~**Integrations**~~ | ~~*new*~~ | **Moved to Settings → AI on 2026-08-03 — see §11.16.** Nothing on it is authored |

Sidebar footer: `Settings` · `Help` · active-profile row (today's `ProfileSwitcher`).

#### Settings window

| Group | Section | Sources |
| --- | --- | --- |
| **APP** | **General** | `InputTab` *Microphone*; `InsertRecoveryArea` *Sound*; `OverlayTab` *Overlay placement*, *Result overlay*; `ModesTab` *Workspace context* |
| | **Hotkeys** | `InputTab` *Shortcuts* + activation mode; `ModesTab` *Hotkeys*, *Mode-select overlay* |
| **AI** | **AI Models** | Sub-tabs `[Models · On this machine]`. One connection (lane, provider, key, plan), then one row per job, grouped `Listening` · `Writing` · `Speaking` · `Runs no model`. Absorbs `ApiModelsTab` whole, `ModesTab` *Communication style*, the meeting speech engine, and the voice preset's model row. **Replaced Speech-to-Text, Language Models and a Providers & Keys screen on 2026-08-03 — see §11.34 and ADR 0042.** The second tab is the local installation: in-app model downloads, the server, detected acceleration |
| **APP** | **Notes & Meetings** | *new* — preview, added 2026-08-03 (§11.20). Notes root directory, note actions and meeting capture. The meeting *speech engine* left for AI Models on 2026-08-03 (§11.34); what a meeting **records** stays here, what **transcribes** it does not |
| **AI** | **Agents** | *new* — Phase 8 preview, labeled |
| | **Integrations** | *new* — Phase 8 preview, labeled. Moved here from the workspace 2026-08-03 (§11.16); sits beside Agents because §10.1 is one question, not two |
| **SYSTEM** | **Delivery & Insert** | `InsertRecoveryArea` *Insert readiness*, *Driver chain*, *Prerequisites & limits*, *Delivery*, *Recovery* |
| | **Privacy & Data** | `HistoryArea` *History policy*; `AccountArea` *Data export & import*; secret-store statement |
| | **Account & Sync** | `AccountArea` *Account*, *Self-hosting sync* — preview, added 2026-08-02 (§11.5) |
| | **Diagnostics** | `RebuildLabTab` unchanged in content, keeps its existing sub-tabs and pop-out. One layout note (§11.15): its *Diagnostics preview* panel stacks raw above transformed; side by side is the better pairing, and it is the single idea worth keeping from the withdrawn commit screen. A layout line, not a feature — no commit action follows it here |
| | **About & Updates** | `AboutTab` |

Result: **14 flat entries → 5 workspace views + 11 settings sections in 3
groups.** The longest single list a user scans drops from 14 to 5. (Seven and
ten when this section was written; §11.16 moved Integrations into settings and
§11.19 turned Chat into a panel.) (Nine
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
| Which model each mode uses, and how it writes | configuration | Settings → AI Models |
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
| ~~**Live preview & commit**~~ | ~~Phase 3~~ | **Withdrawn 2026-08-03 — see §11.15 and §10.3. It is documented as pending.** |
| **Notes** | V2 (existing) | Existing `NotesArea`, **rebuilt** 2026-08-03 — folders on disk, three tabs, timestamps, note states, chat panel (§11.18, §11.19) |
| **Upload** | V2 (existing) | Existing `UploadArea`, restyled. Band over a full-width queue, not a 460 px `solo` |
| **Chat** | V2 (existing) | Existing `ChatArea`, **as a panel inside Notes** (§11.19). Assistant turns name the rows they read |
| **Integrations** | Phase 8 | MCP server endpoint, token, port file; CLI install; all marked planned. **In Settings**, not the workspace (§11.16) |
| **Meeting capture** | *not on the roadmap* | Added 2026-08-03. A second capture type in a second window — resizable, content-protected, ends as a note. Sketched so the direction is written down; the open questions are in §10.4, and it needs its own ADR and roadmap entry before anything is built |

### Documented as pending, not rendered

| Item | Why not a preview | Where recorded |
| --- | --- | --- |
| ~~Account, sign-in, sync~~ | ~~ROADMAP: V2 or later. No decided data model to lay out.~~ | **Overruled 2026-08-02 — see §11.5. It is a built preview.** |
| Live preview & commit | Phase 3, moved here 2026-08-03 (§11.15). Its content already exists on the shipped surface — Diagnostics' *Diagnostics preview* panel runs raw text through the runtime and names every applied rule — and its home is a 440 × 60 window that must not take focus, which is not a shape this rework can draw. | §10.3, plus the one layout idea kept in §4.2's Diagnostics row |
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

Built in the new kit, each with its `PreviewBanner` and roadmap reference. The
list is §7's *Built as previews* table — seven entries, not eight: Live preview
& commit was withdrawn 2026-08-03 (§11.15) and is not built here or anywhere in
this rework, despite the prototype still carrying the screen.

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
| 9 | Is meeting capture wanted, and does it start from a hotkey or from detecting a call? | **Open — see §10.4.** Added 2026-08-03. A roadmap candidate with a gate, not a promise; sketched as a preview so the direction is arguable. Needs system-audio capture and echo cancellation, neither of which exists in the runtime. |

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

### 10.3 Phase 3 asks for a reading surface in a window that cannot be one

Raised 2026-08-03 by the review that withdrew the commit preview (§11.15).

ROADMAP Phase 3 requires the speaker to *"inspect raw and transformed text, the
active mode, and the delivery decision before final insertion"*, and to see
*"raw versus transformed text and meaningful guardrail interventions"*. The
surface that has to carry that is the overlay, because the decision happens
while another app has focus and this product's own windows are not where the
user is. The overlay is configured as follows in `tauri.conf.json:16-27`:

| Property | Value | Why it is there |
| --- | --- | --- |
| `width` × `height` | 440 × 60 | It is a pill above the work, not a panel |
| `focus` | `false` | Taking focus moves the insert target away from the app that was dictated into |
| `transparent`, `alwaysOnTop`, `decorations: false` | — | It floats over whatever has focus |

Those two requirements are in direct conflict. A diff of two paragraphs plus a
list of applied rules plus four actions does not fit in 440 × 60, and every way
of making it fit — grow the window, open a second one, move the decision into
the workspace window — either takes focus or puts the decision somewhere the
user is not. `focus: false` is not a detail to relax: it is what keeps the
insert target stable.

What exists today and works is the narrow version: `clipboard_only` stops, the
pill offers commit, cancel and edit, and nothing is inspected. What Diagnostics
does is the wide version, after the fact and out of the flow.

**Do not settle this inside the settings rework.** It is a Phase 3 design
problem about the overlay, and §1 puts the overlay out of scope. Two further
questions belong to whoever takes it: whether the stop is opt-in per profile or
per mode rather than a default — a stop on every capture works against the speed
that is this product's reason to exist — and whether "inspect" can be satisfied
by something smaller than a diff, since the runtime already names each applied
rule and a count of them fits where a diff does not.

### 10.4 Meeting capture wants a second window, and that is not the overlay

Raised 2026-08-03 alongside §11.18. Recorded here rather than decided, and
sketched in the prototype as `Meeting capture`.

A meeting recording is a **second capture type**, not a longer dictation: it
runs for an hour, it captures the microphone *and* system audio, it inserts
nothing, and it ends as a note. The surface it needs is a window you can read
while you talk — which sounds like the conflict §10.3 records, and is not.

§10.3 is unsolvable because the dictation pill must keep `focus: false`: taking
focus moves the insert target away from the app being dictated into. **A meeting
inserts nothing.** There is no insert target to protect, so the constraint does
not apply and the window may be moved, resized, collapsed and focused. The two
windows are different objects:

| | Dictation pill | Meeting HUD |
| --- | --- | --- |
| Size | 440 × 60, fixed | resizable, remembered |
| Focus | never | may take it |
| Lifetime | seconds | the length of the call |
| Audio | microphone | microphone + system audio, echo-cancelled |
| Ends in | text at your cursor | a note in Notes |
| Screen share | visible | excluded, by content protection |

§1 therefore still holds: no `overlay*.css` token, size or rule is touched, and
nothing here relaxes `focus: false` on the pill.

**What the donor and the landscape settle.** No bot joins the call — Granola's
model, and the only honest one for a local-first product with no server to send
a participant from. The transcript arrives while you are still talking, which is
what makes the note's left column worth looking at during the call. Content
protection is not optional for a window that floats over a shared screen;
OpenWhispr calls `setContentProtection(true)` on its meeting surfaces, verified
in the shipped 1.8.1 bundle along with a dedicated meeting hotkey, separate
microphone and system streams, an AEC sidecar with a leak detector, and live
diarization that re-clusters at the end.

**What is open, and belongs to whoever takes this:**

- Does capture start from a hotkey, from detecting a call, or both? A detection
  prompt has to be a window rather than an OS notification — visible in Focus
  mode, absent from a share — which is a third surface to own.
- What happens to the audio of a meeting nobody keeps? ADR 0038 and ADR 0039
  bound a dictation's audio; an hour of meeting is a different size of promise
  and the sweep that covers one may not cover the other.
- System-audio capture has no native path in the runtime today, and echo
  cancellation is a real component, not a flag. Neither is a settings problem.

**Do not settle this inside the settings rework.** It wants its own ADR and a
roadmap entry. The prototype's screen exists so the direction is written down
and argued with, not so it is built from.

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

### 11.15 The commit preview duplicated a shipped surface and drew an impossible one

The mirror image of §11.5. There, a screen was reinstated because the thing it
described already ships and a user reaches it. Here, a screen is withdrawn for
the same reason: it already ships, in a better form, somewhere else.

**It duplicates Diagnostics.** `RebuildLabTab` has three panels, one of them
named *Diagnostics preview*. It takes raw text, runs it through the real
runtime, and translates roughly 25 applied rules into named lines
(`RebuildLabTab.tsx:184-333`) — the four the prototype shows are a subset. It
also carries the simulated delivery targets *Editor preview* and *Clipboard
fallback preview* (lines 55-56). The test surface is not missing; it is richer
than the screen proposed to replace it with.

**And it drew a window that cannot exist.** The prototype rendered Phase 3 as a
settings-window view: header, cards, two diff panes, a rule list, four buttons.
The flow it describes lives in a 440 × 60 window with `focus: false`. The screen
inherited `RebuildLabTab`'s shape, which is why it looks like a place where the
decision could be read — and a settings-shaped surface is exactly what the
decision cannot be, because the user is in another app when it happens. Recorded
as §10.3, because it is a real problem and not merely a prototype error.

**What survives.** One presentational idea: raw and transformed belong side by
side rather than stacked, which is a layout line for Diagnostics (§4.2) and not
a feature. The four action buttons do not survive into Diagnostics — a commit
control there would commit a session nobody dictated.

**The screen stays in the prototype.** It is no longer a target shape; it is the
illustration attached to §10.3. Without that demotion written down, the next
reader builds Phase 3 out of it — which is how a preview turns into a second
surface reporting the same session, the failure ADR 0018 and ADR 0019 exist to
prevent.

### 11.16 Integrations is configuration, so it belongs in settings

Corrected 2026-08-03. §4.2's table puts **Integrations** in the workspace
window. Everything on it is an endpoint, a token, a port file, an install
command and a list of what WordScript deliberately does not do. Nothing is
authored, nothing is read back later, nothing is a record of work — and §4.3.1
is explicit: *if a user sets it, it is in settings*.

It moves to **Settings → AI**, beside `Agents`, which is the other half of the
same subject: §10.1's open question is precisely how many MCP surfaces there
are and who may call them, and the two screens that answer it were in two
different windows. Workspace drops from 7 views to 6; the settings list grows
from 10 sections to 11, which is affordable because it is grouped and the
workspace list is not.

This is the same correction as §11.7, applied to a whole screen instead of to
rows: §4.2's table sorts by where a control was *found* in the shipped tree, and
that has to give way to what the control *is*.

### 11.17 The card had no vertical padding, and three screens had patched it

Corrected 2026-08-03. The prototype's card was `padding: 0 var(--pad-card)` and
left the vertical space to whatever sat inside it. A card of `FormRow`s
therefore had 20 px at the sides and 13 px top and bottom — the row's own
padding, not the card's — and a card ending in anything else had **none**.
Measured across all 20 screens before the fix: every card was flush.

Three different inline paddings had grown in the prototype to patch it screen by
screen. That is the shape of a missing rule, and it is exactly what Stage 1
would have carried into `src/` as component-local spacing.

**The rule, for `DESIGN_SYSTEM.md` and for Stage 1:** the card owns its inset —
padding on all four sides — and the first and last child of a row stack drop
their own edge padding, so the inset stays `--pad-card` regardless of what is
inside. Nothing in a card needs to know it is at an edge. The action that acts
on a card's content is a footer component, not a flex row with a guessed
padding.

Three further rules came out of the same pass and belong in the same document:

1. **A control that must look centred is drawn on integers.** The radio was
   17 px with a 1.5 px border. An odd box has no integer centre and a fractional
   border snaps to different device pixels on each side, so the dot sat visibly
   off-centre. 16 / 2 / 8 leaves 2 px on every side at any pixel ratio.
2. **A stat tile carries a number that changes and summarises more rows than fit
   on screen.** Otherwise it is a row. Three tiles across the top had become a
   habit: nine of them stood on three screens, six carrying words that never
   change, all of them restating the banner beneath.
3. **No coloured edge bar, ever.** A vertical accent rule down the side of a
   notice is a web convention that reads as a rendering defect at this scale.
   Emphasis is the ground plus an icon tile. Ruled out by review on 2026-08-03
   for the action strip and for every component after it.

And one contrast bug worth naming because the rule already existed: `--fg-muted`
is 3.94:1 on `--bg-elevated`, and the **selected** pane row is `--bg-elevated`.
The rule confining muted text to the card plane was written on the prototype's
own Design System screen and broken by the one row every reader looks at.

### 11.18 Notes had a diarization feature and no way to make a recording

Raised 2026-08-03. `NotesArea` separates speakers, and nothing in the product
creates a note that contains audio. A note is authored as text. That is a door
with no building behind it, and no amount of restyling fixes it.

Two things follow, and they are different in kind.

**The layout, which this plan can settle.** It took two attempts and the failed
one is the instructive half.

Transcript, raw notes and enhanced summary were three mutually exclusive
sub-tabs. The first correction replaced them with two fixed columns — the
transcript reading on the left, the notes and the derived summary working on the
right — because you write shorthand while someone else is talking and the
shorthand only means anything beside the line it was written against. That
argument is sound and it is about the wrong surface. **The two columns are not
equal:** the transcript is long and the notes are short, so the most-read view
gets half a column and the least-read one gets the other half, permanently.
Reading and writing at once happens *during* the call, which is the meeting
HUD's job (§10.4); afterwards a reader reads one of the three and switching is
cheap.

So Notes is three tabs again, placed at the top right of the note where a view
switch belongs rather than under the title where they read as sections of it,
and the HUD carries the same three so nothing is learned twice and nothing is
migrated when the call ends.

Three things came with it and are not negotiable detail:

1. **Timestamps.** A transcript with no time cannot be matched against a
   recording and a note cannot point at the moment it is about.
2. **Note states in the list.** A note is a session — *Recording*,
   *Transcribing* and *Ready* are different things to look at.
3. **Folders, and they are directories.** See §11.19.

The diarization toggle left the note detail: a setting parked in the workspace
is the same category error as §11.7.

**The capture, which this plan cannot settle** — see §10.4.

### 11.19 Chat is a panel, and a folder is a directory

Two structural corrections from 2026-08-03, both in Notes.

**Chat was a place you had to leave the note to ask about the note.** It was a
top-level workspace view, next to Notes, answering questions about your own
transcripts, vocabulary and profiles — every one of which is about something you
are already looking at. It is a panel inside Notes now: an overlay on the right
of the note detail, with the note behind it, opened from the note's own head.
Everything it carried survives the move, because a preview is rebuilt from the
component it replaces (§11.6): an answer names the rows it read, voice input is
the dictation hotkey rather than a second recording path, and nothing is
persisted. The workspace list drops from 7 entries to 5.

**Folders are a filesystem promise, not a grouping column.** Notes were one flat
list, which holds until there are forty of them and the meeting you want is
under two weeks of dictations. The rail carries folders above the note list, and
the folder governs the list the way the list governs the detail — one column,
two levels, no second window.

The part that binds the runtime: **WordScript keeps notes as files under a real
path on this machine, so a folder is a directory.** A folder in this surface is
what the user's file manager shows; creating one creates a directory and moving
a note between folders moves a file. The path is rendered in the rail footer for
exactly that reason — it is the cheapest possible guard against the
implementation quietly becoming a `folder` column on a notes table, which would
give the same screen and break the promise the screen makes. Upload picks the
folder its results land in, so an uploaded transcript has a destination rather
than a row in a queue somebody eventually clears.

Whoever builds this owes an answer to two questions the surface does not settle:
what the root path is per platform, and what happens when a note file changes on
disk under a running app.

### 11.20 Four things had no home, and the donor answers three of them

Added 2026-08-03, after a review of §11.18's rebuild.

**Ask is a window, not a panel.** §11.19 made chat an overlay welded to the right
edge of the note detail. That covers the note it is answering about, which is the
same failure as the top-level view in the opposite direction. It is a small
always-on-top window: movable, resizable, able to sit beside the main window so
the note and the answer are readable at once. It joins the meeting HUD as the
second member of a window family this plan now has — small, OS-decorated
(ADR 0003), with a resize grip and no invented chrome.

**A path you cannot change is a statement about somebody else's machine.** The
notes root was rendered in the rail footer and was not a control. It opens the
folder picker now, and the setting lives in a new section.

**Settings gains `Notes & Meetings`**, under APP. Four things had no home and
were being implied by surfaces that could not configure them: where notes are
written, what the note action bar can run, what a meeting records, and which
speech engine transcribes an hour rather than a sentence. Settings is 12
sections; the APP group is the right home because all four are machine-scoped.

**The template question is answered by the donor.** The meeting HUD's bar offers
"Sync template", and a template has to live somewhere.
`donors/app/desktop-shells/openwhispr/src/components/notes/ActionPicker.tsx` is a
split button whose menu lists user-editable **actions** — a name, a description
and a prompt each (`ActionManagerDialog.tsx`) — with "Manage actions" at the foot
and last-used promoted to the default button. Borrowed whole, with one change:
OpenWhispr keeps actions in SQLite, and since §11.19 makes notes files under a
real directory, the actions are Markdown files beside them in `_actions/`. A
prompt you can read in your editor and put in git is worth more than a row in a
database nobody can see.

**One model for notes, meetings and Ask**, as a fifth tab in Language Models —
the ceiling §4.3 sets, and it earns the fifth because none of the four dictation
modes covers it. The donor separates identically:
`src/config/inferenceScopes.ts` defines `dictationCleanup`, `dictationAgent`,
`noteFormatting` and `chatIntelligence`, resolves provider and model per scope,
and falls back from `noteFormatting` to `dictationCleanup` when unset — which is
also what keeps ADR 0036 true for notes. The meeting speech engine is separate
too: `MeetingSettings.tsx` carries a full parallel set of transcription settings,
because seconds of one voice and an hour of several are different workloads and
one setting cannot be right for both.

**The upload queue was a colour chart.** Nine rows each carried a coloured pill,
two thirds of them reporting that things went as expected, which left the one row
needing a decision nothing to stand out from. Expected states are a dot and a
word in the meta line; Queued gets nothing, because its position in the list
already says it; the badge is reserved for failure. Generalized: **a badge is for
a status that is not expected. An expected status is a dot and a word, or
nothing.**

### 11.21 The driver chain was drawn as one chain, and the runtime has two

Corrected 2026-08-03 against `src-tauri/src/core/insertion.rs`, which has been
right the whole time the surface was wrong.

`NativeInsertDriver::role()` sorts the eight drivers into three kinds:
`clipboard` for `WlCopy` and `Arboard`, `paste` for `XdotoolType`, `Xdotool`,
`Wtype`, `Ydotool` and `Enigo`, and `recovery` for `Scratchpad`. There are two
execution chains — `clipboard_driver_execution_chain` and
`paste_driver_execution_chain` — and the scratchpad is in neither; it is where a
transcript waits when nothing placed it.

The prototype drew one ordered list. Three consequences:

1. **Three drivers were missing** — `wl-copy`, `arboard` and `enigo`, including
   the only one that writes a Wayland clipboard.
2. **A clipboard writer, a paste driver and a fallback looked like alternatives
   for the same job**, which is how the omissions went unnoticed for three
   passes.
3. **`wtype` and `ydotool` were labelled "not in PATH".** That is not why they
   are unused. `paste_driver_execution_chain` never reaches them: on hybrid
   XWayland it returns after `xdotool`, and on pure Wayland it returns an *empty*
   chain, with a comment stating that clipboard-only is the safe default because
   both drivers trigger a compositor privilege prompt. They are excluded by a
   decision, not by an absent binary — the difference between "install a package"
   and "this will never work here", and the surface was telling the user the
   first one.

Stage 4 renders this section. It must render the runtime's own three roles, not
a flattened list, and it must not describe a deliberate exclusion as a missing
dependency.

### 11.22 Settings is a sheet over the workspace, and it has its own scale

Corrected 2026-08-03. Overrides §4.1's "two surfaces, two windows" for the
settings half; the workspace half of §4.1 is unchanged.

Settings was a second top-level window with its own sidebar, its own wordmark
and the workspace's exact metrics. Two faults, and the second is the one that
made the surface feel wrong without being nameable:

1. **The window was a lie about the task.** Configuring something is a detour
   from what you were doing, and you come back. A second top-level window says
   the opposite — that this is a place you go and stay — and it leaves the
   workspace behind with no indication it is still there.
2. **The scale was identical.** Same 232 px sidebar, same 32 px rows, same
   760 px column. Two surfaces drawn at exactly one scale do not read as two
   surfaces. They read as one surface whose content changed, which is why the
   settings window never announced itself as a different mode.

Settings is now a modal sheet laid over the workspace, at its own scale:

| Token | Workspace | Settings sheet |
| --- | --- | --- |
| `--nav-w` | 232 px | 196 px |
| `--nav-row-h` | 32 px | 28 px |
| `--content-max` | 760 px | 640 px |
| `--pad-card` | 20 px | 16 px |
| `--row-py` | 13 px | 11 px |

Type does not scale. 13 px body in a sheet and 13 px body in a window is the
same reading task; structure scales, type does not. The sheet is 1000 × 680,
capped, over a scrim at 50 % black with a 2 px blur. It closes on Escape, on
the scrim, and on its close control, and it returns to the workspace view it
was opened over rather than to a fixed Home.

Three things the sheet drops, each because the window behind it still has them:
the wordmark (the brand stated twice on one screen), the "Back to workspace"
row (closing *is* going back), and the status strip. The profile switcher
survives and is promoted into the sheet header, where the context that every
scope tag refers to is stated once and readable from every section.

**Runtime consequence.** `SettingsWindow.tsx` stops being a window. Stage 3's
"split the surfaces" keeps its component split and loses its second
`WebviewWindow` — one window, two layers. ADR 0003 is unaffected: the sheet is
not OS-decorated because it is not an OS window. The donor reached the same
answer independently (`src/components/SettingsModal.tsx` wraps a sidebar list
and a content pane in a dialog rather than a window), which is corroboration,
not the reason.

### 11.23 A transcript is a file, and the row can reach it

Added 2026-08-03. New requirement; nothing in §4 anticipated it.

**Every transcript is written to disk as Markdown at the moment it completes**,
whether it came from a dictation, an upload or a link. Not as an export you ask
for — as the record itself. History and the note tree are then two views over
files rather than two tables, and "your transcripts are yours" stops being a
privacy sentence and becomes a path you can `cd` into.

```
~/WordScript/transcripts/2026/08/03-0942-settings-restructure.md
```

Year and month directories, then `DD-HHMM-<slug>.md`, the slug taken from the
first words of the written text. Frontmatter carries what the row displays and
what a retry needs:

```yaml
---
id: 01J9F0T3W4X5Y6Z7A8B9C0D1E2   # ULID, the History primary key
created: 2026-08-03T09:42:17+02:00
profile: General writing
mode: cleanup                    # ADR 0020 axis value
provider: groq
model: whisper-large-v3-turbo
duration_ms: 8420
delivery: insert                 # insert | clipboard | failed
audio: captures/03-0942.wav      # relative; absent once swept (ADR 0039)
---
```

The body is the written text. The heard text goes under a `## Heard` heading
only when the two differ — a Verbatim transcript has one text, and writing it
twice would make every Verbatim file claim an AI stage ran.

**Two row actions follow from the file existing.** `View raw transcript` unfolds
the pair in place; `Show in file manager` reveals the `.md`. The second is the
one that makes the promise checkable, which is why it is on every row and not
only on rows that kept their audio.

**Runtime.** A new `core::transcript_store` owns the directory, the slug, the
collision suffix and the write. It is the last step of the session commit
(ADR 0018) and shares its single-commit rule: one file per session, written on
every path including the timeout fallback. Reveal is `tauri-plugin-opener`'s
`reveal_item_in_dir`. The root is configurable and lives in Settings → Notes &
Meetings beside the notes root (§11.20).

Open, and not decided here: whether History reads the files or an index over
them. A directory scan of 500 entries per History open is not obviously wrong
and is obviously simpler; a SQLite index is faster and introduces a second
truth that can disagree with the files. It needs its own ADR.

**Donor reference.** OpenWhispr keeps transcriptions in SQLite
(`src/helpers/database.js`, table `transcriptions`) and has no file at all —
`shell.showItemInFolder` in `src/helpers/ipcHandlers.js:813` reveals the *audio*
file, and the raw text is an expandable region reading `item.raw_text` from the
row (`src/components/ui/TranscriptionItem.tsx:238-257`). We take both actions
and neither implementation: theirs reveals a recording, ours reveals the
transcript, because ours has one to reveal.

### 11.24 A link is an intake

Added 2026-08-03. Extends §4.2's Upload row; no donor equivalent exists.

Upload accepts a URL beside the dropzone — a YouTube link, a podcast episode, a
direct audio URL. A file you have and a file you can reach are the same job to
everything downstream, so they are one block with a rule between them, not two
stacked cards competing to be the primary one.

What the surface promises, and therefore what the runtime owes:

- **It resolves a media stream and transcribes it.** The queue entry appears
  immediately with the source host in its meta line and `resolving stream` where
  a duration would be. Size is unknown until the stream resolves and is shown as
  `—`, never as a fabricated number.
- **It keeps the audio it needs and the transcript it produces, and nothing
  else.** No video, no thumbnail, no metadata sidecar. The audio is swept on the
  same schedule as a recording's (ADR 0039).
- **It is not a downloader.** There is no "save the file" affordance and there
  will not be one. WordScript transcribes; a media downloader is a different
  product with a different legal posture.

**Runtime sketch.** A `core::url_intake` module, resolution behind `yt-dlp` when
present on `PATH` and a direct `Range` fetch for a plain audio URL. `yt-dlp` is
**not vendored and not auto-installed**: it is detected, and when it is absent
the field states that a link of that kind needs it and names the package. That
keeps WordScript's own distribution free of a dependency whose update cadence is
driven by other people's site changes, and it keeps the failure legible — the
same reasoning §11.21 applies to `wtype` and `ydotool`, where a deliberate
exclusion must not be drawn as a missing dependency.

Three refusals to write into the ADR when this is built: no playlist expansion
(one link, one entry), no authenticated sources (no cookie jar, no login), and
no URL that resolves to something other than audio or video.

**Sizing.** A 40-minute episode is far past the 25 MiB provider ceiling that
ADR 0038 and the Upload screen already state, so link intake needs the chunked
path or a local engine — it is the first intake for which the ceiling is the
normal case rather than the exception. Not solved here; flagged so it is not
discovered during Stage 4.

### 11.25 Speaker detection and the note switch belong to the batch

Added 2026-08-03. Corrects the Upload screen's option set.

Upload had two batch decisions (profile, destination folder) sitting in a
toolbar, and two that existed nowhere: whether the transcript is separated by
speaker, and whether a note is written at all. The toolbar was the wrong
container the moment there were four — a toolbar is a line of controls you
scan, and these are settings you read a sentence about. They are a card of rows
now, under "For every file in this batch".

**Speaker detection leads**, because it is the one that changes what the
transcript *is* rather than where it goes. It costs a second pass over the
audio, so the row says which case it is for ("off for one voice") instead of
leaving the user to find that out from a bill.

**"Write a note" is a switch and not an assumption.** Off yields the transcript
only — the Markdown file of §11.23, and the clipboard. A voice memo does not
need a note, and silently creating one for every upload is how a notes tree
fills with things nobody wrote.

**Runtime.** Diarization is a provider capability, not a WordScript algorithm.
It is available where the lane supports it and the row disables itself with the
reason where the lane does not — the readiness rule the rest of the surface
already follows. Notes and meetings already have a separate speech engine from
dictation (§11.20), and this switch belongs to that engine, not to the
dictation one.

**Donor reference.** `src/components/notes/PersonalNotesView.tsx:946-964` parses
speaker segments out of a stored transcript via `parseTranscriptSegments`, so
diarization output reaches the note as structured turns rather than as prose —
that shape is worth taking. The donor has no batch-level switch for it, and its
upload view (`src/components/notes/UploadAudioView.tsx`) writes a note
unconditionally.

### 11.26 Actions are authored where they are run

Corrected 2026-08-03. Overrides §11.20's placement of the action manager.

§11.20 put "what the note action bar can run" in Settings → Notes & Meetings.
That is wrong. An action is not configuration — it is a prompt you write, run,
read the result of, and edit *because* the result was not what you wanted. The
loop happens entirely inside a note, and a settings section breaks it at every
turn: run it in Notes, judge it in Notes, leave Notes to change one line, come
back, run it again. Settings is for what you set once.

The manager is a window in Notes, opened from an **Actions** button beside
**Ask** in the note header. It is the same kind of window Ask is — the third
member of the window family §11.20 named — because it is reached from an
adjacent button, and two adjacent controls that open two different kinds of
thing teach two rules for one gesture. Same chrome, same resize grip, wider
(520 × 440 against Ask's 330 × 400) because it holds a list beside an editor
rather than a column of turns. Not modal: the note underneath is the evidence
for whether a prompt is right.

Everything else in §11.20 stands. Actions are Markdown files in `_actions/`
beside the notes; built-ins are readable and runnable but not editable, and
`Duplicate` is how you get an editable copy, so a shipped prompt is a starting
point rather than a black box. Settings → Notes & Meetings keeps the notes
root, the meeting capture settings and the meeting speech engine — it loses
only the action list.

**Donor reference.** `src/components/notes/ActionPicker.tsx` is the split button
whose menu lists the actions with last-used promoted to the default;
`ActionManagerDialog.tsx` is name + description + prompt per action;
`src/stores/actionStore.ts` holds them. The donor puts the manager in a dialog
over the notes view and the actions in SQLite. We take the split button and the
three fields, put the manager in the window family instead of a dialog, and keep
the prompts as files.

### 11.27 The calendar is what makes a meeting a meeting

Added 2026-08-03. New Integrations section; §10.4's meeting window is unaffected.

Integrations opens with **Calendar**, above the MCP surfaces. It earns the
position because it is the only thing on the screen a person rather than a
program connects, and because without it meeting capture detects that a call is
happening and has no name, no attendees and no agenda to put on the note it
starts.

Three providers, drawn as connections rather than as settings cards: Google
Calendar (OAuth, multi-account, connected accounts listed under the provider),
Apple Calendar (EventKit, local, macOS only), CalDAV (URL plus credentials, for
Fastmail, Nextcloud, iCloud by URL, or anything that speaks the protocol).

**Read-only, and stated as such.** WordScript never writes an event. That is a
capability boundary, not a roadmap position — the same shape as the MCP read
surface's "Writes: Never" two sections below it.

**Visual rule, since this is the first place a third-party brand appears.** The
provider tile is our own ground plus our own glyph in the one stroke weight
every other icon uses. No pasted brand asset: it would be the only foreign
artwork in the surface and would drag its own palette, corner radius and
optical weight in with it. What tells the three providers apart is their name,
which is also what the user is looking for. And no coloured edge rule on the
connected one — connected is said by the badge and by the accounts appearing
underneath.

**Runtime.** Tokens go to the OS secret store, under the app identity and not
under the brand (ADR 0037). Google needs a loopback OAuth redirect; the donor's
`src/helpers/googleCalendarOAuth.js` and `googleCalendarManager.js` carry a sync
loop worth copying wholesale — a 10 s socket timeout and exponential backoff
from 2 min to a 30 min cap on consecutive failures, reset on any success. Its
`meetingDetectionEngine.js` is the consumer: calendar context names the meeting
that process and microphone detection found.

### 11.28 Two things the transcript row was spending badly

Added 2026-08-03.

**Five labelled buttons on a row whose subject is a sentence.** Copy, Retry,
Delete — and now View raw transcript and Show in file manager — ran to roughly
330 px of labelled ghost buttons on a row whose own text was already ending in
an ellipsis. As 24 px icon buttons with a 14 px glyph the same five run to
128 px. The label is not lost: it is the accessible name and the tooltip. Only
its drawing is. The actions stay hidden until the row is touched and reserve
their space either way (`visibility`, not `display`), so nothing reflows on
hover.

**A badge was a slot, and rows can carry two.** One inline badge between the
text and the actions worked until a row was both "Clipboard only" and "Audio
swept": the actions then started at whatever x the badges happened to end at,
so every row in the list ended its actions somewhere different. Badges stack in
a fixed 108 px right-aligned column now. Generalizing §11.20's badge rule: **a
badge is for a status that is not expected, and badges live in a column, not in
the flow.**

**Scrollbars are not drawn anywhere.** Profiles showed five permanent 9 px rails
at once — content column, sidebar, both pane columns, and the page itself, the
last of which scrolled the mock window inside its own frame and belonged to the
rig rather than to the product. A scrollbar is a control you use twice a session
and a border you look at continuously; on a fixed-size desktop window there is
no doubt about which region scrolls. Notes and the meeting HUD had already
reached this locally (`.aichat-body`, `.hud-scroll`); it is the rule for the
whole surface.

An edge fade was built as a replacement and removed. A static mask dims the
first and last 20 px of every scroller permanently — a heading loses its top
edge — to hint at something the wheel answers immediately, and the scroll-driven
variant that fades only the live edge keeps the surface permanently animating.
Nothing replaces the scrollbar.

The window also stopped declaring `min-height: 660px`, which was what forced the
page to scroll on any display shorter than about 780 px. A window is as tall as
the space it is given.

### 11.29 The agent overlay is a tab and a window, not a pill with two wings

Added 2026-08-03, then rebuilt the same day after review. Both the gap and the
first attempt at closing it are recorded, because the first attempt failed in a
way worth not repeating.

**The gap.** ADR 0030 specifies this surface in one paragraph and nothing had
ever drawn it, so Settings → Agents was configuring a thing nobody had seen —
the same fault §11.6 found in three other previews, on the surface where it
cost most.

**The first attempt, and why it was wrong.** It drew a pill with two large
expandable wings, 1038 px across with both open, following ADR 0030's own
sentence — "the surface is a pill with two wings" — to the letter. Two faults,
and the first is the one that mattered:

1. **The pill was invented rather than taken.** ADR 0030 says the base is "the
   existing edit overlay, extended", and the drawing did not read
   `overlay-pill.css`. It therefore previewed something pill-shaped instead of
   previewing the overlay: wrong height, wrong tokens, wrong composition, an
   outer drop-shadow the shipped file explicitly forbids (WebKitGTK paints it
   as an opaque black box), and no `zoom: 0.87`.
2. **A whole application ended up on an always-on-top surface.** Targets with
   state, a thread, an answer window and two repair controls, permanently over
   whatever the user is working in. The overlay's entire discipline is that it
   is 480 × 60 and says one thing.

**What it is instead.** The shipped pill, unchanged except that the mode chip
reads `Agent` — plus a **tab** that grows out of its left edge, and a **window**
the tab opens.

The tab is not a new component. The overlay already grows one out of each edge:
`.ov-learned-tab` on the left (ADR 0035, one shot, retracts, nothing to click)
and `.ov-limit-tab` on the right (the auto-stop countdown, open for the whole
recording, clickable). This is a third instance, built to their three
constraints exactly — out of the pill's flex flow, `width` animated and never
`transform` or `opacity`, and a shutter that paints nothing with the inner
element pinned to its far edge so the content is uncovered rather than grown.

**The left slot, and it is free rather than contended.** `REFERENCE.md` allows
one tab per side "so neither has to yield to the other", so a third has to
prove it cannot contend. It can: the left slot belongs to the learned tab, and
a bridge session cannot produce one. Learning is filled by observing repairs
(ADR 0035) during finalization, and ADR 0030 states that
`finalize_with_text_rules` does not run on bridge output at all. In Agent
delivery the learned tab is structurally absent for exactly as long as this tab
can exist. The right slot stays with the auto-stop, which is time-critical and
yields to nothing.

**One difference from the learned tab, and it is deliberate: this one stays
out.** A learned word is news and retracts after 1.9 s. "An agent is waiting
for you" is a state, and a state that retracts has to be remembered.

**The window is the fourth member of the window family** — after Ask, the
meeting HUD and Actions — at 620 × 340, with the same chrome, the same OS-drawn
decoration (ADR 0003) and the same resize grip. ADR 0030's "space on the left,
time on the right" survives intact and becomes the window's layout: targets
with state and unread counters on the left, the thread and the answer window on
the right, Compact and New session at the rail's foot. The correction is only
where it lives. On a pill that split cost 1038 px of always-on-top furniture;
in a window it costs nothing until it is opened.

**Every number in the drawing is read from the shipped files**, not chosen:
40 px tall, `width: max-content`, `padding: 0 6px`, `gap: 2px`, 999 px radius,
`--ov-surface #1b1b1d` opaque, a `rgba(255,255,255,0.09)` hairline, the inset
top highlight, **no outer shadow**, `zoom: 0.87` on the shell, a 30 × 30 round
mic with its radial sheen, 3 px bars at 2 px gaps in a 30 px band, a 26 px mode
chip with a 5 px accent dot, a 13 px display-face tabular timer, and the tab at
22 px in the learned tab's `right: calc(100% + 6px)` slot. The composition is
the shipped recording pill's, in its order: mic · bars · divider · mode chip ·
divider · timer.

### 11.30 A tab bar is a claim that its entries are the same kind of thing

Corrected 2026-08-03. Two places were making that claim falsely.

**Language Models had five tabs in one undivided run** — Cleanup, Rewrite,
Draft, Prompt Enhance, Notes. Four of those are processing modes: points on
ADR 0020's single transform axis, reachable by cycling the mode in the overlay.
Notes is not on that axis at all. It is the model a note is *formatted* with, on
a surface the dictation path never reaches. In one run of five, the bar was
asserting that formatting a note is a fifth way to transform a dictation.

A 1 px rule now stands before Notes, inset from the pill row's own edges so it
divides the run rather than splitting it into two controls. Cheaper than a
second bar and cheaper than a heading, and it is the general fix: **when a
control offers entries from two categories, the rule marks the boundary and the
control stays one control.**

**The same rule earns `Agent` its place in the mode cycle.** ADR 0030 is
explicit that `Agent` is a delivery target, that modelling it as a
`ProcessingMode` is forbidden, and that `delivery = agent` makes the mode axis
vacuous — "the pill shows `Agent` where the mode would otherwise stand". What
the ADR does not say is how the user gets there, and the answer is the control
they already have: cycling the mode on the overlay reaches it, after the rule.

That is not a contradiction of the axis decision and the prototype says so on
the screen. Being *reachable from* a control is not membership in the category
the control is named after — which is exactly what the rule is there to state.
The alternative, a separate binding for a sixth thing that occupies the same
slot in the pill, is a second control for one position.

### 11.31 Three small things, one of them mine

Added 2026-08-03.

**An entrance animation belongs to an entrance.** The settings sheet of §11.22
animated its scrim and its arrival unconditionally, and `render()` rebuilds the
whole surface — so the sheet flew in again on every click inside its own
sidebar, and on every sub-tab switch inside a section. The sheet was announcing
its arrival to somebody already inside it. It animates only when it was not on
screen in the previous render. Defect introduced by §11.22 in this same pass.

**The Notes rail foot offered a second way to do what its section heads already
do.** Folders and Notes each carry an add control in their own header — the
pattern the whole rail is built on — and `New note` at the foot repeated one of
them, made the foot look like the place new things are made, and then
contradicted itself by not offering a new folder. What is left at the foot is
the one action the rail cannot express as an addition to a list: `Record
meeting`.

**The `subtabs` primitive gained a divider** rather than each screen building
its own bar when it needs one. `"|"` in the item list renders the rule of
§11.30. Written into the component because the second caller already exists.

### 11.32 The surface had twelve radius values and no rule

Added 2026-08-03.

`999px, 50%, 14, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2` — twelve values, none of them
wrong on its own, with nothing saying which belonged to what. The aggregate
read soft to the point of unseriousness: a badge, a status tag, a segmented
control, a sub-tab row, a chip and a profile flag were all capsules, so every
label-shaped thing on screen was a pill. A tool people keep open all day is not
a consumer app, and a capsule on every label is the fastest way to look like
one.

**Four steps, assigned by what a thing is rather than by how big it is:**

| Token | Value | For |
| --- | ---: | --- |
| `--r-window` | 10 px | A window or a sheet — the outermost object on its layer |
| `--r-card` | 8 px | A grouping surface — card, panel, stage, well |
| `--r-control` | 6 px | Something you operate — button, input, select, tab bar |
| `--r-small` | 4 px | A label, and anything sitting inside a control |

`--radius-card` moves from 12 px to 8 px on the proposed side. It is the most
repeated shape in the surface, so it sets the register for everything else. The
shipped 10 px on the other side of the switch is untouched: it is the
measurement being compared against, and editing it would edit the comparison.

**Capsules survive only where the object is physically a capsule** — a switch
track and its knob, a progress or level bar, a waveform bar's line cap, a count
bubble, an avatar, a status dot, a radio, a round mic button. Those are round
because of what they are. Everything that is a rectangle with text in it —
badge, chip, scope tag, tab, segment, mode-cycle entry — is now a rectangle.

**Two exemptions, both deliberate.** The shipped overlay keeps its own
`--ov-radius-compact: 999px` and `--ov-radius-tall: 14px`: it is a capsule by
design, it is outside this plan's scope (§1), and the preview draws it at its
real radius for that reason. And the rig keeps its own shapes, because §2 of
`demo.css` has it deliberately outside the design system so it is never
mistaken for a proposal.

Verified by walking every element on all 23 screens: the only capsules left
inside the product surface are the round mic button and the overlay pill.

### 11.33 Draft and the notes model were the same assistant twice

Added 2026-08-03. Decided in ADR 0040.

§11.20 gave Language Models a fifth tab for "one model for notes, meetings and
Ask", and §11.30 put a rule before it because four of the five entries were
processing modes and the fifth was not. The rule was right about the surfaces
and wrong about the thing. Drawing the boundary was cheaper than noticing there
was no boundary.

**The sentence that breaks it:** *"write the mail from Tuesday's meeting."*
Draft could write a mail and could not reach Tuesday's meeting —
`agent::build_agent_request` assembles a system prompt and the transcript, and
nothing else. Ask could reach Tuesday's meeting and inserted nothing where you
were typing. Two models, both configured, both working, and the request falls
between them. The repair is to open Ask, ask, read, copy, switch back and paste,
which is the workflow this product exists to delete.

The donor was cited for the split and does not support it.
`inferenceScopes.ts` separates `dictationAgent` from `chatIntelligence` as a
**config lookup** — which model runs — and says nothing about them being
different assistants with different names and different rules. Reading a config
split as a product split is what produced the second model.

**One assistant, three doors:** the dictation (Draft), the Ask window, an action
on a note. It may read your notes and transcripts — read-only, one bounded
lookup, never a loop — and it cites what it used. ADR 0040 answers each of ADR
0029's four reasons rather than working around them; side-effecting tools stay
prohibited, and the reason that decides the shape is the session model: one
lookup, then the generation, then the commit, with the number of stages fixed at
compile time rather than chosen by the model.

The rule §11.30 introduced is withdrawn with its cause. It stays in the
`subtabs` primitive, because §11.31 added it there for a second caller and the
component is right even where this screen no longer needs it.

### 11.34 A model could be set in five places, and my fix added a sixth

Added 2026-08-03, after the surface was rebuilt twice in one pass. Decided in
ADR 0042. **The wrong fix is recorded first, because it is the instructive
half.**

**The fault.** A model was settable on Speech-to-Text, on five tabs of Language
Models, on Notes & Meetings (the meeting engine, repeating Speech-to-Text's rows
to say the same thing), and on Agents → Voice. Each was defensible alone. The
total was not: "which model is doing this" took four screens and knowing which
one wins, and the same ten providers were listed on three of them. A sixth
place named a local model it had no way to install and told the user to run a
command elsewhere.

**The wrong fix.** This pass first added `Providers & Keys`, to hold the
credentials the other screens shared. The reasoning was sound in isolation — one
Groq account serves speech and language both, so a key repeated across tabs is
several places to change one secret — and it made the problem worse: three
screens listing providers instead of two, and the real gap still open.

**What the mistake was.** Treating the credential as the thing that needed a
home. A key is one row. It is small, it belongs where the provider is chosen,
and it needs exactly one extra sentence — which other jobs hold it, so changing
it warns you. What had no home was the **installation**: a server, a runner,
model files, downloads, disk.

**What the donor settles, and what it does not.** OpenWhispr has no provider
screen either: `InferenceConfigEditor.tsx` is one component used by every scope,
carrying lane → provider → model → credential where the decision is made, and
its sections divide by consumer and by scope, never by provider. But it keeps
speech and language as two top-level sections, and that is right for its size —
its speech section carries a local model manager, a VAD panel, GPU selection and
three consumer tabs. Ours would be one engine row against five near-identical
ones. **The division earns its keep at the donor's size and not at ours**, which
is the general lesson: a donor's structure is evidence about a shape, not a
mandate to copy the count.

**What it is now.** One section, `AI Models`. One connection stated once —
lane, provider, key, plan — and everything follows it unless a job says
otherwise. One row per job, grouped `Listening` · `Writing` · `Speaking` ·
`Runs no model`; closed, the row answers what runs it and whether that is the
default; open, it is that job's whole settings, in place. One second tab for the
local installation, both kinds of model together, because it is one disk and one
runtime and the total is the number that matters.

The last group is on the surface deliberately: *"why can I not set a model for
Verbatim"* is answered by seeing it stated, and an absence answers nothing.

**Consequence for §4.2:** the settings window carries **11 sections**, not 13.
The headline becomes *14 flat entries → 5 workspace views + 11 settings sections
in 3 groups.* `stt` and `llm` survive as aliases per §4.3's rule 6.

### 11.35 The agent window read as three agents, and one is the whole point

Added 2026-08-03. Decided in ADR 0043.

§11.29 built the agent window with a rail of three targets, each carrying its
own status dot, name and state, and nothing saying that one process drives all
of them. ADR 0030 is built on exactly that — the orchestrator is WordScript's
only client, the agents it starts get no entry, and for them it *is* the human.
A surface suggesting three peers argues against the record it implements.

The fix is not a sentence. **The orb** — one sphere, lit from below left, idle
small and white and still, speaking larger and warm and moving with its own
amplitude — sits at the head of the rail as the identity the rail belongs to,
with the targets indented under it as what the one voice is working on. Bars are
plural and a sphere is not, which is the whole argument for the shape: eleven
bars beside three names is what made it read as three.

A **dash** across the foot of the window carries the same orb at 22 px, what is
being said, and the level. At the foot because it is a state of the window
rather than an entry in it — the sentence is already the last message above.

A **notification** covers the case §11.29's tab does not: a closed window and no
dictation running, which is the ordinary case. It is WordScript's own
always-on-top window, content-protected, carrying the orb at 72 px, the question
and the offered options. Not an OS notification, because Focus mode and screen
sharing suppress those and a screen share is when an agent is most likely to be
running. Its sound is a cue on ADR 0010's existing persistent stream, not a
fresh stream and not the system sound.

**The dictation overlay is untouched**, and the screen says so on itself: the
bars are your voice, the orb is the machine's, neither appears on the other's
surface. §1 holds — no `overlay-pill.css` token, size or rule changes.

One implementation constraint recorded early rather than discovered late: the
glow is a `box-shadow` and never `filter: blur()`. A blur promotes the element
to its own compositor layer, and a compositor layer outliving a surface swap is
the WebKitGTK ghosting mechanism `overlay-pill.css` documents at length. The orb
never goes on the dictation overlay, but the notification is an always-on-top
transparent window on the same engine.

### 11.36 What the runtime has to grow for §11.33–11.35

Added 2026-08-03. Not a task list — a statement of the contract shape, so the
surface above is not drawn against a config that cannot express it. None of it
is implemented; each item names the file it lands in.

**`ProcessingMode` gains one variant** (`src-tauri/src/core/config.rs:71`).
`Translate` joins `Auto | Cleanup | Rewrite | Agent | PromptEnhance | Verbatim`,
with `as_str`, `from_str` and every exhaustive match following, and the
TypeScript union in `src/types/ipc.ts:29` mirroring it. `from_str` keeps its
permissive default so an unknown token still lands on Cleanup. `is_auto` is
unchanged; `is_cleanup_family` stays false for it — a translation is not a
cleanup family member and the transform pipeline must not treat it as one.

**`agent` → `draft` is now blocking rather than deferred.** §10.2 recorded the
rename as unscheduled and Stage 4 as the point it becomes due. §11.33 makes it
earlier: the surface says `the assistant` and `Draft` throughout, and the config
token is `agent`. It is a legacy alias on read and `draft` on write, in the same
commit as the enum change and with its own tests, not a drive-by inside a UI
section.

**A resolved default plus sparse per-job overrides**, which is the shape ADR
0042's connection card promises and today's config cannot express. A profile
holds one `provider` and several models, one per role; what is needed is one
connection (lane, provider, credential reference, plan) and a job map whose
entries are *absent* when the job follows it. Absent-means-default is the part
that matters: storing a full pair per job makes "is this the default" a
comparison rather than a fact, and the badge in the list is then a guess. Nine
jobs — `dictation`, `meetings`, `upload`, `cleanup`, `rewrite`, `translate`,
`prompt_enhance`, `assistant`, `voice` — against the donor's five scopes in
`inferenceScopes.ts`, which is the same structure with our job set.

**`ProviderCapabilities` becomes the filter, not documentation.**
`transcription` and `chat_completion` already exist
(`src-tauri/src/core/providers/mod.rs`); the surface reads them so a provider
that recognizes no speech cannot be offered for a listening job. ROADMAP Phase 4
already owns splitting the axis; this is what consumes it.

**One credential per provider, not per job** — which is why the key is a row
that names its other holders rather than a field repeated per job. ADR 0037's
service-name separation is unchanged and the enterprise three do not fit the
shape: each needs its own credential struct (access key/secret/region; endpoint/
deployment/key; service-account JSON/project/location), so each is a separate
native adapter rather than a variant of a bearer token.

**The assistant needs a retrieval path on the dictation critical path**, which
nothing has today. ADR 0040's `On reference` mode means one bounded lookup
before generation when the transcript refers to material — and if that lookup
cannot answer inside a dictation's latency budget, it degrades to *no lookup*
rather than to a slow one. This is the largest implementation risk in §11.33 and
it belongs to whoever builds it.

**Local installation is a manager, not a settings page** (ROADMAP Phase 5).
Downloads with progress and cancellation, removal, an installed index, and — if
WordScript bundles the server rather than talking to the user's — a sidecar with
a port, a start-on-demand path and a shutdown that survives a crash. The donor's
pattern for exactly this is in `scripts/download-*.js` plus a manager in
`src/helpers/`, registered so one call stops it on quit.

**The notification is a fifth window and the first one nobody opened**
(ADR 0043): always-on-top, content-protected, and its cue is a new motif on the
existing persistent output stream from ADR 0010 rather than a second stream.

### 11.37 Two components existed only as class names

Added 2026-08-03, found while building §11.34.

**`.grp` had been written by Delivery & Insert and never given a rule.** The
driver chain's two stage headings — "1 · Put it on the clipboard", "2 · Make the
target take it" — rendered as bare body text, so the split the card exists to
state was the one thing it did not show. It is defined now, and AI Models uses
it for the four job groups. It is the sub-tab bar's argument at a smaller scale:
when entries in one container are not the same kind of thing, a rule says where
the boundary is between five tabs and a label says it above four groups of rows.

**A downloadable model had no component at all**, because nothing had ever
offered a download. `.mdl` is a name, a size, a state and the control that state
implies — download, progress with cancel, or use and remove. The size is stated
before the download rather than discovered during it, because the size is the
fact that decides whether you want it.

**And the surface had no provider marks**, which is why the model column could
not be scanned. `@lobehub/icons-static-svg` v1.94.0 (MIT) supplies them;
fifteen are inlined as paths because the prototype has no build step and no
network. Two decisions came with them:

- **Monochrome, not the colour variants** — reasoning from §11.20's rule
  against colour charts. **This was wrong and §11.39 reverses it:** that rule is
  about status colour, and a brand mark is not status. Left here as written
  because this section records what was decided, and the reversal belongs to
  the record that made it.
- **The class is `.pmark`, not `.brand`.** `.brand` was taken by the wordmark
  block in `demo.css` §5 — a flex column with padding and a `.qual` child — and
  an SVG inheriting that renders 16 × 32 with the artwork letterboxed inside it.
  Found by measuring the box, not by looking at it: at 15 px against a dark tile
  the difference between "wrong size" and "not there" is invisible in a
  screenshot. **A collision in a stylesheet this size is not caught by reading;
  assert the geometry.**

### 11.38 The lane selector was a label

Found on review of §11.34's own rebuild, 2026-08-03.

AI Models put four lanes — Cloud, Local, Self-hosted, Enterprise — in a segment
at the head of the connection card, and **the card below it did not change**.
All four showed a cloud provider grid, a cloud API key and a cloud account plan.
The job rows below showed the same model names in every lane.

Every other `seg()` in this prototype is inert on purpose: it moves its own
thumb and changes nothing, which is honest for a static mock and is what the
click handler does by design. **The lane cannot be one of those**, and the
distinction is not about fidelity. A lane decides what a provider *is* — a cloud
account with a key, a binary on this disk, a URL you operate, an account with a
region — so a lane switch that leaves the card identical is not an inert
control, it is a false one. It asserts the four lanes are one thing with four
names.

Two things it was hiding:

**The credential shape is different in each.** Local has no credential at all
and should say so — it is the one lane where "no request leaves this machine" is
true by construction rather than by promise, and that is the strongest sentence
this product can put on a screen. Self-hosted has a URL and an optional token.
Enterprise has an account, a region and three different credential structs.

**The model names are different, and that is the point.**
`whisper-large-v3-turbo` is a Groq endpoint; `ggml-large-v3-turbo` is a file on
this disk. Same weights, different things — one is billed per request and
bounded by an upload limit, the other costs 1.6 GB and a load. Showing the same
string in both lanes hides the only difference that matters. Cloud speech now
reads as cloud speech (including `whisper-1` on the Upload job, which is an
OpenAI override), and the local lane reads as files.

**And a job can be unavailable in a lane.** No self-hosted OpenAI-compatible
endpoint transcribes, and among the enterprise three only Azure does. Those rows
say so and name the lane that can run them, instead of offering a picker with
nothing in it.

The fix is one new primitive, `segState(key, items)`, which writes `state[key]`
and re-renders — used by exactly one control, with the rest of the prototype's
segments left inert. **Generalized: a control may be inert, but it may not be
false. If the rest of the screen would change, the mock changes it.**

### 11.39 The marks are in colour, and the onboarding is a flow

Added 2026-08-03, both correcting decisions made earlier the same day.

**Colour was the wrong call and is reversed.** §11.37 chose the monochrome
provider marks by reasoning from §11.20's rule against colour charts. That rule
is about **status** colour — a hue the interface assigns to mean something,
competing with the one hue that means "look here". A brand mark is not status.
Its colour is part of the mark; it is the same orange every time anyone has ever
seen Anthropic, and stripping it makes fifteen marks harder to tell apart while
freeing no attention at all. Monochrome cost recognition and bought nothing. The
accent still means "overridden" and still has no competition, because no brand
in the set is WordScript's amber.

Three marks stay black-and-white because their brands are: OpenAI, xAI and
Ollama have no colour variant to use. They take `currentColor` and follow the
theme, which is what those marks do everywhere else too.

**They are a sprite now, not repeated inline SVG.** Six of the colour variants
carry gradients with internal ids, and the same mark appears in the provider
grid *and* in a job row — inline, that is duplicate ids in one document, which
browsers resolve by first-wins and validators reject. One `<symbol>` per mark,
referenced by `<use>`, with every id additionally namespaced per mark. The
sprite is injected once outside the tree `render()` replaces: `<use>` resolves
against the document, so a sprite rebuilt on each render would leave every mark
briefly pointing at a symbol being replaced.

**Onboarding was one frame of a flow, which is the one thing it could not be.**
It drew "step 3 of 3 — try your hotkey" and nothing else. A setup flow's whole
content is its **order**: what is asked first, what is proved before the next
thing is asked, what happens when an answer is "not yet". A single frame shows
none of that. It is seven walkable steps now, forward and back, with the rail as
a control — every step behind the current one is a decision worth revisiting
once you have seen what it caused, and steps ahead stay unreachable because
claiming otherwise is the same lie in the other direction.

The order follows one rule: **nothing is claimed until it is proved.** Each step
ends in a checked fact rather than a filled field, and the flow ends by
producing text rather than by announcing that it will.

| | Step | Ends in |
| --- | --- | --- |
| 1 | Welcome | where audio goes, stated before anything is asked |
| 2 | Microphone | a level that crossed the mark |
| 3 | **AI Models** | a verified key, or a chosen download |
| 4 | Hotkey | a binding the OS accepted |
| 5 | Insert | a native check that text can reach the focused app |
| 6 | Try it | one real dictation |
| 7 | Done | what is set, and the one thing left open |

**Step 3 is what was missing entirely.** Setup asked for a provider in one line
and never said the same connection also drives cleanup, translation and the
assistant — so the first surprise arrived later, in settings, as rows of models
nobody had been told about.

**It renders the same lane segment and the same provider grid as AI Models**,
not a simplified twin. This is the donor's practice and the reason is worth
stating: `OnboardingFlow.tsx` renders `TranscriptionModelPicker`, the very
component its settings page uses. A setup flow that draws its own version of a
control teaches a screen the user will never see again, and the two drift the
first time one is edited. `providerGrid()` is now shared by both.

**Step 5 is ours and not the donor's.** A dictation that transcribes perfectly
and then cannot be placed is the failure this product has actually shipped
(`known-issues/`), it is invisible until the first real dictation, and on
Wayland it is a decision rather than a missing package. It is better found in
setup with a sentence than at the end of the first sentence worth keeping.

**Step 3 carries all four lanes, and the local one carries real downloads.**
The first build handled Cloud properly, collapsed Self-hosted and Enterprise
into one branch that showed a URL for both, and offered the local lane as two
selects naming files it could not fetch — the same "choose a lane, then find it
unpopulated" failure §11.34 removed from settings, reintroduced at the one
moment the user has agreed to spend time on setup. Local now renders
`modelRow()`, the settings component, with its real controls: size before the
download, progress with cancel, and a state that decides the button. Enterprise
gets its account grid, region and the fact that only Azure transcribes;
Self-hosted gets its URL, a typed model id and the fact that a chat endpoint
does not transcribe at all.

**And the flow states what it deliberately leaves out.** A setup flow's real
failure mode is length, and the way it gets long is one defensible addition at a
time. Every candidate was put to one test — **does it block the first
dictation?** — and everything that failed it is named on the last step rather
than silently absent: processing modes, communication style, overlay placement,
sound cues, history policy, notes and meetings, agents and integrations. Each
has a working default and a user who never opens it still dictates
successfully, which is what makes the omission a decision. It sits on the last
step and not the first, because on step 1 it would be a list of things you have
not seen yet.

`providerGrid()` and `modelRow()` are now shared by both surfaces, which is the
mechanism that keeps this true rather than a promise that it will stay true.

### 11.40 The assistant and the desk needed a line, not a merger

Added 2026-08-03. Recorded as ADR 0044.

The review question was whether the assistant and the orchestrator should be
merged. They cannot be: the assistant runs inside a session that ends in exactly
one reducer commit (ADR 0018) and the orchestrator runs for days, and beyond
that the assistant is an API call we own completely while the orchestrator is a
foreign process with its own model, sandbox and MCP client.

What could be merged is the **surface**. The user says one sentence and does not
classify it first:

```
"Write the mail from Tuesday's meeting."   -> the assistant, text at the cursor
"Send the mail from Tuesday's meeting."    -> the desk, something happens
```

Today that choice is made with a hotkey before the sentence exists. The handoff
is the correction: the assistant recognises it cannot do this, and offers to
pass it on. Enter hands over, Escape inserts the dictation as it always would
have been, ten seconds of nothing does what Escape does. **The safe answer is
the default answer.**

The card does not take focus -- the dictation overlay must keep `focus: false`
or the insert target moves -- so it grabs `Enter` and `Escape` while visible,
Rust-owned like every other shortcut.

**Home carries what the desk could not answer.** ADR 0030 is built on a filter
and a filter has an output; what got through had nowhere to land but a thread in
a closed window. The action strip becomes a list, and the column that makes it a
decision inbox rather than a to-do list is *what happens if you do nothing*: a
desk question expires and takes a blocked run with it, a question out of a
meeting expires never, a clipboard transcript lasts until the next copy. Sorting
is by that column.

### 11.41 Notes and Upload were one thing built twice

Added 2026-08-03. Recorded as ADR 0045.

Two workspace entries produced the same object by two routes, and the user had
to know the route to find the result. Worse, they drew the same material
differently: an upload's transcript was a queue row with a Copy button, a
meeting's was a tab in a note.

One type now, with `origin` and `state` as fields. `scheduled` is the state that
earns the merge its keep -- a meeting on a connected calendar is an object
before it happens, with its name, attendees and the questions the last one left
open. That is "before the meeting you already know everything" with no calendar
view, which would have competed with Google Calendar and lost.

Upload becomes `intake`, a state rather than a place, and its queue is deleted
rather than moved: it was this list filtered to the objects with no transcript
yet, drawn twice.

**Four tabs, and the first draft had seven.** Summary, Transcript, People,
Decisions, Tasks, Linked was written out and thrown away on a rule worth
keeping: *a tab is a view of the whole object, not a heading inside one of
them.* Decisions and Tasks are sections of the summary; on tabs of their own,
one page becomes three and the reader guesses which holds the sentence they
remember. `Enhanced` became `Summary` -- the old name describes how it was made,
which is interesting for ten seconds and meaningless on a dictation.

**The workspace drops from 5 entries to 4.** That is the test: a real
abstraction removes an entry, a false one adds a screen explaining the others.

### 11.42 Relationships belong on the object, and a graph is not the way

The user's proposal was a relationship view -- a small local knowledge graph.
Rejected, and the reason is worth having on record because the idea will come
back: a graph shows *that* things connect, and the question a user arrives with
is *what* connects. Obsidian's graph view is the canonical case -- admired,
shared, and barely used.

The relationships themselves are right. They are a `Linked` tab on the object,
computed locally from shared people, shared topics, the calendar series and
objects produced from each other. The entry from the other direction -- every
object touching one person -- is a filter on the list. If that proves too
little, a graph is still buildable; the reverse is not.

### 11.43 An action declares who runs it

An action was one thing: a prompt the assistant runs over this object. That
covers everything the assistant can do and nothing beyond it, and "collect the
decisions from these three meetings and open a PR" is a sentence people will
write into that box.

So `kind` is a field. An assistant action is seconds and produces text; a desk
action is minutes and produces effects, and goes through the same keyed
confirmation a dictated handoff does. They stay in **one list** -- the user's
intent is one intent, and splitting the list would make them classify their own
idea before acting on it -- with §11.30's rule marking the boundary inside it.

A desk action begins at the assistant: gathering material out of objects is a
read, which is what ADR 0040 permits, and the desk receives an assembled brief
rather than a search task.

### 11.44 The orchestrator is called the desk, and its connectors are not ours

Added 2026-08-03. Recorded as ADR 0044 (the name) and ADR 0046 (the classes).

`Orchestrator` names the thing correctly and nobody says it out loud, which is
what §5.2's budget exists to catch. Rejected: `lead` (collides with the CRM
sense, and this product now models a customer as a context object), `foreman`
(gendered, and an established piece of infrastructure software), `handler`
(exact, but reads as tradecraft). `Desk` carries help desk, news desk and
trading desk, and it is the only candidate that is not a person -- which matters
because ADR 0043 deliberately gave this thing a sphere rather than a face.

**Three classes of connection, sorted by one question -- does it write
anywhere?** intake reads and is why a context object exists (calendar, natively,
read-only); bridge answers a call (`ask`/`await`, notes, the CLI); reach writes
on your behalf and runs in the desk, which is already an MCP client with a
configuration file and a permission model.

The calendar is the only intake and the exception is argued: it is small, it is
the only source of a participant's name, and meeting capture must not require a
configured agent CLI. Mail stays entirely on the reach side -- reading a mailbox
is an OAuth scope nobody wants to hold halfway.

### 11.45 We do not choose the desk's model, and we still owe the door

The surface stated that WordScript owns every model choice (ADR 0042) and then
did not mention the one model it does not own. An absence answers nothing, so
the row is on the screen: the desk's model is a setting of the program the user
chose, read from its configuration and reported here.

That is true and useless on its own, because the user still wants it changed
sometimes. So there are three doors into the directory -- a terminal, the
folder, the instruction file -- and a restart control that states its price.

**ADR 0030 is not contradicted.** It forbids *rebuilding* the CLI's controls
("what is left is a terminal with extra steps"). A button that opens the real
directory rebuilds nothing; it hands over the original, which is the same move
the connector position makes.

**One honesty the door owes:** the running desk is headless with no PTY, so the
button opens a *second* session in that directory, not the running one. A model
changed there takes effect on the next start. Saying otherwise would be exactly
the fake readiness this product refuses.

### 11.46 The copilot writes, never speaks, and never hints without a source

Added 2026-08-03. Recorded as ADR 0047.

One strip above the bar, one hint at a time, replaced rather than stacked. In
the transcript column it would be anchored correctly and then scroll away while
new lines arrive, which means the hint you needed is the one you missed.

Two rules it may not break: it never speaks (one spoken path, and it is the
desk's), and the citation is part of the hint rather than an affordance beside
it. Off by default, because it is inference for the length of a call.

### 11.47 The preview banner was a card and is a strip

A dashed box with an icon, a bold sentence and a paragraph, on eleven screens,
running to about 60 px -- on Context, Agents and Meeting that was a third of
everything above the fold, spent on a fact taken in once and scrolled past
forever after.

It is a chip and one line now, 26 px measured. The lead is a **word**, because
`Layout preview -- not wired to the runtime.` was the fourth time the surface
said so: the rig says `static mock, no runtime` permanently, the nav tags the
entry `preview`, and the picker group is called Previews.

The withdrawn banner keeps its box and its border. A stop is exactly the case
that has to interrupt.

### 11.48 The intake answered the rarest question first

Pressing `+` in Context landed straight in a dropzone, which made importing an
existing recording the definition of "add something" -- and it is the rarest of
the ways material arrives. The merge had quietly deleted the plainest thing the
old Notes could do: make an empty note and start writing in it.

Three ways in, and they are genuinely three -- different object, different
source, no shared controls. `Write` (type or dictate into an empty object),
`Record` (the meeting HUD), `Import` (§11.24's two equal intakes with §11.25's
batch decisions). **`Write` is the default**: an intake whose default is its
rarest case makes the common case feel like the exception.

The segment is the prototype's second use of `segState`, and for §11.38's
reason -- it decides what is being made, so a switch that left the panel
identical would be a false control rather than an inert one.

### 11.49 Integrations had two thousand words and no shape

Review verdict, and it was right: nobody reads it, and the problem was that the
information was unstructured rather than merely long. Eight sections, every row
carrying a sentence arguing for itself -- because the screen had no shape that
made a row mean anything on its own.

With the three classes as a table at the top, a row only has to say what it is:
the class already says what it can do, who runs it and what it costs. About
1100 words came out and no fact went with them.

**One section belonged to another screen.** "Where the text lands" answered how
a transcript reaches the focused app, which is Delivery & Insert's question, in
more detail and beside the live driver chain. Deleted rather than moved, because
the other screen already had it.

The two bridge surfaces are two panels side by side rather than two sections of
rows: they differ in exactly three ways, and §10.1's open question sits in the
row where it is spent.

### 11.50 Account & Sync was selling an account that is not coming

Two faults. It framed self-hosting as an upgrade path towards signing in
somewhere, when the decision is the opposite -- **there is no WordScript account
and there is not going to be one**, and an account exists only if you run the
server it lives on. And it collided with AI Models over the word: that screen is
full of accounts (a Groq plan, an enterprise tenant, a key per provider), so a
reader who has just set one up arrives here looking for it.

The first row now says which account this screen means and points at the other.
The lanes are `This machine only` and `A server you run`. A third lane reading
"WordScript Cloud -- coming soon" is the shape this screen must never take: it
would make everything above it read as a limitation of a free plan rather than
as the product.

### 11.51 One fact, one screen -- History against Privacy and Delivery

Three overlaps, found in review.

**Delivery carried the incident.** Its Recovery card named the last failed
transcript verbatim with a Restore button -- the same event that is now a row in
Home's decision inbox with an expiry, and a row in History as the record. Three
tellings, two of which cannot clear it while offering the button that does.
That is §11.12's fault one screen over. Delivery keeps what only it can answer:
whether recovery works here, where it writes, how much is in it.

**Privacy repeated Account & Sync.** `Transcripts, profiles, settings -- this
machine only. No account, no cloud sync.` was that screen's entire first
section, said again. Privacy keeps where things *are*; whether they go anywhere
else is linked, not repeated.

**Privacy and History are not redundant and the pairing is now stated on both
sides.** History is the data -- find one, read it, retry it, delete one.
Privacy is the policy -- how many, how long, where. Privacy's retention section
also grew the half it was silently missing: a context object is a file in a
folder the user chose, nothing prunes it, and an hour of meeting audio is a
different promise again and stays undecided.

### 11.52 What the runtime has to grow for §11.40--11.51

Added 2026-08-03. Not a task list -- the contract shape, so the surface above is
not drawn against a runtime that cannot express it. None of it is implemented.
It follows §11.36, which carries the same statement for §11.33--11.35.

**A context object type, over files rather than a database.** One frontmatter
shape carrying `origin` (`dictation | meeting | upload | link | calendar`) and
`state` (`scheduled | recording | transcribing | ready | failed`), over the
directory §11.19 already promised and the Markdown transcripts §11.23 already
writes. Notes, transcripts and the upload queue converge on it; the queue stops
being a structure and becomes a filter on `state`. The index that serves ADR
0040's `On reference` lookup indexes this one type instead of two.

**A calendar adapter, read-only, three authentication models.** Google (OAuth,
incremental sync tokens), Apple (EventKit, macOS only, no network), CalDAV
(URL plus credentials). It produces `scheduled` objects and attendee lists and
must hold no write scope -- ADR 0046 is violated the moment it does. It is the
first thing in this product that polls, so it needs a refresh interval, an
offline state and a failure that degrades to "no calendar" rather than to a
stalled meeting surface.

**An effect-intent classifier on the dictation result, and it is the risky
part.** It decides whether a transcript asks for an effect. It runs after
transcription and before the mode router, it must be cheap enough not to move
the latency budget, and it must fail towards *no offer* -- a missed handoff
costs a keystroke, a false one costs a card the user did not want. Whether it is
lexical (a verb list per language) or a model call is open; the lexical version
is the one that cannot blow the latency budget and is where this should start.

**A handoff surface that grabs two keys without taking focus.** A transparent
always-on-top window near the overlay, plus a temporary global grab of `Enter`
and `Escape` released when it closes -- ADR 0006 owns shortcuts, so it owns
this. It is the sixth window in the family and the second that nobody opened
(after ADR 0043's notification).

**`kind` on an action record**, plus target and role for the desk kind. An
action is a Markdown file in `_actions/` (§11.26), so this is frontmatter, and a
desk action's frontmatter is the confirmation card's content.

**Diarization in three stages, and only stage 1 is cheap.** Source attribution
needs no model and is most of the value on a two-person call. Clustering needs
ONNX models and a runtime, which is the local model manager's business (ADR
0042, Phase 5), and the speaker status model -- `provisional | suggested |
confirmed | locked`, with `locked` surviving the end-of-call re-cluster -- is
product logic that has to exist before live labels are offered at all. Echo
cancellation sits upstream of all of it.

**Reading the desk's MCP configuration.** A parser per harness preset, because
the file shape is the harness's. Read-only, tolerant of a file that does not
exist yet, and it must never write -- ADR 0046's "no second door" is enforced by
not having a writer, not by not drawing a button.

**Three shell-out doors:** a terminal in a directory (per-platform: the user's
configured terminal, `open -a Terminal`, `wt.exe`), the file manager (which
§11.23 already needs), and an editor for the instruction file. Plus a restart
path for the desk that survives the process being gone.

**A retention pass that knows the difference between a transcript and an
object.** Transcripts are capped and pruned as they are today. Context objects
are files the user can see and are not pruned. Meeting audio is undecided and
the surface says so rather than defaulting to a promise nobody made.

## 12. Handover

### What exists now

- `docs/prototypes/settings-rework/` — the accepted shape. Four files (the
  fourth is a copy of the shipped wordmark), no build step, nothing imported by
  `src/`. Its README carries the methodology, the measured numbers and the known
  limits.
- This plan, corrected per §11.
- Nothing in `src/` or `src-tauri/` has changed.
- **ADR 0040--0047 have been written** and carry the decisions this plan's
  §11.33--11.51 record from the surface side. The runtime contracts they imply
  are collected in §11.36 and §11.52; neither is implemented.

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
  control that spends it), 0048 (light mode), 0049 (the orb's four states),
  0050 (the keyboard layer and the native handoff)
- `donors/openwhispr donor-screenshots/` — structural reference, AGPL-3.0,
  structure borrowed, identity not


## 15. The tenth pass, and what it moved out of this plan

Added 2026-08-03. §5 specified the design system as colour, copy, components,
radii and motion. A review of the built prototype found the system defensible
in every part and still reading as generated rather than designed, and four of
the five causes were measurable rather than matters of taste. The prototype's
README carries the full account; this section records only what changes for
the stages.

### 15.1 What Stage 1b now writes

The token write was one palette. It is now three things:

1. **The face.** `--font` named Aptos and nothing shipped it, so the product
   renders in Noto Sans on Linux and Segoe on Windows. Archivo and IBM Plex
   Mono are bundled in `assets/fonts/` and wired into `globals.css`. Archivo
   carries a width axis, which §5 did not anticipate and which pays for optical
   size: width, tracking and weight now vary per type step.
2. **The material.** A 1px inset top highlight on cards, and a four-step cast
   shadow ladder for floating surfaces. §5 declared elevation once, as a
   brightness step; that says which plane a surface is on and nothing about
   what it is made of, and the difference is most of what "native on macOS"
   means once the palette is right.
3. **The second and third schemes.** Light and system, per ADR 0048. This is
   the largest addition: the light ladder is rebuilt rather than inverted, and
   the accent moves to `#b45c00` because the identity value is unreadable on
   white.

**13 px is now a named step.** It was in the prototype 28 times before it was
in the scale.

### 15.2 What moved out of this plan entirely

Motion primitives are not built here. The orb, the live waveform, the matrix
field and the keycap exist as React components in `src/lab/`, shown at the
unrouted `/component-lab`, because a motion model cannot be judged from a still
and building each twice guarantees drift. The prototype draws its own version
for screens that need context and points at that route where it cannot render
one truthfully.

Nothing under `src/components/settings/` was touched and no existing shadcn
component was overwritten. The six added (`command`, `empty`, `kbd`, `spinner`,
`button-group`, `input-group`) are unused by any shipped screen.

### 15.3 The native handoff — Phase 7 owes this

Settled as design in ADR 0050, unimplementable in a document, and therefore
owed by `src-tauri/`:

| Owed | Where |
| --- | --- |
| Menu bar (App / File / Edit / View / Window / Help) | `tauri::menu::MenuBuilder` |
| `Cmd+Q` and `Cmd+W` as OS commands | Menu accelerators, not `keydown` |
| Native drag and drop for audio and text | Tauri window drag-drop event |
| System theme following | `window.theme()` and the theme-changed event |

`Cmd+K` and `Cmd+,` stay in the renderer because both act on renderer state —
but the menu bar must mirror them, since a shortcut existing only as a
`keydown` handler is invisible in the place macOS users look to find one.

### 15.4 One thing this pass could not get

The ElevenLabs UI registry (`ui.elevenlabs.io`) returns 429 to the CLI, to
`shadcn add <url>` and to plain fetch alike — a bot check, not a transient
failure, and it did not clear on retry. `orb`, `live-waveform`, `matrix`,
`waveform`, `shimmering-text`, `transcript-viewer`, `mic-selector` and
`scrub-bar` were all unobtainable. The four primitives that mattered were built
against our own tokens instead. When the registry is reachable, the useful move
is to read their versions for ideas rather than to swap ours out: ours already
carry product decisions theirs cannot know about.

## 16. How this plan is delivered

Settled 2026-08-04, after the fourteenth pass closed and the question became
when the prototype stops being edited and starts being built. Three changes to
delivery. None of them moves a design decision — §1 through §7 and every
correction in §11 stand exactly as written.

### 16.1 It is a port that overwrites, not a migration

[ADR 0054](decisions/0054-the-rework-lands-as-an-overwrite-because-there-is-nobody-to-migrate.md).
`0.2.2-alpha` has no users, so the continuity machinery this plan specified has
nobody to serve.

**Withdrawn:** §4.3 rule 6 (*"deep links survive"*) and the alias map it
requires; §13's mitigation that *"old and new sections coexist behind the alias
map"*. A replaced area is deleted in the commit that replaces it, and Stage 4's
section ordering stays a working order rather than a safety mechanism.

**Kept:** `src/lib/settingsAnchors.ts`. The overlay deep-links into
`capture.auto_stop` through a semantic anchor, and that is a runtime contract
with a native caller, not a convenience for a habit. Every anchor stays
resolvable when a control moves; updating that one file is the whole obligation.

This expires at the first distributed build. After that the next surface change
is a migration again.

### 16.2 The gallery is the acceptance surface

[ADR 0055](decisions/0055-the-gallery-is-where-the-port-is-judged-and-it-is-one-route.md).
One design-time route `/gallery` — Foundations · Components · Motion · Overlay ·
Screens — folding in the two unlinked routes that already exist
(`/overlay-gallery`, `/component-lab`).

**A screen is *ported* when it stands in the gallery and *shipped* when it is
wired.** That split is what makes a 1:1 port of the whole design possible
against a runtime that cannot yet answer half of it: §11.36 and §11.52 stop
being blockers and become the list of what the wiring stage needs, discovered
from a finished design instead of guessed at in front of one.

It also gives §11.13's checkpoint a place to happen. The palette, the frost pair
and the light scheme become checkable in WebKitGTK with one `npm run tauri
build` and a walk through Foundations, without the shipped surface having to
change first.

The prototype is read-only from this point. It is the reference the gallery is
diffed against.

### 16.3 It runs as a relay on `main`

Tracked in [`handoffs/HANDOFF_gui-port-relay.md`](handoffs/HANDOFF_gui-port-relay.md),
which carries the rules, the leg map, the active leg's full specification and
the prompt for the next one. Each leg is one agent session that ends green,
commits and pushes to `main`, records what it did, and writes the next prompt.
No feature branch: under §16.1 there is nothing a branch would be protecting.

The legs re-cut §8's stages against the two decisions above:

| Leg | §8 equivalent |
| --- | --- |
| 1 | Stage 1a + Stage 1b, plus the gallery shell |
| 2 | Stage 5, brought forward — every screen into the gallery, statically |
| 3 | Stage 3, as an overwrite and as a sheet (§11.22) rather than a second window |
| 4 | Stage 4, plus P1 and P2 from Stage 2 |
| 5 | §11.36 and §11.52 — the runtime contracts, prioritised by what Leg 4 found |
| 6 | Stage 6 |

**Two ordering corrections are deliberate.** The system lands before the screens,
because §11.17 found the prototype patching four missing rules screen by screen
and a screen-first port carries the patches instead of the rules. And **P1 and
P2 move out of Stage 2 into the wiring leg**: P1 is a write-contract change —
every keystroke is an IPC round trip and a disk write — and P2 remounts an area
on every navigation. Wiring 25 screens onto today's `patch()` would reproduce
both faults 25 times. P3 through P7 are compositing costs and stay where they
are.
