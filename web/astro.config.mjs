// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { LEGAL_ROUTES } from './src/lib/routes';

/* Static output is the default and is deliberate: the site renders no dynamic
   data, so there is no server entrypoint and no Cloudflare adapter. Wrangler
   serves ./dist as Workers static assets. PRODUCT.md Stack carries the two
   deviations from the SW labs default that got us here. */
export default defineConfig({
  site: 'https://wordscript.dev',
  /* THE SITEMAP LISTS WHAT MAY BE INDEXED, AND NOTHING ELSE. /docs is a scope
     item; the integration is what keeps the file correct on the day it lands
     rather than a list somebody has to remember.

     TWO EXCLUSIONS, FOR THE SAME REASON AND BY THE SAME RULE. The 404 is
     reachable, renders, and is not a page anybody should be sent to from a
     search result. The legal routes this site still builds -- the privacy
     notice and the terms -- carry `noindex` off ./src/layouts/Legal.astro,
     which ADR 0264 records. The imprint sits in the same list and is skipped
     by the same comparison for a different reason: it is an absolute URL on
     another host, so no page this site builds ever matches it. A sitemap is a request to index, so
     a noindexed URL listed here is the site contradicting itself in two files
     -- and Search Console reports exactly that, as `Submitted URL marked
     noindex`, an error class that would sit in the report forever because
     nothing about it is wrong to fix.

     THE ROUTES ARE READ, NOT RETYPED. ./src/lib/routes owns that list for the
     footer and for /llms.txt; a fourth route added there has to leave the
     sitemap in the same edit or not at all. Its trailing slash is the
     canonical form, which is what makes the comparison below exact.

     The unused namespaces are dropped: there is no news, no video and no
     second language on this site, and their declarations are bytes a crawler
     parses for nothing. */
  integrations: [
    react(),
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        return path !== '/404/' && !LEGAL_ROUTES.some((r) => r.href === path);
      },
      namespaces: { news: false, video: false, xhtml: false },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    // One stylesheet rather than a per-page injection, because there is one
    // page and the sketch's cascade is written as a single document.
    inlineStylesheets: 'never',
  },
});
