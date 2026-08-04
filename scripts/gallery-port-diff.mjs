// THE PORT VERIFIER — the check the GUI port is judged by.
//
// Opens the running prototype and the running gallery in one headless
// Chromium, selects the same screen in both, walks each screen's block tree
// collecting computed styles, and prints the difference. A screen is ported
// when this reports zero.
//
//   python3 -m http.server 8791 --directory docs/prototypes/settings-rework
//   npm run dev
//   node scripts/gallery-port-diff.mjs home history general       [--text]
//
// Leg 2a verified by hand with a selector list and recorded two false
// positives it produces; this is that check written down, plus the third one
// (content-visibility) and the deliberate renames. Written by Leg 2b — the
// prototype is read-only, this is not, and it is a tool rather than a source.
//
// Class names are normalised by dropping the `ws-` prefix, which is the only
// naming difference the port introduces. Both trees are rooted at the screen's
// blocks — the prototype's `.content-inner` children, the gallery's
// `.ws-screen-stage` children — so a wrapper on either side shows up as a path
// that exists on one side only.
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

// Any Chromium will do. Playwright's is the one this machine already has.
const CHROME = process.env.CHROME ??
  "/home/felixontv/.cache/ms-playwright/chromium-1232/chrome-linux64/chrome";
const PORT = 9333;
const PROTO = "http://localhost:8791/index.html";
const APP = "http://localhost:1420/#/gallery";

const PROPS = ["display","flexDirection","alignItems","justifyContent","gap","padding","margin",
  "width","height","minWidth","minHeight","borderRadius","borderTopWidth","borderBottomWidth",
  "borderLeftWidth","borderColor","backgroundColor","color","fontSize","fontWeight","fontStretch",
  "letterSpacing","lineHeight","textTransform","opacity","boxShadow","flex","overflow","position",
  "textAlign","whiteSpace"];

// FALSE POSITIVE THE THIRD (after Leg 2a's stale zoom and inline-flex
// blockification): `content-visibility: auto` on `.list-item` makes an
// off-screen row report `contain-intrinsic-size` instead of its laid-out
// height. The gallery puts two more blocks above a screen than the prototype
// does, so the same row is rendered on one page and skipped on the other and
// the heights differ by 12.5 px for no reason at all. Forced visible on both
// sides for the duration of the measurement.
const UNSKIP = `(() => {
  let s = document.getElementById("__cmp_unskip");
  if (!s) { s = document.createElement("style"); s.id = "__cmp_unskip";
    // The screen picker is the rig, and the rig does not come across. It is
    // gallery chrome occupying column height the prototype spends outside its
    // mock window, so it is taken out of the flow for the measurement.
    // The screen picker and the gallery's own section masthead are both rig,
    // and the rig does not come across: they occupy column space the prototype
    // spends outside its mock window. Taken out of the flow for the
    // measurement so what is compared is the screen.
    s.textContent = "* { content-visibility: visible !important; }" +
      ".ws-screens > .ws-toolbar { display: none !important; }" +
      ".ws-content-inner > .ws-view-top { display: none !important; }";
    document.head.appendChild(s); }
  return true;
})()`;

