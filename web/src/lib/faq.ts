/* THE SIX ANSWERS, IN ONE PLACE, BECAUSE THEY ARE RENDERED THREE TIMES.

   `Faq.astro` draws them, `schema.ts` emits them as a `FAQPage`, and
   `llms.txt.ts` writes them out as plain text for a retrieval crawler. Three
   readers of one array rather than three copies of six paragraphs: a schema
   that says something the visible page does not is not an advantage, it is a
   liability, and the only way to keep the two identical is to make them the
   same object.

   Plain ASCII, deliberately. The built HTML is audited for em-dashes, en-
   dashes, middle dots and curly quotes; text that reaches the page through a
   `.ts` module is not exempt from that check just because it was not typed
   into the markup. */
export type Qa = { q: string; a: string };

export const FAQ: Qa[] = [
  {
    q: 'Can I download it yet?',
    a: 'Not yet. No release, no date, and no waitlist to put your address on. It runs from source on all three desktops today, and Discord is where you will hear about it first.',
  },
  {
    q: 'Is this another wrapper around Whisper?',
    a: 'The recogniser is swappable and Whisper is one of the options. Speech to text is turning into a commodity, so it is not the product. What is: what accumulates from what you said, and what can act on it.',
  },
  {
    q: 'Does my audio leave the machine?',
    a: 'Only if you point that profile at a cloud model. The local lane runs on your own hardware and reaches nothing. It is a per-profile choice, not one switch for the whole app.',
  },
  {
    q: 'How is this different from the other open dictation apps?',
    a: 'They are good, and the dictation half genuinely overlaps. The difference is where what you said ends up. Theirs keeps it inside the product. WordScript writes it into a directory your own tools already open, so there is no second integration surface to maintain just to get it back out.',
  },
  {
    q: 'When will it be released?',
    a: 'There is no date. The gates still open are recorded in the repository, and that list is the only honest answer to this.',
  },
  {
    q: 'Can I help build it?',
    a: 'Yes, and that is the whole point of this page. The repository is open and the arguing happens on Discord.',
  },
];
