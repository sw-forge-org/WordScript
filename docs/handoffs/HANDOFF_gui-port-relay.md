# WordScript — GUI port relay

Opened 2026-08-04. **Active — Leg 6 is CLOSED. Every transcript is a file,
every drawn door on History and Privacy & Data acts, the retry runs the mode its
record ran, and the decision inbox receives the one question the runtime can
ask. Leg 7 — the five missing SURFACES, which are design rather than runtime —
is next.**

Repo: `/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
Work happens on `main`. There is no feature branch; `gui-rework-second-pass` was
consolidated into `main` and deleted on 2026-08-04.

## What this document is

The settings rework moves from prototype to product as a **relay**. Each leg is
one agent session. A leg reads this file, does its leg completely, validates,
commits and pushes to `main`, appends its record to the leg log at the bottom,
and writes the prompt for the next leg into this file before it stops.

This file is the chain. The prototype is the design, the plan is the derivation,
and this is the order in which they become product.

## The two decisions this relay rests on

- **[ADR 0054](../decisions/0054-the-rework-lands-as-an-overwrite-because-there-is-nobody-to-migrate.md)
  — the port overwrites, it does not migrate.** `0.2.2-alpha` has no users, so
  no alias map is built, the old and new surfaces never coexist, and a replaced
  area is deleted in the commit that replaces it. The plan's §4.3 rule 6 is
  withdrawn. The one exception is `src/lib/settingsAnchors.ts`, which is a
  runtime contract with a native caller and stays resolvable.
- **[ADR 0055](../decisions/0055-the-gallery-is-where-the-port-is-judged-and-it-is-one-route.md)
  — the gallery is the acceptance surface.** One design-time route `/gallery`,
  five sections, folding in `/overlay-gallery` and `/component-lab`. **A screen
  is *ported* when it stands in the gallery and *shipped* when it is wired.**
  That split is what lets a 25-screen design land 1:1 against a runtime that
  cannot yet answer half of it.

## What the library is, and what the gallery is

Stated by the owner on 2026-08-04 and written down here because the distinction
decides where every future component goes.

**The library is `src/components/shell/` plus `src/styles/shell.css`.** That is
the productive component library and it is the point of the whole exercise: it
is where the design components live, and it is what the product renders. It is
built by taking the demo GUI's structure across **1:1** — the same components,
the same grammar, the same states, the same copy.

**The gallery is where that library is displayed and judged. It is not where it
lives.** ADR 0055 is explicit: *the gallery imports the product's components and
never copies them.* A screen in the gallery and the same screen in the product
are one implementation with two sets of props. The moment a component exists
only inside `src/windows/gallery/`, the gallery has become a second product and
the thing it was built to prevent — a component that is correct in the gallery
and wrong in the app — is already true.

So both halves are load-bearing and neither substitutes for the other:

| | Lives in | Is | Is not |
| --- | --- | --- | --- |
| The library | `src/components/shell/`, `src/styles/shell.css` | The design components, ported 1:1 from the demo GUI | A place screens are assembled |
| The gallery | `src/windows/gallery/` | Every component in every state, and every screen at the prototype's fidelity | A place components are defined |

**Three things are deliberately not carried across 1:1**, and each is already a
decision rather than a liberty:

1. **The prototype's rig.** `demo.css` §2 — the top strip with the Surface,
   Theme, Copy, Density and Screen switches — is the instrument the prototype is
   viewed through and is deliberately outside its own design system. It is not
   part of the product. The gallery's scheme switch is the one control that
   survives, because three schemes have to be judged in one place.
2. **The light scheme's `--fg-muted`.** The prototype's `#7d766d` measures
   4.48:1 on the white card and misses AA; the product carries `#7a736a`
   (ADR 0056). Where the two now differ by one hex, that record says which is
   right.
3. **Measured rather than printed contrast.** The prototype hardcodes its
   contrast figures and prints the dark ladder's numbers on both sides of its
   theme switch, which is how (2) went unnoticed for a pass. Foundations
   computes them from the live tokens instead.

Everything else is 1:1, and where the prototype and this repo's shipped surface
disagree, the prototype wins.

**THE PROTOTYPE IS NOW PROVENANCE — flipped 2026-08-04 by Leg 2d**
([ADR 0057](../decisions/0057-the-prototype-has-an-expiry-date-and-the-gallery-has-two-halves.md)).
All 25 screens stand, so the flip the ADR scheduled has happened: the prototype
is read-only, ADR 0056 has already overtaken it by one hex, every further leg
widens that gap, and **the gallery is the source**. A disagreement with the
prototype is either an ADR or a bug in the gallery — never a reason to change
the gallery back. Read `demo.js` and `demo.css` for the derivations their
comments carry; do not read them for what the product should look like.
The gallery's Foundations, Components, Motion and Overlay are permanent; its
**Screens section is scaffolding** and retires per screen in the commit that
wires it, during Leg 4. The steady state is the library, the product, and a
gallery of four sections.

## Rules every leg obeys

1. **Commit and push to `main`.** No branch, no PR. Push only when the leg is
   green.
2. **Never `--no-verify`.** The Husky hooks are the secret gate.
3. **ADRs are append-only.** New file, never an edit to an existing one. Next
   free number is **0060**; update `docs/decisions/README.md` when you file one.
4. **The prototype is read-only from here on** (ADR 0055). It is the reference
   the gallery is diffed against. If you ever must edit `demo.css` or `demo.js`,
   use **exact-match string replacement only** — never line numbers, never a
   computed byte range. On 2026-08-03 a rewrite by computed index destroyed
   about 1350 lines and was recovered only from a Claude Code file-history
   snapshot.
4b. **EXPIRED 2026-08-04 with Leg 2d, and kept here as the record of why it existed.**
   ~~The prototype is the UI source of truth, and you read it per screen.~~
   Every screen is ported, so there is no screen left to read it for, and ADR
   0057's flip has happened: **the gallery is the source**. Read the prototype
   for WHY a screen is shaped the way it is — its comments carry derivations
   nothing else does — never for what the product should look like. What the
   rule said, while it bound:
   Added 2026-08-04 by the owner, against Leg 1's own output. Before you build a
   screen or a section, find its builder in `demo.js` — `grep -n "SCREENS\.<id>"`
   — read it whole, and read the rules it uses in `demo.css`. Do not reconstruct
   a screen from what `DESIGN_SYSTEM.md` implies. The design is already made;
   rebuilding it from its description silently drops the parts that were decided
   on purpose, and the loss is invisible until the two are put side by side.
   Leg 1 did exactly this in one place and it was caught in one glance — see its
   record below.
5. **The overlay is out of scope.** No token, size or rule in `overlay*.css` or
   `OverlayPill.tsx` changes. Reading it in order to draw it is allowed and is
   what the prototype does; frost explicitly excludes it (ADR 0051).
6. **`src-tauri/` is not touched in Legs 1–4.** The runtime contract work is
   Leg 5 and is decided from what Leg 4 finds, not guessed at in front of it.
7. **Never render fake readiness on a product surface.** A gallery screen
   asserts nothing and may carry sample data; the same screen on a product
   surface may not imply a state the runtime did not reach. A preview carries
   its `PreviewBanner`.
8. **Every leg ends green:** `npm test` and `npm run build`. A leg that touches
   native or the shell also runs `cd src-tauri && cargo test`. Anything
   shell-, window- or Tauri-bound is checked in the native host, not in a
   browser preview.
9. **Append your record to the leg log and write the next prompt** before you
   stop. A leg that ends without the next prompt has broken the chain.

## The map

| Leg | What | Done when |
| --- | --- | --- |
| **1** | Foundations, primitives, gallery shell | `/gallery` renders Foundations and Components in three schemes; the eight primitives exist with tests; dead code gone |
| **2a** | The library, and the gallery's own pages re-ported | *Done.* The controls of `demo.css` §6 and the shell of §3–§4 are in `components/shell/`; Foundations, Components, Motion and `GalleryWindow` are read out of `SCREENS.ds` |
| **2b** | Ten of the remaining 24 screens, and the library they needed | *Done.* Eleven of 25 stand in `/gallery` → Screens, each measured exact; the port's check is committed as `npm run port:diff` |
| **2c** | Four screens, and the check taught to reach a screen's other states | *Done.* Fifteen of 25 stand, each measured exact |
| **2d** | The last 10 screens | *Done.* All 25 stand in `/gallery` → Screens at the prototype's fidelity, on the real components, each measured exact in every state |
| **3** | The shell overwrite | *Done.* One window; settings is a sheet over the workspace at its own scale (§11.22); four views and ten sections replace the 14 flat areas; `Cmd+,`; the pre-port shell and every replaced area deleted |
| **4a** | The interaction model the demo GUI never settled | *Done.* Five ADRs (0060–0064) and three roadmap entries; no code, and the six are still mounted nowhere. Five surfaces got a lifecycle; live subtitles got a candidate entry and stays undecided on purpose. §2.6 |
| **4b** | The seam, P1, P2, the rebuild lab, and the first four sections | *Done.* `WorkspaceRuntime` is the seam and a wired screen's `runtime` prop is REQUIRED, so ADR 0057 is enforced by the compiler; About, Diagnostics (and its pop-out), General and Delivery & Insert read the runtime; 21 gallery entries left |
| **4c** | The remaining six wireable sections | Hotkeys, History, Profiles, AI Models wired; Home and Privacy & Data wired in part and still saying so. Context, Notes & Meetings, Agents and Integrations keep their banners — they are V2 or Phase 8 |
| **5** | Runtime contracts | *Done.* The seventh `ProcessingMode` with its own prompt module (ADR 0041, 0071, 0072, 0073), `analyze_communication_style` over IPC, and `AppConfig.color_scheme`. Three §2.5 entries closed, three added. The native-host check is owed |
| **6** | Runtime contracts, the second pass | *Done.* The Markdown transcript store with model-written filenames (ADR 0074, 0077), the reveal command on three surfaces, the retry routed by mode through one shared dispatch (ADR 0075), `core::backup`'s export/import/reset, Home's decision inbox (ADR 0076), and §15.3's native half. History and Privacy & Data are fully wired and left the gallery |
| **7** | The five missing SURFACES | Add and Edit for replacements and snippets, New profile's rename, and where an `analyze_text_rules` answer goes. The gallery grows them first (ADR 0057) |
| **8** | Documentation and drift | DESIGN_SYSTEM, STATUS, ROADMAP, SPEC, README, CHANGELOG, `spec-sync` |

Legs 2 and 4 are large and may split into sub-legs (2a, 2b, …). A leg that
splits says so in its record and writes the prompt for the next sub-leg.

## Leg 2 — the active leg, in full

Plan reference: `docs/SETTINGS_REWORK_PLAN.md` §8 Stage 5 brought forward by
§16.3, read with §7 (what is a preview and what is not) and §11.15 (the one
withdrawn screen).

**Leg 2 has two halves and the first one is a repair.** Leg 1 ported the design
system into the library correctly — the tokens, the grammar and the eight
primitives are read out of `demo.css` line for line — and then displayed it in
four gallery files it wrote from scratch. The owner caught it in one glance on
2026-08-04.

**The gallery is not the mistake and is not up for removal.** It is the
acceptance surface (ADR 0055) and the library needs a display surface. What is
wrong is only its *content*: a gallery that shows a system nobody drew cannot be
diffed against the prototype it exists to be diffed against. So those four files
get their content taken across 1:1, exactly like every screen in §2.2.

### 2.1 Re-port the gallery's own pages — do this first

`SCREENS.ds` in `demo.js` **is** the Design System screen, and it is 350 lines
of decided content: sections, copy, tables, state lists. Port it.

| File | Port from |
| --- | --- |
| `src/windows/gallery/Foundations.tsx` | `SCREENS.ds`, the sections up to and including *Radius* — `.ramp` with its L\* column, the `.spec` contrast table, `.type-row`, `.rhythm`, the *Elevation* rows, the *Rules this pass added* card, the *Radius* rows. Keep Leg 1's one addition: contrast and L\* are **measured** at render time from the live tokens, never printed as literals (ADR 0056 is the record of what happens otherwise) |
| `src/windows/gallery/Components.tsx` | `SCREENS.ds`'s *Components* section — five cards, *Buttons* · *Inputs* · *Level* · *Status* · *New in this plan* — plus the *Layout primitives* and *Motion* sections that follow it. Every state in each list, and the copy as written |
| `src/windows/gallery/Motion.tsx` | the matrix presentation the owner screenshotted: a card per mode with a name, its type (`vu` / `frames` / `pattern`) and a description, under a *Frame clock* header carrying `fps · loop · autoplay`. What is there now is the old `/component-lab` row of unlabelled swatches |
| `src/windows/GalleryWindow.tsx` | the prototype's `.rig` plus `.nav` grammar. The scheme switch stays where Leg 1 put it |

**Grow the library, do not grow the gallery.** The prototype's component cards
need controls the kit does not carry yet — Leg 1 built the eight primitives
§5.3 names and `.btn` is not one of them. Build it in `components/shell/`,
ported from `demo.css`'s `.btn`: `data-v="primary"` with its three-value
material, `ghost`, `danger`, `disabled`, `data-busy`. Same for `.chip` and
`.ibtn` where a section needs them. A gallery that draws a button inline is the
same defect one level down, and it is the defect that makes the gallery a second
product rather than the library's display surface.

### 2.2 Every screen into `/gallery` → Screens

25 entries, listed in `src/windows/gallery/Screens.tsx` and in the prototype's
README. Each one 1:1 against the prototype: spacing, radii, states and copy.

**The method, and it is the rule this leg is judged on.** For each screen:

1. `grep -n "SCREENS\.<id>" docs/prototypes/settings-rework/demo.js`, then read
   the whole builder. It carries the structure, the copy and the sample data.
2. Read the rules it uses in `demo.css`. If a rule is missing from
   `src/styles/shell.css`, add it there — never at the call site.
3. Serve the prototype and put the two side by side:
   `python3 -m http.server 8791 --directory docs/prototypes/settings-rework`.
4. Where the prototype and this repo's shipped surface disagree, the prototype
   wins. That is the point of the port.

**Do not reconstruct a screen from `DESIGN_SYSTEM.md`.** It describes the
system; it is not the design. This is rule 4b, it is the reason Leg 2 starts
with a repair, and it is the single most likely way this leg fails.

Order suggestion, not a requirement: the Design System screen is already covered
by §2.1, so start with the four workspace views (Home · History · Profiles ·
Context), then the eleven settings sections, then the previews. A leg that runs
long splits into 2a/2b and says so in its record.

### 2.3 What a screen in the gallery may and may not do

- **It carries sample data and asserts nothing** (ADR 0055). That is what makes
  it compatible with *never render fake readiness*: the fake state is the same
  screen on a product surface implying the runtime reached something it did not.
- **Every preview screen carries its `PreviewBanner`**, and the withdrawn one
  carries the withdrawn variant. `Live preview & commit` is drawn and is
  explicitly not a target shape (§11.15) — draw it with the stop on it, or the
  next reader builds Phase 3 out of it.
- **No screen imports a Tauri API.** The gallery route uses none, and its test
  asserts that by mocking `invoke` to throw.
- **A screen never copies a component.** If a screen needs something the shell
  kit does not have, the shell kit grows it.
- **No screen carries an inline spacing value.** If one seems to need it, the
  primitive is missing a rule — that is ADR 0052's whole subject.

### 2.4 The one check Leg 1 could not finish

**Look at the frost pair in the native host, before you build on it.** It is at
the foot of `/gallery` → Foundations and it carries a button that takes the blur
off the layer behind. If the ground visibly sharpens when you press it, the
material is running; if nothing changes, it is not, and that is a finding rather
than a nuisance — ADR 0051 exists because the settings sheet shipped a plain
black scrim for several passes while its stylesheet asked for a blur and no
browser preview could show it. Leg 1 could not deliver a pointer event to the
window under this compositor. A human with a mouse can.

### 2.5 What Leg 2 must write down

- Every place where a screen could not be drawn on the real components without
  inventing a control. That list is what Leg 4 wires and what Leg 5 costs.
- Every place where the prototype and the shipped surface disagree on a **fact**
  rather than on presentation — a label the runtime does not use, a status that
  does not exist. §11.11 found three of those; a 25-screen port will find more.
- A new ADR only if a design decision departs from the prototype. Never an edit
  to an existing record. The next free number is **0059**; update
  `docs/decisions/README.md` when you file one.
- `CHANGELOG.md` under `[Unreleased]`, your record in the leg log, and the
  **Leg 3 prompt**.
- **Flip the prototype's status** (ADR 0057). When the last screen stands in the
  gallery, say so in this document and in `SETTINGS_REWORK_PLAN.md` §0, which
  still calls the prototype mandatory reading with no horizon. Rule 4b applies
  to screens not yet ported and expires with them.

### 2.6 What the demo GUI did NOT settle, and it is not the same gap as §2.5

Raised by the owner on 2026-08-05, against the finished port, and it is a
correction to how §2.5 was framed rather than an addition to it.

**§2.5 lists FACTS the runtime does not have** — a field, a status, a
measurement. That list is complete and it is what Legs 4 and 5 cost.

**This lists BEHAVIOUR nobody has decided.** The prototype is static HTML: it
draws states, and drawing a state is not deciding how you arrive at it, what
keeps it, or what takes it away. For most of the 25 screens that gap does not
exist — a settings section is entered from a nav row and left by leaving it,
and the shell answers it once for all of them. **For six surfaces it does
exist, because none of them is a section in a window**: they are separate
windows, an overlay tab, a strip over somebody else's video, and a flow that
runs before the product does.

A screen with a decided layout and an undecided lifecycle is the one thing that
looks finished and is not. It cannot be caught by measuring — the port measures
exact against a prototype that is equally silent about it.

| Surface | Drawn | Undecided |
| --- | --- | --- |
| **Onboarding** | Seven steps, the rail, the foot, the preflights | **When it runs.** First launch only, or re-runnable, and from where. What a skipped setup leaves behind and whether skipping is offered at all. What quitting at step 4 does to steps 1–3. Which window it is — its own, or the main one before the workspace exists |
| **Meeting capture** | The HUD in three states, the bar, the copilot lane | **How a capture starts and what ends it.** The meeting hotkey is drawn `not set`; call detection is drawn as an *Open decision* with three answers; the audio afterwards is drawn as an *Open decision*. What the HUD does when the meeting ends is prose — "it stops being the way you look at it" — not a transition. §10.4 is the window question and is only part of this |
| **Live subtitles** | The caption strip on three grounds, the echo under the pill | **What turns either on, and where the placement lives.** A strip "you place once" needs a stored position and a per-source or global answer. The echo is a settings toggle, and what makes it appear under the pill for THIS dictation and not that one is undrawn |
| **Translation** | The window, both tabs, the per-language routing | **How the window is opened.** No entry point for it exists anywhere in the 25 screens. Whether it is one window or one per conversation, what a swapped pair does to a running conversation, and where the two device routings are persisted |
| **Agent overlay** | The pill, the tab, the window, the notification | **The state machine between the three surfaces.** That the tab appears and never retracts is stated; what fires the notification INSTEAD of the tab is only implied by "if the window is closed". What a dictation starting while an agent waits does to the tab is drawn as a settings row, not as a transition |
| **Handoff** | The card, both keys, the timeout, what crosses | **What detects the effect verb, and where it runs.** The card is the most complete of the six — Rust owns the key grab (ADR 0006) and Enter/Escape/timeout are all drawn. What is undecided is the stage that produces the offer at all, and how its refusal rate is measured, which is the card's entire budget |

**Why this is its own leg (4a) and not part of Leg 4.** Wiring is "make this
control read the runtime truthfully". These are product decisions with an owner
in the loop — several of them are already marked *Open decision* on the drawn
surface, which is the prototype admitting it. Deciding them inside a wiring leg
means deciding them by implementing one answer, which is how a placeholder
becomes the product.

**What 4a produces:** an ADR per surface where the answer is a decision, a
roadmap entry where the answer is "not yet", and nothing else. No code. ~~Three
of the six (translation, meeting capture, subtitles) are also **not on the
roadmap at all** — §7 records translation and meeting capture as candidates
needing their own entry before anything is built, and that is still true.~~

**CORRECTED 2026-08-05 by Leg 4a, and it was wrong in both halves.** Meeting
capture has been a roadmap **candidate with a gate since 2026-08-03**, added the
same day §7's sentence was written; the sentence was repeated into §2.6 and into
the Leg 4a prompt without being re-checked. And the translation **mode** has
been ADR 0041 and Phase 4 since the same day, so the thing with no roadmap home
was the translation *window*, not translation. Two of the six were homeless, not
three: the window and live subtitles. Both have a candidate entry now.

**Leg 3 did not decide any of this, and paid its debt on 2026-08-05.** It owned
the main window and five of the six live outside it, so what it owed was
narrower: **where each entry point would go**, recorded as a list of holes
rather than filled with invented controls. That list is
`ENTRY_POINT_HOLES` in `src/windows/workspace/ia.tsx` — six entries, each naming
the surface, the screen it is drawn on, where its door would go and what is
undecided about its lifecycle. It is data rather than prose because Leg 4a's
first act is to read it, and `ia.test.tsx` asserts that all six are still named
and that **none of the six is mounted**. A nav row that opens nothing is the
fake affordance rule 7 forbids — the same reason the gallery's sidebar has no
search box (Leg 2a, finding 10), and the same reason the workspace mounts
neither a search field nor Help.

Onboarding was the one expected to bite, because it is a full-window flow and
Leg 3 owned the windows. It did not: the workspace is what the window renders,
and putting a flow ahead of it is a routing decision in `App.tsx` or in the
window's own first branch, neither of which anything Leg 3 built depends on. The
question is recorded and unanswered.

**ANSWERED 2026-08-05 BY LEG 4a. This table is now history, and the answers are
ADRs.** Read the ADR before the row: the row states what was undecided, and the
ADR states what was decided.

| Surface | Answer | Leg 4 does |
| --- | --- | --- |
| **Onboarding** | [ADR 0060](../decisions/0060-onboarding-runs-when-the-runtime-cannot-answer-and-it-is-re-runnable.md) — a routing branch in this window; auto-runs on no usable connection until completed or closed; re-runnable from `Settings → General`; the resume point is **derived** from the first unsatisfied step, never stored | nothing — Phase 6 |
| **Meeting capture** | [ADR 0063](../decisions/0063-a-meeting-has-four-ways-in-one-of-them-watches-the-microphone-and-only-a-press-ends-it.md) — four ways in; detection watches which process holds the **microphone**; the prompt is ADR 0043's window; only an explicit stop ends it | **skip** — blocked on system audio |
| **Live subtitles** | Roadmap candidate. The echo belongs to the **profile**; the strip reuses the overlay's placement grammar per display. What turns captions on is **still undecided** and cannot honestly be decided before the capture exists | **skip** — blocked on system audio and streaming recognition |
| **Translation** | [ADR 0064](../decisions/0064-the-translation-window-is-a-view-with-a-pop-out-and-a-conversation-is-kept-only-if-you-say-so.md) — a workspace **view** whose pop-out is the drawn window; a conversation is a context object only if the session opts in; one live conversation at a time | **skip** — candidate, not scheduled |
| **Agent overlay** | [ADR 0061](../decisions/0061-the-tab-is-a-state-the-notification-is-the-question-and-neither-replaces-the-other.md) — the tab is a state, the notification is the question, both may stand at once; dismissing is *not now*, never *no* | nothing — Phase 8 |
| **Handoff** | [ADR 0062](../decisions/0062-the-effect-verb-stage-runs-before-the-mode-router-and-a-refusal-is-counted-against-the-verb-that-caused-it.md) — the stage is Rust, lexical first, before the mode router, skipped with no desk; refusals are counted **per verb** and shown on Diagnostics | nothing — Phase 8 |

**`ENTRY_POINT_HOLES` in `ia.tsx` still reads as though nothing is decided, and
that is deliberate.** Leg 4a wrote no code, including no comment. Whoever mounts
a surface updates its entry in the commit that mounts it; until then the holes
are correct about the product and stale about the paperwork, and the table above
is the reconciliation.

### Leg 2 is done when

**ALL FIVE ARE CLOSED as of 2026-08-04. Leg 2 is done.** Leg 2a closed the
first, fourth and fifth; Leg 2b closed the third and got the second to eleven of
twenty-five; Leg 2c took it to fifteen; Leg 2d took it to twenty-five.

- ✅ The four files of §2.1 are ported rather than composed, and a reader with the
  prototype open beside `/gallery` cannot name a section that was invented.
- ✅ All 25 screens stand in `/gallery` → Screens at the prototype's fidelity, on
  the components in `components/shell/`, **each measured structural 0 / style 0
  in every state it has** — 40 measurements across 25 screens.
- ✅ `npm test` and `npm run build` are green, and the new screens carry tests.
  *335 frontend tests after 2d, `cargo test` 623, both builds green.*
- ✅ The result was looked at in the native host, not only in a browser. **The
  frost pair is settled and the material runs** — see Leg 2a's record. Leg 2b
  looked at Home there, 2c at AI Models, 2d at Context. *The agent overlay is
  owed — see Leg 2d's finding 5.*
- ✅ It is committed and pushed to `main`, and the next prompt is in this file.

## Read before starting Leg 2

| Read | For |
| --- | --- |
| `CLAUDE.md` (= `AGENTS.md`) | The repo's own rules; they outrank any default |
| `docs/prototypes/settings-rework/demo.js` | **The screens themselves.** Read the builder for each screen you port, whole |
| `docs/prototypes/settings-rework/demo.css` | The rules those builders use |
| `docs/prototypes/settings-rework/README.md` | The pass log, what is real and what is sample, the known limits |
| `docs/DESIGN_SYSTEM.md` | What the product now claims — as a check on your port, never as its source |
| `src/styles/shell.css` and `src/components/shell/` | What Leg 1 ported. Grow this, do not work around it |
| `docs/SETTINGS_REWORK_PLAN.md` §7, §11.11, §11.15, §11.17, §11.20, §11.28 | Previews, invented vocabulary, the withdrawn screen, and the four rules that belong in primitives |
| ADR 0048, 0051, 0052, 0053, 0054, 0055, 0056, 0057, 0058 | Light mode, frost, the row grammar, the level readout, the two delivery decisions, the measured-contrast rule, the prototype's expiry, and why a gallery draws a live instrument at rest |
| `docs/REFERENCE.md` | Overlay sizes and CSS invariants, before drawing anything near the overlay |

Serve the prototype for comparison:
`python3 -m http.server 8791 --directory docs/prototypes/settings-rework`
## Leg log

| Leg | Date | Agent | Commit | Outcome |
| --- | --- | --- | --- | --- |
| 0 | 2026-08-04 | Opus 5 | `dbd83c6` | Relay opened. `gui-rework-second-pass` consolidated into `main` and deleted. ADR 0054 and 0055 filed. Baseline: 154 tests green, `/gallery` does not exist, Stage 1a and 1b unstarted apart from the `glass*` removal and the font wiring. |
| 1 | 2026-08-04 | Opus 5 | `135771f` | Dead code out, token write, eight primitives, `/gallery` shell, native-host look. 154 → 217 tests, `npm run build` green. ADR 0056 filed: the light scheme's `--fg-muted` was measured for the first time and missed AA. **The gallery's own pages were composed rather than ported — Leg 2 fixes that first.** Full account below. |
| **2a** | 2026-08-04 | Opus 5 | `438d1d4` | **§2.1 done: the four gallery pages are ported, not composed.** The controls of `demo.css` §6 and the nav/content grammar of §3–§4 are in the library — 17 new components, ~700 lines of ported CSS. 217 → 244 frontend tests, `cargo test` 623 green, `npm run build` green. Verified by computed-style diff against the running prototype, property by property, and in the native host. **The frost pair is settled: the material runs.** ADR 0058 filed. §2.2 is Leg 2b's. Full account below. |
| **2b** | 2026-08-04 | Opus 5 | `d0f4baa` | **Ten screens ported, eleven of 25 now stand, every one measured exact.** Home, History, Profiles, General, Hotkeys, Delivery & Insert, Privacy & Data, Diagnostics, About & Updates, Integrations and the withdrawn Live preview & commit. The icon set, the orb, the provider marks, the list row, the decision inbox, the pane, the connection block and the log are in the library; `src/lab/` is deleted. **The port's check is committed** as `npm run port:diff`, and it found nine library defects no single screen showed. 244 → 282 frontend tests, `cargo test` 623, both builds green. Home looked at in the native host. **The prototype's status is NOT flipped — 14 screens remain.** Full account below. |
| **2c** | 2026-08-04 | Opus 5 | `0fbddce`…`cd320f5` | **Four screens ported, fifteen of 25 now stand — and the leg SPLIT rather than overrun.** Notes & Meetings, AI Models, Onboarding and Agents, every tab and every one of onboarding's seven steps measured exact. The job list, the model badge, the downloadable model row, the onboarding rail, the desk's MCP readout and the agent thread are in the library. **The verifier can now reach a screen's other states** — `npm run port:diff models#1 onboarding#4` drives both surfaces into them — which turned up a fifth measurement false positive and a library defect Leg 2b could not have seen: the prototype's SECOND base rule, a 16 px default icon size, was never ported. 282 → 298 frontend tests, `cargo test` 623, both builds green. AI Models and its job list looked at in the native host. **The prototype's status is NOT flipped — 10 screens remain.** Full account below. |
| **3** | 2026-08-05 | Opus 5 | `8f9077e` | **The shell is overwritten. The product is ONE WINDOW.** A workspace with four views, settings as a modal sheet over it at its own scale, `Cmd+,` to open and Escape to close. Fourteen flat areas deleted in the commit that replaced them; `FormCard`, `FormRow`, `Sidebar` and `StatTiles` deleted with their last caller; the 25 screens moved out of the gallery into `src/screens/` so the product mounts what the gallery displays. **All 33 `port:diff` measurements are structural 0 | style 0 after the shell change** — the regression check earned its keep. 289 frontend tests (335 minus the 67 that belonged to the deleted areas, plus 21 new), `cargo test` 623, both builds green. The workspace, the sheet and the agent overlay all looked at in the native host — **Leg 2d's three owed agent-overlay checks all pass.** ADR 0059 filed: the gallery gets a chord. **One live defect found and fixed: the overlay's deep link had been resolving to nothing.** Full account below.
| **4a** | 2026-08-05 | Opus 5 | `67bd0f9` | **Six drawn surfaces got a lifecycle, and no code was written.** Five ADRs — 0060 onboarding, 0061 the agent overlay, 0062 the handoff, 0063 meeting capture, 0064 the translation window — plus three roadmap entries: meeting capture's gate 1 closed, and two new candidates (live subtitles, the live-translation window) for the two surfaces that genuinely had no roadmap home. **Live subtitles is deliberately the one without an ADR**: what turns captions on cannot be decided honestly before the capture exists, and saying so is the answer. The owner decided three of them; the rest are derived and each ADR says which it was. **Two things were nearly decided wrong and the drawn surface caught both** — the notification does not retract when a dictation starts, it offsets above the pill, and §7's "meeting capture is not on the roadmap" has been false since the day it was written. 289 frontend tests, `cargo test` 623, `npm run build` green — untouched, as a doc leg should leave them. Full account below. |
| **4b** | 2026-08-10 | Opus 5 | `a8dc617`…`88bf75a` | **The seam is open, P1 and P2 are fixed on it, the rebuild lab is back, and four of fourteen sections are wired — so the leg SPLIT rather than overrun.** About & Updates, Diagnostics (with its pop-out), General and Delivery & Insert read the runtime; the other ten keep their banners and four of those can never lose one. **ADR 0057 is mechanical now**: a wired screen takes a REQUIRED `runtime` prop, so its gallery entry stops compiling, and `registry.test.tsx` asserts the set that left the registry EQUALS the set the product mounts without a banner — both directions fail. `RebuildLabTab`'s ~1000 lines came back onto the drawing, and cost less than budgeted because the drawing had been read off the surface it replaces. 289 → 316 frontend tests, `cargo test` 623, both builds green. Gallery 25 → 21 entries; `port:diff` 33 → 29 measurements, **every one structural 0 \| style 0**. Full account below. |
| **6** | 2026-08-10 | Opus 5 | `6608131`…`6ee471b` | **The drawn promise turned out to be a folder, so the folder exists — and the retry stopped running the wrong job.** `core::transcript_store` writes every transcript as a Markdown file whose NAME the chat model writes (ADR 0074, ADR 0077), from the one funnel every history record passes through; delete, clear and retention take the file with the entry, and the runtime removes only paths an entry named. `Show transcripts in file manager` acts on all three surfaces. The mode dispatch left the pipeline's closure for `core::mode_router::apply_mode_transform`, so a retried Agent, Prompt Enhance or Translate record re-runs its own mode (ADR 0075) — a defect that had been live for two of them since they shipped. `core::backup` answers Full export, Full import and Reset all settings, both destructive ones snapshotting first. Home's decision inbox receives a fallen-back delivery and nothing else (ADR 0076). §15.3's native half is closed for the shell. **History and Privacy & Data are fully wired and left the gallery**; `port:diff` 28 → 26 measurements, 25 at structural 0 \| style 0. 427 → 437 frontend tests, `cargo test` 645 → 670, both builds green. **Four ADRs, and two of them were the owner's corrections mid-leg.** Full account below. |
| **2d** | 2026-08-04 | Opus 5 | `ae5af81`… | **The last ten screens ported. ALL 25 STAND, every one measured exact in every state it has.** Context with its four note tabs and both windows over it, the intake's three ways in, Actions & templates, meeting capture, the handoff, live subtitles, translation, client conversations and the agent overlay. The note grammar, the five-member window family, the intake, the shipped overlay pill drawn at its real geometry, the caption strip and the echo, the translation window and the client record are in the library. Three library defects no earlier screen could show: the wide layout had no measure, the 16 px icon base rule was shrinking the dot-matrix readout to a square, and `Card` now owns the head/rows/body/foot order that three legs had got wrong at a call site. 298 → 335 frontend tests, `cargo test` 623, both builds green. Context looked at in the native host; the agent overlay is owed there. **The prototype's status IS flipped — Leg 2 is closed.** Full account below. |

