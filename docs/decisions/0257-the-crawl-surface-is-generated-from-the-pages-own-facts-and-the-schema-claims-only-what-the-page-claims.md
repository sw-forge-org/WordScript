# 0257 - The crawl surface is generated from the page's own facts, and the schema claims only what the page claims

Date: 2026-08-26
Status: **Accepted.** Seventh decision covering `web/`, the product site at
wordscript.dev. It adds the machine-readable half of the site and changes no
copy, no layout and no island. ADR 0252's rule -- the page reads its facts out
of the files that own them -- is not re-opened; this record extends it from the
runtime's facts to the product's own, and adds three readers to them.

## Context

The site had been built, audited three times and measured against the runtime.
Everything those passes looked at is what a human sees. Nothing had looked at
what a crawler sees, and the two are not the same document.

### The head carried six tags, and the missing one was the canonical

`title`, `description`, `og:title`, `og:description`, `og:image`,
`theme-color`. That is a share card and nothing else.

Absent: `canonical`, `og:url`, `og:type`, `og:site_name`, `og:locale`, the
image's dimensions, and every Twitter card tag. The consequences are not
uniform in severity:

| Missing | Effect |
| --- | --- |
| `canonical` | `wordscript.dev`, a `www` variant and the `workers.dev` host are three pages carrying one document |
| `og:image:width`/`height` | the 1200x630 card is re-cropped by the platform because it has to guess |
| `twitter:card` | X falls back to a small square crop; it reads `og:*` but picks the layout off this tag alone |
| `og:url` | a shared link that carried a query string is a second URL in the graph |

The `title` was the single word `WordScript`, which matches one query: the
product's own name, which is a query nobody types before they have heard of it.

### `not_found_handling` pointed at a file that was never built

`wrangler.jsonc` has read `"not_found_handling": "404-page"` since it was
written. That option serves the nearest `404.html` for any path that matches no
asset. There was no `404.html`, so it resolved to Cloudflare's unbranded
default -- and the footer links four legal routes that do not exist yet, so the
one error page the site could reliably produce was the one it had not drawn.

### The FAQ would exist twice the moment anything else wanted it

Six question and answer pairs sat as a `const` inside `Faq.astro`. A `FAQPage`
schema needs the same six, and a text surface for a retrieval crawler needs
them again. Copied, they become three documents that start identical and do not
stay that way, and a schema that says something the visible page does not is a
liability rather than a rich result.

### The site is one page, and its shape is hostile to extraction

The argument is carried by a pinned plane, a hydrated capsule, a scrubbed
diagram and an ASCII band. A retrieval crawler gets a DOM whose heading order
does not follow the argument, and six answers under a heading that reads
`The honest answers.` -- correct on the page, useless as a query match. There
was no surface stating the same claims in a shape an answer engine can lift.

### The product has no release, and a schema is where that stops being true

`package.json` reads `0.2.2-alpha` and nothing is published. The page's first
answer says outright that there is no release and no date. A
`SoftwareApplication` node with a `softwareVersion`, an `offers` block or a
`downloadUrl` would be the crawl surface making a promise the page refuses to
make, in the one place nobody looks to check.

## Decision

**One module owns the product's facts, and four surfaces read it.**
`src/lib/site.ts` carries the title, the description, the card, the triangle
out of `docs/VISION.md`, the licence and the platforms. `src/lib/faq.ts`
carries the six pairs. The head, the JSON-LD graph, `/llms.txt` and the FAQ
section are readers; none of them is a copy. The four outbound addresses are
not restated either -- `linkMarks.ts` already owns them for the footer row, and
the same four are the organisation's `sameAs` set.

**The head states the page's identity, once.** Canonical built from
`Astro.url.pathname` against `Astro.site`, so a query string a share button
appended does not become a second URL. The full Open Graph block including the
card's real dimensions, checked against the file rather than assumed.
`twitter:card` for the layout, and nothing else repeated from the OG block.
A square icon at 32 and at 512 out of `src-tauri/icons`, because the lock-up in
`assets/logos` is 121x128 and iOS refuses a non-square touch icon.

**The graph is one `@graph` with four nodes, and what it omits is the point.**
`Organization`, `WebSite`, `SoftwareApplication`, and the page typed as both
`WebPage` and `FAQPage` so that one URL keeps one `@id`. No `offers`, no
`aggregateRating`, no `softwareVersion`, no `downloadUrl`. When there is a
build to download, that node and the FAQ's first answer change in the same
commit or neither changes.

**`robots.txt` is generated, and its crawler policy is a decision.** Generated
because the `Sitemap:` line is an absolute URL, and an absolute URL typed into
`public/` is a second copy of `site` in `astro.config.mjs`. Every crawler is
allowed, the AI ones included. This is an AGPL project whose source is public,
whose readers arrive from GitHub and Discord rather than from a ranking, and
for which being quotable inside an assistant is the surface that substitutes
for the search traffic the site does not have. Blocking the training crawlers
would buy nothing the licence has not already given away and would cost the
citation. The named crawlers are deliberately not given their own groups: a
named group replaces the `*` group rather than adding to it, so the day a
`Disallow` is added, those agents would silently keep the old rule.

