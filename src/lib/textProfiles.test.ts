import { describe, expect, it } from "vitest";
import { createAppConfig } from "../test/factories";
import {
  buildTextProfilesPatch,
  createDefaultTextProfileWorkMode,
  createEmptyTextProfileCuration,
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
