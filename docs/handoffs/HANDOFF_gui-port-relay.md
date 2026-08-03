# WordScript — GUI port relay

Opened 2026-08-04. **Active — Leg 1 is next and nothing in it has been started.**

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
   free number is **0056**; update `docs/decisions/README.md` when you file one.
4. **The prototype is read-only from here on** (ADR 0055). It is the reference
   the gallery is diffed against. If you ever must edit `demo.css` or `demo.js`,
   use **exact-match string replacement only** — never line numbers, never a
   computed byte range. On 2026-08-03 a rewrite by computed index destroyed
   about 1350 lines and was recovered only from a Claude Code file-history
   snapshot.
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

## Leg 1 — the active leg, in full

Plan reference: `docs/SETTINGS_REWORK_PLAN.md` §8 Stage 1, as split by §11.13,
plus §15.1 which grew what the token write contains, plus §16 which records this
relay.

### 1.1 Dead code out

- Delete `src/components/areas/PermissionsArea.tsx`. It is exported and imported
  by nothing; its provenance and its four cards being a strict subset of
  `InsertRecoveryArea`'s six are re-verified in plan §2.2. Confirm no import
  survives.
- `glass*`, `ws-pill`, `--surface-glass` and the `glass` variants of
  `ui/card.tsx` and `ui/window.tsx` were removed in the fourteenth pass.
  **Verify, do not redo.** `grep -rn "glass\|ws-pill\|backdrop-filter" src/`
  should return only the sound pack named "Glass — soft bell", one line of prose
  in `OverlayGallery.tsx`, and the two comments in `overlay-pill.css` about the
  overlay's own faux glass.

### 1.2 The token write

Everything below lands in `src/styles/globals.css` and its `@theme inline` map.

- **The palette**, plan §5.1: the prototype's `[data-palette="after"]` values,
  with `--bg-inset` added. The dead duplicate `--bg-elevated: #141a20` — declared
  twice in the same `:root`, the first shadowed by the second — goes with it.
- **Three schemes** (ADR 0048): dark as today's default, light **rebuilt rather
  than inverted** with the accent at `#b45c00` because the identity orange is
  unreadable on white, and system following. Take the mechanism from the
  prototype, not from memory.
- **The radius ladder** (§11.32): `--r-window: 10px`, `--r-card: 8px`,
  `--r-control: 6px`, `--r-small: 4px`, assigned by what a thing *is*. Capsules
  survive only where the object is physically a capsule. The overlay keeps its
  own two radii and is not touched.
- **Material** (§15.1): the 1 px inset top highlight on cards and the four-step
  cast shadow ladder, replacing the four hardcoded shadow literals.
- **Frost as a named surface class** (ADR 0051): `filter: blur()` on the layer
  *behind*, a pair rather than a plane, receding layers nest. **Never
  `backdrop-filter`** — it is inert in WebKitGTK 2.52.4 while `@supports`
  reports it as supported. Only for a surface that floats and is transient:
  never a card, never the sidebar, never the overlay.
- **13 px is a named type step.** It was used 28 times before it was in the
  scale.
- **Fonts are already wired** — Archivo and IBM Plex Mono are bundled in
  `assets/fonts/` and declared in `globals.css`. Verify, do not redo.
- **Overlay guard, as a verification and not a job** (§11.14): confirm by grep
  that `overlay-pill.css` and `overlay-shell.css` reference no token from
  `globals.css`, then leave them alone. `git diff --stat` at the end of the leg
  must show them untouched.

### 1.3 The eight primitives

`LaneCard`, `SubTabs`, `SectionHeader`, `PreviewBanner`, `EmptyState`,
`DangerRow`, `Toolbar`, `ScopeTag` — plan §5.3 plus §11.7 — each with tests, in
`src/components/shell/`. Two notes that are not optional:

