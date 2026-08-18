import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAppConfig } from "../test/factories";
import {
  buildProfileProvidersPatch,
  buildTextProfilesPatch,
  createDefaultProfileModesSettings,
  createDefaultTextProfileWorkMode,
  createEmptyTextProfileCuration,
  describeTextProfileWorkMode,
  foreignModel,
  namedModel,
  resolveActiveTextProfile,
  resolveJobProvider,
  resolveProfileProviderSettings,
  resolveTextProfileWorkMode,
  TEXT_PROFILE_SCHEMA_VERSION,
} from "./textProfiles";

/**
 * THE MODEL A JOB MAY BE SENT — this side's copy of `JobProvider::named_model`,
 * and the cases are the ones where a stricter rule looked right and was not.
 *
 * The surface asked *is this id in the vendor's catalogue rows* in two places.
 * That refuses a typed override the runtime sends untouched (ADR 0115), so a row
 * drew `Follow the profile` while its request carried the stored id — which is
 * ADR 0067's *surface names one model, request carries another*, arriving from
 * the side nobody was watching. A vendor retirement puts every machine into that
 * state at once, which is how it was found.
 */
describe("the model a job may be sent (ADR 0211, mirroring named_model)", () => {
  it("sends an id this build has never read about, because the catalogue is a snapshot", () => {
    const shipped_after_this_build = { provider: "groq", model: "groq-next-2" };
    expect(namedModel(shipped_after_this_build, "chat")).toBe("groq-next-2");
    expect(foreignModel(shipped_after_this_build, "chat")).toBe(false);
  });

  /* The state a retirement leaves, and the reason this file exists rather than a
     `offered.includes` at each call site: the id was catalogued yesterday, the
     vendor still answers to it or does not, and either way the runtime sends it.
     A surface that hid it would be reporting a value no request carries. */
  it("sends an id the catalogue carried until the vendor retired it", () => {
    expect(namedModel({ provider: "groq", model: "llama-3.3-70b-versatile" }, "chat")).toBe(
      "llama-3.3-70b-versatile",
    );
  });

  it("refuses an id the catalogue attributes to another vendor, which is a leftover", () => {
    const groq_id_on_an_openai_job = { provider: "openai", model: "openai/gpt-oss-120b" };
    expect(namedModel(groq_id_on_an_openai_job, "chat")).toBeUndefined();
    expect(foreignModel(groq_id_on_an_openai_job, "chat")).toBe(true);
  });

  /* The role is half the question on both sides. One vendor's speech id and
     another's chat id have no reason to be distinguishable as strings, so asking
     without it would refuse a chat model for looking like somebody's recogniser. */
  it("asks per role, so one vendor's speech id is not another's chat id", () => {
    expect(namedModel({ provider: "openai", model: "whisper-large-v3" }, "speech")).toBeUndefined();
    expect(namedModel({ provider: "openai", model: "whisper-large-v3" }, "chat")).toBe(
      "whisper-large-v3",
    );
  });

  /* A job whose account is gone has no vendor to be foreign TO. That row already
     states the missing account; blaming the model it stored would be a second,
     wrong sentence about one broken pointer. */
  it("blames no model when the account itself is gone", () => {
    const orphaned = { provider: "", model: "openai/gpt-oss-120b" };
    expect(namedModel(orphaned, "chat")).toBeUndefined();
    expect(foreignModel(orphaned, "chat")).toBe(false);
  });

  it("falls back where nothing was named at all", () => {
    expect(namedModel({ provider: "groq", model: "" }, "chat")).toBeUndefined();
    expect(foreignModel({ provider: "groq", model: "   " }, "chat")).toBe(false);
  });
});

describe("the model axis on the provider object (ADR 0211)", () => {
  /** **A STORED MODEL SURVIVES AN UNRELATED SAVE.**
   *
   *  Every writer builds its patch by spreading what `resolveProfileProviderSettings`
   *  returns, so a key that resolver forgets is a key the next save drops — and
   *  the reader would watch their per-task model disappear because they touched
   *  a different row. Absent in every config written before this axis, which is
   *  exactly the shape this defaults from. */
  it("keeps a job's model when another part of the axis is written", () => {
    const config = createAppConfig();
    const active = resolveActiveTextProfile(config);
    active.providers = {
      default: "connection-default",
      overrides: {},
      models: { translate: "gpt-5.6-terra" },
    };
    config.text_profiles = config.text_profiles.map((profile) =>
      profile.id === active.id ? active : profile,
    );

    const patch = buildProfileProvidersPatch(config, { default: "connection-work" });
    const written = patch.text_profiles!.find((profile) => profile.id === active.id)!;

    expect(resolveProfileProviderSettings(written)).toEqual({
      default: "connection-work",
      overrides: {},
      models: { translate: "gpt-5.6-terra" },
    });
  });

  /** A profile written before the axis existed reads as *no model named*, which
   *  is the same answer as a job that never had one: the role default. */
  it("reads a config written before the axis as naming no models", () => {
    const config = createAppConfig();
    const active = resolveActiveTextProfile(config);
    active.providers = { default: "connection-default", overrides: {} } as never;

    expect(resolveProfileProviderSettings(active).models).toEqual({});
    expect(resolveJobProvider(active, "translate").model).toBe("");
  });
});

