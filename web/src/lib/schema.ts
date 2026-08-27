/* THE PAGE, RESTATED FOR A MACHINE.

   One `@graph` rather than four separate blocks, because the four nodes refer
   to each other: the page is about the application, the application is
   published by the organisation, and the organisation is the site's publisher.
   Four disconnected blocks state the same facts and leave the reader to guess
   that they are the same three things.

   WHY THE INDEX'S PAGE NODE CARRIES TWO TYPES. `FAQPage` requires its
   `mainEntity` to be the questions, and `WebPage` wants `about` to be the
   subject. That page is both: it argues a product and it answers six questions
   about it. Typing one node as both keeps a single `@id` for a single URL,
   which is the thing a second FAQ node at a second `@id` would quietly break.

   THE OTHER ROUTES TAKE `WebPage` ALONE, and the derivation for that sits on
   `graph` below, next to the line that decides it.

   WHAT IS ABSENT IS THE POINT. No `offers`, no `aggregateRating`, no
   `softwareVersion`, no `downloadUrl`. There is no release, the page says so
   in its first answer, and structured data that runs ahead of the visible page
   is a risk rather than a rich result. When there is a build to download, the
   `offers` node and the FAQ's first answer change in the same commit or
   neither changes.

   ../lib/site carries the facts; this module only shapes them. */
import { FAQ } from './faq';
import {
  CHAT,
  FEATURES,
  LICENCE_URL,
  ORG,
  PLATFORMS,
  REPO,
  SAME_AS,
  SITE,
} from './site';

/** What the page node says about itself. The head already has both strings;
 *  passing them in is what keeps the graph and the `<title>` from being two
 *  independent claims about one document. */
export type PageFacts = { name: string; description: string };

/** The graph for one URL. `canonical` is the page's own absolute URL and
 *  `origin` the site root, so every `@id` is stable and absolute.
 *
 *  THE FAQ BELONGS TO ONE ROUTE AND THE PAGE NODE IS PER ROUTE. Both used to
 *  be neither: the graph was written when there was one page, so it typed
 *  every page as `FAQPage`, hung the six questions off it, and gave it the
 *  site's own title and description. The day the legal routes landed, the
 *  imprint was a document claiming in machine-readable form to be a frequently
 *  asked questions page about a dictation app, under a name that was not its
 *  own. Structured data that disagrees with the visible page is a liability
 *  rather than a rich result, which is the rule ADR 0257 set for this file and
 *  the rule this is the second application of.
 *
 *  The index is identified by its path rather than by a flag the caller
 *  passes. A flag is a second thing to remember at every call site; the path
 *  is already known here and cannot be forgotten. */
export function graph(canonical: URL, origin: URL, page: PageFacts) {
  const id = (hash: string) => `${origin.href}#${hash}`;
  const abs = (path: string) => new URL(path, origin).href;
  const isIndex = canonical.pathname === '/';

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': id('org'),
        name: ORG.name,
        description: ORG.description,
        url: ORG.url,
        logo: { '@type': 'ImageObject', url: abs(ORG.logo) },
        sameAs: SAME_AS,
        parentOrganization: {
          '@type': 'Organization',
          name: ORG.parent.name,
          url: ORG.parent.url,
        },
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'technical support',
          email: SITE.email,
          availableLanguage: ['en', 'de'],
        },
      },
      {
        '@type': 'WebSite',
        '@id': id('website'),
        url: origin.href,
        name: SITE.name,
        description: SITE.description,
        inLanguage: SITE.locale,
        publisher: { '@id': id('org') },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': id('app'),
        name: SITE.name,
        description: SITE.description,
        url: origin.href,
        applicationCategory: 'UtilitiesApplication',
        applicationSubCategory: 'Dictation and speech to text',
        operatingSystem: PLATFORMS,
        license: LICENCE_URL,
        isAccessibleForFree: true,
        featureList: [...FEATURES],
        discussionUrl: CHAT,
        image: abs(SITE.og.path),
        author: { '@id': id('org') },
        publisher: { '@id': id('org') },
        sameAs: [REPO],
      },
      {
        '@type': isIndex ? ['WebPage', 'FAQPage'] : 'WebPage',
        '@id': canonical.href,
        url: canonical.href,
        name: page.name,
        description: page.description,
        inLanguage: SITE.locale,
        isPartOf: { '@id': id('website') },
        /* `about` stays on every page, and it is right on all of them: the
           imprint and the privacy notice are about this application too, which
           is the whole reason a reader opens them. */
        about: { '@id': id('app') },
        primaryImageOfPage: { '@type': 'ImageObject', url: abs(SITE.og.path) },
        ...(isIndex && {
          mainEntity: FAQ.map((x) => ({
            '@type': 'Question',
            name: x.q,
            acceptedAnswer: { '@type': 'Answer', text: x.a },
          })),
        }),
      },
    ],
  };
}

/** Serialised for an inline `<script>`. Every `<` is escaped, because a
 *  literal `</script>` anywhere inside a JSON string ends the element early
 *  and the rest of the graph is parsed as markup. Nothing in this graph
 *  contains one today, and that is exactly the kind of thing that stops being
 *  true without anyone noticing. */
export function graphJson(canonical: URL, origin: URL, page: PageFacts): string {
  return JSON.stringify(graph(canonical, origin, page)).replace(/</g, '\\u003c');
}
