# 0007: The Shortcut Capability Matrix Is Measured, Not Assumed

Date: 2026-07-25
Status: Accepted

## Context

Slice S7 of the shortcut lane rebuild asks for one per-OS capability matrix
(target contract T12) that drives both the options the UI offers and what the
tests assert. The obvious shape for such a matrix is a table of platform facts:
"hold to talk works on Windows and macOS, not on Linux Wayland".

That shape cannot be filled in honestly. The whole point of slice S0 was to find
out whether a `Released` event arrives for a globally registered shortcut, and
the measurement is documented in
[known-issues/capture-shortcut-recording.md](../known-issues/capture-shortcut-recording.md):
on KDE Plasma 6 with the app on XWayland, delivery is **nondeterministic**. Some
holds delivered extra press/release pairs, some lost the release entirely, and
the counts did not scale with hold duration. That run injected keys through
XTEST, which is not physical input, so it proves the failure state is reachable
but proves nothing about hardware keyboards. The physical half of the
measurement needs a person and is still open.

Writing a per-OS truth table now would therefore mean encoding a guess as a
platform fact — for Linux, and for Windows and macOS where nothing has been
measured at all. That is the same class of mistake as D11: hold to talk was
offered as an equal activation mode on the assumption that it works.

## Decision

The matrix has two inputs and no assumptions.

1. **Session facts**, collected once by `core::shortcut::shortcut_platform()`:
   which OS, which session type, XWayland versus native Wayland, which keys the
   desktop swallows. Which row of the matrix a session is gets a name —
   `SessionKind` — so every branch that differs per platform selects on one enum
   instead of scattered `cfg!` checks.
2. **Release evidence**, measured by the trigger lane. `ReleaseEvidence` is
   derived from the press and release counters the lane already records per
   binding (T11): `Unobserved`, `ReleaseObserved` or `ReleaseMissing`.

`core::shortcut::capability_matrix()` is a pure function of those two. It emits
a `CapabilityState` per activation mode and per key class, with the reason
phrased for the user. The state has three values, not two: `Conditional` means
"registerable, with a consequence you have to know", which is what the previous
UI had no way to express and therefore had to guess about.

The session facts decide only what follows from them with certainty:

- No global-shortcut API in this session (native Wayland without the portal)
  means no activation mode and no key class can fire. Everything is
  `Unavailable`, with that as the reason.
- A session type with a known delivery risk contributes a **caveat sentence**,
  not a state: XWayland's focus-dependent passive grab, macOS's Input Monitoring
  requirement. The caveat names a plausible cause; the counters remain the
  finding.

Hold to talk follows the evidence on every platform, including Windows and
macOS:

| Evidence | Hold state | Meaning |
| --- | --- | --- |
| `Unobserved` | `Conditional` | Nothing is known yet. Explicitly not "works". |
| `ReleaseObserved` | `Available` | This session delivered releases for this shortcut. |
| `ReleaseMissing` | `Unavailable` | Presses arrived, releases did not — the stranded hold of D11. |

Tap and double tap are `Available` wherever grabs exist at all; neither depends
on a release.

## Consequences

- The UI gates the activation selector on `shortcut_capabilities` and renders
  `state` and `reason` verbatim. It no longer derives "hold is unverified" from
  the press/release counters itself, which was a rule living in TypeScript and
  therefore a slow drift away from ADR 0006.
- An option the session cannot honor is offered as unselectable with the reason
  stated. The persisted value is never rewritten: if the user's stored mode
  becomes `Unavailable`, it stays selected and the row explains why. Silently
  swapping their choice would be the same failure as an empty shortcut reverting
  to a default (T7).
- Because the evidence is per-session and per-shortcut, the matrix changes while
  the settings window is open. `loadShortcutCapabilities()` is deliberately not
  cached, and it is refreshed together with the trigger status.
- Every matrix branch is unit-testable without a desktop: `capability_matrix` is
  pure and the tests construct all five `SessionKind` rows against all three
  evidence states.
- **The physical S0 measurement can only tighten this, never invalidate it.** If
  physical keys turn out to lose releases on XWayland as reliably as XTEST did,
  the change is one branch: `LinuxXWayland` gets a hard `Unavailable` for hold
  independent of the counters. Until then the runtime reports what it observed
  and says so.
- The matrix is documented for humans in
  [PLATFORMS.md](../PLATFORMS.md#shortcut-capability-matrix). That table is a
  rendering of the derivation, not a second source of truth.
