# WordScript — GUI port relay

Opened 2026-08-04. **Active — Legs 0 through 13a are CLOSED and Leg 13b is
open.** Leg 13 split on 2026-08-14: 13a is the caller sweep, done; 13b is the
panel plane, which is the half where the port designs rather than carries.
Its brief is at the foot of this page; the page you paste to start it is
[`gui-port-relay-kickoff.md`](gui-port-relay-kickoff.md). Two other tracks work
in the same tree — see [`../IMPLEMENTATION.md`](../IMPLEMENTATION.md) — so stage
your own paths and never `git add -A`.

**This line is the one every leg forgets.** It said "Leg 6 is CLOSED, Leg 7 is
next" for six legs after Leg 7 closed. If you are reading it and it disagrees
with the leg log below, the leg log is right and your first edit is this
paragraph.

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
3. **ADRs are append-only.** New file, never an edit to an existing one. Update
   `docs/decisions/README.md` when you file one. **Do not trust a next-free
   number written on a page — grep the tree.** Three tracks file ADRs
   concurrently and a number is cited in a commit before its file lands; this
   rule carried a stale `0060` for sixty-three records.
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

**There is one table on this page and it is the leg log below.** The map that
used to stand here restated, per leg, what the leg log already says — it was
written as *done when* criteria and then overwritten with *done* summaries, so
it became a second account of the same twelve legs and drifted from the first.

What the map carried that the log does not:

- **Legs 2 and 4 were large and split into sub-legs** (2a, 2b, 2c, 2d; 4a, 4b,
  4c, 4d). A leg that splits says so in its record and writes the brief for the
  next sub-leg. Nothing forbids a future leg from splitting the same way.
- **The port had two halves.** Legs 1 through 4 put every screen into the
  gallery and left `src-tauri/` alone; Leg 5 was the first into the runtime, and
  the contract work was decided from what Leg 4 found rather than guessed at in
  front of it. That order is why rule 6 reads the way it does.

**Two commits on this track have no leg behind them.** `b330815` — the sidebar's
second width and the container-query tiers, ADR 0111 — landed on 2026-08-11 while
Leg 13 was open, and it is neither of Leg 13's two items. The 2026-08-14
`Context.tsx` wiring is the second: four `Open decision` badges removed, three
drawn states connected, three cases added to `screens.test.tsx`, recorded in
[`context-objects.md`](context-objects.md) so it is not rediscovered as that
track's work. Neither claimed a leg, so neither appears in a row. **Leg 13b
either adopts them into its record or files them as their own leg**; do not
leave them unattributed a third time.

## Leg log

Every leg the relay has run, in the order it ran. **This table is the index;
the paragraph accounts are the record.** Legs 1 through 8 keep theirs in
[`../archive/gui-port-relay-leg-records.md`](../archive/gui-port-relay-leg-records.md);
the four most recent keep theirs below.

A commit is listed only where a leg wrote one down. An empty cell is not an
absent leg — it is a leg whose record names its work and not its hash.

| Leg | Date | Commit | What it closed |
| --- | --- | --- | --- |
| 0 | 2026-08-04 | `dbd83c6` | Relay opened; `gui-rework-second-pass` consolidated into `main`. ADR 0054, 0055 |
| 1 | 2026-08-04 | `135771f` | Dead code out, the token write, eight primitives, the `/gallery` shell. ADR 0056 |
| 2a | 2026-08-04 | `438d1d4` | The gallery's own four pages ported rather than composed; the frost pair settled. ADR 0058 |
| 2b | 2026-08-04 | `d0f4baa` | Ten screens; `npm run port:diff` committed as the port's check |
| 2c | 2026-08-04 | `0fbddce`…`cd320f5` | Four screens; the check taught to reach a screen's other states |
| 2d | 2026-08-04 | `ae5af81`…`db9a6dc` | The last ten — all 25 stand. The prototype becomes provenance. ADR 0057 |
| 3 | 2026-08-05 | `8f9077e` | The shell overwrite: one window, four views, ten sections; fourteen flat areas deleted. ADR 0059 |
| 4a | 2026-08-05 | `67bd0f9` | Six drawn surfaces got a lifecycle. ADR 0060–0064. No code |
| 4b | 2026-08-06…10 | `a8dc617`…`87edf2f` | The seam, the rebuild lab, four of fourteen sections wired |
| 4c | 2026-08-10 | …`067b1ff` | The remaining six wireable sections |
| 4d | 2026-08-10 | | The surface nobody could see, the surface nobody had ported, one decision handed back |
| 5 | 2026-08-10 | …`c5766d5` | First leg into `src-tauri/`; the seventh `ProcessingMode`. ADR 0041, 0071–0073 |
| 6 | 2026-08-10 | `6608131`…`858bf33` | The transcript store, the retry routed by mode, `core::backup`, the decision inbox. ADR 0074–0077 |
| 7 | 2026-08-11 | | The five missing surfaces, on one panel plane; one shape per job. ADR 0082 |
| 8 | 2026-08-11 | | The health flag's click; **Profiles wired and out of the gallery**. ADR 0085–0087 |
| 9 | 2026-08-11 | | Documentation and drift; the Titles row measured; fourteen orphaned commands. ADR 0088, 0089 |
| 10 | 2026-08-11 | | Text-rules export/import and the session command shells, both decided rather than built. ADR 0090, 0091 |
| 11 | 2026-08-11 | | The copy budget **measured** across 123 rows and wrong in all four places it was written. ADR 0092, 0093 |
| 12 | 2026-08-11 | | The three unmeasured row classes; the sweep run the other way found a caller with no command. ADR 0103, 0104 |
| 13a | 2026-08-14 | | The sweep run over both channels of the seam; the `invoke` half clean, the event half not. ADR 0153 |
| **13b** | **open** | | The row classes the panel plane draws |

Legs 1 through 8 are closed and their full records are in
[`../archive/gui-port-relay-leg-records.md`](../archive/gui-port-relay-leg-records.md).
The four most recent stay below, because a leg's starting state is the record
of the one before it. The spent briefs are in
[`../archive/gui-port-relay-prompts.md`](../archive/gui-port-relay-prompts.md),
and the spent kick-off pages in
[`../archive/gui-port-relay-kickoffs.md`](../archive/gui-port-relay-kickoffs.md).

### Leg 9 — the doors nobody walked through, and the debt that had been paid six legs ago

**ALL THREE ENTRIES ARE DONE.** Two ADRs (0088, 0089). Three commits, plus the
documentation commit.

**THE THING TO TAKE FROM THIS LEG: A DOCUMENT THAT ASSERTS A CAPABILITY IS HOW
A REGRESSION HIDES.** `export_text_rules` and `import_text_rules` are complete
in the runtime — schema version, conflict resolution, merge, analysis — and
their caller went with Leg 3's shell overwrite. Nothing replaced them: the full
backup on Privacy & Data writes the whole config, which is a different artifact.
For six legs `ARCHITECTURE.md` said the UI does "preview, validation and
import/export in Text Rules", and every reader who checked the doc found the
capability present and every reader who checked the runtime found it compiled.
Only the caller was gone, and nothing looks at callers.

