# wordscript.dev - the product site

What this site is for, who reads it, what it asks them to do, and what it is
allowed to claim. Nothing here is design: the design contract is the built site
itself, and how it got there is [ADR 0251](../docs/decisions/0251-the-marketing-sketch-is-a-design-contract-so-the-astro-port-is-checked-by-computed-style-rather-than-by-eye.md).

Written 2026-08-25, rewritten 2026-08-26 after the positioning below replaced
the one this file used to argue. Repository documentation is American English
(`AGENTS.md`).

## The one decision that shapes everything else

**There is no download, and the site does not pretend otherwise.**

WordScript is `0.2.2-alpha` and nothing is published. Where a product site puts
its download button, this one puts a choice of ways to follow the build:
Discord, GitHub. That absence is the site's honest signal that the product is
not out yet, and it is a stronger one than any "coming soon" badge.

**The site therefore presents WordScript as it is envisioned, not as it is
wired today, and it does not label built against planned.** Decided by the
owner on 2026-08-25, and the reasoning is that the distinction has no meaning
before a first release exists: with no download there is nothing a reader could
mistake for a shipping promise. The built-versus-planned split is the *app's*
problem, and it is what `developer_mode` and ADR 0250 solve inside the product;
importing it into pre-release marketing would be answering a question nobody
asked.

**The window closes with the first release.** From the day an artifact is
downloadable, a reader can act on what this site claims, and every claim on it
becomes a claim about a thing they can install. This section gets rewritten
that day rather than inherited.

## The line that stays either way

No invented claims. No testimonials, user counts, adoption figures, accuracy
percentages, latency numbers, comparison tables against named competitors, or
prices that are not measured facts we can produce evidence for. Under UWG that
is actionable, not merely embarrassing, and it is orthogonal to showing the
product as envisioned: a design of our own unreleased software is a legitimate
statement about intent; a fabricated benchmark is not.

Three consequences the built page carries:

- **The five figures in the Numbers section are labelled on the page as a
  constructed example of the surface, not an average of anybody.** That label
  stays as long as the figures do.
- **The three research measurements are other people's**, cited by author,
  title and year, each read out of the paper it belongs to rather than off a
  site quoting it. One of them says speech lost, and it stays because the row
  after it is worth nothing without it.
- **The wiring diagram's destinations are generic.** It is a comparative
  drawing, and a real vendor mark inside one asserts something about that
  vendor's integrations that we have not verified.

## Positioning

**The voice is the input. What stays is context. The output is the cursor, an
object, or an agent.** That is `docs/VISION.md`, and it is the authority.

The page is built on an equally weighted triangle, **Cursor, Context, Agent**,
and the weighting is the argument: every dictation tool does the first one, and
the first one is becoming a commodity. VISION.md says outright that
transcription accuracy is commoditising, so a pitch built on transcribing
honestly argues the losing half.

**The differentiator is ADR 0046: WordScript does not build a connector
layer.** Context is written into a directory the user's own tools already open,
rather than living inside the product. The agent channel is the proof of that
claim rather than the spearhead of it.

### What was rejected, and why it is not coming back

- **"It shows you what it did."** The transcript pair is real and it is a good
  property, but it is a claim about the dictation half, which is the half that
  is commoditising. It survives on the page as one of six items under *The
  dictation half, done properly*, which is the weight it deserves.
- **Speed, and privacy.** The nearest peer is `openwhispr.com`: MIT,
  local-first, already shipping meeting notes, folders, semantic search and
  cross-meeting chat. Privacy is a tie. Speed is a tie. Neither is a position.
- **The category's own opening sentence.** `wisprflow.ai` and
  `superwhisper.com` both open on an imperative speech verb and both sell a
  speed multiple. That is a line-up WordScript cannot win on spend, and the
  numbers are ones we cannot produce.

## Audience

Primary: heavy writers who already dictate and already have a tool they are
unhappy with. Engineers writing docs and issues, support and success people
answering in volume, writers and researchers, anyone whose day is text.

Secondary: people who want a dictation tool that is local-capable and whose
data handling they can read in the source.

Not the audience: casual voice-memo users, and mobile.

Both groups arrive from GitHub, from Discord, or from a link. Nobody arrives
from search yet, so the site is not built as an SEO surface first. That changes
with the release.

## Primary action and conversion

**Primary action: follow the build.** In order of weight:

