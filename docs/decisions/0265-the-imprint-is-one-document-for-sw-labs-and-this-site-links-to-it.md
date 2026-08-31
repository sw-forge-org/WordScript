# 0265 - The imprint is one document for SW labs, and this site links to it

Date: 2026-08-31
Status: **Accepted.** Fourteenth decision covering `web/`. Supersedes nothing
that shipped: an earlier draft of this record kept the provider details on the
site and read them out of the build environment, and that draft was never
committed. Shortened on 2026-09-06 to the decision it records.

## Context

ADR 0264 decided how the legal routes are delivered -- linked from every page,
kept out of the index, kept out of the sitemap. It did not ask the prior
question: whether this site should be publishing an imprint at all.

### The first answer was a good answer to the wrong question

The draft that came first moved the provider's address fields into `astro:env`
secrets: out of the tree, into `.env` and a set of Cloudflare build secrets,
with the build failing when they were missing and the launch gate refusing a
build made against the placeholders. It worked, it was verified, and it left
the same details on two pages of this site and in two more places that had to
be kept in sync.

The question it answered was "how do we store this safely". The question worth
asking was "why is this site storing it at all".

### One address, one document, several products

SW labs publishes more than one thing. Each product site restating the provider
means the same details in as many repositories, as many build environments and
as many pages -- and one edit that has to land in all of them on the day they
change. That is not a security argument, it is an accuracy argument, and it
points the same way.

## Decision

**This site does not publish an imprint. It links to one.**
`src/pages/imprint.astro` is deleted. `LEGAL_ROUTES` keeps its Imprint entry and
its `href` is `https://legal.sw-labs.de/imprint`, exported as `IMPRINT_URL`
because the terms and the privacy notice both name it in running prose.

**The privacy notice names the controller and stops there.** Article 13 (1) (a)
GDPR requires the identity and the contact details of the controller. It does
not name a postal address. The body and an inbox are on the page; the full
provider details are one link away.

**Every address field is deleted, not hidden.** `ENTITY` is down to `name` and
`holder`. Gone with the fields: the `astro:env` schema, `.env`, `.env.example`,
the Cloudflare build secrets and the placeholder check that guarded them. Not
storing a value beats storing it carefully. `PHONE` goes too -- it had exactly
one reader and that was the imprint, and the second-contact-channel question
under section 5 DDG is now the SW labs imprint's to answer.

**`/imprint/` keeps working, permanently redirected.** `public/_redirects`
sends `/imprint` and `/imprint/` to the document with a 301. The route was live
for four days, linked from every page and listed in a sitemap Google has
already fetched; removing it without this turns every one of those into a 404,
and the reader looking for an imprint would be the one who found it.

**The footer link is the obligation now, so the gate blocks on it.**
`scripts/launch-check.mjs` asserts the link on every built page and the 301 in
the shipped `_redirects`. A missing footer link breaks nothing visible -- the
page renders, the build passes -- and puts the site out of compliance on every
route at once.

### The risk this record accepts, stated rather than buried

Section 5 (1) no. 1 DDG asks for the address of the provider of *this*
telemedium, and whether that duty is discharged by a link to a document on
another domain is not settled. No decision was found that answers it. The owner
was told before deciding and decided anyway; this is the record of that, not an
argument that the risk is small.

Two things reduce it and neither removes it: the document is one hop away in
the footer of every page, well inside the two clicks the BGH accepted in
I ZR 228/03, and both domains belong to the same body, so a reader following
the link is not sent to a third party.

## Consequences

`astro check` reports 0 errors and 0 warnings across 55 files. Four pages build
where five did. `npm run launch-check` exits 0. Verified against the output
rather than reasoned about:

1. No address field appears anywhere in `src/`, `public/`, `scripts/` or
   `dist/`.
2. Every built page links the imprint.
3. `/imprint` and `/imprint/` both answer 301 to it, probed against
   `wrangler dev`.
4. `/privacy/` and `/terms/` carry the `noindex` meta tag and the
   `X-Robots-Tag` header; the sitemap holds one URL.

Four mutations were run against the gate before it was believed: a stripped
footer link, a deleted redirect, a broken `href` shape in `routes.ts`, and a
stripped `noindex`. All four failed the gate; it returned to green after each.

**The third mutation is why the parser has a self-check.** An earlier version
matched string literals only, and the day the imprint's `href` became an
identifier it resolved one route fewer, produced an empty external set, and
passed both imprint checks by having nothing to look at. Both mutations aimed
at them went green. The parser now compares the number of entries it resolved
against the number the list declares, and fails when they differ.

**`legal.sw-labs.de` did not exist when this was written.** DNS resolved to
Cloudflare and no route answered. Nothing here may be committed until it does:
a site whose only imprint is a dead link is worse off than one whose imprint
sits on the wrong domain.
