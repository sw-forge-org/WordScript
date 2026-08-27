# 0259 - The deploy runs from the repository, so the accent face is one the repository may carry

Date: 2026-08-27
Status: **Accepted.** Ninth decision covering `web/`, the product site at
wordscript.dev. It changes the site's emphasis typeface and the check that
guards the typefaces, and it does so because the deployment model changed. It
supersedes the font half of [ADR 0258](0258-the-legal-pages-state-the-stack-the-site-really-has-and-the-fourth-footer-link-is-removed-rather-than-written.md)
-- that record's reading of the ITF Free Font License stands and is what forces
this one. No copy, no layout and no island is reopened.

## Context

### The deploy moved onto a machine that only has the repository

The site was built and deployed from one machine. `npm run deploy` ran the
build, then `scripts/launch-check.mjs`, then wrangler, all in a working tree
that had everything in it. Under that model a file could be present locally and
absent from version control and nothing was wrong.

The owner decided the deploy should run on every push instead, through
Cloudflare Workers Builds. That build starts from a clone. **Everything the
page needs has to be in the repository, because the repository is all the build
machine gets.**

### One of the four typefaces could not be in the repository

ADR 0258 read the ITF Free Font License 2.0 and got it right. Section 01
expressly permits self-hosting Zodiak and calls it the recommended way to use
the font. Section 02 forbids passing it on and names repositories, download
services and publicly accessible servers among the ways that is done. Serving
the file to a reader is the permitted case. Committing it to a public
repository is the forbidden one, and `sw-forge-org/WordScript` is public.

So Zodiak was gitignored and a fresh clone had to fetch it by hand from
Fontshare. `launch-check.mjs` failed the deploy while it was missing and failed
again if it ever appeared in the index. That was a correct answer to the
question as it stood.

Under Workers Builds it stops being an answer at all. The clone has no font,
`astro build` does not care, and the deploy succeeds. What ships is a page that
preloads `/fonts/zodiak-400-italic.woff2`, gets a 404 on every load, and draws
its display italic in whatever the fallback stack supplies. **Nothing fails.
The page is just quietly wrong**, which is the failure mode this project's
checks exist to prevent.

### The near miss that came first

The rule that kept Zodiak out named one path,
`web/public/fonts/zodiak-400-italic.woff2`. A second copy of the same face sat
one directory up in the sketch's own `fonts/`, together with two further
weights, none of them covered. Committing `web/` as it stood would have pushed
three Zodiak files to a public repository. The rule was widened to a glob and
`launch-check.mjs` was widened to ask the whole checkout, and both of those are
now gone with the font -- but the shape is worth keeping: **a licence attaches
to a font, so a rule that attaches to a path is one copy away from being
wrong.**

## Decision

### 1. The face is replaced rather than the pipeline worked around

Three ways to keep Zodiak were considered, and each one buys the same font at a
recurring price:

| Way | What it costs, permanently |
|---|---|
| Base64 in a build variable | 31,312 bytes of base64, past the per-variable limit, so it would have to be chunked and reassembled |
| Private R2 bucket, fetched in `prebuild` | a bucket, a token to rotate, and a network call whose failure mode is a page with no serif |
| Fontshare API at runtime | a third-party request on every load, which contradicts the third-party inventory `/privacy` states and puts the site back inside TDDDG section 25 |

All three keep a permanent tax to hold one 23 kB file. **The licence attaches
to the font, so the only fix that ends the problem is a font whose licence
permits what this repository does.**

### 2. Fraunces italic 400, chosen by eye against five candidates

The candidates were rendered into the real hero line, with the real Archivo,
the real accent and the real ground, and read side by side. Every one of them
is OFL 1.1.

| Candidate | x height | Read |
|---|---|---|
| Zodiak (the face being replaced) | 0.5075 | broad, warm, high contrast |
| Instrument Serif | 0.5150 | closest optical slot, but condensed |
| **Fraunces** | **0.4425** | **old style, live optical size axis. Chosen.** |
| Bodoni Moda | 0.4700 | hairlines break up at the pull quote's 19 px |
| Newsreader | 0.5250 | reads as italicised Archivo, so it stops being emphasis |
| EB Garamond | 0.4150 | too quiet for display |

The owner chose Fraunces from that rendering. It is not the closest match to
Zodiak -- Instrument Serif is -- and it was not picked as a substitute.

### 3. The emphasis ratio is re-derived, not converted

`site.css` carried `font-size:1.04em` on the `em` rule, as the measured
correction that matches the serif word's x height to its Archivo host.