1. **Discord** - `https://discord.com/invite/BHfApphz8h`. Where releases are
   announced, and the highest-signal thing a reader can do. It is also the only
   channel where they can talk back before there is anything to install.
2. **GitHub** - `https://github.com/sw-forge-org/WordScript`. Star and watch;
   the source is the product's own argument.

There is also an address, `forge@sw-labs.de`, in the footer and under the two
buttons in the close. It is deliberately not a third button: the buttons are
rooms you join, and an address is not a room.

**Email is deliberately not built for launch.** Discord and GitHub both already
exist, both already notify on release, and a list is a data-protection
obligation, a double-opt-in flow and a sender reputation to maintain for a
signal the other two already carry. It stays a candidate, not a launch item.

**Conversion is not measured as a rate.** With no purchase and no download
there is no funnel; what the site is judged on is whether the two channels grow
after it goes live, read off Discord and GitHub directly rather than off
analytics.

## The site's own reach into the app

The app already links here, which makes this less optional than a marketing
site usually is.

`src/lib/appMeta.ts` carries four canonical addresses and the Help menu
(ADR 0069) draws them as four rows:

| Row | Address | State |
|---|---|---|
| Website | `https://wordscript.dev` | live |
| Discord | `https://discord.com/invite/BHfApphz8h` | live |
| GitHub | `https://github.com/sw-forge-org/WordScript` | live |
| Documentation | `null` | drawn inert on purpose, hint reads *No address yet* |

**The Website row used to be the defect the Documentation row was made inert to
avoid.** ADR 0069's own comment states the rule - a URL that does not resolve
yet is a link that must not be drawn yet - and for the whole build of this site
a live row pointed at a hostname with no A record. Publishing closed it on
2026-08-27, which was the better fix than making the row inert.

**One hostname serves this site, and it is the apex** (ADR 0263).
`www.wordscript.dev` resolves, is proxied, and answers 301 to the same path on
`wordscript.dev` -- it never serves a page. Measured on 2026-08-30: path and
query survive the hop, plain `http` on `www` reaches `https` on the apex in one
redirect rather than two, and the apex itself answers 200 with no `Location`,
so there is no loop. The redirect is a Cloudflare Single Redirect rule and has
no artefact in this repository; the ADR is the only place it is written down.

**And `/docs` later is what makes the fourth row live.** Documentation on this
domain is not a nice-to-have for the site; it is the condition under which
`APP_DOCS_URL` stops being `null`. That is a Phase 2 scope item, not launch.

## Scope

**Launch (v1 of the site):** one page that presents the product, plus the two
follow channels, plus imprint and privacy. Nothing else.

**The page presents the product whole, and carries no readiness labels**
(ADR 0252). It does not sort its own contents into what is wired today and what
is drawn, and it never wears `PreviewTag` or `PreviewBanner`. That is the app's
rule and it is right there, where a user is trying to do something now. Here
there is no release at all, so the honesty sits in four places instead and none
of them may be softened: there is no download, the primary action is to follow
the build, the source is the second action at near-equal weight, and the first
FAQ answer is whether you can install it yet.

**Vision, in the order it is likely to arrive:**

- `/docs` - public documentation, which retires `APP_DOCS_URL = null`
- photography and recordings of the real thing, which is the one open content
  item and the only one nobody but the owner can supply
- `/download` - with the first release, gated on V1 gates G3, G5, G6 and G12
- release notes, which the release itself owes anyway (G6, G10)

## Content and assets

**In the repository already:**

- Wordmark and logo lock-ups: `assets/wordscript_wordmark.png`,
  `assets/wordscript_wordmark+logo.png`, `assets/logos/`. The site copies the
  four it uses into `web/public/assets/` at build time via
  `web/scripts/sync-assets.mjs` rather than keeping a second copy in the tree.
- Icons at every size: `src-tauri/icons/`
- Social card: `assets/OG.png`, **generated rather than drawn**. `web/scripts/make-og.mjs`
  composes it out of the page's own ground, lamp, ruled sheet, grain, `h1`,
  fact strip and `.stage__win`, and `npm run og` photographs that with headless
  Chrome. It is deliberately not a build step: the deploy starts from a clone
  with no browser on it, so the PNG is committed and the script is the record of
  how (ADR 0262).