### Leg 1 — what landed, and the one thing it got wrong

**Ported 1:1 from `demo.css`, read rather than reconstructed.** The whole token
block — the `[data-palette="after"]` palette with `--bg-inset`, the light ladder,
the radius ladder, `--edge-light` and the four-step elevation ladder, the frost
set, the type scale with its optical-size trio per step, the 4 px rhythm, and
the structure tokens (`--pad-card`, `--row-py`, `--gap-row`, `--gap-block`,
`--content-max`, `--nav-w`, `--nav-row-h`) at the accepted Standard values. And
the shell grammar in the new `src/styles/shell.css`: the card and its inset
guard, the row stack, the lane rows with the 16/2/8 radio, the sub-tab bar with
its `"|"` rule, the banner and its withdrawn variant, the empty state, the
toolbar and its search, the badge, the dot, the scope tag, the section header,
the card footer, the frost pair and the two-layer focus ring. Those are
line-for-line from the prototype with the class names prefixed `ws-`.

**Composed instead of ported, and this is the defect.** Raised by the owner on
2026-08-04 against this leg's own output, from two screenshots put side by side:
the gallery's Motion section against the prototype's own matrix section. His
verdict, and it is right: *the design system already exists 1:1, and building
from memory as an outsider instead of taking the demo GUI as the UI source of
truth produces something that partly has nothing to do with it.*

Concretely, four files display the system and none of them was read out of
`demo.js`:

| File | What the prototype already has |
| --- | --- |
| `windows/gallery/Foundations.tsx` | `SCREENS.ds` — the whole Design System screen, with its own sections, copy, `.ramp`, the `.spec` contrast table, `.type-row`, `.rhythm`, the *Rules this pass added* card, the radius rows and the motion table |
| `windows/gallery/Components.tsx` | the Components section inside `SCREENS.ds` — five cards (*Buttons*, *Inputs*, *Level*, *Status*, *New in this plan*), each with an exact state list and exact copy |
| `windows/gallery/Motion.tsx` | the richer matrix presentation: a card per mode carrying a name, its type (`vu` / `frames` / `pattern`) and a description, under a *Frame clock* header with `fps · loop · autoplay`. What is there now is the thin `/component-lab` row of unlabelled swatches |
| `windows/GalleryWindow.tsx` | the prototype's `.rig` and `.nav` grammar |

The distinction that matters for the next leg: **the system is ported, the pages
that show it are not.** Nothing in `globals.css` or `shell.css` needs revisiting
for this; the four files above do.

**What the native-host look settled.** Recorded in full under §1.5's obligation:

- `npm run tauri dev` **is not the toolchain's fault here.** It failed on
  `beforeDevCommand` because a pre-existing Vite server held the strict port
  1420 — a stale server from an earlier session, not a broken dev path. The plan
  records "not runnable here" as a property of the machine; the observed cause on
  2026-08-04 is a port conflict, and the next leg should free 1420 and try again
  rather than assume the production build is the only route.
- The premise check of §11.13 — **whether today's palette crushes on the panel** —
  could not be run as the plan writes it, and the reason is structural rather
  than incidental: this leg replaced the shipped tokens, so the production build
  no longer carries the old palette to look at. It is one `git stash` away for
  anyone who wants it, and §2.3's premise therefore stays **unverified on the
  panel**, exactly as it was before this leg. It is not weakened and it is not
  confirmed. Whoever wants to close it should do it before Leg 3 builds on the
  ladder, and it costs one build of `dbd83c6`.
- **The lifted ladder reads on the target panel.** All five planes separate:
  the sidebar at L\* 6.4 sits visibly below the window at 10.3, the card at 19.0
  is a distinct layer rather than a slightly-less-black rectangle, and the
  hover plane at 24.6 is legible against it. §11.13's second row — *whether the
  lifted ladder reads on that panel* — is answered, and it reads.
- **The light scheme reads on it too**, and reads as a light theme rather than
  as an inverted dark one: warm grey window, white card coming forward, sidebar
  receding below the window. Checked by defaulting the gallery to `light` for
  one build.
- **The primitives render correctly in WebKitGTK.** The lane rows with their
  icon tiles and the 16/2/8 radio, the rectangular badges, the sub-tab bar with
  its `"|"` rule, the keycaps, the provider marks, and the primary button's
  three-value material.
- **The frost pair was NOT settled, and it is the one that most needed to be.**
  ADR 0051 is explicit that a browser preview cannot show whether this material
  is running. It sits at the foot of Foundations, and no synthetic pointer event
  — click or wheel — could be delivered to the window under the running Wayland
  compositor (the app is an XWayland client and the reported X geometry does not
  match the scanout position), so the section could not be scrolled to or its
  toggle operated. **This is thirty seconds of work for a human with a mouse and
  it is still owed.** Open `/gallery` → Foundations in the native host, scroll to
  *Frost*, and press the button that takes the blur off the layer behind: if the
  panel's ground visibly sharpens, the material is running.

**Two findings worth carrying forward.**

1. **A stored contrast figure is a lie waiting to happen.** Foundations measures
   the live tokens at render time rather than printing figures, and the first
   switch to the light scheme produced the first measurement anybody had taken
   of it: `--fg-muted` at 4.48:1 on the white card, under AA. The prototype's
   own design-system screen prints the dark ladder's numbers on both sides of
   its theme switch, which is why nobody had seen it. ADR 0056.
2. **The dark ladder measures exactly what §5.1 claims.** L\* 6.4 / 7.3 / 10.3 /
   19.0 / 24.6 and 11.80:1, 7.37:1, 4.71:1, 6.47:1 on the card, computed from
   the shipped tokens rather than copied from the plan. The palette port is
   exact.

**Known exceptions to the acceptance greps.** `grep -rn "backdrop-filter" src/`
returns `src/styles/overlay.css` (three declarations). That is the Storybook-era
file §11.14 records as imported by nothing, and rule 5 puts every `overlay*.css`
out of scope, so it was left alone. `git diff --stat` shows `overlay-pill.css`
and `overlay-shell.css` untouched.

**`/gallery` has no door in the native host, and this is a gap in ADR 0055.**
Every window's URL is pinned in `src-tauri/tauri.conf.json` — `#/overlay`,
`#/settings`, `#/rebuild-lab` — and rule 6 puts `src-tauri/` out of scope until
Leg 5, so a gallery window cannot be added. The ADR's *"checkable with one `npm
run tauri build` and a walk through Foundations"* therefore does not hold as
written. Leg 1 looked at it by temporarily pointing the `/settings` route at
`GalleryWindow` in `src/App.tsx`, building, looking, and reverting — a
frontend-only instrument that touches nothing out of scope. **Do the same, and
revert it before you commit.** The permanent fix is one entry in
`tauri.conf.json` and belongs to the first leg allowed to open that file.

**Two smaller things the next leg should know.**

- `FormCard` and `FormRow` were left alone. The card grammar is ported as
  `Card` / `CardRows` / `Row` / `CardFooter` on `.ws-card`, and the pre-port pair
  is still what the thirteen shipped areas render — several of them with a
  `bodyClassName="py-4"` patch that the new grammar makes wrong. They are
  deleted with the last screen that reads them, which is Leg 3's business.
- `vitest.setup.ts` gained a `ResizeObserver` stub. jsdom has none and the Radix
  primitive behind `Toggle` measures its thumb with one, so any test that
  renders a switch threw from a layout effect. It is an environment gap, not a
  product fault.
- `src-tauri/src/core/mode_router.rs:7` cites `OverlayGallery.tsx`, which is now
  `src/windows/gallery/OverlayStates.tsx`. Out of scope to fix under rule 6 — a
  note for whichever leg opens that file.

### Leg 2a — what landed, what it found, and what it deliberately did not do

**§2.1 is done and §2.2 is not started.** The leg split because the expensive
shared half turned out to be the library, not the screens: the Design System
screen's Components section is a page of controls, and Leg 1 had built the eight
primitives §5.3 names while leaving every control they sit next to on the
pre-port kit — a shadcn Switch, a Tailwind stepper, a Radix slider. None of
those could be shown on a page whose subject is what the controls look like. So
the leg ported the controls first, which is what Leg 2b now spends rather than
earns.

**Ported into the library**, all read out of `demo.css` line for line:
`.btn` with its three-value primary material and its `ghost` / `danger` /
`disabled` / `data-busy` / `data-on` states, `.ibtn`, `.toggle`, `.seg`,
`.sel-wrap` + `.sel`, `.field`, `.stepper`, `.slider`, `.level`, `.kbd` +
`.kbd-btn`, `.chip` + `.chips`/`.chip-x`, `.note`, `.check-list`, `.strip`,
`.disc`, `.sources`, plus the Design System screen's own grammar (`.ramp`,
`.spec`, `.type-row`, `.rhythm`, `.states`, `.mx-lab`) and the navigation and
content column of §3–§4 (`.nav`, `.brand`, `.nav-search`, `.nav-group`,
`.nav-row`, `.nav-foot`, `.content`, `.content-inner`, `.view-top`,
`.view-head`). Seventeen new components in `components/shell/`, none in the
gallery.

**The card guard was carrying four of eight names.** Leg 1 wrote
`.ws-card > :not(.ws-rows):not(.ws-list):not(.ws-lane):not(.ws-scale)`; the
prototype exempts eight, and `.ws-scale` is not one of them — it was a wrapper
Leg 1 invented, because the prototype's type rows are direct children of the
card and are exempted by name. `.check-list`, `.disc`, `.owed-list`, `.legend`
and `.type-row` are in the guard now. The thirteenth prototype pass is the
record of what a missing name costs: every list item, lane row, check and
disclosure started flush against the rounded corner until it was fixed.

**How the port was verified, and it was not by eye.** Screenshots could not be
written to disk from the Playwright MCP server, so both surfaces were measured
instead: ~70 selectors, ~20 computed properties each, prototype against gallery,
diffed in the browser. Foundations, Components and Motion came out identical on
every checked property. Two classes of false positive are worth knowing about
for whoever repeats this:

- **A stale browser zoom.** The first pass reported five border widths as 0.8px
  against 1px. The tab was at 80%; re-measured at 100% both sides read 1px and
  2px. Check `devicePixelRatio` and a fresh `1px` probe element before believing
  a sub-pixel difference.
- **`inline-flex` blockifies.** Seven controls "differed" as `inline-flex` vs
  `flex`. Chromium reports `flex` for an `inline-flex` element that is itself a
  flex item — on **both** pages. Compare against what the prototype actually
  reports, never against what its stylesheet says.

**The native host, and the check Leg 1 left owed is now answered.**

- **THE FROST MATERIAL RUNS.** Rendering the pair twice — once with
  `data-frost-stack`, once without — put both states in one still and removed
  the need for any input at all. In the captured window the frosted block's
  heading and bars are unreadable and the sharp block's are crisp, same layer,
  same text. `filter: blur()` on the layer behind does in WebKitGTK what
  `backdrop-filter` cannot (ADR 0051). **This is closed. Do not re-open it.**
- **Synthetic input still cannot be delivered.** `xdotool key`, `xdotool click`
  and wheel events all left the window unchanged, exactly as Leg 1 found. A
  window resize is also clamped to the screen height, so a tall window is not a
  way around it either. What *does* work: `import -window <id>` captures the
  window's own buffer correctly, and `xdotool search --name "WordScript –
  Settings"` finds it. **If you need to see something below the fold, hoist it
  for one build — that is cheaper than fighting the compositor.**
- **`npm run tauri build` works and Leg 1's diagnosis of the dev server was
  wrong.** Leg 1 recorded the `beforeDevCommand` failure as a stale Vite server
  holding port 1420. Nothing was listening on 1420; the bind is refused by the
  **agent sandbox**, and `npm run dev` starts immediately when run outside it.
  The AppImage bundling step fails on `linuxdeploy`, which is packaging and not
  the app — `target/release/wordscript` is built and runs.
- **The gallery renders correctly in WebKitGTK**: the ported nav with its brand
  mark and icon tiles, the ramp, the spec table, the light scheme and the dark
  one. The scheme switch persists across launches through the webview's own
  storage.

**Findings for Leg 2b and beyond.**

1. **`src/lab/` is gallery-only, and after this leg nothing imports it.**
   `Orb.tsx`, `LiveWaveform.tsx`, `Keycap.tsx`, `ProviderMark.tsx` and
   `lab.css` were imported by exactly one file — the old Motion page — which is
   the defect ADR 0055 forbids in as many words: a component that exists only
   under the gallery. They are **left in place and unreferenced**, deliberately,
   because deleting them is not the fix and porting from them would be rule 4b's
   failure a second time. The orb and the provider marks are components the
   prototype has (`demo.css` §"The orb", §"Provider marks") and Leg 2b's screens
   need them: **port them from `demo.css` into `components/shell/`, then delete
   `src/lab/` in the same commit.**
2. **The prototype's type scale is missing a step its own stylesheet declares.**
   `demo.css` declares `--t-note: 13px` and reads it 28 times; `SCREENS.ds`'s
   `typeScale` array lists six steps and leaves it out. Foundations shows seven
   and says why in a comment. The page was behind the system it draws; the
   prototype is read-only so it could not be fixed there.
3. **A moving instrument is a claimed measurement** — ADR 0058. The prototype
   animates its waveform and VU meter from a synthetic envelope because it has
   no microphone; the product's components open one. Gallery screens draw them
   at rest, or hold one frame of sample data. This governs the meeting HUD, the
   agent overlay, Live subtitles and Client conversations in Leg 2b.
4. **`SegmentControl` announced itself as navigation.** Leg 1 gave it
   `role="tablist"` and `aria-selected`; the prototype's `.seg` is
   `aria-pressed` and its `.subtabs` is the tablist, and the difference is real
   — a segment sets a value, a sub-tab swaps the panel under it. Corrected, and
   `ApiModelsTab.test.tsx` updated with it. Its `size` prop is gone: the
   prototype has one segment size, and the second existed only so the gallery's
   scheme switch could be smaller than the control it displays.
5. **The `.seg` active label is `--accent`, unconditionally.** The prototype
   makes that conditional on `[data-density="standard"|"roomy"]`. The product
   ships at Standard and has no density switch — the rig does not come across —
   so the conditional collapses to the branch that is always true.
6. **`StatTiles` was NOT re-ported, on purpose.** `SCREENS.ds` never renders a
   stat tile, and porting a primitive no ported screen asks for is the same
   guess the composed gallery pages were. `.ws-stats` is in `shell.css` ready
   for Context · intake, which is the one honest use left. The component still
   renders its six pre-port callers and is marked as pre-port.
7. **The light `--accent` clears AA by 0.20.** Measured on the card: `#b45c00`
   at 4.70:1, against the dark side's 6.47:1. It passes and nothing is owed —
   but it is the thinnest margin in either ladder, and the next person to adjust
   that hex should re-read Foundations before and after.
8. **`--bg-surface` prints as `#fff` in a production build.** The token is
   declared `#ffffff`; the CSS minifier shortens it, and Foundations shows what
   `getComputedStyle` returns. Cosmetic, in the value column of one table.
9. **`DisclosureRow` is deleted.** It was pre-port, the gallery was its only
   caller, and `Disclosure` replaces it — ADR 0054's rule that a replaced
   surface goes in the commit that replaces it.
10. **The gallery's sidebar has no search box, and that is deliberate.**
    `demo.css` §3's `.nav-search` is ported and `NavSearch` is in the library
    for Leg 3, but it is not mounted here: it opens the command palette, the
    gallery has none, and a search field that opens nothing is the fake
    affordance rule 7 forbids. Mount it when the palette exists.
11. **`assets/logos/wordscipt-logo-light-transparent.png` is new.** Copied from
    the prototype, which carries a recoloured wordmark for the light scheme
    because the white word disappears on a light ground and `filter: invert()`
    would fix the word by destroying the tile. The dark file in `assets/` is
    byte-identical to the prototype's, which confirms the prototype's claim that
    it copied the shipped mark rather than redrawing it.

**What was deliberately not carried across.** `SCREENS.ds`'s last section,
*What the palette switch changes*, is not ported and should not be: it compares
the shipped palette against the §5.1 proposal, and the product carries only the
proposal. It is the rig's Surface switch documenting itself, which is exception
1 in this document.

**The prototype's status is NOT flipped.** ADR 0057 puts the flip at the end of
Leg 2 — when the last screen stands in the gallery. Twenty-four screens are
still unported, so the prototype is still the source and rule 4b still binds.
Leg 2b flips it, in this document and in `SETTINGS_REWORK_PLAN.md` §0.

### Leg 2b — what landed, what it found, and what is left

**Eleven of 25 screens stand in the gallery and every one of them measures
exact.** Ten are Leg 2b's: Home, History, Profiles, General, Hotkeys, Delivery
& Insert, Privacy & Data, Diagnostics, About & Updates, Integrations, and the
withdrawn Live preview & commit. **Fourteen are left** and they are listed at
the foot of this record.

**THE ONE THING TO TAKE FROM THIS LEG: the check is committed.**
`npm run port:diff <screen>…` (`scripts/gallery-port-diff.mjs`) opens the
running prototype and the running gallery in one headless Chromium, selects the
same screen in both, walks each screen's block tree collecting 31 computed
properties per node, and prints every difference. A screen is ported when it
reports zero. Leg 2a described this check as a hand-run selector list and could
not repeat it cheaply; written down it costs one command, and it is the reason
this leg's eleven screens are exact rather than approximately right.

It found **nine defects in the library that no single screen showed**, and
that is the argument for it. Each was fixed in the primitive:

1. **A stacked row had a control slot.** `.ws-row-ctl` is `flex: none` and
   holds a control at an inline row's trailing edge; the prototype's
   `stackRow()` puts the body as a *direct child*. Every full-width block
   inside a stacked row — the input meter, a textarea, a button run — was
   drawing at its content width instead of the row's.
2. **Everything that inherited its size was one step small.** `body` reads
   `--text-body`, the pre-port alias for `--t-note` at 13 px, where the
   prototype's window declares `--t-body` at 14. Set on `.ws-content` until
   Leg 3 owns the window root.
3. **`svg { flex: none }` was missing** — the prototype's one unscoped base
   rule. An icon inside a flex control could be squeezed below its declared
   width. Fenced to the ported surface, because the thirteen pre-port areas
   still render lucide icons under their own assumptions.
4. **The card's `padding: 0` guard for a tinted stack named only
   `.ws-rows[data-tinted]`.** The prototype's own case is `.owed-list`, so
   Home's decision inbox had 20 px of untinted card above its first row.
5. **The toolbar's trailing slot carried `.right` without `.rowflex`.** One
   caller with one control today, which is exactly why it went unseen.
6. **`SegmentControl` carried six Tailwind utilities** restating what
   `.ws-seg button` already declares, and the stepper's value had lost
   `.ws-num`, so a changing number shifted width.
7. **`StatusDot` was still Tailwind.** `.ws-dot` sat ported in `shell.css` at
   7 px with `--success`/`--accent`/`--danger` and no caller, while the
   component drew itself at 8 px with `--green`/`--orange`/`--red`. The one
   place the dot was defined and the one place it was drawn disagreed on its
   size and on all three of its colours.
8. **`card()` renders its ROWS BEFORE its BODY.** Both cards on Integrations
   had them the wrong way round, which the card's first/last-child edge rules
   then made visible as an inset on the wrong side.
9. **`.ws-badge` and `.ws-subtabs button` each carried a `white-space: nowrap`
   the prototype does not have**, and `.ws-conn` asked for `--card-border`,
   which is the prototype's token and not this repo's.

**Four measurement false positives, on top of Leg 2a's two.** Leg 2a recorded a
stale browser zoom and `inline-flex` blockification. Add:

- **`content-visibility: auto`.** An off-screen list row reports
  `contain-intrinsic-size` instead of its laid-out height, and the gallery puts
  two more blocks above a screen than the prototype does, so the same row is
  rendered on one page and skipped on the other. Forced visible for the
  measurement.
- **The window is not the column.** The prototype draws inside a mock window
  capped at 1180 px with its own sidebar; the gallery is a real window at the
  viewport's width. A column layout hides it behind `--content-max`; a pane
  layout fills, so the two content columns are brought to the same box before
  any width is compared, and the gallery's own masthead and screen picker —
  which are rig — are taken out of the flow.
- **Tailwind's preflight.** The prototype ships no CSS reset, so a `<button>`
  keeps the UA's `letter-spacing: normal` where preflight makes it inherit.
  Suppressed only where the element draws no text of its own.
- **JSX splits adjacent text.** `{pct}%` is two text nodes and one in the DOM.

**Three divergences are deliberate**, named in the verifier so they are a
decision rather than a silence: the live meter is upstream's component (a
wrapper div and an idle rule) where the prototype draws a bare canvas; the
switch uses the Radix `aria-label` where the prototype hides a text span; and
the slider has a real range input, so unlike the prototype's it can be operated
from the keyboard.

**The icon set came across whole, and that is a decision worth defending.**
`demo.js` heads it *"lucide geometry, one stroke weight, DRAWN NOT BORROWED"*,
and several of the 79 carry a comment saying which obvious glyph was rejected —
why `swap` is two lanes and not one curved arrow, why `translate` carries no
flag, why `arrow-left` is drawn rather than derived with `scaleX(-1)`. Reaching
for the nearest lucide export would have discarded those decisions silently, in
79 places, invisibly. `lucide-react` stays where Legs 1 and 2a put it: inside
the primitives, for the glyphs a control draws for itself. Eight primitives
moved onto `Icon` in this leg because the prototype names their glyph.

**The settings sheet's own scale is ported early, and it earns its keep.**
§11.22's `.modal-win` scope is `.ws-sheet-scale`, applied by the gallery around
a settings screen — because a settings screen measured at the workspace's 20 px
inset is *not* the screen the prototype draws. Leg 3 moves it to the sheet
itself. That it moved from one container to another without a single component
changing is the first proof ADR 0052's tokens do what they claimed.

**Findings for whoever takes 2c and beyond.**

1. **The prototype disagrees with itself in one place.** `demo.css` defines
   `.dot` rules for `success`, `warning` and `danger`; `demo.js` calls
   `dot("accent")` once, on the withdrawn screen, so that dot renders muted.
   Ported as it renders — the drawing is what was looked at and accepted — and
   `StatusDot` carries `accent` with no colour rule to match. If anyone ever
   wants an accent dot, that is a new decision and needs an ADR.
2. **A settings screen is a sheet, so the prototype renders TWO
   `.content-inner` elements** — the workspace behind it and the sheet's own.
   Anything measuring the prototype has to take the modal's. The verifier does.
3. **The 14 remaining screens are not evenly sized.** `context` (with
   `contextintake` and `contextactions`), `models`, `agents` and `onboarding`
   are 200–600 lines of builder each and bring their own CSS blocks. The seven
   standalone previews are medium. Budget accordingly: this leg spent roughly
   half its time on the first two screens and the library they needed, and the
   rest went four times faster.
4. **`FormCard`, `FormRow`, `Sidebar` and `StatTiles` are still pre-port** and
   still what the thirteen shipped areas render. Untouched, as Leg 2a left
   them; they are deleted with the last screen that reads them, which is Leg
   3's business.
5. **`src-tauri/src/core/mode_router.rs:7` still cites `OverlayGallery.tsx`**,
   which is now `src/windows/gallery/OverlayStates.tsx`. Out of scope under
   rule 6, and still owed to whichever leg opens that file.
6. **The native host is reachable and the recipe works.** `npm run tauri build`
   (ignore the AppImage step), run `src-tauri/target/release/wordscript`, find
   the window with `xdotool search --name "WordScript – Settings"`, capture
   with `import -window <id>`. Synthetic input still cannot be delivered, so a
   screen below the fold has to be hoisted for one build — two `useState`
   defaults and the temporary route, all three reverted before committing.
   Home was looked at this way and renders correctly: the keycaps with their
   lit top edge and cast shadow, the decision inbox with only the urgent row
   tinted, the ported icon set throughout.

**What is left, in the order the prompt below suggests.**

| Group | Screens |
| --- | --- |
| Workspace | `context` — and its two states `contextintake`, `contextactions` |
| Settings | `models`, `agents`, `notesettings` |
| Previews | `onboarding`, `translate`, `subtitles`, `meeting`, `conversation`, `agentoverlay`, `handoff` |

**The prototype's status is NOT flipped.** ADR 0057 puts the flip at the point
where the last screen stands in the gallery. Fourteen are unported, so the
prototype is still the source and rule 4b still binds. Leg 2c flips it, in this
document and in `SETTINGS_REWORK_PLAN.md` §0, and writes the Leg 3 prompt.

### Leg 2c — four screens, a stronger check, and why it split at four

**Fifteen of 25 stand and every one measures exact.** Four are Leg 2c's: Notes &
Meetings, AI Models, Onboarding and Agents. **Ten are left** and they are listed
at the foot of this record with their line spans.

**IT SPLIT AT FOUR AND SAYS SO.** The 2c prompt costed the fourteen by new CSS
classes and that count was right about the library and wrong about the reading.
The four cheapest screens were done in roughly a third of the session; what the
count does not price is that every one of the remaining ten is either a
200–350-line builder of its own or reads back a family one of those brings.
There is no cheap screen left, so there was no honest way to take a sixth or
seventh and still close the leg. Per the 2c prompt's own instruction, the leg
split instead of reporting fourteen when four were done.

**THE ONE THING TO TAKE FROM THIS LEG: the check can now reach the rest of a
screen.** `npm run port:diff models#1 onboarding#4 agents#2` drives BOTH
surfaces into the named sub-tab or wizard step with their own controls, then
measures. Before this, a screen was measured in its default state and the rest
was taken on trust — which for AI Models was a whole tab, for Agents two of
three, and for onboarding six of seven steps. Two shapes: a tab is indexed and
jumped to once, a wizard step is pressed forward n times with a frame between
presses.

Writing it turned up two things worth knowing:

1. **Both surfaces keep their wizard state across runs**, the prototype in
   `state.ob` and the gallery in the component's own `useState`. So
   `onboarding#1 onboarding#2` walked one step and then two MORE, and reported
   step 4 under the name of step 3 — with the two sides in step with each other
   the whole time, which is exactly what made it silent. The driver resets to
   zero first, and it resets even when no `#` is given.
2. **False positive the fifth: a transitioning property measured mid-flight.**
   The rail step animates its colour. The prototype rebuilds its window
   wholesale on every render, so its new element is born at the final value with
   nothing to transition FROM; React mutates the same node's attribute, so the
   same change animates and the walk caught the app halfway. It reported a
   `done` step at the `now` colour, intermittently. `transition: none` is now
   part of the measurement stylesheet — nothing measured depends on a transition
   being live.

**THE LIBRARY DEFECT NO EARLIER SCREEN COULD SHOW.** `demo.css` has TWO base
rules and only one was ported. The second is `.win svg { width: 16px; height:
16px }` — the surface's default icon size — and it **beats `.pmark`'s own 14 px
on specificity, in the prototype exactly as here.** Every icon Leg 2b drew sat
under a more specific rule (`.btn svg` 13, `.nav-row svg` 15, `.lane-tile svg`
15), so the fallback was never reached; the provider mark inside a job badge is
the first that does not. Ported fenced to `.ws-content` / `.ws-nav` beside the
`flex: none` rule, and re-measuring all eleven earlier screens confirmed it
changed none of them.

**Leg 2b's finding 8 recurred, in a second place.** The prototype's `card()`
renders its ROWS before its BODY. Both of Agents' mixed cards had them the other
way round and the measurement caught it in six properties. `Card` takes free
children, so ordering is the caller's — worth checking by eye on every card that
carries both, and worth considering as a `body` prop if it recurs a third time.

**What was ported into the library**, all read out of `demo.css` line for line:
`.selmark`, the `jobmodel` family, the `job` / `joblist` family with its open
body and the rule that aligns a detail row with the label rather than the
chevron, the `mdl` family and its in-row download bar, the `obrail` / `obstep` /
`obfoot` family, `mcpl` and the agents `thread`. Six new components in
`components/shell/` — `Job`, `ModelRow`, `Onboarding`, `Thread` and their
companions — and none in the gallery. `Field` gained the prototype's own `w`
option so a field's width stays the field's property rather than a style at a
call site.

**`LANES` and `PROVIDERS` are data, in `screens/data.ts`.** Four lanes × eight
jobs, copied whole, because they are data in the prototype too and for the
reason the lane switch exists: the model NAMES change per lane
(`whisper-large-v3-turbo` is a Groq endpoint, `ggml-large-v3-turbo` is a file on
this disk) and a job can be unavailable in a lane and say so. Onboarding reads
the same table and renders the same provider picker and the same model row as AI
Models — shared, not twinned, which is what the prototype's own comment demands.

**Findings for whoever takes 2d and beyond.**

1. **The four `#`-driven states are the ones a reader actually visits.** Use
   them. `context` has three panels over one object and `meeting` has a HUD
   state; both will need a `SUBSTATE` entry, and adding one is four lines.
2. **The desk's voice is `mark: null`, not `mark: undefined`,** and the
   difference is drawn: `null` takes a job off the connection's axis entirely,
   so it gets neither a provider mark nor the `default` suffix that would claim
   it follows something. `"mark" in lj` is the test, not `lj.mark`.
3. **The prototype's `.msg[data-from="me"]` is declared unqualified** in the
   message-bubble block that Client conversations brings, so it reaches the
   agents thread too and the agents preview draws it. It is ported with the
   thread; whoever ports `conversation` should not port it twice.
4. **`ScopeTag` without `onOpen` renders a `<span>` and the prototype's
   `scope()` is always a `<button>`.** Pass `onOpen={() => undefined}` or the
   measurement reports a structural difference that looks like a missing
   element.
5. **The orb's `drive` in this repo is not a generator.** It removes the
   transition and nothing else, so passing it is compatible with ADR 0058 — the
   prototype animates from a synthetic envelope, the port sits at level 0. The
   Agents test asserts `--orb-level` is `0.00` on all four.
6. **`FormCard`, `FormRow`, `Sidebar` and `StatTiles` are still pre-port**, and
   `src-tauri/src/core/mode_router.rs:7` still cites `OverlayGallery.tsx`. Both
   unchanged, both still owed to the leg allowed to open those files.
7. **The native-host recipe still works and still needs a hoist.** `npm run
   tauri build` (the AppImage step fails on `linuxdeploy`; the binary is built),
   run `src-tauri/target/release/wordscript`, `xdotool search --name "WordScript
   – Settings"`, `import -window <id>`. Synthetic input still cannot be
   delivered. AI Models was looked at this way and renders correctly: the lane
   segment, the provider chip row with its brand tints at the corrected icon
   size, the sub-tab bar, and — after hoisting the section above it for one
   build — the job list with its open body and override badges.

**What Leg 2 owes Legs 4 and 5 so far** (§2.5). Every one of these is a place
the prototype states a fact the runtime does not yet have, rather than a
presentation difference:

- **The desk's own model is read from somebody else's configuration file.**
  Agents draws `claude-opus-5` with a `read-only` badge and a "needs a restart"
  row. Nothing in the runtime reads a harness configuration today, and the
  restart semantics (a running process does not re-read its config) are a
  runtime contract, not a label.
- **The MCP readout has no source.** Five servers with owner, transport and a
  privacy consequence each. It is explicitly a readout of a file WordScript does
  not write; it is also a file WordScript does not currently read.
- **`Measured TTFB` says `Not measured` in two places** — AI Models' speaking
  job and Agents' Voice tab — which is honest today and is a measurement the
  runtime owes.
- **Local model installation is drawn as working.** Download, progress with
  cancel, remove, and a disk total. `useModelDownload` is the donor's; this
  repo has no equivalent, and the "On this machine" tab is the largest single
  block of runtime the port has drawn.
- **`Longest recording this lane accepts` (`~26 min`) is derived** from the
  account plan on the connection. ADR 0038's budget already computes something
  like it; whether the two agree is a Leg 5 question.
- **The lane vocabulary is four values and the runtime has two.** Cloud and
  Local exist; Self-hosted and Enterprise are drawn in full, with their own
  credential shapes, and are vocabulary the runtime does not carry.
- **Onboarding's `Registration: Accepted` and its insert check** are the
  shortcut and delivery preflights the runtime does have — those two are wiring
  rather than contract, and are the cheapest part of that screen to make real.

**Leg 2d's additions to the same list.** The distinction Leg 2c set is kept: a
label the runtime does not use is a **Leg 5 contract**; a screen that could not
be drawn without inventing a control is a **Leg 4 wiring problem**.

- **The context object is one type with five states and four origins, and the
  runtime has one of them.** `origin` — `calendar`, `meeting`, `upload`,
  `link`, `dictation`, and `conversation` on top of those — is the field the
  whole of Context, the intake and Client conversations hang off, and the
  transcript record has nothing like it. **Leg 5 contract, and it is the
  largest single one this port has drawn**: everything downstream of it
  (search, the rail, Linked, retention) reads it.
- **Folders are directories and the surface says so in as many words.** The
  rail states a real path and promises that moving an object between folders
  moves a file. Nothing in the runtime keeps notes as files under a root today.
  **Leg 5 contract** — and the one place where getting it wrong later is a data
  migration rather than a relabel.
- **Speaker status is four values and diarization produces none of them.** ADR
  0047's `provisional` / `suggested` / `confirmed` / `locked` is a product
  decision borrowed from the donor, and `locked` is load-bearing: without a
  status that survives the end-of-meeting re-clustering, every name typed
  during a call changes after it. **Leg 5 contract.**
- **The Summary tab says out loud that nothing on it was produced by a model,**
  which is honest today and is the whole of what Leg 4 has to make true or
  visibly untrue. Decisions, tasks and open questions are drawn complete.
