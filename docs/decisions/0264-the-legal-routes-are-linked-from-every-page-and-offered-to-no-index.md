# 0264 - The legal routes are linked from every page and offered to no index

Date: 2026-08-30
Status: **Accepted.** Thirteenth decision covering `web/`, the product site at
wordscript.dev. It narrows one clause of ADR 0257 -- the crawl surface -- and
re-opens nothing else in it. The crawler policy in `robots.txt` stands
unchanged: every crawler is still allowed, the AI ones included. Shortened on
2026-09-06 to the decision it records.

ADR 0265 removes the imprint from this site entirely, so of the three routes
named below two remain pages here. Everything this record says about them still
holds. The substance of the legal documents is untouched: this record changes
delivery and metadata, not a sentence of what they say.

## Context

ADR 0257 built the crawl surface when there was one route. ADR 0258 added
`/imprint/`, `/privacy/` and `/terms/`, and they inherited what the index
inherited: no `robots` meta, no `X-Robots-Tag`, and a place in
`sitemap-0.xml`, which listed four URLs. Measured against the live site on
2026-08-30, three days after launch: all three answered 200 with no robots
directive anywhere in the head or in the response headers.

That was never decided. It is what a shared layout does when nobody says
otherwise, and the `noindex` prop that `Base.astro` already carried had exactly
one caller, `404.astro`.

### What an indexed legal page is worth

Nothing that the footer does not already deliver. These pages rank for queries
nobody types -- the product name plus a statute, at best -- and every route on
the site links all three, so the index is not a way in for a reader who wants
them. What it is, is a second and third listing of the same site under headings
that answer no question.

### The requirement the fear attaches to, and what it actually says

Section 5 DDG asks for the imprint to be *easily recognisable, directly
accessible and permanently available* -- properties of the site. A search
engine's index is not one of them, and no reading of the provision makes
Google a delivery channel for it. `Foot.astro` draws all three routes on every
page; that is the surface the section is about.

### A noindexed URL in a sitemap is a contradiction with a report line

A sitemap is a request to index. Listing a page there and marking it `noindex`
states both, and Search Console reports it as `Submitted URL marked noindex` --
an error class that would sit in the report for as long as both files disagree,
with nothing about it worth fixing except the disagreement itself.

## Decision

**`noindex, follow` on the shell, not on the three pages.** `Legal.astro` is
what all three legal documents render through, so the directive is set once
where the shell is chosen rather than three times where the prose is written.
A fourth legal route added later gets it by construction and not by memory.

`follow` and not `nofollow`: these pages carry outbound references worth
following -- the provider, the hosting vendor's own notice -- and a crawler
arriving through a stale link should still be able to take the way home.

**They leave the sitemap, and the exclusion reads the routes rather than
retyping them.** `astro.config.mjs` imports `LEGAL_ROUTES` from
`src/lib/legal.ts`, the same list `Foot.astro` and `/llms.txt` read, and
compares it against `new URL(page).pathname`. The trailing slash in that list
is the canonical form, which is what makes the comparison exact. A route added
there leaves the sitemap in the same edit or not at all.

**`robots.txt` is not touched, and that is load-bearing.** A `Disallow` would
stop the fetch that has to happen for the `noindex` to be read, which is how a
disallowed page ends up listed as a bare URL with no snippet -- the outcome
this record is trying to avoid, reached by the tool that looks like it prevents
it. Allow, crawl, read the directive, drop the page.

**The directive is stated twice, on two layers, and that redundancy is the
decision rather than an oversight.** `public/_headers` sets
`X-Robots-Tag: noindex, follow` on the three routes as well. The meta tag is
the authoritative copy -- it is generated from the shell every legal document
renders through, so a fourth route inherits it -- and the header is the copy
that survives a layout edit. The failure mode being defended against is silent:
lose the meta tag and the page still renders, the build still passes, the suite
still passes, and the finding arrives weeks later as a search result.

**One rule per route, the bare path, and that is a measurement.** Both the bare
path and the splat were written first, on the reasoning that `*` might not
match an empty remainder. Probed against `wrangler dev` on 2026-08-30:
`/imprint/` matched both rules and the response carried `X-Robots-Tag` twice.
Combined directives are read as combined, so it was harmless -- and it was
noise in a response whose only job is to be unambiguous. The splat was dropped;
these routes have nothing beneath them, `/imprint` without the slash is a 307
to `/imprint/`, and the bare path is the exact URL that is served. Re-probed
after the change: exactly one header on each of the three, none on the index.

**Neither copy can be lost quietly, because the gate refuses to deploy without
both.** `scripts/launch-check.mjs` reads `LEGAL_ROUTES` out of
`src/lib/legal.ts` and asserts, per route, that the built page carries the meta
tag and that the shipped `_headers` carries the rule -- and, in the other
direction, that no path is noindexed in `_headers` that is not a legal route.
Three mutations were run against it before it was believed: a deleted
`_headers` rule, a stray `/pricing/` rule, and a meta tag stripped out of a
built page. All three were caught and the gate returned to green.

**`/llms.txt` keeps all three links.** It is a retrieval surface for an
assistant answering a question about the product, not a listing in a ranking,
and an assistant that can name the provider when asked is the surface ADR 0257
chose to invest in.

## Consequences

`astro check` reports 0 errors and 0 warnings across 55 files. The build emits
`noindex, follow` on `/privacy/`, `/imprint/` and `/terms/` and on the 404, and
on nothing else; `sitemap-0.xml` now holds one URL, the index. The canonical
tag, the OG block and the JSON-LD graph on the legal pages are unchanged --
`noindex` governs listing, and a page that is not listed still benefits from a
correct card when its URL is pasted into a chat. `npm run launch-check` exits
0. No copy moved.

**A directive is read on the crawler's schedule, not on ours.** A `noindex`
takes effect when the page is next crawled, and it removes a listing that
already exists only on that schedule -- for a three-day-old site that is weeks,
not hours. Anything already in the index is dropped by re-crawl and, where it
needs to be faster than that, by a temporary removal in Search Console, which
expires after about six months and is a stopgap rather than a fix. The
directive is the fix; the removal only buys the interval.

**The structured data was checked rather than assumed, and it carries no
address at all.** The graph is `Organization`, `WebSite`, `SoftwareApplication`
and `WebPage`, with a `contactPoint` holding a role mailbox and nothing else.
No `PostalAddress`, no `streetAddress`, no `LocalBusiness`, no `Person`, and no
microdata anywhere in `src/`. No `address` fragment in any `description`,
`og:title` or `og:description`. The footer's legal links carry no `rel` at all,
so no `nofollow` -- correct, because `nofollow` on an internal link to a page
that is already `noindex, follow` would only stop the crawl that reads the
directive.

**What this record does not claim.** Whether any of the three was ever indexed.
It was not measurable from the repository or from the live response: a `site:`
query is not something this project can run reliably, and the authority is
Search Console's URL inspection against the verified property. The site went
live on 2026-08-27, so the prior is that little or nothing had been listed --
a prior, not a measurement.
