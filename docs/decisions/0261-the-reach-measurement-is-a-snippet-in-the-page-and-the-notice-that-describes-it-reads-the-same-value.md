# 0261 - The reach measurement is a snippet in the page, and the notice that describes it reads the same value

Date: 2026-08-27
Status: **Accepted.** Eleventh decision covering `web/`, the product site at
wordscript.dev. It replaces Cloudflare's edge injection with a snippet in the
document, and ties the privacy notice's reach-measurement section to the same
value that renders the snippet. It corrects a defect that was live.

## Context

### A legal page described a processing operation that was not happening

`/privacy` carried a Reach measurement section in full: what Cloudflare Web
Analytics processes, that IP address and user agent are hashed immediately and
not stored, that query strings are not logged, and that the data is available to
us for six months. The paragraph above it promised the reader that section.

Measured on the live host on 2026-08-27, **none of it was happening.** The
served page carries five `<script>` tags, all of them Astro's, and no
`cloudflareinsights`, no `beacon.min.js` and no `data-cf-beacon`.

The error ran in the harmless direction -- the notice declared more processing
than occurred, rather than less -- but a legal page that does not describe the
site is a legal page that has to be rewritten, not reasoned with.

### Why the edge injection did not arrive, established by probe rather than by reading

Every documented precondition for automatic injection holds and each was
checked rather than assumed. The zone answers on Cloudflare addresses
(`172.67.205.17`, `104.21.37.68`), so traffic is proxied. The HTML parses. The
HTML's `Cache-Control` is `public, max-age=0, must-revalidate`, and
`public/_headers` omits `no-transform` deliberately, with a comment saying that
omitting it is what leaves the injection possible.

The probe that settles it is `/cdn-cgi/rum`, the endpoint the beacon reports to:

| Probe | Result | What it establishes |
|---|---|---|
| `/cdn-cgi/trace` | 200, genuine Cloudflare output | Cloudflare's own `/cdn-cgi/` path is live on this host and the Worker does not intercept it |
| `/cdn-cgi/rum` | 404 | RUM is not on this host |
| `static.cloudflareinsights.com/beacon.min.js` | 200 | not a network fault |

The owner confirms the site is added under Web Analytics and enabled. So the
reading is that **a response served by a Workers static-assets binding does not
receive the injection.** Cloudflare's own documentation does not state this
either way -- the Web Analytics FAQ and the get-started page list proxying,
valid HTML and the absence of `no-transform`, and say nothing about Workers.
**Recorded as a measurement plus a reading, not as a documented fact.**

## Decision

### 1. The snippet goes in the document

`Base.astro` renders the standard Web Analytics snippet, `defer`, from
`static.cloudflareinsights.com`, with the site token in `data-cf-beacon`. It is
the last element in the `<head>`: `defer` already keeps it off the parse path,
and placing it after the font preloads keeps it off the discovery path too, so
both faces are in flight before the browser reaches it.

**This is the better answer independently of why the injection failed.** Edge
injection leaves no trace in this repository. `/privacy` would describe a
measurement whose existence depends on a dashboard toggle that nobody reading
the code can see, and the day somebody flips that toggle the legal page starts
lying with nothing in the tree changed. A snippet in the page is auditable by
reading the page.

### 2. One value, and both surfaces read it

`src/lib/analytics.ts` exports `BEACON_TOKEN` and the derived `BEACON`.
`Base.astro` renders the snippet when `BEACON` is true. `privacy.astro` renders
the Reach measurement section when `BEACON` is true, **and so does the clause in
the summary paragraph that promises it** -- a summary announcing a section that
is not there is the same defect one paragraph earlier.

`BEACON_TOKEN = null` is a supported state and not a broken one. Nothing is
measured, nothing is claimed, and the page is correct.

This is ADR 0123's rule applied to a legal claim: one list per fact. The fact is
whether a reach measurement exists, and it is written down once.

### 3. The token is public and is committed

It identifies a site to the beacon endpoint. It authorises nothing and grants no
read access to the collected data. It is deliberately **not** in an environment
variable or a secret store, because putting it there would tell the next reader
it is a secret, and they would then treat a public string as one.

### 4. The gate checks the built output, in both directions

Construction already prevents the two surfaces from disagreeing. The check is
for the other way in -- a hand-edited page, or one of the two `.astro` files
changed without the other -- and it reads `dist/`, because a claim assembled at
build time is only visible in the output.

Both directions fail, and both were provoked rather than assumed:

- **Section present, beacon absent.** The original defect.
- **Beacon present, section absent.** The harmful direction: processing the
  notice does not describe.

## Consequences

- **`/privacy` is accurate again as of this change**, in the `null` state: no
  reach measurement is claimed and none runs.
- **Turning it on is one value.** Set `BEACON_TOKEN` and the beacon, the
  section and the summary clause all appear together.
- **`public/_headers` keeps its missing `no-transform`.** The reasoning in its
  comment is now historical rather than operative, and the comment says so. It
  costs nothing to leave the edge path open.
- **One more third-party host appears in the served page when the token is
  set**, `static.cloudflareinsights.com`. It is Cloudflare, which the notice
  already names as the provider delivering the site, and the section says so
  explicitly rather than leaving the reader to work it out.

## What this does not close

Whether the beacon then actually reports is still unverified, and cannot be
verified from this repository: the check is `/cdn-cgi/rum` answering, plus a
figure appearing in the dashboard. `PRODUCT.md` under Open facts keeps it.