- Typefaces, self-hosted: Archivo and IBM Plex Mono, both SIL OFL, from
  `assets/fonts/` with their licence files. The site adds one face the app has
  no use for, Fraunces italic, because the app never has to introduce itself.
  All three are OFL and all three are committed, which is what lets the site
  build from a clone (ADR 0259).
- The design system the app draws with: `docs/DESIGN_SYSTEM.md`, Tailwind v4
  `@theme inline` tokens, which the site adopts under the same token names.

**Producible on demand, and this is the unusual advantage:** the workspace
renders headless in a plain browser behind a stubbed `__TAURI_INTERNALS__`, so
product imagery for the site is **real screenshots of the real UI at any width**
rather than mockups. Nothing on this site needs to be drawn in Figma to look
like the product.

**The demo question is answered, and it was answered by building rather than by
filming.** The capsule on the page is not a screenshot and not a recording: it
is the app's own overlay rebuilt as live DOM against the geometry in
`src/styles/overlay-pill.css`, driven through the runtime's own `levelToBars`
curve. If the shipped pill moves, this moves with it.

**Still missing, and it is the expensive one:** the page is entirely
self-drawn. Nothing on it is a photograph. In descending order of value: the
app running over a real application with the capsule visible and text arriving;
the actual desk, shot dark enough to sit in the palette; the Context folder in
a real file manager with real filenames and timestamps. These are not to be
generated and not to be substituted with stock.

## Stack

**Astro with React islands, static output, deployed to Cloudflare Workers
static assets.** Tailwind CSS v4, shadcn/ui through React islands when one is
first needed, Archivo, IBM Plex Mono and Fraunces self-hosted from the
repository's own files.

**Two documented deviations from the SW labs stack default:**

1. **Astro instead of Next.js App Router.** The site renders no dynamic data,
   so everything Next.js is paid for - RSC, ISR, middleware, route handlers -
   is unused weight here, and reaching Workers with it means
   `@opennextjs/cloudflare`, a third-party adapter that must track a
   fast-moving framework forever. Astro ships a zero-JS baseline and hydrates
   only the islands that animate, and Starlight makes the `/docs` scope item
   cheap when it arrives. Islands are also the better substrate for motion,
   because what hydrates is explicit.
2. **Workers instead of Pages.** Pages is in maintenance for new projects;
   Workers static assets is Cloudflare's current path and is where a later
   server route (a redirect to the newest release, for instance) can be added
   without a migration.

**No adapter.** Static output needs none. `wrangler.jsonc` points at `./dist`
and that is the whole deployment surface.

**The deploy runs from the repository, on every push, through Cloudflare
Workers Builds.** Root directory `web`, build command **`npm run build:ci`**,
deploy command `npx wrangler deploy`; the Worker is `wordscript-homepage`. That
model is why all three typefaces are committed: the build starts from a clone,
so anything the page needs and the repository does not carry is a 404 that no
build step reports (ADR 0259).

**The build command is `build:ci` and not `build`, and the difference is the
launch gate.** `scripts/launch-check.mjs` used to hang off `npm run deploy`,
which a Workers build never calls, so the pair a dashboard suggests would have
published without it. `build:ci` is the build followed by the gate; a blocker
fails the build. `npm run deploy` is the same thing plus wrangler and is the
local path.

**Two things the port settled, both recorded in ADR 0251:**

- **The component CSS is authored CSS in `@layer components`, not utilities.**
  The derivations live in its comments, and a utility class at the call site
  has nowhere to put them. Tailwind supplies preflight, the token-to-utility
  bridge and the substrate for what gets built next.
- **Four islands hydrate and nothing else does.** `HeroStage`, `Demo`,
  `Wiring`, `Band`. Every other section is `.astro` and ships no JavaScript.

**And one thing the first review settled, recorded in ADR 0252: the page reads
its facts out of the files that own them.** Three build-time inputs so far,
none of them copied into `web/`:

| Input | What it feeds | Why not typed |
|---|---|---|
| `shared/model_catalogue.json` | the vendor, lane and model grid | ADR 0115 puts a model id in that file and nowhere else; the site is its third reader |
| `simple-icons` | the fifteen focus-band marks | a brand refresh is an `npm update` |
| `src-tauri/src/core/config.rs` | the shipped hotkey defaults | transcribed once with the source named beside each; a candidate for the same treatment if it drifts |

