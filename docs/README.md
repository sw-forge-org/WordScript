# WordScript documentation

Status: 2026-08-12

**This page is the map. It is the only one** — the doc set used to be listed in
five places that disagreed with each other, and four of those now point here.

## Start here

| If you are | Read, in this order |
| --- | --- |
| New to the project | [`../README.md`](../README.md) → [`VISION.md`](VISION.md) → [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Setting up to build | [`DEVELOPMENT.md`](DEVELOPMENT.md) → [`PLATFORMS.md`](PLATFORMS.md) |
| **About to write code** | [`IMPLEMENTATION.md`](IMPLEMENTATION.md) → the track's own sequence → [`spec/SPEC.md`](spec/SPEC.md) |
| Asked what works today | [`STATUS.md`](STATUS.md) |
| Asked what is next | [`ROADMAP.md`](ROADMAP.md) |
| Chasing a bug with history | [`known-issues/`](known-issues/README.md) |
| Wondering why a rule exists | [`decisions/`](decisions/README.md) |

## The four kinds of document

The kind decides how a document may be changed, and getting this wrong is how
the set drifted in the first place.

| Kind | Rule | Where |
| --- | --- | --- |
| **Authoritative** | The contract. When an overview disagrees with it, the overview drifted | [`spec/SPEC.md`](spec/SPEC.md) |
| **Living** | Updated when product reality changes | the top-level docs below, [`known-issues/`](known-issues/), each track's sequence |
| **Append-only** | Never rewritten retroactively. A changed decision is a new record that supersedes the old one | [`decisions/`](decisions/), every track *record* |
| **Frozen** | Historical. Read for derivation, never as current truth | [`archive/`](archive/README.md), [`donors/`](donors/README.md), [`prototypes/`](prototypes/settings-rework/README.md) |

## The living set

| Document | Read it before |
| --- | --- |
| [`IMPLEMENTATION.md`](IMPLEMENTATION.md) | Starting any implementation session — it says which tracks are live and where each sequence is |
| [`spec/SPEC.md`](spec/SPEC.md) | Any runtime contract, session semantics or delivery mode |
| [`VISION.md`](VISION.md) | Arguing about scope, or the V1/V2 boundary |
| [`ROADMAP.md`](ROADMAP.md) | Asking what phase something belongs to. The canonical phase detail |
| [`STATUS.md`](STATUS.md) | Reporting what works, what is open, what is release-ready |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Module boundaries or the UI/runtime seam |
| [`DEVELOPMENT.md`](DEVELOPMENT.md) | Setup, or when unsure which validation a change needs |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Settings UI, tokens, motion, scroll and compositing behavior |
| [`PLATFORMS.md`](PLATFORMS.md) | Insert, recovery, shortcuts, capture, audio devices, Wayland, the Windows vendor patch |
| [`PROVIDERS.md`](PROVIDERS.md) | Any provider, lane, credential shape or model name — what a vendor serves, per row and per date |
| [`REFERENCE.md`](REFERENCE.md) | Overlay sizes and CSS invariants, provider lanes, mode semantics |
| [`RELEASE_RUNBOOK.md`](RELEASE_RUNBOOK.md) | Release build-up, `check_app_update`, AppImage packaging |

## The directories

| Directory | Holds | Kind |
| --- | --- | --- |
| [`spec/`](spec/SPEC.md) | The one authoritative contract | authoritative |
| [`decisions/`](decisions/README.md) | Architecture Decision Records, `NNNN-title.md`, never renumbered | append-only |
| [`known-issues/`](known-issues/README.md) | Living diagnostic records for open and resolved bugs. A resolved one stays, as the reference for its failure class | living |
| [`tracks/`](tracks/README.md) | The sequence and kick-off page of every **live** implementation track | living |
| [`archive/`](archive/README.md) | Closed tracks, spent plans, spent briefs, closed hand-off records | frozen |
| [`donors/`](donors/README.md) | Frozen comparison repositories and slice planning, captured 2026-06-10 | frozen |
| [`prototypes/`](prototypes/settings-rework/README.md) | The settings-rework demo GUI. **Read-only since 2026-08-04** (ADR 0057) — it is provenance, and the gallery is the source | frozen |

## Documentation outside this directory

| File | Purpose |
| --- | --- |
| [`../README.md`](../README.md) | Project overview, what works, how to run from source |
| [`../AGENTS.md`](../AGENTS.md) | The repo's agent instruction. `CLAUDE.md` is a filename symlink to it |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Branches, commits, review, what to update |
| [`../SECURITY.md`](../SECURITY.md) | Disclosure and secret handling |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Per-commit history. Product state does **not** belong here — that is `STATUS.md` |
| [`../staging/README.md`](../staging/README.md) | Intake for unstructured material awaiting consolidation |
| [`../.agents/README.md`](../.agents/README.md) | Why project-local agent skills do not exist yet |

## Rules for changing this set

- **Documentation set changes go in this file and nowhere else.** If you find a
  second list of documents, it is drift; replace it with a link here.
- **Product state belongs in [`STATUS.md`](STATUS.md)**, the spec drift date in
  the `Status:` line of [`spec/SPEC.md`](spec/SPEC.md), and per-commit history
  in [`../CHANGELOG.md`](../CHANGELOG.md). None of the three belongs in
  [`../AGENTS.md`](../AGENTS.md).
- **An ADR is never edited.** File a new one that supersedes it, and grep the
  whole tree for the next free number — three tracks file concurrently.
- **A new top-level document needs a narrower purpose than every entry above.**
  When it does not have one, it belongs inside an existing document.
- Drift check runs via the `spec-sync` skill.