describe("textProfiles", () => {
  it("falls back to the first persisted profile instead of legacy top-level mirrors", () => {
    const config = createAppConfig({
      active_text_profile_id: "missing-profile",
      text_profiles: [
        {
          id: "general",
          label: "General writing",
          prompt: "profile prompt",
          stt_hints: "profile hint",
          vocabulary_hints: [],
          schema_version: 2,
          curation: createEmptyTextProfileCuration(),
          dictionary_entries: [],
          snippet_entries: [],
        },
      ],
    });

    const profile = resolveActiveTextProfile(config);

    expect(profile.id).toBe("general");
    expect(profile.prompt).toBe("profile prompt");
    expect(profile.stt_hints).toBe("profile hint");
    expect(profile.dictionary_entries).toEqual([]);
    expect(profile.snippet_entries).toEqual([]);
    expect(resolveTextProfileWorkMode(profile)).toEqual(createDefaultTextProfileWorkMode());
  });

  it("builds profile patches without reintroducing top-level mirror fields", () => {
    const config = createAppConfig();
    const patch = buildTextProfilesPatch(config, [
      {
        id: "general",
        label: "General writing",
        prompt: "owned by profile",
        stt_hints: "owned hint",
        vocabulary_hints: [],
        schema_version: 2,
        work_mode: {
          rewrite_style: "polished",
          insert_behavior: "clipboard_only",
          recovery_behavior: "standard",
        },
        curation: createEmptyTextProfileCuration(),
        dictionary_entries: [],
        snippet_entries: [],
      },
    ]);

    expect(patch).toEqual({
      active_text_profile_id: "general",
      text_profiles: [
        expect.objectContaining({
          id: "general",
          prompt: "owned by profile",
          stt_hints: "owned hint",
          vocabulary_hints: [],
          schema_version: 2,
          work_mode: expect.objectContaining({
            rewrite_style: "polished",
            insert_behavior: "clipboard_only",
            recovery_behavior: "standard",
          }),
        }),
      ],
    });
    expect(patch).not.toHaveProperty("prompt");
    expect(patch).not.toHaveProperty("stt_hints");
    expect(patch).not.toHaveProperty("dictionary_entries");
    expect(patch).not.toHaveProperty("snippet_entries");
  });
});

/**
 * THE DERIVATION LEG 4C FOUND RETURNING ONE STRING FOR SIX PROFILES, decided in
 * Leg 4d and held here. The three expectations that reproduce the prototype's
 * own rows are the point: the drawing is the specification and these are it,
 * read off `demo.js`'s profile list.
 */
describe("the profile list's subline", () => {
  const summarise = (
    processing_mode: "auto" | "rewrite" | "cleanup" | undefined,
    insert_behavior: "auto_paste" | "clipboard_only",
    communication_register?: "off" | "client" | "quick",
  ) =>
    describeTextProfileWorkMode({
      work_mode: {
        rewrite_style: "clean",
        insert_behavior,
        recovery_behavior: "standard",
        processing_mode,
      },
      modes: communication_register
        ? { ...createDefaultProfileModesSettings(), communication_register }
        : createDefaultProfileModesSettings(),
    });

  it("draws the prototype's three rows exactly", () => {
    expect(summarise("auto", "auto_paste")).toBe("Auto · Insert at cursor");
    expect(summarise("rewrite", "auto_paste", "client")).toBe("Rewrite · Client register");
    expect(summarise("rewrite", "clipboard_only")).toBe("Rewrite · Clipboard only");
  });

  it("prefers a register over the delivery, because a set register is the more specific fact", () => {
    expect(summarise("auto", "clipboard_only", "quick")).toBe("Auto · Quick-message register");
  });

  it("falls back to the delivery when the register is off, which is the default", () => {
    expect(summarise("auto", "clipboard_only", "off")).toBe("Auto · Clipboard only");
  });

  it("says Auto for a profile written before processing_mode existed", () => {
    expect(summarise(undefined, "auto_paste")).toBe("Auto · Insert at cursor");
  });

  /* The regression this replaced: two of the three clauses could not vary.
     `recovery_behavior` has one value in the type, and the rewrite style is a
     lossy function of a mode the row was not showing. */
  it("no longer states a constant, and no longer collapses four modes onto one word", () => {
    expect(summarise("cleanup", "auto_paste")).not.toBe(summarise("auto", "auto_paste"));
    expect(summarise("auto", "auto_paste")).not.toContain("recovery");
  });
});

/**
 * **THE TWO SCHEMA NUMBERS ARE ONE NUMBER, AND NOTHING WAS HOLDING THEM
 * TOGETHER** (ADR 0123's one-list-per-fact, applied to a constant).
 *
 * This side read `4` while `core::config` read `5` for the whole of ADR 0094's
 * config half — a profile the UI created was stamped with a version whose
 * migration had not run on it. The cost was latent, because the axis that
 * migration adds is one this file already writes, and it stops being latent at
 * the next migration: one that would then run over every profile this build has
 * ever created.
 *
 * B16 corrected the number and wrote *the two numbers are one number* in a
 * comment. A comment is not a guard, and the drift it describes had gone
 * unnoticed across two records — so the next bump is held by this instead of by
 * whoever remembers. Read out of the Rust source for the same reason
 * `modelCatalogue.test` reads `model_install.rs`: the runtime owns the fact and
 * this side mirrors it.
 */
describe("the profile schema version (ADR 0112, ADR 0123)", () => {
  it("is the number the runtime writes, read out of the runtime's own source", () => {
    const rust = readFileSync(join("src-tauri", "src", "core", "config.rs"), "utf8");
    const declared = rust.match(/pub const TEXT_PROFILE_SCHEMA_VERSION: u32 = (\d+);/);

    expect(declared, "core::config must declare TEXT_PROFILE_SCHEMA_VERSION").not.toBeNull();
    expect(Number(declared![1])).toBe(TEXT_PROFILE_SCHEMA_VERSION);
  });
});
