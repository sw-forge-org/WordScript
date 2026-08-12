# GUI port relay — the spent leg kick-offs

Each leg of the GUI port relay was started by pasting a kick-off page to a
fresh agent session. The page was orientation; the leg's actual brief was
always the matching `## The prompt for Leg N` section in the relay.

These eight are spent. They are kept because each one carries the instrument
notes and the standing warnings its leg accumulated, and several of those
rules were never written down anywhere else. The kick-off for the **open**
leg lives at [`../tracks/gui-port-relay-kickoff.md`](../tracks/gui-port-relay-kickoff.md).

Legs 1 through 4c and Leg 9 were started without a kick-off page of their own.


---

## Leg 4d

Paste this to the next agent. Everything it needs beyond this page is in the
relay.

---

You are picking up the WordScript GUI port. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. **Leg 4d is yours.**

**Read `docs/tracks/gui-port-relay.md` first.** The Leg 4d prompt is
the section titled *"The prompt for Leg 4d"* and it is your actual brief — this
page is only the orientation. Above it, Leg 4c's record is your starting state
and carries eight findings you will otherwise rediscover; §2.5 is the list of
what the runtime cannot answer, and you add to it rather than starting a second
one. Then `CLAUDE.md`, then `src/screens/props.ts`, which is the seam in about
110 lines.

**Leg 4d is not a wiring leg.** Every wireable screen was wired in Leg 4c. Four
rows still carry a banner and all four are unwireable by nature — Context (V2),
Notes & Meetings (V2), Agents and Integrations (Phase 8). Deleting one of those
banners is the error, not the goal.

Four items, in this order:

0. **The communication style.** ADR 0023's register, length, style rules and
   writing sample are running in the runtime and have no surface anywhere — the
   prototype points at the profile three times and never draws it. One profile
   on this machine carries a non-default register nobody can see or change.
   **Where it goes is decided: ADR 0068** — a sixth profile tab `Style` in
   second position, one card `Communication style`, and a fifth Legend row on
   Defaults stating its scope. Draw it in the gallery first, wire it second.
1. **The search bar and the command palette.** `NavSearch` is ported 1:1 and
   mounted nowhere; the palette is `demo.js:8031–8366` and is the only prototype
   surface the port never carried. It is a port, not a design. The owner has
   raised the missing search bar once already.
2. **The Help modal** (ADR 0066), three links, two of which do not exist yet.
3. **Two derivations to decide rather than guess** — the profile list's subline
   and its neighbours. Item 0 and the subline are one job.

**Three rules you will be judged on.** Never render fake readiness (rule 7). A
control that cannot act is disabled with its reason, not deleted and not left
looking settable (ADR 0065/0067) — **and check that the design system draws the
state you set**, because Leg 4c found six controls that took `disabled` and
looked entirely operable while every unit test passed. The gallery shrinks by
wiring and by nothing else; it is a test, so do not argue with it.

**Do not touch `src-tauri/` (rule 6), the overlay (rule 5), or Context in any
direction** — the owner said on 2026-08-10 that Context is going to be done
differently and deliberately did not say how.

**Checks:** `npm test`, `npm run build`, `cd src-tauri && cargo test`, and
`npm run port:diff` after anything that could move a screen — the exact 28-screen
command is in the relay's Leg 4d prompt. Run the suite twice before believing a
failure. A wired screen cannot be looked at in a browser; the native-host recipe
and its timer trick are in the same section. Do not `pkill -f vite`, it kills
the agent's own shell.

**One thing about the briefs themselves.** The owner dictates them into
WordScript and its transcription is currently inaccurate — see
`docs/known-issues/transcription-accuracy.md`, opened 2026-08-10. A sentence in
a brief that matches nothing in the repository, the plan or the drawing is a
candidate mishearing and is worth one direct question rather than an hour of
searching. That has cost a round trip at least once.

**When it is done:** commit, push to `main`, append your record to the leg log,
and write the next prompt. If all four items are done, write the **Leg 5** prompt
instead — the runtime contracts, prioritised by what §2.5 says is blocking. Its
cheapest entry is already visible from two screens: a seventh `ProcessingMode`
variant and one config field, which Hotkeys and Profiles both draw a disabled
control for today.

---

## Leg 5

Paste this to the next agent. Everything it needs beyond this page is in the
relay.

---

You are picking up WordScript after the GUI port. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. **Leg 5 is yours, and it is the first leg
allowed into `src-tauri/`.**

**Read `docs/tracks/gui-port-relay.md` first.** The Leg 5 prompt is
the section titled *"The prompt for Leg 5"* and it is your actual brief — this
page is only the orientation. Above it, Leg 4d's record is your starting state
and Leg 4c's below it carries the disabled-state rule you will be held to.
**§2.5 — the entries under Leg 2c's, 2d's, 4a's, 4b's, 4c's and 4d's headings —
is your backlog**, and it was written down as it was found rather than guessed
at the end. Then `CLAUDE.md`, `docs/spec/SPEC.md`, and `src/screens/props.ts`.

**Leg 5 is not a drawing leg.** Every screen the prototype drew stands, every
wireable one is wired, and the two surfaces the port never carried — the command
palette and Help — landed in Leg 4d. What is left is the runtime side of
promises the surface is already making honestly.

Rule 6 held for seven legs so that this leg would find a product that states
exactly what it cannot answer. It does. Every inert control names its reason on
itself, and your job is to delete those reasons by making them false.

The order, cheapest first, and the first three are days rather than weeks:

1. **The seventh `ProcessingMode`.** ADR 0041 gave Translate a slot and the enum
   has six values, so Hotkeys and Profiles each draw a disabled control for it
   today. One variant and one config field.
2. **`CommunicationStyleAnalysis` over IPC.** The runtime computes it and no
   command returns it. It closes the Style tab's budget meters — which currently
   mirror two constants and over-count — and it gives `Check against a sample`
   and `Show the effective bias` an answer to put somewhere. That second half is
   a DRAWING job first (ADR 0057).
3. **A colour-scheme config field.** The palette ships three theme rows that
   change one window and persist nothing.
4. A reveal command, the Markdown-file promise, Home's decision inbox, the three
   data commands, and the five missing editors. The relay orders them and says
   which are contracts and which are surfaces.

Three rules you are measured on. **Never render fake readiness (rule 7)** — and
now it cuts backwards too: when a control gets its command, delete the reason it
was carrying. **A control that cannot act is disabled with its reason, and the
design system has to DRAW that state** (ADR 0065/0067) — check in the native
host, not in jsdom. **A banner comes off in the commit that makes it false, and
its gallery entry goes with it** (ADR 0057, held by `registry.test.tsx`).

Not to be touched: **Context**, in any direction — the owner said on 2026-08-10
it is going to be done differently and deliberately did not say how. The
**overlay** (rule 5). The **six undecided surfaces** (ADRs 0060–0064 plus one
roadmap candidate). And no config migration without a backup path: this machine
carries six real profiles, 174 transcriptions and a communication style that was
invisible until yesterday.