- **Two gestures on the Summary tab reach outside the note** — a task to the
  desk, an open question to Home's decision inbox. The inbox exists as a
  drawing (Leg 2b) and neither gesture has a receiver. **Leg 4 wiring**, and it
  needs the inbox to be real first.
- **The Linked tab is computed and says it is computed on this machine.** Four
  groups from shared people, shared topics and a calendar series. There is no
  index behind any of it. **Leg 5 contract.**
- **The actions are files in `_actions/` and the surface states the filename.**
  Six of them, two built-in, two running on the desk with a target and a role.
  Nothing reads or writes that directory. **Leg 5 contract**; the desk half of
  it also needs ADR 0030's keyed confirmation, which does not exist.
- **The meeting HUD is a second window and there is no second window.** 330 ×
  560, always on top, resizable, content-protected, and it captures system
  audio — which is the same dependency Live subtitles' captions wait on and the
  reason both are drawn rather than built. **Leg 4 cannot wire this screen at
  all**; it is a capability, not a control.
- **The copilot lane has three rules and no producer.** It never speaks, never
  hints without a citation, and replaces rather than stacks. The citation rule
  is the one that has to survive into whatever produces the hints.
- **The handoff's effect-verb recognition does not exist**, and neither does the
  keyed card that must not take focus. Rust owns the key grab (ADR 0006). The
  card's whole budget is that refusing costs one keystroke — **if refusals
  become common the recogniser is wrong**, which means Leg 5 owes a way to
  measure the refusal rate, not just the feature.
- **The agent window draws a live thread, an answer window that counts down and
  a voice with a named model and a measured latency.** `Cartesia Sonic-3 ·
  240 ms` is a fact about a text-to-speech path that has no implementation.
  **Leg 5 contract**, and it is where ADR 0030's spoken half lands.
- **Translation routes per language to two output devices and names a
  text-to-speech model.** Speech in two directions plus a voice that speaks are
  both new runtime capability. The address form and the terminology are
  already the profile's (ADR 0033, 0035, 0041) — those two are wiring.
- **Consent is a field on a conversation and there is nowhere to put it.**
  Whether it was recorded, written, and under which answer. It is the field
  somebody reads two years later, so it is a contract rather than a label.
- **The document template belongs to the profile and the product ships none.**
  Five fields, each stating where its value came from, and the rule that an
  empty field says empty rather than being filled by a model.

**Leg 4a's additions to the same list.** Every one of these falls out of a
lifecycle decision rather than out of a drawing, which is why Leg 2 could not
have found them: they are things the runtime has to be able to answer *because
of how a surface is entered or left*, not because a label states them.

- **The runtime cannot say whether it has a usable connection.** ADR 0060's
  auto-run condition is exactly that question, and so is every step's resume
  test. `Registration: Accepted` and the insert preflight already exist; the
  connection, the microphone permission and "has a transcription ever completed"
  do not exist as one readable readiness answer. **Leg 5 contract**, and the
  cheapest of them — it is a read over state the runtime already holds.
- **One config field: when onboarding was completed or closed.** Without it the
  flow re-runs on every launch for anybody who deliberately runs unconfigured.
  **Leg 5 contract**, one timestamp.
- **The tray/dock presence state is decided and drawn nowhere.** ADR 0030 named
  it — three levels, the third with a counter — and ADR 0061 makes it
  load-bearing: it is where a dismissed agent question rests when no pill and no
  window is on screen. **Leg 5 contract *and* a 26th drawing.** It is the only
  surface this port has found that is decided, needed, and has never been drawn.
- **Whether the agent window is focused is an input to the surface selector.**
  ADR 0061 routes a question by what is already on screen, and "focused" is the
  only checkable proxy for "seen". **Leg 5 contract.**
- **Three counters keyed by the verb that fired, persisted like history.**
  ADR 0062 makes them the handoff's grade rather than an optional metric, and
  keyed by trigger rather than totalled, because the fix is removing one entry
  from a list. Diagnostics has to grow a block for them. **Leg 5 contract, plus
  a small drawing owed.**
- **Which processes hold the microphone.** ADR 0063's detection is this read and
  nothing more, per platform (`pactl list source-outputs` on Linux). It is
  independent of system-audio capture, which is what makes noticing a call cheap
  and recording one expensive. **Leg 5 contract.**
- **The consent field on a conversation, which is also its opt-in.** Leg 2d
  listed consent as a field with nowhere to put it; ADR 0064 makes it the thing
  that decides whether an object is written at all. That promotes it from a
  label to a gate: opting out has to leave no file, not a file marked private.
  **Leg 5 contract.**
- **A per-language output-device routing, and a mute of the recogniser for the
  length of each spoken utterance.** ADR 0064. Both are new runtime capability
  and neither is a setting on top of something that exists.

**Leg 4's additions to the same list.** Every one of these was found by trying
to read a fact rather than by reading a drawing, which is why Leg 2 could not
have found them: the drawing states them and the runtime turns out not to.

- **The runtime log has no severity field.** `runtime_log::record` takes one
  string. The ported `Log` draws INFO / WARN / ERROR in three colours and there
  is nothing to put in that column, so `LogLine.level` is optional now and a
  real line draws with an empty gutter. Deriving a level from whether a line
  contains the word "error" would be a guess printed in the one place somebody
  reads to find out what went wrong. **Leg 5 contract, and the cheapest on this
  list** — the levels already exist in the component.
- **`complete_v1_slice_capture` records the profile it was given and decodes its
  rules from the ACTIVE profile's work mode.** So Diagnostics' Text profile
  select labels the run without changing it. **Leg 5 contract**, and the fix is
  one argument reaching `build_transcript`.
- **`audio_level` is one scalar and a waveform needs a history.** The ported
  waveform can only be driven by opening a microphone of its own
  (`getUserMedia`), which would have WordScript hold a second capture device for
  as long as a settings page is open — the exact signal ADR 0063's detection
  watches for. It is drawn at rest on the product surface for that reason, and
  the level meter beside it is live. **Leg 5 contract**: a short sample history
  on the event, or a component that takes one.
- **Nothing says how this build was installed.** About's "How you run it today"
  is derived from whether this bundle came from the dev server, which is honest
  while there is no installer and stops being an answer the day there is one.
  **Leg 5 contract**, and small.
- **The build-lane row names different lanes than the runtime does.** The
  drawing says "Linux AppImage, macOS universal, Windows MSI"; `build_targets`
  says DMG, NSIS and AppImage + DEB. The badge is wired and the hint is not,
  because the gallery is the source and a disagreement is an ADR or a bug in the
  gallery (ADR 0057) — never a quiet edit. **Somebody has to decide which is
  right.**
- **`clear_runtime_log_entries` has no door on the ported Diagnostics.** The
  pre-port panel had a Clear button; the ported card has no footer. The command
  exists and nothing calls it. **A missing control rather than a missing
  capability** — and adding one is drawing, so it needs the gallery to grow it
  first.
- **Privacy & Data's Export, Import and Reset have no commands.**
  `export_transcription_history` writes the HISTORY as JSON; the drawn row
  promises "everything local, as one archive". There is no import of anything
  and no reset-to-defaults. **Leg 5 contract, three of them**, and they are why
  that section still carries its banner.
- **The context objects and meeting-audio rows on Privacy are V2 and an open
  decision** and say so on themselves. Not a gap — recorded so the next leg does
  not go looking for a source.

**Raised by the owner on 2026-08-10**, against Leg 4b's report and from the demo
rather than from the code. Two became ADRs; the rest are contracts.

- **"Every transcript is a Markdown file in `~/WordScript/transcripts`" is not
  what the runtime does.** History's foot states it, and every drawn entry
  carries a path like
  `~/WordScript/transcripts/2026/08/03-0942-settings-restructure.md`. The
  runtime keeps ONE `history.json` under the user data dir and no per-transcript
  file exists. **Leg 5 contract, and it is the second of the two on this list
  where getting it wrong later is a data migration rather than a relabel** — the
  first is Leg 2d's *folders are directories*. It is the same shape of promise
  and probably the same piece of work.
- **`Show in file manager` has neither a path nor a command.** It follows the
  entry above: no file, nothing to reveal, and no `reveal`/`show_in_folder`
  command exists (the `opener` plugin could carry one). **Leg 5 contract.**
- **History's badges have no source.** `Clipboard`, `Insert failed`,
  `Retried once` are drawn per entry; the runtime's `TranscriptionHistoryEntry`
  carries `status`, `insert_mode`, `pasted`, `retry_of` and `applied_rules`,
  which is enough to DERIVE all three — but which badge follows from which field
  is a decision nobody has taken, and taking it inside a wiring commit is how a
  placeholder becomes the product. **Leg 4c decides it and writes it down; it is
  wiring, not contract.**
- **The whole of `AI Models` is one task rather than a screen to wire.**
  [ADR 0065](../decisions/0065-groq-is-the-only-integrated-lane-and-every-other-one-stays-drawn-and-disabled.md):
  Groq is the only integrated lane, the UI does not change, and Local,
  Self-hosted and Enterprise stay drawn and disabled. The §2.5 entries Leg 2c
  and 2d filed about this screen are **deferred, not answered**. The ADR leaves
  one point open on purpose — whether `local_preview` is disabled only here or
  everywhere, since the status strip reads it — and it must be asked, not
  guessed.
- **`Help` finally has something behind it.**
  [ADR 0066](../decisions/0066-help-is-a-small-modal-with-three-links-which-is-what-finally-mounts-the-row.md):
  a small modal with Discord, GitHub and the documentation. Three legs refused
  to mount that row for the written reason that nothing was behind it; this is
  that something. Two of the three URLs do not exist yet and a link that opens a
  404 must not be drawn.
- **THE SEARCH BAR IS MISSING AND THE COMMAND PALETTE BEHIND IT WAS NEVER
  PORTED.** Raised by the owner in as many words: *the searchbar 1:1 from the
  demo GUI was also forgotten.* He is right, and the record was misleading about
  why. `NavSearch` is ported 1:1 — the search glyph, the word `Search`, the
  `⌘K` / `Ctrl K` keycap — and it is mounted in no window, so the product's
  sidebar simply has no search bar where the prototype's has one. Leg 2a wrote
  that it "opens the command palette, the gallery has none" and Leg 3 repeated
  it; both are true of the PORT and neither is true of the prototype, which has
  a complete palette: `demo.js:8031–8366`, a 26-entry `CMDK_INDEX` in three
  groups, prefix/word-start/substring scoring, match highlighting, keyboard
  selection and `Cmd`/`Ctrl`+`K`. **So the search field was never waiting on a
  decision. It was waiting on a surface nobody ported**, and three legs recorded
  the absence as a principle instead of as a gap.
- **It is the ONLY prototype surface the port never carried.** Checked
  mechanically rather than assumed: the prototype has exactly two top-level
  surfaces outside its 25 screens — `settingsModal`, which Leg 3 ported as the
  sheet, and `commandPalette`, which nobody did. "All 25 screens stand" was
  always true and was always about the 25; this is the thing that was never in
  the count.
- **Most of the palette's index is answerable today.** Twelve of its entries are
  `go:` navigations and the seam grew `runtime.open` in Leg 4b; another eleven
  are `go:` under a settings-row label; the theme actions have `useColorScheme`;
  Copy last transcript has `state.lastResult`. **One entry has no source** —
  *Show transcripts in file manager*, which is the same missing path as
  History's row. So this is a port with one hole in it, not a feature to design.
- **Context is going to be done differently.** Said by the owner on 2026-08-10
  and deliberately not elaborated. Until it is, Context, its intake and its
  actions panel stay exactly as they are: mounted with a V2 banner, drawn, and
  three entries in the gallery. **Nothing about Context is Leg 4c's**, and
  nobody should start deriving a design from the drawing in the meantime.

**Leg 4c's additions to the same list.** Every one was found by trying to make
a drawn control act, which is why neither Leg 2 nor Leg 4b could have found
them: the drawing offers the control and the runtime turns out to have nothing
behind it. Two of them are the same shape and it is worth naming — **a control
whose destination was never drawn**. That is not a missing capability and not a
missing command; it is a missing SURFACE, and the gallery has to grow it before
anybody can wire it (ADR 0057).

- **There is no seventh mode, and two screens now say so.** ADR 0041 gave
  Translate a mode slot; `ProcessingMode` is six values and `ModeHotkeys` six
  fields plus the picker. Hotkeys' seventh key and Profiles' seventh option are
  both drawn and disabled for it. **Leg 5 contract**, and it is one variant on
  an enum plus one config field — the cheapest thing on this list and the most
  visible.
- **The trigger-status badge has no cause, only a sentence.** `BindingInfo`
  answers `registered` plus an error string, so the drawn `Taken by the desktop`
  cannot be produced: the badge says `Registered` / `Not registered` /
  `Disabled` / `Not checked` and the sentence goes in the hint. **A drawing that
  is more specific than the runtime**, not a gap to fill — unless somebody wants
  the runtime to classify a refusal, which would be a real contract.
- **Nothing clears a mode hotkey.** `ShortcutField`'s manual-entry field was the
  pre-port way to empty a slot, and the ported `HotkeyButton` has no clear
  affordance. The recorder can only set. **A missing control**, and it needs the
  gallery first.
- **The profile lists have no editor.** `dictionary_entries` and
  `snippet_entries` render and delete; Add and Edit have no form, no dialog and
  no inline field anywhere in the drawing. So does New profile — `createTextProfile`
  works and nothing on the surface can rename what it produces. **Three missing
  surfaces**, and they are the largest single hole this leg found.
- **`analyze_text_rules` has no answer surface.** It is a real command and two
  drawn buttons call for it — *Check against a sample* and *Show the effective
  transcription bias* — and there is nowhere drawn to put what it returns. **A
  missing surface**, and the command is already built, which makes it the
  cheapest of the five to finish once something is drawn.
- **`describeTextProfileWorkMode` is not the profile list's subline.** The
  drawing gives each row a discriminating pair — `Auto · Insert at cursor`,
  `Rewrite · Client register` — and the runtime's describe function returned the
  identical string for all six profiles on this machine, so the column stopped
  telling them apart. **A UI derivation nobody has decided**, the same shape as
  History's badges, and Leg 4d should decide it the same way.
- **The decision inbox has no receiver for any of its three sources**, which
  Leg 2b filed as a drawing and Leg 2d as two gestures. Wiring Home turned it
  into a measurement: all three are absent, so on the product nothing is drawn
  there at all. **Leg 5 contract ×3** — the desk (Phase 8), an open question on
  a note (V2), and a queue of insert fallbacks, which is the only one of the
  three that could exist today.
- **`useTranscriptionHistory` crashed the window on a runtime that did not
  answer.** Not a contract — a defect, fixed in this leg, and recorded because
  it is Leg 4b's finding 4 reaching a second read: `Array.isArray` before
  `setState`, and "not an array" is "did not answer" rather than "none". It only
  became reachable when a second view mounted the hook.
- **The Delivery & Insert screen's history claim is the third of its kind.**
  Not new; noted because History's foot, Leg 2d's *folders are directories* and
  the Markdown-file promise are now three statements about where user data
  lives, and one of them is being read by two screens.

**Raised by the owner on 2026-08-10, against Leg 4c's report, and it is the
first hole this port has found in the PROTOTYPE rather than in the runtime.**

- **HISTORY SHOWS THE REWRITTEN TEXT WHERE THE ACCURACY QUESTION NEEDS THE
  HEARD ONE.** Raised by the owner the same day, against the transcription
  record above, and it splits into a defect that is fixed and a design question
  that is not.

  **The defect, and it was Leg 4c's.** `RawPanel`'s default foot reads
  *"Identical — no AI stage ran on this one"*, which is a claim about whether a
  STAGE RAN, and the wiring keyed it off string equality. Measured against the
  owner's `history.json` on 2026-08-10: **50 of 142 records have identical texts
  and an AI stage ran on all 50** — so the sentence was false every time it
  appeared. The runtime holds the evidence (`corrected`, `applied_rules`), so
  `rawOf` reads it and the third state gets its own sentence, *"The AI stage ran
  and changed nothing."* Fixed, tested, gallery unmoved. **Equal outputs are not
  evidence that nothing ran**, and that generalises past this row.

  **What is NOT a defect: the stored data.** Traced through
  `stage_pending_transcription_preview` — `raw_transcript` is the provider's
  `response.text`, captured before any transform. `Heard` shows the recogniser's
  own words. 92 of 142 records differ from their transformed text, so the pair
  is carrying real signal.

  **The open question is the LIST.** A row's title is the written text, so the
  surface a reader goes to in order to judge transcription accuracy shows the
  AI's version first and the recogniser's one click away behind *View raw*. That
  is the drawing's design and it is right for a record of *what you got*; it is
  wrong for the job the owner now needs this screen to do. **Not changed
  unilaterally** — the gallery is the source (ADR 0057) and the title is drawn.
  Leg 4d decides it with the owner, and the cheapest honest options are a filter
  or a toggle over which text the list shows, not a re-titled row.

- **THE COMMUNICATION STYLE HAS NO SURFACE ANYWHERE, AND IT IS STILL RUNNING.**
  The owner asked whether the old UI's rewriting-style options — how formal,
  which vocabulary, shorter or longer — have an equivalent today. They do not,
  and the shape of the gap is unlike every other entry on this list.

  **The runtime has all of it and uses all of it.** `core::communication_style`
  is intact: `CommunicationRegister` (`off`, `authority`, `client`, `colleague`,
  `friend`, `quick`), `CommunicationLength` (`terse`, `normal`, `full`), the two
  bounded free-text fields with `MAX_STYLE_RULE_CHARS` / `MAX_STYLE_SAMPLE_CHARS`
  and the fixed precedence between preset, rules and sample that ADR 0023 sets.
  `AppConfig::active_text_profile_communication_style` assembles it per profile
  and `transform`, `agent` and `capture` all consume it. **It is live capability,
  not dead code.**

  **The pre-port surface had the controls.** `8f9077e^:src/components/settings/
  ModesTab.tsx` renders the register select with its six descriptions, the
  length select, both textareas and a budget meter on each.

  **The prototype points at the profile for it three times and never draws it.**
  AI Models' Rewrite row: *"How this writes — register, length, style rules,
  writing sample — is the profile's communication style, shared with the
  assistant"*, with an `Open the profile` link. Its Cleanup row: *"No
  communication style here. It applies to Rewrite and the assistant only."*
  Onboarding: *"Communication style — Register, length and writing sample …
  In the profile."* And the profile's five tabs are Defaults, Context, Words,
  Replacements, Snippets. **There is no sixth.** The profile list even displays
  a register in its subline — `Rewrite · Client register` — for a value nothing
  on the surface can set.

  **So the port carried the absence faithfully and Leg 4c had nothing to wire.**
  This is not a screen that lost a control; it is three pointers to a surface
  that was never drawn. `SETTINGS_REWORK_PLAN.md` §11.4 required the card to
  stand on two tabs under the old IA and the prototype relocated it into the
  profile without following it there.

  **It is worse than a missing feature, and this is the part to act on.** On
  this machine one of six profiles — *Product and engineering* — carries
  `register: quick` with 256 characters of style rules and an 88-character
  writing sample, set in the old UI, still being applied to every Rewrite and
  every assistant run under that profile, **and invisible and unchangeable in
  the product.** That is exactly the defect ADR 0023 was written against, quoted
  in the plan: *a setting whose cause is nowhere on screen.*

  **Leg 4d owns it, and it is a drawing job before it is a wiring job**
  (ADR 0057): the gallery grows the surface, the product follows. The runtime
  contract is already met, so the wiring afterwards is one card.
  **Where it goes was decided with the owner the same day —
  [ADR 0068](../decisions/0068-the-communication-style-is-a-tab-in-the-profile-and-the-legend-states-its-scope.md):
  a sixth profile tab `Style` in second position, with the Defaults Legend
  stating its scope in a fifth row.**

**THE PROTOTYPE'S STATUS IS FLIPPED.** All 25 screens stand, so ADR 0057's
condition is met: the prototype is provenance, the gallery is the source, and
rule 4b has expired. Said here, in the rules section above, and in
`SETTINGS_REWORK_PLAN.md` §0. **Leg 2 is closed.**

**What is left, in the order the prompt below suggests.**

| Group | Screens |
| --- | --- |
| Workspace | `context` — and its two states `contextintake`, `contextactions` |
| Previews | `meeting`, `handoff`, `subtitles`, `translate`, `conversation`, `agentoverlay` |

### Leg 2d — the last ten, and what closing Leg 2 turned up

**ALL 25 STAND AND EVERY ONE MEASURES EXACT.** Ten are Leg 2d's: Context,
Context · intake, Actions & templates, Meeting capture, Handoff, Live subtitles,
Translation, Client conversations, Agent overlay — and `notes`, `noteactions`
and `upload`, which are aliases of the first three and were never separate work.
Forty measurements across the twenty-five screens, every one **structural 0 |
style 0**, including four note tabs, three intake ways, seven onboarding steps
and every sub-tab.

**The leg did NOT split, and the reason is worth recording against Leg 2c's
costing.** 2c predicted no cheap screen was left and was right about the
reading; what it could not price is that the first family pays for the rest.
Context, its intake and its actions panel are one builder read once and three
screens out of it, and between them they bring the note grammar, the window
family and the floating bar — which is most of what meeting capture, the agent
overlay and the translation window then ask for. Handoff brought the overlay
drawing and `hoff*`; subtitles is then almost entirely those two plus twenty
lines of its own. The right unit of costing is the FAMILY, not the screen.

**THE ONE THING TO TAKE FROM THIS LEG: three library defects that only the last
ten screens could show, and all three were invisible until a screen asked.**

1. **A wide preview had no measure.** `.ws-content-inner[data-layout="wide"]`
   was `max-width: none`; the prototype caps it at 900 px. Four of this leg's
   screens are `layout: "wide"` and Handoff is the first screen in the whole
   port to ask for it, so the value had never been read. `none` would have let
   a preview column holding a 620 px window run to the width of whatever window
   it was opened in.
2. **The 16 px icon base rule was shrinking the dot-matrix readout to a
   square.** Leg 2c ported `demo.css`'s second base rule and re-measured every
   earlier screen, correctly, and it changed none of them. It could not: no
   ported screen drew a matrix. The meeting HUD is the first, and the readout
   declares its box in `width`/`height` ATTRIBUTES, which lose to any
   stylesheet — so a 47 × 20 meter came out 16 × 16. **The prototype hit exactly
   this and says so in `matrixMount`**, and answered it with an inline `style`
   on the SVG it builds by hand; here the SVG is upstream's, so the answer is
   one rule beside the base rule. It was also wrong on the six matrices on
   `/gallery` → Motion, which nobody had noticed because that page is not
   measured by `port:diff`.
3. **`card()`'s child order caught out a third leg, so it is the component's
   now.** `demo.js` renders head, then ROWS, then BODY, then foot. Leg 2b found
   it on Integrations, Leg 2c on both of Agents' mixed cards, and 2d on the
   meeting's speaker-stages card. Leg 2c wrote "worth considering as a `body`
   prop if it recurs a third time"; it recurred. `Card` takes `body` now and the
   order cannot come out reversed at a call site.

**THE VERIFIER LEARNED TWO THINGS, and the first is a silent-wrong-answer
class.**

- **A driver selector is scoped to the screen, not to the document.** Driving
  the intake's segment with `.ws-seg button` clicked the GALLERY'S OWN SCHEME
  SWITCH — it is a `SegmentControl` too, and it comes first in the document. The
  prototype's rig sits outside its mock window so its side moved correctly, and
  the two surfaces then measured different states: ninety-six "missing"
  elements, none of them a port defect. Both roots are now the roots the walk
  itself uses, so a driver can only reach a control the measurement is about to
  look at.
- **The state a screen family shares has to be reset, even when the control is
  an absolute index.** Leg 2c's reset exists for the wizard, where the presses
  are relative. Absolute tabs need one too, for a different reason: the
  prototype keeps the note tab in `state.sub.context`, which `context`,
  `contextactions` and their three aliases all read, while the gallery remounts
  the screen and returns to Summary. So `contextactions` measured after a
  `context#3` compared Linked against Summary. `resetAt` is which entry the
  surface opens on — a wizard resets to its first, a note to its third.

**A SIXTH MEASUREMENT FALSE POSITIVE, and it is a different kind.** The
dot-matrix readout is the first thing on a measured screen that MOVES on the
prototype's side — 12 fps off `orbEnvelope` — and its lit pixels carry a CLASS,
so a per-pixel comparison compares whatever frame the walk caught and reports it
as structure. It is also upstream's component where the prototype hand-builds
the same SVG, so the tree differs even at rest. It is compared as ONE node now:
the wrapper's display, flex and box are checked, the 112 circles under it are
not. `ws-matrix-wrap` is the name that says where the line is, and it is on the
shell wrapper rather than only in the script — which turned up defect 2 above.

**THE PROTOTYPE DISAGREES WITH ITSELF IN TWO MORE PLACES.** Leg 2b found the
first (`dot("accent")` with no `accent` rule). Add:

- **`.sources` is a `<span>` in one place and a `<div>` in the other**, with
  identical rules, so the tag changes nothing it draws. Both are ported as
  written — `Sources` takes `as` — because normalising one of them makes the
  measurement report an element that is missing when nothing is.
- **`icon("sound")` is not a name the prototype's own icon set carries**, so it
  falls back to the dot glyph. Translation's desk-side outcome line therefore
  draws a dot where a speaker was meant. Ported as it renders, on Leg 2b's rule:
  the drawing is what was looked at and accepted.

**WHERE ADR 0058 WAS APPLIED, AND WHERE IT DELIBERATELY WAS NOT.** Four of these
ten screens carry a capture surface, and the line this leg drew is *does the
component claim a MEASUREMENT*:

- **At rest, always:** the meeting HUD's level readout, the translation
  window's listening strip and the agent window's answer meter all sit at zero,
  which is the value Leg 2c gave the orb on Agents. The prototype drives all
  three from a synthetic envelope because it has no microphone.
- **Following the prototype:** `data-live` on a mic button, and `data-rec` on
  the drawn pill. Those are colours, not generators — and on a window that
  already carries "12:04 elapsed" and a red dot as sample data, a grey mic
  would be the only thing on it pretending the drawing is not a drawing.
  A gallery screen carries sample data and asserts nothing (ADR 0055); what it
  may not do is show a reading it did not take.

**Ported into the library**, all read out of `demo.css` line for line: the
`pane-sec` / `folders` / `folder-row` family, `note-tabs` / `note-body` /
`note-date` / `origin-from`, `tscript` / `tline` / `speaker`, the `who-chip`
family and its four statuses, `enh` / `enh-act`, `linkgrp` / `link-row`,
`floatbar` / `mic-btn` / `split-btn` / `menu`, `chatwin` and its deco, `bubble` /
`typing` / `readout`, `hud-resize`, the `intake` family with `dropzone` and
`rec-start`, `write-*`, the `actionswin` family, the `hud` family with `cop` and
`stagelist`, `ovp*` including the tab, `hoff*`, `linecmp`, `cross` and
`crossflow`, `cap*` and `echo*`, the `trw*` family, `clnt*` and `doct*`, the
`agw*` and `agpop*` families, and `cycle`. Twelve new component files in
`components/shell/`, none in the gallery.

**`CTX` and `ACTIONS` are data, in `screens/contextData.ts`**, for the reason
they are data in the prototype: the object list is one type in five states from
four origins and the states are the point, and the action list is two kinds in
one list where `kind` is what the surface reads to know which button it gets.

**Findings for Leg 3 and beyond.**

1. **The window family is five members and one chrome, and that is now a rule
   in `DESIGN_SYSTEM.md`.** Ask, Actions, the meeting HUD, the agent window and
   the translation window all take `ChatWinDeco` and the same resize grip. The
   handoff card is deliberately NOT one of them — no title bar, no close, no
   grip — and the reason is written on the component.
2. **The overlay is drawn from `overlay-pill.css` and `tauri.conf.json`, and it
   is a copy of a measurement.** `OverlayPillDrawing` reproduces the shipped
   pill including the shell's `zoom: 0.87`. Rule 5 held: `git diff` touches no
   `overlay*.css` and not `OverlayPill.tsx`. **If the shipped pill ever moves,
   this has to move with it** — a copy of a measurement that drifts is worse
   than no copy.
3. **`ChatWinDeco` grew an `actions` slot** because the translation window
   closes with an `IconButton` where Ask and Actions draw the strip's own bare
   button. That is the prototype's own difference, not a divergence, and
   passing the controls in is what keeps it a decision.
4. **`FormCard`, `FormRow`, `Sidebar` and `StatTiles` are still pre-port**, and
   `src-tauri/src/core/mode_router.rs:7` still cites `OverlayGallery.tsx`. Both
   unchanged, both still owed — and `FormCard`/`FormRow`/`Sidebar` are Leg 3's
   directly, because Leg 3 is the leg that deletes their last caller.
5. **The native-host recipe still works and still needs a hoist.** `npm run
   tauri build` (the AppImage step fails on `linuxdeploy`; the binary is built),
   run `src-tauri/target/release/wordscript`, `xdotool search --name
   "WordScript – Settings"`, `import -window <id>`. Synthetic input still cannot
   be delivered. **Context was looked at this way and renders correctly**: the
   folder rail with its counts and its open folder highlighted, the pane search,
   the object rows with their state badges, the note tabs with the accent on the
   open one's glyph, the two window buttons with Ask lit, the object's own
   header line with its origin, and the derived Decisions list.

   **The agent overlay was NOT looked at there, and it is the one thing this
   leg owes.** A second build was started for it, with the default screen
   hoisted to `agentoverlay`, and it was interrupted and then spent twenty
   minutes recompiling every dependency from scratch rather than finishing.
   It is the screen most worth a human's thirty seconds: it is the largest new
   CSS block, it is drawn dark-on-dark on hardcoded hex rather than on tokens,
   and it carries the only `zoom` in the port. **Open `/gallery` → Screens →
   Agent overlay in the native host and check three things**: that the drawn
   pill is the size of the real one, that the agent window's rail and thread do
   not clip at 340 px, and that the notification's orb glows rather than
   flattening. Everything else on it measured exact in Chromium.

   Do not interrupt `npm run tauri build` to change something — killing cargo
   mid-link costs a full dependency rebuild, which is how this was lost.
6. **The gallery still has no door in the native host.** One entry in
   `tauri.conf.json`, still out of scope under rule 6, and now owed by four
   legs. Leg 3 opens `src/App.tsx` anyway.

### Leg 3 — the shell overwrite, and the two things it found by deleting

**THE PRODUCT IS ONE WINDOW.** `SettingsWindow.tsx` is gone and
`WorkspaceWindow.tsx` stands where it did: four views in a `.ws-nav` sidebar —
Home · History · Profiles · Context — with the active-profile row at its foot,
the status strip along the bottom edge, and settings as a **modal sheet laid
over it at its own scale**, opened with `Cmd+,` / `Ctrl+,` and closed on Escape,
on the scrim and on its close control. Ten sections in three groups. The
fourteen flat areas were deleted in the commit that replaced them, nothing is
aliased, and old and new never coexisted (ADR 0054).

**THE ONE THING TO TAKE FROM THIS LEG: `.ws-sheet-scale` moved onto the sheet
and NOT ONE COMPONENT CHANGED.** That was ADR 0052's claim and this was the only
way to test it. The move is one selector — `.ws-modal-win` added to the list
that redeclares `--nav-w`, `--nav-row-h`, `--content-max`, `--content-pad`,
`--pad-card`, `--row-py`, `--gap-block` and `--gap-row` — and the same screens
now stand at 196/28/640/16 inside the sheet and at 232/32/760/20 in the gallery,
measuring exact against the prototype in both. A primitive that hardcoded 20 px
could not have made that journey, and three legs of "no screen carries an inline
spacing value" is what bought it.

**THE SCREENS MOVED OUT OF THE GALLERY.** `src/windows/gallery/screens/` →
`src/screens/`. ADR 0055 says the gallery imports the product's components and
never copies them; with the screens under `windows/gallery/`, mounting one on a
product surface would have made the gallery a dependency of the product, which
is that rule inverted. The gallery's `registry.tsx` stays in the gallery — it is
scaffolding and retires per screen in Leg 4 — and `ia.test.tsx` asserts that
every screen the product mounts is the same `render` the registry lists, so the
two cannot drift while both exist.

**THE BANNER IS A PROP, AND THAT IS THE WHOLE SEAM.** A screen takes
`ScreenProps { banner }` (`src/screens/props.ts`) and passes it to its
`ViewTop`. The gallery passes nothing — it asserts no runtime state and an extra
element in the masthead would break forty measurements at once. The product
passes one, because the moment the same drawing stands on a product surface it
may not imply a state the runtime did not reach. **`windows/workspace/ia.tsx`
carries all fourteen of those statements, and deleting a row's `banner` is what
wiring a section looks like** — so that table is also the list of what is left.
Four screens already carried their own (Context, Notes & Meetings, Agents,
Integrations); the prop overrides rather than stacks, because a masthead states
one thing and the product's row says both facts in one line.

**WHAT IS WIRED, AND WHY THE LINE IS WHERE IT IS.** The SHELL reads the runtime:
the status strip states the session status, the lane and the delivery target off
`useRuntime`; the profile row switches through `switch_active_text_profile` and
refuses during a session because the runtime does; the deep-link anchor
resolves. The CONTENT does not — every view and section is the drawing with
sample data. The line is not arbitrary. The strip is never scrolled away and is
not a section Leg 4 could come back to, so a permanently green "Ready" that
nobody measured would be the fake-readiness defect at the most permanent place
on screen; and everything it states was already in this window's hand.