**Analytics: Cloudflare Web Analytics, cookieless, no consent banner required
for it.** No Google Analytics, no tag manager. This is the standing SW labs
decision, not a per-project choice.

**It is installed as a snippet in the page, not by edge injection** (ADR 0261).
The site is added under Web Analytics and enabled, every documented
precondition for automatic injection holds, and the injection still does not
arrive -- `/cdn-cgi/rum` answers 404 on this host while `/cdn-cgi/trace` answers
200 with genuine Cloudflare output, so the path is live and RUM is not on it.
The reading is that a response served by a Workers static-assets binding does
not receive the injection. Cloudflare's documentation says nothing either way,
so that is a measurement plus a reading rather than a documented fact.

The snippet is the better installation independently of that. Edge injection
leaves no trace in this repository, which means `/privacy` would describe a
measurement whose existence depends on a dashboard toggle nobody reading the
code can see. **One value drives both surfaces**: `BEACON_TOKEN` in
`src/lib/analytics.ts` renders the snippet in `Base.astro` and the Reach
measurement section in `privacy.astro`, and `null` is a supported state in
which nothing is measured and nothing is claimed. `scripts/launch-check.mjs`
reads `dist/` and fails in both directions -- a section without a beacon, and a
beacon without a section.

The site token is public. It identifies a site to the beacon endpoint,
authorises nothing, and is committed rather than put in an environment variable
or a secret store, because putting it there would tell the next reader it is a
secret.

The dashboard setting is **Enable**, not *Enable, excluding visitor data in the
EU*: that option drops the beacon for EU visitors, which for a German-run
project is most of the audience, and the exclusion buys nothing that is
required -- Web Analytics sets no cookie and reads nothing off the device, so
TDDDG section 25 does not apply and the processing runs on legitimate interest.
`public/_headers` still omits `no-transform` on the HTML; that was what kept the
edge path open, and it costs nothing to leave open now that the snippet carries
the measurement. Two hosts, both Cloudflare and both read off the shipped
`beacon.min.js` rather than assumed: the snippet loads from
`static.cloudflareinsights.com` and reports to an absolute
`https://cloudflareinsights.com/cdn-cgi/rum`. A later CSP therefore needs the
first in `script-src` and the second in `connect-src`, each beside `'self'`.

That absolute URL is also why `/cdn-cgi/rum` still returns 404 on this origin
with the beacon live and correct. The same-origin path is the edge-injected
variant's; the snippet does not use it, so that 404 is not a symptom of
anything and is not worth re-investigating.

**The crawl surface is generated, and it reads the same facts the page does**
(ADR 0257). `src/lib/site.ts` and `src/lib/faq.ts` are the two modules; the
head, the JSON-LD graph, `/llms.txt` and the FAQ section are readers of them.
`robots.txt` is a route rather than a file in `public/` so its `Sitemap:` line
is not a second copy of `site`, `@astrojs/sitemap` keeps the sitemap correct as
`/docs` lands, and `404.astro` is what the already-set
`not_found_handling: "404-page"` had been pointing at. Every crawler is
allowed, the AI ones included.

**One page is offered to the index, and it is the index** (ADR 0264). The three
legal routes carry `noindex, follow` off `src/layouts/Legal.astro` and are
filtered out of the sitemap by the same `LEGAL_ROUTES` list the footer draws
from, so the two files cannot disagree. They stay linked from every page, which
is what section 5 DDG asks for, and they stay in `/llms.txt`, which is a
retrieval surface and not an index. `robots.txt` is untouched: it still allows
everything, because a `Disallow` there would stop the crawl that has to happen
for the `noindex` to be read at all.

The directive is stated twice on purpose -- the meta tag out of the layout and
`X-Robots-Tag` out of `public/_headers` -- because those pages carry personal
data of the operator and a `noindex` that lives in one file is one silent edit
away from gone. `scripts/launch-check.mjs` asserts both per route, and refuses
to deploy if either is missing or if a path is noindexed that is not a legal
route. The structured data names no address anywhere: the graph has no
`PostalAddress` and no `Person`, and `src/lib/legal.ts` is the one constant the
two pages read.

**The imprint is not served here** (ADR 0265). It is one document for the whole
of SW labs at `legal.sw-labs.de/imprint`, linked from the footer of every page
and 301-redirected from the old `/imprint/`. No address field exists in this
repository any more: `ENTITY` is `name` and `holder`, the privacy notice names
the controller and gives an inbox per Article 13 (1) (a) GDPR, and the link
carries the rest. `launch-check` blocks on a missing footer link or a missing
redirect, because both fail silently.