Checks: `npm test`, `npm run build`, `cd src-tauri && cargo test`, and
`npm run port:diff` after anything that could move a screen — the 28-screen
command is in the relay, and the expected result is 26 zeros plus two RECORDED
departures (`profiles`, ADR 0068; `history`, ADR 0070). Run the suite twice
before believing a failure.

**Before you spend 3m 43s on `npm run tauri build`, check whether a
`npm run tauri dev` host is already running on this machine.** One usually is,
it hot-reloads the working tree in about a second, and it may be the owner's own
session — do not kill it. Fast Refresh preserves component state, so drive a
surface with a temporary mount effect rather than a changed `useState` default,
and take the temporary code out before the commit. Synthetic clicks do not reach
the WebKitGTK window; synthetic scroll does. No `pkill -f vite` — it matches the
agent shell's own command line.

The owner dictates these briefings in WordScript, whose transcription is
currently inaccurate — see `docs/known-issues/transcription-accuracy.md`. A
sentence matching WordScript's own initial prompt is WordScript's own and can be
deleted on sight; anything else that matches nothing in the repo, the plan or
the drawing is worth one direct question rather than an hour of searching.

When it is done: commit, push to `main`, append your record to the leg log, and
write the Leg 6 prompt.

---

## Leg 6

Paste this to the next agent. Everything it needs beyond this page is in the
relay.

---

You are picking up WordScript after Leg 5. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. **`src-tauri/` is open** — Leg 5 opened it
and the rule that kept it shut is spent.

**Read `docs/tracks/gui-port-relay.md` first.** The Leg 6 prompt is
the section titled *"The prompt for Leg 6"* and it is your actual brief — this
page is only the orientation. Above it, Leg 5's record is your starting state,
and it owes you one thing by name: the native-host check it did not get. Leg 4c's
record carries the disabled-state rule you are still held to. §2.5 is your
backlog. Then `CLAUDE.md`, `docs/spec/SPEC.md`, and `src/screens/props.ts`.

**Leg 5 closed the three cheapest runtime contracts.** `ProcessingMode` has seven
values and Translate is selectable, settable and states its target language on
the overlay; `analyze_communication_style` answers what the two style fields
cost; `AppConfig.color_scheme` persists the theme. Four inert controls got their
command and lost the reason they were carrying. Four ADRs — 0071, 0072, 0073 —
plus 0069 and 0070 finally indexed.

The order, and the first one is a debt rather than a feature:

1. **Look at Leg 5's four surfaces in the native host** before building on them:
   `Profiles → Defaults` under Translate, the Style tab's budget meter, the two
   disabled Translate rows on AI Models, and the pill's language chip. Leg 4c
   found five missing CSS rules exactly this way and every one had a passing
   test.
2. **A reveal command**, and it is coupled to the next one: there is nothing per
   transcript to reveal.
3. **The Markdown-file promise** — kept or retired, in an ADR, before writing
   either.
4. **Route the history retry by mode.** A retried Agent, Prompt Enhance or
   Translate record comes back as a conservative cleanup. One job for all three.
5. Home's decision inbox, the export/import/reset trio, §15.3's native half, and
   the five missing editors. The relay orders them.

Three rules you are measured on. **Never render fake readiness (rule 7)**, in
both directions — when a control gets its command, delete the reason it carried.
**A control that cannot act is disabled with its reason and the design system
has to DRAW that state** (ADR 0065/0067) — with one recorded exception now: a
setting that is IRRELEVANT under the current state is hidden rather than
disabled, and ADR 0072 draws that line. **A banner comes off in the commit that
makes it false, and its gallery entry goes with it** (ADR 0057).

And one Leg 5 paid for: **check whether a later ADR has already answered the
question the drawing is answering.** Leg 5's one real defect was following the
prototype past ADR 0068, which had settled the same placement question two days
before the code was written.

Not to be touched: **Context**, in any direction — the owner said on 2026-08-10
it is going to be done differently and deliberately did not say how. The **six
undecided surfaces** (ADRs 0060–0064 plus one roadmap candidate), and note that
the translation **view** is one of them and is not the Translate **mode** — the
prototype separates them at `demo.js:6911` under a heading that says so. The
**overlay** stays rule 5 apart from what Leg 5 recorded. And no config migration
without a backup path: this machine carries six real profiles, 174
transcriptions, a communication style, a colour scheme and four translate
settings.

Checks: `npm test`, `npm run build`, `cd src-tauri && cargo test`, and
`npm run port:diff` after anything that could move a screen — the 28-screen
command is in the relay and the expected result is 26 zeros plus two RECORDED
departures (`profiles`, ADR 0068; `history`, ADR 0070). **Watch the test TOTAL,
not the colour**: Leg 5 silently overwrote a 17-test file with a 4-test one and
the suite stayed green, and the falling count was the only signal. Run the suite
twice before believing a failure.

Before you spend 3m 43s on `npm run tauri build`, check whether a
`npm run tauri dev` host is already running. One usually is, it hot-reloads the
working tree in about a second, and it may be the owner's own session — do not
kill it, and do not raise its window past somebody working at the machine. Ask
instead. Fast Refresh preserves component state, so drive a surface with a
temporary mount effect rather than a changed `useState` default, and take the
temporary code out before the commit. Synthetic clicks do not reach the
WebKitGTK window; synthetic scroll does. No `pkill -f vite` — it matches the
agent shell's own command line.

Two instrument notes Leg 5 paid for. **`import -window` is dead on this
machine** and fails for every argument including `-window root`;
`spectacle -f -b -n -S -e -o <file>` works. The desktop is **two monitors at a
1.6 device-pixel scale**, so a crop to an `xdotool` geometry must be multiplied
by 1.6 first.

The owner dictates these briefings in WordScript, whose transcription is
currently inaccurate — see `docs/known-issues/transcription-accuracy.md`. A
sentence matching WordScript's own initial prompt is WordScript's own and can be
deleted on sight; anything else that matches nothing in the repo, the plan or
the drawing is worth one direct question rather than an hour of searching.

When it is done: commit, push to `main`, append your record to the leg log, and
write the Leg 7 prompt.

---

## Leg 7

Paste this to the next agent. Everything it needs beyond this page is in the
relay.

---

You are picking up WordScript after Leg 6. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. `src-tauri/` is open.

**Read `docs/tracks/gui-port-relay.md` first.** The Leg 7 prompt is
the section titled *"The prompt for Leg 7"* and it is your actual brief — this
page is only the orientation. Above it, Leg 6's record is your starting state,
and **its finding 1 changes how you look at anything**: synthetic KEYS reach the
WebKitGTK window through XTEST, so the command palette drives the product
surface without touching the source. Leg 4c's record carries the disabled-state
rule you are still held to. Then `CLAUDE.md`, `docs/spec/SPEC.md`, and
`src/screens/props.ts`.

