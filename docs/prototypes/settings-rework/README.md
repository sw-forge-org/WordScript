# Settings Rework — Stage 0 prototype

**This does not ship**, and **it is not disposable either.** It is not imported
by `src/`, not routed in `App.tsx`, uses no Tauri API, and changes nothing in
the build system — but it is the accepted shape of the target and the reference
Stage 1 through Stage 5 build against. Do not delete it.

Its gate, per [SETTINGS_REWORK_PLAN.md](../../SETTINGS_REWORK_PLAN.md) §8, is
**passed**:

> **Gate: agreement on IA, palette and copy budget before Stage 1.**

Settled by review on 2026-08-02: palette **Proposed**, copy **Budget**, density
and accent reach **Standard**. Open the demo on those three and you are looking
at the agreed target. What remains open is in the plan's §9 and §10.

## Open it

```
xdg-open docs/prototypes/settings-rework/index.html
```

Opening the file directly works. If your browser blocks local subresources,
serve the folder instead:

```
python3 -m http.server 8791 --directory docs/prototypes/settings-rework
```

No build step, no dependencies, no network access. Four files plus fonts and a
second wordmark: `index.html`, `demo.css`, `demo.js`, `wordmark.png` — a copy
of the shipped `assets/logos/wordscipt-logo-transparent.png`, kept here so the
folder serves standalone rather than reaching up three levels into the repo —
`wordmark-light.png`, and `fonts/`.

**`fonts/` is the tenth pass and it is not an optimisation.** The stack this
prototype inherited named Aptos first and shipped no font file, so every screen
here rendered in Noto Sans on Linux, Segoe on Windows and SF on macOS: three
typographic identities, none of them chosen, and every judgement made about
this surface before 2026-08-03 was made about a face nobody selected. Archivo
and IBM Plex Mono are now bundled as woff2, both SIL OFL, with their licences
beside them — which the licence requires and which is also why the folder still
serves with no network access.

**`wordmark-light.png` exists because the mark is a dark tile with a cream
quill beside a pure-white wordmark.** On a light ground the tile still reads
perfectly and only the word vanishes. `filter: invert()` would fix the word by
destroying the tile, and a logo is the one thing in a surface that may not be
approximated, so the light variant recolours the white glyphs and leaves every
other pixel alone.

## What is in it

23 screens, reachable from the **Screen** picker in the rig or from the
navigation inside the mock window.

| Group | Screens |
| --- | --- |
| System | Design System |
| Workspace | Home · History · Profiles · Context |
| Settings | General · Hotkeys · Notes & Meetings · AI Models · Agents · Integrations · Delivery & Insert · Privacy & Data · Account & Sync · Diagnostics · About & Updates |
| Previews | Onboarding · Meeting capture · Agent overlay · Handoff · Context · intake · Actions & templates · Live preview & commit **(withdrawn)** · *(Notes & Meetings, Agents, Integrations, Account & Sync and Context are previews too, and live in the group they belong to)* |

**Settings is a sheet, so it is never on screen alone.** Picking any settings
section renders the workspace view you last had open, with the sheet over it.
Escape, the scrim and the close control all dismiss it and return you to that
view. See "What the sixth pass changed" below.

**Three picker entries are one screen in two states.** *Context* is the object
being read, *Context · intake* is the object being made, and *Actions &
templates* is Context with its other window open — Ask and Actions open from
adjacent buttons in the object header. A static mock shows one state at a time,
so they are three entries here and one place in the product.

**4 workspace views and 11 settings sections**, plus 12 previews. Six previews
are counted twice because they *are* the workspace or settings screen, which is
the point: a preview is not a separate place.

**Two screens draw the overlay — Agent overlay and Handoff — and neither
changes it.** What follows is written about the first and holds for both: the
Handoff screen reuses the same pill at the same measured geometry and adds one
tab in the same slot. §1 excludes the overlay from the plan and that still
holds.

**The Agent overlay preview is the screen that draws the overlay, and it
does not change it.** §1 excludes the overlay from the plan and that holds: no
shipped overlay token, size or rule is edited, and `overlay-pill.css` is not
imported. What the preview does is *read* it — every number in the drawing
comes from `src/styles/overlay-pill.css` and
`src/components/overlay/OverlayPill.tsx`, down to `zoom: 0.87` and the absent
outer shadow — because the state it shows is a state of that pill and drawing
an invented one would be previewing something else. The one new thing on it is
a tab in the slot the learned-word tab already uses, and a window the tab
opens.

Changes against the plan's §4.2 table, from the fourth pass unless marked:

- **Integrations moved from the workspace to Settings.** It is an endpoint, a
  token, a port file and an install command, and §4.3.1 puts a thing you *set*
  in settings.
- **Chat stopped being a view and became a window opened from the object.**
  Every question it can answer is about something you are already looking at, so
  a top-level entry made you leave the note to ask about the note.
- **Actions & templates joined it as the second window** (sixth pass), which
  reverses §11.20's placement of the action manager in Settings. An action is
  authored, not set.
- **Meeting capture was added** as a standalone preview, because Notes could
  separate speakers and had no way to make a recording.
- **Notes & Meetings was added** to Settings, because four things had no home:
  where notes are written, what the note action bar can run, what a meeting
  records, and which speech engine transcribes an hour rather than a sentence.
- **Notes and Upload became Context** (ninth pass, ADR 0045). They produced one
  object by two routes and drew it two ways; an upload is now a *state* of the
  one list rather than a place beside it.
- **Handoff was added** as a standalone preview (ninth pass, ADR 0044) — the
  moment a dictation crosses from the assistant to the desk, which nothing had
  ever drawn.

The workspace list is 7 entries in the plan and 4 here.

**One screen is no longer a target: Live preview & commit.** Withdrawn
2026-08-03 by the plan's §11.15. It duplicates what Diagnostics already does —
`RebuildLabTab`'s *Diagnostics preview* panel runs raw text through the real
runtime and names roughly 25 applied rules — and it draws the decision as a
settings-window view, when the flow it describes lives in a 440 × 60 overlay
that must not take focus. It is still in the demo, and it stays: it is now the
illustration attached to the plan's §10.3, which records that conflict as an
open Phase 3 problem. **Do not build Phase 3 from this screen.** The one idea
worth keeping from it is that raw and transformed belong side by side rather
than stacked, which is a layout note for Diagnostics.

**Design System** is the new screen relative to the plan. §5 specifies the
design-system rework but scatters it across colour, copy, components, radii and
motion; that screen puts the whole system on one page — surfaces, measured
contrast, type scale, spacing rhythm, elevation rule, radius rule, every
component in every state, motion durations — and it changes live with the
switches, so the system is judged as a system rather than inferred from screens.

## The rig

The strip along the top is instrumentation, not a proposal. It keeps its own
fixed colours on both sides of the switch so it never contaminates the
comparison.

| Control | Keys | What it does |
| --- | --- | --- |
| **Surface** — Shipped / Proposed | `P` | Swaps the entire visual system |
| **Theme** — Dark / Light / System | `D` `L` `S` | The three colour schemes (ADR 0048) |
| **Copy** — Today / Budget | `C` | Swaps prose between the shipped strings and the §5.2 budget |
| **Density** — Tight / Standard / Roomy | `1` `2` `3` | The three calibration variants |
| **Screen** | — | Jumps anywhere without a reload |

**Theme is its own axis and is deliberately not folded into Surface.** Surface
records a decision already taken — shipped palette versus the §5.1 proposal —
and that pair is evidence the plan cites; a third button in it would destroy
the comparison. Theme asks a different question: does the proposal hold when
the room is bright. It applies only on the Proposed side, because the shipped
palette has no light mode and inventing one would quietly break the same
comparison from the other end.

**`System` is a deferral, not a third palette.** It resolves against
`prefers-color-scheme` at render time and re-resolves when the OS changes, so a
desktop switching at dusk is followed without a reload.

### What the Surface switch changes

Palette (five surface tokens, three foregrounds, the accent), card radius and
card border, and the window background. It does **not** change the information
architecture — both sides show the proposed structure, because the IA is being
judged on its own, not through a palette. It does not touch the overlay, which
is out of scope for the entire plan.

### What the Copy switch changes

Only prose: descriptions, hints and notes. Labels, values and control names are
identical on both sides — the budget in §5.2 reduces explanation, not
vocabulary.

