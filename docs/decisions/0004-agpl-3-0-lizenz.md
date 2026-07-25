# 0004: AGPL-3.0 License

Date: 2026-06-17
Status: Accepted

## Context

WordScript was initially MIT-licensed. Its community-build position under SW
forge and its GPL donor references required an explicit licensing choice:
retain permissive MIT terms or adopt copyleft that also covers network use.

## Decision

Adopt AGPL-3.0 as of 2026-06-17. `LICENSE` and the README license section are
the authoritative public license text and notice.

## Consequences

- Derivatives offered as a network service must make corresponding source
  available under the license terms.
- GPL donor projects remain design and UX references, not copy-and-paste code
  sources for the active implementation.
- [REFERENCE.md](../REFERENCE.md) lists the license as a project constant.
- This ADR records the decision; it does not replace `LICENSE`.
