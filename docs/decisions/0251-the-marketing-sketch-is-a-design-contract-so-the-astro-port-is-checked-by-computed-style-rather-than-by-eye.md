# 0251 - The marketing sketch is a design contract, so the Astro port is checked by computed style rather than by eye

Date: 2026-08-26
Status: **Accepted.** First decision covering `web/`, the product site at
wordscript.dev. It records how the settled HTML/CSS/JS sketch was carried into
the decided stack, and what a port of that kind has to prove before it is
called finished.

## Context

### A sketch that is a contract, not a draft

`web/` held a single marketing page written as plain HTML, CSS and JS. That was
deliberate: the design questions had to be settled before any build step
existed, and a build step is a bad place to argue about a heading size. By the
time the port started the sketch carried two review rounds, four answered
design questions, and a set of measurements taken against it: no overflow at
ten widths, no AA contrast failure, seven modes reaching their end state,
reduced motion complete, zero banned punctuation, a known payload.

Those measurements are the part that makes the sketch a contract rather than a
draft. A redesign discards them. A port has to reproduce them.

### The stack was decided before the sketch existed

`web/PRODUCT.md` had already recorded Astro with React islands, static output,
Tailwind v4 and Cloudflare Workers static assets, with two deviations from the
SW labs default written out: Astro rather than Next.js because the site renders
no dynamic data and reaching Workers with Next means a third-party adapter, and
Workers rather than Pages because Pages is in maintenance for new projects.

The handover then said, in one sentence, to scaffold that stack and to port the
sketch "as-is". Read as a file-level instruction those two halves contradict
each other: the sketch contains no React and no Tailwind. Read correctly they
do not, because the sketch's own opening paragraph says it is plain HTML on
purpose so that the design can be settled *before* the Astro work starts. The
sketch is the design contract. It is not the code that ships.

## Decision

### 1. The tokens are the app's tokens, under the app's own arrangement

`web/src/styles/globals.css` has the same shape as `src/styles/globals.css`:
`:root` carries the raw values, `@theme inline` exposes them as utilities under
the same names, and the component grammar is imported into `@layer components`
the way the app imports `shell.css`. A card lifted out of the app resolves
against `bg-bg-inset`, `text-fg-dim` and `rounded-control` here and means the
same thing.

The site adds exactly one token with no counterpart in the app, `--font-em`,
and the reason is stated where it is declared: the app never has to introduce
itself, so it has no use for a display serif.

The site does **not** carry the app's shadcn semantic mapping. It renders no
shadcn component yet, and a mapping written in advance of its first consumer is
a guess about what that consumer will need.

### 2. The component CSS is adopted, not translated into utilities

The sketch's 1,286 lines of component CSS moved into `@layer components`
unchanged apart from four asset paths. It was not rewritten as Tailwind
utilities, and this is the decision most likely to be questioned later.

The reason is that the derivations live in the comments. Why `--fg-muted` steps
up to `--fg-dim` once the ground lifts to `--bg-elevated` is four lines of
prose beside the rule that does it, and it is the record of a contrast finding.
Why the ground is grain rather than a dot matrix is a paragraph about what a
blank canvas sells. A utility class at the call site has nowhere to put either.
Translating the file would have deleted the reasoning and forced every measured
value to be taken again.

Tailwind is still present and still load-bearing: it supplies preflight, the
token-to-utility bridge, and the substrate for anything built here next.

### 3. Four islands, and the rest is zero JS

What hydrates is what animates, and nothing else:

| Island | Why it cannot be static |
|---|---|
| `HeroStage` | drives the live capsule and types a transcript |
| `Demo` | three tabs, seven modes, three intakes, a desk; cancellable sequences |
| `Wiring` | a two-state diagram with a switch, and SMIL that has to be paused by hand |
| `Band` | a sampled waveform redrawn on a timer and on resize |

Everything else is `.astro` and ships no JS: the header, the hero copy, the
focus band, the research timeline, the activity field, the feature list, the
FAQ, the close, the footer. One small page script owns the scroll reveal, the
sticky header and the count-up, because those are behaviour over
server-rendered markup rather than surfaces of their own.

Two surfaces the sketch built at runtime are now built at build time, which is
what removed them from the bundle: the fifteen focus-band marks are read out of
the `simple-icons` package, and the activity field's 364 cells are cut from a
constant. The field's data must **not** follow the icons into generation: it
stands in for a reading taken off a file, and a field that reshuffles per build
is decoration on a slower clock than one that reshuffles per visit.

### 4. Imperative surfaces stay imperative behind a ref

The four islands render their own markup as JSX, so the served HTML contains
every frame, label and control before hydration. What the effect adds is the
motion, and it adds it through the sketch's own machinery lifted into typed
modules under `web/src/lib/`.

A typing sequence that writes 380 intermediate states is not derived state, and
restating it as `useState` would be a rewrite of the one thing on the page that
must not change: the capsule is the app's own surface, rebuilt against the
geometry in `src/styles/overlay-pill.css` and driven through the runtime's own
`levelToBars` curve. React holds the frame. The scene modules drive it.

### 5. A port is finished when the computed styles match, not when it looks right

This is the part worth carrying to the next port of anything.

The port was accepted against a computed-style diff: 78 selectors across 22
properties, 1,716 comparisons, both pages served side by side at 1440x900. It
came back with 64 differences in exactly two classes, and both were read before
being dismissed:

- **63 x `border-top-style: none` to `solid`**, at `border-width: 0`. Tailwind's
  preflight sets a border style on every element so that a later `border-2`
  needs one declaration rather than two. Nothing renders.
- **1 x `box-shadow` serialisation.** `color-mix(in srgb, white 34%, transparent)`
  reaches the browser as `color(srgb 1 1 1 / 0.34)` when the browser evaluates
  it and as `rgba(255, 255, 255, 0.34)` when Lightning CSS evaluates it at
  build time. The same colour, resolved earlier.

Every font, size, weight, stretch, tracking, colour, radius, padding, margin,
gap, shadow and box metric was identical.

**The diff also found the one real regression, which no screenshot would have
shown.** The ASCII band's `<pre>` was empty until its island hydrated, so the
strip stood one line tall instead of seven and the page grew 58 px under the
reader as they scrolled to it. The frame needs the viewport width to compute;
the height it will occupy does not. The server now prints seven blank rows, and
the band measures 97.8594 px on both pages before any script runs.

## Consequences

### The bundle

Our own JavaScript went down, from 21.9 KB gzipped to 15.4, because the icon
paths and the activity data left it. The CSS went down, from 16.6 to 12.2. The
HTML went up, from 8.0 to 15.3, and that is the markup the JS used to build.

The React runtime adds 59.0 KB gzipped in three chunks, and the page transfers
101.9 KB against the sketch's 46.5. That cost belongs to the island runtime
rather than to anything on the page, and the lever against it is
`preact/compat`, which keeps every component and every island boundary as
written. It has not been pulled, because React is what `PRODUCT.md` records and
a runtime swap is a stack decision rather than a port decision.

### What the sketch becomes

`web/index.html`, `web/site.css`, `web/site.js` and `web/fonts/` are the
contract the port was checked against, and they stay until the port has been
seen in a browser by the owner. After that they are a spent plan and belong in
`docs/archive/`, not beside the code that replaced them.

### What this does not close

The site is built and it is not publishable. `web-launch-gate` has not run,
there is no imprint and no privacy notice, and the Zodiak licence text is not
in `web/public/fonts/` beside the two SIL OFL files. Nothing may be deployed to
wordscript.dev before those are closed, and the domain still has an empty zone.
