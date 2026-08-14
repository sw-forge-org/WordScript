#!/usr/bin/env node
// The caller sweep, in both directions (ADR 0089, ADR 0093, ADR 0103).
//
// Direction 1 — CALLER WITH NO COMMAND. Every invoke("name") in non-test src/
// against the invoke_handler list. A miss is a control that rejects at runtime.
// It is a bug, not a triage question.
//
// Direction 2 — COMMAND WITH NO CALLER. The invoke_handler list against those
// same calls. A miss is dead weight, triaged by why it lost its caller.
//
// The third question (ADR 0093) — for every command direction 2 names, where
// the name still appears in the tree. A name surviving in a test mock looks
// called to a name-grep and uncalled to a call-grep, and only the second is
// true.
//
// THE SCAN SPANS LINES. A line-based grep reported five live commands as
// orphans on 2026-08-11 because the name sits on the line after `invoke(`, and
// it reports false passes in direction 1 for the same reason. This reads whole
// files and strips comments and template substitutions before it matches.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const LIB_RS = join(ROOT, "src-tauri", "src", "lib.rs");

// `--frontend <dir>` scans a tree other than this checkout's `src/`. It exists
// so the sweep can be pointed at a historical one and made to FAIL: run it
// against `git archive 4445423^ src` and direction 1 must name
// `load_transcription_history`, the defect Leg 12 found. A sweep that has never
// been observed to report a defect is a sweep nobody has tested.
const frontendFlag = process.argv.indexOf("--frontend");
const FRONTEND = frontendFlag === -1 ? join(ROOT, "src") : process.argv[frontendFlag + 1];

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs)$/;
const TEST_FILE = /(\.test\.|\.spec\.|[\\/]__tests__[\\/]|[\\/]test[\\/])/;
const SKIP_DIRS = new Set(["node_modules", "dist", "target", ".git"]);

// ── reading ────────────────────────────────────────────────────────────────

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

/**
 * Strip line and block comments from TS/JS source without losing string
 * contents, so a `//` inside a URL literal does not swallow the rest of a line
 * and a command name inside a comment is never counted as a call.
 *
 * EVERY NEWLINE SURVIVES, including the ones inside a block comment. A first
 * draft dropped them, and the offsets it handed `lineOf` drifted by however
 * many lines of docblock stood above the call — the regression run reported
 * `OverlayWindow.tsx:1345` for a call on 1380. A defect report with a wrong
 * line in it is a report that has to be re-derived by hand to be used.
 */
