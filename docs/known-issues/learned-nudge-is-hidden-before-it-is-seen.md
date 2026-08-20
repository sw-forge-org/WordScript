# Bug: the learned-word nudge is hidden 1.7 seconds before it is done being shown

Status: **Fixed 2026-08-16 by [ADR 0169](../decisions/0169-a-transient-that-outlives-a-park-is-bounded-by-a-clock-the-park-cannot-stop.md)**,
which took the first of the three options below — delay the park — after the
owner reported the tab was unreadable in practice. A running nudge now holds the
overlay active, and the duration went from 1.9 s to 4 s. The 2026-08-16 addendum
carries what the sighting measured; the analysis below is unchanged and is why
the fix has the shape it does.

Previous status (2026-08-12): **Open — cause located, and it is not a race.** The
runtime emits the nudge and the overlay window is hidden 268–303 ms later, every
time. The tab asks for 2020 ms. Seven of seven learned events across both runtime
logs, spanning 2026-08-02 to 2026-08-12, lost by the same margin.

First reported: 2026-08-12 by the owner — *"dieses Learned Badge habe ich gar
nicht bekommen. Generell keine Badges."*
Affected area: `src/windows/OverlayWindow.tsx` and `park_overlay_window`
(`src-tauri/src/lib.rs`).

## Symptom

The runtime learns a word, logs that it learned it, and tells the overlay. The
overlay never gets to say so. Nothing is broken on screen and nothing errors —
the window is simply gone before the tab has finished opening.

## The measurement

`[Vocabulary] Learned` is written immediately before `emit_learned_event`, and
`Overlay parked` immediately after `window.hide()` (`lib.rs:915`). The distance
between them is how long the nudge had:

| Learned (epoch ms) | Hidden after |
| --- | --- |
| 1785724790234 | 298 ms |
| 1785731635866 | 268 ms |
| 1785750494276 | 269 ms |
| 1785804086029 | 268 ms |
| 1786388886684 | 303 ms |
| 1786414172313 | 270 ms |
| 1786496261394 | 284 ms |

Against `LEARNED_NUDGE_DURATION_MS = 1900` plus the 120 ms the timer adds
(`LEARNED_NUDGE_VISIBLE_MS = 2020`). The nudge gets between 13 % and 15 % of the
time it is built for, and the CSS animation that opens the tab has not finished
in that window either.

**Seven of seven is not a race.** It is a fixed ordering: the learning pass runs
at the end of the pipeline, after the insert, and parking follows immediately.

## Why it cannot win

The nudge rides its own channel on purpose. `wordscript-learning-event` is
deliberately neither `wordscript-event` nor `wordscript-native-event`, because
per ADR 0018 and ADR 0019 a session ends in exactly one reducer commit and
nothing presentational may touch `status`, `pendingResult`, `previewStaged` or
`resultSurfaceOpen` (ADR 0035, and the comment above the listener says so).

That isolation is correct and it is also the trap: **a channel that may not
influence session state cannot ask the session to stay on screen.** The window's
lifetime is decided by the insert path, which has already finished. The nudge is
announced into a window that is closing.

## The other two side tabs, checked

The report was "no badges at all", and the other two are not the same finding:

- **`ov-limit-tab` — correct absence.** It appears at a quarter of the auto-stop
  capped at 120 s, so with `max_recording_seconds = 720` it opens with 120 s
  remaining, i.e. after ten minutes of unbroken recording. The longest capture
  in the current log is 217.6 s. It has never had the opportunity.
- **`ov-gap-tab` — not established either way.** Two `verdict=Short` captures
  exist in the current log (2026-08-11, `missing_ratio` 0.1144 and 0.1903), and
  the overlay stayed up for 2347 ms and 2693 ms after them — enough time.
  Whether it painted is not observable from the runtime log, because overlay
  render state is not logged.

  **The live check is cheap and does not need the defect.** The first of those
  two was 3.238 s of wall clock against 2.868 s recorded: at three seconds the
  ordinary startup transient is already 11.4 % of the capture, which is over the
  10 % threshold. So a deliberate three-second dictation reads `Short` without
  anything going wrong, and the gap tab either paints or it does not. That is
  one recording, not an investigation.

