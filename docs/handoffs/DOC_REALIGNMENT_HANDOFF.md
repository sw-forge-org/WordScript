# Hand-Off: Documentation Realignment

Status: **Completed 2026-07-24**

## Outcome

The repository documentation now follows the SW labs repository template and
uses American English throughout. The work established a lean consolidated
specification at `docs/spec/SPEC.md`, canonical agent instructions, ADRs,
known-issue records, templates, contribution and security guidance, staging,
GitHub templates, editor configuration, and repository hooks.

## Consolidated Documentation

- The active product documentation is `SPEC`, `VISION`, `ARCHITECTURE`,
  `STATUS`, `PLATFORMS`, `REFERENCE`, `DEVELOPMENT`, `ROADMAP`,
  `DESIGN_SYSTEM`, `RELEASE_RUNBOOK`, and `UI_UX_OVERHAUL_PLAN`.
- Product direction and architecture decisions are separated: living overview
  documents explain current behavior; append-only ADRs capture hard decisions.
- Known issues are editable diagnostic records. Historical implementation work
  belongs in `docs/handoffs/`; frozen comparisons belong in `docs/donors/`.
- The README is source-first and accurately distinguishes the development build
  from internal release build-up and future public distribution.

## Decisions Preserved

- Lean spec mode with `docs/spec/SPEC.md` as the authoritative contract.
- Tauri/Rust runtime ownership and typed UI/runtime contracts.
- Cloud-first Groq BYOK with a distinct local runtime lane.
- Native settings window decorations on all platforms.
- AGPL-3.0 licensing and optional future WordScript-owned local-first sync.

## Follow-Up

Future changes must update the relevant living document and use a new ADR for
an architectural decision. Use `spec-sync` for material contract drift. Do not
reintroduce per-commit narratives into architecture or status documents.
