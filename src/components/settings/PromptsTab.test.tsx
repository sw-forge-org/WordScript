import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppConfig } from "../../test/factories";
import { PromptsTab } from "./PromptsTab";

const invokeMock = vi.fn();
const openMock = vi.fn();
const saveMock = vi.fn();

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
            profile_hints: [],
            dictionary_terms: [],
            stt_hints: [],
            ignored_profile_lines: [],
            ignored_stt_hint_lines: [],
          },
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
              profile_hints: ["ImportedTerm"],
              dictionary_terms: [],
              stt_hints: [],
              ignored_profile_lines: [],
              ignored_stt_hint_lines: [],
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
    await user.click(screen.getByRole("button", { name: /add dictionary term/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /heard as/i }), { target: { value: "word script" } });
    fireEvent.change(screen.getByRole("textbox", { name: /replace with/i }), { target: { value: "WordScript" } });

    expect(screen.getByRole("textbox", { name: /heard as/i })).toHaveValue("word script");
    expect(screen.getByRole("textbox", { name: /replace with/i })).toHaveValue("WordScript");

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

  it("explains literal matching and preview scope clearly", () => {
    render(<Harness />);

    expect(screen.getByText(/not raw audio and not semantic intent/i)).toBeInTheDocument();
    expect(screen.getByText(/dictionary runs first, snippets second/i)).toBeInTheDocument();
    expect(screen.getByText(/validation checks for empty fields, duplicates and collisions/i)).toBeInTheDocument();
    expect(screen.getByText(/preview runs the literal dictionary-plus-snippet pass/i)).toBeInTheDocument();
  });

  it("organizes the editor into explicit workspace stages", () => {
    render(<Harness />);

    expect(screen.getByRole("tablist", { name: /text rules workspace/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /open vocabulary workspace/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /open replacements workspace/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /open snippets workspace/i })).toBeInTheDocument();
  });

  it("keeps a taught word out of the recognizer prompt until it is opted in per entry", async () => {
    const user = userEvent.setup();

    render(<Harness />);

    await user.click(screen.getByRole("button", { name: /add word or name/i }));

    const wordField = screen.getByRole("textbox", { name: /word or name 1/i });
    await user.type(wordField, "WordScript");
    expect(wordField).toHaveValue("WordScript");

    // Off by default: the deterministic pass handles it, and a longer
    // recognizer prompt is itself a hallucination source.
    const hintToggle = screen.getByRole("checkbox", { name: /hint the recognizer for word 1/i });
    expect(hintToggle).not.toBeChecked();

    await user.click(hintToggle);
    expect(hintToggle).toBeChecked();
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
              code: "broad_profile_context_ignored",
              message: "1 context line is too broad for the automatic STT bias path and will be ignored. Keep automatic context lexical and concrete.",
              rule_ids: [],
            },
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
            profile_hints: ["WordScript", "ticket IDs"],
            dictionary_terms: ["SEV-1"],
            stt_hints: ["status update"],
            ignored_profile_lines: ["customer names"],
            ignored_stt_hint_lines: ["this hint is too long to stay in the automatic bias path"],
          },
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

    expect(await screen.findByText("Automatic STT vocabulary")).toBeInTheDocument();
    expect(await screen.findByText("ticket IDs")).toBeInTheDocument();
    expect(screen.getByText("SEV-1")).toBeInTheDocument();
    expect(screen.getByText("status update")).toBeInTheDocument();
    expect(screen.getByText("Context ignored: customer names")).toBeInTheDocument();
    expect(screen.getByText("STT ignored: this hint is too long to stay in the automatic bias path")).toBeInTheDocument();
    expect(screen.getByText(/too broad for the automatic stt bias path/i)).toBeInTheDocument();
    expect(screen.getByText(/stt hint line is too long for the conservative bias path/i)).toBeInTheDocument();
  });

  it("reorders dictionary entries so the current sequence matches the authored priority", async () => {
    const user = userEvent.setup();

    render(<Harness />);

    await user.click(screen.getByRole("tab", { name: /open replacements workspace/i }));
    await user.click(screen.getByRole("button", { name: /add dictionary term/i }));
    await user.type(screen.getByRole("textbox", { name: /heard as/i }), "alpha term");
    await user.type(screen.getByRole("textbox", { name: /replace with/i }), "Alpha");

    await user.click(screen.getByRole("button", { name: /add dictionary term/i }));

    const heardInputsBeforeMove = screen.getAllByRole("textbox", { name: /heard as/i });
    const replaceInputsBeforeMove = screen.getAllByRole("textbox", { name: /replace with/i });

    await user.type(heardInputsBeforeMove[1], "beta term");
    await user.type(replaceInputsBeforeMove[1], "Beta");

    const secondDictionaryCard = screen.getByText("Dictionary term 2").closest("article");
    expect(secondDictionaryCard).not.toBeNull();

    await user.click(within(secondDictionaryCard as HTMLElement).getByRole("button", { name: /move up/i }));

    const orderedHeardValues = screen
      .getAllByRole("textbox", { name: /heard as/i })
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
            profile_hints: ["WordScript"],
            dictionary_terms: ["WordScript"],
            stt_hints: [],
            ignored_profile_lines: [],
            ignored_stt_hint_lines: [],
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

    const dictionaryCard = await screen.findByText("Dictionary term 1");
    const dictionaryCardArticle = dictionaryCard.closest("article");
    expect(dictionaryCardArticle).not.toBeNull();

    expect(within(dictionaryCardArticle as HTMLElement).getByText("Dictionary phrase collides with another rule.")).toBeInTheDocument();

    expect(dictionaryCardArticle).toHaveAttribute("data-active");
    expect(screen.getByRole("textbox", { name: /heard as/i })).toHaveFocus();
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
    await user.type(screen.getByRole("textbox", { name: /transcription context/i }), "Escalation contacts");

    await user.click(screen.getByRole("button", { name: /duplicate profile/i }));

    const duplicatedOption = screen.getByRole("option", { name: /support reply copy/i });
    expect(duplicatedOption).toBeInTheDocument();

    await user.selectOptions(activeProfileSelect, "general");
    expect(screen.getByRole("textbox", { name: /profile label/i })).toHaveValue("General writing");
    expect(screen.getByRole("textbox", { name: /transcription context/i })).toHaveValue("");

    await user.selectOptions(activeProfileSelect, duplicatedOption);
    expect(screen.getByRole("textbox", { name: /profile label/i })).toHaveValue("Support reply copy");
    expect(screen.getByRole("textbox", { name: /transcription context/i })).toHaveValue("Escalation contacts");
  });

  it("shows included profiles as normal selectable, editable and deletable profiles", async () => {
    const user = userEvent.setup();

    render(<Harness />);

    const activeProfileSelect = screen.getByRole("combobox", { name: /active profile/i });
    await user.selectOptions(activeProfileSelect, "curated-customer-success");

    expect(screen.getByRole("textbox", { name: /profile label/i })).toHaveValue("Customer success replies");

    expect((screen.getByRole("textbox", { name: /transcription context/i }) as HTMLTextAreaElement).value).toContain("Statuspage");

    await user.click(screen.getByRole("tab", { name: /open replacements workspace/i }));
    expect(screen.getByDisplayValue("SEV-1")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /open snippets workspace/i }));
    expect(screen.getByDisplayValue("Status update")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /open vocabulary workspace/i }));
    const promptField = screen.getByRole("textbox", { name: /transcription context/i }) as HTMLTextAreaElement;

    await user.clear(promptField);
    await user.type(promptField, "custom org names");

    expect(screen.getByRole("textbox", { name: /profile label/i })).toHaveValue("Customer success replies");

    await user.click(screen.getByRole("button", { name: /duplicate profile/i }));

    expect(screen.getByRole("textbox", { name: /profile label/i })).toHaveValue("Customer success replies copy");

    await user.click(screen.getByRole("button", { name: /delete profile/i }));

    expect(screen.getByRole("textbox", { name: /profile label/i })).not.toHaveValue("Customer success replies copy");
  });
});