**THE SWEEP WAS SEVEN TIMES THE BRIEF.** The brief sent this leg after two
caller-less commands. `invoke_handler` against every `invoke(` in `src/` is two
greps and it found **fourteen**. Applying Leg 7's rule flatly — a primitive with
no user is not part of the system — would have deleted a lane ADR 0065 defers
and the lost capability above. So they are triaged by *why* they lost a caller
(ADR 0089), which is one command: `git log -S'"the_name"' -- src/`.

- **superseded → deleted (6):** both `*acknowledge_profile_health_flag`,
  `get_workspace_context`, `app_config_file_path`, `resize_overlay_to_height`,
  `resize_edit_overlay`. The resize pair is why the class goes rather than being
  tolerated: it is the dynamic sizing path this codebase abandoned, and leaving
  it registered keeps a route back into `known-issues/overlay-ghosting.md`.
- **owed a surface → kept:** `preview_prompt_enhance` (ADR 0065, Phase 8).
- **lost capability → kept and listed:** the text-rules pair.
- **command shell only → kept and listed:** `transcribe_audio_file` and the four
  session commands, whose functions the Rust pipeline drives directly.

Five `OVERLAY_EDIT_MODE_*` constants went with the resize commands. `cargo check`
named all five the moment those two left — the compiler confirming they had
exactly one user. 20 warnings to 15.

**THE LEG 8 RECORD IS WRONG ON ONE PREMISE AND THIS LEG CORRECTS IT.** It says
the acknowledge commands lost their caller "since Leg 3 deleted `PromptsTab.tsx`
in `8f9077e`, which is the file that used to call them". That file did not call
them: it held acknowledgements in React `useState` and passed them to
`get_profile_health` as a request field, so they were never persisted at all.
`git log --all -S` finds **no commit in the repository's history** in which
either was invoked from `src/`. They were a surface never built, not a caller
deleted. Leg 8's rule survives; its example does not.

**§2.5's LAST BULLET HAS BEEN DONE SINCE LEG 2 AND SIX BRIEFS RE-CARRIED IT.**
"Flip the prototype's status … `../archive/plans/settings-rework.md` §0, which still calls
the prototype mandatory reading with no horizon." §0 has read *"the prototype is
PROVENANCE, not the source"* since `db9a6dc` — Leg 2's own closing commit.
Nobody struck the bullet, so every subsequent prompt inherited it, including the
Leg 9 prompt, which sent a leg to fix something fixed six legs earlier. The
bullet is struck through now. **An owed list nobody marks off manufactures
debt**, and it is more expensive than the drift it was tracking, because a real
item and a phantom one are indistinguishable to the next reader.

**THE MEASURED COST WAS A THIRD OF THE PRICE, AND THE SHAPE IS WHY.** ADR 0087
priced the Titles row at **structural 18 | style 6**, measured on a
`LaneJobRow`. But `LaneJobRow` contradicts ADR 0087's own ruling that the row
states rather than sets: its `<details>` would open onto an empty body, the fake
affordance rule 7 forbids. The shape that carries the decision honestly is a
flat `JobNone`, and it costs **6 | 6** — its own six nodes plus one height
reported at each of six ancestors. `JobNone` renders `div.job` where
`LaneJobRow` renders `details.job`, so an appended flat row occupies its own
sibling index space and **shifts no path at all**. Both ends measured in this
leg rather than inferred (ADR 0088).

**THE NATIVE HOST FOUND A DEFECT AGAIN — THE THIRD LEG RUNNING.** The row
shipped with a 228-character description carrying the Verbatim ruling and the
ADR 0077 fallback. The copy budget is ≤ 90 on one line and its three neighbours
run 82, 91 and 98. jsdom sees a correct string; WebKitGTK draws four lines
against rows that take one. Now 78. Both facts that went were already recorded
in ADRs, which is where a fact that does not fit a row belongs.

**WHAT LEG 9 REMOVES FROM §2.5.**

- **AI Models has no row for the title model call** — closed (ADR 0088).
- **`acknowledge_profile_health_flag` and `unacknowledge_profile_health_flag`
  have no caller** — closed by deletion (ADR 0089).

**WHAT LEG 9 ADDS TO §2.5.**

- **Text-rules import and export have a complete runtime and no UI.** A
  capability the pre-port surface had. Not a runtime gap and not a drawn-design
  debt — a third kind: a shipped feature whose surface was deleted.
- **Four session commands SPEC names as contract have no UI caller.**
  `start_native_session`, `stop_native_session`, `native_session_status`,
  `complete_native_session`. The operations are alive via the Rust trigger path.
  Removing them is a contract change, so this leg corrected the SPEC section
  describing them and left the commands alone.

**Findings for Leg 10.**

1. **THE SPEC ITSELF HAD DRIFTED, AND IT IS THE FILE EVERY OTHER DOC DEFERS
   TO.** `docs/spec/SPEC.md` said **"none of it is wired"** about a port where
   eight surfaces write the runtime and two more read it. It described the
   `settings` window as the pre-port shell with a 232px sidebar. Its "Tauri
   commands (UI -> Rust), key surface" list carried four commands no UI calls
   and two entries (`reveal_overlay_window`, `park_overlay_window`) that are not
   commands at all. Its `Status:` line said "last drift check 2026-08-11" — the
   date was current and the content was three legs stale. **A drift-check date
   is not evidence of a drift check.**
2. **`xdotool` reports geometry this machine's compositor does not honour.**
   `getwindowgeometry` returned three different positions for one window across
   one session and none matched where it was drawn; `getdisplaygeometry` returns
   the primary monitor only while windows sit past its right edge. Cropping a
   full-desktop `spectacle` capture to those numbers lands on whatever else is
   on screen — twice it landed on the owner's browser. **`spectacle -a -b -n -o
   <file>` captures the active window and is the only reliable instrument**;
   `xdotool getactivewindow` is trustworthy, its geometry is not.
3. **Synthetic POINTER events do not reach the webview; synthetic KEYS do.**
   Leg 6 recorded that clicks are dead. The same holds for the wheel: fourteen
   `xdotool click 5` over the content scrolled nothing. `Page_Down` also did
   nothing, because the scroll container has no focus. **`Tab` is the scroller**
   — 34 of them walk focus from the top of AI Models to the Writing group and
   drag the viewport along. The command palette takes arrow keys and `Return`
   but ignores `xdotool type`, so navigate it by counting rows, not by typing.
4. **The Leg 9 prompt itself carried a stale instruction** (see the §2.5 finding
   above) **and a stale number** (ADR 0087's 18 | 6, correct for a shape the
   decision it accompanied had ruled out). Both were caught by checking rather
   than by obeying. A prompt is a leg's best summary of the state, not the state.
5. **Three `never used` warnings survive `cargo check` and are not this leg's:**
   `should_oscillate_flat_reveal`, `NativeInsertionState::configure`,
   `ModeHotkeys::for_mode`. They are in the tree the core-hardening track is
   working in; the sweep that found them is in ADR 0089 and they were left alone
   deliberately.
6. **`port:diff` takes an explicit screen list or it measures nothing.** With no
   arguments it prints `ALL EXACT` over an empty set, which reads exactly like a
   pass. The list is every gallery id except `ds`, plus `models#1 agents#1
   agents#2 onboarding#1`–`#6` — 25 measurements.
