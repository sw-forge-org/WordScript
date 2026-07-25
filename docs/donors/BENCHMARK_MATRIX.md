# WordScript Benchmark Matrix

Frozen: 2026-06-10

> This is historical reference material, not the active product plan. Current
> direction lives in [VISION.md](../VISION.md), [ROADMAP.md](../ROADMAP.md), and
> [ARCHITECTURE.md](../ARCHITECTURE.md).

## Purpose

This matrix records the open-source dictation and desktop-utility references
used to shape WordScript. It answers which repositories are useful for a given
owning surface and prevents unfocused donor browsing.

## WordScript Guardrails

- Tauri/Rust remains the runtime core.
- V1 is trigger, capture, transcription, transform, insertion, recovery, and
  diagnostics.
- Cloud-first BYOK is the default path; local runtime is important but not the
  sole product path.
- Windows and macOS are Tier 1 targets; Linux X11 is preview and Wayland is
  experimental.
- Notes, search, sync, MCP, API, and assistant scope follow a stable core.

## Reference Shortlist

| Reference | Primary value |
| --- | --- |
| Handy | typed runtime coordination, history, cross-platform dictation |
| openwhispr | provider modes, platform expansion, settings architecture |
| voxtype | Linux insertion, engine abstraction, Wayland fallbacks |
| hyprwhspr | Linux hybrid runtime and setup separation |
| chirp-stt | minimal Windows local-first dictation |
| VoiceInk | macOS product polish, dictionary, work modes |
| FluidVoice | low-latency overlay, preview, command-mode thinking |
| vocalinux | Linux support tiers, installer realism, recovery messaging |
| Whisper-Input-Next | floating preview and two-pass recognition patterns |
| OpenSuperWhisper | macOS hold-to-record patterns |

The first active reading wave was intentionally narrower: Handy, openwhispr,
voxtype, hyprwhspr, chirp-stt, VoiceInk, and FluidVoice.

## UI and Utility References

For shell, settings, and keyboard-first utility patterns, the frozen shortlist
also includes Ice, MonitorControl, Clipy, raycast/extensions, massCode, Zed,
AeroSpace, Spacedrive, Mullvad VPN, Beekeeper Studio, Standard Notes, UTM,
darwin-ui, desktop-ui, and kitlib's Tauri app template. These are style and
interaction references only; they must not turn WordScript into an IDE, file
manager, VPN, or simulated operating system.

## Donor Mapping

| WordScript area | Primary references | Why |
| --- | --- | --- |
| Runtime kernel | Handy, voxtype, vocalinux | serialized flow, output modes, recovery honesty |
| Linux X11/Wayland | voxtype, hyprwhspr, vocalinux | insertion drivers, hybrid integration, support guidance |
| Windows | Handy, chirp-stt | cross-platform ownership and local Windows path |
| macOS product quality | VoiceInk, FluidVoice, OpenSuperWhisper | utility polish, dictionary, preview, hold-to-record |
| BYOK and providers | openwhispr, hyprwhspr, FluidVoice | provider modes and pragmatic hybrid paths |
| Profiles and text rules | VoiceInk, Handy, voxtype | dictionary, replacement, and work-mode patterns |
| Notes and sync later | openwhispr, voxtype | long-form, export, and platform direction |
| Assistant scope later | openwhispr, FluidVoice, VoiceInk | intent and command-mode patterns |

## Historical Staging

1. Stabilize the kernel: sessions, providers, Linux insertion, local preview,
   history, and profiles.
2. Expand provider and profile foundations: work modes, preview/controlled
   commit, production providers, and local runtime productization.
3. Add guided setup, permissions, and packaging.
4. Consider long-form, notes, search, sync, API, and MCP only after V1.
5. Consider assistant or computer-use scope last.

## Reading Rule

Read donor code along the owning WordScript surface. Extract a pattern, decide
whether it fits the current contract, implement the smallest native slice, and
validate it before moving to another system. Donor repositories are references,
not architecture to copy wholesale.
