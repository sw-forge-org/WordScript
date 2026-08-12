# GUI port relay — the spent leg briefs

Every leg's actual brief, in the order the legs ran. A brief was written into
the relay by the leg before it; when its leg closed it stayed there, marked
spent, as the chain's record. They are collected here so the relay carries
only the brief that is still open.

Leg 2's brief was never written as a prompt — it stood in the relay as a full
specification, and it is reproduced first, with the reading list that went
with it. Both name paths that have since moved.

Relay: [`../tracks/gui-port-relay.md`](../tracks/gui-port-relay.md).
What each leg reported back:
[`gui-port-relay-leg-records.md`](gui-port-relay-leg-records.md).

---

## Leg 2 — the active leg, in full

Plan reference: `docs/archive/plans/settings-rework.md` §8 Stage 5 brought forward by
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
- ~~**Flip the prototype's status** (ADR 0057). When the last screen stands in
  the gallery, say so in this document and in `plans/settings-rework.md` §0,
  which still calls the prototype mandatory reading with no horizon. Rule 4b
  applies to screens not yet ported and expires with them.~~ **DONE by Leg 2 in
  `db9a6dc`** and struck through by Leg 9. §0 has read "the prototype is
  PROVENANCE, not the source" since 2026-08-04. **Nobody struck it, so six
  consecutive briefs re-carried it as owed** — including the Leg 9 prompt, which
  is what sent a leg to fix something that had been fixed for six legs. An owed
  list nobody marks off manufactures debt.

**The audio entries on this list now have records, and none of them has code.**
Added 2026-08-11 by the speech track, which did documentation only. The four
§2.5 bullets about per-language output routing, the mute of the recogniser,
speech in two directions and a voice that speaks are answered by
ADR 0095 (a streaming contract beside the batch one), ADR 0097 (a second output
stream on a selectable device), ADR 0098 (the mute, and the finding that `muted`
is not the primitive it looks like) and ADR 0099 (the direction of a turn) --
plus ADR 0107 (where a turn's audio comes from, since the cpal stream currently
lives exactly as long as the recording) and ADR 0108 (the routing is
machine-wide, is drawn on a window that may stand several times, and the runtime
announces no config change at all).
**Nothing is struck.** A §2.5 entry is closed by the runtime growing the fact,
not by a record saying it should — and the whole point of the striking rule is
that it marks work done rather than work decided. The capability survey behind
those records is `docs/PROVIDERS.md`.

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
| `docs/archive/plans/settings-rework.md` §7, §11.11, §11.15, §11.17, §11.20, §11.28 | Previews, invented vocabulary, the withdrawn screen, and the four rules that belong in primitives |
| ADR 0048, 0051, 0052, 0053, 0054, 0055, 0056, 0057, 0058 | Light mode, frost, the row grammar, the level readout, the two delivery decisions, the measured-contrast rule, the prototype's expiry, and why a gallery draws a live instrument at rest |
| `docs/REFERENCE.md` | Overlay sizes and CSS invariants, before drawing anything near the overlay |

Serve the prototype for comparison:
`python3 -m http.server 8791 --directory docs/prototypes/settings-rework`

---

## The prompt for Leg 2 (spent — kept for the chain's record)

Copied to a fresh agent verbatim.

---

You are picking up the WordScript GUI port. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on the `main` branch. Do not create a branch. **Leg 2 is yours and you finish it
completely.**

**Read this first**

`docs/tracks/gui-port-relay.md`, in full. It is the chain document: it
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
`plans/settings-rework.md` §0), and write the **Leg 3 prompt** into the relay
document. Leg 3 is the shell overwrite: one window, settings as a sheet over the
workspace at its own scale (§11.22), the new IA replacing the 14 flat areas,
`Cmd+,`, and the old areas deleted.

Then report what you did, what you found, and anything the next leg needs to know
that is not already written down.

---


---

## The prompt for Leg 2b (spent — kept for the chain's record)

Copied to a fresh agent verbatim.

---

You are picking up the WordScript GUI port. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on the `main` branch. Do not create a branch. **Leg 2b is yours: the 24
remaining screens.**

**Read this first**

`docs/tracks/gui-port-relay.md`, in full — especially Leg 2a's record
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
document and in `plans/settings-rework.md` §0, which still calls it mandatory
reading with no horizon. Then write the **Leg 3 prompt** into this document.
Leg 3 is the shell overwrite: one window, settings as a sheet over the workspace
at its own scale (§11.22), the new IA replacing the 14 flat areas, `Cmd+,`, and
the old areas deleted.

Then report what you did, what you found, and anything the next leg needs to
know that is not already written down.

---


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

`docs/tracks/gui-port-relay.md`, in full — especially Leg 2b's record
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
   `plans/settings-rework.md` §0, which still calls it mandatory reading with no
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

`docs/tracks/gui-port-relay.md`, in full — especially Leg 2c's record
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
   `plans/settings-rework.md` §0, which still calls it mandatory reading with no
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

