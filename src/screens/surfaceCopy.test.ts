/// <reference types="node" />
/* Reads the tree rather than rendering it, the same way
   `lib/modelCatalogue.test.ts` does and for the same reason: the rule is about
   what is WRITTEN on a surface, and rendering every screen in every state to
   find one sentence would be a slower test that covers less. `tsconfig.json`
   pins `types` to the two test globals, so Node's own are pulled in here. */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";

/**
 * ADR 0199 — what a reader of the compiled product is allowed to be shown.
 *
 * Two rules, one sweep. Both were violated in fifteen and in six places
 * respectively before the ADR, and both are the kind of defect that returns
 * silently: the prototype still carries the dead links this port removed, so
 * re-porting a screen re-introduces them, and an ADR number is the most natural
 * thing in the world to write in a repository where every other line cites one.
 *
 * The comments are deliberately NOT swept. A citation above the code is the
 * derivation, it is addressed to whoever changes the code, and it is the reason
 * the number may leave the surface without the reasoning leaving the file.
 */

const SRC = "src";

describe("what the product says to a reader who has no repository", () => {
  /**
   * A `DocLink` renders `<a href="#">` with `preventDefault()`. Without an
   * `onClick` it swallows the click and does nothing — the fake affordance
   * rule 7 forbids, which `props.ts` states about buttons and which nobody had
   * applied to a link because a link reads as prose.
   */
  it("gives every DocLink somewhere to go", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const text = stripComments(readFileSync(file, "utf8"));
      for (const tag of openingTags(text, "DocLink")) {
        if (!/\bonClick\b/.test(tag.attrs)) {
          offenders.push(`${file}:${lineOf(text, tag.at)} — <DocLink${tag.attrs}>`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  /**
   * An ADR number, a plan section or a track stage names a document that lives
   * in this repository. The reader is in a desktop application and has none, so
   * the citation is a reference they cannot follow — at best noise, at worst an
   * affordance that fails.
   *
   * ROADMAP VOCABULARY IS NOT SWEPT and that is deliberate: `Preview`,
   * `Wired in part`, `Planned for Phase 8`, `ROADMAP Phase 5`, `V2` are
   * readable statements about what is built, they are the standing way this
   * product marks unbuilt UI, and they are the material a developer mode will
   * later display.
   */
  it("cites no ADR, plan section or track stage in text a reader can see", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      if (isGalleryChrome(file)) continue;
      const text = stripComments(readFileSync(file, "utf8"));
      for (const region of visibleCopy(text)) {
        const found = region.text.match(/\bADR\s*\d{2,4}\b|§\s*\d+(\.\d+)*|\bStage [A-Z]\d+\b/);
        if (found) {
          offenders.push(`${file}:${lineOf(text, region.at)} — ${found[0]} in ${region.carrier}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

/* ── reading the tree ─────────────────────────────────────────────────────── */

/**
 * THE ONE PLACE AN ADR NUMBER MAY BE WRITTEN ON A SURFACE, and it is the
 * surface whose whole subject is why the system is the way it is. Foundations,
 * Components and Motion explain a token to the person changing it, behind a
 * chord nothing links to; a citation there is addressed to a reader who has the
 * repository open, because reaching that page requires it.
 *
 * THE SCREENS SHOWN INSIDE THE GALLERY ARE NOT EXEMPT, and that is the whole
 * point of drawing the line here rather than at `src/windows/`. A screen is one
 * implementation with two sets of props: what it says in the gallery is what it
 * will say in the product on the day it is mounted, so it is swept wherever it
 * lives. Only the gallery's own chrome is out.
 */
function isGalleryChrome(file: string): boolean {
  return file.split(sep).includes("gallery");
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!/\.tsx?$/.test(entry.name)) return [];
    return /\.test\.tsx?$/.test(entry.name) ? [] : [path];
  });
}

/** Blanked rather than deleted, so every offset still names its own line. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "))
    .replace(/(^|[^:/])\/\/[^\n]*/g, (match, lead: string) =>
      lead + " ".repeat(match.length - lead.length),
    );
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

/**
 * The attributes of every opening `<Name ...>`, with brace depth tracked so
 * that the `>` of an arrow function inside a handler does not end the tag.
 * `<DocLink onClick={() => open({ view: "profiles" })}>` is the case that
 * defeats a `[^>]*` match, and it is the shape this sweep exists to approve.
 */
function openingTags(text: string, name: string): { at: number; attrs: string }[] {
  const out: { at: number; attrs: string }[] = [];
  const opener = new RegExp(`<${name}(?=[\\s/>])`, "g");
  let match: RegExpExecArray | null;

  while ((match = opener.exec(text)) !== null) {
    const from = match.index + match[0].length;
    let depth = 0;
    let quote: string | null = null;

    for (let i = from; i < text.length; i += 1) {
      const char = text[i];
      if (quote) {
        if (char === quote && text[i - 1] !== "\\") quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") quote = char;
      else if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      else if (char === ">" && depth === 0) {
        out.push({ at: match.index, attrs: text.slice(from, i) });
        break;
      }
    }
  }
  return out;
}

/**
 * Where a sentence reaches a reader. Two shapes carry it: the children of a
 * prose component, and the string value of a copy prop.
 *
 * A bare object property is NOT copy. `ENTRY_POINT_HOLES` is data read by a
 * test and by whoever builds those doors, and the Context screen's sample
 * transcript has a fictional speaker say "It needs its own ADR" — neither is a
 * claim this product makes to anybody.
 */
const PROSE_COMPONENTS = ["Note", "PreviewBanner", "DocLink", "StatusBadge", "ScopeTag"];
const COPY_PROPS = ["hint", "description", "lead", "title", "what", "label", "placeholder"];

function visibleCopy(text: string): { at: number; carrier: string; text: string }[] {
  const out: { at: number; carrier: string; text: string }[] = [];

  for (const name of PROSE_COMPONENTS) {
    const block = new RegExp(`<${name}(?=[\\s/>])[\\s\\S]*?</${name}>`, "g");
    let match: RegExpExecArray | null;
    while ((match = block.exec(text)) !== null) {
      out.push({ at: match.index, carrier: `<${name}>`, text: match[0] });
    }
  }

  for (const prop of COPY_PROPS) {
    const assigned = new RegExp(`\\b${prop}=(?:"([^"]*)"|\\{\`([^\`]*)\`\\})`, "g");
    let match: RegExpExecArray | null;
    while ((match = assigned.exec(text)) !== null) {
      out.push({ at: match.index, carrier: `${prop}=`, text: match[1] ?? match[2] ?? "" });
    }
  }

  /* `saysSo(...)` in `windows/workspace/ia.tsx` builds a PreviewBanner from a
     string, so the banner text is an argument rather than a child. */
  const banner = /saysSo\(\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = banner.exec(text)) !== null) {
    out.push({ at: match.index, carrier: "saysSo()", text: match[1] });
  }

  return out;
}