**Leg 6 closed the runtime side.** Every transcript is a Markdown file under
`~/WordScript/transcripts` whose NAME the chat model writes (ADR 0074, 0077),
and that name is also what History's and Home's rows open with (ADR 0078). The
reveal acts on three surfaces. A retry re-runs the mode its record ran
(ADR 0075) and no longer refuses every record that succeeded. Export, import and
reset act, snapshotting first. Home's decision inbox receives a fallen-back
delivery (ADR 0076). The window chrome follows the colour scheme. Five ADRs —
0074 through 0078 — and two of them were the owner's corrections mid-leg.

**This leg is design rather than runtime, and it is one job:**

1. **The five missing SURFACES, and the gallery grows them first** (ADR 0057).
   Add and Edit for replacements and snippets, New profile's rename, and where
   an `analyze_text_rules` answer goes. Every one is a control that is drawn,
   disabled and carrying its reason today, and every reason is the same: *there
   is no drawn editor behind this*. `analyze_text_rules` is a real command with
   nowhere to put its answer. **The prototype has no editor for any of them**,
   so this is the first new DESIGN the port has had to make rather than carry
   across — read `demo.css` for the grammar, `docs/DESIGN_SYSTEM.md` for what
   the system already claims, and file an ADR for the shape you choose.
2. If you have room: `duration_ms` in the transcript frontmatter. §11.23 asks
   for it, the record has no source, and `transcript_store` has a test asserting
   its absence so that adding it is deliberate.
3. If you still have room: whether the title's model call belongs on a surface.
   ADR 0077 spends a call per dictation and no screen says so; every other model
   choice lives on AI Models' job list.

Three rules you are measured on. **Never render fake readiness (rule 7)**, in
both directions — when a control gets its command, delete the reason it carried,
**and grep the BANNERS too**: Leg 5 deleted four control-level reasons and left
a banner on Profiles saying Translate was not a runtime mode, which Leg 6 found
in its first screenshot. **A control that cannot act is disabled with its reason
and the design system has to DRAW that state** (ADR 0065/0067), with one
recorded exception: a setting IRRELEVANT under the current state is hidden
rather than disabled (ADR 0072). **A banner comes off in the commit that makes
it false, and its gallery entry goes with it** (ADR 0057) — `WiredScreenProps`
makes the compiler hold it, two screens retired that way in Leg 6, and the
screen's drawn branch goes with the entry while its fidelity cases move to the
wired suite rather than being dropped.

And one Leg 6 paid for: **check whether the PLAN designed the thing you are
about to recommend against.** §11.23 is four hundred words of decided design —
module name, path scheme, frontmatter, the reason — and a keep-or-retire
recommendation was very nearly made without reading it. Leg 5's version of the
same rule is about ADRs; this one is about the plan.

Not to be touched: **Context**, in any direction — the owner said on 2026-08-10
it is going to be done differently and deliberately did not say how. The **six
undecided surfaces** (ADRs 0060–0064 plus one roadmap candidate); the
translation **view** is one of them and is not the Translate **mode**. The
**overlay** is still rule 5: its pill owns a token capsule with ONE palette by
design, and the ghosting on a language change is documented in
`docs/known-issues/overlay-ghosting.md` and is not yours to work around. And no
config migration without a backup path — `core::backup` is the pattern now:
snapshot the file, then act, then answer with where the snapshot went.

Checks: `npm test`, `npm run build`, `cd src-tauri && cargo test`, and
`npm run port:diff` after anything that could move a screen — the 26-screen
command is in Leg 6's record and the expected result is 25 zeros plus one
RECORDED departure (`profiles`, ADR 0068). **Watch the test TOTAL, not the
colour**, and **run `npm run build` even when the suite is green**: Leg 6
shipped a mock signature `vitest run` does not typecheck and only the build
caught it. Run the suite twice before believing a failure.

Before you spend 3m 43s on `npm run tauri build`, check whether a
`npm run tauri dev` host is already running. One usually is, it hot-reloads the
working tree in about a second, and it is the owner's own session — do not kill
it, and do not raise its window past somebody working at the machine. Ask
instead. **You can drive it**: `xdotool key ctrl+k` with NO `--window` opens the
command palette through XTEST, `xdotool type` fills it, `Return` navigates.
Clicks are dead either way and scroll works only downward. Where the palette
cannot reach — a sub-tab, a collapsed job row — use a temporary mount effect and
take it out before the commit; Fast Refresh preserves component state, so a
changed `useState` default does nothing and a new hook does.

**Never `pkill -f`.** The pattern matches the agent shell's own command line,
whatever the pattern is, and it cost Leg 6 a killed shell. Kill by PID.

Two instrument notes that still hold. **`import -window` is dead on this
machine**; `spectacle -f -b -n -e -o <file>` works. The desktop is **two
monitors at a 1.6 device-pixel scale**, so a crop to an `xdotool` geometry must
be multiplied by 1.6 first — and the dev host gets a NEW window id every time
cargo rebuilds it, so re-read the id rather than trusting a saved one.

The owner dictates these briefings in WordScript, whose transcription is
currently inaccurate — see `docs/known-issues/transcription-accuracy.md`. A
sentence matching WordScript's own initial prompt is WordScript's own and can be
deleted on sight; anything else that matches nothing in the repo, the plan or
the drawing is worth one direct question rather than an hour of searching.

When it is done: commit, push to `main`, append your record to the leg log, and
write the Leg 8 prompt.

---

## Leg 8

Paste this to the next agent. Everything it needs beyond this page is in the
relay.

---

You are picking up WordScript after Leg 7. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. `src-tauri/` is open — and **the
core-hardening track is working in the same tree**. Run `git log --oneline -5`
before you start, and **stage your own paths when you commit** rather than
`git add -A`.

**Read `docs/tracks/gui-port-relay.md` first.** The Leg 8 prompt is
the section titled *"The prompt for Leg 8"* and it is your actual brief — this
page is only the orientation. Above it, Leg 7's record is your starting state,
and **its finding 1 binds you**: the owner lifted the Context do-not-touch for
one drawn change and nothing else. Then ADR 0082, `CLAUDE.md`,
`docs/spec/SPEC.md`, and `src/screens/props.ts`.

**Leg 7 closed the design side of Profiles.** The five controls that had been
drawn, disabled and carrying *"No editor is drawn for this yet"* since Leg 4c
all act now (ADR 0082): Add and Edit on Replacements and Snippets, a new
profile's rename, `More`'s menu, and both calls to `analyze_text_rules`. Every
one opens a panel that unfolds under the row or card it acts on — the plane
`RawPanel` already used — rather than a dialog over a surface that is itself a
modal sheet. Both rule lists reorder, because the runtime folds one entry's
output into the next.

**And the leg turned into the surface's manners, because the owner opened the
running app and named what was actually wrong.** It was not any one control but
the count of them: three shapes for "add one", two for "act on a row", and two
weights for "delete" — a rule went on one click with no question while the
profile holding it asked twice. So **one shape per job, on both pane screens**:
adding is `+` in the head of the list it adds to, a row's actions are a
right-click with a compact menu of verbs, an icon on a row is only for what you
repeat positionally, and deleting always asks at the row with Cancel focused.
Context's rail carries the same gesture, drawn only.

