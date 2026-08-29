# 0263 - One hostname serves the site, and the second one redirects to it

Date: 2026-08-30
Status: **Accepted.** Twelfth decision covering `web/`, the product site at
wordscript.dev. It settles what `www.wordscript.dev` does, and it is recorded
here because the mechanism that implements it lives in the Cloudflare dashboard
and leaves nothing in this repository.

## Context

`www.wordscript.dev` did not resolve at all after launch. Somebody typing the
address the way most people still type an address got a DNS failure rather than
a site, which is a worse first impression than any design decision on the page
can repair.

Two ways to fix it, and they are not variations of one thing.

**Attach `www` to the Worker as a second custom domain.** One click. Both
hostnames then serve the site, both answer 200, and both are indexable.

**Point `www` at the zone and redirect it.** A proxied CNAME plus a redirect
rule. One hostname serves; the other only forwards.

The first was tried first and worked immediately, which is what made the
comparison concrete rather than theoretical.

## Decision

**The apex serves. `www` redirects to it, 301, preserving path and query.**

A proxied `CNAME www -> wordscript.dev` puts the name in front of Cloudflare,
and a Single Redirect rule matching `http.host eq "www.wordscript.dev"`
rewrites to `concat("https://wordscript.dev", http.request.uri.path)` with
*Preserve query string* on.

### Why not the second custom domain, given that it worked

The generated head already fights the crawler half of the problem on its own.
Served on `www`, the page still emits `<link rel="canonical">` and `og:url`
pointing at the apex, and `/robots.txt` still names the apex sitemap, because
all three read `site` from the Astro config rather than the request. So the
duplicate-content argument, the usual one, was close to answered before the
question was asked.

Two things it does not answer:

1. **People are not crawlers.** A `www` URL that returns a page gets bookmarked,
   pasted into a message, printed on something. The canonical steers indexing;
   it does not stop an address from establishing itself in the world.
2. **The reach measurement counts by hostname.** ADR 0261 switched the beacon
   on the day before this. Two serving hostnames means two rows in the
   dashboard, and every figure read off either one is a fraction of the traffic
   with no marker saying so. A number that is quietly partial is worse than no
   number.

The second is what decided it. It also would not have applied a day earlier,
which is worth recording: the right answer here changed because something else
in the system changed.

### Why the rule is exact rather than broad

`http.host eq "www.wordscript.dev"` and not a `starts_with` or a wildcard.
Redirect rules are zone-wide, so a broad match is a standing trap for every
subdomain this zone does not have yet -- a future `docs.`, `app.` or `status.`
host would be swept into a redirect nobody wrote for it, and the failure would
look like a broken deploy rather than an old rule. An exact match has to be
extended deliberately.

### Ordering, and why it works at all

Cloudflare runs Single Redirects before Bulk Redirects, and Bulk Redirects in
front of a Worker. The redirect therefore fires without the Worker being
consulted, which is why it works even while `www` is still attached to the
Worker as a custom domain -- attaching and redirecting are not mutually
exclusive, the redirect simply wins.

## Consequences

- **Measured on 2026-08-30**, each of these run rather than reasoned about:
  every path on `www` answers 301 to the same path on the apex; `?ref=test&
  utm_source=x` survives intact; `http://www/terms/` reaches
  `https://wordscript.dev/terms/` in **one** hop, not two; the apex answers 200
  with an empty `Location`, so nothing loops; the full chain is one redirect to
  a 200.
- **The certificate needed nothing.** Cloudflare's universal certificate for
  this zone already carries `www.wordscript.dev` in its SAN list.
- **Analytics stays one row.** Which was the deciding reason, so it is the
  thing to re-check if the figures ever look halved.
- **This decision is invisible in the repository.** No file changes when the
  rule changes, and no test can fail if somebody deletes it. That is the same
  hazard ADR 0261 rejected for the beacon, except here it cannot be designed
  away -- a DNS record and a redirect rule have no in-repo form. The mitigation
  is this record plus the entry in `PRODUCT.md`, and the honest statement that
  a person has to look at the dashboard to confirm it is still true.

## What this does not decide

Whether the apex or `www` should be canonical in the abstract. The apex was
already live, already in the sitemap, already in `site`, and already in every
link this project has published. Reversing that would have been a migration,
not a preference.
