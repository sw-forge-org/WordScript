# Kick-off — Leg 8

Paste this to the next agent. Everything it needs beyond this page is in the
relay.

---

You are picking up WordScript after Leg 7. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. `src-tauri/` is open — and **the
core-hardening track is working in the same tree**. Run `git log --oneline -5`
before you start, and **stage your own paths when you commit** rather than
`git add -A`.

**Read `docs/handoffs/HANDOFF_gui-port-relay.md` first.** The Leg 8 prompt is
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