function stripComments(source) {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") out += "\n";
        i += 1;
      }
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      out += ch;
      i += 1;
      while (i < source.length) {
        if (source[i] === "\\") {
          out += source.slice(i, i + 2);
          i += 2;
          continue;
        }
        out += source[i];
        if (source[i] === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function lineOf(source, index) {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i += 1) {
    if (source[i] === "\n") line += 1;
  }
  return line;
}

// ── direction 0: what is registered ────────────────────────────────────────

function registeredCommands() {
  const source = readFileSync(LIB_RS, "utf8");
  const start = source.indexOf("tauri::generate_handler![");
  if (start === -1) throw new Error("generate_handler! not found in lib.rs");
  const open = source.indexOf("[", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "[") depth += 1;
    else if (source[i] === "]") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const block = source
    .slice(open + 1, end)
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  return block
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((path) => ({ path, name: path.split("::").pop() }));
}

// ── direction 1: what is called ────────────────────────────────────────────

/**
 * Every `fn(...)` call in a file, with its first argument where that argument
 * is a string literal or a bare identifier. Skips the generic parameter list,
 * which may span lines and contain `>`, then reads the first argument. A first
 * argument that is neither is reported rather than dropped: the sweep cannot
 * resolve it and saying so is the point.
 *
 * THE GENERIC IS SKIPPED BY DEPTH, NEVER BY A NON-GREEDY REGEX. A first draft
 * of the event half used `listen\s*(?:<[\s\S]*?>)?\s*\(\s*"..."` and matched
 * `listen<BackendEvent>(RUNTIME_EVENT_CHANNEL, …)` against an `invoke` string
 * two hundred lines further down, because `[\s\S]*?` will happily cross the
 * end of the call it is standing in. It reported `load_app_config` and
 * `save_config` — two commands — as events nothing emits.
 */
function callsTo(source, fn) {
  const calls = [];
  const pattern = new RegExp(`\\b${fn}\\s*(?=[<(])`, "g");
  let match;
  while ((match = pattern.exec(source)) !== null) {
    let i = match.index + match[0].length;
    // Skip a generic argument list, tracking nesting so `Record<string, X>`
    // and `Array<Map<K, V>>` both close correctly.
    //
    // AN INLINE OBJECT TYPE IS THE COMMON CASE HERE, NOT THE EXCEPTION.
    // `invoke<{ history_count: number; transcript_count: number }>(` carries
    // both `{` and `;` inside its own angle brackets. A first draft of this
    // scanner treated either as proof that the `<` was a comparison and
    // abandoned the hit — which reported all five of `Privacy.tsx`'s backup
    // commands as orphans, the exact five ADR 0103 recorded as false, and
    // would have passed a direction-1 defect written in the same shape.
    if (source[i] === "<") {
      let depth = 0;
      let closed = false;
      const ceiling = i + 2000;
      while (i < source.length && i < ceiling) {
        if (source[i] === "<") depth += 1;
        else if (source[i] === ">") {
          depth -= 1;
          if (depth === 0) {
            i += 1;
            closed = true;
            break;
          }
        }
        i += 1;
      }
      if (!closed) continue;
    }
    while (i < source.length && /\s/.test(source[i])) i += 1;
    if (source[i] !== "(") continue;
    i += 1;
    while (i < source.length && /\s/.test(source[i])) i += 1;
    const quote = source[i];
    if (quote === '"' || quote === "'" || quote === "`") {
      let name = "";
      i += 1;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\") {
          i += 2;
          continue;
        }
        name += source[i];
        i += 1;
      }
      const dynamic = quote === "`" && name.includes("${");
      calls.push({ name, index: match.index, dynamic, via: null });
      continue;
    }
    // A bare identifier — a channel name held in a constant. Resolved against
    // the frontend's own string constants below; unresolved ones are reported.
    const identifier = /^[A-Za-z_$][\w$]*/.exec(source.slice(i, i + 80));
    if (identifier && !/^(await|new|function)$/.test(identifier[0])) {
      calls.push({ name: null, index: match.index, dynamic: true, via: identifier[0] });
      continue;
    }
    calls.push({ name: null, index: match.index, dynamic: true, via: null });
  }
  return calls;
}

/** `const NAME = "literal"` across the frontend, so a channel constant resolves. */
function stringConstants(paths) {
  const table = new Map();
  for (const path of paths) {
    const source = stripComments(readFileSync(path, "utf8"));
    const pattern = /\b(?:const|let|var)\s+([A-Z][A-Z0-9_]*)\s*(?::[^=]+)?=\s*"([^"]+)"/g;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      table.set(match[1], match[2]);
    }
  }
  return table;
}

// ── the same seam, the other channel ───────────────────────────────────────
//
// `invoke` is the frontend calling the runtime; an event is the runtime calling
// the frontend. It is one seam with two channels and only the first had ever
// been swept. The asymmetry is the same shape: an emitter with no listener
// compiles, runs, and delivers to nobody.

const RUST_SRC = join(ROOT, "src-tauri", "src");

