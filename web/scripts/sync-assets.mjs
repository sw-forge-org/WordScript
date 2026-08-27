/* The site draws the repository's own marks. They live in <repo>/assets and
   are copied into public/ at build time rather than duplicated into the tree,
   so a refreshed logo is one file changed and not two. public/assets is
   gitignored for the same reason: a copy that can be committed is a copy that
   can drift. */
import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const out = join(here, '..', 'public', 'assets');

const files = [
  ['assets/logos/wordscript-icon-128.png', 'logos/wordscript-icon-128.png'],
  ['assets/logos/sw-forge-logo-transparent.png', 'logos/sw-forge-logo-transparent.png'],
  ['assets/OG.png', 'OG.png'],
  ['assets/wordscript_wordmark.png', 'wordscript_wordmark.png'],
  /* THE TWO SQUARE ICONS, AND THEY COME OUT OF THE APP RATHER THAN OUT OF
     assets/. The mark in assets/logos is 121x128, which is the lock-up rather
     than an icon: a browser tab scales it and iOS refuses a non-square
     apple-touch-icon outright. src-tauri/icons already ships the app's own
     icon at both sizes, drawn square, so the site takes those instead of
     having a third rendition made for it. */
  ['src-tauri/icons/32x32.png', 'icons/icon-32.png'],
  ['src-tauri/icons/icon.png', 'icons/icon-512.png'],
];

for (const [from, to] of files) {
  const dest = join(out, to);
  await mkdir(dirname(dest), { recursive: true });
  await cp(join(repo, from), dest);
}

console.log(`sync-assets: ${files.length} files into public/assets`);