const WALK = `(rootSel) => {
  const PROPS = ${JSON.stringify(PROPS)};
  // Deliberate renames, so the harness compares the same node rather than
  // reporting a rename as a missing element. ".right" was too generic a name
  // for a stylesheet shared with the product; ".ws-toolbar-right" is Leg 2a's.
  const ALIAS = { "toolbar-right": "right", "check-mark": "mark", "disc-n": "n",
    "stepper-val": "val", "stepper-unit": "unit", "slider-track": "track",
    "slider-knob": "knob", "slider-out": "out", "slider-input": "input",
    "level-track": "track", "level-fill": "fill", "level-hold": "hold",
    "level-thr": "thr", "level-verdict": "verdict", "level-thr-key": "thr-key",
    "kbd-edit": "edit", "banner-tag": "banner-tag", "sec-action": "sec-action",
    "brand-qual": "qual", "nav-tag": "nav-tag" };
  const norm = c => { const n = c.replace(/^ws-/, ""); return ALIAS[n] ?? n; };
  const sig = el => { const c = [...el.classList].map(norm).filter(Boolean);
    // The prototype writes the stacked row as a second class; the port writes
    // it as an attribute. Same rule, same rendering, different spelling.
    if (el.getAttribute("data-layout") === "stack") c.push("stack");
    c.sort();
    return el.tagName.toLowerCase() + (c.length ? "." + c.join(".") : ""); };
  const out = {};
  const walk = (el, path) => {
    const cs = getComputedStyle(el); const o = {};
    for (const p of PROPS) o[p] = cs[p];
    o["#text"] = [...el.childNodes].filter(n => n.nodeType === 3)
      .map(n => n.textContent).join("").replace(/\\s+/g, " ").trim();
    out[path] = o;
    const seen = {};
    for (const kid of [...el.children]) { const s = sig(kid); seen[s] = (seen[s] ?? -1) + 1;
      walk(kid, path + " > " + s + "[" + seen[s] + "]"); }
  };
  const root = document.querySelector(rootSel);
  if (!root) return JSON.stringify({ __error: "root not found: " + rootSel });
  const seen = {};
  for (const kid of [...root.children]) { const s = sig(kid); seen[s] = (seen[s] ?? -1) + 1;
    walk(kid, s + "[" + seen[s] + "]"); }
  out.__meta = { dpr: devicePixelRatio, count: Object.keys(out).length };
  return JSON.stringify(out);
}`;

