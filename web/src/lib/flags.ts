/* THE LANGUAGES THE PAGE NAMES, WITH A FLAG AND THEIR OWN NAME FOR THEMSELVES

   ── A FLAG IS A COUNTRY AND A LANGUAGE IS NOT, AND THIS ROW DOES IT ANYWAY ──

   Spanish is not Spain. English is not the United States. Arabic is spoken as a
   first language across two dozen countries and Saudi Arabia is one of them.
   Every flag in the table below is a convention rather than a fact, and the two
   entries that make that plainest are the ones this file will not draw at all:
   the detector also names Esperanto and Latin, which have no country to point
   at, and a row that quietly dropped them would be the surface deciding a
   language is not real because it has no flag.

   It is drawn anyway because of what the row is FOR. It is not a claim about
   nations; it is a reader scanning for their own language and finding it in
   under a second, which is what a flag does and what a two-letter code does
   not. The honest way to do a dishonest convention is to say so, keep the
   mapping in one place where it can be argued with, and never let the flag be
   the only identification: every chip carries the language's own name for
   itself beside it, and that name is the actual answer.

   ── THE NAMES ARE ENDONYMS AND THEY ARE NOT TYPED ──────────────────────────

   `Intl.DisplayNames` with the language asking about itself gives Deutsch,
   Español, 日本語, العربية -- what a speaker calls their own language, not what
   English calls it. It is derived at build time from Node's ICU data rather
   than being a list somebody transliterated, which is the same rule the rest of
   this page's values follow: read, not typed.

   That is also what makes the row worth looking at. A row of chips in Latin,
   Cyrillic, Arabic, Devanagari, Han, Kana and Hangul says "this thing hears
   scripts" in a way the same words set in English never would.

   ── AND EVERY CODE IS CHECKED AGAINST THE DETECTOR ─────────────────────────

   A code drawn here that the detector has no row for would be the page naming a
   language the product cannot name back. `CODES` is parsed out of
   `src-tauri/src/core/language_detect.rs` by ../lib/languages, and a chip whose
   code is not in it throws during the build.

   Flags: `circle-flags`, MIT, by HatScripts. Read at build time and inlined;
   the package never reaches the browser. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { CODES, DETECTED } from './languages';
import { namespaceIds } from './svgIds';

const require = createRequire(import.meta.url);

/* WHICH LANGUAGES ARE DRAWN, AND WHY THESE.

   Enough scripts that the row cannot be mistaken for a European list, and
   enough of the languages this project's own readers actually dictate in that
   somebody scanning finds theirs. The region beside each code is the
   convention this file's header argues with; where a language has an obvious
   plurality of speakers in one country that is the one used, and where it does
   not -- Arabic -- the choice is arbitrary and admitted.

   The order is the order a European reader scans, then the scripts, which is
   also roughly the order of the page's own audience. */
const SHOWN: { code: string; region: string }[] = [
  { code: 'en', region: 'us' },
  { code: 'de', region: 'de' },
  { code: 'es', region: 'es' },
  { code: 'fr', region: 'fr' },
  { code: 'pt', region: 'br' },
  { code: 'it', region: 'it' },
  { code: 'nl', region: 'nl' },
  { code: 'pl', region: 'pl' },
  { code: 'sv', region: 'se' },
  { code: 'uk', region: 'ua' },
  { code: 'ru', region: 'ru' },
  { code: 'tr', region: 'tr' },
  { code: 'ar', region: 'sa' },
  { code: 'hi', region: 'in' },
  { code: 'zh', region: 'cn' },
  { code: 'ja', region: 'jp' },
  { code: 'ko', region: 'kr' },
];

const SVG_OPEN = /^<svg[^>]*>/;
const SVG_CLOSE = /<\/svg>\s*$/;
const VIEWBOX = /viewBox="([^"]+)"/;

export type Lang = {
  code: string;
  /** What speakers of this language call it. */
  name: string;
  /** The flag's own viewBox, kept rather than assumed: the package draws on a
   *  512 grid today and a row stretched onto a guessed one would be wrong the
   *  day that changes. */
  viewBox: string;
  body: string;
};

function flag(code: string, region: string): Lang {
  if (!CODES.has(code)) {
    throw new Error(
      `flags: '${code}' is not in the detector's ISO_639_1 table, so the page ` +
      'would be naming a language the product cannot name back.',
    );
  }

  const raw = readFileSync(
    require.resolve(`circle-flags/flags/${region}.svg`),
    'utf8',
  ).trim();

  const viewBox = raw.match(VIEWBOX)?.[1];
  if (!viewBox) {
    throw new Error(`flags: ${region}.svg has no viewBox`);
  }

  /* THE ENDONYM, ASKED IN THE LANGUAGE ITSELF. `of()` falls back to returning
     the code it was given when ICU has no name, which would put a bare "sv" in
     a row of words -- so a fallback is a failure here rather than a default. */
  const name = new Intl.DisplayNames([code], { type: 'language' }).of(code);
  if (!name || name === code) {
    throw new Error(
      `flags: no endonym for '${code}'. This build's Node has no ICU data for ` +
      'it, and a two-letter code in a row of language names is not a name.',
    );
  }

  return {
    code,
    name,
    viewBox,
    /* Every circle flag masks itself with the same `id="a"`, so seventeen of
       them inlined into one document would all resolve to the first mask.
       ../lib/svgIds carries the derivation. */
    body: namespaceIds(
      raw.replace(SVG_OPEN, '').replace(SVG_CLOSE, ''),
      `fl-${region}`,
    ),
  };
}

/** The languages the card draws, in scanning order. */
export const LANGS: Lang[] = SHOWN.map((l) => flag(l.code, l.region));

/** How many of the detector's table are not on the row. Counted rather than
 *  typed, so adding a chip above takes one off this without anyone noticing
 *  they had to. */
export const MORE = DETECTED - LANGS.length;