7. **The window label is still `settings` and still names the wrong thing**, on
   a window that is the workspace. Six Rust call sites and the window-state
   persistence key hang on it, so renaming is a runtime change rather than a doc
   fix; the docs now say what the label is and why it stayed. `mode_router.rs`'s
   citation of `OverlayGallery.tsx` — a file ADR 0055 folded away — is gone.

**Checks at the close.** 470 frontend tests across 39 files (from 469), `cargo
test` 740 unchanged, `cargo check` 15 warnings (from 20), `npm run build` green,
`port:diff` **24 of 25 at structural 0 | style 0** with `models` at 6 | 6. Load
was 2.0–3.2 throughout and the suite did not flake; `--no-file-parallelism` was
used for the final count anyway. The Titles row was confirmed in the native host
before and after the copy fix.


### Leg 10 — the question the drawing had already answered, and the budget that turned out to be a variable

**BOTH ENTRIES ARE DONE.** Two ADRs (0090, 0091). Two commits, plus the
documentation commit.

**THE THING TO TAKE FROM THIS LEG: A CONTROL'S WIDTH IS PART OF ITS COPY
BUDGET, AND NOTHING IN THE TOOLCHAIN KNOWS THAT.** The Privacy & Data rules rows
shipped their first build at **79 and 71 characters** — both comfortably inside
the ≤ 90 one-line budget every other row on the surface is written to, both
measured against it before the host was opened — and WebKitGTK drew them at
**three lines and two** against neighbours that drew one. `.ws-row-ctl` is
`flex: none`, so every pixel the control takes comes off the text column: a row
whose control is a `Select` plus a button has roughly **thirty** characters per
line where a row with a single button has fifty. Leg 9's defect was a string too
long for a constant budget. This one was a string inside the budget and a budget
that was not a constant. The fix is the donor's own rule — the explanation
belongs on the section header, a row gets at most one line — and the finding is
that **the budget must be quoted with the control it is for**.

**THE PROTOTYPE HAD ANSWERED HALF THE LEG'S QUESTION IN A SENTENCE NOBODY HAD
READ AS A SPECIFICATION.** Where text-rules export goes was framed as three open
placements. The prototype's Profiles section already says *"Duplicate and Export
are things you do to a profile rarely and from the list, not from the header of
the one you are editing — they are on the row's own menu."* Leg 7 built that menu
with three verbs and `Profiles.tsx`'s docblock carried the sentence naming four.
**A comment asserting a control is indistinguishable from the control** — ADR
0089's finding at the scale of a source file, found the same way: by checking
the claim instead of reading it.

**THE OWNER ANSWERED THE OTHER HALF BY REJECTING THE OBVIOUS FIX.** Asked to
confirm export and import together on the row menu, they said an Import there
makes no sense — *what am I supposed to do with it then*. That is the design in
one question. **Export ACTS ON a thing; import CREATES one**, so they are not a
pair and must not be drawn as one: export is the fourth verb on the row menu and
writes the row it opened on; import is on Privacy & Data, lands as a **new**
profile and replaces nothing, because the profile it makes does not exist yet
and has no row to act on (ADR 0090). Privacy & Data carries the export too, with
a picker, for a reader who is there to move data rather than to edit a profile.

**THE SESSION COMMANDS WERE THE PYTHON SIDECAR'S CONTRACT** (ADR 0091). The
owner refused a deletion on a grep and asked why they were integrated in the
first place — which was the right instinct and produced the answer.
`wordscript/ipc.py` documents the Tauri → Python channel as `start_recording` /
`stop_recording` / `abort_recording`: the sidecar owned session state in another
process, so the host genuinely had to drive it from outside. `febc452` carried
that command set across as `#[tauri::command]`s and, **in the same commit**,
moved trigger, capture and pipeline into the Rust process — so the caller they
existed for became `start_from_native`, `processing_from_native` and
`complete_processing_session` before the commit creating them had finished
landing. They read as a designed UI contract for six legs, and the thing that
distinguished them from one was not in the code at all: it was in a deleted
Python file's docstring.

`abort_native_session` stays, because abort is the one lifecycle transition a
**user** makes. `complete_native_session` was worse than unreached: it emitted
only `wordscript-native-event`, the channel `AGENTS.md` says may never end a
session, and its `complete_current_transcription` completed whichever session
happened to be processing rather than the one the result belongs to — the
session-id guard, removed one frame after `complete_processing_session` applies
it. `useRuntime.ts`'s fallback comment names the caller it was guarding against.

**NO PLANNED CALLER LOSES ANYTHING, AND THAT IS CHECKABLE RATHER THAN ASSUMED.**
A `#[tauri::command]` is reachable only from this app's own webviews — no CLI
plugin is configured, no test names any of the four — so the roadmap's MCP
bridge, specified to run *in the Tauri process, no daemon*, could never have
reached them. It calls the same Rust functions the trigger path calls.

**WHAT LEG 10 CLOSES.** Both of Leg 9's additions, in opposite directions:
text-rules import/export got its surface, the four session commands were
removed. What separated them was never whether they had a caller — neither
did — but *why*, which is the question ADR 0089 exists to ask.

**Findings for Leg 11.**

1. **THE SAME WIDTH DEFECT IS ALREADY SHIPPING ON `General`, AND IT IS A
   PATTERN RATHER THAN AN INCIDENT.** `Input device` pairs a wide `Select` with
   a `Rescan` button and a runtime-conditional hint — *"Saved microphone is not
   available right now. WordScript will fall back to default on the next
   capture."* — which draws at **six lines** in the host. It was visible in this
   leg's own screenshots. It is conditional copy, so a default-state check never
   sees it, and `General` is nobody's this leg. Worth a pass over every `Row`
   whose control is more than one button.
2. **`port:diff` TAKES GALLERY IDS, AND A NAME THAT IS NOT ONE MEASURES NOTHING
   SILENTLY.** Leg 9 recorded that no arguments prints `ALL EXACT` over an empty
   set. The sharper version: passing the *retired* screen names — `profiles`,
   `privacy`, `history`, `general`, `hotkeys`, `delivery`, `diagnostics`,
   `about`, `notes` — produces no measurement and no error either, so a run can
   look full and be short. The 25 are the **16 ids in `SCREEN_GROUPS` except
   `ds`** plus `models#1 agents#1 agents#2 onboarding#1`–`#6`. Read
   `src/windows/gallery/registry.tsx` for the list rather than a prose one; the
   prose list in a prompt goes stale every time a screen is wired.
3. **A `pub` Rust item with no user compiles silently, and that is the same
   property that hides a caller-less command.** `StartNativeSessionRequest` and
   `CompleteNativeSessionRequest` survived the command deletion with no warning
   at all — `cargo check` stayed at exactly 15. The sweep ADR 0089 put in the
   drift pass has to cover types reached only by a deleted command, not just the
   `invoke_handler` list.
4. **The three `never used` warnings are still not this leg's:**
   `should_oscillate_flat_reveal`, `NativeInsertionState::configure`,
   `ModeHotkeys::for_mode`. Unchanged from Leg 9's finding 5, still the
   core-hardening track's.
