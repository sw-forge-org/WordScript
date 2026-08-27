/* THE ENTITY BEHIND THE SITE, IN ONE PLACE.

   Three pages and the footer read this module. The imprint states the provider
   because section 5 DDG requires it, the privacy notice states the same body
   as the controller because Article 13 GDPR requires that, and a second copy
   of an address is a second thing to correct the day it changes. The site's
   own facts stay in ./site; this file carries only the ones the law asks for.

   WHY THE PROVIDER IS SW LABS AND NOT SW FORGE. SW forge is a brand, and a
   brand cannot be served notice. The body that publishes wordscript.dev is the
   sole proprietorship behind it, which is the same body named in the imprint
   at sw-labs.de, and the two must not drift apart: one address, one inbox, one
   set of register facts, whichever site a reader arrives on.

   WHAT IS DELIBERATELY ABSENT. No register court, no register number and no
   VAT identification number, because a sole proprietorship that is not entered
   in the commercial register has none and none is issued. The imprint template
   is explicit that a block which does not apply is deleted rather than filled
   with a dash: an imprint with empty rubrics draws the eye to exactly the
   thing that is missing. If either fact ever comes into existence, it is added
   here and the page grows the block back.

   The MStV block is absent for the same reason, and it is the one most likely
   to become wrong: section 18 (2) MStV attaches to journalistic and editorial
   content, which a product page is not. The day this site grows a blog, a
   magazine or release notes written as articles, that block becomes mandatory
   and this comment is where the next reader finds out. */

/** The single open field on any of the three pages.
 *
 *  Section 5 DDG asks for details that allow fast electronic contact AND
 *  immediate communication. The Court of Justice read the same wording in
 *  Article 5 (1) (c) of Directive 2000/31/EC in C-298/07 of 16 October 2008:
 *  an email address on its own does not satisfy it, and a second means giving
 *  rapid contact and direct, effective communication is required. That second
 *  means need not be a telephone number -- an electronic enquiry mask can
 *  qualify -- but the same judgment requires a further means outside the
 *  electronic network for a user who turns out to have no access to it. A form
 *  is therefore lawful and impractical here: it would be the first form, the
 *  first backend and the first interaction this site has, and it would tie the
 *  site to a response time it then has to keep.
 *
 *  It is `null` rather than a placeholder string on purpose. A string of the
 *  `+49 ...` shape reads as filled in from three metres away and would ship;
 *  a null renders no row at all, and `scripts/launch-check.mjs` refuses to
 *  deploy while it is null.
 *
 *  The assertion is load-bearing rather than decoration: with a plain
 *  annotation TypeScript narrows a `const` initialised to `null` down to
 *  `null` at every use site, so the imprint's `phone && ...` guard becomes a
 *  branch on `never` and the file that renders the row stops compiling. The
 *  value is open, and the type has to stay open with it. */
export const PHONE = null as string | null;

/** The provider under section 5 DDG, and the controller under Article 4 (7)
 *  GDPR. The same body in both roles, which is why it is one object. */
export const ENTITY = {
  name: 'SW labs',
  holder: 'Felix Winkel',
  /* THERE IS NO `form` FIELD, AND ITS ABSENCE IS THE OWNER'S DECISION RATHER
     THAN AN OVERSIGHT. The imprint carried "Sole proprietorship
     (Einzelunternehmen)" for one afternoon and it was struck without
     replacement. Section 5 (1) no. 1 DDG asks for the legal form where the
     provider is a legal person; a natural person trading under a business
     name is identified by that name and their own, which the two fields above
     already are.

     Nothing else moved with it: the register and VAT blocks are still absent
     for the reason the header of this file gives, and that reasoning stays
     here because it is why those blocks are missing, not a statement the page
     makes. */
  street: 'REDACTED-STREET',
  postcode: 'REDACTED-POSTCODE',
  city: 'Aschaffenburg',
  country: 'Germany',
  phone: PHONE,
} as const;

/* THE SUPERVISORY AUTHORITY IS THE ONE FOR THE PROVIDER'S SEAT, NOT THE ONE
   FOR THE READER'S. Article 77 GDPR gives a reader the choice of their own
   authority, their place of work or the place of the alleged infringement; the
   notice names ours because that is the one a reader cannot look up without
   knowing where we sit.

   Aschaffenburg is in Bavaria, and the private sector in Bavaria is supervised
   by the BayLDA in Ansbach rather than by the Bavarian commissioner who
   supervises public bodies. The two are routinely confused, and the wrong one
   in a privacy notice is a reader sent to an office that will not take the
   complaint. Read from the authority's own site on 2026-08-27. */
export const AUTHORITY = {
  name: 'Bayerisches Landesamt für Datenschutzaufsicht',
  street: 'Promenade 18',
  postcode: '91522',
  city: 'Ansbach',
  country: 'Germany',
  url: 'https://www.lda.bayern.de',
} as const;

/** The one processor this site has. It is DNS, CDN and host in a single
 *  entry because it is a single company doing all three, and splitting it
 *  across three sections would suggest three relationships. */
export const HOST = {
  name: 'Cloudflare, Inc.',
  address: '101 Townsend St., San Francisco, CA 94107, USA',
  privacy: 'https://www.cloudflare.com/privacypolicy/',
} as const;

/* THE DATE THE PAGES CARRY, AND WHAT IT ACTUALLY CLAIMS.

   Not "last changed" but "last reviewed": a legal page whose date only moves
   when its wording moves cannot be distinguished from one nobody has read in
   two years. It is bumped when the third-party inventory, the entity facts or
   the law behind a section have been checked again, whether or not a word
   changed. The launch gate's own rule is that a stale date is itself a defect.

   Written out in full rather than as a numeric date, because 08/09 is two
   different days on two sides of an ocean and this page is read on both. */
export const REVIEWED = '27 August 2026';

/* THE FOOTER'S LEGAL GROUP, AND WHY IT IS THREE ROUTES AND NOT FOUR.

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
export const LEGAL_ROUTES = [
  { href: '/imprint/', label: 'Imprint' },
  { href: '/privacy/', label: 'Privacy' },
  { href: '/terms/', label: 'Terms' },
] as const;
