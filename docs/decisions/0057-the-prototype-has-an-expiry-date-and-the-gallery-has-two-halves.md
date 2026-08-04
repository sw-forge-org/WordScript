# 0057: The prototype has an expiry date, and the gallery has two halves

Date: 2026-08-04
Status: Accepted

## Context

The port currently runs four surfaces at once, and the owner asked the obvious
question on 2026-08-04: do we really need all four simultaneously?

| | What | Where |
| --- | --- | --- |
| The demo GUI | 25 screens in vanilla HTML/CSS/JS, read-only | `docs/prototypes/settings-rework/` |
| The library | the design components and the CSS grammar | `src/components/shell/`, `src/styles/shell.css` |
| The gallery | one design-time route showing the system and the screens | `src/windows/gallery/` |
| The product | the wired settings surface | `src/components/settings/`, `src/components/areas/` |

Two of those pairs are not duplicates and never were. **The library and the
product** are components and screens-built-from-components; every application
has both. **The library and the gallery** are a thing and the surface that
displays it, which [ADR 0055](0055-the-gallery-is-where-the-port-is-judged-and-it-is-one-route.md)
already settles: *the gallery imports the product's components and never copies
them.*

The real duplication is **the demo GUI and the gallery**, and it is real only
after a specific moment. ADR 0055 says the prototype *"stops being the only
place the design exists"* and becomes *"the reference the gallery is diffed
against — read, not changed."* It does not say **when**, and that omission is
already producing drift:

- The prototype is read-only, so it can never be brought forward.
- [ADR 0056](0056-the-light-schemes-muted-step-was-measured-for-the-first-time-and-missed-aa.md)
  has already overtaken it: the prototype carries `--fg-muted: #7d766d` in the
  light scheme and the product carries `#7a736a`, because the prototype's value
  measures 4.48:1 and misses AA.

That is one hex today. Leg 3 moves the whole shell into a sheet and Leg 4 wires
25 screens; by then a reader treating the prototype as current is reading a
document that is confidently wrong in a growing number of places. This is the
same failure §15.2 already solved once, when the motion primitives were moved
out of the prototype because *"building each twice guarantees drift."*

The second half of the question is the gallery's own **Screens** section. ADR
0055 splits *ported* (stands in the gallery) from *shipped* (is wired), which is
what makes a 25-screen port possible against a runtime that cannot answer half
of it. It says nothing about what happens to the gallery entry once the screen
**is** wired — at which point that entry is a second static copy of a live
screen, which is exactly what ADR 0054 forbids for areas.

## Decision

**The four surfaces are a state of the port, not the steady state. The steady
state is two, plus a display surface.**

1. **The prototype's status changes at the end of Leg 2, from source to
   provenance.** Until then it is the thing every screen is read out of. After
   the last screen stands in the gallery, **the gallery is the source** and the
   prototype is where you look to find out *why* something is the way it is, not
   *how* it should look. It is not deleted — that was settled on 2026-08-02 and
   this record does not reopen it — and it stays read-only. What changes is
   which document a disagreement is resolved against: after Leg 2, the product
   wins over the prototype, and a difference is either an ADR or a bug.

2. **The gallery has two halves with different lifetimes.**

   - **Foundations · Components · Motion · Overlay are permanent.** They show
     every component in every state, the three schemes side by side, and the
     measured contrast that catches a token regression. The product shows one
     state at a time and cannot do this job.
   - **Screens is scaffolding.** A screen's entry there is retired in the commit
     that wires it, per screen, during Leg 4. When Leg 4 finishes, the section
     is empty and is removed with the last entry.

3. **Nothing is built in the gallery.** A control the gallery needs is built in
   the library and imported. This is ADR 0055's rule restated because it is the
   one that decides whether the gallery stays a display surface or becomes a
   second product.

## Consequences

- Leg 2 ends by flipping the prototype's status in
  `handoffs/HANDOFF_gui-port-relay.md` and in `SETTINGS_REWORK_PLAN.md` §0,
  which currently reads *"the prototype is mandatory reading"* without a
  horizon. Rule 4b of the relay — *read the prototype per screen* — applies to
  screens not yet ported and expires with them.
- Leg 4 owes one deletion per screen it wires. A leg that wires a screen and
  leaves its gallery entry standing has shipped the duplication this record
  exists to prevent.
- The steady state after Leg 6 is: the library, the product, and a gallery of
  four sections. Not four parallel descriptions of one design.
- **This is a delivery decision.** It moves no design value, and it does not
  touch ADR 0018, 0019, 0020, 0024 or 0025.
- The prototype's own README and the plan's §0 keep their historical statements.
  Where they and this record disagree about the prototype's *status after Leg
  2*, this record is later and wins; where they describe what the prototype
  contains, they are unaffected.
