// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

/* Static output is the default and is deliberate: the site renders no dynamic
   data, so there is no server entrypoint and no Cloudflare adapter. Wrangler
   serves ./dist as Workers static assets. PRODUCT.md Stack carries the two
   deviations from the SW labs default that got us here. */
export default defineConfig({
  site: 'https://wordscript.dev',
  /* ONE URL TODAY, AND THAT IS NOT WHY IT IS HERE. Four legal routes are
     already drawn into the footer and /docs is a scope item; the integration
     is what keeps the sitemap correct on the day they land rather than a file
     somebody has to remember. The 404 is filtered because it is reachable,
     renders, and is not a page anybody should be sent to from a search result.

     The unused namespaces are dropped: there is no news, no video and no
     second language on this site, and their declarations are bytes a crawler
     parses for nothing. */
  integrations: [
    react(),
    sitemap({
      filter: (page) => !page.endsWith('/404/'),
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
