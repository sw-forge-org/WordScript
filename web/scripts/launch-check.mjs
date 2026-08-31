/* THE GATE BETWEEN A BUILD AND A DEPLOY.
 *
 * `npm run deploy` builds, runs this, and only then calls wrangler. It is not
 * a linter and it does not run on `npm run build`: everything it checks is a
 * thing that is fine to have in a working tree and not fine to publish, and a
 * check that fires during ordinary development is a check people learn to
 * skip.
 *
 * WHAT IT IS FOR. The launch gate's own finding is that the defects which
 * reach production are not subtle: a phone number that is still `1234567`, a
 * `[[PLATZHALTER]]` nobody filled, an imprint citing a statute that was
 * repealed, a link to a dispute-resolution platform that was switched off. All
 * of them look finished. None of them survives a grep, which is why this is a
 * grep and not a review.
 *
 * IT RUNS AGAINST `dist/`, NOT AGAINST `src/`. What ships is the rendered
 * page. A string assembled from two variables is invisible to a source scan
 * and perfectly visible in the output, and the output is what somebody reads.
 *
 * WHAT IT CANNOT SEE is printed at the end rather than left out. Three of the
 * launch gate's requirements have no artefact in this repository -- a dashboard
 * switch, a legal review and a manual accessibility pass -- and a check that
 * silently omits them reads as "everything is covered" when it is not. */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const SRC = new URL('../src/', import.meta.url).pathname;
const FONTS = new URL('../public/fonts/', import.meta.url).pathname;

const failures = [];
const fail = (what, detail) => failures.push({ what, detail });

/** Is `path`, relative to web/, in the git index? `null` when git cannot
    answer -- no binary, or not a checkout -- which is reported rather than
    treated as a pass: the stronger of the two answers is the one that did not
    run. */
function gitTracks(path) {
  try {
    return execFileSync('git', ['ls-files', '--cached', '--', path], {
      cwd: new URL('../', import.meta.url).pathname, encoding: 'utf8',
    }).trim().length > 0;
  } catch {
    return null;
  }
}

/** Every file under a directory, filtered by extension. */
function walk(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(path);
  }
  return out;
}

const html = walk(DIST, ['.html']);
const emitted = walk(DIST, ['.html', '.js', '.txt', '.xml']);
const rel = (p) => p.slice(DIST.length);

if (html.length === 0) fail('no build', 'dist/ holds no HTML. Run the build first.');

/* ---- 1. and 2. moved, and the move is worth a line -----------------------
   Two checks used to stand here. Both belonged to an imprint this site served,
   and it does not serve one any more (ADR 0265).

   The second contact channel under section 5 DDG -- the notice that PHONE was
   null and the imprint therefore gave an email address and nothing else -- is
   now a question about the document at legal.sw-labs.de, and this repository
   cannot answer it. It is not silently dropped: it is the SW labs imprint's
   obligation, and it stops being checkable here rather than stopping being
   true.

   "The legal routes exist" is superseded rather than removed. It parsed
   src/lib/legal.ts for internal hrefs and asserted a built page for each. The
   pass further down does that against src/lib/routes.ts, and also asserts the
   noindex meta tag, the X-Robots-Tag rule, and the footer link for the route
   that is no longer a page. One check, more of the contract. */

/* ---- 3. the strings that must never ship -------------------------------
   Each pattern is a defect with a history, not a style preference. */
