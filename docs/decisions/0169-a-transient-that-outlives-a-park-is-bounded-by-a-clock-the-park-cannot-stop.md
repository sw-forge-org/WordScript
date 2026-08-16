# 0169: A transient that outlives a park is bounded by a clock the park cannot stop

Date: 2026-08-16
Status: Accepted. Spends the second consequence
[ADR 0155](0155-the-overlay-stops-being-unmapped-because-every-map-costs-one-black-frame.md)
left open — it recorded that the offscreen park move now lands on a window that
is no longer hidden, and this is the other thing that changed with it: a parked
overlay is still a page, and a page that is not visible does not necessarily
keep running.

## Context

The learned-word nudge (ADR 0035) is a tab that sweeps out of the pill's left
edge, holds, and retracts. Its life is 2020 ms, spent by two clocks: a CSS
keyframe animation drives the shutter's width, and a `setTimeout` unmounts the
element afterwards.

Both are page clocks, and until ADR 0155 that was safe, because the window they
run in was unmapped between sessions. An unmap is a hard stop and the following
map is a fresh start; whatever the page had been doing did not survive it.

**ADR 0155 removed the unmap.** On Linux the overlay is mapped once at setup and
parked by moving it offscreen at opacity 0. The page is never torn down, so
nothing resets it — and WebKitGTK suspends a page it classifies as not-visible,
which this codebase already works around in two other places (`OverlayWindow`
routes both its reveal dispatch and its diagnostic flush through microtasks
rather than rAF, for exactly this reason).

The two clocks stop together, and neither of them stops cleanly:

- The sweep freezes at whatever width it had reached.
- The `setTimeout` does not fire, so the element is not unmounted.

Both resume at the next reveal, which is one session too late.

**The nudge is always mid-sweep when the park arrives.** This is measured, not
inferred: the runtime emits it 268–303 ms before the park, seven of seven times
across two runtime logs
([learned-nudge-is-hidden-before-it-is-seen.md](../known-issues/learned-nudge-is-hidden-before-it-is-seen.md)).
So this is not an edge case the nudge can avoid by being quick — it is the only
path it has.

Reported 2026-08-16 by the owner, who saw a tab reading `nit` beside a running
recording at `00:03` and named the flash fix as the suspect. Measured from the
screenshot and `[ov-dom]`: the window was 480x60 with a 384 px viewport and a
195 px pill, leaving a 94.5 px strip for a 58 px tab. **The geometry was
correct and had room to spare.** What was on screen was 19 px of that tab —
a frozen frame of the sweep, holding a shutter open at a third of its width
with the label's right end showing through it.

## Decision

**A transient in the overlay is bounded by wall-clock and by the session
boundary, not by a pending timer — and it holds the window open for as long as
that bound lasts.**

For the nudge, concretely:

- The listener records `Date.now() + LEARNED_NUDGE_VISIBLE_MS` when it opens the
  tab. The `setTimeout` stays and remains the ordinary path — it is more precise
  and costs nothing.
- An effect re-checks that deadline on every reveal and repaint. `Date.now()`
  keeps running across a suspension; a pending timer does not. This is what
  bounds the tab when no new session arrives.
- **A new session clears it outright.** A word learned in the previous session
  names nothing that is happening in this one, so carrying it across is wrong
  even in the case where it painted correctly.
- **A running nudge keeps the overlay active**, and the duration went from 1.9 s
  to 4 s.

### The window hold, which is the half that makes it readable

The bound above is worth nothing on its own: on the window's own schedule the
tab gets 280 ms, so *any* duration was theoretical and 1.9 s was as unreadable
as 4 s would have been. The owner's report is the measurement — *"man sieht das
gar nicht"*.

So `isActive` gains `nudgeHasSurface`, and this ADR takes the option the
known-issue record listed first and declined: **delay the park**. Two things
make it narrower than the coupling ADR 0035 avoided:

- **The session reducer is untouched.** `status`, `pendingResult`,
  `previewStaged` and `resultSurfaceOpen` are exactly what they were, and the
  session has already ended in its one commit (ADR 0018/0019) before this can be
  true. What is extended is how long the window stays up afterwards — that is
  presentation deciding how long presentation lasts.
- **It is conditional on there being something to see.** The tab is anchored to
  `.ov-pill-shell`, which exists only inside `{pillState && …}`. With no pill
  there is no tab either, so `nudgeHasSurface` requires one of the three leave
  holds; without one it is false and the window parks on its old schedule. The
  alternative was four seconds of empty transparent window.

