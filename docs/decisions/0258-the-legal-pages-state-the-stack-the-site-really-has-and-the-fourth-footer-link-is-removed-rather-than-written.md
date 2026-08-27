# 0258 - The legal pages state the stack the site really has, and the fourth footer link is removed rather than written

Date: 2026-08-27
Status: **Accepted.** Eighth decision covering `web/`, the product site at
wordscript.dev. It writes the three pages that `PRODUCT.md` recorded as the
blocker on publishing, removes the fourth route that was drawn beside them, and
runs gate 4 of the `web-launch-gate` skill against the real third-party
inventory. It reopens no copy, no layout and no island. ADR 0257's rule -- the
crawl surface claims only what the page claims -- is extended once, because the
graph it wrote was correct for a site with one route and wrong the moment there
were four.

## Context

`Foot.astro` drew four legal links, `/imprint`, `/privacy`, `/terms` and
`/dpa`, and said in its own comment that all four pointed at pages that did not
exist. That was deliberate: the row settles where the pages live and what they
are called, so the day they land nothing has to be rewired. `PRODUCT.md` named
the same four as the open fact blocking publication, and `wrangler.jsonc` keeps
the custom domain commented out for the same reason, which is why nothing about
this was urgent and everything about it was blocking.

Four routes were drawn. Three of them are written here. The fourth is the
decision this record exists for.

### The provider is the sole proprietorship, not the brand

SW forge is the open source brand of SW labs and has no legal existence of its
own; a brand cannot be served notice. The body that publishes wordscript.dev is
the same one named in the imprint at sw-labs.de: a sole proprietorship in
Aschaffenburg. The two imprints must not drift, so both name one address and
one inbox, and this site's copy of those facts lives in `src/lib/legal.ts`
rather than in the three pages that print them.

The inbox is the one the site already published in its mobile menu, which is a
deliberate reuse: an imprint that names an address nothing else on the site uses
is an address nobody watches.

### Section 5 DDG, and the one requirement that has no answer yet

The Telemediengesetz ceased to apply on 2024-05-14 and the
Digitale-Dienste-Gesetz replaced it. An imprint headed "in accordance with
section 5 TMG" cites a repealed statute and has been warned over; this one
names the DDG.

Most of the section does not apply to this provider. There is no register
court, no register number and no VAT identification number, because a sole
proprietorship that is not entered in the commercial register has none and none
is issued. There is no supervisory authority for the trade, and no MStV
responsible party, because a product page carries no journalistic or editorial
content. The template rule is that a block which does not apply is deleted and
not filled with a dash, so those blocks are absent and `src/lib/legal.ts` says
which and why.

**One requirement is open and is not closed by this record.** Section 5 DDG
asks for details that permit fast electronic contact and immediate
communication. The Court of Justice read the identical wording of Article 5 (1)
(c) of Directive 2000/31/EC in C-298/07 of 16 October 2008: an email address on
its own does not satisfy it, a second means permitting rapid contact and direct,
effective communication is required, and that second means need not be a
telephone number -- an electronic enquiry mask can qualify. The same judgment
carries the catch that makes a form awkward: a further means outside the
electronic network has to be available for a user who, having made contact,
turns out to have no access to it.

So a form is lawful in principle and impractical here. It would be the first
form, the first backend and the first interaction this site has, it would tie
the site to a response time it then has to keep, and it has consequences three
sections down. A telephone number carries none of that.

The owner decided for a telephone number. The number itself has not been
supplied, so `PHONE` in `src/lib/legal.ts` is `null`, the imprint renders
without the row, and `scripts/launch-check.mjs` refuses to deploy while it
stays null. It is a null rather than a placeholder string on purpose: a string
of the `+49 ...` shape reads as filled in from three metres away and would
ship.

The same defect exists today at sw-labs.de, which publishes an email address
and nothing beside it. It is named here because a fix on one site and not the
other is half a fix.

### The DPA link was a relationship that does not exist

A data processing agreement under Article 28 GDPR is the contract between a
controller and somebody processing personal data on their behalf. WordScript
hands us nothing to process. It runs on the reader's own machine, it has no
account and no server of ours, the provider key belongs to the reader and lives
in their operating system's secret store, and where a cloud lane is chosen the
audio goes from their machine to a vendor they selected on an account they own.
We are not in that path and we receive nothing from it.

A page at `/dpa` would therefore have had to do one of two things: invent the
relationship, or spend a screen explaining that it does not exist. The first is
a false claim in the most sensitive place on the site. The second answers a
question with a paragraph in a place a reader arrived at expecting a document.

