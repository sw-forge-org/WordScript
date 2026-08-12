# `staging/` Consolidation Area

`staging/` is temporary intake for unstructured material supplied to this
repository: documents, scripts, snippets, notes, exports, and external
references. It is not permanent storage.

## Purpose

Place material here before consolidating its useful content into the final
documentation, source, or configuration location. Delete the staging subfolder
once its contents are fully consolidated and reviewed. An empty `staging/`
means no consolidation work is pending.

## Rules

- Use one subfolder per topic or project: `staging/<topic-or-project>/...`.
  Never create a flat root-level file dump.
- Consolidation means integrating the useful result at its destination, not
  copying a source file unchanged somewhere else.
- When a subfolder is complete, delete the entire subfolder.
- When staging content is found, first group it, identify its owner, consolidate
  it, then delete it.

## Do Not Stage

- Final documentation, production code, or configuration
- Secrets, credentials, or `.env` values
- Material that belongs only to another repository

## WordScript Scope

Frozen donor references in `docs/donors/` and closed implementation records in
`docs/archive/` are already in their final location and do not belong here.
Neither does a document for work that is still running -- that belongs in
`docs/tracks/`, listed on `docs/IMPLEMENTATION.md`. The global staging principle
is defined by the shared SW labs agent guidance.
