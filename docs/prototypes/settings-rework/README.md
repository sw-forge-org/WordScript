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

No build step, no dependencies, no network access. Four files: `index.html`,
`demo.css`, `demo.js`, and `wordmark.png` — a copy of the shipped
`assets/logos/wordscipt-logo-transparent.png`, kept here so the folder serves
standalone rather than reaching up three levels into the repo.

## What is in it

20 screens, reachable from the **Screen** picker in the rig or from the
navigation inside the mock window.

| Group | Screens |
| --- | --- |
| System | Design System |
| Workspace | Home · History · Profiles · Notes · Upload · Chat · Integrations |
| Settings | General · Hotkeys · Speech-to-Text · Language Models · Agents · Delivery & Insert · Privacy & Data · Account & Sync · Diagnostics · About & Updates |
| Previews | Onboarding · Live preview & commit · *(Agents, Account & Sync, Notes, Upload, Chat and Integrations are previews too, and live in the group they belong to)* |

That is the plan's 7 workspace views and its settings sections — ten, after
Account & Sync was added — plus 8 previews. Six previews are counted twice
because they *are* the workspace or settings screen, which is the point: a
preview is not a separate place.

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
| **Copy** — Today / Budget | `C` | Swaps prose between the shipped strings and the §5.2 budget |
| **Density** — Tight / Standard / Roomy | `1` `2` `3` | The three calibration variants |
| **Screen** | — | Jumps anywhere without a reload |

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
reduction, there is no shipped string to reduce: Integrations, Agents,
Onboarding and Live preview & commit do not exist yet, and Home, History, Notes,
Chat, Privacy & Data and About are written to budget from the start.

## The word meter

Two rows, top right. Both totals are computed on every render from the same
document, so the numbers do not move when you flip the switch — only the
emphasis does.

| | Today | Budget | |
| --- | ---: | ---: | ---: |
| 19 product screens | 2317 | 1917 | −17 % |
| the 10 screens carrying shipped copy | 1454 | 1054 | −28 % |

Per screen, largest first: Language Models −49 %, Upload −42 %, General −38 %,
Diagnostics −29 %, Hotkeys −28 %, Profiles −25 %, Speech-to-Text −21 %,
Account & Sync −18 %, Delivery & Insert −14 %, Home −6 %.

**The total moved between the second pass and the third, and up is not worse.**
The third pass added product — the second MCP surface, the CLI, the profile
Defaults tab, the driver and registration states the surface was not showing —
so both columns grew. The reduction that matters is the second row: the screens
that reproduce a shipped string still shed more than a quarter of it. Screens
with nothing shipped to compare against (Integrations, Agents, Onboarding, Live
preview & commit) are now written to budget on **both** sides, so they no longer
contribute a reduction they cannot have earned.

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