`docs/tracks/gui-port-relay.md`, in full — Leg 2d's record directly
above this prompt, then 2c and 2b. Then `docs/archive/plans/settings-rework.md` §4.1,
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

`docs/tracks/gui-port-relay.md`, in full. Leg 3's record is the shell
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

`docs/tracks/gui-port-relay.md`, in full — **§2.6 is your brief** and
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


---

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

`docs/tracks/gui-port-relay.md`. Leg 4b's record directly above the
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


---

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

`docs/tracks/gui-port-relay.md`. Leg 4c's record directly above Leg
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


---

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

`docs/tracks/gui-port-relay.md`. Leg 4d's record is your starting
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


---

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

`docs/tracks/gui-port-relay.md`. **Leg 5's record is your starting
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


---

## The prompt for Leg 7 (spent — kept for the chain's record)

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

`docs/tracks/gui-port-relay.md`. **Leg 6's record is your starting
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


---

## The prompt for Leg 8 (spent — kept for the chain's record)

You are picking up WordScript after Leg 7. Work in the repo root on `main`. Do
not create a branch. `src-tauri/` is open, and **the core-hardening track is
working in the same tree** — check `git log --oneline -5` before you start and
stage your own paths when you commit.

### What is already true

**Profiles is editable.** The five controls that had been drawn and inert since
Leg 4c act (ADR 0082): Add and Edit on both rule lists, rename, `More`'s menu,
and both calls to `analyze_text_rules`. Every one opens a panel that unfolds
under the row or card it acts on. Both rule lists reorder. **One shape per job
holds across both pane screens** — adding is `+` in the list head, a row's
actions are a right-click, an icon on a row is only for what repeats
positionally, and deleting always asks at the row. Context's rail carries the
same gesture, drawn only.

### Read this first

`docs/tracks/gui-port-relay.md`. **Leg 7's record is your starting
state and its finding 1 binds you**: the owner lifted the Context do-not-touch
for one drawn change and nothing else. Then ADR 0082, `CLAUDE.md`,
`docs/spec/SPEC.md`, and `src/screens/props.ts`.

### The order

1. **The profile health flag's click, and it is the last thing between Profiles
   and `WiredScreenProps`.** The count is read and the sentences are the
   tooltip; the click has no destination because the four flag kinds point at
   three different tabs. Decide the routing — one flag routes to its own tab,
   several route to the first, or the flag opens a panel listing them with a
   door each — file the ADR, and take Profiles out of the gallery in the commit
   that closes it. Its drawn branch and `DRAWN_*` constants go with it, and its
   fidelity cases move to the wired suite rather than being dropped (ADR 0057).
2. **`duration_ms` in the transcript frontmatter.** §11.23 asks for it, the
   record has no source, and `transcript_store` has a test asserting its absence
   so that adding it is deliberate. The pipeline already times itself. Leg 7 did
   not get to it.
3. **Whether the title's model call belongs on a surface.** ADR 0077 spends a
   model call per dictation and no screen says so; every other model choice
   lives on AI Models' job list. Leg 7 did not get to it either.

### The rules you will be judged on

**NEVER RENDER FAKE READINESS (rule 7)**, in both directions — and Leg 7 is the
leg that shows what the second direction costs: it deleted five reasons, one
banner, and rewrote the test that had asserted them for three legs.

**CHECK WHETHER THE PRODUCT ALREADY SHIPPED THE THING AND SOMETHING DELETED
IT.** Leg 5's rule is about ADRs, Leg 6's about the plan, and Leg 7's is about
the deleted implementation: `PromptsTab.tsx` had the editor, the reorder and the
issues-at-the-rule, and Leg 3's own overwrite removed it.
`git log --diff-filter=D --name-only` is the tool.

**MEASURE THE ALTERNATIVE BEFORE YOU KEEP THE TIDY ONE.** Three menu anchors
were tried; the obvious wrapper cost `profiles` nine structural differences and
the second choice moved `context`, which was not this leg's to move.

**A PRIMITIVE WITH NO USER IS NOT PART OF THE SYSTEM.** `align="end"` and
`drop="down"` were added and deleted the same day for that reason.

### What you must NOT do

- **Do not widen the Context opening.** One drawn gesture was lifted, on
  2026-08-11, so the two rails would not differ. The screen is still going to be
  done differently and the owner still has not said how.
- **Do not mount any of the six undecided surfaces** (ADRs 0060–0064 plus the
  roadmap candidate). `ia.test.tsx`'s last case asserts none is mounted.
- **Do not migrate a config without a backup path.** `core::backup` is the
  pattern: snapshot, act, answer with where the snapshot went.
- **The overlay is still rule 5**, and its ghosting on a language change is
  documented rather than worked around.

### How to check yourself

- `npm test`, `npm run build`, `cd src-tauri && cargo test`. **Watch the TOTAL,
  not the colour.** **Under load the suite flakes and the number is 5** — three
  parallel runs failed a different 3–5 tests each and all passed in isolation.
  `npx vitest run --no-file-parallelism` is the tiebreaker; `uptime` tells you
  whether to reach for it.
