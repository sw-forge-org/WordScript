import type { APIRoute } from 'astro';
import { SITE } from '../lib/site';

/* GENERATED RATHER THAN PARKED IN public/, FOR ONE REASON: the `Sitemap:`
   line is an absolute URL, and an absolute URL typed into a static file is a
   second copy of `site` in astro.config.mjs. It is read off the build here, so
   a domain change is one edit and not two.

   THE CRAWLER POLICY IS A DECISION AND NOT A DEFAULT. Everything is allowed,
   AI crawlers included: GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot,
   Google-Extended, CCBot. This is an AGPL project whose source is public
   anyway, its readers arrive from GitHub and Discord rather than from a
   ranking, and being quotable inside an assistant is the surface that
   substitutes for the search traffic the site does not have yet. Blocking the
   training crawlers would buy nothing that the licence has not already given
   away, and would cost the citation.

   They are not listed as their own groups on purpose. A named group replaces
   the `*` group for that agent rather than adding to it, so the day a
   `Disallow` is added below, six agents would silently keep the old rule. One
   group, one policy, and this comment carries the rest.

   WHAT THIS FILE CANNOT DO. A Cloudflare Bot Fight Mode or WAF rule turns AI
   crawlers away at the edge no matter what is written here. If citation ever
   matters enough to check, the check is in the zone's bot settings and in the
   request logs, not in this file. */
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('sitemap-index.xml', site);

  const body = `# ${SITE.name} -- ${site?.host ?? 'wordscript.dev'}
# Every crawler is welcome, including the AI ones. See src/pages/robots.txt.ts
# for why that is a decision rather than an omission.

User-agent: *
Allow: /

Sitemap: ${sitemap.href}
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
