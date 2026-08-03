# WordScript — GUI rework, third pass

> **Superseded 2026-08-04 by [HANDOFF_gui-port-relay.md](HANDOFF_gui-port-relay.md).**
> Its four listed faults and its open items were carried through passes four to
> fourteen and are recorded in the prototype's own pass log: the padding system
> (ADR 0052), the matrix (ADR 0053), the frosted material (ADR 0051), the
> provider grid (resolved as a chip row, not a grid and not a select), the live
> waveform, and the four features that had never been sketched. The validation
> it never ran was run on 2026-08-04: 154 frontend tests green.
>
> Everything below is historical. The prototype it describes is read-only from
> 2026-08-04 (ADR 0055), and its two large files are no longer edited — but the
> exact-match editing rule in the next section still governs anyone who has to
> touch them anyway, and it is the reason this file is kept rather than archived.

Repo: `/home/felixontv/localdev/sw-labs.localdev/brands.localdev/sw-forge-org/WordScript-master/WordScript`
Branch: `gui-rework-second-pass`, commit `e92e44c`, pushed.

Read first: `AGENTS.md` (= `CLAUDE.md`), `docs/DESIGN_SYSTEM.md`,
`docs/SETTINGS_REWORK_PLAN.md` §5 and §15,
`docs/prototypes/settings-rework/README.md`.

Serve the prototype: `python3 -m http.server 8791 --directory docs/prototypes/settings-rework`

---

## Read this before you touch demo.css

`docs/prototypes/settings-rework/demo.css` is 4547 lines and `demo.js` is 7241.
On 2026-08-03 the previous agent rewrote a region of demo.css by computing a
byte range with `src.index('.matrix-field {')`. That anchor matched an earlier
occurrence inside a light-theme rule, and about 1350 lines were destroyed —
the entire layout and control layer. It was recovered only from a Claude Code
file-history snapshot, because the file had never been committed.

It is committed now, which is what the branch above is for. The rule stands
anyway:

- **Edit these two files only with exact-match string replacement.** Never with
  line numbers, never with computed index ranges. Selectors repeat; anchors are
  ambiguous; you will not notice.
- Before any scripted rewrite, copy the file to your scratchpad.
- If something is lost: `~/.claude/file-history/<session-id>/` holds per-file
  snapshots keyed by a path hash. `grep -rl "<distinctive string>"` finds them.

---

## What the second pass delivered

- **The ElevenLabs blocker is solved.** `ui.elevenlabs.io` still answers every
  request with a Vercel bot check (HTTP 429), including from the CLI and with a
  browser user agent. The components are MIT and open at
  `github.com/elevenlabs/ui`. Seven plus one hook are vendored in
  `src/components/ui/`, each with its upstream path and commit `6e5b681c01ee`
  in a header. Do not try the registry host again; go to the repository.
- Three of the ordered eleven do not apply and are not installed: `voice-picker`
  (picks TTS voices through the ElevenLabs SDK; WordScript has no TTS voices),
  `speech-input` (needs the ElevenLabs Scribe cloud hook), `orb` (pulls
  three.js and four packages, and pulses, which ADR 0049 forbids — the owner
  chose to keep `src/lab/Orb.tsx`).
- **`message-scroller` cannot be installed.** It depends on `@shadcn/react`,
  which requires `@types/react >= 19`. This project is on React 18.3.1. Do not
  force it with `--legacy-peer-deps`; if the owner wants it, that is a React 19
  upgrade and its own decision.
- 18 shadcn components plus `@tanstack/react-table` are installed. All 26
  pre-existing files in `src/components/ui/` were verified bit-identical
  afterwards.
- In the prototype: the card became an inset group, selects became macOS pop-up
  buttons, the sidebar took neutral icon tiles and a search field, and the glyph
  field standing in for `matrix` was replaced with the real dot-matrix geometry.

Decisions the owner already took — do not reopen them:

- Row grammar plus sidebar, tokens untouched (colour ladder, accent, Archivo).
- Sidebar tiles stay **neutral**; accent only on the active row.
- The glyph rain is gone for good; the matrix is a readout, not a ground.

---

## What is wrong right now — the owner's own list

### 1. Padding. Content is stuck to the card walls.

This is a regression the second pass introduced and did not finish. The card's
horizontal padding was moved onto `.row` so hairlines could span the group, and
a guard was added:

```css
.card > :not(.rows):not(.list):not(.lane):not(.check-list):not(.disc) {
  padding-left: var(--pad-card);
  padding-right: var(--pad-card);
}
```

`.rows` was handled, because `.row` took the padding itself. **`.list`,
`.lane`, `.check-list` and `.disc` were not.** Their children have no
horizontal padding from anywhere, so every list item, lane row and disclosure
in the prototype now starts flush against the rounded corner. Home's "Recent"
list shows it plainly: the text begins exactly on the card's left edge.

Fix it the same way `.row` was fixed — the *item* carries the inset, so its
separator can still run to the group's edge. Then walk all 23 screens and check
every card, not only the ones on Home. Treat the whole padding system as in
scope: the density variants (`--pad-card`, `--row-py` at tight/standard/roomy)
were tuned against the old grammar and have not been re-judged since.

### 2. The matrix sits on a strange card, and it is not 1:1.

The dot-matrix readout was dropped into Home's hero state line. The owner's
verdict: the card it lives on is odd, its content is odd, and the card can go.

Two jobs:

- **Remove that surface.** Decide where a level readout actually belongs and
  put it there. It is a measurement — it belongs next to the thing being
  measured, not floating in a hero panel.
