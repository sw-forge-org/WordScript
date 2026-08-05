# 0059: The gallery gets a chord, because four legs paid for a rebuild instead

Date: 2026-08-05
Status: Accepted

## Context

[ADR 0055](0055-the-gallery-is-where-the-port-is-judged-and-it-is-one-route.md)
makes `/gallery` the acceptance surface for the port and sets its terms: one
design-time route, in the shipping bundle, lazy-loaded, using no Tauri API and
**linked from no product surface** — the same terms `/component-lab` already
shipped under. Its stated consequence is that the palette, the frost pair and
the light scheme *"become checkable in WebKitGTK with one `npm run tauri build`
and a walk through Foundations"*.

That consequence does not hold, for a reason nobody had checked when it was
written. Every window's URL is pinned in `src-tauri/tauri.conf.json` —
`#/overlay`, `#/settings`, `#/rebuild-lab` — no window opens `#/gallery`, and
relay rule 6 puts that file out of scope for Legs 1–4. There is no address bar
in a Tauri window and, on this machine, no synthetic pointer or key event can be
delivered to one either (recorded by Legs 1, 2a, 2b, 2c and 2d).

So four legs looked at the gallery the only way available: temporarily point the
`/settings` route at `GalleryWindow`, hoist whatever sits below the fold to the
top of a screen, run a full `npm run tauri build`, capture the window, and revert
all of it before committing. Leg 2d lost its second native-host look to exactly
this — a build interrupted mid-link cost a full dependency rebuild, and the agent
overlay went unlooked-at for a leg because of it.

## Decision

**The gallery is reachable in a built application by a keyboard chord:
`Ctrl`/`Cmd` + `Shift` + `Alt` + `G`, handled in `App.tsx`, which navigates to
`/gallery`.**

ADR 0055's terms are unchanged and the chord does not breach them. *Linked from
no product surface* is a statement about what a user can find: no surface names
the gallery, nothing announces the chord, no affordance leads to it, and it
appears in no menu, sidebar, palette or help text. What the chord replaces is the
temporary route edit — the same act, performed by whoever is working on the port,
costing five lines instead of twenty minutes of `cargo`.

The chord is deliberately awkward. Three modifiers plus a letter is not a
sequence anything types by accident, and it collides with no shortcut this
product or a common desktop environment registers.

## Consequences

- **A leg looks at the gallery in the native host without a build.** That is the
  whole benefit and it compounds: Leg 4 wires screen by screen with the ported
  drawing to compare against, and the comparison is now one chord away.
- **The hoist recipe is still needed for anything below the fold**, because
  synthetic input still cannot be delivered to the window and a chord cannot
  scroll. What goes away is the route edit and one of the two reasons to rebuild.
- **This expires when the gallery gets a window.** One entry in
  `tauri.conf.json` is the permanent fix and it belongs to the first leg allowed
  to open that file — Leg 5 under rule 6. The chord is deleted in the same commit
  that adds the window; two doors to a design-time route is one more than the
  route deserves.
- **It ships.** The route already did (ADR 0055 accepted that cost as a few
  kilobytes on a build nobody has installed), and a `keydown` listener is not
  measurably more. Under ADR 0054 there is no user to stumble into it, and that
  decision expires at the first distributed build — whoever ships that build owes
  a check that this chord and the route behind it are still wanted.