const BANNED = [
  [/\[\[[A-Z_]+\]\]/, 'an unfilled [[PLACEHOLDER]] from a legal template'],
  [/lorem ipsum/i, 'placeholder copy'],
  [/1234567/, 'the placeholder telephone number'],
  [/\bTMG\b/, 'a citation of the TMG, repealed on 2024-05-14 and replaced by the DDG'],
  [/\bTTDSG\b/, 'a citation of the TTDSG, renamed TDDDG in 2024'],
  [/ec\.europa\.eu\/consumers\/odr/, 'a link to the EU ODR platform, shut down on 2025-07-20 by Regulation (EU) 2024/3228'],
  [/Online[- ]Streitbeilegung/i, 'a reference to the shut-down EU ODR platform'],
  [/OS[- ]Plattform/i, 'a reference to the shut-down EU ODR platform'],
  [/Online Dispute Resolution platform/i, 'a reference to the shut-down EU ODR platform'],
];
/* WHY THE ODR FAMILY IS FOUR PATTERNS AND NOT A BARE `ODR`. Regulation (EU)
   2024/3228 took the platform down on 2025-07-20 and repealed the obligation to
   link it. The link is no longer merely useless: it points consumers at a dead
   service, which is itself attackable. Every German imprint template written
   before 2025 carries the sentence, so the check has to catch the sentence and
   not only the URL. A bare `\bODR\b` is deliberately absent: three letters
   that common in a built bundle would fire on something unrelated within a
   month, and a check that cries wolf gets switched off with every real rule
   still inside it. */
/* THE DEVELOPMENT-HOST PATTERN THAT IS NOT IN THAT LIST. `localhost`,
   `127.0.0.1` and `https://your-host` all appear in the built page on purpose:
   they are the credential shape the Self-hosted lane asks for, drawn as
   example copy in the engines section. A check that fires on them would be
   switched off within a week, and it would take the real rules with it. */
for (const file of emitted) {
  const text = readFileSync(file, 'utf8');
  for (const [pattern, why] of BANNED) {
    const hit = text.match(pattern);
    if (hit) fail(`${rel(file)}: ${why}`, `matched ${JSON.stringify(hit[0])}`);
  }
}

/* ---- 4. punctuation ----------------------------------------------------
   The page's own rule, checked here rather than by hand for the fourth time.
   The escaped forms are checked too: a curly apostrophe written as ’ in a
   source string is invisible to a scan for the character and reaches the page
   all the same. */
const PUNCT = [
  ['—', 'em dash'], ['–', 'en dash'], ['·', 'middle dot'],
  ['‘', 'curly quote'], ['’', 'curly quote'],
  ['“', 'curly quote'], ['”', 'curly quote'],
];
for (const file of emitted) {
  const text = readFileSync(file, 'utf8');
  for (const [ch, name] of PUNCT) {
    const escaped = `\\u${ch.codePointAt(0).toString(16).padStart(4, '0')}`;
    if (text.includes(ch)) fail(`${rel(file)}: ${name}`, 'the character itself');
    if (text.includes(escaped)) fail(`${rel(file)}: ${name}`, `written as ${escaped}`);
  }
}

/* ---- 5. the typefaces, and the question that replaced the old one -------
   THIS CHECK HAS ASKED THE WRONG QUESTION TWICE, AND BOTH ARE WORTH KEEPING.

   The first version looked for an OPEN marker in NOTICE.txt because the Zodiak
   licence text was not in the directory, on the assumption that every font
   licence works the way the SIL Open Font License does. It does not: the ITF
   Free Font License requires no text to travel with the font at all.

   The second version asked whether that font was committed, which was the
   right question while deploys ran from one machine and the wrong one the
   moment the site started building from the repository. A font the repository
   may not carry is a font the build cannot have. Zodiak was replaced by
   Fraunces for that reason and not for a typographic one (ADR 0259).

   SO THE QUESTION NOW IS THE ONE A CLONE ASKS. Every face the stylesheet
   declares has to be committed, because the build machine has nothing else,
   and every face has to have its licence text beside it, because OFL condition
   2 is what permits it to be there. Both are read out of the tree rather than
   listed here: a check with its own copy of the list passes while the list
   drifts. */
const faceBlocks = [...readFileSync(join(SRC, 'styles/globals.css'), 'utf8')
  .matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);

/* Files and families are counted separately and they are different numbers.
   A family can be declared once per cut -- Plex Mono is here twice, at 400 and
   500 -- so counting src urls to compare against licence texts reports a
   missing licence for a weight. The first version of this check did exactly
   that and failed a tree that was correct. */
const declared = [];
const families = new Set();
for (const block of faceBlocks) {
  const file = block.match(/url\('\/fonts\/([^']+\.woff2)'\)/);
  const family = block.match(/font-family\s*:\s*'([^']+)'/);
  if (file) declared.push(file[1]);
  if (family) families.add(family[1]);
}

