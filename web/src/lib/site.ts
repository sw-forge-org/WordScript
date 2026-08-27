/* THE FACTS THE CRAWL SURFACE STATES, IN ONE PLACE.

   Four things read this module: the head in ../layouts/Base.astro, the JSON-LD
   graph in ./schema, /llms.txt and /robots.txt. Every one of them is a machine
   reading a claim about the product, and a claim that differs between them is
   worse than no claim at all -- a schema that says something the visible page
   does not is a liability rather than an advantage.

   WHAT IS DELIBERATELY NOT HERE. No version, no release date, no download URL
   and no price. `package.json` reads 0.2.2-alpha and nothing is published; the
   page says outright that there is no release and no date. A `softwareVersion`
   or an `offers` block would be the crawl surface making a promise the page
   refuses to make.

   The four outbound addresses are not repeated here either. `./linkMarks`
   already owns them for the footer row, and the same four are the
   organisation's `sameAs` set, so this module reads that list rather than
   keeping a second copy of it. */
import { LINKS } from './linkMarks';

export const SITE = {
  name: 'WordScript',
  /* Under 60 characters, name first, because it is the whole title on the one
     page that exists. A second page gets `<name> | WordScript`. */
  title: 'WordScript, an open desktop dictation app',
  /* 155 characters of the argument, not of the category. The category line is
     what every peer opens on; the differentiator is what happens after the
     text lands. */
  description:
    'What you say lands at the cursor, stays as a file in a folder you named, and can be handed to one agent that acts on it. Open source, Windows, macOS, Linux.',
  ogDescription: 'Speak once. It lands, it stays, it acts.',
  locale: 'en',
  themeColor: '#0f0f11',
  email: 'forge@sw-labs.de',
  /* 1200x630, checked against the file rather than assumed. A card served with
     the wrong dimensions is cropped by the platform, not by us.

     THE ALT IS THE CARD AND NOT THE PRODUCT. It read `WordScript`, which is
     the one thing a reader who cannot see the image already has: the title
     sits beside it in every preview that shows the card at all. What the
     picture carries and the title does not is the window -- a dictated line
     with its fillers marked and the delivered sentence under it -- so that is
     what the sentence describes. `scripts/make-og.mjs` draws it, and a card
     redrawn to say something else is a card that has to change this line. */
  og: {
    path: '/assets/OG.png',
    width: 1200,
    height: 630,
    alt: 'Speak once. It lands. It stays. It acts. Beside it a text window, holding a dictated line with its filler words marked and the cleaned sentence delivered under it.',
  },
} as const;

export const ORG = {
  name: 'SW forge',
  description: 'The open source brand of SW labs.',
  url: 'https://github.com/sw-forge-org',
  logo: '/assets/logos/sw-forge-logo-transparent.png',
  parent: { name: 'SW labs', url: 'https://sw-labs.de' },
} as const;

export const REPO = LINKS[0].href;
export const CHAT = LINKS[1].href;
export const SAME_AS = LINKS.map((l) => l.href);

/* The triangle out of docs/VISION.md, which is the authority for it, in the
   weighting the page argues: everyone does the first one, and the first one is
   becoming a commodity. */
export const FEATURES = [
  'Cursor: what you say lands in the window you already had open.',
  'Context: what you said stays as a file in a directory your own tools already open.',
  'Agent: what accumulated can be handed to one agent that acts on it.',
] as const;

export const PLATFORMS = 'Windows, macOS, Linux';
export const LICENCE_URL = 'https://www.gnu.org/licenses/agpl-3.0.html';
export const LICENCE_ID = 'AGPL-3.0-only';
