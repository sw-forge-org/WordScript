# 0262 - The social card is drawn from the site's own tokens, and drawing it is not a build step

Date: 2026-08-27
Status: **Accepted.** Twelfth decision covering `web/`, the product site at
wordscript.dev. It replaces `assets/OG.png`, adds the script that produces it
and changes one field in `src/lib/site.ts`. No copy on the page, no layout and
no island is reopened.

## Context

### The card was older than the design it was standing for

`assets/OG.png` entered the repository on 2026-05-13, in a commit about the
README's logo. Every line of the site's design system was written after it. It
was never wrong when it landed; it simply stopped being about the same product
as the page it was attached to, and nothing in the tree could notice.

Four things it carried, each checkable against the built site rather than a
matter of taste:

- **An italic the site never sets.** The name itself is the real wordmark --
  compared glyph for glyph against `assets/wordscript_wordmark.png`, it is that
  file. The two lines under it are not: they are a sans italic, and
  `globals.css` declares Archivo in the roman only, Fraunces in the italic only
  and Plex Mono. **The page sets a sans italic nowhere**, so the sentence
  carrying the whole pitch was in the one cut the product never uses.
- **The app icon at nine times the width the header gives it.** Measured off
  the file, the icon's ink runs 242 by 246 pixels on that card against the 26
  by 27 of `.brand img`. `wordscript-icon-128.png` is drawn with a border, and
  a border is chrome at 26 and a picture frame at 242.
- **A sentence naming the category the product is trying to leave.** The card
  read that you speak into any text field and that it is native, open and
  without a subscription. Speaking into a text field is what every peer opens
  on. Meanwhile `SITE.ogDescription` -- the line a platform renders directly
  under that image -- reads that you speak once, it lands, it stays, it acts.
  **A preview showed both at the same time**, so the card was arguing against
  the page's own strongest claim inside a single card.
- **No ground.** Flat black. The page's opening plane is a lit ruled sheet with
  paper grain over it, and that surface is the one thing on this site that
  could not belong to any other product.

### The general problem is that the card was hand-made

Any of the four could have been fixed by drawing a better still. That leaves
the mechanism intact: a picture made once, by hand, from a design that then
keeps moving. The palette, the wordmark and the opening claim have all changed
since May, and each change silently widened the gap.

## Decision

### 1. The card is rendered from the page's own stylesheets

`web/scripts/make-og.mjs` is the only place the card exists. It composes an
1200x630 page out of the values the site already ships and photographs it with
headless Chrome:

| On the card | Where it comes from |
|---|---|
| ground, ink, accent, danger, radius, elevation | the `:root` ladder in `globals.css` |
| the lamp and the ruled sheet | `.pin` and `.pin::after` in `site.css`, rules at the lede's 26px line box |
| the paper grain | the `body::after` turbulence in `globals.css` |
| the heading and the one italic | the `h1` and `em` rules in `site.css`, at 1.19em |
| the lock-up | the header's icon plus the wordmark as a mask tinted with `--fg` |
| the fact strip | the hero's `.hero__facts`, same three facts |
| the window | `.stage__win` and the cleanup scene in `src/lib/scenes/cursor.ts` |

**The window is why the card is worth redrawing at all.** It carries the
demo's own two rows -- a dictated line with `um` and `the the` tinted, and the
delivered sentence under it -- so the card shows the claim beside the sentence
that makes it. The alternative, the heading alone on the lit sheet, was drawn
and read side by side with it; it is the calmer card and it only asserts.

### 2. Drawing it is not a build step, and that follows from ADR 0259

The deploy starts from a clone on a machine that has the repository and
nothing else. A build machine with no Chrome cannot draw this card, and a
`prebuild` that needed one would fail the deploy over an image that had not
changed. So the PNG is committed, `scripts/sync-assets.mjs` copies it into
`public/` exactly as before, and `npm run og` redraws it on a machine that has
a browser. The script is the record of how; nothing enforces that the two agree.

### 3. Everything the page loads is inlined as a data: URI

A `file://` page in headless Chrome cannot read a sibling file without
`--allow-file-access-from-files`. The failure is silent in the worst possible
way: a `mask` whose image does not load paints nothing, so the card comes out
with the wordmark missing and the run reports success. Base64 costs about
200 KB of temporary string and cannot fail halfway.

### 4. The strip is words where the page uses marks

`osMarks.ts` measured its set at 16px against the strip's 11px type and dropped
the GNU head for being a smudge there. A card is met at roughly a third of its
drawn width in a feed, so a mark drawn for this card would arrive at about five
pixels. Words reduce to texture at that scale and read exactly when the card is
opened, which is the only two states a card has.

### 5. The palette step is optional and the grain pays for it

Chrome writes truecolour and the card costs 617,727 bytes -- three times what a
file every link preview fetches should cost. The image is one dark wash, one
warm lamp and four type colours, so 255 entries hold it: **200,272 bytes, at
0.776 per cent RMSE against the truecolour original**, with no banding in the
lamp, because the paper grain is already a dither. Compared at 200 per cent on
the gradient the two are not told apart. ImageMagick is not a dependency of this
repository, so its absence prints a line and ships the truecolour PNG.

### 6. The card does not correct the page, and it nearly did

Fraunces italic rides on a slope and reads tight against the roman before it,
and the first pass padded the `em` here. Measured, that was unfounded: the gap
between the right edge of `Speak` and the ink of `once` is 7.58px at the page's
largest heading size of 48, 11.06 at the card's 70 and 15.16 at 96 -- ratios of
0.1579, 0.1580 and 0.1579. The setting is identical at every size. A correction
made only on the card would have been the card disagreeing with the page about
the same three words, invisibly, for as long as nobody compared them.

### 7. The alt text describes the picture, not the product

`SITE.og.alt` read `WordScript`, which is the one thing a reader who cannot see
the image already has: the title sits beside it in every preview that renders
the card. It now describes what the picture carries and the title does not --
the heading, and the window holding a dictated line with its fillers marked and
the cleaned sentence delivered under it.

## Consequences

- **The preview and the line under it now say the same thing.** The card, the
  `og:description` and the page's own `h1` are one claim in three places.
- **Redrawing is one command, and it is byte-stable.** `npm run og`, on any
  machine with a Chrome. Two consecutive runs produce the same md5, so a
  re-render with nothing changed leaves no diff to review.
- **The file grew by 65,889 bytes**, from 134,383 to 200,272. What was bought
  is the ground and the window.
- **`astro check` reports 0 errors and 0 warnings across 55 files**, the built
  card is 1200x630 as the Open Graph block declares, and `npm run launch-check`
  reports no blockers in `dist/`.
- **The repository's own banner changed with it.** `README.md` opens on
  `assets/OG.png`, so this file has a second reader who never sees the site.
  Nothing had to be done for that, and it is the reason the card carries the
  lock-up rather than assuming a title above it: on GitHub there is none.

## What this does not close

- **Nothing checks that the committed PNG is what the script would draw
  today.** The card can drift from the page again; what has changed is that
  closing the gap is a command rather than a redesign, and that the script says
  which rule each element came from. A gate would have to run a browser in CI,
  which is the thing decision 2 declines.
- **The page's own word space is untouched.** If the roman and the italic are
  ever tightened, that happens in `site.css`, where the card reads it too.