Every string on the **Today** side is a verbatim literal from `src/`. Nothing
was lengthened to make the reduction look better. Where a screen shows no
reduction, there is no shipped string to reduce: Integrations, Agents and
Onboarding do not exist yet, and Home, History, Privacy & Data and About are
written to budget from the start. Live preview & commit is a third
case — withdrawn, and outside the count.

## The word meter

Two rows, top right. Both totals are computed on every render from the same
document, so the numbers do not move when you flip the switch — only the
emphasis does.

| | Today | Budget | |
| --- | ---: | ---: | ---: |
| every screen the rig counts | 8471 | 7217 | −15 % |
| the 12 screens carrying shipped copy | 3344 | 2636 | −21 % |

Per screen, largest first: Profiles −40 %, General −35 %, Context −33 %,
Hotkeys −32 %, Diagnostics −29 %, Onboarding −28 %, AI Models −23 %,
Notes & Meetings −16 %, Agents −14 %, Delivery & Insert −10 %,
Account & Sync −4 %, Home −4 %.

Re-measured 2026-08-03 after the ninth pass, in a browser, not written from
memory. **The totals are four times what this table said after the seventh pass
(3386 → 2869), and almost all of that is the eighth pass rather than the
ninth.** AI Models alone is 1121 words on the Today side; Meeting capture is
891, Handoff 636, Agent overlay 506. Those numbers were never brought forward
into this file when they landed, which is drift of exactly the kind this
prototype is supposed to catch, in the prototype's own documentation.

**The second row is the honest one and it moved from −26 % to −21 %**, for the
same reason the top line has moved every pass: the screens added since carry no
shipped string to reduce, so they are written to budget on both sides (§11.10)
and enter both columns equally. Handoff, Meeting capture, Agent overlay and
Context · intake are all in that group, and together they are more than 2000
words on both sides.

The 12 counted in the second row are the ones where a shipped string exists to
compare against. The rest read identically on both sides of the switch, which is
§11.10's rule: a screen may not claim a reduction it cannot have earned.

**Two rows moved in the sixth pass.** Profiles went from −37 % to −40 %: its
Defaults tab lost about 90 words when six equal rows became two grouped cards
and the hints stopped explaining the feature instead of the choice. Upload
re-entered the second row at −21 % after leaving it in the fourth pass (§11.10)
— the batch-options card rewrites three genuinely shipped strings, so it has a
reduction to claim again.

**The top line fell from −17 % to −15 % in the seventh, and that is again the
meter working.** The Agent overlay adds 274 words to a demo that had 3112, and
it has no shipped copy to reduce — nothing about that surface ships — so §11.10
requires it to read identically on both sides of the switch. It therefore
enters the numerator and the denominator equally and flattens the percentage
without a word being added to the target. The second row, which is the honest
one, did not move at all: 12 screens, 1951 → 1434, −26 %, unchanged across both
passes.

**The top line fell from −20 % to −17 %, and that is the meter working.** The
fourth pass added screens with no shipped string to reduce — Meeting capture,
Notes & Meetings, and the enlarged Integrations — and they are written to budget
on *both* sides, so they enter the numerator and the denominator equally and
flatten the percentage without a single word being added to the target. Upload
left the second row entirely: its rewrite reduced structure, not prose, so it now
reads the same on both sides and no longer claims a cut it did not earn
(§11.10). Delivery & Insert fell from −15 % to −11 % for the same honest reason —
the driver-chain correction added facts that are true on both sides of the
switch.

**The total moved between the second pass and the third, and up is not worse.**
The third pass added product — the second MCP surface, the CLI, the profile
Defaults tab, the driver and registration states the surface was not showing —
so both columns grew. The reduction that matters is the second row: the screens
that reproduce a shipped string still shed more than a quarter of it. Screens
with nothing shipped to compare against (Integrations, Agents, Onboarding) are
written to budget on **both** sides, so they no longer contribute a reduction
they cannot have earned. Live preview & commit was in that list until it was
withdrawn; it is now out of the count entirely.

Two reductions are invisible to this meter because it only swaps prose:
**History** lost a whole filter card to a toolbar, and **General** lost two
rows to Profiles. Structure is not counted here.

**What these numbers are not.** They count what this demo renders, not the
shipped surface. The plan measured 3068 words across the real
`src/components/settings/` and `src/components/areas/` and targets under 900;
this prototype reproduces the structure and the worst offenders, not every card,
so its totals are smaller on both sides and its percentage is not the plan's
percentage. Use it to judge whether the reduction reads as *lossy* — whether a
fact you needed went missing — not to certify the target.

Prose is counted as whitespace-separated tokens in `description`, `hint`, `note`
and banner text. Labels, values, code and links are not prose and are not
counted.

**The totals above are the ones you see on a fresh open.** A sub-tabbed screen
contributes only its open tab — the same thing the eye sees — so opening
Profiles → Snippets instead of Profiles → Defaults moves the total. That is
intended, and it is why the numbers here name the default state rather than a
maximum.

## What the tenth pass changed

Everything below landed on 2026-08-03, after a review whose verdict was that
the system was defensible in every part and still read as generated rather than
designed. Four of the five causes turned out to be measurable rather than
matters of taste.

### The typeface was never the typeface

`--font` named Aptos and the folder shipped no font file. Every screenshot,
every contrast judgement and every density calibration made against this
prototype before today was made in Noto Sans on Linux and Segoe on Windows.
Archivo is now bundled, and it carries a width axis as well as a weight axis,
which buys something a static face cannot give: **optical size**.

Small text needs more width, more letter-spacing and more weight to hold its
counters open; large text needs less of all three or it reads loose. A static
UI strikes that compromise once — usually at body size — leaving 11 px muddy
and 28 px airy. Section 1.1 of `demo.css` now sets width, tracking and weight
per step, from 104% / +0.012em at micro to 96% / −0.026em at hero.

**13 px joined the scale.** It was in the file 28 times before it was in the
scale — card titles, view descriptions, connection names — because it is the
step that lets a card title sit *below* body size and still outrank it, on
weight rather than on size. That is a real role, so it is named rather than
rounded away.

### The focus ring was an alarm

`2px solid var(--accent)` at `outline-offset: 2px`, on eight control classes at
once. Two things made it read as a warning rather than as a position. The
offset detached it from the control so it floated around the object, and at
full saturation and full width it outweighed the primary action standing beside
it — which is the one thing a focus ring must never do.

It is now a thin fully-saturated core flush against the control, carrying the
contrast the ring is required to have, plus a wide low-alpha halo carrying the
softness. Quieter at the same visibility, because the loud part is 1.5 px wide
instead of 2 px wide with a 2 px gap in front of it.

### The accent was on everything at once

Filled primary button, filled toggle track, filled *disabled* toggle track,
filled status badge, active nav icon, and a green level meter beside all of
them. Four fixes, one rule — the accent means primary action, active selection,
live capture, and nothing else:

- The toggle knob was `--on-accent`, a near-black disc on a saturated track,
  which made an on switch read as an orange slab with a hole punched in it. The
  knob is light in both states now, so the track stays readable as a track.
- A disabled toggle drops the accent entirely rather than dimming it. At
  `opacity: .4` an accent track is still the most saturated thing in its row,
  so the eye went to the one switch in the card that cannot be operated.
- The accent badge is tinted rather than filled. It carries "changed",
  "Active" and "Insert at cursor" — labels, not actions — and a label at the
  same weight as the only button on screen stops that button being findable.
- The level meter's fill is neutral. Its normal range is the state it is in
  almost all the time, and a permanently green moving surface in the corner of
  the eye is a status light that never turns off. The verdict line still says
  "Good" in `--success`. "Too quiet" moved from `--danger` to the accent,
  because wasting a take and recording something unfixable are not the same
  severity, and a scale spending its top level on the milder one has nothing
  left for the worse.

### Surfaces had elevation but no material

Elevation was a brightness step, which says which plane a surface is on and
says nothing about what the surface *is*. A 1px inset highlight on the top edge
only — the edge that turns toward the light, which on every desktop OS is
directly above — is the whole of what makes the same flat palette read as
material on macOS and as a diagram here. Bottom edges get nothing; a highlight
on both is a bevel, and a bevel is 1998.

