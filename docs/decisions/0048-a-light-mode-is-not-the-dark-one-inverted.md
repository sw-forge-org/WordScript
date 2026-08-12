# 0048 -- A light mode is not the dark one inverted

Date: 2026-08-03
Status: Accepted (prototype; Stage 1b writes the tokens)

## Context

WordScript has shipped dark-only since the first build, and that was never a
decision. `docs/DESIGN_SYSTEM.md` opens with "WordScript is a dark, calm
voice-workstation utility" and the token block in `src/styles/globals.css` has
one ladder. No ADR chose dark; there was simply never a second option.

For a product used the way this one is, that is a defect rather than a
preference. The whole interaction happens from inside another application: you
are looking at a document, an editor or a mail client, you hold a shortcut, and
you keep looking at that other window. Most of those windows are bright. A
settings window that is the only dark object on a bright desktop reads as a
foreign body every time it is opened, which is the precise opposite of the
native feel the design system asks for.

The prototype's palette work made the cost concrete. `--accent: #ff9c2b`
measures 6.47:1 on the proposed card and 2.1:1 on white. The identity colour is
unusable in the room half the users are sitting in.

## Decision

**Three settings, and the third is the honest one: Light, Dark, System.**
`System` is not a third palette. It is a deferral, resolved against
`prefers-color-scheme` at render time and re-resolved when the OS changes, so a
desktop that switches at dusk is followed without a restart. A value sampled
once at boot is a guess that goes stale.

**The ladder is rebuilt, not flipped.** A dark UI raises a surface by making it
lighter than its ground. A light UI cannot do that, because the card is already
white and white does not go further. So a light UI raises a surface by moving
the GROUND down instead: window slightly grey, card pure white, sidebar
receding below the window rather than above it. Inverting the dark ladder
produces a light theme whose cards are darker than the window they sit on,
which is the tell in every theme that was generated rather than designed.

**The accent moves and the foreground on it moves with it.** `#ff9c2b` becomes
`#b45c00` — the same hue at a lightness that clears AA on white — and
`--on-accent` flips from near-black to white. The filled primary button is
therefore the dark theme's mirror rather than a bright slab with unreadable
text on it.

**The material signal inverts.** In dark, a surface states its plane with a 1px
top highlight: light comes from above, and the edge that turns toward it
catches it. On white there is no highlight available, so the same token becomes
a soft downward shadow that reads as thickness. Shadows in light are warm
(`rgba(52, 40, 22, …)`), because a neutral black shadow on a white surface
reads as dirt.

**Two things stay dark in both themes and that is deliberate.** The orb's
viewing stage, because a glow is legible only against something dark — that is
physics, not styling, and it is the same reason a colour swatch sits on a
neutral card regardless of the page. And every drawing of the dictation
overlay, which quotes `overlay-pill.css` values exactly; the overlay renders in
a transparent always-on-top window with its own compositing rules, it has no
light mode, and a drawing that invented one would be documenting something that
does not exist.

## Consequences

- `docs/DESIGN_SYSTEM.md`'s "dark, calm voice-workstation utility" is now a
  statement about one of three settings, not about the product.
- Every hardcoded colour outside the two exemptions above is a bug. The
  prototype pass pulled roughly ninety of them onto tokens, including four
  floating-shadow values that had accumulated as literals.
- The native side owes the system half of this: `window.theme()` and the
  Tauri theme-changed event, so the shell follows the OS the way the prototype
  follows `prefers-color-scheme`. Recorded in the handoff section of
  `../archive/plans/settings-rework.md`.
- Contrast has to be re-measured on the light side. The dark ladder's numbers
  in the design-system screen do not transfer, and a theme shipped without its
  own measurements is a theme nobody checked.
