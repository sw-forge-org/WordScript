/* THE FOUR MARKS IN THE FOOTER'S LEFT GROUP

   The row is source, room, site, page. It was four words in a line, and four
   words in a line at 11px is a row a reader parses rather than scans. A mark
   in front of each turns it into four objects.

   ── ONE PACKAGE, BECAUSE THE ROW NEEDED THE REAL LINKEDIN MARK ────────────

   The first version of this file read GitHub and Discord out of `simple-icons`
   and drew the other two by hand, because LinkedIn is not in `simple-icons`:
   it was removed over the trademark, the same way Windows was, and ../osMarks
   already settles that this project does not paste vendor artwork in from a
   third party to work around a removal. A globe stood in for SW labs and a
   profile silhouette for LinkedIn.

   That was the wrong trade for this row. A footer group of four brand links
   where two carry the brand and two carry an abstraction reads as two of the
   links being less real than the others, and the one that lost its mark was
   the company's own page.

   `bootstrap-icons` ships all four -- LinkedIn included -- under MIT, which is
   a licence to use the artwork rather than a copy of it found somewhere. So
   the whole row comes from one package: one licence, one 16-unit grid, one
   stroke weight, and no per-mark alignment to negotiate. `simple-icons` stays
   where it already was, in ../osMarks, for the desktops and the copyleft ring.

   SW LABS TAKES A GLOBE AND THAT IS STILL NOT A LOGO. It is the only one of
   the four with no mark to license: what exists in this repository is a
   wordmark, and a wordmark reduced to a 14px square is a smudge -- the same
   measurement ../osMarks made when it rejected the GNU head. A globe says
   "the house's website", which is what the link is, and it comes off the same
   grid as the three beside it.

   ── VIEWBOX PER MARK, READ RATHER THAN ASSUMED ────────────────────────────

   Every glyph carries its own `viewBox` out of the file. They are all 16 today
   and a row stretched onto a number this module had hard-coded would be wrong
   the day one of them is not.

   Read at build time: imported by `.astro` only, so what ships is path data
   and the package never reaches the browser.

   Marks: `bootstrap-icons`, MIT, by The Bootstrap Authors. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const PATH_D = /<path[^>]*\sd="([^"]+)"/;
const VIEWBOX = /viewBox="([^"]+)"/;

export type LinkMark = {
  href: string;
  label: string;
  path: string;
  viewBox: string;
};

/** One glyph out of the package, or a build that stops. A footer that renders
 *  with a mark missing is a footer nobody notices is wrong. */
function mark(icon: string): { path: string; viewBox: string } {
  const raw = readFileSync(
    require.resolve(`bootstrap-icons/icons/${icon}.svg`),
    'utf8',
  );

  const path = raw.match(PATH_D)?.[1];
  const viewBox = raw.match(VIEWBOX)?.[1];
  if (!path || !viewBox) {
    throw new Error(
      `linkMarks: ${icon}.svg has no single path or no viewBox. The package ` +
      'changed shape; fix the pattern rather than pasting the artwork in.',
    );
  }

  /* EVERY ONE OF THESE IS A SINGLE PATH TODAY and the row is drawn as one.
     A glyph that grows a second path would render as its first path only,
     which is a mark that is quietly missing half of itself. */
  if ((raw.match(/<path/g) || []).length !== 1) {
    throw new Error(
      `linkMarks: ${icon}.svg now has more than one path, and this module ` +
      'draws only the first. Render the whole body instead.',
    );
  }

  return { path, viewBox };
}

/** Nearest-to-the-code first: where it is written, where it is talked about,
 *  where the house is, and where the house posts. */
export const LINKS: LinkMark[] = [
  { href: 'https://github.com/sw-forge-org/WordScript', label: 'GitHub', ...mark('github') },
  { href: 'https://discord.com/invite/BHfApphz8h', label: 'Discord', ...mark('discord') },
  { href: 'https://sw-labs.de', label: 'SW labs', ...mark('globe2') },
  { href: 'https://www.linkedin.com/company/sw-labs', label: 'LinkedIn', ...mark('linkedin') },
];

export const LINKS_LICENCE = 'bootstrap-icons, MIT';