Floating surfaces get a real cast shadow instead, because they genuinely are
above the plane. Four hardcoded shadow values that had accumulated as literals
are now one four-step ladder: `--elev-raised`, `--elev-pop`, `--elev-sheet`,
`--elev-window`.

### Home was four card stacks and one of them was the point

The most important fact in this product is *press Ctrl+Super in any app*, and
it was set at 13 px in the colour reserved for things you may skip. It is now
the object Home is built around: keycaps built the way a key is built, with a
front lip that is real padding rather than a border, so the cap has a face and
not just an outline.

Behind it is the matrix field, which is not wallpaper. Home's job at rest is to
answer *is this thing listening*, and a surface that responds to your voice
answers it without being read, from across a desk — which is the distance this
app is used at, because you are looking at another application while you talk.

The "next dictation runs as" row lost its card and moved to the hero's foot. It
is one line of standing state that had a whole grouping surface to itself, at
the same visual rank as the list of things blocking work.

### Three things are new, and one of them is not here

**A live waveform**, in the two places a microphone is actually judged. The
level bar reports one number as a length; it cannot show whether the signal is
steady or spiky, whether the room floor is audible under the speech, or whether
peaks are clipping while the average sits far too low. It does not replace the
bar — the bar carries the discard threshold, which is a boundary the runtime
applies.

**A command palette** on `Cmd/Ctrl+K`, searching screens, settings, profiles
and actions, with each row carrying the path it lives at. See ADR 0050 for the
full keyboard assignment and for the list of what only Rust can grant.

**The orb has four states** instead of two, and none of them pulses. See
ADR 0049.

**What is not here is the ElevenLabs registry.** `ui.elevenlabs.io` returns 429
to the CLI, to `shadcn add <url>` and to plain fetch alike, so `orb`,
`live-waveform`, `matrix` and the rest could not be pulled. The four primitives
above are ours, written against our own tokens with the motion decisions
recorded where they are made. They also exist as real React components at
`/component-lab` — see below.

### Where the truth now lives for moving parts

This folder is still the target and still ships nothing. But a motion model
cannot be judged from a still, and building the orb, the waveform and the
matrix twice — once in vanilla here and once in React later — guarantees the
two drift.

So they are built once, in `src/lab/`, against the shipped tokens, and shown at
the unrouted `/component-lab` route (`npm run dev`, then `/#/component-lab`).
This prototype draws its own version for the screens that need to show them in
context. **Where a screen here cannot render one truthfully, it says so and
points at that route.** Nothing under `src/components/settings/` was touched,
and no existing shadcn component was overwritten.

## What is real and what is sample

**Real, read from the current tree:** every label, section name, mode name and
mode description, register names and their descriptions, provider names, model
identifiers (`whisper-large-v3-turbo`, `llama-3.3-70b-versatile`,
`llama3.2:latest`), hotkey defaults (`Ctrl+Super`, `Ctrl+Space`, `Ctrl+Alt`,
`Alt+S`, `Alt+1`–`Alt+6`), activation modes, sound pack and cue names, insert
drivers (`xdotool`, `wtype`, `ydotool`), history status values, diagnostics
session sources and preview targets, the applied-rule names the runtime prints,
and the version `0.2.2-alpha`.

**Sample:** every runtime value — readiness states, transcripts, timings, log
lines, counts, the profile list. The rig says `static mock, no runtime`, and
every preview carries its `PreviewBanner`. Nothing here reports a state the
runtime reached.

**Invented on purpose, and labelled:** the second MCP surface and its tool
names, the CLI commands, and hook-based delivery. They are UX proposals for
Phase 8, not descriptions of code — the screen carries its banner and each row
states its status.

The window's title strip is a placeholder for what the window manager draws.
ADR 0003 binds the product to native decorations, so the prototype draws no
traffic lights and no custom chrome. The brand mark is redrawn geometry standing
in for the shipped PNG, at the same proportions.

## Known limits of the prototype

- **Fonts.** It uses the app's real stack (`Aptos`, then `SF Pro Text`,
  `Segoe UI Variable`, `Noto Sans`). On a machine without Aptos you are judging
  a fallback, exactly as the app does today.
- **Not the native host.** Chromium is not WebKitGTK. The palette must be
  confirmed on a real panel in `npm run tauri dev` before Stage 1 — §5.1 says
  the native host is the judge, and black crush is precisely what a browser on a
  good monitor will not show you.
- **Nothing is measured for performance here.** §6 P1–P7 are runtime costs in
  React and are not observable in a static mock.
- **Controls are inert.** Toggles, segments, sub-tabs and radios move so the
  states are visible; they persist nothing.

## What the sixth pass changed

2026-08-03. Six changes, each recorded in the plan as a numbered correction.
The OpenWhispr donor is the reference for *what a feature has to contain*, never
for how it is structured or drawn — where the two diverge, the divergence is
stated.

**Settings became a sheet with its own scale** (plan §11.22). It was a second
window with the workspace's exact metrics: same 232 px sidebar, same 32 px rows,
same 760 px column. Two surfaces drawn at one scale do not read as two surfaces.
The sheet is 1000 × 680 over a dimmed, blurred workspace, at 196 / 28 / 640.
Type does not scale — structure does. It drops the wordmark, the "Back to
workspace" row and the status strip, because the window behind it still has all
three; the profile switcher moves up into the sheet header.

**Every transcript is a Markdown file** (plan §11.23), at
`~/WordScript/transcripts/YYYY/MM/DD-HHMM-slug.md` with frontmatter carrying the
id, profile, mode, provider, model, duration, delivery and audio path. The row
grew two actions from it: *View raw transcript*, which unfolds heard against
written in place, and *Show in file manager*. A Verbatim transcript has one
text and says so rather than printing it twice.

**Upload accepts a link** (plan §11.24) — YouTube, podcast episode, direct audio
URL — beside the dropzone, as an equal intake rather than a fallback under a
heading. And it gained the two batch decisions it never had (plan §11.25):
speaker detection, and whether a note is written at all. The four stat tiles
went; a count is the result of a list, so it is in the list's header.

**Actions & templates are authored in Notes** (plan §11.26), which reverses
§11.20's placement of them in Settings. An action is a prompt you write, run,
judge and edit — a loop that lives inside a note. It opens from an **Actions**
button beside **Ask** and is the same kind of window Ask is, because two
adjacent buttons that open two different kinds of thing teach two rules for one
gesture.

**Integrations opens with Calendar** (plan §11.27): Google, Apple, CalDAV,
read-only, drawn as connections rather than as settings cards. The provider tile
is our own ground and our own glyph — a pasted brand asset would be the only
foreign artwork in the surface and would bring its own palette and radius with
it.

**The transcript row stopped spending its width on buttons** (plan §11.28).
Five labelled ghost buttons ran to ~330 px on a row whose own sentence was
already truncating; as 24 px icon buttons with a 14 px glyph they run to 128 px,
measured. Badges moved into a fixed 108 px right-aligned column, so a row
carrying two of them no longer pushes the actions to a different x than the row
above it. **And no scrollbar is drawn anywhere** — Profiles alone had shown five
at once, one of which scrolled the mock window inside its own frame. An edge
fade was built as a replacement and removed: it costs every heading its top edge
permanently to hint at what the wheel answers immediately.

## What the seventh pass changed

2026-08-03, immediately after the sixth. Plan §11.29–§11.31.

**The agent overlay is drawn** (plan §11.29). ADR 0030 specifies it in one
paragraph and nothing had ever rendered it, so Settings → Agents was
configuring a surface nobody had seen. It is **the shipped pill, unchanged
except that the mode chip reads `Agent`**, plus a tab that grows out of its
left edge and a window the tab opens.

The tab is not a new component: the overlay already grows one out of each edge
— the learned-word tab on the left (ADR 0035) and the auto-stop tab on the
right — and this is a third instance built to their constraints. The left slot
is free rather than contended: a bridge session runs no finalization, so it
learns nothing, so the learned tab is structurally absent for exactly as long
as this tab can exist. One difference, deliberate: this one stays out, because
"an agent is waiting for you" is a state and a state that retracts has to be
remembered.

Everything agent-specific is in the window — the fourth member of the window
family at 620 × 340, after Ask, the meeting HUD and Actions. ADR 0030's "space
on the left, time on the right" survives as the window's layout: targets with
state and unread counters on the left, the thread and the answer window on the
right.