if (declared.length === 0) {
  fail('fonts: nothing declared', 'No @font-face src was found in src/styles/globals.css.');
}

for (const file of declared) {
  try {
    statSync(join(FONTS, file));
  } catch {
    fail(
      `fonts: ${file} is declared and not in the tree`,
      'src/styles/globals.css asks for it and public/fonts/ does not have it. '
      + 'The build machine only has what is committed, so a face that is not '
      + 'here is a 404 on every page that draws it.',
    );
  }
  const tracked = gitTracks(`public/fonts/${file}`);
  if (tracked === false) {
    fail(
      `fonts: ${file} is not in version control`,
      'It renders here and it will not render on a build from the repository, '
      + 'because that build starts from a clone. Commit it, or replace the '
      + 'face with one whose licence permits committing it.',
    );
  }
}

/* The licence texts, checked as a set rather than per face: OFL condition 2
   asks that the notice travel with the font, and what discharges it is a text
   in this directory, not a particular file name. A face added without one is
   the failure this catches. */
const licences = readdirSync(FONTS).filter((n) => /^LICENSE-.*\.txt$/.test(n));
if (licences.length < families.size) {
  fail(
    'fonts: fewer licence texts than families',
    `public/fonts/ declares ${families.size} famil(y/ies) `
    + `(${[...families].join(', ')}) across ${declared.length} file(s), and `
    + `carries ${licences.length} LICENSE-*.txt file(s). OFL condition 2 `
    + 'permits redistribution provided each copy carries the copyright notice '
    + 'and the licence. NOTICE.txt names which face is under which.',
  );
}

if (readFileSync(join(FONTS, 'NOTICE.txt'), 'utf8').includes('OPEN:')) {
  fail(
    'fonts: NOTICE.txt has an open item',
    'public/fonts/NOTICE.txt carries an OPEN marker. Close it or remove it.',
  );
}

/* Said rather than passed over in silence. The tracked check is the one that
   speaks for the build machine, and it is also the one that can decline to
   run. */
if (declared.length && gitTracks(`public/fonts/${declared[0]}`) === null) {
  console.log('  note: git did not answer, the committed-font check did not run.');
}

/* ---- 6. the reach measurement and the page that describes it -----------
   THE DEFECT THIS EXISTS FOR SHIPPED. `/privacy` carried a full
   reach-measurement section -- what is processed, how it is hashed, six months
   of availability -- while no beacon was being served at all, because the site
   was written for Cloudflare's edge injection and that does not reach a
   Workers static-assets response. A legal page described a processing
   operation that was not happening.

   `src/lib/analytics.ts` now derives both surfaces from one token, so they
   cannot disagree by construction. This check is for the other way in: someone
   editing the built page, or editing one of the two `.astro` files by hand
   without the other. It reads `dist/`, because a claim assembled at build time
   is only visible in the output. */
const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
const privacyHtml = readFileSync(join(DIST, 'privacy', 'index.html'), 'utf8');
const beaconServed = /static\.cloudflareinsights\.com|data-cf-beacon/.test(indexHtml);
const measurementClaimed = /Reach measurement/.test(privacyHtml);

if (measurementClaimed && !beaconServed) {
  fail(
    'privacy: a reach measurement is described and none is running',
    '/privacy carries its Reach measurement section and the index serves no '
    + 'beacon. That is the exact defect this check was written for: a legal '
    + 'page describing processing that does not happen. Set BEACON_TOKEN in '
    + 'src/lib/analytics.ts, or let the section render itself away.',
  );
}
if (beaconServed && !measurementClaimed) {
  fail(
    'privacy: a beacon is served and the notice does not mention it',
    'The index loads the Web Analytics beacon and /privacy has no Reach '
    + 'measurement section. Processing that the notice does not describe is '
    + 'the harmful direction of this error, not the harmless one.',
  );
}