**THE SHEET'S FOOT DOES NOT SAY WHAT THE PROTOTYPE SAYS, ON PURPOSE.** The
prototype's line is *"Every change applies as you make it."* — true of the
shipped instant-save behaviour and not true of a sheet whose sections write
nothing. It reads *"No section here writes to the runtime yet — each one says so
at its head."* until Leg 4 makes the first section write, and the commit that
does should put the prototype's line back.

**A LIVE DEFECT, FOUND BY HAVING TO MOVE IT.** `SETTINGS_ANCHOR_AREAS` mapped
`capture.auto_stop` to the area `input`. The window's area ids were `capture`,
`speech`, `modes` and the rest; `input` was the id that tab carried before it
was renamed. So the overlay's auto-stop tab — the one deep link in the product,
and the one runtime contract ADR 0054 exempts from the overwrite — opened the
settings window onto a header with a **blank pane** under it, and had done for
as long as the rename. Nothing failed, nothing logged, and no test looked.
Fixed, and `settingsAnchors.test.ts` now fails if the mapping stops naming
something the workspace actually mounts. **The target names a surface as well as
an id now**, because settings is a sheet: an anchor in a section has to open the
sheet before it can scroll and an anchor in a view has to close it. The one
anchor that exists is the second kind — §11.7 moved auto-stop into the profile,
so it lands in Profiles → Defaults and does not open the sheet at all. **The Leg
3 prompt predicted "several of them now land inside the sheet"; none does.**

**THE COUNT IS TEN SETTINGS SECTIONS, NOT ELEVEN**, and four documents said
eleven. The eleventh was Account & Sync, which the prototype removed on
2026-08-04 with its screen — an entry in a sidebar promises a decision lives
behind it and there is no account to decide anything about. Counted off
`demo.js`'s `settingsNav` groups, which is what the port is measured against.
Corrected in `SETTINGS_REWORK_PLAN.md` §4.2 (which also still said five views;
it is four since Notes and Upload became Context) and in the gallery's registry.
**ADR 0050 and the prototype's own README still say eleven and both were left
alone** — append-only and read-only respectively. Leg 6's drift check owes them.

**WHAT `RebuildLabTab` COST, AND IT IS THE LARGEST THING THIS LEG GAVE UP.**
Plan §4.2 keeps Diagnostics' pop-out; ADR 0054 forbids the old and the new
coexisting. `RebuildLabTab` satisfied neither: it was the pre-port area, the
ported screen replaced it in the sheet, and leaving it in the pop-out would have
put two implementations of one section on two surfaces of one product with no
rule for which is right. So `RebuildLabWindow` mounts the ported
`DiagnosticsScreen` and `RebuildLabTab` is deleted with `WindowChrome` beside
it. **That is ~1000 lines of working checks against the native runtime, and it
is Leg 4's to restore onto the drawing.** It is also what freed `FormCard` and
`FormRow`: the pop-out, not the main window, was their real last caller, and the
Leg 3 prompt did not know that.

**Ported into the library**, read out of `demo.css` line for line: `.win` minus
its mock (no radius, no shadow, no measure, no `.win-deco` — ADR 0003 leaves the
chrome to the OS), `.win-body`, `.win-foot`, the whole `.modal-*` family with
its two keyframes, and `.nav-profile` / `.nav-lock`. Three new component files —
`Window.tsx` (`WindowShell`, `WindowBody`, `StatusStrip`), `Sheet.tsx` (seven
parts) — and `ProfileSwitcher` re-ported onto `.ws-nav-profile`.

**THE TWO BASE RULES CAME OFF THEIR FENCE.** `svg { flex: none }` and the 16 px
default icon size were fenced to `.ws-content` / `.ws-nav` because the pre-port
areas rendered lucide icons under their own assumptions; the comment said "Leg 3
owns the window root and can unfence it there", and it did — both sit on
`.ws-win` now, where the prototype has them. **`.ws-win` is therefore also the
gallery's root**, which is what keeps `port:diff` measuring what it measured
before. `body` is still left alone: the overlay window shares it and rule 5 puts
the overlay out of scope.

**Findings for Leg 4a and Leg 4.**

1. **`ENTRY_POINT_HOLES` in `windows/workspace/ia.tsx` is Leg 4a's first
   input**, and it is data rather than prose because 4a's first act is to read
   it. Six entries, each naming the surface, the screen it is drawn on, **where
   its door would go**, and what is undecided about its lifecycle. `ia.test.tsx`
   asserts all six are still named, that each points at a screen that exists,
   and — the one that matters — that **none of the six is mounted**. A nav row
   that opens nothing is the fake affordance rule 7 forbids.
2. **Onboarding did not bite, and the reason is worth recording.** It is the one
   of the six that lands inside this window, and the shell can be built without
   answering it: the workspace is what the window renders, and putting a flow
   ahead of it is a routing decision taken in `App.tsx` or in the window's own
   first branch. Neither is load-bearing for anything Leg 3 built. **The
   question is recorded and unanswered** — first launch only or re-runnable,
   whether skipping is offered, what a quit at step 4 leaves behind, and which
   window it is.
3. **Neither the search field nor Help is mounted**, and both are ported.
   `NavSearch` opens the command palette and there is no palette (Leg 2a,
   finding 10); Help has nothing behind it at all. Mount each when there is
   something to open. This is the same rule as (1) one level down.
4. **"Notes & Meetings" wraps to two lines in the sheet's nav**, and the
   prototype does exactly the same — `.nav-row` has no `white-space` on either
   side, `--nav-w` is 196 on both, and the `preview` tag takes the rest. It is
   1:1, not a port defect. If it should not wrap, that is a design decision and
   needs an ADR.
5. **Six modules are now unreferenced and were deliberately kept**:
   `useNativeInsertion`, `useRuntimeLogs`, `useTranscriptionHistory`,
   `useV1Slice`, `lib/appMeta` and `HotkeyRecorder`. Every one lost its only
   caller with a deleted area, and every one is the runtime-facing half Leg 4
   needs to wire the drawing — deleting them would mean re-deriving the IPC
   shapes from Rust. ADR 0054 deletes a replaced *area*; a hook that reads the
   runtime is not an area and has no replacement. `diagnosticsPolling.test.tsx`
   still exercises two of them.
6. **`npm run port:diff` is the regression check and it earned its keep.** All
   33 measurements came out **structural 0 | style 0** after a leg that moved
   two base rules, changed the window root, and put every settings screen inside
   a container it had never been in. The `text` column is entirely the recorded
   soft divergences — `--text` prints nothing. Run it after any shell change.
7. **`tauri.conf.json` now names the wrong thing twice.** The main window's
   label is `settings` and its title is `WordScript – Settings`; it is the
   workspace. The route `/settings` is kept for exactly that reason. Owed to the
   first leg allowed to open that file, together with the gallery's own window
   (ADR 0059 deletes the chord in that commit) and the stale `OverlayGallery.tsx`
   reference at `src-tauri/src/core/mode_router.rs:7`, which four legs have now
   carried.
8. **`docs/known-issues/` cites line numbers in files that no longer exist** —
   `capture-shortcut-recording.md` and `insert-behavior-reverts.md` point into
   `InputTab.tsx`, `ModesTab.tsx` and `SettingsWindow.tsx`. They are failure
   records rather than live pointers, so they were left as written; the P1
   mechanism `insert-behavior-reverts.md` describes (in-flight save counting)
   moved intact into `WorkspaceWindow.tsx`. Leg 6's drift check owes them a
   pass.

**The native host, and Leg 2d's owed check is answered.**

- **The workspace renders correctly.** The brand mark, four rows with Context
  tagged `preview`, the Settings row carrying `CTRL+,`, the profile row at the
  foot reading the real config, the content column centred on `--content-max`,
  and the strip along the bottom edge: `Ready · Groq cloud · whisper-large-v3 ·
  Clipboard only`, every value read from the runtime.
- **The sheet renders correctly and THE FROST PAIR RUNS UNDER IT.** The
  workspace behind it is visibly blurred — the nav at the top-left corner and
  the status strip at the bottom are legible as blur, not as a black rectangle.
  Ten rows in three groups, the profile in the header, the foot stating what the
  sheet does not do. This is ADR 0051's material doing the job the sheet was the
  original reason for.
- **THE AGENT OVERLAY IS SETTLED — all three of Leg 2d's checks pass.** The
  drawn pill is at the real geometry (40 px tall, max-content wide, mic glyph,
  bars, `• Agent`, `04:12`) and reads as the shipped pill. The agent window's
  rail and thread do not clip at 340 px — the desk, the target list, the thread
  and the answer meter all render inside it. The notification's orb **glows**: a
  warm radial with a halo bleeding onto the card behind it, not a flat disc.
- **Synthetic input still cannot be delivered**, so both the sheet and the agent
  overlay needed a hoist. A new trick worth keeping: to see something below the
  fold, a temporary `useEffect` that sets `.ws-content`'s `scrollTop` on a timer
  lets ONE build be captured twice, at the top and at the bottom. That is how
  the pill and the notification were both checked without a fourth build.
- The AppImage step still fails on `linuxdeploy`; the binary is built and runs.

### Leg 5 — the first leg into `src-tauri/`, and the mode that had been naming its own absence on two screens

**THE FIRST THREE ENTRIES ARE DONE, AND A FOURTH THE OWNER ASKED FOR MID-LEG.**
`ProcessingMode::Translate` exists and is selectable (ADR 0071),
`analyze_communication_style` returns the budget the meters had been mirroring,
`AppConfig.color_scheme` persists what the palette's theme rows change, and the
overlay names the target language (ADR 0073). Five commits. Entries 4 through 8
of the Leg 5 prompt are untouched and are Leg 6's.

**THE THING TO TAKE FROM THIS LEG: A DRAWING CAN BE OLDER THAN A DECISION, AND
FOLLOWING IT PAST ONE IS A REAL DEFECT.** ADR 0041 gave Translate four settings
and the prototype draws all four inside the Translate job on AI Models, two of
them tagged `Per profile`. So they were built there. Then the owner asked how the
mode is actually used, and the answer was three screens for one decision: pick
Translate on Profiles, set the language on AI Models, bind a key on Hotkeys.
**ADR 0068 had ruled on exactly this two days earlier**, for the communication
style, and its rejected alternative is one line — *beside the Rewrite job on AI
Models, which is machine-scope for a profile-scope value*. The drawing predates
the decision. ADR 0072 moves the two per-profile rows onto `Profiles → Defaults`
under the mode select and leaves them STATED on AI Models with the scope tag as
the door. **Before following the drawing, check whether a later ADR has already
answered the question it is answering.**

**AND THE SECOND ONE: THE OWNER REMEMBERED A DOCUMENTED WORKSPACE TAB, AND WAS
RIGHT ABOUT THE DOCUMENT AND WRONG ABOUT WHICH SURFACE.** ADR 0064 makes the
translation WINDOW a workspace view with a pop-out; it is a roadmap candidate
gated on streaming recognition per direction and text-to-speech, and neither
exists. ADR 0041's MODE is a different surface of the same capability, and the
prototype separates them under a heading that says so in as many words
(`demo.js:6911`, *"It is not the Translate mode, and it is not a second one"*).
Both records were quoted back rather than paraphrased, and that settled it in one
exchange. **The repo answers this class of question better than a rebuild does.**

**WHAT TRANSLATE ACTUALLY COST, against "one variant and one config field" in
the prompt.** The variant and the field are real, but the mode owns a prompt:
`core::translate` is a new module, because the correction prompt carries a global
rule that forbids translating and orders the language mix kept as dictated. A
translation cannot be that prompt with a flag on it — which is ADR 0041's own
argument, arriving as code. Four settings, two scopes, a seventh hotkey slot, a
seventh cycle entry, the overlay union, and the same-language behaviour written
into the prompt as a fixed consequence while the model still decides whether the
two languages match.

**IT SHIPS AHEAD OF ITS PHASE AND THAT IS RECORDED, NOT HIDDEN** (ADR 0071).
`ROADMAP.md:154` files the mode under Phase 4 because translation is where model
quality shows first. It runs on the chat model the product already has,
`llama-3.3-70b-versatile`. A mode with a mediocre model beats a control that
cannot act; the Phase 4 argument is an argument for a better model, not for no
mode, and it stays true afterwards.

**THE BUDGET METERS WERE HALF-HONEST AND ARE NOW WHOLE.** The runtime collapses
whitespace, drops a repeated rule and truncates a rule past 120 characters
before it counts, and every one of those only ever reduces — so the mirrored
count was a guarantee in one direction and a "maybe" in the other. A meter in the
red now means the runtime really did drop something. **The `dropped` list is not
drawn, on the owner's call**: the field's hint states the two rules a reader can
act on and `REFERENCE.md` carries the exhaustive table. A card enumerating the
declined lines would be a second place for style rules to live.

**WHAT IS DRAWN AND INERT, WITH THE REASON WHERE A READER CAN REACH IT.**

1. **`Into` and `Keep the profile's words` on AI Models.** Disabled and showing
   what the active profile holds, with the `Per profile` tag beside each as the
   working door (ADR 0072). Both classes already had a `disabled` rule from
   Leg 4c, so no new state was introduced.
2. **The language chip on the processing surface.** Drawn, no handler. By then
   the language is spent, and a press would change the next session while the
   chip states this one.
3. **Everything Leg 4c left inert is still inert**, minus the two Translate
   controls whose reasons this leg deleted.

**WHAT LEG 5 REMOVES FROM §2.5.**

- **Translate has no runtime mode** — closed. The Hotkeys row and the Profiles
  option both act, and both reason comments are gone from the source.
- **The style budget is not exposed over IPC** — closed.
  `analyze_communication_style` is registered and the meters read it.
- **No config field carries the colour scheme** — closed. `color_scheme` is on
  `AppConfig`, normalized to one of three, defaulting to `dark`.

**WHAT LEG 5 ADDS TO §2.5.**

- **`retry_transcription_history_entry` does not route by mode.** A retried
  Translate record comes back cleaned up rather than translated, exactly as a
  retried Agent or Prompt Enhance record does. Pre-existing for two modes,
  visible for three now. **One job for all three, not one for Translate.**
- **§15.3's native half is still owed.** `color_scheme` persists the choice and
  the workspace follows it; `window.theme()` and the Tauri theme-changed event
  are not wired, and the overlay window does not read the scheme at all. The
  overlay is rule 5 and was left alone apart from what the mode forced.
- **The gallery cannot reach a wired screen's runtime states**, which is what
  made the Style meter and the two AI Models rows unverifiable outside the
  native host. Not new, but this leg is the first where it blocked a check.

**Findings for Leg 6.**

1. **`npm run port:diff` WAS BROKEN ON EVERY SCREEN AND NOTHING SAID SO.** Its
   Chromium path was pinned to `chromium-1232`, a Playwright revision that no
   longer exists on this machine, and the failure was a bare `ENOENT` from
   `spawn` with no message about why. It resolves the newest installed revision
   now and errors with an instruction if there is none. **A check that cannot
   run is worse than a check that fails.**
2. **`import -window` no longer works on this machine.** Leg 4d's screenshot
   instrument fails with `missing an image filename` for every argument,
   including `-window root`, although the X11 delegate is built in.
   `spectacle -f -b -n -S -e -o <file>` works, and the desktop is **two monitors
   at a 1.6 device-pixel scale** (`6912x2508` for a `4320x1568` logical layout),
   so a crop to an `xdotool` geometry must multiply by 1.6 first. That cost
   several attempts and is written down so it costs none next time.
3. **THE NATIVE-HOST CHECK DID NOT HAPPEN AND THAT IS THE ONE THING THIS LEG
   OWES.** A `tauri dev` host was up the whole leg and hot-reloading, but the
   window sat behind the owner's browser and then moved off-screen, and raising
   it would have taken the focus of somebody working at the machine. The pill
   was measured in Chromium instead — see finding 4 — and the four wired
   surfaces were not looked at. Every state involved is one the design system
   already draws: `.ws-sel` and `Toggle` have had `disabled` rules since Leg 4c,
   and nothing new was disabled. **Look at Profiles → Defaults under Translate,
   the Style meter, the AI Models Translate rows and the pill before building on
   them.**
4. **The pill was measured rather than argued about.** In the gallery's overlay
   page: the language chip is **30 px** and the recording pill in Translate is
   **282 px** unscaled, against the 480 px window whose overflow clips the
   rounded ends. The widest pill on the page is 427 px and is unaffected. That
   is real headroom, in Chromium metrics; WebKitGTK differs and not by 200 px.
5. **A `Write` to a path that already exists overwrites it silently.**
   `WorkspaceWindow.test.tsx` existed with 17 tests and was replaced with 4. It
   was caught because the suite total FELL — 417 to 404 across a leg that only
   added tests — and recovered from git in full. **Watch the total, not the
   colour.**
6. **Four orphans, still four.** `DangerRow`, `Inspector`, `PaneGroup`,
   `VolumeSlider`. Nothing was deleted.
7. **`tauri.conf.json` still names the wrong thing twice**, `mode_router.rs:7`
   still cites `OverlayGallery.tsx`, and the gallery still has no door in the
   native host. Eight legs have carried these, and **`src-tauri/` is open now**,
   so two of the three stopped being rule 6 and started being a choice.
8. **`port:diff` is 26 of 28 at zero and the two recorded departures, unchanged
   through five commits.** `models` moved to structural 0 and back within the
   leg, which is the script doing its job: wiring the four Translate rows left
   it at zero, and it was the ADR 0072 rewrite that had to be checked rather
   than assumed. `profiles` never moved — the two new rows render only under
   Translate and the gallery's drawn mode is `auto`.

**Checks at the close.** 427 frontend tests across 39 files (from 414 across 38),
`cargo test` 645 (from 623), `npm run build` green, `port:diff` 26 of 28 at
structural 0 | style 0. The suite was run after every commit and twice at the
end.

### Leg 6 — the promise that turned out to be a folder, and the retry that had been running the wrong job

**ALL SEVEN ENTRIES ARE DONE, AND AN EIGHTH THE OWNER RAISED MID-LEG.** Six
commits, four ADRs (0074, 0075, 0076, 0077). Entry 8 — the five missing
surfaces — is untouched and is Leg 7's, by name, at the top of its prompt.

**THE THING TO TAKE FROM THIS LEG: A COST ARGUMENT CAN BE VOIDED BY ONE
SENTENCE, AND THEN THE DECISION HAS TO BE RE-MADE ON ITS OWN GROUNDS.** The
Markdown-file promise was put to the owner as keep-or-retire with a
recommendation to retire, and the recommendation rested on two costs: the
backfill of 174 records, and two stores that drift. The owner voided the first
in a sentence — *"auf die vorhandenen Einträge kannst du komplett scheißen, wir
sind im Development-Modus"* — and asked for it to be reconsidered. Reading
§11.23 then settled it the other way: it is not a label on a drawing, it is a
designed requirement with a module name, a path scheme, a frontmatter schema, a
`## Heard` rule and a stated reason, and it even names `reveal_item_in_dir` as
the implementation. **A recommendation made without reading the section that
designed the thing is not a recommendation.** ADR 0074 records the case for
retiring in full, including the one argument that survives, because the next
person to ask deserves the real reasons rather than the outcome.

**AND THE SECOND ONE: THE OWNER ANSWERED THE OBJECTION THE ADR RAISED AGAINST
ITSELF, AN HOUR AFTER IT LANDED.** ADR 0074 named its own weak point — a slug
from the first words gives a thing with no title a filename, and
`ja-genau-mach-das-mal-so.md` is a file nobody will find — and accepted it on
the grounds that the clutter is honest. The owner asked why the model already in
the pipeline does not just write the title. It should, it does now (ADR 0077),
and the three properties that make it safe are worth carrying forward: the call
is made AFTER the text has reached the cursor, any failure falls back to the
deterministic slug, and it arrives at the history funnel as an ARGUMENT rather
than as a call inside it — because that funnel is synchronous and is the one
place a file comes into existence.

**WHAT THE TRANSCRIPT STORE ACTUALLY COST**, against "a reveal command" in the
prompt. `core::transcript_store` is a new module; the history entry grew three
fields (`transcript_path`, `effective_mode`, `fallback_acknowledged`); every
entry constructor and every one of its eleven call sites moved; `chrono` became
a direct dependency (already in the lock file, not in any target's graph, so it
is a real compile); retention, delete and clear each grew a second thing to
remove; and `paths.rs` grew a root that lives OUTSIDE the user data directory
and still has to divert under test. Entry 2 and entry 3 of the prompt were one
job and the prompt said so.

**THE RETRY HAD BEEN RUNNING THE WRONG JOB FOR TWO MODES SINCE THEY SHIPPED**
(ADR 0075), and it was invisible for the ordinary reason: a conservative cleanup
of an instruction looks like a plausible answer rather than like the wrong
transform having run. It could not be fixed where it was — the only
implementation of "which transform does this mode run" was fifteen lines of
`match` inside the native pipeline's async closure, holding four of its locals.
It is `core::mode_router::apply_mode_transform` now and both callers use it.
**The record also could not answer the question**: `work_mode.processing_mode`
is the profile's STORED mode and keeps `auto` for an Auto record, so
`effective_mode` had to exist before the routing could be right.

**WHAT LEG 6 REMOVES FROM §2.5.**

- **The Markdown-file promise** — kept rather than retired (ADR 0074).
- **`Show transcripts in file manager` has no command** — closed, on all three
  surfaces, and the three reasons were deleted in the commit that made them
  false.
- **`retry_transcription_history_entry` does not route by mode** — closed
  (ADR 0075). It was Leg 5's own addition to the list.
- **Full export, Full import and Reset all settings have no command** — closed
  (`core::backup`).
- **§15.3's native half** — closed for the shell. The OVERLAY half is not a
  wiring gap and is recorded as such below.
- **ADR 0044's three sources have no receiver** — shrinks to two. The insert
  fallback has one (ADR 0076); the desk and a meeting's open questions do not.

**WHAT LEG 6 ADDS TO §2.5.**

- **`duration_ms` is in §11.23's frontmatter and the record has no source for
  it.** The field is deliberately not written rather than invented, and a test
  asserts its absence so a later leg adds it on purpose. One measurement, on the
  pipeline that already times itself.
- **The transcript root is not configurable.** §11.23 puts it beside the notes
  root on `Settings → Notes & Meetings`, which is a V2 screen with a banner.
  Until that screen exists the root is `~/WordScript/transcripts` and History's
  foot states the resolved path.
- **The title costs a model call per dictation and nothing states it.** It is in
  ADR 0077 and in the changelog; it is not on any surface. Whether it should be
  — a row on AI Models' job list, which is where every other model choice lives
  — is drawn design work and belongs with the five missing surfaces.

**WHAT IS DRAWN AND INERT, WITH THE REASON WHERE A READER CAN REACH IT.**

1. **`Show in file manager` on a record that produced no text.** The one
   remaining case, and it is the same shape Retry already had on a record whose
   audio was swept: drawn, disabled, reason as the tooltip (ADR 0065).
2. **Everything Leg 4c and Leg 5 left inert is still inert**, minus the five
   controls this leg gave a command to.

**Findings for Leg 7.**

1. **SYNTHETIC KEYS REACH WEBKITGTK; SYNTHETIC CLICKS DO NOT — AND LEG 4D'S
   NOTE WAS ABOUT THE WRONG MECHANISM.** `xdotool key --window <id>` sends
   XSendEvent and is ignored, which is what Leg 4d measured. **`xdotool key`
   with no `--window` goes through XTEST and works**: `ctrl+k` opened the
   palette, `xdotool type` filled it, `Return` navigated. Clicks stay dead
   either way, and scroll works only downward. **This makes the command palette
   the instrument for driving the product surface** — three of this leg's four
   native-host checks were reached without touching the source. Where the
   palette cannot reach (a sub-tab, a collapsed job row), the temporary mount
   effect is still the answer.
2. **`pkill -f <pattern>` MATCHES THE AGENT SHELL'S OWN COMMAND LINE, and the
   relay's warning is narrower than the trap.** The rule is written as "no
   `pkill -f vite`"; it cost this leg a killed shell (exit 144) on
   `pkill -f "chromium-1237.*wordscript-port-diff"`, because the pattern was in
   the `bash -c` line running it. **Kill by PID, always, whatever the pattern.**
3. **THE STORE WAS VERIFIED ON REAL DICTATIONS IN THE RUNNING HOST**, which is
   better than any screenshot. The owner dictated through the leg, `tauri dev`
   hot-reloaded, and `~/WordScript/transcripts/2026/08/` filled with their own
   sentences — correct local time with the `+02:00` offset (so `chrono`'s
   `Local` works in the packaged environment), `mode: cleanup` from the new
   `effective_mode` on a record dictated under Auto, `delivery: clipboard`, and
   German slugs with their umlauts intact. **ADR 0077 was verified the same
   way, one commit later, and the folder carries its own before-and-after**:
   `10-2234-kurzfrage-macht-es-nicht-mehr-sinn-dass-das-glei.md` was written by
   the first-words slug, `10-2248-language-chip-problem.md` and
   `10-2250-status-pages-erstellen-und-verwalten.md` by the model — in the
   dictation's own language, which is the rule the prompt spends its longest
   line on.
4. **ALL FOUR OWED SURFACES ARE ANSWERED, AND THE FOURTH FOUND A BUG.**
   `Profiles → Defaults` under Translate draws both rows between the mode select
   and Delivery, nothing clipped, and the list subline moves with it. The Style
   meter reads **247 / 400** where the field holds **256** characters — the
   runtime's number, not the textarea's, which is exactly what Leg 5 built it
   for. AI Models draws `Into` with its `Per profile` tag and a visibly dimmed
   select beside it, with the two machine-scope rows below it bright. **The
   pill's language chip could not be reached from here** — the overlay window is
   `visible: false` until a session runs, so seeing it means running a Translate
   dictation on the owner's microphone, which is not something to do unasked —
   **and the owner answered it directly: the chip works and steps through the
   languages, and changing the language GHOSTS at the pill's edges.** That is
   recorded in `docs/known-issues/overlay-ghosting.md` as the 2026-08-10
   addendum, with the reason it matters: the chip's width is fixed by design
   (ADR 0073 chose two-letter codes for exactly that), so it is the first case
   in that file that the standing 27px pill-width hypothesis cannot explain. No
   workaround, on the owner's instruction — documented, with a fifth row for the
   measurement table.
5. **RETRY WAS GREYED OUT ON EVERY RECORD THAT HAD SUCCEEDED, and the owner
   found it by asking why.** `TranscriptRow` disabled the control on a missing
   `audio_path`, which is one of the runtime's two retry paths and not both: a
   record holding its raw transcript re-runs the transform and needs no capture.
   A successful run deletes its audio, so the entire set somebody would want to
   re-run — after fixing a profile, after changing a model — was refusing, while
   `retry_transcription_history_entry` would have run any of it. Fixed in this
   leg. **The class is worth carrying: a UI precondition that is STRICTER than
   the runtime's is invisible to every test that asserts the control is
   disabled**, and this one had one.
6. **THE STYLE METER IS HONEST ABOUT DROPS AND SILENT ABOUT TRUNCATION.** Both
   of the owner's two style rules are 124 and 131 characters and both are cut at
   120 with `...` appended — which is where 256 becomes 247. The meter reads
   black, `dropped` is empty, and two of two rules are losing their tails.
   Leg 5's record says "a meter in the black is a guarantee that nothing was
   dropped"; that is true and it is not the same as nothing being lost. Not
   fixed here — it is the Style card and not on this leg's list — but it is a
   real gap between what the meter implies and what happened. Written up as
   `docs/known-issues/style-rules-are-truncated-without-saying-so.md` with the
   four possible fixes, all of them product decisions rather than repairs.
7. **A BANNER CAN GO STALE IN A LEG THAT NEVER OPENED THE SCREEN.** Profiles was
   still saying *"Translate is not a mode the runtime carries"* — false since
   Leg 5, which deleted four control-level reasons and left the banner. It was
   caught in the first native-host screenshot of this leg, before any code was
   written. **When a leg deletes a reason, grep the banners too.**
8. **`npm test` IS NOT `npm run build`.** The suite was green with a mock whose
   signature `tsc` rejects, and only the build caught it. Run both; the relay
   says so and this is the leg that paid for it.
9. **Four orphans, still four.** `DangerRow`, `Inspector`, `PaneGroup`,
   `VolumeSlider`. Nothing was deleted.
10. **`tauri.conf.json` still names the wrong thing twice** and `mode_router.rs:7`
   still cites `OverlayGallery.tsx`. Nine legs have carried these; `src-tauri/`
   has been open for two of them, so they are a choice rather than a rule.
11. **`port:diff` is 26 measurements now, was 28.** `history` and `privacy` left
    the gallery with their screens. Every one is **structural 0 | style 0**
    except `profiles`, which is ADR 0068's recorded departure. **`history`'s
    recorded departure (ADR 0070) is gone with the screen** — the segment is
    still on the product, there is simply nothing left to measure it against.

**A SEVENTH ENTRY THE OWNER ADDED AFTER THE LEG WAS PUSHED.** The title
ADR 0077 produces is useful one row further in: History drew 174 rows each
opening with the first sentence of a dictation, so the folder had become
scannable and the list had not. ADR 0078 gives ADR 0070's segment a third
reading, `Title`, and makes it the default — `Heard` stays, because the job it
was added for has not gone away. The same look found the Retry defect above.

**Checks at the close.** 439 frontend tests across 39 files (from 427),
`cargo test` 670 (from 645), `npm run build` green, `port:diff` 25 of 26 at
structural 0 | style 0. The suite was run after every commit and twice at the
end.

### Leg 4d — the surface nobody could see, the surface nobody had ported, and one decision the owner handed back