The link is removed. `src/lib/legal.ts` carries the reasoning beside the list it
draws, rather than only here, because a removed link is exactly the kind of
decision that gets quietly re-added by somebody restoring symmetry. The `404`
page names the route too, so a stale link in somebody's notes lands somewhere
that explains itself.

The day WordScript grows something hosted -- sync, accounts, a managed model
endpoint -- the link comes back with a real agreement behind it.

### Terms is not a set of general terms and conditions

The obvious content for `/terms` was the AGB skeleton the launch-gate skill
ships. It does not fit, and forcing it would have cost something real.

General terms govern a contract. Nothing on this site concludes one: no
purchase, no account, no sign-up, no download, and today no release. Terms
drafted for that absent contract would have to invent an ordering process, a
payment term and a notice period for a page whose only two actions are joining
a chat room and reading source. They would also carry a live risk: general terms
are subject to content review under sections 305 to 310 BGB, and a clause that
fails does not soften, it falls away entirely and the statute takes its place.
Terms nobody needed can leave their author worse off than none at all.

What the route carries instead is the conditions the site is offered under and
the pointer to the licence that actually governs the software. AGPL-3.0 already
states what may be done with the program and already disclaims warranty in its
own sections 15 and 16; the page says so and does not restate it in weaker
words. The naming carve-out is the one thing the licence does not cover and the
page does: the marks are not licensed by it.

The moment something here is sold, subscribed to, or accounts for, this page is
replaced by real terms with legal review behind them, and not extended clause by
clause.

### The privacy notice describes an inventory that was read, not remembered

Gate 1 of the launch gate is the third-party inventory, and this site's is
small enough to state in full: Cloudflare serves the pages and resolves the
name, the four typefaces are served from this origin, and the four outbound
links in the footer are links rather than embeds. `src/` contains no
`localStorage`, no `sessionStorage`, no `document.cookie` and no `indexedDB` --
checked rather than assumed -- so the site sets nothing on the reader's device
and has no consent banner to show.

Two things about the notice are worth recording rather than leaving to the
page:

**It covers the application as well as the website, in its own section.** A
dictation product whose privacy page discusses only its marketing site answers
the question nobody asked. The FAQ answers "does my audio leave the machine" in
one line; this is where that line is allowed to be exact, and every claim in it
was read off the runtime rather than off the marketing copy: `src-tauri/src`
contains no telemetry, no usage reporting and no crash reporting, and its only
outbound hosts are the transcription providers and the GitHub releases endpoint
that `core::updates` calls. That update request is named explicitly, including
when it runs -- once when the About section is first opened, and again on
demand -- because "it phones home on startup" is what a reader will assume of
any request they are not told the shape of.

**The third-country paragraph names two bases on purpose.** The EU-US Data
Privacy Framework is in force and Cloudflare is certified under it. The General
Court dismissed the first challenge to the adequacy decision on 2025-09-03 in
T-553/23, Latombe v Commission, and an appeal against that judgment is pending
before the Court of Justice as C-703/25 P. Separately from the litigation, one
of the institutional safeguards the Commission relied on has been weakened: the
Privacy and Civil Liberties Oversight Board lost its quorum in January 2025 when
three of its five members were removed. Naming the standard contractual clauses alongside the framework means
the page does not have to be rewritten in a hurry on the day that appeal is
decided.

The statute for anything touching the device is the TDDDG and has been since
2024. A page still calling it the TTDSG is making the same class of error as an
imprint citing the TMG, and the deploy check now greps for both.

### Analytics is named because it is being switched on

The launch-gate skill settles the analytics question for every SW labs site:
Cloudflare Web Analytics, cookieless, therefore requiring no consent under
section 25 TDDDG, and never Google Analytics. `public/_headers` was already
written for it -- it deliberately carries no `Cache-Control` and in particular
no `no-transform` on the HTML, because that header is what would stop the edge
injecting the beacon.

So there is no snippet to add and no token in the repository. The switch is in
the Cloudflare dashboard, the notice names the service, and `launch-check`
prints it as one of the three gates it cannot see. The alternative -- write the
notice without it and add the section when the switch is flipped -- is the
failure mode `_headers` already warns about: the half that is invisible is the
half that gets forgotten.

### The BFSG threshold, assessed rather than assumed

