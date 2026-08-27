# 0256 - The pinned plane is gated on the width that gives it a layout, and the page answers the in-app browser bar it cannot see

Date: 2026-08-26
Status: **Accepted.** Sixth decision covering `web/`, the product site at
wordscript.dev. It corrects the gate ADR 0254 put on the opening plane and adds
a class of viewport the site had not accounted for. ADR 0254's structure -- one
plane pinned, the argument covering it -- is not re-opened: the effect is kept
where it was measured to work and withdrawn where it was measured to destroy
content.

## Context

A phone screenshot of the site showed the hero cut off at the bottom edge, with
the fact strip half under the browser's own bar. The report named three things
at once -- the crop, iOS Safari retracting its bar on scroll, Android behaving
differently, and social app browsers -- and they are not one problem. Measured
on the built page, they are three.

### The pinned plane was taller than the phone, and sticky made the overflow permanent

`.pin` holds the hero and the focus band and, per ADR 0254, becomes
`position: sticky; top: 0` above a threshold. The threshold was
`@media (min-height: 640px)`, which every phone in portrait satisfies.

A sticky box taller than the viewport pins its top and hangs. Measured at
390x664 across the whole scroll range, at every position:

| element | visible |
| --- | --- |
| `.focus` -- the claim that it lands in the focused window, and the fifteen windows | **0 of 130px** |
| `.hero__facts` -- licence, the three desktops, the four lanes | **15 of 42px** |

175px of the plane sat below the fold and no scroll could reach it, because
the top was holding at 0 until the cover arrived over it. The focus band is the
page's evidence for its opening claim, and on a phone it did not exist.

### The gate was on the wrong axis

The demand is set by width, not height: a single column stacks the sentence,
the live window and the fact strip that the two-column hero puts side by side.
Measured as the plane's own content height plus the header, with the pin off:

| width | viewport it needs | width | viewport it needs |
| --- | --- | --- | --- |
| 360px | 918px | 768px | 769px |
| 390px | 871px | 1024px | 828px |
| 430px | 871px | **1080px** | **590px** |
| 600px | 782px | 1440px | 626px |

Under 1080 the plane wants between 751 and 918 CSS pixels. No phone has that
with a browser bar on screen, and a tablet in landscape does not either -- 1024
by 768 was overflowing by 60px. At 1080 the two-column hero halves the demand
and the worst case across the desktop range is 626.

So the height gate was not too low. It was measuring the wrong thing, and the
one case it did catch -- a phone in landscape -- was the case it was written
for, which is why it read as sufficient.

### The header was never counted

`.pin` was `min-height: 100svh` and sits in normal flow under `.top`, which is
sticky and therefore takes its height there. Measured at every width from 360
to 1440, the plane's overhang on first paint was exactly the header: 58px
narrow, 62px wide, at all of them. On a desktop that is invisible, because the
content is centred and there is slack. On a phone it added to the crop above.

### `svh` is correct and does not cover a social app browser

The stylesheet already sizes in `svh` rather than `vh`, and that is the right
answer for Safari's bottom bar and for Chrome's address bar: `svh` is the small
viewport, what is on screen before anything retracts.

It is not an answer for Instagram, Facebook, TikTok, LINE, WeChat. Their bar is
drawn by the native application over the WebView and is not in the document at
all: no `resize` fires when it appears, `env(safe-area-inset-*)` does not report
it -- that pair is the notch and the home indicator -- and `z-index` cannot
reach it, because it is not in this page's stacking context. It is a spacing
problem wearing a stacking problem's clothes, and the site had nothing for it.

## Decision

**The pin is gated on the width where the layout it needs exists.**
`@media (min-width: 1080px) and (min-height: 700px)`. The width is the
two-column break; the height stays as the landscape backstop it was always
serving. Below the gate the page is what ADR 0254 already described as the
fallback: two boxes, one after the other.

**The header's height is one number, declared once.** `--top-h` is set beside
the header that produces it and read by the plane that starts under it, which
is now `min-height: calc(100svh - var(--top-h))`. The bar's own height comes
off the same variable, so the narrow breakpoint changes one value rather than
two literals in two rules.

**In-app browsers are detected before the first paint and answered with
space.** A synchronous script in the base layout matches the known user agent
strings and sets `html.iab`; the rules that read it add `--iab-chrome` to the
document's bottom padding, to the menu panel's bottom padding, and to the
toast's offset. No rule raises a `z-index`, because there is nothing in this
document to raise it above.

**`--iab-chrome` is a floor and is written down as an estimate.** 64px is the
working figure for the Instagram and Facebook bottom chrome. It has not been
verified on a device for this site, and the comment in the stylesheet says so
rather than implying a measurement that was not taken.

**No escape hatch.** The pattern -- prompting the reader to open the page in a
real browser -- exists for flows an in-app browser genuinely breaks: OAuth,
payment autofill, persistent cart state. This page's two actions are external
links that leave the in-app browser by being followed. Adding the prompt would
be answering a problem the page does not have.

## Consequences

Measured on the built page after the change, walking the full scroll at each
size: `.focus` reaches 130 of 130px and `.hero__facts` 42 of 42px at every
viewport from 360x640 up. The plane's overhang on first paint is 0 at every
pinned size, where it was the header's height at all of them. The pin is
`sticky` from 1080x700 and `relative` below it. At 390x664 the hero now ends
8px below the fold, and those 8px are padding.

Under an Instagram user agent the document carries `html.iab`, the body takes
64px of bottom padding, and the menu panel's last action stands 82px clear of
the viewport edge; under a plain Safari user agent none of that is set.

The user agent list is maintenance rather than a fixture. Meta changes these
strings, and a string that stops matching fails silently -- the page simply
goes back to being cut off in that one app. It belongs in the periodic audit,
not in the set of things assumed to keep working.

**What is still unverified, and cannot be verified here.** A headless Chromium
cannot stand in for a real in-app browser: it does not draw the bar, so the
64px is reasoned rather than measured, and the panel's `100svh` -- added
because `inset: 0` resolves against an initial containing block that iOS
reports as the large viewport -- is defensive on the same footing. Both need a
real iPhone through a bio link and a real Android through a story link. Until
that happens this record claims a fix for the crop, which was measured, and an
estimate for the app chrome, which was not.
