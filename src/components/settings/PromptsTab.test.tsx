import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppConfig } from "../../test/factories";
import type { VocabularyHintEntry } from "../../types/ipc";
import { PromptsTab } from "./PromptsTab";

/// A vocabulary row at its defaults, so a test states only the field it is
/// about. `use_as_prompt_hint` is a migration remnant nothing reads (ADR 0035).
function vocabularyEntry(overrides: Partial<VocabularyHintEntry> & { id: string; phrase: string }): VocabularyHintEntry {
  return {
    use_as_prompt_hint: false,
    origin: "user",
    learned_at_ms: null,
    hit_count: 0,
    observation_count: 0,
    ...overrides,
  };
}

const invokeMock = vi.fn();
const openMock = vi.fn();
const saveMock = vi.fn();

/// The runtime owns the context budget; tests set what it would report.
/// Mirrors `core::profile_context::ProfileContextBudget`.
let profileContextResponse = {
  accepted: [] as string[],
  dropped: [] as string[],
  used_chars: 0,
  max_chars: 600,
};

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => openMock(...args),
  save: (...args: unknown[]) => saveMock(...args),
}));

afterEach(() => {
  cleanup();
});

function Harness({ initialConfig }: { initialConfig?: ReturnType<typeof createAppConfig> }) {
  const [config, setConfig] = useState(initialConfig ?? createAppConfig());

  return (
    <PromptsTab
      config={config}
      onChange={(partial) => setConfig((current) => ({ ...current, ...partial }))}
    />
  );
}