The Barrierefreiheitsstaerkungsgesetz has applied since 2025-06-28 and the
transition period is over. The obligation attaches to services provided to
consumers through a site, which means real interaction: a form, a booking, a
shop, a login, a download area, a configurator.

This site has none. It is a static project page: text, links and one animated
demonstration, whose two actions are outbound links. No contract is concluded
over it, nothing is ordered, nothing is booked and there is nothing to log in
to, so there is no service provided to a consumer through it for the obligation
to attach to.

**That is the whole basis, and the micro-enterprise exemption is deliberately
not part of it.** The provider would meet its two conditions, and an earlier
draft of this record leant on that as a second leg. It does not carry weight
here: the exemption is a fallback for a provider who *is* within scope, it does
not apply where a product is placed on the market, and resting a finding on it
would mean the finding flips the day the company grows rather than the day the
site does. The site being out of scope is the load-bearing reason and it is
the only one stated.

So there is no accessibility statement today, and its absence is a finding
rather than an oversight. **Two things would change it, and both are on the
roadmap**: a download area, and any contact form -- which is also one of the
two candidate answers to the second-contact-channel requirement above. The
exemption is not a reason to build inaccessibly, and the site's own audits
already hold the WCAG AA line on contrast, reduced motion, focus and keyboard
reachability.

### The pages needed a header that works off the index

`Base.astro` puts the header on every route, and the header's six section links
were bare fragments. On `/imprint` a bare `#how` is a link to a fragment of
`/imprint`, which does not exist: the reader presses it and nothing at all
happens. They are root-relative now, which is still an in-page jump on the
index because Lenis resolves a same-document hash whatever path precedes it,
and a navigation home from anywhere else. The wordmark goes to the top on the
index and home from a subpage.

### The graph typed every page as an FAQ

ADR 0257 wrote the JSON-LD graph when the site had one route, so the page node
was typed `WebPage` and `FAQPage`, hung the six questions off itself, and
carried the site's own title and description. The first legal page built under
it was a document asserting in machine-readable form that it was a frequently
asked questions page about a dictation app, under a name that was not its own.

That is the exact failure 0257 set out to avoid, one route later. The page node
now takes the head's own title and description, and the FAQ typing and its
questions belong to the index alone, identified by its path rather than by a
flag every call site has to remember.

## Decision

1. **Three legal routes, written against the real stack.** `/imprint` under
   section 5 DDG, `/privacy` under Articles 13 and 14 GDPR with a section for
   the application, and `/terms` as conditions of use plus the licence pointer.
   All three are indexable URLs of their own, reachable in one click from every
   page, with speaking link text.
2. **No `/dpa`.** There is no processing in our name to put under an Article 28
   agreement. The link is removed from the footer rather than pointed at a page
   that explains its own emptiness.
3. **`src/lib/legal.ts` owns the entity facts.** Provider, address, contact,
   supervisory authority, host and the review date, plus the footer's legal
   list. The pages print them; nothing types them twice.
4. **The open telephone number is a `null` and a deploy blocker**, not a
   placeholder string.
5. **English only, no German route, and the reason is the audience rather than
   a language rule.** An earlier draft of this record asserted that a German
   provider owes the mandatory details at least also in a language attributable
   to it, which made an English-only imprint from a seat in Aschaffenburg look
   like a tolerated defect. That assertion is struck. Neither section 5 DDG nor
   Article 12 GDPR contains a language requirement, and no supreme court
   decision supplies one.

   What both provisions do prescribe is measured against the people addressed.
   Section 5 DDG requires the details to be easily recognisable, directly
   accessible and permanently available; Article 12 (1) GDPR requires the
   information it governs to be concise, transparent, intelligible and in clear,
   plain language. This site is English throughout, its readers are
   international and English-speaking, and there is no sales relationship to the
   German market behind it. English is therefore the language in which the
   addressed group can actually read these pages, which is what both standards
   ask for.

   Section 3 DDG is a different question and is the one easiest to run together
   with this one: it puts a German provider under German law wherever the reader
   sits. Applicable law is not prescribed language.

   **The residual risk is borne knowingly.** The question is not conclusively
   settled, and a court could draw the addressed group differently than this
   record does. That is accepted as an interpretation risk rather than hedged,
   and `imprint.astro` carries it so the next reader meets the decision instead
   of rediscovering the question. What that page no longer does is present the
   missing German version as a violation, which is what its first comment did.

   **The condition that reopens it is a change in who is addressed**, not the
   passage of time: German-language content, prices in euro, German customer
   references, or any sales relationship to the German market. On the first of
   those, this decision is taken again and a German version is added.