**The first attempt at this screen is recorded in the plan because it failed
usefully.** It drew a pill with two large wings, 1038 px across, following
ADR 0030's own sentence to the letter — and it invented the pill instead of
reading `overlay-pill.css`, so it previewed something pill-shaped rather than
the overlay. Every number in the drawing now comes from the shipped files:
40 px tall, `zoom: 0.87`, `--ov-surface #1b1b1d` opaque, no outer shadow (the
shipped file forbids it — WebKitGTK paints it as a black box), and the
composition in its shipped order.

**`Agent` joined the mode cycle, after a rule** (plan §11.30). ADR 0030 forbids
modelling it as a `ProcessingMode` and says `delivery = agent` makes the mode
axis vacuous, so the pill shows `Agent` where a mode would stand. What the ADR
does not say is how you get there, and the answer is the control you already
have. Being *reachable from* a control is not membership in its category — the
rule is what states the difference, and the screen says so in as many words.

**Language Models stopped claiming Notes is a processing mode.** Five tabs in
one undivided run asserted that formatting a note is a fifth way to transform a
dictation. A 1 px rule now stands before it. Generalized: when a control offers
entries from two categories, the rule marks the boundary and the control stays
one control.

**Two fixes, one of them to the sixth pass's own work** (plan §11.31). The
settings sheet animated its entrance on *every* render, so it flew in again on
each click in its own sidebar — it now animates only when it was not already on
screen. And `New note` left the Notes rail foot: Folders and Notes each carry
their own add control in their section head, so the foot was repeating one of
them and then contradicting itself by not offering a new folder.

**The design system got a radius scale, and it had not had one** (plan §11.32).
Twelve values with no rule about which belonged to what, and the aggregate read
soft to the point of unseriousness — every label-shaped thing on screen was a
capsule.

| Token | Value | For |
| --- | ---: | --- |
| `--r-window` | 10 px | A window or a sheet |
| `--r-card` | 8 px | A card, panel, stage or well |
| `--r-control` | 6 px | A button, input, select or tab bar |
| `--r-small` | 4 px | A label, and anything inside a control |

The card moves from 12 px to 8 px on the proposed side; the shipped 10 px on
the other side is left alone, because it is the measurement being compared
against. Capsules survive only where the object is physically a capsule — a
switch track, a level bar, a waveform line cap, a count bubble, an avatar, a
dot, a radio, a round mic button. Badges, chips, scope tags, tabs and segments
are rectangles now. The overlay is exempt and stays exempt, and so does the
rig, which `demo.css` §2 deliberately keeps outside the design system.

Verified by walking every element on all 23 screens: the only capsules left
inside the product surface are the round mic button and the overlay pill.

## What the ninth pass changed

2026-08-03, after the eighth. This is the pass that stopped adding surfaces to
the product and started deciding where its two halves meet. Recorded in
ADR 0044--0047 and in plan §11.40--§11.52.

### The assistant and the desk are two things with one visible crossing

**The question was whether to merge them.** They cannot be merged, and the
reason is structural rather than aesthetic: the assistant runs inside a session
that ends in exactly one reducer commit (ADR 0018) and the other runs for days;
and the assistant is an API call we own completely while the other is a foreign
process with its own model, sandbox and MCP client.

What *can* be merged is the surface, because the user says one sentence and does
not classify it first:

```
"Write the mail from Tuesday's meeting."   -> text at your cursor
"Send  the mail from Tuesday's meeting."   -> something happens
```

One verb apart, and today the choice is made with a hotkey **before the sentence
exists**. So: the assistant recognises it cannot do this and offers to hand it
over. Enter hands over, Escape inserts the dictation as it always would have
been, and ten seconds of nothing does what Escape does — **the safe answer is
the default answer**. The card cannot take focus (the overlay must keep
`focus: false` or the insert target moves), so it grabs two keys while it is
visible instead of becoming a dialog.

Nothing about ADR 0029 is weakened. The assistant does not act; it hands over,
and a person presses a key. The new thing is an *inference* — "this sentence
asks for an effect" — and it is acceptable only because it is drawn, keyed and
free to refuse. The rule that keeps it that way is ADR 0041's, one word further:
**Auto may choose how text reads, never whether something happens.**

**The line runs where four properties agree**: time, effects, reach, ownership.
That agreement is the evidence it is a real boundary and not a way of sorting a
list — and it turns out to be the privacy boundary too. *The assistant reads
what is on this disk; the desk reaches what comes over the network.*

**`the orchestrator` is `the desk`.** It named the thing correctly and nobody
said it out loud. `lead` collides with the CRM sense (this product now models a
customer as a context object), `foreman` is gendered and is an existing piece of
infrastructure software, `handler` is exact and reads as tradecraft. `Desk`
carries help desk, news desk and trading desk — and it is the only candidate
that is not a person, which matters because ADR 0043 gave this thing a sphere
rather than a face. It is one constant in `demo.js`.

### Notes and Upload were one thing built twice

Two workspace entries produced the same object by two routes, and the user had
to know the route to find the result — then the two drew the same material
differently, a queue row here and a note tab there.

One type now, with `origin` and `state` as fields on it. The state that earns
the merge its keep is **`scheduled`**: a meeting on a connected calendar is an
object *before it happens*, carrying its name, its attendees and the questions
the last one in the series left open. That is "before the meeting you already
know everything" with no calendar view — which would have competed with the
calendar the user already keeps, and lost.

**The workspace drops from 5 entries to 4**, and that is the test the
abstraction had to pass: a real one removes an entry, a false one adds a screen
that explains the others.

Upload becomes a *state* rather than a place, and its queue is deleted rather
than moved — it was this list filtered to the objects with no transcript yet,
drawn twice. Then the first build of that intake was itself corrected: pressing
`+` landed straight in a dropzone, which made importing an existing file the
definition of "add something" and quietly deleted the plainest thing old Notes
could do. **Three ways in — Write, Record, Import — and Write is the default.**

**Four tabs, and the first draft had seven.** Summary · Transcript · People ·
Decisions · Tasks · Linked was written out and thrown away on a rule worth
keeping: *a tab is a view of the whole object, not a heading inside one of
them.* `Enhanced` became `Summary` in the same pass — the old name describes how
it was made, which is interesting for ten seconds and meaningless on a dictation.

**Relationships are a list, not a graph.** A graph shows *that* things connect;
the question a user arrives with is *what* connects. Obsidian's graph view is
the canonical case — admired, shared, barely used. The entry from the other
direction is a filter on the list.

### Nobody's connectors are ours except the calendar's

One question sorts every integration, present and future: **does it write
anywhere?**

| | | |
| --- | --- | --- |
| **intake** | reads, and that reading is why a context object exists | WordScript, natively |
| **bridge** | answers a call from something else | WordScript, as a server |
| **reach** | writes something, somewhere, for you | the desk, with its own connectors |

The desk is an agent CLI, so it already has an MCP client, a configuration file
and a permission model. A second one here would be a connector surface to
maintain forever, for capabilities that exist one directory away. So reach is
**shown and never configured**: WordScript reads that file and lists what is
attached, and there is deliberately no "add server" button.

The calendar is the only intake and the exception is argued rather than assumed
— it is small, it is the only source of a participant's name, and meeting
capture must not require that an agent CLI was configured first. Mail stays
entirely on the reach side.

**The door into the directory is ours to build**, and it does not contradict
ADR 0030. That record forbids *rebuilding* the CLI's controls; a button that
opens the real directory rebuilds nothing. Three doors — a terminal, the folder,
the instruction file — plus a restart that states its price. One honesty they
owe: the running desk is headless with no PTY, so the terminal is a **second**
session and a model changed there takes effect on the next start.

### A speaker's name is never in the audio

Read out of both donors rather than designed here. `voxtype` is the relevant one
because it is Rust: `meeting/diarization/{simple,ml}.rs`, ECAPA-TDNN embeddings
over `ort` with cosine clustering, and a subprocess backend for memory
isolation. OpenWhispr does the same over sherpa-onnx with pyannote segmentation
and CAMPPlus embeddings, identifying live at a 0.65 threshold.

Three stages, and only the first two are audio: **source** (mic is you, loopback
is everyone else — free, no model, and most of the value on a two-person call),
**cluster** (produces `Speaker 2`, a count and a separation, never an identity),
**name** (the invite, a saved voice, or a click).