**ALL FOUR POINTS ARE DONE, AND A FIFTH THAT WAS ONLY "TO BE DISCUSSED".** The
communication style has a tab (ADR 0068), the search field is mounted in both
sidebars with the command palette behind it, Help opens four addresses over its
own row (ADR 0069, replacing 0066's modal), the profile subline is decided and
tested, and History's row title got the `Written` / `Heard` segment the owner
left to my judgement (ADR 0070). Nothing was wired, because there was nothing
left to wire: the four banners on Context, Notes & Meetings, Agents and
Integrations are untouched and the gallery still holds twenty entries.

**THE THING TO TAKE FROM THIS LEG: THE PROTOTYPE STILL CONTAINED THE ANSWER,
TWICE, AND BOTH TIMES IT WAS A DEAD FUNCTION.** `meterLine(used, max)` sits in
`demo.js` beside `textarea()` and `kbd()` and **nothing calls it** — it is the
only builder in that file with no caller, and `.meter` is in `demo.css` beside
it. It was written for the communication style's two bounded fields and stayed
behind when the card was relocated into the profile and never drawn there. So
the budget meter ADR 0068 asks for is a PORT with provenance rather than new
design, and Leg 4d is only its first caller. The same check found the second
one: `navSearch()` is called from **three** sidebars in `demo.js` (1765, 1806,
1847), not one, so the settings sheet's nav carries a search field too — three
legs of comments said "no search field here" about a place the prototype draws
one. **Before drawing anything the prototype "does not have", grep for a
builder nobody calls.**

**THE COMMUNICATION STYLE IS VISIBLE, AND THE FIRST THING IT SHOWED WAS THE
DEFECT.** The profile `Product and engineering` on this machine carries
`register: quick` with 256 characters of style rules — including a loaded
German lexicon line and a rule about working curse words into the output — that
have been applied to every Rewrite under that profile with no surface anywhere.
It is on screen now, in the native host, and that screenshot is the whole
argument for ADR 0068. The runtime did not change: no Rust, no migration, no
new field.

**THE PALETTE IS THIRTY-ONE ENTRIES, NOT THE TWENTY-SIX THIS RELAY SAYS.**
Counted off `CMDK_INDEX` and asserted in `palette.test.ts` so the correction
outlives this paragraph: twelve `Go to`, thirteen `Settings`, six `Do`. The
prompt's "another eleven" was an estimate. Twenty-five of the thirty-one are
navigations and `runtime.open` answers every one.

**THE SEAM HELD AND THE LIBRARY GREW BY THREE.** `Palette` and its six parts,
`BudgetMeter`, and `Menu` gaining `onSelect` / `disabled` / `align` — its first
LIVE caller after three legs as a drawn-only component. The index and what each
row does stayed in `windows/workspace/palette.tsx`, because a library component
that knew this window's views and sections would be the second product ADR 0055
forbids. `Sheet` grew `closeOnEscape`, which is the Escape stack the prototype
states and never had to build: palette first, then the sheet.

**WHAT IS DRAWN AND INERT, WITH THE REASON WHERE A READER CAN REACH IT.**

1. **The Style card's length, rules and sample while the register is `Off`.**
   `is_active()` gates the whole block in `core::communication_style`, so all
   three genuinely cannot reach a prompt. The reason is a `Note` under the card
   and NOT a `title`: a disabled control takes `pointer-events: none`, so a
   tooltip on one is a reason nobody can hover.
2. **`Show transcripts in file manager` in the palette** — the same hole
   History's row has. The reason goes in the path column, which normally names
   the room a setting lives in.
3. **`Restore last clipboard insert` and `Copy last transcript`** when there is
   nothing to act on. They ask `native_insertion_status.last_transcript` rather
   than guessing from `state.lastResult`, because the window's memory and the
   runtime's scratchpad disagree the moment the window is reopened over a
   running process.
4. **Help's `Documentation`.** Two of ADR 0066's three URLs did not exist; the
   owner supplied the Discord invite and named `wordscript.dev`, and said the
   documentation has no link yet. It is drawn with `No address yet` in its hint
   rather than left out, because a missing entry teaches the reader that
   WordScript has no documentation.

**WHAT LEG 4D ADDS TO §2.5.**

- **The style budget is not exposed over IPC.** `MAX_STYLE_RULE_CHARS`,
  `MAX_STYLE_SAMPLE_CHARS` and `CommunicationStyleAnalysis` — which reports what
  was accepted and what was dropped — are all in `core::communication_style` and
  **no command returns any of them.** The meter mirrors the two constants and
  counts what was typed. Those are not the same number: the runtime collapses
  whitespace, drops duplicate rules and truncates a rule past 120 characters
  before it counts, and every one of those steps only ever REDUCES. So a meter
  in the black is a guarantee that nothing was dropped and a meter in the red is
  a maybe, which is the honest half of the contract. One command returning
  `CommunicationStyleAnalysis` closes it and would also give
  `Check against a sample` somewhere to put an answer.
- **No config field carries the colour scheme.** The palette's three theme rows
  call `useColorScheme` and change THIS window: nothing persists the choice, a
  restart loses it, and the overlay window does not follow. §15.3 already owes
  the native half (`window.theme()` and the Tauri theme-changed event); the
  config field is the cheap half and it is now reachable from a control the
  product ships.
- **`Show transcripts in file manager` has no command**, and it is now visible
  from a second surface rather than one. Unchanged as a fact; changed as a cost.

**Findings for the next leg.**

1. **THE NATIVE HOST ON THIS MACHINE IS ALREADY RUNNING AND IT HOT-RELOADS.** A
   long-lived `npm run tauri dev` (a debug binary plus the Vite server on 1420)
   was up for the whole leg and picks up the working tree in about a second. It
   is a far better instrument than `npm run tauri build` at 3m 43s — and it may
   be the owner's own session, so do not kill it and do not leave temporary code
   in the tree longer than one screenshot.
2. **FAST REFRESH PRESERVES COMPONENT STATE, so a temporary `useState` default
   does not drive anything.** Changing `useState("home")` to `useState("history")`
   and saving changes nothing on screen. A temporary MOUNT EFFECT does, because
   adding a hook changes the signature and forces the remount.
3. **Synthetic clicks do not reach the WebKitGTK window; synthetic SCROLL
   does.** `xdotool click 1` on a nav row is ignored, `xdotool click 4/5` scrolls
   the pane under the pointer. That is enough to read a card below the fold and
   not enough to change a tab.
4. **`xdotool search --pid` does not AND with `--name`.** Two hours of this leg
   went into screenshots of a window that belonged to a different process.
   Confirm with `xprop -id <win> _NET_WM_PID` before believing a window id.
5. **`port:diff` is 26 of 28 at zero and two recorded departures.** `profiles`
   carries the sixth sub-tab and the fifth legend row (ADR 0068); `history`
   carries the segment and the narrower search field it leaves room for
   (ADR 0070). Everything else is **structural 0 | style 0**, and one regression
   was caught only by the script: `flex: none` on `.ws-subtabs button` measured
   against the prototype's `0 1 auto` on all eight sub-tab rows in the port. The
   wrap needed `flex-wrap` and `max-width`, not a shrink override.
6. **Four orphans, still four.** `DangerRow`, `Inspector`, `PaneGroup`,
   `VolumeSlider`. Nothing was deleted. `Menu` left that neighbourhood by
   getting a caller rather than by being removed.
7. **The AppImage step still fails on linuxdeploy** and the binary is still
   built. One release build was spent this leg and it turned out not to be the
   instrument — see finding 1.
8. **`tauri.conf.json` still names the wrong thing twice**, `mode_router.rs:7`
   still cites `OverlayGallery.tsx`, and the gallery still has no door in the
   native host. Seven legs have carried these; all three are rule 6.

**The native host, and what it settled.** WebKitGTK, the running dev binary.

- **The Style tab draws the disabled state and the enabled one.** Under `Off`
  the length select and both fields are visibly dimmed; under `Quick message`
  the same select is bright and the live rules are on screen. That is Leg 4c's
  finding 1 answered for the new controls.
- **Six sub-tabs WRAP inside the profile pane** — `Defaults · Style · Context ·
  Words · Replacements` on one line, `Snippets` on the second, nothing clipped.
  At the gallery's wider column all six fit on one line, which is the rule
  working rather than two behaviours.
- **The palette renders** — panel, frost, group headings, the path column, the
  selection ground, the foot — **and the two inert `Do` rows are drawn dimmed**,
  which is `.ws-cmdk-row[disabled]` doing its job. It was also caught standing
  over the settings sheet with BOTH layers receding, which is ADR 0051's nesting
  in one screenshot.
- **The search field is mounted in the workspace sidebar and in the sheet's**,
  drawn as the prototype draws it, with the `Ctrl K` cap on the control it
  accelerates.
- **The profile list finally discriminates**: five profiles read
  `Auto · Clipboard only` and one reads `Auto · Quick-message register`.

**Checked in Chromium rather than in the host, and said so rather than implied.**
The budget meter (`0 / 400`, and the over-budget state computing to `--danger`
for both the count and the bar), History's toolbar with the segment at the
toolbar's own 28 px, and the Help popover's two new rules —
`.ws-menu[data-align="start"]` resolving to the anchor's 211 px instead of the
float bar's fixed 230, and a disabled entry at `opacity: 0.4` with
`pointer-events: none`. The Help POPOVER in place in the sidebar is the one
thing this leg did not get a native screenshot of; its parts are all measured
and its component is the float bar's.

### Leg 4c — the last six wireable screens, and the rule that had no styling

**EVERY WIREABLE SCREEN IS WIRED. TEN ROWS BECAME FOUR.** The six the Leg 4c
prompt named — Hotkeys, History, Profiles, AI Models, Home, Privacy & Data —
are all done, in that order, and the four that remain are the four that were
never Leg 4's: Context, Notes & Meetings, Agents and Integrations. Every one of
those keeps its banner and its gallery entries, and deleting one would be the
error rather than the goal.

**One of the six lost its banner outright: Hotkeys.** Every fact on it has a
source, so it left the gallery in the commit that wired it and its assertions
moved out of the fidelity suite — a retired screen has no measurement left.
**The other five are wired IN PART and still say so**, which is
what the prompt asked for and what `registry.test.tsx` enforces: History, Home,
Profiles, AI Models and Privacy & Data all read the runtime for most of what
they draw, keep a banner naming exactly what they cannot read, and keep their
gallery entry with it.

**THE ONE THING TO TAKE FROM THIS LEG: A RULE WITH NO STYLING IS NOT A RULE.**
ADR 0065 says a control that cannot act is disabled rather than deleted, and
that the vocabulary for it already exists. It half did. `Button`, `IconButton`,
`Toggle` and `Stepper` each had a `[disabled]` rule in `shell.css`; **a segment,
a provider chip, a select, a text field, a hotkey target and a flag did not.**
So three greyed-out provider lanes were not greyed out, seven inert provider
chips looked exactly like the one that works, and every unit test asserting
`toBeDisabled()` passed the whole time. It was found in WebKitGTK, by looking.
Five rules and one `:has()` later it is true. **If a leg adds a state, it checks
that the design system draws that state** — jsdom cannot, and the gallery cannot
either, because the prototype draws no disabled control anywhere.

**THE SEAM GREW A THIRD SHAPE AND IT WAS FORCED BY THE GUARD, not chosen.**
`WiredScreenProps.runtime` is required, which is what retires a gallery entry
(ADR 0057). But `registry.test.tsx` also holds the other direction: a screen
with a banner must KEEP its entry — and an entry renders `() => <X />` with no
props. A partly wired screen is therefore both things at once, and the only
shape that satisfies both is `PartlyWiredScreenProps`, whose `runtime` is
optional and whose absence means "you are standing in the gallery".

It is still ONE implementation, and that is the whole discipline of it: **what
branches is where a row comes FROM, not how it is drawn.** History computes a
`HistoryRow[]` from `transcription_history_entries` or from `data.ts` and
renders one list; Home does the same; Profiles branches per control and meets on
the same card. When the last unreadable fact on such a screen gets a source, it
moves to `WiredScreenProps` and loses banner and entry in one commit.

**P1 HAS BEEN RUN, AND IT HOLDS.** Leg 4b built the debounce and said plainly
that nothing called it. Profiles' Context tab is the first text field in the
product, so `patchText` finally has a caller — and `useConfigDraft.test.tsx` now
exercises the mechanism rather than the screen: the draft is in the form on the
keystroke, one write per burst instead of five a second, an explicit flush
cancels the pending timer, an unmount loses nothing, a refused save puts the
form back, and **a discrete patch flushes the pending text commit first**, so a
keystroke typed before a toggle cannot land after it and revert it. That last
one is the reason the hook is shaped the way it is and it had never been tested.

Adding a word on the Words tab takes `patch` and not `patchText`, and the
distinction is the seam rather than an oversight: it is one word and one write.

**WHAT WAS DELIBERATELY LEFT ABSENT OR INERT RATHER THAN INVENTED.** This is
what the leg was to be judged on, so here is every place it bit, and they are
not six different ways this time — they are three kinds.

*Inert with the reason on it (ADR 0065), which is most of them.*

1. **Translate has no runtime mode**, on both Hotkeys and Profiles. ADR 0041
   gave it a slot; `ProcessingMode` has six values.
2. **`Show in file manager` has no path and no command**, on History and on
   Home. The reason IS the button's label, because `IconButton`'s label is its
   tooltip — a disabled control with no explanation is the same defect quieter.
3. **Add, Edit and New profile have no drawn editor.** Delete needs none, so
   Delete acts.
4. **`Check against a sample` and `Show the effective bias`** are
   `analyze_text_rules`, a real command with nowhere drawn to put its answer.
5. **Three lanes, seven provider chips and ~40 job-row controls on AI Models.**
6. **Full export, Full import and Reset all settings** have no command at all.
7. **The profile health flag's click.** The count is read and the flag
   sentences are the button's `title`, because that is the only place on the
   drawing they fit.

*Absent, because the drawing's own rule says absent.*

8. **Home's decision inbox is not drawn on the product.** ADR 0044's three
   sources have no receiver, and the drawing already states the rule: *"Nothing
   is drawn here when nothing is owed; a standing all clear is furniture."*
   This is the one place on the surface where inventing content would invent a
   QUESTION rather than a label, and it is why Home keeps its banner.

*Stated as the runtime's, where the drawing drew one member of a family.*

9. **History's foot no longer promises a folder of Markdown files.** The
   runtime keeps one `history.json` and no per-transcript file exists, so the
   sentence states `transcription_history_storage_status`'s answer and both
   retention numbers from the config. `RawTranscript.path` is optional now and
   the wired path passes none. The Markdown-file PROMISE stays a Leg 5 contract;
   what may not stand is the product sending somebody to a folder that is not
   there.
10. **Home's hero says what the activation mode does.** "Hold in any app to
    dictate / Release to stop" is true of one of the three modes
    `activation_mode` takes, and the shipped default is not it. The drawing is
    kept verbatim as the `hold` member.
11. **Hotkeys' activation hint and closing note** are the runtime's timing
    constants and this session's platform summary.

**THE BADGE DERIVATION IS DECIDED AND WRITTEN DOWN**, because §2.5 recorded it
as nobody's decision. It is in `badgesFor` in `History.tsx` with the reasoning,
and in tests. `Failed` / `Empty` from `status`; ONE delivery badge from
`insert_mode` and never two; `Retried once` says *once* because `retry_of` links
exactly one level and the runtime keeps no count, so a second retry is a third
record rather than a "twice".

**And one place the derivation departs from the drawing's sample, on purpose.**
`Audio swept` is not drawn on every record whose audio is gone. A successful run
deletes its audio, so keying it off `audio_path` alone would put that badge on
nearly every row — which is exactly the defect §11.20 names, two thirds of a
list reporting that things went as expected. "The audio is gone" already lives
on the control it affects: Retry disables itself and says why. The badge appears
only where the fact is unexpected — a record that FAILED, which you would
reasonably retry, and cannot.

**ADR 0065's OPEN POINT WAS ASKED BEFORE ANYTHING WAS GREYED OUT, and it is
ADR 0067.** The owner's answer on 2026-08-10: *treat `local_preview` just like
the other unpublished AI model providers everywhere they come up — preview
badge, etc. — because it's not fully implemented yet.* So the governing property
is CONSISTENCY rather than location, and it splits three ways: a surface that
OFFERS a lane makes it inoperable; a surface that REPORTS what is running states
it and marks it (`Local runtime · <model> · preview` in the status strip); a
diagnostic prints the runtime identifier unchanged, because a diagnostic that
prettifies a value cannot be used to diagnose anything. Nothing leaves the
runtime.

**Findings for Leg 4d.**

1. **THE NATIVE HOST IS THE ONLY INSTRUMENT FOR A DISABLED STATE.** Leg 4b said
   a wired screen cannot be looked at in a browser; the sharper version is that
   `toBeDisabled()` in jsdom asserts the attribute and says nothing about
   whether a reader can see it. Every one of the five missing CSS rules passed
   its test.
2. **This machine disagrees with the drawing on more than Delivery did.** The
   config's trigger is a bare `Shift` with `double_tap`, pause is `Space`, abort
   is `Alt`; the drawing draws `Ctrl+Super` / `Ctrl+Space` / `Ctrl+Alt` on
   `Tap`. Retention is 7 days and 200 entries against the drawn 90 and 500.
   There are 174 transcriptions and 6 profiles against the drawn 7 and 3. Six
   screens, and every one of them caught something.
3. **`describeTextProfileWorkMode` returned the same string for all six
   profiles**, so the profile list's discriminating subline stopped
   discriminating. The drawing's `Auto · Insert at cursor` / `Rewrite · Client
   register` is a different derivation from the runtime's sentence. On §2.5,
   and it is History's-badges-shaped: decide it, do not guess it.
4. **A JSX `{" "}` is a second text node and `port:diff` sees it.** Three spans
   in Home's hero measured 0.015 px wide of the prototype until the space moved
   inside the string. Two style regressions were introduced this leg and both
   were caught only by running the script; neither is visible to a person.
5. **`port:diff` is 28 measurements now, was 29.** `hotkeys` left the gallery
   with its screen. Every remaining one is **structural 0 | style 0** and the 34
   text differences are Leg 2b's recorded soft divergences, unchanged. The list
   is in the 4d prompt so the number stays reproducible.
6. **Four orphans left**, not five. `RawPanel` is History's and is in use.
   `DangerRow`, `Inspector`, `PaneGroup` and `VolumeSlider` are still referenced
   by nothing and nothing was deleted.
7. **The AppImage step still fails on linuxdeploy** and the binary is still
   built; two builds were spent this leg, 3m 35s each, and batching the screens
   into one walk is what kept it to two.
8. **`tauri.conf.json` still names the wrong thing twice**, `mode_router.rs:7`
   still cites `OverlayGallery.tsx`, and the gallery still has no door in the
   native host. Six legs have carried these; all three are one file Leg 4 may
   not open (rule 6).

**The native host, and it is where this leg paid for itself twice.** Two builds,
each walking the surfaces on a timer, `import -window` at the marks.

- **Hotkeys states this machine and the drawing is wrong about all four facts.**
  `Shift`, `Space`, `Alt`, all three `Registered`, and `Double tap` selected
  with the runtime's own sentence carrying its `400 ms` window.
- **History reads 174 transcriptions**, real German dictations from 02:46, every
  one carrying `Clipboard only` derived from `insert_mode` and nothing else —
  the expected case carries no badge, which is the derivation working.
- **Profiles reads six profiles** with the active one badged, `New profile`
  visibly inert, and the six sublines identically worded, which is finding 3.
- **Privacy reads 200 entries and 7 days**, against the drawn 500 and 90.
- **Home says "Double tap in any app to dictate" over a single `Shift` cap**,
  states `Auto` from the mode router, lists five real records, and draws no
  decision inbox at all.
- **AI Models shows the ADR working**: four lanes drawn with three dimmed, eight
  provider chips drawn with seven dimmed, and the banner naming both ADRs. It
  is also the screenshot that found the missing CSS, because the first build
  showed the same screen with nothing dimmed.

**What is left. Four rows, and none of them is wiring.**

| Screen | State | Why |
| --- | --- | --- |
| `context` | **must not be touched** | The owner said on 2026-08-10 it is going to be done differently and deliberately did not say how. Mounted, V2 banner, three gallery entries, no design derived from the drawing |
| `notesettings` | **cannot** | V2 |
| `agents` | **cannot** | Phase 8, ADR 0030 |
| `integrations` | **cannot** | Phase 8 |

**Two things beside the ten are still owed and this leg did not fit them.** Said
plainly rather than quietly dropped, because three legs already carried the
second one as a principle when it was a gap:

- **The Help modal (ADR 0066)** — three links, two of which do not exist yet,
  and a link that opens a 404 must not be drawn. It is the first new UI this
  port would draw.
- **The search bar and the command palette behind it.** `NavSearch` is ported
  1:1 and mounted nowhere; the palette is `demo.js:8031–8366` and is the only
  prototype surface the port never carried. It is a PORT, not a design, and
  `runtime.open` now answers twelve of its twenty-six entries — the seam grew
  the door it needed in Leg 4b and used it on four screens in this one.

They are Leg 4d's, by name, at the top of its prompt.

### Leg 4b — the seam, the rebuild lab, and four sections of fourteen

**IT SPLIT AT FOUR AND SAYS SO.** Four of the fourteen mounted screens are wired
— About & Updates, Diagnostics, General, Delivery & Insert — plus the
`RebuildLabTab` restoration, which is the single largest item the Leg 4 prompt
named and is done. **Ten are left**, and they are listed at the foot of this
record with what each one needs. Reporting fourteen when four are wired is what
the prompt told this leg not to do.

**THE ONE THING TO TAKE FROM THIS LEG: THE COMPILER NOW ENFORCES ADR 0057.** A
wired screen takes `WiredScreenProps`, whose `runtime` is REQUIRED. The
gallery's registry renders `() => <X />` and passes nothing, so the moment a
screen is wired its registry entry stops compiling and has to go — in the same
commit, which is exactly what the ADR asks for. `registry.test.tsx` holds the
other direction: the prototype's 25 ids are frozen in it as provenance, and the
set missing from the registry must EQUAL the set the product mounts without a
banner. An entry deleted for tidiness fails; a screen wired without retiring its
entry fails. The count is derived from that subtraction rather than written
down, so the `toHaveLength(25)` that would have had to be edited fourteen times
— and that made the one honest edit indistinguishable from five dishonest ones —
is gone. That was this leg's first commit, before any wiring, as the prompt
asked.

**THE SEAM IS ONE OBJECT AND ONE READER.** `WorkspaceRuntime` in
`src/screens/props.ts`: `config`, `state`, `patch`, `patchText`, `flushText`,
`active`, and an optional `open`. One reader per window — `useRuntime` opens two
event channels and loads the config, so a screen calling it for itself would
double every listener and give two components two opinions of one config. The
window reads; the screen is handed the result. `active` is false while a surface
is mounted-but-hidden so a poll can idle, and `open` is optional because the
Diagnostics pop-out has nowhere to navigate to and a door that opens nothing is
the fake affordance rule 7 forbids.

**P1 AND P2 ARE FIXED AT THAT SEAM, and neither is visible in a screen — which
is the test that they are in the right place.**

- **P1** is `src/hooks/useConfigDraft.ts`, shared by both windows that hold a
  config draft. `patch` stays instant for a discrete control, because there is
  no such thing as a half-pressed toggle; `patchText` puts the draft in the form
  on the keystroke and debounces the write by 400 ms. **A discrete patch flushes
  a pending text commit first** — without that, a debounced keystroke can land
  after a later toggle carrying the config it was computed from, and quietly
  revert it. Leaving a screen and unmounting both flush. *Nothing calls
  `patchText` yet:* none of the four wired screens has a text field. It is the
  seam being ready rather than a fix being exercised, and the first screen with
  a text input — Profiles, AI Models — is where it earns its keep. Say so.
- **P2** was not what the plan's wording suggests. §2.4 says "drop
  `key={active}`", and Leg 3 had already dropped it — but a rendered element of
  a DIFFERENT TYPE unmounts the old one just the same, so the remount survived
  the rewrite and P2 was still true. Every view and every settings section the
  user has actually opened now stays mounted with the inactive ones `hidden`.
  They are SIBLINGS rather than one container with a swapped child because each
  keeps its own scroll box and its own `data-layout`; a surface nobody opened
  costs nothing. Two CSS rules were needed and they are the only two lines in
  `shell.css` this leg added that the prototype does not have: Tailwind's
  preflight declares `[hidden] { display: none }` in `@layer base` and
  `shell.css` is `@layer components`, so the LAYER — not the specificity — is
  why `.ws-content { display: flex }` would otherwise win.

**THE SHEET'S FOOT IS THE PROTOTYPE'S LINE AGAIN**, and it is derived rather
than typed: `SECTIONS.some((entry) => !entry.banner)`. A leg that somehow
un-wired all ten would get the honest line back without having to remember to.

**THE REBUILD LAB IS BACK, AND IT COST LESS THAN THE PROMPT BUDGETED.** The
reason is worth recording against the estimate: **`RebuildLabTab`'s three panels
ARE the ported screen's three tabs, and its three selects carry exactly the
prototype's three option lists.** `TRIGGER_OPTIONS` was "Hold to talk / Tap to
toggle / Diagnostics demo"; so is the drawing. `INSERT_TARGET_OPTIONS` was
"Editor preview / Clipboard fallback preview"; so is the drawing. Its ten
`MetaRow`s are the drawn Runtime-snapshot card's eight rows plus two. Whoever
drew this screen was reading the surface it replaces, so restoring it was a
mapping and not a rebuild. **The lesson for the remaining ten: read the pre-port
area out of `8f9077e^` BEFORE deciding what a row means.** `git show
8f9077e^:src/components/settings/<Tab>.tsx`.

`describeAppliedRule` — the ~40-entry vocabulary that knows what
`phrase_repetition_collapsed` is — came back as `src/lib/transformRules.ts`
rather than into a component, because it is runtime vocabulary and the next
surface that has to explain a rule should read it instead of writing a second
table. What did NOT come back is `parseRuntimeLogRuleHints`, and that is not a
loss: it scraped `rules=` out of log lines because the transform result was not
otherwise reachable, and on this surface the result IS reachable. It is
obsolete, not dropped.

**THE POP-OUT WAS WIRED BY THE SAME CHANGE**, because it mounts the same screen.
It reads the runtime for itself, which is NOT a second opinion of one config: it
is a separate webview with its own JavaScript context, so its `useRuntime` is
the one reader in ITS window. What must not happen — two readers inside one
window — does not.

**WHAT WAS DELIBERATELY LEFT ABSENT RATHER THAN INVENTED.** This is the rule the
leg was to be judged on, so here is every place it bit:

1. **The runtime log has no severity field.** `LogLine.level` is optional now
   and a real line draws with an empty gutter and no hue. The three levels stay
   in the component for the day the runtime emits one.
2. **Everything on Diagnostics that only exists after a check says `not run`**,
   and the rules list uses `CheckList`'s `todo` — the empty ring that means a
   probe that has not run — rather than a tick.
3. **About says "Not checked" in both release rows until the check answers**,
   and it does not ask GitHub for a section nobody opened.
4. **General's waveform stays at rest on the product surface.** Not laziness:
   `active` makes upstream open a microphone with `getUserMedia`, so driving it
   would have WordScript hold a second capture device for as long as a settings
   page is open — the exact signal ADR 0063's detection watches for. The
   measurement under it is live.
5. **Delivery's doors are absent in the pop-out**, because `open` is absent
   there.
6. **The diff marks on Diagnostics are computed from the two strings the runtime
   returned** — exact, not case-folded, because `capitalized_sentence_start` is
   one of the rules the list beneath is claiming.

**A FIFTH ORPHAN CAME BACK INTO USE AND THE PROMPT'S GUESS ABOUT TWO OTHERS WAS
WRONG.** The Leg 4 prompt listed six genuinely orphaned exports and guessed that
"at least `Inspector` and `RawPanel` look like Diagnostics' business". Measured:

- **`InputLevelMeter` is General's** and is now used. Five orphans left.
- **`RawPanel` is History's, not Diagnostics'.** It renders a `RawTranscript` as
  a Heard/Written pair inside `.ws-list-raw`, which is a history list item's
  disclosure body. It lives in `ListItem.tsx`.
- **`Inspector` is a generic slide-over** with a width and an Escape handler and
  belongs to no screen in particular. Nothing Diagnostics needed.
- `DangerRow`, `PaneGroup`, `VolumeSlider` unexamined beyond confirming they are
  still referenced by nothing.
- **Nothing was deleted.** Five orphans, all still there.

**Findings for Leg 4c.**

1. **A WIRED SCREEN CANNOT BE LOOKED AT IN A BROWSER, and that changes the
   check.** The workspace needs `invoke`; without the Tauri host it renders
   "Connecting to runtime…" and nothing else. The Leg 4 prompt's "look at it in
   the browser first — screenshots work" was written for gallery screens and
   stops being true for exactly the screens this leg produces. The browser is
   still the right instrument for the twenty-one screens still IN the gallery.
   **Budget one `npm run tauri build` per batch of wired screens, not per
   screen** — and batch them, because the build is the expensive part.
2. **Playwright's browser had to be installed.** `npx @playwright/mcp
   install-browser chrome-for-testing`, ~114 MB, once. `port:diff` wants
   `CHROME=` pointed at it: the script's default is `chromium-1232` and this
   machine has `chromium-1237`.
3. **`port:diff` is 29 measurements now, was 33.** `about`, `diagnostics`,
   `general` and `delivery` left the gallery with their screens. Every remaining
   one is **structural 0 | style 0**, and `--text` still prints nothing — the
   `text` column is entirely Leg 2b's recorded soft divergences, unchanged.
   The list this leg ran is in the 4c prompt so the number is reproducible.
4. **A command that answers with anything but a list crashes a screen that calls
   `.find` on it.** `WorkspaceWindow.test.tsx` mocks `invoke` to resolve
   `undefined` for every command, which is exactly what a runtime that does not
   know a command looks like. `Array.isArray` before `setState`, and treat "not
   an array" as "did not answer" rather than as "none" — the row then states the
   stored value rather than claiming the machine has no microphone.
5. **Run the suite twice before believing a failure.** One full run reported
   eight unrelated files failing with 5–15 s test durations, and a clean re-run
   was green. It was machine load (a browser download and a dev server), not the
   code.
6. **`pkill -f vite` kills the agent's own shell**, because the pattern matches
   the shell's command line. It cost one commit that silently did not run. Kill
   by PID.
7. **`tauri.conf.json` still names the wrong thing twice**, `mode_router.rs:7`
   still cites `OverlayGallery.tsx`, and the gallery still has no door in the
   native host. Five legs have now carried these; all three are one file Leg 4
   may not open (rule 6).

**The native host, and it is where the wiring paid for itself.** All four wired
screens were looked at in WebKitGTK, in one build that walked the sheet's
sections on a timer — synthetic input still cannot be delivered, so the trick is
Leg 3's `scrollTop` timer generalised to `setSection`, and it turns four builds
into one. `import -window <id>` at 14 s, 26 s, 50 s and 72 s.

- **The workspace renders correctly with P2's sibling scroll boxes.** Nav, the
  Home view with its banner, the strip along the bottom reading `Ready · Groq
  cloud · whisper-large-v3 · Clipboard only`. Nothing moved.
- **The sheet's foot reads "Every change applies as you make it."** and the
  frost is running under it.
- **General states the truth about THIS machine and it is not the drawing's.**
  The saved microphone is unavailable, so the row says so and keeps the stored
  value selected rather than silently showing another device. The meter reads
  "Speak to measure the level." with its threshold mark at the far left.
- **Diagnostics reads the live snapshot**: `idle`, `no session armed`, `groq /
  whisper-large-v3`, `Ready`, `auto → cleanup`, `native · 12 min cap · 0 s
  silence stop`. Every one of those is this machine's.
- **DELIVERY CAUGHT THE BEST ONE.** The drawing says `tier 1 · Linux · X11` and
  `Insert at cursor`; this machine reports **`experimental · Linux Wayland`** and
  the active profile is **`Clipboard only`**. A drawing of a plausible machine
  and the machine it is running on disagreed on four facts, and that is the
  entire argument for this leg.
- **About is talking to GitHub**: the runtime's own summary sentence, `In
  progress`, `Building`, and `npm run tauri build` for a built bundle.
- **One layout consequence worth passing on.** A long runtime hint beside a wide
  control collapses into a narrow column — General's unavailable-microphone
  sentence wraps to eight short lines next to a full-width select. The drawn
  hint was one short line, so the row was never laid out against a long one. It
  is the exceptional case rather than the normal one and no drawing was changed
  for it, but a screen with long runtime strings should expect it.

**What is left, and what each one needs.** Ten rows in `ia.tsx` still carry a
banner. Four of them are not Leg 4's at all.

| Screen | State | What it needs |
| --- | --- | --- |
| `hotkeys` | **wireable** | `HotkeyRecorder` (kept unreferenced for exactly this), `validate_shortcut`, `shortcut_vocabulary`, `shortcut_platform`, `shortcut_capabilities`, `native_trigger_status`, and the seven `mode_*_hotkey` config fields. Read `8f9077e^:src/components/settings/InputTab.tsx` and `ShortcutField.tsx` first — the trigger half of that area is this screen |
| `history` | **wireable, and bigger than it looks** | `useTranscriptionHistory` (kept for this), `transcription_history_entries`, `delete_…`, `retry_…`, `export_…`, plus `RawPanel`, which is History's and one of the five orphans. **Six per-row controls are drawn** — View raw, Show in file manager, Retry, Restore to cursor, Copy, Delete — plus two filters, a count and per-entry badges. Two of those have no runtime at all (see §2.5: the Markdown-file claim and Show in file manager) and the badges need a derivation decided rather than guessed. **Wire what reads, leave the two that cannot, keep the banner** |
| `profiles` | **wireable** | `config.text_profiles` end to end, `switch_active_text_profile`, `get_profile_health`, `acknowledge_profile_health_flag`, `analyze_text_rules`, `import/export_text_rules`, `useCaptureBudget`. **The first screen with text fields — `patchText` is waiting for it** |
| `models` | **partly, and it is now a small job** | **ADR 0065**: Groq is the only integrated lane. The UI does not change; Local, Self-hosted and Enterprise stay drawn and DISABLED. Wire the Cloud lane — `provider_status`, `save/clear/validate_provider_api_key`, `resolve_provider_tiers`, `resolve_capture_budget` — and disable the rest with the vocabulary the surface has. **Keeps its banner.** Ask the ADR's open question before greying anything: `local_preview` exists and the status strip reads it |
| `home` | **partly** | The hero and the record can read `state.lastResult` and the history; the decision inbox has no receiver and two Summary-tab gestures point at it (§2.5, Leg 2d). Wire what reads, keep the banner |
| `privacy` | **partly** | `history_limit` and `history_retention_days` are config; `clear_transcription_history_entries` is real. Export, Import and Reset have no commands at all, so it **keeps its banner and its gallery entry** |
| `context` | **cannot** | V2. The context object does not exist |
| `notesettings` | **cannot** | V2 |
| `agents` | **cannot** | Phase 8, ADR 0030 |
| `integrations` | **cannot** | Phase 8 |

**Two things beside the ten, both raised by the owner on 2026-08-10 and neither
of them one of the 25 screens.**

- **`Help` is a small modal** with Discord, GitHub and the documentation
  (ADR 0066), and its row is mounted in the commit that builds it. That is the
  first new UI this port has drawn — the prototype draws the row and not what it
  opens — so it is judged by eye rather than measured.
- **THE SEARCH BAR GOES BACK, 1:1, AND THE PALETTE BEHIND IT GETS PORTED.** The
  owner's words: *the searchbar 1:1 from the demo GUI was also forgotten.*
  `NavSearch` is already ported exactly and mounted nowhere; the palette is
  `demo.js:8031–8366` and is the only prototype surface the port never carried.
  It is a PORT, read per the method Leg 2 used — read the builder whole, read
  its rules in `demo.css`, put the rules in `shell.css` and not at a call site —
  and not a design job. Twelve of its 26 entries are navigations the seam can
  already do through `runtime.open`; one, *Show transcripts in file manager*,
  has no source and is the same hole as History's row, so it is drawn disabled
  per ADR 0065's rule rather than left out.

**Neither blocks the ten**, but the search bar is a visible absence in the
shipped sidebar rather than a deferred feature, so do not let it fall off the
end again — it has now been carried by three legs as a principle when it was a
gap.

### Leg 4a — six lifecycles, no code, and the two things the drawing caught

**FIVE ADRs AND THREE ROADMAP ENTRIES. NOTHING ELSE CHANGED.** `git diff` touches
`docs/` only: five new ADRs, the decisions index, `ROADMAP.md`,
`SETTINGS_REWORK_PLAN.md`, this file and `CHANGELOG.md`. No component, no route,
no token, and **no edit to `ia.tsx`** — including no comment, because a leg that
writes no code writes no code. 289 frontend tests and `npm run build` green,
both untouched.

| Surface | Shape of the answer | Where |
| --- | --- | --- |
| Onboarding | **Decision** | ADR 0060 |
| Agent overlay | **Decision** | ADR 0061 |
| Handoff | **Decision** | ADR 0062 |
| Meeting capture | **Decision, blocked on a capability** | ADR 0063 + the existing candidate, gate 1 closed |
| Translation window | **Decision, not scheduled** | ADR 0064 + a new candidate |
| Live subtitles | **Not yet, and deliberately no ADR** | a new candidate |

**THE ONE THING TO TAKE FROM THIS LEG: two answers were nearly written wrong,
and looking at the drawn surface is what caught both.**

1. **The notification does not retract when a dictation starts.** The draft of
   ADR 0061 had it fall back to the tab, with a decent argument — the
   microphone belongs to the user, so *answer out loud* is unavailable for the
   length of the capture, and a surface whose primary control cannot be used
   should not be standing. `Settings → Agents` already says otherwise, in a row
   nobody had read for this question: *"Remembered per monitor. It never covers
   the dictation overlay — it offsets above it while one is on screen."* The
   gallery is the source (ADR 0057), so the drawing wins and the ADR says the
   opposite of what it was about to say. **This is rule 4b's failure in its new
   form: deciding a lifecycle from a description when the drawing already
   answered it.**
2. **"Meeting capture is not on the roadmap" has been false since the day it was
   written.** §7 says it, §2.6 repeated it, and the Leg 4a prompt repeated it
   again — three documents deep. The candidate entry was added 2026-08-03,
   hours after the sentence. The two surfaces that genuinely had no roadmap home
   are the translation **window** (the mode has been Phase 4 since ADR 0041) and
   live subtitles.

**THE DONOR ANSWERED THE MEETING QUESTION AND MADE IT CHEAPER.** The owner
pointed at `donors/app/desktop-shells/openwhispr`, which is in this repo and had
not been read for this. Read for mechanism, not copied:

- `meetingProcessDetector` exists and its events are **deliberately
  context-only** — a running meeting app never triggers a prompt, because an app
  idling in the background is a false positive. **The detector that looks most
  obviously right is the one the donor disabled.**
- The trigger is `audioActivityDetector`, and it watches **another process
  holding the microphone** (`pactl list source-outputs` on Linux). Sustained
  over ~6 s polled, 2 s event-driven, 5-minute cooldown after a dismissal,
  queued rather than dropped while the user dictates.
- **So noticing a call needs no system-audio capture at all.** The expensive
  capability blocks recording, not noticing. §10.4's gate had assumed the
  detection prompt would be "a third surface to own"; it is ADR 0043's
  notification window with a different payload.
- Calendar reminders enter the same pipeline, 60 s before the start, with a
  five-minute imminence threshold deciding whether the prompt reads *starting*
  or *underway*.
- One rule was read and **not** taken: the donor's prompt auto-dismisses after
  30 s. WordScript's agent notification may not, because an unanswered question
  is still blocking somebody — but a *detection* prompt is an offer about
  something already happening, so it expires, and expiring is not a decline.
  Two windows, one family, two dismissal rules, and the difference is stated in
  ADR 0063 rather than left to whoever builds them.

**WHAT THE OWNER DECIDED AND WHAT WAS DERIVED.** Three questions were asked, in
one call, on the three where a wrong guess was expensive. Each ADR says which of
its clauses came from which.

- **Onboarding** — first launch, re-runnable from Settings. Everything else in
  ADR 0060 is derived: the window (there is only one), the writes (instant-save
  is the product's rule), the absence of a Skip (every step 1–5 is a
  precondition and the title bar already closes windows), and the derived resume
  point, which is the part that makes the flow idempotent.
- **Meeting capture** — the owner's answer was four ways in, not one of the
  three drawn: hotkey, calendar offering shortly before with a notification
  button, call detection with a notification button, and `Context → New →
  Meeting`. The fourth was **already drawn** and had not been counted as a way
  in: `Context → intake → Record` carries *Start recording*, the pane foot
  carries *Record meeting*, and a scheduled meeting carries *Record this*.
- **Translation** — the owner's answer moved the surface: it is a workspace
  **view** with a compact pop-out, not a standalone window, and a conversation
  is a context object **opt-in per session**. That connects to a §2.5 entry Leg
  2d had filed separately — *"consent is a field on a conversation and there is
  nowhere to put it"* — and makes it the same field. The owner named two open
  points himself (is a view enough interaction at a table, and does it need a
  processing mode of its own); both are in the ADR and in the roadmap gate,
  unsettled, because an implementation must not settle them quietly.

**WHY LIVE SUBTITLES GOT NO ADR, AND THAT IS THE ANSWER RATHER THAN A GAP.** An
ADR here is four questions — entered, held, dismissed, and what happens when the
thing it is about ends — and the rule the prompt set is *all four, or the surface
is still undecided*. Two of the four are answerable and are answered in the
roadmap entry: the echo belongs to **the profile** (the active profile at
capture start is what makes it appear for this dictation and not that one — the
same rule every other per-profile capture setting follows), and the strip's
placement reuses **the overlay's own placement grammar** per display, globally
rather than per source, because a strip you place once is a property of your desk
and a per-source memory would move it when you switch from a player to a call.
What turns captions on is not answerable: it is a control on a capture that does
not exist, and inventing its door now would be deciding the feature by naming its
entry point.

**Findings for Leg 4 and Leg 5.**

1. **`ENTRY_POINT_HOLES` was not edited and Leg 4 will meet it stale.** It still
   reads as though nothing is decided. The reconciliation table is in §2.6 above,
   under Leg 3's record; whoever mounts a surface updates its entry in the commit
   that mounts it. `ia.test.tsx` asserts all six are named and none is mounted,
   and that assertion is still exactly right.
2. **`Settings → Agents`'s `Show it` toggle is drawn as neutral and is not.**
   Off leaves the tab and the window as the only signals, which means a question
   raised while nothing is on screen is invisible until the budget expires —
   the failure ADR 0043 exists to prevent. **Do not wire that row without
   stating the consequence on it**, and changing the copy on a drawn row is a
   design change that needs its own record.
3. **The tray/dock presence state is the only decided-and-never-drawn surface
   this port has found.** ADR 0030 named it, ADR 0061 makes it load-bearing, and
   there is no 26th screen. It is both a Leg 5 contract and a drawing.
4. **Five of the six are Phase 6/8/V2 and Leg 4 wires none of them.** What Leg 4
   inherits from this leg is a list of what to skip and why, not new work.
5. **Nothing was mounted, nothing in `src-tauri/` was opened, and no overlay
   rule moved.** Rules 5 and 6 held; ADR 0061 needs the pill to change in no
   way, and it says so.
6. `docs/STATUS.md` was **not** touched. Nothing shipped, and product state is
   Leg 6's drift check. Same for `VISION.md`: two roadmap candidates are not a
   scope move — the roadmap already carries candidates outside the phases.
7. **THE PREVIEWS ARE ONE `git rm` FROM GONE, AND NOTHING GUARDS THEM.** Raised
   by the owner against this leg's own Leg 4 prompt, and he was right: the
   prompt said what to delete when wiring and never said what may not be
   deleted. Measured afterwards — **84 components in `components/shell/` are
   reachable only through the nine screens that are mounted nowhere**, and a
   screen's gallery entry is the only thing that references its family. One
   deleted preview entry orphans the whole family; the next "nothing imports
   this" pass takes ~700 lines of ported CSS with it. `registry.test.tsx`
   asserts exactly 25 screens, which **breaks on the first wired screen** — so
   the one commit where the count must be edited is also the commit where five
   more entries could go with it and every test would still pass. The guard is
   now a block in the Leg 4 prompt rather than a test, and a test would be
   better: an assertion that the registry never loses an entry whose screen the
   product does not mount would make this mechanical. **Leg 4 should write it.**
8. **Playwright screenshots DO work, and Leg 2a's record is wrong about it.**
   2a concluded *"screenshots could not be written to disk from the Playwright
   MCP server"* and measured computed styles instead, which is why three legs
   verified by numbers alone. They write fine — to the **process's working
   directory**, not to the `.playwright-mcp/` path the tool reports back, which
   is why the file looks missing if you go looking where it says. Pass a plain
   relative filename, then read it from the repo root. `.playwright-mcp/` is
   gitignored; a screenshot at the root is not, so delete it when you are done.
   The accessibility snapshot is still the cheaper instrument for copy and
   structure, but a leg that wants to *see* a screen now can.

## The prompt for Leg 7

You are picking up WordScript after Leg 6. Work in the repo root on `main`. Do
not create a branch. `src-tauri/` is open.

### What is already true

**Every screen the prototype drew stands, twelve of the fourteen mounted ones
are wired or wired in part, and the runtime contracts Leg 5 and Leg 6 named are
closed.** Every transcript is a Markdown file whose name a model writes
(ADR 0074, 0077); the reveal acts on three surfaces; a retry re-runs the mode
its record ran (ADR 0075); export, import and reset act with a snapshot first;
Home's decision inbox receives a fallen-back delivery (ADR 0076); the window
chrome follows the colour scheme. `npm run port:diff` is **26 measurements**,
25 at structural 0 | style 0 with `profiles` (ADR 0068) the one recorded
departure — `history` and `privacy` left the gallery with their screens.

**Nothing you find is a surprise.** §2.5 is the list of what the runtime cannot
answer, and Leg 6's record says which six entries it closed and which three it
added.

### Read this first

`docs/handoffs/HANDOFF_gui-port-relay.md`. **Leg 6's record is your starting
state, and its finding 1 changes how you look at anything** — synthetic KEYS
reach the WebKitGTK window through XTEST, so the command palette drives the
product surface without touching the source. Leg 4c's record carries the
disabled-state rule you are still held to. Then `CLAUDE.md`,
`docs/spec/SPEC.md`, and `src/screens/props.ts`.

### The order, and this leg is design rather than runtime

1. **THE FIVE MISSING SURFACES, AND THE GALLERY GROWS THEM FIRST** (ADR 0057).
   Add and Edit for replacements and snippets, New profile's rename, and where
   an `analyze_text_rules` answer goes. Every one of them is a control that is
   drawn, disabled and carrying its reason today, and every one of those reasons
   is *"there is no drawn editor behind this"* — a design gap, not a runtime
   one. `analyze_text_rules` is a real command with nowhere to put its answer.
   **This is bigger than it looks and it is the whole leg.** The prototype has
   no editor for any of them, so this is the first new DESIGN the port has had
   to do rather than carry across; read `demo.css` for the grammar and
   `docs/DESIGN_SYSTEM.md` for what the system already claims, and file an ADR
   for the shape you choose.
2. **If you have room: `duration_ms` in the transcript frontmatter.** §11.23
   asks for it, the record has no source, and `transcript_store` has a test
   asserting its absence so that adding it is deliberate. The pipeline already
   times itself.
3. **If you still have room: whether the title's model call belongs on a
   surface.** ADR 0077 spends a model call per dictation and no screen says so.
   Every other model choice lives on AI Models' job list. A row there is drawn
   design work, which is why it is in this leg's neighbourhood rather than in
   Leg 6's.

### The rules you will be judged on

**NEVER RENDER FAKE READINESS (rule 7),** in both directions: when you give a
control its command, DELETE the reason it was carrying — **and grep the BANNERS
too.** Leg 5 deleted four control-level reasons and left a banner on Profiles
saying Translate was not a runtime mode; Leg 6 found it in its first screenshot.

**A CONTROL THAT CANNOT ACT IS DISABLED WITH ITS REASON, AND THE DESIGN SYSTEM
HAS TO DRAW THAT STATE** (ADR 0065, ADR 0067). Outside `shell.css`'s known list,
look in the native host before you believe it. The one recorded exception stands:
a setting that is IRRELEVANT under the current state is hidden rather than
disabled (ADR 0072).

**A BANNER COMES OFF IN THE COMMIT THAT MAKES IT FALSE, AND THE GALLERY ENTRY
GOES WITH IT** (ADR 0057), and `WiredScreenProps` makes the compiler hold it.
Two screens retired this way in Leg 6; expect the drawn branch inside the screen
to go with them, and its fidelity cases to move to the wired suite rather than
be dropped.

**CHECK WHETHER A LATER ADR HAS ALREADY ANSWERED THE QUESTION THE DRAWING IS
ANSWERING** (Leg 5's defect), **and whether the PLAN designed the thing you are
about to recommend against** (Leg 6's). §11.23 is four hundred words of decided
design that a keep-or-retire recommendation was very nearly made without.

### What you must NOT do

- **Do not touch Context**, in any direction. The owner said on 2026-08-10 it is
  going to be done differently and deliberately did not say how.
- **Do not mount any of the six undecided surfaces.** ADRs 0060–0064 and one
  roadmap candidate; `ia.test.tsx`'s last case asserts none is mounted. The
  translation VIEW is one of them (ADR 0064) and is not the Translate mode.
- **Do not change a drawn screen's copy or layout to make a contract easier.**
  Where the drawing and the runtime disagree on a FACT, wire the fact and leave
  the copy — unless the drawing designed something the runtime should grow, in
  which case grow it and say so in an ADR.
- **Do not migrate a config without a backup path.** `core::backup` is the
  pattern now: snapshot the file, then act, then answer with where the snapshot
  went.
- **The overlay is still rule 5.** Its pill owns a token capsule with ONE
  palette by design; a light one is a decision the owner has not made. The
  ghosting on a language change is documented and is not yours to work around.

### How to check yourself

- `npm test`, `npm run build`, `cd src-tauri && cargo test`. **Watch the test
  TOTAL, not the colour**, and **run `npm run build` even when the suite is
  green** — Leg 6 shipped a mock signature `vitest run` does not typecheck and
  only the build caught it. Run the suite twice before believing a failure.
- `npm run port:diff` after anything that could move a screen. The 26-screen
  command is in Leg 6's record; the expected result is 25 zeros plus `profiles`.
- **The native host is the only instrument for a drawn state, and you can drive
  it.** `xdotool key ctrl+k` (no `--window`) opens the palette, `xdotool type`
  fills it, `Return` navigates. Clicks are still dead and scroll works only
  downward; where the palette cannot reach, use a temporary mount effect and
  take it out before the commit. `spectacle -f -b -n -e -o <file>` shoots, and a
  crop to an `xdotool` geometry multiplies by the 1.6 device-pixel scale.
- **Do not raise the window past somebody working at the machine — ask.** The
  owner works in that session while you run.
- **Never `pkill -f`.** The pattern matches the agent shell's own command line,
  whatever the pattern is. Kill by PID.

### When it is done

Commit, push to `main`, append your record to the leg log, and write the Leg 8
prompt. Then report what you did, what you found, and anything the next leg
needs that is not already written down.

## The prompt for Leg 6 (spent — kept for the chain's record)

You are picking up WordScript after Leg 5. Work in the repo root on `main`. Do
not create a branch. **`src-tauri/` is open** — Leg 5 opened it and the rule that
kept it shut is spent.

### What is already true

**Every screen the prototype drew stands, every wireable one is wired, and the
three cheapest runtime contracts are closed.** `ProcessingMode` has seven values
and Translate is selectable, settable and states its target language on the
overlay; `analyze_communication_style` answers what the two style fields cost;
`AppConfig.color_scheme` persists the theme. `npm run port:diff` is 26 of 28 at
**structural 0 | style 0** with the two RECORDED departures — `profiles`
(ADR 0068's sixth tab) and `history` (ADR 0070's segment). A third departure
needs its own ADR.

**Nothing you find is a surprise.** §2.5 is the list of what the runtime cannot
answer, and Leg 5's record says which three entries it closed and which three it
added.

### Read this first

`docs/handoffs/HANDOFF_gui-port-relay.md`. **Leg 5's record is your starting
state and it owes you one thing: the native-host check it did not get.** Leg 4c's
record below it carries the disabled-state rule you are still held to. Then
`CLAUDE.md`, `docs/spec/SPEC.md`, and `src/screens/props.ts`.

### The order, and the first one is a debt rather than a feature

1. **LOOK AT LEG 5'S FOUR SURFACES IN THE NATIVE HOST**, before building on
   them: `Profiles → Defaults` with the mode on Translate (two rows that appear
   and disappear), the Style tab's budget meter reading a runtime number, the
   two disabled Translate rows on AI Models with their `Per profile` tag, and
   the pill's language chip. Every state involved is one the design system
   already draws and nothing new was disabled, so this is a confirmation rather
   than a hunt — but Leg 4c found five missing CSS rules exactly this way, and
   every one of them had a passing test. Leg 5's findings 2 and 3 tell you how
   to take the screenshot on this machine and why `import -window` will not.
2. **A reveal command.** `Show transcripts in file manager` is inert on History,
   on Home and in the palette — three surfaces, one hole. Coupled to the next
   one: there is nothing per transcript to reveal.
3. **The Markdown-file promise.** The drawing says every transcript is a file in
   `~/WordScript/transcripts`; the runtime keeps one `history.json`. Leg 4c made
   the product state the truth and left the promise as a contract. Decide whether
   it is kept or retired, in an ADR, before writing either.
4. **Route the history retry by mode.** A retried Agent, Prompt Enhance or
   Translate record comes back as a conservative cleanup, because
   `retry_transcription_history_entry` runs the correction transform for every
   mode. It is one job for all three and Leg 5 added the third; the dispatch it
   needs is the one already in `lib.rs`.
5. **Home's decision inbox.** ADR 0044's three sources have no receiver, so the
   product draws nothing there — the one place on the surface where inventing
   content would invent a QUESTION. It is why Home still carries a banner.
6. **Full export, Full import, Reset all settings.** No command at all.
7. **§15.3's native half.** `window.theme()` and the Tauri theme-changed event,
   so the shell follows the OS the way the media query does — and the overlay
   window, which reads no scheme at all today.
8. **The five missing SURFACES, and they are design rather than runtime.** Add
   and Edit for replacements and snippets, New profile's rename, and where an
   `analyze_text_rules` answer goes. The gallery grows them first (ADR 0057).
   Say in your record if you start this; it is bigger than it looks.

### The rules you will be judged on

**NEVER RENDER FAKE READINESS (rule 7),** in both directions: when you give a
control its command, DELETE the reason it was carrying. Leg 5 deleted four.

**A CONTROL THAT CANNOT ACT IS DISABLED WITH ITS REASON, AND THE DESIGN SYSTEM
HAS TO DRAW THAT STATE** (ADR 0065, ADR 0067). `shell.css` has rules for
`.ws-seg button`, `.ws-provchip`, `.ws-sel`, `.ws-field`, `.ws-kbd-btn`,
`.ws-flag`, `.ws-cmdk-row` and `.ws-menu button`. Outside that list, look in the
native host before you believe it. **And there is now one recorded exception:**
a control whose setting is IRRELEVANT under the current state is hidden, not
disabled — ADR 0072 draws the line and says why.

**CHECK WHETHER A LATER ADR HAS ALREADY ANSWERED THE QUESTION THE DRAWING IS
ANSWERING.** Leg 5's one real defect was following the prototype past ADR 0068,
which had settled the same placement question two days before the code was
written. The prototype is the source for what a screen looks like; it is not the
source for a decision made after it.

**A BANNER COMES OFF IN THE COMMIT THAT MAKES IT FALSE, AND THE GALLERY ENTRY
GOES WITH IT** (ADR 0057). `registry.test.tsx` holds both directions.

### What you must NOT do

- **Do not touch Context**, in any direction. The owner said on 2026-08-10 it is
  going to be done differently and deliberately did not say how.
- **Do not mount any of the six undecided surfaces.** ADRs 0060–0064 and one
  roadmap candidate; `ia.test.tsx`'s last case asserts none is mounted. **The
  translation VIEW is one of them** (ADR 0064) and is not the Translate mode —
  the prototype separates the two under a heading that says so, at
  `demo.js:6911`, and the owner asked about exactly this in Leg 5.
- **Do not change a drawn screen's copy or layout to make a contract easier.**
  Where the drawing and the runtime disagree on a FACT, wire the fact and leave
  the copy.
- **Do not migrate a config without a backup path.** The owner's machine carries
  six real profiles, 174 transcriptions, a communication style that was
  invisible until two days ago, and now a colour scheme and four translate
  settings.
- **The overlay is still rule 5** apart from what Leg 5 recorded: ADR 0073's
  language chip and the seventh mode's label. Nothing else in `overlay*.css` or
  `OverlayPill.tsx` moves without the owner saying so.

### How to check yourself

- `npm test`, `npm run build`, `cd src-tauri && cargo test`. **Watch the test
  TOTAL, not the colour** — Leg 5 silently overwrote a 17-test file with a
  4-test one and the suite stayed green; the falling count was the only signal.
  Run the suite twice before believing a failure.
- `npm run port:diff` after anything that could move a screen. The 28-screen
  command is in the Leg 4d prompt below; the expected result is 26 zeros plus the
  two recorded departures.
- **The native host is the only instrument for a drawn state**, and Leg 5's
  findings 2 and 3 carry what works on this machine: `import -window` is dead,
  `spectacle -f -b -n -S -e -o <file>` works, and a crop to an `xdotool`
  geometry must be multiplied by the 1.6 device-pixel scale first. Do not raise
  the window past somebody working at the machine — ask.
- **Do not `pkill -f vite`.** It matches the agent shell's own command line.

### When it is done

Commit, push to `main`, append your record to the leg log, and write the Leg 7
prompt. Then report what you did, what you found, and anything the next leg needs
that is not already written down.

## The prompt for Leg 5 (spent — kept for the chain's record)

You are picking up WordScript after the GUI port. Work in the repo root on
`main`. Do not create a branch. **Leg 5 is the first leg allowed into
`src-tauri/`** — rule 6 held for seven legs precisely so that this one would
find a surface that states exactly what it cannot answer, and it does.

### What is already true

**Every screen the prototype drew stands, and every wireable one is wired.**
Twenty of the twenty-five keep a gallery entry; four product rows keep a banner
(Context, Notes & Meetings, Agents, Integrations) and every one of those is V2
or Phase 8 and cannot be wired at all. `npm run port:diff` is 26 of 28 at
**structural 0 | style 0**, with two RECORDED departures — `profiles`
(ADR 0068's sixth tab) and `history` (ADR 0070's segment). Those two are the new
baseline; a third departure needs its own ADR.

**Nothing you find is a surprise.** §2.5 in this document is the list of what
the runtime cannot answer, written down as it was found across five legs, and
every screen that draws an inert control names its reason on itself.

### Read this first

`docs/handoffs/HANDOFF_gui-port-relay.md`. Leg 4d's record is your starting
state; Leg 4c's below it carries the disabled-state rule you will be held to.
**§2.5 — the entries under Leg 2c's, 2d's, 4a's, 4b's, 4c's and 4d's headings —
is your backlog.** Then `CLAUDE.md`, `docs/spec/SPEC.md`, and
`src/screens/props.ts`, which is the seam in about a hundred and ten lines.

### The order, cheapest first, and the first three are days rather than weeks

1. **THE SEVENTH `ProcessingMode`.** ADR 0041 gave Translate a slot and
   `ProcessingMode` has six values, so **Hotkeys and Profiles each draw a
   disabled control for it today**. One variant, one config field, and the two
   controls come alive in the commit that adds them. It is the cheapest entry on
   the whole list and it is visible from two screens.
2. **`CommunicationStyleAnalysis` OVER IPC.** `core::communication_style`
   already computes it — what it accepted, what it dropped, `used_chars`,
   `max_chars` — and no command returns any of it. One command closes three
   things at once: the Style tab's budget meters stop mirroring two constants
   and counting typed characters (they over-count, see Leg 4d's §2.5 entry), and
   **`Check against a sample` and `Show the effective bias` finally have an
   answer to put somewhere** — which is the other half of the same job, and that
   half is a DRAWING job first (ADR 0057: the gallery grows the surface, the
   product follows).
3. **A colour-scheme config field.** The palette ships three theme rows that
   change this window and persist nothing; the overlay window does not follow.
   §15.3 owes the native half (`window.theme()` plus the Tauri theme-changed
   event) and the config field is the cheap half.
4. **A reveal command.** `Show transcripts in file manager` is inert on History,
   on Home and now in the palette — three surfaces, one hole. It is coupled to
   the next one: there is nothing per transcript to reveal.
5. **The Markdown-file promise.** The drawing says every transcript is a file in
   `~/WordScript/transcripts`; the runtime keeps one `history.json`. Leg 4c made
   the product state the truth and left the promise as your contract. Decide
   whether it is kept or retired, in an ADR, before writing either.
6. **Home's decision inbox.** ADR 0044's three sources have no receiver, so the
   product draws nothing there — the one place on the surface where inventing
   content would invent a QUESTION. It is why Home still carries a banner.
7. **Full export, Full import, Reset all settings.** No command at all.
8. **The five missing SURFACES, and they are design rather than runtime.** Add
   and Edit for replacements and snippets, New profile's rename, and where an
   `analyze_text_rules` answer goes. The gallery grows them first (ADR 0057).
   Say in your record if you start this; it is bigger than it looks.

### The rules you will be judged on

**NEVER RENDER FAKE READINESS (rule 7).** Unchanged, and now it cuts the other
way too: when you give a control its command, DELETE the reason it was carrying.
A row that says "no command exists" beside a control that works is the same
defect facing backwards.

**A CONTROL THAT CANNOT ACT IS DISABLED WITH ITS REASON, AND THE DESIGN SYSTEM
HAS TO DRAW THAT STATE** (ADR 0065, ADR 0067; Leg 4c's finding 1, Leg 4d's
confirmation). `shell.css` now has rules for `.ws-seg button`, `.ws-provchip`,
`.ws-sel`, `.ws-field`, `.ws-kbd-btn`, `.ws-flag`, `.ws-cmdk-row` and
`.ws-menu button`. If you disable something outside that list, look at it in the
native host before you believe it.

**A BANNER COMES OFF IN THE COMMIT THAT MAKES IT FALSE, AND THE GALLERY ENTRY
GOES WITH IT** (ADR 0057). `registry.test.tsx` holds both directions.

### What you must NOT do

- **Do not touch Context**, in any direction. The owner said on 2026-08-10 it is
  going to be done differently and deliberately did not say how.
- **Do not mount any of the six undecided surfaces.** ADRs 0060–0064 and one
  roadmap candidate; `ia.test.tsx`'s last case asserts none is mounted.
- **Do not touch the overlay** (rule 5).
- **Do not change a drawn screen's copy or layout to make a contract easier.**
  Where the drawing and the runtime disagree on a FACT, wire the fact and leave
  the copy, as Legs 4b, 4c and 4d each did once.
- **Do not migrate a config without a backup path.** This is the first leg that
  can write a migration, and the owner's machine carries six real profiles, 174
  transcriptions and a communication style that was invisible until yesterday.

### How to check yourself

- `npm test`, `npm run build`, `cd src-tauri && cargo test`. Run the suite twice
  before believing a failure.
- `npm run port:diff` after anything that could move a screen — the 28-screen
  command is in the Leg 4d prompt below, and the expected result is now 26 zeros
  plus the two recorded departures.
- **The native host is already running on this machine and hot-reloads** — see
  Leg 4d's finding 1. Do not spend 3m 43s on `npm run tauri build` before
  checking whether a `tauri dev` host is up, do not kill it, and do not leave a
  temporary driver in the tree. Fast Refresh preserves state, so drive a surface
  with a temporary mount effect rather than a changed `useState` default.
- **Do not `pkill -f vite`.** It matches the agent shell's own command line.

### When it is done

Commit, push to `main`, append your record to the leg log, and write the Leg 6
prompt. Then report what you did, what you found, and anything the next leg
needs that is not already written down.

## The prompt for Leg 4d (spent — kept for the chain's record)

You are picking up the WordScript GUI port. Work in the repo root on `main`.
Do not create a branch. Leg 4d is yours, and it is **not a wiring leg**: every
wireable screen is wired. Leg 4d is the three surfaces the port never carried
and the two derivations nobody has decided — and the third surface was found
after Leg 4c closed, by the owner, which is why it is item 0 rather than item 4.

### What is already true

Leg 4c wired the last six — Hotkeys, History, Profiles, AI Models, Home,
Privacy & Data. Ten rows in `src/windows/workspace/ia.tsx` became four, and all
four of those are rows Leg 4 was never allowed to touch: **Context, Notes &
Meetings, Agents, Integrations.** Deleting one of their banners is the error,
not the goal, and `registry.test.tsx` will fail you for it either way.

**Nothing about Context is yours**, in any direction, for the same reason it was
not Leg 4c's: the owner said on 2026-08-10 that it is going to be done
differently and deliberately did not say how. It stays mounted with its V2
banner and its three gallery entries, and nobody derives a design from the
drawing in the meantime.

### Read this first

`docs/handoffs/HANDOFF_gui-port-relay.md`. Leg 4c's record directly above Leg
4b's is your starting state and carries eight findings you will otherwise
rediscover — finding 1 is the one that will bite you. §2.5 — the entries under
Leg 2c's, 2d's, 4a's, 4b's and now Leg 4c's headings — is the list of what the
runtime cannot answer. Add to it; do not start a second one. Then `CLAUDE.md`,
and `src/screens/props.ts`, which is the seam in about a hundred and ten lines
and now has three shapes rather than two.

### The order, and the first one was raised by the owner after Leg 4c closed

0. **THE COMMUNICATION STYLE, AND IT OUTRANKS EVERYTHING BELOW IT.** Raised by
   the owner on 2026-08-10: the old UI let you choose, for Rewrite and the
   assistant, how formal the result is, which vocabulary it may use, and whether
   it comes out shorter, longer or the same. **There is no equivalent on any
   surface today**, and the full §2.5 entry above is worth reading before you
   start, because the shape is unlike anything else on this list.

   The short version: `core::communication_style` is intact and RUNNING —
   register, length, style rules, writing sample, with ADR 0023's precedence
   between them — and `transform`, `agent` and `capture` all consume it. The
   pre-port `ModesTab.tsx` had every control. **The prototype points at the
   profile for it three times and never draws it**, and the profile's five tabs
   have no sixth. So the port carried a faithful absence.

   **It is a live setting nobody can see.** One of the six profiles on the
   owner's machine carries `register: quick` with 256 characters of style rules
   and an 88-character sample, set in the old UI, applied to every Rewrite under
   that profile, invisible and unchangeable. That is the defect ADR 0023 exists
   against.

   **WHERE IT GOES IS DECIDED — [ADR 0068](../decisions/0068-the-communication-style-is-a-tab-in-the-profile-and-the-legend-states-its-scope.md),
   taken with the owner on 2026-08-10. Do not re-open it.** A sixth profile tab
   `Style`, in SECOND position — after Defaults, before Context — carrying one
   card titled `Communication style`. The `Where each list lands` Legend on
   Defaults gains a fifth row, **Style · sets how a sentence is built · Rewrite
   and the assistant**, and that row is how ADR 0023's narrow scope gets stated
   once. The ADR carries why Defaults and Context were both wrong, why AI Models
   was wrong, and what §11.4 it supersedes.

   **Draw it first, wire it second** (ADR 0057): the gallery grows the tab, the
   product follows. The runtime contract is already met, so the wiring is one
   card — two selects on `patch`, two textareas on `patchText`, and
   `MAX_STYLE_RULE_CHARS` / `MAX_STYLE_SAMPLE_CHARS` as the budget meters the
   pre-port `ModesTab.tsx` drew. Read that file out of `8f9077e^` before you
   draw: the six register descriptions are written to be verifiable by counting
   properties in the output rather than by an adjective, and they are the area's
   own words.

   **Two things the same commit settles.** `npm run port:diff -- profiles` stops
   measuring 1:1 against the prototype's five-tab screen — that is the accepted
   cost and the ADR records it, so say so in your record rather than treating it
   as a regression. And **six sub-tabs will not fit as drawn**: `.ws-subtabs` has
   neither `flex-wrap` nor `overflow`, and the five already clip inside the
   profile pane in the native host (`Replacemen…`). One-word labels or an
   overflow rule, decided here.

   **The profile-list subline is the same piece of work.** It already displays a
   register (`Rewrite · Client register`) for a value nothing can set, and
   `describeTextProfileWorkMode` returns an identical string for every profile —
   so item 3's derivation and this tab are one job.

1. **THE SEARCH BAR AND THE COMMAND PALETTE.** This is the one to do first and
   the owner has raised it once already, in as many words: *the searchbar 1:1
   from the demo GUI was also forgotten.* `NavSearch` is ported exactly — the
   glyph, the word `Search`, the `⌘K` / `Ctrl K` keycap — and is mounted in no
   window, so the shipped sidebar simply has no search bar where the
   prototype's has one. **It is a VISIBLE ABSENCE rather than a deferred
   feature.**

   The palette behind it is `demo.js:8031–8366` and is **the only prototype
   surface the port never carried**: a 26-entry `CMDK_INDEX` in three groups,
   prefix/word-start/substring scoring, match highlighting, keyboard selection
   and `Cmd`/`Ctrl`+`K`. It is a PORT — read the builder whole, read its rules
   in `demo.css`, put the rules in `shell.css` and not at a call site, the same
   method Leg 2 used twenty-five times — and **not a design job**.

   Most of its index is answerable today. Twelve entries are `go:` navigations
   and `runtime.open` does exactly that; another eleven are `go:` under a
   settings-row label; the theme actions have `useColorScheme`; *Copy last
   transcript* has `state.lastResult`. **One entry has no source** — *Show
   transcripts in file manager* — and it is the same hole History's row has, so
   it is drawn disabled with the reason on it (ADR 0065) rather than left out.

   `.ws-frost-stack` already exists in `shell.css` for exactly this: ADR 0051
   carries the nesting and `WorkspaceWindow` has a comment saying the layer is
   not drawn because there is no palette. Draw it.

2. **THE HELP MODAL (ADR 0066).** Three links — Discord, GitHub, the
   documentation — and its row is mounted in the commit that builds it. Two of
   the three URLs do not exist yet and **a link that opens a 404 must not be
   drawn**, so decide per link: ship the one that resolves, and disable the
   others with the reason on them. It is the first new UI this port has drawn —
   the prototype draws the row and not what it opens — so it is judged by eye
   against `DESIGN_SYSTEM.md` rather than measured.

3. **TWO DERIVATIONS, DECIDED AND WRITTEN DOWN.** Both are the shape Leg 4c
   settled History's badges in: the runtime has the fields, and which fact
   follows from which field is nobody's decision yet. Taking it inside a commit
   without writing it down is how a placeholder becomes the product.

   - **The profile list's subline.** `describeTextProfileWorkMode` returned the
     identical string for all six profiles on this machine, so the column that
     is supposed to tell them apart stopped doing it. The drawing's pairs are
     `Auto · Insert at cursor` and `Rewrite · Client register` — a mode and a
     delivery, not a sentence. Decide it, write it in the function, test it.
   - **`Not checked` versus `Not registered` is settled** and is the model to
     copy: four answers and no fifth, and "the runtime has not answered" is not
     the same as "the runtime said no".

4. **If you have room: the missing surfaces on §2.5, in the gallery first.**
   Leg 4c found five controls whose DESTINATION was never drawn — Add and Edit
   for replacements and snippets, New profile's rename, and
   `analyze_text_rules`' answer. Every one is a missing surface rather than a
   missing command, and ADR 0057 puts the gallery in charge of what a screen
   looks like, so the gallery grows it first and the product follows. **Do not
   start this without saying so in your record**; it is a design job and it is
   bigger than it looks.

### The rules you will be judged on

**NEVER RENDER FAKE READINESS (rule 7).** A screen that reads three of its eight
facts and invents the other five is worse than the banner it replaced. If a fact
has no source the row says so, and the fact goes on §2.5.

**A CONTROL THAT CANNOT ACT IS DISABLED, NOT DELETED AND NOT LEFT LOOKING
SETTABLE** (ADR 0065, and ADR 0067 for the provider lanes). And Leg 4c's finding
1 sharpens it: **check that the design system DRAWS the state you set.** Five
controls took `disabled`, refused the click and looked entirely operable, and
every unit test asserting `toBeDisabled()` passed. `shell.css` now has rules for
`.ws-seg button`, `.ws-provchip`, `.ws-sel`, `.ws-field`, `.ws-kbd-btn` and
`.ws-flag`; if you disable a control that is not one of those, look at it in the
native host before you believe it.

**THE GALLERY SHRINKS BY WIRING AND BY NOTHING ELSE.** Twenty entries now, and
the eleven mounted nowhere stay whatever else happens: 84 components in
`components/shell/` are reachable only through them. It is a test rather than a
paragraph — do not argue with it. **Neither the palette nor the Help modal is
one of the prototype's 25**, so neither adds an entry and neither removes one;
`registry.test.tsx` freezes the 25 as provenance and will reject an id it does
not know.

**FOUR EXPORTS ARE STILL ORPHANED** — `DangerRow`, `Inspector`, `PaneGroup`,
`VolumeSlider`. `RawPanel` stopped being one in Leg 4c. This is information, not
a delete list; if you do remove one, say so with what you checked.

### What you must NOT do

- **Do not mount any of the six undecided surfaces.** ADRs 0060–0064 and one
  roadmap candidate; every one is Phase 6, Phase 8 or a V2 candidate.
  `ia.test.tsx`'s last case asserts none is mounted.
- **Do not delete a banner from Context, Notes & Meetings, Agents or
  Integrations.** They are V2 or Phase 8 and cannot be wired at all.
- **Do not touch Context at all, in any direction.** See above.
- **Do not touch `src-tauri/`.** Rule 6 stands through Leg 4. What you find goes
  on §2.5 for Leg 5.
- **Do not touch the overlay.** Rule 5. `overlay*.css` and `OverlayPill.tsx` do
  not move.
- **Do not change a drawn screen's copy or layout to make anything easier.** The
  gallery is the source (ADR 0057). Where the drawing and the runtime disagree
  on a FACT, wire the fact, leave the copy, and file it in §2.5 — Leg 4b did it
  with About's build lanes and Leg 4c did it with History's foot.

### How to check yourself

- `npm test`, `npm run build`, `cd src-tauri && cargo test`. Run the suite twice
  before believing a failure — Leg 4b saw eight unrelated files fail once under
  machine load and pass on a clean re-run.
- `npm run port:diff` after anything that could move a screen. Serve the
  prototype (`python3 -m http.server 8791 --directory
  docs/prototypes/settings-rework`), run `npm run dev`, and point the script at
  the browser this machine has:

```
CHROME=/home/felixontv/.cache/ms-playwright/chromium-1237/chrome-linux64/chrome \
npm run port:diff -- home history profiles context notesettings models \
  agents integrations privacy onboarding translate subtitles meeting conversation \
  agentoverlay handoff commit contextintake contextactions \
  models#1 agents#1 agents#2 onboarding#1 onboarding#2 onboarding#3 onboarding#4 \
  onboarding#5 onboarding#6
```

- That is the 28. Every one is **structural 0 | style 0** today and the 34 text
  differences are Leg 2b's recorded soft divergences. **The palette is not in
  that list and cannot be**, because the script measures a gallery screen
  against a prototype screen and the palette is neither — measure it by opening
  both and comparing the built rules, and say in your record how you checked.
- **A wired screen cannot be looked at in a browser.** The workspace needs
  `invoke`; without the host it renders "Connecting to runtime…". The browser is
  still right for the twenty screens in the gallery. For the product surfaces:
  `npm run tauri build` (the AppImage step fails on linuxdeploy; the binary is
  built), run `src-tauri/target/release/wordscript`, `xdotool search --name
  "WordScript – Settings"`, `import -window <id>`. Synthetic input cannot be
  delivered, so use Leg 4c's trick — a temporary `useEffect` in
  `WorkspaceWindow` walking the surfaces on a timer, removed before the commit.
  **Batch and build once**: 3m 35s each, and do not interrupt it — killing cargo
  mid-link costs a full dependency rebuild.
- **The palette needs the host too**, because `Cmd`+`K` over a workspace that
  says "Connecting to runtime…" tells you nothing.
- **Do not `pkill -f vite`.** It matches the agent shell's own command line and
  kills the shell. Kill by PID.

### Split if you run long

Leg 2 split three times and Leg 4 has split twice; every split was right. The
palette is a 335-line builder with its own scoring and its own CSS, and it is
the only prototype surface nobody has read yet — if it takes the session, say
so, list what is left, and write the 4e prompt.

### When it is done

Commit, push to `main`, append your record to the leg log, and write the next
prompt. **If the palette, the Help modal and both derivations are done, write
the Leg 5 prompt instead** — the runtime contracts, prioritised by what §2.5 now
says is blocking. §2.5 currently names the cheapest one on the whole list: a
seventh `ProcessingMode` variant and one config field, which two screens are
already drawing a disabled control for. Then report what you did, what you
found, and anything the next leg needs that is not already written down.

## The prompt for Leg 4c (spent — kept for the chain's record)

Copied to a fresh agent verbatim.

---

You are picking up the WordScript GUI port. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on the `main` branch. Do not create a branch. **Leg 4c is yours: the rest of the
wiring.**

**What is already true**

Leg 4b opened the seam, fixed P1 and P2 on it, restored `RebuildLabTab` onto the
ported Diagnostics screen, and wired four of the fourteen mounted screens —
About & Updates, Diagnostics, General, Delivery & Insert. **Ten rows in
`src/windows/workspace/ia.tsx` still carry a banner and four of those can never
lose one.** The table at the foot of Leg 4b's record is the list, with what each
remaining screen needs and which pre-port file to read for it.

**Read this first**

`docs/handoffs/HANDOFF_gui-port-relay.md`. Leg 4b's record directly above the
Leg 4 prompt is your starting state and carries seven findings you will
otherwise rediscover. **§2.5 — the entries under Leg 2c's, Leg 2d's, Leg 4a's
and now Leg 4b's headings — is the list of what the runtime cannot answer.** Add
to it; do not start a second one. Then `CLAUDE.md`, and `src/screens/props.ts`,
which is the seam in about eighty lines.

**What wiring looks like now, and it is smaller than it was**

`WorkspaceRuntime` is handed to every row. Take it, change the screen's props
from `ScreenProps` to `WiredScreenProps`, and the compiler will tell you the
gallery entry has to go — that is ADR 0057 enforced rather than remembered.
Delete the row's `banner` in the same commit, move that screen's assertions out
of `src/screens/screens.test.tsx` into `src/screens/<Screen>.test.tsx`, and
write them about WHICH FACTS COME FROM THE RUNTIME rather than about fidelity,
because a retired screen has no measurement left.

**Read the pre-port area before you decide what a row means.** This is Leg 4b's
biggest single saving and it will be yours: the ported screens were drawn by
reading the surfaces they replace, so the drawn option lists, hints and row
orders are frequently that area's own, verbatim. `git show
8f9077e^:src/components/settings/InputTab.tsx` and so on — the file list is `git
ls-tree -r 8f9077e^ --name-only src/components/settings/`.

**The order, and it is not arbitrary**

1. **Hotkeys.** `HotkeyRecorder` was kept unreferenced for exactly this, and
   `InputTab.tsx` plus `ShortcutField.tsx` in `8f9077e^` are this screen's
   trigger half almost verbatim. Cheapest real one.
2. **History.** `useTranscriptionHistory` was kept for it and `RawPanel` stops
   being orphaned. Bigger than it looks — six per-row controls — and two of its
   facts have no runtime at all, so it ends the leg wired in part.
3. **Profiles, and do it BEFORE Models.** It is the first screen in the whole
   product with text fields, which makes it the first caller `patchText` has
   ever had. P1 is built and has never been exercised; a debounce nobody has run
   is a debounce nobody has tested.
4. **AI Models.** Small now under ADR 0065 — one lane wired, three disabled —
   but ask that ADR's open question first.
5. **Home and Privacy & Data.** Both partial, both keep their banners, both
   cheap. Good work to end a leg on rather than to start one.

**The rule you will be judged on**

**Never render fake readiness** (rule 7). A screen that reads three of its eight
facts and invents the other five is worse than the banner it replaced. If a fact
has no source the row says so — Leg 4b's four screens do it six different ways
and they are listed in its record — and the fact goes on §2.5. **A partial
wiring is fine and it keeps its banner**: `home`, `privacy`, `history` and
`models` are all partly wireable and all four should end this leg wired in part
and still saying so, with their gallery entries intact. The guard in
`registry.test.tsx` enforces exactly that pairing.

**A CONTROL THAT CANNOT ACT IS DISABLED, NOT DELETED AND NOT LEFT LOOKING
SETTABLE.** This is the owner's instruction of 2026-08-10 and it is now
[ADR 0065](../decisions/0065-groq-is-the-only-integrated-lane-and-every-other-one-stays-drawn-and-disabled.md).
The UI does not change: no row, field, tab or lane is deleted, moved or
reworded. What changes is whether it can be operated, and the vocabulary for
saying so already exists — `Button`'s `disabled`, `StatusBadge`'s `plan` tone,
the `preview` tag. It is written about `AI Models`, where three of four provider
lanes are affected, and it is the general rule for every screen you touch.
General already does the one case where the drawing itself asked for absence
instead — Display and Anchor in manual placement — and that stays the exception
rather than the pattern.

**THE GALLERY STILL SHRINKS BY WIRING AND BY NOTHING ELSE.** It is a test now
rather than a paragraph, so you will not get it wrong by accident — but do not
argue with it. Twenty-one entries, and the eleven that are mounted nowhere stay
whatever else happens: 84 components in `components/shell/` are reachable only
through them.

**Five exports are still orphaned** — `DangerRow`, `Inspector`, `PaneGroup`,
`RawPanel`, `VolumeSlider`. `RawPanel` is History's and you are wiring History,
so it stops being orphaned this leg. This is information, not a delete list; if
you do remove one, say so with what you checked.

**What you must NOT do**

- **Do not mount any of the six undecided surfaces.** ADRs 0060–0064 and one
  roadmap candidate; every one is Phase 6, Phase 8 or a V2 candidate.
  `ia.test.tsx`'s last case asserts none is mounted.
- **Do not delete a banner from Context, Notes & Meetings, Agents or
  Integrations.** They are V2 or Phase 8 and cannot be wired at all. For those,
  deleting the banner is the error, not the goal.
- **Do not touch Context at all, in any direction.** The owner said on
  2026-08-10 that it is going to be done differently and deliberately did not
  say how. It stays mounted with its V2 banner and its three gallery entries,
  and nobody derives a design from the drawing in the meantime.
- **Do not grey out the Local lane before asking.** ADR 0065 leaves exactly one
  point open and names it: `local_preview` is a real runtime provider and the
  status strip already states it, so whether Local is disabled only on `AI
  Models` or everywhere is the owner's to answer. An implementation must not
  settle it quietly (the discipline ADR 0064 set for its own open points).
- **Do not touch `src-tauri/`.** Rule 6 stands through Leg 4. What you find goes
  on §2.5 for Leg 5, which is prioritised by what you find blocking.
- **Do not touch the overlay.** Rule 5. Writing `overlay_*` CONFIG from General
  is not touching it and is already done; `overlay*.css` and `OverlayPill.tsx`
  do not move.
- **Do not change a drawn screen's copy or layout to make wiring easier.** The
  gallery is the source (ADR 0057). Leg 4b hit one real disagreement — About's
  build-lane hint names different artifacts than `build_targets` does — and left
  the copy alone, put the badge on the runtime and filed it in §2.5. Do that.

**How to check yourself**

- `npm test`, `npm run build`, `cargo test` in `src-tauri/`. **Run the suite
  twice before believing a failure** — Leg 4b saw eight unrelated files fail
  once under machine load and pass on a clean re-run.
- `npm run port:diff` after anything that could move a screen. Serve the
  prototype (`python3 -m http.server 8791 --directory
  docs/prototypes/settings-rework`), run `npm run dev`, and point the script at
  the browser this machine has:

  ```
  CHROME=/home/felixontv/.cache/ms-playwright/chromium-1237/chrome-linux64/chrome \
  npm run port:diff -- home history profiles context hotkeys notesettings models \
    agents integrations privacy onboarding translate subtitles meeting conversation \
    agentoverlay handoff commit contextintake contextactions \
    models#1 agents#1 agents#2 onboarding#1 onboarding#2 onboarding#3 onboarding#4 \
    onboarding#5 onboarding#6
  ```

  That is the 29. Every one is `structural 0 | style 0` today and `--text`
  prints nothing. **Take the screens you wire out of that list and say so in
  your record with the new count**, so the drop is a decision rather than a
  regression.
- **A WIRED SCREEN CANNOT BE LOOKED AT IN A BROWSER.** The workspace needs
  `invoke`; without the host it renders "Connecting to runtime…". The browser is
  still right for the twenty-one screens still in the gallery. For the wired
  ones: `npm run tauri build` (the AppImage step fails on `linuxdeploy`; the
  binary is built), run `src-tauri/target/release/wordscript`, `xdotool search
  --name "WordScript – Settings"`, `import -window <id>`. Synthetic input still
  cannot be delivered, so hoist what you need or use Leg 3's trick — a temporary
  `useEffect` setting `.ws-content`'s `scrollTop` on a timer lets one build be
  captured twice. **Batch the screens and build once. Do not interrupt the
  build** — killing cargo mid-link costs a full dependency rebuild.
- **Do not `pkill -f vite`.** It matches the agent shell's own command line and
  kills the shell. Kill by PID.

**Two things beside the ten, and they are yours if you have room.** The `Help`
modal (ADR 0066) and the search bar with the command palette behind it — see the
foot of Leg 4b's record. The search bar is a VISIBLE ABSENCE in the shipped
sidebar rather than a deferred feature: `NavSearch` is ported 1:1 and mounted
nowhere, and the palette is a port (`demo.js:8031–8366`) rather than a design.
Three legs carried it as a principle when it was a gap. If you cannot fit them,
carry them into the 4d prompt by name.

**Split again if you run long.** Leg 2 split three times and Leg 4 has split
once; each split was right. Six wireable screens is more than one session if
Models and Profiles are in it. Say so, list what is left, write the 4d prompt.

**When it is done**

Commit, push to `main`, append your record to the leg log, and write the next
prompt. If every wireable screen is wired, say so and write the **Leg 5** prompt
instead — the runtime contracts, prioritised by what §2.5 now says is blocking.
Then report what you did, what you found, and anything the next leg needs that
is not already written down.

---

## The prompt for Leg 4 (spent — kept for the chain's record)

Copied to a fresh agent verbatim.

---

You are picking up the WordScript GUI port. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on the `main` branch. Do not create a branch. **Leg 4 is yours: wiring, section
by section.**

**What is already true**

Leg 2 ported all 25 screens, Leg 3 overwrote the shell, and Leg 4a decided the
six lifecycles that were open. The product is one window — a workspace with four
views and settings as a sheet over it — and **fourteen of the 25 screens are
mounted in it, every one carrying a banner that says it is drawn rather than
wired.** The shell reads the runtime; the content does not. That is what you are
here to change.

**Read this first**

`docs/handoffs/HANDOFF_gui-port-relay.md`, in full. Leg 3's record is the shell
you are wiring into, Leg 4a's record directly above this prompt is what you may
skip and why, and **§2.5 — the twenty-odd entries under Leg 2c's, Leg 2d's and
Leg 4a's headings — is the list of what the runtime cannot answer.** Add to it;
do not start a second one. Then `CLAUDE.md`, which outranks any default you
carry, and `docs/ARCHITECTURE.md` for the UI/runtime seam.

**What wiring looks like, exactly**

`src/windows/workspace/ia.tsx` carries fourteen rows, each with a `banner`.
**Deleting a row's `banner` is what wiring that section looks like**, and that
table is therefore the list of what is left. A section is wired when every fact
on it is read from the runtime or is visibly absent — never when it merely stops
saying it is a preview.

In the same commit that wires a screen: **delete that screen's entry from
`/gallery` → Screens** (ADR 0057 — the Screens section is scaffolding and
retires per screen). `registry.tsx` is where it comes out. `ia.test.tsx` asserts
that every screen the product mounts is the same `render` the registry lists, so
the two cannot drift while both exist.

**THE GALLERY SHRINKS BY WIRING AND BY NOTHING ELSE. READ THIS BEFORE YOU DELETE
ANY ENTRY.**

`registry.test.tsx` asserts `ALL_SCREENS` has exactly **25**. That number breaks
on your first wired screen and you will have to edit it — which is the one
moment in this leg where deleting five more entries costs nothing and passes.
Do not.

- **An unwired screen's entry is never deleted.** Not "it will never be wired",
  not "the previews are scaffolding too", not tidiness. ADR 0057 retires an
  entry *in the commit that wires that screen* and says nothing else.
- **Nine screens are mounted nowhere and all nine stay in the gallery.** Six are
  Leg 4a's decided-but-unbuilt surfaces; `conversation` is Phase 8; `commit` is
  the **withdrawn** screen and keeps its withdrawn banner, because §11.15 exists
  so nobody builds Phase 3 out of it; `contextintake` and `contextactions` are
  states of a screen you *are* wiring and are not covered by its retirement.
- **Four mounted sections cannot be wired at all** — Context, Notes & Meetings,
  Agents, Integrations are V2 or Phase 8. They keep their banners *and* their
  gallery entries. For those, deleting the banner is the error, not the goal.
- **84 components in `components/shell/` are reachable only through screens that
  are mounted nowhere.** Measured, not estimated: the whole `Hud*` family, every
  `Translate*`, every `Agent*` plus `AgentPopup`, `Caption*`, `Echo*`,
  `Handoff*`, `Cross*`, `LineCompare*`, `Onboarding*`, `OverlayPillDrawing` /
  `OverlayStage` / `OverlayTab`, `Matrix`, `ModeCycle`, `StageList`, `Readout`,
  `Client*`, `Doc*`. **Deleting one preview's gallery entry orphans its entire
  family in a single move**, and the next "nothing imports this" pass removes
  ~700 lines of ported CSS with it.
- **"Unreferenced" is not the test; "is it the library" is.** Everything in
  `components/shell/` is the library, ported 1:1 from the prototype, and the
  library is the deliverable. `src/lab/` was deleted correctly (Leg 2b) because
  it was a *gallery-only duplicate* of components the library already needed —
  the opposite case. Leg 3 kept six unreferenced runtime hooks for exactly this
  reason and said so.
- **Six exports are genuinely orphaned today**: `DangerRow`, `InputLevelMeter`,
  `Inspector`, `PaneGroup`, `RawPanel`, `VolumeSlider` — no screen, no window,
  no gallery page. This is information, **not a delete list**: at least
  `Inspector` and `RawPanel` look like Diagnostics' business, which is yours.
  If you do remove one, say so in your record with what you checked.

**Make that guard mechanical, in your first commit.** A paragraph in a prompt is
the weakest form of this rule and it is what protects ~700 lines of ported CSS
today. `registry.test.tsx` should fail when the registry loses an entry whose
screen the product does not mount — the two lists are already in the same test's
reach (`ALL_SCREENS` and `VIEWS` / `SECTIONS`), so the assertion is small: the
only ids that may leave the registry are ids the product now mounts without a
banner. Replace the bare `toHaveLength(25)` with it rather than decrementing a
literal fourteen times.

**The rule you will be judged on**

**Never render fake readiness** (rule 7). A screen that reads three of its eight
facts and invents the other five is worse than the banner it replaced, because
the banner was honest. If a fact has no source, the row says so or the section
keeps its banner — and the fact goes on the §2.5 list for Leg 5. A partial
wiring is fine; a partial wiring that stops admitting it is not.

**The big one, and do it early**

**`RebuildLabTab` is the largest single thing Leg 3 gave up** — about 1000 lines
of real checks against the native runtime, deleted because the ported
Diagnostics screen replaced it in the sheet and ADR 0054 forbids the old and the
new coexisting. `RebuildLabWindow` now mounts the ported `DiagnosticsScreen`,
which is a drawing. **Restoring those checks onto the drawing is yours**, and it
is the one place where wiring means recovering deleted behaviour rather than
reading a value. Its code is in the history; `diagnosticsPolling.test.tsx` still
exercises two of the hooks it used.

**Six modules were deliberately kept unreferenced for you**:
`useNativeInsertion`, `useRuntimeLogs`, `useTranscriptionHistory`, `useV1Slice`,
`lib/appMeta` and `HotkeyRecorder`. Each lost its only caller with a deleted
area and each is the runtime-facing half of a drawing you are about to wire.
Deleting them would mean re-deriving the IPC shapes from Rust.

**Two more things that land in the commit that makes the first section write**

- **The sheet's foot goes back to the prototype's line.** It reads *"No section
  here writes to the runtime yet — each one says so at its head."* and that stops
  being true the moment one does. The prototype's line is *"Every change applies
  as you make it."*
- **P1 and P2 are fixed at the seam**, not inside a screen.

**What you must NOT do**

- **Do not mount any of the six undecided surfaces.** They are decided now —
  ADRs 0060–0064 and one roadmap candidate — and every one of them is Phase 6,
  Phase 8 or a V2 candidate. `ia.test.tsx`'s last case asserts none is mounted
  and it stays that way. Leg 4a's record has the per-surface *skip* column.
- **Do not touch `src-tauri/`.** Rule 6 stands through Leg 4. Everything you
  find that the runtime cannot answer goes on the §2.5 list for Leg 5, which is
  prioritised by what you find blocking.
- **Do not touch the overlay.** Rule 5. No token, size or rule in `overlay*.css`
  or `OverlayPill.tsx`.
- **Do not re-open anything §0 of the plan lists as settled**, and do not
  re-decide a lifecycle ADRs 0060–0064 just decided.
- **Do not change a drawn screen's copy or layout to make wiring easier.** The
  gallery is the source (ADR 0057); a disagreement is an ADR or a bug in the
  gallery, never a quiet edit.

**How to check yourself**

- `npm run port:diff` after any change that could move a screen. All 33
  measurements were structural 0 | style 0 after Leg 3, which moved two base
  rules and every settings screen into a container it had never been in. A
  wired screen that no longer measures is a wired screen that got redrawn.
  **A screen you delete from the gallery leaves the diff — say so in your
  record, with the count, so the drop is a decision rather than a regression.**
- `npm test`, `npm run build`, and `cd src-tauri && cargo test` — you are
  touching the seam, so run all three.
- **Look at it in the browser first — screenshots work.** Leg 2a's *"screenshots
  could not be written to disk"* is wrong: they land in the working directory,
  not in the `.playwright-mcp/` path the tool reports. Pass a plain relative
  filename and read it from the repo root, then delete it. That is minutes
  instead of a full `tauri build`, and it catches everything except the things
  only WebKitGTK does.
- **Then look at it in the native host**, which is still where anything
  shell-, window- or Tauri-bound is judged. `npm run tauri build` (the AppImage
  step fails on `linuxdeploy`; the binary is built), run
  `src-tauri/target/release/wordscript`, `xdotool search --name "WordScript –
  Settings"`, `import -window <id>`. Synthetic input still cannot be delivered,
  so hoist what is below the fold for one build, or use Leg 3's trick: a
  temporary `useEffect` that sets `.ws-content`'s `scrollTop` on a timer lets
  one build be captured twice. **Do not interrupt `npm run tauri build`** —
  killing cargo mid-link costs a full dependency rebuild.

**Split if you run long.** Leg 2 split three times and each split was right.
Fourteen sections plus the rebuild lab is more than one session; say so in your
record, list what is left, and write the 4b prompt. A leg that reports fourteen
wired when six are wired is worse than a leg that splits.

**When it is done**

Commit, push to `main`, append your record to the leg log, and write the next
prompt. Then report what you did, what you found, and anything the next leg
needs that is not already written down.

---

## The prompt for Leg 4a (spent — kept for the chain's record)

Copied to a fresh agent verbatim.

---

You are picking up the WordScript GUI port. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on the `main` branch. Do not create a branch. **Leg 4a is yours: the interaction
model the demo GUI never settled.**

**YOU WRITE NO CODE.** Not a component, not a route, not a token. What this leg
produces is an ADR per surface where the answer is a decision, a roadmap entry
where the answer is "not yet", and the corrections those imply in the plan and
the relay. A leg that ships a control has decided one of these questions by
implementing one answer, which is the exact failure it exists to prevent.

**What is already true**

Leg 2 ported all 25 screens; Leg 3 overwrote the shell. The product is one
window — a workspace with four views and settings as a sheet over it — and
fourteen of the 25 screens are mounted in it, each carrying a banner that says
it is drawn rather than wired. Nine screens are mounted nowhere. Six of those
nine are the subject of this leg.

**Read this first**

`docs/handoffs/HANDOFF_gui-port-relay.md`, in full — **§2.6 is your brief** and
Leg 3's record directly above the Leg 2d prompt is your starting state. Then
`src/windows/workspace/ia.tsx`, whose `ENTRY_POINT_HOLES` is the list Leg 3 owed
you: six entries, each naming the surface, the screen it is drawn on, **where
its door would go**, and what is undecided about its lifecycle. Then
`CLAUDE.md`, which outranks any default you carry.

Look at each of the six in `/gallery` → Screens before you decide anything about
it. In a built application that is now `Ctrl`/`Cmd`+`Shift`+`Alt`+`G`
(ADR 0059); in a browser it is `npm run dev` and `/#/gallery`. **A layout you
have not looked at is a layout you are about to decide the lifecycle of from its
description**, which is rule 4b's failure wearing a different hat.

**The six, and what is undecided about each**

§2.6 has the table. In one line each: **Onboarding** — when it runs, whether it
is skippable, what a quit at step 4 leaves behind, and which window it is.
**Meeting capture** — how a capture starts and what ends it, and whether the HUD
is a second window (§10.4). **Live subtitles** — what turns the strip and the
echo on, and where a placement "you set once" is stored. **Translation** — how
the window is opened, since no entry point for it exists anywhere in the 25
screens. **The agent overlay** — the state machine between the pill's tab, the
window and the notification. **The handoff** — what detects the effect verb,
where that stage runs, and how its refusal rate is measured, which is the card's
entire budget.

**The shape of the answer, and it is three shapes**

1. **A DECISION → an ADR.** Append-only, new file, next free number is **0060**;
   update `docs/decisions/README.md` when you file one. An ADR here is a
   lifecycle: how the surface is entered, what holds its state, what dismisses
   it, and what happens to it when the thing it is about ends. All four, or the
   surface is still undecided.
2. **NOT YET → a roadmap entry.** Three of the six — translation, meeting
   capture, live subtitles — **are not on the roadmap at all**, and §7 records
   translation and meeting capture as candidates needing their own entry before
   anything is built. That is still true. A roadmap entry that says "not yet"
   and names what would have to be true first is a complete answer and is often
   the right one.
3. **BLOCKED ON A CAPABILITY → say so and stop.** The meeting HUD needs a second
   always-on-top content-protected window AND system-audio capture; live
   subtitles waits on the same audio. Leg 2d already wrote *"Leg 4 cannot wire
   this screen at all; it is a capability, not a control."* Deciding a lifecycle
   for a surface that cannot exist yet is still worth doing — but say which of
   the two it is, because Leg 4 needs to know what to skip.

**The owner is in the loop and that is the point of the leg**

Several of these are marked *Open decision* on the drawn surface, which is the
prototype admitting it could not settle them alone. **Use `AskUserQuestion` for
the ones where you cannot derive the answer from an existing ADR, the roadmap or
the runtime** — call detection's three drawn answers, whether onboarding is
re-runnable, whether translation is one window or one per conversation. Do not
ask six questions about all six at once; ask where a wrong guess would be
expensive and derive the rest, saying in the ADR which it was.

**What you must NOT do**

- **No code.** See above. If you find yourself wanting a prop, write down what
  the prop would be and hand it to Leg 4.
- **Do not mount any of the six.** They are drawn in the gallery and mounted
  nowhere, and that is correct until their lifecycle is decided.
  `ia.test.tsx`'s last case asserts it and will fail if you do.
- **Do not touch `src-tauri/`.** Rule 6 stands through Leg 4. Several of your
  answers will name a native capability; naming one is the deliverable, building
  it is Leg 5.
- **Do not decide the overlay's geometry or behaviour.** Rule 5. The agent
  overlay's tab is drawn on a copy of the shipped pill's measurement; if your
  state machine needs the pill to change, that is a finding for Leg 5 and an ADR
  that says so, not an edit to `overlay-pill.css`.
- **Do not re-open anything §0 of the plan lists as settled.**

**When it is done**

The tests and builds should be untouched by a leg that writes no code — run
`npm test` and `npm run build` anyway, because a doc leg that broke the build
has done something it did not mean to. Then commit, push to `main`, append your
record to the leg log, and **write the Leg 4 prompt**.

Leg 4 wires, section by section: each of the fourteen mounted screens either
reads the runtime truthfully or keeps its `PreviewBanner`, and **deleting that
screen's row-`banner` in `windows/workspace/ia.tsx` is what wiring it looks
like** — that table is the list of what is left. The sheet's foot goes back to
the prototype's *"Every change applies as you make it."* in the commit that
makes the first section write. Each wired screen's Gallery → Screens entry is
deleted in the same commit (ADR 0057). P1 and P2 are fixed at the seam. The
largest single thing Leg 3 gave up is `RebuildLabTab` — about 1000 lines of real
checks against the native runtime, replaced by the drawing — and restoring it
onto the ported Diagnostics screen is Leg 4's. The list of what the runtime
cannot answer is already written: §2.5 in this document, twenty entries, split
between Leg 4 wiring and Leg 5 contracts. Add to it; do not start a second one.

Then report what you did, what you found, and anything the next leg needs to
know that is not already written down.

---

## The prompt for Leg 2d (spent — kept for the chain's record)

Copied to a fresh agent verbatim.

---

You are picking up the WordScript GUI port. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on the `main` branch. Do not create a branch. **Leg 2d is yours: the last 10
screens, and the paperwork that closes Leg 2.**

Fifteen of the prototype's 25 screens already stand in `/gallery` → Screens,
each measured exact. You are finishing the port.

**Read this first**

`docs/handoffs/HANDOFF_gui-port-relay.md`, in full — especially Leg 2c's record
directly above this prompt and Leg 2b's below it. Between them they list the
library defects already fixed, **five** measurement false positives you will
otherwise rediscover, the deliberate divergences, and the one place where the
prototype disagrees with itself. Then the "Read before starting Leg 2" table,
and `CLAUDE.md`, which outranks any default you carry.

**The one rule this leg is judged on**

**The demo GUI is the UI source of truth, and you read it per screen. You do not
design anything.** For every screen, in this order:

1. Read the whole builder function in `demo.js`. Line spans are in the table
   below. It carries the structure, the copy and the sample data.
2. Read the CSS rules it uses in `demo.css`. If a rule is not yet in
   `src/styles/shell.css`, add it **there**, with the prototype's comment for
   why it exists — never at the call site (ADR 0052).
3. Compare by **measuring**:

   ```
   python3 -m http.server 8791 --directory docs/prototypes/settings-rework
   npm run dev
   npm run port:diff context meeting handoff        # add --text for copy
   ```

   `structural 0 | style 0 | text 0` is the only evidence that counts. A
   non-zero `text` is the recorded soft divergences — a switch's hidden label,
   the live meter's wrapper, the slider's real range input — and the diff names
   them; anything else in that column is a real copy difference and prints with
   `--text`.

**MEASURE THE OTHER STATES TOO.** Leg 2c taught the verifier to reach them:
`npm run port:diff models#1 onboarding#4` drives both surfaces into a sub-tab or
a wizard step before measuring. **Every screen you are about to port has more
than one state**, and a screen measured only in its default state is a screen
half checked. `SUBSTATE` at the head of `scripts/gallery-port-diff.mjs` is where
you add a driver; the tab shape is four lines and already covers anything using
`.subtabs` / `.note-tabs`.

**The ten, in the order that costs least**

| # | Screen | `demo.js` | Why here |
| --- | --- | --- | --- |
| 1 | `context` | `SCREENS.context` 2881–2898 + `contextRail` 2923–2942 + `contextScreen` 2944–3155 | The largest, and the other two are states of it. Pane grammar is ported; this adds `pane-sec`, `folders`/`folder-row`, `note-tabs`, `note-body`, `tscript`/`tline`/`speaker`, `who-chip`, `enh`/`enh-act`, `linkgrp`/`link-row`, `floatbar`/`mic-btn`/`split-btn`, and the Ask window (`chatwin`, `aichat-*`, `bubble`, `typing`). Its four note tabs are four separate bodies — measure all four. |
| 2 | `contextintake` | `contextIntake` 3191–3415 | A state of (1), not a screen beside it. Adds `dropzone`, `intake-*`, `write-*`, `rec-start`. Its segment has three genuinely different bodies — measure all three. |
| 3 | `contextactions` | `actionsPanel` 3417–3547 | The other panel over the same object, in place of the Ask window. Adds `action*`, `actionswin`. `ACTIONS` at 3364 is data — port it as data. |
| 4 | `meeting` | 7392–7769 | Reuses `tscript`, `note-tabs`, `mic-btn` from (1). Adds the HUD. **Draw it at rest** (ADR 0058) — the prototype animates three matrices from a synthetic envelope. |
| 5 | `handoff` | 6480–6808 | Brings `ovp*` — the shipped overlay pill drawn at its real geometry — and `hoff*` and `cross*`. Three later screens read those back, so it is the hinge of the second half. |
| 6 | `subtitles` | 7048–7249 | Almost all of it is `ovp*` and `hoff*` from (5). Adds only `cap*` and `echo*`. |
| 7 | `translate` | 6810–7046 | Reuses `hoff*` from (5); adds the `trw*` family. |
| 8 | `conversation` | 7251–7390 | Reuses `cross*` from (5); adds `clnt*` and `doct*`. **Its `.bubble` block also carries `.msg[data-from="me"]`, which is already ported with the agents thread — do not port it twice.** |
| 9 | `agentoverlay` | 6117–6204 + `agentWindow` 6206–6478 | Last on purpose: the biggest CSS block, and `ovp*` already exists by now. Adds `agw*` and `agpop*`. Three states in the spec (nothing waiting, something waiting, looking at the work) — measure each. |

`SCREENS.notes`, `SCREENS.noteactions` and `SCREENS.upload` are aliases of
`context`, `contextactions` and `contextintake`. They are not extra work.

**Pace yourself against what actually happened.** Leg 2b ported ten screens and
spent half its session on the first two plus the library they needed. Leg 2c
ported four and split, because by then no cheap screen was left. Yours are all
expensive and (1)–(3) are one family that should be done together. **If you run
out, split into 2e exactly as 2b, 2c did** — say so in your record, list what is
left with these same line spans, and write the 2e prompt. A leg that overruns
and reports ten done when six are done is worse than a leg that splits.

**What you must NOT touch, so you do not wander**

These look like defects and are Leg 3's by decision, not by oversight:

- `body` reads `--text-body` (13 px) where the prototype's window declares
  `--t-body` (14 px). Fixed on `.ws-content` for now; `body` belongs to the leg
  that owns the window root. **Both of `demo.css`'s base rules are now ported
  and both are fenced to `.ws-content` / `.ws-nav` for the same reason.**
- `.ws-sheet-scale` (§11.22) is applied by the gallery around a settings screen.
  Leg 3 moves it onto the sheet.
- `FormCard`, `FormRow`, `Sidebar` and `StatTiles` are pre-port and are what the
  shipped areas still render. Nothing new may use them; they are deleted with
  the last screen that reads them, which is Leg 3.
- `src-tauri/` does not change (rule 6), including the stale `OverlayGallery.tsx`
  reference at `core/mode_router.rs:7`.
- **The overlay does not change.** Rule 5. Drawing it — which `ovp*` does, at
  the real geometry from `tauri.conf.json` — is allowed and is what the
  prototype does; changing `overlay*.css` or `OverlayPill.tsx` is not.

**The rest of what governs this**

- Where the prototype and this repo's shipped surface disagree, **the prototype
  wins.**
- **No screen carries an inline spacing value.** If one seems to need it, a
  primitive is missing a rule. A width that is a property of the value — a URL
  field, a model id — is the component's own option, the way `Field`'s `w` is.
- A gallery screen carries sample data and asserts nothing. Every preview screen
  carries its `PreviewBanner`.
- **A live instrument is drawn at rest** (ADR 0058). Never pass `active` to a
  capture component from a gallery page. This governs the meeting HUD, the agent
  overlay, Live subtitles and Client conversations — four of your ten.
- **No screen imports a Tauri API.** `GalleryWindow.test.tsx` asserts that by
  mocking `invoke` to throw.
- **Grow `components/shell/`, not the gallery.** Read
  `src/components/shell/index.ts` before you write anything. The thing you are
  about to need probably exists — the pane, the transcript row, the orb, the
  icon set, the level meter and the matrix are all in there.
- **Check the order of a card's children.** The prototype's `card()` renders
  head, then ROWS, then BODY, then foot. This has now caught out two legs in
  three cards; `Card` takes free children and will not stop you.
- Add each screen to `src/windows/gallery/screens/registry.tsx`. Set `surface`
  and, for a pane view, `layout: "pane"` — `context` and both its states are
  panes.
- End green: `npm test`, `npm run build`, and `cd src-tauri && cargo test` if you
  touch the shell. New screens carry tests — read the existing ones first: a
  unit test cannot see a pixel, so it holds what the measurement would accept
  because both sides changed together.
- Look at it in the native host. The recipe is finding 7 in Leg 2c's record;
  synthetic input still cannot be delivered, so hoist what you need to see and
  revert the hoist before committing.

**When every screen stands — the paperwork that closes Leg 2**

1. **Flip the prototype's status (ADR 0057).** It stops being the source and
   becomes provenance. Say so in this document *and* in
   `SETTINGS_REWORK_PLAN.md` §0, which still calls it mandatory reading with no
   horizon. Rule 4b expires with the last unported screen — note that too.
2. **Update the docs that now describe something that changed.** `CHANGELOG.md`
   under `[Unreleased]`, `docs/STATUS.md` (Leg 2c added the port's own paragraph
   to Product state — keep its count right), and `docs/DESIGN_SYSTEM.md` where
   the library grew past what it describes. Run the `spec-sync` skill rather
   than doing the drift check by hand.
3. **File an ADR only if a design decision departed from the prototype.** Never
   an edit to an existing record. The next free number is **0059**; update
   `docs/decisions/README.md` when you file one.
4. **Finish the list of what Leg 2 owes Legs 4 and 5** (§2.5). Leg 2c started it
   under its own record — seven entries, each a place the prototype states a
   FACT the runtime does not have. Add yours to it rather than starting a second
   list, and keep the distinction: a label the runtime does not use is a Leg 5
   contract; a screen that could not be drawn without inventing a control is a
   Leg 4 wiring problem.
5. Commit, push to `main`, append your record to the leg log, and **write the
   Leg 3 prompt** into this document. Leg 3 is the shell overwrite: one window,
   settings as a sheet over the workspace at its own scale (§11.22 — the scale
   is already ported as `.ws-sheet-scale`; Leg 3 moves it onto the sheet), the
   new IA replacing the 14 flat areas, `Cmd+,`, and the old areas deleted.

Then report what you did, what you found, and anything the next leg needs to
know that is not already written down.

---

## The prompt for Leg 2c (spent — kept for the chain's record)

Copied to a fresh agent verbatim.

---

You are picking up the WordScript GUI port. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on the `main` branch. Do not create a branch. **Leg 2c is yours: the last 14
screens, and the paperwork that closes Leg 2.**

Eleven of the prototype's 25 screens already stand in `/gallery` → Screens, each
measured exact. You are finishing the port.

**Read this first**

`docs/handoffs/HANDOFF_gui-port-relay.md`, in full — especially Leg 2b's record
directly above this prompt. It lists nine library defects it already fixed, four
measurement false positives you will otherwise rediscover, three deliberate
divergences, and the one place where the prototype disagrees with itself. Then
the "Read before starting Leg 2" table, and `CLAUDE.md`, which outranks any
default you carry.

**The one rule this leg is judged on**

**The demo GUI is the UI source of truth, and you read it per screen. You do not
design anything.** For every screen, in this order:

1. Read the whole builder function in `demo.js`. Line spans are in the table
   below, so you do not have to hunt for them. It carries the structure, the
   copy and the sample data — including which rows exist and why.
2. Read the CSS rules it uses in `demo.css`. If a rule is not yet in
   `src/styles/shell.css`, add it **there**, with the prototype's comment for
   why it exists — never at the call site (ADR 0052).
3. Compare by **measuring**. Leg 2b committed the check:

   ```
   python3 -m http.server 8791 --directory docs/prototypes/settings-rework
   npm run dev
   npm run port:diff context models agents          # add --text for copy
   ```

   It reports `structural 0 | style 0 | text 0` when a screen is ported. **Do
   not call a screen done on any weaker evidence.** If you cannot point at the
   prototype and say "this line, this value", you invented it.

**The fourteen, in the order that costs least**

The order is not arbitrary and following it will save you a day. Screens share
CSS families; doing a sharer before its sharee means the second one is nearly
free. The last column is how many of the screen's classes are **not yet** in
`shell.css`, counted mechanically — it is the real size of each job.

| # | Screen | `demo.js` | New classes | Why here |
| --- | --- | --- | --- | --- |
| 1 | `notesettings` | 3842–3974 | **0** | Pure card and row grammar. A warm-up that proves your loop works before you spend anything. |
| 2 | `models` | 4300–4875 | 15 | The biggest settings screen. Brings `job*`, `jobmodel*`, `mdl-list`, `selmark`. Its 4 lanes × 8 jobs are data, not markup — port `LANES` as data. |
| 3 | `onboarding` | 5696–6115 | 12 | Reuses `jobmodel`, `mdl-list`, `selmark` from (2); adds only the `obrail*`/`obstep*` family. Its step 3 renders the SAME provider picker as AI Models — share the component, do not draw a twin. |
| 4 | `agents` | 4892–5221 | 9 | Brings `thread`, `msg*`, `mcp*`. Uses the orb, which is already in the library. |
| 5 | `context` | 2881–2900 + `contextScreen` 2944–3189 | 42 | The largest. Three entry points: `SCREENS.context`, `contextactions`, `contextintake`. Pane grammar is already ported; this adds folders, note tabs, the transcript line, speaker chips, the float bar and the two panels. |
| 6 | `contextintake` | `contextIntake` 3191–3415 | ↑ | A state of (5), not a screen beside it. Adds `dropzone`, `intake*`. |
| 7 | `contextactions` | `actionsPanel` 3417–3547 | ↑ | The other panel over the same object. Adds `action*`, `actionswin`. |
| 8 | `meeting` | 7392–7769 | 28 | Reuses `tscript`, `enh`, `note-tabs`, `readout`, `mic-btn` from (5). Adds the HUD. **Draw it at rest** (ADR 0058). |
| 9 | `handoff` | 6480–6808 | 34 | Brings `ovp*` — the shipped overlay pill drawn at its real geometry — and `hoff*` and `cross*`. Three later screens read those back. |
| 10 | `subtitles` | 7048–7249 | 24 | Almost all of it is `ovp*` and `hoff*` from (9). Adds only `cap*` and `echo*`. |
| 11 | `translate` | 6810–7046 | 31 | Reuses `hoff*` from (9); adds the `trw*` family. |
| 12 | `conversation` | 7251–7390 | 19 | Reuses `cross*` from (9); adds `clnt*` and `doct*`. |
| 13 | `agentoverlay` | 6117–6204 + `agentWindow` 6206–6478 | 54 | Last on purpose: the biggest CSS block, and `ovp*` already exists by now. Adds the `agw*` and `agpop*` families. |

`SCREENS.notes`, `SCREENS.noteactions`, `SCREENS.upload`, `SCREENS.stt` and
`SCREENS.llm` are aliases of screens in this table. They are not extra work.

**Leg 2b's throughput, so you can pace yourself.** It ported ten screens in one
session, and roughly half that session went on the first two plus the library
they needed; the last eight went four times faster. Yours are the expensive
ones. **If you run out before the fourteenth, split into 2d exactly as 2a and 2b
did** — say so in your record, list what is left with these same line spans, and
write the 2d prompt. A leg that overruns and reports fourteen done when nine are
done is worse than a leg that splits.

**What you must NOT touch, so you do not wander**

These look like defects and are Leg 3's by decision, not by oversight:

- `body` reads `--text-body` (13 px) where the prototype's window declares
  `--t-body` (14 px). Fixed on `.ws-content` for now; `body` belongs to the leg
  that owns the window root.
- `svg { flex: none }` is fenced to `.ws-content` / `.ws-nav` rather than
  global, because the thirteen pre-port areas still render lucide icons.
- `.ws-sheet-scale` (§11.22) is applied by the gallery around a settings screen.
  Leg 3 moves it onto the sheet.
- `FormCard`, `FormRow`, `Sidebar` and `StatTiles` are pre-port and are what the
  shipped areas still render. Nothing new may use them; they are deleted with
  the last screen that reads them, which is Leg 3.
- `src-tauri/` does not change (rule 6), including the stale `OverlayGallery.tsx`
  reference at `core/mode_router.rs:7`.
- **The overlay does not change.** Rule 5. Drawing it — which `ovp*` does, at
  the real geometry from `tauri.conf.json` — is allowed and is what the
  prototype does; changing `overlay*.css` or `OverlayPill.tsx` is not.

**The rest of what governs this**

- Where the prototype and this repo's shipped surface disagree, **the prototype
  wins.**
- **No screen carries an inline spacing value.** If one seems to need it, a
  primitive is missing a rule.
- A gallery screen carries sample data and asserts nothing. Every preview screen
  carries its `PreviewBanner`.
- **A live instrument is drawn at rest** (ADR 0058). Never pass `active` to a
  capture component from a gallery page. This governs the meeting HUD, the agent
  overlay, Live subtitles and Client conversations — four of your fourteen, and
  the prototype animates all four from a synthetic envelope because it has no
  microphone. The product has one, which is exactly why the gallery must not
  touch it.
- **No screen imports a Tauri API.** `GalleryWindow.test.tsx` asserts that by
  mocking `invoke` to throw.
- **Grow `components/shell/`, not the gallery.** Read
  `src/components/shell/index.ts` before you write anything: it carries the card
  grammar, the eight primitives, every control of `demo.css` §6, the nav and
  content column, the icon set, the orb, the provider marks and their sprite,
  the list row and its raw panel, the decision inbox, the pane, the connection
  block, the runtime log and the diff. The thing you are about to need probably
  exists.
- Add each screen to `src/windows/gallery/screens/registry.tsx`. The ledger and
  its counts read that file, so there is nothing to keep in step by hand. Set
  `surface` and, for a pane view, `layout: "pane"`.
- End green: `npm test`, `npm run build`, and `cd src-tauri && cargo test` if you
  touch the shell. New screens carry tests — read what Leg 2b's assert before
  writing yours: a unit test cannot see a pixel, so it holds what the
  measurement would accept because both sides changed together.
- Look at it in the native host. The recipe is finding 6 in Leg 2b's record and
  it works; synthetic input still cannot be delivered, so hoist what you need to
  see and revert the hoist before committing.

**When every screen stands — the paperwork that closes Leg 2**

1. **Flip the prototype's status (ADR 0057).** It stops being the source and
   becomes provenance. Say so in this document *and* in
   `SETTINGS_REWORK_PLAN.md` §0, which still calls it mandatory reading with no
   horizon. Rule 4b expires with the last unported screen — note that too.
2. **Update the docs that now describe something that changed.** `CHANGELOG.md`
   under `[Unreleased]`, `docs/STATUS.md` for what works today, and
   `docs/DESIGN_SYSTEM.md` where the library grew past what it describes. Run
   the `spec-sync` skill rather than doing the drift check by hand.
3. **File an ADR only if a design decision departed from the prototype.** Never
   an edit to an existing record. The next free number is **0059**; update
   `docs/decisions/README.md` when you file one.
4. **Write down what Leg 2 owes Legs 4 and 5** (§2.5): every place a screen
   could not be drawn without inventing a control, and every place the prototype
   and the runtime disagree on a *fact* rather than on presentation — a label
   the runtime does not use, a status that does not exist. §11.11 found three;
   a 25-screen port will have found more.
5. Commit, push to `main`, append your record to the leg log, and **write the
   Leg 3 prompt** into this document. Leg 3 is the shell overwrite: one window,
   settings as a sheet over the workspace at its own scale (§11.22 — the scale
   is already ported as `.ws-sheet-scale`; Leg 3 moves it onto the sheet), the
   new IA replacing the 14 flat areas, `Cmd+,`, and the old areas deleted.

Then report what you did, what you found, and anything the next leg needs to
know that is not already written down.

---

## The prompt for Leg 2b (spent — kept for the chain's record)

Copied to a fresh agent verbatim.

---

You are picking up the WordScript GUI port. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on the `main` branch. Do not create a branch. **Leg 2b is yours: the 24
remaining screens.**

**Read this first**

`docs/handoffs/HANDOFF_gui-port-relay.md`, in full — especially Leg 2a's record
directly above this prompt, which lists ten findings you would otherwise
rediscover. Then the "Read before starting Leg 2" table, and `CLAUDE.md`, which
outranks any default you carry.

**The one rule this leg is judged on**

**The demo GUI is the UI source of truth, and you read it per screen. You do not
design anything.** For every screen, in this order:

1. `grep -n "SCREENS\.<id>" docs/prototypes/settings-rework/demo.js` and read the
   whole builder function. It carries the structure, the copy and the sample data.
2. Read the CSS rules it uses in `demo.css`. If a rule is not yet in
   `src/styles/shell.css`, add it **there** — never at the call site.
3. Serve the prototype and put it side by side with the app:
   `python3 -m http.server 8791 --directory docs/prototypes/settings-rework`.
   The prototype persists its screen; set the picker with
   `document.getElementById("pick").value = "<id>"` plus a `change` event.
4. Compare. If you cannot point at the prototype and say "this line, this
   value", you invented it — go back to step 1.

**Leg 2a already bought you the library.** `src/components/shell/` now carries
the card grammar, the eight primitives AND every control of `demo.css` §6, plus
the nav and content-column grammar. Read `src/components/shell/index.ts` before
you write anything: the thing you are about to need probably exists. When it
does not — the orb, the provider marks, the pane layout, the list item and its
raw panel, the transcript line, the decision inbox, the meeting HUD — **grow the
library, not the gallery.**

**What to build**

All 24 remaining screens into `/gallery` → Screens, at the prototype's fidelity,
on the real components. Order suggestion, not a requirement: the four workspace
views (Home · History · Profiles · Context), then the eleven settings sections,
then the previews. `src/windows/gallery/Screens.tsx` carries the ledger; update
its counts as you go.

Start by porting the orb and the provider marks out of `demo.css` into
`components/shell/` and deleting `src/lab/` in the same commit — finding 1 above
explains why that is the first move rather than a cleanup.

**The rest of what governs this**

- Where the prototype and this repo's shipped surface disagree, **the prototype
  wins.**
- **No screen carries an inline spacing value.** If one seems to need it, a
  primitive is missing a rule (ADR 0052).
- A gallery screen carries sample data and asserts nothing. Every preview screen
  carries its `PreviewBanner`; `Live preview & commit` carries the **withdrawn**
  variant — it is drawn and is explicitly not a target shape (§11.15).
- **A live instrument is drawn at rest** (ADR 0058). Never pass `active` to a
  capture component from a gallery page.
- **No screen imports a Tauri API.** `GalleryWindow.test.tsx` asserts that by
  mocking `invoke` to throw.
- **The overlay does not change. `src-tauri/` does not change.**
- End green: `npm test`, `npm run build`, and `cd src-tauri && cargo test` if you
  touch the shell. New screens carry tests — under ADR 0054 there is no old
  surface to fall back on.
- Verify by **measuring**, not by eye: the computed-style diff Leg 2a used is
  described in its record, including the two false positives it produces.
- Looking in the native host: `npm run tauri build` (ignore the AppImage
  bundling failure), run `src-tauri/target/release/wordscript`, find the window
  with `xdotool search --name "WordScript – Settings"`, capture with
  `import -window <id>`. Reaching `/gallery` there needs a temporary route in
  `src/App.tsx` — **revert it before committing.** No synthetic input reaches
  the window; hoist what you need to see.

**When it is green**

Commit, push to `main`, append your record to the leg log, and then — because
the last screen will be standing in the gallery — **flip the prototype's status
per ADR 0057**: it stops being the source and becomes provenance. Say so in this
document and in `SETTINGS_REWORK_PLAN.md` §0, which still calls it mandatory
reading with no horizon. Then write the **Leg 3 prompt** into this document.
Leg 3 is the shell overwrite: one window, settings as a sheet over the workspace
at its own scale (§11.22), the new IA replacing the 14 flat areas, `Cmd+,`, and
the old areas deleted.

Then report what you did, what you found, and anything the next leg needs to
know that is not already written down.

---

## The prompt for Leg 2 (spent — kept for the chain's record)

Copied to a fresh agent verbatim.

---

You are picking up the WordScript GUI port. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on the `main` branch. Do not create a branch. **Leg 2 is yours and you finish it
completely.**

**Read this first**

`docs/handoffs/HANDOFF_gui-port-relay.md`, in full. It is the chain document: it
names the decisions this rests on (ADR 0054, 0055, 0056, 0057, 0058), the rules every
leg obeys, what Leg 1 landed and got wrong, and the full specification of Leg 2.
Then read what its "Read before starting Leg 2" table lists — and read
`CLAUDE.md`, which outranks any default you carry.

**The one rule this leg is judged on**

**The demo GUI is the UI source of truth, and you read it per screen. You do not
design anything.**

The design is finished. It lives in `docs/prototypes/settings-rework/` as 25
screens of vanilla HTML/CSS/JS, fourteen passes deep and accepted. Your job is to
carry it across 1:1 — the same structure, the same spacing, the same radii, the
same states, the same copy — onto React components. Nothing on your screen should
be a decision you made.

For every screen and every section, in this order:

1. `grep -n "SCREENS\.<id>" docs/prototypes/settings-rework/demo.js` and read the
   whole builder function. It carries the structure, the copy and the sample data.
2. Read the CSS rules it uses in `demo.css`. If a rule is not yet in
   `src/styles/shell.css`, add it **there** — never at the call site.
3. Serve the prototype and put it side by side with the app:
   `python3 -m http.server 8791 --directory docs/prototypes/settings-rework`
4. Compare them. If you cannot point at the prototype and say "this line, this
   value", you invented it — go back to step 1.

**Do not build a screen from `docs/DESIGN_SYSTEM.md`.** That document describes
the system; it is not the design. This is exactly how Leg 1 failed: it ported the
tokens and the component grammar correctly out of `demo.css`, then wrote the four
gallery pages that display them from scratch, and the owner saw the difference in
one glance. Repairing that is §2.1 and it comes before anything else.

**What you are building**

**The library is the deliverable.** `src/components/shell/` plus
`src/styles/shell.css` is the productive component library — that is where the
design components live and what the product renders. The gallery **displays**
that library and never defines it: a component that exists only under
`src/windows/gallery/` has made the gallery a second product, which is the one
thing ADR 0055 forbids. So when a screen needs a control the kit does not have —
starting with `.btn`, which Leg 1 did not build — **grow the library, not the
gallery.**

Then do Leg 2's two halves in order:

- **§2.1 — re-port the four gallery pages** (`Foundations`, `Components`,
  `Motion`, `GalleryWindow`) out of `SCREENS.ds` in `demo.js`, which is 350 lines
  of decided content. Keep Leg 1's one addition: contrast and L* are measured at
  render time, never printed as literals.
- **§2.2 — every one of the 25 screens** into `/gallery` → Screens, at the
  prototype's fidelity, on the real components.

Follow the acceptance list at the end of the leg specification. Do not declare it
done while any item is open. If it runs long, split into 2a/2b, say so in your
record, and write the prompt for 2b.

**The rest of what governs this**

- Where the prototype and this repo's shipped surface disagree, **the prototype
  wins.** That is the point of the port.
- Three things are deliberately not 1:1 and each is already a decision, not a
  liberty: the prototype's own rig, the light `--fg-muted` (ADR 0056), and
  measured-instead-of-printed contrast. They are listed in the relay document.
- The design-system rules live in the primitives, never in a screen. **No screen
  carries an inline spacing value.** If one seems to need it, a primitive is
  missing a rule.
- A gallery screen carries sample data and asserts nothing. Every preview screen
  carries its `PreviewBanner`; the withdrawn one carries the withdrawn variant.
- **The overlay does not change. `src-tauri/` does not change.**
- End green: `npm test`, `npm run build`. New screens carry tests — under ADR
  0054 there is no old surface to fall back on.
- **Look at the frost pair in the native host.** Leg 1 could not deliver a
  pointer event to the window under this compositor and left it owed; it is at
  the foot of `/gallery` → Foundations with a button that takes the blur off the
  layer behind. Reaching `/gallery` there needs a temporary frontend route — Leg
  1's record says how, and says to revert it before committing.

**When it is green**

Commit it, push it to `main`, append your record to the leg log, flip the
prototype's status per ADR 0057 (at the end of Leg 2 it stops being the source
and becomes provenance — say so in the relay document and in
`SETTINGS_REWORK_PLAN.md` §0), and write the **Leg 3 prompt** into the relay
document. Leg 3 is the shell overwrite: one window, settings as a sheet over the
workspace at its own scale (§11.22), the new IA replacing the 14 flat areas,
`Cmd+,`, and the old areas deleted.

