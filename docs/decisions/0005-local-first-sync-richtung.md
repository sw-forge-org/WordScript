# 0005: Local-First Sync Direction

Date: 2026-06-20
Status: Accepted (planning direction; not implemented)

## Context

Future sync, account, and workspace features require an ownership model. The
options were an external mandatory hub, peer-to-peer as the primary model, or
an optional WordScript-owned layer built on local data.

## Decision

If WordScript later adds sync, accounts, or hosted workspaces, use an optional
WordScript-owned local-first sync layer. The core dictation path remains usable
without an account. Do not make peer-to-peer the primary model or require an
external hub.

Profiles, history, and future voice workspaces remain WordScript-owned. Sync
and provider transport remain separate decisions; provider traffic is not
implicitly routed through a WordScript proxy.

## Consequences

- This is planning direction, not an active feature. UI and documentation must
  not present accounts, sync, or cloud workspaces as current product reality.
- Early sync candidates are profiles, dictionaries, snippets, selected settings,
  and later optional history or workspaces.
- Provider credentials, including the Groq key, remain local in the OS secret
  store and are not implicit sync data.
- A changed direction requires a new ADR that supersedes this one.