The rule the whole thing rests on is the donor's `speakerAssignmentPolicy`:
`provisional → suggested → confirmed → locked`, and **`locked` survives the
end-of-call re-cluster**. Without it every name typed during a call changes
after it, which is worse than offering no names at all.

**The copilot** gets its rules in the same record: it never speaks — there is
one spoken path and it is the desk's — and the citation is part of the hint
rather than an affordance beside it. One at a time, replaced rather than
stacked, off by default.

### Four things the review caught

**The preview banner was a card.** A dashed box with an icon, a bold sentence
and a paragraph, on eleven screens, at about 60 px — on Context, Agents and
Meeting that was a third of everything above the fold. It is a chip and one line
now, **26 px measured**. Its lead is a *word*, because "Layout preview — not
wired to the runtime" was the fourth time the surface said so.

**Integrations had two thousand words and no shape.** The prose was doing the
structure's job: every row argued for itself because nothing made a row mean
anything on its own. With the three classes as a table at the top, a row only
has to say what it is. About 1100 words came out and no fact went with them —
and one section left entirely, because "where the text lands" is Delivery &
Insert's question and that screen answers it better.

**Account & Sync was selling an account that is not coming.** It framed
self-hosting as an upgrade path toward signing in somewhere, when the decision is
the opposite: **there is no WordScript account and there is not going to be
one.** It also collided with AI Models over the word — that screen is full of
accounts — so the first row now says which account it means and points at the
other.

**One fact, one screen.** Delivery's Recovery card named the last failed
transcript verbatim with a Restore button — the same event that is now a row in
Home's inbox with an expiry and a row in History as the record. Three tellings,
two of which cannot clear it. And Privacy repeated Account & Sync's whole first
section. History against Privacy is *not* redundant and the pairing is stated on
both sides now: History is the data, Privacy is the policy.

### Two layouts gave way, and both for the same measured reason

The fourth tab took Context's tab bar to 349 px against 387 px of head, with
245 px of buttons still to place. The same thing happened in the meeting HUD at
330 px once the calendar origin joined the date line — the tabs were painting
over "from Google Calendar".

Both heads are two rows now: identity and windows above, views below. Squeezing
was available and wrong — the ways to fit were dropping the Linked tab or
unlabelling Ask and Actions, which is a layout making content decisions. Export
did lose its label, on §11.28's rule: it is the one control there that is
neither a view of the object nor a window over it.

## What the eighth pass changed

2026-08-03. Four decisions, and one of them is a correction of something this
same pass built. Recorded in ADR 0040--0043 and in plan §11.33--11.36.

### Every model choice is one screen now

**The fault.** A model could be set in five places: Speech-to-Text, five tabs of
Language Models, the meeting engine on Notes & Meetings, the voice preset on
Agents, and a set of local checks that named a model they had no way to install.
Each was defensible alone. The total was not — "which model is doing this" took
four screens and knowing which one wins, and the same ten providers were listed
on three of them.

**The wrong fix, kept in the record because it is the instructive half.** This
pass first added a *sixth* place: a `Providers & Keys` screen to hold the
credentials the others shared. Sound in isolation, worse in fact — three screens
listing providers instead of two, and the real gap untouched. The mistake was
treating the credential as the thing that needed a home. **A key is one row.**
What had no home was the *installation*: a server, a runner, model files,
downloads, disk.

**What it is now.** One section, `AI Models`. One connection stated once — lane,
provider, key, plan — and every job follows it unless it says otherwise. One row
per job, grouped `Listening` · `Writing` · `Speaking` · `Runs no model`. Closed,
a row answers what runs it and whether that is the default; open, it is that
job's whole settings, in place, with no navigation. A second tab carries the
local installation, both kinds of model together, because it is one disk and one
runtime and the total is the number that matters when a model is 4 GB.

The last group is on the surface deliberately: *"why can I not set a model for
Verbatim"* is answered by seeing it stated. An absence answers nothing.

**On the donor.** OpenWhispr has no provider screen either — `InferenceConfigEditor`
carries lane → provider → model → credential where the decision is made, and its
sections divide by consumer and by scope. But it keeps speech and language as
two top-level sections, and that is right *for it*: its speech section carries a
local model manager, a VAD panel, GPU selection and three consumer tabs. Ours
would be one engine row against five near-identical ones. A donor's structure is
evidence about a shape, not a mandate to copy the count.

### The local lane stopped being a claim

It could be selected and then not populated. The surface named
`llama3.2:latest is not installed` and offered `Copy command` — it was telling
the user to leave the application and come back. `On this machine` now has what
the donor's `ModelCardList` has: a size stated *before* the download, progress
with cancel, removal, the installed total, and the server that loads them.
Whether WordScript bundles that server or talks to the Ollama you already run is
drawn as a real choice and is open work — ROADMAP Phase 5 now carries it.

### Draft and the notes model were the same assistant twice

The seventh pass gave Language Models a fifth tab for the notes/meetings/Ask
model and put a rule before it. The rule was right about the surfaces and wrong
about the thing. The sentence that breaks it: *"write the mail from Tuesday's
meeting."* Draft could write a mail and not reach Tuesday's meeting; Ask could
reach it and inserted nothing where you were typing.

One assistant, three doors, one bounded read of your own notes — and ADR 0040
answers each of ADR 0029's four reasons for prohibiting tools rather than
working around them. Side-effecting tools stay prohibited; what is permitted is
one lookup, then the generation, then the commit, with the number of stages
fixed at compile time rather than chosen by the model.

`Translate` takes the freed slot as a mode in the full sense (ADR 0041), not a
switch on Cleanup — a flag that turns the smallest transform into the largest
makes the mode indicator lie.

### The orchestrator got one voice, and it has a body

The agent window drew three targets with three status dots and read as three
agents talking, which argues against ADR 0030 — one orchestrator, one client,
and for the agents it starts it *is* the human. The fix is a shape, not a
sentence: an **orb**, idle small and white and still, speaking larger and warm
and moving with its own amplitude. Bars are plural; a sphere is not. It sits at
the head of the target rail as the identity the targets are indented under, and
again in a dash across the window's foot.

A **notification** covers what the overlay tab cannot: a closed window and no
dictation running. WordScript's own always-on-top window, content-protected,
carrying the orb, the question and the offered options — not an OS notification,
because Focus mode and screen sharing suppress those and a screen share is
exactly when an agent is likely to be running. Its sound is a cue on ADR 0010's
existing persistent stream, which means a second motif has to be composed rather
than sampled.

**The dictation overlay is untouched, and the screen says so on itself.** The
bars are your voice, the orb is the machine's, neither appears on the other's
surface. §1 holds.

### Onboarding is a flow you can walk

It was one frame — "step 3 of 3, try your hotkey" — which is the one thing a
setup flow cannot be shown as. A flow's whole content is its **order**: what is
asked first, what is proved before the next thing is asked, what happens when an
answer is "not yet". Seven steps now, forward and back, with the rail as a
control: steps behind you are buttons, steps ahead are not.

One rule throughout: **nothing is claimed until it is proved.** Each step ends
in a checked fact rather than a filled field, and the flow ends by producing
text instead of announcing that it will.

`Welcome · Microphone · AI Models · Hotkey · Insert · Try it · Done`

**Step 3 was missing entirely.** Setup asked for a provider in one line and
never said the same connection drives cleanup, translation and the assistant.
It now renders the *same* lane segment, provider grid and model rows as
Settings — not a simplified twin. That is the donor's practice
(`OnboardingFlow.tsx` renders `TranscriptionModelPicker`, its settings
component) and the reason is worth stating: a setup flow that draws its own
version of a control teaches a screen the user never sees again, and the two
drift the first time one is edited. `providerGrid()` and `modelRow()` are shared.

All four lanes are real here: Cloud has the provider grid and a key, **Local has
actual downloads** with sizes, progress and cancel, Enterprise has an account
grid and a region, Self-hosted has a URL and a typed model id. The two that need
another lane for speech say so.

**Step 5, Insert, is ours and not the donor's** — a dictation that transcribes
perfectly and then cannot be placed is the failure this product has actually
shipped, it is invisible until the first real dictation, and on Wayland it is a
decision rather than a missing package.

**And the flow says what it leaves out.** Every candidate was put to one test —
does it block the first dictation? — and everything that failed it is named on
the last step rather than silently absent: modes, communication style, overlay
placement, sound cues, history policy, notes, agents. A setup flow gets long one
defensible addition at a time.