Then report what you did, what you found, and anything the next leg needs to know
that is not already written down.

---

## The prompt for Leg 3 (spent — kept for the chain's record)

Copied to a fresh agent verbatim.

---

You are picking up the WordScript GUI port. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on the `main` branch. Do not create a branch. **Leg 3 is yours: the shell
overwrite.** Leg 2 is closed — all 25 screens stand in `/gallery` → Screens on
the real components, each measured exact.

**What changes, and it is one thing said four ways**

Today the product is a settings window with fourteen flat areas in it. After
this leg it is **one window**: a workspace with four views, and settings as a
**sheet laid over it at its own scale**, reached with `Cmd+,`. The fourteen
areas are deleted in the commit that replaces them (ADR 0054 — there is nobody
to migrate, so nothing is aliased and the old and new never coexist).

1. **One window.** `SettingsWindow.tsx` is the window; it stops being *the
   settings window* and becomes the workspace. Home · History · Profiles ·
   Context are its views. All four are ported and standing in the gallery.
2. **Settings is a sheet over it, at its own scale (§11.22).** A modal sheet,
   not a second top-level window, because configuring something is a detour you
   come back from — and drawn at a smaller scale, because two surfaces at
   exactly one scale read as one surface whose content changed. **The scale is
   already ported**: `.ws-sheet-scale` in `shell.css` redeclares `--nav-w`,
   `--nav-row-h`, `--content-max` and `--pad-card` and nothing else. Today the
   gallery applies it around a settings screen. **Your job is to move it onto
   the sheet**, where it belongs. That it moves from one container to another
   without a single component changing is the proof ADR 0052's tokens work —
   if you find yourself editing a component to make the sheet fit, stop.
