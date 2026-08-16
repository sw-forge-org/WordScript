# Bug: parking the overlay stops its clocks, and the next reveal resumes them

Status: **Open — one symptom fixed, cause not.** The learned-word tab can no
longer survive a park (ADR 0169), but nothing else in the overlay is protected,
and whether the page may be suspended at all is unanswered.

First reported: 2026-08-16 by the owner — *"es war nicht weg, aber auch
abgeschnitten … erst nachdem ich das Recording neu gestartet habe, war es wieder
weg."*
Affected area: `park_overlay_surface` (`src-tauri/src/lib.rs`) and every
animation or timer in `src/windows/OverlayWindow.tsx`.

## Symptom

A CSS animation running when the overlay parks freezes at the frame it had
reached, and a `setTimeout` pending at that moment does not fire. Both resume at
the next reveal — so a transient from one session appears, mid-motion and
motionless, beside the next one.

Observed on the learned-word tab: a shutter caught at a third of its width, the
label's right end showing through it, sitting beside a running recording at
`00:03`. It cleared only when the recording was started again.

## The measurement

From the reported screenshot and `[ov-dom]` in `/tmp/kilo/overlay-diag.log`:

| Quantity | Value |
| --- | --- |
| Window, native | 480 x 60 (`[ov-reveal]` inner and outer both) |
| Webview viewport | 384 x 48 CSS px (host scale 1.25) |
| Pill, painted | 195 px (`pillOffsetW=224` at `zoom: 0.87`) |
| Strip beside the pill | (384 − 195) / 2 = **94.5 px** |
| Tab, wanted | ~58 px painted |
| Tab, on screen | **19 px** |

**The geometry was right and had room to spare.** The tab was not clipped by the
window and not mis-measured — 19 px is not a value the variant logic can
produce. Its three outcomes are 0 (hidden), ~24 (marker, and the marker hides
its label by CSS, so the text would not have been readable), and ~67 (full).
19 px of 58 is a frame of `overlay-learned-sweep`, stopped.

`prefers-reduced-motion` was ruled out on the reporting machine:
`AnimationDurationFactor` is 0.25 and `gtk-enable-animations` is `true`, so the
`@media (prefers-reduced-motion: reduce)` block in `overlay-pill.css` — which
would have held the tab open statically — did not apply.

## Why the park does this now

Until [ADR 0155](../decisions/0155-the-overlay-stops-being-unmapped-because-every-map-costs-one-black-frame.md)
the Linux park was `hide()`, an X11 unmap. That is a hard stop, and the `show()`
that followed was a fresh start. ADR 0155 removed it — every map cost one black
frame on screen — and parking became an offscreen move at opacity 0. The window
stays mapped for the life of the process.

The page therefore is never torn down, and WebKitGTK suspends a page it
classifies as not-visible. `OverlayWindow.tsx` already knows this and works
around it twice, routing both the reveal dispatch and the diagnostic flush
through microtasks rather than rAF, each with a comment saying why. What ADR 0155
changed is *when* that classification happens: between every pair of sessions,
for as long as the gap lasts.

## What is not established

- **Whether the suspension is the mechanism, or only consistent with it.** The
  evidence is a stopped frame plus a timer that fired late; neither was observed
  in the engine. The `[ov-nudge] measure` / `[ov-nudge] end` pair added with
  ADR 0169 is the instrument: a `measure` line with no matching `end` is the
  freeze, directly.
- **What else is exposed.** Every animation in the overlay and every pending
  timer is on the same two clocks. The pill's own leave animation, the limit
  tab's transition and the mode-picker auto-close timer are all candidates and
  none has been checked.
- **Whether a reveal reliably wakes the page.** The owner's tab persisted
  through an entire following session and cleared only at the one after it,
  which suggests the wake is not immediate — but the sample is one sighting.

## What would fix it

Unresolved, and it is runtime work rather than surface work:

1. **Do not let the park suspend the page** — keep the window in a state
   WebKitGTK still classifies as visible while parked. Needs a way to be
   offscreen-and-transparent without being not-visible, which may not exist
   under XWayland.
2. **Wake the page explicitly on reveal**, so the resume is a defined moment
   rather than whenever the compositor gets round to it.
3. **Treat every overlay transient the way ADR 0169 treats the nudge** — bound
   by wall-clock and by the session boundary. Works per surface, costs one
   deadline each, and leaves the underlying stop in place.

## Related

- [learned-nudge-is-hidden-before-it-is-seen.md](learned-nudge-is-hidden-before-it-is-seen.md)
  — the same tab, the other defect: it gets ~280 ms of its 2020 ms because the
  park follows the learning event immediately. That one is about *when* the park
  happens; this one about *what the park does to the page*.
- [overlay-recording-freeze.md](overlay-recording-freeze.md) — a pill that stops
  moving mid-capture. Different phase (during a session, not between two), and
  not shown to share a mechanism, but the same class of symptom.
- [overlay-stranded-off-screen.md](overlay-stranded-off-screen.md) — the other
  consequence ADR 0155 left open.
