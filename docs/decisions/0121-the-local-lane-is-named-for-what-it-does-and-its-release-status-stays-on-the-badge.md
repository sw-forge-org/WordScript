# 0121: The local lane is named for what it does, and its release status stays on the badge

Date: 2026-08-12
Status: Accepted. Does not supersede
[ADR 0067](0067-local-preview-is-treated-as-an-unpublished-provider-everywhere-it-is-offered.md),
whose presentation rule stands unchanged.

## Context

`local_preview` is not only a module name. It is the **serialized provider id**
written into `AppConfig.provider` and into every history row, the registry entry
id in `core/providers/registry.rs`, the `ProviderId` union member in
`src/types/providers.ts`, and the prefix of every profile id in the shape
`local-preview-{model}-{preset}`. 177 references across 43 files.

**The name was chosen to carry a status, not a description.** ADR 0067 records
the owner's instruction in his own words — *treat it just like the other
unpublished AI model providers everywhere they come up: preview badge, etc. —
because it's not fully implemented yet* — and made consistency the governing
property: the lane is presented as unpublished wherever it appears.

**That status is still literally true.** `docs/STATUS.md` carries *Phase 5 —
Local runtime as a first-class product option* as an open box, and names
automatic model management and pull/install as missing.

**But the lane is under construction right now**, which is the owner's position
on this record: the speech track is actively building it out, and naming a lane
after a release state it is in the middle of leaving makes the identifier stale
by design.

**There is a second, independent problem with the word.** *Preview* already
means something else in this product — `previewStaged`, `pendingResult` and the
result surface are the session pipeline's preview, and the runtime rules in
`CLAUDE.md` use the term that way. A provider id reading `local_preview` reads
as *a local preview of text*, which is not what it is.

## Decision

**The lane's identifier becomes `local`, everywhere it is spelled.** The module,
the struct, the constants, the `ProviderId` member, the registry id and the
profile prefix `local-preview-*` all follow. The registry entry's existing
`aliases: &["local"]` is what the id becomes, and the alias list empties.

**A release status belongs on the badge, not in an identifier.** ADR 0067's
mechanism was the preview badge on the surfaces that offer the lane, and that
mechanism is correct and untouched. Encoding the same status a *second* time, in
a string that is serialized into config and history, means the identifier has to
change when the status changes — which is precisely why this record exists. One
status, one place to state it.

**The preview badge stays until Phase 5 lands.** This record renames a lane; it
does not publish one. Every presentation rule ADR 0067 decided — inoperable
where a surface offers the lane, badged where a surface reports it — applies
unchanged to the lane now called `local`.

**No compatibility alias and no dual profile prefix.** The owner's instruction
is explicit: this is a development install and the stored data does not matter.
A5 removed every on-disk compatibility path days ago (ADR 0112), and adding one
back for a rename would reverse that decision to protect data nobody wants
protected.

## Consequences

- **Stored profile selections stop resolving, and that is harmless by
  construction.** `local_profile_selection_from_id` hard-strips the old prefix
  and returns `None`; the caller falls through to `request.model` and then to
  `"base"`. A stale `local_profile` or `provider_profile` degrades to the base
  model at the default preset — no error, no failed session.
- **Stored `provider: "local_preview"` values stop resolving** and
  `resolve_entry` returns its *not supported yet* error rather than silently
  choosing a lane. On a fresh or re-picked config this never arises; on a stale
  one the fix is picking the lane again.
- **ADR 0067 is not superseded and must not be read as retracted.** Its subject
  is how an unpublished lane is presented. Only the identifier it happened to
  name has changed.
- **The ADRs keep the old name.** Records are append-only, so 0002, 0015, 0065,
  0067, 0094, 0096, 0102, 0108 and 0115 continue to say `local_preview` and are
  correct as of their dates. The living documents — `ARCHITECTURE.md`,
  `DEVELOPMENT.md`, `PROVIDERS.md`, `REFERENCE.md`, `SPEC.md`, `STATUS.md`,
  `DESIGN_SYSTEM.md`, `ROADMAP.md`, `VISION.md`, `README.md` — move to the new
  name.
- **When Phase 5 lands, nothing gets renamed.** The badge comes off and the
  identifier stays, which is the property this record was written to buy.
