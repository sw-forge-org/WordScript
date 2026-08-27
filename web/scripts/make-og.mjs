/* THE SOCIAL CARD, DRAWN BY THE SITE RATHER THAN BESIDE IT.

   `assets/OG.png` was a still from before the page had a design: its pitch set
   in a sans italic this site declares nowhere, the app icon at 242 pixels
   against the header's 26 so that its border read as a frame, and a sentence
   naming the category the product is trying to leave. Nothing in it could
   drift back into agreement with the site, because nothing in it came from the
   site.

   So the card is rendered from the same tokens the page renders from -- the
   ground, the lamp, the ruled sheet, the grain, the optical-size axis and the
   one italic -- and this file is the only place that arrangement exists. Run
   it when the page's opening claim, the wordmark or the palette moves:

     npm run og                          # writes ../assets/OG.png
     node scripts/make-og.mjs --variant a --out /tmp/a.png

   IT IS NOT A BUILD STEP. `prebuild` copies `assets/OG.png` into `public/`;
   producing it needs a Chrome on the machine, and a site that builds from a
   clone (ADR 0259) cannot have a browser in its critical path. The PNG is
   committed, this script says how it was made, and the two are kept together
   by the comment rather than by a hook.

   EVERYTHING IS INLINED AS A data: URI. A file:// page in headless Chrome
   cannot read a sibling file without --allow-file-access-from-files, and a
   mask that silently fails to load produces a card with the wordmark missing
   and no error anywhere. Base64 costs a temporary 200 KB and cannot fail
   halfway. */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '..');
const repo = join(web, '..');

/* ---- the arguments ------------------------------------------------------ */
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const variant = (arg('variant', 'b') || 'b').toLowerCase();
const out = resolve(arg('out', join(repo, 'assets', 'OG.png')));
const keepHtml = argv.includes('--keep-html');

/* ---- the assets, inlined ------------------------------------------------ */
const b64 = async (path, mime) =>
  `data:${mime};base64,${(await readFile(path)).toString('base64')}`;

const [archivo, fraunces, mono400, mono500, wordmark, icon] = await Promise.all([
  b64(join(web, 'public/fonts/archivo-latin-variable.woff2'), 'font/woff2'),
  b64(join(web, 'public/fonts/fraunces-400-italic.woff2'), 'font/woff2'),
  b64(join(web, 'public/fonts/ibm-plex-mono-400.woff2'), 'font/woff2'),
  b64(join(web, 'public/fonts/ibm-plex-mono-500.woff2'), 'font/woff2'),
  b64(join(repo, 'assets/wordscript_wordmark.png'), 'image/png'),
  b64(join(repo, 'assets/logos/wordscript-icon-128.png'), 'image/png'),
]);

/* ---- what the card says -------------------------------------------------
   The heading is the page's own h1 and the strip is the page's own fact strip,
   in words rather than in marks. `osMarks.ts` measured its set at 16px against
   11px type and dropped the GNU head for being a smudge at that size; a card
   is met at a third of its drawn width in a feed, so every mark on it would be
   arriving at about five pixels. Words survive the same reduction as texture
   and read exactly when the reader opens the card.

   AND THE STRIP DOES NOT REPEAT THE HEADING. The three facts are the ones the
   hero carries beside the window: the licence, the desktops, and the four
   lanes -- none of which the sentence above them states. */
const FACTS = ['AGPL-3.0-only', 'macOS, Windows, Linux', 'cloud, local, your server, enterprise'];

/* The delivered line in variant b is the cleanup scene's own `out`, cut at the
   comma: the full sentence sets three lines in a window this size and a card
   is not read for its third line. The cut is at a clause boundary, so what is
   shown is a true prefix of what the runtime produces rather than an ellipsis
   standing in for text nobody wrote. */
const SCENE = {
  win: 'A message to your team',
  raw: [['so i think we should ', 0], ['um', 1], [' ship ', 0], ['the the', 1], [' migration on friday', 0]],
  out: 'So I think we should ship the migration on Friday,',
};

/* ---- the page ------------------------------------------------------------
   The token block is `web/src/styles/globals.css` verbatim, cut to what a
   1200x630 still needs. The ruled sheet and the lamp are `.pin` and
   `.pin::after` from `web/src/styles/site.css`, with two numbers changed and
   both changed for the same reason: the card is a fixed 630px tall where the
   plane is a viewport, so the lamp is placed against the heading's real centre
   here rather than against a proportion of an unknown height. */
