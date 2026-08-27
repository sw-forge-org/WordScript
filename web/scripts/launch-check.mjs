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

/* ---- 1. the second contact channel -------------------------------------
   Section 5 DDG wants a way to reach the provider that is as fast as email and
   is not email, and `src/lib/legal.ts` holds it as `null`. The imprint renders
   without a telephone row and looks complete, which is the thing that has to be
   said out loud somewhere.

   IT IS REPORTED AND NO LONGER BLOCKS, ON THE OWNER'S DECISION OF 2026-08-27
   (ADR 0260). The site was ready in every other respect and the number is
   coming; holding the launch on it was the owner's call to make and he made it.
   What the check must not do is go quiet -- an open legal item that stops being
   printed is an open legal item nobody remembers. So it moves down to the
   report at the end, beside the three gates that have no artefact here, and it
   is the only one of the four this repository can actually answer for itself.
   The `fail()` returns the day PHONE stops being null: this check then has
   nothing to say and the notice deletes itself. */
const legalSource = readFileSync(join(SRC, 'lib/legal.ts'), 'utf8');
const phoneOpen = /export const PHONE = null as/.test(legalSource);

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

/* ---- the report -------------------------------------------------------- */
if (failures.length) {
  console.error(`\nlaunch-check: ${failures.length} blocker(s)\n`);
  for (const { what, detail } of failures) console.error(`  x ${what}\n    ${detail}`);
  console.error('\nNothing was deployed.\n');
  process.exit(1);
}

console.log('launch-check: no blockers in dist/.');

if (phoneOpen) {
  console.log(`
  ACCEPTED AND OPEN: the imprint has no second contact channel.

  PHONE in src/lib/legal.ts is null, so the imprint gives an email address and
  nothing else. Section 5 DDG asks for a further means of contact permitting
  rapid and direct communication. The Court of Justice read the same wording in
  C-298/07 of 16 October 2008: the address alone does not satisfy it, and the
  second channel need not be a telephone number.

  Shipping without one is the owner's decision of 2026-08-27, taken knowingly
  and meant to be short-lived (ADR 0260). Set PHONE and this notice goes away
  on its own.
`);
}

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