5. **The host reached its own defect through the palette in about a dozen
   keystrokes**, which is cheaper than Leg 9's 34 Tabs and worth reusing: the
   palette's `GO TO` block lists the four workspace views first, so `ctrl+k`,
   two `Down`s and `Return` is Profiles from Home. `Tab` is still the only way
   to reach a control — the row menu opened from the `More` button at Tab 16
   from the view's first focusable, and `Return` opens it. **Escape must be sent
   to the ACTIVE window with a bare `xdotool key`**; `xdotool key --window <id>`
   was silently dropped by the webview and cost one round trip.
6. **The settings sheet reopens on `General`, not on the section it was closed
   on.** Not investigated and possibly deliberate; noted because it made
   restoring the owner's session to where it was found impossible without
   navigating.

**Checks at the close.** 473 frontend tests across 39 files (from 470 — three
added, none removed), `cargo test` **740 unchanged**, `cargo check` **15
warnings unchanged**, `npm run build` green, `port:diff` **24 of 25 at
structural 0 | style 0** with `models` at 6 | 6 and 33 in the soft text column.
Both screens this leg touched had already left the gallery, so no measurement
moved. Load was 1.3–1.4 throughout and the suite did not flake. Both drawn
states were confirmed in the native host, which is where the copy defect was
found and where the fix was confirmed.


### Leg 11 — the budget nobody had measured, and the rule that turned out to describe one card

**BOTH ENTRIES ARE DONE.** Two ADRs (0092, 0093). Two commits, plus the
documentation commit.

**THE THING TO TAKE FROM THIS LEG: THE BUDGET WAS MEASURABLE ALL ALONG, AND
MEASURING IT CONTRADICTED THE BRIEF THAT SENT ME TO APPLY IT.** Leg 10 said a
copy budget is a function of the control beside it and that nothing in the
toolchain knows that. The second half was the part worth acting on: a mount
effect that walks the surfaces and reads `.ws-row-hint`'s
`getBoundingClientRect().height` against its computed line-height reports the
drawn line count directly, in the shipped engine, for **123 rows and 51
conditional states** in about twenty seconds. What it reported:

| Control | Text column | One line holds |
| --- | --- | --- |
| runtime-filled `Select` + `Button` | 80–165 px | **12–26 characters** |
| runtime-filled `Select` | ~250 px | ~34 |
| `Select`, fixed options | ~300–350 px | ~45–57 |
| badge or one `Button` | ~400–470 px | ~62–73 |
| stacked row | 436 px (`62ch` cap) | ~60–74 |

**`≤ 90` IS WRONG FOR EVERY CASE IN THAT TABLE**, and it was written down in
four places: `Card.description`'s docblock, `SectionHeader.description`'s,
`DESIGN_SYSTEM.md`'s copy-budget table and the plan's §5.2 — where it was
additionally promised a **lint rule**, which was never possible for a number
that is not knowable from the source. `Card`'s had been copied from
`SectionHeader`, whose paragraph is not even the same width: it shares its row
with the section's `action`, so it was measured between 131 px (23 characters)
and 444 px (about 70) on the shipped surfaces. All four are corrected.

**THE RULE IN MY OWN BRIEF DESCRIBED ONE CARD.** "The explanation belongs on the
section header; a row gets at most one line" — of **74 measurements over one
line, 62 carry the prototype's copy verbatim**. Two lines is the drawing's norm,
consistently, on Models, Agents, Integrations, Notes & Meetings, Privacy and
About. Applying the rule as written would have rewritten sixty rows of the
donor's copy on the authority of a sentence derived from one card of two. The
check that separated them was mechanical: normalise the string, ask whether
`demo.js` contains it. Three lines beside neighbours drawing one is the real
departure, and that is what Leg 10 actually fixed.

**THE THREE PORT-AUTHORED DEFECTS ARE ONE MISTAKE, AND IT IS NOT A LENGTH
MISTAKE.** `General`'s `Input device`, `General`'s `Anchor` and `About`'s
`Latest published release` each put **the control's own runtime text into the
hint beside it** — a device name, a monitor label, a release summary. `.ws-sel`
is `width: auto`, so that text is also what sets the control's width: the row
spends its text column on the string and then tries to print the string in what
is left. Every length rule misses this, because the string and the width have
the same cause and shortening one moves the other. The drawing had none of it —
the prototype gives `Input device` a 46-character static hint and names the
monitor `DP-1` where its own Select holds `DP-1 (2560×1440) — primary`.

**A SHORTER SENTENCE WAS TRIED FIRST AND THE INSTRUMENT REFUSED IT.** The
replacement ran 24 characters and still drew two lines, because the row had
**80 pixels**. That is the measurement that decided the fix: the row is given no
hint at all. The standing fact is the card's description; a running capture and
a missing device are exceptional and get a `Note` under the card, which spans it
at about seventy characters a line; an error stays on the row and wraps, because
truncating a runtime error would be a lie about the runtime. In the state that
mattered most the row was repeating its own control — the `<option>` already
reads `<name> — not available`.

**THE SECOND DEFECT WAS UNREACHABLE BY SCREENSHOT.** `Anchor` is only rendered
in preset placement and the machine is in manual, so the row does not exist on
this surface. It was found by reading the drawing for the screen being changed,
and priced by cloning the hint node and setting the alternate text. **Enumerate
the states** in the brief meant this, and a screenshot pass would have closed
the leg without seeing it.

**`native_capture_status` NEARLY LOST ITS ONLY CALLER TO A COPY FIX.** Dropping
the recording sentence made `captureStatus` dead state, and deleting the invoke
with it would have manufactured exactly the drift ADR 0089 sweeps for — inside
the leg running the sweep. The fact moved to the `Note` instead, where it has
room to name the device.

**THE SWEEP'S OWN LIST WAS SHORT** (ADR 0093). `read_diag_log`,
`clear_diag_log` and `overlay_open_devtools` have no caller and were **not**
among ADR 0089's fourteen. All three were orphaned by `8f9077e` — Leg 3's shell
overwrite, the same commit that orphaned the text rules — which deleted
`OverlayDiagPanel.tsx`. Leg 9 missed them because their names still appear in
`src/`: as `case` arms in `OverlayWindow.test.tsx`'s invoke mock, which nothing
removed when the panel went. **A command whose name survives in a test mock
looks called to a name-grep and uncalled to a call-grep, and only the second is
true.** `append_diag_log` still has a live caller, so WordScript writes a
diagnostic log no surface can read, and both comments went on naming the deleted
panel for eight legs. Corrected, recorded, nothing deleted — the devtools door
has no shell substitute and the other two do.

**Findings for Leg 12.**

1. **THE INSTRUMENT IS TEN LINES AND IT SHOULD BE REBUILT RATHER THAN
   REDERIVED.** A mount effect that walks `VIEWS` and `SECTIONS` with a 700 ms
   settle, reads each `.ws-row-hint`'s height against its line-height, clones
   the node to price alternate strings, and **POSTs to a loopback collector**.
   `tauri.conf.json` sets `csp: null`, so `fetch` needs no permission and lands
   in a file the shell can read immediately. `append_diag_log` was tried first
   and failed silently into its own `.catch` — do not debug through a channel
   whose failure mode is silence.
