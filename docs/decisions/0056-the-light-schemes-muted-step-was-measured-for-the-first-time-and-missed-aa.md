# 0056: The light scheme's muted step was measured for the first time, and missed AA

Date: 2026-08-04
Status: Accepted

## Context

[ADR 0048](0048-a-light-mode-is-not-the-dark-one-inverted.md) built the light
ladder and closed with an obligation it could not discharge itself:

> Contrast has to be re-measured on the light side. The dark ladder's numbers in
> the design-system screen do not transfer, and a theme shipped without its own
> measurements is a theme nobody checked.

Nothing had discharged it. The prototype's Design System screen carries the dark
figures as literals — `--fg 11.80`, `--fg-dim 7.37`, `--fg-muted 4.71`,
`--accent 6.47` — and switching that screen to the light scheme changes every
colour on the page while leaving those six numbers exactly where they are. The
light values had been chosen by eye against the dark ones' roles and had never
been computed.

Leg 1 of the GUI port built Foundations to measure the live tokens at render
time rather than to print stored figures (ADR 0055 asks for "measured
contrast"). The first switch to the light scheme therefore produced the first
measurement of it. Against the light card, `#ffffff`:

| Token | Value | On card | |
| --- | --- | ---: | --- |
| `--fg` | `#1a1815` | 17.72:1 | ✓ |
| `--fg-dim` | `#55504a` | 7.98:1 | ✓ |
| `--fg-muted` | `#7d766d` | **4.48:1** | ✗ |
| `--accent` | `#b45c00` | 4.70:1 | ✓ |
| `--success` | `#1e6f4c` | 6.12:1 | ✓ |
| `--danger` | `#b3271b` | 6.52:1 | ✓ |

Five of six clear AA. The muted step misses it by two hundredths.

Two hundredths is not a rounding artefact worth waving through, because of what
that particular token is for. `../archive/plans/settings-rework.md` §5.1 argues the entire
dark lift partly on this one figure: today's `--fg-muted` measures 3.89:1 on the
shipped card and the proposed one measures 4.71:1, so *"`--fg-muted` clears AA
for the first time and is restricted to labels and counts"*. A light scheme in
which the same token does not clear AA is that defect mirrored — and it would
have shipped inside the pass whose stated purpose was to remove it.

ADR 0048's own verdict applies to itself here: a theme shipped without its own
measurements is a theme nobody checked.

## Decision

**The light scheme's `--fg-muted` moves from `#7d766d` to `#7a736a`.**

The value is picked to mirror the dark side rather than to be safely dark. On
the card, `#7a736a` measures **4.68:1** against the dark scheme's **4.71:1**:
the two schemes now sit at the same distance above AA, which is what makes them
one system set twice rather than two palettes with different tolerances. A
darker value would clear AA by more and would also make the light surface's
tertiary text heavier than its dark counterpart, which is a different design
than the one ADR 0048 accepted.

**The confinement rule survives intact and is now measured on both sides.**
`--fg-muted` is confined to the card plane in dark because it is 4.71:1 there
and 3.94:1 on `--bg-elevated`. The same holds after this change in light —
4.68:1 on the card, 4.08:1 on elevated, 4.23:1 on the window, 3.80:1 on the
inset — so the rule ports without an exception, and so does its consequence: a
row carrying muted text does not change ground on hover.

**Nothing else in either ladder moves.** In particular `--accent: #b45c00`
stands: ADR 0048 claims it is "the same hue at a lightness that clears AA on
white", and the measurement confirms it at 4.70:1.

## Consequences

- ADR 0048 is not edited. Its light `--fg-muted` value is superseded by this
  record; every other value it sets is confirmed by measurement for the first
  time, which is the more useful half of this finding.
- The prototype at `docs/prototypes/settings-rework/` still carries `#7d766d`
  and still prints the dark figures on both sides of the theme switch. It is
  read-only from ADR 0055 and is not corrected; where it and the product now
  disagree, this record says which is right. A reader diffing the gallery
  against the prototype will find this one hex apart, deliberately.
- **A stored contrast figure is a figure that stops being true when the colour
  moves.** Foundations measures at render time for that reason, and this defect
  is the argument for it: the number had been printed correctly beside the wrong
  palette for a whole pass. No surface in this product should print a contrast
  ratio it did not compute from the value it is describing.
- The light ladder has now been measured once. It has still never been *looked
  at* on the target panel in the native host, which is a different check and
  belongs to the same leg.
