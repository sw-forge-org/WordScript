/// <reference types="node" />
/* The second file in this tree that reads the tree, and for the same reason as
   `modelCatalogue.test.ts`: the fact it asserts spans two languages and no
   compiler sees both sides. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PROVIDER_CAPABILITY_FIELDS } from "@/lib/providerSeam";

/**
 * THE MIRROR, HELD BY A TEST RATHER THAN BY DISCIPLINE (ADR 0106, ADR 0124).
 *
 * `src/types/providers.ts` restates structs `src-tauri/src/core/providers/mod.rs`
 * declares, across a gap no compiler spans. ADR 0106 requires **two** tests
 * before any document may call that mirror a guard: one that a denied
 * capability makes a row inert — `providerSeam.test.ts` — and this one, that
 * the mirror still matches the struct it mirrors.
 *
 * The donor demonstrates both halves of the same arrangement: its
 * `src/config/secretKeys.js` is a single source that `preload.js` cannot import
 * under sandbox, so the tuples are restated with *"keep BYOK_KEY_BRIDGES there
 * in sync"* and a test file named as the keeper. A comment is not the keeper.
 * This is.
 *
 * **A field added on one side and not the other fails here**, naming the field
 * and the side it is missing from — which is the whole value, because the
 * failure it replaces is a surface reading `undefined` as `false` and quietly
 * calling a working lane denied.
 */

const RUST = readFileSync(
  join("src-tauri", "src", "core", "providers", "mod.rs"),
  "utf8",
);
const MIRROR = readFileSync(join("src", "types", "providers.ts"), "utf8");

/** The `pub` field names of one Rust struct, in declaration order. */
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
    /* Doc comments, ordinary comments and derive attributes are not fields. */
    .filter((line) => line.startsWith("pub "))
    .map((line) => line.slice("pub ".length).split(":")[0].trim());
}

/** The property names of one TypeScript interface, in declaration order. */
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

describe("the TypeScript mirror and the Rust struct", () => {
  /* The struct the seam reads. Its nine fields decide whether a drawn row can
     be operated, so one that arrives under a different name is a capability
     read as absent — the failure this whole step exists to end. */
  it("carries the same fields for ProviderCapabilities", () => {
    expect(mirrorInterfaceFields(MIRROR, "ProviderCapabilities")).toEqual(
      rustStructFields(RUST, "ProviderCapabilities"),
    );
  });

  /* The list the seam validates against is a third statement of the same nine,
     and it exists because a type cannot be counted at runtime. It is held to
     the other two rather than trusted. */
  it("carries the same fields in the list the seam counts", () => {
    expect([...PROVIDER_CAPABILITY_FIELDS]).toEqual(
      rustStructFields(RUST, "ProviderCapabilities"),
    );
  });

  /* The model axis (ADR 0110). A surface reading only the provider axis proves
     the easier half, so the mirror is held on both. */
  it("carries the same fields for ModelCapabilities", () => {
    expect(mirrorInterfaceFields(MIRROR, "ModelCapabilities")).toEqual(
      rustStructFields(RUST, "ModelCapabilities"),
    );
  });

  /* The seam's first question (ADR 0124), and the one whose absence is an
     answer — so its shape has to be exactly what the command sends. */
  it("carries the same fields for RegisteredProvider", () => {
    expect(mirrorInterfaceFields(MIRROR, "RegisteredProvider")).toEqual(
      rustStructFields(RUST, "RegisteredProvider"),
    );
  });

  /* The credential axis (ADR 0105). The third sentence is composed from
     `missing`, so a rename on either side is a sentence that stops being said. */
  it("carries the same fields for RoleCredentialStatus", () => {
    expect(mirrorInterfaceFields(MIRROR, "RoleCredentialStatus")).toEqual(
      rustStructFields(RUST, "RoleCredentialStatus"),
    );
  });

  /* The parser is the load-bearing part of every assertion above: one that
     silently found nothing would make all of them pass on two empty lists. */
  it("reads real fields out of both files rather than passing on two empty lists", () => {
    expect(rustStructFields(RUST, "ProviderCapabilities").length).toBe(9);
    expect(mirrorInterfaceFields(MIRROR, "ProviderCapabilities").length).toBe(9);
    expect(rustStructFields(RUST, "ProviderCapabilities")).toContain("speech_synthesis");
    expect(mirrorInterfaceFields(MIRROR, "ProviderCapabilities")).toContain("speech_synthesis");
  });
});