2. **THE SHEET'S WIDTH IS NOT CONSTANT BETWEEN RUNS.** The same rows measured
   542 px of row width in one pass and 457 in the next, which moved
   `Input device`'s text column from 165 px to 80. Any budget is a budget at a
   window size. Measure, do not carry a number.
3. **THE ROWS STILL DRAWING THREE LINES ARE THE PROTOTYPE'S** and were left
   alone deliberately: Models (`Bias from the profile's words`, `Into`,
   `Address form`, `When it looks`, the assistant `Provider`), Agents
   (`Restart it` at **four**, `Changing it`, `Open a terminal here`,
   `Instruction file`, `Adding one`), Privacy (`Context objects`, `The accounts
   you do have`), About (`Account, sign-in and sync`). If the owner ever wants
   the drawing's copy tightened, that is the list and it is a design decision,
   not a port fix.
4. **`Profiles`' editor rows were never measured.** The panel is closed in the
   default state and the instrument only sees what is rendered; the same is true
   of `Diagnostics`' non-default tabs and every `Models` job that is not
   expanded. A future pass has to open them.
5. **The three `never used` warnings are still not this leg's:**
   `should_oscillate_flat_reveal`, `NativeInsertionState::configure`,
   `ModeHotkeys::for_mode`. Unchanged since Leg 9's finding 5, still the
   core-hardening track's.
6. **A stale `port:diff` browser was holding 9333** from a run at 05:03 that
   never finished — ten hours old, `--user-data-dir=/tmp/wordscript-port-diff`.
   The script binds that port itself, so a new run would have attached to a
   ten-hour-old browser instead of failing. Killed by PID. Check `ss -ltn`
   before a run.

**Checks at the close.** 473 frontend tests across 39 files (unchanged — two
assertions rewritten, none added or removed), `cargo test` **740 unchanged**,
`cargo check` **15 warnings unchanged**, `npm run build` green, `port:diff`
**24 of 25 at structural 0 | style 0** with `models` at 6 | 6 and 33 in the soft
text column. Both screens this leg touched had already left the gallery, so no
measurement moved. Load ran 1.6–2.4 and the suite did not flake. Every fix was
measured in the native host before and after, and the one that looked right on
the first attempt was rejected by the second measurement.


### Leg 12 — the rows nobody had measured, and the button that had never worked

**BOTH ENTRIES ARE DONE.** Two ADRs (0103, 0104). One commit.

**THE THING TO TAKE FROM THIS LEG: THE SWEEP HAD ONLY EVER BEEN RUN IN THE
DIRECTION WHOSE ANSWERS ARE HARMLESS.** ADR 0089 asks which registered command
has no `invoke(`; ADR 0093 sharpened it; every answer either way is dead weight
to be triaged. Run the other way — **every `invoke("name")` against the
registered list** — it produced one name, and that one is a live defect.
`load_transcription_history` is invoked by `OverlayWindow.tsx` and **was never
registered anywhere**. `git log --all -S` finds it in exactly one commit, the
one that introduced the caller. The overlay's *Retry from the recording* has
rejected on every press since **2026-08-03** — offered by `1fda91d`, the commit
whose whole subject was that a 679-second dictation was lost and the audio must
survive the failure so it can be retried. `useTranscriptionHistory` has always
used the right name (`transcription_history_entries`), with the identical
payload shape, which is why the same retry works from the History list.

**NO CHECK IN THIS REPOSITORY COULD SEE IT.** `cargo check` is happy — the Rust
side is complete. `npm run build` is happy — the string is a string. And the
test suite asserted the retry button **appears** when the runtime kept the audio
and never pressed it, so the invoke mock's `default` arm — which throws on an
unknown command — was never reached. **A control asserted only to exist is not
tested.** The new case clicks it, and it was verified to FAIL against the old
name before it was kept.

**THE FIRST PASS OF THE SWEEP REPORTED FIVE FALSE ORPHANS AND I ALMOST BELIEVED
IT.** `export_full_backup`, `import_full_backup`, `export_text_rules`,
`import_text_rules`, `reset_all_settings` — all five alive, all five called from
`Privacy.tsx` with the command name on the line **after** `invoke(`. A
line-based grep cannot see a call it does not fit on one line. Trusting it would
have triaged both halves of the backup path as dead weight inside the leg
running the sweep. The check reads whole files now (ADR 0103).

**THE THREE UNREACHED ROW CLASSES ARE MEASURED AND TWO OF THEM ARE CLEAN.**
The instrument was rebuilt in ten minutes from ADR 0092's description, walked
**25 surface states in 37 seconds** and reported 286 runs. Diagnostics' Preview
and Logs draw every run at **one line** at 429–467 px — nothing to fix. Every
`Models` job opened (`details.open = true`, since a closed `<details>` measures
zero) and its three-line rows are all the prototype's. **The one defect is in
Profiles' editor panel**, which is the surface the port designed rather than
carried: `.ws-edit-note` had `min-width: 0` beside 110 px of Cancel and Save,
which left it **68 px for a 59-character sentence — six lines**, under a CSS
comment claiming *"the panel's height does not change when a rule has something
to say."* A comment asserting a control, one layer below where ADR 0090 named
it. With a `26ch` floor and a wrapping foot it measures **two lines at 194 px**.

**AND MY OWN FIX MADE A CLAIM I HAD TO GO BACK AND MEASURE.** The comment I
wrote said `margin-right: auto` still holds the buttons to the trailing edge
once the foot wraps. It does not — an auto margin only holds a line it shares.
The instrument reported the foot's geometry: note `537..731`, buttons
`613..731`, foot ends at `731`. That is `justify-content: flex-end` doing it,
not the auto margin, and the comment says so now.

**THE PROTOTYPE PRINTS A CONTROL'S OWN TEXT IN THE HINT BESIDE IT, ON PURPOSE.**
Profiles → Defaults `Ceiling` reads `hint: "13:39 — the 25 MiB upload size on
your plan. Past it, nothing transcribes."` beside `ctl: badge("13:39")`. I had
it queued as this leg's instance of ADR 0092's defect class and the drawing
stopped it. **The class is narrower than its sentence**: the control must be
width-auto AND runtime-filled, so that the string and the width have one cause.
A badge quoting five characters spends nothing twice. `Auto-stop`'s six-line
hint is the drawing's copy verbatim too. Reading `demo.js` for the screen cost
two minutes and saved rewriting a card of the donor's copy (ADR 0104).

**THE WINDOW IS THE FRAME AROUND EVERY NUMBER AND NOBODY HAD RECORDED IT.**
The workspace reports **800 × 608 CSS px at dpr 1.25**. `xdotool` reports the
same window as **1000 × 760**, which is exactly what `tauri.conf.json` declares
— nobody had resized anything, and `Xft.dpi: 120` is the 1.25. So the config's
pixels and the stylesheet's are different units with the display scale between
them, and `"minWidth": 880` describes a viewport of 704 px that the layout never
sees. The floor moved from ADR 0092's 12 characters to **10** between two passes
at the same window. Recorded, not acted on: geometry is ADR 0100's, and that is
the core-hardening track's (ADR 0104).