- **Implement the matrix 1:1 with the real component.** The vanilla version in
  `demo.js` currently ports only `vu()` and the circle geometry. Upstream
  `src/components/ui/matrix.tsx` also carries `digits`, `loader`, `pulse`,
  `wave`, `snake`, the frame animation with fps/loop/autoplay, the `brightness`
  prop, the lit-pixel scale step and the radial-gradient fills. Port the rest,
  or render the React component at `/component-lab` and say so in the prototype
  — the arrangement the owner set is: show it in the demo where possible,
  otherwise point at `/component-lab`.
- Note one upstream bug already fixed locally and marked `WORDSCRIPT`: the
  `matrix-pixel-off` gradient hardcoded `--muted-foreground`, so the
  `palette.off` prop never reached the unlit pixels.

### 3. The search palette has a scrollbar that should not be there.

`.cmdk-list` scrolls with the platform's native scrollbar, and it renders as a
bright bar down the right edge of the panel. Give the list a styled, overlay
scrollbar or none at all. Check it in the Tauri host too, not only in the
browser — WebKitGTK draws scrollbars differently.

### 4. The palette needs a frosted, liquid-glass surface — and the design system has no such style at all.

This is the largest of the four and it is not only a palette fix. The owner
wants this material to **exist in the design system**, named, with rules for
where it applies.

**There is a hard conflict you must resolve deliberately, not silently.**
`docs/DESIGN_SYSTEM.md` currently says:

> Use faux glass: solid or semi-transparent designed surfaces with a hairline
> highlight, never `backdrop-filter` or blur.

and

> Do not use `backdrop-filter` in the shell or overlay.

That rule exists because this shell fights WebKitGTK compositing — DMABUF is
disabled, and `WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING=1` is a shipped hardware
opt-out for black blocks. The owner has now asked for frosted glass anyway, so
the rule is being changed, not broken by accident. Handle it properly:

- Decide whether the material is real `backdrop-filter` or a layered faux glass
  (stacked translucent grounds, hairline highlight, a noise or gradient veil).
- **Verify in the native host, not the browser preview.** A frosted panel that
  looks right in Chromium and produces a black rectangle in WebKitGTK is worse
  than no frosting. `npm run tauri dev`.
- Whichever way it goes, write a **new ADR** in `docs/decisions/` recording the
  material, where it may be used, and what it does under reduced transparency
  and on the compositing opt-out path. Never edit an existing ADR.
- Then add it to `docs/DESIGN_SYSTEM.md` as a real surface class beside
  `--bg-base` / `--bg-surface` / `--bg-elevated`, and correct the two lines
  quoted above so the document stops contradicting the product.

Sources to base the material on, in this order:

- **The donor repositories** — `docs/donors/README.md`,
  `docs/donors/BENCHMARK_MATRIX.md`, `docs/donors/CORE_EXECUTION_PLAN.md`.
- **The shadcn MCP.** Call `view_items_in_registries` and
  `get_item_examples_from_registries` before every `add`. Note: the MCP server
  dropped out mid-session on 2026-08-03; the `npx shadcn@latest` CLI worked
  throughout, so if the MCP is unavailable, say so and use the CLI rather than
  guessing at component APIs.
- **Your skills** — `impeccable` is the primary lifecycle for this work
  (`init`, direction, `shape`, `critique`, `audit`, `polish`). `shadcn` governs
  component work. Do not use `design-taste-frontend`; this is a
  settings-and-dashboard surface, which that skill explicitly excludes.

---

## Still open from the second pass

Nothing below was started, so none of it is half-finished.

- **Meeting capture waveform.** Still the old one. Screen `meeting`,
  `SCREENS.meeting` in `demo.js`. `live-waveform` and `waveform` are vendored
  and ready. Upstream `live-waveform` opens the microphone itself with
  `getUserMedia`; the prototype has no microphone and fakes levels through
  `orbEnvelope`, so port the bar geometry rather than the audio path.
- **The provider tile grid on AI Models.** Seven large tiles for what is one
  choice. This is the other half of the "dropdowns eat space" complaint.
  `combobox` and `native-select` are installed.
- **Four features never sketched**: assistant → desk handoff (deeper than the
  existing `handoff` screen), transcription mode, live subtitles, client
  conversation and documentation.
- **Documentation.** New ADRs for the row grammar and the matrix decision, plus
  the frosted-material ADR above. Then `docs/DESIGN_SYSTEM.md`, the prototype
  README's pass log, `CHANGELOG.md`, and a `spec-sync` run.
- **Validation was never run this pass**: `npm run build`, `npm test` (154 tests
  were green before), `cd src-tauri && cargo test`, and
  `node ~/.claude/skills/impeccable/scripts/detect.mjs --json <files>`.

---

## Boundaries

- `src/components/settings/`, `src/components/areas/`, `SettingsWindow.tsx` and
  `src-tauri/` stay untouched. Owner's instruction.
- The prototype is the stage. Everything visible goes there. What vanilla cannot
  show honestly gets named in the prototype and pointed at `/component-lab`
  (`src/windows/ComponentLabWindow.tsx`, `src/lab/`). The productive path is not
  the subject of this work — do not adapt vendored components to the native
  runtime contract; that was tried and reverted as out of scope.
- Every foreign component moves onto WordScript tokens. Tokens live in
  `src/styles/globals.css`; the prototype's own are in `demo.css`.
- Never bypass the Husky pre-commit hooks.
- ADRs are append-only. New file, never an edit.
- Known open detector hit, deliberately untouched: `--ease-spring` in
  `globals.css` is bounce easing, defined and never used.

## ADRs this pass must respect

- **0043** — the orchestrator has one voice and that voice has a body (orb ≠ bars)
- **0048** — light mode is not the dark one inverted
- **0049** — the orb has four states and none of them pulses
- **0050** — the keyboard layer and what only Rust can grant it