- `npm run port:diff` after anything that could move a screen. Serve the
  prototype on 8791, run `npm run dev`, and expect **25 of 26 at structural 0 |
  style 0** with `profiles` at 172 vs 175 | structural 14 | style 18 — ADR 0068's
  departure plus ADR 0082's two.
- **The native host is the only instrument for a drawn state**, and Leg 7 found
  two defects with it that no test could see. `xdotool key ctrl+k` opens the
  palette through XTEST; clicks are dead. Where the palette cannot reach, use a
  temporary mount effect — and set the tab in one tick and open the panel in a
  `setTimeout`, or the clear-on-tab-change effect wipes it. Take it out before
  the commit.
- **Do not raise the window past somebody working at the machine — ask.**
- **Never `pkill -f`.** Kill by PID.

### When it is done

Commit, push to `main`, append your record to the leg log, and write the Leg 9
prompt. Then report what you did, what you found, and anything the next leg
needs that is not already written down.


---

## The prompt for Leg 9 (spent — kept for the chain's record)

You are picking up WordScript after Leg 8. Work in the repo root on `main`. Do
not create a branch. `src-tauri/` is open, and **the core-hardening track is
working in the same tree** — check `git log --oneline -5` before you start and
stage your own paths when you commit.

### What is already true

**Every screen that can be wired is wired, and the gallery is down to 25
measurements at structural 0 | style 0.** Profiles left it in Leg 8 with its
banner (ADR 0057, ADR 0085): the health flag opens a panel listing its flags,
each with the door to the tab that holds its cause and an Acknowledge that
reaches a per-profile set the runtime had been reading and nothing had written
since Leg 3. Two surfaces are still `PartlyWiredScreenProps` and both say why on
themselves — AI Models (one integrated lane of four) and Home (two of the
decision inbox's three sources have no receiver). Neither gap is closable by a
GUI leg: they are Phase 8 and V2.

**§11.23's frontmatter is complete** (ADR 0086), and the title model call's
surface is decided but not drawn (ADR 0087).

### Read this first

`docs/tracks/gui-port-relay.md`. **Leg 8's record is your starting
state**, and its finding 2 binds you: the Context do-not-touch stands except for
the one drawn gesture Leg 7 was given. Then ADR 0085 and ADR 0087, `CLAUDE.md`,
`docs/spec/SPEC.md`, and `src/screens/props.ts`.

### The order, and this leg is drift rather than features

1. **The drift pass, and it is the leg's body.** Run the `spec-sync` skill and
   then read, because a skill flags drift and does not know which side is
   wrong. `DESIGN_SYSTEM.md`, `ARCHITECTURE.md`, `REFERENCE.md`, `ROADMAP.md`,
   `README.md` and `plans/settings-rework.md` §0 have not been read against the
   product since the shell overwrite in most cases. §0 still calls the prototype
   mandatory reading with no horizon, which ADR 0057 ended — §2.5's last bullet
   has been owed since Leg 2. **The spec wins over an overview doc; the overview
   is the one that drifted.**
2. **The Titles row on AI Models** (ADR 0087). The decision is filed and the
   cost is measured: a ninth job row takes `models` from **structural 0 | style
   0** to **structural 18 | style 6**, because `port:diff` walks by path and an
   inserted element shifts every sibling index after it. That is a departure of
   ADR 0068's kind and it needs its own record with its own before-and-after —
   the expectation becomes 24 of 25 with `models` named. The row STATES and does
   not set: ADR 0077 resolves the model through `chat_model_for_provider` and
   adds no setting.
3. **`acknowledge_profile_health_flag` and `unacknowledge_profile_health_flag`
   have no caller.** Leg 8 wrote acknowledgement through the config seam, which
   is what every other discrete control on that screen uses, and left these two
   registered and unreachable. A primitive with no user is not part of the
   system (Leg 7). Either they become the seam for this one write — they take
   the config file lock, which `patch` does not — or they go. It is a runtime
   decision in a tree another track is working in, so ask before deleting.

### The rules you will be judged on

**NEVER RENDER FAKE READINESS (rule 7)**, in both directions. Leg 8 is the leg
that shows the second direction cheapest: a meter drawn against the UI's own
copy of a runtime constant reads right until the day the runtime changes it, so
it now draws nothing until the bound is answered.

**READ YOUR OWN TODOs BACK.** `duration_ms` sat unwritten for three legs behind
a docstring that said exactly when to write it, and ADR 0079 met that condition
without anybody re-reading the note. `grep -rn "when the\|goes in when\|once the"
src-tauri/src/` is a start; so is reading the record you are about to cite.

**CHECK WHETHER THE RUNTIME ALREADY SHIPS IT AND NOTHING CALLS IT.** Leg 7's
rule was the deleted implementation; Leg 8's is the orphaned command. Two
registered `#[tauri::command]`s wrote a config field the frontend never touched,
so a level nothing could change was being computed from it. `grep` the invoke
handler list against the frontend's `invoke(` calls.

**MEASURE THE ALTERNATIVE BEFORE YOU KEEP THE TIDY ONE.** Leg 8's entry 3 is
decided-and-owed because the row was built, measured at 18 and 6, and reverted.
An assertion about `port:diff` that has not been run is a guess.

### What you must NOT do

- **Do not widen the Context opening.** One drawn gesture was lifted, on
  2026-08-11, so the two rails would not differ. The screen is still going to be
  done differently and the owner still has not said how.
- **Do not mount any of the six undecided surfaces** (ADRs 0060–0064 plus the
  roadmap candidate). `ia.test.tsx`'s last case asserts none is mounted.
- **Do not edit an existing ADR.** Append-only. The next free number is **0088**
  and that sentence is the first thing that goes stale — grep the tree, source
  as well as `docs/`, because a number is cited in code before its file lands.
- **Do not migrate a config without a backup path.** `core::backup` is the
  pattern: snapshot, act, answer with where the snapshot went.
- **The overlay is still rule 5**, and its ghosting on a language change is
  documented rather than worked around.

### How to check yourself

- `npm test`, `npm run build`, `cd src-tauri && cargo test`. **Watch the TOTAL,
  not the colour.** Under load the suite flakes and the number is about 5;
  `npx vitest run --no-file-parallelism` is the tiebreaker and `uptime` tells you
  whether to reach for it. Leg 8 ran at load 1.5–3.0 and saw no flake at all.
- `npm run port:diff` after anything that could move a screen. Serve the
  prototype on 8791, run `npm run dev`, and expect **25 of 25 at structural 0 |
  style 0** — or 24 of 25 with `models` named, if you draw entry 2. The screen
  list is every gallery id except `ds`, plus `models#1 agents#1 agents#2
  onboarding#1`–`#6`. The `text` column is the soft category Leg 2a recorded as
  false positives; no leg counts it.
- **The native host is the only instrument for a drawn state.** Leg 7 found two
  defects with it and Leg 8 one — a filled `primary` button on a row that had
  deliberately receded, which jsdom sees as a correct variant string.
  `xdotool key ctrl+k` opens the palette through XTEST; clicks are dead. Where
  the palette cannot reach, use a temporary mount effect — set the tab in one
  tick and open the panel in a `setTimeout`, or the clear-on-tab-change effect
  wipes it. Take it out before the commit and grep for it.
- **Check whether a host and a dev server are ALREADY running before starting
  one.** Leg 8 started two that silently failed on a bound port; `ps -o lstart=`
  on the pid is what showed they were not its own.
- **Do not raise the window past somebody working at the machine — ask.**
- **Never `pkill -f`.** Kill by PID.

### When it is done

Commit, push to `main`, append your record to the leg log, and write the Leg 10
prompt. Then report what you did, what you found, and anything the next leg
needs that is not already written down.


---

## The prompt for Leg 10 (spent — kept for the chain's record)

You are picking up WordScript after Leg 9. Work in the repo root on `main`. Do
not create a branch. `src-tauri/` is open, and **the core-hardening track is
working in the same tree** — check `git log --oneline -5` before you start and
stage your own paths when you commit.

### What is already true

**The documentation describes the product again.** Leg 9 read SPEC, README,
ARCHITECTURE, REFERENCE, DESIGN_SYSTEM, VISION, ROADMAP, STATUS and the plan's
§0 against the shipped build — the first time since Leg 3's overwrite — and the
spec was the worst of them: it said *"none of it is wired"* about a port with
eight wired surfaces, under a `Status:` line whose drift-check date was current.

**AI Models names the title call** (ADR 0088), at a measured `models` 6 | 6
rather than the 18 | 6 ADR 0087 had priced, because the shape that carries "it
states rather than sets" is a flat row and a flat row shifts no sibling path.
`port:diff` is **24 of 25 at structural 0 | style 0**.

**Six caller-less commands are gone and eight are documented** (ADR 0089). The
sweep — `invoke_handler` against every `invoke(` in `src/` — found fourteen when
the brief expected two.

### Read this first

`docs/tracks/gui-port-relay.md`. **Leg 9's record is your starting
state, and its findings 2 and 3 will save you an hour** if you go near the
native host: `xdotool`'s geometry is not to be trusted on this compositor,
pointer events do not reach the webview, and `Tab` is how you scroll. Then ADR
0089, `CLAUDE.md`, `docs/spec/SPEC.md`, and `src/screens/props.ts`.

### The order, and both entries are decisions before they are code

1. **Text-rules import and export, and this is the leg's question.** The runtime
   is complete — schema version, conflict resolution, merge, analysis — and has
   had no caller since Leg 3's shell overwrite deleted the surface that called
   it. Nothing replaced it: `export_full_backup` writes the whole config, which
   is not a shareable rules document. **This is a capability the product had and
   silently lost**, and Leg 9 deliberately did not decide it. Three answers are
   open and each is defensible: draw it on Profiles (it is that screen's data
   and ADR 0082 already gives you the panel plane); fold it into Privacy & Data
   beside the backup (both are import/export of user data); or delete the
   runtime and record that WordScript does not share rule sets. **Ask the owner
   before deleting** — this is a product decision, not a cleanup.
2. **The four session commands SPEC names as contract and nothing calls.**
   `start_native_session`, `stop_native_session`, `native_session_status`,
   `complete_native_session`. The operations are alive — the Rust trigger path
   drives `start_from_native`, `processing_from_native` and the state machine
   directly — so these are command shells. `abort_native_session` is the one of
   the five with a caller, because the overlay draws an abort. Either the spec
   stops calling them the UI surface, or something starts calling them. Leg 9
   corrected the section's description and left the commands, because removing
   a contract is not a drift fix.

### The rules you will be judged on

**A DOCUMENT THAT ASSERTS A CAPABILITY IS HOW A REGRESSION HIDES.**
`ARCHITECTURE.md` claimed the UI does text-rules import/export for six legs. The
doc said present, the runtime said compiles, and only the caller was gone.
Nothing looks at callers unless somebody greps for them.

**A DRIFT-CHECK DATE IS NOT EVIDENCE OF A DRIFT CHECK.** SPEC's `Status:` line
read "last drift check 2026-08-11" over three-leg-stale content. If you touch a
`Status:` line, say what you actually read against what.

**STRIKE THE ITEM WHEN YOU DO IT.** §2.5's last bullet was discharged by Leg 2
in `db9a6dc` and re-carried as owed by six consecutive prompts, including Leg
9's. A list nobody marks off costs more than the drift it tracks, because a real
item and a phantom one look identical.

**MEASURE THE SHAPE YOU ARE SHIPPING, NOT THE ONE YOU TRIED.** ADR 0087's 18 | 6
was honest and belonged to a `LaneJobRow` that the same ADR's own ruling had
excluded. The number carried forward one leg as fact and was a third off.

**THE NATIVE HOST HAS FOUND A DEFECT IN THREE CONSECUTIVE LEGS**, and Leg 9's
was pure rendering: a 228-character row description against a ≤ 90 budget, which
jsdom reports as a correct string.

### What you must NOT do

- **Do not widen the Context opening.** One drawn gesture was lifted, on
  2026-08-11, so the two rails would not differ. The screen is still going to be
  done differently and the owner still has not said how.
- **Do not mount any of the six undecided surfaces** (ADRs 0060–0064 plus the
  roadmap candidate). `ia.test.tsx`'s last case asserts none is mounted.
- **Do not edit an existing ADR.** Append-only. The next free number is **0090**
  and that sentence is the first thing that goes stale — grep the tree, source
  as well as `docs/`, because a number is cited in code before its file lands.
- **Do not rename the `settings` window label** without being asked. Six Rust
  call sites and the window-state persistence key hang on it; the docs now say
  what it is and why it stayed.
- **Do not migrate a config without a backup path.** `core::backup` is the
  pattern: snapshot, act, answer with where the snapshot went.
- **The overlay is still rule 5**, and its ghosting on a language change is
  documented rather than worked around. The two commands that resized it
  dynamically are gone (ADR 0089) — do not bring that path back.

### How to check yourself

- `npm test`, `npm run build`, `cd src-tauri && cargo test`. **Watch the TOTAL,
  not the colour.** Leg 9 closed at 470 frontend across 39 files, `cargo test`
  740, `cargo check` 15 warnings. Under load the suite flakes by about 5;
  `npx vitest run --no-file-parallelism` is the tiebreaker and `uptime` tells
  you whether to reach for it. Leg 9 ran at 2.0–3.2 and saw none.
- **`npm run port:diff` TAKES A SCREEN LIST OR IT MEASURES NOTHING.** With no
  arguments it prints `ALL EXACT` over an empty set, which reads exactly like a
  pass. Serve the prototype on 8791, run `npm run dev`, and pass: every gallery
  id except `ds`, plus `models#1 agents#1 agents#2 onboarding#1`–`#6`. Expect
  **24 of 25 at structural 0 | style 0** with `models` at 6 | 6 (ADR 0088). The
  `text` column is the soft category Leg 2a recorded as false positives.
- **The native host is the only instrument for a drawn state**, and Leg 9's
  findings 2 and 3 are the operating manual: `spectacle -a -b -n -o <file>`
  captures the active window and is the only reliable capture — do NOT crop a
  full-desktop shot to an `xdotool` geometry, which on this compositor points
  somewhere else and twice landed on the owner's browser. Pointer events
  (clicks AND wheel) do not reach the webview; keys do. The palette opens on
  `ctrl+k`, takes arrows and `Return`, and ignores `xdotool type` — count rows.
  `Tab` is how you scroll a section: focus walks and drags the viewport.
- **Check whether a host and a dev server are ALREADY running before starting
  one**, and note that `tauri dev` starts its own Vite — a `npm run dev` you
  started yourself will collide with it on 1420. `ps -o lstart=` on the pid
  shows whose is whose.
- **Do not raise the window past somebody working at the machine — ask.**
- **Never `pkill -f`.** Kill by PID, and stop what you started.

### When it is done

Commit, push to `main`, append your record to the leg log, and write the Leg 11
prompt. Then report what you did, what you found, and anything the next leg
needs that is not already written down.


---

## The prompt for Leg 11 (spent — kept for the chain's record)

You are picking up WordScript after Leg 10. Work in the repo root on `main`. Do
not create a branch. `src-tauri/` is open, and **the core-hardening track is
working in the same tree** — check `git log --oneline -5` before you start and
stage your own paths when you commit.

### What is already true

**Text-rules import and export have a surface again** (ADR 0090), and the two
halves are on different screens because **export acts on a thing and import
creates one**: `Export rules` is the fourth verb on the profile's row menu,
import is on Privacy & Data and lands as a new profile. The capability had been
complete in the runtime and reachable from nothing since Leg 3.

**The four session commands are gone** (ADR 0091). They were the Python
sidecar's IPC command set, carried into `febc452` by the rewrite that made them
unnecessary, and no commit in the repository's history invoked one from `src/`.
`abort_native_session` stays. Both of Leg 9's open items are now closed.

**`port:diff` is 24 of 25 at structural 0 | style 0**, `models` the one
departure at 6 | 6 (ADR 0088). `cargo test` 740, `cargo check` 15 warnings, 473
frontend tests across 39 files.

### Read this first

`docs/tracks/gui-port-relay.md`. **Leg 10's record is your starting
state, and its findings 1 and 2 are the two that will cost you if you skip
them**: a row's one-line copy budget is a function of its control's width, and
`port:diff` accepts a screen name that is not a gallery id without complaining.
Then ADR 0090, ADR 0091, `CLAUDE.md` and `docs/spec/SPEC.md`.

### The order

1. ~~**The width defect on `General`, and it is a pass rather than a fix.**~~
   **STRUCK — done by Leg 11 (ADR 0092).** Measured rather than eyeballed: 123
   rows in the host, one line holding 12 to 73 characters, `≤ 90` wrong in all
   four places it was written down. **The rule in this bullet was wrong** — 62
   of the 74 over-length rows are the prototype's own copy, so two lines is the
   drawing's norm. Three rows were port-authored and shared one mistake: a row
   printing the runtime text its own control displays.
2. ~~**Whatever the drift pass turns up in `src-tauri/`.**~~ **STRUCK — done by
   Leg 11 (ADR 0093).** Leg 10's type extension found nothing further. The sweep
   itself was short by three: `read_diag_log`, `clear_diag_log` and
   `overlay_open_devtools`, orphaned by `8f9077e` and invisible because their
   names survive in a test mock.

### The rules you will be judged on

**A COPY BUDGET IS QUOTED WITH THE CONTROL IT IS FOR.** 79 characters is inside
the ≤ 90 one-line budget and drew three lines, because `.ws-row-ctl` is
`flex: none` and a `Select` plus a button leaves the text column about thirty
characters. jsdom reports the string and cannot report the wrap.

**ASK WHY IT IS THERE BEFORE YOU ASK WHETHER ANYTHING CALLS IT.** The owner
refused a deletion on a grep and that is what produced ADR 0091: the four
session commands looked exactly like a designed contract, and the fact that
separated them from one was in a deleted Python file's docstring, not in the
code. `git log -S` over the commit that introduced a primitive answers *why*.

**THE PROTOTYPE IS A SPECIFICATION EVEN IN ITS PROSE.** Where the rules export
goes had been written down since before the port, in a comment, and three legs
read past it. Read the drawing for the screen you are changing before you
design anything for it.

**A COMMENT ASSERTING A CONTROL IS INDISTINGUISHABLE FROM THE CONTROL.**
`Profiles.tsx` named four verbs over a menu of three for three legs — the same
defect as `ARCHITECTURE.md`'s, one layer down.

**STRIKE THE ITEM WHEN YOU DO IT.** Leg 9 struck a bullet six briefs had
re-carried. Leg 10 struck both of the entries Leg 9 added. Keep it that way.

### What you must NOT do

- **Do not widen the Context opening.** One drawn gesture was lifted, on
  2026-08-11, and the screen is still going to be done differently.
- **Do not mount any of the six undecided surfaces** (ADRs 0060–0064 plus the
  roadmap candidate). `ia.test.tsx`'s last case asserts none is mounted.
- **Do not edit an existing ADR.** Append-only. The next free number is **0092**
  and that sentence is the first thing to go stale — grep the tree, source as
  well as `docs/`.
- **Do not rename the `settings` window label** without being asked.
- **Do not migrate a config without a backup path.** `core::backup` is the
  pattern. ADR 0090's rules import is *not* an exception to it: it appends and
  replaces nothing, which is why it snapshots nothing, and it says so.
- **The overlay is still rule 5.** The two commands that resized it dynamically
  are gone (ADR 0089) — do not bring that path back.

### How to check yourself

- `npm test`, `npm run build`, `cd src-tauri && cargo test`. **Watch the TOTAL,
  not the colour.** Leg 10 closed at 473 frontend across 39 files, `cargo test`
  740, `cargo check` 15 warnings. Under load the suite flakes by about 5;
  `npx vitest run --no-file-parallelism` is the tiebreaker and `uptime` says
  whether to reach for it. Leg 10 ran at 1.3–1.4 and saw none.
- **`npm run port:diff` TAKES GALLERY IDS OR IT MEASURES NOTHING**, and a name
  that is not one is dropped in silence — Leg 10 passed nine retired screen
  names and got a run that looked full and was short. The 25 are the **16 ids in
  `src/windows/gallery/registry.tsx` except `ds`** plus `models#1 agents#1
  agents#2 onboarding#1`–`#6`. Read the registry, not a prose list: the prose
  goes stale every time a screen is wired and leaves the gallery. Expect **24 of
  25 at structural 0 | style 0** with `models` at 6 | 6 and 33 in the soft text
  column.
- **The native host is the only instrument for a drawn state**, and it has found
  a defect in four consecutive legs. `spectacle -a -b -n -o <file>` captures the
  active window and is the only reliable capture — do NOT crop a full-desktop
  shot to an `xdotool` geometry. Pointer events (clicks AND wheel) do not reach
  the webview; keys do, and **must be sent bare — `xdotool key --window <id>` is
  dropped**. The palette opens on `ctrl+k` and its `GO TO` block lists the four
  workspace views first, so two `Down`s and `Return` is Profiles from Home; it
  ignores `xdotool type`, so count rows. `Tab` reaches a control and drags the
  viewport with it.
- **Check whether a host and a dev server are ALREADY running before starting
  one.** `tauri dev` starts its own Vite, so a `npm run dev` you start yourself
  collides with it on 1420 and kills the host — and if the owner's session is
  already up, `port:diff` needs nothing started at all, because 1420 and 8791
  are both already served. `ps -o lstart=` on the pid shows whose is whose.
- **Do not raise the window past somebody working at the machine — ask.**
- **Never `pkill -f`.** Kill by PID, and stop what you started.

### When it is done

Commit, push to `main`, append your record to the leg log, and write the Leg 12
prompt. Then report what you did, what you found, and anything the next leg
needs that is not already written down.


---

## The prompt for Leg 12 (spent — kept for the chain's record)

You are picking up WordScript after Leg 11. Work in the repo root on `main`. Do
not create a branch. `src-tauri/` is open, and **the core-hardening track is
working in the same tree** — check `git log --oneline -5` before you start and
stage your own paths when you commit.

### What is already true

**The copy budget is measured, and it is a range rather than a number** (ADR
0092). One line holds between **12 and 73 characters** depending on the control
beside it, `≤ 90` was wrong in all four places it was written down, and
`DESIGN_SYSTEM.md` now carries the measured table. **Two lines is the drawing's
norm**: 62 of the 74 rows over one line are the prototype's own copy, so the
"at most one line" rule Leg 11 was handed described one card, not the design.

**Three commands ADR 0089's sweep missed are recorded and undecided** (ADR
0093): `read_diag_log`, `clear_diag_log`, `overlay_open_devtools`, orphaned by
`8f9077e` along with the text rules. `append_diag_log` still writes a log no
surface reads. Nothing was deleted.