**Findings for Leg 13.**

1. **THE INDEX ENTRIES AND THIS RECORD ARE NOT IN MY COMMIT.** By the end of
   this leg the other track had uncommitted work in `docs/decisions/README.md`,
   `DESIGN_SYSTEM.md`, `STATUS.md`, `CHANGELOG.md`, `REFERENCE.md`,
   `ARCHITECTURE.md`, `ROADMAP.md`, `spec/SPEC.md`, `AGENTS.md`, `README.md`
   **and this relay** — ~250 lines of it. Staging any of those paths commits
   their prose under my message, so I committed only what is exclusively mine:
   `src/`, ADR 0103 and ADR 0104. **My ADR index entries, this record, the map
   row and the DESIGN_SYSTEM additions are sitting in the working tree**, and
   whichever track commits those files next carries them. Check `git status`
   before assuming anything in `docs/` is on `main`.
2. **`npm run port:diff` CANNOT DO ALL 25 IN ONE INVOCATION.** It crashed at
   screen 8 (`translate`, `TypeError: Illegal invocation`) on the first attempt
   and at screen 23 (`onboarding#4`, `getBoundingClientRect` of null) on the
   second, with different exceptions — and **every screen that crashed is exact
   when run alone**. A crashed run also leaves its browser holding 9333, which
   is where Leg 11's finding 6 came from: the stale browser is the *symptom*.
   Run it in two or three batches and kill the leftover by PID between them.
   The full picture still checks out: **24 of 25 at structural 0 | style 0,
   `models` at 6 | 6, 33 in the soft text column.**
3. **PROFILES → STYLE IS THE ONE CARD WHERE THE PORT WROTE THE COPY AND THE
   WIDTH IS SMALLEST.** `Writes to`, `Length`, `Your rules`, `Writing sample`
   and the `Communication style` card description appear **nowhere in
   `demo.js`** — only the string "Communication style" does, as a row label on
   Onboarding. They draw **7, 5, 7 and 3 lines at 86, 114, 226 and 226 px**.
   `Writes to`'s hint is `REGISTER_DESCRIPTIONS[register]`, so it changes with
   its own Select's value and gets whatever that Select's longest option leaves.
   Deliberately not touched: rewriting five rows to fit 86 px would be carrying
   a number that ADR 0104 says is about to move.
4. **THE INSTRUMENT NEEDS A GUARD AND MINE DID NOT HAVE ONE AT FIRST.** Fast
   Refresh re-runs the hook on every edit, so a second walk starts while the
   first is still navigating and the two drive and measure each other — three
   payloads were silently interleaved before I noticed a surface labelled
   `hotkeys` full of `models` rows. Guard on `window.__…` with a timestamp
   (a boolean latches forever when a module swap kills a walk mid-way), and
   record the DOM-observed surface beside the loop variable.
5. **The three `never used` warnings are still not this leg's:**
   `should_oscillate_flat_reveal`, `NativeInsertionState::configure`,
   `ModeHotkeys::for_mode`. Unchanged since Leg 9's finding 5.
6. **ADR numbers rotted again, twice in one session.** The brief said 0101 was
   free; by the time I filed, the core-hardening track had taken 0101 and 0102
   while I was running checks. Mine are **0103 and 0104**. Grep the tree.

**Checks at the close.** **474 frontend tests across 39 files** (473 + the one
that presses the retry button), `cargo test` **740 unchanged**, `cargo check`
**15 warnings unchanged**, `npm run build` green, `port:diff` **24 of 25 at
structural 0 | style 0** with `models` at 6 | 6 and 33 in the text column — in
three batches, for the reason in finding 2. Load ran 1.8–2.5 and the suite did
not flake. The editor-panel fix was measured before and after in the native
host, and the comment I wrote about it was measured too and was wrong.


### Leg 13a — the sweep over the other channel, and three false findings from the tool built to prevent them

**ITEM 1 IS DONE AND STRUCK. ITEM 2 IS UNTOUCHED AND IS NOW LEG 13B.** One ADR
(0153). The leg split because item 1 grew a second channel and item 2 is a
design plane, not a scan.

**THE `invoke` SEAM IS CLEAN AND THE NUMBER IS CHECKABLE.** 72 commands
registered in `generate_handler!`, 72 defined by `#[tauri::command]`, the two
lists **identical** — so there is no command written and never registered, which
no ADR had asked before. 67 called from non-test `src/`. **Zero callers with no
command.** Five commands with no caller, and they are the same five ADR 0089 and
ADR 0093 already recorded: `preview_prompt_enhance`, `transcribe_audio_file`,
`read_diag_log`, `clear_diag_log`, `overlay_open_devtools`. Nothing new became
dead weight and nothing dead came back.

**SO I RAN THE CHANNEL NOBODY HAD SWEPT.** ADR 0089, 0093 and 0103 are all about
`invoke` — the frontend calling the runtime. An event is the runtime calling the
frontend, the same seam turned around, and its asymmetry is identical: an emitter
with no listener compiles, runs, delivers to nobody and warns nowhere.
**`wordscript-native-insert` is emitted from three sites in `core/insertion.rs`
and nothing in `src/` listens** — not the overlay, not the workspace, not even a
test mock. `docs/spec/SPEC.md:297` carries it as contract: *"carries
`NativeInsertResult`, including insertion and recovery truth."*

