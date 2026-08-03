# 0051: Frost is a pair, and it is not backdrop-filter

Date: 2026-08-04
Status: Accepted

## Context

The settings rework asked for a frosted, liquid-glass surface under the command
palette. `docs/DESIGN_SYSTEM.md` forbade the material outright in two places:

> Use faux glass: solid or semi-transparent designed surfaces with a hairline
> highlight, never `backdrop-filter` or blur.

> Do not use `backdrop-filter` in the shell or overlay.

That ban was written because the shell fights WebKitGTK compositing. The DMABUF
renderer is disabled unconditionally (`src-tauri/src/main.rs:40`) and
`WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING=1` is a shipped hardware opt-out for
black blocks, so a GPU-bound effect was assumed to be the next black block.

**The ban was right and its stated reason was wrong.** `backdrop-filter` does
not produce a black rectangle in this engine. It produces nothing at all.

Benchmarked in WebKitGTK 2.52.4 — the engine the Tauri host loads, driven
through the shipped `MiniBrowser` — against a 6 px stripe ground, where any
real blur averages the stripes toward a flat field and drops their contrast:

| Condition | Stripe contrast |
| --- | ---: |
| Ground, unoccluded | 0.0858 |
| `backdrop-filter: blur(26px)` on the panel | 0.0484 |
| The identical alpha with no blur at all | 0.0484 |

Identical to four decimals. The drop from 0.0858 is the panel's own alpha; the
blur contributes zero. The property is inert with GPU compositing on and with
`WEBKIT_DISABLE_COMPOSITING_MODE=1` — those two captures are byte-identical —
inert behind `will-change`, inert inside a promoted stacking context, and inert
with the `-webkit-` prefix alone.

The failure mode is what makes this worth an ADR.
`@supports ((backdrop-filter: blur(1px)))` reports **supported**, so the
standard feature guard cannot detect it. Anything built on the property looks
correct in a Chromium preview and ships to Linux as flat translucency laid over
legible text. Nothing looks broken, which is why the settings sheet has been
shipping a plain black scrim: it has asked for `backdrop-filter: blur(2px)
saturate(0.8)` for some time, that declaration has never once run in the
product, and no browser preview could show it.

`filter: blur()` is fully functional in the same engine. Measured on this
machine with the palette open and content repainting every frame: 62.4 fps with
no blur, 62.5 fps with `blur(18px)` applied across the whole shell, and the
same on the compositing opt-out path.

## Decision

**Frost is a fourth surface class, it is built from `filter: blur()` on the
layer behind, and it is a pair rather than a plane.**

`--bg-base`, `--bg-surface` and `--bg-elevated` are three planes of one stack:
each names a layer and each is a flat color. Frost is not a fourth entry in
that ladder. It is what a floating surface and the window under it do together
— the panel goes translucent, the window recedes behind it — and neither half
is the material alone. A translucent panel over a sharp window is a panel you
can see the text through; a blurred window under an opaque panel is a blurred
window.

1. **The blur is on the layer behind, never on the panel.** This is also closer
   to what macOS does for a sheet than a local backdrop blur is: the
   application recedes, rather than a rectangle of it.

2. **The receding layers are nested, not parallel.** `.win-shell` is the
   application and recedes behind the settings sheet; `.win-stack` is the
   application plus the sheet and recedes behind the palette. Opening the
   palette from inside settings takes both back one step, which is the only
   arrangement in which the depth order stays true.

3. **The blurred layer carries its own opaque ground.** A blur samples the
   neighborhood of each pixel, so at the edge of a blurred element it samples
   whatever lies outside it — with nothing there it fades, drawing a soft rim
   just inside the window edge and eating the window radius. Each receding
   layer therefore repeats the ground it sits on.

4. **One strength, taken from the settings sheet:** `blur(2px) saturate(0.8)`
   behind a `rgba(0, 0, 0, 0.5)` scrim on the dark ladder. The sheet is the
   surface this material was first drawn on, so the palette copies it rather
   than re-deriving it; two surfaces at two strengths are two treatments that
   happen to co-exist, not one material. A stronger blur was built first and
   measured well, and was rejected for exactly that reason.

5. **The light scheme rebuilds it rather than inverting it** (ADR 0048). The
   fill goes *up*, 82% → 92%: on a near-white window an 82% panel is the same
   value as the ground behind it and stops having an edge. The sheen goes
   almost away, because a white highlight on white is either invisible or a
   grey smear, and the shadow states the material instead. The scrim cannot
   carry over at all — half black over a light room is a bruise —
   `rgba(24, 20, 14, 0.26)`.

**Where it may be used: on a surface that floats and is transient.** The
command palette today; a sheet or a popover if one earns it. Never on a card,
never on the sidebar, never on the overlay. A surface that is always on screen
has nothing to recede from, and the overlay renders in a transparent window
with no desktop behind it to blur — which is what `overlay-pill.css` has always
said and why it stays outside this decision entirely.

**It degrades by design, not by fallback.** Under
`prefers-reduced-transparency` the panel fill goes opaque and the window behind
it is left sharp. Nothing else about the panel changes, because nothing else
about it depended on the frost. Under `prefers-reduced-motion` the filter
transition is dropped and the state is taken without the transit, since a blur
that fades in is a blur rasterized on every intermediate frame.

## Consequences

- `docs/DESIGN_SYSTEM.md` loses both quoted rules. The first is replaced by a
  Frost surface class; the second is restated as what it actually is —
  `backdrop-filter` does not work in the shipped engine, so it is not a style
  choice that was rejected but a property that does nothing.
- The settings sheet gains the effect it has been declaring and not rendering.
  This is a visible change in the native host and no change at all in a browser
  preview, which is the reverse of the usual direction and the reason this must
  be judged with `npm run tauri dev`.
- `@supports` may not be used as the guard for this material anywhere. It
  reports a false positive in the one engine that matters.
- Any future request for glass on a card, the sidebar or the overlay is
  answered by this record rather than re-litigated.
- The measurement is machine-specific in its fps figures and engine-specific in
  its inertness. If WebKitGTK ships a working `backdrop-filter`, that is a new
  ADR and not a silent revert: the nested-layer arrangement is a better
  description of a receding application than a local backdrop blur is, and it
  would survive the property becoming available.
