/* WHAT THE PRODUCT CAN DO WITH A LANGUAGE, READ OFF THE TWO PLACES THAT DECIDE IT

   ADR 0252 decision 2: every value this page states is the runtime's, read
   rather than typed. Language is the hardest case of that rule on the whole
   site, because it is the number every competitor prints on their landing page
   and none of them says where it comes from. "100+ languages" is the category's
   phrase; it is not a measurement, and this page is not allowed to make one up
   to match.

   So the surface states two numbers and they are different numbers, because
   they answer different questions:

   - **WHAT THE RECOGNISER REACHES.** Whisper's own count, and it arrives here
     off the catalogue rows that name it. `shared/model_catalogue.json` carries
     a `languages` field per row with a source and a read date, and the speech
     rows that run on Whisper weights say "Whisper's 99+". That is a property of
     the model, so it is read from the model file rather than asserted here.

   - **WHAT WORDSCRIPT ITSELF CAN NAME.** The detector in
     `src-tauri/src/core/language_detect.rs` measures the language on the
     DELIVERED TEXT rather than reading it off the setting or asking the
     provider, which is ADR 0180's finding: on the two lanes most dictations go
     through, no provider ever reports one. Its table is seventy rows, and the
     seventy is the array's own declared length.

   THE DETECTOR ALSO REFUSES, AND THE PAGE DOES NOT SAY SO. Under `MIN_WORDS`
   of text, or where whatlang judges its own reading unreliable, a run is
   counted in no language at all rather than folded into a near neighbour. That
   was printed on the card for a while as a third figure reading `0 guessed`,
   and it was removed: nobody arrives at a language card wondering whether the
   product guesses, so answering it is answering an accusation nobody made, and
   a product that volunteers what it does not do reads as one with something to
   be defensive about. The behaviour is unchanged and its derivation is in
   ADR 0180 and in the Rust file's own header, which is where it belongs.

   ── HOW IT IS READ, AND WHY IT THROWS ────────────────────────────────────────

   The Rust file is parsed at build time, which is a real dependency on the
   shape of a source file in another language, so it fails loudly rather than
   quietly: a pattern that stops matching throws during `astro build` and no
   page is produced. That is the same discipline `libraryModel` in
   src/screens/data.ts uses for a model with no install block -- a surface whose
   whole promise is that the number is the runtime's cannot be allowed to render
   with a number that is merely plausible.

   IT IS A `?raw` IMPORT AND NOT `readFileSync`, and that is a correction rather
   than a preference. `readFileSync(new URL('...', import.meta.url))` reads the
   right file in dev and the wrong one in a build: Astro bundles this module
   into `dist/.prerender/chunks/`, `import.meta.url` follows it there, and the
   relative path then resolves against the chunk. Measured: it went looking for
   `web/src-tauri/...`, which does not exist, and the build failed -- which at
   least is the direction to fail in. A `?raw` import is resolved by the
   bundler against THIS file's own location, so it survives being bundled, and
   the file's content is inlined at build time.

   Zero runtime cost. What ships is the rendered text; neither the Rust source
   nor the catalogue reaches the browser. */
import catalogue from '../../../shared/model_catalogue.json';
import rust from '../../../src-tauri/src/core/language_detect.rs?raw';

function rustNumber(pattern: RegExp, what: string): number {
  const hit = rust.match(pattern);
  if (!hit) {
    throw new Error(
      `languages: could not read ${what} out of core/language_detect.rs. ` +
      'The file moved or its shape changed; fix the pattern rather than ' +
      'hard-coding the number.',
    );
  }
  return Number(hit[1]);
}

/** The size of the detector's ISO 639-3 to 639-1 table, off the array's own
 *  declared length. This is how many languages a delivered text can be NAMED
 *  as; the recogniser transcribes more than this, and a language the table has
 *  no row for is stored under its three-letter code rather than dropped. */
export const DETECTED = rustNumber(
  /const ISO_639_1: \[\(&str, &str\); (\d+)\]/,
  'the ISO_639_1 table length',
);


/* THE CODES THEMSELVES, AND NOT JUST HOW MANY.

   The surface names a handful of the seventy, and a name it prints has to be
   one the detector could actually return -- otherwise the page is advertising
   a language the product would store under a three-letter code it has no row
   for. So the table's second column is parsed as well as counted, and
   ../lib/flags checks every code it draws against this. */
const PAIR = /\("[a-z]{3}",\s*"([a-z]{2})"\)/g;

/** Every ISO 639-1 code the detector can name a text as. */
export const CODES: ReadonlySet<string> = new Set(
  [...rust.matchAll(PAIR)].map((m) => m[1]),
);

if (CODES.size !== DETECTED) {
  throw new Error(
    `languages: the ISO_639_1 table declares ${DETECTED} rows and ${CODES.size} ` +
    'were parsed out of it. One of the two patterns is wrong.',
  );
}

/* THE RECOGNISER'S REACH, OFF THE CATALOGUE ROWS THAT STATE IT.

   Not every speech row states a count -- Groq's says "multilingual" and
   documents no detection, which is a real difference and one the catalogue
   already records. The rows that DO state one all state the same one, because
   they are all Whisper. Taking the maximum across them and refusing an empty
   result is what keeps this honest in both directions: it cannot silently
   report a smaller number if a row is edited, and it cannot report anything at
   all if every row stops saying it. */
const stated = (catalogue.models as { role: string; languages?: string }[])
  .filter((m) => m.role === 'speech')
  .map((m) => m.languages?.match(/(\d+)\s*\+/)?.[1])
  .filter((n): n is string => Boolean(n))
  .map(Number);

if (!stated.length) {
  throw new Error(
    'languages: no speech row in shared/model_catalogue.json states a language ' +
    'count. The page cannot state one either.',
  );
}

/** Whisper's own count, as the catalogue's speech rows state it. */
export const RECOGNISED = Math.max(...stated);
