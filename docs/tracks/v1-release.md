# The V1 release track

Opened 2026-08-17. **Open.** Both the orientation page and the sequence — start
a session here.

Owns **ADR 0197–0202**. Grep the whole tree before claiming a number, not just
`docs/decisions/`: eight tracks share `main` and a number is cited in source
before its file lands.

## The one question

**Can somebody who did not build WordScript get it, install it, and dictate with
it?**

Today the answer is no, and the shipped artifact is `npm run tauri dev` from
this repository. Everything on this page exists to turn that *no* into a reading
somebody can take — gate by gate, with a date and a piece of evidence — instead
of a feeling about how close it is.

**This is a measuring instrument, not a build queue.** A gate here is closed by
work that mostly lives in other tracks. What this page owns is *knowing where
the product stands*, and one gate nobody else will close (Stage A).

## What this page is, and the three it is not

| Not this | Where it lives |
|---|---|
| The phase list — which capability belongs to which phase | [`../ROADMAP.md`](../ROADMAP.md) |
| The product state — what is wired, drawn, or open today | [`../STATUS.md`](../STATUS.md) |
| The build procedure — the matrix, the artifacts, the checks | [`../RELEASE_RUNBOOK.md`](../RELEASE_RUNBOOK.md) |

**The gate list moves here, and the runbook links to it.** The runbook carried
*Gates Before the First Public Release* as seven unstated bullets — a list with
no state per row, which is a list you cannot take a reading off. It becomes one
list with one home, per
[ADR 0123](../decisions/0123-a-fact-has-one-list-and-a-track-is-a-directory-not-a-naming-convention.md).
If you find a second copy, it is drift.

## What "delivered" means

A gate you cannot state is a gate you cannot close, so the target is written
down first. **WordScript is delivered when all five hold:**

1. **It installs on the three platforms it already bundles for.** `nsis`, `dmg`,
   `appimage` and `deb` are declared in `src-tauri/tauri.conf.json`.
2. **The download can be trusted** — signed, or with a stated and honest trust
   path where it is not.
3. **A first run reaches a first dictation** without the new user having to find
   Diagnostics.
4. **The app claims only what it can do.** No surface offers a control that does
   nothing.
5. **The next version can reach the person who installed this one**, under
   semantics stated before the first release rather than after it.

## The board

**State vocabulary**, and it is deliberately narrow:

- **closed** — measured, with the evidence named in the row.
- **open** — the work exists and is not done.
- **not started** — nothing in the tree addresses it; verified, not assumed.
- **owner** — a decision, not work. It closes when Felix says so.

| # | Gate | State | What closes it | Where the work lives |
|---|---|---|---|---|
| **G1** | Transcription is dependable outside `General Writing` | **open** | A re-measurement against real dictation. The mechanical cause is fixed (ADR 0015/0016); the result was never re-measured | [`core-hardening.md`](core-hardening.md), ROADMAP Phase 7 |
| **G2** | A guided path from install to first dictation | **open** | Ordered onboarding for microphone, accessibility, credential or local setup, trigger, test dictation | ROADMAP Phase 6 |
| **G3** | Platform signing and a trust path | **not started** | Certificates, notarization, and a stated path where a platform is left unsigned | this track's owner decision, then packaging |
| **G4** | Updater semantics, decided before the first release | **not started** | A decision on what an update is here, then the mechanism | this track |
| **G5** | Linux packaging without the `linuxdeploy` failure | **open** | A build-matrix run whose AppImage step completes | [`../RELEASE_RUNBOOK.md`](../RELEASE_RUNBOOK.md) |
| **G6** | A reviewed release-note, tag and promotion process | **open** | The runbook has the procedure; the notes ADR 0037 obliges are unwritten | this track, with G10 |
| **G7** | The decision to promote beyond internal draft handoffs | **owner** | Felix says the workflow publishes | — |
| **G8** | The surface claims only what it can do | **open — this track builds it** | Stage A below: Developer Mode, one registry, off by default | this track |
| **G9** | The compatibility shapes go out before the first release, not after | **open** | ADR 0112's list, executed. **The window closes with the first release** — see below | this track raises it; the config is core's |
| **G10** | The identifier change is in the release notes | **open** | ADR 0037's two consequences written into the first release's notes | this track, with G6 |
| **G11** | `main` is continuously validated | **open** | CI runs on `pull_request` and `workflow_dispatch` only; the `push: main` trigger is off | this track's owner decision |
| **G12** | Distribution meets the licence it ships under | **not started** | AGPL-3.0 source offer and third-party notices in the artifact | this track |
| **G13** | The provider stack behind the surface is one lane wide | **open** | Groq is the only integrated cloud lane and it cannot stream | [`speech-track-plan.md`](speech-track-plan.md), ROADMAP Phases 4–5 |