The instrument renders the glyph `x` at 400 px into a canvas and measures the
ink upward from the baseline. Run against the old pair it returns Archivo 600 at
0.5275 and Zodiak italic at 0.5075, a ratio of 1.0394 -- **which reproduces the
1.04 that was already there.** The instrument was validated against the record
before it was trusted with a new number.

Against the new pair it returns Fraunces italic at 0.4425 and a ratio of 1.1921.
The rule becomes `font-size:1.19em`.

**One ratio still serves all three call sites, and that had to be checked
rather than assumed.** Fraunces has a live optical-size axis, so a ratio taken
at one size could have been wrong at another. Measured at 19, 23, 48 and 200 px
its x height runs 0.4694 to 0.4700. The axis moves the drawing, not the x
height.

### 4. The variable cut is shipped, and the 42 kB are bought on purpose

A pinned instance is 22,852 bytes against the variable font's 42,228. It was
rejected because the optical-size axis is doing real work: measured here, the
word `once` at 48 px is 94.73 px wide at opsz 48 and 80.75 px at opsz 144, a
difference of 15 per cent. The three places that reach `--f-em` run at roughly
16, 23 and 48 px, so no single pinned optical size is right for them.
`font-optical-sizing` stays at its default of `auto`.

The declared range is the font's own 9..144 rather than the 16..48 the page
uses, because Google serves the same file for all three requests. That was
checked, not assumed.

### 5. The typeface check asks the question a clone asks

The old check asked whether one named font was absent from the index. The new
one reads `src/styles/globals.css`, takes every face it declares, and requires
each to be in the tree **and** in version control, plus one licence text per
family. Both lists come out of the tree rather than out of the script, because
a check carrying its own copy of a list passes while the list drifts.

**It counts families, not files.** The first version of this check counted
`src` urls against `LICENSE-*.txt` files and failed a correct tree: Plex Mono is
declared twice, at 400 and 500, and has one licence.

### 6. The gate runs in the build command, because a repo deploy never reaches `npm run deploy`

Workers Builds runs a build command and a deploy command as two separate steps.
The obvious pair is `npm run build` and `npx wrangler deploy`, and that pair
**silently drops the launch gate**: `scripts/launch-check.mjs` lived in
`npm run deploy`, which nothing in that pair calls. The checks for an unfilled
placeholder, a repealed statute, a dead dispute-resolution link and the site's
banned punctuation would have stopped running on the only path that publishes.

So the build command is `npm run build:ci`, which is the build followed by the
gate. A failing gate fails the build and nothing is deployed. It is a separate
script rather than a change to `build`, because the gate firing during ordinary
development is what teaches people to skip it -- the reasoning is in the
script's own header and is not reopened here.

**Both scripts had to be rewritten to call `npm run build` rather than
`astro build`.** npm's `pre` hooks are matched by script name, so `prebuild`
fires for `build` and for nothing else. `deploy` had read
`astro build && ... && wrangler deploy` since it was written, which means it had
never run `scripts/sync-assets.mjs` -- every deploy would have shipped whatever
`public/assets/` happened to hold, and that directory is gitignored, so on a
clone it holds nothing. The bug was invisible because a person runs
`npm run build` first out of habit. A build machine does not.

## Consequences

- **A fresh clone builds a complete page.** Verified rather than argued: a
  `--depth 1` clone, `npm ci`, `npm run build`, and every one of the four
  `/fonts/*.woff2` paths the built HTML and CSS ask for resolves inside `dist/`,
  with the app's logos and icons copied in by `sync-assets.mjs`. No font is
  fetched by hand and no secret exists.
- **`/terms` states one licence for all three faces**, and that sentence is
  true rather than convenient. The comment above it carries the earlier draft
  that collapsed three licences into one while one of them was different, and
  says what to re-read if a fourth face is ever added.
- **The `.gitignore` entry is gone, and its absence is commented.** A rule that
  disappears without a note reads as an oversight to whoever finds the gap.
- **The site's payload grows by 19 kB on the index** and shrinks by 23 kB on
  every other route, which never drew the display italic and no longer carries
  a face they cannot use.

## What this does not close

The imprint still has no second contact channel and `launch-check.mjs` still
fails on it. The owner has said the number is coming. Until it lands the custom
domain route in `wrangler.jsonc` stays commented, so a deploy produces a Worker
reachable at no hostname. The three gates with no artefact in this repository --
the Cloudflare Web Analytics switch, the legal review, the manual accessibility
pass -- are unchanged and still printed by the check rather than enforced by it.