**IT IS DEAD WEIGHT AND NOT A GAP, AND I HAD TO MEASURE THAT RATHER THAN ASSUME
IT.** Each of the three emitters sits beside a path that already delivers the
same `NativeInsertResult`: `insert_text_native` and `restore_last_transcript`
return it to their `invoke` caller, and `insert_transcription_from_legacy` — the
runtime-driven one, called from `lib.rs:1965`, `sessions.rs:664` and
`history.rs:762`, with no frontend caller to return to — reaches the frontend
folded into `wordscript-event` as the `insertion` field (`src/types/ipc.ts:144`).
No surface is missing truth it needs. What exists is a second, unordered channel
carrying session truth the authoritative one already carries, which is what ADR
0018/0019 argues against. **Recorded, not deleted** (ADR 0093's rule), and the
disposition is the runtime ownership track's because the insert is.

**MY OWN INSTRUMENT PRODUCED THIS CLUSTER'S FAILURE CLASS THREE TIMES WHILE I
WAS BUILDING IT, AND THAT IS THE PART TO TAKE FROM THIS LEG.**

1. The first draft abandoned any `invoke<…>` whose generic contained `{` or `;`,
   reading them as proof the `<` was a comparison. It reported **all five of
   `Privacy.tsx`'s backup commands as orphans — the exact five ADR 0103 recorded
   as false**, one leg after that ADR was written. Worse than the noise: the same
   blindness would have **passed** a direction-1 defect written in that shape.
2. The event half used a non-greedy `<[\s\S]*?>` to skip the generic. It matched
   `listen<BackendEvent>(RUNTIME_EVENT_CHANNEL, …)` against an `invoke` string
   two hundred lines further down and reported `load_app_config` and
   `save_config` — two **commands** — as events nothing emits. A non-greedy class
   will cross the end of the call it is standing in.
3. Stripping comments dropped the newlines inside block comments, so every line
   number drifted by the height of whatever docblock stood above the call. The
   regression run reported `OverlayWindow.tsx:1345` for a call on **1380**.

Three passes, three false findings, from the tool whose whole purpose is to stop
false findings. Everything the sweep now reports was verified by hand against the
tree before it was believed.

**AND THE PRODUCT'S MAIN EVENT CHANNEL READ AS REACHING NOBODY UNTIL THE SWEEP
LEARNED TO READ A CONSTANT.** The overlay subscribes with
`listen<BackendEvent>(RUNTIME_EVENT_CHANNEL, …)`, so the literal
`"wordscript-event"` never appears at the call site. A name-grep finds it only in
a **comment** on `src/types/ipc.ts:1`. The sweep resolves frontend string
constants now; `tauri://` is the framework's namespace and is skipped, because
`tauri://theme-changed` has no emitter here and never will.

**EVERY DIRECTION HAS BEEN OBSERVED TO REPORT A TRUE DEFECT, WHICH IS THE ONLY
REASON `0 defects` MEANS ANYTHING.** Direction 1 was pointed at
`git archive 4445423^ src` — the tree that still had Leg 12's defect — and named
`load_transcription_history` at `OverlayWindow.tsx:1380`. Direction 4 was made to
fire by deleting one `listen(` from a copy of `src/`. `--frontend <dir>` exists
for exactly that and the file says so. This is ADR 0103's lesson about the retry
button, applied to the instrument instead of to a control.

**Findings for Leg 13b.**

1. **THE SWEEP HAS NO npm SCRIPT AND THAT IS DELIBERATE FOR ONE MORE SESSION.**
   It runs as `node scripts/command-sweep.mjs`. Adding `sweep:commands` to
   `package.json` is a one-line change and I did not make it: a `tauri dev` host
   was running (PID 3307285) and Vite can restart on a `package.json` write, and
   the runtime-ownership track's step 6 is waiting on a natural capture event
   that a restart would cost. **Land it as your first edit if no host is
   running**, next to `port:diff`.
2. **THE TEST COUNT MOVED AND NONE OF IT IS MINE.** Leg 12 closed at 474 across
   39 files; the suite is now **541 across 42**. I added no test and touched no
   file under `src/`, so +67 across +3 files is the runtime-ownership and
   context-objects work of 2026-08-14. Take 541/42 as your baseline, not 474/39.
3. **`b330815` STILL HAS NO LEG BEHIND IT, AND NOW IT HAS COMPANY.** The
   sidebar's second width (ADR 0111) and the 2026-08-14 `Context.tsx` wiring —
   four `Open decision` badges removed, three drawn states connected, three cases
   added to `screens.test.tsx` — are both GUI-port work that no leg claimed.
   `docs/tracks/context-objects.md` records the second so it is not rediscovered
   as that track's. **Adopt both into your record or file them as their own leg.**
   Do not leave either unattributed a third time.
4. **THE RUST BASELINE IS MEASURED AGAIN AND IT MOVED A LOT.** `cargo test` is
   **807 passed / 5 ignored**, not Leg 12's 740, and `cargo check` is **15
   warnings** — the same count, but re-measured rather than carried. The three
   `never used` are unchanged and still nobody's:
   `should_oscillate_flat_reveal`, `NativeInsertionState::configure`,
   `ModeHotkeys::for_mode`. `port:diff` did not run and could not have moved:
   nothing in this leg touched `src/` or a style.
5. **THE ADR NUMBER WENT STALE AGAIN — FOURTH LEG RUNNING.** The brief said 0105
   was free; the tree said 0152 was the highest and I took **0153**. The runtime
   ownership track's board line claims *"0153 onward as they come"*, which is a
   direction of travel rather than a reservation, so it takes 0154. Grep the
   tree, including source and commit messages.

**Addendum, 2026-08-15 — the two things this record deferred were both cleared
the same session, by the owner, on one sentence.** *"Kein Ding, alles kann neu
starten."* That removed the only reason findings 1 and 5 existed:

- **`sweep:commands` is wired.** `npm run sweep:commands` runs beside
  `npm run port:diff`. Finding 1 is spent.
- **`wordscript-native-insert` is gone (ADR 0154).** The emitter, its three call
  sites, the `Emitter` import and the timing pair that only measured the emit are
  out of `core/insertion.rs`; `spec/SPEC.md` keeps a sentence naming what
  replaced it. **`restore_last_transcript` lost its `AppHandle` parameter** — the
  emit was its only reader, and leaving it would have been the sixteenth warning.
  All four defect directions now report zero.
- **The app restarted during this, which is what the sentence authorised**, and
  the log shows it: trigger re-registration at `+0.000` and the audio output
  reopening. **No capture ran** — the only line matching the capture pattern is
  `binding=capture shortcut=Shift`, a shortcut registration — so runtime
  ownership's step 6 lost nothing.
- **One line in that window is machine load and should not be read as a
  finding:** `Audio output stream error: Buffer underrun/overrun occurred.`
  landed while `cargo test` was running on 20 cores. It is the cue output stream
  (ADR 0150's, which is why the line names its stream now), not capture, and it
  is exactly the artefact `CLAUDE.md`'s no-heavy-builds rule predicts.

**Checks at the close.** `npm test` **541 passed across 42 files**, `npm run
build` green in 1.90 s. **The suite did not move by my hand and I did not re-run
it to prove that** — vitest collects only from `src/` and this leg added one file
under `scripts/`. No `cargo` command was run because no Rust changed. **The
runtime log stood at 33724 lines before the checks and 33724 after**, so no
capture ran during them and no measurement was contaminated — which is the check
`CLAUDE.md`'s no-heavy-builds rule actually asks for, rather than a promise not
to build.

## The prompt for Leg 13b

You are picking up WordScript after Leg 13a. Work in the repo root on `main`. Do
not create a branch. **Four other tracks work in the same tree** — see
[`../IMPLEMENTATION.md`](../IMPLEMENTATION.md) — so run `git status` and
`git log --oneline -5` before you start, and stage your own paths. Never
`git add -A`.

**Leg 13 split.** 13a was the caller sweep and it is struck. You are item 2 and
only item 2: **the row classes no instrument has reached — the panel plane,
where the port designs rather than carries.**

### What is already true

**The seam is swept and clean, so it is not your job.** `npm run sweep:commands`
reports both channels: caller with no command, command with no caller,
unresolvable call sites, listener with no emitter, emitter with no listener.
Today it is `direction 1: 0 | direction 2: 5 | events 0 | 0` — **all four defect
directions at zero**, and the five are the orphans ADR 0089 and ADR 0093 triaged.
`wordscript-native-insert` was the fifth column's one entry and was removed on
2026-08-15 (ADR 0154). **Re-run the sweep if you add an `invoke` or a `listen`;
do not rebuild it.**

**A `tauri dev` host was running throughout 13a and may still be.** Writing
anything under `src-tauri/` rebuilds and restarts the whole app — the process
dies, the hotkeys go with it, and a dictation in flight is interrupted. The
runtime ownership track's step 6 is waiting on a natural `Short` capture at about
1.5 % of captures, and a restart costs whatever was accruing. Say whether a host
is running before you touch native, and batch the edits.

**The suite is 541 across 42 files**, not Leg 12's 474 across 39. The difference
is other tracks' 2026-08-14 work, not a regression. **`cargo test` is 807 passed
/ 5 ignored and `cargo check` 15 warnings**, both re-measured on 2026-08-15.

**Every copy budget is a budget at a CSS viewport** (ADR 0104). The workspace
lays out at **800 CSS px** while `tauri.conf.json` declares 1000 and a minimum of
880, because the display scale is 1.25 — the config's pixels and the
stylesheet's are different units. The floor moved from 12 characters to 10
between two passes at the same window.

### Read this first

`docs/tracks/gui-port-relay.md` — Leg 13a's record above is your starting state,
and its findings 1 through 3 are the ones that will cost you. Then ADR 0092, ADR
0104, ADR 0103, `CLAUDE.md` and `docs/spec/SPEC.md`.

### The order

1. **Whatever the row instrument reaches that Leg 12's did not.** It walked
   views, sections, sub-tabs, `<details>` jobs and the two Add panels. It did
   **not** open a row menu, a `ConfirmPanel`, a `FlagPanel`, an `AnswerPanel`,
   the export answer, or any error state — `.ws-edit-question`,
   `.ws-edit-issues p` and `.ws-flag-what p` returned zero samples because
   nothing on the walk rendered them. Those are the next unmeasured classes.
2. **Settle the two commits with no leg behind them.** `b330815` — the sidebar's
   second width, ADR 0111 — and the 2026-08-14 `Context.tsx` wiring recorded in
   `docs/tracks/context-objects.md`. Adopt both into your record or file them as
   their own leg. This is the third leg they have been asked about.

### The rules you will be judged on

**READ THE DRAWING FOR THE SCREEN BEFORE YOU CALL ANYTHING A DEFECT.** Leg 12
had `Ceiling` queued as a port defect — a hint whose first token is the badge
beside it — and `demo.js` draws exactly that, on purpose. ADR 0092's class needs
the control to be **width-auto AND runtime-filled**; a badge quoting five
characters is not it.

**A CONTROL ASSERTED ONLY TO EXIST IS NOT TESTED.** The overlay's retry test
passed for eight legs while the retry did nothing, because it never pressed the
button. Where a control's whole purpose is the call it makes, press it — and
check the new test FAILS before you keep it.

**AN INSTRUMENT ASSERTED ONLY TO RUN IS NOT TESTED EITHER**, which is 13a's
version of the same sentence. It reproduced this cluster's failure class three
times before it was trusted, twice reporting findings that were pure artefact.
Make yours report something you already know is there before you believe a zero
out of it.

**MEASURE THE BUDGET, DO NOT CARRY IT**, and quote the viewport with it:
`window.innerWidth` and `devicePixelRatio`, not the number in `tauri.conf.json`.

**A COMMENT ASSERTING A CONTROL IS INDISTINGUISHABLE FROM THE CONTROL** (ADR
0090). Leg 12 found one in `shell.css` claiming a foot never wraps, then wrote a
replacement that was also wrong until it measured it.

**STRIKE THE ITEM WHEN YOU DO IT.** Leg 13a struck item 1 of two.

### What you must NOT do

- **Do not rewrite the prototype's copy.** ADR 0092 lists the rows drawing three
  lines and they are the drawing's.
- **Do not rewrite Profiles → Style either**, though it IS port-authored (Leg 12
  finding 3). Its rows draw 7, 5 and 7 lines at 86–226 px, and that is the width
  question ADR 0104 hands to whoever settles ADR 0100.
- **Do not touch the window geometry.** ADR 0100 is the core-hardening track's
  and is explicitly a planning direction.
- **Do not widen the Context opening** beyond the drawn gesture lifted on
  2026-08-11 — ask.
- **Do not mount any of the six undecided surfaces** (ADRs 0060–0064 plus the
  roadmap candidate). `ia.test.tsx`'s last case asserts none is mounted.
- **Do not dispose of `wordscript-native-insert`.** ADR 0153 records it; the
  insert belongs to the runtime ownership track.
- **Do not edit an existing ADR.** Append-only. **0153 is taken by this track**
  and the runtime ownership board claims 0153 onward, so it takes 0154 — the
  number on this page has gone stale four legs running. Grep the whole tree,
  source and commit messages included.
- **Do not rename the `settings` window label** without being asked.
- **Do not migrate a config without a backup path.** `core::backup` is the
  pattern.
- **The overlay is still rule 5.**
- **Leave a temporary instrument out of the commit** and grep for it. Leg 12's
  was `src/dev/rowAudit.ts` with one hook in `WorkspaceWindow.tsx`, and it needs
  a timestamped run guard or Fast Refresh interleaves two walks.

### How to check yourself

- `npm test`, `npm run build`, and `cd src-tauri && cargo test` **only if you
  touched Rust**. **Watch the TOTAL, not the colour.** The baseline is **541
  frontend across 42 files**. Under load the suite flakes by about 5;
  `npx vitest run --no-file-parallelism` is the tiebreaker and `uptime` says
  whether to reach for it.
- **A capture measurement is running in ordinary use, so prove you did not
  disturb it rather than promising not to.** `wc -l
  ~/.config/WordScript/logs/wordscript-runtime.log` before and after your checks;
  if it moved, read what landed before trusting any number out of it. 13a's
  checks moved it by zero lines.
- **`npm run port:diff` TAKES GALLERY IDS OR IT MEASURES NOTHING**, and a name
  that is not one is dropped in silence. The 25 are the **16 ids in
  `src/windows/gallery/registry.tsx` except `ds`** plus `models#1 agents#1
  agents#2 onboarding#1`–`#6`. **Run it in two or three batches** — it crashed at
  screen 8 and at screen 23 of a single 25-id invocation, and every screen that
  crashed is exact alone. **Check `ss -ltn | grep 9333` before each batch** and
  kill a leftover by PID: a crashed run is what creates the stale browser.
- **The native host is the only instrument for a drawn state.** Rebuild the row
  instrument from ADR 0092 and Leg 12's record: walk `VIEWS` and `SECTIONS`,
  click every `button[role=tab]`, set `details.ws-job { open = true }` (a closed
  `<details>` measures zero), read each run's height against its computed
  line-height, and POST to a loopback collector — `csp` is `null`, so `fetch`
  needs no permission. Report the window size in the payload.
- **Check whether a host and a dev server are ALREADY running before starting
  one.** `tauri dev` starts its own Vite. `ps -o lstart=` shows whose is whose,
  `xprop -id <win> _NET_WM_PID` maps a window to its process, and
  `xdotool getwindowgeometry` is good enough for a width (`xwininfo` is not
  installed).
- **Do not raise the window past somebody working at the machine — ask.**
- **Never `pkill`.** Kill by PID, and stop what you started.

### When it is done

Commit, push to `main`, append your record to the leg log, and write the Leg 14
prompt. Then report what you did, what you found, and anything the next leg needs
that is not already written down.