let chrome, nextId = 1;
async function cdp() {
  chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`,
    "--no-first-run", "--no-default-browser-check", "--disable-gpu",
    "--window-size=1400,1000", "--user-data-dir=/tmp/wordscript-port-diff", "about:blank"],
    { stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break; }
    catch { await sleep(200); }
  }
}
async function newTab(url) {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  const t = await r.json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise(res => (ws.onopen = res));
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params) => new Promise(res => {
    const id = nextId++; pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expr) => {
    const m = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (m.result?.exceptionDetails) throw new Error(JSON.stringify(m.result.exceptionDetails.exception?.description ?? m.result.exceptionDetails));
    return m.result.result.value;
  };
  await send("Emulation.setDeviceMetricsOverride",
    { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  return { send, evaluate, close: () => ws.close() };
}

function diff(A, B, showText) {
  if (A.__error || B.__error) { console.log("  ERROR proto:", A.__error, "app:", B.__error); return 1; }
  const meta = `${A.__meta.count} vs ${B.__meta.count} nodes`;
  delete A.__meta; delete B.__meta;
  let struct = 0, style = 0, soft = 0;
  const bk = new Set(Object.keys(B));
  // Recorded divergences, each an implementation choice rather than a design
  // one, and each written up in the leg record:
  //   .wave-live  the live meter is upstream's component (a wrapper div plus
  //               its idle rule) where the prototype draws a bare canvas
  //   toggle .sr  the prototype hides a text label inside the switch; the port
  //               uses the Radix switch's aria-label
  //   slider input the port gives the slider a real range input, so it can be
  //               operated from the keyboard. The prototype's cannot be.
  const KNOWN = /wave-live|toggle\[0\] > span\.sr|slider\[0\] > span\.track\[0\] > input/;
  for (const k of Object.keys(A)) if (!bk.has(k)) { if (KNOWN.test(k)) { soft++; continue; } console.log("  ONLY IN PROTOTYPE  " + k); struct++; }
  for (const k of Object.keys(B)) if (!(k in A)) { if (KNOWN.test(k)) { soft++; continue; } console.log("  ONLY IN APP        " + k); struct++; }
  for (const k of Object.keys(A)) {
    if (!bk.has(k)) continue;
    for (const p in A[k]) {
      if (A[k][p] === B[k][p]) continue;
      if (p === "#text") { soft++; if (showText) console.log("  TEXT " + k + "\n    proto: " + A[k][p] + "\n    app:   " + B[k][p]); continue; }
      console.log("  " + k + "\n      ." + p + ": proto=" + A[k][p] + "  app=" + B[k][p]); style++;
    }
  }
  console.log(`  → ${meta} | structural ${struct} | style ${style} | text ${soft}`);
  return struct + style + soft;
}

const screens = process.argv.slice(2).filter(a => !a.startsWith("-"));
const showText = process.argv.includes("--text");
await cdp();
const proto = await newTab(PROTO);
const app = await newTab(APP);
await sleep(2500);
await app.evaluate(`[...document.querySelectorAll(".ws-nav-row")].find(r => r.textContent.includes("Screens")).click(); "ok"`);
await sleep(400);

let bad = 0;
for (const id of screens) {
  console.log("\n=== " + id + " ===");
  await proto.evaluate(`(() => { const p = document.getElementById("pick"); p.value = ${JSON.stringify(id)}; p.dispatchEvent(new Event("change", { bubbles: true })); return p.value; })()`);
  const mounted = await app.evaluate(`(() => {
    const sel = document.querySelector(".ws-toolbar select");
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(sel, ${JSON.stringify(id)});
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return document.querySelector(".ws-screen-stage")?.dataset.screen;
  })()`);
  if (mounted !== id) { console.log("  APP DID NOT MOUNT (got " + mounted + ") — not ported?"); bad++; continue; }
  await sleep(250);

  await proto.evaluate(UNSKIP); await app.evaluate(UNSKIP);
  await sleep(150);

  // MATCH THE COLUMN, NOT THE WINDOW. The prototype draws inside a mock window
  // capped at 1180 px with its own 196 px sidebar; the gallery is a real window
  // at the viewport's width with a sidebar of its own. A column layout hides
  // the difference behind `--content-max`, but a pane layout fills, so the two
  // content columns have to be brought to the same width before any width can
  // be compared. Anything left after this is the port's.
  {
    const box = `(el => { const r = el.getBoundingClientRect(); return [r.width, r.height]; })`;
    const [protoW, protoH] = await proto.evaluate(
      `${box}(document.querySelector(".modal-content .content-inner") ?? document.querySelector(".content-inner"))`);
    let [appW, appH] = await app.evaluate(`${box}(document.querySelector(".ws-content-inner"))`);
    if (Math.abs(appW - protoW) > 0.5 || Math.abs(appH - protoH) > 0.5) {
      await app.send("Emulation.setDeviceMetricsOverride", {
        width: Math.round(1440 - (appW - protoW)),
        height: Math.round(1000 - (appH - protoH)),
        deviceScaleFactor: 1, mobile: false,
      });
      await sleep(200);
      [appW, appH] = await app.evaluate(`${box}(document.querySelector(".ws-content-inner"))`);
      if (Math.abs(appW - protoW) > 0.5 || Math.abs(appH - protoH) > 0.5) {
        console.log(`  (columns still differ: ${protoW}x${protoH} vs ${appW}x${appH})`);
      }
    }
  }
  await proto.evaluate(UNSKIP); await app.evaluate(UNSKIP);
  await sleep(150);
  // A settings screen is a SHEET over a workspace screen, so the prototype
  // renders the workspace underneath it and there are two `.content-inner`
  // elements in the document. The screen under test is the modal's.
  const A = JSON.parse(await proto.evaluate(
    `(${WALK})(document.querySelector(".modal-content .content-inner") ? ".modal-content .content-inner" : ".content-inner")`));
  const B = JSON.parse(await app.evaluate(`(${WALK})(".ws-screen-stage")`));
  bad += diff(A, B, showText);
  await app.send("Emulation.setDeviceMetricsOverride",
    { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
}
proto.close(); app.close(); chrome.kill();
console.log(bad === 0 ? "\nALL EXACT" : `\n${bad} difference(s)`);
process.exit(0);