/* ---- the legal routes are off the index, in both places that say so ------
   Two surfaces carry the same directive and neither is a copy of a string in
   the other: `src/layouts/Legal.astro` emits the meta tag through the shell
   all three documents render through, and `public/_headers` sets the response
   header. ADR 0264 carries why, and why the redundancy is wanted: these pages
   carry personal data of the operator because sections 5 DDG and Article 13
   GDPR require the body to be named, and a directive that lives in one file
   only is one silent edit away from gone.

   Silent is the operative word. Losing it breaks nothing a build or a test
   would notice -- the page renders, the suite passes, and the finding arrives
   weeks later as a search result. So it is asserted here, against `dist/` for
   the markup and against the shipped `_headers` for the transport, with
   `LEGAL_ROUTES` as the one list both are measured against. */
const routesSource = readFileSync(join(SRC, 'lib/routes.ts'), 'utf8');

/* An `href` is either a string literal or a `const` declared above the list --
   the imprint is the second kind, because two pages name it in prose as well.
   Both forms are read, and identifiers are resolved against the module's own
   `export const NAME = '...'` declarations.

   THE COUNT IS CHECKED AGAINST THE LIST, AND THAT LINE IS THERE BECAUSE THIS
   PARSER ALREADY FAILED ONCE. An earlier version matched string literals only.
   The day the imprint's href became an identifier it silently matched one
   route fewer, `externalRoutes` came out empty, and the two checks that guard
   the imprint link passed by having nothing to look at. Both mutations aimed
   at them went green. A parser that reports less than it should is worse than
   one that throws, so the number of entries it resolved has to equal the
   number of entries in the list. */