- `SubTabs` takes a `"|"` item that renders the dividing rule (§11.31).
- `PreviewBanner` is **a chip and one line, about 26 px** (§11.47), not the old
  dashed card with a paragraph. The withdrawn-screen variant keeps its box and
  its border, because a stop is exactly the case that has to interrupt.

Do **not** re-invent the four that already exist and were silently replaced by
worse controls in the first Stage 0 build (§11.9): `Stepper`, `VolumeSlider`,
`InputLevelMeter`, `DisclosureRow`. Use them.

**These rules go into the primitives, not into the screens.** They are what
§11.17 found the prototype patching screen by screen, and porting the patches
instead of the rules is the single most likely way this leg fails:

- The card owns its inset on all four sides; the **item** carries the horizontal
  inset so a group's separators reach the card's edge (ADR 0052). The action
  that acts on a card's content is a footer component, not a flex row with a
  guessed padding.
- A control that must look centred is drawn on integers — 16 / 2 / 8, never
  17 px with a 1.5 px border.
- A stat tile carries a number that **changes** and summarises more rows than
  fit on screen. Otherwise it is a row.
- **No coloured edge bar, ever.** Emphasis is the ground plus an icon tile.
- A badge is for a status that is **not expected**; an expected status is a dot
  and a word, or nothing. Badges live in a fixed right-aligned column, not in
  the flow (§11.20, §11.28).
- `--fg-muted` is confined to the card plane — 4.71:1 there, 3.94:1 on elevated.
  That is also why a row carrying muted text does not change ground on hover.
- **No scrollbars are drawn anywhere**, and nothing replaces them: the edge fade
  was built and removed (§11.28).
- No hover transition on card borders (§5.4, §6 P7).
- A list and its detail are one surface, not two cards — the `pane` primitive.
- One control per kind of value: a bounded number with a unit is a stepper, a
  proportion is a slider, a measurement with a decision threshold is a meter
  with the threshold drawn in, and a text field is what is left (§12.3).

### 1.4 The gallery shell

New route `/gallery` in `App.tsx`, lazy, no Tauri API, linked from no product
surface — the terms `/component-lab` already ships under. Five sections per
ADR 0055: **Foundations · Components · Motion · Overlay · Screens**.

- Foundations renders the tokens live in all three schemes with measured
  contrast, the type scale, the spacing rhythm, the radius ladder, elevation and
  the frost pair. The scheme switch belongs here so it is judged in one place.
- Components renders every shell primitive in every state, importing the real
  components. **The gallery never copies a component.**
- Motion is today's `/component-lab` content, folded in.
- Overlay is today's `/overlay-gallery` content, folded in.
- Screens is the frame only in this leg; Leg 2 fills it.
- Retire `/overlay-gallery` and `/component-lab` as routes once their content is
  in. Under ADR 0054 they are deleted, not aliased.

### 1.5 The native-host checkpoint

This is the checkpoint §11.13 moved *into* Stage 1b. It happens after the tokens
are written, not before.

- `npm run tauri build`, launch it, open `/gallery` → Foundations, and look at
  all three schemes on the real panel. Look at the frost pair. Look at the
  overlay in the same session (verification, not pinning).
- `npm run tauri dev` was recorded as not runnable here on 2026-08-03. Try it;
  if it runs, say so in your leg record, because the plan currently states the
  opposite.
- Record the outcome either way. **If today's palette does not crush on the
  panel, §2.3's premise is weaker than the plan claims** — say so plainly. That
  is the one outcome that reopens a value §0 records as settled.

### 1.6 Documentation this leg owes

- A new ADR only if a value departs from §5.1 or from ADR 0048/0051 — never an
  edit to those records.
- `docs/DESIGN_SYSTEM.md`: the new tokens, the three schemes, frost as a surface
  class beside `--bg-base` / `--bg-surface` / `--bg-elevated`, the radius ladder,
  the four rules of §11.17, the copy budget, the surface model. Correct anything
  in it that the product now contradicts.
