# 0073 -- The overlay names the target language in two letters beside the mode

Date: 2026-08-10
Status: Accepted

## Context

`ProcessingMode::Translate` shipped with ADR 0071 and the overlay's mode chip
learned to say `Translate`. That is where the problem showed: it is the one mode
name that does not say what will happen. `Cleanup` is the whole instruction and
`Verbatim` is the whole instruction; `Translate` is half of one, and the missing
half is the only thing on the surface a reader cannot derive.

The mode is a per-profile setting with one fixed target (ADR 0041), so the
answer does exist -- it is just not on the surface that reports what is running.

Two shapes were considered and the owner chose between them.

**A side tab, left of the pill**, in the shape `.ov-learned-tab` and
`.ov-limit-tab` already use. Rejected: the left slot is the learned-word tab,
which is a one-shot shutter that slides out, names a word and retracts, with
nothing to click. A language badge has the opposite lifecycle -- on screen for
the whole recording and pressable -- which is the *right* tab's shape, and the
right slot is the auto-stop's. `overlay-pill.css` states the rule the two were
built on: *two side tabs, one per side, so neither has to yield to the other*. A
third persistent tab breaks the arrangement that made the two safe, and it would
have needed a collision rule for "a word is learned during a Translate
recording" that nothing else needs.

**Inside the pill, beside the mode chip.** Chosen.

## Decision

**A chip of two letters, in the pill's flex flow, beside the mode chip, drawn
only while the mode is `translate`.**

Everything else in this window that was ever added went `position: absolute` and
out of the flow, for a reason `overlay-pill.css` repeats: a pill wider than the
480px window has its rounded ends clipped, and `Prompt Enhance` was already
shortened to `Enhance` for the same budget. This one is affordable in the flow
for a stated reason rather than an assumed one: **every language the runtime
offers has a two-letter code**, so the chip has a fixed width rather than a
content-dependent one, and it is on screen for one mode out of seven. The width
is confirmed in the native host rather than argued from here.

**It is its own button, not a longer mode label.** The mode chip already cycles
the mode on press. Putting the language into the same control would make one
press mean two things depending on where in it you landed. Two chips, two
cycles, one each.

**Pressing it steps to the next target language and persists it**, through
`cycle_active_profile_translate_language` -- its own command for the reason
`set_active_profile_processing_mode` is one: the overlay holds no config draft,
so a read-modify-write from there would send back whatever snapshot it happened
to hold and clobber a concurrent settings save. Under the file lock, it reads
and writes one field. It emits the config event and **no mode event**: the mode
did not change, and a mode event that repeats the same mode is a signal every
listener has to learn to ignore.

**No dot, and no divider before it.** The dot on the mode chip marks where the
mode group starts; a second dot would read as a second group, and this is the
same statement continued.

**It is a statement rather than a control on the processing surface.** While the
transform runs, the language is already spent -- a press there would change the
next session while the chip states this one. The window withholds the handler;
the chip is drawn and does nothing.

**The cycle is not optimistic**, where the mode cycle is. The mode's eager local
commit exists because the mode drives `pillVisualEpoch`, and a stale mode for
one to three renders paints into a backing store WebKitGTK has not invalidated.
Two letters drive no epoch and change no surface geometry, so there is nothing
to coalesce and nothing to roll back.

## Consequences

- **This is a deliberate exception to relay rule 5**, which puts the overlay out
  of scope for Leg 5, and it was directed by the owner rather than taken. It is
  the second overlay change in the leg: the first was unavoidable, because
  `OverlayProcessingMode` had to grow a seventh value or the pill could not name
  the mode at all.
- The chip is in the flex flow, so it is the first addition to this window that
  can change the pill's measured width. `overlay-pill.css` documents what that
  costs when it goes wrong -- clipped rounded ends, the "eckige Kanten" defect
  -- and the window is fixed at 480px with `pill__preview-text` capped at 220px
  to keep the unscaled pill inside it. The recording surface has headroom; that
  is a measurement, and it belongs in the native host.
- **The gallery reaches the state now.** `OverlayStates`'s mode cycle was six
  entries and skipped Translate, so the one mode that adds a chip was reachable
  only by making a recording. It mirrors `MODE_CYCLE_ORDER` and carries its own
  language cycle as sample data, which is what makes the chip inspectable on the
  acceptance surface (ADR 0055).
- Nothing about ADR 0041 changes. The target is still one fixed per-profile
  value; this is a second door to it, on the surface that reports what is
  running, in the same way the mode chip is a second door to the profile's mode.
