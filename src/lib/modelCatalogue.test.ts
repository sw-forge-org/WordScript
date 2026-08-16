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
  formatModelSize,
  laneJobModels,
  modelId,
  modelInstall,
  modelRow,
  providerLabel,
  runtimeDefault,
} from "./modelCatalogue";
import { LANES, LIBRARY_LANGUAGE_ROWS, LIBRARY_SPEECH_ROWS, libraryModel } from "@/screens/data";

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

  /* B5's block (ADR 0122). The Rust suite holds the same rows from the other
     side; what this half proves is that the drawing can read them, because the
     size a row states is now the size the download actually costs. */
  it("carries an install block on every row the library draws, and on nothing else", () => {
    for (const id of [...LIBRARY_SPEECH_ROWS, ...LIBRARY_LANGUAGE_ROWS]) {
      expect(modelInstall(id), `${id} has no install block`).toBeDefined();
    }

    /* A hosted lane carries none, and the absence is the answer: there is
       nothing to install for Groq, and a Download button under that row would
       be the surface asking the wrong lane. */
    expect(modelInstall("groq-speech-turbo")).toBeUndefined();
    expect(modelInstall("openai-chat-terra")).toBeUndefined();
  });

  it("keeps the pull tag apart from the model id", () => {
    const install = modelInstall("local-chat-qwen-7b");
    expect(install?.kind).toBe("server_pull");
    if (install?.kind !== "server_pull") throw new Error("unreachable");

    /* The property ADR 0122 carries the tag separately for: rewriting the
       punctuation of one into the other would be a guess dressed as a lookup. */
    expect(install.tag).not.toBe(modelId("local-chat-qwen-7b"));
    expect(install.tag).toContain(":");
  });

  it("throws for a slug with no row rather than answering that it is not installable", () => {
    /* Not installable and not a row are different mistakes, and only one of
       them is this repo naming its own data wrongly. */
    expect(() => modelInstall("no-such-row")).toThrow(/no-such-row/);
  });

  /**
   * **The units, and the correction they carry** (ADR 0128's rule that a false
   * drawn sentence is corrected).
   *
   * The drawing spent `142 MB` on a file Hugging Face lists as 148 MB and
   * `4.4 GB` on a pull the Ollama library lists as 4.7 GB — binary units under
   * decimal names, so the number on this surface was never the number on the
   * page the file comes from. Held against `core::model_install::format_bytes`,
   * which prints the same two.
   */
  it("prints a size in the units the sources publish, and mirrors the runtime", () => {
    expect(formatModelSize(147_951_465)).toBe("148 MB");
    expect(formatModelSize(4_683_086_845)).toBe("4.7 GB");

    const rust = readFileSync(
      join("src-tauri", "src", "core", "model_install.rs"),
      "utf8",
    );
    expect(rust).toContain('assert_eq!(format_bytes(147_951_465), "148 MB");');
    expect(rust).toContain('assert_eq!(format_bytes(4_683_086_845), "4.7 GB");');
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

  /**
   * **The last two entries on ADR 0115's own inventory, taken by B5.**
   *
   * The size and the quantization were literals in `data.ts` beside the slug
   * they described, which is one drawn row split across two files — the exact
   * condition ADR 0115 was written to end. They now come off the install block,
   * so the number this surface prints and the number the download costs are one
   * fact.
   */
  it("spends no size and no quantization of its own", () => {
    const speech = libraryModel("local-speech-base");
    expect(speech.size).toBe(formatModelSize(147_951_465));
    /* A speech row states no quantization: a ggml file carries it in the
       weights rather than in a column, and inventing a label for it would be
       the guess this file exists to remove. */
    expect(speech.detail).not.toContain("Q4");

    const language = libraryModel("local-chat-qwen-7b");
    const install = modelInstall("local-chat-qwen-7b");
    if (install?.kind !== "server_pull") throw new Error("unreachable");
    expect(language.size).toBe(formatModelSize(install.size_bytes));
    expect(language.detail.startsWith(`${install.quantization} · `)).toBe(true);
  });

  it("refuses to draw a library row the catalogue cannot state a size for", () => {
    /* The surface's whole promise is that the size is stated before the
       download rather than discovered during it. A row that cannot keep it does
       not belong in the list, and it says so rather than rendering blank. */
    expect(() => libraryModel("groq-speech-turbo")).toThrow(/no drawn library row/);
  });

  it("keeps the sentence that stands where a model id would", () => {
    /* Self-hosted is not a lane missing a catalogue entry — its model list
       belongs to whoever runs the server, which is the free-typed field
       ADR 0115 keeps beside every curated list.

       **AND IT IS NOW EVERY JOB ON THE LANE** (D1a, ADR 0164). The three
       listening jobs carried a `none:` sentence while the adapter was unbuilt;
       D1a builds it, so they take the same typed field. The lane is the one
       place in this file where a model id is not a catalogue row at all, and
       after this step it is uniformly so. */
    expect(LANES["Self-hosted"].jobs.cleanup.model).toBe("typed on the endpoint");
    expect(LANES["Self-hosted"].jobs.dictation.model).toBe("typed on the endpoint");
    expect(LANES["Self-hosted"].jobs.dictation.none).toBeUndefined();
    /* Enterprise is the lane that still refuses, and on a fact about its three
       vendors rather than about this build. */
    expect(LANES.Enterprise.jobs.dictation.none).toBeTruthy();
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