const consts = Object.fromEntries(
  [...routesSource.matchAll(/export const (\w+) = '([^']+)'/g)].map((m) => [m[1], m[2]]),
);
const hrefs = [...routesSource.matchAll(/\{ href: (?:'([^']+)'|(\w+)), label:/g)];
const legalRoutes = hrefs.map((m) => m[1] ?? consts[m[2]]).filter(Boolean);
const declaredRoutes = (routesSource.match(/label: '/g) || []).length;

if (legalRoutes.length !== declaredRoutes || !declaredRoutes) {
  fail(
    'legal: LEGAL_ROUTES could not be read in full',
    `src/lib/routes.ts declares ${declaredRoutes} entries and this script resolved `
    + `${legalRoutes.length}. Every check below is scoped to what it resolved, `
    + 'so a short read silently narrows them instead of failing. Fix the '
    + 'parser or the list shape before trusting anything that follows.',
  );
}

const shippedHeaders = readFileSync(join(DIST, '_headers'), 'utf8');

/* An entry whose href starts with `/` is a page this site builds; anything
   else is absolute and points at another host. ../src/lib/routes carries why
   the shape is the marker. The external ones are checked further down, by a
   different rule, because a link and a page fail in different ways. */
const internalRoutes = legalRoutes.filter((r) => r.startsWith('/'));
const externalRoutes = legalRoutes.filter((r) => !r.startsWith('/'));

for (const route of internalRoutes) {
  const file = join(DIST, route.replace(/^\/|\/$/g, ''), 'index.html');
  let markup = '';
  try {
    markup = readFileSync(file, 'utf8');
  } catch {
    fail(
      `legal: ${route} is in LEGAL_ROUTES and was not built`,
      `The footer draws this route and ${rel(file)} does not exist. A link to `
      + 'a legal document that 404s is the launch blocker, whatever the robots '
      + 'directive says.',
    );
    continue;
  }
  if (!/<meta name="robots" content="noindex, follow">/.test(markup)) {
    fail(
      `legal: ${route} carries no noindex meta tag`,
      'src/layouts/Legal.astro passes `noindex` to Base.astro for every legal '
      + 'document. This page rendered without it, so either it stopped using '
      + 'that layout or the prop stopped being passed. ADR 0264.',
    );
  }
  /* The bare path, which is the exact URL that is served: `/imprint` without
     the slash is a 307 to it, and these routes have nothing underneath them.
     public/_headers carries the measurement that settled the splat. */
  const rule = new RegExp(`^${route}\\n  X-Robots-Tag: noindex, follow$`, 'm');
  if (!rule.test(shippedHeaders)) {
    fail(
      `legal: ${route} has no X-Robots-Tag rule in _headers`,
      'public/_headers must carry the bare path of every route in '
      + 'LEGAL_ROUTES with `X-Robots-Tag: noindex, follow`. A '
      + 'route added to the footer without one ships an indexable legal page, '
      + 'and these pages carry personal data of the operator. ADR 0264.',
    );
  }
}

/* The other direction, and the one a reader of the diff would not think of:
   a path noindexed in `_headers` that is no longer a legal route. Harmless on
   the day it happens and wrong the day that path becomes something else. */
for (const [, path] of shippedHeaders.matchAll(/^(\/[^\s*]*)\*?\n  X-Robots-Tag:/gm)) {
  if (!internalRoutes.includes(path)) {
    fail(
      `_headers: ${path} is noindexed and is not a legal route`,
      'Every X-Robots-Tag rule in public/_headers has to correspond to an '
      + 'entry in LEGAL_ROUTES. This one does not, so either the route was '
      + 'removed and the rule was left behind, or a page is being hidden from '
      + 'search without a record saying why.',
    );
  }
}

/* ---- the imprint is a link now, so the link is the obligation -------------
   Section 5 DDG asks for an imprint that is easily recognisable, directly
   accessible and permanently available. This site stopped serving one when the
   document moved to legal.sw-labs.de (ADR 0265), so what carries that duty
   here is a link in the footer -- and the footer is on every page.

   Which makes a missing link the single worst silent failure this site has.
   It breaks nothing: the page renders, the build passes, the tests pass, and
   the site is out of compliance on every route at once. So it is asserted on
   the built output, per page, and it blocks the deploy. */
for (const url of externalRoutes) {
  const missing = html.filter((f) => !readFileSync(f, 'utf8').includes(url));
  if (missing.length) {
    fail(
      `legal: ${missing.length} built page(s) do not link ${url}`,
      `${missing.map(rel).join(', ')}. The imprint is not served by this site; `
      + 'the footer link is what makes it reachable, and section 5 DDG asks '
      + 'for reachable from the telemedium rather than from one page of it. '
      + 'Check that Foot.astro still maps LEGAL_ROUTES and that every route '
      + 'renders the footer.',
    );
  }
}

/* The redirect that keeps the old URL working. `/imprint/` was live, linked
   and in the sitemap; without this file every bookmark and every crawler
   holding it lands on a 404 page that says nothing about where the document
   went. */
const shippedRedirects = (() => {
  try { return readFileSync(join(DIST, '_redirects'), 'utf8'); } catch { return ''; }
})();
for (const url of externalRoutes) {
  if (!new RegExp(`^/imprint/?\\s+${url.replace(/[.*+?^$()|[\\]\\\\]/g, '\\\\$&')}\\s+301$`, 'm').test(shippedRedirects)) {
    fail(
      'legal: /imprint/ has no 301 to the document it moved to',
      `public/_redirects must send both /imprint and /imprint/ to ${url} with `
      + '301. The route was public for three days and is in caches, bookmarks '
      + 'and at least one sitemap Google has already fetched.',
    );
  }
}

/* ---- the report -------------------------------------------------------- */
if (failures.length) {
  console.error(`\nlaunch-check: ${failures.length} blocker(s)\n`);
  for (const { what, detail } of failures) console.error(`  x ${what}\n    ${detail}`);
  console.error('\nNothing was deployed.\n');
  process.exit(1);
}

console.log('launch-check: no blockers in dist/.');


console.log(`
  Three gates have no artefact here and are not covered by the above:

  1. The reach measurement actually reports. Whether the beacon is SERVED is
     checked above, in both directions. Whether it then reaches Cloudflare is
     not checkable from here: the signs are /cdn-cgi/rum answering rather than
     404, and a figure in the dashboard after real traffic (ADR 0261).
  2. The legal texts have been through a legal review. They are drafts from a
     template until they have.
  3. The manual accessibility pass has been walked. A green axe run covers
     between a third and a half of the WCAG A and AA rules.
`);
