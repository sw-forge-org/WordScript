/* THE ROUTES THE LEGAL DOCUMENTS LIVE AT.

   IT IS ITS OWN MODULE BECAUSE ./legal IS NO LONGER IMPORTABLE FROM
   EVERYWHERE. That module now reads the provider's address out of
   `astro:env/server`, which does not resolve while Astro is loading its own
   configuration -- and `astro.config.mjs` needs this list, to keep the three
   documents out of the sitemap. Splitting the list off is what lets the config
   have the routes without pulling the address into a context that cannot
   supply it.

   TWO OF THESE THREE ARE PAGES AND ONE IS AN ADDRESS SOMEWHERE ELSE. The
   imprint is not published here at all any more: it is one document for the
   whole of SW labs, served at legal.sw-labs.de, and this site links to it. ADR
   0265 carries the decision and what it costs.

   THE FORM IS THE MARKER. An entry whose `href` starts with `/` is a route
   this site builds; anything else is absolute and points outward. Every reader
   tells them apart that way -- the footer needs no distinction at all, the
   sitemap filter only ever sees built pages, and `scripts/launch-check.mjs`
   asserts a built page and a `_headers` rule for the internal ones and a live
   link for the external one. No flag to keep in sync with the `href` that
   already says it.

   It was Imprint, Privacy, Terms and DPA. The fourth is gone, and it is worth
   saying why in the place that draws the row rather than only in ADR 0258.

   A data processing agreement under Article 28 GDPR is the contract between a
   controller and somebody processing on their behalf. WordScript gives us
   nothing to process: it runs on the reader's own machine, it has no account
   and no server of ours, the key belongs to the reader, and where a cloud lane
   is chosen the relationship is between the reader and that vendor. There is
   no processing in our name to put under a contract, so a page at /dpa would
   have had to either invent the relationship or spend a screen explaining that
   it does not exist. Both are worse than not drawing the link.

   The day WordScript grows something hosted -- a sync service, an account, a
   managed model endpoint -- that link comes back, and it comes back with a
   real agreement behind it rather than as a reassurance.

   THE TRAILING SLASH IS THE CANONICAL FORM AND IS NOT COSMETIC. The build
   emits `imprint/index.html`, the sitemap lists `/imprint/`, and the canonical
   tag is built from `Astro.url.pathname`, which is `/imprint/` too. A footer
   link to `/imprint` is the same document at a URL that redirects, so the row
   and the crawl surface would disagree by one character in three places. */
/** The provider's imprint, which this site links to and does not serve.
 *  Named separately because ../pages/terms and ../pages/privacy point a reader
 *  at it in running prose, and three copies of one URL is two too many. */
export const IMPRINT_URL = 'https://legal.sw-labs.de/imprint';

export const LEGAL_ROUTES = [
  { href: IMPRINT_URL, label: 'Imprint' },
  { href: '/privacy/', label: 'Privacy' },
  { href: '/terms/', label: 'Terms' },
] as const;