**This leg is three items and the first one closes a screen:**

1. **The profile health flag's click, and it is the last thing between Profiles
   and `WiredScreenProps`.** The count is read (`get_profile_health`) and the
   flag sentences are the button's tooltip; the click has nowhere to go because
   the four flag kinds point at three different tabs — `form_conflict` and
   `cleanup_interference` at Context, `length_bias` at Replacements,
   `bias_policy_weak` at Words. **One click on an aggregate count cannot route.**
   Decide it, file the ADR, and take Profiles out of the gallery in the commit
   that closes it — its drawn branch and its `DRAWN_*` constants go with it, and
   its fidelity cases move to the wired suite rather than being dropped
   (ADR 0057). That also retires `profiles` from `port:diff`, the way `history`
   and `privacy` went in Leg 6.
2. **`duration_ms` in the transcript frontmatter.** §11.23 asks for it, the
   record has no source, and `transcript_store` has a test asserting its absence
   so that adding it is deliberate. The pipeline already times itself. Leg 7 did
   not reach it and neither did Leg 6.
3. **Whether the title's model call belongs on a surface.** ADR 0077 spends a
   model call per dictation and no screen says so; every other model choice
   lives on AI Models' job list. A row there is drawn design work.

Four rules you are measured on. **Never render fake readiness (rule 7)**, in
both directions — Leg 7 is what the second direction costs: it deleted five
control-level reasons, rewrote a banner, and rewrote the test that had asserted
those reasons for three legs. **A control that cannot act is disabled with its
reason and the design system has to DRAW that state** (ADR 0065/0067), with the
one recorded exception that a setting IRRELEVANT under the current state is
hidden instead (ADR 0072). **A banner comes off in the commit that makes it
false, and its gallery entry goes with it** (ADR 0057) — `WiredScreenProps`
makes the compiler hold it.

And the one this leg pays for: **check whether the PRODUCT already shipped the
thing and something deleted it.** Leg 5's version of that rule is about ADRs,
Leg 6's is about the plan, and Leg 7's is one level lower —
`src/components/settings/PromptsTab.tsx`, 1720 lines, had the rule editor, the
reordering and the issues-attached-to-their-rule, and **Leg 3's own shell
overwrite deleted it** in `8f9077e`. Finding it changed two decisions.
`git log --oneline --diff-filter=D --name-only` is the tool.

Two more from Leg 7 that will save you an hour. **Measure the alternative before
you keep the tidy one:** three menu anchors were tried, and the obvious wrapper
element cost `profiles` nine structural differences while the second choice
moved `context`, which was not that leg's to move. **A primitive with no user is
not part of the system:** `align="end"` and `drop="down"` were added to
`.ws-menu` and deleted the same day once the panel became `fixed`.

Not to be touched: **Context beyond the one drawn gesture.** The owner lifted
the standing block on 2026-08-11 so the two pane screens would not grow two
manners, and only for that. It is still going to be done differently and the
owner still has not said how — ask before widening it. The **six undecided
surfaces** (ADRs 0060–0064 plus one roadmap candidate); `ia.test.tsx`'s last
case asserts none is mounted. The **overlay** is still rule 5, and the ghosting
on a language change is documented in `docs/known-issues/overlay-ghosting.md`
and is not yours to work around. And no config migration without a backup path
— `core::backup` is the pattern: snapshot, act, then answer with where the
snapshot went.

Checks: `npm test`, `npm run build`, `cd src-tauri && cargo test`, and
`npm run port:diff` after anything that could move a screen. **Watch the test
TOTAL, not the colour**, and **run `npm run build` even when the suite is
green** — Leg 6 shipped a mock signature `vitest run` does not typecheck and
only the build caught it.

**Under load the suite flakes and the number is about five.** Leg 7 saw three
full runs fail 3, 5 and 5 tests — a DIFFERENT set each time, every one passing
in isolation, with `uptime` reporting a load average of 14.
**`npx vitest run --no-file-parallelism` was green every time and is the
tiebreaker.** Do not chase a failure before you have run it serially.

For `port:diff`: serve the prototype (`python3 -m http.server 8791 --directory
docs/prototypes/settings-rework`), run `npm run dev`, and point `CHROME` at
`/home/felixontv/.cache/ms-playwright/chromium-1237/chrome-linux64/chrome`. The
26-screen command is in Leg 6's record. Expect **25 at structural 0 | style 0**
and `profiles` at **172 vs 175 | structural 14 | style 18** — ADR 0068's
departure plus ADR 0082's two, which are the head's title 24 px narrower where
the `+` sits and the scroll 45 px taller where the foot button was. If you close
item 1, `profiles` leaves the list entirely and the expectation becomes 25 of
25.

Before you spend 3m 43s on `npm run tauri build`, check whether a
`npm run tauri dev` host is already running. It hot-reloads the working tree in
about a second and it is usually the owner's own session — do not kill it, and
do not raise its window past somebody working at the machine. Ask instead.
**You can drive it**: `xdotool key ctrl+k` with NO `--window` opens the command
palette through XTEST, `xdotool type` fills it, `Return` navigates. Clicks are
dead either way and scroll works only downward.

**Where the palette cannot reach, a temporary mount effect is still the answer —
and it has an ordering trap.** Setting the tab and opening a panel in the same
effect does nothing on Profiles: the screen's own clear-on-tab-change effect
wipes what you just set. Set the tab, then open the panel in a `setTimeout`.
Take the effect out before the commit. Fast Refresh preserves component state,
so a changed `useState` default does nothing and a new hook does.

**The native host is the only instrument for a drawn state, and Leg 7 found two
defects with it that no test could see** — both for one reason: `patch` is a spy
that does not feed the config back, so a precondition that only breaks once a
write RETURNS cannot occur in jsdom. If you write a test for something that
happens after a config write, make the test return the write.

**Never `pkill -f`.** The pattern matches the agent shell's own command line,
whatever the pattern is, and it cost Leg 6 a killed shell. Kill by PID.

Two instrument notes that still hold. **`import -window` is dead on this
machine**; `spectacle -f -b -n -e -o <file>` works. The desktop is **two
monitors at a 1.6 device-pixel scale**, so a crop to an `xdotool` geometry must
be multiplied by 1.6 first — and the dev host gets a NEW window id every time
cargo rebuilds it, so re-read the id rather than trusting a saved one.

The owner dictates these briefings in WordScript, whose transcription is
currently inaccurate — see `docs/known-issues/transcription-accuracy.md`. A
sentence matching WordScript's own initial prompt is WordScript's own and can be
deleted on sight; anything else that matches nothing in the repo, the plan or
the drawing is worth one direct question rather than an hour of searching.

When it is done: commit, push to `main`, append your record to the leg log, and
write the Leg 9 prompt.

---

## Leg 10

Paste this to the next agent. Everything it needs beyond this page is in the
relay.

---

You are picking up WordScript after Leg 9. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. `src-tauri/` is open — and **the
core-hardening track is working in the same tree**. Run `git log --oneline -5`
before you start, and **stage your own paths when you commit** rather than
`git add -A`.

