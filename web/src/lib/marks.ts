/* PROVIDER MARKS, READ OUT OF THE PACKAGE AT BUILD TIME

   `@lobehub/icons-static-svg`, MIT, by LobeHub. Same source and same version
   the app itself uses in src/components/shell/brandSymbols.ts, which is the
   point: a vendor's mark on the site and the same vendor's mark on the AI
   Models screen come from one package, so a brand refresh is an `npm update`
   in two places rather than a redraw in one and a stale paste in the other.

   ── THE MARKS ARE IN COLOUR, AND FOUR OF THEM ARE NOT ─────────────────────

   This module drew the mono variant of everything for two reasons, and both
   have been answered rather than overruled.

   The first was a design argument: that a lane row answering "what runs this"
   wants a set rather than a parade, and that the page already spends its
   colour budget on the focus band under the hero. The section it was written
   for no longer exists. What replaced it is a picker the reader operates, and
   in a surface somebody is choosing inside, a vendor's own colours are what
   makes a row findable at a glance instead of readable at a stop. The page now
   has two coloured runs and they are doing two different jobs: the focus band
   is a claim about where text lands, this is a control.

   The second was mechanical and is the reason for the sprite below rather than
   a reason to stay mono. Coloured variants carry gradients and masks with
   internal `id`s, and this page draws the same mark many times -- OpenAI is on
   Cloud and on Local, Anthropic is on Cloud and in the profile, and the job
   rows repeat a mark once per job. Inlined, that is duplicate ids, which
   browsers resolve first-wins and validators reject; worse, ACROSS marks the
   package reuses `a` and `b`, so Gemma's gradient would resolve to Qwen's.

   FOUR VENDORS HAVE NO COLOURED VARIANT AND THAT IS NOT A GAP. Groq, OpenAI,
   Anthropic and Ollama ship one file each, because their marks are monochrome
   by design -- there is no colour to draw. Those keep `currentColor` and sit at
   the foreground's weight, which is what those brands look like everywhere
   else. A row mixing the two is what the vendors actually look like side by
   side; inventing a colour for the four would be drawing a logo that does not
   exist.

   ── WHY A SPRITE ──────────────────────────────────────────────────────────

   Each mark is defined once, as a `<symbol>` in a hidden `<svg>` rendered by
   Base.astro, and every use site is a five-attribute `<use>`. Three things
   follow: an internal id exists exactly once in the document, so nothing can
   collide with anything; the ids are namespaced by slug anyway, so a future
   second sprite cannot collide either; and the path data stops being repeated
   once per row, which on the engines section is the difference between eleven
   definitions and something closer to forty.

   Zero runtime cost. This module is imported by `.astro` components only, so
   it runs during the build and what ships is the rendered markup. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { namespaceIds } from './svgIds';

const require = createRequire(import.meta.url);

/** Every mark on this page, in one place, so the licence note under the
 *  section can count them and nothing can be drawn that is not listed. */
export type MarkId =
  | 'groq' | 'openai' | 'anthropic' | 'openrouter'
  | 'ollama' | 'meta' | 'qwen' | 'gemma'
  | 'bedrock' | 'azureai' | 'vertexai';

const ALL: MarkId[] = [
  'groq', 'openai', 'anthropic', 'openrouter',
  'ollama', 'meta', 'qwen', 'gemma',
  'bedrock', 'azureai', 'vertexai',
];

const SVG_OPEN = /^<svg[^>]*>/;
const SVG_CLOSE = /<\/svg>\s*$/;
const TITLE = /<title>.*?<\/title>/;
const VIEWBOX = /viewBox="([^"]+)"/;

type Source = { body: string; viewBox: string; colour: boolean };

/** The coloured file if the package has one, the mono file otherwise. A
 *  missing colour variant is a fact about the brand, not a lookup failure, so
 *  it falls through rather than throwing. */
function read(id: MarkId): Source {
  let colour = true;
  let file: string;
  try {
    file = require.resolve(`@lobehub/icons-static-svg/icons/${id}-color.svg`);
  } catch {
    colour = false;
    file = require.resolve(`@lobehub/icons-static-svg/icons/${id}.svg`);
  }

  const raw = readFileSync(file, 'utf8').trim();
  const viewBox = raw.match(VIEWBOX)?.[1];
  if (!viewBox) {
    throw new Error(`marks: ${id} has no viewBox`);
  }

  const body = raw.replace(SVG_OPEN, '').replace(SVG_CLOSE, '').replace(TITLE, '');

  /* THE MONO FILES MUST STAY TINTABLE. A hard-coded fill in what this module
     believes is a mono file means the CSS `fill: currentColor` under it is
     silently doing nothing, and the mark would be black on a dark ground. */
  if (!colour && /fill="#/.test(body)) {
    throw new Error(
      `marks: ${id}.svg has no colour variant and carries a hard-coded fill, ` +
      'so it cannot take currentColor. Check the package.',
    );
  }

  return { body: namespaceIds(body, `m-${id}`), viewBox, colour };
}

const SOURCES = new Map<MarkId, Source>(ALL.map((id) => [id, read(id)]));

/** Whether this mark is drawn in the vendor's own colours. The four that are
 *  not have no coloured variant to draw, and take `currentColor` instead. */
export const isColour = (id: MarkId): boolean => SOURCES.get(id)!.colour;

/** The id a `<use href>` points at. */
export const markHref = (id: MarkId): string => `#m-${id}`;

/** The whole sprite, rendered once by Base.astro. Every symbol keeps its own
 *  viewBox, so a package that ships one mark on a different grid stays
 *  correctly proportioned rather than being stretched onto a shared one. */
export const MARK_SPRITE: string = ALL
  .map((id) => {
    const s = SOURCES.get(id)!;
    return `<symbol id="m-${id}" viewBox="${s.viewBox}">${s.body}</symbol>`;
  })
  .join('');

export const MARKS_LICENCE = '@lobehub/icons-static-svg, MIT';
