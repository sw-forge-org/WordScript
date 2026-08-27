/* NAMESPACING THE IDS INSIDE A BORROWED SVG

   Two packages on this page ship SVGs with internal `id`s, and both ship them
   with the SAME internal ids. Every circle flag in `circle-flags` masks itself
   with `id="a"`; five of the coloured vendor marks in
   `@lobehub/icons-static-svg` define a gradient as `id="a"` or `id="b"`.

   Inline more than one of either into one document and the ids collide. What
   happens then is not a validator complaint, it is a wrong picture: `url(#a)`
   resolves to the FIRST element with that id in the document, so the German
   flag would be masked by whichever flag came first and Gemma's gradient would
   be filled with Qwen's colours.

   So every borrowed body is rewritten with a prefix that is unique to the
   thing it came from, before it is ever put in the page. Three forms are
   rewritten because all three are how an SVG points at its own id: the
   definition, the functional `url(#…)` reference, and the `href`/`xlink:href`
   fragment reference.

   IT THROWS RATHER THAN PASSING SOMETHING THROUGH UNTOUCHED. A file whose ids
   it did not rewrite is a file it did not understand, and the failure mode of
   getting this wrong is silent: the page renders, and one mark or one flag is
   quietly the wrong colour. A build that stops is the cheaper outcome. */

const DEF = /\bid="([^"]+)"/g;
const URL_REF = /url\(#([^)]+)\)/g;
const HREF_REF = /\b(xlink:href|href)="#([^"]+)"/g;

/**
 * Rewrite every internal id in one SVG body so it cannot collide with another.
 *
 * @param body   the SVG's inner markup, without its own `<svg>` wrapper
 * @param prefix unique per source file, e.g. the mark slug or the flag's code
 */
export function namespaceIds(body: string, prefix: string): string {
  const seen = new Set<string>();
  let out = body.replace(DEF, (_, id: string) => {
    seen.add(id);
    return `id="${prefix}-${id}"`;
  });

  if (!seen.size) return out;

  out = out.replace(URL_REF, (whole, id: string) =>
    seen.has(id) ? `url(#${prefix}-${id})` : whole);
  out = out.replace(HREF_REF, (whole, attr: string, id: string) =>
    seen.has(id) ? `${attr}="#${prefix}-${id}"` : whole);

  /* Every id that was DEFINED should now be gone in its bare form. One left
     over means a reference shape this function does not know about, and the
     picture it produces would be wrong in a way nothing else here checks. */
  for (const id of seen) {
    if (new RegExp(`#${id}[)"']`).test(out)) {
      throw new Error(
        `namespaceIds: '${prefix}' still references '#${id}' after rewriting. ` +
        'The file uses a reference form this function does not handle.',
      );
    }
  }
  return out;
}
