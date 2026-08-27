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

/* ---- 1. the second contact channel -------------------------------------
   Section 5 DDG wants a way to reach the provider that is as fast as email and
   is not email. src/lib/legal.ts holds it as `null` until there is one, and
   that null is the thing this check exists for: the imprint renders without a
   telephone row and looks complete. */
const legalSource = readFileSync(join(SRC, 'lib/legal.ts'), 'utf8');
if (/export const PHONE = null as/.test(legalSource)) {
  fail(
    'imprint: no second contact channel',
    'PHONE in src/lib/legal.ts is null. Section 5 DDG asks for a fast channel '
    + 'beside the email address. Set the number, or take the documented '
    + 'decision to ship without one and change this check with it.',
  );
}

/* ---- 2. the legal routes exist ----------------------------------------- */
for (const route of legalSource.matchAll(/href: '\/([a-z-]+)\/'/g)) {
  const page = join(DIST, route[1], 'index.html');
  const flat = join(DIST, `${route[1]}.html`);
  try { statSync(page); } catch {
    try { statSync(flat); } catch {
      fail('legal route missing', `/${route[1]} is in the footer and has no page in dist/.`);
    }
  }
}

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

/* ---- 5. the typefaces, and the two different obligations they carry ----
   THE FIRST VERSION OF THIS CHECK ASKED THE WRONG QUESTION. It looked for an
   OPEN marker in NOTICE.txt because the Zodiak licence text was not in the
   directory, on the assumption that every font licence works the way the SIL
   Open Font License does. It does not.

   Archivo and IBM Plex Mono are OFL 1.1, whose condition 2 permits
   redistribution provided each copy carries the copyright notice and the
   licence. Their texts sit in public/fonts/ because that is what discharges
   it, and they may be committed.

   Zodiak is under the ITF Free Font License 2.0 (17 Aug 2026), read from
   fontshare.com/licenses/itf-ffl on 2026-08-27. That licence requires no text
   to travel with the font and no attribution at all. What it forbids is
   passing the font on: section 02 rules out making the Font Software available
   to any other person or entity, naming repositories, download services and
   publicly accessible servers, while section 01 expressly permits self-hosting
   it on your own site. Serving the file is the permitted case; committing it
   to a public repository is the forbidden one.

   So the two checks below are the two halves of that: the file has to be here
   when the site is built, because the page preloads it and a missing face is a
   404 on every load, and it has to be absent from version control, because the
   repository is public. */
const notice = readFileSync(join(FONTS, 'NOTICE.txt'), 'utf8');
if (notice.includes('OPEN:')) {
  fail(
    'fonts: NOTICE.txt has an open item',
    'public/fonts/NOTICE.txt carries an OPEN marker. Close it or remove it.',
  );
}

const RESTRICTED = 'zodiak-400-italic.woff2';
try {
  statSync(join(FONTS, RESTRICTED));
} catch {
  fail(
    'fonts: the display italic is not in the working tree',
    `public/fonts/${RESTRICTED} is missing and the page preloads it. It is `
    + 'deliberately not in version control, so a fresh clone has to fetch it '
    + 'from fontshare.com/fonts/zodiak once. public/fonts/NOTICE.txt says why.',
  );
}
/* THE TRACKED CHECK ASKS ABOUT THE FONT, NOT ABOUT ONE PATH. It used to name
   `public/fonts/zodiak-400-italic.woff2` and would have passed while a second
   copy of the same face, plus two further weights, sat in the sketch's own
   web/fonts/ directory waiting to be committed to a public repository. The
   licence attaches to the Font Software, so the question has to be asked of the
   whole checkout: is any Zodiak file in the index anywhere. */
try {
  const tracked = execFileSync('git', ['ls-files', '--cached', '--', ':(glob)**/zodiak*'], {
    cwd: new URL('../../', import.meta.url).pathname, encoding: 'utf8',
  }).trim();
  if (tracked) {
    fail(
      'fonts: a font that may not be redistributed is committed',
      `${tracked.split('\n').join(', ')} tracked by git. The ITF Free Font `
      + 'License forbids passing the font on through a repository. Remove it '
      + 'from the index and from history before this repository is pushed '
      + 'anywhere public.',
    );
  }
} catch (e) {
  /* No git, or not a checkout. Worth saying rather than passing silently: the
     stronger of the two checks is the one that did not run. */
  if (e && e.status === undefined) {
    console.log('  note: git not available, the tracked-font check did not run.');
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

  1. Cloudflare Web Analytics is switched on for this zone. The privacy notice
     names it, and public/_headers is written so the edge can inject it. The
     switch itself lives in the dashboard.
  2. The legal texts have been through a legal review. They are drafts from a
     template until they have.
  3. The manual accessibility pass has been walked. A green axe run covers
     between a third and a half of the WCAG A and AA rules.
`);