- `CHANGELOG.md` under `[Unreleased]`.
- Your record in the leg log below, and **the Leg 2 prompt**.

### Leg 1 is done when

- `npm test` is green — 154 existing tests plus the new primitive tests — and
  `npm run build` is green.
- `/gallery` renders Foundations and Components, and the scheme switch works in
  all three schemes.
- `grep -rn "PermissionsArea\|backdrop-filter\|ws-pill" src/` returns nothing
  that is not a documented exception.
- `git diff --stat` shows `overlay-pill.css` and `overlay-shell.css` untouched.
- No primitive carries an inline spacing value.
- The native-host look happened and its outcome is written down.
- It is committed and pushed to `main`, and the Leg 2 prompt is in this file.

## Read before starting Leg 1

| Read | For |
| --- | --- |
| `CLAUDE.md` (= `AGENTS.md`) | The repo's own rules; they outrank any default |
| `docs/SETTINGS_REWORK_PLAN.md` §0, §5, §8, §11.7–§11.52, §12, §15, §16 | The derivation and every correction to it |
| `docs/prototypes/settings-rework/README.md` | The pass log, what is real and what is sample, the known limits |
| `docs/prototypes/settings-rework/demo.css` | The design system written out — tokens, scale, elevation rule, the three layout primitives |
| `docs/DESIGN_SYSTEM.md` | What the product currently claims, including what this leg corrects |
| ADR 0048, 0051, 0052, 0053, 0054, 0055 | Light mode, frost, the row grammar, the level readout, and this relay's two decisions |
| `docs/REFERENCE.md` | Overlay sizes and CSS invariants, before drawing anything near the overlay |

Serve the prototype for comparison:
`python3 -m http.server 8791 --directory docs/prototypes/settings-rework`

## Leg log

| Leg | Date | Agent | Commit | Outcome |
| --- | --- | --- | --- | --- |
| 0 | 2026-08-04 | Opus 5 | *this commit* | Relay opened. `gui-rework-second-pass` consolidated into `main` and deleted. ADR 0054 and 0055 filed. Baseline: 154 tests green, `/gallery` does not exist, Stage 1a and 1b unstarted apart from the `glass*` removal and the font wiring. |

## The prompt for Leg 1

Copied to a fresh agent verbatim.

---

You are picking up the WordScript GUI port. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on the `main` branch. Do not create a branch.

Read `docs/handoffs/HANDOFF_gui-port-relay.md` first and in full. It is the
chain document: it names the two decisions this work rests on (ADR 0054 and ADR
0055), the rules every leg obeys, and the full specification of **Leg 1**, which
is yours. Then read what its "Read before starting Leg 1" table lists.

Do Leg 1 completely — all six sections: dead code out, the token write, the
eight primitives, the `/gallery` shell, the native-host checkpoint, and the
documentation the leg owes. Follow the acceptance list at the end of the leg
specification; do not declare it done while any item is open.

The short version of what governs this work, so you can spot it if you drift:

- The prototype at `docs/prototypes/settings-rework/` is the accepted design and
  is now read-only. The port is 1:1 against it, down to spacing, radii, states
  and copy. Where the prototype and this repo's shipped surface disagree, the
  prototype wins — that is the point of the port.
- The design-system rules go into the primitives, never into a screen. The
  prototype had been patching four missing rules screen by screen; porting those
  patches instead of the rules is how this leg fails.
- The overlay does not change. `src-tauri/` does not change.
- Nothing renders fake readiness on a product surface. The gallery may carry
  sample data because a gallery asserts nothing.
- End green: `npm test`, `npm run build`. Look at the result in the native host
  via `npm run tauri build`, not only in a browser.

When Leg 1 is green: commit it, push it to `main`, append your leg record to the
leg log in the relay document, and write the **Leg 2 prompt** into that same
document — Leg 2 is every prototype screen into `/gallery` → Screens, 1:1, on
the real components. Then report what you did, what you found, and anything the
next leg needs to know that is not already written down.

---
