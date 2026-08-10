# Kick-off — Leg 6

Paste this to the next agent. Everything it needs beyond this page is in the
relay.

---

You are picking up WordScript after Leg 5. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. **`src-tauri/` is open** — Leg 5 opened it
and the rule that kept it shut is spent.

**Read `docs/handoffs/HANDOFF_gui-port-relay.md` first.** The Leg 6 prompt is
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
