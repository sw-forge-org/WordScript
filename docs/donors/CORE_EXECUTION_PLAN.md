# WordScript Core Execution Plan

Frozen: 2026-06-10

> This historical plan informed the current roadmap. It is retained for donor
> rationale, not as an active implementation checklist. See
> [ROADMAP.md](../ROADMAP.md) for current phase planning.

## Core Definition

The durable WordScript path is trigger, capture, transcription, transform,
insertion, recovery, and history/diagnostics/settings contracts. Later notes,
MCP, sync, and assistant features have no value if this path is unreliable.

## Donor Reading Method

Read only the owning donor files, identify the matching WordScript surface,
build the smallest real runtime slice, run tests and builds, then move on. Do
not develop several new core systems in parallel and do not create UI options
before a native path exists.

### Primary Donor Files

- Handy: `transcription_coordinator.rs` and history commands
- voxtype: output module and defaults
- openwhispr: settings store, enterprise provider helper, and audio manager
- hyprwhspr: CLI/runtime setup boundary
- VoiceInk: dictionary service and power-mode session manager
- FluidVoice: transcription history and command-mode service

## Historical Slices

| Slice | Objective | Outcome |
| --- | --- | --- |
| 1 | serialize runtime coordination | implemented through native session ownership |
| 2 | generalize the provider contract | implemented; Groq is first provider |
| 3 | harden Linux insertion | implemented driver chain and recovery diagnostics |
| 4 | introduce local STT preview | implemented as `local_preview` local runtime lane |
| 5 | make history and diagnostics core | implemented persistence, retry, filters, export, and logs |
| 6 | introduce local text profiles | implemented native profiles, migration, and profile-aware UI |
| 7 | turn profiles into work modes | partially implemented; current contract flows through runtime and history |
| 8 | add live preview and controlled commit | partial `clipboard_only` preview implemented; full scope remains planned |
| 9 | production provider stack | planned second provider and clearer mode system |
| 10 | productize local runtime | preflight implemented; model management remains planned |
| 11 | guide setup, permissions, packaging | partial preflight implemented; installer-to-first-dictation remains planned |

## Slice Principles

### Runtime Coordination

One native owner serializes start, stop, pause, abort, processing completion,
and error transitions. The UI and tray observe derived state and do not create
parallel orchestration.

### Providers

Every provider uses the shared request, response, capability, and error
contracts. Cloud, local, and future self-hosted modes are distinct semantics;
secrets stay outside JSON configuration.

### Insertion

Insertion has explicit platform drivers and typed outcomes. `type`, `paste`,
`clipboard_only`, and scratchpad recovery are different product behaviors.
Linux diagnostics name the actual unavailable helper or permission boundary.

### Local Runtime

The local lane has the same response contract as cloud transcription. It keeps
STT profile, decode, prompt-bias, and cleanup configuration explicit and shows
native setup truth rather than a UI approximation.

### History and Profiles

History retains raw and transformed text, insertion outcome, provider, profile,
and errors. Retry is a real reprocess path. Profiles package context, dictionary,
snippets, and later work-mode defaults; they are manual, explicit work modes
before any automatic activation is considered.

## Deferred Scope

Do not treat chat, accounts, sync, hosted workspaces, long-form notes, broad
assistant behavior, or browser/computer use as core work. They require a stable
dictation path, clear provider ownership, durable history, trustworthy recovery,
and an explicit product decision.

## Final Rule

Use donors to improve WordScript's active native contract. Never import their
scope wholesale, replace WordScript ownership with their architecture, or let a
future feature bypass the validated core path.