**So one of the three is a defect and one is working as specified.** The
"generally no badges" impression is real, but it has three different causes and
only one of them is a bug.

## Not the cause

Ruled out while narrowing, recorded so nobody re-walks it:

- The channel is not missing on either side. `vocabulary_learning.rs:454` emits
  `wordscript-learning-event` with `event: "vocabulary_learned"` and `terms`,
  and `OverlayWindow.tsx:1141` listens for exactly that shape.
- The measure-then-open shutter that sizes all three tabs against the side strip
  `(480 - pillWidth) / 2` (REFERENCE.md) is a plausible second cause and is
  **untested**: the window is hidden before the measurement matters. It has to
  be re-examined once the timing is fixed, not before, or a geometry change will
  be credited with a fix that came from the ordering.

## What would fix it — an open decision, not a detail

Three shapes, and choosing between them is ADR work because each one trades
against a rule the overlay already keeps:

1. **Delay the park** until the nudge has run. Cheapest to write, and it makes
   the session's window lifetime depend on a presentational channel — the exact
   coupling ADR 0035 avoided.
2. **Emit earlier**, at preview-ready rather than after the insert, so the nudge
   opens while the result surface is still up. Keeps the channels apart; means
   the nudge can announce a term the learning pass has not yet committed.
3. **Say it somewhere that persists** — the result surface or the history row —
   and drop the transient tab. Loses the "quietly, then gone" quality the tab
   was designed for (ADR 0035).

## Addendum 2026-08-16: the shutter geometry is not a second cause, and the tab was seen

*Not the cause* above leaves one item open: the measure-then-open shutter is
"a plausible second cause and is **untested**", to be re-examined once the
timing is fixed. It has now been measured directly, and it is clean.

The owner saw the tab for the first time on 2026-08-16 — reading `nit`, beside a
running recording, and not moving. From the screenshot and `[ov-dom]`:

| Quantity | Value |
| --- | --- |
| Webview viewport | 384 CSS px (the window is 480 logical; host scale 1.25) |
| Pill, painted | 195 px |
| Strip beside the pill | 94.5 px |
| Tab, wanted | ~58 px |

**The strip had room for the tab and then some**, and `sideStrip` resolved to
`full`. The shutter arithmetic is therefore not implicated, and this section's
open item is closed: **the geometry is not a second cause.**

What the sighting did find is a different mechanism, filed separately in
[overlay-park-suspends-the-page.md](overlay-park-suspends-the-page.md): since
ADR 0155 the park no longer unmaps the window, so the sweep freezes mid-frame
and the unmount timer does not fire. That is why the tab was visible at all —
a frozen frame outlives the 280 ms this record measures — and why it was
visible *wrongly*, cut off at a third of its width.

### And this record's own finding was then fixed, the same day

The owner's verdict on seeing it: **280 ms is not enough — the thing is simply
not visible.** That is the measurement above restated from the other side, and it settled the choice between the three
options.

**Option 1 was taken: delay the park.** ADR 0169 carries the derivation and the
two things that make the coupling narrower than the one ADR 0035 avoided — the
session reducer is untouched, and the hold is conditional on a pill existing to
anchor the tab to. The duration went to 4 s in the same change, since it is now
a number that is actually spent.

**What it costs**, recorded here because this is where anyone will look: after a
dictation that learned a word, the last surface stays up four seconds longer as
a frozen frame with its actions inert. Seven events in ten days, so most
dictations are unaffected. In `clipboard_only` those four seconds show the
transcript with a dead `Copy` button — the same rendering
[overlay-leave-hold-dead-actions.md](overlay-leave-hold-dead-actions.md) is
about, sixteen times longer. If that reads badly in use, the fix is an idle
presentation for the hold, not a shorter nudge.

## Environment

- Overlay window 480x60 (flat), side tabs sized against
  `(480 - pillWidth) / 2` — see [REFERENCE.md](../REFERENCE.md).
- Observed on the `clipboard_only` delivery with `auto_paste=false`. Whether a
  delivery mode that keeps the result surface open changes the timing is
  untested; all seven measured events were on this path.