3. **The new IA (§4.2).** Five workspace views become four (Chat became a panel
   inside Context, §11.19; Upload became its intake state, §11.41), and eleven
   settings sections in three groups — APP · AI · SYSTEM. The longest list a
   user scans drops from 14 to 4.
4. **`Cmd+,` opens the sheet**, and Escape closes it. It is a frontend
   shortcut, not a Rust one: it is scoped to a focused window, which is the
   whole difference from every shortcut ADR 0006 owns.

**Read this first**

`docs/handoffs/HANDOFF_gui-port-relay.md`, in full — Leg 2d's record directly
above this prompt, then 2c and 2b. Then `docs/SETTINGS_REWORK_PLAN.md` §4.1,
§4.2, §4.3 and §11.22, which are the IA and the sheet in full. Then
`CLAUDE.md`, which outranks any default you carry.

**THE PROTOTYPE IS NO LONGER THE SOURCE.** ADR 0057's flip happened at the end
of Leg 2. `/gallery` is the source now: every screen you are about to mount
already stands there, measured exact, and if the gallery and the prototype
disagree the gallery is right. Read `demo.js` and `demo.css` for the shell
grammar's derivations — the sheet, the scrim, the nav, `§11.22` — because their
comments carry reasoning nothing else does. Do not re-port a screen from them.