### The three rows that are not in the runbook, and why each is here

**G9 — the compatibility window closes exactly once.**
[ADR 0112](../decisions/0112-a-migration-with-no-installation-behind-it-is-ballast-and-the-import-door-is-not-the-config-door.md)
records that the config still carries shapes nothing writes — a legacy plaintext
key field, millisecond timeout fields, a global `auto_paste`, two schema gates
with their migration bodies, a pre-profile text-rules reader, two retired
secret-store entry names — and the argument for removing them is that **no
published versioned release exists**, so they serve exactly one developer
machine. `package.json` and `tauri.conf.json` both read `0.2.2-alpha` and
nothing is published, so the argument still holds. **It stops holding the day
somebody installs a version**: from then on every one of those shapes is a real
compatibility obligation to a real install, and removing it becomes a migration
rather than a deletion. This gate is cheap now and permanent later, which is why
it is on the board rather than in a backlog.

**G12 — an AGPL app that is actually distributed owes things a private build
does not.** `LICENSE` is AGPL-3.0. Nothing is distributed today, so nothing is
owed today. On the first public artifact the source offer becomes an obligation,
and so do the notices for what is vendored: `src/components/ui/heat-map.tsx` is
MIT from `@uiwjs/react-heat-map`, and `vendor/global-hotkey` is `Apache-2.0 OR
MIT` with all three licence files present in the tree. Both are compatible and
neither is automatic — a notice that exists in the repository is not a notice
that ships in the bundle.

**G13 — the lane behind the surface.** The runbook's gates are about the
artifact; this one is about whether the artifact is worth installing. One cloud
lane, no streaming, no synthesis. It is the speech track's whole subject and is
listed here only so the board is not read as *four packaging items and we ship*.

### What G4 has to decide before it can be built

There is **no updater in this tree** — no `tauri-plugin-updater` in
`src-tauri/Cargo.toml`, no `updater` block and no `createUpdaterArtifacts` in
`src-tauri/tauri.conf.json`. What exists is `core::updates::check_app_update`, a
poll of GitHub's latest-release endpoint that reports honestly that no published
release exists.

**Those are two different products and the board must not collapse them.** A
check that tells you a version exists is not an update that installs it. The
decision this gate owes is which of the three WordScript ships first: a check
that points at a download page, a full in-place updater with its signing key, or
a package manager's update path on the platforms that have one. **Decide before
the first release**, because the first release is what defines what the second
one is allowed to be.

## How to take the reading

The board is only worth having if it can be re-measured rather than remembered.
Each of these is a command or a file, and it answers exactly one row.

| Row | The reading |
|---|---|
| G3 | `grep -n "signingIdentity\|notarize" src-tauri/tauri.conf.json` — empty means not started |
| G4 | `grep -n "updater" src-tauri/Cargo.toml src-tauri/tauri.conf.json` — empty means not started |
| G5 | The last `Release Build-Up Matrix` run's Linux step |
| G8 | `grep -rn "<PreviewBanner\|<PreviewTag" src/ --include="*.tsx" \| grep -v '\.test\.' \| wc -l` against the registry's entry count |
| G9 | ADR 0112's list, item by item, against `src-tauri/src/core/config.rs` |
| G11 | `head -10 .github/workflows/ci.yml` — the trigger list |
| G12 | The bundle's own contents, not the repository's |
| G13 | [`../PROVIDERS.md`](../PROVIDERS.md) and the registered adapters |

**Re-read the board before reporting release readiness**, and put the date on
it. A gate row that has not been re-measured since it was written is a claim
about the past.

## Stage A — Developer Mode, the preview filter (gate G8)

**The one gate this track closes with its own hands**, because it is the only
one that is about the *release* rather than about a capability: a build a
stranger installs must open on what is real, and this product draws a great deal
that is not.

The product marks unbuilt work in three shapes. **Counted 2026-08-17: 20
`<PreviewBanner>` literals and 13 `<PreviewTag>` literals across 18 files,
excluding tests and the two definition files; `ia.tsx` on its own declares seven
banners through `saysSo()` and four `preview: true` rows.**

- `PreviewBanner` — a chip and one line at the top of a screen.
- `PreviewTag` — a chip beside a single row's label
  ([ADR 0161](../decisions/0161-a-drawn-row-says-so-beside-its-own-label-and-the-sketch-is-the-deliverable.md)).
