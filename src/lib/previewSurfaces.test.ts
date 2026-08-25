/// <reference types="node" />
/* Reads the tree rather than rendering it, the same way `surfaceCopy.test.ts`
   and `modelCatalogue.test.ts` do and for the same reason: the rule is about
   what is WRITTEN in the source, and rendering every screen in every state to
   find one literal would be a slower test that covers less. */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PREVIEW_SURFACES, previewVisible, developerMode } from "./previewSurfaces";

/**
 * ONE REGISTRY, AND A MARKER MAY NOT BE SPELLED OUTSIDE IT.
 *
 * The switch this guards was, before it existed, three dozen inline conditions
 * and 33 literal sentences across 18 files. That shape is wrong within one
 * release for a reason a review comment cannot fix: the next preview surface
 * will not know the switch exists, so it will be drawn with a literal, and a
 * literal is invisible to the filter — it ships visible in a build a stranger
 * installed. So the rule is an instrument, which is the shape the model
 * catalogue already has (ADR 0115).
 *
 * THE GALLERY IS EXEMPT AND ONLY THE GALLERY. It is the acceptance surface for
 * drawn screens (ADR 0055): its own chrome demonstrates the components,
 * including this one, and a demonstration is a literal by definition.
 */
const SRC = "src";

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path)) out.push(path);
  }
  return out;
}

/** The two files that DEFINE the markers, and the gallery that demonstrates them. */
function isExempt(file: string): boolean {
  const path = file.split(/[\\/]/).join("/");
  return (
    path.includes("src/components/shell/PreviewTag.tsx") ||
    path.includes("src/components/shell/PreviewBanner.tsx") ||
    path.includes("src/windows/gallery/")
  );
}

/** Opening tags of `name`, with their attribute text. */
function openingTags(text: string, name: string): { at: number; attrs: string }[] {
  const found: { at: number; attrs: string }[] = [];
  const re = new RegExp(`<${name}(?=[\\s/>])`, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    let depth = 0;
    let quote: string | null = null;
    const start = match.index + name.length + 1;
    let i = start;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (quote) {
        if (ch === "\\") i++;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") quote = ch;
      else if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === ">" && depth === 0) break;
    }
    found.push({ at: match.index, attrs: text.slice(start, i) });
  }
  return found;
}

const lineOf = (text: string, at: number) => text.slice(0, at).split("\n").length;

describe("the preview registry", () => {
  it("has one entry per id, and every entry says what off does to it", () => {
    const ids = PREVIEW_SURFACES.map((entry) => entry.id);
    expect(new Set(ids).size, "an id is declared twice").toBe(ids.length);
    for (const entry of PREVIEW_SURFACES) {
      expect(entry.says.length, `${entry.id} says nothing`).toBeGreaterThan(0);
      expect(["remove", "unmark"], `${entry.id} has no kind`).toContain(entry.whenOff);
    }
  });

  /**
   * The one behaviour the whole switch exists for, held as a fact rather than
   * as a rendering: OFF removes what does nothing and keeps what works.
   */
  it("removes the inert and keeps the partly wired, with the switch off", () => {
    for (const entry of PREVIEW_SURFACES) {
      expect(previewVisible(entry.id, true), `${entry.id} hidden in developer mode`).toBe(true);
      expect(previewVisible(entry.id, false)).toBe(entry.whenOff === "unmark");
    }
  });

  it("reads a config that predates the field as off", () => {
    expect(developerMode(null)).toBe(false);
    expect(developerMode(undefined)).toBe(false);
    expect(developerMode({ developer_mode: undefined })).toBe(false);
    expect(developerMode({ developer_mode: false })).toBe(false);
    expect(developerMode({ developer_mode: true })).toBe(true);
  });

  /**
   * A marker with a literal instead of an id is a marker the filter cannot
   * reach. It renders unconditionally, which in a released build is the
   * fake-readiness defect the switch was built to close.
   */
  it("spells no marker outside itself", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      if (isExempt(file)) continue;
      const text = readFileSync(file, "utf8");
      for (const name of ["PreviewTag", "PreviewBanner"]) {
        for (const tag of openingTags(text, name)) {
          if (/\bid=/.test(tag.attrs)) continue;
          offenders.push(`${file}:${lineOf(text, tag.at)} — <${name}${tag.attrs.trim() ? " …" : ""}> with no registry id`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