**What you are moving, and where it already is**

Everything you need is in `src/components/shell/` and rendered by
`src/windows/gallery/screens/`. A screen in the gallery and the same screen in
the product are one implementation with two sets of props (ADR 0055) — so
mounting one on a product surface is **passing it different props**, never
copying it. If you find yourself copying JSX out of a gallery screen, the screen
needed a prop and you are about to make the gallery a second product.

| The window | Today | After |
| --- | --- | --- |
| Chrome | `WindowChrome`, `Sidebar`, `FormCard`, `FormRow` | `Nav` / `NavGroup` / `NavRow` / `NavFoot`, `ViewTop`, `Card` / `CardRows` / `Row` |
| Areas | 14 in `AREAS` in `SettingsWindow.tsx` | 4 views + a sheet of 11 sections |
| Scale | one | workspace, plus `.ws-sheet-scale` inside the sheet |

**The four things that will bite**

1. **`src/lib/settingsAnchors.ts` IS A RUNTIME CONTRACT** and the one exception
   ADR 0054 names. Rust deep-links into settings by anchor; every anchor must
   still resolve after the restructure, and several of them now land inside the
   sheet rather than in a window. Read it before you move a control, and check
   `SETTINGS_ANCHOR_AREAS` against your new IA row by row.
2. **`FormCard`, `FormRow`, `Sidebar` and `StatTiles` are the pre-port shell**
   and this is the leg that deletes their last caller. Delete them **in the
   commit that replaces their last caller**, not before and not after. Several
   of their callers carry a `bodyClassName="py-4"` patch that the ported card
   grammar makes wrong — that patch goes with them, it is not ported.
3. **The frost material is what the sheet is made of, and it is not
   `backdrop-filter`** (ADR 0051, and it is inert in this engine). The pair is
   ported: `.ws-frost-shell` / `.ws-frost-stack` recede, `.ws-frost-panel`
   catches the light, `.ws-frost-scrim` darkens. The nesting is the part to get
   right — `shell` is the application receding behind a sheet, `stack` is the
   application *plus* the sheet receding behind the palette. Read the comment.
4. **FIVE OF THE SIX UNDECIDED SURFACES LIVE OUTSIDE YOUR WINDOW, and you must
   not invent their doors.** §2.6 of this document lists what the demo GUI drew
   without deciding: Onboarding, Meeting capture, Live subtitles, Translation,
   the Agent overlay and the Handoff. Those are **Leg 4a's** decisions, taken
   with the owner, before wiring. What you owe is narrower and you owe it
   explicitly: **as you build the IA, write down where each entry point WOULD
   go and leave the hole.** A nav row that opens nothing is the fake affordance
   rule 7 forbids — the same reason the gallery's sidebar carries no search box
   (Leg 2a, finding 10). Onboarding is the one that may bite you directly,
   because it is a full-window flow and you own the windows: if the shell needs
   to know whether onboarding precedes the workspace, **record the question,
   ship the workspace, and hand it to 4a.**
5. **`/gallery` has no door in the native host**, and four legs have now owed
   it. Every window's URL is pinned in `src-tauri/tauri.conf.json` and rule 6
   put that file out of scope for Legs 1–4 — but you are rewriting `App.tsx`
   and the routes anyway, so **decide explicitly** whether the gallery gets a
   route you can reach or whether the temporary-hoist recipe stands for another
   leg. Say which in your record.

**The rules that still bind**

- Commit and push to `main`. No branch, no PR. Never `--no-verify`.
- ADRs are append-only. Next free number is **0059**; update
  `docs/decisions/README.md` when you file one.
- **The overlay does not change.** Rule 5 stands: no token, size or rule in
  `overlay*.css` or `OverlayPill.tsx`. `OverlayPillDrawing` draws it and is a
  copy of a measurement — if you change the shipped pill, that copy moves too.
- **`src-tauri/` is not touched.** Rule 6 stands through Leg 4, `tauri.conf.json`
  included; if point 4 above makes you want to open it, that is a decision to
  record and hand to Leg 5, not one to take quietly.
- **Never render fake readiness on a product surface.** This is the leg where it
  starts to matter for real: a gallery screen may carry sample data and assert
  nothing, and **the moment the same screen stands on the product surface it may
  not imply a state the runtime did not reach.** Nine of the 25 are previews and
  carry a `PreviewBanner`; the rest are wired in Leg 4, not here. A screen that
  is mounted but not wired **keeps its banner** until Leg 4 takes it off.
- No screen carries an inline spacing value. If one seems to need it, a
  primitive is missing a rule (ADR 0052).
- End green: `npm test`, `npm run build`, and `cd src-tauri && cargo test`
  because you are touching the shell. **Check it in the native host** — a
  window, a sheet and a shortcut are exactly what a browser preview cannot
  judge. The recipe is finding 5 in Leg 2d's record.

**What `npm run port:diff` is for now**

It compares the gallery against the prototype, and both of those still exist —
so it is your **regression check**, not your acceptance check. Run it after you
touch `shell.css` or any component: 40 measurements, and all 40 are exact today.
A shell change that breaks one has broken a screen you are not looking at.

`node scripts/gallery-port-diff.mjs home history profiles context context#0
context#1 context#3 contextintake contextintake#1 contextintake#2 contextactions
general hotkeys notesettings models models#1 agents agents#1 agents#2
integrations delivery privacy diagnostics about onboarding onboarding#3
translate subtitles meeting conversation agentoverlay handoff commit`

**When it is green**

Commit it, push it to `main`, append your record to the leg log, and write the
**Leg 4a prompt** into this document — 4a comes before the wiring and is the
leg that decides the behaviour the demo GUI never settled (§2.6): an ADR per
surface where the answer is a decision, a roadmap entry where it is "not yet",
and no code. Your own list of entry-point holes is its first input, so write
that list where 4a will find it. **Leg 4** then wires, section by section:
each section either reads the runtime truthfully or keeps its `PreviewBanner`;
P1 and P2 are fixed at the seam; and **each wired screen's Gallery → Screens
entry is deleted in the commit that wires it** (ADR 0057). The list of what the
runtime cannot answer is already written — §2.5 in this document, twenty
entries, split between Leg 4 wiring and Leg 5 contracts. Add to it; do not start
a second one.

Then report what you did, what you found, and anything the next leg needs to
know that is not already written down.
