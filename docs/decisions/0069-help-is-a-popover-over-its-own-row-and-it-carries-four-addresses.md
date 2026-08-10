# 0069: Help is a popover over its own row, and it carries four addresses

Date: 2026-08-10
Status: Accepted

Supersedes the FORM and the COUNT of
[ADR 0066](0066-help-is-a-small-modal-with-three-links-which-is-what-finally-mounts-the-row.md).
Everything else that record decided still holds: the row is mounted in the
commit that builds what it opens, every link opens through `openUrl`, the URLs
live in `lib/appMeta.ts`, and a URL that does not resolve yet may not be drawn
as a working link.

## Context

ADR 0066 was taken on 2026-08-10 against a sidebar row that three legs had
deliberately left unmounted, and it decided two things at once: **that** Help
gets a surface, and **what shape** that surface has. The first was right. The
second was decided without one, because there was nothing to look at — the
prototype draws the row and not what it opens, so the modal was reasoned about
rather than seen.

Leg 4d built it as ADR 0066 described: a small sheet from the `Sheet` family,
centred behind a scrim, carrying three rows. The owner saw it and named two
faults the same day:

1. **It is centred and it should not be.** A scrim plus a centred panel is the
   weight of the settings sheet, and the settings sheet earns it — configuring
   something is a detour you come back from, and the scrim is what says the
   workspace is still there. Reading four link names is not a detour. The panel
   belongs over the row that opened it.
2. **The product's own site is missing.** ADR 0066 listed Discord, GitHub and
   the documentation from memory. `https://wordscript.dev` exists and is the
   first address a person looking for help would try.

ADR 0066 also rejected a menu in as many words: *"it is three destinations with
names worth reading, which a bare menu renders as three anonymous strings."*
That objection is to a BARE menu — a list of labels. It does not apply to
`.ws-menu`, which carries a glyph, a label and a hint per entry, and which the
float bar has been using for exactly that reason since Leg 2d.

## Decision

**The `Help` row opens `.ws-menu` anchored above itself, carrying four entries:
Website, Discord, GitHub, Documentation.**

- **A popover, not a modal.** No scrim, nothing behind it is dimmed, and the
  window does not recede. It closes on a press outside it, on Escape, and on
  choosing an entry.
- **It is the library's existing menu, not a new one.** `Menu` and `MenuEntry`
  are `components/shell/FloatBar.tsx` and `.ws-menu` is in `shell.css`; the only
  thing Leg 4d added to either is `align="start"` and the two properties an
  entry needs to be live rather than drawn — `onSelect` and `disabled`. The
  float bar's menu is the same component under the same rules.
- **`align="start"` exists because the sidebar is narrower than the float bar.**
  `.ws-menu` is a fixed 230 px centred on its anchor, which spills out of both
  edges of a 200 px sidebar. The start variant takes the anchor's width.
- **The row and the panel are one component.** A popover positions against the
  nearest positioned ancestor, so the row it opens over has to be inside the
  same box — which also puts the outside-press check on the right element, so a
  press on the row toggles instead of closing and reopening in one gesture.
- **The documentation entry is drawn and inert**, with `No address yet` as its
  hint (ADR 0065). Leaving it out would teach the reader that WordScript has no
  documentation; drawing it live would open a 404.
- **`APP_PRODUCT_URL` is a new constant and is not `APP_SITE_URL`.** The latter
  is SW labs' site and is what About's Project card links under that name. Two
  different addresses under one constant is how a link ends up saying the wrong
  thing on one of the two surfaces that use it.

## Consequences

- **Nothing is measured by `npm run port:diff`, and that has not changed.** The
  prototype draws the row and not what it opens, so this is still judged by eye
  against `DESIGN_SYSTEM.md`. What changed is that it is now judged against a
  component the design system already contains rather than against a new panel.
- **The Escape stack got simpler rather than deeper.** The popover listens in
  the bubble phase, which puts it under the command palette's capture listener
  automatically: while the palette is up, the key is the palette's and this
  never sees it. No flag had to be passed.
- **`Sheet` keeps the `closeOnEscape` prop the modal version introduced.** It is
  the settings sheet's, and it is what keeps Escape from closing settings out
  from under an open palette. It is not orphaned by this record.
- **About & Updates is still untouched**, for the reason ADR 0066 gave: its
  Project card is a drawn card the gallery still measures, and appending
  Discord to it would be a gallery change with its own record.
