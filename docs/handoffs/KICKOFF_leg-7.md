# Kick-off — Leg 7

Paste this to the next agent. Everything it needs beyond this page is in the
relay.

---

You are picking up WordScript after Leg 6. Work in
`/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
on `main`. Do not create a branch. `src-tauri/` is open.

**Read `docs/handoffs/HANDOFF_gui-port-relay.md` first.** The Leg 7 prompt is
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
