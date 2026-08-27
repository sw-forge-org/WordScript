/* THE LICENCE AND THE THREE DESKTOPS, AS MARKS RATHER THAN AS WORDS.

   The hero's fact strip carried three strings: `AGPL-3.0`, `macOS, Windows,
   Linux` and one about lanes. Two of the three name things that already have a
   mark the reader knows on sight, and a mark is read at a glance where a
   comma-separated list has to be parsed. The third is a claim in words and
   stays in words.

   Read at build time, like ../focusApps and ../marks: this module is imported
   by `.astro` components only, so what ships is the rendered path data and the
   package never reaches the browser.

   Licence: Simple Icons, CC0-1.0.

   SIZE DECIDED THE SET, and it was measured rather than guessed. The strip is
   set at 11px and its marks at 16, against the focus band's 19; at that size a
   mark that is an outline with interior detail is a smudge. The GNU head was
   the first choice for the licence -- the Affero General Public License is a
   GNU licence, so it is the exact family mark -- and it is an engraving of an
   animal's face. Rendered at 16px and blown back up pixel for pixel it is a
   grey blur with no readable feature in it. Tux survives the same test because
   a penguin is legible as a silhouette. Apple survives because it is solid.

   So the licence is the COPYLEFT mark instead: a ring and a reversed C, drawn
   below. It is two strokes and it reads at any size, it is not anyone's
   trademark, and it says what the row is there to say. AGPL-3.0 is a strong
   copyleft licence, and the word beside the mark carries the version. */
import * as icons from 'simple-icons';

export type Mark = { label: string; path: string };

/* COPYLEFT, DRAWN HERE.

   A ring, then its hole wound the other way so the fill rule leaves it open,
   then the C. The C is an annulus sector spanning 290 degrees with its gap
   facing left, which is the whole difference between this and the copyright
   sign and is the reason the two are never confused at a glance. */
const COPYLEFT =
  'M12 1a11 11 0 1 0 0 22a11 11 0 1 0 0-22z'
  + 'M12 3.3a8.7 8.7 0 1 1 0 17.4a8.7 8.7 0 1 1 0-17.4z'
  + 'M6.84 8.39A6.3 6.3 0 1 1 6.84 15.61L8.72 14.29A4 4 0 1 0 8.72 9.71Z';

export const LICENCE: Mark = { label: 'AGPL-3.0', path: COPYLEFT };

/* WINDOWS IS DRAWN HERE AND THE OTHER TWO ARE READ FROM THE PACKAGE.

   Simple Icons carries Apple and it carries Tux; it does not carry Windows,
   and it will not: the mark was pulled from the set over the trademark, and
   asking for it back is a closed question there. Substituting some third-party
   paste of the same artwork would put an unlicensed vendor asset in the build
   and would freeze it at whatever a copy of a copy looked like.

   So the four panes are ours: a geometric figure drawn to the same 24-unit box
   the other two arrive in, saying "the operating system whose logo is four
   panes" without reproducing anyone's artwork. It is also the least
   interesting mark of the three, which is correct -- this row is a fact, not a
   partner wall. */
const PANES = 'M3 3h8.4v8.4H3Zm9.6 0H21v8.4h-8.4ZM3 12.6h8.4V21H3Zm9.6 0H21V21h-8.4Z';

/** The order the product's own sentences use, in the FAQ and in PLATFORMS.md:
 *  macOS, Windows, Linux. */
export const DESKTOPS: Mark[] = [
  { label: 'macOS', path: icons.siApple.path },
  { label: 'Windows', path: PANES },
  { label: 'Linux', path: icons.siLinux.path },
];

/** What the row says out loud, for a reader who gets no marks at all. */
export const DESKTOPS_LABEL = 'macOS, Windows and Linux';