### Provider marks, in colour

The provider is picked from a grid of tiles carrying brand marks, not from a
`<select>`. Picking a provider is a recognition task — you know the mark before
you have read the word — and a closed select also gives the capability, *which
jobs this one can actually run*, nowhere to live. The donor makes the same
choice (`ProviderTabs`, `ModelCardList`). The mark repeats in the model column
of every job row, which is what makes that column scannable: twelve model names
have to be read, twelve with a mark in front are sorted by shape, and the one
that went somewhere else is visible without reading any of them.

**Source:** [`@lobehub/icons-static-svg`](https://www.npmjs.com/package/@lobehub/icons-static-svg)
v1.94.0, MIT licence, by [LobeHub](https://lobehub.com/icons). Fifteen marks are
inlined into `demo.js` — the prototype has no build step and no network access,
so a CDN reference or an npm import would both break it.

**Colour, and an earlier pass here was wrong about that.** The first build used
the monochrome variants, reasoning from the plan's §11.20 rule against colour
charts. That rule is about **status** colour — a hue the interface assigns to
mean something, competing with the one hue that means "look here". A brand mark
is not status. Its colour is part of the mark, it is the same orange every time
anyone has ever seen Anthropic, and stripping it makes fifteen marks harder to
tell apart while freeing no attention at all. The accent still means
"overridden" and still has no competition, because no brand in the set is
WordScript's amber.

Three stay black-and-white because their brands are — OpenAI, xAI and Ollama
have no colour variant to use. They take `currentColor` and follow the theme.

**They are a `<symbol>` sprite, not repeated inline SVG.** Six of the colour
variants carry gradients with internal ids, and the same mark appears in the
provider grid *and* in a job row — inline, that is duplicate ids in one
document. One symbol per mark, referenced by `<use>`, every id namespaced per
mark, and the sprite injected once outside the tree `render()` replaces.

A mark is identification and never the only label: every one sits beside the
provider's name in text.

### The lane selector was a label, and is now a control

Caught on review of this same pass. AI Models offered four lanes — Cloud, Local,
Self-hosted, Enterprise — and the card below them did not change: all four
showed a cloud provider grid, a cloud API key and a cloud account plan, and
every job row showed the same model names.

Every other `seg()` here is inert on purpose — it moves its thumb and changes
nothing, which is honest for a static mock. The lane cannot be one of those. It
decides what a provider *is*, so a switch that leaves the card identical is not
an inert control but a false one: it asserts the four lanes are one thing with
four names.

What it was hiding: Local has **no credential at all** and now says so — the one
lane where "no request leaves this machine" is true by construction rather than
by promise. Self-hosted has a URL and typed model ids. Enterprise has an account,
a region and three credential shapes. And the model names differ —
`whisper-large-v3-turbo` is a Groq endpoint, `ggml-large-v3-turbo` is a 1.6 GB
file on this disk; same weights, different things. A job that a lane cannot run
(no self-hosted endpoint transcribes; among the enterprise three only Azure
does) now says so and names the lane that can, instead of offering an empty
picker.

One new primitive, `segState(key, items)`, writes state and re-renders. Exactly
one control uses it. **A control may be inert; it may not be false.**

### Two components existed only as class names

`.grp` had been written by Delivery & Insert and never given a rule, so the
driver chain's two stage headings rendered as bare body text and the split the
card exists to state was the one thing it did not show. And a downloadable model
had no component at all, because nothing had ever offered a download.

## What the fourth pass changed

A detail review on 2026-08-03: spacing, redundancy, and the question *what does
each tab look like when someone actually uses it*. Everything below was measured
in a browser across all screens and all sub-tabs, not judged by eye on one.

**Every card in the demo was flush at the bottom.** The card had
`padding: 0 var(--pad-card)` and left the vertical space to whatever sat inside
it, so a card of rows had 20 px at the sides and 13 px top and bottom, and a
card ending in anything else — a button, a list, a checklist — had **zero**.
Three different inline paddings had grown in `demo.js` to patch it one screen at
a time (`padding-top:12px` on Profiles, `padding:0 0 16px` on Agents and
Diagnostics, nothing at all elsewhere), which is what an *Add replacement*
button welded to the bottom edge of its card looks like. The card owns its inset
now, the first and last child of a row stack drop their own edge padding, and
the action that acts on a card is a component (`card-foot`). No screen carries
an inline spacing value; that is asserted by a check that walks every card on
every screen.

**The radio dot was off-centre, and arithmetic says why.** 17 px box, 1.5 px
border: an odd box has no integer centre and a fractional border snaps to
different device pixels on the left and the right. It is 16 / 2 / 8 now — 12 px
of content, an 8 px dot, exactly 2 px on every side at any pixel ratio. Written
into the design system as a rule, because the next control will have the same
problem.

**Three tiles across the top was a habit, not information.** Integrations opened
with `Loopback` · `0` · `None`, Account & Sync with `Local` · `Off` ·
`This machine`, About with `0.2.2` · `alpha` · `Source build`. Six of those nine
are words that never change, and on all three screens the tiles restated the
banner directly beneath them. The rule now: **a stat tile carries a number that
changes and summarises more rows than fit on screen.** That leaves one honest
use — above the Upload queue — and clears the other nine.

**Home told one story three times.** A failed insert was announced by the action
strip, repeated by a *Last transcript* row with the same sentence and the
Restore button, and shown again as the fourth row of Recent with a Clipboard
badge. The strip keeps the exception and the action that clears it; Recent keeps
the record. Also gone from Home and Notes: the demo's own commentary about what
the empty state would read, which was the prototype talking to its reviewer from
inside the product surface.

**Notes was rebuilt, and the rebuild was rebuilt.** The first version put
Transcript, Raw notes and Enhanced on three mutually exclusive sub-tabs. The
second replaced them with two fixed columns — transcript reading on the left,
notes and summary working on the right — on the grounds that you write shorthand
while someone else is talking. Both are wrong for the *workspace*, and the
reason the second one failed is the useful one: the two columns are not equal.
The transcript is long, the notes are short, so the most-read view got half a
column and the least-read one got the other half, permanently. Reading and
writing at the same time is real, and it happens **during** the call — which is
what the meeting HUD is for. Afterwards you read one of the three.

So Notes is three tabs again, at the top right of the note where a view switch
belongs, and the HUD carries the same three so nothing is learned twice.

Four things came with it:

- **Folders.** The rail carries folders above the note list, and the folder
  governs the list the way the list governs the detail. They are **directories**
  — WordScript keeps notes as files under a real path on this machine, so a
  folder here is what the file manager shows and moving a note moves a file. The
  path is stated in the rail footer precisely so that promise stays visible and
  cannot quietly become a database table with folder-shaped rows.
- **Chat, as a panel.** It was a top-level workspace view; it is an overlay
  inside Notes now, with the note behind it. Everything it carried survives the
  move: an answer names the rows it read, voice input is the dictation hotkey
  rather than a second recording path, and nothing is persisted.
- **One floating bar.** A mic and one primary action, the rest behind a chevron,
  at the foot of the note at every scroll position. A split button, not a
  select: a select makes you choose before you can act.
- **Timestamps and note states.** A transcript with no time cannot be matched
  against a recording and a note cannot point at the moment it is about; and a
  note is a session, so *Recording*, *Transcribing* and *Ready* belong in the
  list. Upload picks the folder its results land in.

Removed: the settings card that sat in the note detail — a diarization toggle is
configuration parked in the workspace.

**Upload was 460 px wide and had four copies of one limit.** It was a `solo`,
which is right for an empty Upload and wrong the moment a file is in it: a queue
row carries a name, a size, a status and a transcript, and 460 px squeezed all
four into a column two words wide. It is a band over a full-width list now, the
25 MiB is stated once — inside the dropzone that spends it (ADR 0034) — the
batch profile became a control instead of a subtitle, and a finished row offers
what actually applies to a file transcribed in this window: copy it, or keep it
as a note. *Insert at cursor* was never one of those.

**Integrations moved to Settings.** Endpoint, token, port file, install command:
nothing on it is authored, and §4.3.1 says a thing you set lives in settings. It
now sits beside Agents, which is the other half of the same MCP question
(§10.1). Its group captions went too — each card carried a caption *and* a
title, two headings for one thing.

**Meeting capture is new**, and it is the door Notes was missing. It is a
*second window*, not a second state of the dictation overlay — see the section
below.

Smaller, and all of them redundancy: History's *Errors only* toggle (the status
select already has *Failed*); the second bias door in Speech-to-Text (the terms
live in the profile, so the list does too); the Agents roles legend (three rows
whose only control was a bare icon); Privacy's *Danger zone* header (a third red
signal on top of the red label and the red button, and the least useful of the
three — it names a neighbourhood instead of a consequence); Delivery's three
platform rows all badged *Not this session*; About's *Not built* section
restating Account & Sync's own banner; the second closing note on Hotkeys; and
the footer's *Every change saves as you make it*, which was the "Auto-saved"
furniture the plan removed from the header, moved down one edge and kept.

