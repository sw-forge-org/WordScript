# WordScript — GUI port relay

Opened 2026-08-04. **Active — Leg 2a is done and pushed. Leg 2b is next.**

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

**And the four surfaces are a state of the port, not the steady state**
([ADR 0057](../decisions/0057-the-prototype-has-an-expiry-date-and-the-gallery-has-two-halves.md)).
The prototype turns from source into provenance at the end of Leg 2: it is
read-only, ADR 0056 has already overtaken it by one hex, and every further leg
widens that gap, so after the last screen stands in the gallery **the gallery is
the source** and a disagreement with the prototype is either an ADR or a bug.
The gallery's Foundations, Components, Motion and Overlay are permanent; its
**Screens section is scaffolding** and retires per screen in the commit that
wires it, during Leg 4. The steady state is the library, the product, and a
gallery of four sections.

## Rules every leg obeys

1. **Commit and push to `main`.** No branch, no PR. Push only when the leg is
   green.
2. **Never `--no-verify`.** The Husky hooks are the secret gate.
3. **ADRs are append-only.** New file, never an edit to an existing one. Next
   free number is **0059**; update `docs/decisions/README.md` when you file one.
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
| **2a** | The library, and the gallery's own pages re-ported | *Done.* The controls of `demo.css` §6 and the shell of §3–§4 are in `components/shell/`; Foundations, Components, Motion and `GalleryWindow` are read out of `SCREENS.ds` |
| **2b** | The remaining 24 screens into the gallery, 1:1 | All 25 screens stand in `/gallery` → Screens at the prototype's fidelity, on the real components |
| **3** | The shell overwrite | One window; settings is a sheet over the workspace at its own scale (§11.22); the new IA replaces the 14 flat areas; `Cmd+,`; old areas deleted |
| **4** | Wiring, section by section | Each section either reads the runtime truthfully or carries a `PreviewBanner`; P1 and P2 fixed at the seam; the list of what the runtime cannot answer is written down; **each wired screen's Gallery → Screens entry is deleted in the commit that wires it** (ADR 0057) |
| **5** | Runtime contracts | §11.36 and §11.52, prioritised by what Leg 4 found blocking |
| **6** | Documentation and drift | DESIGN_SYSTEM, STATUS, ROADMAP, SPEC, README, CHANGELOG, `spec-sync` |

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

### Leg 2 is done when

Leg 2a closed the first, fourth and fifth of these on 2026-08-04. The second and
third are Leg 2b's, and the leg is not done until every one is closed.

- ✅ The four files of §2.1 are ported rather than composed, and a reader with the
  prototype open beside `/gallery` cannot name a section that was invented.
- ⬜ All 25 screens stand in `/gallery` → Screens at the prototype's fidelity, on
  the components in `components/shell/`. *One of 25 as of Leg 2a: the Design
  System screen, which is Foundations plus Components plus Motion.*
- ⬜ `npm test` and `npm run build` are green, and the new screens carry tests —
  under ADR 0054 there is no coexisting old surface to fall back to, which makes
  the test obligation stricter than the plan's, not looser. *Green at 244 after
  2a; the screens Leg 2b adds bring their own.*
- ✅ The result was looked at in the native host, not only in a browser. **The
  frost pair is settled and the material runs** — see Leg 2a's record.
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

## The prompt for Leg 2b

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