/** Every `.emit(...)`/`.emit_to(...)` name in Rust, spanning lines. */
function emittedEvents() {
  const found = new Map(); // name -> [{ file, line }]
  const files = walk(RUST_SRC).filter((path) => path.endsWith(".rs"));
  for (const path of files) {
    const raw = readFileSync(path, "utf8");
    const rel = relative(ROOT, path).split(sep).join("/");
    const pattern = /\.\s*(emit|emit_to|emit_filter)\s*\(/g;
    let match;
    while ((match = pattern.exec(raw)) !== null) {
      let i = match.index + match[0].length;
      // emit_to takes the label first, so skip one argument for it.
      let toSkip = match[1] === "emit_to" ? 1 : 0;
      while (toSkip > 0) {
        let depth = 0;
        while (i < raw.length) {
          const ch = raw[i];
          if (ch === "(" || ch === "[") depth += 1;
          else if (ch === ")" || ch === "]") depth -= 1;
          else if (ch === "," && depth === 0) {
            i += 1;
            break;
          }
          i += 1;
        }
        toSkip -= 1;
      }
      while (i < raw.length && /[\s]/.test(raw[i])) i += 1;
      if (raw[i] !== '"') continue;
      i += 1;
      let name = "";
      while (i < raw.length && raw[i] !== '"') {
        name += raw[i];
        i += 1;
      }
      if (!name) continue;
      if (!found.has(name)) found.set(name, []);
      found.get(name).push({ file: rel, line: lineOf(raw, match.index) });
    }
  }
  return found;
}

/**
 * Every `listen(...)` in the frontend, product and test kept apart, with
 * channel constants resolved. `tauri://…` is the framework's own namespace —
 * emitted by Tauri rather than by this runtime, so it is not an orphan.
 */
function listenedEvents() {
  // Shares the table built beside the invoke half; see `constants` there.
  const product = new Map();
  const test = new Map();
  const unresolvable = [];
  for (const path of files) {
    const source = stripComments(readFileSync(path, "utf8"));
    const isTest = TEST_FILE.test(path.slice(ROOT.length));
    const inside = relative(ROOT, path).split(sep).join("/");
    const rel = inside.startsWith("../") ? path : inside;
    for (const call of callsTo(source, "listen")) {
      const site = { file: rel, line: lineOf(source, call.index) };
      const name = call.name ?? (call.via ? constants.get(call.via) : undefined);
      if (!name) {
        unresolvable.push({ ...site, via: call.via, test: isTest });
        continue;
      }
      if (name.startsWith("tauri://")) continue;
      const bucket = isTest ? test : product;
      if (!bucket.has(name)) bucket.set(name, []);
      bucket.get(name).push(site);
    }
  }
  return { product, test, unresolvable };
}

// ── the sweep ──────────────────────────────────────────────────────────────

const commands = registeredCommands();
const registered = new Set(commands.map((command) => command.name));

const files = walk(FRONTEND).filter((path) => CODE_EXT.test(path));
const productCalls = new Map(); // name -> [{ file, line }]
const testCalls = new Map();
const unresolved = [];

const constants = stringConstants(files);

for (const path of files) {
  const raw = readFileSync(path, "utf8");
  const source = stripComments(raw);
  const isTest = TEST_FILE.test(path.slice(ROOT.length));
  const inside = relative(ROOT, path).split(sep).join("/");
  const rel = inside.startsWith("../") ? path : inside;
  for (const call of callsTo(source, "invoke")) {
    const site = { file: rel, line: lineOf(source, call.index) };
    // A command name may sit in a constant the same way a channel name does.
    const name = call.name ?? (call.via ? constants.get(call.via) : undefined);
    if (!name) {
      unresolved.push({ ...site, test: isTest, text: `invoke(${call.via ?? "<non-literal>"})` });
      continue;
    }
    const bucket = isTest ? testCalls : productCalls;
    if (!bucket.has(name)) bucket.set(name, []);
    bucket.get(name).push(site);
  }
}

// Direction 1 — a caller with no command. This is the half that is a defect.
const callerWithNoCommand = [...productCalls.entries()]
  .filter(([name]) => !registered.has(name))
  .sort(([a], [b]) => a.localeCompare(b));

// Direction 2 — a command with no caller in non-test src/.
const commandWithNoCaller = commands
  .filter((command) => !productCalls.has(command.name))
  .sort((a, b) => a.name.localeCompare(b.name));

// The third question — where an orphan's name still appears.
const treeFiles = walk(ROOT).filter(
  (path) => CODE_EXT.test(path) || /\.(rs|json|md|css|html)$/.test(path),
);
const appearances = new Map();
for (const command of commandWithNoCaller) appearances.set(command.name, []);
if (commandWithNoCaller.length > 0) {
  for (const path of treeFiles) {
    if (path === LIB_RS) continue;
    let raw;
    try {
      raw = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    const rel = relative(ROOT, path).split(sep).join("/");
    if (rel.startsWith("docs/archive/")) continue;
    for (const command of commandWithNoCaller) {
      if (raw.includes(command.name)) appearances.get(command.name).push(rel);
    }
  }
}

// ── report ─────────────────────────────────────────────────────────────────

const bar = "─".repeat(72);
console.log(bar);
console.log(
  `Command sweep — ${registered.size} registered, ${productCalls.size} called from non-test src/`,
);
console.log(bar);

console.log("\n1. CALLER WITH NO COMMAND — a control that rejects at runtime\n");
if (callerWithNoCommand.length === 0) {
  console.log("   none.");
} else {
  for (const [name, sites] of callerWithNoCommand) {
    console.log(`   ${name}`);
    for (const site of sites) console.log(`     ${site.file}:${site.line}`);
  }
}

console.log("\n2. COMMAND WITH NO CALLER — dead weight, triaged by why\n");
if (frontendFlag !== -1) {
  console.log(
    "   NOT MEANINGFUL IN A --frontend RUN: the registered list is this\n" +
      "   checkout's and the callers are another tree's, so a command added\n" +
      "   after that tree reads as an orphan. Direction 1 is the proof.\n",
  );
}
if (commandWithNoCaller.length === 0) {
  console.log("   none.");
} else {
  for (const command of commandWithNoCaller) {
    const inTests = testCalls.has(command.name)
      ? testCalls.get(command.name).map((site) => `${site.file}:${site.line}`)
      : [];
    console.log(`   ${command.name}   (${command.path})`);
    if (inTests.length > 0) {
      console.log(`     invoked in tests: ${inTests.join(", ")}`);
    }
    const named = appearances.get(command.name).filter((rel) => !rel.startsWith("src-tauri/"));
    if (named.length > 0) {
      console.log(`     name appears in: ${named.join(", ")}`);
    }
  }
}

console.log("\n3. UNRESOLVABLE CALL SITES — the sweep cannot read these\n");
if (unresolved.length === 0) {
  console.log("   none.");
} else {
  for (const site of unresolved) {
    const kind = site.test ? "test" : "PRODUCT";
    console.log(`   ${kind}  ${site.file}:${site.line}  ${site.text ?? "<non-literal>"}`);
  }
}

// The event channel. It runs in a --frontend pass too, because that is how
// section 4 is made to FAIL: copy `src/`, delete one `listen(...)`, and point
// the sweep at the copy. Emitters always come from this checkout's Rust, so a
// --frontend pass carries the same caveat direction 2 does.
let listenerWithNoEmitter = [];
let emitterWithNoListener = [];
{
  const emitted = emittedEvents();
  const {
    product: listened,
    test: listenedInTests,
    unresolvable: unresolvableListens,
  } = listenedEvents();
  for (const site of unresolvableListens) {
    unresolved.push({ ...site, text: `listen(${site.via ?? "<non-literal>"})` });
  }

  listenerWithNoEmitter = [...listened.entries()]
    .filter(([name]) => !emitted.has(name))
    .sort(([a], [b]) => a.localeCompare(b));
  emitterWithNoListener = [...emitted.entries()]
    .filter(([name]) => !listened.has(name))
    .sort(([a], [b]) => a.localeCompare(b));

  console.log("\n4. LISTENER WITH NO EMITTER — a surface waiting for nothing\n");
  if (frontendFlag !== -1) {
    console.log("   (emitters are this checkout's; same caveat as direction 2)\n");
  }
  if (listenerWithNoEmitter.length === 0) {
    console.log("   none.");
  } else {
    for (const [name, sites] of listenerWithNoEmitter) {
      console.log(`   ${name}`);
      for (const site of sites) console.log(`     ${site.file}:${site.line}`);
    }
  }

  console.log("\n5. EMITTER WITH NO LISTENER — the runtime talking to nobody\n");
  if (emitterWithNoListener.length === 0) {
    console.log("   none.");
  } else {
    for (const [name, sites] of emitterWithNoListener) {
      console.log(`   ${name}`);
      for (const site of sites) console.log(`     ${site.file}:${site.line}`);
      if (listenedInTests.has(name)) {
        const where = listenedInTests.get(name).map((s) => `${s.file}:${s.line}`);
        console.log(`     listened in tests only: ${where.join(", ")}`);
      }
    }
  }
}

console.log(`\n${bar}`);
console.log(
  `direction 1: ${callerWithNoCommand.length} defect(s) | ` +
    `direction 2: ${commandWithNoCaller.length} orphan(s) | ` +
    `unresolvable: ${unresolved.length}`,
);
{
  console.log(
    `events — listener with no emitter: ${listenerWithNoEmitter.length} | ` +
      `emitter with no listener: ${emitterWithNoListener.length}`,
  );
}
console.log(bar);

// Only the two directions that are defects rather than triage questions fail
// the run: a caller that rejects at runtime, and a surface listening for an
// event nothing sends.
process.exitCode = callerWithNoCommand.length > 0 || listenerWithNoEmitter.length > 0 ? 1 : 0;