6. **`scripts/launch-check.mjs` gates `npm run deploy`.** It runs against
   `dist/` after the build and before wrangler, because what ships is the
   rendered page and a string assembled from two variables is invisible to a
   source scan. It fails on an unfilled `[[PLACEHOLDER]]`, on `lorem ipsum`, on
   the placeholder telephone number, on a citation of the TMG or the TTDSG, on a
   link to the EU ODR platform and on the three sentences that introduce it in
   every pre-2025 German template, on the site's banned punctuation in any
   emitted file, on a missing legal route, on the null telephone number, on an
   open item in the fonts' NOTICE, on the display italic being absent from the
   working tree, and on that same italic being tracked by git. It prints the three
   gates it cannot see rather than omitting them.

   The ODR family is four patterns because Regulation (EU) 2024/3228 took the
   platform down on 2025-07-20 and repealed the duty to link it: the sentence
   now points a consumer at a dead service, which is attackable in its own
   right, and it survives in templates long after the URL is dropped. A bare
   three-letter `ODR` is deliberately not among them, because a pattern that
   short fires on something unrelated in a built bundle and takes the whole
   check down with it.
7. **The graph is per route** and the FAQ typing belongs to the index.
8. **The header's section links are root-relative.**
9. **No legal claim in this documentation set without its source.** A statement
   about what a statute, a regulation or a court requires names the norm or the
   judgment it rests on. One that cannot be sourced is marked as unsettled and
   written as a reading rather than as a rule. Item 5 is what the rule is for:
   the struck claim was stated flatly, it read as settled law, and nothing in it
   pointed at an authority it did not have. The rule binds the whole set and is
   recorded in `docs/decisions/README.md` rather than only here.

   It caught a second claim in this same record within the day. The fonts' own
   NOTICE stated that the Zodiak licence text had to be added "the same way the
   two above are", which was the OFL condition generalised to a licence nobody
   had read. Reading it reversed the obligation. Two for two is not a sample,
   but it is the shape of the failure the rule exists for: a real rule applied
   to a case it does not govern, stated with the confidence of the case it
   does.

## Consequences

The site is one step from publishable rather than blocked on a missing
document. What remains before the custom domain in `wrangler.jsonc` may be
uncommented:

- **The telephone number.** Enforced by the deploy check.
- ~~**The Zodiak licence text**~~, which was never the obligation. Closed by
  reading the licence rather than by producing the file. The ITF Free Font
  License 2.0 of 17 August 2026 requires no text to travel with the font and no
  attribution; its section 01 expressly permits self-hosting through
  `@font-face` and its section 02 forbids passing the font on, naming
  repositories and publicly accessible servers. The obligation is therefore the
  opposite shape: serve it, do not ship it. `zodiak-400-italic.woff2` is
  gitignored, `public/fonts/NOTICE.txt` carries the clauses and the reading,
  and the gate checks both halves -- present locally, absent from the index.
  One thing stays unverified and is recorded as unverified: whether the file
  is the untouched Fontshare webfont, since section 02 also forbids subsetting
  and format conversion and reading the font tables needs a Brotli decoder this
  machine does not have.
- **The Cloudflare Web Analytics switch**, which the privacy notice already
  names.
- **A legal review.** These are drafts from a template until they have had one.
  The skill is explicit that this is not optional for terms. The language
  decision in item 5 is the question worth putting to whoever does it, together
  with its stated reasoning, so that the review answers the reasoning rather
  than the conclusion.
- **The manual accessibility pass.** An automated run covers between a third
  and a half of the WCAG A and AA rules, so a green axe report is not the gate.

Measured on the built output rather than claimed: `astro check` reports 0
errors and 0 warnings; the build emits five pages; no overflow on any of the
four secondary routes across eight widths from 360 to 1920, measured as
document scroll width and per-element rectangles; every colour pair on the new
prose passes AA against the page ground, from the 20px headings at 14.83:1 down
to the 11px review stamp at 5.91:1; the accent against the body colour is
1.14:1, which is why prose links carry an underline rather than colour alone;
the sitemap lists four URLs and excludes the 404; the deploy check reports
exactly the two blockers named above and nothing else.

What this record does not do: it does not run gates 1 through 3 or 5 of the
launch gate as a whole, it does not decide when the site goes live, and it does
not touch the copy of the index. The privacy notice describes an analytics
service that is not switched on yet, which is a deliberate ordering and is a
defect on any day the site is live and the switch is not.