**`port:diff` is 24 of 25 at structural 0 | style 0**, `models` the one
departure at 6 | 6 (ADR 0088). `cargo test` 740, `cargo check` 15 warnings, 473
frontend tests across 39 files.

### Read this first

`docs/tracks/gui-port-relay.md`. **Leg 11's record is your starting
state, and its findings 1 and 4 are the two that will cost you if you skip
them**: the instrument is ten lines and should be rebuilt rather than
rederived, and three whole classes of row have never been measured because they
are not rendered in a default state. Then ADR 0092, ADR 0093, `CLAUDE.md` and
`docs/spec/SPEC.md`.

### The order

1. **The rows no instrument has reached yet.** `Profiles`' editor panel,
   `Diagnostics`' non-default tabs and every `Models` job that is not expanded
   were never measured, because the instrument only sees what is rendered.
   Rebuild it (Leg 11 finding 1), open those surfaces, and apply ADR 0092's
   test: is the copy the prototype's, or did the port write it? Only the second
   is yours to change.
2. **Whatever the drift pass turns up in `src-tauri/`.** Run the sweep with
   Leg 11's third question: `invoke_handler` against `invoke(` in **non-test**
   `src/`, then the survivors against the whole tree to see what is still
   asserting them. That is what turned up ADR 0093's three.

