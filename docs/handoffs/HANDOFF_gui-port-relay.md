# WordScript — GUI port relay

Opened 2026-08-04. **Active — Leg 1 is done and pushed. Leg 2 is next.**

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

## Rules every leg obeys

1. **Commit and push to `main`.** No branch, no PR. Push only when the leg is
   green.
2. **Never `--no-verify`.** The Husky hooks are the secret gate.
3. **ADRs are append-only.** New file, never an edit to an existing one. Next
   free number is **0057**; update `docs/decisions/README.md` when you file one.
4. **The prototype is read-only from here on** (ADR 0055). It is the reference
   the gallery is diffed against. If you ever must edit `demo.css` or `demo.js`,
   use **exact-match string replacement only** — never line numbers, never a
   computed byte range. On 2026-08-03 a rewrite by computed index destroyed
   about 1350 lines and was recovered only from a Claude Code file-history
   snapshot.
4b. **The prototype is the UI source of truth, and you read it per screen.**
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
| **2** | Every prototype screen into the gallery, 1:1 | All 25 screens stand in `/gallery` → Screens at the prototype's fidelity, on the real components |
| **3** | The shell overwrite | One window; settings is a sheet over the workspace at its own scale (§11.22); the new IA replaces the 14 flat areas; `Cmd+,`; old areas deleted |
| **4** | Wiring, section by section | Each section either reads the runtime truthfully or carries a `PreviewBanner`; P1 and P2 fixed at the seam; the list of what the runtime cannot answer is written down |
| **5** | Runtime contracts | §11.36 and §11.52, prioritised by what Leg 4 found blocking |
| **6** | Documentation and drift | DESIGN_SYSTEM, STATUS, ROADMAP, SPEC, README, CHANGELOG, `spec-sync` |

Legs 2 and 4 are large and may split into sub-legs (2a, 2b, …). A leg that
splits says so in its record and writes the prompt for the next sub-leg.

## Leg 2 — the active leg, in full

Plan reference: `docs/SETTINGS_REWORK_PLAN.md` §8 Stage 5 brought forward by
§16.3, read with §7 (what is a preview and what is not) and §11.15 (the one
withdrawn screen).

**Leg 2 has two halves and the first one is a repair.** Leg 1 ported the design
system correctly and then displayed it in four files it wrote from scratch. The
owner caught it in one glance on 2026-08-04. Fixing that is not optional
housekeeping: those four files are the gallery, the gallery is the acceptance
surface, and a gallery that shows a system nobody drew cannot be diffed against
the prototype it exists to be diffed against.

### 2.1 Re-port the gallery's own pages — do this first

`SCREENS.ds` in `demo.js` **is** the Design System screen, and it is 350 lines
of decided content: sections, copy, tables, state lists. Port it.

| File | Port from |
| --- | --- |
| `src/windows/gallery/Foundations.tsx` | `SCREENS.ds`, the sections up to and including *Radius* — `.ramp` with its L\* column, the `.spec` contrast table, `.type-row`, `.rhythm`, the *Elevation* rows, the *Rules this pass added* card, the *Radius* rows. Keep Leg 1's one addition: contrast and L\* are **measured** at render time from the live tokens, never printed as literals (ADR 0056 is the record of what happens otherwise) |
| `src/windows/gallery/Components.tsx` | `SCREENS.ds`'s *Components* section — five cards, *Buttons* · *Inputs* · *Level* · *Status* · *New in this plan* — plus the *Layout primitives* and *Motion* sections that follow it. Every state in each list, and the copy as written |
| `src/windows/gallery/Motion.tsx` | the matrix presentation the owner screenshotted: a card per mode with a name, its type (`vu` / `frames` / `pattern`) and a description, under a *Frame clock* header carrying `fps · loop · autoplay`. What is there now is the old `/component-lab` row of unlabelled swatches |
| `src/windows/GalleryWindow.tsx` | the prototype's `.rig` plus `.nav` grammar. The scheme switch stays where Leg 1 put it |

The buttons the prototype's component cards need do not exist as React
components yet — Leg 1 built eight primitives and `.btn` was not among them,
because §5.3 does not list it. Build it now, in `components/shell/`, ported from
`demo.css`'s `.btn` including `data-v="primary"` with its three-value material,
`ghost`, `danger`, `disabled` and `data-busy`. Same for `.chip` and `.ibtn` if a
section needs them. A gallery that draws a button inline is the same defect one
level down.

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
  to an existing record. The next free number is **0057**; update
  `docs/decisions/README.md` when you file one.
- `CHANGELOG.md` under `[Unreleased]`, your record in the leg log, and the
  **Leg 3 prompt**.

### Leg 2 is done when

