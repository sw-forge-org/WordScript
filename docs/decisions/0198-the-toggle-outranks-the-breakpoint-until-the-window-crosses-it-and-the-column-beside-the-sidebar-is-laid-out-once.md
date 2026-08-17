# 0198: The toggle outranks the breakpoint until the window crosses it, and the column beside the sidebar is laid out once

Date: 2026-08-17
Status: Accepted. Corrects two claims made by
[ADR 0111](0111-the-sidebar-has-two-widths-and-the-layout-measures-the-column-it-is-drawn-in.md)
and
[ADR 0125](0125-the-sidebar-transition-is-a-clip-and-a-save-adopts-its-own-answer.md)
that the code did not keep.

## Context

Reported by the owner on 2026-08-17, as two complaints about one control:

> when I want to pull the sidebar out I always have to click twice, wrongly, to
> pull it out, and only once to pull it in, and it is still very juddery, above
> all in the Profiles tab

Both turned out to be real, and neither was the defect ADR 0125 already fixed.

### The window is narrow, and on this display it always is

`useNavRail` rails the sidebar below **760 CSS px** of viewport, and ADR 0111
justified that floor against ADR 0104's measurement: the shipped window declares
1000, that 1000 lands as **device** pixels, and at the 1.25 display scale
measured then the layout got 800 CSS px.

**The scale is what moved.** The owner's primary display is a 4K panel at scale
1.6 — `xrandr` reports 2400 x 1350 logical for a 3840 x 2160 surface. The same
window therefore hands the layout `1000 / 1.6 = 625` CSS px, and even
`maxWidth: 1240` comes to 775. So the workspace sits under the floor at every
width it can be dragged to, and **the rail is the state it opens in.**

Nothing about that is wrong on its own — it is the breakpoint doing exactly what
ADR 0111 designed it to do. What it changes is the status of the narrow half:
it is not the edge case the suite may skip, it is the only case this machine
has.

### One press in, two presses out

`useNavRail`'s adoption effect re-derived the state from the stored preference:

```js
useEffect(() => {
  if (preference === undefined) return;
  setRailed(windowIsNarrow() || preference);
}, [preference]);
```

The toggle writes the preference into the window's config draft, and the draft
hands the field straight back. **So the toggle's own write arrives as a change
and re-enters that effect.** Expanding wrote `false`, the echo derived
`narrow || false` — railed — and the column shut again inside the press.
Collapsing wrote `true` and the derivation agreed with it by coincidence.

That is the whole asymmetry: one direction was overruled by a re-derivation and
the other was not. The second press then worked, because by then the preference
no longer changed and the effect did not run at all.

ADR 0111's own text already stated the rule this broke — *"In between, the
toggle is the authority and nothing overrules it — a sidebar that springs back
open on the next resize tick is a control that does not work."* The comment is
still in the file. The code never implemented it.

**The suite could not have caught it.** jsdom's `matchMedia` answers
`matches: false` to everything, so every case in `WorkspaceWindow.test.tsx`
runs in a wide window, where `windowIsNarrow()` is false and the re-derivation
is a no-op.

### The judder is the column next to the sidebar, not the sidebar

`.ws-nav` animates `width` over 180 ms. `.ws-content` was a `flex: 1` sibling,
so **its inline size changed on every frame of that animation** — and
`.ws-content` is `container: ws-column / inline-size`. Every frame therefore
re-evaluated every container query beneath it and re-laid-out the subtree.

At the widths this window actually lives at, the content column travels from
`625 - 232 = 393` px to `625 - 56 = 569` px, which **crosses the 460 px tier**
at the foot of `shell.css`: `.ws-row` flips between a stack and a line,
`.ws-legend-row`, `.ws-mcp-row`, `.ws-klass-row` and `.ws-stage-row` re-grid,
`.ws-seg` and `.ws-note-tabs` change their wrap, `.ws-sec-head` changes
direction — mid-animation, on the way past.

**Profiles pays it twice**, which is why the owner named that tab. It is the
pane layout: `--pane-list-w` is `clamp(176px, 32cqi, 236px)`, a grid track
resolved against that same moving container, and `.ws-pane-detail` inside it is
a second `ws-column` container whose own queries then re-ran per frame as well.

`shell.css` claimed the opposite, and had since ADR 0111:

> It is cheap because the column is `flex: none` — the content beside it reflows
> once, at the end, rather than on every frame of a layout animation.

`flex: none` fixes the animated column's own basis. It says nothing about the
flexible column beside it, which took the whole cost.

## Decision

**One: the hook can tell its own echo from a new choice.** `useNavRail` records
the value it last wrote and skips the adoption effect when the preference comes
back equal to it. Anything genuinely new — another window, a config edited on
disk, a save the runtime refused and reverted — differs from that value and is
adopted with the narrow-window override intact. A breakpoint crossing clears the
record, because the crossing is the one event that *is* allowed to overrule the
toggle.

**Two: the sidebar leaves the flow, and the column beside it is pinned.**
`.ws-win-body` becomes the positioning context, `.ws-nav` is anchored to its
left edge, and the content columns take their inset from a `margin-left` that is
not transitioned:

```css
.ws-nav ~ .ws-content { margin-left: var(--nav-w); }
.ws-nav[data-collapsed] ~ .ws-content { margin-left: var(--nav-w-rail); }
```

The content column therefore takes its final width on the first frame and the
sidebar slides over it or off it. **This is ADR 0125's own clip, applied to the
one box it was never extended to** — that ADR pinned the sidebar's children to
the width of the state they are in for exactly this reason and stopped at the
sidebar's edge.

The state is read off the sidebar's existing `data-collapsed` through a sibling
combinator rather than restated on the body, because one fact gets one home
(ADR 0123), and a `.ws-content` mounted without a sidebar — the workspace before
the runtime answers — correctly keeps the whole width.

## Consequences

**Measured after the change**, in the gallery shell at a 625 x 475 viewport:
expanded the sidebar is 232 px at x = 0 and the column is 393 px at x = 232;
railed, 56 px and 569 px at x = 56. Flipping `data-collapsed` mid-transition
shows the column already at its destination while the sidebar is still
travelling — which is the property the fix is for: **the column's box does not
depend on the animating width.** One layout pass per press instead of one per
frame, and the container queries answer once.

**Expanding shows the window's own ground for the length of the slide.** The
column parks at 232 immediately and the sidebar grows into the strip left over,
so for 180 ms there is a shrinking band of `--bg-base` between them. That is the
drawer idiom and it is the honest cost of the clip; the alternative — sliding
the column with a transform — would put a permanent stacking context and
containing block on `.ws-content`, and `.ws-menu[data-fixed]` is drawn inside
it.

**The narrow half of the rail is now tested.** `src/hooks/useNavRail.test.tsx`
stubs `matchMedia` and drives the hook through the window's real wiring — a
preference that is written and read back one render later. Without the guard its
narrow case fails and the two wide cases pass, which is the shape the shipped
suite had.

**What this ADR does not decide** is whether 760 is still the right floor. At a
1.6 display scale the workspace can never clear it, so the sidebar's expanded
state is reachable only through the toggle and is forgotten on every launch. The
window arithmetic in ADR 0104 and ADR 0111 was measured at 1.25 and is quoted
with that viewport, as it should be; re-deriving it for the scales the product
actually meets is its own piece of work.
