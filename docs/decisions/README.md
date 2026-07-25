# Architecture Decision Records

Architecture Decision Records (ADRs) are small, dated, immutable records of
individual decisions. They complement the living [architecture overview](../ARCHITECTURE.md)
and [product direction](../VISION.md); neither overview replaces ADRs.

## When to Create an ADR

Create one for a consequential, difficult-to-reverse decision: a runtime or
data contract change, provider strategy, licensing, hosting, window-chrome
strategy, authentication, or sync direction. Do not create ADRs for routine
code style or small implementation details.

## Format

Use `NNNN-short-title.md`, in ascending order. Never renumber an existing ADR.

```md
# NNNN: Title

Date: YYYY-MM-DD
Status: Proposed | Accepted | Superseded by NNNN

## Context

## Decision

## Consequences
```

## Rules

- ADRs are never rewritten retroactively.
- A changed decision requires a new ADR that marks the prior one as superseded.
- `spec-sync` may identify a decision that needs human review, but it does not
  create an ADR without explicit confirmation.

## Existing ADRs

- [0001](0001-tauri-rust-als-runtime-owner.md): Tauri/Rust owns product runtime behavior.
- [0002](0002-cloud-first-groq-byok.md): cloud-first Groq BYOK provider strategy.
- [0003](0003-native-fensterdekorationen.md): native window decorations on every platform.
- [0004](0004-agpl-3-0-lizenz.md): AGPL-3.0 licensing.
- [0005](0005-local-first-sync-richtung.md): optional WordScript-owned local-first sync direction.
- [0006](0006-rust-owns-the-shortcut-contract.md): one Rust module owns the
  shortcut token vocabulary, display strings and validity rules; the UI carries
  no key table.
- [0007](0007-capability-matrix-is-measured-not-assumed.md): the shortcut
  capability matrix is derived from session facts plus measured press/release
  evidence, never from a per-OS assumption about hold to talk.
- [0008](0008-double-tap-is-the-default-activation-mode.md): `double_tap` is the
  default activation mode, because the default triggers are modifier-only;
  existing configs keep their chosen value.
- [0009](0009-modifier-only-shortcuts-are-observed-not-grabbed.md): a
  modifier-only shortcut is observed through the raw key stream instead of
  grabbed, so the modifier keeps working for everyone else; a shortcut with a real
  key is still grabbed.
