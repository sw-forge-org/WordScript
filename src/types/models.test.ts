/// <reference types="node" />
/* The third file in this tree that reads the tree, for the reason the other two
   do: the fact it asserts spans two languages and no compiler sees both sides. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * THE INSTALL MIRROR, HELD BY A TEST (B5, ADR 0122).
 *
 * `src/types/models.ts` restates structs `src-tauri/src/core/model_install.rs`
 * declares. It is the same arrangement `providers.test.ts` keeps one axis over
 * and it exists for the same reason: a field that arrives under a different
 * name reads as `undefined`, and `undefined` on this surface would be a row
 * claiming a model is not installed because nobody spelled `in_use_by` the
 * same way twice.
 */

const RUST = readFileSync(
  join("src-tauri", "src", "core", "model_install.rs"),
  "utf8",
);
const MIRROR = readFileSync(join("src", "types", "models.ts"), "utf8");

function rustStructFields(source: string, name: string): string[] {
  const start = source.indexOf(`pub struct ${name} {`);
  expect(start, `Rust declares no struct ${name}`).toBeGreaterThan(-1);
  const body = source.slice(start + `pub struct ${name} {`.length);
  const end = body.indexOf("\n}");
  expect(end, `struct ${name} is not closed`).toBeGreaterThan(-1);

  return body
    .slice(0, end)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("pub "))
    .map((line) => line.slice("pub ".length).split(":")[0].trim());
}

function mirrorInterfaceFields(source: string, name: string): string[] {
  const start = source.indexOf(`export interface ${name} {`);
  expect(start, `the mirror declares no interface ${name}`).toBeGreaterThan(-1);
  const body = source.slice(start + `export interface ${name} {`.length);
  const end = body.indexOf("\n}");
  expect(end, `interface ${name} is not closed`).toBeGreaterThan(-1);

  const fields: string[] = [];
  let inBlockComment = false;
  for (const raw of body.slice(0, end).split("\n")) {
    const line = raw.trim();
    if (inBlockComment) {
      if (line.includes("*/")) inBlockComment = false;
      continue;
    }
    if (line.startsWith("/*")) {
      if (!line.includes("*/")) inBlockComment = true;
      continue;
    }
    if (line.startsWith("//") || line.startsWith("*") || line === "") continue;

    const match = /^([A-Za-z_][A-Za-z0-9_]*)\??\s*:/.exec(line);
    if (match) fields.push(match[1]);
  }
  return fields;
}

describe("the install mirror and the Rust struct", () => {
  it("carries the same fields for ManagedModelRow", () => {
    expect(mirrorInterfaceFields(MIRROR, "ManagedModelRow")).toEqual(
      rustStructFields(RUST, "ManagedModelRow"),
    );
  });

  it("carries the same fields for ModelLibrary", () => {
    expect(mirrorInterfaceFields(MIRROR, "ModelLibrary")).toEqual(
      rustStructFields(RUST, "ModelLibrary"),
    );
  });

  it("carries the same fields for LocalServerAnswer", () => {
    expect(mirrorInterfaceFields(MIRROR, "LocalServerAnswer")).toEqual(
      rustStructFields(RUST, "LocalServerAnswer"),
    );
  });

  /* The event is the half no command answers, so a rename here is silent until
     a download draws a percentage that never moves. */
  it("carries the same fields for ModelInstallEvent", () => {
    expect(mirrorInterfaceFields(MIRROR, "ModelInstallEvent")).toEqual(
      rustStructFields(RUST, "ModelInstallEvent"),
    );
  });

  /**
   * **The channel is its own name on both sides, and never a session channel.**
   * ADR 0018 and ADR 0019 spent a leg each establishing that a session ends in
   * exactly one reducer commit; a download must not be able to reach the
   * reducer, and the cheapest guarantee is that it does not have the door.
   */
  it("speaks on its own channel and not on either session channel", () => {
    expect(RUST).toContain('MODEL_EVENT_CHANNEL: &str = "wordscript-model-event"');
    expect(MIRROR).toContain('MODEL_EVENT_CHANNEL = "wordscript-model-event"');
    expect(RUST).not.toContain('"wordscript-event"');
    expect(RUST).not.toContain('"wordscript-native-event"');
  });

  /* The parser is the load-bearing part of every assertion above: one that
     silently found nothing would make all of them pass on two empty lists. */
  it("reads real fields out of both files rather than passing on two empty lists", () => {
    expect(rustStructFields(RUST, "ManagedModelRow")).toContain("in_use_by");
    expect(mirrorInterfaceFields(MIRROR, "ManagedModelRow")).toContain("in_use_by");
    expect(rustStructFields(RUST, "ManagedModelRow").length).toBe(9);
  });
});