**Read `docs/tracks/gui-port-relay.md` first.** The Leg 10 prompt is
the section titled *"The prompt for Leg 10"* and it is your actual brief — this
page is only the orientation. Above it, Leg 9's record is your starting state,
and **its findings 2 and 3 will save you an hour** if you go anywhere near the
native host. Then ADR 0089, `CLAUDE.md`, `docs/spec/SPEC.md`, and
`src/screens/props.ts`.

**Leg 9 was the drift pass, and the spec was the worst offender — the one file
every other document defers to.** `docs/spec/SPEC.md` said **"none of it is
wired"** about a port where eight surfaces read and write the runtime, two more
read part of what they draw, and four carry a banner naming their phase. It
described `settings` as a pre-port shell with a 232px sidebar, when that window
has been the workspace since Leg 3. Its "Tauri commands (UI -> Rust), key
surface" list carried four commands no UI calls and two entries that are not
commands at all. All of it under a `Status:` line reading *"last drift check
2026-08-11"*. **The date was current and the content was three legs stale.**
README, ARCHITECTURE, REFERENCE, DESIGN_SYSTEM, VISION, ROADMAP, STATUS and the
plan's §0 were corrected in the same pass.

**AI Models names the title call now** (ADR 0088). ADR 0087 had priced that row
at **structural 18 | style 6** — a number measured on a `LaneJobRow`, which is a
shape ADR 0087's own ruling excludes, because "states rather than sets" means
its `<details>` would open onto an empty body. The honest shape is a flat
`JobNone`, and it costs **6 | 6**: `JobNone` renders `div.job` where
`LaneJobRow` renders `details.job`, so an appended flat row occupies its own
sibling index space and shifts no path at all. Both ends measured this leg.
`port:diff` is **24 of 25 at structural 0 | style 0**, `models` the one
departure.

**And the two caller-less commands turned out to be fourteen** (ADR 0089).
`invoke_handler` against every `invoke(` in `src/` is two greps. Applying Leg 7's
rule flatly — a primitive with no user is not part of the system — would have
deleted a lane ADR 0065 explicitly defers and a capability the product silently
lost. So they are triaged by **why** they lost a caller, which is one command:
`git log -S'"the_name"' -- src/`. Six went, eight are documented and kept.

**This leg is two items and both are decisions before they are code:**

