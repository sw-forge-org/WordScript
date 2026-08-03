# 0055: The gallery is where the port is judged, and it is one route

Date: 2026-08-04
Status: Accepted

## Context

The prototype is the accepted shape of the surface and it cannot be looked at
inside the product. It is vanilla HTML under `docs/prototypes/settings-rework/`,
outside the Vite root, imported by nothing and routed nowhere — which is
deliberate (§8: *"not imported by `src/`, not routed in `App.tsx`, no Tauri
API"*) and which is also why §11.13 found the palette gate unrunnable: a native
host shows the shipped surface with the shipped tokens, so the proposal is
judged by looking at something that is not the proposal. `npm run tauri dev` was
additionally recorded as not runnable here on 2026-08-03; the production build
is.

Meanwhile `src/` has grown two design-time surfaces of its own, both real and
both unlinked:

- `/overlay-gallery` — `OverlayGallery.tsx`, every `OverlayPill` state on a
  neutral backdrop with a mock level slider (Phase 1).
- `/component-lab` — `ComponentLabWindow.tsx` over `src/lab/`, the four motion
  primitives that §15.2 moved out of the prototype because *"a motion model
  cannot be judged from a still and building each twice guarantees drift"*.

Add the prototype's own Design System screen and the system is currently
demonstrated in three places, none of which is the product. Under ADR 0054 the
port overwrites the shipped surface, so there is no longer a live old screen to
compare a new one against either.

## Decision

**One design-time route, `/gallery`, is the acceptance surface for the port.**

It is a single route in the shipping bundle, lazy-loaded, using no Tauri API and
linked from no product surface — the same terms `/component-lab` already ships
under. It carries five sections:

| Section | Contents |
| --- | --- |
| **Foundations** | Tokens in all three schemes, measured contrast, type scale, spacing rhythm, the radius ladder, elevation and the frost pair (ADR 0051) |
| **Components** | Every shell primitive in every state, on the real components |
| **Motion** | The four `src/lab/` primitives — the present `/component-lab`, folded in |
| **Overlay** | Every `OverlayPill` state — the present `/overlay-gallery`, folded in |
| **Screens** | Every screen of the prototype, at the prototype's fidelity |

`/overlay-gallery` and `/component-lab` are retired as routes when their content
lands here. Two unlinked design-time routes were already one too many; five would
be a second product.

**A screen is *ported* when it stands in the gallery and *shipped* when it is
wired.** Those are two different acts with two different gates, and separating
them is what makes a 1:1 port of a 25-screen design possible against a runtime
that cannot yet answer half of it (§11.36, §11.52). The gallery renders sample
data and asserts nothing about readiness, so building a screen there is not the
fake state the runtime rules forbid — the fake state would be putting that same
screen on a product surface and letting it imply the runtime reached it.

**The gallery imports the product's components. It never copies them.** A screen
in the gallery and the same screen in the product are one implementation with
two sets of props. This is the rule that already keeps onboarding honest in the
prototype, where `providerGrid()` and `modelRow()` are shared by both surfaces
rather than drawn twice (§11.39).

## Consequences

- The palette, the frost pair and the light scheme become checkable in WebKitGTK
  with one `npm run tauri build` and a walk through Foundations, without a dev
  server and without the shipped surface having to change first. §11.13's
  checkpoint has a place to happen.
- The prototype stops being the only place the design exists, and it stops being
  edited. It becomes the reference the gallery is diffed against — read, not
  changed. Its two large files keep the exact-match editing rule for as long as
  anyone touches them at all.
- The gallery ships in the bundle. That is a deliberate cost: an unlinked lazy
  route is a few kilobytes on a build nobody has installed (ADR 0054), and the
  alternative — a second Vite entry or a Storybook — is a second build system to
  keep true. Storybook was already removed from this repo once.
- A screen with no runtime path yet has somewhere to be complete. The
  outstanding runtime contracts stop blocking the port and start being what they
  are: a list of what the wiring stage will need, discovered from a finished
  design rather than guessed at in front of one.
- **The gallery must not become the only place a component is correct.** If a
  primitive looks right in the gallery and wrong in the product, the gallery is
  what lied. The section that finds that is the one that owes the fix.