### The rules you will be judged on

**MEASURE THE BUDGET, DO NOT CARRY IT.** The sheet's row width changed from 542
to 457 pixels between two passes in one session, which moved a text column from
165 px to 80. Every number in ADR 0092's table is a number at a window size.

**A ROW MUST NOT PRINT THE RUNTIME TEXT ITS OWN CONTROL DISPLAYS.** Not a length
mistake, and no length rule catches it: `.ws-sel` is `width: auto`, so the
string and the width have the same cause and shortening one moves the other.

**THE PROTOTYPE IS A SPECIFICATION EVEN IN ITS PROSE, AND IN WHAT IT LEAVES
OUT.** The drawing names a monitor `DP-1` where its own Select holds
`DP-1 (2560×1440) — primary`. Read the drawing for the screen you are changing
before you decide anything is a defect.

**A BRIEF'S RULE IS A CLAIM, AND CLAIMS GET CHECKED.** Leg 11 was sent to apply
"a row gets at most one line" and found it false of 62 rows on the surface it
was sent to fix. Checking it cost one script.

**ASK WHY IT IS THERE BEFORE YOU ASK WHETHER ANYTHING CALLS IT.** Still ADR
0089's question, and it is what kept three dev doors alive this leg.

**STRIKE THE ITEM WHEN YOU DO IT.** Leg 9 struck a bullet six briefs had
re-carried; Leg 10 struck both of Leg 9's; Leg 11 struck both of Leg 10's.

