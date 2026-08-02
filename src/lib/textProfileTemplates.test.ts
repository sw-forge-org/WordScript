import { describe, expect, it } from "vitest";
import { createEmptyTextProfileCuration } from "./textProfiles";
import { CURATED_TEXT_PROFILE_SEEDS, createTextProfileFromTemplate, mergeTemplateIntoTextProfile } from "./textProfileTemplates";

describe("textProfileTemplates", () => {
  it("creates a profile from a curated template with unique labels and generated ids", () => {
    const supportTemplate = CURATED_TEXT_PROFILE_SEEDS.find((template) => template.id === "curated-customer-success");
    expect(supportTemplate).toBeDefined();

    const profile = createTextProfileFromTemplate(supportTemplate!, ["Customer success replies"]);

    expect(profile.label).toBe("Customer success replies 2");
    expect(profile.id).toMatch(/^profile-/);
    expect(profile.work_mode!.rewrite_style).toBe(supportTemplate!.work_mode!.rewrite_style);
    expect(profile.work_mode!.insert_behavior).toBe(supportTemplate!.work_mode!.insert_behavior);
    expect(profile.work_mode!.recovery_behavior).toBe(supportTemplate!.work_mode!.recovery_behavior);
    expect(profile.curation.curated).toBe(false);
    expect(profile.dictionary_entries).toHaveLength(supportTemplate!.dictionary_entries.length);
    expect(profile.snippet_entries).toHaveLength(supportTemplate!.snippet_entries.length);
  });

  it("merges template data into a profile without overwriting authored prompt or conflicting rules", () => {
    const supportTemplate = CURATED_TEXT_PROFILE_SEEDS.find((template) => template.id === "curated-customer-success");
    expect(supportTemplate).toBeDefined();

    const merged = mergeTemplateIntoTextProfile(
      {
        id: "general",
        label: "General writing",
        prompt: "ticket IDs\ncustom org names",
        stt_hints: "existing guided phrase",
        vocabulary_hints: [],
        schema_version: 2,
        curation: {
          curated: true,
          audience: "Customer success",
          summary: "Seeded profile",
          highlights: ["Status updates"],
        },
        dictionary_entries: [
          { id: "dict-1", phrase: "sev one", replace_with: "SEV 1 custom" },
        ],
        snippet_entries: [
          { id: "snippet-1", label: "Status update", trigger: "status update", expansion: "Custom update copy." },
        ],
      },
      supportTemplate!,
    );

    expect(merged.label).toBe("General writing");
    expect(merged.curation).toEqual(createEmptyTextProfileCuration());
    expect(merged.work_mode!.rewrite_style).toBe(supportTemplate!.work_mode!.rewrite_style);
    expect(merged.work_mode!.insert_behavior).toBe(supportTemplate!.work_mode!.insert_behavior);
    expect(merged.work_mode!.recovery_behavior).toBe(supportTemplate!.work_mode!.recovery_behavior);
    expect(merged.prompt).toContain("custom org names");
    expect(merged.prompt).toContain("customer names");
    expect(merged.stt_hints).toContain("existing guided phrase");
    expect(merged.prompt.split("\n").filter((line) => line === "ticket IDs")).toHaveLength(1);
    expect(merged.dictionary_entries.find((entry) => entry.phrase === "sev one")?.replace_with).toBe("SEV 1 custom");
    expect(merged.dictionary_entries.some((entry) => entry.phrase === "s l a")).toBe(true);
    expect(merged.snippet_entries.find((entry) => entry.trigger === "status update")?.expansion).toBe("Custom update copy.");
    expect(merged.snippet_entries.some((entry) => entry.trigger === "escalation needed")).toBe(true);
  });
});