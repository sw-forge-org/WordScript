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

/* THIS SITE DOES NOT PUBLISH AN ADDRESS, AND THAT IS WHY THERE IS NONE HERE.

   The imprint is one document for the whole of SW labs, served at
   legal.sw-labs.de and linked from the footer of every page here. Section 5
   DDG's address requirement is met on that document. The privacy notice on
   this site names the controller and gives an inbox, which is what Article 13
   (1) (a) GDPR asks for -- identity and contact details, not a postal address
   -- and links onward for the rest.

   So the three address fields are gone rather than hidden. An earlier revision
   of this file read them out of `astro:env` to keep them out of a public
   repository; that machinery is gone with them, and with it the `.env` file,
   the Cloudflare build secrets and the placeholder check that guarded it. Not
   storing a value beats storing it carefully. ADR 0265.

   WHAT THIS FILE STILL OWNS. The body's name and holder, which the privacy
   notice and the terms both state; the supervisory authority, because Article
   77 GDPR sends a reader to ours and they cannot look it up without knowing
   where we sit; and the one processor. */
/** The controller under Article 4 (7) GDPR, named by the privacy notice and by
 *  the terms. It was also the provider under section 5 DDG until the imprint
 *  moved off this site; the provider role is still the same body, it is simply
 *  no longer this site's document to print. */
export const ENTITY = {
  name: 'SW labs',
  holder: 'Felix Winkel',
  /* NO LEGAL FORM, NO REGISTER, NO VAT NUMBER -- and after ADR 0265 that is
     not this file's argument to make any more. Those rubrics belong to an
     imprint, and the imprint is served for the whole of SW labs at
     legal.sw-labs.de. What this object still owes is the controller's identity
     for the privacy notice and the party's name for the terms, which is the
     two fields above. */
} as const;

/* THE SUPERVISORY AUTHORITY IS THE ONE FOR THE PROVIDER'S SEAT, NOT THE ONE
   FOR THE READER'S. Article 77 GDPR gives a reader the choice of their own
   authority, their place of work or the place of the alleged infringement; the
   notice names ours because that is the one a reader cannot look up without
   knowing where we sit.

   The provider's seat is in Bavaria, and the private sector in Bavaria is
   supervised by the BayLDA in Ansbach rather than by the Bavarian commissioner
   who supervises public bodies. The two are routinely confused, and the wrong one
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
