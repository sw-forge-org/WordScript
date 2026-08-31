# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- Template for new releases:

## [X.Y.Z] - YYYY-MM-DD

### Added
- New features or capabilities

### Changed

- **The orb has four states and none of them pulses.** `idle`, `listening`,
  `thinking` and `speaking`, each moving the way that state behaves. The
  predecessor had two and a fixed-period keyframe — a heartbeat, which says
  ALIVE in three states where that is the wrong thing to say, and which drives
  a voice with a symmetrical oscillator when speech has no period at all
  (ADR 0049).
- **The focus ring stopped outweighing the primary action.** It was
  `2px solid var(--accent)` at a 2px offset on eight control classes; the
  offset detached it from its control so it read as a warning badge around the
  object. Now a thin saturated core flush to the control plus a wide low-alpha
  halo — quieter at the same visibility.
- **The accent is spent on one thing at a time.** A disabled toggle no longer
  wears it, a status badge is tinted rather than filled, the toggle knob is
  light in both states so an on switch reads as a track rather than a slab, and
  the input meter's fill is neutral until something is worth acting on.
- **Surfaces have material, not only elevation.** One 1px inset highlight on
  the top edge — the edge that turns toward the light — plus a four-step cast
  shadow ladder replacing four hardcoded literals.
- **Home is built around the shortcut.** "Press Ctrl+Super in any app" was the
  most important fact in the product, set at 13 px in the colour for things you
  may skip. It is now keycaps over a field that responds to input level.
- Changes to existing functionality

### Deprecated
- Features that will be removed in upcoming releases

### Removed
- Features removed in this release

### Fixed
- Bug fixes

### Security
- Security patches and vulnerability fixes

-->

## [Unreleased]

### Changed - the imprint is one document for SW labs, and this site links to it

- **`/imprint/` is gone from this site.** The document is served for the whole
  of SW labs at `legal.sw-labs.de/imprint` and the footer links it from every
  page. One address, one document, however many products -- an accuracy
  argument before it is a privacy one (ADR 0265).
- **Every address field is deleted rather than hidden.** `ENTITY` is down to
  `name` and `holder`. The privacy notice names the controller and gives an
  inbox, which is what Article 13 (1) (a) GDPR asks for -- identity and contact
  details, not a postal address -- and links onward for the rest. `PHONE` goes
  with it: its only reader was the imprint.
- **The draft that came first answered the wrong question.** It moved the
  provider's address fields into `astro:env` secrets, with the build failing on
  a missing value and the gate refusing a build made against the placeholders.
  It worked -- and the question worth asking was not how to store those fields
  safely, but why this site was storing them at all. That draft never shipped.
- **`/imprint/` keeps working.** `public/_redirects` sends both `/imprint` and
  `/imprint/` to the document with a 301 -- the route was live for four days,
  linked everywhere and in a sitemap Google has fetched. Probed against
  `wrangler dev`: both answer 301.
- **The footer link is the obligation now, so the gate blocks on it.**
  `launch-check` asserts the link on every built page and the 301 in the
  shipped `_redirects`. Four mutations were run against it -- stripped link,
  deleted redirect, broken `href` shape, stripped `noindex` -- and one of them
  found a real hole: the route parser read string literals only, so the day the
  imprint's `href` became an identifier it silently checked one route fewer and
  both imprint guards passed by having nothing to look at. The parser now
  compares what it resolved against what the list declares.
- **The risk is recorded, not buried.** Whether a link to another domain
  discharges section 5 (1) no. 1 DDG for *this* telemedium is unsettled. The
  owner was told and decided; ADR 0265 carries what reduces it and what does
  not.

### Changed - the legal routes are linked from every page and offered to no index

- **`/privacy/`, `/imprint/` and `/terms/` carry `noindex, follow`.** They had
  carried no robots directive at all -- not in the head, not in the response
  headers -- which was never a decision: it is what a shared layout does when
  nobody says otherwise, and the `noindex` prop `Base.astro` already had was
  called by `404.astro` alone. The directive is set on `Legal.astro`, the shell
  all three render through, so a fourth legal route inherits it by construction.
  `follow` rather than `nofollow`, because these pages reference the provider
  and the hosting vendor's own notice and a crawler on a stale link should be
  able to take the way home (ADR 0264).
- **The sitemap lists one URL, and drops the three by reading them.**
  `astro.config.mjs` imports `LEGAL_ROUTES` from `src/lib/legal.ts` -- the list
  `Foot.astro` and `/llms.txt` already read -- rather than repeating the paths.
  A sitemap is a request to index, so a noindexed URL listed in one is the site
  contradicting itself in two files, and Search Console reports exactly that as
  `Submitted URL marked noindex`.
- **The directive is stated on two layers, and the gate refuses to ship one
  without the other.** `public/_headers` sets `X-Robots-Tag: noindex, follow`
  on the three routes as well as the meta tag. A directive living in one file
  only is one silent layout edit away from gone -- the page would still render,
  the build would still pass, and the finding would arrive weeks later as a
  search result.
  `scripts/launch-check.mjs` reads `LEGAL_ROUTES` and asserts both copies per
  route, plus the reverse: no path noindexed in `_headers` that is not a legal
  route. Verified by mutation rather than by reading -- a deleted rule, a stray
  `/pricing/` rule and a stripped meta tag were each caught, and the gate went
  back to green.
- **One header rule per route, because the pair was measured.** Bare path and
  splat were both written first; probed against `wrangler dev`, `/imprint/`
  matched both and the response carried `X-Robots-Tag` twice. The splat was
  dropped -- nothing sits beneath these routes, and `/imprint` without the
  slash is a 307 to `/imprint/`.
- **`robots.txt` is unchanged on purpose.** A `Disallow` would stop the crawl
  that has to happen for the `noindex` to be read, which is how a page ends up
  listed as a bare URL with no snippet. Every crawler is still allowed, the AI
  ones included, and `/llms.txt` still links all three legal pages: that is a
  retrieval surface, not a ranking.
- **Nothing became harder to reach.** Section 5 DDG asks for the imprint to be
  easily recognisable and directly accessible on the site; the footer draws all
  three routes on every page, which is the surface that provision is about.
- **The structured data was checked and carries no address at all.** No
  `PostalAddress`, no `streetAddress`, no `LocalBusiness`, no `Person` and no
  microdata anywhere in `src/`; no address fragment in any `description` or
  `og:*` tag; the footer's legal links carry no `rel`, so no `nofollow` --
  correct, because `nofollow` on an internal link to a page that is already
  `noindex, follow` would only stop the crawl that reads the directive.

### Added - wordscript.dev answers on www, and only the apex serves

- **`www.wordscript.dev` resolves and redirects.** It did not resolve at all
  after launch, so anyone typing the address the way most people still type one
  got a DNS failure rather than a site. A proxied `CNAME www -> wordscript.dev`
  plus a Cloudflare Single Redirect matching `http.host eq "www.wordscript.dev"`
  now answers 301 to the same path on the apex (ADR 0263).
- **Attaching `www` to the Worker as a second custom domain was tried, worked,
  and was undone.** Both hostnames served the site. The crawler half of that was
  already handled -- `canonical`, `og:url` and the sitemap line all read `site`
  from the Astro config rather than the request, so they name the apex even when
  served on `www`. What decided against it was the beacon switched on the day
  before: Web Analytics counts by hostname, so two serving hostnames means every
  figure read off either row is a fraction of the traffic with nothing saying
  so. The right answer changed because something else in the system changed.
- **The rule matches exactly one host**, `eq` rather than a wildcard. Redirect
  rules are zone-wide, so a broad match is a standing trap for every subdomain
  this zone does not have yet.
- **Measured rather than assumed**, on 2026-08-30: every path on `www` answers
  301 to the same path; `?ref=test&utm_source=x` survives intact;
  `http://www/terms/` reaches `https://wordscript.dev/terms/` in one hop rather
  than two; the apex answers 200 with an empty `Location`, so nothing loops.
  Cloudflare's universal certificate already carried `www` in its SAN list, so
  TLS needed nothing.
- **`PRODUCT.md`'s address table said the site does not resolve.** It had said
  so since before launch and was three days stale. Corrected, with the hostname
  fact written beside it.

### Changed - wordscript.dev, the social card is drawn by the site instead of beside it

- **The card was older than the design it stood for.** `assets/OG.png` entered
  the repository on 2026-05-13, before a line of the site's design system was
  written. Its wordmark is the real one, but the two lines carrying the pitch
  are a sans italic, and the page declares Archivo roman, Fraunces italic and
  Plex Mono and sets a sans italic nowhere. It also blew the app icon up to 242
  pixels against the header's 26, until its border read as a picture frame, and
  stood on flat black where the page opens on a lit ruled sheet. Worst of it
  was the sentence: the card said you speak into any text field, which is what
  every peer opens on, while `SITE.ogDescription` right underneath it in the
  same preview said you speak once, it lands, it stays, it acts (ADR 0262).
- **`web/scripts/make-og.mjs` composes the card out of the page's own rules.**
  The ground, the lamp, the ruled sheet at the lede's 26px line box, the paper
  grain, the `h1` with its one italic, the header lock-up, the hero's fact
  strip and the cleanup scene inside `.stage__win` -- every one of them read
  from `globals.css`, `site.css` or `src/lib/scenes/cursor.ts` rather than
  redrawn. `npm run og` writes it.
- **It is not a build step and cannot become one.** The deploy starts from a
  clone with no browser on it (ADR 0259), so the PNG stays committed and
  `sync-assets.mjs` copies it as before. Fonts, wordmark and icon are inlined
  as data: URIs: a `file://` page cannot read a sibling without a flag, and a
  mask that fails to load paints nothing while the run reports success.
- **255 palette entries, because the grain is already a dither.** 617,727 bytes
  truecolour against 200,272 indexed, 0.776 per cent RMSE, no banding in the
  lamp at 200 per cent magnification. ImageMagick is not a dependency, so its
  absence prints a line and ships the truecolour file.
- **A correction the card nearly made to itself was measured away.** The
  italic reads tight against the roman, and the first pass padded it here only.
  The gap between `Speak` and the ink of `once` is 7.58px at the page's largest
  48, 11.06 at the card's 70 and 15.16 at 96 -- ratios of 0.1579, 0.1580 and
  0.1579. Identical setting at every size, so the padding came out.
- **`SITE.og.alt` describes the picture rather than repeating the title.** It
  read `WordScript`, which is the one thing a reader without the image already
  has.

### Fixed - wordscript.dev, the reach measurement and the notice that describes it

- **`/privacy` described a processing operation that was not happening, and now
  cannot.** The Reach measurement section rendered unconditionally: what
  Cloudflare Web Analytics processes, that IP address and user agent are hashed
  immediately, that the data is available to us for six months. None of it was
  running. `BEACON_TOKEN` in `src/lib/analytics.ts` is now the single value
  behind the beacon in `Base.astro`, the Reach measurement section in
  `privacy.astro` **and** the clause in the summary paragraph that promises that
  section. `null` is a supported state: nothing measured, nothing claimed
  (ADR 0261).
- **The measurement is installed as a snippet rather than by edge injection.**
  The entry below recorded the beacon as not arriving with the dashboard as the
  last unread variable. The owner confirms the site is added and enabled, which
  settles it: `/cdn-cgi/rum` returns 404 on this host while `/cdn-cgi/trace`
  returns 200 with genuine Cloudflare output, so Cloudflare's own path is live
  and RUM is not on it. The reading is that a Workers static-assets response
  does not receive the injection -- a measurement plus a reading, since
  Cloudflare's documentation addresses neither way. The snippet is the better
  installation regardless: edge injection leaves no trace in the repository, so
  a legal page would depend on a toggle nobody reading the code can see.
- **The site token is committed, deliberately.** It identifies a site to the
  beacon endpoint and authorises nothing. Putting it in an environment variable
  or the OS secret store would tell the next reader it is a secret, and they
  would then handle a public string as one.
- **The launch gate reads `dist/` and fails in both directions.** A Reach
  measurement section with no beacon served, and a beacon served with no
  section -- the second being the harmful direction, processing the notice does
  not describe. Both were provoked by hand-corrupting the built output rather
  than assumed to work.

### Fixed - wordscript.dev, the first measurement against a live site

- **The analytics beacon is not arriving, and `/privacy` says it is.** The
  first check that could only be run once the domain resolved was run:
  `wordscript.dev` returns five script tags, all of them Astro's, and zero
  occurrences of `cloudflareinsights`, `beacon.min.js` or `cf-beacon`. Every
  precondition on this side is met -- the zone answers on Cloudflare addresses,
  the HTML parses, and the `Cache-Control` carries no `no-transform`, which is
  the documented blocker and which `public/_headers` omits on purpose. The
  remaining variable is the dashboard and it cannot be read from here. Recorded
  in `PRODUCT.md` under Open facts as a measured negative rather than an
  unperformed check.
- **What did verify on the live site**, all of it measured rather than assumed:
  the four routes and both text endpoints return 200 and an unknown path
  returns 404; all four typefaces serve with
  `public, max-age=31536000, immutable`; `zodiak-400-italic.woff2` returns 404
  and nothing asks for it; the four security headers in `public/_headers` are
  present, so Workers static assets parses that file; and the deployed
  stylesheet carries the same content hash as the local build and the
  `font-size:1.19em` rule from ADR 0259, which is what proves the push-to-deploy
  path ran end to end.
- **The custom domain declared in `wrangler.jsonc` did not collide with the one
  created by hand in the dashboard.** The deploy ran and the site serves the
  newest build. Not established from the documentation, and therefore not
  claimed: whether removing that line from the config later would detach the
  domain. Leave it in place.


### Added - wordscript.dev is live

- **The custom-domain route is open.** `wrangler.jsonc` carries
  `"routes": [{ "pattern": "wordscript.dev", "custom_domain": true }]`, which
  every earlier record called the launch gate. `custom_domain: true` makes
  wrangler create the DNS record, so the first deploy carrying that line puts
  the site online. The comment above it changed job: it used to say why the line
  was absent and now says what the line does, including the part that is easy to
  get wrong later -- commenting it out again does not take the site down,
  because the record stays in the zone (ADR 0260).

### Changed - wordscript.dev, one legal item is open on a live site and says so

- **The missing second contact channel no longer blocks the deploy.** Section 5
  DDG asks for a means of contact permitting rapid and direct communication
  beside the email address, and the Court of Justice read the same wording in
  C-298/07 of 16 October 2008 as not satisfied by the address alone. `PHONE` in
  `src/lib/legal.ts` is still `null`. The owner decided to publish and supply
  the number afterwards, with the exposure named. `scripts/launch-check.mjs`
  prints a headed notice on every successful run instead of failing, carrying
  the statute, the judgment and the fact that it was a decision rather than an
  oversight (ADR 0260).
- **The notice is conditional on the value and removes itself.** The day `PHONE`
  stops being `null` the check has nothing to say, so there is no second cleanup
  to remember. Deleting the check outright was rejected: an open legal item that
  stops being printed is one nobody remembers, and it is the only one of the
  four open gates this repository can answer for itself.


### Changed - wordscript.dev, the deploy moved and took the typeface with it

- **The site deploys from the repository on every push.** Cloudflare Workers
  Builds, root directory `web`, build command `npm run build`, deploy command
  `npx wrangler deploy`, Worker `wordscript-homepage`. The name is in
  `wrangler.jsonc` now because it was `wordscript-dev` there and
  `wordscript-homepage` in the dashboard, and a mismatch does not fail: it
  deploys a second Worker beside the first.
- **Zodiak is replaced by Fraunces italic, and the reason is the build machine
  rather than the drawing.** A build from the repository starts on a clone, and
  the ITF Free Font License forbids the repository from carrying that font, so
  the clone had no display italic and the page preloaded a 404 that no build
  step reports. Three ways to keep it were considered and each buys one 23 kB
  file at a recurring price: base64 in a build variable past the per-variable
  limit, an R2 bucket with a token to rotate, or a runtime request to the
  Fontshare API that contradicts the third-party inventory `/privacy` states.
  The licence attaches to the font, so the fix is a font. Fraunces is OFL 1.1
  and is committed like the other two; the owner chose it from five candidates
  rendered into the real hero line (ADR 0259).
- **The emphasis ratio was re-derived rather than converted.** `em` carried
  `font-size:1.04em` as a measured correction matching the serif word's x
  height to its Archivo host. The instrument -- the glyph `x` rendered at
  400 px into a canvas, ink measured up from the baseline -- was run against
  the old pair first and returned Archivo 0.5275, Zodiak 0.5075, ratio 1.0394,
  reproducing the number already in the file. Against Fraunces it returns
  0.4425 and 1.1921, so the rule is `1.19em`. The x height is flat from 19 to
  200 px, so the live optical-size axis moves the drawing and not the ratio,
  and one correction still serves all three call sites.
- **The variable cut ships at 42 kB where a pinned instance is 22 kB.** The
  optical-size axis is doing real work: `once` at 48 px measures 94.73 px wide
  at opsz 48 and 80.75 px at opsz 144. The three places that reach `--f-em` run
  at roughly 16, 23 and 48 px, so no single pinned size is right for them.

### Fixed - wordscript.dev, the launch gate would have stopped running the day it mattered

- **The Workers Builds build command is `npm run build:ci`.** Workers Builds
  runs a build command and a deploy command as two steps, and the obvious pair
  -- `npm run build` then `npx wrangler deploy` -- calls nothing that runs
  `scripts/launch-check.mjs`, because the gate hung off `npm run deploy`. Every
  check it performs would have stopped running on the only path that publishes,
  and nothing would have said so. `build:ci` is the build followed by the gate,
  so a blocker fails the build.
- **`npm run deploy` had never run `sync-assets.mjs`.** It read
  `astro build && ... && wrangler deploy`, and npm matches `pre` hooks by script
  name: `prebuild` fires for `build` and for nothing else. Both scripts now go
  through `npm run build`. The bug was invisible because a person runs the build
  first out of habit, and `public/assets/` is gitignored -- on a build machine
  that directory starts empty.

### Fixed - wordscript.dev, a check that guarded a path instead of a font

- **`launch-check.mjs` asks the question a clone asks.** It reads every face
  `globals.css` declares and requires each to be in the tree and in the index,
  with one licence text per family, both lists taken from the tree rather than
  carried in the script. The version before it named one file, and a second
  copy of the same face plus two further weights sat one directory up in the
  sketch's `fonts/` folder, uncovered -- committing `web/` as it stood would
  have pushed three Zodiak files to a public repository. Its own first draft
  then failed a correct tree by counting `src` urls against licence files: Plex
  Mono is declared twice, at 400 and 500, and has one licence.
- **`/terms` states one licence for all three faces and the sentence is true.**
  An earlier draft said the same thing while one face was under a different
  licence. The comment above it keeps that history and names what to re-read if
  a fourth face is ever added.


### Added - wordscript.dev, the three legal pages and the fourth link that went away

- **`/imprint`, `/privacy` and `/terms` exist and resolve.** The footer drew
  four legal links at pages that did not exist, and `PRODUCT.md` recorded them
  as the blocker on publishing. Three are written, against gate 4 of the
  `web-launch-gate` skill and against the real third-party inventory rather
  than a remembered one: Cloudflare serves and resolves the site, the four
  faces are self-hosted, the four footer links are links and not embeds, and
  `src/` sets nothing on the reader's device -- no `localStorage`, no
  `sessionStorage`, no cookie, no `indexedDB`, checked rather than assumed. The
  imprint cites the DDG, not the repealed TMG (ADR 0258).
- **The privacy notice covers the application, not only the website.** A
  dictation product whose privacy page discusses its marketing site answers the
  question nobody asked. Every claim in that section was read off the runtime:
  `src-tauri/src` carries no telemetry, no usage reporting and no crash
  reporting; audio leaves the machine only on a cloud profile and then to the
  reader's own vendor on their own key; the provider key lives in the operating
  system's secret store; and the one request the app makes of its own accord is
  named with the moment it runs, which is when the About section is first
  opened, never at startup.
- **`scripts/launch-check.mjs` gates `npm run deploy`.** It runs on `dist/`
  after the build and before wrangler, because what ships is the rendered page
  and a string assembled from two variables is invisible to a source scan. It
  fails on an unfilled `[[PLACEHOLDER]]`, `lorem ipsum`, the placeholder
  telephone number, a citation of the TMG or the TTDSG, a link to the EU ODR
  platform shut down on 2025-07-20, the site's banned punctuation in any
  emitted file, a footer route with no page, the still-null telephone number
  and the OPEN marker in the fonts' NOTICE. The three gates it cannot see -- a
  dashboard switch, a legal review, the manual accessibility pass -- are
  printed rather than omitted, because a check that silently drops them reads
  as full coverage.

### Removed - wordscript.dev, the DPA link

- **`/dpa` is gone from the footer and was never written.** An Article 28
  agreement is a contract with somebody processing personal data on your
  behalf. WordScript hands us nothing to process: it runs on the reader's
  machine, there is no account and no server of ours, the key is theirs, and a
  cloud lane goes from their machine to a vendor they chose on an account they
  own. The page would have had to invent that relationship or spend a screen
  explaining that it does not exist. The reasoning sits in `src/lib/legal.ts`
  beside the list it draws, because a removed link is what somebody re-adds to
  restore symmetry (ADR 0258).

### Fixed - wordscript.dev, what a second route and a read-back exposed

- **The header's section links pointed at nothing off the index.** Six bare
  fragments in `Top.astro`: on `/imprint`, `#how` addresses a fragment of
  `/imprint`, so pressing it did nothing at all. They are root-relative now,
  which is still an in-page jump on the index because Lenis resolves a
  same-document hash whatever path precedes it. The wordmark goes to the top on
  the index and home from a subpage.
- **Every page claimed to be a frequently asked questions page.** ADR 0257's
  graph was written for a site with one route, so the page node was typed
  `WebPage` and `FAQPage`, carried the six questions and took the site's own
  title and description. The first legal page built under it asserted in
  machine-readable form that it was an FAQ about a dictation app, under a name
  that was not its own -- the exact failure that record set out to avoid, one
  route later. The page node takes the head's own title and description, and
  the FAQ typing belongs to the index alone, identified by its path rather than
  by a flag every call site has to remember.
- **The language decision was recorded as a legal duty that does not exist.**
  ADR 0258's first draft and the imprint's own comment stated that a German
  provider owes the mandatory details at least also in a language attributable
  to it, which made the English-only imprint read as a tolerated violation.
  Neither section 5 DDG nor Article 12 GDPR contains a language requirement and
  no supreme court decision supplies one. Both now argue from what those
  provisions do prescribe -- recognisability and intelligibility measured
  against the group actually addressed -- and the record carries the residual
  interpretation risk plus the four conditions that reopen it: German-language
  content, prices in euro, German customer references, or a sales relationship
  to the German market.
- **The terms page named the wrong licence for one of its own typefaces.** It
  said the typefaces served here are licensed under the SIL Open Font License
  1.1. That is true of Archivo and IBM Plex Mono and false of Zodiak, which
  comes from the Indian Type Foundry through Fontshare under that foundry's own
  terms. Two of three sharing a licence is how the collapse happened. The page
  names them separately and points at the notice served beside the font files.
- **The deploy check caught the dead ODR link but not the sentence around it.**
  Regulation (EU) 2024/3228 took the platform down on 2025-07-20 and repealed
  the duty to link it, so the sentence now sends a consumer to a dead service.
  Every German imprint template written before 2025 carries it, and it survives
  in wording long after the URL is dropped, so the check greps the wording too.
  A bare three-letter `ODR` is deliberately not among the patterns.
- **Two claims in the pages rested on nothing citable and now carry the case.**
  The second-contact-channel requirement is C-298/07 of 16 October 2008, which
  also settles that the second channel need not be a telephone number; the
  third-country paragraph names T-553/23 and the pending appeal C-703/25 P.

### Fixed - wordscript.dev, the font obligation was the wrong way round

- **The display italic must not be committed, and its licence text was never
  owed.** `public/fonts/NOTICE.txt` and the deploy check both said the Zodiak
  licence text had to be added to the directory "the same way the two above
  are". That is the SIL Open Font License condition, applied to a licence
  nobody had read. Read on 2026-08-27 from fontshare.com: the ITF Free Font
  License 2.0 of 17 August 2026 requires no text to travel with the font and
  asks for no attribution. Its section 01 expressly permits self-hosting
  through `@font-face` and calls that the recommended way to use it; its
  section 02 forbids passing the font on, naming repositories, download
  services and publicly accessible servers. Serving the file is the permitted
  case, committing it to a public repository is the forbidden one.
- **So the file is served and never committed.**
  `web/public/fonts/zodiak-400-italic.woff2` is gitignored, and it had never
  been committed, so nothing had to be rewritten out of history. The NOTICE
  carries the clauses and the reading. The gate lost the marker check and
  gained the two that matter: the file has to be in the working tree, because
  the page preloads it and a missing face is a 404 on every load, and it has to
  be absent from the index. Both were proven to fire by removing the file and
  by force-adding it.
- **One thing stays unverified and is recorded as unverified.** Section 02 also
  forbids subsetting and format conversion. Whether the file is the untouched
  Fontshare webfont needs the font's name and glyph tables read, which needs a
  Brotli decoder this machine does not have and that `pip` refuses to install
  under PEP 668.
- **The display italic was preloaded on five routes and drawn on one.** It is
  reached by `em`, `.close .quote p` and `.sig__n`, which appear four times,
  once and once on the index and not at all on the three legal pages or the
  404. Four routes were each fetching 23 kB they never drew, which the browser
  reports as an unused-preload warning of its own accord. The preload is now
  emitted for the index alone.

### Added - wordscript.dev, the way back from a subpage

- **Every subpage carries a back link, and it returns to the position.** A
  reader who took a footer link to the privacy notice was some distance into
  the page they were reading; the header's wordmark goes home, but it goes to
  the top of home. The link is `href="/"` in the markup, which is what a middle
  click, a bookmark, a crawler and a reader without JavaScript get. Where the
  index is genuinely the entry behind the current page, the press becomes a
  `history.back()` and the browser restores the offset it already recorded. The
  referrer decides which of the two happens, so the label is never a promise
  the navigation does not keep.

### Fixed - wordscript.dev, going back replayed a page the reader had read

- **Five of twenty-eight blocks came back invisible.** Scroll position was
  already restored correctly; the reveal was not. The reveal runs on one
  IntersectionObserver, and an observer only ever fires for what intersects, so
  everything above the restored viewport stayed at opacity 0 and animated in
  again as the reader scrolled back up over text they had just read. Measured
  on the built page: leaving the index at 3000px and pressing back returned to
  3000px with five blocks unrevealed. Anything above the fold line is now
  marked revealed on arrival with the transition suppressed for that frame, and
  its counters take their printed value instead of running up. Bound to
  `pageshow`, which is the event a bfcache restore fires when no script re-runs
  at all. Re-measured after the change: five unrevealed became zero.

### Changed - documentation, no legal claim without its source

- **A record that states what the law requires names the norm or the
  judgment.** Where it cannot, it is marked unsettled and written as a reading
  rather than as a rule. The trigger is the language claim above: stated flatly
  and without a citation, it read as settled law, and the next record would
  have been built on it. Filed in `docs/decisions/README.md` beside the rule
  that ADRs are never rewritten retroactively.

### Added - wordscript.dev, the half of the site a crawler reads

- **The head states the page's identity.** Canonical built from the route
  against `site`, so a shared link carrying a query string is not a second URL.
  Full Open Graph including the card's real 1200x630, checked against the file.
  `twitter:card` for the layout X picks off that tag alone. A square icon at 32
  and 512 out of `src-tauri/icons`, because the lock-up in `assets/logos` is
  121x128 and iOS refuses a non-square touch icon. The title was the single
  word `WordScript`, which matches the one query nobody types before they have
  heard of the product (ADR 0257).
- **One JSON-LD graph, and what it omits is the point.** `Organization`,
  `WebSite`, `SoftwareApplication`, and the page typed as both `WebPage` and
  `FAQPage` so one URL keeps one `@id`. No `offers`, no `aggregateRating`, no
  `softwareVersion`, no `downloadUrl`: there is no release, the page says so in
  its first answer, and a schema that runs ahead of the visible page is a
  liability rather than a rich result.
- **`robots.txt`, `/llms.txt`, a sitemap and a 404 page.** `robots.txt` is
  generated so the `Sitemap:` line is not a second copy of `site`; every
  crawler is allowed, the AI ones included, because being quotable inside an
  assistant is the surface that substitutes for search traffic this site does
  not have. `/llms.txt` restates the page's claims in the shape an answer
  engine can lift, including a status section that instructs against reporting
  a version, a date or a price. `404.astro` is what `wrangler.jsonc` has been
  pointing at since it was written: `not_found_handling: "404-page"` had no
  `404.html` to find, so the four unwritten legal routes in the footer landed on
  Cloudflare's unbranded default.
- **The `workers.dev` preview host is closed in `wrangler.jsonc`, not
  noindexed.** `workers_dev` defaults to true, which would put a second public,
  indexable copy of the site under a URL nobody should be sent to. An
  `X-Robots-Tag` on that host is wrong twice: `_headers` allows one `*` per
  rule, so `https://*.workers.dev/*` cannot be written, and a header only asks
  a crawler not to list a document still being served. `workers_dev: false` and
  `preview_urls: false` instead -- the host does not exist. The custom-domain
  route stays commented: with it off, `wrangler deploy` produces a Worker
  reachable nowhere, which is the correct state for a site that has no imprint
  yet, and uncommenting it is the launch rather than a config step.
- **`public/_headers`, and one header deliberately absent.** `nosniff`,
  `strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, a
  `Permissions-Policy` denying microphone, camera and geolocation, and
  immutable caching for the hashed and font paths. No `Cache-Control` on the
  HTML and specifically no `no-transform`, which is the header that silently
  stops Cloudflare injecting the Web Analytics beacon.

### Changed - wordscript.dev, three facts stop being typed twice

- **The six FAQ pairs moved to `src/lib/faq.ts` and the product's facts to
  `src/lib/site.ts`.** The FAQ section, the `FAQPage` schema and `/llms.txt`
  are three readers of one array rather than three copies of six paragraphs;
  the head, the graph and `/llms.txt` read one description rather than three.
  The four outbound addresses are still `linkMarks.ts`'s, which already owned
  them for the footer row.

### Fixed - wordscript.dev, the phone stops losing the bottom of the opening plane

- **The pinned plane is gated on width, and it was gated on height.** ADR 0254's
  opening plane became `position: sticky` above `min-height: 640px`, which every
  phone in portrait satisfies -- and a sticky box taller than the viewport pins
  its top and hangs, so the overflow is unreachable rather than merely below the
  fold. Measured at 390x664 across the whole scroll, at every position: the
  focus band was **0 of 130px** visible and the fact strip **15 of 42px**. The
  page's evidence for its own opening claim did not exist on a phone. The demand
  is set by width, not height -- a single column stacks what two columns put side
  by side -- so the gate is now `min-width: 1080px and min-height: 700px`, the
  break where the two-column hero exists. Under 1080 the plane wants between 751
  and 918 CSS pixels of viewport; above it, 626 is the worst case. 1024x768 was
  overflowing by 60px and is fixed by the same line (ADR 0256).
- **The header is counted in the plane's height.** `.pin` was `100svh` and sits
  under a sticky header that takes its height in normal flow, so the plane ended
  one header below the fold -- measured at every width from 360 to 1440, the
  overhang was exactly 58px narrow and 62px wide. The height is now one variable
  declared beside the bar that produces it and subtracted by the plane that
  starts under it.
- **The page answers the bar an in-app browser draws over it.** `svh` is right
  for Safari's bottom bar and Chrome's address bar and was already in use; it
  says nothing about Instagram, Facebook, TikTok, LINE or WeChat, whose chrome
  the native app paints over the WebView. No `resize` fires, no
  `env(safe-area-inset-*)` reports it, and `z-index` cannot reach it because it
  is not in this document's stacking context. A pre-paint script sets
  `html.iab`, and the rules that read it add space -- to the document's end, to
  the menu panel's bottom, to the toast. **The 64px is a floor, not a
  measurement**: it needs a real iPhone through a bio link and a real Android
  through a story link, which no headless engine can stand in for.

### Changed - wordscript.dev, the phone gets navigation and one figure stops predicting an install

- **The offline card's disk figure states both ends.** It was one number, the
  whole Local lane deduped, and it was a prediction: nothing on the site knows
  which models somebody installs, and a reader who only dictates was being told
  they owed seven gigabytes for a job that costs a hundred and fifty megabytes.
  It now states the floor and the ceiling with the condition on each, which is
  the section's own argument -- a profile decides each job separately, so there
  is no single download. The ceiling stays deduped by model, because eight jobs
  resolve to four files and adding up the visible rows reports about triple
  (ADR 0255).
- **The two cards under the picker are two cards.** They were one bordered box
  with a 1px seam, which is the drawing for one thing with two halves. Each now
  carries its own border, radius and shadow. Both figure blocks are drawn by one
  rule, because a figure with the condition it holds under is the same object on
  both cards.
- **A phone gets a menu, on the page's own ground.** Below 680px the two header
  links were hidden and the phone had no way to reach any part of a
  ten-thousand-pixel page except by scrolling all of it. Six entries in page
  order, in a panel that covers the page; the burger sits to the right of the
  action. It closes when a link inside it is followed, locks the page behind it,
  answers Escape, closes when a rotation crosses the breakpoint that hides its
  button, and returns focus to that button -- none of which a checkbox toggle can
  do, which is why this one is a script where the lane picker is four radios.
- **The panel's first draft was a copy and was replaced.** Flat dark plane,
  stacked labels with hairline dividers, a chevron per row, one full-width
  accent slab at the foot: the default shape of a phone menu, and recognisably
  one particular reference. It is drawn out of what the page already owns now --
  the ruled sheet and warm lamp from the opening plane, with the light behind
  the list rather than under it; a mono `01`-`06` where the chevron was, which is
  what the demo's own tab row does; and the page's own pair of actions instead
  of a third call to action invented for one screen.
- **The panel scrolls, and fits a landscape phone without needing to.** The
  breakpoint is a width, so at 640 by 360 the burger is on the bar and the six
  rows plus header plus action came to 499px against 360 of viewport -- the
  action was 139px below a fold that could not be scrolled to. Under 560px of
  height the list yields; measured at 640 by 360, the action now ends at 355.
- **The footer's four links carry marks, three of them the vendor's own.** The
  whole row moved onto `bootstrap-icons` (MIT) to get LinkedIn's real mark:
  `simple-icons` dropped it over the trademark, and drawing a substitute makes
  the company's own page the only link in the group without its brand on it. SW
  labs takes a globe, because a wordmark at 14px is a smudge and there is no
  mark to license. Each keeps its own viewBox.
- **The footer on a phone is a grid rather than a wrapping row.** Where a
  wrapping row breaks is a function of the label lengths, so the marks moved the
  break and left one link alone on a second line. The licence takes its own line
  and the four links are two columns.
- **The activity field is legible on a phone.** Fifty-two columns of `1fr` in
  298px rendered the year at 4.3px per cell and 39px tall. It is a scroller at
  11px per cell now; the year is not thinned, because a field of real records
  that drops half of them is lying about how much it holds.
- **Fixed: the turn's lede lost a space.** It read `their own product.WordScript
  keeps it` on every viewport. Astro collapses the newline between a closing tag
  and the next word to nothing rather than to a space.
- **Fixed: `#turn` had no landing offset.** It was not a link target until the
  phone menu made it one, so a tap put its first line under the header.

### Changed - wordscript.dev, the page opens on a pinned plane and the lanes become a picker

- **The hero and the focus band are one plane the argument scrolls over.**
  `position: sticky` at `100svh` and an opaque second ground with its own top
  radius, and nothing else: no ScrollTrigger, no transform, no scroll listener.
  It works with script disabled and under `prefers-reduced-motion`, because
  nothing animates -- one box stops while the box after it keeps going. Under
  640px of viewport height it does not pin at all, which is the landscape phone
  where a plane taller than the screen would hang instead of arriving
  (ADR 0254).
- **The opening ground is a ruled sheet with one warm light on it.** Ruled at
  26px, which is the lede's own line box, and masked by the same radial light
  that washes it, so the rules exist only where the light falls. Four grounds
  were rendered and compared; the one that won on character was a cell grid
  under a warm light, and against the ruled version the grid was not what won
  it -- the light was. The rules surface again on every dark plane, and the
  closing section became one.
- **The four lane cards became a picker, and every row states what would run.**
  Four radios and `:checked ~`, still no JavaScript on the section. One lane's
  eight jobs at a time, each row carrying the job, the vendor's own mark, the
  model id the catalogue defaults to, and -- on Local only -- what it weighs.
  The section named four model ids out of thirty-five before this; the `none`
  rows stop being the quietest text on a grid and become the shape of the lane
  just opened.
- **Vendor marks are drawn in the vendor's colours, as one sprite.** Eleven
  `<symbol>` definitions with ids namespaced by slug, thirty-six `<use>` sites,
  zero duplicate ids in the document. Four vendors keep `currentColor` because
  they ship no coloured variant -- their marks are monochrome by design.
  `src/lib/svgIds.ts` is new and throws rather than passing through a file
  whose reference shapes it did not rewrite, which is what stops one flag's
  mask from being applied to every other flag.
- **Two cards answer the two questions that decide a dictation download.**
  Language: what the recogniser transcribes and what the app can name back are
  two different numbers, read from `shared/model_catalogue.json` and from the
  declared length of `ISO_639_1` in `core/language_detect.rs`, with a row of
  flags whose names are endonyms read from ICU at build time. Offline: what the
  Local lane costs -- no key, no request, and the whole eight-job lane on disk
  as one figure, deduped by model because eight jobs resolve to four files and
  summing the rows would report nearly double.
- **LinkedIn joins the footer.** There is no X link and there will not be one:
  the account belongs to the maintainer rather than to SW labs, so a link would
  point a reader looking for the company at a person.

### Added - wordscript.dev, built

- **The product site is a real build.** `web/` was a single hand-written HTML
  page with its own stylesheet and one script, kept deliberately buildless so
  the design could be settled before a build step existed. It is now Astro 7
  with React islands, static output and Tailwind v4, with its own
  `package.json` and lockfile and deliberately no root workspace, ready for
  Cloudflare Workers static assets. [ADR 0251](docs/decisions/0251-the-marketing-sketch-is-a-design-contract-so-the-astro-port-is-checked-by-computed-style-rather-than-by-eye.md)
  carries the derivation.
- **The site's tokens are the app's tokens.** `web/src/styles/globals.css` has
  the same shape as `src/styles/globals.css`: raw values on `:root`, utilities
  through `@theme inline` under the same names, component grammar in
  `@layer components`. `bg-bg-inset`, `text-fg-dim` and `rounded-control` mean
  the same thing on both sides, so a component lifted out of the app resolves
  rather than needing translation. The site adds exactly one token the app has
  no counterpart for, `--font-em`, because the app never has to introduce
  itself.
- **Four islands hydrate, and nothing else does.** The live capsule, the
  three-tab demo, the wiring diagram and the ASCII band. Every other section is
  `.astro` and ships no JavaScript, including the focus band, the research
  timeline and the 364-cell activity field.

### Changed - the port, measured rather than eyeballed

- **The port was accepted against a computed-style diff**, 78 selectors across
  22 properties on both pages side by side at 1440x900. Of 1,716 comparisons,
  64 differed, all in two classes with no visual effect: Tailwind preflight
  setting `border-style: solid` at `border-width: 0` on 63 elements, and one
  `box-shadow` where Lightning CSS resolved a `color-mix()` at build time into
  the identical `rgba()`.
- **The fifteen focus-band marks are read out of `simple-icons` at build
  time** rather than pasted as path strings, so a brand refresh is an
  `npm update`. The three whose brand colour is black are lifted to the page
  foreground by a luminance threshold rather than by a hardcoded list of three
  names, which would go stale the first time a brand goes monochrome.
- **Our own JavaScript went down**, from 21.9 KB gzipped to 15.4, and the CSS
  from 16.6 to 12.2. The HTML went up from 8.0 to 15.3, which is the markup
  the script used to build. The React runtime adds 59.0 KB gzipped on top, and
  the page transfers 101.9 KB against the sketch's 46.5.

### Fixed - two defects the port surfaced

- **The ASCII band no longer grows the page under the reader.** Its `<pre>`
  was empty until its island hydrated, so the strip stood one line tall instead
  of seven and the document gained 58 px as the reader scrolled to it. The
  frame needs the viewport width to compute; the height it will occupy does
  not, so the server prints seven blank rows and the band measures the same
  97.8594 px before and after any script runs.
- **Replaying the agent scene no longer opens on a finished answer strip.** The
  sketch rebuilt the strip's contents on replay but left `is-on` and the done
  marker from the previous run, so a fresh sequence started with the strip
  already showing its completed state over its opening content. Both are
  cleared before the scene is built.

### Fixed - the page against the runtime, which the port diff could not see

A computed-style diff compares the built page to the sketch, so anything the
sketch already had wrong survives the port as a match. Read back against the
runtime instead (ADR 0252):

- **The demo played a sequence that occurs in no delivery mode.** Every mode
  scene and the hero ran `recording, processing, preview, result`, which is
  both of ADR 0011a's decision surfaces in one run. `auto_paste` now delivers
  and shows result-actions (Copy / Edit / Dismiss); `clipboard_only` stops on a
  real processing preview (Copy / Edit / Abort), commits, and the overlay
  leaves with no result surface at all. Which one runs is a control on the
  panel, so the two endings can be compared rather than described.
- **The capsule's state model is the runtime's.** `OverlayPillState` is six
  cases and `preview` is not one of them: a staged preview is a field on
  `processing`. The site had invented a fourth state and lost `mode-picker`,
  `error` and `edit-mode`; the first two are now built and used, the third has
  no scene yet and is named as absent.
- **Every mode carries the key that reaches it.** The shipped defaults from
  `default_mode_*_hotkey`, plus the picker key and the capture, pause and abort
  chords in the panel's header. The mode chip on the capsule is a button, as it
  is in the app, and the language chip appears beside it in Translate.
- **The activity field answers a hover.** The day, the count, the words and the
  two clocks, in the shape `ActivityCalendar` uses. One reading per cell as a
  single attribute and one panel that draws it, clamped to the viewport.

### Added - what the page was asserting rather than showing

- **The hero hands over.** It still plays once on first sight, then parks in
  the `mode-picker` state: hold the pointer or the space bar and the capture
  runs for as long as you hold it, the transcript arriving at hold speed. The
  chip cycles the mode. A press too short to capture anything produces the
  `error` state rather than an empty transcript with a result surface behind
  it. The page binds space and names `Ctrl+Super` beside it, because a browser
  cannot receive the real chord.
- **A section for what runs each job**, read out of
  `shared/model_catalogue.json` at build time: eight jobs against three lanes,
  with the default model and its vendor in every cell that has one and a
  visible gap in the three that do not. Seven vendors, thirty-five models, and
  no model id spelled anywhere in `web/` (ADR 0115).
- **The wiring diagram's dots arrive.** They used to slide every wire at once,
  forever, at constant speed. Both states now share one 5.4s beat and differ in
  how many arrivals fit inside it, five against one, which is the quantity the
  count line under the drawing prints.

### Changed - the demo panel, re-cut

- **One column, not two.** The rules had a full-height column they filled for
  one second at the end of a sequence, so the panel stood at the height of its
  emptiest moment. The rules now wrap under the window into as many columns as
  they need.
- **The capsule floats over the window** instead of sitting beside it on the
  page's ground, which is the only place it is ever seen and the only place it
  explains itself without a caption.
- **The panel's header stopped pretending to be a window title bar.** It said
  "WordScript" above a panel that already contains a window; it now carries the
  key legend and the live state readout.
- **Payload:** 101.9 KB gzipped to 111.6. The HTML carries most of it, 15.3 to
  21.4, about 6 KB of which is one reading per activity cell. Our own
  JavaScript 15.4 to 18.1, CSS 12.2 to 13.1, React runtime unchanged at 59.0.

### Changed - wordscript.dev, the second read against a running app

A review of the built page produced six findings with one shape in common: the
page was describing a claim it could have been making, and charging the reader
for the description. [ADR 0253](docs/decisions/0253-the-page-performs-each-claim-once-instead-of-listing-it-and-the-hero-stops-asking-to-be-operated.md)
carries the derivation.

- **The hero plays instead of asking to be operated.** It was a hold-to-talk
  instrument: park in `mode-picker`, hold the pointer or the space bar, get a
  capture as long as the hold. Three structural problems, not polish. The
  gesture is learned inside the product and a first-time reader has not learned
  it; a hold too short to capture anything is answered with the `error` state,
  which reads as a broken page rather than as a faithful error path; and the
  hero is the one surface that has to work without being worked. It is now an
  autoplay loop over the six concrete modes, starting and stopping on an
  IntersectionObserver, with the mode chip still pressable and advancing the
  loop. This **reverses ADR 0252 decision 3** and keeps the rule it came from:
  the hero no longer invites a press it cannot answer well.
- **The learned tab is the shipped learned tab.** The page grew a tab reading
  `learned backfill`, split into a muted verb and an accent word. The app's tab
  (`.ov-learned-tab`, built by `activeNudge` in `src/windows/OverlayWindow.tsx`)
  is one accent dot beside the word alone, `word` or `word +N`, with
  `Learned: a, b` in the `title` and the `aria-label`. The geometry is now
  copied value for value and the hold is 3660 ms, which with the shutter's two
  ramps is `LEARNED_NUDGE_DURATION_MS`. The capsule is the app's surface
  reproduced, so a difference in it is a defect rather than a style.
- **`Where your words go` lost its seven-button mode strip.** The product does
  not offer that control: it changes modes on a per-mode key, on the picker
  key, or by pressing the mode chip on the capsule. The page drew a control the
  app does not have, beside a capsule carrying the one it does. The mode now
  changes on the chip, and on one button under the window that names the
  current mode and its key -- which exists because the chip is absent on
  `result-actions` and under reduced motion, and a control reachable in only
  some states is not reachable by keyboard at all. The section is 61 px
  shorter, the two delivery cards are a two-button segment, and each of the
  three leads is one sentence.
- **The activity field reports what a day holds.** Meetings and uploads were
  missing from the hover although the product records both. The site carries
  them without the Developer Mode tag production uses, per ADR 0252 decision 1.
- **The four figures are one arithmetic.** They were four independent literals
  under a line claiming they were read off the field above them. Every one is
  now computed from the same 364-day array the field draws, using the runtime's
  own formulas: the rate is the divisor that turns each day's words into that
  day's seconds, `Time saved` is `ledgerTimeSaved` over `SAVED_WINDOW_DAYS`
  with the baseline in the foot (ADR 0182), and `Languages` names the share and
  the denominator it was measured on (ADR 0186). **Turnaround was 1.9 s and is
  now 0.9 s**, which is what ADR 0247 and ADR 0248 measured.
- **The engine matrix is four lane cards and one worked profile.** Eight jobs
  by three lanes was twenty-four mono model ids, complete and unreadable, with
  its only actionable content (the four cells reading `none`) as its quietest
  text. And it was missing a lane: the product has four and the grid drew the
  three the catalogue has rows for, so a reader who runs their own box found
  the product does not serve them. **`Your server` is now a card**, drawing the
  two fields it takes instead of a vendor row. The profile below shows four
  jobs on three lanes, every model on it the catalogue's own default for that
  pair.
- **Vendor marks come from `@lobehub/icons-static-svg`**, MIT, the same package
  and version `src/components/shell/brandSymbols.ts` uses, read at build time.
  Mono variants: the colour files carry gradients with internal `id`s and the
  same mark repeats on the page, which inline is duplicate ids in one document.
  The loader checks both properties against each file and throws rather than
  trusting them. A vendor the set does not carry rides as its name beside a dim
  dot -- dropping the glyph is a rendering decision, dropping the vendor would
  be a claim about the product.

### Fixed - wordscript.dev, two hydration warnings

- **Both islands root on a `.rise` element** whose `is-in` is added
  imperatively by the one reveal observer in `Base.astro`. Both are
  `client:visible`, so the served DOM already carries a class that is not in
  the JSX by the time React hydrates -- a mismatch React reports and then
  leaves alone. The className is a literal that never re-renders, so the fix is
  to say the difference is intended rather than to end up with two mechanisms
  deciding one class. The built page now reports zero console errors.

### Changed - wordscript.dev, re-measured after all six

- **Overflow**: none at 360, 390, 430, 620, 768, 900, 1024, 1080, 1280, 1440.
  `.own__tip` joins `.focus__rail` and `.band` on the exclusion list: it is a
  fixed panel parked off-canvas while hidden, counted by a naive walk and
  contributing nothing to the document's width.
- **Contrast**: 283 elements checked in the settled state, 0 AA failures.
- **Reduced motion**: 28/28 reveals shown, SMIL paused by hand (25 animations),
  the hero capsule settled, all seven modes settled, all three intakes settled,
  the diagram on `ws`.
- **Banned punctuation**: 0 em-dashes, 0 en-dashes, 0 middle dots, 0 curly
  quotes, in the sources and in the built HTML, CSS and JS. The only non-ASCII
  in the build is the German in the Translate scene's fixture.
- **Payload**: HTML 126.4 KB (27.9 gz), CSS 65.4 KB (13.4 gz), JS 233.8 KB
  (76.4 gz) across ten chunks, of which React is 179.7 KB (55.7 gz).



### Changed - wordscript.dev, the demo stops being a box and the footer closes on the mark

- **The window is now the only edge in "Where your words go".** `.demo__stage`
  was itself a window - window radius, window border, `--elev-window` - and
  inside it stood the meeting window with its own native decoration and resize
  grip, and the desk, which is a full application frame. A window drawn around
  a window says the inner one is a picture of an app rather than an app, and at
  full width the outer frame was the largest object in the section. The stage
  keeps no ground, no border and no elevation; the legend that was its title
  bar is a mono line on the page's own ground under a hairline; and the three
  surfaces that are windows - the target window, `.hud`, `.desk` - take the
  radius, edge and elevation the ladder reserves for one.
- **The two-column panels stopped stretching to each other.** With the frame
  gone, the right column of Context and Agent grew to the window's height and
  spread its parts to fill it. Both grids align to the start now, so each
  column is as tall as what it says.
- **The address is copied, not handed to a mail client.** `mailto:` assumed a
  desktop client bound to the scheme; where that assumption is wrong the reader
  loses the one thing they came for. Pressing it writes the address to the
  clipboard and a notice at the foot of the page says so, naming what was
  copied. `navigator.clipboard` with an offscreen-field fallback for
  non-secure contexts, and the notice reports a failure as a failure rather
  than claiming a copy that did not happen. It carries no coloured edge bar and
  no tone, for the reason `UndoNotice` gives in the app.
- **The forge mark stands on the ASCII band, at a size it can be read at.** It
  was a 13px anvil at the end of a mono row with "SW forge" set beside it as
  the caption a legible mark would not have needed. It is four fifths of the
  band's height now, at the page's own gutter, over the signal rather than in
  a row under it. No filter and no opacity: the mark is drawn for a dark
  ground, so the band supplies the contrast the anvil wants and the wordmark
  never needed it. The footer keeps AGPL-3.0, GitHub and Discord, on the side
  the mark left free; the address left it, because the section above is where
  the page asks to be written to.
- **Smooth scrolling, Lenis alone.** No GSAP: the page runs no ScrollTrigger,
  its reveals are one IntersectionObserver and its counters are CSS delays, so
  the second library would ship 70 KB to synchronise nothing. Lenis animates
  the real scroll offset, so the reveal observer, the header's `is-stuck`
  toggle and the activity field's panel need no knowledge of it. Under
  `prefers-reduced-motion: reduce` nothing is constructed and no listener is
  bound, checked again on change rather than only at load. Measured: the
  `lenis` class is absent under `reduce` and present under `no-preference`.
- **The anchor clearance is declared once.** Lenis subtracts the target's own
  `scroll-margin-top`, so passing the header height a second time as an
  `offset` applied it twice - `#how` landed 153px below the viewport top
  instead of 76px. The option is now `anchors: true` and the one number lives
  in `.sec { scroll-margin-top: 76px }`, where the no-JavaScript path reads it
  too.
- **Payload**: JS 83.9 KB gz across ten chunks, of which React is 57.2 KB gz.
  Lenis lands in the Base script chunk, 6.7 KB gz for the page's whole
  non-island script.
### Changed - wordscript.dev, the copy stops annotating itself and the licence becomes a mark

- **A small explanatory line under every object was the page's own AI tell.**
  Six of them are gone. The worst was the hero note reading `Nothing is
  released yet. This is the part where it gets built.`, which is the closing
  section's H2 set at a tenth of the size, so the page opened by spending its
  own ending. Also cut: the sub-line under `The dictation half, done properly`
  that only restated it, the three-clause version of the focus band's "not
  integrations", the second half of the engine section's foot (keys in the
  secret store, which every lane card already says under `needs`), and the
  numbers block's closing disclaimer, which is now one sentence. Each was
  defensible alone and the accumulation was not: a page that annotates every
  one of its objects does not trust any of them to land.
- **The hero's caption is gone, and the capsule was standing on it.**
  `.stage__cue` sat 1.9rem under the window while `.stage__float` hangs 20px
  below its lower edge, so the line the reader was meant to read was the line
  the product was drawn on top of. It also spelled the capture hotkey out as
  prose, two sections above the block that teaches every key on keycaps. What
  the chip's affordance rests on now is what the app itself carries: the
  `title` and `aria-label` that say "tap to cycle" in `OverlayPill.tsx`. No ADR
  decision is disturbed - ADR 0253 decision 3's "one button under the window"
  is the demo section's mode control, not this caption.
- **The licence is a mark, and it is copyleft rather than the GNU head.** The
  hero's fact strip and the footer both name AGPL-3.0 and both draw it now.
  The GNU head was the first choice and is the exact family mark, and it failed
  a measurement: rendered at the strip's size and blown back up pixel for
  pixel it is a grey smudge with no readable feature in it, because it is an
  engraving of an animal's face. The copyleft ring and reversed C is two
  strokes, reads at any size, and is nobody's trademark. The marks went to
  16px against 11px type, with the focus band's 19px as the ceiling.
- **The three desktops are three marks.** Apple and Tux are read out of
  `simple-icons` at build time, like the focus band and the vendor row; Windows
  is four panes drawn in `web/src/lib/osMarks.ts`, because the package dropped
  that mark over the trademark and a third-party paste of the artwork would put
  an unlicensed vendor asset in the build. The strip carries a visually hidden
  `macOS, Windows and Linux` for a reader who gets no marks at all.
- **`local or cloud` named two of the four lanes.** It is
  `cloud, local, your server, enterprise` now. This is the same defect ADR 0252
  found in the engine section - the reader it loses is the one who runs their
  own box - surviving one screen higher than the fix reached.
- **The fact strip left the island.** It is Astro markup in `Hero.astro` rather
  than JSX in `HeroStage.tsx`, so three glyphs that never change are rendered
  path data in the served HTML instead of vendor path data shipped as
  JavaScript. `.stage__facts` is `.hero__facts`: it is a sibling of `.stage`
  now, which is also what gives it 58px of clearance under the capsule where
  the caption had 30.
- **The close is a person rather than a paragraph.** Three sentences saying
  there is no installer, no date, an open repository, a room and an address
  were the page reading its own closing section aloud - the heading, the two
  buttons and the address line are each of those facts as an object. What is
  not anywhere else on a project with no release is who is behind it, so the
  paragraph is a signed quotation. It is set in the serif at reading size and
  carries no quotation marks: the curly pair is on the page's banned list and
  the straight pair is a programmer quoting a string. The signature is
  `felixontv`, the name, linked to the domain - a page signed with a URL is not
  signed.
- **The footer is one row with two ends.** Left is the project and the house it
  is built in: AGPL-3.0 with its mark, GitHub, Discord, SW labs. Right is the
  legal set - Imprint, Privacy, Terms, DPA - pointing at `/imprint`,
  `/privacy`, `/terms` and `/dpa`, none of which exist. `PRODUCT.md` records
  the imprint and the privacy notice as the open fact that blocks publishing,
  and the site is not published; drawing the row now settles where it lives and
  what the routes are called, so the day the pages land nothing has to be
  rewired. Nothing on that half is reachable and nothing on it is a claim.
- **Measured:** `astro check` 0 errors and 0 warnings, zero banned punctuation
  in the built HTML and in every emitted chunk, no overflow from any changed
  element at 360 and at 1440.




### Added — Developer Mode, and the drawings it is for

- **The surfaces that are drawings are gone unless you ask for them.**
  Settings → General → Developer carries one switch, `developer_mode`, off by
  default and machine-wide. With it off the workspace mounts **3 of 4 views**
  (Context is absent) and **7 of 10 settings sections** (Notes & Meetings,
  Agents and Integrations are absent), and the command palette indexes only
  what it can reach. With it on, everything returns and every drawn row wears
  its chip again. Home and AI Models are the exception: they are wired in part,
  so off removes their chip and never their screen (ADR 0250).
- **One registry decides all of it.** `src/lib/previewSurfaces.ts` holds every
  drawn surface, the sentence its marker says, and whether *off* removes it or
  merely unmarks it. `PreviewTag` and `PreviewBanner` take an id from that list
  instead of free text, and a walker test fails the build on a marker written
  without one.
- **A door and the room behind it are now one decision.** `canOpen` on
  `WorkspaceRuntime` answers whether a target exists, and the links that cross
  screens — the palette, AI Models' link to Agents, Privacy's two doors — ask
  it before drawing themselves. The gallery is exempt and always shows every
  marker, since it is the acceptance surface for drawn screens (ADR 0055).

### Changed — the line under the heading

- **Roughly a quarter of the product's secondary text is gone**, from 43,997
  characters across 460 sites to 33,980, with the longest single line down
  from 268 characters to 173. Nothing was shortened for its own sake: a
  `description`, `hint` or `lead` was kept only where it carries a fact its
  heading does not. What went was the heading restated, the derivation of a
  rule the label already states, and — twice on General alone — a hint printing
  the value of the select beside it. The rule is now written down in
  `docs/DESIGN_SYSTEM.md` beside the measured length budget (ADR 0250).
- **The screens that changed most were the ones that argued.** Meeting
  (4,469 → 2,138 characters), Handoff (3,292 → 1,828), Translate
  (2,653 → 1,310), Conversation (2,600 → 1,117) and Subtitles (2,368 → 1,183)
  each carried paragraphs re-arguing the claim their own row label made.
  Onboarding is the documented exception and kept 37 of its 42 lines: a wizard
  explains as its purpose.
- **Two sentences that had become false were rewritten rather than shortened.**
  Privacy counted *four collections* on a screen where one card is now
  conditional, and promised a bounded copilot reach on a row that off hides.

### Added — a roadmap candidate for a draft the desk researched

- **The request that falls between two records now has an entry.** *Write a post
  on this subject, and look the subject up* cannot be served by `draft`, whose
  output contract forbids adding facts the instruction does not contain
  (ADR 0026, narrowed by ADR 0245) and whose path is closed to tools on
  ADR 0029's four reasons; nor by the desk alone, whose targets are repositories
  and whose runs end as stdout in a thread (ADR 0030). ADR 0044 already routes
  it — the assistant reads this disk, the desk reaches the network, and a desk
  action is an assembled brief handed over on a key — and that route had never
  been walked for a job that is not code. `ROADMAP.md` carries it as a candidate
  with four gates, none of them closed, and nothing is built.
- **The blocking gate is that no prompt in this product has a slot for
  material.** ADR 0023 makes every context source a reading aid — never derive
  content from it, never supplement the result with it — and ADR 0029 binds
  every later source to that rule by name. Sourced material exists to be derived
  from, so either a second block is decided with its own provenance and citation
  rules, or the candidate cannot produce a grounded text and should be dropped
  rather than narrowed. ADR 0040 wrote the citation sentence for a bounded local
  read and is the shape a wider answer would take.
- **Two accepted records sort a read-only network source differently, and
  neither had noticed.** ADR 0044 sorts by disk versus network, which puts every
  network read on the desk. ADR 0046 sorts by *does it write anywhere* into
  intake, bridge and reach. A search reads over the network and writes nowhere,
  so it satisfies neither sort. The disagreement stayed invisible because every
  connector considered so far was either local material (the calendar) or
  writing (mail, issues). It is the candidate's gate 2 and it is answerable
  today.
- **The one-shot rule has its first counter-case.** ADR 0031 refused multi-turn
  refinement conditionally — not until something validates it — and Phase 9
  repeats that as out of scope. A post is not a correction: the refinement loop
  is the work rather than a repair of a nearly-right result. The candidate's
  gate 4 puts the question rather than answering it, and notes that nothing new
  has to be invented either way, because the desk already has a thread.
- **And the entry says which half it is not.** Whether a result reads as written
  by a person is decided by the communication style — 400 characters of rules,
  400 of writing sample, with a shipped bug that truncates any rule past 120
  characters without saying so — which is Phase 7 and buildable today. No amount
  of sourced material fixes tone.
- **The candidate count above the phase list was already stale.** The libei
  entry has carried `superseded` since 2026-08-18 and was still being counted as
  open. The sentence now names the four open candidates and says why the fifth
  stays below the phases rather than being deleted.

### Changed — `Heard` is the recogniser's own output and `Written` is the delivery

- **The word `Heard` named a boundary one stage later than it promised.** The
  runtime took the record's heard text nine lines BELOW `apply_confidence_gate`,
  and that gate is not a passive reading: where the recogniser's own metrics
  reject a segment it overwrites the text with the survivors rejoined. So the
  column labelled **Heard** was the recogniser's output minus whatever
  WordScript's own filter had removed, and a dropped segment was
  indistinguishable from one the recogniser never returned — on every surface
  and in every record ever written. `heard_text` is now taken before the gate,
  before the recogniser repair and before any mode (ADR 0249).
- **The gate records what it removed instead of logging it to a file that
  rotates.** Every rejected segment is stored on the record with its reason, its
  start and its end, alongside the text the transform actually ran on. A record
  can now be asked whether its **Heard** was edited before it was stored; none
  ever could.
- **The panel's foot names the gate as WordScript's own stage.** A run whose
  gate fired carries `low_confidence_dropped` first in `applied_rules`, so its
  removal is no longer read as the AI stage's — the misattribution ADR 0204 was
  written against, one stage further up.
- **The record's own Markdown file carries the whole account.** What the gate
  removed follows the transcript under `## Dropped`, one line per segment with
  its place in the audio and the metric that rejected it. No third column on the
  panel: that plane is the narrowest text column on the surface.
- **A retry transforms the text the gate left, not the text that was heard.**
  Without it, moving the boundary would have made every retry re-admit exactly
  the segments the live run threw out.
- **The re-transcription retry ran the repair, skipped the gate entirely, and
  stored the repaired text as the record's heard text** — a third meaning for
  one word, and a path on which a retry could deliver the hallucination the
  original run had removed. It now runs the same two stages the live pipeline
  runs, in the same order.
- **The parked delivery taught vocabulary from the unrepaired text** while the
  insert path deliberately uses the repaired one, on the reasoning that learning
  handed the unrepaired text could propose WordScript's own stripped prompt as
  profile vocabulary. Both paths now pass the same thing.
- **Verbatim's row on Models stopped claiming more than the mode does.** It read
  *what the recognizer heard, with nothing after it*; the gate, the recogniser
  repair and the profile's text rules all run on it.
- **No backfill, and there cannot be one.** A record written before this carries
  the post-gate text under its heard field and nothing on it says so — the
  removal was never stored. On the reporting machine the gate has never fired in
  4.4 MB of runtime log or 157 records, so nothing there changes meaning in
  practice; that is a fact about this store, not about the product.

### Fixed — a stage figure says how many runs it was measured on

- **`heard in 0.5 s` beside `in total 0.9 s` was two medians over two different
  sets of runs.** The split table had a state for *nothing measured* and a state
  for *measured*, and none for the one every installation is in the day after
  the split ships: five runs of a hundred and forty-seven carrying a stage, the
  rest carrying only a total, both printed on one line with nothing but a hover
  tooltip to tell them apart. While a row's split is short of its runs the count
  cell now holds both — `4/137`, `1/6`, `0/2` — and the heading names the column
  that is thin (`heard in measured on 5 so far`). Both statements delete
  themselves once the split covers the runs (ADR 0248).
- **A `—` in the stage column now has a number beside it.** `0/2` says the dash
  is *never measured* rather than *nothing to measure*, which is the distinction
  the empty stage histogram exists to preserve.
- **The per-cause total histogram is guarded against an edited bucket
  constant**, as its `heard_buckets` sibling in the same struct already was, and
  a cause row left with no counts by that guard is dropped rather than kept as a
  name with nothing behind it.

### Changed — a wait is two stages, and every metric detail says what it is reading before it draws it

- **The turnaround detail no longer stacks two lists of the same number.**
  `Which model heard it` and `What the mode cost` were fed the identical
  end-to-end duration and filed under two keys, so the two figures agreed
  because they were one measurement — leaving a reader to decide whether the
  second was a component of the first or another view of it. They are now one
  table with a `by model` / `by mode` toggle and columns that name what they
  hold: **runs**, **heard in** / **rewrote in**, **in total** (ADR 0247).
- **The runtime measures where the wait actually goes.** `heard_ms` is stamped
  the moment the provider returns — before the session is tested for staleness,
  so an aborted dictation measures the same interval a delivered one does — and
  the rewriting is the remainder up to delivery. The model cut of the turnaround
  carries the hearing, the mode cut carries the rewriting, each on its own
  400-bucket histogram beside the total.
- **A stage that was never measured is absent, not nought.** No stored record
  holds the split, so nothing is backfilled and the stage columns start empty on
  every installation. Where that is the case the column is not drawn at all and
  one sentence says when it will appear, rather than a column of dashes or a row
  of invented zeroes.
- **Each of the four metric details opens with its reading in one line.**
  Turnaround, languages, time saved and words per minute now put the figure
  first in a single sentence, with the qualifiers on one line under it, and each
  chart carries a title. The explanatory paragraphs under the lists are gone —
  they arrived after the reader had already answered the question wrongly.

### Fixed — a failed dictation keeps its recording, and the ceiling is the one the provider honours

- **A transcription that fails no longer takes your audio with it.** A 17:46
  dictation was recorded cleanly, refused by the provider, and deleted six
  milliseconds later, with nothing left to retry from. Retention had been asking
  whether the same request would succeed if it were repeated — which is a fact
  about the request, not about what would be lost. After a failed transcription
  nothing else survives: there is no transcript, and the recording is the whole
  of what you said. A failed transcription now keeps its audio whatever failed,
  so the retry that re-transcribes from it always has something to work with.
  Every other path — success, an empty result, an abandoned session, an abort —
  still deletes as before (ADR 0246).
- **The recording ceiling stops promising minutes the provider will not accept.**
  Groq's ceiling was computed from the stored plan: 25 MiB on Free, 100 MiB on
  Developer, which drew a 30-minute ceiling on the settings card. Measured
  against a Developer-tier key on both sides of the boundary, the upload is
  capped at 25 MiB on **every** plan — the larger figure belongs to a
  hosted-file path this app does not use. A plan buys rate limit, not request
  size, and the rows on AI Models say so. **The Groq dictation ceiling is now
  13:39**, which is a real loss of minutes and the honest number; the previous
  one cost the whole recording rather than a retry.
- **An upload that cannot succeed is refused before it is sent**, at the real
  limit rather than at a limit nobody had tested, and the message says what to
  do rather than repeating the provider's wording.

### Changed — kept recordings are bounded by what they weigh

- **The sweep keeps a week or four gigabytes, instead of a week or twenty
  files.** A file count answers *how many*, which is a question nobody has:
  twenty one-minute recordings are 38 MiB and twenty at the ceiling are half a
  gigabyte, so one number meant two very different things and neither was the
  one that mattered. It also became the wrong bound the moment retention stopped
  being conditional — an afternoon of failures fills twenty slots easily, and
  the file a count throws out first is the oldest, which is the one you were
  meaning to come back to. Privacy & Data states the new bound (ADR 0246, on
  ADR 0241's shape).

### Changed — a record states what was decided, and an example is written for its rule

- **Nothing in this repository quotes the owner's dictation any more, and no
  example in code is a transcript of one.** `AGENTS.md` gains a *Quotation and
  Examples* section: records state what was decided or reported in their own
  American English, and a prompt rule, doc comment, test fixture or filter rule
  that teaches by example carries the clearest example for that rule rather than
  the sentence that prompted it — a dictated brief is one instance stated under
  load, while an example in code is a specification and whatever it leaves
  uncovered is uncovered. ADR 0245's context paragraph and the echo guard's
  fixtures are rewritten to it, the fixtures now spread across languages, and
  the guard gains the boundary case its ratio never had. Product evidence still
  stays verbatim — a transcript the app produced is the defect itself.

### Fixed — Draft refused work it exists to do, and said nothing

- **Draft carries out the instruction it was given, including one that asks it
  to work something out.** A dictation that listed ten words with their
  positions and asked which word they point at came back word for word, pasted
  at the cursor, 473 characters in and the same 473 out. The mode had not
  failed — it had obeyed. `AGENT_OUTPUT_CONTRACT` said *never answer it* against
  conversational replies and *invent nothing the user did not dictate* against
  an invented deadline, and between them the two closed off derivation, leaving
  the plain-text fallback as the only rule the model could satisfy. The contract
  now states the positive case: an instruction that asks you to solve, decide,
  choose, find, rank, guess or answer is carried out and its finished result is
  the artifact. Everything the old rules were written against stays forbidden —
  no reply to the user, no addressee but the one the instruction names, no fact,
  name, date or number nobody asked for (ADR 0245, narrowing ADR 0026).
- **A refusal is no longer delivered as a result.** `was_agent` was set from
  "the HTTP call returned Ok" and read everywhere as "the mode produced
  something", so the echo reached the record as `corrected: true` with
  `transform_warning: null` and reached the cursor through the ordinary paste
  path — indistinguishable, at every surface, from a Draft that worked. The
  runtime now compares the reply to the instruction, and where they are the same
  text it reports `corrected: false` with a warning History renders. The text
  still goes through: a mode that discards a minute and a half of speech because
  it disliked the instruction is worse than one that hands it back.
- **The overlay pill calls the mode `Draft`, like every other surface.**
  ADR 0029 renamed it because ADR 0030 gives `Agent` to a different feature —
  one reachable by cycling the very same control. The rename had landed on Home,
  History, Hotkeys, AI Models, Onboarding and Handoff; the pill kept a private
  `switch` that still answered `Agent`, and nothing failed. It now reads
  `PROCESSING_MODE_SHORT_LABELS`, spread from the single map that holds the
  names, and a test walks both against `ProcessingMode`.


### Removed — there is no legacy in a developer build

- **The ledger's opaque `retired` tier is deleted, with its stamp and its schema
  migrations.** It existed because pruning used to destroy a day's shape; the
  month tier removed that reason the day before. What was left was three
  constructs maintained for files that no installation outside this repository
  has ever held — and they were not idle: their output reached the screen as a
  language count that summed to 653 against 586 dictations. A ledger this build
  creates now states this build's schema stamp, and nothing branches on the
  version a file arrived with. **The first release build is where that changes**;
  from it forward every schema change owes its users a path.
- **`Never asked` is gone from the Languages metric.** It was described as the
  runs from before the record kept an answer. It actually measured how far back
  the SEED could reach, it was non-zero on exactly one machine in the world, and
  every counted dictation increments one of the two rows beside it — so on any
  installation it is structurally zero.
- **One language counter, not two.** A lifetime map had counted alongside the
  per-period rows since the language verdict was first stored; two copies of one
  fact drifted by 67 runs. The tiered counter is the survivor, because it can
  answer every question the lifetime map could and one it could not.

### Changed — what the two metrics state

- **A share is stated against the runs it was measured over.** `Named: 412 of
  526` counts the runs a language was asked of, not every dictation — the same
  construction the speaking rate already uses for `Measured over`. The two rows
  under it account for that population exactly, at every age and on every
  machine.
- **The two turnaround lists say they are two cuts of the same runs.** Which
  model heard it and what the mode cost were stacked, identically shaped and each
  ending in a total, which reads as a breakdown. The second now says `the same
  474 runs` — or `470 of the same 474 runs` where a run's record named no mode,
  a shortfall that until now was disclosed only in a source comment claiming the
  surface stated it.

### Changed — every reading on Home can now exist indefinitely

- **The activity ledger grows a month tier, and it is never pruned.** Until now
  a day row past the 800-day horizon was absorbed into one opaque `retired`
  total: the figures survived and the SHAPE did not. Every series started after
  that horizon, so the *Months* view could never hold more than 26 buckets and
  **the *Years* view could never hold more than three, at any installation age**.
  A departing day is now folded into its month instead, months are kept forever,
  and a lifetime figure is the sum of three disjoint tiers. Twelve month rows a
  year is under 4 kB: **fifty years of them is under 200 kB**, against 4.9 MB if
  every day row were kept.
- **A stored reading is a fixed-size mergeable accumulator per period, and
  nothing else goes on Home.** Sums, counts, maxima and histograms are stored;
  medians, means, rates and shares are derived when a surface asks. That is what
  makes coarsening a period lossless, and it is a gate on what may become a tile.
- **`activity.json` is written minified, through a temporary and a rename.** It
  was `to_string_pretty` straight over the live file on every dictation — on the
  reporting machine **21,326 bytes on disk against 5,634 bytes of content, 73%
  indentation** — and it is the one file in a backup that cannot be rebuilt from
  anything else. A crash between the truncate and the last byte destroyed it.
  Seconds are rounded to milliseconds on the way in, so `4647.276553287982`
  stops being stored as a measurement.
- **Turnaround and languages have a history.** Both were all-time-only figures
  that a chart could not draw without spreading a lifetime number evenly over
  the weeks. Each period now carries its own accumulators: run count and
  millisecond sum for an exact mean, a 41-bucket quarter-octave histogram for
  the shape, and the language counts with the refusals beside them.
- **`Not named` was two populations sharing one counter, and is now two rows.**
  *Too short to name* is the verdict coming back empty and grows with every
  brief dictation; *Never asked* is the frozen backlog from before the field
  existed, is derived rather than stored, and is not drawn where it is zero.
- **The turnaround gains a second cut, by processing mode.** Two independent
  one-dimensional views of the same runs — by recogniser and by mode — and never
  a cross-tab. The 64-key cap on the recogniser map gains an `other` row, so the
  rows sum to the histogram at every installation age, which is what the display
  already claimed.
- **Every accumulator records the day it started being measured.** A series may
  not draw a period that begins before its field's stamp, because a zero there
  is a claim about the product's past that the record cannot make. This replaces
  three separate prose caveats and handles every field added after it.
- **Home's counters are re-read on the runtime's own event.** The reload key was
  the number of index rows, which stands still when a dictation and a retention
  drop land in the same moment. Home also asks for the five recent rows it draws
  rather than every summary the store holds, and an owed fallback is a filter in
  the runtime rather than a scan — one can be arbitrarily old, so a limit could
  never find it.
- **Three surfaces stop under-saying what they know.** Calendar markers are a
  list rather than two constants and the legend counts the kinds present; the
  speaking rate states over how many of the counted runs it was measured.

### Changed — the index stops being rewritten, and the bound stops being a number of dictations

- **`history.json` is `history.jsonl`, and it is an append-only journal.** One
  line is one operation: a record put, a delete tombstoned, an edit put again.
  The whole-file write it replaces cost more the more records were in the file,
  and `HISTORY_CEILING` existed to bound that curve. Measured on a release build
  at the four sizes ADR 0240 used — 1,000 / 2,000 / 5,000 / 10,000 records — an
  append costs **0.012 / 0.012 / 0.006 / 0.006 ms** against **3.5 / 7.5 / 19.3 /
  38.3 ms** to rewrite. Compaction is kept for activation, a wholesale
  replacement and a doubling of dead weight, and never runs on the dictation
  path. A torn last line from an interrupted append costs that one record rather
  than the file.
- **`HISTORY_CEILING` is deleted rather than raised a third time**, and
  `history_limit` with it — out of `AppConfig`, out of the IPC contract, out of
  the export document and out of `prune_entries`. What governs the index is
  `history_retention_days`, in months, which is what a reader setting it always
  thought it was: at 217 dictations a day the ceiling arrived in 23 days while
  their setting said 365.
- **An existing `history.json` is read once, converted and deleted.** The only
  migration ADR 0241 allows itself, and it is there because the parse was
  already written.

### Added — two collections, two byte budgets, and both say what they weigh

- **The index and the transcript archive each get a 5 GB warning and a 10 GB
  ceiling, independently.** At the ceiling the oldest go, in the collection that
  reached it and only there — pooling them would put back the coupling ADR 0237
  broke. Enforced at startup, not on the dictation path: it is a backstop
  against a runaway, and at any real rate neither threshold arrives this decade.
- **The transcript archive has a lifetime at all, which it did not.** ADR 0237
  decoupled the files from the index retention and left the answer to *when do
  they go* as *never, unless you press the button*. Privacy & Data stops saying
  `Nothing prunes them` and names the backstop.
- **Privacy & Data states what the index weighs**, the reading the archive card
  already had. The figure is the instrument and the threshold is the backstop's
  voice — a row wired only to 5 GB would never say anything.

### Changed — the archive counts itself without being walked

- **`transcript_store_status` stopped stat-ing every file in the archive.** It
  runs on workspace activation and on every visit to Privacy & Data. A sidecar
  beside the archive now records a tally per day shard beside that shard's
  directory modification time, and only shards whose stamp moved are recounted.
  It is a tally per shard rather than one cached total precisely because a total
  is invalidated by what the product writes and by nothing the reader does: a
  reader emptying half of last March in their file manager moves exactly one
  stamp.
- **The layout shards to `YYYY/MM/DD/`.** A 10 GB ceiling under `YYYY/MM/` would
  be about 1.2 million files in one directory, so this is a precondition for the
  ceiling rather than tidiness. **Files written before the shard are not moved** —
  that folder is the reader's (ADR 0237) — and a month directory holding them
  stays a shard of its own.
- **Two ignored measurement harnesses stopped reading a file shape that no
  longer exists.** Both read the developer's live store and both print their
  record count as a finding; parsing the old array would have answered zero, and
  somebody writes a zero like that down.

### Fixed — the row's cut reached two surfaces it should not have

- **The raw panel showed the whole dictation on History and 160 characters of it
  on Home.** ADR 0240 made a list row a summary carrying a preview of each
  transcript, and wired the whole-record fetch into History's disclosure only.
  Home draws the same rows on the same builder, so opening one there showed a
  truncated transcript with nothing saying it had been cut. Both screens now go
  through `useWholeTranscript`, which is one fetch rule rather than two.
- **The raw panel's *the AI stage removed words and added none* was read off two
  cuts.** It is a claim about the WHOLE dictation — every word of the delivered
  text appearing in the heard text, in order — and a rewrite past the preview is
  invisible to both previews, so a pair whose first line merely dropped fillers
  could exonerate a stage that invented the rest. The claim is withheld until the
  record is in hand, which is exactly when the panel is drawn; the panel's own
  *the AI stage rewrote it* stands in the meantime and is true either way.
- **`query_limit` still clamped a caller's limit to the old ceiling.** It carried
  the literal `1000` after ADR 0240 took `HISTORY_CEILING` to 5,000. It is the
  ceiling itself now, so the two move together.

### Changed — the list stopped building five thousand rows to draw twenty-five

- **History builds its rows for the page rather than for the whole set.** The
  runtime hands over every matching summary, which ADR 0240 took from at most a
  thousand to at most five thousand, and the screen minted a title, a badge list
  and six closures for every one of them on every render — including every
  keystroke in the search box. The count over the pager is read off the filtered
  set, so the pager still counts what it counted.
- **Three numbers ADR 0240 stated loosely are corrected in the living docs.** The
  summary carries 25 fields, not 24, and 16 stored fields no longer reach a
  screen, not 15 — both counted off the two structs. The ADR keeps its own
  wording, because an ADR is append-only.

### Fixed

- **The capture shortcut stops arriving, and this is why.** A modifier-only
  binding is observed through XInput2 raw events rather than grabbed, and the
  backend tracked the modifier state itself in a list only a matching raw
  release ever removed from. Raw releases go missing on a KDE Plasma 6 Wayland
  session — measured here, six capture presses in one log with no release before
  the next, one of them a hold committed and never ended — and one stranded
  modifier made the comparison the trigger depends on unsatisfiable **forever**.
  No event, no error, `registered` still true on every slot, and nothing but a
  process restart could clear it: re-registration does not touch that list,
  which is why the self-heal restored the day before could never have reached
  this fault. The path reads the X server's own key bitmap now, so the state
  that could drift no longer exists, and a reconciliation pass emits the release
  the stream owed — which also ends the hold a lost release used to leave
  running (ADR 0238).
- **A binding that cannot deliver stops calling itself registered.** The
  backend's event loop beats, names its own death where a caller can read it
  rather than only on stderr, and counts the releases it had to emit itself. A
  watch states all of it every five minutes, split by the path each event
  arrived on — `grab` against `raw`, which is what ruled out the leading suspect
  in the first place. On Hotkeys a stopped loop reads *Not delivering* with the
  restart as the stated next action (ADR 0239).

### Added — every metric on Home opens its own view

- **Press a metric and it opens up.** Each of the four tiles is now a button
  onto a third view of the home block, beside the counters and the calendar.
  Pressing the background or the dots still swaps those two; while a detail is
  open the swap layer is not rendered at all, so nothing changes behind what you
  are reading (ADR 0235).
- **Days, weeks, months and years — and a grain is only offered once the record
  reaches three of it.** A `Years` tab holding one bar teaches nothing and costs
  a press to find out, so the tabs appear as the ledger grows into them, the same
  way the calendar's year picker fills. The view opens on weeks where weeks
  exist.
- **Each metric draws what its own record can carry, and says so when that is not
  a history.** Time saved and words per minute fold over any span, because the
  day rows carry their fields. Turnaround and languages exist only as all-time
  figures — there is no per-period turnaround anywhere in the file — so those two
  draw the spread and the shares, with one line saying which they are. What moves
  the turnaround is the model and the lane, so a change there shows up as a
  second hump before it shows up in the median.
- **A sum is drawn as a bar and a rate as a line**, and a rate that did not move
  is drawn flat: fourteen weeks at an identical speaking rate differ by the last
  bit of a double, and a line that scaled to *that* range turned floating-point
  noise into a mountain range.

### Changed — time saved says which span it means, and changes unit before it runs out of room

- **A three-day-old record no longer says "last 4 weeks".** The foot ramps —
  `today`, then `last N days`, then `last 4 weeks` once there are twenty-eight
  days of record to fold. The window itself stays rolling: a counter that
  restarted every four weeks would read highest on day 27 and nothing on day 28,
  through no change in how much you dictated (ADR 0233).
- **Minutes become hours at 180, and hours become days at 72.** `4820 minutes`
  is a number nobody has a feel for, and it was two heavy weeks away. Above
  minutes the figure carries one decimal, drawn as the point the matrix counter
  already knows how to draw.
- **The ramp counts from the ledger's first day, not from the install date.** On
  a machine installed four months before the activity record existed, the install
  date would have claimed a full window over three days of data.

### Fixed — the week starts on Monday

- **The calendar's rows and the new week buckets both start on Monday**, patched
  in the vendored heat map as well as in both callers. A chart whose weeks began
  on Sunday under a grid whose rows began on Monday would have put one dictation
  in two different weeks on one screen.
- **A tick label no longer collides with the one before it.** The final column of
  a chart is always labelled — the right edge is where you look to ask *up to
  when* — except where it would land beside its neighbour, which printed
  `10 Aug17 Aug` as a single run of characters.

### Changed — the index is read when it changes, and a row carries what a row needs

- **The five-second poll is gone.** Home and History re-read the index when the
  runtime says a record landed — `transcription`, `error` and `empty` on
  `wordscript-event`, the three events that write one — and again when the
  window comes back into view. Before this it read twelve times a minute whether
  or not anything had happened, which on the reporting machine's 478 records was
  **14.1 MB a minute** across the IPC bridge for a file that changes about two
  hundred times a day (ADR 0240).
- **A row in the list is a summary, not the whole record.** The list command
  sends the twenty-four fields the two screens actually draw, with the heard and
  the written text cut to 160 characters; the whole record is fetched by id when
  a row is expanded, restored or copied. Fifteen stored fields that no screen
  has ever read stopped being sent at all — among them the local decoding
  parameters, the recovery message and the per-session input level, which alone
  was 161 bytes a row.
- **Measured, on the owner's real index: 2,453 bytes a row became 1,113, a 54.6%
  cut** — 1,172,580 bytes for 478 records down to 532,436. And the remaining
  payload is paid once per dictation while the workspace is open, rather than
  twelve times a minute regardless.
- **The turnaround cause list is all time.** It read the records still on the
  machine, which is where the surface's apology came from — on this machine that
  was about five days. Each `provider/model` now keeps its own turnaround
  histogram in the activity ledger, on the same 25 ms axis as the bands above
  it, seeded once from whatever the index still holds and merged field-wise like
  every other term. The head reads `N runs all time` and the note about pruning
  is gone.
- **The index write is atomic and compact.** It went to a temporary file and a
  rename, so a crash mid-write can no longer leave a half-written index where a
  whole one was, and it stopped being pretty-printed — 229,019 bytes of
  indentation on the reporting machine, 16.3% of the file, in a file nobody
  reads by eye.
- **The ceiling went from 1,000 records to 5,000.** A thousand was about five
  days of writing here. On a release build a 5,000-record index serialises in
  22.7 ms and reaches the disk in 2.2 ms — measured, not estimated. Past that
  the answer is a different file format rather than a larger number, and the ADR
  says so.

### Changed — your transcript files stopped sharing the index's lifetime

- **Retention no longer deletes your Markdown files.** Every dictation is also a
  file in `~/WordScript/transcripts`, and until now the sweep that dropped a
  record from History deleted it. The index is capped at a thousand records so a
  list stays fast — on the reporting machine that is about five days of writing —
  and that cap was quietly the lifetime of the archive too. It is not a rule
  anybody chose for files, so the prune stopped applying it (ADR 0237).
- **Deleting still deletes.** Removing one record, clearing the history and the
  new purge all take the file with them. Only the automatic age-and-count sweep
  changed; wanting the writing gone is a separate intention with its own doors.
- **`Transcript files` is now its own card on Privacy & Data**, with the rule and
  the reading beside it: how many files are on this machine and what they weigh.
  It has to be read rather than assumed, because once an index entry is pruned
  nothing knows its file's path — that file has no row in History, and this count
  is the only place the product says it is there.
- **And a `Delete now` beside it, which is the only way back out.** It walks the
  folder, which nothing else in the runtime is allowed to do, so it is bounded by
  the store's own naming shape: `<YYYY>/<MM>/<DD-HHMM>-<slug>.md` and nothing
  else. A file you wrote, renamed or dropped into that folder yourself survives,
  and the row says so.
- **The retention hint no longer claims the files.** It read *older dictations
  are deleted with their transcript files*, which was true and is what this
  change reverses.

### Changed — turnaround is read by band, and by what caused it

- **Five bands instead of a 25 ms histogram.** On a real record of 346 runs the
  fine chart drew twenty-four columns of which eleven were empty, and each hint
  read *this many dictations came back between 4.5 and 4.9 seconds* — a sentence
  with no question behind it. The bands carry a share instead: *under a second,
  seven times in ten*. Which edges are used is picked from the record's own p90,
  so a fast machine is not four empty columns and a slow one is not one full
  column (ADR 0236).
- **And under them, a list of what the wait belongs to.** Model, vendor, runs and
  that group's own median. The lifetime histogram carries no model, so this list
  reads the records still on the machine and says so — history is pruned by age
  and count while the ledger is not, so it covers fewer runs than the spread
  above it.
- **The vendor is written out and labelled `via`.** The same recogniser is served
  by more than one vendor at more than one speed, which is the comparison the
  list exists for; an unlabelled second word beside a model name was read as
  possibly the model's author and possibly the profile.
- **The note says what the clock covers.** The wait runs from you stopping to the
  text being ready, so where a mode rewrote the text there is a second model
  inside it that the record does not name.

### Fixed — a language that was named and never written down

- **`Too short to name · 91 runs` was describing the wrong cause.** The naming
  call had answered for almost every one of those dictations — on the reporting
  machine, 74 of 75 calls came back with a language — but nothing stored the
  answer, so a ledger rebuilt from history re-measured with the offline detector
  alone and dropped every record under its eight-word floor. The record now
  carries the language it was counted as (`spoken_language`, additive, read by
  both the live write and the rebuild), and the label reads **`Not named`**,
  which is true of both causes (ADR 0236).
- **This repairs nothing already lost.** An answer that was never written down
  cannot be recovered; the field stops the next rebuild from losing the next one.
- **The decimal point no longer touches the digit before it.** Seven of the ten
  matrix glyphs light their last column in the two rows the point occupies, so
  `3.5` merged into one shape while `1.0` was clean — same component, same code,
  different digits. The gap is now clear on both sides of the mark, which is the
  only arrangement that does not depend on what is being displayed.
- **The view dots leave the screen while a metric is open.** Disabling them left
  a lit dot beside an unlit one, which reads as a choice however inert it is.
  Their space is held, so nothing above them moves.

### Added — a paste that can say whether it arrived

- **Insert at cursor reaches native Wayland windows for the first time.**
  `NativeInsertDriver::RemoteDesktopPortal` sends Ctrl+V as four
  `NotifyKeyboardKeysym` calls on an `org.freedesktop.portal.RemoteDesktop`
  session held open by a persistent in-process D-Bus connection. Unlike every
  other Linux paste driver, its delivery is a call that returns a result rather
  than a keystroke into an X server that answers "sent" whether or not anybody
  was listening — so on that lane the previous clipboard contents can be restored
  again, which has been withheld since ADR 0229 whenever delivery could not be
  confirmed (ADR 0228).
- **The permission is asked for once, by a button, and never during a
  dictation.** "Grant access" in Delivery & Insert is the only thing in the
  product that can raise the desktop's "Control input devices" dialog; the paste
  path has no route to the call that prompts, and a test asserts the absence of
  that route rather than trusting the comment. A run without the permission goes
  to the clipboard and names the button. Saying no is remembered — nothing asks
  again until "Ask again" is pressed — and the delivery mode is never changed
  behind the user's back (ADR 0234).
- **The grant survives a reboot.** It is stored in
  `$XDG_STATE_HOME/wordscript/remote-desktop-grant.json`, mode `0600` in a `0700`
  directory, and asked of the portal as `PersistMode::ExplicitlyRevoked`. The
  previous location was `$XDG_RUNTIME_DIR`, which the system clears on reboot —
  that would have turned "one grant ever" into "one grant per boot".
- **One driver per run, decided before any of them launches.** The focus probe
  picks `xdotool` when a real X client holds the focus and the portal when a
  native Wayland window does; they are never tried one after the other, because
  each fake-input attempt on Linux is its own privilege prompt. An undetermined
  probe stays on `xdotool` rather than spending the grant on a guess.

### Fixed — a desktop that could not be named closed the whole path

- **A KDE Plasma 6 session was classified as an unknown compositor, silently.**
  `detect_compositor()` searched the desktop environment variables for
  `"plasma"`; a KDE session answers `KDE`, so the portal path was ruled out
  before it began — and the early return that ruled it out had no log line, which
  is why 6539 runtime-log lines contained not one portal line. `plasmashell
  --version`, which would have got it right, sat behind the branch that never
  ran.
- **The portal interface probe could never have found the interface.** It
  searched `busctl --user list` for `org.freedesktop.portal.remotedesktop`. That
  command lists bus *names*; RemoteDesktop is an *interface* on the single name
  `org.freedesktop.portal.Desktop`. It now reads the interface's `version`
  property, which answers `u 2` on the machine where the old check answered
  nothing. The diagnostics panel had been reporting the interface as unreachable
  on a session where it responds.
- **The `busctl` portal session is gone rather than repaired.** It created a
  session on a connection that died with the process, sent no `persist_mode`, and
  wrote back the restore token it had loaded instead of the one the portal
  returned — so every grant obtained through it was a fresh grant. Reading
  `native_insertion_status` no longer creates anything; it reports a session that
  actually exists.

### Fixed — the permission row survived neither its own dialog nor a paste failure

Four defects found reviewing the driver above, all in the seam between the
session thread and what the screen is allowed to say about it.

- **Pressing "Grant access" took the button off the screen.** The portal thread
  serves one command at a time, and the grant command waits up to two minutes
  for a person to answer the compositor's dialog. Every status read taken during
  that wait timed out, and a timed-out read reported the phase `Unsupported` —
  which the status command maps to "this desktop has no portal", which removes
  the entire "Insert on Wayland" card. So the section containing the button
  disappeared for exactly as long as the dialog that button opened was up, and
  again for the first seconds after app start while the background restore held
  the thread. A timeout now reports what is knowable without the thread: whether
  the desktop has a portal at all, and what the last run wrote to disk.
- **The row offered a button that could not act.** The status read gated on the
  compositor alone, while the grant action also required the RemoteDesktop
  interface to be reachable. On a KDE session without `xdg-desktop-portal`
  installed the row therefore drew "Not granted" with a live-looking button, and
  pressing it made the section vanish instead of doing anything. Both now ask the
  same question.
- **A failed paste reported "RemoteDesktop portal Start failed".** Every
  `NotifyKeyboardKeysym` error, and the paste timeout, reused the error variant
  that names the *permission* call — pointing the reader at the one control that
  was already working. A paste failure now says so in its own words.
- **Every dictation paid for a probe whose result was discarded.**
  `detect_insert_platform_context()` called `detect_portal_capabilities()` and
  dropped the value; the interface fix had just turned that from one subprocess
  into three. The call is gone, and the capability gate behind the driver-chain
  description is answered once per run instead of on every settings poll — none
  of its three answers can change without the desktop session being replaced.

### Fixed — the compositor was asked for with a subprocess, every time

`detect_compositor()` spawned `plasmashell --version` on every call — ~95 ms to
load a Qt binary that prints a string. It sits under `detect_portal_capabilities()`
and under the portal session thread's status read, so a single
`native_insertion_status` paid for it twice, and that command runs every time the
workspace palette opens and every time Delivery & Insert mounts. A session's
compositor cannot change while the process runs, so it is now answered once. The
Rust test suite dropped from 41 s to 5.2 s on the same machine, which is how many
times the old code was spawning it.

### Changed — the restore measurement is logged as two numbers instead of one

`Start` now logs its own elapsed time and whether a stored token was sent with
it, rather than leaving both to be inferred from the enclosing call. That is what
decides the one question this driver still rests on: a restore KDE honours
returns in milliseconds, one it re-confirms cannot return until a human has read
a dialog. "It prompted" means nothing without "and it had a token to avoid
prompting with".

### Fixed — the portal's waiting was being paid by the main thread

- **Reading the insert status could freeze the app for one and a half seconds.**
  `native_insertion_status` was a synchronous Tauri command, and a synchronous
  command runs on the main thread with the webview's JS event loop behind it. It
  asks the portal session thread twice — once for the Delivery permission row,
  once for `session_is_live()` — and that thread serves one command at a time, so
  while the "Control input devices" dialog is up both requests wait out their
  full timeout. The workspace palette takes one status read every time it opens.
  Every command in the file is now async and works on a blocking worker, and the
  status read asks the portal once and hands the answer down instead of asking
  again. A test fails on any synchronous command in that file: a command that
  blocks is correct in isolation and only wrong about where it runs.
- **"Restore last transcript" ran a whole insert on the main thread** — clipboard
  write, focus probe, paste driver and portal call. It is the button somebody
  presses when an insert has already failed, and it froze the window while it
  worked.
- **App start spent 120–215 ms spawning processes before the first frame.** The
  background grant restore answered its capability gate on the main thread and
  only then spawned its thread — `plasmashell --version` (98–175 ms),
  `xdg-desktop-portal --version` (27 ms) and two `busctl get-property` calls
  (13–16 ms), to decide something no dictation was waiting for. The gate moved
  inside the thread.

### Fixed — the two delivery switches could not be used

- **Both switches from ADR 0231 shipped inoperable, and now work.** Clicking
  either one did nothing: the screen read the stored value through a resolver
  that dropped it, so the control was permanently off, and every unrelated edit
  to the same profile block erased whatever had been stored. The runtime half was
  right the whole time. The Delivery screen's sentence follows the switch now
  too, because it read the same resolver.
- **A hold that turns into a toggle, and a recording ended by opening a window,
  are recorded rather than fixed.** Both are the same lost key release, both need
  one reproduction, and the log already separates the three possible causes — see
  `docs/known-issues/capture-shortcut-recording.md`.
- **The reported 3-minute ceiling under "Copy and insert at cursor" could not be
  reproduced.** The "When a recording stops" card governs every activation mode
  and both delivery modes — that is now held by a test — and no recorded session
  in the whole history was ended by a ceiling. What looked like a delivery-mode
  difference is a profile difference: the two modes are on different profiles with
  different cards.

### Changed — four things that were written to hold a fact and could not

- **A shortcut that stops arriving can now say so.** The Linux hotkey backend
  polled the X server in a way that discarded the error case, so a broken
  connection left it spinning silently forever — no key events, no report, and
  the app still believing its shortcuts were registered. It ends with a stated
  reason instead. This does not explain why the grabs die; it makes the failure
  visible.
- **Every shortcut registration now says what the standing one delivered** —
  its age and its event counters — so "the grabs have been dead for some
  unbounded time" becomes a number in the log.
- **The overlay reveal trace names its surface.** One field, and it refuted the
  explanation it was built to test: the residual double reveal at app start is
  two reveals of the *same* surface 108 ms apart, not two surfaces racing.
- **`devtools` is a real build feature.** It was named at two compile-time gates
  and declared nowhere, so the gate could never open. Two dead compiler warnings
  and, beside them, a test that had never run for want of its attribute and
  another that was being counted twice.

### Removed — a command that configured nothing (ADR 0232)

- **`configure_native_capture` is gone, and nothing changes for you.** It looked
  like the path that set the recording ceilings and the microphone, and it set
  nothing: the field it wrote had no reader, and every recording builds its own
  snapshot from the active profile's "When a recording stops" card. That card was
  already the only thing deciding — on all three activation modes and both
  delivery modes — so the seam is one command lighter and the behaviour is
  identical. Found while chasing the reported three-minute abort.

### Added — one delivery switch per mode (ADR 0231)

- **"Copy to clipboard only" can put the text on your clipboard right away.**
  Until now the mode named after the clipboard was the slower of the two to
  reach it: the transcript was held in the preview and only written when you
  clicked, or ten seconds later. The new **Copy immediately** switch writes it
  as soon as it exists, with the preview still offering the edit — and
  confirming an edit writes the corrected text over it.
- **"Copy and insert at cursor" can leave the text on your clipboard.** It
  pastes and then puts your previous clipboard back, which is right when the
  clipboard was only the transport and wrong when you wanted the transcript
  too. The new **Keep it on the clipboard** switch skips the restore.
- Both live per profile, beside Delivery, each drawn only under the mode it
  belongs to. **Both default to what that mode has always done**, so no existing
  profile changes behaviour, and the Delivery screen's sentence now follows the
  switch instead of promising "then restores your clipboard" in every case.

### Fixed — right-click no longer ends your dictation, and the OS menu is gone (ADR 0230)

- **Right-clicking a WordScript window while holding the capture key ended the
  dictation, and the menu it opened outlived the overlay.** WordScript hides its
  overlay rather than closing it, so WebKitGTK's context menu stayed on screen
  after the pill was gone and held the keyboard until it was dismissed — no new
  recording could start in the meantime.
  - The native context menu is now suppressed in every window, in every build,
    and a WordScript menu (Cut, Copy, Paste, Select all) takes its place in text
    fields. It is drawn inside the page, so it holds nothing and disappears with
    its window. **Inspect Element is no longer one right-click away in a release
    build**, which is what the owner asked for; a dev build keeps it on
    `Ctrl`+right-click.
  - The overlay gets the suppression without a menu of its own: its window is
    exactly pill-sized, so a menu drawn in it would be cut off. `Ctrl+V` there
    is unchanged.
- **A dictation stopped by the recording ceiling now says so.** It used to be
  delivered, filed and displayed exactly like one you ended yourself, with the
  only trace in a log that rotates — which is why it was reported as
  inexplicable. Both ceiling paths now record the reason on the transcript, and
  History states it on the record.
- **The trigger log names which OS event path a shortcut came from**
  (`origin=grab` / `origin=raw`). Added to answer whether the click-abort was a
  key release the X server fabricated on focus loss. It was not: 44 of 44
  releases came from the physical device stream.

### Fixed — the overlay stops stacking, and auto-paste stops claiming it worked (ADR 0227)

- **Starting a dictation while the last result is still on screen no longer
  stacks two overlays.** The recording pill was painting on top of the previous
  pill's retained raster. Two native reveals were racing: the Rust capture
  trigger revealed the window directly while the frontend revealed it through
  the coalescer, and each one nudged the window height independently, so the
  single repaint that clears the old pixels became two competing ones. Measured
  with the overlay render trace — every such transition produced two reveals
  with heights 60 and 61, every ordinary end-of-dictation produced one.
- **"Copy and insert at cursor" no longer takes your transcript back when the
  paste may not have arrived.** On a Wayland session it puts the text on the
  clipboard, presses Ctrl+V, and then restores whatever was on your clipboard
  before — so a paste that silently went nowhere left you with neither. When
  nothing can confirm the paste arrived, the transcript now stays on the
  clipboard instead.
  - Nothing in the app can tell whether a keystroke reached another application,
    and this release does not pretend otherwise. An earlier attempt in this
    cycle refused to paste at all in that situation; that was wrong — the paste
    does sometimes land — and it was withdrawn the same day. See ADR 0229.
- **Holding the key no longer cuts your dictation off after two minutes.** Tap
  and double-tap have always used the maximum length on the "When a recording
  stops" card — twelve minutes by default. Holding used a second, hidden number
  set to two, with no control anywhere. All three modes now follow the card.
  Measured twice on one afternoon: a dictation stopped mid-sentence at exactly
  120 seconds with the key still held.
- **A hold that does end at the ceiling no longer reports itself as a lost
  keystroke.** The watchdog logged `release_missing`, which asserts a defect;
  the key was still down and the release arrived four seconds later. It now logs
  `hold_limit_reached`.
- **A shortcut that stops working can be brought back by changing a setting
  again.** When the capture key stopped arriving, every attempt to re-register
  it was skipped as redundant — the check compared what the app remembered, not
  what the system actually held, so a registration that had died still looked
  current. The only way back was a hidden one: open and close the hotkey
  recorder. The check now applies only to the burst of duplicate calls at
  startup that it was written for. **Why the shortcut stops arriving in the first
  place is still unknown** and is recorded in
  `docs/known-issues/shortcuts-die-and-cannot-be-re-registered.md`.

### Changed — AI Models says what belongs to the machine and what belongs to your profile (ADR 0226)

- **The accounts are the machine's.** Their names, keys, plans and server
  addresses are the same in every profile — add a key on one profile and it is
  there on all of them. The screen said the opposite: a note above the cards
  claimed the accounts belonged to the open profile.
- **Exactly one thing on an account card is your profile's** — which account it
  is billed to — and that is now the one thing wearing your profile's name.
  Before, it was only in the tooltip.
- **The note is gone.** The first line of the screen names both owners instead,
  and the Accounts header says the list is the machine's.
- **Your profile's name is on the screen once, not four times.** It is in the
  switcher, in that first line, and on the account you bill to — the two repeats
  further down are gone.
- Nothing moved: the accounts, their cards and where you pick one are exactly
  where they were.

### Added — accounts fold, so a machine with several still fits on a screen (ADR 0224)

- **Every account card can be collapsed.** Each one carries its own key, plan,
  endpoint and used-by line since the last release, which made three accounts a
  screen and a half. Measured on a three-account machine: the list was 1217 px
  and is now 434 px at rest.
- **The one your profile bills to is open when you arrive**, and the rest are
  folded to a single line that still shows the vendor's mark, the account's name
  and whether it holds a key. Opening one does not close another — two accounts
  on one vendor exist so their keys can be compared.
- Pressing an account to bill through it also opens it. The fold and the choice
  are two separate controls, so opening a card never changes where jobs are paid
  for.

### Changed — the job list says what a control does before it says why (ADR 0224)

- Twenty-two sentences under *What runs what* were shortened. The rule was to
  lead with the control's own answer and drop the second clause, never to delete
  the reason a reader needs once.
- Three of them stopped calling an account *the connection*, which is what it was
  called two releases ago.

### Fixed — a dictation no longer sends one vendor's model to another (ADR 0225)

- **A profile whose account moved to a second vendor kept sending the first
  vendor's speech model.** The vendor quietly substituted its own and the History
  record stored the model that was never sent — so the record named
  `whisper-large-v3-turbo` for five dictations that actually ran on `whisper-1`.
- A record now leaves the model out where the vendor picked it, rather than
  naming one the request did not carry.
- **A transcript title that cannot be made says so in the runtime log** — skipped,
  failed with the reason, or made. It has always fallen back to the first words
  of the dictation, silently, which is right for the reader and left no way to
  find out why. Nothing changes on screen.

### Fixed — History names transcripts again, and a thinking model no longer eats the answer (ADR 0221)

- **The title was never being written, and the request looked perfectly
  healthy.** Groq's replacement chat models all reason, and `max_tokens` on the
  wire caps thinking and answer together. The title asks for 48 tokens;
  `gpt-oss-120b` — the model the title runs on, because the title follows the
  assistant — spends 38 of them thinking. What came back was the language line,
  cut, under `HTTP 200`. Every dictation since 2026-08-17 11:45 has been filed
  with no name.
- **A budget is now what the ANSWER may cost.** The adapter adds a reasoning
  model's thinking on top of what the caller asked for, because the adapter is
  the layer that knows the wire's reading of the number.
- **And a reply that ran out of budget is refused rather than delivered.** Half a
  cleanup, a translation missing its end or a title truncated to a language code
  is text claiming to be finished when it is not. Every caller already had an
  honest fallback and none of them was being reached.
- **Two things nobody had reported were broken the same way.** Auto stopped
  routing to the assistant — its intent classifier asks for ten tokens — and a
  short dictation's cleanup ran out before it started.
- **The Title / Written / Heard segment works again with it.** Title falls back
  to the written text when a record has no name, so with nothing named two of the
  three positions were rendering the same thing. That fallback is correct and was
  never the defect.
- Records written while this was broken keep their first-words name. A title is
  made when the text is delivered and nothing re-opens a record to name it.

### Changed — an account is one card, with its own key on it (ADR 0223)

- **The API key sat beside the account list, not inside an account**, so it read
  as one key for the whole machine. Every account is a card now and carries its
  own key, its own plan, and — on your own server — its own URL and token.
- **The provider logos at the top did nothing when you clicked them.** They were
  a statement, not a control, and they moved when you changed something further
  down the page. They are gone; each account shows its own vendor's mark, and the
  logos you can actually press are in *Add account*, which is the one place a
  vendor gets chosen.
- **Which account a profile bills to is now decided on the account.** One press
  on a card. The row further down still says which one it is, because the job
  rows say *follow the profile* and you have to be able to see what that means.
- **The lane picker is gone.** It grouped the accounts, so the card showed a
  quarter of what the machine holds and two of its four buttons were dead. Every
  account is on one page. What you cannot make an account on yet — Local,
  Enterprise — is named underneath, with the reason.
- Adding an account offers every vendor and says why the ones without an adapter
  cannot be picked, instead of hiding them.

### Changed — the Accounts card is the same list as everything else (ADR 0222)

- **Two accounts ran together with nothing between them**, because the space
  inside one entry was the space between two of them.
- **The open account was drawn as a filled primary button** — the weight of the
  strongest action on the screen — so an account read as something to press,
  while the account beside it read as prose.
- Each one is now the list row History and Profiles use: a rule between entries,
  the name over its vendor, the key state in the badge column, and Rename and
  Remove as icons. The name is what you press to open an account's settings, and
  the open one is marked by its ground.
- Rename and Remove now say which account they act on, so two accounts on one
  vendor no longer offer two buttons with the same name.
- The breakpoints are untouched: at the width this window runs at, every row was
  already stacked, and stacking was never what made the card hard to read.

### Fixed — the workspace strip said `Needs key` on every machine, always (ADR 0217)

- **From the day ADR 0208 moved credentials onto accounts, the status strip has
  reported a missing key with the key present.** It asked the runtime about the
  account by omitting it: `useProvider`'s connection argument defaults to the
  empty string, and the secret-store entry name is `{scope}.{role}.{kind}` — so
  the runtime read `.speech.api_key`, a name no save can ever produce. The
  account was derived four lines above the call and simply not passed on. This is
  the defect ADR 0209 closed on the AI Models card, standing on the one surface
  that is never scrolled away.
- **The runtime refuses the question now.** A status for a vendor that stores a
  credential must name the account it is asked about; the local lane, which
  authenticates against nothing, is exempt by construction rather than by name.
  *No account was named* and *this account holds no key* are different facts, and
  only the second is the reader's to act on.
- **The suite could not have caught it**, which is half the finding: the test
  double for that seam took one argument and ignored the rest, so a caller that
  dropped the account got the vendor's answer from the mock and an empty entry
  from the runtime.

### Fixed — no credential is left keyed by a vendor (ADR 0218)

- **A machine could hold an API key that no surface could show and no reader
  could clear.** ADR 0208's migration re-keys the vendors its lift produced
  connections for, and that lift builds its list from the ids the **profiles**
  name — so a vendor the machine held a key for but no profile pointed at was in
  neither list. The reporting machine's own pre-migration backup shows exactly
  that: every profile on one vendor, and a self-hosted token written the day
  before with no account to move onto. Revoking such a token from inside the
  product was impossible.
- **A sweep runs on every launch instead of once.** It adopts a vendor-scoped
  entry onto the single account of that vendor, refuses where two accounts make
  the target a guess, and names one where there is no account at all rather than
  deleting a secret to tidy up a name — so the launch after an account appears is
  the one that adopts it.
- **A self-hosted server URL is no longer lost by the same gap.** The migration
  took the machine-wide endpoint off the config and then spent it only where a
  profile named that lane, so a machine that configured a server and went on
  dictating in the cloud had the URL read, dropped and never written again.

### Added — the language a profile dictates in can be set (ADR 0219)

- **It was drawn on AI Models, settable nowhere, and read by the runtime all
  along.** The value reaches the capture snapshot, the drift check and both cloud
  adapters as the language hint. It is now edited on Profiles → Defaults and
  stated on AI Models with the tag that opens it — the shape `Into` and `Keep the
  profile's words` already use.
- **Auto-detect is a choice rather than a blank**: an empty language means *let
  the model decide*, which is what every profile has until somebody picks.
- **`Pin this language` is refused until a language is chosen.** The drift check
  lowers its corroboration threshold for the language the request carried, and an
  auto-detected dictation carried none.
- **The machine-wide `language` field is removed rather than kept in step.**
  Nothing wrote it in either runtime, while the transcript record read it at four
  sites and the request sent the profile's — both empty everywhere, so they
  agreed by accident. A stored value is ignored on read and gone on the next
  save.

### Changed — the Accounts card is an inventory (ADR 0220)

- **Every account this machine holds on the shown lane is visible at once**, each
  with its vendor, whether it holds a key, which profiles use it, and its own
  rename and remove. It was one row showing one account, and which one was a
  derivation rather than a choice — at the width this workspace renders, that row
  was 171 px tall.
- **Which account the credential rows configure is the reader's choice.** Two
  accounts on one vendor previously gave no way to tell which of them a key row
  belonged to.
- **Adding an account asks who it is with.** The button used the vendor already
  on screen, so it could only ever create a second account on that vendor; the
  provider chip row was the only route onto another. It asks for a vendor and a
  name, and it no longer points the profile at what it creates.
- **Choosing which account a profile bills to happens where the jobs are**, at
  the head of *What runs what*, with the profile named — not inside the card that
  lists what the machine holds.
- The provider chips state the vendor of the account on show and no longer set
  it. Re-pointing an existing account at a different vendor would leave its
  stored key addressed to a company that never issued it.

### Removed — three settings nobody needs an opinion about leave the job list (ADR 0216)

- **`Bias from the profile's words`** offered `Off | Light | Standard` over
  `bias_mode`, a field nothing in the product writes. The choice it implied had
  already been decided against: every vocabulary term reaches every transform
  stage unconditionally and slot allocation is the runtime's (ADR 0033,
  ADR 0035). The vocabulary still steers the recognizer; what is gone is a
  control that never did.
- **Prompt Enhance's `Sub-mode` and `Prompt target`** were an inert segment and a
  drawn select over two fields stored in `AppConfig` **and** in the profile's
  work mode, with no writer for either. The fields keep their defaults.
- **They are removed rather than marked, and that is the new rule's whole
  point.** ADR 0161 keeps an unbuilt control visible because it is owed; a
  control whose intent is withdrawn is not owed, and a preview badge on one
  promises something nobody has decided to build. `port:diff` on `models` moves
  from `29 | 287 | 33` to `65 | 281 | 33` and the movement is the decision.
- **What the removal does NOT change is written down as two open steps**, because
  a consequence noted in a closed record is one nobody reads. `bias_mode` remains
  a live three-way switch that nothing writes — `Off` suppresses both prompts,
  `Manual` substitutes a typed override — with two arms reachable only from tests
  and a profile health flag guarding one of them that can therefore never fire.
  And `enhance_sub_mode` / `enhance_target` still occupy two homes apiece with no
  writer for either. Neither is a user-visible change today; both become one the
  first time anything writes those fields.

### Fixed — the surface asks the runtime's own question about a stored model, and three controls stop claiming what they do not do (ADR 0215)

- **A job row could name one model while its request carried another.** The
  frontend spelled the model guard twice and neither copy was the runtime's
  rule: both asked *is this id among the vendor's catalogue rows*, where
  `JobProvider::named_model` asks *does the catalogue attribute it to a
  different vendor*. An id the catalogue has never seen is a typed override the
  runtime sends untouched (ADR 0115) — and the surface drew *Follow the profile*
  over it. **A vendor retirement puts every machine into that state at once**,
  because a retired id is by construction one the catalogue no longer carries;
  ADR 0214 removed three the same day. Both call sites ask `namedModel` now, one
  function mirroring the Rust one, and a stored id the offered list does not
  carry is added to the select rather than silently re-pointed by it.
- **The name you address the assistant by was a live field that stored
  nothing.** Not a disabled drawing: a reader could type into it and watch the
  value survive until the next render, while `modes.agent_name` — read on every
  dictation, and what decides when Auto routes one to the assistant — had no
  writer anywhere in the tree. It writes the active profile now and names which
  profile that is.
- **The provider chips showed the profile's vendor over another account's
  rows.** Every row under them has read the lane's own account since ADR 0213;
  the chip row still followed the profile, so a profile pointed at *Your server*
  left no chip marked and a capability sentence describing Groq, above an
  account row and a key row showing the Groq account. It also repointed the
  active profile without saying so, which is the write ADR 0209 requires be
  labelled.
- **The profile schema version read 4 on the frontend and 5 in the runtime**,
  under a comment claiming no migrations were left on either side — false since
  ADR 0094. Harmless today and not at the next migration.
- The typed model-id placeholder on *Your server* named a cloud vendor's chat
  family, and after ADR 0214 a retired one. It matches the wired row's example.

### Fixed — a card configures the account it shows, and a key cannot reach another vendor's account (ADR 0213)

- **A key typed on one lane could be written into another lane's account, and
  sent to it.** The connection card is grouped by lane since ADR 0212 while its
  credential rows still followed the active profile, so on a machine dictating
  through its own server the Cloud card's `API key` field saved as
  `{provider: self_hosted, connection: <the server's account>}`. The OS secret
  store keys an entry by account and carries no vendor, so a Groq key landed in
  the slot the self-hosted adapter reads its bearer token from — sent to the
  reader's own machine on the next transcription, with the token that had been
  there overwritten. Every card row reads its own lane's account now, and the
  runtime refuses a `(vendor, account)` pair this machine holds for a different
  vendor before anything is written.
- **The `Account` row on *Your server* named the Cloud account.** It read the
  literal `"Cloud"` while the self-hosted card rendered it, so *Rename*, *New*
  and *Remove* all acted on Groq from a card showing the server's URL. The lane
  is a parameter now.
- **A job row states its own account's key.** `Key set` was answered per vendor,
  so a job running on an employer's keyless account reported the private
  account's key beside it — the green badge ADR 0128 exists to forbid. The
  status is read once per account and filed under the account the runtime says
  it answered about.
- **A job pointed at another lane's account stops reading *Not read*.** The seam
  was scoped to the lane on screen while ADR 0211 lets a job run on any account
  the machine holds, so a cross-lane row had no status of its own.
- **The reachability probe asks about the server the card is showing**, rather
  than about whichever account the profile happened to be on.

### Added — a profile carries its whole connection, server and account included (ADR 0208)

- **Your accounts are objects now, and a profile points at one.** A connection
  carries the vendor, the server URL, the model id, the account plan and the
  credential; the `Account` row on the connection card in AI Models picks which
  one this profile uses, and `New` gives you a second on the same vendor. That
  is the case nothing could express before: an employer's Groq key and a private
  one were one entry in the OS secret store, so switching profiles moved the
  vendor and never who was paying.
- **Switching a profile switches the account.** Two profiles on two accounts of
  one vendor resolve to two different stored keys, and a test says so on both
  sides of the seam — the entry the runtime reads, and the account a key typed
  on the screen is stored under.
- **Two profiles may share one account**, which is what keeps a second writing
  style from costing a second copy of the same key: one entry, rotated once.
- **`Your server` moved with them.** The endpoint and the model id were
  machine-wide because there was nowhere else for them to live; they belong to
  the account that names the server now, beside the token that may be sent to
  it — so two servers are two accounts rather than one field you retype. The
  three `WORDSCRIPT_SELF_HOSTED_*` variables are unchanged and still lose to
  what is typed.
- **The account plan follows the account.** It was keyed by vendor, which could
  not tell a paid work account from a free private one on the same vendor.
- **Your stored keys are moved, not copied.** The first load re-keys each one
  from the vendor id onto the account that owns it and deletes what it moved: a
  key left behind under an old name is a secret the product can no longer show
  you or clear.
- **Removing an account repoints you and nobody else.** The profile you are on
  moves to another account with the same vendor, because you are the one who
  pressed the button; every other profile that named it keeps naming it and says
  so, since choosing who pays for a writing style you are not looking at is not a
  deletion's decision.

### Added — AI Models is organised by task (ADR 0211, ADR 0212)

- **Every job picks any account on this machine, and a model from that account's
  vendor.** The config has stored an account per job since the connection axis
  landed, so *dictation on Groq, cleanup on your own OpenAI account* was already
  a state it accepted — and the screen forbade it, because the picker offered one
  lane's vendors. It offers accounts now, grouped lane → provider → account, and
  the lane a job lands in is read off the account it runs on.
- **A model belongs to the task.** Eight jobs pointed at three stored slots, and
  five of them shared one: moving Translate's model moved four other jobs. Each
  job carries its own now, from the list its own vendor serves, and a job that
  names none says which of the profile's defaults it follows. Two exceptions, both
  stated on the row: the local recogniser is a file on this machine, chosen where
  it is installed, and your own server's model id is half its address, typed once
  beside the URL — a job on it may still name its own.
- **The lane stopped being a mode.** Picking one used to create an account and
  repoint your profile in one click, neither of them stated. It groups the accounts
  the card configures; assigning one to a profile is the `Account` row, which
  carries the profile's name, and adding one is its own button that adds without
  assigning.
- **The card says what it holds and who uses it.** `Connection` became
  `Accounts`, with a read-out naming the profiles that bill through each one —
  which is the sentence you need before rotating a key. And the screen states
  which profile it is setting, once, at the top.
- **A job row states its account's key and does not offer to change it.** The
  credential belongs to the account; a key field scoped to a job is what made a
  credential look like the thing a job runs on.

### Fixed — a removed account left its key behind (ADR 0210)

- **Removing an account deletes its credential from the OS secret store**, and
  the removal asks before it does. The config write dropped the account and left
  the key under a name nothing pointed at any more — a secret the product could
  no longer show you or clear, which is the exact state the migration above was
  written to avoid, produced from the other end by the delete button. The clear
  walks every role the vendor registers and runs **before** the config is
  written, because the account's id is the only handle onto its entries: a secret
  store that does not answer keeps the account and says so.
- **And it asks first**, with the account, its vendor and its key preview still
  on screen behind the question, because a key deleted from the OS store cannot
  be brought back by anything this product can do. Removing a *key* still does
  not ask — you can type that one again.

### Fixed — the account row said one account and wrote another (ADR 0209)

Four faults in the row that shipped an hour earlier, all found by using it.

- **A new account no longer arrives carrying the previous one's API key.** The
  runtime was asked about the FIRST account on a vendor and answered for it, while
  the field below wrote the account you had selected — so a second Groq account
  opened with the first one's `gsk_…` preview and a green `Set` over a key it had
  never held. The screen now asks about the account you are on, and a status says
  which account it answered about: where the two disagree the row reads
  `Not read` rather than showing somebody else's credential. The same guard covers
  the `Your server` bearer token, where `None` was being printed for an account
  nothing had been read about.
- **Deleting the account you are on no longer empties the row.** It left the
  profile pointing at an account that was gone, which took the vendor with it: an
  empty picker, no rename, no remove, and a `New` button that looked live and did
  nothing. The only way back was clicking a provider chip. The deletion moves your
  profile to another account with that vendor now, and a config already in the
  broken state gets a row that says so by name and offers every account as the way
  out.
- **The Account row says which profile it is setting.** It writes the active
  profile's account and nothing said so, which left *how do I give a profile an
  account* unanswerable on the screen that answers it. It carries the profile's
  name and the door to Profiles, like every other per-profile row there.
- **A job pointed at a deleted account stops instead of quietly billing another
  one.** Loading the config dropped such an override, which reads as *follow the
  connection* — your choice replaced by the default, silently. The name stays and
  the job goes inert under it, which is what the profile's own account already did.

### Fixed — the two instruments that reported something the runtime did not do (ADR 0203, ADR 0204)

- **A record names the model that listened.** History resolved the model off the
  connection-wide field while the request was built from the profile's, so every
  record on this machine was filed under `whisper-large-v3` while every request
  went to `whisper-large-v3-turbo` — 105 of 105. One resolver,
  `AppConfig::speech_model()`, now answers for the request, the record and the
  capture ceiling; three cases hold the seam.
- **A lane that sent no model id records none.** The empty case used to be
  filled in with a default, which names a model no request carried — the same
  plausible-and-wrong shape the whole hardening cluster is about.
- **Records written before the fix are not migrated and keep the wrong value**,
  so no per-model rate may be computed across 2026-08-17.
- **The Heard/Written foot says what changed instead of that something ran.** It
  reported a 16-byte prompt strip as *"The AI stage rewrote it."* and a defect
  was filed against a cleanup that had returned the text it was given. The foot
  now names WordScript's own rules — the prompt strip, the address repair — and
  derives the rest from the diff: *nothing else was added or reworded* is a
  word-subsequence test, not a rule id.
- **A retry names the recogniser that produced its text** (ADR 0205). Only the
  retry that re-sends the kept audio names this machine's — the one that just
  re-runs the transform sends no audio anywhere, and now inherits the retried
  record's provider, model and decode settings instead of describing a request
  that never happened. The two retry branches had also been writing different
  vendors into the same field depending on whether the retry produced text.
- **A profile carries its own models, and no control moved to say so**
  (ADR 0207). The chat model behind every transcript title, the Auto classifier,
  Agent, Translate and Prompt Enhance was the catalogue default that no surface
  could change, and the per-profile field beside it was written when a profile
  was created and read by nothing. It is read now — profile first, connection
  second — and `Use` on a language model points both of that lane's chat jobs at
  what you picked. The visible defect it removes is a local one: a machine that
  pulled anything other than `llama3.2:latest` had its cleanup moved and its
  titles silently left behind on a model that was not installed.
- **A correction runs on a model its own vendor serves** (ADR 0206). The capture
  chose the correction model by whether the *recogniser* was local — a different
  job — so a profile that listens on Groq and corrects on the local runtime sent
  it `llama-3.3-70b-versatile`, a name no local runtime has. Both models are
  carried now and the lane picks one where the job is resolved; a long text
  escalates to its own lane's model rather than always to the cloud's; and a
  retry corrects on what the session would have.

### Fixed — setting a hotkey takes one press, and removing one takes no replacement (ADR 0201)

- **The click that opens the recorder now starts it.** The Hotkeys row swapped
  its button for the recorder and the recorder mounted idle, waiting for a
  second click of its own. The two states are key caps in a bordered box either
  way, so nothing said which one was in front of you: the first click bought a
  widget that looks like it is listening, and the keys pressed into it went
  nowhere. Reported as "I have to press twice and it does not always register".
- **And it is recording on its first frame.** Starting it from an effect painted
  the idle pill first and replaced it once the runtime's vocabulary round trip
  came back — long enough to see, and seen.
- **A chord with a key is written when the keys come up.** No confirmation step.
  `Ctrl+Shift+D` is finished by construction the moment you let go; there is
  nothing it could still become. The confirmation stays exactly where it earns
  its keystroke: a modifier-only chord (which is a prefix of everything you
  might still be reaching for — the D1 hazard, unchanged and still tested), a
  shortcut the runtime warned about, and a combination another slot owns.
- **Backspace clears the slot, and every bound row has a clear button.**
  Empty-means-disabled was implemented end to end in the runtime and no control
  anywhere produced an empty value, so the only way out of a shortcut was
  another shortcut. The button appears for a value rather than as a permanent
  column, and an emptied slot reads `Disabled` in the badge the row already has.
- **A second attempt no longer inherits the first one's key.** "The largest
  chord wins" is a rule about one grip; a press with nothing else held now
  starts a fresh chord.
- **The ten-second timeout is re-armed on every key event** instead of running
  from the click, which made it a budget for deciding rather than for pressing
  keys.
- **A duplicated key release commits once.** X11 delivered two and four release
  edges for a single hold in the S0 measurement, so this is a measured case.
- **A row draws the value that was just saved, not the one the runtime last
  registered.** `patch` updates the config immediately and
  `native_trigger_status` lags it by a save and a re-registration, and the row
  preferred the runtime's spelling over the stored value. Saving `Alt+F8` over
  `Ctrl+Super` therefore drew `Ctrl+Super` back — indistinguishable from a save
  that did not happen, so it gets done again — and clearing a slot removed the
  clear button while leaving its key caps, so the slot read as bound and
  unclearable at once. The binding's `configured` is the value it was built for,
  which is the whole test for whether its answer is about this one; the badge
  says `Not checked` rather than reporting a registration of something else. The
  refresh now watches all eleven shortcut fields instead of the three capture
  ones, so a mode row stops holding an answer about what it used to be bound to.
- **The recorder lost its check mark and its cross.** Two controls for gestures
  the widget performs by itself: let go to set, Escape to cancel, Backspace to
  clear, Enter for the one chord the release edge cannot finish. The hint under
  the pill is one short line instead of two sentences of instructions.
- **Setting a shortcut is one control now, `ShortcutField`** — the caps, the
  clear button, the stored-value resolution and the recorder behind them. The
  recorder was always shared; the three things around it were not, and each was
  a defect the first time it was written. Recording is controlled by the caller
  where several slots sit together (Hotkeys holds the single open one across
  eleven rows) and owned by the control where one does.
- **Onboarding's hotkey step performs that interaction instead of drawing it.**
  It was three dead buttons with `Ctrl+Super` hardcoded into each; the step now
  sets a real value, and the two later steps that recite it — "press it" and the
  summary — read what was set, including when it was deliberately emptied. The
  value stays local like every other answer in that flow. The registration badge
  beside it gained a `PreviewTag`: `Accepted` was tolerable while the whole step
  was a drawing and a fresh false claim once the control above it became real.

### Removed — fifteen links that opened nothing, and every ADR number a reader was shown (ADR 0199)

- **Fifteen of the sixteen `DocLink`s in the settings UI had no handler.**
  `DocLink` renders `<a href="#">` with `preventDefault()`, so without an
  `onClick` it swallows the click and does nothing. Eight of them had an ADR
  number as their link text — a reference to a file in this repository, offered
  to somebody running a compiled desktop application. `props.ts` had already
  written the rule down about buttons ("a button that opens nothing is the fake
  affordance rule 7 forbids") and nobody had applied it to a link, because a
  link reads as prose and prose is not audited as a control.
- **Five of them became doors.** General and AI Models open Profiles, AI Models
  opens Agents, and Notes & Meetings opens AI Models — through `runtime.open`,
  the same door History and `ScopeTag` already used, drawn only where a runtime
  handed one over. `NoteSettingsScreen` takes `PartlyWiredScreenProps` for this
  and nothing else; its engine row keeps its button and disables it with the
  reason on it rather than losing the only control on its right.
- **The rest lost the link and kept the sentence.** `Why`, `Why not here` and
  `How context reaches the model` were questions whose answers are one clause
  long, so the clause is in the sentence now.
- **"Set the level itself in your system sound settings" moved into the row it
  is about.** It is the answer to "where is the gain slider" and it stood in a
  footnote under the meter with a dead link after it.
- **The note naming the device a running capture was using is gone.** The card
  above it already carries "A change applies to the next capture, not the one
  running" as its standing description; the note repeated that fact and added a
  device name, offered mid-dictation. The exceptional state — the saved
  microphone is unplugged, and here is what the runtime will use instead —
  stays. `native_capture_status` is still read and did not become an orphan.
- **No ADR number, plan section or track stage is shown to a reader any more.**
  A provider tooltip, two section banners, a privacy preview tag, four status
  badges and eleven sentences carried one. The statement stayed and was stated
  in full; the citation went. Roadmap vocabulary — `Preview`, `Wired in part`,
  `Planned for Phase 8`, `ROADMAP Phase 5`, `V2` — is untouched: it says what is
  built, and it is the material a developer mode will later display.
- **A sweep holds both rules** (`src/screens/surfaceCopy.test.ts`). It reads the
  tree rather than rendering it, fails on a `DocLink` without a handler and on a
  citation inside `Note`, `PreviewBanner`, `StatusBadge`, `DocLink`, `ScopeTag`
  or a copy prop, and it has been observed reporting both. The gallery's own
  Foundations, Components and Motion pages are exempt and the screens shown
  inside the gallery are not — a screen says the same thing on both surfaces.
- **The prototype still carries these notes and these dead links**
  (`demo.js` lines 2697, 3746, 3812, 4649). It is read-only and stays as it is;
  `npm run port:diff` reports the difference on `general`, `models`, `profiles`
  and `notesettings` deliberately.

### Fixed — the sidebar opens on one press, and the column beside it stops being re-laid-out mid-slide (ADR 0198)

- **Expanding the sidebar took two presses and collapsing took one.** The toggle
  writes its choice into the window's config draft, and the draft handed the
  field straight back — so `useNavRail` re-derived the state from its own echo
  and put the narrow window's rail back in front of a choice just made.
  Expanding wrote "not railed", the derivation answered "railed", and the column
  shut again inside the press; collapsing agreed with the derivation by
  coincidence. The hook now knows the value it wrote last and only adopts a
  preference that came from somewhere else — another window, a config edited on
  disk, or a save the runtime refused.
- **On a high-scale display the rail is the state the workspace opens in.** The
  shipped 1000 lands as device pixels, so the layout gets `1000 / scale` CSS px:
  800 at the 1.25 the breakpoint was measured against, 625 at the 1.6 a 4K panel
  asks for — under the 760 px floor at every width the window can be dragged to.
  The narrow half of the rail is therefore a main path, and it now has tests;
  every case in the suite ran wide, because jsdom answers `matches: false` to
  every media query.
- **The rail transition no longer re-lays-out the view beside it on every
  frame.** The sidebar animates its width, and the content column was a flexible
  sibling of it *and* a size container — so all 180 ms of the slide were spent
  re-evaluating container queries and rebuilding the subtree, crossing the
  460 px tier on the way past and flipping rows between a stack and a line
  mid-animation. Profiles paid it twice, since its pane list is a track measured
  in `cqi` against that same moving container and its detail column is a second
  container inside the first. The sidebar is anchored out of flow now and the
  column takes its final inset on the first frame: one layout pass per press
  instead of one per frame.
- **Profiles asked the runtime for two analyses on every config write, including
  ones that changed nothing it analyses** (ADR 0200). `get_profile_health` and
  `analyze_text_rules` watched arrays off the config, and a settled save replaces
  the whole config graph — `save_config` answers over the IPC, so what comes back
  is a fresh parse in which every array is equal to the old one and is not it.
  A rail toggle therefore cost two Rust analyses and the two re-renders of their
  answers, landing inside the 180 ms the sidebar was sliding; that is why
  Profiles was the only view that still juddered after the fix above. Both are
  keyed on the serialized request now, which is the shape the style analysis on
  the same screen already had. An edit that changes what is graded still
  re-grades on the keystroke.
- **And the press that moves the sidebar no longer writes the config in the same
  frame** (ADR 0202). This was the reported defect, and the three fixes above
  were not it. Measured in the shipped engine on the Profiles view, one press:
  the state change alone runs 31 frames in half a second, the state change *with
  the width slide* runs 31 frames, the config write alone runs 31 frames — and a
  press that did both dropped to 14 frames with two consecutive stalls of about
  145 ms. Each half is free and the pair is not: the save's settle and its
  `ready` each re-render the window, and landing those on a frame where the
  sidebar's style and layout are already dirty costs two full passes over the
  pane. Nothing in the app forces that layout — every geometry-reading API was
  patched and counted across a press, and the count was zero. The toggle now
  shows the new state at once and writes the preference on a 240 ms timer,
  flushing if the window closes first, which is the bargain `useConfigDraft`
  already strikes for a keystroke. After the change: 29–31 frames with a worst
  gap of 26–28 ms, the same figure the empty view gets.
- **The sidebar's width animation stays**, and an earlier revision of this entry
  claiming it had been removed was wrong. It was deleted for one revision on the
  theory that it was unaffordable; the measurement above says the press runs
  every frame with it. It was never the cost.

### Changed — the mode lane runs seven digits and stops explaining itself

- **Translate ships bound, on `Alt+5`.** The lane now runs `Alt+1` through
  `Alt+7` in the order the Hotkeys screen lists, so Agent (`Draft`) moved to
  `Alt+6` and Prompt Enhance to `Alt+7`. Translate shipped unbound on the
  reasoning that six digits were already taken (ADR 0041); the seventh digit is
  taken instead. One stored value still carries the platform spelling on its
  own — macOS renders the lane as `Option+1`–`Option+7`. Seven is where the row
  stops being comfortable, so the eighth mode inherits that question rather
  than a precedent for extending the row.
- **These are defaults, and defaults only reach a fresh config.** No migration
  runs: a config written before this keeps the keys it holds.
- **The closing note on Hotkeys is gone.** It named the desktop session and
  said that a combination another app holds is reported rather than dropped —
  true, and already visible as the per-row badge and hint that report it. The
  session summary it carried is now shown nowhere.

### Added — the calendar names two days, and a delete can be taken back (ADR 0189–0195)

- **Two days on the activity calendar carry a name rather than a count.**
  WordScript's publication on 23 February 2026, and the day you installed it.
  A marker never joins the colour ramp — a marked day you did not dictate on is
  a green circle, and one you did keeps its own ramp step and takes a green ring
  inside the same radius. The legend gained an entry for it and the day's hover
  names it above its own readings.
- **The install date is a new ledger field, and it is never invented.** On a
  fresh machine it is today; on one that has run for months it comes from the
  config file's creation time, or from the ledger's first row, or the marker is
  simply not drawn. It merges across machines by earliest-wins — so it means
  *when you first installed WordScript*, which is what the marker says — and it
  survives the reset in Privacy & Data, because that button is about what was
  recorded.
- **A deleted transcript can be brought back for six seconds.** The row leaves
  at once and the runtime is told when the window closes, so nothing is
  destroyed until you have stopped being able to change your mind. Deleting a
  second row inside the first one's window carries out the first. Leaving the
  screen or closing the window carries out whatever is pending, rather than
  losing it.
- **A profile can be made active from the Profiles screen**, by right-click on
  its row or from the `…` in its header — the two are one verb list. It was
  reachable only from the picker at the foot of the sidebar, which lists every
  profile by name and shows you nothing to choose by.

### Changed — the row got shorter, the strip got clearer, and the counter learned a decimal point (ADR 0191–0196)

- **Turnaround reads in seconds.** `2400 ms` is a true figure in a unit nobody
  waits in. The matrix counter has ten digit glyphs and no period, so the point
  is drawn in the blank column the frame already keeps between two digits — with
  that gap widened, because a mark that is not visibly separated is a mark the
  eye reads as part of its neighbour.
- **Home's standing facts are the first thing on the screen again**, above the
  counters rather than under them. This reverses a decision made when the block
  carried two 42 px keycaps: the shortcut was an instruction and is read once,
  but *which mode the next dictation runs as* is a question you have every day.
- **A transcript row draws two controls and a menu instead of six controls.**
  View raw and Copy stay on the row; Show in file manager, Retry, Restore and
  Delete moved into a menu that the `…` and a right-click both open. Every row
  is now the same width, including the ones that can be restored, and no verb
  was lost — a disabled Retry still says why.
- **A clipboard delivery is grey.** `Clipboard only` and `Clipboard` carried the
  same orange as the product's primary button, which on a clipboard-only profile
  is every row in the list reporting a warning about a setting you chose.
  Anything that actually failed is unchanged.
- **The status strip names the lane separately from the provider.** It read
  `Groq cloud · llama-3.3-70b`; it now reads `Cloud · Groq · llama-3.3-70b`.
  Where the work runs and who does it are two facts, and on the local and
  self-hosted lanes the lane already names the vendor.
- **A locked profile stops explaining itself for the length of a recording.**
  The sidebar printed thirty words under the row while you were talking. It says
  `Locked while recording` and offers the rest on the hover.

### Fixed — the calendar's left arrow lied about the end of the record (ADR 0189)

- **The earlier-weeks arrow stayed lit at the first column of the year.**
  Pressing it did nothing visible: the scroller rests five pixels in — which is
  what keeps a circle from being shaved at either edge — and the reach test was
  taken against a bare zero. It is disabled at the start of the drawn year now,
  in the same shape the later arrow already had at the end.

### Fixed — nothing waits on a filename any more, and the language is asked of the model that is already there (ADR 0188)

- **The naming call stood in front of every delivery.** It asks the chat model
  what a dictation should be called, and the pipeline awaited it before inserting
  the text — and before showing the parked preview. Up to four seconds of
  filename in front of the overlay you are waiting for, and up to four more in
  front of the insert when you pressed commit. Every caller now names the file
  after the text has been delivered.
- **A parked dictation made that call twice and used one answer.** The pipeline
  named text it was about to stage a preview of, then threw the name away,
  because the record is written later — by the commit, which names the text
  again. That first call is gone: one naming call per dictation, always.
- **The same call now also answers the language**, on the same request and for
  two extra tokens, which is what lets short dictations be counted at all. The
  offline detector stays as the fallback for every run where no model answered —
  offline, no key, no chat model, a timeout — and for the model's own `??`.
- **Languages counts what you SPOKE, not what was delivered.** In Translate the
  tile has been counting the language you translated into, and in Draft and
  Prompt Enhance whatever language the model chose to write in. It reads the raw
  transcript now, and in those three modes it ignores the model's answer, which
  described the file it had just named.
- **A named language needs three words.** A model never refuses, so it would name
  one for `Ja` and for `Removing`, and a counter that tallies interjections
  drifts toward whatever short exclamations happen to look like.

### Fixed — the calendar's colour scale was built for somebody else (ADR 0187)

- **The ramp tops out at 150 dictations a day instead of 11.** The steps were
  chosen before this product had measured a single day; the first full day it
  measured held 104 dictations and 6,065 words, and its owner called that a light
  Sunday. Every threshold was cleared inside the first hour, so every real day
  painted the brightest colour and the legend explained a gradient nobody could
  be on. The four steps now read: you dictated · a working session · a heavy day
  · an exceptional one.
- **A day with a single dictation is still lit.** That floor cannot move: an
  unlit cell says nothing was dictated that day, and it may not be spent on a day
  somebody worked.

### Fixed — a counter explains itself from anywhere on it, and Languages stops overclaiming (ADR 0186)

- **The tooltips answer over the whole tile.** Every counter carries a sentence
  explaining what its figure is, and the hover only fired over the label — one
  line of small caps at the top of a narrow column. Pointing at the number, which
  is the thing anybody is actually asking about, produced nothing. A click on a
  tile now swaps the view as well, which it had quietly stopped doing.
- **`only German` no longer claims a language nobody measured.** A dictation
  under about a sentence has no language a trigram model can read, so it is
  counted in none (ADR 0180) — on this machine 40 runs in 107. The tile said
  `only German` anyway, to somebody who had also dictated in English. The foot
  now states what it read, `measured on 67 of 107`, and spends the word *only*
  where nothing was refused. The hover names the floor.
- **The two short English asides stay uncounted, and that is the right answer.**
  Run through the detector, `Whats up my fellow American` comes back Hungarian at
  0.05 confidence; the reliability gate throwing it away is the measurement
  working.
- **The standing facts stopped saying the mode twice.** `Next dictation runs as
  Cleanup · Founder ops notes on Cleanup` — the profile now names its mode only
  where it differs from the one the router resolved, which is the case worth
  reading. The row fits on one line again, and is centred under the display it
  belongs to.

### Changed — retention is one rule you set, and the audio a failure parks can be counted and deleted (ADR 0185)

- **One picker, and it asks in months.** `Privacy & Data` offered a count and an
  age over the same list, and both bound: `prune_entries` sweeps by age and then
  by count, so `Keep all` still dropped the 1001st record and a ninety-day rule
  was broken by a number the reader set once without being told what it did. The
  rule is now `Kept for` — 7 days · 1 month · 3 months · 1 year · No age limit —
  because that is the unit the question is asked in. `Keep all` is gone as a
  label; the runtime has never done it.
- **The count became the index's ceiling.** `history_limit` is pinned to
  `config::HISTORY_CEILING` (1000) on load and stated on the screen as
  `Newest 1000` rather than offered. It bounds the index, not your privacy — a
  thousand transcripts is a few hundred kilobytes of text. Any stored value is
  raised to it, including the `50` on the machine this was measured on, which is
  why the activity calendar there could only ever draw one column.
- **The audio a failed dictation parks is its own card, and it now says what is
  actually there.** It sat as a fourth row under `Dictation history`, which is
  the card whose own rule is that a card names its collection. New commands
  `retained_capture_status` and `discard_retained_captures` mean the screen can
  print `Nothing kept` — or a count, a size and the age of the oldest, with a
  `Delete now` beside it. It deletes only files this app wrote, in the directory
  it writes to, and it names its cost: a failed dictation can no longer be
  retried from its audio.
- **The context rows stopped implying a runtime.** There is no context store
  yet, so both rows carry `PreviewTag`; `Pruning` became `Kept for` like every
  other collection, and `Own budget` became the rule it actually stands for —
  `Until the note is saved`.

### Changed — every figure on Home is now measured the way its label reads (ADR 0176-0181)

- **Words per minute is a speaking rate.** It divided the DELIVERED text by the
  time the microphone was open, so Cleanup's removed filler cost a few percent
  and Prompt Enhance — where a model writes two hundred words from fifteen spoken
  ones — would have entered the record at several hundred words a minute. It now
  divides what you SAID by the time you spent saying it: the runtime measures
  speech in the audio callback and subtracts any gap of half a second or more as
  a thinking pause. Gaps shorter than that are the spaces between words and stay
  in, because removing those would report a rate nobody speaks at. The tooltip
  states what share of your microphone time was pauses.
- **Time saved credits only what you would have typed.** Words and seconds now
  come from the same runs or from neither — a day holding one untimed record used
  to credit its words against no time at all — and Agent and Prompt Enhance
  contribute nothing to it, because nobody would have typed a model's essay.
- **The typing baseline is yours to set.** It was 40 words a minute, hard-coded,
  and it is the whole figure: the same four weeks read 43 minutes saved at 40 and
  15 at 60. Privacy & Data → *Activity figures* now carries it, and the tile's
  hover names the value it used.
- **Turnaround starts when you stop speaking.** The clock used to start once the
  audio file already existed, so draining, resampling, trimming and encoding the
  capture — all of it in front of a reader looking at nothing — was outside the
  figure.
- **Languages counts what came back, not what you configured.** Groq treats the
  language as a request hint and never names one in its answer, and the local
  lane has no field for it, so the planned route would have left the tile dark on
  the two lanes most dictations take. The language is read off the delivered text
  in the runtime, offline, across seventy languages — and a dictation too short
  or too ambiguous to be sure of is counted in none of them rather than guessed
  at.

### Added — the lifetime figures cannot fall, and there is a button that clears them

- **A day that ages out of the ledger is retired into the totals rather than
  dropped.** The file still keeps 800 day rows so it cannot grow without bound;
  before this, every all-time figure would have started falling after two years
  and two months of daily use. Nothing in the ledger subtracts any more.
- **The figures are in the full backup.** They were the one thing in a WordScript
  archive that could not be rebuilt from anything else, and a restore on a new
  machine set them to zero. An import now MERGES them by taking the larger of the
  two figures field by field, so restoring the same archive twice changes nothing
  and a restore can only ever raise a total.
- **Privacy & Data → Delete and reset → Reset activity statistics.** The one door
  that lowers these numbers. Clearing your transcription history does not, and
  deleting a single transcript does not; the row says so.

### Added — History is a list you can move through, and Home has a visible switch (ADR 0184)

- **The two dots under Home's opening block are buttons.** They said which view
  you were on and could not be pressed; the only way to change it was to guess
  that a block of read-outs is clickable. Each dot now selects its view, and
  pressing the one you are on does nothing rather than bouncing you away.
- **The calendar states how many days of the year you dictated on.** Days rather
  than dictations: one long thought and eight false starts are the same
  afternoon, and the grid under the figure counts days too.
- **History is paged.** 10, 25, 50 or 100 records at a time, 25 by default, with
  the range and the page spelled out at the foot of the list. Changing the size
  keeps the record at the top of the page at the top of the page.
- **And it filters by month, defaulting to all time.** The transcripts have
  always been written into `YYYY/MM/` folders and the list was the only place
  that could not be read that way. The picker is the first control on the
  toolbar and is always there, so it also says what the list is scoped to.
- **Two doors instead of a recital.** The foot named the transcripts folder, the
  index file, the retention days and the cap under every visit, and none of it
  could be acted on there — its one link was an anchor with no handler. `Open
  folder` opens the directory, `Retention rules` opens Privacy & Data, and the
  count over the list is gone: the pager says `26–50 of 60`, which is the same
  figure with your position added.
- The toolbar reads in three groups now: which records, what a row shows and how
  many, what to do with the set.

### Added — the activity calendar is a year you can move through (ADR 0183)

- **A year picker, top right.** It offers the years the record actually holds
  days for, plus the current one, and nothing else: a year whose rows have aged
  out of the ledger would draw as a grid of unlit circles, which would claim you
  dictated on none of those days rather than that the days are gone. The line
  under the grid names the day the record starts.
- **Scrolling, with two arrows for a mouse that has no second axis.** A year is
  wider than the box that shows it; a trackpad and a shifted wheel move it, and
  the arrows step four weeks at a time. Every position lands on a whole column,
  including after a free scroll, so no day is ever cut in half at an edge. A year
  opens at its newest end — today for this year, December for a past one.
- **The weekday labels stopped scrolling away.** They were inside the drawing,
  which meant the first thing a scroll took away was the labels that say which
  row is which. They are pinned beside the grid now, on the rows' centre lines.
- **A legend, bottom right.** `Less` to `More` across the five steps of the ramp,
  because the scale is a question about the whole grid and hovering thirty cells
  to infer it is not an answer.
- The block still swaps to the counters when you click it — the hit area is a
  layer behind the view now, so the picker and the arrows can be pressed without
  swapping anything.

### Changed — a counter's basis is under the figure, not in its hover (ADR 0182)

- **Time saved names the typing speed it divided by.** `vs 40 wpm typing`, under
  the figure. The baseline is not context about that number — it IS the number,
  and the same four weeks read 43 minutes at 40 words a minute and 15 at 60. It
  was behind a hover, which is unread standing up and unreachable on a touch
  screen.
- **Languages says how much of the record your main language is.** The foot read
  `mostly German · +2`, which counts the others and says nothing about the first;
  it now reads `mostly German · 86 %`, measured against the dictations that COULD
  be identified rather than against all of them. One language reads `only
  German`, and the share never rounds to a hundred while a second language
  exists. The hover no longer lists languages; it states where the figure comes
  from.
- **The typing baseline is three descriptions and a field.** It was a dropdown of
  eight bare numbers, which asks you for a figure about yourself that almost
  nobody has measured and gives you nowhere to put the one you know if you have
  it. Now `Two fingers · 30`, `Average · 40`, `Touch typist · 70`, beside a field
  that takes any speed from 10 to 200 — and the onboarding flow asks for it on
  its last step, so the figure is not left silently at a default.

### Fixed

- **The turnaround was never written to a record.** `history_entry_from_insert_result`
  took the measurement as an argument and stored `None`, so the histogram behind
  the tile could never fill and the tile stayed dark on a machine with sixty
  dictations in it.
- **And it was dropped a second time, on the path most dictations take.** A
  profile that does not paste at the cursor stages a preview instead, and the
  commit behind that preview passed `None` — on the argument that a parked
  overlay's delay is not a latency the runtime should claim. True of the park and
  wrong for everything else, because staging a preview is the ORDINARY path for
  clipboard-only delivery: on the reporting machine all fifty stored records had
  no turnaround at all. The measurement now travels with the preview. It fills
  from the next dictation; nothing is backfilled, because nothing measured the
  records already on disk.
- **Home stopped showing the instruction to readers who had already started.**
  The choice between "press this to dictate" and the counters hung on one tile
  having a reading; it now hangs on whether the record has anything to say at
  all, and a tile with nothing to report draws a dark display instead.

### Added — Home's counters are all-time now, and there is a record that does not forget (ADR 0174, ADR 0175)

- **Words per minute and the calendar read a ledger, not your history.** History
  is pruned by age and by count, so anything summed from it grows, sticks, and
  then runs backwards. WordScript now keeps one small row per day — counts and
  durations, never text, never which app, never a language — so the figures can
  say *all time* and mean it. It seeds once from whatever history still holds, so
  an existing install does not start at zero.
- **Words per minute is the middle dictation's rate, not an average.** An average
  over total time is dragged down by long dictations, which are mostly thinking
  pauses; an average of rates is dragged up by short ones, where the recogniser
  can invent ten words for two seconds of audio. The median is what a typical
  dictation actually ran at.
- **Time saved stays on the last four weeks**, deliberately. A lifetime figure
  stops being something you can hold.
- **Apps is gone and Turnaround takes its place.** The target application is only
  known when the text is pasted straight in — on a clipboard delivery there is
  nothing to name, so the tile could never have worked. Turnaround is the median
  wait from you stopping to the text being ready, measured at both ends inside
  the runtime, and it is the one figure that moves when you change the model or
  the lane.
- **The tiles say less.** Each foot names the scope and stops: `median · all
  time`, `≈ minutes · last 4 weeks`. The tooltips are one sentence each.

### Added — Home's opening block gets an activity calendar, and it only claims what the record can prove (ADR 0172)

- **A half-year of dictation, as circles on the matrix ramp.** The opening block
  now carries either the four counters or an activity calendar; clicking the
  block swaps them and the choice survives a restart. Twenty-six weeks at 470 px,
  one point per day, stepping through four levels of the accent — the same circle
  the dot-matrix readout draws, at calendar scale, so the two are one display in
  two states rather than two widgets.
- **An unlit day says you did not dictate that day, so the display only spans
  days it can prove.** History is pruned by age and by count on every read, and a
  full history file cannot vouch for any day before its own oldest record — even
  one well inside the retention horizon, because the records that would have
  proved it are the ones that were dropped. The calendar draws the narrowest of
  those bounds, names underneath which one bit, and grows rightwards as the
  record deepens.
- **Days outside that window are drawn as nothing at all**, not as unlit circles.
  Unlit claims nothing was dictated; blank claims nothing. The grid keeps a
  four-week floor so it still reads as a calendar rather than as a single column.
- **Hovering a day names its composition** — the weekday and date in full, the
  dictations, the words, the longest one and how much was recorded. A day with
  nothing on it says so in words rather than showing a row of noughts. Meetings
  and uploads hold their line with the preview tag and no figure, because neither
  origin exists yet and `0 meetings` would be an invented count.
- **A day's colour is an absolute claim, not a relative one.** The steps are fixed
  at one, three, six and eleven dictations rather than scaled to your busiest day,
  so a colour does not change meaning when an unrelated day gets busier.
- **Words per minute says what its clock actually is.** The capture clock runs
  from starting the capture to ending it, so the pause while you think is in the
  denominator: the figure is throughput rather than speaking rate and reads below
  how fast you speak. The tile states this on hover.

### Changed — Home stops explaining itself and starts reporting (ADR 0171)

- **Home's opening block has two lives.** An instruction is read exactly once,
  and the two 42 px keycaps held the most prominent surface in the product
  forever. Before your first measured dictation the block still carries the
  instruction; after it, four counters. The shortcut keeps a permanent home in
  the standing fact line below, at the size a sentence can hold — it is still
  the runtime's resolved keys and never the raw token.
- **Two of the four counters are measured, and they say what they were measured
  over.** Words per minute is your total words over the seconds your captures
  actually recorded; time saved is the last seven days against a typing
  baseline. A retry and every record older than the capture measurement carry no
  clock, so the tile prints `5 of 6 runs measured` on itself rather than
  averaging over a denominator that quietly skipped them.
- **Time saved is marked as an approximation, because its baseline is one.**
  Nothing in WordScript has ever watched you type; the 40 words-per-minute
  figure is an assumption, so the tile carries `≈` and names it on hover.
- **Apps and Languages are drawn, and show no figure at all.** No record stores
  which application you dictated into, and the language on a record is the
  setting rather than what was recognised. Both carry the preview tag at their
  label and light no pixel — an invented 3 is worse than a visible gap.
- **A counter with no reading is dark, not zero.** A lit `0` claims the runtime
  counted none; a dark display claims nothing. Numbers are drawn on the
  dot-matrix readout in four reserved positions, right-aligned, so nothing on
  the row moves when 99 becomes 100.
- **A profile with no dictations sees the instruction, not four zeroes** — and
  so does a profile whose records all predate the capture measurement. A display
  with nothing to display reads as broken for the same reason four zeroes do.
- **Home's banner chip says what it is.** `Wired in part` rather than `Preview`,
  over a screen whose inbox, record list and mode line are all runtime truth,
  and the sentence now names what is drawn instead of repeating the grade.

### Added — the input-level row measures your microphone before you dictate (ADR 0170)

- **The waveform moves, and the runtime is what moves it.** It was drawn at rest
  because the only way to animate it was the vendored component's own
  `getUserMedia`, which would have WordScript hold a second capture device for
  as long as a settings page is open. `core::input_monitor` opens the configured
  input read-only instead, stores no audio, and reports level and RMS every
  42 ms — the same cadence a capture reports at.
- **The meter under it is live without a dictation.** It used to read only
  `audio_level`, which exists only while a capture runs, so the row asked "is
  this microphone set right" and could not answer until you were already
  recording.
- **A capture always wins.** Starting a dictation stops the monitor before it
  opens its own stream, and the monitor refuses to start while a capture runs.
- **The microphone is open only while you are looking at the meter.** General
  being on screen is not enough — the window has to be focused. On top of that
  the monitor holds a 45-second lease the screen renews; a window that
  disappears without cleanup has its microphone closed by the runtime.
- **The verdict is about a phrase, not about a frame.** Decided per reading it
  flipped between "Good" and "Too quiet" several times a sentence — correct
  every frame, unreadable — and since the two sentences are different lengths
  the card resized with every flip. It is now decided over 2.5 seconds, a
  clipping warning stands for 1.5 seconds after the syllable that caused it, the
  quoted dBFS is that window's peak, and the line reserves two lines of height
  so the card cannot resize at all.
- **The bar and the waveform run at the display's rate, not React's.** Both read
  the level from a ref inside an animation frame and interpolate between the
  runtime's reports with meter ballistics. Driving them through React state
  re-rendered the whole settings screen twenty-four times a second, which is
  what made a correct meter look stuttery.

### Fixed — the learned-word badge is on screen long enough to read (ADR 0169)

- **The badge stays for 4 seconds instead of 0.28.** It was built for about two
  seconds and never got them: the overlay window parked 280 ms after the runtime
  said it had learned something, so the badge went with it. It now holds the
  overlay up for as long as it runs. The cost is visible and deliberate — after
  a dictation that learned a word, the last pill stays on screen those four
  seconds as a still frame with its buttons inactive. Dictations that learned
  nothing are unchanged.
- **The badge cannot outlive the session that learned the word.** It appeared
  cut off — a sliver of a tab with the end of the word showing through it —
  beside a recording it had nothing to do with, and stayed there until the
  recording was started again. A new session now clears it, and it is bounded by
  wall-clock rather than by a timer, because the timer it used to rely on stops
  when the overlay is parked.
- **The slide is not slower for being longer.** The badge's animation moved its
  hold from 14–88 % to 7–93 %, so sliding out and back still take ~280 ms each
  and the added time is spent standing still, which is the part that gets read.
- **The badge's geometry was measured and cleared of suspicion.** The window had
  94.5 px of room beside the pill for a 58 px badge, so nothing was clipped by
  the window and nothing was mis-sized. What was on screen was a frozen frame of
  the badge's own animation.
- **The cause underneath is recorded, not fixed.** Since the recording-start
  flash was removed the overlay window is no longer unmapped between sessions,
  and WebKitGTK suspends a page it treats as not-visible: any animation running
  at that moment freezes and any pending timer stops. Every other animation and
  timer in the overlay is still exposed to it —
  `docs/known-issues/overlay-park-suspends-the-page.md` carries the measurement
  and the three candidate fixes.

### Changed — your account plan belongs to the provider you bought it from (ADR 0167, ADR 0168)

- **The plan is stored per provider.** It was one setting for the whole machine,
  so switching your connection from Groq to OpenAI carried Groq's paid plan
  across to a provider that never sold it. Each provider now holds its own, and
  switching back and forth keeps both. Your existing plan is moved for you on
  the first start, with a backup of the config taken first.
- **The row stops offering a choice where there is none.** OpenAI and OpenRouter
  publish one upload size for every account, so `AI Models` states it instead of
  drawing a menu with a single entry. The number is unchanged and is still shown
  resolved under *Longest recording this lane accepts*.
- **A provider with no plans no longer reads `Reading the provider plans…`
  forever.** That message claimed an answer was still on its way when the
  runtime had already replied. The row now says which of three things is true:
  the connection does not transcribe, the lane is not billed by request size, or
  this build has no adapter for that vendor.
- **The import drop zone stopped naming a plan it could not know.** It read *up
  to 25 MiB per file on your Free plan* for everyone, including machines on the
  developer plan and every provider that is not Groq. The picker directly above
  it answers the same question against the file you actually dropped.

### Fixed — the readiness chip reports the connection you are actually on (ADR 0166)

- **`Needs key` no longer means the Groq key when you are not on Groq.** The
  chip at the bottom edge of every view asked the runtime about Groq for every
  cloud connection — so a machine on OpenAI was told about a key it does not
  use, and a machine on `Your server`, which needs no key at all, was told to
  add one.
- **`Your server` is told what it is actually missing.** A URL, or the model id
  to send — in the runtime's own words, naming the row on the connection card
  where you fix it, rather than pointing at a credential that would not have
  helped.
- **A connection this build has no adapter for says so.** If the stored
  connection names a vendor WordScript cannot run, the chip carries the
  runtime's refusal instead of implying a missing key.
- **Nothing is claimed while the answer is still on its way.** The chip read
  `Needs key` for the moment between opening a window and the runtime replying;
  it now says `Checking` until there is something to report.
- **One fewer secret-store read per window.** Every workspace launch asked about
  Groq before the config had said what the connection was, and threw the answer
  away.
- **Onboarding stops saying your own server cannot transcribe.** The setup
  flow's `Your server` step had it backwards: that lane does the listening, and
  it is the writing jobs that need another connection. Its `Local` step also
  stated a bundled model server, a CPU-only verdict and 32 GB of RAM as facts
  about your machine — nothing reads any of the three, and each now says on the
  row that it is a drawing.

### Added — Your server has somewhere to type its endpoint, and can be chosen (ADR 0165)

- **Type the URL of your own server on the screen that offers it.**
  `Settings → AI Models → Connection` takes the base URL of an
  OpenAI-compatible server — whisper.cpp's `whisper-server`, speaches, LocalAI —
  the model id it serves, and an optional bearer token. Nothing needs an
  environment variable any more.
- **And that lane can be picked.** It was greyed out with *adapter built,
  nowhere to type the endpoint* for exactly one evening. A lane is offered when
  it can be operated, so it is offered now, and the Connection card's withheld
  rows are down to the two that are genuinely withheld: `Local` waits on its
  release phase, `Enterprise` has no adapter at all.
- **The token is optional and stays optional.** `whisper-server` issues none;
  speaches and LocalAI may. WordScript stores one if you have one — in the OS
  secret store, never in the config file — and the lane is ready without it.
- **What you type wins over what the shell exports.**
  `WORDSCRIPT_SELF_HOSTED_BASE_URL`, `_MODEL` and `_TOKEN` still work and are
  now the fallback rather than the only way in; when one of them is what a
  request would use, the row says so and shows the value.
- **A refused address says what is wrong with it and keeps what you typed.**
  Plain HTTP to a public host is not sent audio or a token; a LAN, loopback,
  `.local` or tailnet address over plain HTTP is fine, because that is the
  ordinary case for a machine you run.
- **The reachability probe runs when you press it and not when the screen
  opens.** A settings page that pings your private server every time you look
  at it is making network decisions for you; until you press `Test` the row says
  `Not tested`, which is a third answer rather than a pessimistic one.
- **Every job on this lane sends the model id the connection holds**, and a job
  with no id is refused with the reason rather than sent with a guess. A server
  behind a URL publishes no list to pick from, which is why the field is typed.
- **The status strip along the bottom edge names the connection it is on.** It
  said `Groq cloud` for every connection that was not local — including OpenAI,
  since that became selectable — over a model field the lane is not even sent.

### Changed — Privacy says which things a retention rule keeps, and what may read them (ADR 0138)

- **The retention rules name their collection.** `Settings → Privacy & Data`
  drew a cap and an age above two rows naming *other* collections, so the cap
  read as covering meetings — a meeting produces a transcript, after all. It
  never did. The section is now one card per collection: **Dictation history**
  holds the cap and the age, **Context objects** holds the meetings, uploads,
  links, notes and kept conversations that nothing prunes.
- **The cap covers every dictation, whatever mode ran on it** — cleanup,
  rewrite, translate, agent, prompt enhance, verbatim, and the ones that failed
  or produced nothing. That was always true and was never written down; the card
  says it now.
- **Both prune rules bind, and the row used to name one.** The sweep drops what
  is too old and then what is past the cap, so `Keep all` still loses the
  record beyond the limit. The row reads *whichever binds first*.
- **The audio rule is on the screen at last.** A failed dictation keeps its
  recording so a retry can use it — seven days or twenty files, whichever comes
  first. That has shipped since ADR 0039 and the privacy screen listed two
  durations without it, while `Audio` promised *then discarded* without saying
  that a failure's is not.
- **The copilot will not read your dictation history.** A meeting's hints come
  from meetings, uploads and notes, and from nothing you dictated into another
  application. Which means the retention picker is disk housekeeping and not a
  hidden control over what a model is shown — the screen now says both.
- **A door that named a screen and went nowhere now goes there.**
  `Notes & Meetings` had an arrow and no destination.

### Added — OpenRouter transcribes, and so does a server you run yourself (ADR 0164)

- **OpenRouter can be picked for the listening jobs.** One key reaching several
  vendors' recognisers, including models nobody here wrote a row for — a model
  id you type on that lane is sent as you typed it. Its writing jobs are not
  wired yet, and they say that plainly: WordScript has no chat adapter for it
  yet, which is not the same as OpenRouter being unable to do it.
- **Your server transcribes too.** An OpenAI-compatible endpoint you operate —
  whisper.cpp's `whisper-server`, speaches or LocalAI — now answers the
  dictation, meeting and upload jobs. The three rows that said *not on this
  lane* offer a typed model id instead, the same as the writing jobs there
  already did.
- **That lane still cannot be chosen from the screen, and the card says why.**
  Its URL, token and model id are still drawings that save nowhere, so it is
  set through `WORDSCRIPT_SELF_HOSTED_BASE_URL` for now and stays greyed. The
  Connection card had *"neither has an adapter yet"* over `Your server` and
  `Enterprise` together; they are separate rows now, because only one of them
  is still true.
- **A plain-HTTP address on the open internet is refused before your token
  reaches it.** A server on your own network — LAN, loopback, `.local` or a
  tailnet — works over plain HTTP, because that is the ordinary case for a
  machine you run. Anything public needs HTTPS.
- **A vendor that serves something WordScript has not built now says so that
  way round.** Rows used to read *"X does not do Y"* whenever this build had no
  adapter for that half of a vendor, which was a claim about the vendor rather
  than about WordScript. No vendor was affected until now; OpenRouter is the
  first, and the wording is corrected for every one that follows. **The same
  correction reaches the warning you see when a cleanup cannot run**, which is
  not a log line — your transcript comes back uncorrected with the reason
  attached, and the reason now names what WordScript is missing.

### Changed — a lane you cannot pick now says why, and what your machine already has (ADR 0163)

- **The greyed lanes stopped being silent.** `Local`, `Your server` and
  `Enterprise` have been dimmed on *AI Models* with no explanation at all — no
  reason, no timeline, and no acknowledgement that your machine might already
  have everything the Local lane needs. Two rows on the Connection card answer
  it now.
- **Local says where you stand.** `Ready`, `2 of 3 ready` or `Not read`, read
  from the same probe *On this machine* uses — with the pieces you have and the
  ones you do not named in the row. A machine with `whisper-cli`, a speech
  model and Ollama running is told plainly that what is missing is the product
  and not its setup.
- **And what is still owed is named.** The lane is not offered yet because
  Phase 5 still owes the acceleration probe, the bundling decision and
  streaming. `Your server` and `Enterprise` are a different sentence and get
  their own row: neither has an adapter behind it yet.
- **Nothing became clickable.** The lock is deliberate — a lane that accepts a
  click and then cannot run your dictation is worse than one that says why it
  is waiting — and it comes off in the release that finishes the lane.

### Changed — the Local lane stops restating the tab next to it (ADR 0162)

- **The Local lane is three rows instead of five.** Four of the five were a
  second copy of *On this machine* rather than a summary of it — the runner,
  its endpoint, the installed total and the acceleration all appeared twice.
  What is left is what the lane is actually about: which runner, whether it
  answers, no credential needed, and how much is installed.
- **`Manage →` works now.** It has been drawn in that row since the first port
  with nothing behind it; it opens *On this machine*.
- **Why the two tabs stay.** A lane is a stored setting, so putting the model
  library behind it would mean changing your configuration in order to look at
  your own disk. What is installed belongs to the machine and outlives every
  lane switch — so the tab answers what is here, and the lane answers what
  WordScript uses.

### Changed — a drawn row says so, and one of them was claiming you have no GPU (ADR 0161)

- **The surface stopped telling you what hardware you have.** The Acceleration
  row read `CPU only · no CUDA, ROCm or Metal device found`. There is no
  detection in the runtime at all — the sentence was a literal — so on any
  machine with a card in it, it was a specific false claim about your own
  computer. The claim is gone. The badge stays, marked as a drawing.
- **Every row that is a drawing now says so, beside its own label.** A small
  `Preview` tag, with what the row will do once built in its tooltip. Three rows
  on *On this machine* carry it — *Who runs Ollama*, *Keep it warm*,
  *Acceleration* — and the lane row carries it whenever a drawn lane is
  selected, which is what ADR 0067 asked for and this screen never had.
- **`Bundled` is marked as unbuilt.** WordScript ships no Ollama today; only
  *Yours* is real. The choice stays drawn because it is a real decision that
  Phase 5 will make.
- **A third of the words are gone from that tab** — 242 to 163 — without losing
  a fact. The explanations that mattered moved into tooltips; the ones that
  existed only to disambiguate a word stopped being necessary when the word
  stopped being ambiguous.
- **The Local lane's connection rows had the same three problems and are fixed
  too.** They called Ollama a server, repeated the GPU claim, and said speech
  and language models share one disk — which stopped being true when the
  language half moved into Ollama's own store.

### Changed — a server is a machine that is not this one (ADR 0160)

- **The tab stopped calling this machine a server.** *On this machine* closed
  on a section titled *The server* whose endpoint is `127.0.0.1`, while the
  lane row one tab over spends four lines establishing that a server is a
  machine that is **not** this one. One word, two places, opposite meanings.
  What is actually here is two programs that run models, so the card is now
  **Runners on this machine** and names them: `whisper-cli` for speech, Ollama
  for language.
- **Both runner rows are read rather than drawn.** The resolved path, whether
  the runner was found, the endpoint and whether it answers all come from the
  runtime. A probe that failed reads *Not read* rather than *Not found* — the
  runtime not answering and a binary being absent are different sentences.
- **The `Self-hosted` lane reads as *Your server*.** The stored value is
  unchanged; only what you see moved, so the word *server* now names exactly
  one thing on this screen.
- **Where models come from is answered inside each card.** The folder list sat
  at the foot of the tab, which by reading order made it the answer for the
  *Language models* card above it — whose files live in a store that list has
  never described. Speech models now carries its folders, and Language models
  says in one row that Ollama owns its store and WordScript never writes there.

### Added — bring your own model, and a list that survives growing (ADR 0159)

- **A model WordScript never heard of shows up on the tab.** Drop a
  `ggml-*.bin` in the model folder, or pick one with *Add a model…*, and it is
  listed, usable and removable like any other — with the folder it came from
  beside it. Before this, the tab was called *On this machine* and listed the
  catalogue: a file the runtime would happily transcribe with was invisible.
- **Two ways in, because both are real.** *Add a model…* copies the file into
  the folder WordScript manages. *Add a folder…* points at a folder and copies
  **nothing** — a library on a home server or a second disk is used where it
  lies, and removing the folder later removes no file. The language half takes
  a typed Ollama tag instead: that server owns its store, so there is no folder
  to point at.
- **Every folder is listed, in the order that decides which file runs.** Two
  folders holding the same model is one model; the higher-ranked one
  transcribes. A folder on a share that is not mounted says so instead of
  looking empty.
- **The list grows a search once it outgrows its drawing** — a toolbar with a
  search box and an origin filter, above twelve rows. Below that, nothing
  changes.

### Fixed

- **An in-app install was invisible if you had `WORDSCRIPT_LOCAL_MODEL_DIR`
  set.** The model was downloaded, verified, on the disk and resolvable — and
  never offered, because the first model source that answered hid the rest.
  Precedence is a tie-break now: every folder is listed, and the rank only
  decides which file runs.

### Added — the local lane installs its own models (ADR 0122, ADR 0158)

- **`AI Models` → *On this machine* works.** It has been drawn since Leg 6 with
  a size per row, a percentage and an installed total, and nothing behind any of
  it. Now a speech model downloads with real progress, is verified against a
  SHA256 the catalogue carries, and is found afterwards **with no environment
  variable set** — by the picker and by the decode path both.
- **The two halves say who owns the file.** WordScript downloads the speech
  weights into a folder it manages; the language models belong to the Ollama you
  run, so it asks that server to pull and never puts a file beside its own. One
  tab, because a 4 GB language model and a 1.6 GB speech model compete for the
  memory of the same machine, and a total split across two screens is invisible
  exactly when it matters.
- **A download that does not fit is refused before the first byte** rather than
  after the last one, and a checksum that does not match removes the part file
  and installs nothing. There is no window in which half a model is spelled like
  a whole one.
- **A model your profile runs on cannot be removed by accident**, and the
  refusal names the profile.

### Changed

- **The local lane stopped offering four models it did not have.** It listed
  `base`, `small`, `medium` and `large-v3` as profiles whether or not one of
  them was on the disk. A machine with nothing installed now says so, and the
  catalogue's rows are offered as *installable* — a different sentence, and a
  true one. This closes a gate open since 2026-08-03: *until in-app installation
  exists, the local lane is expert configuration and the surface says so.*
- **Six drawn model sizes were wrong and are corrected.** Five printed binary
  units under decimal names — `ggml-base` reads 148 MB rather than 142 MB, and
  `qwen2.5-7b-instruct` 4.7 GB rather than 4.4 GB, which is what the pages those
  files come from say. The sixth was simply a guess: `gemma-3-4b-it` is a 3.3 GB
  pull, not 2.5 GB.

### Added — the provider choice moved to where the file is (ADR 0129, ADR 0131, ADR 0157)

- **A surface that starts a job now names where it runs, before it runs it.**
  The import intake states *Using Groq · whisper-large-v3* above the drop zone
  and the translation window states the model that translates, each with the
  full ladder — lane, vendor, credential, model — behind a collapsed
  `Transcription settings` disclosure. Most uploads take the connection; the
  person who needs to change it gets the whole stack rather than a button to a
  settings screen and back.
- **A vendor too small for your file greys itself and says both numbers**, and
  the audio is never rerouted around it. The one that fits is offered; choosing
  is yours. Sending a recording to a vendor nobody picked is a data decision
  wearing the costume of a convenience.
- **`Cloud.upload` lost its drawn override to OpenAI.** Nothing backed it: no
  recorded file ceiling favoured it, only `whisper-1` accepts the response
  format that row needs most, and it cost a second credential on a fresh
  install for a job that would otherwise run. The question it answered badly —
  which vendor takes this file — moved to where the file's size is known.
  `docs/PROVIDERS.md` open disagreements 6 and 12 are closed with it.

### Changed

- **The job ladder is a shared component rather than `AI Models`' internals.**
  Three surfaces render it now, so it moved to `src/components/jobProvider.tsx`
  under ADR 0055's one-implementation rule. What configures a lane — the
  connection card, the lane segment, the model library — stayed. The move
  measured **zero** on `npm run port:diff`, proven by reverting the override and
  landing back on the baseline exactly.
- **The capture ceiling can be asked in the other direction.**
  `resolve_upload_capacity` answers which `(provider, model, tier)` accepts a
  given number of bytes. `Unbounded` and `Unknown` are kept apart — a lane that
  uploads nothing accepts any file, a vendor with no adapter accepts none — so a
  picker cannot report the second as the first.
- **The size constraint outranks a missing credential.** A key can be added; a
  file will not get smaller. It still yields to a missing adapter, a denied
  role, an unanswered runtime and a pending read.


### Fixed — the answer that printed rule ids under a comment saying it printed names (ADR 0156)

- **A fired rule is named with the words you wrote it in.** *Check against a
  sample* listed what applied as `dictionary:curated-founder-ops-dict-wordscript`
  — the entry's internal id, because `rule_label` returns an id whenever an entry
  has one — under a comment reading *the rules that fired, BY NAME*. It now reads
  `“KA” · “standard closing”`, resolved against the profile's own entries. An id
  with no entry behind it is printed unchanged: a rule can fire from an entry the
  profile no longer holds, and inventing a name for it would be the plausible-
  and-wrong this surface exists against.
- **Measured rather than guessed, and the width was the symptom.** One fired rule
  drew four lines in a 241 px foot beside `Close` at the 800 × 608 CSS px window
  the surface is normally read at; the same string at 992 px drew one. Shortening
  the id would have fixed neither — the string and the width have one cause
  (ADR 0092).
- **The panel plane has a measured text column for the first time**: 241–292 px,
  the narrowest on the surface, against the 436 px ADR 0092 measured for a
  stacked row. It was the last row class no instrument had reached.

### Fixed — the black frame at every recording start, which was the window being mapped (ADR 0155)

- **The overlay no longer flashes black when a recording starts.** Every session
  ran park→reveal, and every reveal ended in `show()` — an X11 map under
  XWayland. KWin composites a newly mapped window before WebKitGTK has delivered
  its first frame with alpha, so one frame showed the uninitialised backing
  store: the full 480×60 rectangle, black. The existing
  `set_background_color(0,0,0,0)` calls answer the resize case and cannot reach
  this one, and GTK's own paint is transparent either way — the black arrives
  after GTK, in the compositor.
- **On Linux the window is now mapped exactly once, at setup, offscreen and at
  opacity 0, and never unmapped again.** Parking is opacity 0 plus
  click-through. An opacity gate *around* the map was tried first and only
  softened it: KWin does not reliably apply `_NET_WM_WINDOW_OPACITY` to the
  first frame of a window it is just starting to manage, so the map had to stop
  happening rather than be timed against. Windows and macOS keep `hide()` —
  the map frame is an X11/KWin behaviour.
- **The placement path is untouched**, which is what made the unmap removable at
  all: the hidden→visible guard reads `OVERLAY_WINDOW_SHOWN`, not the native map
  state, and park still clears it. One consequence is open and recorded in
  [known-issues/overlay-stranded-off-screen.md](docs/known-issues/overlay-stranded-off-screen.md):
  the offscreen park move never landed on a hidden window and now does.

### Removed — the second insert channel, which nothing had ever listened to (ADR 0153, ADR 0154)

- **`wordscript-native-insert` is gone.** It was emitted from three sites in
  `core::insertion` and heard by nothing — not the overlay, not the workspace,
  not a test mock — while `spec/SPEC.md` carried it as part of the
  runtime→frontend contract. Nothing was missing truth it needed: every emitter
  sat beside a path already delivering the same `NativeInsertResult`, the
  runtime-driven one folded into `wordscript-event` as the `insertion` field. It
  is removed on ADR 0018/0019's rule that a session ends in exactly one reducer
  commit — an unlistened second channel is that forbidden shape left available
  for a future surface to bind to by mistake. `restore_last_transcript` lost its
  `AppHandle` parameter with it; the emit was its only reader.
- **The seam has a standing check in both directions now.**
  `npm run sweep:commands` reports callers with no command, commands with no
  caller, unresolvable call sites, listeners with no emitter and emitters with no
  listener. ADR 0089, 0093 and 0103 only ever asked about `invoke` — the frontend
  calling the runtime; an event is the runtime calling the frontend, and that
  half had never been checked. The `invoke` side came back clean: 72 registered,
  72 defined, the lists identical, zero callers with no command, and the same
  five orphans already on record.

### Added — a window that mounts mid-session repaints it, and an open edit surface keeps the runtime waiting (ADR 0151, ADR 0152)

Runtime-ownership steps 4 and the decision step 1 had left to the owner.

- **Reloading the overlay during a capture brings the pill back instead of
  nothing.** Every input to that surface arrives as an event, so a window that
  was not there when they fired rendered an empty overlay while the runtime kept
  recording. It now asks `native_session_snapshot` on mount and repaints a live
  capture or a staged preview — with the elapsed time the session actually has,
  read from the runtime's session start rather than counted from the remount.
- **It repaints what is live and re-reports nothing that is over.** A session
  that ended while the window was away already reported itself to the window
  that was there; a remount is not a second chance. For a preview the runtime's
  deadline committed, that means no surface at all — which is exactly what a
  committed clipboard-only preview looks like.
- **Editing a preview for longer than ten seconds no longer loses the edit.**
  The runtime's commit deadline could not tell a dead window from a user still
  typing into one: at ten seconds it committed the *unedited* text and the edit
  box vanished mid-sentence. The open surface now asks for another deadline
  every three seconds. There is no hold to release — a window that dies stops
  asking, and the ordinary deadline finishes the session exactly as before.
- **A preview nobody is editing keeps its ten seconds.** Not answering is a
  decision the runtime is allowed to make; the transcript reaches the clipboard,
  the history and the disk either way.

### Changed — the cue stream stops being held open, and closing it does not answer where it plays (ADR 0150)

- **The cue output stream is opened on demand and closed after 60 s idle.** It
  was held for the process lifetime, which produced 283 stream errors against
  256 reopens in 2.5 days and left the app holding a monitor's audio path awake
  as the only stream in the system. ADR 0010 had registered exactly this
  fallback in advance; the evidence it named arrived. A cold open measures
  14–20 ms against the 40 ms of warm-up silence the engine already prepends, so
  a dictation's cue chain still runs on one stream and an idle app holds no
  device.
- **The reopen budget counts failures, not opens.** `MAX_REOPENS` exists for a
  device that keeps dying; if an idle close spent it, four dictations inside a
  minute would leave the app silent.
- **The log line names its stream: `Audio output stream error:`.** The old
  wording read as a capture failure and cost one investigation a detour.
- **Where a cue plays is not fixed by this and is now named as open.**
  WirePlumber pins an output target by application name, so a stream that closes
  and reopens returns to the remembered device rather than the current default —
  which is why cues can play into a monitor while the user listens elsewhere.
  The fix needs an explicit device choice and belongs to the speech track's F2.

### Changed — the cadence measures the callback instead of the callback's wait for us (ADR 0133)

Runtime-ownership steps 5 and 3, in that order. **Nothing is fixed by this and
nothing is meant to be.** The three realtime violations ADR 0133 names are still
in the callback, deliberately: changing them now would destroy the attribution
the next event is supposed to carry.

- **The first observed dropout is in the regression corpus as a timeline rather
  than as a story.** Every cadence assertion this repo had drove a synthetic
  timeline — which pins the arithmetic and not the phenomenon, and did not even
  run at the cadence of the device the defect occurs on: they assume 2048
  interleaved samples every 23 ms and it delivers 1024 every 11.6 ms.
  `native-18` replays through the real `CallbackCadence` and reproduces its
  recorded log line. The entry says which of its assertions check the event and
  which only check the line.
- **The gap is now a property of the stream, not of our own mutex.**
  `cadence.observe` is fed the moment the callback arrived, taken before
  `shared.lock()`, so "the callback was never called" and "the callback was
  called and waited on us" stop being the same number.
- **The lock wait is its own reported quantity**, `slowest_lock_wait_ms` and
  `lock_wait_total_ms`, and it is the entire difference between the record's
  hypotheses 1 and 4. The reading was pre-registered by ADR 0133 and is not
  chosen after the fact.
- **`signature()` stops overclaiming.** A gap that is mostly our own lock is
  reported as `blocked_on_our_lock` rather than `stream_suspended`, which
  asserted a producer-side cause from an observation that could not carry one.
  Ordinary contention does not reach the verdict — the threshold is half the
  longest gap — and a gap with no lock wait is still a suspend, which is the
  direction that matters, because that is the first real support hypothesis 1
  has ever had.
- **The loss below the threshold is attributed.** `native-18` lost 2.556 s, named
  1.681 s of it in seven gaps, and the remaining 0.875 s sat in no gap and in no
  field. `lost_in_gaps_seconds` and `lost_below_threshold_seconds` now approach
  `wall - recorded` together.
- **That field was wrong on its first implementation and real hardware said so.**
  Summing only the late side of the jitter reported **0.292 s lost on a
  four-second soak segment that had recorded MORE audio than its own clock ran**
  — a fabricated loss, produced by the instrument built to find fabricated
  losses, and invisible to every synthetic test because the test constants
  rounded 23.2 ms to 23. ALSA delivers in bursts, so an early callback repays a
  late one and the sum has to be signed. Re-measured on the same hardware the
  three segments read 0.005, **−0.006** and 0.007 s against 0.291/0.292/0.302
  before. The negative one is the segment whose recorded audio exceeds its clock,
  and it is reported rather than clamped, because that is hypothesis 3 showing
  itself.
- **The soak takes the same change** (ADR 0084's premise is that it is the app
  minus a *known* delta) and now measures its own lock contention, which had
  been assumed to be zero and is now a number.
- **The three fields are appended to the cadence line, never woven in.** A test
  holds the field order, because `~/.cache/wordscript-soak-report.sh` and the
  event history in the record both parse it positionally — a field inserted in
  the middle silently changes what every previously recorded capture meant.

Rust tests 790 → 799 (+9: one corpus replay, eight in `core::capture`). Every
one was falsified against a deliberately broken implementation before it was
trusted, and the mutation table is in the commit. `cargo check` unchanged at 15
warnings. Frontend untouched. **`process_samples` takes an `AppHandle` and is
driven by no test in this repo, so that `arrived_at` is taken before the lock is
held by construction and review rather than by an assertion** — the half of that
decision a test can hold is held.

### Fixed — the runtime finishes the session, and the dev server stops killing the window (ADR 0134)

Runtime-ownership steps 1 and 2. **Step 1 passed its native-host acceptance run
the same evening, in a run where the overlay rendered no frames at all** — two
dictations reached the clipboard, `history.json` and `~/WordScript/transcripts`
10.0 s after their preview, with zero `[ov-*]` diagnostic output for the whole
run. Still owed: one healthy session logging `path=frontend`, and the epoch
guard has never run in the wild (the binary in that run predated it by one
build).

- **A finished dictation is no longer discarded when its window does not come
  back.** Staging a `clipboard_only` preview arms a runtime deadline of 10 s;
  when it expires the runtime commits — clipboard, history record, transcript
  file — through the same body a window commit takes, so ADR 0018's one-commit
  rule holds across both paths and the overlay keeps commit and abort. Whichever
  path arrives second finds the preview taken and does nothing.
- **The deadline is guarded by a staging epoch, not by a session id.** An abort
  inside the deadline window frees the session for a new capture, and that
  capture can stage its own preview before the first deadline expires — so a
  deadline that only asked "is a preview pending" would commit somebody else's
  dictation several seconds early. `force_processing_for_active_capture` reuses
  a session id, so the id could not separate them either.
- **The runtime says which path completed the session.**
  `Native session completed path=frontend|deadline …` in the runtime log, so
  deadline commits are counted rather than inferred from timing, plus a line
  when the deadline fires and one when it wakes to find nothing to do.
- **Left open, and it is a decision rather than a defect:** an edit that takes
  longer than ten seconds loses to the deadline, and the unedited text is
  committed. The edit surface closes on its own rather than erroring, because it
  reads `isProcessing && pendingResult` and the commit clears both — so nothing
  is inconsistent, but the in-progress correction is gone. ADR 0134 weighed the
  abort case and not this one.
- **The dev server no longer watches 40,000 files it has no reason to watch.**
  `server.watch.ignored` and `test.exclude` read one `NON_SOURCE_DIRS` constant;
  the duplication is what let `donors/` and `vendor/` be excluded for the test
  runner and watched by the dev server for as long as both lines existed.
  Measured on the running server: **20,393 inotify watches before, 576 after**,
  `src/` hot reload unchanged, and Vitest discovering the same 42 files and 533
  tests. Dev-only; `vite` does not exist in a release build.

### Documented — the cue output stream has a user-visible symptom, and it is the routing

No code change. Reported as "the sound is gone" and it was not: the cues were
playing at full volume into the HDMI monitor while the owner listened on the
Bluetooth default. A permanently open output stream acquires a device at process
start and keeps it, and PipeWire's `module-stream-restore` re-applies that route
on every restart — so a stream opened per cue, routed when it plays, could not
have this symptom. The HDMI sink was `RUNNING` with WordScript as its only
stream. Runtime-ownership **step 7** already asks whether the sink should be
held open at all; this is the second reason to answer it, and the speech track's
**F2** (a second output stream, its own lifecycle) is the second consumer.
Addendum in `known-issues/sound-output-underruns-and-reopens.md`; the record had
said no user-visible symptom existed.

Also recorded: editing `vite.config.ts` under a running `npm run tauri dev`
restarts the dev server in place and leaves the parked overlay permanently
blank while the runtime keeps working. That is what produced the invisible
overlay during the acceptance run, and it is now a rule in `AGENTS.md`.

Rust tests 787 → 790 (three new, all in `core::sessions`; two were made to fail
against a build without the epoch guard before they were trusted). Frontend
unchanged at 533 in 42 files — no frontend code was touched.

*(This line read `790 → 793` until 2026-08-14 and took the after-number as the
before-number. Measured at `83d4f0d` the suite is 790, `b9f493e` is documented
at 787, and that commit adds exactly three `#[test]` items — corrected here
because the next step measures its own delta against it.)*

### Documented — the session end belongs to a window, and the instruments that could not see it (ADR 0133, ADR 0134)

Documentation only; no product behavior changed. Sequenced as the new
**runtime ownership** track (`docs/tracks/runtime-ownership.md`), opened as
*measurement integrity* and re-scoped the same day when the last finding turned
out not to be a measurement problem.

- **A finished dictation is discarded when its window does not come back**
  (ADR 0134). `CLAUDE.md` gives the runtime the insert; every insert call site
  is an `invoke` from `OverlayWindow.tsx`, and after `preview ready` the runtime
  has no deadline and no fallback. The clipboard write, the history record and
  the transcript file are all created inside that insert, so no insert means the
  text exists only in memory. Measured across 277 `clipboard_only` previews:
  **1.12 s median, but 11.45–115.11 s in the 13 whose webview was destroyed
  mid-preview**, and one transcript lost outright to an app restart. The runtime
  gets a **10 s deadline** and commits when it expires; the overlay keeps commit
  and abort, and a late frontend commit is a no-op. This is why the track was
  re-scoped: it outranks the watcher fix even though the watcher is cheaper.

- **The dev server reloads all three windows mid-session.** New record
  `known-issues/dev-server-reloads-the-app-mid-session.md`. `vite.config.ts`
  limits the watcher to `**/src-tauri/**`; `donors/**` and `vendor/**` are
  excluded only under `test.exclude`, which the dev server never reads. So it
  watches 32,576 files under `donors/` — 577 of them `tsconfig.json` /
  `package.json`, each a forced full reload — and 4,078 under `vendor/`. About
  **1,389 full reloads in 2.5 days**, 33 of them inside a live capture. That is
  the white GUI window and the vanishing overlay. Dev-only; one edit away.
- **The capture cadence measures on the far side of its own lock** (ADR 0133).
  The defect occurred live on 2026-08-13 and the log held it whole. It refutes
  the app-side delta ADR 0084 pointed at — `slowest_emit_ms` is 0 and 5 ms in
  two of three failures — and shows the instrument cannot separate "the stream
  stopped" from "we blocked our own callback", while printing the first as a
  verdict. A third of the missing audio sits below the 200 ms threshold and is
  attributed to nothing. Load and memory were re-tested and stay refuted.
- **The overlay freeze record reopened.** The sighting it asked for arrived with
  a live capture behind it. The trigger path is not implicated — the stop hotkey
  ends the session and every shortcut works every time. What sometimes fails is
  the recovery, and then in `clipboard_only` the transcript can no longer be
  copied; the two failures occur separately as well as together. Its heartbeat
  cannot detect a reload — a destroyed interval reads as silence, not as a
  stall — so the decision table gained a fourth row.
- **Three mechanisms in six weeks produced one user sentence.** Recorded as an
  addendum on the *fixed* `overlay-leave-hold-dead-actions.md`, whose own
  mechanism did not regress: dead handlers (fixed), a window on no monitor
  (reopened), and now a destroyed webview. Each removes the surface the mode
  offers to the text, and two were fixed individually before the sentence
  returned — so the recurring part is none of them, it is the ownership above.
- **The cue output stream underruns constantly.** New record
  `known-issues/sound-output-underruns-and-reopens.md`. 283 stream errors and
  256 reopens in 2.5 days on the playback sink, whose log line reads as a
  capture failure and is not one.
- **`overlay-stranded-off-screen.md` narrowed.** A second mechanism produces its
  founding sentence, so its mid-session half is no longer safely attributable
  there; the addendum carries the log discriminator.

### Fixed — the screen stops claiming things it does not know (ADR 0128)

- **A per-job provider override is now what is stored, not what was drawn.**
  `AI Models` was taken whole from the demo GUI, and three job rows carried a
  hardcoded override — `Upload` to OpenAI, `Translate` and `Assistant` to
  Anthropic — that decided the row's shape while the runtime stored no override
  at all. The row now states the stored answer, the select writes it, and *Use
  the default* clears it rather than freezing the job onto today's connection.
- **A green `Set` badge no longer appears over a key that does not exist.** The
  override rows asserted a stored credential nothing had been asked about — on
  two of them for a vendor with no adapter and therefore no secret-store entry.
  The badge reads the runtime and has a third answer, *Not read*, for the case
  where nothing was asked.
- **A row that cannot run no longer disables the control that would fix it.**
  The provider select is the way out of *this vendor has no adapter*, and it was
  greyed out by the sentence saying so.
- **The Self-hosted lane stops claiming it cannot hear.**
  `/v1/audio/transcriptions` is a de-facto standard a user-run `whisper-server`
  answers on; what is missing is WordScript's adapter, and the three rows say
  that instead. `OpenRouter` is no longer drawn as unable to transcribe.
- **Vendors without an adapter stay on the screen, greyed, with the reason.**
  That is deliberate and is now written down: an inherited drawing is an
  inventory of what the product intends to offer, so what is still missing stays
  visible rather than being tidied away.

### Added — a second cloud lane, and a connection you can choose (ADR 0096 step 1, ADR 0126, ADR 0127)

- **OpenAI transcribes and writes.** One module plus one registry line, which is
  what ADR 0094's contract promised a second vendor would cost and this is the
  first step that spent it. Nothing in the registry, the capability axes, the
  credential resolution, the seam or the model catalogue had to move.
- **The transport and the credential store are shared; no policy is.**
  `groq.rs` was already the OpenAI request shape with a Groq host
  (`GROQ_API_BASE` ends `/openai/v1`), so the client, the retries, the multipart
  upload and the keyring live in two modules both lanes call. **What is not
  shared is what would have broken it:** OpenAI documents
  `response_format=verbose_json` for `whisper-1` alone, and Groq's
  unconditional default would have made every `gpt-4o-transcribe` request a 400.
- **The connection is yours to pick, and it is stored.** The Cloud provider chip
  wrote nowhere and the credential row spelled `groq` five times. Picking OpenAI
  now writes `providers.default` on the active profile, the key is saved under
  that vendor, and every job row says which connection it follows. **The per-job
  override is deliberately still inert** — the drawing and the runtime disagree
  about what a fresh profile overrides, which is `docs/PROVIDERS.md` open
  disagreement 13 and somebody's decision rather than an adapter's.
- **`whisper-1` is the default on this lane, and not for its accuracy.** It is
  the only OpenAI model returning `duration` and `segments`, which is what the
  *transcript stopped before the audio did* check reads. Choosing a newer model
  costs that check, and the runtime log says so instead of letting the verdict
  go quietly `unknown`.
- Model ids, sources and read-dates for OpenAI's chat and transcription rows are
  in `shared/model_catalogue.json`, read from the vendor's own documentation on
  2026-08-12 (ADR 0115).

### Added — the capability seam, so a drawn row states why it cannot be operated (ADR 0106, ADR 0124)

- **`AI Models` asks the runtime whether a lane can be operated, instead of a
  table.** Which provider chips can be picked was the literal `["Groq"]`, and
  what a connection does was `chosen.stt && chosen.llm` read off the drawn
  `PROVIDERS` table. Both come from `core::providers` now. The drawn table stays
  and is still what `port:diff` measures; it has stopped being a runtime claim,
  and the open disagreements it carries in `docs/PROVIDERS.md` stay open —
  correcting a drawn row is not what this does.
- **`registered_providers()` answers for the whole registry in one call**, reads
  no credential and cannot fail. **A vendor's absence from that answer is how
  *no adapter exists* is stated** — which is what lets it be told apart from
  *the lane denies this role* and from *the role has no credential*. The
  alternative was ten `provider_status` calls on a screen that merely opened:
  ten OS-secret-store reads, a local-runtime probe, and eight of ten answers
  arriving as errors.
- **Three reasons, three sentences, and two more that are about the read.** A
  row inert because a key is missing now says which key, on which role, and
  where to add it, rather than "not integrated yet" over a vendor that is
  integrated. A read that has not come back claims nothing and leaves the
  existing reason standing; **an incomplete capability block is reported rather
  than read as nine silent `false`s**, which would be a working lane called
  denied.
- **The credential row stopped running its own `provider_status`.** It shared
  one read with the seam — two reads of one secret store on one screen open, and
  two components with two opinions of one credential.
- **The mirror between `src/types/providers.ts` and the Rust structs is held by
  a test rather than by a comment.** A field added on one side and not the other
  fails, naming the field and the side. Both new tests were made to fail before
  they were trusted.

### Fixed — the sidebar collapses cleanly, and a saved toggle stops springing back (ADR 0125)

- **The rail no longer reverses itself twice per press.** `useConfigDraft`
  resolved a save by adopting the config it had last received on the event
  channel, and `save_config` emits that event and returns on two channels that
  race — so whenever the promise won, the form was set back to a config that did
  not carry the write yet. The sidebar closed, sprang open, and closed again
  inside one 180 ms transition. A settled save now adopts the config that save
  returned, which belongs to that write and cannot be older than it. This
  reaches every discrete control, not only the sidebar's toggle; it was visible
  here because the old value is a 232 px column rather than a word.
- **Nothing inside the sidebar re-lays-out while the sidebar moves.** Its
  children were `width: 100%` of a box being animated, so every frame
  re-measured the whole column: labels rewrapped, group titles took two lines
  and then one, and the footer was measured moving 29 px up and back down in one
  press. The children are pinned to the width of the state they are in, the head
  is a fixed-height band, and the transition is a clip.
- **The mark stops being rescaled and stops going blank.** The wordmark was
  sized as a percentage of the animating column, so a 1611 px source was
  re-rasterised at 26 → 96 → 158 → 161 px across four frames; the rail's mark
  was the same `<img>` with its `src` swapped, so the first frame of a collapse
  drew nothing at all. Both marks are mounted and crossfade, and the wordmark is
  sized by its height.
- **The rail's icons stand on one axis.** The mark, the toggle, the search icon,
  every row tile and the avatar resolve to the same centre. Two of them did not:
  Tailwind's preflight capped the 26 px mark at the 23 px box it sat in, and the
  shortcut print kept its padding after losing its width, pulling the search
  icon 4 px off the column.
- **The app icon ships at the size it is drawn.** `wordscript-icon.png` is
  2016 × 2130 and 4.65 MB, and was fetched and decoded at the moment of the
  first collapse to be drawn at 26 px. The bundle carries a 20 kB icon instead
  and loses 4.63 MB.

### Changed — the documentation gets an index and a board, and a fact stops having five lists (ADR 0123)

- **`docs/README.md` is new and is the map** — every document, what kind it is,
  and what to read before touching an area. It replaces five lists that had
  drifted apart: `README.md`, `docs/REFERENCE.md`, `docs/DEVELOPMENT.md`,
  `AGENTS.md` and the sub-READMEs each carried their own, and `REFERENCE.md` was
  the only one still naming `docs/templates/` while `DEVELOPMENT.md` did not
  name `PROVIDERS.md` at all.
- **`docs/IMPLEMENTATION.md` is new and is the board.** Three tracks run
  concurrently on `main` — the GUI port relay at Leg 13, core hardening at its
  third pass, the speech track in Stage B — and the only place that said so was
  a prose paragraph in a folder README. The board carries each track's stage,
  its sequence document, the page you paste to start a session, the ADR range it
  owns, and the rules for sharing one tree.
- **A document's directory now states its lifecycle.** `docs/tracks/` holds only
  running tracks; `docs/archive/` holds closed ones, spent plans, spent briefs
  and closed hand-off records. `docs/handoffs/` — which held all four kinds at
  once, sorted by filename prefix rather than by whether the work was live — is
  gone, and the `HANDOFF_`/`KICKOFF_`/`PLAN_` prefixes with it.
- **The GUI port relay goes from 6,081 lines to 877, with nothing deleted.** It
  keeps its rules, a leg-log index that for the first time lists every leg, the
  four most recent leg records and the open brief. Closed records, seventeen
  spent briefs and nine spent kick-off pages moved to three archive documents.
  Its header had said "Leg 6 is CLOSED, Leg 7 is next" for six legs after Leg 7
  closed, and its rule 3 had named `0060` as the next free ADR for sixty-three
  records; both now say what to do instead of carrying a number that goes stale.
- **Two live contradictions were found by restructuring rather than by reading.**
  `STATUS.md` carried its own phase list showing six phases while `ROADMAP.md`
  carried nine — Phases 7, 8 and 9 were missing. The speech plan's status table
  listed step C3 as *not started* eleven paragraphs after the step itself
  recorded **Done 2026-08-12**. The phase copy is removed; C3's row is corrected.
- **One commit belongs to no leg.** `b330815` — the sidebar's second width,
  ADR 0111 — landed while Leg 13 was open and is neither of its two items. It is
  now recorded as unattributed on the relay instead of being silently absent.
- **Paths were corrected across the whole tree, including inside 16 ADRs and six
  source-file comments.** The append-only rule protects a record's reasoning, not
  the resolvability of a path it cites. `docs/prototypes/` is the exception and
  keeps its original citations: ADR 0055 makes it read-only. All 205 markdown
  files resolve.
- **`docs/templates/` is deleted.** Each of its four files stated in its own
  header that WordScript does not use it.

### Added — one model catalogue, and neither runtime spells a model name (ADR 0115 scoped by ADR 0120, speech track step B3)

- **`shared/model_catalogue.json`, with its schema beside it**, carrying one row
  per model this build routes to, defaults to or makes a statement about:
  `(provider, role, model_id, documented streaming, languages, source,
  read_date)`. `core::model_catalogue` loads it through `include_str!` behind
  `CATALOGUE_VERSION` — the shape `core::regression_corpus` already has — and
  `src/lib/modelCatalogue.ts` imports the same bytes. **One file, two readers,
  no mirror.** It sits outside `src/` and `src-tauri/` because neither owns it.
- **A row is named by a stable slug, not by the model name.**
  `anthropic-chat-sonnet`, not `claude-sonnet-5`. That is the property the whole
  scheme rests on: a vendor's next generation is one edited `model_id` and every
  reference in both trees stands. Naming rows by the id would have moved the
  rename problem rather than solved it.
- **The drawn Anthropic ids moved a generation, which closes
  `docs/PROVIDERS.md` open disagreement 5.** `claude-sonnet-4-6` →
  `claude-sonnet-5` and `claude-opus-4-7` → `claude-opus-5`, on the Cloud lane
  and under the Enterprise lane's `anthropic.` prefix. Correcting them by hand
  was refused twice as *the same work twice*; this is the once.
- **Twelve places stopped spelling a model id.** `config.rs`'s four default
  constants plus the inline speech default, `groq.rs`'s default and its two
  profile models, the v1 slice's cloud fallback and its profile match,
  `local.rs`'s chat default, `data.ts`'s four lane tables, the drawn model
  library on `AI Models` and in onboarding, `NoteSettings`' badge, the desk's
  voice preset on three surfaces, `textProfiles.ts`'s profile defaults,
  `WorkspaceWindow`'s two fallbacks, the test factories and the component
  gallery's Select demo. **A test walks `src/` and fails on the thirteenth**;
  test files are excluded on purpose, because a literal in an assertion is a
  check on what a surface renders rather than a second source of truth.
- **The v1 slice's model-to-profile match is gone**, replaced by
  `groq::speech_profile_id`, which answers off `provider_profiles()`. It was a
  second copy of that table and would have become a second copy of two catalogue
  rows as well.
- **The catalogue is not `ModelCapabilities` and is not derived from it.** One
  records what a vendor documents, the other what an adapter asserts. The local
  rows are the live disagreement — they say `streaming: supported` because
  whisper.cpp ships a streaming example and a `whisper-server`, while
  `core::providers::local` answers `Unsupported` because this build shells out
  to `whisper-cli`. A test pins both answers so neither can be quietly made to
  follow the other, which is the defect ADR 0106 recorded.
- **It is not a whitelist either.** A model absent from the file round-trips
  through the config as a typed override — Azure's deployment name is in no
  catalogue by construction, and a self-hosted server's model list belongs to
  whoever runs it. A test saves four uncatalogued ids and reads them back.
- **A row without a source and a read-date fails the suite**, on both sides of
  the seam. That is the rule `docs/PROVIDERS.md` has held itself to in prose
  since it was written and nothing enforced. Rows whose provenance is this
  repo's own drawing or runtime say so — a path in this tree with a date —-
  rather than borrowing a vendor URL they were not read from.
- **A finding the catalogue produced rather than a reading:** `Cloud.upload`
  offers `whisper-large-v3` under a provider override to OpenAI, and that id is
  Groq's. Invisible while the list was three strings in an array. Recorded as
  `docs/PROVIDERS.md` open disagreement 12 and **not corrected** — the row is a
  drawing and the gallery owns it (ADR 0057).
- **The drawn library kept its sizes and quantizations**, moved from JSX into
  `data.ts` beside the slug each row names. They are facts about a file on this
  disk rather than about a vendor's model, and ADR 0122's step B5 is where they
  become an `install` block at `CATALOGUE_VERSION` 2.
- `cargo test` 767 passed / 3 ignored (+12), `cargo check` 15 warnings
  unchanged, `npm test` 492 across 40 files (+12), `npm run build` passes.
  `npm run port:diff`: `onboarding` and `agentoverlay` at 0, `notesettings` and
  `agents` unmoved, and **`models` at structural 6 — the one recorded departure
  (ADR 0088) — with style 191 → 213 and text 6 → 12**, which is the corrected
  Anthropic ids being shorter than the drawn ones and therefore laying out
  narrower.
- **`models` reads style 191 at `HEAD` too**, measured on a stashed tree before
  this step's files existed and twice for stability. So the `6 | 6` this repo
  has quoted since ADR 0088 is structural and style, and **the style half no
  longer describes the screen** — 107 width, 43 padding, 29 height and 12
  min-width differences, with the harness also reporting the two content columns
  at 1765.5 px against 1825 px after its own compensation. When that happened is
  not something this step measured; that it is not this step's doing is.

### Added — the installation the local lane was drawn with and never got (ADR 0122, speech track step B5)

- **A record and a step, no code.** In-app model installation moved out of
  ROADMAP Phase 5 and into the speech track as **B5**, on the owner's
  instruction, because the surface for it has been finished and inert since
  Leg 6: `Models.tsx`'s `MachineTab` and the `Onboarding.tsx` first-run step
  draw a size per row, a `downloading` state with a percentage, an installed
  total and *Open the model folder*, with nothing behind any of it.
- **The finding that shapes the step: the two halves do not share a disk.**
  ADR 0042 argued the single tab from *speech models and language models sit on
  the same disk, under the same runtime*. Half of that is not true in this tree
  — the local chat role talks to Ollama (`127.0.0.1:11434`, `GET /api/tags`,
  `POST /api/chat`, and a failure message that says *Start Ollama*), and Ollama
  owns its store, so a `.gguf` placed beside it is invisible to it. **One
  surface still, for the memory argument that survives; two mechanisms inside
  it** — WordScript downloads the speech weights and asks the user's server to
  pull the language ones.
- **What today's runtime actually does, stated so the step has a baseline.**
  `discover_local_provider_profiles` reads two environment variables and scans
  for `ggml-*.bin`. With neither set, `fallback_provider_profiles` still offers
  `base`, `small`, `medium` and `large-v3` — four rows naming four files that
  may not exist. B5 ends that: a catalogued model with no file is *installable*,
  never *available*.
- **The catalogue grows an install block additively** (`CATALOGUE_VERSION`
  1 → 2, `install: Option<InstallSource>`), which also retires the last of
  ADR 0115's inventory: the drawn sizes and `Q4_K_M` quantizations that are
  still literals in `Models.tsx` and `Onboarding.tsx`.
- **Progress gets its own channel.** `wordscript-model-event`, never the two
  session channels — a download is not a session, and the cheapest way to keep
  it out of the reducer (ADR 0018, ADR 0019) is not to give it the door.
- ADR 0042's gate is unchanged and still open: until the installation exists,
  the local lane is expert configuration and the surface says so. ADR 0067's
  preview badge is untouched — this makes the lane installable, not published.
- Documentation only; no runtime, frontend or test file was touched.

### Changed — the local lane is called `local` (speech track, stage A6, ADR 0121)

- **The provider id `local_preview` becomes `local`, everywhere it is spelled.**
  The module (`core/providers/local.rs`), the struct, the static, the
  `LOCAL_PROVIDER_ID` constant and its serialized value, the `ProviderId` member
  in `src/types/providers.ts`, the v1 slice's `local` contract, and the
  `local-{model}-{preset}` profile prefix. The registry entry's `aliases:
  &["local"]` became the id and the alias list is empty.
- **No compatibility alias and no dual profile prefix**, on the owner's
  instruction: this is a development install and the stored data does not
  matter. A5 removed every on-disk compatibility path days earlier, so adding
  one back for a rename would reverse that decision inside the same plan. A
  stored `local_preview` now resolves to nothing — `normalize_provider_value`
  lands it on the default like any other unknown id, and a stale
  `local-preview-*` profile id falls through to `"base"` at the default preset.
- **The preview badge stays exactly where ADR 0067 put it.** The lane is still
  unpublished and still presented as unpublished; what moved is the identifier
  that was carrying the same status a second time. When Phase 5 lands, the badge
  comes off and nothing gets renamed.
- **The lane's own prose stopped saying *preview* about itself.** Six setup and
  probe messages read *Local preview runner* / *Local preview model file* while
  every other message in the same module already said *Local runtime*; they now
  agree. `previewStaged` and the result surface keep the word for what it means
  in this product.
- Behaviour is unchanged and the counts are the proof: `cargo test` 755 passed
  / 3 ignored, `cargo check` 15 warnings, `npm test` 480 across 39 files,
  `npm run port:diff` `ALL EXACT`.

### Changed — a provider per job, and the second field that meant the same thing

- **A profile stops holding one provider and starts holding the axis.**
  `providers: { default, overrides }` — a resolved default plus a **sparse** map
  keyed by job. A job absent from the map is not a job without an answer; its
  answer is *follow the connection*, which is the drawn select's first option,
  stored as an absence so *Use the default* has something to write back to and
  so the resolution happens at read time. This is ADR 0094's other half, marked
  *not built* in the spec since stage A1.
- **The finding underneath it: there were two `provider` fields and they could
  disagree.** One per profile, which the live pipeline spent on the dictation
  and every transform in that session; one machine-wide, which the history
  retry, the mode router, the v1 slice and the transcript title spent. **A
  config where they differed sent a dictation to one vendor and a retry of that
  same record to another**, with no surface saying so. Nothing in the UI wrote
  either, so on any real machine both read `groq` and the divergence never
  showed. The machine-wide field is gone; the per-profile one won, because it is
  the one the pipeline was actually running on.
- **Every call site names its own job.** `JobKey` is the eight columns
  `AI Models` has drawn since Leg 6, and `JobKey::role()` is the single bridge
  to the credential axis — so *recognise with Groq, transform with something
  stronger* is now a thing the config can express, and a job that overrides
  takes the credential of the vendor it runs on and **never the connection's**.
  That last rule is ADR 0094's one security property: a key resolved before the
  override is a credential sent to a host it was never entered for.
- **`meetings` and `upload` have no runtime path**, and that is stated rather
  than hidden: there is one transcription path and it is `dictation`. They are
  variants so an override stored against one survives the build that grows its
  path. Titles rides the assistant's resolution and gains no override of its
  own, because ADR 0087 settled that its row states rather than sets.
- **Profile schema 5 lifts the stored value behind a `core::backup` snapshot**,
  guarded on its own version rather than on the constant so it runs once instead
  of firing again on every later bump. It ran end to end on the developer's own
  config while `tauri dev` was live: snapshot first, six profiles v4 to v5, the
  machine-wide key gone, no other key touched.
- **Nothing was drawn.** `npm run port:diff` is `ALL EXACT`; the surface still
  writes no provider, which is the seam ADR 0106 describes. `provider_tier`
  stays machine-wide. `cargo test` 755 passed / 3 ignored (+8).

### Added — the transcript that stops before the audio does

- **`TranscriptionCoverage` reads the two fields the response already carried
  and nobody compared.** `verbose_json` returns `duration` and a segment list;
  both were parsed and then only `text` was read. On 2026-08-12 a 72.1 s
  dictation came back as 424 characters ending mid-sentence while the capture
  stage read `missing_ratio=0.0004 verdict=Intact` and the provider itself
  reported `duration=72.144437248`. **The audio was complete and the transcript
  was not**, and nothing downstream had any evidence the rest was ever spoken —
  a truncated transcript is fluent and plausible, which is what makes it worse
  than a dropout.
- **It is the same instrument as `CaptureIntegrity`, one stage later.** One
  answers whether the audio reached the file, the other whether the file reached
  the transcript, and both write one line in the same shape so a reader
  comparing the two stages of one dictation compares like with like. The 10 %
  threshold is deliberately `CAPTURE_GAP_THRESHOLD`'s: the user who reports
  *half my dictation is gone* does not know which side of the seam lost it, and
  two thresholds would put that sentence on two numbers.
- **A ratio alone would call an ordinary pause a truncation**, so a finding also
  needs two absolute seconds uncovered, and clips under two seconds are not
  measured at all. `NotMeasured` is deliberately not `Complete` — *we did not
  look* and *we looked and it was fine* are different facts. An empty segment
  list over real audio is the strongest form of the finding, not a missing one.
- Five tests, including the observed case and the false positive that would make
  the instrument useless. `cargo test` 747 passed / 3 ignored.

### Added — two records from the model-identity question, and a lane renamed

Documentation only. **No source file is in this stage** — the change is five
markdown files, which `git diff --stat` shows directly. No test count is quoted
because the working tree carries a concurrent track's uncommitted Rust, and a
number measured across both would be a claim about somebody else's work.

- **ADR 0120 — a vendor serves its model ids, the catalogue keeps the columns
  no endpoint answers.** Raised as an objection to ADR 0115: curating eighteen
  vendors that rename on their own calendar is stress for no gain. Right about
  volume, wrong about substitution — `/models` returns the id and **none of the
  other columns**. Not the role, which this repo already wrote down at
  `groq.rs:774` (*"`/models` is neither recognition nor completion"*); not
  streaming, which ADR 0110 put on the model axis on purpose; not the languages
  that separate `eleven_flash_v2_5` from `eleven_flash_v2`. Azure OpenAI has no
  listing endpoint **by construction**, because the deployment name is the model
  id. So: the catalogue keeps the typed columns and **shrinks to what this build
  has a position on**, a live fetch merges the long tail when the settings
  surface opens, and a fetched id with no row answers `Unknown` rather than
  `supported`. A failed, empty or unauthenticated fetch falls back to the
  catalogue — **never to an empty picker**, which is what a pure fetch would
  have shown on every lane before its key exists.
- **ADR 0121 — the local lane is named for what it does.** `local_preview`
  becomes `local` everywhere it is spelled, including the serialized provider id
  and the `local-preview-*` profile prefix. **A release status belongs on the
  badge, not in an identifier**: ADR 0067 already states it once with the
  preview badge, and stating it a second time inside a string that reaches
  config and history is why the id would have to change when the status does.
  The word also collides with the session pipeline's own `previewStaged`. The
  badge stays until Phase 5 and ADR 0067's presentation rule is untouched — the
  point is that when Phase 5 lands, the badge comes off and **nothing gets
  renamed**. No compatibility alias and no dual prefix, on the owner's
  instruction and because A5 removed every on-disk compatibility path days
  earlier; a stale profile id resolves to `None` and falls through to `"base"`.
- **The plan gains A6, B4 and a narrowed B3.** A6 is the rename, gated on
  nothing and independent of A4. B4 is the fetch, gated on B3 because there has
  to be something to merge into. B3 keeps its file format, loader and
  source/date test and loses rows.

### Removed — the on-disk compatibility layers, while removing them is still free (speech track, stage A5, ADR 0112)

`cargo test` 742 passed / 3 ignored (**−18**: every case that held a migration,
and none that held a rule — the difference is which sentence the test name
makes). `cargo check` 15 warnings unchanged. The frontend suite reads **480
across 39 files, unmoved**, because no frontend case ever held one of these
migrations: the only one in the area holds the *import* door, and that door
stays open. `npm run port:diff` is `ALL EXACT` — no drawing moved.

**Nothing was behind any of it.** `docs/STATUS.md` records no published
versioned releases and `check_app_update` reports the same, so every path below
served a case that existed on one machine. That machine's config was already in
the current shape when this landed — all six profiles carrying all three
sub-blocks at schema 4, no removed key on disk — so the subtraction cost it
nothing. **The window closes at the first published release**, and this is not a
precedent for deleting migrations later.

- **The plaintext key in `config.json` is gone**, with the three compatibility
  layers A3 had to carry over one API key: `AppConfig.legacy_groq_api_key` and
  its deferred-rewrite branch, the retired bundle identifier
  `io.github.swbench.wordscript`, and the pre-role entry name `groq_api_key`
  with the adoption that fanned it across both roles before any write or delete
  touched it. A credential is now one entry per `(provider, role, kind)` with no
  second place to look. **A3's rules are untouched** — the fan-out across
  registered roles, the refusal of an inadmissible kind, and *clearing one role
  does not clear another* all still hold and still have their tests.
- **The millisecond timeout fields, the global `auto_paste` shadow field, the
  `LegacyTextRules` top-level block, the too-early-seeded reseed repair and the
  global-settings-into-the-active-profile migration** are gone from
  `core/config.rs`, together with the three `TextProfile` migration bodies.
- **Both schema counters stay and stamp.** `TEXT_PROFILE_SCHEMA_VERSION` and
  `shortcut_schema_version` cost a `u32` each and are what keeps the *next*
  migration a one-shot gate rather than a rewrite on every save — D6's defect,
  observed 183 times in two runtime logs. A load below the current version now
  stamps it and rewrites no field.
- **`AppConfig::without_secrets()` stays and scrubs nothing.** It cleared the
  one secret an `AppConfig` ever held; the promise it carries — *nothing leaving
  this runtime holds a secret* — outlives that field, and it is called on every
  write, export and planned config event, so a later credential field lands
  inside a function that already exists.
- **`core/shortcut.rs` stops accepting the pynput dialect** (`ctrl_l`, `alt_r`,
  `shift_l`), a form only the removed Python sidecar produced (ADR 0091).
  Everything else a live surface can send is unchanged: the plain modifier word,
  the platform words for Super, browser `event.code`, key abbreviations and
  comma separators. **A boundary where something foreign arrives keeps its
  tolerance** — that is the whole distinction this step turns on.
- **The `auto_detect_mode` serde alias goes on both sides.** ADR 0112 lists only
  the frontend fallback, and that fallback existed because the runtime accepted
  the alias; keeping one half would have left a pair whose one side justifies
  the other.
- **The import door is not the config door, and it stayed open.** `stt_hints`
  survives as a field a foreign document may carry, `text_rules.rs` still
  honours it, and the conversion into per-entry vocabulary moved out of
  `migrateLegacyBiasPolicyToVocabularyHints` and into
  `textProfileFromRulesDocument`, which is the door it was always really
  serving. An imported archive comes from another machine and another build.
- **`backup::snapshot_config` is private again.** A3 widened it for the
  credential migration; with that migration gone, a visibility with no caller
  behind it is the defect class ADR 0089 and ADR 0103 each swept for. A4 widens
  it back in the step that needs it.
- **The price, stated rather than discovered:** a `config.json` written by an
  earlier build now reads partly as defaults. A pre-seconds timeout, a global
  `auto_paste`, a pre-work-mode profile set, a profile with no per-profile
  blocks and a plaintext API key are ignored instead of converted.

### Added — the provider survey's second pass, and five records from it

Documentation only. `cargo test` 760 passed / 3 ignored and `cargo check` 15
warnings, both unchanged, which is the whole claim a documentation stage gets to
make.

- **`docs/PROVIDERS.md` gains seven vendors and a section on what a vendor
  actually costs.** The drawn set was chosen when the question was *which
  language model cleans up a transcript*; only five of its ten members
  transcribe. Deepgram, ElevenLabs, AssemblyAI, Speechmatics, Microsoft's
  MAI-Voice family through Azure Speech, MiniMax and Bland are surveyed, each
  with a source and a read-date. The voice candidate table goes from seven rows
  to fourteen and **still has not one time-to-first-byte this document will
  repeat as fact.**
- **The adapter-shape table is the section that answers *can this be
  implemented*.** Eighteen vendors collapse into seven protocol shapes, and the
  answer is per shape rather than per vendor or per model. One module reaches
  four lanes; one transport reaches nine streaming vendors; exactly one entrant
  costs a credential ladder of its own.
- **ADR 0113 — the OpenAI-compatible audio shape is already in the tree.**
  `GROQ_API_BASE` is `https://api.groq.com/openai/v1` and the speech call posts
  to `{GROQ_API_BASE}/audio/transcriptions`, so the one integrated cloud adapter
  is the OpenAI shape with a Groq host. Parameterized by base URL it also serves
  OpenAI, OpenRouter and a user-run `whisper-server` — which is why **the
  Self-hosted lane gains the three listening jobs.** A free base URL is gated on
  HTTPS or a private host. Self-hosted synthesis was not read and is not
  claimed.
- **ADR 0114 — `VoiceProvider` gets a contract.** It carried zero methods, so
  every synthesis vendor was unexpressible rather than merely unimplemented.
  Fourteen candidates across four shapes agree on the same request, so the
  contract is **one method, `synthesize_speech`**, the voice an optional field
  because Azure puts it inside the model id and ElevenLabs beside it. Streaming
  grows beside it later — the order ADR 0095 already set for recognition.
- **ADR 0115 — a model name is a dated row in one catalogue.** Model ids live in
  `core/config.rs`, in `src/screens/data.ts` and in the survey's prose, and
  those three have drifted a generation apart. One versioned data file, read by
  Rust through `include_str!` and imported by TypeScript, held by a test — the
  shape `core::regression_corpus` already has. **It is not `ModelCapabilities`**:
  one records what a vendor documents, the other what an adapter asserts.
- **ADR 0116 — a vendor comes in because it serves a job better.** The four STT
  specialists bias the recogniser through a parameter that **never becomes
  decoder text**, which is the defect class
  `known-issues/stt-prompt-leaks-into-the-transcript.md` stays open on and that
  three existing records exist to contain. And a vendor gets its own module only
  for a reason OpenRouter cannot already answer.
- **ADR 0117 — Azure Speech is a Cloud credential.** Different host, header,
  body format, resource and key from Azure OpenAI; no deployment and no tenant,
  which this repo's own lane definition makes the deciding test. Same
  relationship Polly has to Bedrock — the shared brand is what makes the wrong
  answer look right.
- **`docs/tracks/speech-track-plan.md` gains B3 and D1a**, and
  G3 stops being one bullet naming nine adapters. **D1a is not gated on a
  drawing answer**, which makes it the reachable path to a second and third
  speech lane while F1 waits on the owner.

### Added — the speaking palette, and the row question answered

- **ADR 0118 — the palette is offered whole.** *No half measures*, the second
  time that instruction has widened a scope after ADR 0096 did it for the lanes.
  **Cartesia, Bland and MiniMax get their own modules because OpenRouter does
  not carry them**; **Azure Speech gets one because OpenRouter carries it
  flattened** — it serves `microsoft/mai-voice-2` without SSML, and SSML is
  where `mstts:express-as` and the eighteen styles on `de-DE-Klaus` and
  `de-DE-Mia` live. **The order follows a measurement on this machine**, not the
  vendors' pages, because not one of the fourteen candidates publishes a figure
  this repo will repeat as fact. Cartesia's 3000 ms default buffer is named in
  advance rather than discovered in a shipped build.
- **ADR 0119 — the `Speaking` group has two rows**, answering the question
  ADR 0109 left with the owner, who delegated it. The desk speaks **as**
  WordScript — ADR 0043's one voice, one body, and the orb has no meaning
  outside agents. The translation speaks **somebody else's words**, in a
  language that is by definition not the user's, at conversational tempo. They
  need different languages (candidates run 8 to 70+), different latencies and
  different budgets, so they are different jobs: `JobKey` gains `voice` **and**
  `translation_voice`, both on the `Voice` role and therefore on one credential.
  **One row for translation, not one per language** — the route is per language
  (ADR 0064), the model is not, and two model rows for one dialogue would mean
  two vendors and two keys inside a single exchange.
- **A defect the question was hiding.** `Translate.tsx` already tells the user
  the voice is *"chosen on AI Models like the rest"* and draws a button there —
  pointing at a group whose only row is explicitly about coding agents. It was
  recorded as *undecided*; one surface was already promising what the other does
  not answer.
- **Plan steps F4 and F5**, and **F1 loses its gate.** F4 is the
  time-to-first-byte measurement that orders F5's four modules; F1 was blocked
  on the owner's drawing answer and is now blocked only on drawing it.

### Changed — two claims the survey made about itself

- **"Audio rides the chat endpoint, not an audio endpoint" was half right.**
  OpenRouter's multimodal page is correct and simply is not the whole API:
  `/api/v1/audio/speech` has existed since 2026-04-18 and
  `/api/v1/audio/transcriptions` since 2026-07-22, both OpenAI-SDK compatible.
  They reach `microsoft/mai-voice-2`, `google/gemini-3.1-flash-tts-preview`,
  `mistralai/voxtral-mini-tts-2603` and `openai/gpt-4o-mini-tts-2025-12-15` —
  **four vendors' synthesis on one key, for no module each.** The drawn
  `stt: false` on that lane is now provably wrong and is open disagreement 11.
- **"Speech has no OpenAI-compatible shape to talk to" contradicted the same
  file eleven paragraphs earlier**, which already recorded that whisper.cpp
  ships `whisper-server`, *"an HTTP server with an OpenAI-compatible API"*.
  `/v1/audio/transcriptions` is a de-facto standard. The drawn refusal on the
  Self-hosted lane's three listening jobs is open disagreement 10 — a drawing,
  so the gallery corrects it, not this pass.
- **The survey's maintenance rules gain the lesson.** Both errors were one
  mistake made twice: a page read correctly and a *"not"* written from it. So:
  before writing that a vendor cannot do something, look for the second page —
  and before writing it about a lane, grep the file for the opposite claim.

### Added

- **The workspace sidebar has a second width, and the window may choose it**
  (ADR 0111). A toggle at the top of the sidebar — drawn in both states, never
  on hover — collapses it to a **56 px rail**: the app icon in place of the
  wordmark, the search field as the icon it already carries, every navigation
  row as its own tile, the active profile as its avatar. It is the same sidebar
  with its labels withheld, not a second sidebar: every rule about a row's
  tile, its active ground, its accent and its hover is untouched, and the label
  stays in the DOM so a row keeps its accessible name and gains the tooltip a
  label would have been. **The choice is remembered** in
  `AppConfig.workspace_nav_rail`, for the reason `color_scheme` is remembered
  there. **The window rails on its own below 760 CSS px** and that is *not*
  written down — dragging a window narrow and wide again expresses nothing, so
  the breakpoint fires on a crossing and the toggle is the authority in
  between.
- **The icon set gains its 79th glyph, and it is the first that is not the
  prototype's.** `demo.js`'s `ICONS` and `iconPaths.ts` were name-for-name
  identical; the prototype's sidebar has one width and therefore no control to
  change it, so `sidebar` is drawn at this set's radii and stroke rather than
  borrowed from lucide.

### Fixed — the workspace at the widths it is actually used at

ADR 0104 closed with a finding and did not act on it: *"The workspace has no
width breakpoint at all. Below the width the design assumes, the layout does not
rearrange — it compresses, and the text column is what pays."* ADR 0111 is that
finding answered. Reported from the running host on 2026-08-11.

- **Every responsive rule measures the column it is drawn in, never the
  window.** `.ws-content`, the settings sheet's scroller and **a pane's detail
  column** all declare `container: ws-column / inline-size`, and the nearest one
  wins. The rail is what makes this the only correct choice: the content column
  is the window minus a sidebar of one of two widths, so two windows of the same
  width can hand their content a column 176 px apart. The four `@container`
  rules that already existed resolved against `.ws-content-inner`, which in a
  pane is the full column and not the half the row sits in — they now measure
  the half.
- **Three tiers, each giving up the cheapest thing left.** At 620 px the inset
  falls from 32 to 24; at 460 px it falls to 16, **`.ws-row` becomes a stack**
  (the control takes its own line, the text column takes the whole row — the
  arrangement `data-layout="stack"` already draws by hand), and **fixed-track
  grids collapse to one column**. A fixed grid track does not degrade, it
  collides: an `auto` track will not shrink below its content, so a legend row
  came out as `sets / how / a / sentence / is / built` with the badge column
  drawn over the top of it.
- **The pane's list column is a range, not a number.**
  `clamp(176px, 32cqi, 236px)`. It was a flat 236 px, which left the detail
  beside it **227 px** at a 695 px window — a profile's whole settings surface
  at three words to a line.
- **`Change in profile` on Home hung 5 px past the content column.** `.ws-grow`
  was `flex: 1` with a zero basis, so on a wrapping row it never took a line of
  its own; an `auto` basis is what lets the wrap the row already declares
  actually happen.
- **AI Models: every control in an open job's well sat hard against the well's
  right edge** while its label sat 25 px in from the left one. The well pays its
  inset on both sides now. The job's model badge also got a shrinkable track,
  so `whisper-large-v3-turbo default` reaches the ellipsis it already had
  instead of pushing itself off the card.
- **The segment control and the note tab strip wrap** rather than running off
  the card; a section head stacks its title and its sentence; and `.ws-cmd`
  gained the `min-width: 0` that makes the scroller inside it reachable.

### Fixed — the profile control

- **The settings sheet's profile control was a link wearing a popup button's
  chevron.** `ProfileSwitcher`'s own note has claimed since Leg 3 that it is
  "the same control in the workspace sidebar and in the settings sheet's
  header"; it was a `SheetProfile` that navigated to Profiles and closed the
  sheet. It is the same component now, in a `sheet` variant — one runtime call,
  one refusal path, two grounds. `SheetProfile` is deleted rather than aliased
  (ADR 0054); the door to Profiles is not lost with it, because every scoped row
  on those screens carries its own.
- **A refused profile switch is visible.** `.catch(() => {})` swallowed the
  runtime's refusal, so the `<select>` sprang back to where it started with
  nothing said — the whole of "sometimes it just does not switch". The sidebar
  prints the sentence; the sheet's header strip draws the refusal on the row and
  carries the sentence in its tooltip.

### Fixed — two things found on the way

- **The Help panel looked transparent and was never transparent.**
  `.ws-menu` carried no `z-index`, and a positioned box with `z-index: auto`
  paints in DOM order among its siblings' positioned descendants — the sidebar
  comes before the content column, so every positioned box in a pane painted
  over an opaque `--bg-surface` panel. It sits at 8 now: above the note's float
  bar and the chat window, below the settings sheet's scrim.
- **The Help panel was clipped to 56 px in the rail.** `.ws-nav` scrolls, and a
  scrolling box clips both axes whatever the other is declared as. It takes the
  same way out `RowMenu` already takes for the pane's head — the caller
  measures, the panel places itself at viewport coordinates — and only in the
  rail, because expanded, an anchored panel is the better one.

### Added

- **`docs/PROVIDERS.md` — the provider matrix, read against each vendor's own
  documentation rather than from memory.** **Ten providers across four lanes**,
  plus the local and self-hosted ones and the voice-only vendors outside the
  drawn set, each row dated and sourced: which of the nine jobs it serves,
  whether recognition is batch or streaming, whether the response names the
  language it heard, and what the credential shape is. It exists because the
  provider stack turned out to be what blocks the surfaces above it, and because
  three of its findings contradict what a search result says. **Nothing in it is
  a claim about this codebase** — the runtime still integrates exactly two
  providers.
- **A ChatGPT subscription can pay for OpenAI's text jobs, and it is the only
  vendor where that is still allowed** (ADR 0102). The API key stays the default
  and stays available; what is added is a second credential kind on the same
  Cloud row. **It reaches five of the nine jobs.** The backend a subscription
  authenticates against serves `/v1/chat/completions` and `/v1/responses` and
  has **no `/v1/audio/transcriptions` and no `/v1/audio/speech`** — so it can
  pay for `cleanup`, `rewrite`, `translate`, `enhance` and `assistant`, and for
  none of `dictation`, `meetings`, `upload` or `voice`. A subscription pays for
  what happens to a transcript, never for producing one. **The equivalents for
  the other vendors exist and two were shut off this year**: Anthropic added the
  prohibition to its terms on 2026-02-19 and enforced it on 2026-04-04, Google
  suspended accounts in February 2026 including paying Ultra subscribers, and
  Groq, Mistral, xAI and Deepgram sell no subscription at all. That refusal is
  part of the record rather than an omission — the cost of getting it wrong is
  the user's account, not a failed request. Auth is planned as a native Rust
  OAuth + PKCE flow, **not a bundled Node proxy**, which would reverse ADR 0001
  and ADR 0091. Planned; not implemented.
- **The four decision gates the roadmap put in front of streaming recognition
  now have answers, and two of them are closed** (ADR 0095, ADR 0097).
  **Groq — the only integrated cloud lane — does not stream at all**: one file
  in, one result out, no websocket, no `stream=true`, no partials, and language
  is a hint rather than a detection. OpenAI, xAI, Mistral and Azure OpenAI do.
  So the roadmap's conditional resolved to something its entry did not
  anticipate: it is neither a pure Phase 4 nor a pure Phase 5 question, because
  streaming exists on several lanes the product intends to carry and none it
  carries today.
- **A streaming contract that stands beside the batch one rather than replacing
  it** (ADR 0095), so ADR 0018 and ADR 0019 are untouched and no partial result
  reaches the session reducer. Its first implementation emits **no partials at
  all** — a segmenter marks the utterance and the adapter transcribes it as a
  file — which is what lets one contract serve a lane that streams and a lane
  that cannot. **Turn boundaries and partial results are separate requirements**,
  and the two surfaces waiting behind this need different ones: a conversation
  at a table needs turns, a caption strip needs partials.
- **The direction of a spoken turn is read off the recogniser, never off a
  button** (ADR 0099) — the gate the roadmap calls the feature's real one. The
  signal exists on four lanes and not on Groq. The rule that carries it is the
  no-match case: an unrecognised turn keeps the direction it had **and says so**
  rather than being silently turned around. Not to be confused with
  `hallucination_detect.rs`'s language-switch signal, which is quality control
  on one finished batch; wiring the two together would make a conversation's
  normal behaviour look like a hallucination.
- **Speech gets a second output stream on a device the user picks** (ADR 0097),
  extending ADR 0010 without weakening a single cue rule. The difference that
  forced a second object rather than a shared one: a cue pre-empts the running
  cue, because a stale cue is a lie about state — **an utterance cut mid-sentence
  is the other person's half of the conversation**.
- **Every drawn lane gets a real adapter** (ADR 0096, superseding ADR 0065),
  documented before it is written. Three of ADR 0065's terms carry over
  unchanged, including the one most likely to be dropped in a build-out: a lane
  that is not yet integrated stays inert **and still says why**.
- **The provider contract becomes three traits plus a registry** (ADR 0094).
  The closed `enum ProviderId { Groq, LocalPreview }` is two match arms in eight
  functions today and eighty at the drawn target. A provider that cannot serve a
  role does not stub it, which moves the absence somewhere the compiler can see
  it — and the provider axis splits per role, because Anthropic transcribes
  nothing and one `provider` field per profile cannot express that.
- **A window class whose geometry belongs to the user** (ADR 0100), for the four
  drawn windows with no runtime host. `DESIGN_SYSTEM.md` has named a five-member
  window family for two legs and **none of the five exists**: three windows are
  declared statically and there is no `WebviewWindowBuilder` in the tree. The
  class is explicitly *not* the path ADR 0089 abandoned — that was content
  height driving repeated `set_size`, and no generic resize command returns.
- **A credential resolves per role, and a job never inherits one its role cannot
  use** (ADR 0105). ADR 0094 wrote its credential rule for the *overriding* job,
  which makes inheritance the operating case for every other one — and ADR 0102
  broke that premise the same day by making the credential kind per role. Set
  the connection to OpenAI, pay by subscription, and `dictation` would inherit a
  credential whose backend serves no recognition, **without the user touching
  that job**. So *follow the connection* follows the provider and never the
  credential; a role with no credential makes the job inert and **names what is
  missing** rather than borrowing the other kind, which would be the role-shaped
  version of the host mistake ADR 0094's security rule exists to prevent.
- **A turn is a recording, and the stream that carries a conversation outlives
  every one of them** (ADR 0107) — the capture half ADR 0095 assumed and did not
  price. `start_native_capture` opens the device *and* begins the recording;
  samples land in one `max_samples`-bounded buffer; `stop_native_capture` takes
  it whole. **There is no way to lift a segment out of a running capture**, and
  a conversation is nothing but segments. Separating the two keeps every
  instrument applying per turn unchanged — `CaptureIntegrity`, `capture_budget`,
  `transcribe_audio_file` — and makes ADR 0095's sentence about transcribing an
  utterance as a file literally true instead of aspirational.
- **`voice` becomes the ninth `JobKey`, and no adapter lands before the row that
  operates it** (ADR 0109). Four records already write contracts against a job
  the type does not carry. The second half is the rule the build-out order
  needed: ADR 0096 schedules Groq voice second while the drawn `Speaking` row
  offers `Cartesia Sonic-3` and `Kokoro-82M` and nothing else, with no provider
  mark and no credential control — **an adapter written under that order is code
  with no control that reaches it**. An inert lane that says so is honest; a
  capability with no drawn control is not visible as missing at all.
- **A machine-wide setting drawn on a surface that stands more than once needs
  an echo the runtime does not have** (ADR 0108). ADR 0097's per-language
  routing is a property of the desk and is drawn inside a window ADR 0064 lets
  stand several times, in webviews that share no state — and **nothing in the
  runtime announces that a setting changed**. The config is the only holder, a
  write is announced, the card states its own scope, and the event takes the
  same `without_secrets()` scrubbing every disk write does.

- **The on-disk compatibility layer is dropped rather than carried** (ADR 0112,
  planned as stage A5; not implemented). Stage A3 had to hold **three**
  compatibility layers over one API key at once to re-key it safely — a retired
  bundle identifier, a pre-role entry name and the plaintext key in the config
  file — and there is nothing behind any of them: `docs/STATUS.md` records **no
  published versioned releases** and `check_app_update` reports the same. So a
  path that exists only to read an older *local* stored shape goes, with its
  field and the tests that hold it. **Three lookalikes stay, and the record
  names them** so a sweep matching the word does not take them: normalization,
  which canonicalizes every value including one written a second ago; tolerance
  at a boundary where something foreign arrives — an imported archive, an IPC
  payload, a shortcut string typed into the UI; and a name that says *legacy*
  about a session state rather than a file shape. **The import door is not the
  config door**: `stt_hints` survives as a field a foreign document may carry,
  while the migration that rewrote this machine's profiles into
  `vocabulary_hints` does not. The window closes at the first published release,
  and the record says so rather than becoming a precedent for deleting
  migrations later.

### Changed

- **A credential belongs to a role, not to a provider** (ADR 0105 and ADR 0102's
  storage half, plan stage A3). The secret-store entry stopped being one string
  per provider and became one per `(provider, role, kind)`, so **clearing the
  chat credential leaves the speech one standing** — a single provider-keyed
  delete was the bug this shape exists to prevent. A role with no credential
  answers inert and **names what it is missing** rather than spending the kind
  the same provider holds for another role, which is the role-shaped version of
  the mistake ADR 0094's security rule prevents and is not softer for happening
  inside one vendor.
  **A save that names no role reaches every role the kind can pay for.** The one
  drawn key row sits on a connection, and the everyday act is *I gave WordScript
  my key* — not *I paid for recognition but not for cleanup*. A save landing on
  one role would leave somebody having done everything the screen asked while
  half the jobs stayed silently inert. Which roles exist is
  `ProviderEntry::roles()`, so a credential cannot be stored for a role with no
  implementation.
  **A subscription is inadmissible for speech and voice in the type** — the
  backend a ChatGPT plan reaches serves no `/v1/audio/transcriptions` and no
  `/v1/audio/speech`, so there is no call to fail — and it is filtered out of
  that fan-out whether or not a caller names a role. Groq accepts an API key and
  says so; the local lane accepts no kind at all, which is what that lane *is*
  rather than a lane missing one. **A registry test holds the subscription kind
  to OpenAI**, so a later vendor cannot inherit ADR 0102's exception by omission.
  `provider_status` answers per role in `role_credentials` and folds them into
  the one connection block conservatively: configured means every role has one,
  because overstating readiness fails a transform silently and understating it
  is visible. The single key a previous build stored is adopted onto every role
  it used to pay for **before** any write or delete touches it, and the config
  migration copies the file aside through `core::backup` first. `cargo test` 760
  passed / 3 ignored (**+12**); `cargo check` 15 warnings unchanged; in `src/`
  only the type mirror moved and `npm run port:diff` reads `ALL EXACT`. **The
  OAuth flow is not here** — acquiring a token set is stage D3, and no vendor
  accepts a subscription today.
- **A capability is asked on two axes, and "does this stream" needs a model**
  (ADR 0110, plan stage A2). *Which roles does this vendor serve* stays on
  `ProviderCapabilities` and gains `speech_synthesis`; *does this model stream,
  does it name the language it heard, does its voice stream* moved onto
  `ModelCapabilities`, answered by `providers::model_capabilities(provider,
  model)` — **both arguments always**, the shape `capture_limits` already had.
  One OpenAI key serves `gpt-4o-transcribe`, which streams, and `whisper-1`,
  which does not, so a contract answering that from the provider alone forces a
  lie on whichever model loses the vote.
  **A model answer is three-valued** — `supported`, `unsupported`, `unknown` —
  because one drawn lane's model list belongs to the vendor and cannot be
  enumerated ahead of time. A capability nobody has looked up is not a
  capability that is absent, and a `bool` would have settled that at the point
  where the value is written, where no reader can tell a guess from a
  measurement.
  **A lane cannot claim a role it did not register**: a registry test holds
  `speech_synthesis` to `voice.is_some()` across the whole table, which is the
  property ADR 0094 wanted from the type and could not get from a struct field.
  Both lanes answer `unsupported` on every model field today — Groq's speech
  endpoint takes a file and returns a result, and the local lane passes `-l` to
  `whisper-cli` and puts the *requested* language back on the response, which is
  echoing rather than reporting. **So the pair differentiates nothing yet**, and
  the vendor whose two models disagree is proved by a fixture in `registry.rs`
  rather than left unproved until its adapter lands. `cargo test` 748 passed / 3
  ignored (**+8**, all new tests); `cargo check` 15 warnings unchanged. Nothing
  in `src/` changed but the type mirror, and **no surface reads either axis** —
  that seam is ADR 0106.
- **The provider enum is gone; dispatch is a registry over three role traits**
  (ADR 0094, plan stage A1 — the first step of the speech track to change code).
  `core/providers/registry.rs` declares `Provider`, `SpeechProvider`,
  `ChatProvider` and `VoiceProvider`; a `ProviderEntry` names one id, its
  aliases and the implementations behind it; and the eight top-level functions
  in `providers/mod.rs` became thin resolvers that look an entry up and call a
  role. **Adding a provider is now a module plus one entry**, where it was an
  edit in eight match statements. **A provider that cannot serve a role does not
  stub it** — the absence is `voice: None`, and `Some(&GROQ)` in that slot fails
  to compile because `Groq: VoiceProvider` is not satisfied, which was verified
  by making it fail rather than by asserting it here. `VoiceProvider` is
  declared and implemented by nobody, and carries no method: the synthesis shape
  belongs to ADR 0097 and ADR 0109, and a signature invented ahead of them would
  be a guess the compiler cannot check.
  **A pure refactor, and the test counts are the proof**: `cargo test` 740
  passed / 3 ignored and `cargo check` 15 warnings, both unchanged; `npm test`
  474 across 39 files and `npm run build` unchanged by construction, since
  nothing in `src/` was touched and every `invoke(` still resolves against
  `invoke_handler`. ADR 0094's other half is untouched and still planned: the
  config holds one `provider` field per profile, not a resolved default plus a
  sparse override per job.
- **Streaming is a property of a model, not of a provider** (ADR 0110). ADR 0094
  named OpenRouter *"the exception that proves the axes are per provider"*; a
  second read of the donor's model registry shows **it is a constant nowhere**.
  One OpenAI key and one endpoint serve `gpt-4o-transcribe` and
  `gpt-4o-mini-transcribe` with `streaming: true` and `whisper-1` without it,
  and the local lane says it again — two of four Parakeet models carry
  `runtime: "online"` and stream, the other two do not, same binary family and
  same installation. **The role is the provider's and the shape is the
  model's**: `speech_synthesis` stays a provider-level role question,
  `transcription_streaming`, `reports_detected_language` and
  `synthesis_streaming` move onto the model entry — which is the axis the user
  is already standing on, since they pick a model per job and never pick a
  "streaming provider". `docs/PROVIDERS.md` had the evidence in its own OpenAI
  section and its sixth open disagreement before the axis was chosen.
- **Bedrock model ids are up to four parts, and the drawn ones are wrong in
  two.** The survey recorded an `anthropic.` prefix; a shipped implementation
  uses `us.anthropic.claude-sonnet-5` and
  `us.anthropic.claude-haiku-4-5-20251001-v1:0` — a cross-region inference
  profile prefix, then the vendor prefix, then optionally a date and a `-v1:0`
  version. The drawn `LANES.Enterprise` rows carry `anthropic.claude-sonnet-4-6`:
  no region prefix **and** a generation behind. Also recorded: all three
  enterprise lanes need a typed model id rather than only Azure, and Azure ships
  with no model list at all — which is the working answer to *the deployment
  name is the model id*.
- **No surface reads a runtime capability, and a record claimed one did**
  (ADR 0106). ADR 0094's first draft called the `ProviderCapabilities` mirror
  *"the seam that stops a surface from claiming a capability the lane behind it
  does not have"*. The struct is mirrored and returned by `provider_status`, and
  **no field of it is read anywhere in `src/`** — `Models.test.tsx` mocks it as
  `{}` and the suite passes, which is the proof nothing consumes it. Every
  capability answer on `AI Models` comes from the hand-maintained `PROVIDERS`
  table in `src/screens/data.ts`, the same booleans `docs/PROVIDERS.md` runs
  three of its open disagreements against. **The drawing states an intent and
  the runtime answers a capability**; the code that makes the second govern the
  first is a step before the first adapter and is asserted by a test rather than
  by a sentence. The false clause is corrected in ADR 0094 and `SPEC.md` in
  place and recorded rather than deleted — asserting a capability the runtime
  does not have is the defect class this repo has a six-leg scar from.
- **`muted` does not do what its name suggests, and a duplex mute cannot reuse
  it** (ADR 0098). Read against `process_samples`: `paused` gates the sample
  push and is subtracted from the effective wall clock; **`muted` gates only the
  level statistics, the voice-activity timestamp and the emitted meter, and the
  audio keeps being recorded**. So the runtime mute that lets the machine speak
  over an open microphone is a third state, and the stretch it holds must come
  off `CaptureIntegrity`'s clock — otherwise every spoken reply pushes a
  conversation toward ADR 0079's `short` verdict and the one instrument this
  repo has for the open capture defect starts crying wolf on its own behaviour.
- **The copy budget is measured now, and `≤ 90 characters, one line` was wrong
  for every row on the surface** (ADR 0092). `.ws-row-ctl` is `flex: none` and
  `.ws-sel` is `width: auto`, so a Select is as wide as the longest option the
  runtime put in it and every one of those pixels comes off the text column.
  Measured in WebKitGTK across 123 rows and 51 conditional states, **one line
  holds between 12 and 73 characters** depending on the control beside it. The
  `≤ 90` was written in four places — `Card.description`, `SectionHeader.description`,
  `DESIGN_SYSTEM.md`'s budget table and the plan's §5.2, where it was also
  promised a lint rule that was never possible — and all four now carry the
  measurement. **Two lines is the drawing's norm**: 62 of the 74 rows over one
  line are the prototype's copy verbatim, and they are deliberately untouched.
- **Three rows stopped printing the runtime text their own control displays.**
  `General`'s `Input device` built four conditional sentences out of the device
  name its Select was already showing and drew four lines — five where a saved
  device is missing — beside an `Input level` row drawing one; the row now
  carries no hint, the standing fact is on the card, and the two exceptional
  states are a `Note` under it with room for a sentence. `General`'s `Anchor`
  named the monitor with the `(Primary)` suffix its own Select carries, where
  the drawing names it `DP-1`. `About`'s release row grew a 68-character summary
  to 172; the five `check_app_update` summaries state their result only, and the
  clause all five shared is on the **This build** section header once.

### Added

- **Text rules can be shared again, and the two halves are on different screens
  on purpose** (ADR 0090). `export_text_rules` and `import_text_rules` have been
  complete in the runtime — schema version, conflict resolution, merge,
  analysis — and reachable from nothing since Leg 3's shell overwrite deleted
  the surface that called them, while `ARCHITECTURE.md` went on asserting the UI
  did it. **Export acts on a thing and import creates one**, so they are not
  drawn as a pair: `Export rules` is the fourth verb on the profile's own row
  menu, where it writes the profile the menu was opened on and needs no picker;
  import is on Privacy & Data beside the full backup, where it lands as a **new**
  profile and replaces nothing — the profile it makes does not exist yet, so
  there is no row for it to act on and no target to choose. Privacy & Data
  carries the export too, with a profile picker, for a reader who is there to
  move data rather than to edit a profile. The import re-mints the file's rule
  ids and runs the legacy vocabulary migration, or every word in an imported
  file would be drawn in the profile and reach no recognizer (ADR 0035).

- **AI Models has a row for the title call** (ADR 0088). ADR 0077 spends a
  chat-model call on every dictation to name the transcript file, and until now
  it was stated in a decision record and on no surface. Titles is a row in the
  Writing group that names the model it runs — the assistant's, resolved through
  `chat_model_for_provider` — and offers no setting, because ADR 0077 gives it
  none. It does not open, and that is the decision rather than an economy: a
  `<details>` whose body holds no control is the affordance that opens nothing.
  Measured both ends: `models` goes from structural 0 | style 0 to **structural
  6 | style 6**, against the 18 | 6 ADR 0087 had priced for a `LaneJobRow`
  shape. A flat row renders `div.job` where a job row renders `details.job`, so
  it occupies its own sibling index space and shifts no path — the 6 are its own
  nodes and one height reported at each ancestor it cascades through.

- **The profile health flag's click opens the flags** (ADR 0085). It had no
  destination because its four kinds point at three different tabs, so it routes
  to none of them: it opens a panel listing each flag with its sentence and the
  door to the tab that holds its cause — `form_conflict` and
  `cleanup_interference` to Context, `length_bias` to Replacements,
  `bias_policy_weak` to **Defaults**, which corrects the Leg 7 record's "Words".
  `bias_mode` has no control anywhere in the product and Words only displays the
  effect, so a door there would have promised a repair it cannot perform. One
  click on an aggregate count landing on the first of three would have been a
  guess presented as a route.
- **A health flag can be acknowledged, which it could not since Leg 3.**
  `acknowledge_profile_health_flag` and its counterpart have been registered
  commands writing a per-profile set that `get_profile_health` reads back and
  derives `level` from — with no caller, because Leg 3's shell overwrite deleted
  the `PromptsTab.tsx` that wrote it. `derive_health_level` was computing a level
  out of a set nothing could write, so a heuristic warning could never be closed.
  An acknowledged flag stays in the list and in the count, because it is still
  true; what it stops doing is colouring the profile.
- **The flag carries the runtime's `level` as its tone.** Red for a conflict the
  model will act on, amber for the ordinary case, green for every flag read and
  accepted. A red profile and an amber one had looked identical.
- **A transcript states how long its audio is** (ADR 0086). `duration_ms` was
  the one §11.23 frontmatter key with no source, and `render`'s own note said it
  would go in "when the record grows a duration" — the record grew one three legs
  earlier in ADR 0079 and nobody connected the two. It is
  `capture_integrity.recorded_seconds`: the audio, not the clock, because that is
  the length of the file the `audio:` key points at and the only one of the two a
  reader can check. Absent on a retry, an upload and every record older than the
  measurement, rather than written as zero.
- **The defect that needed no dictation got a binary that needs no app**
  (ADR 0084). `capture-soak` opens the device WordScript opens, holds it open
  for hours and reports what it delivers — the loss of audio in
  `capture-loses-half-the-recording.md` happens about once per hour of open
  stream, not once per capture, and every diagnostic it needs is written before
  the empty-recording branch, so nobody has to speak into it. It carries
  `CallbackCadence` and `CaptureIntegrity` themselves rather than copies, does
  the same per-callback work minus the `app.emit`, and rotates its books into
  300 s segments from inside a callback so the segments tile the run without a
  seam a dropout could hide in. Not shipped and not reachable from the UI; run
  by hand, writing its own log. **The eleven events are still eleven** — the
  tool exists, a night has not been recorded.
- **The five controls that had no editor behind them have one, and it unfolds
  under the row it acts on** (ADR 0082). Add and Edit on Profiles' Replacements
  and Snippets, a new profile's rename, `More`'s menu, and both calls to
  `analyze_text_rules` — every one of them had been drawn, disabled and carrying
  *"No editor is drawn for this yet"* since Leg 4c, and the prototype draws no
  editor for any of them, so this is the first surface the port designed rather
  than carried across. It is the plane `RawPanel` already opens on: same inset
  ground, same dropped rule above, nothing dimmed and nothing centred. Not a
  dialog, because Settings is already a modal sheet and a second scrim over it is
  the weight ADR 0069 took off Help. The panel holds the draft until Save, so
  Cancel can throw it away and one finished value reaches the config instead of a
  keystroke; the first field takes focus, Enter commits, Escape reverts, and a
  snippet body keeps Enter for its own newline and commits on Ctrl+Enter.
- **`analyze_text_rules` answers where it was asked.** *Check against a sample*
  opens a live preview under the card — what you say, what gets written, and the
  rules that fired by name — and *Show the effective bias* opens what the
  recognizer actually receives beside what deterministic repair can reach.
  Warnings appear **under the rule that caused them**, routed by `rule_ids`,
  which is the pre-port behaviour restored: a list of issues at the top of a
  screen tells the reader something is wrong and leaves them to find it.
- **The rule lists can be reordered, and say why.** `apply_dictionary_entries`
  and `apply_snippet_entries` each fold one entry's output into the next, so the
  order is a value — and it was one the ported list could neither show nor set.
- **A row's actions are a right-click, on every list in both pane screens.**
  Profiles' profile rows and rule rows, and Context's folders and objects, all
  answer with the same compact menu of verbs. Context's is drawn only: the
  context object does not exist in the runtime and the banner still says so, but
  the two rails no longer have two manners.

### Removed

- **The four session commands, which were the Python sidecar's contract**
  (ADR 0091). `start_native_session`, `stop_native_session`,
  `native_session_status` and `complete_native_session` were named in
  `docs/spec/SPEC.md` as the UI surface and had never been invoked from `src/`
  in any commit. The pre-rewrite `wordscript/ipc.py` documents the Tauri →
  Python channel as `start_recording` / `stop_recording` / `abort_recording`:
  the sidecar owned the session state in another process, so the host had to
  drive it from outside. `febc452` carried that command set across and, in the
  same commit, moved trigger, capture and pipeline into the Rust process — so
  the caller became `start_from_native`, `processing_from_native` and
  `complete_processing_session`, which are untouched. `abort_native_session`
  stays, because abort is the one lifecycle transition a user makes.
  `complete_current_transcription` goes with its only caller: it completed
  whichever session happened to be processing instead of the one the result
  belongs to, and the command emitted only `wordscript-native-event`, so any
  caller would have left the overlay in `processing` until ADR 0018's fallback
  fired. `cargo test` unchanged at 740, `cargo check` unchanged at 15 warnings —
  a `pub` item with no user compiles silently, which is why a sweep is the only
  instrument.

- **Six registered Tauri commands that no caller ever reached** (ADR 0089). A
  sweep of the whole `invoke_handler` list against every `invoke(` in `src/`
  found fourteen caller-less commands, not the two the leg was sent for, so they
  are triaged by *why* they lost a caller rather than by whether they have one.
  Removed as superseded: `acknowledge_profile_health_flag` and
  `unacknowledge_profile_health_flag` (the config seam performs that write since
  ADR 0085, and neither took an `AppHandle`, so neither could emit `ready` — a
  second window would never have learned), `get_workspace_context`,
  `app_config_file_path`, `resize_overlay_to_height` and `resize_edit_overlay`,
  plus the five `OVERLAY_EDIT_MODE_*` clamp constants that existed only to bound
  the last two. The resize pair is why this class goes rather than being
  tolerated: it is the dynamic overlay sizing path this codebase deliberately
  abandoned, and leaving it registered keeps a route back into the ghosting in
  `docs/known-issues/overlay-ghosting.md`.

  **Kept rather than deleted, and now listed:** `preview_prompt_enhance` (ADR
  0065 defers it to Phase 8 explicitly), `export_text_rules` and
  `import_text_rules` (complete runtimes whose UI went with Leg 3's overwrite
  and which nothing replaced — a lost capability, not a corpse), and the session
  command shells (`start_native_session`, `stop_native_session`,
  `native_session_status`, `complete_native_session`) plus
  `transcribe_audio_file`, whose functions the Rust pipeline drives directly.

  **Both kept-and-listed entries were settled by Leg 10 the same day**, in
  opposite directions: the text-rules pair got its surface (ADR 0090) and the
  four session commands were removed as sidecar residue (ADR 0091). What
  separated them was not whether they had a caller — neither did — but *why*,
  which is the question ADR 0089 exists to ask. `transcribe_audio_file` remains
  in this class: its function has live Rust callers and only the registration is
  unreached.

  Corrects Leg 8's premise while keeping its rule: `PromptsTab.tsx` never called
  the acknowledge commands — it held acknowledgements in React state and passed
  them to `get_profile_health` as a request field. No commit in the
  repository's history invoked either from `src/`.

### Changed

- **Profiles is wired and has left the gallery** (ADR 0057, ADR 0085). Every
  fact on the screen has a source now, so `runtime` is required, the drawn
  branch and its sample rows are gone, its banner and its gallery entry went in
  the same commit, and `npm run port:diff` measures 25 screens instead of 26 —
  all 25 at structural 0 | style 0. The two departures the screen carried,
  ADR 0068's sixth sub-tab and ADR 0082's create control, are settled rather
  than carried. Its five fidelity cases moved into the wired suite re-expressed
  against a config rather than being dropped.
- **The style meters wait for the runtime's bound instead of falling back to a
  copy of it.** They fell back to a `400` duplicated out of
  `core::communication_style`, which would have kept reading right on the day
  the runtime changed the budget.
- **Adding is `+` in the head of the list it adds to, everywhere** (ADR 0082).
  The product had three shapes for one job — a labelled button at the foot of
  the profile list, another at the foot of each rule card, and Context's `+` in
  a section head. Context's wins: it sits with the count it changes, at the top,
  and stays put while the list grows past the fold.
- **Deleting always asks, at the row.** A replacement or a snippet used to
  disappear on one click with no question while the profile containing it asked
  twice. Both are one press plus one confirmation now, and the panel focuses
  Cancel rather than the danger button. Deleting the active profile hands the
  session to the first one left; the last profile cannot be deleted at all.
- **What stays an icon on a row is only what you repeat positionally** — the
  reorder pair. Edit and Delete left the rule rows for the menu.

- **A capture reports the cadence of its own input stream** (ADR 0083). ADR 0079
  made a short capture say so; this says *how* it went short. `CallbackCadence`
  counts every cpal callback and every stretch over 200 ms in which the stream
  delivered nothing, and the stop writes one line per capture — healthy ones
  included, because 345 healthy captures are what made eight broken ones legible
  in the first place. Each gap carries **the number of samples the callback that
  ended it delivered**, which is what separates the three hypotheses in
  `capture-loses-half-the-recording.md`: an ordinary period on resume means the
  audio is gone (`stream_suspended`), a catch-up-sized one means it only arrived
  late (`late_delivery`), and **no gap at all on a capture that is still short**
  (`no_gaps_but_audio_missing`) means starvation — a positive finding the line
  names rather than reporting nothing unusual. Nothing is logged from the audio
  callback: the gaps accumulate in memory and flush at the stop, because writing
  a file from a realtime audio thread to report a dropout is a good way to cause
  the next one. A pause and a rebuild reset the cadence so an explained outage is
  not counted as the unexplained defect. **No real gap has been observed yet** —
  this instruments a hypothesis, it does not confirm one.
- **The input level is kept per transcription** (ADR 0083). Peak and mean were
  computed on every capture and kept only when the capture came back empty,
  which is the one case that already explains itself. `InputLevelSummary` gains
  `rms` / `rms_dbfs` and is persisted on the history record as `input_level`,
  and written to the runtime log on every capture. **The mean is the part that
  was missing**: a peak is set by one sample, so a cough sets it as well as
  speech does, and a dictation too quiet to transcribe can still report a
  healthy peak. It is what separates "the recogniser is wrong" from "the
  microphone is quiet", and the text cannot be asked. Reported and not acted on
  — `too_quiet` still reads the peak, whose thresholds were derived against it.
  `None` on older records and on a retry, which never touched a microphone.
- **The first genuine mishearing is in the regression corpus.**
  `recognizer_mishears_a_technical_term`: the owner said `tmux`, the recogniser
  produced `D-Max`, and `applied_rules` carries `overlay_edit` — so the ground
  truth is his own retyped word rather than a guess. It is neither of the two
  identified causes, which is the gap `transcription-accuracy.md` names as its
  open headline. The entry asserts that all three stages which could touch it
  decline: the echo strip, the address repair, and vocabulary learning — the
  last because `tmux` is four characters and `MIN_CANDIDATE_CHARS` is five, so
  the one mechanism that would stop this recurring cannot reach a term this
  short. Recorded as a measured limit with a named cost, not lowered on one case.
- **A capture states how much of its own clock it kept** (ADR 0079). Between
  12 % and 55 % of the audio of some recordings is never captured and nothing
  said so: re-measured 2026-08-10 over 634 paired captures, **11 are short and
  the worst — 54.6 % of a 214 s dictation — is the most recent**, its transcript
  reading as a finished piece of German at a third of the expected density.
  `CaptureIntegrity` compares the untrimmed buffer against the effective wall
  clock and travels with the capture to three places: the runtime log on every
  capture including discarded ones, the history record (an `Audio missing` badge
  and a sentence in the raw panel), and a tab beside the result pill **at
  delivery time**, while the text is still in hand. The tab is a statement and
  not a control — audio that was never captured cannot be recovered, and a
  button there would be an offer the runtime cannot keep. Threshold 10 %,
  derived from a gap in the data running from 7.0 % to 12.0 %; nothing under two
  seconds is judged, and `not_measured` is kept distinct from `intact`.
- **WordScript removes its own initial prompt from the transcript** (ADR 0080).
  Whisper echoes the prompt it is given back as if it had been spoken —
  12.5 % of raw transcripts, 6.6 % delivered still carrying it — and on
  2026-08-10 one such sentence reached an agent **as an instruction and was
  followed**. The strip removes an echo of the prompt *this request sent*,
  carried from the request rather than rebuilt. Matching is a normalised
  in-order subsequence because the echo turned out to be a paraphrase, and the
  unit is the sentence, which is what separates a leak from the owner quoting
  the leak. It never restores the displaced words: a wholly-echoed transcript
  comes back empty, and `raw_transcript` deliberately keeps the leak so the rate
  stays measurable.
- **A pluralized form of address is restored to the singular** (ADR 0081).
  `fix das bitte` shipped as `fixt das bitte`. The obvious suffix rule was
  measured first and rejected — it flags 45 tokens in 31 of 136 records of which
  3 are the defect — so the repair reads grammatical **mood**: clause-initial
  verb from a closed table, not a question, no plural addressee, and a particle
  or `dir`/`dich` vouching for it. It is **German-only by declaration**, gated
  on the detected language, because the bare-stem/stem-plus-`-t` pair that is
  the defect exists in no other language WordScript dictates in.

- **Every transcript is a Markdown file, which is what the surface always said**
  (§11.23, ADR 0074). `core::transcript_store` writes one per record that
  produced text, under `~/WordScript/transcripts/<YYYY>/<MM>/<DD-HHMM>-<slug>.md`
  with the frontmatter the drawing specifies, from the one funnel every history
  record already passes through — so "on every path, including the timeout
  fallback" is structural rather than a rule five callers have to remember.
  `history.json` stays the index and carries the path. Delete, Clear and the
  retention sweep take the file with the entry, and the runtime removes only
  paths an entry named: a file you moved or added yourself is not its to delete.
  One file per transcript rather than one per day, so the runtime creates a file
  once and never edits one. Its **filename is a title the model writes**
  (ADR 0077) — two to six words in the transcript's own language, from the chat
  model already configured, so the folder can be scanned rather than only
  walked. The call is made after the text has reached the cursor, once, with a
  four-second timeout, and any failure falls back to the first words: the title
  decides what a file is called, never whether it exists.
- **`Show transcripts in file manager` acts, on all three surfaces it is drawn
  on** — History's row, Home's row and the command palette. The row reveals the
  record's own file; the palette reveals the folder, because that entry is about
  the collection. The only record that cannot is one that produced no text, and
  it says so on the control (ADR 0065).
- **Full export, Full import and Reset all settings** (`core::backup`). The
  export is the config, the history index and the transcript files as one
  archive — "everything local", which is a different thing from History's own
  Export of the index as JSON. Import and Reset copy the config aside before
  they replace anything and answer with where it went. The API key is not in an
  archive and the import says so: it lives in the OS secret store, which is the
  one thing about a machine that does not travel.
- **History's and Home's rows open with what the record is called** (ADR 0078).
  ADR 0070's `Written` / `Heard` segment gains a third reading, `Title`, and it
  is the default: a list of rows each opening with the first sentence of a
  dictation starts every line mid-thought and cannot be scanned. `Heard` stays,
  because the job it was added for — judging transcription accuracy across many
  records — has not gone away. Home draws the same records on the same builder
  and takes the same derivation, without the segment: five rows of the last few
  minutes is not the surface anybody scans. A record the model never named falls
  back to its own words.
- **Home's decision inbox receives a fallen-back delivery** (ADR 0044,
  ADR 0076). The one of its three sources the runtime can already ask about, and
  it draws nothing when nothing is owed — which is the drawing's own rule and
  the common case. Dismissing is recorded on the record, so a question answered
  once does not come back with the next launch. The desk (Phase 8) and a
  meeting's open questions (V2) still have no receiver and the banner says so.
- **The window follows the colour scheme** (§15.3). `window.theme()` answers
  `system` from the host rather than second-hand through the media query, and
  the window chrome moves with the choice — picking Light on a dark desktop was
  leaving a light workspace inside a dark title bar. The overlay is untouched:
  its pill owns a token capsule with one palette by design.

- **Translate is a processing mode you can select** (ADR 0041, ADR 0071).
  `ProcessingMode` gains a seventh value with its own prompt in
  `core::translate`, its own hotkey slot and its own place in the mode cycle. It
  is not a member of the cleanup family: the correction prompt forbids
  translating, so a translation cannot be that prompt with a flag on it. Auto
  never selects it and no communication style applies to it, both by decision
  rather than by omission. Its four settings — the target language, what happens
  when you already dictated in that language, the address form, and whether the
  profile's names and terms survive untranslated — were drawn on AI Models since
  the port and inert; they are live now, in the scope the drawing gives them.
  It ships ahead of its roadmap phase and therefore on the chat model the
  product already runs, which ADR 0071 records rather than leaves to be
  discovered. The target language and the profile-words switch are set on
  `Profiles → Defaults`, under the mode select that makes them apply, and only
  stated on AI Models with the `Per profile` tag as the door (ADR 0072) — the
  rule ADR 0068 had already set for the communication style.
- **The colour scheme survives a restart.** `AppConfig.color_scheme` is the
  config field the palette's three theme rows had been missing: they switched
  the window and persisted nothing, so every launch came back dark. `system`
  stays a deferral rather than a third palette (ADR 0048) — what lands on
  `<html data-theme>` is always the resolved value — and the shipped default is
  `dark`, which is what every window rendered before the field existed.
- **The style budget meters state what the prompt costs**, not what was typed.
  `analyze_communication_style` returns `core::communication_style`'s own
  `CommunicationStyleAnalysis` — what each of the two bounded fields accepted,
  what it dropped, and the characters the result actually spends. The meters
  used to count the characters in the textarea against two constants copied out
  of the runtime, which reads high whenever whitespace collapses, a rule repeats
  or a rule runs past 120 characters; a meter in the red could only ever mean
  "maybe". It now means the runtime really did drop something. The list of what
  was dropped is not drawn: the field's hint states the two rules a reader can
  act on and `REFERENCE.md` carries the rest.
- **The overlay names the target language** (ADR 0073). `Translate` is the one
  mode name that is half an instruction; the other half is two letters, drawn as
  their own chip beside the mode chip and only while that mode is running. A
  press steps through the languages and persists the step. It is inside the
  pill rather than a third side tab, because every offered language has a
  two-letter code — the width is fixed rather than content-dependent, which is
  what makes it affordable in a window whose rounded ends clip past 480px. The
  gallery's overlay cycle grew Translate with it, so the chip is reachable
  without making a recording.
- **The seventh mode ships with no hotkey**, and that is stated rather than
  papered over with `Alt+7`: the shipped defaults occupy `Alt+1` through
  `Alt+6`. The row on Hotkeys is settable like the other six and empty until
  somebody sets it.
- **The communication style has a surface for the first time.** Relay Leg 4d,
  ADR 0068: a sixth profile tab `Style`, in second position, carrying one card —
  the register with its six levels, the length, your rules and a writing sample,
  each free-text field with the budget meter the runtime's own bounds imply.
  `core::communication_style` has been running the whole time and `transform`,
  `agent` and `capture` all consume it, while the prototype pointed at the
  profile for it three times and never drew it. On this machine one of six
  profiles carried `register: quick` with 256 characters of style rules, applied
  to every Rewrite and invisible — which is the exact defect ADR 0023 was
  written against. Nothing in the runtime changed: no Rust, no migration, no new
  field. The `Where each list lands` legend gains a fifth row that states the
  style's narrow scope — Rewrite and the assistant — once, in one place.
- **The search field and the command palette behind it.** `NavSearch` was ported
  in Leg 2 and stood in no window for three legs, because it opens a palette the
  port did not carry. Both sidebars now mount it, as the prototype does, and
  `Cmd`/`Ctrl`+`K` toggles the palette: thirty-one entries in three groups,
  prefix-then-word-start-then-substring ranking, match highlighting, keyboard
  selection that wraps, and a click outside or Escape to dismiss. Twenty-five of
  the entries navigate, the theme actions switch the scheme, and the three that
  act on a transcript ask the runtime whether there is one. What cannot act is
  drawn inert with the reason in the path column.
- **Help opens four addresses over its own row** (ADR 0069, replacing ADR 0066's
  centred modal): the site, Discord, GitHub, and the documentation, which is
  drawn and inert because it has no address yet. The row had been deliberately
  unmounted for three legs for exactly that reason — nothing behind it.
- **History switches which of a record's two texts its rows carry** (ADR 0070).
  `Written` stays the default and is the drawing unchanged; `Heard` retitles
  every row with the recogniser's own words, so the screen you go to in order to
  judge transcription accuracy can be scanned rather than opened fold by fold.
  It narrows nothing and moves no count.

### Fixed

- **The cleanup invention rate was counting three things that were not cleanup.**
  `measure_invented_tokens_in_shipped_corrections` excluded `agent` mode on the
  argument that it writes an artifact from an instruction, so every word of its
  output is new by construction — and that argument covers `translate` and
  `prompt_enhance` word for word, but neither was excluded. Snippet expansions
  were not on the deterministic allowlist although the harness's own doc comment
  claims they are. And a record the user had retyped in the overlay
  (`overlay_edit`) was credited to cleanup, which is the same false claim
  `apply_edited_preview_text` explicitly refuses to make about history. Together
  they reported **11 of 138 flagged (8.0 %)** where the corrected harness reports
  **7 of 135 (5.2 %)**; hand-read, 6 are real, so **4.4 % against the 6.1 % of
  2026-08-02 — which on 6 events against 12 is not a movement and is not
  reported as one.**
- **`shortfall_ratio` was unreadable on any paused capture** (ADR 0079). Pausing
  calls `Stream::pause`, which stops the cpal callback outright, so a paused
  capture emitted nothing and recorded nothing while its clock kept running —
  measured against the raw clock, every paused capture reported a shortfall by
  construction, on exactly the long dictations the metric exists for. Both
  accountings now measure against `effective_elapsed`. A stream rebuild also
  sets `paused` and is deliberately *not* excused: those samples are genuinely
  lost, and a metric that hides real loss is worse than no metric.
- **Retry was greyed out on every record that had succeeded.** The control
  disabled itself whenever `audio_path` was empty — but that is one of the
  runtime's two retry paths, not both: a record that still holds its raw
  transcript re-runs the transform and needs no capture at all. A successful run
  deletes its audio, so the entire set somebody would actually want to re-run
  after fixing a profile or changing a model was refusing, while the runtime
  would have re-run any of it. The screens now state the runtime's own rule, and
  the control is inert only where there is neither a transcript nor a recording.
  It matters more since ADR 0075, because a retry re-runs the record's mode.
- **A retried Agent, Prompt Enhance or Translate record re-runs its own mode**
  (ADR 0075). `retry_transcription_history_entry` called the cleanup family's
  transform for every entry, so three of the seven modes came back conservatively
  tidied instead of re-run — a defect that had been there for two of them since
  they shipped, invisible because a tidied instruction looks like a plausible
  answer. The mode dispatch moved out of the native pipeline's closure into
  `core::mode_router::apply_mode_transform`, where the retry can reach it, and
  the record grows `effective_mode` — what actually ran — because the stored work
  mode keeps `auto` for an Auto record and could not answer.

### Changed

- **The profile list's subline states the mode and one second fact.** It
  returned an identical string for all six profiles on this machine, because two
  of its three clauses could not vary — `recovery_behavior` has one value in the
  type, and the rewrite style is a lossy function of a mode the row was not
  showing. It now reads `Auto · Insert at cursor` or `Rewrite · Client register`:
  the mode, then the register where one is set and the delivery otherwise, which
  is what the prototype's three rows actually draw.
- **A sub-tab row wraps instead of running off its pane.** Leg 4c measured the
  profile's five sub-tabs clipping inside the detail column in WebKitGTK and
  ADR 0068 adds a sixth. An overflow would put a tab behind a scroll this
  surface draws no scrollbar for.

### Added

- **Every wireable surface now reads the runtime.** Relay Leg 4c, six more:
  **Hotkeys** is `native_trigger_status` per slot — the caps, the registration
  badge, the refusal sentence, the activation timings and this session's
  platform summary; the recorder that sets a shortcut releases and restores the
  OS grabs. **History** lists this machine's transcriptions with both filters
  going to the runtime's own query, and View raw, Retry, Restore to cursor,
  Copy, Delete and Export all act. **Profiles** reads and writes the selected
  profile end to end — mode, delivery, workspace context, both recording limits
  against the runtime's ceiling, the word list, the replacements and the
  snippets — and its Context tab is the first text field in the product.
  **AI Models** wires the Groq connection: the credential in the OS secret
  store with its preview, the account plan from `resolve_provider_tiers`, and
  the recording ceiling from the same command Profiles reads. **Home** states
  the trigger, what the activation mode actually does, which mode is effective
  now, and the last five records. **Privacy & Data** writes both retention rules
  and clears the history.
- **Anything the runtime cannot answer is inert and says why.** Not deleted and
  not left looking settable (ADR 0065): the three provider lanes and seven
  provider chips, `Show in file manager`, Add and Edit on the profile lists, the
  two `analyze_text_rules` doors, Full export, Full import, Reset all settings,
  and the seventh mode `ProcessingMode` does not have. Home's decision inbox is
  absent rather than inert, because its three sources have no receiver and the
  drawing's own rule is that nothing is drawn when nothing is owed.
- **ADR 0067** answers the point ADR 0065 left open: `local_preview` is treated
  like every other unpublished provider everywhere it comes up. A surface that
  offers it makes it inoperable, a surface that reports what is running states
  it and marks it, and a diagnostic prints the runtime identifier unchanged.
- **The first four settings surfaces read the runtime.** Relay Leg 4b:
  **About & Updates** states the running binary's version, copies it, and runs
  `check_app_update` — badge, the runtime's own summary and a Check now that
  re-runs it — plus four project links that open. **Diagnostics** is the
  `RebuildLabTab` the shell overwrite gave up, restored onto the ported drawing:
  the slice snapshot, a real capture-to-insert check with per-stage durations,
  the decoded transform rules and the buffered runtime log, on both of its
  mounts. **General** writes every field it draws — microphone, the four sound
  packs, cue volume, the launch signature, the overlay's placement, display and
  anchor, and the result overlay's dwell — lists the machine's real microphones
  and displays, and plays a cue through the runtime's own synthesiser.
  **Delivery & Insert** is `native_insertion_status` in full: platform, tier,
  readiness, strategy, the two-stage driver chain with each driver's real
  availability, and the scratchpad with a Clear that clears.
- **Two decisions taken against the drawn surfaces.** ADR 0065: Groq is the only
  provider WordScript integrates, and `AI Models` keeps every lane it draws with
  the other three disabled rather than deleted or left looking settable — a
  scope decision, not a capability claim. ADR 0066: the sidebar's `Help` row
  opens a small modal with Discord, GitHub and the documentation, which is what
  finally gives three legs' worth of deliberately unmounted row something to
  open.
- **The transform-rule vocabulary is back**, as `src/lib/transformRules.ts` — the
  forty-odd entries that know what `phrase_repetition_collapsed` means, so a
  Diagnostics screen read because something is wrong does not print runtime
  identifiers at the person reading it.

### Known gaps

- **The communication style has no surface and is still applied.** Register,
  length, style rules and a writing sample are per profile in the runtime
  (`core::communication_style`, ADR 0023) and every Rewrite and assistant run
  reads them — the pre-port surface had the controls, the prototype points at
  the profile for them three times, and the profile screen never drew them. A
  profile carrying a non-default register cannot be seen or changed in the
  product. Recorded in the relay's §2.5 and first on Leg 4d; where it goes is
  settled by ADR 0068 — a sixth profile tab, `Style`.
- **WordScript's own initial prompt is transcribed into the output.** The
  prefix sent to Whisper is echoed back as if spoken — at the start, the end or
  mid-text — displacing real speech, and cleanup keeps it because it is a
  well-formed sentence. Measured on 141 records: 15 % of raw transcripts carry
  it, 9 % are delivered still carrying it. Both prompt forms leak, so the
  ADR 0036 floor is not the only source. See
  `docs/known-issues/stt-prompt-leaks-into-the-transcript.md`.
- **Raw transcription accuracy is poor and unmeasured.** Dictated words come
  back as different words often enough that a dictated brief has to be re-read
  before it is trusted. Distinct from the hallucination record: a mishearing is
  fluent, grammatical and in register, so nothing downstream can see it. Nothing
  is measured yet — see `docs/known-issues/transcription-accuracy.md`.

### Fixed

- **Six controls could be disabled and did not look it.** A segment, a provider
  chip, a select, a text field, a hotkey target and a flag all took the
  attribute, refused the click, and rendered exactly as operable as their
  neighbours — so ADR 0065's inert lanes were not visibly inert. Found in the
  native host; every unit test asserting it had passed.
- **A history read could take the window down.** A runtime that answers
  `transcription_history_entries` with anything but a list has not answered, and
  is not a machine with no history.

### Changed

- **Typing no longer writes to disk on every keystroke.** A text field commits
  through a 400 ms debounce while the draft lands in the form immediately; a
  discrete control keeps instant save, and a discrete change flushes a pending
  text commit first so a late keystroke cannot revert it. (plan P1)
- **A view or a settings section you come back to is no longer rebuilt.** Every
  surface the user has actually opened stays mounted with the inactive ones
  hidden, each keeping its own scroll position. (plan P2)
- **The settings sheet's foot says "Every change applies as you make it." again**
  — derived from whether any section writes, rather than typed.

- **Six drawn surfaces got a decided lifecycle, and nothing was built for
  them.** Relay Leg 4a: how each is entered, what holds its state, what
  dismisses it, and what happens to it when the thing it is about ends —
  onboarding (ADR 0060), the agent overlay's three surfaces (ADR 0061), the
  handoff's effect-verb stage and its refusal counters (ADR 0062), meeting
  capture's four ways in (ADR 0063), and the live-translation window (ADR 0064).
  All six are still mounted nowhere, which is correct: five are Phase 6, Phase 8
  or a V2 candidate.
- **Three roadmap entries.** Meeting capture's first decision gate is closed;
  live subtitles and the live-translation window are new candidates, for the two
  surfaces that genuinely had no roadmap home. Live subtitles is the one of the
  six without an ADR — what turns captions on cannot be decided honestly before
  the capture that would carry the control exists, and saying so is the answer.
- **Detecting that a call is happening turns out to be cheap.** Read off the
  donor: watch which process holds the *microphone*, not which applications are
  running — the donor's own process detector is deliberately inert because an
  idle meeting app is a false positive. Noticing a call therefore needs none of
  the system-audio capture that blocks recording one (ADR 0063).

### Changed

- **The product is one window.** The settings window with fourteen flat areas is
  gone; the main window is the workspace — Home, History, Profiles, Context —
  and settings is a modal sheet laid over it at its own scale (plan §11.22),
  opened with `Cmd+,` / `Ctrl+,` and closed with Escape, the scrim or its close
  control. Ten sections in three groups, APP · AI · SYSTEM. The longest list
  anybody scans drops from 14 to 4. The fourteen areas were deleted in the same
  commit that replaced them, and nothing is aliased (ADR 0054).
- **The settings sheet carries its own scale, and not one component moved with
  it.** `.ws-modal-win` redeclares `--nav-w`, `--nav-row-h`, `--content-max`,
  `--content-pad`, `--pad-card`, `--row-py`, `--gap-block` and `--gap-row`;
  every screen inside reads them without knowing it has moved. The same screens
  stand in the gallery at the workspace's scale and still measure exact against
  the prototype there. That was ADR 0052's claim and this is the test of it.
- **The screens moved out of the gallery into `src/screens/`.** A screen in the
  gallery and the same screen in the product are one implementation with two
  sets of props (ADR 0055); leaving them under `windows/gallery/` would have
  made the gallery a dependency of the product, which is that rule inverted.
- **The pre-port shell is deleted.** `FormCard`, `FormRow`, `Sidebar` and
  `StatTiles` went with their last caller, and the `bodyClassName="py-4"`
  patches went with them — the ported card owns its own vertical inset (§11.17,
  ADR 0052) and the patches are the defect that rule exists to prevent. The
  unreferenced `.ws-sidebar-item`, `.ws-btn-primary` and `.ws-btn-secondary`
  utilities in `globals.css` went in the same commit.
- **The two base rules moved to the window root**, where the prototype has them.
  `svg { flex: none }` and the 16 px default icon size were fenced to
  `.ws-content` / `.ws-nav` while the pre-port areas still rendered lucide icons
  under their own assumptions; those areas are gone, so the fence came off onto
  `.ws-win` — which is now also the gallery's root.
- **The diagnostics pop-out mounts the same section the sheet does.**
  `RebuildLabTab` was the pre-port area and could not stay beside its
  replacement (ADR 0054), so the pop-out renders the ported Diagnostics screen.
  `WindowChrome` went with it: ADR 0003 leaves the title to the OS.

### Fixed

- **The overlay's deep link into settings had been resolving to nothing.**
  `SETTINGS_ANCHOR_AREAS` mapped `capture.auto_stop` to the area `input`, which
  had been renamed to `capture` — so the auto-stop tab opened the window onto a
  header with a blank pane under it. The mapping now names a surface as well as
  an id, resolves to Profiles → Defaults where §11.7 put the control, and
  `settingsAnchors.test.ts` fails if it ever stops naming something the
  workspace mounts.

### Added

- **The gallery is reachable in a built application** by
  `Ctrl`/`Cmd`+`Shift`+`Alt`+`G` (ADR 0059). Nothing names it and no affordance
  leads to it — ADR 0055's terms are unchanged. It replaces the temporary route
  edit and full rebuild that four legs paid for instead.

### Added

- **All 25 of the prototype's screens stand in `/gallery` → Screens, each
  measured exact.** Leg 2d took the last ten: Context with its four note tabs
  and both windows over it, the intake's three ways in, Actions & templates,
  meeting capture, the handoff, live subtitles, translation, client
  conversations and the agent overlay. Into the library with them: the note
  grammar (four tabs, the transcript with its timestamps and speaker chips, the
  derived lists that can carry one action each, the linked groups), the window
  family (Ask, Actions, the meeting HUD, the agent window and its
  notification), the folder rail, the intake and its two equal ways in, the
  shipped overlay pill drawn at its real geometry, the caption strip and the
  echo, the translation window with its per-language routing, and the client
  record with the document it ends in.
- **The prototype has turned from source into provenance (ADR 0057).** With the
  last screen standing, the gallery is the source: a disagreement between the
  two is either an ADR or a bug in the gallery. Relay rule 4b — read the
  prototype's builder before you build a screen — expired with the screens it
  applied to.
- **Fifteen of the prototype's 25 screens stand in `/gallery` → Screens.** Leg 2c
  added Notes & Meetings, AI Models, Onboarding and Agents — every tab and every
  one of onboarding's seven steps measured exact. Into the library with them:
  the job list (a row that opens into its own settings rather than navigating to
  them), the model badge that names where a job went, the downloadable model row
  with its size stated before the download, the onboarding rail, the desk's MCP
  readout and the agent thread.
- **The port's check can reach a screen's other states.** `npm run port:diff`
  now takes `models#1` and `onboarding#4`: it drives BOTH surfaces into the
  named sub-tab or wizard step with their own controls before measuring. Whole
  halves of three screens were previously taken on trust. It immediately found
  false positive the fifth — a transitioning colour measured mid-flight, which
  only the port shows because the prototype rebuilds its window wholesale on
  every render and so never transitions at all.
- **Eleven of the prototype's 25 screens stand in `/gallery` → Screens.** Leg 2b
  ported Home, History, Profiles, General, Hotkeys, Delivery & Insert, Privacy
  & Data, Diagnostics, About & Updates, Integrations and the withdrawn Live
  preview & commit, each measured exact against the running prototype. Into the
  library with them: the icon set (79 drawings, `demo.js`'s own — several exist
  nowhere else and each carries the record of which obvious glyph was
  rejected), the orb and its four states, the provider marks and their sprite,
  the list row and its unfolded raw panel, the decision inbox, the pane, the
  connection block, the runtime log and the raw-beside-transformed diff.
- **The port has a check, and it is committed.** `npm run port:diff <screen>…`
  opens the running prototype and the running gallery in one headless Chromium,
  walks both block trees and reports every structural and computed-style
  difference. Leg 2a described the same check as a hand-run selector list;
  writing it down turned up nine defects in the library that no screen showed
  on its own, four measurement false positives worth knowing about, and the one
  fact where the prototype disagrees with itself.
- **The settings sheet's own scale is ported (§11.22).** `.ws-sheet-scale` is a
  scope, not a density: the structure tokens are redeclared inside it and the
  type is not, so a settings screen is demonstrably drawn smaller than a
  workspace screen without one component knowing about it.
- **The controls the design system is made of are in the library.** Leg 2a of
  the GUI port relay ported `demo.css` §6, §3 and §4 into
  `src/components/shell/` and `src/styles/shell.css`: the button with its
  three-value primary material, the icon button, the switch, the segmented
  control, the pop-up button, the text field, the stepper, the slider, the level
  meter with its threshold mark, the key caps, the chips, the note, the check
  list, the action strip, the disclosure, the source list — plus the sidebar and
  content-column grammar Leg 3 builds the product's navigation on. Leg 1 built
  the eight primitives §5.3 names; these are the controls those primitives sit
  next to, and the Design System screen could not be ported without them.
- **The gallery's own pages are ported rather than composed.** Foundations,
  Components, Motion and the gallery window are read out of `SCREENS.ds` in
  `demo.js` — the prototype's sections, in its order, with its copy. Foundations
  gains *Rules this pass added*, the surface ramp and the contrast table, which
  the composed version did not have; Motion is the readout's own six-mode
  exhibit instead of a row of unlabelled swatches. Verified by diffing computed
  styles against the running prototype, property by property.
- **The frost pair is confirmed running in WebKitGTK.** Leg 1 could not settle
  it because no synthetic pointer event reaches the window under this
  compositor. Shown instead by rendering the pair in both states at once and
  capturing the native window: the layer behind is unreadable when frosted and
  crisp when not, so `filter: blur()` on the layer behind does what
  `backdrop-filter` could not (ADR 0051).

### Changed

- **A switch, a stepper and a slider are the prototype's, not a component
  library's.** The switch was a Radix `Switch` whose knob went dark when checked
  — a near-black disc on a saturated track, which reads as an orange slab with a
  hole in it rather than a knob that has travelled — and which measured its own
  thumb with a `ResizeObserver`. The stepper had an editable number field where
  the design has a readout, because a bounded value adjusted by one is two
  buttons and nothing else. The slider is now the prototype's drawing over a
  native `range`.
- **A segmented control is a group of pressed buttons, not a tablist.** A
  segment sets a value and reveals nothing; a sub-tab swaps the panel under it.
  The prototype draws the two differently on purpose and Leg 1 gave both the tab
  roles, which made every value control on the surface announce itself as
  navigation.
- **A gallery draws a live instrument at rest** (ADR 0058). The prototype
  animates its waveform and VU meter from a synthetic envelope because it has no
  microphone; the real components open one. A moving meter on a page that is
  measuring nothing is a claimed measurement, which is the fake readiness the
  runtime rules forbid.

- **The settings rework is in the product.** Leg 1 of the GUI port relay wrote
  the accepted prototype's design system into `src/`: the lifted palette, the
  radius ladder, the material, the type scale with its optical-size axis, frost,
  and three colour schemes. The shipped surface changes colour, shape and
  contrast with it. The prototype under `docs/prototypes/settings-rework/` stays
  the reference and is read-only from here (ADR 0055).
- **A gallery at `/gallery`, and it is where the port is judged.** One
  design-time route in the bundle, lazy, using no Tauri API and linked from no
  product surface: Foundations · Components · Motion · Overlay · Screens. It
  folds in `/overlay-gallery` and `/component-lab`, which are deleted rather
  than aliased. Foundations **measures** contrast and L\* off the live tokens at
  render time instead of printing stored figures, and re-measures when the
  scheme switches, so a number on that page cannot be true of a palette that has
  moved (ADR 0055).
- **Light, dark and system, in the product.** `system` is a deferral resolved
  against `prefers-color-scheme` and re-resolved when the OS changes, never a
  third palette; `<html data-theme>` always carries the resolved value. The
  light ladder is rebuilt rather than inverted — the window sits grey, the card
  is white and comes forward, the sidebar recedes below the window, the accent
  moves to `#b45c00`, and the material signal inverts from a top highlight to a
  warm downward shading (ADR 0048).
- **The eight primitives of the plan's §5.3.** `LaneCard`, `SubTabs`,
  `SectionHeader`, `PreviewBanner`, `EmptyState`, `DangerRow`, `Toolbar` and
  `ScopeTag`, with `Card`, `CardFooter`, `CardRows` and `Row` under them. Each
  reads `--pad-card`, `--row-py` and `--gap-row` rather than a spacing literal,
  which is what will let the settings sheet redeclare the scale in its own scope
  without a component knowing about it. 63 new tests.
- **Frost is a named surface class, and it is not `backdrop-filter`.** Measured
  in WebKitGTK 2.52.4, the engine the Tauri host loads: `backdrop-filter:
  blur(26px)` and the identical alpha with no blur produce the same stripe
  contrast to four decimals (0.0484 against an unoccluded 0.0858). The property
  is inert, `@supports` reports it as supported, and anything built on it looks
  correct in a Chromium preview and ships to Linux as flat translucency. Frost
  is `filter: blur()` on the layer behind, it is a pair rather than a plane
  (the panel goes translucent, the window recedes), and the receding layers
  nest. It applies only to a surface that floats and is transient — never a
  card, never the sidebar, never the overlay (ADR 0051).
- **Four features that had never been drawn.** A translation window with
  one-way and conversation modes and per-language audio routing — theirs out
  loud, yours in your ear, which is the part a phone cannot do because it has
  one speaker for two audiences. Live subtitles as the two separate features
  they actually are: captions over somebody else's audio, and an echo of your
  own voice under the dictation pill. Client conversations, reusing the meeting
  window with consent asked once per client (ADR 0045 is why it is not a second
  window). And the handoff screen finally drawing what crosses the line.
- **Provider chips on AI Models and in onboarding.** A wrapping row of brand
  marks replaces the select, shared through `providerPick()` so the two
  surfaces cannot drift.
- **The settings rework prototype got a typeface, three colour schemes and a
  search.** Archivo and IBM Plex Mono are now bundled as woff2 rather than
  named and never shipped — every judgement made about this surface before
  2026-08-03 was made in Noto Sans on Linux and Segoe on Windows. Light, dark
  and system schemes, with the light ladder rebuilt rather than inverted and
  the accent moved to `#b45c00`, which the identity value cannot substitute for
  on white (ADR 0048). `Cmd/Ctrl+K` opens a palette that searches screens,
  settings and actions, each row carrying the path it lives at (ADR 0050).
- **A component lab at the unrouted `/component-lab`.** The orb, the live
  waveform, the matrix field and the keycap as real React components on the
  shipped tokens, so a motion model is built once rather than in vanilla now
  and React later. Not linked from any product surface and wired to no runtime.
- **A live waveform where a microphone is actually judged.** The level bar
  reports one number as a length and cannot show whether a signal is steady or
  spiky, or whether peaks clip while the average sits far too low. It sits
  above the bar rather than replacing it — the bar carries the discard
  threshold, which is a boundary the runtime applies.
- **A long recording warns you before it stops itself.** In the last quarter of
  the auto-stop — at most two minutes before it — a small countdown appears
  beside the pill and turns urgent near zero. Tapping it opens the setting that
  owns the number. Recordings that never approach the limit never see it.
- **Three recording limits, each named after what it does.** *Stop after
  silence* reacts to you stopping. *Auto-stop* ends a recording that got long,
  early enough that it still goes through. *Processing limit* is the point past
  which nothing can be transcribed at all — it follows the provider, the account
  plan and the model, and Settings recommends keeping the auto-stop a safe
  distance under it (ADR 0038).
- **Account plan for the speech provider.** Groq's free and developer plans
  allow different upload sizes, and with them different recording lengths.
  Selecting the plan is what lets a paying account record to its real limit
  instead of the free one. Providers declare their own plans, so a lane without
  any (the local runtime) shows no control.
- **A failed recording can be retried from the audio.** A transcription that
  times out keeps its recording, and both the overlay's error surface and the
  history list offer a retry that re-transcribes it. Kept recordings are swept
  after seven days or twenty files (ADR 0039).

### Changed

- **The light scheme's muted step missed AA, and nobody had ever measured it.**
  `--fg-muted: #7d766d` computes to 4.48:1 on the white card — under 4.5:1 by
  two hundredths. The prototype's design-system screen prints the dark ladder's
  figures on both sides of its theme switch, so the light values had been chosen
  by eye against the dark ones' roles and never computed. It moves to `#7a736a`
  at 4.68:1, which is the dark side's own 4.71:1 rather than an arbitrary darker
  value. The other five light foregrounds are confirmed by the same measurement
  (ADR 0056, and ADR 0048 is the record that asked for it).
- **Every radius on the surface is now one of four.** `--r-window` 10,
  `--r-card` 8, `--r-control` 6, `--r-small` 4, assigned by what a thing *is*
  rather than by how big it is. The surface had twelve values and no rule, and a
  badge, a status tag, a segmented control, a sub-tab row and a chip were all
  capsules, so every label-shaped thing on screen was a pill. Capsules survive
  only where the object is physically one — a switch track, a level bar, an
  avatar, a status dot, a radio. The overlay keeps its own two radii and is
  untouched.
- **No scrollbar is drawn anywhere, and nothing replaces it.** Profiles showed
  five permanent rails at once. A scrollbar is a control you use twice a session
  and a border you look at continuously, and on a fixed-size desktop window there
  is no doubt about which region scrolls. The edge fade built as a replacement is
  not adopted: a static mask dims every scroller's first and last 20 px
  permanently, and the scroll-driven variant keeps the surface animating.
- **The window is one flat colour.** The two-layer viewport-fixed body gradient
  left with the palette — it was two literal dark hexes and could not be carried
  into the light scheme at all.
- **The focus ring is in the product, not only in the prototype.** It was
  `2px solid var(--accent)` at a 2 px offset, which detached it from its control
  and outweighed the primary action beside it. Now a 1.5 px saturated core flush
  to the control plus a wide low-alpha halo, with the core on `outline` so a
  control inside an `overflow: hidden` scroller keeps its ring.
- **`PermissionsArea.tsx` deleted.** Exported and imported by nothing, and its
  four cards were a strict subset of `InsertRecoveryArea`'s six.
- **The settings rework becomes a port, and the port overwrites.** `0.2.2-alpha`
  has no users, so the alias map and the coexisting-surfaces provisions in the
  plan have nobody to serve: a replaced area is now deleted in the commit that
  replaces it, and area ids are replaced rather than aliased. The semantic
  anchors in `src/lib/settingsAnchors.ts` survive, because the overlay's
  deep-link into `capture.auto_stop` is a runtime contract and not a habit. The
  decision expires at the first distributed build (ADR 0054).
- **The port is judged in a gallery, not against the shipped surface.** One
  design-time route `/gallery` — Foundations, Components, Motion, Overlay,
  Screens — absorbing the two unlinked routes that already exist
  (`/overlay-gallery`, `/component-lab`). A screen is *ported* when it stands in
  the gallery and *shipped* when it is wired, which is what lets a settled
  25-screen design land against a runtime that cannot yet answer half of it, and
  it gives the palette checkpoint a place to happen in WebKitGTK without the
  shipped surface having to change first (ADR 0055). The prototype at
  `docs/prototypes/settings-rework/` is read-only from 2026-08-04.
- **The work runs as a relay on `main`**, tracked in
  `docs/tracks/gui-port-relay.md`: six legs, each one session that ends
  green, pushes, records what it did and writes the prompt for the next. Two
  deliberate ordering corrections against the plan's stages — the design system
  lands before the screens, because the prototype had been patching four missing
  rules screen by screen; and P1 and P2 move out of the performance stage into
  the wiring leg, because wiring 25 screens onto a `patch()` that writes config
  on every keystroke would reproduce that fault 25 times.

### Fixed

- **The dot-matrix level readout drew as a 16 × 16 smudge.** The surface's own
  default icon size — the 16 px base rule ported by Leg 2c — captured the
  readout's `<svg>`, because a component that declares its box in `width` and
  `height` ATTRIBUTES loses to any stylesheet. The prototype hit exactly this
  and answered it with an inline style on the SVG it builds by hand; here the
  SVG is upstream's, so the answer is a rule beside the base rule. It was wrong
  everywhere a matrix was drawn, including the six on `/gallery` → Motion.
- **A card's rows and its body could be the wrong way round, and were, three
  times.** The prototype's `card()` renders head, then ROWS, then BODY, then
  foot; `Card` took free children, so the order was the caller's and three
  separate call sites across three legs got it backwards — visible only once
  the card's first/last-child edge rules drew an inset on the wrong side.
  `Card` now takes `body`, and the order cannot come out reversed.
- **A wide preview had no measure.** `.ws-content-inner[data-layout="wide"]`
  was `max-width: none` where the prototype caps it at 900 px, which would have
  let a 620 px window's preview column run to the width of whatever window it
  was opened in. Handoff is the first screen that asks for the layout.
- **Every icon in the ported shell was two pixels small wherever nothing sized
  it.** `demo.css` carries a second base rule — a default icon size of 16 px —
  which was never ported, and which beats a component's own declaration on
  specificity in the prototype exactly as it does here. Every icon Leg 2b drew
  sat under a more specific rule, so the gap only appeared when a screen finally
  drew one that did not: the provider mark inside a job badge.
- **Long recordings could not be transcribed at all.** The transcription budget
  capped the audio duration at 60 seconds before scaling, so an 11-minute
  recording was granted the same 35 seconds as a one-minute one and timed out
  twice. The pipeline watchdog was a fixed 120 seconds and could fire while the
  provider call was still legitimately running. Both now scale with the
  recording (ADR 0038).
- **A failed recording was deleted immediately.** The pipeline removed the
  capture on every path, the error path included, so a timeout destroyed the
  recording before the error finished rendering — and the existing retry needed
  a transcript a timeout never produces. Recoverable failures now keep their
  audio (ADR 0039).

### Added

- **Words & names fills itself.** You never had a chance of filling it by hand.
  To do that you would have to know in advance which words speech recognition
  will get wrong, and you only find that out in the second the text comes out
  wrong — a second you spend inside whatever you were doing, not inside
  Settings. So the list stayed empty and everything built on it was worth
  nothing.

  It learns from the correction that already happens. When the AI cleanup turns
  "cuber netties" into "Kubernetes", that is proof of three things at once:
  the recognizer cannot spell the word, the word is yours, and the sentence was
  enough to identify it. After the same word has been fixed twice, it is added
  to the profile. Correct a word yourself in the overlay before sending it and
  it is added straight away — you saw the wrong text and wrote the right one,
  and there is nothing left to confirm.

  Twice, not once, because the cleanup rephrases too and one near-miss can be a
  coincidence. Rewording, removed fillers, shortened sentences and capitalized
  first words are all ignored on purpose.

  This is not a detour through the AI to reach a result the AI already gave you.
  A learned word is repaired instantly and for free, with no model call, and it
  works in Verbatim where no AI runs at all. It also makes speech recognition
  get the word right in the first place, which no amount of fixing afterwards
  can do.

- **The overlay shows you the word it just learned.** A small tab slides out of
  the pill's left edge, names the word, and withdraws — under two seconds, once,
  with nothing to click and nothing to answer. On a wide pill, where there is no
  room for the word, you get the marker alone rather than a name cut in half.
  The full list lives in Settings -> Vocabulary. See ADR 0035.

- **A communication style per profile**, in Settings -> Modes, read by Agent and
  Rewrite. A register — Authority, Client, Colleague, Friend, Quick message —
  plus a length, your own rules, and a sample of your own writing. The register
  is named after who you are writing to rather than by a formality adjective,
  because four adjectives from one semantic field cannot be told apart in a
  select.

  **The register sets form, never wording.** Formality and youth language are
  different dimensions, and a model's own slang is measurably misaligned with how
  people actually use it — wrong slang reads as parody, where none merely reads
  as plain. So Friend and Quick message carry an explicit ban on the agent
  supplying slang from its own memory or translating it from another language;
  the only sources are your rules and your writing sample. A dated starter
  lexicon (German, English, Spanish, French) can be loaded into your rules, where
  you can read and edit it — never into a hidden layer.

  Precedence is fixed and written into the prompt: preset, then your rules, then
  your sample, with the sample subordinate for form and authoritative for
  wording. Default is off, at which every prompt is byte-identical to before.
  See ADR 0023.

### Changed

- **`DESIGN_SYSTEM.md` stopped contradicting the product.** Two rules went: the
  faux-glass rule that forbade blur outright, and the flat ban on
  `backdrop-filter`. The second is restated as what it is — a property that
  does nothing in the shipped engine and cannot be feature-guarded — rather
  than a style choice that was rejected. Frost takes its place as a surface
  class beside `--bg-base`, `--bg-surface` and `--bg-elevated`.
- **A group's separators run to its edge.** The item carries the horizontal
  inset and the stack spans the card, so a settings group reads as one object
  with divisions rather than as a container with contents (ADR 0052).
- **A level readout sits next to what it measures.** It leaves Home, which
  reported a room nobody was recording, and appears where the recording is
  happening. `wave(n, seed)` is deleted: a frozen bar row on a surface claiming
  to be listening is a fake state, and it stood in two of them (ADR 0053).

### Removed

- **Account & Sync.** There is no WordScript account and none is planned, so
  the surface that explained the absence is gone with it — a settings entry
  promises that a decision lives behind it. Where the data lives is Privacy &
  Data's sentence now; the fact that the accounts you hold are model vendors'
  is stated in About's list of what is not built. This is about the WordScript
  account only and says nothing about local or self-hosted models.
- **Six dead glass utilities.** `.glass`, `.glass-elevated`, `.glass-strong`,
  `.glass-subtle`, `.glass-panel` and `.ws-pill`, plus `--surface-glass` and
  the `glass` variants of `ui/card.tsx` and `ui/window.tsx`. All were
  `backdrop-filter`, none appeared in any markup, and the property does nothing
  in the shipped engine anyway (plan §5.3).

### Fixed

- **The agent window cut off its own answer strip.** It is fixed at 340 px with
  `overflow: hidden`, and two of its grid items kept the default
  `min-height: auto` — a grid item refuses to become shorter than its content,
  so 12 px went over the edge with no scrollbar and no mark: the rail's two
  buttons and the entire answer strip. The inner thread scroller could not help,
  because it only absorbs what the chain above it allows to shrink.
- **Rows inside an open job disclosure started on the wall of their own well.**
  They aligned with the summary's grid rather than with the summary's text, so
  every detail row sat 25 px left of the job it belonged to.

- **WordScript now identifies itself as SW forge everywhere, including to your
  operating system.** The rename from `SW-Bench` to `sw-forge-org` had only
  reached the interface. Underneath, the app still registered itself under the
  old name — and so did the entry your Groq API key is stored in, and the
  address the update check asks for a new release.

  Your saved API key moves with the rename. The first time WordScript starts
  after this update it finds the key under the old name, files it under the new
  one, removes the old copy and notes the move in the runtime log. You do not
  have to enter it again, and nothing about how it is stored changes: it stays
  in the operating system's secret store, never in a configuration file.

  **On macOS you have to grant microphone and accessibility permission once
  more.** macOS ties those grants to the application's identifier, so with a new
  identifier WordScript is a new application as far as the system is concerned.
  There is no way around it. Your settings, history and log are untouched — they
  were never tied to that identifier.

  On Windows, a build from before this change is not replaced by an in-place
  update but installed alongside; remove the old one by hand. This is exactly
  why the change happens now, while there is no public installer, rather than
  after one exists. See ADR 0037.

- **Which words go to speech recognition is no longer yours to pick, and that is
  the point.** The switch existed, and using it the obvious way did the wrong
  thing: you would switch on your most important words — the long product names
  — and those are exactly the ones that get repaired reliably afterwards anyway.
  The words that actually need the slot are the short ones. "Tauri" is five
  characters; once it has come back as "Tori" there is nothing left to work
  with, because no rule can tell those two apart without putting a word in your
  mouth. Operating the switch sensibly spent every slot on the words that needed
  it least.

  So the runtime allocates the few slots itself, shortest first, then by how
  often a word has actually been mangled. Each row says whether the recognizer
  is carrying it. The switch, the capacity counter and the reordering buttons
  are gone — there is no longer a decision behind them. Adding and removing a
  word by hand stays: a name you are about to start using has no dictation
  behind it to learn from.

  Everything in the list still reaches every AI mode and still gets repaired,
  exactly as before. See ADR 0035.

- **Three direction decisions are recorded; none of them is implemented.**
  Documentation only — no runtime behaviour changes with this entry, and the
  features below do not exist yet.

  **The mode formerly called `agent` carries out an instruction; it does not
  act** (ADR 0029). Text in, text out, one call, and no tool-calling surface —
  stated as a contract rather than left as a current limit, because "agent" now
  generally means something this mode deliberately is not. Side-effecting tools
  stay out of the dictation path: a tool loop has no single session end (ADR
  0018/0019), the delivery architecture presupposes a text result (ADR 0011a),
  and speech is a low-confidence channel that must not drive actions (ADR 0016).
  MCP splits into three questions — WordScript as a server is in scope, as a
  client in the dictation path is rejected, and as a vocabulary source is
  rejected as a distinct feature because it is the profile context with a remote
  origin. The mode will be **renamed to `draft`**, which says what comes out of
  it, and the name `Agents` goes to the settings area for coding agents; a
  config written by an older version keeps working. `docs/ROADMAP.md` and
  `docs/VISION.md` are corrected accordingly: they fenced MCP wholesale, which
  is now wrong in one direction.

  **Working with coding agents by voice is planned** (ADR 0030, ROADMAP Phase
  8): an agent asks you out loud when it needs a decision, and you start work by
  speaking instead of opening a repository. One configured orchestrator is the
  only party WordScript talks to — it drives the coding agents, answers what it
  can, and reaches you only for what it cannot. That is the whole point: an
  agent cannot judge what is worth interrupting a person for, and a voice channel
  without that filter would be worse than the terminal, because terminal output
  can be skimmed and speech cannot. The channel is built so a monologue cannot
  travel through it — one short spoken field, everything else silent in the
  thread. It shares capture and transcription and then returns the transcript to
  the caller rather than inserting it, so it is not a processing mode; the mode
  axis stays the transform axis (ADR 0020).

  That record was **revised on 2026-08-01**, before any of it was built, after
  every external claim in it was checked against primary sources. Two arguments
  turned out to rest on things that were not true — a client timeout that is
  documented nowhere and a specification change that never happened — and both
  were replaced; where a claim is only plausible, the word now appears. The
  revision also settles what the first version left open: the orchestrator may
  compose a question but returns your answer **verbatim**, because you can hear a
  wrongly put question and cannot see a wrongly relayed answer. Asking and waiting
  are split into two calls, so nothing ever blocks on a person. Everything
  configurable — model, permissions, profile — hangs on the target you set up
  once, so speech carries intent only and never configuration. Starting a run with
  write permissions is confirmed on screen with a key, never by voice. Questions
  are spoken one at a time, closed questions can be answered with one word, and a
  misheard answer is never forwarded to the agent as a guess. Voices are picked by
  how fast they start speaking rather than by price, and the measured value is
  shown to you. Bridge answers stay out of the transcript history and are not run
  through your text rules, which exist for text that lands in a document.

  **A voice nudge is planned as one shot on known text** (ADR 0031, ROADMAP
  Phase 9): revise what was just produced without dictating it again. The
  assumption going in was that conversational state was missing; no competitor
  ships multi-turn editing and one publicly retreated from it, so it is not
  built. Entry is explicit and never inferred, because inferring it is where
  shipped products break.

- **Every prompt is now written in English**, whatever language you dictate in.
  English instructions are followed more reliably. Each prompt states explicitly
  that the *output* language is the dictated one, so this does not change what
  comes back — the agent prompt forbids answering in the language of its own
  instructions, and the German `um`-is-a-preposition guard is unchanged because
  it is about the dictated language, not the prompt's.

### Fixed

- **Speech recognition was being sent nothing at all when your profile was
  empty, which is not the same as being sent nothing harmful.** With no words &
  names configured — the state almost everyone is in — the provider received no
  opening line whatsoever. That is not a neutral request: with nothing in front
  of it the decoder falls back on what it was trained on, and on quiet or
  garbled audio the nearest thing in that training is subtitles. It is where
  "Thank you for watching!" and "Untertitel im Auftrag des ZDF" come from in a
  recording that contains neither.

  It now always gets one short constant line that says nothing except what
  register this is: dictated notes, ordinary sentences, ordinary punctuation. No
  topic, no vocabulary, nothing that could come from your profile. The
  recognizer preview in Settings shows it, so the panel cannot keep claiming
  nothing is sent. If you switched the recognizer channel off, it stays off.
  See ADR 0036.

- **The AI cleanup no longer glues spelled-out letters into a fake product
  name.** Dictate a name the recognizer does not know and it sometimes writes it
  out letter by letter, getting the letters wrong: `c a u d e code` for
  "Claude Code". Cleanup then fused those letters into `CAUDE-Code` — capitalized
  and hyphenated, the exact shape of a real product name.

  The wrong letters were never the problem; the transcript was already broken.
  The problem is that you can see `c a u d e code` and fix it in a second,
  whereas `CAUDE-Code` looks deliberate and ships. The letters now go back in
  exactly as the recognizer left them.

  It repairs that one word rather than throwing away the correction, unlike the
  other guardrails: they discard the whole thing, which is right when the model
  answered your question instead of cleaning it, and wrong when a five-minute
  dictation is otherwise fine. That trade was decided by counting rather than by
  arguing — 12 of 197 real dictations, 6.1 %. Two related failures were measured
  and are **not** fixed: a garbled word being turned into a plausible different
  one, and a foreign word being translated. No rule that only sees the
  transcript can tell those apart from a correct repair. See ADR 0036 and
  `docs/known-issues/cleanup-invents-tokens-on-broken-input.md`.

- **Prompt Enhance never received your words & names.** Every other AI mode got
  them; this one had no channel for them at all, which made it the only mode
  that could respell your own product names — and the one whose output you paste
  straight into another tool. It gets them now, through the same bounded block
  the profile context uses.

- **Settings stopped teaching the habit it just removed, and stopped counting a
  field it no longer has.** The empty Replacements panel — the first thing you
  see there — still read "add the phrases Groq hears wrong", three lines under a
  description saying the opposite, and the note below advised one entry per way
  a word might be misheard. Both now point at Words & names, which is the list
  that needs no spoken form. "Profile details" also showed "STT hints: 0" next
  to a profile with terms in it: it was counting an old field the panel has not
  edited in a long time. It counts your words & names now.

- **The rule preview now runs the same passes your dictation does.** It built
  its pipeline without the vocabulary list, so the automatic repair never ran
  there — the panel that exists to show you what the rules do was showing a
  pipeline the app does not have. A repair also gets its own entry in the
  applied rules now ("Repaired: Kubernetes") instead of an unnamed one, which
  matters most for the one change you did not write down yourself.

- **Words & names now works, and misheard names no longer need you to guess.**
  Every term in the list reaches all AI modes as context — before, a term with
  its switch off reached nothing at all, anywhere, and even switched on it never
  reached Cleanup or Rewrite.

  Terms of seven characters or more are also repaired automatically. If you say
  "Kubernetes" and it comes back as "cuber netties", it gets fixed — without you
  writing that down first. This is the part Replacements structurally could not
  do: it needs to know the left-hand side, and the recognizer mangles a name
  differently every time, so there is nothing stable to write. Repair runs in
  every mode, including Verbatim where no AI touches your text, and every fix it
  makes is listed in the applied rules.

  It declines more than it could, on purpose. Short terms are left alone —
  "Tauri" and "Tori" are one character apart and no threshold tells them apart,
  so guessing would put a word in your mouth that you never said. Those rely on
  the AI stages, which can read the sentence.

  Replacements keeps its two columns but is now scoped to what it is actually
  good at: shorthand you say deliberately, like "KA" for "Kundenanfrage". The
  fields are named "What you say" and "What gets written" accordingly. See
  ADR 0033.

- **Each word says what it does, on its own row.** Speech recognition takes a
  small, fixed number of words, and everything beyond that used to be dropped
  without a trace. Now every row states whether the recognizer carries it and
  whether it is long enough to be repaired automatically, resolved from what the
  runtime actually did rather than from a rule the settings panel restates. See
  ADR 0034.

  *(The capacity counter and the reordering this entry originally described are
  gone again, unreleased, in the same cycle. Which words the recognizer carries
  is no longer yours to decide — see the learning entry above.)*

- **Profile context stops being judged by a filter it was never meant to
  reach.** The context field asks for topics — its own description says "topics,
  not spellings" — but the settings panel reported those topics as "not sent to
  the recognizer" and two warnings asked you to replace them with acronyms and
  product names. That advice was backwards. The recognizer conditions Whisper on
  literal words, so a topic cannot bias it; the field exists for the AI stages,
  where naming your domain is exactly what helps it pick `SLO` over `slow`.
  Individual terms have their own place in Words & names.

  The warning was not even true: the path it described had already been switched
  off, so nothing from this field was reaching the recognizer at all. It now
  reaches only the AI stages, and no surface reports a rejection that cannot
  happen. The recognizer preview shows what it actually sends — the words you
  switched on — next to what Replacements corrects afterwards.

  The included profiles are back to topics. They had been rewritten to spellings
  in May to satisfy that same filter, which is how `Product and engineering`
  came to read `API / SDK / SQL` instead of `platform constraints / release
  scope`. Every acronym in those lists was already a Replacement, so nothing is
  lost. If you edited the field yourself, it stays exactly as you left it — the
  migration only replaces the untouched original, character for character.

  Two documents described a profile that had not shipped since 25 May, because
  both read a developer's local config rather than the shipped one. The
  measurement behind ADR 0021 read the same file. Its safety conclusion stands;
  what it cannot support is any claim about profile context in general. See
  ADR 0032.

- **Agent mode writes the thing you asked for instead of answering you.**
  Reported from live use: "Hey WordScript, schreib eine E-Mail an Jürgen, er
  soll das und jenes machen" came back as "Ja, das sollte Jürgen auf jeden Fall
  machen … bis heute Abend um 8 Uhr" — a reply to the dictation, with a deadline
  nobody dictated.

  Every rule in the agent prompt was a negative one — no preamble, no invented
  facts, no profile content — and a conversational reply satisfies all of them.
  Nothing said what the output *is*, and nothing fixed the addressee, so with a
  transcript that is formally a message to an assistant the nearest addressee
  was the user. The prompt now opens with what it owes: the transcript is
  dictated speech and never a message to answer, the output is the artifact
  alone, the addressee is the person the instruction names, and an instruction
  that cannot be carried out comes back as plain text rather than a question.

  The Expansive length was the accelerant, not the cause: "spell out context and
  reasoning" is an invitation to narrate the task, and it now describes the
  result instead — develop the instruction's background and framing inside the
  result, never your own reasoning, never facts the instruction does not
  contain. That wording is shared with Rewrite, where it is the same defect
  under another name. See ADR 0026.

- **Switching the active profile during a recording is refused instead of
  half-applied.** The profile decides the recognizer settings, and those are
  committed the moment recording starts — but the pipeline resolved the profile
  again once the audio was ready. A mid-recording switch therefore produced a
  transform built from two profiles at once (label and terms from the new one,
  context and dictionary from the old) on top of a transcription that had
  already run under the old one. The runtime now refuses the switch, in both the
  explicit command and a settings save that would change it, and the switcher
  says why before you try.

  Alongside it, the agent name and the communication style moved into the
  capture snapshot, where the profile text and vocabulary already lived. One
  rule holds now: **during a recording only the processing mode still changes
  anything; everything else applies from the next recording.** Previously the
  agent name and style applied mid-recording while the profile text did not.
  See ADR 0025.

- **The processing mode in Settings and the mode on the overlay no longer drift
  apart.** Reported as: change the mode while recording and the overlay keeps
  showing the old one — sometimes. The "sometimes" was the clue. Two causes:

  A process-global runtime override was set by every mode-change path (overlay
  tap, mode hotkeys) and cleared by none — `clear_processing_mode_override` had
  no caller, because its only consumer was a hook nothing imported. It outranked
  the profile, so the first tap after a start pinned the mode for the rest of
  the process and every later change in Settings was resolved away. With no tap
  since launch it worked; after one tap it never did again. This was not only
  cosmetic: the pipeline reads the same resolver, so it also kept *processing*
  under the stale value.

  The override is gone. Every path that changes the mode already persists it to
  the profile, and the pipeline loads its config after the recording ends — so
  a mode changed mid-recording is on disk before it is read. The profile is now
  the only source.

  Second: saving in Settings emitted no mode signal at all, and the overlay's
  150 ms fetch guard *discarded* calls inside its window instead of deferring
  them, so a save landing in that window was lost with no retry. Every writer
  now emits `wordscript-mode-event`, and the guard coalesces to the last
  request. See ADR 0024.

- **Agent mode no longer writes profile context into what it generates.**
  Reported as: dictate "write an email to X, content Y" and the email comes back
  carrying material from the profile that was never dictated. Three causes in one
  prompt — only one of six context blocks carried any restriction, the system
  prompt actively said to "take the context into account" with nothing on the
  other side, and the whole block sat in the *user* turn one line above the
  instruction, where it was formally indistinguishable from it.

  The context stays, because it is what lets the agent spell your terms and names
  correctly. What changed is its job: it is a reading aid for the instruction, it
  moved into the system prompt behind an explicit prohibition on deriving content
  from it, and the user turn now carries the transcript and nothing else. Snippets
  contribute their trigger without their expansion — an expansion is finished text,
  and it was already applied deterministically at the end of the pipeline, so
  listing it was a second, generative path for the same data. See ADR 0023.

- **The agent name is visible in every mode.** It used to render only while Agent
  was the selected mode — but the name is also the first thing Auto routes on,
  and Auto is the default, so in the default configuration the field deciding
  whether Auto ever reaches Agent was not on screen. The name itself always
  worked; only the surface was missing. Its placeholder now shows the global
  fallback rather than a hardcoded "WordScript".

- **The overlay is no longer placed where no monitor is.** Reported as "the
  overlay becomes completely invisible mid-recording although the recording
  keeps running, and the stop hotkey brings it back". It was never a freeze:
  reveals only ever positioned the window on the hidden→visible transition, so a
  monitor topology change during a session left stale coordinates behind — and
  the union bounding box of a staggered multi-monitor layout has corners no
  monitor covers. Measured on the reporting machine: 18.3% of a 4320x1568 box is
  dark, and the overlay sat at (3840,1508), on nothing. Stop "fixed" it only
  because ending a session parks and hides the window, so the next reveal
  recomputed placement.

  A rectangle intersecting no monitor work area is now treated as a position the
  user cannot have chosen, and is corrected — on every reveal, and on a 2 s
  cadence inside the existing capture monitor loop, because a long recording
  produces no reveals at all. The drag-snap protection is unchanged for every
  position that is actually visible: the check uses intersection, so a pill
  hanging over an edge is left alone, and it reports nothing when no monitors
  can be enumerated (ADR 0022).

- **The end of a clipboard-only session no longer shows buttons that do
  nothing.** For 240 ms after a session ended, the leave hold replayed the
  preview surface from a snapshot with Copy, Edit and Abort wired to handlers
  that had already bailed on the nulled `pendingResult`. The buttons rendered
  fully enabled and correctly labelled, and did nothing — in `clipboard_only`,
  where that surface is the only route to the transcript, that reads as the app
  eating the dictation. The hold is now inert the way the edit-mode branch
  beside it already was, `handleEditOpen` got the guard it never had, and an
  absent handler renders the button disabled.

- **The overlay layer is visible in the runtime log.** Across 755 captures it
  previously carried zero lines about placement, park, monitor choice or work
  area, which is why a misplacement left nothing to read afterwards. Placement
  decisions, stranded-overlay rescues and parks (including the
  requested-vs-applied position, since X11/KWin clamps an off-screen park back
  onto the screen edge) are now recorded in every build.

- **The KWin overlay pin survives a screen change.** It was applied on
  `windowAdded` only, i.e. once per window lifetime, so an output
  reconfiguration silently dropped always-on-top for the rest of the session.

- **`cargo test` no longer writes into the developer's live data.**
  `core::paths::user_data_dir()` had no test seam and always resolved to the
  real `~/.config/WordScript`, so the suite appended its own lines to the real
  runtime log and wrote synthetic entries into the real history — corrupting
  exactly the evidence the runtime log exists to provide. Test builds are now
  diverted to a per-process temp directory, and a `WORDSCRIPT_DATA_DIR` override
  works in every build.

### Changed

- **Profile context now reaches every mode at the same width.** The same field,
  `TextProfile.prompt`, arrived in three different shapes: Cleanup and Rewrite
  pushed it through the *transcription* hint filter (a line survived only at ≤4
  words and with a capital, digit or punctuation in it), while Agent and Prompt
  Enhance took it raw, untruncated and uncapped. On the curated
  `Product and engineering` profile that meant 2 of 8 lines for Cleanup and all 8
  for Agent. The split was never decided — `git log -L` shows the filter arriving
  in `transform.rs` as a side effect of a commit about STT bias, two months
  before ADR 0017 documented the reasoning for the recognizer path it was
  actually built for. `core::profile_context` is now the single producer for all
  modes: normalized, deduplicated, 80 chars per line, and the block bounded by a
  600-character budget. The mode decides the framing — corrective for Cleanup and
  Rewrite, generative for Agent — never the width. The recognizer filter is
  untouched and stays recognizer-only (ADR 0021).

  Verified by replaying 96 real history transcripts twice through the production
  correction path (192 provider calls): widening Cleanup from 2 lines to 8 left
  74% of outputs identical, produced **zero** occurrences of the six previously
  dropped context lines, and did not increase divergence from the transcript.
  The change is safe and simplifying, not an improvement — recorded that way on
  purpose.

- **Agent's prompt is bounded.** Its dictionary, snippet and `stt_hints` blocks
  grew with the profile and had no cap; they now use the same limits as the
  correction prompt.

- **The context field is now called "Profile context", not "Transcription
  context".** The old name described the minority consumer: the field goes to
  every mode's transform prompt in full, and only a filtered subset reaches the
  recognizer. The card now shows how much of the 600-character budget the profile
  spends and names any line that exceeds it, because a bound the user cannot see
  is indistinguishable from a bug.

- **Two UI strings stopped overclaiming.** The Text Rules warning and the
  Profiles panel said broad context lines "are not forwarded automatically".
  That is true only of the recognizer, so both now say so and add that the lines
  still reach the transform prompt.

### Fixed

- **The recognizer preview showed an initial prompt the provider never
  received.** ADR 0017 made `use_as_prompt_hint` the single per-entry control
  over what reaches Whisper, and the capture path honours it
  (`prompt_hint_phrases`). The Settings panel did not: it sent the legacy
  `stt_hints` free-text field — which migration copies from but never clears —
  into `analyze_text_rules`. With every vocabulary toggle off, the panel
  displayed `Likely phrases: triage summary; release note; qa handoff; incident
  update` while the request carried no initial prompt at all, and flipping a
  toggle changed nothing on screen. `AnalyzeTextRulesRequest` now carries
  `vocabulary_hints` and the analysis derives the phrases the way the capture
  path does. Imported documents, which predate the per-entry opt-in, still fall
  back to the legacy field.

- **The Profiles tab stopped using three names for the same place.** The tab
  said "Vocabulary", its panel header said "Context & Preview", and the
  replacements card said "Personal dictionary" under a tab labelled
  "Replacements". Panel titles now match their tabs. "Step 1 of 4" is gone — the
  three lists are independent, not a sequence, and the fourth step it counted
  (Bias policy) stopped existing with ADR 0017. "Words & names" moved out of the
  "Profile context" card into its own, which is why the difference between a
  free-text topic list and a per-term recognizer opt-in was hard to see. A
  three-column note grid, a four-line paragraph on prompt length and a trailing
  note about team sharing were removed.

### Removed

- **The three "Cleanup settings" toggles, because none of them reached the
  runtime.** AI cleanup, Remove fillers and Rewrite phrasing sat in Settings ->
  Modes under a caption promising they applied to Cleanup and Rewrite.
  `effective_filter_fillers` and `effective_professionalize` took the stored value
  as an argument and opened with `let _ = fallback;`, deriving the result purely
  from the mode; the per-profile fields the UI wrote were dereferenced nowhere in
  the runtime. `post_process` was read and then overwritten per mode. Across 1586
  live correction calls only the three mode-derived flag combinations ever
  occurred — never one produced by a toggle. Two of the three were also redundant
  with the mode axis even had they worked: Cleanup with AI cleanup off is
  Verbatim, Cleanup with Rewrite phrasing on is Rewrite. The processing mode is
  now the only transform axis and each of the six modes is a fixed preset
  (ADR 0020).

### Fixed

- **The workspace-context toggle had no effect.** Settings wrote
  `ProfileModesSettings.auto_detect_mode` on the active profile while the runtime
  read the global `AppConfig.auto_detect_mode` at both of its call sites. Nothing
  connected them, so turning the switch off changed nothing. The runtime now reads
  the per-profile value, with the global as fallback for profiles predating the
  block. The key is renamed to `collect_workspace_context` because the context no
  longer applies only to Auto; the old key is accepted as an alias on both sides.
- **A manually chosen Agent mode could be overridden by the runtime.** After the
  mode resolved to Agent, the Agent branch ran the intent classifier a *second*
  time and, on "no", silently fell through to a cleanup — with flags derived from
  the profile's stored mode rather than the mode the session was running in. Intent
  is now classified only while resolving Auto, at one commit point; reaching the
  Agent branch is itself the decision.
- **The history re-transform mixed flag sources.** It took `post_process` from the
  global field and the other two from the profile, a combination no live session
  could produce. All three now come from one preset.
- **A profile could display a rewrite style it was not running.** `rewrite_style`
  was stored independently of `processing_mode`, and the live config held
  `"polished"` on a profile running `"auto"`. It is now derived from the mode.
- **The per-profile agent name was editable but never read** — the runtime always
  used the global one, so the name shown in Settings and the name the detection
  heuristic matched against could differ. The runtime now reads the profile value
  with the global as fallback.
- **Agent and Prompt Enhance ignored the profile's dictionary and snippets.** The
  text-rule stage sat inside `apply_native_transform`, and neither of those modes
  calls it — so a dictionary replacement the user configured simply did not happen
  there. Agent half hid it by listing dictionary and snippet entries in its prompt,
  which asks the model to honor them instead of applying them; Prompt Enhance did
  neither. Text rules are now a separate final stage
  (`transform::finalize_with_text_rules`) at the single pipeline exit, so every mode
  passes through them. Verbatim was never affected — that call already sat outside
  the `post_process` branch.
- **German `um` was exposed to filler stripping.** It is an English interjection
  and a German preposition, and appears as a preposition in real transcripts. The
  cleanup instruction now states that a filler is stripped only where it stands
  alone as an interjection, and names German `um` explicitly. Guarded by a
  regression-corpus case.

### Added

- **Workspace context reaches every mode**, not just Prompt Enhance: as a category
  signal in Auto routing and as exactly one bounded hint line in the cleanup,
  rewrite and agent prompts, carrying its own instruction never to derive content
  from it. It is detected once per session instead of twice on two paths. This is a
  new input into the correction prompt and therefore a new hallucination surface —
  bounded and corpus-guarded, but the first thing to check if cleanup output starts
  drifting toward the app it was dictated in.
- **An `expected_correction_prompt` block in the regression corpus** with a driver
  test. Prompt shape is the only lever the product has over the cleanup LLM, so the
  guards belong next to the transcripts they protect.
- **Auto routing invariants are enforced by test** rather than stated in prose:
  neither `verbatim` nor `rewrite` can be reached from Auto, and no mode can produce
  the `(filter_fillers=false, professionalize=true)` prompt arm.

### Changed

- **The agent instruction is a working file again instead of a growing
  archive.** `AGENTS.md` had reached 236 lines; a file loaded into context on
  every request costs tokens on every request, and the measured convention puts
  the useful ceiling at 100–150 lines, beyond which the hard rules get buried
  in the volume. It is now 132 lines. Three kinds of weight came out: a spec
  changelog that grew with every ADR (the same anti-pattern the project
  forbids for `ARCHITECTURE.md`), 51 lines of gotchas that were already
  documented in `docs/`, and two rules that had drifted into the file twice.
  No fact was dropped without its owning document being checked first — the
  overlay size and layer-cache invariants moved to `docs/REFERENCE.md`, the
  Windows `vendor/global-hotkey` patch rule to `docs/PLATFORMS.md`,
  `resolve_overlay_monitor` to
  `docs/known-issues/overlay-placement-persist.md`, and the spec drift date to
  `docs/spec/SPEC.md`, which now carries its own `Status:` line like every
  other document. The cpal 0.17 `SampleRate` note was retired outright: it
  described a migration that had already been completed in `capture.rs`.
- **The reference map says when to read a document, not only that it exists.**
  Shortening the file first went one step too far: the rule that the spec
  outranks the living overview docs on conflict was dropped because
  `docs/spec/SPEC.md` states it in its own header. That is the one place it
  cannot help — an agent that opens `ARCHITECTURE.md` first never learns it is
  outranked. Routing rules have to fire before a document is picked, so
  precedence and the append-only ADR rule are back in `AGENTS.md`, and the
  reference map gained a "before touching" column that names the code areas
  which should trigger each read. The separate gotchas list is gone: once the
  map carries triggers, it was a second routing table pointing at the same
  documents.

### Documentation

- **The Linux paste lane is documented by mechanism instead of by symptom.**
  `PLATFORMS.md` grouped `wtype`, `ydotool` and `enigo` under one reason — the
  KDE portal prompt. That is right for the first two and wrong for `enigo`, which
  is pulled with its default `x11rb` backend and drives input through the X11
  XTEST extension: on pure Wayland it is not skipped but inapplicable, and on
  hybrid XWayland it is the *same* request `xdotool` already made, which is why
  `paste_with_enigo` refuses while `xdotool` is in `PATH`. Stated plainly now:
  hybrid sessions have exactly one paste mechanism and pure Wayland has none, so
  a refused XTEST grant has nothing independent behind it. A second mechanism
  (libei) is filed in `ROADMAP.md` as a candidate with an open decision gate —
  deliberately not as scheduled work, because the reliability problem that
  motivated it measured clean (37 real pastes, zero portal denials) and is far
  better explained by the config revert above.
- **`cargo test` writes into the developer's real runtime log**, which cost one
  wrong analysis: 116 lines reading `xdotool blocked by portal ... Authorization
  denied` looked like a 30% XTEST failure rate and were all test fixtures. Real
  sessions have zero. Recorded with the discriminator (the elapsed offset in the
  line prefix) and the fix the repo already uses for `history.json` — a
  `#[cfg(test)]` path override — in
  `known-issues/rust-test-global-state-isolation.md`, whose status is corrected
  from "fixed" to one case still open.

### Fixed

- **The 1.5 s completion fallback no longer ends a session without a surface.**
  The fallback introduced with ADR 0018 set the session to idle but left
  `resultSurfaceOpen` untouched, so an authoritative transcription arriving
  after it flipped the result surface on one commit later — the exact
  two-commit gap ADR 0018 had removed, reachable again through the mechanism
  ADR 0018 added. The fallback now ends the session together with the surface
  that reports it, built from the transcript the native channel actually
  mirrored and with every field the authoritative event owns left null rather
  than guessed. A session that has already ended never has its surface
  re-decided: a late authoritative event updates the open surface in place
  instead of mounting a second one. ADR 0019.
- **A delivery-mode change on the processing preview forces a native repaint.**
  `previewClipboardOnly` swaps the preview's primary button between Copy and
  Insert and toggles `pill--clipboard`, but it only entered `pillVisualEpoch`
  for the result surface. The preview could therefore change its visual identity
  with no native repaint behind it, which on WebKitGTK is the condition under
  which the previous raster stays. ADR 0019.
- **A normalized `work_mode` is written back to disk instead of being
  recomputed forever.** `should_save` did not count a profile normalization, so
  the legacy `insert_behavior` token `"clipboard"` survived on disk and forced
  that profile to clipboard-only on every single load, regardless of what the
  user had selected — the reported "the delivery mode switches itself back".
  The P1 diagnostic recorded that correction 183 times across two runtime logs,
  which is the same statement as "never persisted". A canonical config still
  reports no rewrite, so this does not trade a silent revert for a config
  written on every load. ADR 0019,
  `docs/known-issues/insert-behavior-reverts.md`.
- **The edit surface keeps painting through its own fade.** The leave hold
  required the live `editText` to be non-empty, but a confirmed edit ends the
  session, the new result fires the interaction-reset effect, and that clears
  `editText` — so the surface was pulled out from under its own hold at the
  instant the fade started, measured in 4 of 5 edit closes. The hold now paints
  from a frozen frame captured while the surface was live, the same pattern the
  processing hold already used. ADR 0019.
- **The overlay diagnostics no longer lose lines silently, and no longer go
  quiet where they are being read.** `[ov-*]` output was one fire-and-forget
  `invoke` per line, and concurrent Tauri commands are not ordered against each
  other — so a missing `[ov-repaint]` next to its `[ov-sched]` was
  indistinguishable from an effect that never ran, which is the one distinction
  that log exists to make. Lines now carry a monotonic `#n` and are flushed on a
  microtask. Not `requestAnimationFrame`: WebKitGTK pauses that for the
  not-visible overlay, which buffered every line emitted during the leave until
  the next wake and made a healthy 243 ms transition read as a 258-second stall.
  The `[ov-beat]` heartbeat now also covers the leave window, so a suspended
  main thread there is observable instead of inferred.
- **The result overlay no longer stacks on a processing overlay that never went
  away.** A finished dictation is announced twice — first the native session
  mirror, then the authoritative transcription — as two IPC messages and
  therefore two React commits. The first one already flipped the session to
  idle, so for one render the session was over and no surface owned the pill:
  it unmounted, and on WebKitGTK that orphans the processing pill's compositor
  layers for the result surface to mount on top of. The native channel now only
  mirrors the transcript text; the session ends in exactly one commit, together
  with the surface that reports it, with a bounded 1.5 s fallback in case the
  authoritative event never arrives. Structurally exclusive to "Copy and insert
  at cursor" — "Copy to clipboard only" stops on the processing preview, which
  the leave hold already covered. ADR 0018,
  `docs/known-issues/overlay-ghosting.md`. The reported mode dependence (clean
  in `Auto`, visible in the other five processing modes) is a separate, still
  open axis; it is to be measured with the existing `[ov-*]` diagnostics.

- **Curated profiles no longer lose the delivery mode you chose.** Every profile
  except `General writing` delivered through the wrong pipeline: the overlay
  showed the auto-paste surface while the setting read "Copy to clipboard only".
  `refresh_unedited_curated_text_profile_metadata` reset `work_mode` from the
  shipped template on every save, and its "edited" signal — `curation.curated =
  false` — was only cleared by one of the three UI write paths. `General
  writing` is the one non-curated profile, which is exactly why it was the only
  one unaffected. The refresh now touches presentation only (audience, summary,
  highlights) and never behaviour, and the Modes and Insert & Recovery write
  paths detach a profile from its template like the Profiles tab already did.
  Requiring three call sites to remember one call was the same shape of defect
  as the transcription wiring gap below.

- **Text profiles now actually affect transcription.** Per-profile bias policy
  (`bias_mode`, `manual_bias`) and every local decode setting
  (`local_prompt_strength`, `local_prompt_carry`, `local_beam_size`,
  `local_best_of`, `local_profile`) were written to the config, rendered
  correctly in the Profiles preview, and then dropped before the provider call.
  `capture.rs` hand-built the `audio_ready` payload and `lib.rs` hand-parsed it
  back with per-key lookups; the two schemas had drifted, so every recording ran
  Conservative bias with preset decode defaults regardless of configuration. The
  capture config now crosses the boundary as one flattened value and
  `NativeCaptureConfig::resolve_transcription_request` is the only place a
  request is derived (ADR 0015). Configured profiles will visibly change
  transcripts for the first time — that is the fix, not a regression.

### Changed

- **Profile vocabulary is applied after transcription, not whispered into the
  recognizer** (ADR 0017). Copying vocabulary into Whisper's initial prompt is
  itself a documented cause of repetition loops and language drift, which is why
  the old bias path had to default to "conservative" — and why profiles felt
  like they did nothing. Dictionary terms now leave the prompt entirely
  (`apply_dictionary_entries` already replaced them deterministically, so the
  prompt copy was redundant risk), and the prompt caps drop from 896/480 to
  320/200 characters.
- The four Profiles panels become three: **Vocabulary** (context plus words &
  names), **Replacements** (the dictionary, renamed to what it does) and
  **Snippets**. The **Bias policy** panel is gone. `BiasMode` and its two
  `ManualBias` flags are replaced by a single per-entry "Hint the recognizer"
  toggle, off by default — the only question left is per word, and it is phrased
  as what it does rather than as what it is.
- `TextProfile.stt_hints` (a free-text blob governed by a profile-wide policy)
  becomes `vocabulary_hints: VocabularyHintEntry[]`, separating "teach a word"
  from "replace X with Y" the way Wispr Flow does. `TextProfile.schema_version`
  migrates existing profiles once on load; lines the hint filter would have
  rejected are logged rather than dropped silently, and Manual opt-ins are
  preserved per entry. `bias_mode` / `manual_bias` stay one release as
  migration-only remnants that nothing reads at runtime.

- **The default branch is now `main`.** The repository ran on `master` while
  `CONTRIBUTING.md`, `docs/RELEASE_RUNBOOK.md` and the `ref` inputs of both
  GitHub workflows already named `main` as the target ref. The branch was
  renamed rather than the documentation rewritten, which closes the mismatch in
  the direction of the wider convention. GitHub redirects the old name, so
  existing clones keep fetching; realign one with `git fetch --prune`,
  `git branch -m master main` and `git branch -u origin/main main`. Historical
  records in `docs/handoffs/` that name `master` stay unedited under the
  append-only documentation rule.

### Added

- A speech gate before transcription (ADR 0016). Leading and trailing silence is
  trimmed off the capture, and anything shorter than 200ms of remaining audio
  ends as `InputLevelVerdict::TooShort` with an explicit overlay message rather
  than a silent nothing. The threshold sits far below a real word ("Ja." runs
  400-600ms) because a swallowed dictation is worse than a filtered
  hallucination; `WORDSCRIPT_MIN_SPEECH_MS` overrides it for development.
- A confidence gate on the cloud lane (ADR 0016). The runtime asks for
  `verbose_json` again — it had been overridden to plain `json`, discarding
  Whisper's own per-segment metrics. `core::confidence_gate` drops a segment on
  `no_speech_prob > 0.6` combined with `avg_logprob < -1.0`, or on
  `compression_ratio > 2.4` alone.
- Capability-probed whisper.cpp hallucination controls on the local lane. The
  existing `whisper-cli --help` health probe now also reports which flags the
  installed build understands; `--max-context 0`, `--logprob-thold`,
  `--no-speech-thold` and the `--vad*` family are passed when supported and
  logged when skipped. VAD additionally needs a Silero model via
  `WORDSCRIPT_LOCAL_VAD_MODEL_PATH`. An unsupported flag never fails a run.
- A post-transcription detection stage (`core::hallucination_detect`, ADR 0016)
  that collapses character, word and phrase repetition and filters broadcaster
  subtitle boilerplate by pattern. The previous filter matched exact strings
  only, so it caught `"untertitel von"` as a whole output and missed
  `"Untertitelung des ZDF, 2020"` appended to a real sentence.
- An optional per-profile language pin (`language_locked`, off by default).
  It never makes a language mismatch sufficient on its own to discard text; it
  only lowers the corroboration the drift check requires from two independent
  signals to one. Speaking several languages inside one sentence — anglicisms in
  German, a quoted Spanish phrase in English — is legitimate transcription and
  is left untranslated and byte-identical either way, pinned by two corpus
  entries.
- Editing a transcript before it is delivered. The `clipboard_only` processing
  preview now carries an Edit action next to Copy and Abort — the one surface
  where the text has not left the app yet, so a correction there changes what
  actually gets delivered. Confirming goes through
  `commit_pending_transcription_preview` (new optional `text` argument) rather
  than a separate insert, so the delivered text, the completed session and the
  history entry can never describe different wording; the edit clears the
  machine-corrected flag and records an `overlay_edit` rule. Edit on the
  `auto_paste` result surface is unchanged in behaviour but honest in wording
  now: the button reads "Copy corrected text", because a text already pasted at
  the cursor cannot be retracted.
- Every `transcription` event carries `delivery` (`inserted` | `clipboard`) from
  the new `NativeInsertMode::delivery_label`. Previously only the `auto_paste`
  pipeline emitted it, so the commit and history-retry paths left the UI
  inferring what had happened to the text.
- Diagnostics for the overlay freeze reported during long captures
  (`docs/known-issues/overlay-recording-freeze.md`). Runtime log lines now carry
  an epoch-millisecond and a monotonic timestamp, overlay diagnostic lines carry
  the matching epoch stamp, and every capture records its `audio_level` emit
  accounting on stop (`expected` / `attempted` / `failed` / `shortfall_ratio` /
  `slowest_emit_ms`). A dev-only `[ov-beat]` main-thread heartbeat in the
  overlay reports intervals that land late. Together these separate a genuine
  freeze from the overlay legitimately not re-rendering during silence, which
  the previous telemetry could not distinguish.
- A complete audio-feedback rework (ADR 0010). Cues are synthesised from one
  G-major theme: a startup signature (G3 -> D4 -> G4) that every operational
  cue quotes a fragment of. New `Done` cue on a successful insert — the first
  audible confirmation that a round trip actually finished. Four selectable
  timbre packs (`timber`, `glass`, `air`, `tap`), a volume slider, a startup
  toggle and per-cue preview buttons in Settings. New config:
  `sound_volume`, `sound_pack`, `play_startup_sound`; new command
  `preview_sound_cue`.
- `cargo run --example audition_cues -- --out DIR [--sequence]` renders every
  pack and cue to WAV so the sound can be judged by ear without building the
  app.
- WordScript now names itself in the system volume mixer on Linux
  (`application.name=WordScript` via `PIPEWIRE_ALSA`, `PIPEWIRE_PROPS` and
  `PULSE_PROP`) instead of appearing twice as "PipeWire ALSA [wordscript]" —
  once for the sound cues and once for the microphone. `PIPEWIRE_ALSA` names
  the client object, which is what the KDE applet shows; `PIPEWIRE_PROPS` names
  the stream node, which is what the remembered volume is keyed on. PipeWire keys the remembered per-application volume
  on that name, so the system-mixer setting is now both findable and durable.
  Windows already names packaged builds from `productName`, and macOS has no
  per-application mixer to name.
- Microphone input-level diagnosis. A capture whose loudest moment never
  crosses the speech threshold used to be discarded in silence, so a microphone
  set too quietly was indistinguishable from a broken app. The runtime now
  measures peak and clipping across every capture and reports the verdict
  (`ok`, `too_quiet`, `silent`, `clipping`) with the measurement in dBFS and
  the next concrete step. Settings gained a live input meter with the speech
  threshold drawn in, under the microphone selector. Read-only throughout:
  WordScript never writes the OS input volume, which is per device rather than
  per application and shared with every other app on that microphone.
- A single Rust-owned shortcut contract (`core::shortcut`, ADR 0006) covering
  the token vocabulary, canonical storage form, human display strings and every
  validity rule. The UI no longer carries a key table: it reads the vocabulary
  from the runtime, so every token it can produce is registerable by
  construction. New commands: `validate_shortcut`, `shortcut_vocabulary`,
  `shortcut_platform`.
- Permanent structured trigger observability. Every received shortcut event,
  the decision taken (`start`, `stop`, `debounced`, `ignored_*`, `hold_start`,
  …), every registration and unregistration outcome and every stranded hold
  ended by the watchdog are logged to the runtime log under `[trigger]`, plus
  press/release counters per binding in `native_trigger_status`.
- Per-shortcut runtime truth in Settings: registered versus configured with a
  persistent reason when registration failed, observed press/release evidence,
  and a platform line naming the session type, the backend and the keys the
  desktop swallows.
- A hold-to-talk watchdog (`hold_watchdog_seconds`, default 120, `0` disables).
  A hold whose key release never arrives is ended explicitly with reason
  `native_hold_watchdog` instead of drifting into the silence timeout, and the
  activation-mode selector states whether a key release has actually been
  observed for the configured shortcut in this session.
- A per-session shortcut capability matrix (`shortcut_capabilities`, ADR 0007).
  `core::shortcut::capability_matrix` derives a state (`available`,
  `conditional`, `unavailable`) and a user-facing reason for every activation
  mode and key class, from the session facts plus the press/release evidence the
  trigger lane measured — never from a per-OS assumption about hold to talk.
  Settings gates the activation selector on it: an option this session cannot
  honor is unselectable with the reason stated, and a stored mode that becomes
  unavailable stays selected rather than being silently swapped.
- Modifier-only shortcuts are observed instead of grabbed (ADR 0009). A grab
  delivers the key to WordScript instead of the focused window, which is right for
  `Ctrl+F9` and wrong for `Ctrl+Super`: the combination was taken from every other
  application. Modifier-only shortcuts now go through XInput2 raw key events on
  Linux, which do not consume the keystroke. `validate_shortcut` reports which of
  the two mechanisms applies in `delivery`. The vendored `global-hotkey` crate
  carries the new observation path; Windows and macOS still need the same routing.
- A **single modifier** can be the capture trigger where the session supports it —
  double-tap Shift, or push-to-talk on one key, the idiom the mainstream dictation
  tools use. It rests on an `interrupted` flag the observation path now reports
  with each key edge: tap and double tap discard an interrupted edge, so `Shift`
  pressed to type a capital and `Ctrl+Alt` on the way to `Ctrl+Alt+T` no longer
  count as taps, while hold to talk ignores it and still ends on release. The
  two-modifier minimum became a session property rather than a fixed rule; where a
  platform cannot report interruption it still applies, and the stated reason names
  the missing signal. Linux reports it today; Windows and macOS do not yet.
- A cross-platform verification record for the shortcut lane
  (`docs/known-issues/cross-platform-shortcut-verification.md`): executable run
  sheets for Windows and macOS, the per-platform release mechanisms read from the
  vendored `global-hotkey` source, and an assessment of which questions a VM or a
  CI runner can answer instead of owned hardware. It records that the
  modifier-only capture defaults are expected to fail registration on macOS,
  because that platform implementation maps no modifier as a main key.
- A development-only key probe in the shortcut recorder that logs `event.code`,
  `event.key`, the modifier state and whether the code mapped to a registerable
  token, for diagnosing which keys a desktop actually delivers.
- Test coverage for the shortcut recorder (`HotkeyRecorder.test.tsx`), which
  previously had none and was mocked out wherever it would have been exercised.
- Repository documentation now follows the SW labs template: canonical
  `AGENTS.md` with `CLAUDE.md` symlink, `.editorconfig`, `.claude` examples,
  `.agents` guidance, contribution and security policies, staging guidance,
  GitHub issue and pull-request templates, and `.githooks/pre-commit` with
  secret scanning and legacy build-artifact cleanup.
- A lean consolidated product specification at `docs/spec/SPEC.md`, five
  initial ADRs, reference templates, an indexed living known-issues area, and
  a fully English documentation set.
- Permanent development-only overlay diagnostics: native DevTools and
  diagnostic-log commands plus a development settings panel and frontend event
  traces.
- Cross-platform CI repairs: `cpal` 0.17 and `rodio` 0.22 updates for
  Send-safe macOS capture streams, and the vendored Windows global-hotkey
  pointer fix for `windows-sys` 0.59.
- One-shot native capture-stream rebuild after a transient stream error, with
  format matching, runtime logging, and regression coverage.
- Persistent runtime-log diagnostics for capture error classification and
  selected audio device details.
- A KDE Plasma 6 KWin overlay-layer script and the
  `WORDSCRIPT_DISABLE_WEBKIT_COMPOSITING=1` hardware opt-out.
- Native provider capabilities, setup diagnostics, local `fast` and `quality`
  profiles, profile-bound decode and prompt-bias persistence, and a local
  runtime snapshot for Diagnostics and history.
- Profile work-mode contracts, typed insertion-recovery metadata, server-side
  history filters, JSON export, and a native capture/provider/transform/insert
  timeline.
- Text-profile STT hints, one-time persisted included profiles, a global active
  profile switcher, and a staged Text Rules workspace.
- Internal release build-up aggregation with platform archives, checksums,
  metadata, and optional maintainer draft releases.

### Changed

- Hold to talk is strictly momentary (ADR 0013). A press shorter than
  `hold_arm_ms` (300 ms, fixed) is now **discarded** — no session, no overlay, no
  cue, no history entry. The old `hold_min_ms` did not gate a hold, it extended
  one: a release below the threshold scheduled a deferred stop that fired once
  the recording had reached 300 ms, so every press produced a transcript and the
  hold duration changed nothing. The mode behaved like tap to toggle with a
  floor. The microphone still opens on the press edge and the audio is kept, so
  a hold that commits loses no word; what waits for the threshold is the
  session, not the stream. The listen cue therefore moves from the press to the
  commit, and the watchdog arms there too. No latch gesture was added, to hold
  or to tap: the two toggle modes already own latching, and a hybrid branch
  would make the three options overlap. The threshold gates all three
  capture-lane bindings — start/stop, pause and abort — the way the double-tap
  window already does. `NativeTriggerStatus.hold_min_ms` is renamed to
  `hold_arm_ms`; `TriggerEffect::DeferredStop` is removed and replaced by
  `StartCaptureProvisional`, `CommitHold`, `DiscardProvisional` and
  `DeferredHoldAction`. This also closes D11 in the known-issues record, which
  had hold to talk down as doing nothing at all: both edges arrive and both act,
  and the defect was in what they meant.

### Fixed

- The Windows and macOS builds were broken and had been for as long as the
  vendored `global-hotkey` patch has existed. Three `GlobalHotKeyEvent` literals
  were never updated when the patch added the `interrupted` field
  (`windows/mod.rs:165`, `macos/mod.rs:466` and `:519`), which is E0063 — a
  missing field in a struct literal. The patch had only ever been compiled on
  Linux. Fixed by supplying the contract-correct `false` at each site (press
  edge, grabbed real key, media key).
- Modifier-only shortcuts now exist on Windows. They previously registered and
  then never fired: the low-level hook returned early for every modifier virtual
  key, so a shortcut whose main key is itself a modifier never reached the
  matcher. The shared state machine behind it — held-modifier tracking, the
  exact-match rule, and what marks a held trigger interrupted — moved into a new
  platform-neutral `modifier_only` module with ten unit tests that compile and
  run on Linux, so the logic is checkable even though the target is not. Windows
  registers modifier main keys with the observer, feeds it every key event, and
  still passes modifier keys on rather than consuming them (ADR 0009). This also
  makes the release-edge pause/abort fix effective there, since `interrupted` is
  now computed rather than absent. The x11 backend is untouched: it is the
  reference implementation and the only one that has actually run.
  **Not compiled for Windows or macOS** — there is no cross toolchain on the
  development machine. `session_has_interruption_signal` therefore still returns
  false for Windows, so a single bare modifier stays rejected there until
  hardware confirms the signal. macOS remains unimplemented, with its
  requirements written into the known-issues record instead of guessed at in
  code, because `objc2-app-kit` could not be read to verify the API.
- Two ADRs filed on 2026-07-27 shared the number 0011 — the delivery-surface
  record and the mode-lane record. Both are accepted and neither could be
  withdrawn, so they gained a disambiguating suffix instead of a new number:
  `0011a-one-decision-surface-per-delivery-mode.md` and
  `0011b-the-mode-lane-sits-on-alt-not-on-ctrl.md`. Renumbering the second to
  the next free number was rejected because it breaks the "never renumber an
  existing ADR" rule and would silently send an older bare "ADR 0011" reference
  to the wrong record. Every citation across the docs now carries the letter;
  the reference audit was redone in the process and had been wrong about two of
  them. The next decision takes 0015.
- `cargo test` is reliably green again on a clean tree. Three tests mutated
  process-wide state and therefore raced their own siblings under the parallel
  default: two `core::runtime_log` tests cleared the shared ring buffer before
  recording into it, and the `core::workspace_context` pair set and removed the
  same `WORDSCRIPT_PROJECT_ROOT` variable. Measured at 2 failures in 22
  consecutive runs, load dependent, and always a false negative — the assertions
  and the code under test were correct. Both sites now assert through a seam
  rather than a lock: the ring-buffer tests compose `formatted_entry` and
  `push_bounded` against a local `VecDeque`, and the project-root tests call
  `resolve_configured_project_root` with the value they want instead of touching
  the environment. Serialising the suite was explicitly not the fix; the
  parallel default stays the normal case and `--test-threads=1` stays green.
  Two behaviours gained coverage on the way — ring-buffer eviction at the cap,
  and project-root resolution with no variable set — and `std::env::set_var` is
  gone from the test module ahead of the Rust 2024 edition bump.
- Reaching for `Ctrl+Alt+<key>` while dictating no longer discards the capture.
  The shipped abort default `Ctrl+Alt` is modifier-only, and pause and abort
  acted on its press edge — a moment at which the interruption signal cannot
  exist yet, because the third key has not been pressed. All three activation
  modes misfired: tap the instant both modifiers were down, double tap on the
  second such chord inside the window, hold once its arm timer passed
  `hold_arm_ms` underneath the still-held chord. Pause and abort now follow the
  rule start/stop already followed (ADR 0014): a modifier-only binding is decided
  at the release edge, and an interrupted chord acts on nothing and counts toward
  nothing. In hold mode the threshold is unchanged but measured at the release,
  because a timer that fires mid-hold fires before the interruption is knowable.
  A binding containing a real key — the shipped `Ctrl+Space` pause — is
  unaffected and still acts on the press. Fixing the default alone would not have
  helped: any modifier-only value a user assigns hits the same path.
- Holds taken in quick succession no longer strand the microphone. The
  provisional window is the one moment where a key is held without a session,
  and `sync_trigger_state_with_session` treated that as state to repair: it
  cleared `hotkey_active` on the next incoming event, the matching release was
  dropped as a release without a press, and the capture stayed open. The next
  press then failed with "A native audio capture is already active", the leftover
  stream produced "No speech detected", and an abort was needed to clear a
  session that already looked finished. The hold now carries an explicit
  `HoldPhase`, which the session sync leaves alone while it is provisional.
  Alongside it: a release is handled whenever a hold is in flight even if the
  held flag was lost, a failed provisional start cancels the hold so the arm
  timer cannot commit a session with no audio behind it, the capture monitor
  starts with the stream instead of with the session so no capture is ever
  unsupervised, and a monitor autostop that finds no session releases the device
  instead of returning and leaving it open.
- A hold pressed while the previous transcript is still processing is refused at
  the press edge (`ignored_processing`), the way tap mode already refused it,
  instead of opening a microphone for 300 ms and then failing the commit.
- The mode lane moved from `Ctrl` to `Alt` (ADR 0011b): mode select is `Alt+S`
  instead of `Ctrl+S`, and the six per-mode jumps are `Alt+1`-`Alt+6` instead of
  `Ctrl+1`-`Ctrl+6`. The old defaults were global grabs on **save** and on
  **browser tab switching** — the two reflexes a writing tool must not take
  away. One stored value covers every platform: macOS renders the lane as
  `Option+S` and `Option+1`-`Option+6`, Windows and Linux as `Alt+…`. Existing
  configs are migrated once (`SHORTCUT_SCHEMA_VERSION` 1 -> 2), per slot, and
  only where the slot still holds its untouched `Ctrl` default; an assigned
  shortcut, an empty (disabled) slot, and any slot whose new value is already
  taken are left alone.
- The overlay's dev-only per-render trace is now opt-in behind
  `VITE_WORDSCRIPT_OVERLAY_RENDER_TRACE=1` and runs in an effect rather than in
  the render body, and `read_diag_log` returns only the tail of the diagnostic
  log instead of the whole file. The panel polls that command every 500 ms while
  it is open, so the previous behaviour put an unbounded, session-length-
  dependent payload on the main thread — load heavy enough to be a candidate
  cause of the very stall the log exists to diagnose.
- Sound cues no longer open a fresh output device per cue. One stream, owned by
  a dedicated thread, is opened at startup and primed with silence, so cues no
  longer contend with the microphone device and are rendered at the real device
  sample rate instead of being resampled at playback time.
- `SoundCue::Start`/`Stop` became `Listen`/`Handoff`. `Handoff` fires when
  capture stops and is deliberately unresolved: at that point the pipeline is
  still running, so the old conclusive-sounding tone asserted a completion that
  had not happened.
- Documentation was audited against the active Rust, React, Tauri, workflow
  and packaging code. The spec now names the registered session commands,
  distinguishes Tauri channels from payload discriminators and internal UI
  actions, documents profile-bound mode resolution and its legacy fallback,
  automatic settings persistence, the 232px settings sidebar, visible
  preview-only More areas, the accepted overlay residuals and the actual
  Node.js engine requirement.
- Rust package metadata now matches the accepted AGPL-3.0 license and current
  SW forge repository. Bootstrap scripts reject Node.js versions unsupported
  by Vite 8.
- Rust/Tauri remains the runtime owner; React consumes typed native truth.
  Provider configuration uses consistent provider terminology and legacy Groq
  secret migration runs natively before configuration is saved.
- The local runtime now passes transcription context through `whisper-cli`,
  distinguishes `fast` from `quality`, records local prompt/decode/cleanup
  metadata, and conservatively falls back when local cleanup is unavailable.
- Linux insertion uses explicit native driver chains and desktop-aware portal
  diagnostics. Pure Wayland avoids privileged auto-paste attempts and uses
  clipboard-only recovery; KDE Plasma 6 and GNOME can request a persisted
  RemoteDesktop grant.
- Settings now use a calmer native-decorated utility shell with grouped
  navigation, profile context, one dominant content surface, and the same
  Diagnostics pop-out language.
- The overlay uses a compact fixed stage, real processing-time
  `clipboard_only` preview, native result actions, movement-threshold dragging,
  remembered user placement, and clearer speech waveform behavior.
- Linux WebKitGTK performance work enables GPU compositing by default, removes
  card shadows and backdrop filters, adds contained scroll surfaces, uses a
  fixed background gradient, and changes history refresh to five seconds.
- Overlay host behavior uses fixed 440x60 and 460x164 surfaces, XWayland by
  default, per-reveal background color updates, and native hide/parking.
- The universal CSS reset now belongs to Tailwind's `@layer base`; shared
  wordmark, spacing, tokens, and content-visibility utilities support the
  current shell.
- Documentation and About copy accurately distinguish internal build-up from
  published releases and defer broad workspace, sync, MCP, and assistant scope.

### Removed

- The active Python sidecar path, including build scripts, legacy package files,
  and obsolete configuration examples.
- Deprecated isolated settings prototypes and obsolete general-area
  placeholders; the visible Chat, Upload, Notes and Account layouts remain
  explicitly labeled previews. The inactive `show_tray_icon` runtime field and
  obsolete `rebuild-lab.css` were also removed.
- The old `hooks/pre-commit` location and regenerated legacy `BUILD_ID` and
  `build_info.json` behavior.

### Added

- A third activation mode, **double tap to toggle**: two taps within
  `double_tap_window_ms` (default 400) start or stop the capture, a single tap
  does nothing. This is what the mainstream dictation tools do — Wispr Flow
  double-taps right Shift, macOS Dictation double-taps Fn — and it exists for a
  concrete reason: a modifier-only trigger in tap mode acts on every single
  press, so `Ctrl+Alt` as the trigger also fires when the user meant
  `Ctrl+Alt+T`. Requiring two taps leaves the single press to the rest of the
  desktop. The gate covers start/stop, pause and abort, each with its own
  window; mode hotkeys stay single-press. Settings names the trade-off on both
  modes.

### Changed

- The reason a single bare modifier is rejected changed with the mechanism. It is
  no longer "it would be grabbed from every application" — with observation that is
  no longer true. It is that nothing distinguishes a deliberate tap of Shift from
  the Shift pressed to type a capital, and two of those inside the double-tap
  window is ordinary text entry. The stated reason says so, so the restriction does
  not read as arbitrary.
- **`double_tap` is now the default `activation_mode`** (ADR 0008), because the
  default capture triggers are modifier-only and in tap mode every single press
  of `Ctrl+Super` or `Ctrl+Alt` would act — taking that combination away from
  every other application. The default applies to a config that does not record
  an `activation_mode`; existing installations keep the value they have and no
  migration rewrites the field.
- New default shortcut rotation, identical on Linux, Windows and macOS:
  `Ctrl+Super` start/stop, `Ctrl+Space` pause, `Ctrl+Alt` abort, `Ctrl+S` mode
  select and `Ctrl+1`-`Ctrl+6` for the six processing modes. The per-OS
  branching is gone — divergent defaults are what let the legacy migration
  rewrite the Windows default on every save — and the set is asserted in tests
  to parse, register, not collide and survive normalization unchanged.

### Known issues

- The pause/abort interrupted-chord fix below is unobserved: neither the defect
  nor the fix has been seen in a running app, and on Windows and macOS the defect
  is untouched because those backends report no interruption signal at all.
  `docs/known-issues/pause-abort-interrupted-chord.md`.
- `cargo test` is not reliably green on a clean tree: two `core::runtime_log`
  tests and the `core::workspace_context` env-var pair mutate process globals
  and fail at random under parallel execution — 2 of 22 consecutive runs when
  measured. False negatives, not regressions;
  `docs/known-issues/rust-test-global-state-isolation.md`.
- Hold to talk does not work, observed live on a session where double tap on the
  same trigger does. Since double tap counts release edges that only follow a
  counted press edge, key delivery is ruled out and the fault is in the hold path
  or in what it starts. Narrowed to four candidates in
  `docs/known-issues/capture-shortcut-recording.md`, each of which names itself in
  the `[trigger]` log.

### Fixed

- Switching processing modes in the idle mode picker left the previous mode's
  pill painted underneath the new one. It looked like the compositor artifact
  accepted on 2026-07-20, but it was not: `dragSessionActiveRef` stayed true for
  the rest of the process after the first overlay drag, because the position
  persist handler cancelled the only timeout that ever ends a drag session.
  Both overlay layout effects bail on that ref, so from the first drag onwards
  the per-surface size sync and the visual-epoch repaint were dead — and the
  visual-epoch repaint is the only native repaint trigger for a change that
  keeps the same pill kind, such as a mode cycle. The grace timeout is now
  re-armed instead of cancelled, which keeps the long-drag persistence fix (K1)
  intact. See `docs/known-issues/overlay-drag-session-never-ends.md`.
- In "Copy and insert at cursor", the final result overlay could appear stacked
  on top of the previous overlay, which never went away. The visibility of the
  result surface was set in a React effect one render after the session ended,
  so a six-condition bridge predicate — reachable only on this delivery path —
  had to carry the pill across that render. When it did not hold, the pill
  unmounted for a frame and orphaned the processing pill's WebKitGTK compositor
  layers. The surface is now decided in the same reducer commit that ends the
  session (`RuntimeState.resultSurfaceOpen`), so the gap render no longer
  exists; the bridge, the commit-suppression ref and the sticky suppressed-result
  marker are gone. The overlay also emits a single surface value now, so the
  runtime is never told a different surface than the one being painted — that
  had been harmless only because every flat surface happens to be 480x60.
  (ADR 0011a)
- The "finished" cue in "Copy and insert at cursor" sounded before the result
  overlay appeared, and could fire for a result the runtime then discarded as
  stale. `Done` and `Error` were played from inside the insert helper, which
  three flows call at three different moments and always before their staleness
  gate. Cues now come from the session lifecycle, next to the event that tells
  the UI the same thing, so both delivery modes fire the same cue at the same
  meaning. `Handoff` moved into the branch that actually hands audio to the
  pipeline, after the capture teardown — an empty capture no longer announces
  work in progress and then contradicts itself. The insert-error arm that
  previously played no cue at all now reports one. (ADR 0012)
- Sound cues were sometimes swallowed entirely, started chopped, or fired
  twice. The per-cue device open could fail silently, the device was played
  before it had warmed up, and rapid cue chains overlapped acoustically. A
  failed abort also played `Abort` and then `Error` for one action; it now
  reports only the error.
- A per-mode hotkey now confirms itself on screen. The direct jump set the mode
  in the runtime but revealed nothing, so `Ctrl+1`-`Ctrl+6` looked dead while
  the mode had in fact changed. The overlay opens on the mode-select surface
  showing the new mode and auto-dismisses; it never starts a capture.
- Mode hotkeys changed in Settings are now actually re-registered.
  `configure_native_trigger` preserved them from in-memory state, so a new value
  was written to disk and the OS grab kept firing on the value from the last
  startup: mode select appeared dead no matter what you assigned, and configured
  versus registered disagreed silently.
- Shortcut recording is an explicitly ended state. It no longer commits on the
  first key release, so tapping `Ctrl` no longer writes `ctrl_l` and closes the
  recorder — the reason no further key could be added. The recorder accumulates
  the largest chord seen and requires confirmation.
- A single bare modifier can no longer be registered. It used to be expanded
  into a grab with no modifier at all, which consumed every `Ctrl` press
  desktop-wide and broke `Ctrl` shortcuts in other applications. Modifier-only
  shortcuts now require at least two modifiers.
- Opening a shortcut recorder now really releases the OS grabs, in Capture and
  in Modes. The previous soft pause left every shortcut grabbed, so the
  combination you already use was invisible to the recorder and could never be
  re-recorded; in Modes, pressing a live mode shortcut fired the mode action
  instead.
- Manual shortcut entry edits a local draft and only reaches the runtime on
  commit. Saving on every keystroke walked through intermediate values such as
  `c`, which are themselves valid single-key shortcuts and were registered as
  bare global grabs that then swallowed the very letters being typed.
- Persist-time normalization no longer truncates `Ctrl+Alt+Space`,
  `Ctrl+Super+Space` and `Ctrl+Cmd+Space`. The Windows default hotkey was
  rewritten to a modifier-only shortcut on every save. Legacy rewrites are now
  gated on `shortcut_schema_version` and run once.
- Clearing a shortcut disables it. An empty capture or mode shortcut used to be
  silently rewritten to the platform default, so a shortcut could not be turned
  off.
- Collision validation runs after normalization, not before, so two spellings of
  the same combination can no longer both pass validation and then collide on
  disk.
- A shortcut value that cannot be parsed is stored unchanged and surfaced as
  "not registerable" instead of being lowercased into something that can never
  register, with the failure visible only in a transient toast.
- The recorder accepts the runtime's full key vocabulary — arrows, numpad,
  punctuation, `Insert`/`Delete`/`Home`/`End`/`PageUp`/`PageDown`, `F13`+ — and
  `Escape` held together with a modifier is a chord member, so the default abort
  shortcut `Ctrl+Alt+Escape` can finally be recorded with the recorder that
  manages it.
- Shortcuts render as human strings (`Ctrl + F9`) in pills and summaries;
  raw tokens appear only behind the per-row "Enter manually" affordance.
- Pipeline watchdog and one transient provider retry prevent indefinite
  processing states and make failures visible in persistent logs.
- Native audio handling no longer retains a long-lived `rodio` output stream;
  capture errors terminate safely and buffer growth is capped.
- Duplicate session completion and insertion ownership errors are eliminated.
- Local provider slots, cleanup configuration, retries, profile history, and
  release status now reflect the native runtime contract.
- Linux portal-prompt classification, clipboard fallback, hotkeys, timeout
  handling, and recovery diagnostics now report actionable native truth.
- Overlay ghosting is blocked by opaque pill surfaces; clipboard-only commits
  preserve a safe processing hold instead of briefly mounting invalid result UI.
- Overlay placement persists only actual user drags, resolves monitor changes
  from stored logical placement, reapplies placement after reveal, and suppresses
  action clicks until a drag ends.
- Settings preserve native decorations and usable window minima; sidebar,
  provider selects, utility links, key-validation status, and normalized hotkeys
  behave consistently across supported hosts.

### Security

- Groq keys remain in the OS secret store and are scrubbed from saved JSON.
- Legacy JSON Groq keys migrate to the secret store before sanitized config is
  persisted.

## [0.2.0-alpha]

### Removed

- Debug code from `SettingsWindow.tsx` and `lib.rs`.

### Fixed

- Linux/Wayland startup no longer fails with GDK Error 71; transparent and
  undecorated paths fall back to XWayland where required.
- Overlay `show`, `hide`, and always-on-top crashes on Linux/Wayland were
  removed by using safer visibility and positioning behavior.
- Settings window visibility handling no longer crashes on Linux/Wayland.
- All platforms now use the unified user configuration path, restoring Groq
  configuration and transcription behavior.
- The IPv4 transport path prevents IPv6 connection timeouts from blocking Groq.

## [0.1.6-alpha]

### Fixed

- Groq API calls use forced IPv4 transport to avoid 20- to 60-second IPv6
  connection timeouts on every platform.
- Linux development mode starts the Python sidecar through the project root and
  its `.venv` rather than an uncontrolled system Python.

## [0.1.5-alpha]

### Fixed

- Linux Groq API calls use forced IPv4 transport when IPv6 fallback fails.
