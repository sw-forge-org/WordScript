# 0260 - The site is published with one legal item open, and the check that guarded it reports instead of blocking

Date: 2026-08-27
Status: **Accepted.** Tenth decision covering `web/`, the product site at
wordscript.dev. It opens the custom-domain route that every previous record
called the launch gate, and it converts the one remaining automated blocker
into a printed notice. It supersedes decision 4 of
[ADR 0258](0258-the-legal-pages-state-the-stack-the-site-really-has-and-the-fourth-footer-link-is-removed-rather-than-written.md),
which made the missing telephone number a deploy blocker. Nothing else in that
record is reopened, and its reading of section 5 DDG is what this one is decided
against rather than around.

## Context

### One item was left, and it was not a technical one

By 2026-08-27 the site was finished in every respect this repository can check.
The three legal pages exist and resolve, the third-party inventory behind them
was read off the real stack rather than a remembered one, the crawl surface is
generated from the page's own facts, the typefaces are all committed and the
deploy builds from a clone (ADR 0259). `scripts/launch-check.mjs` reported one
blocker, and it had reported the same one for a day: `PHONE` in
`src/lib/legal.ts` is `null`.

### What the law actually asks, stated once and not softened

Section 5 (1) no. 2 DDG requires an imprint to carry details permitting rapid
electronic contact and direct communication, including the electronic mail
address. The Court of Justice read the identical wording of the predecessor
provision in **C-298/07 (Bundesverband der Verbraucherzentralen v deutsche
internet versicherung), 16 October 2008**: an email address alone does not
discharge it, a second means of communication is required, and that second
means **need not be a telephone number** -- an electronic enquiry mask answered
within 30 to 60 minutes was held sufficient on the facts.

So the gap is real and it is narrow: the imprint currently offers one channel
where two are required. It is not cured by anything else on the page.

ADR 0258 recorded that the owner chose a telephone number over the enquiry-mask
route, because the alternative a static site can offer is a form with a
response-time promise attached to it. That choice is unchanged. The number had
simply not been supplied yet.

## Decision

### 1. The site is published now, and the number follows

The owner decided to open the route and supply the number afterwards. The
decision was put to him with the exposure named and he took it twice.

**It is his to take.** The gap is a compliance defect on a page nobody has been
directed to yet, on a domain that resolved to nothing until this deploy, for a
product with no release and no customers. The record's job is not to relitigate
it; the record's job is to make sure it cannot be forgotten and that whoever
finds it later knows it was seen rather than missed.

### 2. The check reports and stops blocking

`scripts/launch-check.mjs` no longer calls `fail()` on the null phone. It prints
a headed notice at the end of every successful run, beside the three gates that
have no artefact in this repository, carrying the statute, the judgment and the
fact that this was a decision.

**Two properties of that notice are the point of it.** It fires on every run,
so it cannot decay into something nobody sees. And it is conditional on the
value: the day `PHONE` stops being `null`, the check has nothing to say and the
notice removes itself, so there is no second cleanup to remember.

**Deleting the check outright was rejected.** An open legal item that stops
being printed is an open legal item nobody remembers, and this one is the only
one of the four that this repository can answer for itself.

### 3. The route is uncommented, and the comment above it changes job

`wrangler.jsonc` now carries
`"routes": [{ "pattern": "wordscript.dev", "custom_domain": true }]`.

The comment that used to explain why the line was absent now explains what the
line does, because that is the part which is easy to get wrong later:
`custom_domain: true` makes wrangler create the DNS record, and the site is
public from the moment the deploy lands. **Commenting the line out again does
not take the site down** -- the record it created stays in the zone. Reversing
this means deleting the custom domain in the dashboard.

The same comment carries what was open on the day it was opened. A launch gate
that is walked past silently is worse than one that was never written.

## Consequences

- **`wordscript.dev` resolves and serves** from the first deploy that carries
  this config.
- **`npm run build:ci` is green**, so a push through Workers Builds deploys
  rather than failing. That is the intended effect and it is also the risk: the
  gate no longer has a way to stop a publish on this item, only a way to say so.
- **The imprint is short one contact channel until `PHONE` is set.** No code
  change is needed beyond that value; `src/lib/legal.ts` types it
  `string | null` precisely so the row appears when it is filled.
- **Cloudflare Web Analytics can be verified for the first time.** ADR 0258
  recorded it as armed but unverifiable, because injection happens at the edge
  for a proxied hostname and there was no hostname. There is one now, and the
  check is one grep for the beacon in the served HTML.

## What this does not close

The three gates without an artefact here are untouched and are now open on a
live site rather than on a private one: the analytics beacon is unconfirmed, no
legal review of the three pages has taken place, and the manual accessibility
pass has not been walked. `PRODUCT.md` under Open facts remains the list.