### What you must NOT do

- **Do not rewrite the prototype's copy.** ADR 0092 lists the rows still drawing
  three lines and they are the drawing's. Tightening them is a design decision
  and the owner's, not a port fix.
- **Do not widen the Context opening** beyond the drawn gesture lifted on
  2026-08-11 and the row pass the owner scoped on 2026-08-11 — ask.
- **Do not mount any of the six undecided surfaces** (ADRs 0060–0064 plus the
  roadmap candidate). `ia.test.tsx`'s last case asserts none is mounted.
- **Do not edit an existing ADR.** Append-only. The next free number is **0101**
  — 0094 through 0100 were claimed by the core-hardening track while Leg 11's
  checks were running, which is the second time in two legs that sentence went
  stale before the commit landed. Grep the tree, source as well as `docs/`.
- **Do not rename the `settings` window label** without being asked.
- **Do not migrate a config without a backup path.** `core::backup` is the
  pattern.
- **The overlay is still rule 5.** The two commands that resized it dynamically
  are gone (ADR 0089) — do not bring that path back.
- **Leave a temporary instrument out of the commit** and grep for it. Leg 11's
  lived at `src/dev/rowAudit.ts` with one hook in `WorkspaceWindow.tsx`.

### How to check yourself

- `npm test`, `npm run build`, `cd src-tauri && cargo test`. **Watch the TOTAL,
  not the colour.** Leg 11 closed at 473 frontend across 39 files, `cargo test`
  740, `cargo check` 15 warnings. Under load the suite flakes by about 5;
  `npx vitest run --no-file-parallelism` is the tiebreaker and `uptime` says
  whether to reach for it. Leg 11 ran at 1.6–2.4 and saw none.
