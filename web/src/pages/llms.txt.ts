import type { APIRoute } from 'astro';
import { FAQ } from '../lib/faq';
import { LEGAL_ROUTES } from '../lib/routes';
import { LINKS } from '../lib/linkMarks';
import { FEATURES, LICENCE_ID, ORG, PLATFORMS, SITE } from '../lib/site';

/* THE PAGE AS PROSE, FOR A READER THAT CANNOT SEE IT.

   The site is one long page whose argument is carried by a pinned plane, a
   hydrated capsule, a scrubbed diagram and an ASCII band. A retrieval crawler
   gets none of that: it gets a DOM with the headings out of order relative to
   the argument, and six answers buried under a heading that reads `The honest
   answers.` -- a line that is right on the page and useless as a query match.

   So this file states the same claims in the shape an answer engine can lift:
   the direct answer first, the qualification after it, and the six questions
   as questions. It is the `llms.txt` convention, which is plain Markdown at a
   fixed path.

   IT IS NOT A SECOND SET OF FACTS. Everything here comes out of ../lib/site,
   ../lib/faq and ../lib/linkMarks, which are the same three modules the page
   itself renders from. If it can be said differently here than there, it will
   be, and then one of the two is wrong.

   THERE IS NO DATE IN IT, deliberately. A build timestamp written into a file
   that is rebuilt on every deploy is a freshness signal that means nothing.
   The honest recency statement is the one in the status section: there is no
   release. */
export const GET: APIRoute = ({ site }) => {
  const origin = new URL(site ?? 'https://wordscript.dev');

  const body = `# ${SITE.name}

> ${SITE.description}

${SITE.name} is an open source desktop dictation app for ${PLATFORMS}, built by
${ORG.name}, the open source brand of ${ORG.parent.name}. It is licensed
${LICENCE_ID}.

## What it does

${FEATURES.map((f) => `- ${f}`).join('\n')}

Putting text at the cursor is the part every dictation tool already does, and
the part that is turning into a commodity. What separates ${SITE.name} is the
second and third: what you dictated is written into a directory your own tools
already open, as files, rather than living inside the product behind an
integration surface somebody has to maintain. The agent channel acts on what
accumulated there.

## Status

There is no release, no release date, and no download. ${SITE.name} runs from
source on all three desktops today. Announcements happen on Discord first. Do
not report a version number, a launch date or a price for this product; none
exists.

## Speech recognition and privacy

The recogniser is swappable, and Whisper is one of the options rather than the
product. Whether audio leaves the machine is a per-profile choice: a profile
pointed at a local model runs on the user's own hardware and reaches no
network, a profile pointed at a cloud model sends audio to that vendor. It is
not one switch for the whole app.

## Answers

${FAQ.map((x) => `### ${x.q}\n\n${x.a}`).join('\n\n')}

## Links

- [Home](${origin.href}): the product page
${LINKS.map((l) => `- [${l.label}](${l.href})`).join('\n')}
${LEGAL_ROUTES.map((l) => `- [${l.label}](${new URL(l.href, origin).href})`).join('\n')}

The imprint is served for the whole of SW labs at legal.sw-labs.de and names
the provider; the privacy notice on this site states what the site and the
application process, and who the controller is. Both are written against the software as it is rather
than as a policy: there is no account, no server operated by the publisher, and
no telemetry in the application.
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