One contrast bug: `--fg-muted` measures 3.94:1 on `--bg-elevated` and the
selected pane row **is** `--bg-elevated`. The rule confining muted text to the
card plane was written on the Design System screen and broken by the one row
every reader looks at.

**A rejected direction, recorded so it is not tried again.** The action strip
first got an accent rule down its left edge to tell it apart from a card. Ruled
out on sight: a coloured edge bar is a web convention, not a native one, and at
this scale it reads as a rendering defect. Emphasis is carried by the ground and
by an icon tile — the same tile idiom the lane rows already use, so the accent
arrives as a shape the system owns. This holds for every future component.

### What the fifth round changed

A review of the fourth pass, against reference screenshots the user supplied and
against the donor source in `donors/app/desktop-shells/openwhispr/` — which turns
out to hold the full OpenWhispr tree, not just the screenshots.

**Ask is a window, not a panel.** It was a full-height panel welded to the right
edge of the note, which covered the note you were asking about. It is a small
always-on-top window now: movable, resizable, and able to sit beside the main
window so the answer and the note are readable at once. Same window family as
the meeting HUD — an OS decoration strip, a resize grip, no invented chrome.

**The notes path is a control.** The rail footer stated where notes live and
could not change it. A path you can read but not set is a statement about
somebody else's machine; it opens the folder picker now, and Settings → Notes &
Meetings owns the setting.

**The upload queue stopped being a colour chart.** Nine rows each carried a
coloured pill — Completed, Completed, Transcribing, Failed, Queued, Queued,
Queued. Two thirds of it said "this went exactly as expected", and the one row
that needed a decision had nothing left to stand out from. Expected states are a
dot and a word in the meta line, Queued gets nothing because its position in the
list already says it, and the badge is reserved for the row that failed. A row
that finished normally proves it by carrying a transcript.

**Notes & Meetings is a new settings section**, because four things had no home
and were being implied by surfaces that could not configure them: where notes are
written, what the note action bar can run, what a meeting records, and which
speech engine transcribes an hour rather than a sentence.

**The template question is answered by the donor, and better than a template
file.** OpenWhispr's `ActionPicker.tsx` is a split button whose menu lists
user-editable **actions** — a name, a description and a prompt each — with
"Manage actions" at the foot and last-used promoted to the default button.
Borrowed whole, with one change: OpenWhispr keeps actions in SQLite; since notes
here are files under a real directory, the actions are Markdown files beside
them in `_actions/`. A prompt you can read in your editor and put in git is worth
more than a row in a database nobody can see.

**One model for notes, meetings and Ask**, as a fifth tab in Language Models.
The donor separates the same way: `src/config/inferenceScopes.ts` defines four
scopes — `dictationCleanup`, `dictationAgent`, `noteFormatting`,
`chatIntelligence` — resolves provider and model per scope, and falls back from
`noteFormatting` to `dictationCleanup` when unset. The meeting speech engine is
separate too, and that is not an invention either: `MeetingSettings.tsx` carries
a full parallel set of transcription settings, because seconds of one voice and
an hour of several are different workloads.

**The driver chain was wrong three ways**, and `src-tauri/src/core/insertion.rs`
had been right the whole time. It drew one ordered chain; the runtime has two
plus a terminal state and says so itself — `NativeInsertDriver::role()` returns
`clipboard` for `wl-copy` and `arboard`, `paste` for
`xdotool`/`wtype`/`ydotool`/`enigo`, and `recovery` for the scratchpad. Three of
the eight drivers were missing, including the only one that writes a Wayland
clipboard. And `wtype`/`ydotool` were shown as "not in PATH", which is not why
they are unused: `paste_driver_execution_chain` never reaches them, deliberately,
because both trigger a compositor privilege prompt per paste. That is the
difference between "install a package" and "this will never work here".

**The meeting HUD lost its scrollbar.** In a 330 px window standing beside a
call, a permanent 9 px gutter spends a thirtieth of the measure saying something
the content already says.

## Meeting capture, and why it is not the overlay

**The window is the note, live.** The first sketch of it was a horizontal strip
of transcript with a quick-note field beside it — a control panel for a
recorder. That is the wrong object: during a call you are not operating a
recording, you are reading and writing the note the call is producing. So it is
tall and narrow, it carries the same three tabs the note has in Notes
afterwards, and the recording itself is one line of state at the top rather than
the subject. Nothing has to be learned twice and nothing has to be migrated when
the call ends — the window simply stops being live.

The screen draws it in the three states that carry the argument: while it runs
(Enhanced), while you are writing in it (Notes, with the action menu open), and
on the record itself (Transcript). Same window, same width, same bar.

The plan's §1 puts the overlay out of scope and its §10.3 records that Phase 3
wants a reading surface in a window that cannot be one. Neither is reopened
here, because **a meeting HUD is a different window with different
obligations.**

§10.3's conflict is real because the dictation pill must keep `focus: false` —
taking focus moves the insert target away from the app being dictated into. A
meeting inserts nothing. There is no insert target to protect, so the constraint
that makes §10.3 unsolvable does not apply, and a window read for an hour may be
moved, resized, collapsed and focused.

| | Dictation pill | Meeting HUD |
| --- | --- | --- |
| Size | 440 × 60, fixed | resizable, remembered |
| Focus | never | may take it |
| Lifetime | seconds | the length of the call |
| Audio | microphone | microphone + system audio, echo-cancelled |
| Ends in | text at your cursor | a note in Notes |
| Screen share | visible | excluded |

**What the landscape settles.** No bot joins the call — Granola's model, and the
only honest one for a local-first product with no server to send a participant
from. The transcript arrives while you are still talking, which is Otter's one
real differentiator and what makes the note's left column worth looking at
during the meeting rather than after it. Content protection is not optional: the
window floats over a call that is often being shared, and OpenWhispr calls
`setContentProtection(true)` on its meeting surfaces for exactly that — verified
in the shipped 1.8.1 bundle, along with a dedicated meeting hotkey, separate
microphone and system streams, an AEC sidecar with a leak detector, and live
diarization that re-clusters when the call ends.

**What is deliberately not settled, and is named on the screen:** whether
capture starts from a hotkey, from detecting a call, or both; and what happens
to the audio of a meeting nobody keeps — ADR 0039 keeps a failed dictation's
audio until the retry or the sweep, and an hour of meeting is a different size
of promise.

This screen proposes product. It is here so the direction is written down and
argued with, not so it is built from.

## What the third pass changed

A screen-by-screen review against the shipped tree, on the standing brief:
native macOS register, less redundancy, more obvious controls. It was not a
port — the live surface is the inventory of what exists, not the layout to
reproduce, and several live things were cut on purpose.

**The wordmark was missing.** The shipped sidebar opens with
`assets/logos/wordscipt-logo-transparent.png`; the prototype opened with a bare
nav group. The real file is now in all three sidebars — copied into this folder,
not redrawn — at the shipped 180 px cap. The settings window carries a
`SETTINGS` qualifier under it, because two windows of one app are told apart by
their sidebar, not by a title bar the OS draws.

**The settings window shows the active profile too.** It was only in the
workspace footer, which left the settings window naming per-profile values
through scope tags without ever naming the profile they point at. The same
switcher now sits in both footers: the tags say *which values* follow the
profile, the footer says *which profile*, and switching it there changes what
several settings screens are showing.

