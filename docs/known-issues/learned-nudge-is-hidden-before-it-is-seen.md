# Bug: the learned-word nudge is hidden 1.7 seconds before it is done being shown

Status: **Open — cause located, 2026-08-12, and it is not a race.** The runtime
emits the nudge and the overlay window is hidden 268–303 ms later, every time.
The tab asks for 2020 ms. Seven of seven learned events across both runtime
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
  render state is not logged. This needs a live check against a deliberately
  short capture, not more log reading.

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

## Environment

- Overlay window 480x60 (flat), side tabs sized against
  `(480 - pillWidth) / 2` — see [REFERENCE.md](../REFERENCE.md).
- Observed on the `clipboard_only` delivery with `auto_paste=false`. Whether a
  delivery mode that keeps the result surface open changes the timing is
  untested; all seven measured events were on this path.