**No CMS.** Content lives in the repository beside the code that renders it.

## Repository placement

The site lives in **`web/`**, with its own `package.json` and its own lockfile,
and is deliberately **not** wired into a root workspace.

The reason is that the repository root is the Tauri app: `npm test`,
`npm run build` and `npm run tauri dev` are the eval loop the concurrent tracks
depend on, and their meaning must not change because a marketing site moved in
next door. A root workspace would put the site's dependency tree in the app's
`node_modules` and its failures in the app's test run.

Consequences to carry:

- CI needs path filters in both directions so an app change does not run the
  site build and a site change does not run the Rust suite
- the Husky pre-commit hooks are the root's and apply to `web/` too, which is
  correct and wanted, gitleaks in particular
- `npm audit` after dependency changes applies here as well
- `web/public/assets/` is gitignored on purpose. It is a build-time copy of
  `assets/`, and a copy that can be committed is a copy that can drift.

## Licence and trademark

The site inherits the repository's **AGPL-3.0**, and that is fine: for site
code it means a forker must publish their changes, which costs us nothing.

**What a copyleft licence explicitly does not convey is the trademark**, and in
an AGPL repository with no notice that question is left open. The repository
needs a `NOTICE` or `TRADEMARK.md` reserving the WordScript wordmark, the logo
lock-ups and the SW forge mark. It needs one anyway for V1 gate G12 (AGPL
source offer plus third-party notices in the distributed artifact), so this is
one piece of work, not two.

**Third-party assets the site serves**, and each needs its licence beside it in
`web/public/fonts/` or named here:

| Asset | Licence | State |
|---|---|---|
| Archivo | SIL OFL 1.1 | text shipped |
| IBM Plex Mono | SIL OFL 1.1 | text shipped |
| Fraunces italic 400, variable optical size | SIL OFL 1.1 | text shipped. Replaced Zodiak, which the ITF Free Font License allowed us to serve and not to commit, once the deploy moved onto a machine that has only the repository (ADR 0259) |
| The fifteen focus-band marks | Simple Icons, CC0-1.0 | read from the npm package at build time |

## Open facts

Marked open rather than guessed.

- **A second contact channel for the imprint. Open on a live site.** Section 5
  DDG asks for a way to reach the provider that is as fast as email and is not
  email. The Court of Justice settled the point on the same wording in C-298/07
  of 16 October 2008: the address alone does not satisfy it, and the second
  channel need not be a telephone number. The owner decided for one anyway,
  because the alternative a static site could offer is a form with a response
  time attached to it. The number has not been supplied, so `PHONE` in
  `src/lib/legal.ts` is `null` and the imprint renders without the row.
  **It stopped being a deploy blocker on 2026-08-27 and the site was published
  with it open** -- the owner's decision, taken with the exposure named
  (ADR 0260). `scripts/launch-check.mjs` prints it on every run instead, and
  the notice removes itself the moment the value is set. ADR 0258, ADR 0260.
- ~~**Whether the Zodiak file is the untouched Fontshare webfont.**~~ Closed
  by removal on 2026-08-27, not by an answer. The question only mattered
  because the ITF Free Font License forbids subsetting and format conversion,
  and Zodiak is no longer served (ADR 0259). The three faces that replaced the
  set are OFL 1.1, whose condition 3 permits modification outright, so the
  question does not arise for any of them. The tooling gap that blocked it is
  unchanged: reading a woff2's name and glyph tables needs a Brotli decoder
  that is not installed here and that `pip` refuses to add under PEP 668.
- **The beacon is installed and has never been seen to report.** The defect
  behind this entry is fixed: it used to say the beacon was not arriving and
  that `/privacy` therefore described a measurement that was not happening.
  Both surfaces now hang off `BEACON_TOKEN` (ADR 0261), so the notice cannot
  over-declare again.

  What is open is one step further on. With the token set, the snippet is in
  the served HTML -- that is checkable from here and the gate checks it. Whether
  the beacon then successfully reports is not: the checks are `/cdn-cgi/rum`
  answering rather than 404, and a figure appearing in the dashboard. Neither
  is scriptable from this repository -- wrangler ships no Web Analytics command
  and the RUM API refuses its OAuth token for want of an analytics scope
  (HTTP 403). It needs one look at the dashboard after the first real traffic.