1. **Text-rules import and export, and this is the leg's question.**
   `export_text_rules` and `import_text_rules` are complete in the runtime —
   schema version, conflict resolution, merge, analysis — and have had **no
   caller since Leg 3's shell overwrite deleted the surface that called them**.
   Nothing replaced them: `export_full_backup` writes the whole config, which is
   not a shareable rules document. This is a capability the product had and lost
   without anybody noticing, because `ARCHITECTURE.md` went on asserting the UI
   did it. Three answers are open and each is defensible: draw it on Profiles
   (it is that screen's data, and ADR 0082 already gives you the panel plane);
   fold it into Privacy & Data beside the backup (both are import/export of user
   data); or delete the runtime and record that WordScript does not share rule
   sets. **Ask the owner before deleting** — this is a product decision, not a
   cleanup.
2. **The four session commands SPEC names as contract and nothing calls.**
   `start_native_session`, `stop_native_session`, `native_session_status`,
   `complete_native_session`. The operations are alive — the Rust trigger path
   drives `start_from_native`, `processing_from_native` and the state machine
   directly — so these are command shells. `abort_native_session` is the one of
   the five that has a caller, because the overlay draws an abort. Either the
   spec stops calling them the UI surface, or something starts calling them. Leg
   9 corrected the section describing them and left the commands, because
   removing a contract is not a drift fix.

Five rules you are measured on. **Never render fake readiness (rule 7)**, in
both directions. **A document that asserts a capability is how a regression
hides** — the doc said present, the runtime said compiles, and only the caller
was gone; nothing looks at callers unless somebody greps for them. **A
drift-check date is not evidence of a drift check.** **Strike the item when you
do it** — §2.5's last bullet was discharged by Leg 2 in `db9a6dc` and re-carried
as owed by six consecutive prompts including Leg 9's own, which sent a leg to
fix something already fixed; a list nobody marks off costs more than the drift
it tracks, because a real item and a phantom one look identical. And **measure
the shape you are shipping, not the one you tried** — ADR 0087's eighteen was
honest, belonged to a row its own decision excluded, carried forward one leg as
fact, and was a third off.

Not to be touched: **Context beyond the one drawn gesture** the owner lifted on
2026-08-11, and only for that — it is still going to be done differently and the
owner still has not said how, so ask before widening it. The **six undecided
surfaces** (ADRs 0060–0064 plus one roadmap candidate); `ia.test.tsx`'s last
case asserts none is mounted. The **`settings` window label**, which names the
wrong thing on a window that is the workspace — six Rust call sites and the
window-state persistence key hang on it, so renaming is a runtime change nobody
has asked for; the docs now say what it is and why it stayed. The **overlay** is
still rule 5, and **the two commands that resized it dynamically are gone**
(ADR 0089) — that path is what the ghosting came from, do not bring it back. And
no config migration without a backup path: `core::backup` is the pattern —
snapshot, act, then answer with where the snapshot went.

Checks: `npm test`, `npm run build`, `cd src-tauri && cargo test`, and
`npm run port:diff` after anything that could move a screen. **Watch the test
TOTAL, not the colour**, and **run `npm run build` even when the suite is
green** — Leg 6 shipped a mock signature `vitest run` does not typecheck and
only the build caught it. Leg 9 closed at **470 frontend across 39 files,
`cargo test` 740, `cargo check` 15 warnings**. Under load the suite flakes by
about five; `npx vitest run --no-file-parallelism` is the tiebreaker and
`uptime` tells you whether to reach for it. Leg 9 ran at 2.0–3.2 and saw none.

**`npm run port:diff` TAKES A SCREEN LIST OR IT MEASURES NOTHING.** With no
arguments it prints `ALL EXACT` over an empty set, which reads exactly like a
pass and is the easiest way to ship a departure you never saw. Serve the
prototype (`python3 -m http.server 8791 --directory
docs/prototypes/settings-rework`), run `npm run dev`, and pass every gallery id
except `ds`, plus `models#1 agents#1 agents#2 onboarding#1`–`#6` — 25
measurements. Expect **24 of 25 at structural 0 | style 0** with `models` at
**6 | 6** (ADR 0088). The 33 differences in the `text` column are the soft
category Leg 2a recorded as false positives and no leg counts.

**Check whether a host and a dev server are already running before you start
one** — `ps -o lstart=` on the pid shows whose is whose. Note that
`npm run tauri dev` starts **its own** Vite, so a `npm run dev` you started
yourself will collide with it on 1420 and the host dies with *"beforeDevCommand
terminated with a non-zero status code"*. Do not kill the owner's session, and
**do not raise its window past somebody working at the machine — ask.**

**The native host is the only instrument for a drawn state, and it has found a
defect in three consecutive legs.** Leg 9's was pure rendering: a 228-character
row description against a ≤ 90-character one-line budget, which jsdom reports as
a correct string and WebKitGTK draws as four lines against neighbours that take
one.

**Three instrument notes from Leg 9, and they replace what earlier pages said.**

- **`spectacle -a -b -n -o <file>` captures the ACTIVE WINDOW and is the only
  reliable capture.** Do **not** crop a full-desktop `spectacle -f` to an
  `xdotool` geometry — earlier pages tell you to multiply by 1.6 and that is now
  wrong in practice: `getwindowgeometry` returned three different positions for
  one window inside a single session and none matched where it was drawn, and
  `getdisplaygeometry` reports the primary monitor only while windows sit past
  its right edge. Two such crops landed on the owner's browser instead of the
  app. `xdotool getactivewindow` is trustworthy; its geometry is not.
- **Synthetic POINTER events do not reach the webview. Synthetic KEYS do.** Leg
  6 recorded that clicks are dead; the wheel is dead too — fourteen
  `xdotool click 5` over the content scrolled nothing. `Page_Down` also does
  nothing, because the scroll container never has focus. **`Tab` is the
  scroller:** 34 of them walk focus from the top of AI Models down to the
  Writing group and drag the viewport along with it.
- **The command palette takes `ctrl+k`, arrow keys and `Return`, and ignores
  `xdotool type`** — the search field stays on its placeholder. Navigate it by
  counting rows, and screenshot once to see where the highlight starts, because
  it opens on the surface you are already on rather than at the top.

Where the palette cannot reach, a temporary mount effect is still the answer,
and it has an ordering trap: setting the tab and opening a panel in the same
effect does nothing, because the screen's own clear-on-tab-change effect wipes
what you just set. Set the tab, then open the panel in a `setTimeout`. Take the
effect out before the commit and grep for it. Fast Refresh preserves component
state, so a changed `useState` default does nothing and a new hook does — and it
also **resets the scroll position**, so a hot reload costs you the 34 Tabs again.

If you write a test for something that happens after a config write, **make the
test return the write**: `patch` is a spy that does not feed the config back, so
a precondition that only breaks once a write RETURNS cannot occur in jsdom. That
is what hid two of Leg 7's defects.

**Never `pkill -f`.** The pattern matches the agent shell's own command line,
whatever the pattern is, and it cost Leg 6 a killed shell. Kill by PID — and
**stop what you started**: Leg 9 started a host for one check and shut it down
afterwards, leaving the owner's prototype server on 8791 alone.

The owner dictates these briefings in WordScript, whose transcription is
currently inaccurate — see `docs/known-issues/transcription-accuracy.md`. A
sentence matching WordScript's own initial prompt is WordScript's own and can be
deleted on sight; anything else that matches nothing in the repo, the plan or
the drawing is worth one direct question rather than an hour of searching.

**The next free ADR number is 0090**, and that sentence is the first thing that
goes stale — grep the tree, source as well as `docs/`, because a number is cited
in code before its file lands. Do not edit an existing ADR; append-only.

When it is done: commit, push to `main`, append your record to the leg log, and
write the Leg 11 prompt.

---

## Leg 11

Paste this to the next agent. Everything it needs beyond this page is in the
relay.

---

You are picking up WordScript after Leg 10. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. `src-tauri/` is open — and **the
core-hardening track is working in the same tree**. Run `git log --oneline -5`
before you start, and **stage your own paths when you commit** rather than
`git add -A`.

**Read `docs/tracks/gui-port-relay.md` first.** The Leg 11 prompt is
the section titled *"The prompt for Leg 11"* and it is your actual brief — this
page is only the orientation. Above it, Leg 10's record is your starting state,
and **its findings 1 and 2 are the two that will cost you if you skip them**.
Then ADR 0090, ADR 0091, `CLAUDE.md` and `docs/spec/SPEC.md`.

**Leg 10 closed both of the items Leg 9 had opened, in opposite directions.**
Text-rules import and export got a surface (ADR 0090); the four session commands
were deleted (ADR 0091). Neither had a caller. What separated them was *why*,
which is the question ADR 0089 exists to ask, and in both cases the answer was
somewhere other than the code.

**The leg's question had been answered in the prototype years before it was
asked.** Where the rules export goes was framed as three open placements. The
prototype's own Profiles comment reads *"Duplicate and Export are things you do
to a profile rarely and from the list … they are on the row's own menu."* Leg 7
built that menu with three verbs; `Profiles.tsx`'s docblock went on naming four.
**A comment asserting a control is indistinguishable from the control** — the
same defect as `ARCHITECTURE.md`'s six-leg claim, one layer down.

**The owner's rejection of the obvious fix is what produced the design.** Asked
to confirm export and import together on the row menu, they said an Import there
makes no sense — *what am I supposed to do with it then*. **Export acts on a
thing; import creates one.** So export is the fourth verb on the row menu and
writes the row it opened on, and import is on Privacy & Data, where it lands as
a **new** profile and replaces nothing — no target to choose, and no snapshot,
because nothing is replaced.

**The owner also refused a deletion on a grep**, and that is what turned up ADR
0091. The four session commands are the **Python sidecar's IPC command set**:
`wordscript/ipc.py` documents the Tauri → Python channel as `start_recording` /
`stop_recording` / `abort_recording`, and `febc452` carried it across as Tauri
commands in the same commit that moved trigger, capture and pipeline into the
Rust process. They read as a designed contract for six legs, and the fact that
separated them from one was in a deleted Python file's docstring.

This leg is one item and a sweep, and the item is a pass rather than a fix:

1. **The width defect on `General`, and every row like it.** `Input device`
   pairs a `Select` with a `Rescan` button and a runtime-conditional hint that
   draws at **six lines** in WebKitGTK. Leg 10 found it in its own screenshots
   while fixing the same defect one screen over and left it, because `General`
   was not its scope. The value is not that row — it is **every `Row` whose
   control is more than one button**. Conditional copy is the part a
   default-state check never sees, so enumerate the states rather than opening
   the screen once.
2. **The `src-tauri/` drift sweep, with the blind spot Leg 10 found.**
   `invoke_handler` against every `invoke(` in `src/` is the check ADR 0089 put
   in every leg that touches the runtime. Extend it: `StartNativeSessionRequest`
   and `CompleteNativeSessionRequest` outlived the commands that deserialized
   them with **no warning at all**, because a `pub` Rust item with no user
   compiles silently.

**The rule you are most likely to break.** A row's one-line copy budget is a
function of the control's width, and nothing in the toolchain knows that. Leg
10's rows shipped at **79 and 71 characters** — both inside the ≤ 90 budget every
other row is written to — and drew **three lines and two** against neighbours
that drew one, because `.ws-row-ctl` is `flex: none` and a `Select` plus a
button leaves the text column about thirty characters where one button leaves
fifty. jsdom reports the string and cannot report the wrap. The explanation
belongs on the section header; a row gets at most one line.

**Also: ask why a thing is there before asking whether anything calls it.** `git
log -S` over the commit that introduced a primitive answers *why*, and *why* is
the only question that separates a deferred lane from a corpse.

**Strike the item when you do it.** Leg 9 struck a bullet six briefs had
re-carried; Leg 10 struck both entries Leg 9 added. Keep it that way.

**Not to be touched:** Context beyond the one drawn gesture lifted on
2026-08-11 — ask before widening it. The six undecided surfaces (ADRs 0060–0064
plus the roadmap candidate); `ia.test.tsx`'s last case asserts none is mounted.
The `settings` window label. The overlay is still rule 5, and the two commands
that resized it dynamically are gone (ADR 0089) — do not bring that path back.
And no config migration without a backup path: `core::backup` is the pattern.
ADR 0090's rules import is not an exception — it appends and replaces nothing,
which is why it snapshots nothing, and it says so on the row.

**Checks:** `npm test`, `npm run build`, `cd src-tauri && cargo test`, and
`npm run port:diff` after anything that could move a screen. Watch the test
TOTAL, not the colour, and run `npm run build` even when the suite is green.
Leg 10 closed at **473 frontend across 39 files, `cargo test` 740, `cargo check`
15 warnings**. Under load the suite flakes by about five;
`npx vitest run --no-file-parallelism` is the tiebreaker and `uptime` tells you
whether to reach for it. Leg 10 ran at 1.3–1.4 and saw none.

**`npm run port:diff` TAKES GALLERY IDS OR IT MEASURES NOTHING — and a name
that is not one is dropped in silence.** Leg 9 recorded that no arguments prints
`ALL EXACT` over an empty set. Leg 10 found the sharper version: passing the
*retired* screen names (`profiles`, `privacy`, `history`, `general`, `hotkeys`,
`delivery`, `diagnostics`, `about`, `notes`) produces no measurement and no
error, so a run can look full and be short. **The 25 are the 16 ids in
`src/windows/gallery/registry.tsx` except `ds`**, plus `models#1 agents#1
agents#2 onboarding#1`–`#6`. Read the registry rather than a prose list — the
prose goes stale every time a screen is wired and leaves the gallery. Expect 24
of 25 at structural 0 | style 0 with `models` at 6 | 6 (ADR 0088); the 33 in the
text column are the soft category Leg 2a recorded as false positives.

**Check whether a host and a dev server are already running before you start
one** — `ps -o lstart=` on the pid shows whose is whose. `npm run tauri dev`
starts its own Vite, so a `npm run dev` you started yourself collides with it on
1420 and the host dies with *"beforeDevCommand terminated with a non-zero status
code"*. If the owner's session is already up, `port:diff` needs nothing started
at all: 1420 and 8791 are both already served. Do not kill the owner's session,
and **do not raise its window past somebody working at the machine — ask**.

**The native host is the only instrument for a drawn state**, and it has found a
defect in four consecutive legs. Leg 10's was a string inside the copy budget
and a budget that was not a constant.

Three instrument notes, and they extend Leg 9's rather than replacing them.

- `spectacle -a -b -n -o <file>` captures the ACTIVE WINDOW and is the only
  reliable capture. Do not crop a full-desktop `spectacle -f` to an `xdotool`
  geometry: `getwindowgeometry` returned three different positions for one
  window in a single session and none matched where it was drawn.
  `xdotool getactivewindow` is trustworthy; its geometry is not.
- Synthetic POINTER events do not reach the webview (clicks and the wheel both).
  Synthetic KEYS do — **but they must be sent bare**. `xdotool key --window <id>
  Escape` was silently dropped; `xdotool windowactivate <id>` followed by
  `xdotool key Escape` works. That cost Leg 10 a round trip.
- The command palette takes `ctrl+k`, arrow keys and `Return`, and ignores
  `xdotool type`. Its `GO TO` block lists the four workspace views first, so
  `ctrl+k`, two `Down`s and `Return` is Profiles from Home — much cheaper than
  Leg 9's 34 Tabs. `Tab` is still the only way to reach a control, and it drags
  the viewport along: the profile row menu is at Tab 16 from the view's first
  focusable, opened with `Return` on the `More` button.

Where the palette cannot reach, a temporary mount effect is still the answer,
and it has an ordering trap: setting the tab and opening a panel in the same
effect does nothing, because the screen's own clear-on-tab-change effect wipes
what you just set. Set the tab, then open the panel in a `setTimeout`. Take the
effect out before the commit and grep for it. Fast Refresh preserves component
state, so a changed `useState` default does nothing and a new hook does — and it
resets the scroll position.

If you write a test for something that happens after a config write, make the
test return the write: `patch` is a spy that does not feed the config back, so a
precondition that only breaks once a write RETURNS cannot occur in jsdom.

**Never `pkill -f`.** The pattern matches the agent shell's own command line and
cost Leg 6 a killed shell. Kill by PID — and stop what you started.

The owner dictates these briefings in WordScript, whose transcription is
currently inaccurate — see `docs/known-issues/transcription-accuracy.md`. A
sentence matching WordScript's own initial prompt is WordScript's own and can be
deleted on sight; anything else that matches nothing in the repo, the plan or
the drawing is worth one direct question rather than an hour of searching.

**The next free ADR number is 0092**, and that sentence is the first thing that
goes stale — grep the tree, source as well as `docs/`, because a number is cited
in code before its file lands. Do not edit an existing ADR; append-only.

When it is done: commit, push to `main`, append your record to the leg log, and
write the Leg 12 prompt.

---

## Leg 12

Paste this to the next agent. Everything it needs beyond this page is in the
relay.

---

You are picking up WordScript after Leg 11. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. `src-tauri/` is open — and **the
core-hardening track is working in the same tree**. Run `git log --oneline -5`
before you start, and **stage your own paths when you commit** rather than
`git add -A`.

**Read `docs/tracks/gui-port-relay.md` first.** The Leg 12 prompt is
the section titled *"The prompt for Leg 12"* and it is your actual brief — this
page is only the orientation. Above it, Leg 11's record is your starting state,
and **its findings 1 and 4 are the two that will cost you if you skip them**.
Then ADR 0092, ADR 0093, `CLAUDE.md` and `docs/spec/SPEC.md`.

**Leg 11 was sent to apply a rule and found the rule was false.** The brief said
a section header carries the explanation and a row gets at most one line. Of the
74 measurements over one line on the shipped surfaces, **62 carry the
prototype's copy verbatim** — two lines is the drawing's norm, on six screens,
consistently. Applying the rule as handed over would have rewritten sixty rows
of the donor's copy on the authority of a sentence derived from one card of two.
**A brief's rule is a claim, and checking it cost one script.**

**The budget was measurable all along.** Leg 10 said a copy budget is a function
of the control beside it and that nothing in the toolchain knows that — the
second half was the part worth acting on. A mount effect that reads
`.ws-row-hint`'s height against its computed line-height reports the drawn line
count directly, in WebKitGTK, for **123 rows and 51 conditional states** in
twenty seconds. One line holds **12 to 73 characters**. `≤ 90` was written in
four places and is wrong in all of them; one of the four also promised a lint
rule, for a number that is not knowable from the source.

**The three real defects were one mistake, and it is not a length mistake.** A
row must not print the runtime text its own control displays. `.ws-sel` is
`width: auto`, so a device name, a monitor label or a release summary is what
sets the control's width — the row spends its text column on the string and then
tries to print the string in what is left. Shortening it moves the width too:
`Input device`'s replacement ran 24 characters and still drew two lines, because
the row had **80 pixels**. That row now carries no hint at all.

This leg is one item and a sweep:

1. **The rows no instrument has reached.** `Profiles`' editor panel,
   `Diagnostics`' non-default tabs and every unexpanded `Models` job were never
   measured — the instrument only sees what is rendered, and Leg 11's pass
   caught the default state of each surface. Rebuild the instrument (it is ten
   lines; the relay's finding 1 says how), open those surfaces, and apply ADR
   0092's test to what you find: **is the copy the prototype's, or did the port
   write it?** Only the second is yours to change.
2. **The `src-tauri/` drift sweep, now with three questions rather than two.**
   `invoke_handler` against `invoke(` in **non-test** `src/`, then the survivors
   against the whole tree. That third pass is what found ADR 0093's three: a
   command whose name survives in a test mock looks called to a name-grep and
   uncalled to a call-grep, and only the second is true.

**The rule you are most likely to break.** Carrying a number instead of
measuring one. The sheet's row width changed from **542 px to 457** between two
passes in a single session, which moved a text column from 165 px to 80. Every
figure in ADR 0092's table is a figure at a window size, including the ones this
page just quoted.

**Also: a conditional state is priced by cloning the node, not by opening the
screen.** `General`'s second defect was in `Anchor`, which is only rendered in
preset placement — the machine is in manual, so no screenshot of that screen was
ever going to contain the row. It was found by reading the drawing.

**Strike the item when you do it.** Leg 9 struck a bullet six briefs had
re-carried; Leg 10 struck both of Leg 9's; Leg 11 struck both of Leg 10's.

**Not to be touched:** The prototype's copy — ADR 0092 lists the rows still
drawing three lines and they are the drawing's; tightening them is a design
decision and the owner's. Context beyond the drawn gesture lifted on 2026-08-11
and the row pass scoped the same day — ask before widening. The six undecided
surfaces (ADRs 0060–0064 plus the roadmap candidate); `ia.test.tsx`'s last case
asserts none is mounted. The `settings` window label. The overlay is still rule
5, and the two commands that resized it dynamically are gone (ADR 0089). And no
config migration without a backup path: `core::backup` is the pattern.

**Checks:** `npm test`, `npm run build`, `cd src-tauri && cargo test`, and
`npm run port:diff` after anything that could move a screen. Watch the test
TOTAL, not the colour, and run `npm run build` even when the suite is green.
Leg 11 closed at **473 frontend across 39 files, `cargo test` 740, `cargo check`
15 warnings** — all three unchanged from Leg 10. Under load the suite flakes by
about five; `npx vitest run --no-file-parallelism` is the tiebreaker and
`uptime` tells you whether to reach for it. Leg 11 ran at 1.6–2.4 and saw none.

**`npm run port:diff` TAKES GALLERY IDS OR IT MEASURES NOTHING — and a name
that is not one is dropped in silence.** The 25 are the **16 ids in
`src/windows/gallery/registry.tsx` except `ds`**, plus `models#1 agents#1
agents#2 onboarding#1`–`#6`. Read the registry rather than a prose list. Expect
24 of 25 at structural 0 | style 0 with `models` at 6 | 6 (ADR 0088); the 33 in
the text column are the soft category Leg 2a recorded as false positives.
**Check `ss -ltn | grep 9333` before you run it** — the script binds that port
itself, and Leg 11 found a ten-hour-old browser from an abandoned run holding
it, which would have made a fresh run attach to stale code rather than fail.

**Check whether a host and a dev server are already running before you start
one** — `ps -o lstart=` on the pid shows whose is whose, and
`xprop -id <window> _NET_WM_PID` maps a window to its process. `npm run tauri
dev` starts its own Vite, so a `npm run dev` you started yourself collides with
it on 1420 and the host dies. If the owner's session is already up, `port:diff`
needs nothing started: 1420 and 8791 are both already served. Do not kill the
owner's session, and **do not raise its window past somebody working at the
machine — ask**.

**The native host is the only instrument for a drawn state**, and it has found a
defect in five consecutive legs. **But prefer the instrument to the
screenshot**: it reads every row on every surface in one pass, including states
no screenshot can reach.

Three instrument notes.

- The channel out of the webview is a **POST to a loopback collector**.
  `tauri.conf.json` sets `csp: null`, so `fetch` needs no permission and lands
  in a file the shell reads immediately. `append_diag_log` was tried first and
  failed silently into its own `.catch` — never debug through a channel whose
  failure mode is silence.
- `spectacle -a -b -n -o <file>` captures the ACTIVE WINDOW and is the only
  reliable capture. Do not crop a full-desktop `spectacle -f` to an `xdotool`
  geometry: `getwindowgeometry` is not trustworthy even though
  `xdotool getactivewindow` is.
- Synthetic POINTER events do not reach the webview. Synthetic KEYS do — **but
  they must be sent bare**: `xdotool key --window <id>` is silently dropped.
  `ctrl+comma` opens settings and it always opens on `General`; `ctrl+k` opens
  the palette, whose `GO TO` block lists the four workspace views first.

Where the palette cannot reach, a temporary mount effect is still the answer,
and it has an ordering trap: setting the tab and opening a panel in the same
effect does nothing, because the screen's own clear-on-tab-change effect wipes
what you just set. Set the tab, then open the panel in a `setTimeout`. Take the
effect out before the commit and grep for it — Leg 11's lived at
`src/dev/rowAudit.ts` with one hook in `WorkspaceWindow.tsx`. **Fast Refresh
preserves component state, so a changed `useState` default does nothing and a
new hook does** — which is also how you re-run an instrument: add a throwaway
hook and it fires again.

**Never `pkill`.** Not `-f`, which matches the agent shell's own command line
and cost Leg 6 a killed shell, and not `-P $$`, which killed Leg 11's own
subshell. Kill by PID — and stop what you started.

The owner dictates these briefings in WordScript, whose transcription is
currently inaccurate — see `docs/known-issues/transcription-accuracy.md`. A
sentence matching WordScript's own initial prompt is WordScript's own and can be
deleted on sight; anything else that matches nothing in the repo, the plan or
the drawing is worth one direct question rather than an hour of searching.

**The next free ADR number is 0101** — and 0094 through 0100 were claimed by the
core-hardening track while Leg 11's own checks were running, which is how fast
this line rots. Grep the tree, source as well as `docs/`, because a number is
cited in code before its file lands. Do not edit an existing ADR; append-only.

When it is done: commit, push to `main`, append your record to the leg log, and
write the Leg 13 prompt.