const css = `
@font-face{font-family:'Archivo';src:url('${archivo}') format('woff2');font-weight:100 900;font-style:normal}
@font-face{font-family:'Fraunces';src:url('${fraunces}') format('woff2');font-weight:400;font-style:italic}
@font-face{font-family:'Plex Mono';src:url('${mono400}') format('woff2');font-weight:400;font-style:normal}
@font-face{font-family:'Plex Mono';src:url('${mono500}') format('woff2');font-weight:500;font-style:normal}

:root{
  --bg-base:#1c1c1e; --bg-inset:#161617; --bg-surface:#2e2e31;
  --fg:#f2efe9; --fg-dim:#c2bfb8; --fg-muted:#9b9892;
  --accent:#ff9c2b; --danger:#ff7a6b;
  --border:rgba(255,255,255,.10);
  --elev-window:0 24px 70px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.08);
  --r-window:10px; --r-small:4px;
  --f-ui:'Archivo',sans-serif; --f-mono:'Plex Mono',monospace; --f-em:'Fraunces',serif;
  /* the sheet's pitch is the lede's line box, 16px at 1.62 -- site.css */
  --rule:26px;
}

*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  width:1200px;height:630px;overflow:hidden;
  background:var(--bg-base);color:var(--fg);
  font-family:var(--f-ui);
  -webkit-font-smoothing:antialiased;
}

.card{position:relative;width:1200px;height:630px;overflow:hidden;
  /* the lamp as a ground wash, centred on the heading and not on the box */
  background-image:radial-gradient(ellipse 58% 62% at 30% 50%,rgba(255,156,43,.085),transparent 72%);
}
/* the sheet: it EXISTS only where the light falls, which is what makes the
   surface read as one thing lit from one place instead of two effects stacked */
.card::before{
  content:"";position:absolute;inset:0;z-index:0;
  background:repeating-linear-gradient(180deg,rgba(242,239,233,.10) 0 1px,transparent 1px var(--rule));
  -webkit-mask-image:
    linear-gradient(180deg,transparent,#000 11%,#000 82%,transparent),
    radial-gradient(ellipse 78% 78% at 30% 50%,#000 26%,transparent 78%);
  -webkit-mask-composite:source-in;
}
/* paper grain, felt rather than seen -- globals.css */
.card::after{
  content:"";position:absolute;inset:0;z-index:3;pointer-events:none;opacity:.055;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='4' stitchTiles='stitch'/></filter><rect width='128' height='128' filter='url(%23g)'/></svg>");
  background-size:128px 128px;
}
.in{position:relative;z-index:2;height:100%;padding:60px 64px;display:flex;flex-direction:column}

/* ---- the lock-up, the page's own, scaled ---- */
.head{display:flex;align-items:center;justify-content:space-between}
.brand{display:inline-flex;align-items:center;gap:15px}
.brand img{width:46px;height:48px;display:block}
.brand .wm{
  display:block;width:210px;height:36px;background:var(--fg);
  -webkit-mask:url('${wordmark}') no-repeat left center/contain;
}
.dom{font-family:var(--f-mono);font-weight:400;font-size:19px;letter-spacing:.02em;color:var(--fg-muted)}

/* ---- the claim ---- */
.body{flex:1;display:flex;align-items:center;gap:56px;min-height:0}
/* the heading takes the slack so the window sits on the right margin and the
   card reads as the page's two columns rather than as a block that stopped */
.body h1{flex:1;min-width:0}
h1{
  margin:0;font-family:var(--f-ui);font-weight:600;
  font-stretch:95%;line-height:1.08;letter-spacing:-.032em;
}
h1 span{display:block}
/* THE CARD DOES NOT CORRECT THE WORD SPACE, AND IT NEARLY DID.
   The italic rides on a slope and reads tight against the roman before it, and
   the first pass here padded it. Measured, that was unfounded: the gap between
   the right edge of "Speak" and the ink of "once" is 7.58px at the page's
   largest 48, 11.06 at this card's 70 and 15.16 at 96 -- a ratio of 0.1579,
   0.1580 and 0.1579 of the size. The setting is identical at every size, so a
   correction made only here would have been the card disagreeing with the page
   about the same three words. If the pair is ever tightened it is tightened in
   site.css, where both read it. */
em{font-family:var(--f-em);font-style:italic;font-weight:400;font-size:1.19em;color:var(--accent)}

/* ---- the fact strip, the hero's own ---- */
.facts{display:flex;align-items:center;gap:0;
  font-family:var(--f-mono);font-weight:400;font-size:19px;letter-spacing:.02em;color:var(--fg-muted)}
.facts b{font-weight:400}
.facts b+b::before{
  content:"";display:inline-block;vertical-align:.28em;
  width:4px;height:4px;border-radius:50%;background:var(--fg-muted);opacity:.5;margin:0 18px;
}

/* ---- variant b: the window out of the hero ---- */
.win{
  flex:none;width:472px;padding:15px 21px 21px;
  border:1px solid var(--border);border-radius:var(--r-window);
  background:var(--bg-inset);box-shadow:var(--elev-window);
}
.chrome{display:flex;align-items:center;gap:10px;margin-bottom:15px}
.dots{display:inline-flex;gap:6px}
.dots i{width:9px;height:9px;border-radius:50%;background:rgba(242,239,233,.14)}
.chrome .t{font-family:var(--f-mono);font-size:13px;color:var(--fg-muted);white-space:nowrap}
.chrome .k{margin-left:auto;font-family:var(--f-mono);font-size:13px;color:var(--accent);opacity:.85}
/* the raw pass and the delivered one, the demo's own two rows. The fillers are
   tinted rather than struck: a strikethrough at this size is a hairline that
   the feed's reduction removes, and the tint survives it as a colour. */
.win .raw{font-size:16px;line-height:1.5;color:var(--fg-dim)}
.win .raw i{font-style:normal;color:var(--danger);background:rgba(255,122,107,.10);border-radius:var(--r-small)}
.win .sep{height:1px;margin:13px 0;background:var(--border)}
.win .out{font-size:20px;line-height:1.5;color:var(--fg);text-wrap:balance}
.caret{display:inline-block;width:2px;height:1.05em;margin-left:2px;background:var(--accent);vertical-align:-.16em}
`;