- **A legal review of the three pages.** They are drafts from the
  `web-launch-gate` templates until they have had one. Two questions are worth
  putting to it by name: the English-only decision (ADR 0258), and whether the
  terms hold as conditions of use rather than as general terms.
- **The manual accessibility pass.** Not a BFSG obligation for this site as it
  stands, and the derivation for that is in ADR 0258; still the gate an
  automated run does not clear on its own.
- **Photography.** See Content and assets.
- **Email.** Deferred, not decided against forever.
- **`/docs`.** Scope, and whether it is Starlight or hand-built. After launch.

## Verified state, 2026-08-26

- The site **builds** and has been audited twice, and the two audits ask
  different questions. Against the sketch it replaced (ADR 0251): a
  computed-style diff over 78 selectors and 22 properties, no overflow at ten
  widths, no AA contrast failure, reduced motion complete, zero banned
  punctuation, four font requests for four declared faces. Against the runtime
  (ADR 0252): every capsule state, delivery path, hotkey and model id read back
  to the file that owns it, which is the pass the first audit is blind to
  because both of its sides came from the same sketch.
- **Re-measured 2026-08-26 after that second pass:** no overflow at ten widths
  from 360 to 1920, no AA failure across the twenty-two surfaces added, all
  seven modes reaching their end state under **both** delivery modes with every
  rule fired, reduced motion complete at 25 of 25 reveals, zero banned
  punctuation in the HTML and in every emitted chunk, zero page errors.
  Transfer 111.6 KB gzipped, of which 59.0 is the React runtime.
- The site is **not publishable**, and the reason changed on 2026-08-27. The
  imprint, the privacy notice and the terms exist and resolve; gate 4 of
  `web-launch-gate` has run. What is left is the list under Open facts, of
  which two are enforced by `npm run deploy` and three are gates outside this
  repository. The custom-domain route in `wrangler.jsonc` stays commented.
- **Third pass, 2026-08-26, copy and marks.** Six explanatory sub-lines cut,
  the hero's caption removed, AGPL-3.0 and the three desktops drawn as marks,
  `local or cloud` corrected to the four lanes, and the close signed. Re-checked
  after it: `astro check` 0 errors and 0 warnings, zero banned punctuation in
  the built HTML and in every emitted chunk, no overflow from any changed
  element at 360 and at 1440. Not re-run: the full ten-width sweep and the AA
  contrast pass, which the next launch-gate run owns.
- **Fourth pass, 2026-08-26, the crawl surface** (ADR 0257). Canonical, the
  full Open Graph block with the card's measured 1200x630, `twitter:card`, a
  square touch icon, one JSON-LD `@graph` of four nodes, generated
  `robots.txt`, `/llms.txt`, `@astrojs/sitemap` and `404.astro`, plus
  `public/_headers`. Re-checked after it: `astro check` 0 errors and 0
  warnings across 48 files, the graph parses and carries none of `offers`,
  `aggregateRating`, `softwareVersion`, `downloadUrl` or `datePublished`,
  `sitemap-0.xml` holds the one canonical URL and not the 404, zero banned
  punctuation in the built HTML and in every emitted chunk. Cost on
  `index.html`: 4.36 KB raw, 1.18 KB gzipped. No copy, CSS or island moved.
  The `workers.dev` preview host is closed in `wrangler.jsonc` rather than
  noindexed in `_headers`: `workers_dev: false` and `preview_urls: false`, so
  the second public copy of the site does not exist. The custom-domain route
  stays commented, which means `wrangler deploy` produces a Worker reachable
  nowhere -- the correct state for a site that may not be published, and one
  that makes an accidental launch impossible rather than unlikely. Checked with
  `wrangler deploy --dry-run`.
  **Not verified and not verifiable here:** nothing has been fetched by a real
  crawler and no rich-result validator has run, because the zone still does not
  resolve.