**Standing state moved to the bottom edge.** The shipped shell says
"Auto-saved" in a permanently green header badge and "Changes are saved
automatically." in the footer — one fact, twice, one of them furniture. Both
were replaced by a single status strip carrying readiness, lane, model and
delivery target, which also fixes something the two-window split broke: the
settings window could no longer see the readiness that only Home showed. Home
lost its own state row to it.

**Half the settings turned out to be per-profile.** Delivery, processing mode,
language, bias, recording limits and the workspace-context switch are all
scoped to the active profile in the runtime, and all sat in settings sections
that read as machine-wide — the same shape as the failure ADR 0024 was written
about. Now: **Settings means this machine.** Everything a profile owns lives in
a new **Profiles → Defaults** tab, and the few rows that stay in settings for
findability (language, bias) carry a scope tag that links to the profile. It is
also the direct answer to the Phase 7 success measure — *see at a glance what a
profile contains and what stays global*.

**Four controls were missing from the kit**, and the surface had been quietly
falling back to worse ones: a **stepper** (the shipped kit has one and calls it
"macOS-style"; the redesign was using bare number fields for minutes and
seconds), a **slider** with a read-out for cue volume, an **input level meter
with the speech threshold drawn in** — the decorative waveform stated a level
and hid the bar you have to clear — and a **disclosure**, so the local decode
settings stop carrying the same weight as the model choice. Two patterns were
added with them: a **toolbar** for filters, and the **scope tag**.

**Integrations went from one MCP surface to the two the product needs.** The
plan's §10.1 recorded that a notes/transcripts server is a second class of
client ADR 0030 does not contemplate, and left the answer open; the first build
showed only the bridge. Both are on screen now, each stating what it can and
cannot do, with the undecided part named as an open decision *in the row where
it is spent* — a reader must not end up holding a token that also reaches `ask`.
Added with them: the CLI with real commands and automatic port discovery, a
group stating that text reaches any focused app so no editor plugin exists or is
needed, and a "deliberately absent" group.

**Things the live surface has that were cut.** The Filters card (three labelled
rows for a search box, a select and a toggle — now one toolbar line), the
duplicate provider "Profile" select that sets the same value as the model
select, the Overlay tab's Display and Anchor rows in the mode where they cannot
act, and the standing "Preview layout" badges that repeated what the banner
already says.

**Vocabulary that was invented and is now the runtime's own.** History status
filters (`Completed · Empty · Failed`, not made-up delivery states) and a
per-entry duration that no history entry carries; Diagnostics session sources
(`Hold to talk · Tap to toggle · Diagnostics demo`), text profiles and preview
targets (`Editor preview · Clipboard fallback preview`); and the commit
preview's intervention names, which are now the labels the runtime prints for an
applied rule — *Removed filler words*, *Collapsed a repeated word*, *Dictionary
replacement applied*, *Hallucination filtered*.

**Runtime truth the surface was not showing.** Whether the OS actually accepted
each shortcut, which driver in the chain is in use, the support tier, the
scratchpad path and entry count, the microphone that the next capture will
use, and the portal check that explains why the Wayland lane is unavailable.

## What the second pass changed

Review feedback on the first build, and what came of it.

**Home was lying about the product's central act.** It opened on a *Ready to
dictate* hero with a `Capture` button. Nothing can press that button into a
recording — dictation starts with the global hotkey, in whatever app has focus,
and this window is usually not that app. The button navigated while looking
like it recorded. Home is now the dictation record: state in one line, the
hotkey named where the eye already is, the list of what was actually dictated as
the dominant surface, and an action strip above it *only when something is
owed*. The donor lands on the same shape.

**Two cards side by side is not a list-and-detail.** Profiles, Notes and Chat
put a list card next to a content card, which reads as two unrelated boxes
because nothing on screen states that the left one governs the right one. All
three now use a **pane**: the list is borderless, sits on the sidebar plane, and
is separated by a hairline — one surface, one scroller, selection on the left
governing everything right of the line. The Design System screen documents
`column` / `pane` / `solo` as the three layout choices.

**A word list is chips, not rows with hover actions.** Words & names now opens
with an input and shows terms as chips, learned ones outlined — the donor's
Dictionary. Rows with hover actions imply a record with fields; a term has none.

**Upload and Integrations were key-value dumps.** Upload is now one centred
dropzone with the active engine stated under the title and the queue beneath it.
Integrations is grouped cards under small captions, with copyable commands and a
closing note stating what WordScript deliberately does not do.

## Two facts the first build had wrong

**The `agent` mode is renamed `draft`.** ADR 0029 records it: ADR 0030 gives the
product a settings area called `Agents` for coding agents, and two unrelated
things cannot both be called agent — of the two it is the mode whose name was
already wrong. `draft` states what comes out, a first version to be reviewed,
which is what ADR 0026 means by calling the output an artifact rather than an
answer. `agent` stays a legacy alias on read and `draft` is written back. The
prototype now says Draft everywhere, on `Alt+5`, in history rows and in the mode
list, and the Draft tab says where the old name went.

**`Agent` is a delivery target, not a processing mode.** ADR 0030: a bridge
session returns the transcript to its caller and inserts nothing, so it performs
no transform and cannot sit on the mode axis — the pill shows `Agent` where the
mode would otherwise stand. It is therefore a third option in
Delivery & Insert's lane card, next to *Insert at cursor* and *Clipboard only*,
and it is not in the mode list.

**Communication style applies to Draft and Rewrite** (ADR 0023, "Scope: Agent
and Rewrite"). It stood only under Rewrite, which meant Draft silently inherited
a setting whose cause was nowhere on screen. The same card now stands on both
tabs, with its scope named on each.

**Agents was three things in one page.** It is now three tabs — `Orchestrator`
(the one process WordScript starts and talks to, its only client), `Targets`
(repositories with a role: inspect, work, resume) and `Voice` (how a question
reaches you and how the answer returns) — plus two rows that state the
disambiguation outright: this is not the Draft mode, and Agent is a delivery
target.

**Three previews were built from their names instead of their code.** Notes,
Upload and Chat each lost features that already ship. Restored, in the new
design system: Notes regained its three panes (Transcript with speaker
separation / Raw notes / Enhanced summary), speaker chips, search, pinning,
copy and delete; Upload regained the queue counters, the real
`413 request_too_large` error, per-row copy/retry/remove and the stated size
limits; Chat regained the local-context statement, per-turn copy, send states
including failure, the typing indicator, the empty state, and the two
boundaries it states — voice input reuses the dictation hotkey, and messages
are not persisted. **A preview is rebuilt from the component it replaces, not
from its name.**

**Account was missing entirely.** §7 had recorded it as "documented as pending,
not rendered". Overruled: `AccountArea.tsx` ships today and a user reaches it,
so removing it without a replacement loses the one place that answers *"do I
need an account?"*. It is now `Account & Sync`, a labelled preview in Settings
under SYSTEM — account mode as a lane, self-hosting sync, and no export card,
because export moved to Privacy & Data and stays moved.

## One correction to the plan

Verified numerically while building this: in §5.1's comparison table, the
`--accent` row's **Today** cell reads `5.12:1`. That is `#e68900` measured
against the *proposed* card `#2e2e31`, not against today's card `#1c2127`, where
it is `6.13:1` — every other cell in that column is measured against today's
card. The rationale below the table is right and the conclusion is unchanged
(lifting the orange takes it to `6.47:1`); only the cell sits in the wrong
column. Every other value in §5.1 was checked and holds.

## After the gate

Nothing here is a component to lift into `src/`. It is a shape to build against.
Stage 1 writes the real tokens and the real primitives with tests, against
`docs/DESIGN_SYSTEM.md`, and pins the overlay first.

`demo.css` is the design system written out and is the file to read first: the
tokens, the type scale, the spacing rhythm, the elevation rule (background
groups; a border means the thing accepts input), the concentric radius rule, and
the three layout primitives — `column`, `pane`, `solo`. Two things it learned
that the plan's §5 does not say, and that belong in `DESIGN_SYSTEM.md`:

1. `--fg-muted` is 4.71:1 on the card but **3.94:1 on the elevated surface**, so
   it is confined to the card plane. That is why rows carrying muted text do not
   change background on hover — which is also the fix for §6 P7.
2. A list and its detail are **one surface**, not two cards. Two cards side by
   side state no relationship between themselves.

See the plan's §12 for the full handover and §10 for the open problems this
prototype surfaced — chief among them how many MCP servers WordScript needs and
who may call them.