- The four files of §2.1 are ported rather than composed, and a reader with the
  prototype open beside `/gallery` cannot name a section that was invented.
- All 25 screens stand in `/gallery` → Screens at the prototype's fidelity, on
  the components in `components/shell/`.
- `npm test` and `npm run build` are green, and the new screens carry tests —
  under ADR 0054 there is no coexisting old surface to fall back to, which makes
  the test obligation stricter than the plan's, not looser.
- The result was looked at in the native host, not only in a browser.
- It is committed and pushed to `main`, and the Leg 3 prompt is in this file.

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
| ADR 0048, 0051, 0052, 0053, 0054, 0055, 0056 | Light mode, frost, the row grammar, the level readout, the two delivery decisions, and the measured-contrast rule |
| `docs/REFERENCE.md` | Overlay sizes and CSS invariants, before drawing anything near the overlay |

Serve the prototype for comparison:
`python3 -m http.server 8791 --directory docs/prototypes/settings-rework`
## Leg log

| Leg | Date | Agent | Commit | Outcome |
| --- | --- | --- | --- | --- |
| 0 | 2026-08-04 | Opus 5 | `dbd83c6` | Relay opened. `gui-rework-second-pass` consolidated into `main` and deleted. ADR 0054 and 0055 filed. Baseline: 154 tests green, `/gallery` does not exist, Stage 1a and 1b unstarted apart from the `glass*` removal and the font wiring. |
| 1 | 2026-08-04 | Opus 5 | *this commit* | Dead code out, token write, eight primitives, `/gallery` shell, native-host look. 154 → 217 tests, `npm run build` green. ADR 0056 filed: the light scheme's `--fg-muted` was measured for the first time and missed AA. **The gallery's own pages were composed rather than ported — Leg 2 fixes that first.** Full account below. |

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

## The prompt for Leg 2

Copied to a fresh agent verbatim.

---

You are picking up the WordScript GUI port. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on the `main` branch. Do not create a branch.

Read `docs/handoffs/HANDOFF_gui-port-relay.md` first and in full. It is the
chain document: it names the two decisions this work rests on (ADR 0054 and ADR
0055), the rules every leg obeys, the record of what Leg 1 landed and got wrong,
and the full specification of **Leg 2**, which is yours. Then read what its
"Read before starting Leg 2" table lists.

**The one rule this leg is judged on: the prototype is the UI source of truth,
and you read it per screen.** For every screen and every section you build,
`grep -n "SCREENS\.<id>" docs/prototypes/settings-rework/demo.js`, read the
builder whole, and read the rules it uses in `demo.css`. Do not reconstruct a
screen from what `docs/DESIGN_SYSTEM.md` implies — that document describes the
system, it is not the design. Leg 1 ported the design system correctly and then
wrote the four files that display it from scratch; the owner saw the difference
in one glance, and repairing it is §2.1, which comes before anything else.

Serve the prototype and keep it open beside the app:
`python3 -m http.server 8791 --directory docs/prototypes/settings-rework`

Do Leg 2 completely — §2.1 (re-port the gallery's own four pages and add the
button/chip/icon-button primitives the prototype's component cards need), then
§2.2 (all 25 screens into `/gallery` → Screens, 1:1). Follow the acceptance list
at the end of the leg specification; do not declare it done while any item is
open. If it runs long, split into 2a/2b, say so in your record, and write the
prompt for 2b.

The short version of what governs this work, so you can spot it if you drift:

- The prototype is the accepted design and is read-only. The port is 1:1, down
  to spacing, radii, states and copy. Where it and this repo's shipped surface
  disagree, the prototype wins — that is the point of the port.
- The design-system rules live in `src/components/shell/` and
  `src/styles/shell.css`, never in a screen. If a screen needs a rule, the
  primitive grows it. No screen carries an inline spacing value.
- The gallery imports the product's components and never copies them. If a
  primitive looks right in the gallery and wrong in the product, the gallery is
  what lied.
- The overlay does not change. `src-tauri/` does not change.
- A gallery screen carries sample data and asserts nothing; every preview screen
  carries its `PreviewBanner`, and the withdrawn one carries the withdrawn
  variant.
- End green: `npm test`, `npm run build`. Look at the result in the native host,
  not only in a browser — and read Leg 1's record first, because reaching
  `/gallery` there needs a temporary frontend route and the reason is written
  down.

When Leg 2 is green: commit it, push it to `main`, append your leg record to the
leg log in the relay document, and write the **Leg 3 prompt** into that same
document — Leg 3 is the shell overwrite: one window, settings as a sheet over
the workspace at its own scale (§11.22), the new IA replacing the 14 flat areas,
`Cmd+,`, and the old areas deleted. Then report what you did, what you found,
and anything the next leg needs to know that is not already written down.

---
