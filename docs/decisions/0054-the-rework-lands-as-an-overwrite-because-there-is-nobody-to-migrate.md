# 0054: The rework lands as an overwrite, because there is nobody to migrate

Date: 2026-08-04
Status: Accepted

## Context

`../archive/plans/settings-rework.md` was written as a migration. §4.3 rule 6 requires that
*"deep links survive — every current area id keeps working via an alias map, on
the `SECTION_ALIASES` pattern the donor uses"*. §13's mitigation for a stalled
rework is that *"old and new sections coexist behind the alias map"*, and Stage 4
is ordered section by section so the two surfaces can stand side by side while
the migration runs.

Every one of those provisions buys the same thing: continuity for a user who
already knows where a control is, and a safe half-state for a rework that stops
in the middle. Both are real costs when they are needed — an alias map is a
second routing table that must be kept true, and a coexisting surface means two
implementations of every screen the migration has reached, plus a rule for which
of them wins.

**WordScript is `0.2.2-alpha`, is installed by nobody, and is distributed to
nobody.** There is no user whose habit is being protected, no deep link in
anybody's notes, and no released build whose settings ids appear in a support
thread. The owner confirmed this on 2026-08-04 as the basis for the delivery
decision.

The prototype is fourteen passes deep and is the accepted shape of the whole
surface (Stage 0, accepted 2026-08-02). What is left is not a design question
that has to be discovered screen by screen against a live surface; it is a port
of a settled design.

## Decision

**The settings rework overwrites the shipped surface. It does not migrate it.**

1. **No alias map is built.** §4.3 rule 6 is withdrawn. Area ids are replaced,
   not aliased. The one exception is the semantic anchor mechanism that already
   exists — `capture.auto_stop` in `src/lib/settingsAnchors.ts`, which the
   overlay deep-links through — because that is a runtime contract with a native
   caller, not a convenience for a human's habit. Every anchor stays resolvable;
   the mapping file is updated when a control moves.
2. **The old and new surfaces do not coexist.** A replaced area is deleted in
   the same commit that replaces it. There is no period in which two components
   render the same section, and therefore no rule about which one wins.
3. **The delivery order is free to follow the design rather than the risk.**
   The plan's section-by-section ordering "by pain" stays a sensible working
   order, but it is no longer a safety mechanism, so a leg may take a whole
   group at once where that produces a better seam.

This decision governs delivery only. It moves no design decision, relaxes no
runtime rule, and does not touch ADR 0018, 0019, 0020, 0024 or 0025 — the
redesign still moves controls and never ownership.

## Consequences

- The migration risk in §13 — *"the rework stalls half-migrated"* — is answered
  by the fact that an unfinished port is a broken alpha, not a broken product.
  That is an acceptable state here and would not be after the first release.
- **This decision expires at the first distributed build.** Once a build exists
  that someone else installed, the next surface change is a migration again and
  the alias question returns with it. Whoever ships that build owes a check that
  no id it exposes is being renamed out from under it.
- Test coverage carries what the coexistence would have carried. A section
  ported without tests has no safety net at all under this decision, which makes
  the test obligation stricter than the plan's, not looser.
- `PermissionsArea.tsx` and the `glass*` removals — already identified as dead
  code in §2.2 and §5.3 — are deletions rather than deprecations. Nothing waits
  for a grace period that has no one to grant it to.