**`/llms.txt` states the same claims as prose.** Direct answer first, the
qualification after it, the six questions as questions, and a status section
that says there is no release, no date and no price and instructs against
reporting one. It carries no build timestamp: a date rewritten on every deploy
is a freshness signal that means nothing.

**`@astrojs/sitemap` rather than a written file.** One URL today, which is not
why it is there: four legal routes are already drawn into the footer and
`/docs` is a scope item. The 404 is filtered out, and the `news`, `video` and
`xhtml` namespaces are dropped because this site has none of them.

**`404.astro` exists, so the Wrangler option means something.** `noindex,
follow` -- reachable, rendered, never a search result, and a crawler that
arrives through a stale link should take the way home. Its heading is an `h1`
and not the `h2` every section head carries, because it is the whole page.

**`public/_headers` carries delivery, and one header is absent on purpose.**
`nosniff`, `strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and a
`Permissions-Policy` denying microphone, camera and geolocation -- checked
against `src/`, which calls `getUserMedia` nowhere. Immutable year-long caching
for `/_astro/*` and `/fonts/*`, a week for `/assets/*` because those are copied
under stable names and a refreshed logo has to be able to land. **No
`Cache-Control` on the HTML, and specifically no `no-transform`**, which is the
header that stops Cloudflare injecting the Web Analytics beacon. Analytics here
is a dashboard switch and no code; a cache directive typed onto `/*` for
tidiness would turn it off with no error anywhere to find it by.

## Consequences

`astro check` reports 0 errors and 0 warnings across 48 files. The build emits
`robots.txt`, `llms.txt`, `sitemap-index.xml`, `sitemap-0.xml`, `404.html` and
`_headers`; `sitemap-0.xml` contains the one canonical URL and not the 404.
The graph parses as JSON, carries four nodes and six questions, and contains
none of `offers`, `aggregateRating`, `softwareVersion`, `downloadUrl` or
`datePublished` -- asserted by the check rather than read off it. Zero banned
punctuation in the built HTML and in every emitted chunk, escaped forms
included.

The graph costs 4.36 KB raw and 1.18 KB gzipped on `index.html`. Nothing else
on the page moved: no copy, no CSS, no island, and the four islands that
hydrate are still the four that hydrated.

**The preview host is closed at the source rather than noindexed.** A Worker is
reachable at `<name>.<subdomain>.workers.dev` unless that is turned off, and
`workers_dev` defaults to true -- read off the schema wrangler ships, not
assumed. That host is public and indexable, so the site would stand in the
index twice, the second time under a URL nobody should be sent to.

The obvious fix is an `X-Robots-Tag: noindex` scoped to that host, and it is
wrong twice. `_headers` allows exactly one `*` per rule, so
`https://*.workers.dev/*` cannot be written at all and the account's own
subdomain would have to be typed in by hand. And a header only asks a crawler
not to list a document that is still being served to anyone holding the URL.
So `wrangler.jsonc` carries `"workers_dev": false` and `"preview_urls": false`
-- the second closes `<version>-<name>.<subdomain>.workers.dev`, which
`wrangler versions upload` creates and which already defaults to false, written
out because this is a posture and not a preference. Not existing beats not
being listed. `_headers` keeps the note and says where the rule would go if
either is ever turned back on.

**The custom domain stays commented, and that is the launch gate.** With
`workers_dev` off and no route, `wrangler deploy` uploads a Worker that is
reachable nowhere, which is the correct state for a site with no imprint and no
privacy notice. Uncommenting the route does not configure a path: it creates
the DNS record for `wordscript.dev` and the site is live from that second. The
config makes an accidental launch impossible rather than merely unlikely.
Validated with `wrangler deploy --dry-run`: 36 assets read, config accepted.

**What this record does not claim.** `robots.txt` allowing a crawler and a
crawler reaching the page are different facts: a Bot Fight Mode or WAF rule in
the zone turns AI crawlers away regardless of what is written here, and that is
checked in the zone's settings and in the request logs, not in this file.
Nothing here has been fetched by a real crawler, because the zone has no A or
AAAA record and the hostname does not resolve. The rich-result and schema
validators have not been run against a live URL for the same reason. The
`llms.txt` convention is a convention and not a standard; it costs 3.2 KB and
is discarded at no loss if it stays one.

Copy is untouched by design. The headings that would match a query -- and the
absence of any heading phrased as a question outside the FAQ -- are a content
decision, and this record deliberately does not make it: three passes settled
that copy, and an SEO pass is not the authority that reopens it.
