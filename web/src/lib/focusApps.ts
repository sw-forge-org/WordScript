/* The focus band's marks, read out of the simple-icons package at build time.
   The sketch pasted fifteen path strings into the page, which put 9.3 KB of
   vendor artwork in the JS bundle and froze it at whatever a brand looked like
   on the day it was copied. This reads the same source, so a brand refresh is
   an npm update.

   Licence: Simple Icons, CC0-1.0.

   The labels are ours rather than the package's title, because two of the
   package's titles name the vendor where the row wants the application:
   Google Chrome is Chrome to the person whose cursor is in it. */
import * as icons from 'simple-icons';
import type { SimpleIcon } from 'simple-icons';

type Entry = { label: string; icon: SimpleIcon };

const ROW: Entry[] = [
  { label: 'Neovim', icon: icons.siNeovim },
  { label: 'Sublime Text', icon: icons.siSublimetext },
  { label: 'IntelliJ IDEA', icon: icons.siIntellijidea },
  { label: 'Chrome', icon: icons.siGooglechrome },
  { label: 'Firefox', icon: icons.siFirefox },
  { label: 'Gmail', icon: icons.siGmail },
  { label: 'Thunderbird', icon: icons.siThunderbird },
  { label: 'Discord', icon: icons.siDiscord },
  { label: 'Telegram', icon: icons.siTelegram },
  { label: 'Notion', icon: icons.siNotion },
  { label: 'Obsidian', icon: icons.siObsidian },
  { label: 'Google Docs', icon: icons.siGoogledocs },
  { label: 'Linear', icon: icons.siLinear },
  { label: 'Jira', icon: icons.siJira },
  { label: 'GitHub', icon: icons.siGithub },
];

/* Black is not a colour on this ground. Three of the fifteen have a brand
   colour that is black or all but black, and printing them as themselves on
   #141416 would be printing nothing; they take the page's foreground instead.

   This is a threshold rather than a list of three names, because the list
   would be a snapshot: a brand that goes monochrome next year has to fall out
   of colour on its own. Relative luminance, sRGB, the WCAG coefficients. */
function isBlackOnThisGround(hex: string): boolean {
  const ch = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
  return l < 0.02;
}

export type FocusApp = {
  label: string;
  /* null means "use the page foreground", which is what the marquee's own CSS
     falls back to when --c is not set. */
  colour: string | null;
  path: string;
};

export const FOCUS_APPS: FocusApp[] = ROW.map(({ label, icon }) => ({
  label,
  colour: isBlackOnThisGround(icon.hex) ? null : `#${icon.hex}`,
  path: icon.path,
}));