const lockup = `
  <div class="head">
    <div class="brand"><img src="${icon}" alt=""><span class="wm"></span></div>
    <div class="dom">wordscript.dev</div>
  </div>`;

const strip = `<div class="facts">${FACTS.map((f) => `<b>${f}</b>`).join('')}</div>`;

const heading = (size) => `
  <h1 style="font-size:${size}px">
    <span>Speak <em>once</em>.</span>
    <span>It lands. It stays.</span>
    <span>It acts.</span>
  </h1>`;

const raw = SCENE.raw.map(([t, fill]) => (fill ? `<i>${t}</i>` : t)).join('');

const window_ = `
  <div class="win">
    <div class="chrome">
      <span class="dots"><i></i><i></i><i></i></span>
      <span class="t">${SCENE.win}</span>
      <span class="k">Ctrl+Super</span>
    </div>
    <div class="raw">${raw}</div>
    <div class="sep"></div>
    <div class="out">${SCENE.out}<span class="caret"></span></div>
  </div>`;

const VARIANTS = {
  /* a -- the claim alone. Three lines at 96px survive a feed's third-scale
     reduction, which is the only size test a card has to pass. */
  a: `${lockup}<div class="body">${heading(96)}</div>${strip}`,
  /* b -- the claim, and the window beside it saying it already happened */
  b: `${lockup}<div class="body">${heading(70)}${window_}</div>${strip}`,
};

if (!VARIANTS[variant]) {
  console.error(`make-og: no variant "${variant}"; have ${Object.keys(VARIANTS).join(', ')}`);
  process.exit(1);
}

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>WordScript social card</title><style>${css}</style></head>
<body><div class="card"><div class="in">${VARIANTS[variant]}</div></div></body></html>`;

/* ---- render -------------------------------------------------------------
   --virtual-time-budget rather than a sleep: it advances the page's clock
   until the queue is empty, so the shot is taken after the four faces have
   been parsed rather than after a guess about how long that takes. */
const work = join(tmpdir(), `wordscript-og-${process.pid}`);
await mkdir(work, { recursive: true });
const page = join(work, 'og.html');
await writeFile(page, html);
await mkdir(dirname(out), { recursive: true });

const CHROME = process.env.CHROME_BIN || 'google-chrome-stable';
await run(CHROME, [
  '--headless',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--window-size=1200,630',
  '--virtual-time-budget=4000',
  `--screenshot=${out}`,
  `file://${page}`,
]);

if (keepHtml) console.log(`make-og: page kept at ${page}`);
else await rm(work, { recursive: true, force: true });

/* ---- and then the palette, WHICH THE GRAIN PAYS FOR --------------------
   Chrome writes 24-bit and the card costs 603 KB, which is three times what
   it needs to be for a file every link preview on the internet fetches. The
   card is one dark wash, one warm lamp and four type colours, so 255 entries
   hold it: measured against the truecolour original the whole image is
   0.78 per cent RMSE and the lamp does not band, because the paper grain is
   already a dither. 603 KB -> 196 KB, and the two are not told apart at 200
   per cent on the gradient.

   IT IS OPTIONAL AND IT SAYS SO. ImageMagick is not a dependency of this
   repository; where it is missing the truecolour PNG is the output and the
   line below is the only difference. */
try {
  await run('magick', [out, '-strip', '-colors', '255', '-define', 'png:compression-level=9', out]);
} catch {
  console.log('make-og: no ImageMagick, the card stays truecolour and about three times the size.');
}

console.log(`make-og: variant ${variant} -> ${out}`);
