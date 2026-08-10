import { describe, expect, it } from "vitest";
import { createAppConfig } from "../test/factories";
import {
  buildTextProfilesPatch,
  createDefaultProfileModesSettings,
  createDefaultTextProfileWorkMode,
  createEmptyTextProfileCuration,
  describeTextProfileWorkMode,
  resolveActiveTextProfile,
  resolveTextProfileWorkMode,
} from "./textProfiles";

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
