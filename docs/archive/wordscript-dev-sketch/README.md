# The wordscript.dev sketch

**Frozen. This is the design contract the Astro port was checked against, not
code that runs anywhere.** The site is `web/`; a claim in these three files that
disagrees with what `web/src/` renders today is a claim that was true on
2026-08-26.

`index.html`, `site.css` and `site.js` were a single marketing page written as
plain HTML, CSS and JS, deliberately without a build step so the design could be
settled before one existed. By the time the port started the sketch carried two
review rounds, four answered design questions, and a set of measurements taken
against it: no overflow at ten widths, no AA contrast failure, seven modes
reaching their end state, reduced motion complete, zero banned punctuation, a
known payload. Those measurements are what made it a contract rather than a
draft, and [ADR 0251](../../decisions/0251-the-marketing-sketch-is-a-design-contract-so-the-astro-port-is-checked-by-computed-style-rather-than-by-eye.md)
is how the port proved it reproduced them.

The same ADR says these files stay beside the code only until the port has been
seen in a browser by the owner, and belong here afterwards. It has been; ADRs
0253 through 0258 are the rounds that followed, and they moved the page past
this sketch in several places -- the hero became a pinned plane (ADR 0254), the
engines section became a picker, the phone got its own navigation (ADR 0255).
**Read these files for a derivation, never for current layout.**

## What does not resolve here

- **The fonts are gone and the `@font-face` paths are dead.** `site.css`
  declares four faces out of a sibling `fonts/` directory that is not in this
  archive. Three of the six files it held were Zodiak, which the ITF Free Font
  License 2.0 forbids passing on through a repository, and the other three were
  byte-identical duplicates of `web/public/fonts/`. Opening `index.html` renders
  in fallback faces. `web/public/fonts/NOTICE.txt` carries the licence reading.
- **The asset paths point at the sketch's own tree.** Four of them were rewritten
  during the port; here they are as the sketch had them.