- **`npm run port:diff` TAKES GALLERY IDS OR IT MEASURES NOTHING**, and a name
  that is not one is dropped in silence. The 25 are the **16 ids in
  `src/windows/gallery/registry.tsx` except `ds`** plus `models#1 agents#1
  agents#2 onboarding#1`–`#6`. Read the registry, not a prose list. Expect **24
  of 25 at structural 0 | style 0** with `models` at 6 | 6 and 33 in the soft
  text column. **Check `ss -ltn | grep 9333` first** — the script binds that
  port itself, and Leg 11 found a ten-hour-old browser holding it, which would
  have made a run attach to stale code instead of failing.
- **The native host is the only instrument for a drawn state**, and it has found
  a defect in five consecutive legs. `spectacle -a -b -n -o <file>` captures the
  active window and is the only reliable capture. Pointer events do not reach
  the webview; keys do, and **must be sent bare**. The palette opens on `ctrl+k`
  and lists the four workspace views first; `ctrl+,` opens settings, always on
  `General`. **But prefer the instrument to the screenshot**: it reads every row
  on every surface in one pass, including states no screenshot can reach.
- **Check whether a host and a dev server are ALREADY running before starting
  one.** `tauri dev` starts its own Vite, so a `npm run dev` you start yourself
  collides on 1420 and kills the host. `ps -o lstart=` on the pid shows whose is
  whose, and `xprop -id <win> _NET_WM_PID` maps a window to its process.
- **Do not raise the window past somebody working at the machine — ask.**
- **Never `pkill`.** Kill by PID, and stop what you started. `pkill -P $$` will
  kill your own shell — it cost Leg 11 a round trip, as `pkill -f` cost Leg 6.

### When it is done

Commit, push to `main`, append your record to the leg log, and write the Leg 13
prompt. Then report what you did, what you found, and anything the next leg
needs that is not already written down.