- `SurfaceEntry.preview` in [`../../src/windows/workspace/ia.tsx`](../../src/windows/workspace/ia.tsx),
  which puts a tag on the nav row and is why Context carries one in the sidebar.

Every one is spelled where it is drawn. **That is the defect this stage takes**:
a switch implemented as three dozen inline conditions is wrong within one
release, because the next preview surface will not know it exists.

- **A1. One registry, one file, and a preview surface registers itself in it.**
  Id, what it is, which phase or track it waits on. Read by the three marker
  components and by the nav; no component asks the config directly and no screen
  carries an inline `if`. **Done when** all 64 sites read the registry and a new
  preview surface has exactly one place to declare itself.
- **A2. `developer_mode` is a config field and a Settings row**, in `General`,
  where the app-wide preferences already are. Written through the same `patch`
  every other discrete control uses. **Default off** — the build a stranger
  installs must open on what is real, which is the whole reason this is a
  release gate and not a convenience.
- **A3. A test walks `src/` and fails on a marker spelled outside the
  registry.** The instrument shape the model catalogue already has
  ([ADR 0115](../decisions/0115-a-model-name-is-a-dated-row-in-one-catalogue-and-neither-runtime-spells-it-alone.md)),
  for the same reason: a rule that lives only in a review comment lasts one
  release.
- **A4. The two named badges keep their content and change their route.** The
  `Context` tag in the sidebar and the `Meetings and uploads · Preview` line in
  the calendar's day tooltip read exactly as they read now; they stop being
  unconditional and become registry entries.

**A5 is the decision this stage cannot skip: what does *off* mean for a screen
that is preview all the way down.** Four surfaces are drawn and not wired —
Context, Notes & Meetings, Agents, Integrations. Hiding their banner while
leaving the drawing in the nav is the **fake-readiness defect `CLAUDE.md`
forbids in as many words**: a stranger opens Agents, sets something, and nothing
happens. The recommendation is that **off removes the surface** — nav entry and
route together — while a surface that is wired *in part* keeps its screen and
loses only its marker. That splits the registry into two kinds of entry, and the
split is the substance of the ADR.

**Watch:** the gallery (`src/windows/gallery/`) is the acceptance surface for
drawn screens
([ADR 0055](../decisions/0055-the-gallery-is-where-the-port-is-judged-and-it-is-one-route.md))
and must keep seeing every one of them whatever this switch says. The filter is
the workspace's, never the gallery's.

## Status

| Row | State | Last measured |
|---|---|---|
| G1 · transcription outside `General Writing` | open | 2026-08-17, from [`../STATUS.md`](../STATUS.md) |
| G2 · guided path to first dictation | open | 2026-08-17, from [`../ROADMAP.md`](../ROADMAP.md) Phase 6 |
| G3 · signing and trust path | **not started** | 2026-08-17, `tauri.conf.json` |
| G4 · updater semantics | **not started** | 2026-08-17, `Cargo.toml` + `tauri.conf.json` |
| G5 · Linux packaging | open | 2026-08-17, from the runbook |
| G6 · release-note and promotion process | open | 2026-08-17 |
| G7 · promote beyond draft handoffs | **owner** | — |
| G8 · the surface claims only what it can do | open — Stage A below | 2026-08-17, 33 marker literals in 18 files |
| G9 · compatibility shapes out before the first release | open | 2026-08-17, version `0.2.2-alpha`, nothing published |
| G10 · identifier change in the release notes | open | 2026-08-17 |
| G11 · `main` continuously validated | open | 2026-08-17, `ci.yml` triggers |
| G12 · licence obligations in the artifact | **not started** | 2026-08-17, AGPL-3.0 + two vendored trees |
| G13 · one lane wide | open | 2026-08-17, from [`../PROVIDERS.md`](../PROVIDERS.md) |
| **A1** | The preview flag registry | open |
| **A2** | `developer_mode` in config and in `General` | open |
| **A3** | The walker test | open |
| **A4** | The two named badges route through the filter | open |
| **A5** | What *off* means for a fully-preview surface | **decision owed** |

## Validation

Stage A is frontend and config: `npm test` and `npm run build`, plus
`cd src-tauri && cargo test` for the config field. It changes what the workspace
draws in the host, so check it in the native host rather than in browser preview
alone.

**Taking a reading is not a change and must move nothing.** A session that
re-measures the board proves the suite did not move rather than that it passes.
