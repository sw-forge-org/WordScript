# 0125: The sidebar's transition is a clip, and a settled save adopts its own answer

Date: 2026-08-12

Status: Accepted

## Context

The owner's report was that the sidebar "does not collapse or expand cleanly —
it judders for a few milliseconds every time, and the logo above all does not
move smoothly."

Four separate faults produced that one symptom. Each was measured in the running
workspace before it was touched, by sampling the sidebar's geometry on every
animation frame across a press of the toggle.

**1. The state reversed itself twice inside one press.** `useConfigDraft`
resolved a save by putting the form back to the config it had last received on
the `wordscript-event` channel. `save_config` (`core/config.rs`) emits that
`ready` event and then returns, so the promise and the event are two channels
racing; whenever the promise won, the form was set back to a config that did not
carry the write yet. The rail closed, sprang open on the settle, and closed
again when the event landed — two reversals in a 180 ms transition. The
preference is a boolean, so nothing about it looked wrong afterwards; what was
wrong was a 232 px column moving three times for one press.

**2. Every frame of the transition was a fresh layout of the whole sidebar.**
Each child of `.ws-nav` was `width: 100%` of a box whose width was being
animated, so the content was re-measured at 232, 167, 117, 90, 76 px and so on:
labels rewrapped, the group title and the profile's second line took two lines
and then one, and the footer was measured moving 29 px up and back down inside
one press.

**3. The mark was rescaled on every frame, from a 4.65 MB file.** The wordmark
was sized as a percentage of the animating column, so a 1611 px source was
re-rasterised at 26 → 96 → 158 → 161 px across four consecutive frames. The
rail's mark was the same `<img>` with its `src` swapped, so on the frame the
collapse began `currentSrc` was still empty — the one element on the surface
that carries brand went blank until the decode finished. The file behind that
decode was `wordscript-icon.png`, 2016 × 2130 and 4.65 MB, drawn at 26 px.

**4. The head changed shape at t=0 while the column took 180 ms.** The rail
turned the head into a `column-reverse` stack, so the toggle jumped to a new
position on the first frame and then waited there for the column to catch up.

## Decision

**The transition is a CLIP, not a layout animation.** The children of `.ws-nav`
are pinned to `--nav-inner`, the width of the state they are in, so the column
slides and the content stands still and is revealed or covered. Nothing inside
the sidebar re-lays-out on any frame. `overflow-x: hidden` is what makes the
overhang legal in both directions rather than a second scrollbar.

**The head is a fixed-height band** (`--nav-head-h`). The two states put
different things in it — a wordmark, or a toggle with the icon under it — and a
band that measured its own contents would hand the difference to every row
below it.

**The toggle rides the trailing edge.** It is positioned against the head's
right inset rather than placed by a flex line, so it travels exactly as far as
the edge does, at one constant height, and a transform lands it centred on the
rail's icon column.

**Both marks are mounted and the state crossfades them.** Two elements cost one
extra decode once, at mount; a `src` swap cost one on every press, at the moment
of the press. The wordmark is sized by its HEIGHT (`--nav-mark-h`), which is the
dimension both states share, so it is rasterised once and never rescaled.

**The rail withholds words by fading them, not by removing them.** A hidden
group title is 24 px that the rows below it would jump by, once per group. The
words keep their space, lose their opacity, and take `white-space: nowrap` in
the rail only — at 35 px of column a word that still wrapped would push the
footer 49 px down the moment the rail took hold.

**A settled save adopts the config that save returned**, not the last one the
event channel delivered. `save_config` answers with the config the runtime
normalized and wrote; that answer belongs to this write and cannot be older
than it. The hook also records which config the write superseded, so the resync
that follows cannot hand the form back to it — anything genuinely newer arrives
as a new object and is still adopted.

`assets/logos/wordscript-icon-128.png` is the icon at the size the surface
draws it. The 4.65 MB master stays in `assets/logos/` and is no longer shipped
in the bundle.

## Consequences

The sidebar's expanded state is unchanged to within a pixel: the mark measures
159.4 × 46 where it measured 161 × 46.5, and every other box is where it was.
The rail keeps the column's 10 px walls instead of narrowing them to 8, which is
what puts a row's icon tile at the same x in both states — the rail is now
literally the same sidebar with its labels withheld, which is what ADR 0111
claimed and could not yet demonstrate.

Measured across a press after the change: the column moves, the toggle moves,
and nothing else does. The head stays 78 px, the mark stays 159.4 × 46 at x 18,
the search field, the first row, its icon tile and the footer do not move at
all, and `data-collapsed` is set once.

The fix to `useConfigDraft` reaches every discrete control in the product, not
only this one: any toggle whose write settled before the runtime's echo could
spring back to its old value for the length of that race. It was visible here
because the old value is a shape rather than a word.

The bundle loses 4.63 MB.

What is NOT addressed: the content column beside the sidebar still re-lays-out
on every frame of the transition, because it is a flex sibling of a box whose
width is animating and a container query resolves against it. That is inherent
to animating a layout dimension at all, and it is one reflow of one column
rather than a sidebar full of rewrapping text.

## Verification

`src/windows/WorkspaceWindow.test.tsx` holds the state half: the rail stays
railed when the save settles before the runtime's own echo. jsdom has no widths,
so the geometry half is judged in a browser against the running dev server, per
ADR 0104 — in CSS pixels, with the viewport quoted, at 1000 × 760.

The measurement is a page opened behind a `__TAURI_INTERNALS__` stub that
answers `load_app_config` and makes `save_config` emit `ready` before it
resolves, as `core/config.rs` does. It samples per animation frame across a
press and keeps only frames that differ from the one before. What it must print
is a single moving column:

    railed|navW|tileMid|searchY|rowY|footY|markW|headH
    1|232|27.5|90|158.5|586.5|159.4|78
    1|167|27.5|90|158.5|586.5|159.4|78
    …
    1|56 |27.5|90|158.5|586.5|159.4|78

Two things fail that check on sight: a `railed` column that is not constant is
the reversal, and any other column that moves is a frame-by-frame relayout. The
static check beside it reads the centre of the mark, the toggle, the search
icon, a row's tile and the avatar in the rail; all five are 27.5 at this width,
and the column's own centre is the sixth.
