/// <reference types="node" />
/* The one test in this tree that reads the tree. `tsconfig.json` pins `types`
   to the two test globals, so Node's own types are pulled in for this file
   explicitly rather than widened for every file. */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  CATALOGUE,
  CATALOGUE_VERSION,
  laneJobModels,
  modelId,
  modelRow,
  providerLabel,
  runtimeDefault,
} from "./modelCatalogue";
import { LANES } from "@/screens/data";

/**
 * The frontend half of ADR 0115. `core::model_catalogue`'s tests hold the same
 * file from the other side, and the two do not duplicate each other: the Rust
 * suite proves the rows are well formed and that a catalogued model with no
 * adapter answers `unknown`, and this one proves the drawing reads them and
 * spells no model id of its own.
 */
describe("the model catalogue", () => {
  it("is the version this build was written against", () => {
    expect(CATALOGUE.version).toBe(CATALOGUE_VERSION);
    expect(CATALOGUE.models.length).toBeGreaterThan(0);
  });

  /* The rule docs/PROVIDERS.md holds itself to in prose. Asserted on both sides
     of the seam because the file is read by both, and a row added from either
     side has to satisfy it. */
  it("carries a source and a read date on every row", () => {
    for (const row of CATALOGUE.models) {
      expect(row.source.trim(), `${row.id} carries no source`).not.toBe("");
      expect(row.model_id.trim(), `${row.id} carries no model id`).not.toBe("");
      expect(row.read_date, `${row.id} read_date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("gives every row an id of its own", () => {
    const ids = CATALOGUE.models.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("names a row by a slug rather than by the model id", () => {
    /* The property the whole scheme rests on: a vendor's next generation moves
       `model_id` and every reference in this tree stands. If a slug were the id
       it would have to be renamed everywhere, which is what this file replaced. */
    for (const row of CATALOGUE.models) {
      expect(row.id).not.toBe(row.model_id);
    }
  });

  it("resolves every lane offer, and offers every lane default", () => {
    for (const [lane, jobs] of Object.entries(CATALOGUE.lanes)) {
      for (const [job, entry] of Object.entries(jobs)) {
        expect(entry.offered.length, `${lane}/${job} offers nothing`).toBeGreaterThan(0);
        expect(entry.offered, `${lane}/${job} default`).toContain(entry.default);
        for (const id of entry.offered) {
          expect(() => modelRow(id), `${lane}/${job} offers ${id}`).not.toThrow();
        }
      }
    }
  });

  it("hands the drawing model ids in drawn order", () => {
    const cloud = laneJobModels("Cloud", "dictation");

    expect(cloud?.model).toBe(modelId(CATALOGUE.lanes.Cloud.dictation.default));
    expect(cloud?.models).toEqual(
      CATALOGUE.lanes.Cloud.dictation.offered.map((id) => modelId(id)),
    );
  });

  it("answers nothing for a lane job it does not carry, rather than an empty picker", () => {
    /* Self-hosted types its model id and the listening jobs on Enterprise name
       the lane that can run them. Neither is a list with nothing in it, and the
       difference is what `LaneJob.none` and the typed field are for. */
    expect(laneJobModels("Self-hosted", "cleanup")).toBeUndefined();
    expect(laneJobModels("Enterprise", "dictation")).toBeUndefined();
  });

  it("fails loudly on a row that is gone, naming it", () => {
    expect(() => modelRow("no-such-row")).toThrow(/no-such-row/);
    expect(() => providerLabel("no-such-vendor")).toThrow(/no-such-vendor/);
  });

  it("resolves every runtime default", () => {
    for (const slot of ["speech", "correction", "local_correction", "agent", "local_agent"] as const) {
      expect(runtimeDefault(slot).trim()).not.toBe("");
    }
  });
});

describe("the drawing", () => {
  it("takes its lane models from the catalogue", () => {
    expect(LANES.Cloud.jobs.dictation.models).toEqual(
      laneJobModels("Cloud", "dictation")?.models,
    );
    expect(LANES.Enterprise.jobs.assistant.model).toBe(
      laneJobModels("Enterprise", "assistant")?.model,
    );
  });

  it("keeps the sentence that stands where a model id would", () => {
    /* Self-hosted is not a lane missing a catalogue entry — its model list
       belongs to whoever runs the server, which is the free-typed field
       ADR 0115 keeps beside every curated list. */
    expect(LANES["Self-hosted"].jobs.cleanup.model).toBe("typed on the endpoint");
    expect(LANES["Self-hosted"].jobs.dictation.none).toBeTruthy();
  });

  /**
   * **The deliverable of this step, as a failing test would state it.**
   *
   * No source file outside the catalogue spells a catalogued model id. Test
   * files are excluded on purpose: a literal in an assertion is a check on what
   * the surface renders, so a catalogue row that moves generation SHOULD break
   * one and be looked at. A literal in a screen is a second source of truth,
   * which is what this walks the tree to prevent.
   */
  it("spells no catalogued model id outside the catalogue", () => {
    const ids = CATALOGUE.models
      .map((row) => row.model_id)
      /* Longest first, so `whisper-large-v3-turbo` is attributed to its own row
         rather than to `whisper-large-v3`. */
      .sort((a, b) => b.length - a.length);

    const offenders: string[] = [];

    for (const file of sourceFiles("src")) {
      if (file.endsWith("modelCatalogue.ts") || /\.test\.tsx?$/.test(file)) continue;

      const text = readFileSync(file, "utf8");
      for (const id of ids) {
        /* Quoted or drawn as text between tags — the two shapes a model id took
           in this tree before the catalogue landed. A word in a comment is not
           a source of truth and is left alone. */
        if (text.includes(`"${id}"`) || text.includes(`>${id}<`)) {
          offenders.push(`${file}: ${id}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}
