# 0115: A model name is a dated row in one catalogue, and neither runtime spells it alone

Date: 2026-08-11
Status: Accepted (planning direction; not implemented). Answers the question
`docs/PROVIDERS.md` open disagreement 5 asks and does not answer.

## Context

A model id lives in three places in this tree today, and nothing checks them
against each other.

- **Rust**, as literals: `DEFAULT_CORRECTION_MODEL` and `DEFAULT_AGENT_MODEL` in
  `core/config.rs`, `DEFAULT_LOCAL_AGENT_MODEL` beside them, and the tier and
  profile tables in `groq.rs` and `local_preview.rs`.
- **The drawing**, as literals: `LANES[lane].jobs[job].model` and `.models[]` in
  `src/screens/data.ts`, plus the installed-model lists in `Models.tsx` and
  `Onboarding.tsx`, plus `Cartesia Sonic-3` in `Agents.tsx` and
  `AgentOverlay.tsx`, plus `whisper-large-v3` in `NoteSettings.tsx`.
- **This survey**, as dated prose tables in `docs/PROVIDERS.md`.

**They have already drifted, and the survey says so about itself.** Open
disagreement 5 records that the drawn lane defaults are a generation behind —
`claude-sonnet-4-6` and `claude-opus-4-7` where the vendor now serves
`claude-sonnet-5` and `claude-opus-5` — and ends with the observation that this
*"is an argument about **where model names should live** rather than about these
particular strings."* It leaves the argument open. No step on
`docs/tracks/speech-track-plan.md` claimed it.

**The scale is about to change by an order of magnitude.** The build-out is ten
drawn vendors (ADR 0096) and the survey now carries seven more. Fourteen
synthesis candidates exist where there were seven. Each vendor ships several
models, renames them on its own schedule, and deprecates them without asking —
MiniMax's `speech-02-hd` became legacy between two releases, and OpenAI's
`gpt-4o-mini-tts` carries a date suffix on one lane and not on another.

**A hand-mirrored pair is the wrong tool at this size, and this repo already
knows the difference.** `ProviderCapabilities` is mirrored by hand into
`src/types/providers.ts` and that works, because it is one small struct that
changes when a contract changes. Hundreds of model rows across eighteen vendors
that change on somebody else's calendar are not that. **The repo also already
has the right tool**: `src-tauri/tests/fixtures/regression_transcripts.json`
with its `.schema.json` beside it, loaded by `core::regression_corpus` through
`include_str!` behind a `CORPUS_VERSION` constant.

## Decision

**Model identity moves into one versioned, checked-in data file**, and both
runtimes read it rather than spelling names themselves. A row carries the
vendor, the model id, the role it serves, what the vendor documents about
streaming, the languages, **and the source and read-date that
`docs/PROVIDERS.md`'s maintenance rule already requires of every row it
publishes.**

**One file, two readers, one test.** Rust loads it with `include_str!` behind a
version constant, the way the regression corpus is loaded. TypeScript imports
the same file. **A test holds the mirror**, which is the pattern the donor
established and this repo adopted for `preload.js`'s mirrored tuples: *"with a
test guarding the copy."*

**Every lane keeps a free-typed model id beside the catalogue list.** A
catalogue is a snapshot and is wrong the moment a vendor ships. An enterprise
deployment name is not in any catalogue by construction (ADR 0106's Azure
finding), a self-hosted server's model list belongs to whoever runs it, and a
user who wants yesterday's release should not have to wait for this repo. The
donor marks every enterprise lane `allowCustomModelId: true` and ships Azure
with no list at all; the shape is **a curated list plus a typed field**, not one
or the other.

**The catalogue is not `ModelCapabilities`, and collapsing them is the mistake
to avoid.** The catalogue records **what a vendor's documentation says**,
refreshed by re-reading that documentation. `ModelCapabilities` records **what
an adapter asserts** at the point its code was written, held to the registry by
a test. They will disagree in the gap between *catalogued* and *adapted*, and
that gap is exactly what `ModelSupport::Unknown` exists to express: a model this
build has catalogued but has no adapter for answers `unknown`, never
`supported`. **Deriving one from the other would let a documentation claim
become a runtime promise**, which is the shape of the error ADR 0106 found when
a mirror was described as a guard.

## Consequences

- **After this, adding a model is a data row.** *Take Bland Speech v3* stops
  being an edit in two languages and becomes a line with a date and a source —
  which is the question that produced this record.
- **The drawn `models[]` arrays change shape**, so the change reaches the
  gallery first (ADR 0057). ADR 0110 already flagged this consequence in general
  terms when it put a capability on the model axis.
- **The stale ids in `data.ts` are deliberately not corrected by hand.** Fixing
  them now is the same work twice, at the place the catalogue replaces. Open
  disagreement 5 stays open and now names its answer.
- **`docs/PROVIDERS.md` does not become the catalogue and is not replaced by
  it.** The prose keeps what a data row cannot carry: why a lane behaves as it
  does, what a vendor does not serve, and what was read but not verified. Its
  model tables become the catalogue's source rows rather than a second copy.
- **The file format, the path and any generation tooling are left to whoever
  builds it.** A1 left the registry's internal shape open the same way, and the
  step landed smaller for it.
- **A row without a source and a date does not belong in the file.** That rule
  is worth a test, because it is the rule this repo's survey already holds
  itself to in prose and nothing enforces.