The pill that stays up is the leave hold — a frozen frame of the surface the
session ended on, actions inert. That is what the hold has always been; it is
now visible for 4 s rather than 240 ms.

### The two meanings of "active", which are now different questions

`isActive` used to mean both "the window is up" and "a session is on screen".
The hold splits them, and `sessionHasSurface` is the second one.

This is not bookkeeping. `lastVisibleSurfaceRef` records the surface the leave
hold replays, and it is written whenever the overlay is active. Left on
`isActive`, the nudge hold would write into it during a period when
`liveSurface` has already fallen to `compact` — and `holdPreviewDuringClose`
refuses to hold a `compact`. The hold would collapse at the exact moment it was
needed, taking the pill, the tab anchored to it, and the reason the window was
being held. It was written that way first and the test caught it.

## Consequences

**The nudge cannot outlive its session.** The failure mode it had — a half-open
shutter parked beside an unrelated recording until the session after that —
cannot recur, whether or not the page was suspended.

**The freeze itself is not fixed and is deliberately not fixed here.** Whether
the overlay's page may be suspended between sessions is a runtime question about
the park path, and it reaches further than one tab: any animation running when a
park lands has the same problem, and so does any timer. The measurement is
recorded in
[overlay-park-suspends-the-page.md](../known-issues/overlay-park-suspends-the-page.md).
This ADR makes one surface survive it; it does not claim the cause is gone.

**The nudge gets its 4 s, and the pill is on screen for them.** After a
dictation that learned a word, the last surface stays up four seconds longer
than it used to, as a frozen frame. That is the price of the hold and it was
accepted deliberately: seven learned events in ten days, so the great majority
of dictations are unchanged, and on those where it applies the alternative was
a signal nobody could read.

**`clipboard_only` is where this is felt most.** It is the mode whose only
surface is the processing preview, so the four seconds are spent showing the
transcript with its actions inert. The text is already on the clipboard by then
— the mode's whole point — so nothing is withheld, but a `Copy` button is
visible and dead for four seconds, which
[overlay-leave-hold-dead-actions.md](../known-issues/overlay-leave-hold-dead-actions.md)
established is a real cost at 240 ms. It is the same rendering, sixteen times
longer. If that reads badly in use, the answer is to give the hold an idle
presentation rather than to shorten the nudge again.

**A `[ov-nudge]` diagnostic pair now exists** (dev builds only): a `measure`
line carrying the three widths and the window they were measured against, and an
`end` line on `animationend`. A `measure` without a matching `end` is the freeze,
and that distinction cannot be made from a screenshot — which is what cost this
investigation its first two hypotheses.

## Alternatives

**Clear the nudge when the overlay goes inactive.** The obvious shape, and it
loses the feature: the nudge arrives 268–303 ms *before* the park, on a surface
that is already closing, so clearing on `isActive === false` would race the
event that creates it and would often delete the tab before it painted at all.

**Emit the nudge earlier**, at preview-ready rather than after the insert — the
known-issue record's second option. Keeps the channels apart and needs no hold
at all, but it announces a term the learning pass has not yet committed, and how
long it is then visible depends on the delivery mode: `auto_paste` closes its
surface quickly, so the mode with the shortest surface would still be the mode
that cannot read the tab.

**Say it somewhere that persists** — the result surface or a history row — and
drop the transient entirely. The record's third option. It is the honest answer
to "the overlay is the wrong place for this", and it gives up what ADR 0035
built the tab to be: something you notice without being asked to act on it.

**Show only the tab and let the pill go.** Would spend no time on a frozen
surface, and was rejected on cost rather than merit: the tab is positioned
against the pill's shell, so a tab without a pill needs its own placement and
becomes a fourth overlay surface. Worth revisiting if the held pill turns out to
be the part that annoys.

**Drive the sweep from JS instead of CSS.** Trades a frozen animation for a
frozen rAF loop, which is the same clock. It would also put a per-frame width
write on the element the ghosting rules keep off the compositor
(`overlay-pill.css` documents at length why this shutter animates `width` and
nothing else).

**Keep the unmap for the park.** That is ADR 0155 reversed, and it buys back the
black map frame on every recording start — a defect that was on screen every
session, against one that needs a learned word to appear at all.