describe("PromptsTab", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    openMock.mockReset();
    saveMock.mockReset();

    openMock.mockResolvedValue(null);
    saveMock.mockResolvedValue(null);
    profileContextResponse = { accepted: [], dropped: [], used_chars: 0, max_chars: 600 };
    invokeMock.mockImplementation(async (command: string, payload?: { request?: { sample_text?: string } }) => {
      if (command === "analyze_text_rules") {
        const sampleText = payload?.request?.sample_text?.trim() || "word script follow up note";
        return {
          blocking: false,
          issues: [],
          preview: {
            input: sampleText,
            output: `current preview: ${sampleText}`,
            applied_rules: [],
          },
          transcription_bias: {
            dictionary_terms: [],
            stt_hints: [],
            ignored_stt_hint_lines: [],
            over_limit_stt_hint_lines: [],
          },
          profile_context: profileContextResponse,
          vocabulary_repair: { repairable: [], too_short: [], min_chars: 7 },
          dictionary_count: 0,
          snippet_count: 0,
        };
      }

      if (command === "import_text_rules") {
        const sampleText = payload?.request?.sample_text?.trim() || "word script follow up note";
        return {
          document: {
            schema_version: 1,
            prompt: "Imported prompt",
            stt_hints: "imported stt hint",
            dictionary_entries: [],
            snippet_entries: [],
          },
          analysis: {
            blocking: true,
            issues: [
              {
                severity: "error",
                code: "empty_snippet_expansion",
                message: "Imported snippet expansion is empty.",
                rule_ids: ["snippet-imported"],
              },
            ],
            preview: {
              input: sampleText,
              output: `import preview: ${sampleText}`,
              applied_rules: ["snippet:follow-up"],
            },
            transcription_bias: {
              dictionary_terms: [],
              stt_hints: [],
                ignored_stt_hint_lines: [],
                over_limit_stt_hint_lines: [],
            },
            dictionary_count: 0,
            snippet_count: 1,
          },
        };
      }

      if (command === "get_profile_health") {
        return {
          level: "green",
          flags: [],
        };
      }

      throw new Error(`Unexpected invoke command: ${command}`);
    });
  });

  it("adds and edits dictionary and snippet entries in the first native text-rules slice", async () => {
    const user = userEvent.setup();

    render(<Harness />);

    await user.click(screen.getByRole("tab", { name: /open replacements workspace/i }));
    await user.click(screen.getByRole("button", { name: /add replacement/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /what you say/i }), { target: { value: "word script" } });
    fireEvent.change(screen.getByRole("textbox", { name: /what gets written/i }), { target: { value: "WordScript" } });

    expect(screen.getByRole("textbox", { name: /what you say/i })).toHaveValue("word script");
    expect(screen.getByRole("textbox", { name: /what gets written/i })).toHaveValue("WordScript");

    await user.click(screen.getByRole("tab", { name: /open snippets workspace/i }));
    await user.click(screen.getByRole("button", { name: /add snippet/i }));
    const snippetCard = screen.getByText("Snippet 1").closest("article");
    expect(snippetCard).not.toBeNull();

    fireEvent.change(within(snippetCard as HTMLElement).getByRole("textbox", { name: /label/i }), { target: { value: "Support follow-up" } });
    fireEvent.change(screen.getByRole("textbox", { name: /trigger phrase/i }), { target: { value: "follow up note" } });
    fireEvent.change(screen.getByRole("textbox", { name: /expansion/i }), { target: { value: "Thanks for the update. We will send the next status tomorrow morning." } });

    expect(within(snippetCard as HTMLElement).getByRole("textbox", { name: /label/i })).toHaveValue("Support follow-up");
    expect(within(snippetCard as HTMLElement).getByRole("textbox", { name: /trigger phrase/i })).toHaveValue("follow up note");
    expect(within(snippetCard as HTMLElement).getByRole("textbox", { name: /expansion/i })).toHaveValue(
      "Thanks for the update. We will send the next status tomorrow morning.",
    );
  });

  it("keeps import preview diagnostics and sample output aligned with the pending import", async () => {
    const user = userEvent.setup();
    openMock.mockResolvedValue("/tmp/wordscript-text-rules.json");

    render(<Harness />);

    const sampleField = screen.getByRole("textbox", { name: /preview sample/i });
    await user.clear(sampleField);
    await user.type(sampleField, "custom merge preview");

    await user.click(screen.getByRole("button", { name: /import & merge/i }));

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("import_text_rules", {
      request: expect.objectContaining({
        sample_text: "custom merge preview",
      }),
    }));

    expect(screen.getByText("import preview: custom merge preview")).toBeInTheDocument();
    expect(screen.getByText("Imported snippet expansion is empty.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply import/i })).toBeDisabled();
  });

  it("shows how much of the context budget the profile spends", async () => {
    profileContextResponse = {
      accepted: ["release scope", "bug IDs"],
      dropped: [],
      used_chars: 120,
      max_chars: 600,
    };

    render(<Harness />);

    expect(
      await screen.findByText(/120 of 600 characters sent to the transform prompt/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/over budget/i)).not.toBeInTheDocument();
  });

  it("names every context line that exceeds the budget instead of dropping it silently", async () => {
    // The defect this guards: the first implementation capped at 8 lines, which
    // was exactly the length of every shipped curated profile, and said nothing
    // when line 9 disappeared.
    profileContextResponse = {
      accepted: ["release scope"],
      dropped: ["migration steps", "infra constraints"],
      used_chars: 600,
      max_chars: 600,
    };

    render(<Harness />);

    expect(await screen.findByText(/2 line\(s\) over budget/i)).toBeInTheDocument();
    expect(screen.getByText("migration steps")).toBeInTheDocument();
    expect(screen.getByText("infra constraints")).toBeInTheDocument();
    expect(screen.getByText("not sent")).toBeInTheDocument();
  });

  it("explains literal matching and preview scope clearly", () => {
    render(<Harness />);

    expect(screen.getByText(/not raw audio and not semantic intent/i)).toBeInTheDocument();
    expect(screen.getByText(/words & names run first and match by closeness/i)).toBeInTheDocument();
    // The old copy told the user to add one entry per mishearing, which is the
    // habit ADR 0033 exists to end.
    expect(screen.getByText(/one entry each, rather than one per way the recognizer might mishear it/i)).toBeInTheDocument();
    expect(screen.getByText(/where each list lands before and after transcription/i)).toBeInTheDocument();
  });

  it("organizes the editor into explicit workspace stages", () => {
    render(<Harness />);

    expect(screen.getByRole("tablist", { name: /text rules workspace/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /open vocabulary workspace/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /open replacements workspace/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /open snippets workspace/i })).toBeInTheDocument();
  });

  it("still lets a term be added by hand, for a name no dictation has produced yet", async () => {
    // The list fills itself now, but a name you are about to start using has no
    // dictation behind it to learn from, so manual entry stays (ADR 0035).
    const user = userEvent.setup();

    render(<Harness />);

    await user.click(screen.getByRole("button", { name: /add word or name/i }));

    const wordField = screen.getByRole("textbox", { name: /word or name 1/i });
    await user.type(wordField, "WordScript");
    expect(wordField).toHaveValue("WordScript");

    const rows = within(screen.getByLabelText("Words and names"));
    expect(rows.getByText("Added by you")).toBeInTheDocument();
  });

  it("no longer exposes bias policy as a user-facing concept", () => {
    render(<Harness />);

    expect(screen.queryByRole("tab", { name: /open bias policy workspace/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("shows the effective transcription bias and ignored lines from analysis", async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "analyze_text_rules") {
        return {
          blocking: false,
          issues: [
            {
              severity: "warning",
              code: "ignored_stt_hint",
              message: "1 STT hint line is too long for the conservative bias path and will be ignored. Keep STT hints short and phrase-like.",
              rule_ids: [],
            },
          ],
          preview: {
            input: "sample",
            output: "sample",
            applied_rules: [],
          },
          transcription_bias: {
            dictionary_terms: ["SEV-1"],
            stt_hints: ["status update"],
            ignored_stt_hint_lines: ["this hint is too long to stay in the automatic bias path"],
            over_limit_stt_hint_lines: [],
          },
          profile_context: profileContextResponse,
          vocabulary_repair: { repairable: [], too_short: [], min_chars: 7 },
          dictionary_count: 1,
          snippet_count: 0,
        };
      }

      if (command === "get_profile_health") {
        return {
          level: "green",
          flags: [],
        };
      }

      throw new Error(`Unexpected invoke command: ${command}`);
    });

    render(<Harness />);

    expect(await screen.findByText("Sent to the recognizer")).toBeInTheDocument();
    expect(await screen.findByText("status update")).toBeInTheDocument();
    expect(screen.getByText("Corrected after transcription")).toBeInTheDocument();
    expect(screen.getByText("SEV-1")).toBeInTheDocument();
    expect(screen.getByText(/stt hint line is too long for the conservative bias path/i)).toBeInTheDocument();
  });

  it("says the recognizer gets the blank-state floor rather than nothing", async () => {
    // The empty state used to read "the recognizer gets nothing", which stopped
    // being true when the floor landed (ADR 0036). The panel answers "what does
    // the provider get", so it has to show the line the runtime reported — not
    // a second copy of that sentence written here.
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "analyze_text_rules") {
        return {
          blocking: false,
          issues: [],
          preview: { input: "sample", output: "sample", applied_rules: [] },
          transcription_bias: {
            dictionary_terms: [],
            stt_hints: [],
            ignored_stt_hint_lines: [],
            over_limit_stt_hint_lines: [],
            cloud_prompt_preview: "Dictated notes. Normale Sätze mit Satzzeichen.",
          },
          profile_context: profileContextResponse,
          vocabulary_repair: { repairable: [], too_short: [], min_chars: 7 },
          dictionary_count: 0,
          snippet_count: 0,
        };
      }

      if (command === "get_profile_health") {
        return { level: "green", flags: [] };
      }

      throw new Error(`Unexpected invoke command: ${command}`);
    });

    render(<Harness />);

    expect(await screen.findByText("Sent to the recognizer")).toBeInTheDocument();
    expect(
      await screen.findByText(/Dictated notes\. Normale Sätze mit Satzzeichen\./),
    ).toBeInTheDocument();
    expect(screen.queryByText(/the recognizer gets nothing/i)).not.toBeInTheDocument();
  });

  it("still says nothing is sent when the profile turned the recognizer channel off", async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "analyze_text_rules") {
        return {
          blocking: false,
          issues: [],
          preview: { input: "sample", output: "sample", applied_rules: [] },
          transcription_bias: {
            dictionary_terms: [],
            stt_hints: [],
            ignored_stt_hint_lines: [],
            over_limit_stt_hint_lines: [],
            cloud_prompt_preview: null,
          },
          profile_context: profileContextResponse,
          vocabulary_repair: { repairable: [], too_short: [], min_chars: 7 },
          dictionary_count: 0,
          snippet_count: 0,
        };
      }

      if (command === "get_profile_health") {
        return { level: "green", flags: [] };
      }

      throw new Error(`Unexpected invoke command: ${command}`);
    });

    render(<Harness />);

    expect(await screen.findByText(/sends the recognizer nothing at all/i)).toBeInTheDocument();
  });

  it("never reports the profile context field as rejected by the recognizer", async () => {
    // The panel used to run the context field through the recognizer's hint
    // filter and list the rejected lines. The field holds topics and never
    // travels that path (ADR 0032), so lines from it must not appear as
    // something the recognizer turned down.
    const initialConfig = createAppConfig();
    initialConfig.text_profiles[0].prompt = "platform constraints\nincident response";

    render(<Harness initialConfig={initialConfig} />);

    expect(await screen.findByText("Sent to the recognizer")).toBeInTheDocument();
    expect(screen.getByText(/profile context is not here by design/i)).toBeInTheDocument();
    expect(screen.queryByText("platform constraints")).not.toBeInTheDocument();
    expect(screen.queryByText("incident response")).not.toBeInTheDocument();
  });

  it("states what each term does and offers nothing to decide about it", async () => {
    // The panel used to carry a per-row recognizer switch, a capacity badge and
    // move buttons. All three operated one decision, and the intuitive way to
    // make it was wrong: people switch on their long product names, which are
    // exactly the terms repair restores afterwards. The runtime allocates the
    // slots now, so every fact here is reported and none of it is a control
    // (ADR 0035).
    const initialConfig = createAppConfig();
    initialConfig.text_profiles[0].vocabulary_hints = [
      vocabularyEntry({ id: "v-1", phrase: "Kubernetes", origin: "learned", learned_at_ms: 1_764_547_200_000, hit_count: 3 }),
      vocabularyEntry({ id: "v-2", phrase: "Tauri" }),
    ];

    invokeMock.mockImplementation(async (command: string) => {
      if (command === "analyze_text_rules") {
        return {
          blocking: false,
          issues: [],
          preview: { input: "sample", output: "sample", applied_rules: [] },
          transcription_bias: {
            dictionary_terms: [],
            stt_hints: ["Tauri"],
            ignored_stt_hint_lines: [],
            over_limit_stt_hint_lines: [],
          },
          profile_context: profileContextResponse,
          vocabulary_repair: {
            repairable: ["Kubernetes"],
            too_short: ["Tauri"],
            min_chars: 7,
          },
          dictionary_count: 0,
          snippet_count: 0,
        };
      }
      if (command === "get_profile_health") return { level: "green", flags: [] };
      throw new Error(`Unexpected invoke command: ${command}`);
    });

    render(<Harness initialConfig={initialConfig} />);

    // The recognizer fact is stated, and it lands on the short term — the one
    // that cannot be recovered once the transcript exists. Awaited because it
    // comes from the runtime's analysis, never from a rule restated here.
    expect(await screen.findByText("In speech recognition")).toBeInTheDocument();

    const rows = within(screen.getByLabelText("Words and names"));
    expect(rows.getByText(/under 7 characters/i)).toBeInTheDocument();

    // Nothing to operate: the switch, the reordering and the capacity counter
    // are gone because none of them decides anything any more.
    expect(rows.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(rows.queryByRole("button", { name: /^move word/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/switched on/i)).not.toBeInTheDocument();

    // Where the row came from, and whether it has earned its place.
    expect(rows.getByText(/learned .* · fixed 3 times/i)).toBeInTheDocument();
    expect(rows.getByText(/added by you/i)).toBeInTheDocument();
    expect(screen.getByText("1 learned")).toBeInTheDocument();
  });

  it("reorders dictionary entries so the current sequence matches the authored priority", async () => {
    const user = userEvent.setup();

    render(<Harness />);

    await user.click(screen.getByRole("tab", { name: /open replacements workspace/i }));
    await user.click(screen.getByRole("button", { name: /add replacement/i }));
    await user.type(screen.getByRole("textbox", { name: /what you say/i }), "alpha term");
    await user.type(screen.getByRole("textbox", { name: /what gets written/i }), "Alpha");

    await user.click(screen.getByRole("button", { name: /add replacement/i }));

    const heardInputsBeforeMove = screen.getAllByRole("textbox", { name: /what you say/i });
    const replaceInputsBeforeMove = screen.getAllByRole("textbox", { name: /what gets written/i });

    await user.type(heardInputsBeforeMove[1], "beta term");
    await user.type(replaceInputsBeforeMove[1], "Beta");

    const secondDictionaryCard = screen.getByText("Replacement 2").closest("article");
    expect(secondDictionaryCard).not.toBeNull();

    await user.click(within(secondDictionaryCard as HTMLElement).getByRole("button", { name: /move up/i }));

    const orderedHeardValues = screen
      .getAllByRole("textbox", { name: /what you say/i })
      .map((input) => (input as HTMLInputElement).value);

    expect(orderedHeardValues).toEqual(["beta term", "alpha term"]);
  });

  it("shows readable applied-rule labels and lets diagnostics jump to the affected rule", async () => {
    const user = userEvent.setup();
    const initialConfig = createAppConfig();
    initialConfig.text_profiles[0].dictionary_entries = [
      {
        id: "dict-1",
        phrase: "word script",
        replace_with: "WordScript",
      },
    ];
    initialConfig.text_profiles[0].snippet_entries = [
      {
        id: "snippet-1",
        label: "Support follow-up",
        trigger: "follow up note",
        expansion: "Thanks for the update.",
      },
    ];

    invokeMock.mockImplementation(async (command: string) => {
      if (command === "analyze_text_rules") {
        return {
          blocking: false,
          issues: [
            {
              severity: "warning",
              code: "dictionary_overlap",
              message: "Dictionary phrase collides with another rule.",
              rule_ids: ["dict-1"],
            },
          ],
          preview: {
            input: "word script follow up note",
            output: "WordScript Thanks for the update.",
            applied_rules: ["dictionary:dict-1", "snippet:snippet-1"],
          },
          transcription_bias: {
            dictionary_terms: ["WordScript"],
            stt_hints: [],
            ignored_stt_hint_lines: [],
            over_limit_stt_hint_lines: [],
          },
          dictionary_count: 1,
          snippet_count: 1,
        };
      }

      if (command === "get_profile_health") {
        return {
          level: "green",
          flags: [],
        };
      }

      throw new Error(`Unexpected invoke command: ${command}`);
    });

    render(<Harness initialConfig={initialConfig} />);

    expect(await screen.findByText("Snippet: Support follow-up")).toBeInTheDocument();

    const dictionaryRuleLink = await screen.findByRole("button", { name: "Dictionary: word script" });
    await user.click(dictionaryRuleLink);

    const dictionaryCard = await screen.findByText("Replacement 1");
    const dictionaryCardArticle = dictionaryCard.closest("article");
    expect(dictionaryCardArticle).not.toBeNull();

    expect(within(dictionaryCardArticle as HTMLElement).getByText("Dictionary phrase collides with another rule.")).toBeInTheDocument();

    expect(dictionaryCardArticle).toHaveAttribute("data-active");
    expect(screen.getByRole("textbox", { name: /what you say/i })).toHaveFocus();
  });

  it("creates, duplicates and switches local text profiles", async () => {
    const user = userEvent.setup();

    render(<Harness />);

    const activeProfileSelect = screen.getByRole("combobox", { name: /active profile/i });
    expect(activeProfileSelect).toHaveValue("general");

    await user.click(screen.getByRole("button", { name: /new profile/i }));

    const profileLabelInput = screen.getByRole("textbox", { name: /profile label/i });
    expect(profileLabelInput).toHaveValue("New profile");

    await user.clear(profileLabelInput);
    await user.type(profileLabelInput, "Support reply");
    await user.type(screen.getByRole("textbox", { name: /profile context/i }), "Escalation contacts");

    await user.click(screen.getByRole("button", { name: /duplicate profile/i }));

    const duplicatedOption = screen.getByRole("option", { name: /support reply copy/i });
    expect(duplicatedOption).toBeInTheDocument();

    await user.selectOptions(activeProfileSelect, "general");
    expect(screen.getByRole("textbox", { name: /profile label/i })).toHaveValue("General writing");
    expect(screen.getByRole("textbox", { name: /profile context/i })).toHaveValue("");

    await user.selectOptions(activeProfileSelect, duplicatedOption);
    expect(screen.getByRole("textbox", { name: /profile label/i })).toHaveValue("Support reply copy");
    expect(screen.getByRole("textbox", { name: /profile context/i })).toHaveValue("Escalation contacts");
  });

  it("shows included profiles as normal selectable, editable and deletable profiles", async () => {
    const user = userEvent.setup();

    render(<Harness />);

    const activeProfileSelect = screen.getByRole("combobox", { name: /active profile/i });
    await user.selectOptions(activeProfileSelect, "curated-customer-success");

    expect(screen.getByRole("textbox", { name: /profile label/i })).toHaveValue("Customer success replies");

    expect((screen.getByRole("textbox", { name: /profile context/i }) as HTMLTextAreaElement).value).toContain("incident severity");

    await user.click(screen.getByRole("tab", { name: /open replacements workspace/i }));
    expect(screen.getByDisplayValue("SEV-1")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /open snippets workspace/i }));
    expect(screen.getByDisplayValue("Status update")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /open vocabulary workspace/i }));
    const promptField = screen.getByRole("textbox", { name: /profile context/i }) as HTMLTextAreaElement;

    await user.clear(promptField);
    await user.type(promptField, "custom org names");

    expect(screen.getByRole("textbox", { name: /profile label/i })).toHaveValue("Customer success replies");

    await user.click(screen.getByRole("button", { name: /duplicate profile/i }));

    expect(screen.getByRole("textbox", { name: /profile label/i })).toHaveValue("Customer success replies copy");

    await user.click(screen.getByRole("button", { name: /delete profile/i }));

    expect(screen.getByRole("textbox", { name: /profile label/i })).not.toHaveValue("Customer success replies copy");
  });
});