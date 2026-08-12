# WordScript UI/UX Overhaul Plan

Status: 2026-07-25

> This is a consolidated record of the implemented UI direction and enduring
> rationale. Current rules live in [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md); runtime
> ownership lives in [ARCHITECTURE.md](../../ARCHITECTURE.md). Historical speculative
> code, CSS, and window-config sketches have been removed.

## Implemented Decisions

- Main settings and diagnostics windows use native decorations on every
  platform. There is no frameless main window, custom title bar, or fake traffic
  lights. [ADR 0003](../../decisions/0003-native-fensterdekorationen.md) is
  authoritative.
- The UI uses React 18, Tailwind CSS v4, shadcn/ui patterns, and existing CSS
  variables through `@theme inline`.
- Runtime truth remains native. React renders, configures, and diagnoses it;
  it does not create an alternate session, insert, recovery, or readiness model.
- The overlay is an undecorated transparent native window with compositor-safe
  faux glass. Main-window decoration rules do not apply to the overlay.
- Motion is restrained and immediate where WebKitGTK performance requires it.
  The former crossfade tab behavior is not part of the active UI.

## Target Experience

WordScript should feel like a precise desktop utility for writers: speak,
observe real state, recover safely, and return to work. It is neither a generic
web dashboard nor a simulated operating system. Calm hierarchy, readable
information density, native controls, and truthful platform guidance matter more
than visual novelty.

The immediate focus is the dictation core. Chat, Upload, Notes and Account are
visible preview layouts in the More group, but their sample/component-local
state is not product functionality. Runtime-backed chat, batch transcription,
meeting notes, accounts, sync and assistant actions remain future scope.

## Information Architecture

The current settings shell groups the active product areas:

| Group | Areas | Purpose |
| --- | --- | --- |
| Workspace | Home, History, Profiles | readiness, durable transcripts, profiles and text rules |
| Engine | Speech & AI, Modes, Capture, Overlay | configure and explain the native dictation path |
| System | Insert & Recovery, Diagnostics, About | delivery, logs, platform state, recovery and release truth |
| More | Chat, Upload, Notes, Account | explicitly labeled future-layout previews |

The sidebar provides orientation and profile context. Each area owns one
decision space and presents one dominant content surface. Diagnostics can open
as a dedicated utility window but retains the same vocabulary and decoration
model.

## Overlay Direction

The overlay remains small and purpose-built. It displays real recording,
processing, preview, result, error, and recovery states from native events. It
does not become a second full application.

The current `clipboard_only` processing preview is real and commits through the
normal native insert/history/session path. A full preview and controlled commit
flow for all delivery modes is planned in [ROADMAP.md](../../ROADMAP.md), Phase 3;
the UI must not simulate it before that runtime path exists.

On Linux, fixed host sizes, native parking, opacity, and compositor-safe CSS
are reliability requirements. Overlay placement is user intent only when it
comes from a real drag. See [REFERENCE.md](../../REFERENCE.md) for the overlay
constants and
[overlay-placement-persist.md](../../known-issues/overlay-placement-persist.md) for
the active placement constraints.

## Design Language

- Dark utility surfaces use clear background elevation, hairline borders, and
  modest radii rather than shadow-heavy cards.
- SW forge orange is a focused accent for capture, explicit selection, and
  meaningful attention.
- Typography uses a compact five-step scale and a four-point spacing rhythm.
- Status uses consistent dots, badges, and native error/recovery language.
- Cards organize one decision with its evidence and next action.
- Long lists remain stable while scrolling through containment and
  content-visibility utilities.

## Donor Boundaries

VoiceInk, FluidVoice, OpenSuperWhisper, and OpenWhispr are design and
information-architecture references. Menu-bar utilities, keyboard-first tools,
and desktop productivity shells are secondary pattern sources. They may inform
control language, spacing, recovery presentation, and navigation; they must not
turn WordScript into an IDE, file manager, VPN application, or web operating
system.

## Enduring UX Requirements

- Provider capability, local setup, and error details are native facts, not UI
  inferences from model names or configuration drafts.
- Local setup separates runner, model, cleanup endpoint, and cleanup model.
- Text profiles are explicit manual work modes; automatic activation remains
  future work unless the runtime contract supports it.
- The user can distinguish history, transient logs, preview text, scratchpad
  recovery, and final insertion outcome.
- Release surfaces distinguish internal build-up artifacts from published
  releases and working updates.
- Accessibility and platform limits receive visible next-step guidance rather
  than a generic success state.

## Future Work

The next UI work follows runtime maturity: controlled commit, clearer provider
modes, guided local setup, and installation-to-first-dictation onboarding. New
visual concepts require an implemented product contract and must be reflected in
[DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md), not accumulated here as code sketches.