- **Fifth pass, 2026-08-27, the legal routes** (ADR 0258). `/imprint`,
  `/privacy` and `/terms` written against the real third-party inventory;
  `/dpa` removed from the footer rather than written, because there is no
  Article 28 processing to put behind it. Entity facts in `src/lib/legal.ts`,
  prose styles in `site.css`, `scripts/launch-check.mjs` gating
  `npm run deploy`. Two fixes the new routes forced: the header's six section
  links were bare fragments and pointed at nothing off the index, and ADR
  0257's graph typed every page as an `FAQPage` under the site's own name.
  Measured after it: `astro check` 0 errors and 0 warnings across 54 files,
  five pages built, the sitemap lists four URLs and excludes the 404, no
  overflow on the four secondary routes across eight widths from 360 to 1920
  (document scroll width and per-element rectangles), every new colour pair
  passes AA against the ground -- 14.83:1 for the 20px headings, 9.27:1 for the
  16px prose, 8.14:1 for links, 5.91:1 for the 11px stamp -- and the accent
  against the body colour is 1.14:1, which is why prose links carry an
  underline rather than colour alone. Zero banned punctuation in every emitted
  file, checked by the new script rather than by hand. The imprint page and the
  index carry distinct JSON-LD page nodes, verified by parsing both.
  **Not verified here:** no legal review has taken place, and the manual
  accessibility pass has not been walked.
- **Sixth pass, 2026-08-27, the accent face and the build machine** (ADR 0259).
  The deploy moved onto Cloudflare Workers Builds, which starts from a clone,
  and the one face that could not be committed became a face the build cannot
  have. Zodiak out, Fraunces italic 400 in, chosen by the owner from five OFL
  candidates rendered into the real hero line. Measured after it: the emphasis
  ratio re-derived with the same canvas instrument that reproduced the old
  1.04 for Zodiak (Archivo 0.5275, Zodiak 0.5075, ratio 1.0394) and returns
  1.1921 for Fraunces, so the rule is `1.19em`; the x height flat at 0.4694 to
  0.4700 across 19, 23, 48 and 200 px, so one ratio serves all three call
  sites; the optical-size axis live and worth its bytes, `once` at 48 px
  measuring 94.73 px at opsz 48 against 80.75 px at opsz 144. All three call
  sites resolve to Fraunces in the built page, the hero `once` computes to
  57.12 px against a 48 px host, and the string `zodiak` appears nowhere in the
  emitted document. `launch-check.mjs` rewritten to ask what a clone asks --
  every declared face in the tree and in the index, one licence text per
  family -- and its first version failed a correct tree by counting files
  rather than families.
  **Not verified here:** nothing has been rendered by a browser other than this
  one, so the fallback stack behind Fraunces is untested.
- **Seventh pass, 2026-08-27, the social card** (ADR 0262). `assets/OG.png`
  dated from 2026-05-13 and predated the design system entirely: its two pitch
  lines in a sans italic the page declares nowhere, the app icon at 242 pixels
  against the header's 26 so that its border read as a frame, flat black under
  it, and a sentence naming the category while
  `SITE.ogDescription` argued the opposite directly beneath it in the same
  preview. It is now composed by `web/scripts/make-og.mjs` from the page's own
  rules and carries the cleanup scene inside the hero's window. Measured after
  it: `astro check` 0 errors and 0 warnings across 55 files, `npm run
  launch-check` no blockers in `dist/`, the built card 1200x630 as the Open
  Graph block declares, and the palette step 617,727 bytes truecolour against
  200,272 indexed at 0.776 per cent RMSE with no banding in the lamp. One
  correction was measured away rather than shipped: the gap between `Speak` and
  the ink of `once` runs 7.58, 11.06 and 15.16 px at 48, 70 and 96, ratios of
  0.1579, 0.1580 and 0.1579, so the italic is set no tighter on the card than
  on the page and the padding came out.
  **Not verified here:** nothing checks that the committed PNG is what the
  script would draw today, and a gate for it would need a browser in CI.
- `wordscript.dev` is registered and on Cloudflare nameservers
  (`ariella.ns.cloudflare.com`, `leland.ns.cloudflare.com`). The zone was empty
  and the hostname did not resolve until 2026-08-27, when the custom-domain
  route in `wrangler.jsonc` was uncommented (ADR 0260). `custom_domain: true`
  makes wrangler create the record, so the first deploy carrying that line is
  what puts the site online -- and commenting the line out again does not undo
  it, because the record stays in the zone.
- `package.json` and `src-tauri/tauri.conf.json` both read `0.2.2-alpha`;
  nothing is published.
- The four canonical addresses are in `src/lib/appMeta.ts`, one of them `null`.
