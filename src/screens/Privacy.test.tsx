import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { PrivacyScreen } from "./Privacy";
import { createAppConfig, createWorkspaceRuntime } from "@/test/factories";

/* The two file dialogs the export and the import open. Answering with a fixed
   path is what lets the test assert the command's argument rather than the
   dialog's. */
vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(async () => "/tmp/chosen-archive.json"),
  open: vi.fn(async () => "/tmp/chosen-archive.json"),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => undefined) }));

const invoked = vi.mocked(invoke);

/**
 * A BUTTON BY THE ROW IT SITS IN, and the card is why it has to be.
 *
 * `Export` and `Import` each name two different artifacts on this screen since
 * ADR 0090 — the machine's archive and one profile's rules — so a query by verb
 * alone matches both and the test that used to pass now cannot say which door
 * it pressed. Naming the row is also what the reader does.
 */
function inRow(label: string) {
  const row = screen.getByText(label).closest(".ws-row");
  if (!row) throw new Error(`No row labelled ${label}`);
  return within(row as HTMLElement);
}

/**
 * Privacy & Data is still in the gallery, so its fidelity is still measured in
 * `screens.test.tsx`. This is the other half: two retention rules and one
 * destructive command act, and the three doors with no command behind them are
 * drawn and inert.
 */

beforeEach(() => {
  invoked.mockReset();
  invoked.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("Privacy & Data, wired", () => {
  it("shows the retention rule the config holds and writes a change to it", async () => {
    const patch = vi.fn();
    const runtime = createWorkspaceRuntime({
      active: true,
      config: createAppConfig({ history_limit: 200, history_retention_days: 30 }),
      patch,
    });
    render(<PrivacyScreen runtime={runtime} />);

    expect(screen.getByLabelText("Stored dictations")).toHaveValue("200");
    expect(screen.getByLabelText("Retention")).toHaveValue("30");

    await userEvent.selectOptions(screen.getByLabelText("Retention"), "0");
    /* `Keep all` is 0 in the config, which is the runtime's own encoding of
       "do not prune" rather than a sentinel invented here. */
    expect(patch).toHaveBeenCalledWith({ history_retention_days: 0 });
  });

  it("keeps a stored value the drawing does not offer rather than moving the user", () => {
    const runtime = createWorkspaceRuntime({
      active: true,
      config: createAppConfig({ history_limit: 750 }),
    });
    render(<PrivacyScreen runtime={runtime} />);

    const select = screen.getByLabelText("Stored dictations") as HTMLSelectElement;
    expect(select).toHaveValue("750");
    expect([...select.options].map((option) => option.value)).toEqual([
      "50",
      "100",
      "200",
      "500",
      "750",
      "1000",
    ]);
  });

  it("clears the history through the runtime and then says what happened", async () => {
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(invoked).toHaveBeenCalledWith("clear_transcription_history_entries");
    expect(
      await screen.findByText("Every stored transcript was deleted. Profiles and settings stayed."),
    ).toBeInTheDocument();
  });

  it("has no door left that cannot act", () => {
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* All four were the reason this screen carried a banner. `core::backup`
       answers the three that had no command at all, and the banner came off in
       the commit that made it false (ADR 0057). The two rules rows joined them
       in Leg 10 against `export_text_rules` and `import_text_rules`, which had
       been complete in the runtime and unreachable since Leg 3 (ADR 0090). */
    for (const [row, name] of [
      ["Full export", "Export"],
      ["Full import", "Import"],
      ["Profile rules", "Export"],
      ["Import rules", "Import"],
      ["Reset all settings", "Reset"],
      ["Clear transcription history", "Clear"],
    ] as const) {
      expect(inRow(row).getByRole("button", { name }), row).toBeEnabled();
    }
  });

  /* ENABLED IS NOT THE SAME AS WIRED, AND THAT IS THE HOLE THIS PAIR CLOSES.
     `Notes & Meetings` shipped with an arrow, a screen's name and no handler:
     the case above passes it, because a `Button` with no `onClick` is enabled.
     Only calling it can tell the two apart, so every door that names a surface
     is pressed here rather than counted there. */
  it("opens the three surfaces its rows name", async () => {
    const open = vi.fn();
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true, open })} />);

    await userEvent.click(screen.getByRole("button", { name: "Open Context" }));
    expect(open).toHaveBeenCalledWith({ view: "context" });
    await userEvent.click(screen.getByRole("button", { name: "Notes & Meetings" }));
    expect(open).toHaveBeenCalledWith({ section: "notesettings" });
    await userEvent.click(screen.getByRole("button", { name: "Open AI Models" }));
    expect(open).toHaveBeenCalledWith({ section: "models" });
  });
});

/**
 * WHICH COLLECTION A RULE GOVERNS, AND WHAT MAY READ IT (ADR 0138).
 *
 * The owner asked the question these cases answer — *is the cap about all
 * transcriptions or only some of them, and does the copilot read what it
 * keeps* — of a screen that stated neither. Both answers are now on the
 * surface, so both are asserted from it.
 */
describe("Privacy & Data · which collection, and who reads it", () => {
  it("names the collection each retention rule governs, on the card that holds it", () => {
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* The cap and the age sit under `Dictation history`; `Context objects` is a
       different card, which is the whole of what four rows under one heading
       could not say. */
    const dictation = screen.getByText("Dictation history").closest(".ws-card");
    expect(dictation).not.toBeNull();
    const inDictation = within(dictation as HTMLElement);
    expect(inDictation.getByLabelText("Stored dictations")).toBeInTheDocument();
    expect(inDictation.getByLabelText("Retention")).toBeInTheDocument();
    expect(
      screen.getByText("Every dictation, whatever mode ran on it — the failed ones too."),
    ).toBeInTheDocument();

    const context = screen.getByText("Context objects").closest(".ws-card");
    expect(context).not.toBeNull();
    expect(within(context as HTMLElement).queryByLabelText("Stored dictations")).toBeNull();
  });

  it("states that both rules bind rather than only the age", () => {
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* `prune_entries` sweeps by age and then by count, so `Keep all` still
       loses the record past the cap. The old sentence described half of it. */
    expect(inRow("Retention").getByText("Whichever binds first: this age, or the cap above."))
      .toBeInTheDocument();
  });

  it("carries the audio rule the screen used to omit", () => {
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* ADR 0039 is built and was unstated here: a raw recording of everything the
       microphone heard, kept for days. */
    expect(inRow("A failure's audio").getByText("7 days · 20 files")).toBeInTheDocument();
    expect(
      inRow("Audio").getByText("Sent to the provider, then discarded — a failure's is kept here for a retry."),
    ).toBeInTheDocument();
  });

  it("bounds the copilot's reach and marks the rule as unbuilt", () => {
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const row = inRow("The copilot's index");
    expect(row.getByText("Context objects only")).toBeInTheDocument();
    /* The rule is decided; the mechanism is not, and the row says which of the
       two it is rather than reading as a reading of the runtime (ADR 0161). */
    expect(row.getByText("Preview")).toBeInTheDocument();
    expect(
      inRow("The rules above").getByText(
        "They govern disk, not reach. Keeping more shows a model nothing more.",
      ),
    ).toBeInTheDocument();
  });
});

/**
 * THE THREE DOORS `core::backup` ANSWERS, and the two cases that came off the
 * fidelity suite when this screen left the gallery.
 */
describe("Privacy & Data · export, import and reset", () => {
  it("writes the archive the row promises and says what went into it", async () => {
    const runtime = createWorkspaceRuntime({ active: true });
    invoked.mockImplementation(async (command: string) => {
      if (command === "export_full_backup") return { history_count: 174, transcript_count: 174 };
      return undefined;
    });
    render(<PrivacyScreen runtime={runtime} />);

    await userEvent.click(inRow("Full export").getByRole("button", { name: "Export" }));

    await waitFor(() =>
      expect(invoked).toHaveBeenCalledWith("export_full_backup", {
        request: { path: "/tmp/chosen-archive.json" },
      }),
    );
    expect(await screen.findByText(/174 records and 174 transcript files/)).toBeInTheDocument();
  });

  /* The rule the whole module is arranged around: an import states where the
     state it replaced went, because that is the way back. */
  it("names the snapshot an import wrote, and the one thing an archive cannot carry", async () => {
    const runtime = createWorkspaceRuntime({ active: true });
    invoked.mockImplementation(async (command: string) => {
      if (command === "import_full_backup") {
        return {
          snapshot_path: "/data/config.backup-import-1.json",
          history_count: 12,
          transcript_count: 12,
        };
      }
      return undefined;
    });
    render(<PrivacyScreen runtime={runtime} />);

    await userEvent.click(inRow("Full import").getByRole("button", { name: "Import" }));

    expect(
      await screen.findByText(/went to \/data\/config.backup-import-1.json/),
    ).toBeInTheDocument();
    expect(screen.getByText(/The API key is not in an archive/)).toBeInTheDocument();
  });

  it("states what a reset kept, rather than only what it undid", async () => {
    const runtime = createWorkspaceRuntime({ active: true });
    invoked.mockImplementation(async (command: string) => {
      if (command === "reset_all_settings") {
        return { snapshot_path: "/data/config.backup-reset-1.json", kept_profiles: 6 };
      }
      return undefined;
    });
    render(<PrivacyScreen runtime={runtime} />);

    await userEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(await screen.findByText(/6 profiles and the history stayed/)).toBeInTheDocument();
  });

  it("exports the profile the picker names, with its words rather than its legacy string", async () => {
    const config = createAppConfig();
    config.text_profiles = [
      {
        ...config.text_profiles[0],
        id: "p-1",
        label: "General writing",
        prompt: "Write plainly.",
        /* The legacy field still holds what a pre-migration profile carried.
           Nothing has written it since ADR 0035 and the recognizer stopped
           reading it, so an export that carried IT would ship a word list the
           user has not seen in six legs. */
        stt_hints: "stale\nfrom before",
        vocabulary_hints: [
          { ...config.text_profiles[0].vocabulary_hints[0], id: "v-1", phrase: "Kubernetes" },
        ],
        dictionary_entries: [],
        snippet_entries: [],
      },
    ];
    config.active_text_profile_id = "p-1";

    invoked.mockImplementation(async (command: string) => {
      if (command === "export_text_rules") {
        return { path: "/tmp/chosen-archive.json", analysis: { blocking: false } };
      }
      return undefined;
    });
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true, config })} />);

    await userEvent.click(inRow("Profile rules").getByRole("button", { name: "Export" }));

    await waitFor(() =>
      expect(invoked).toHaveBeenCalledWith("export_text_rules", {
        request: {
          path: "/tmp/chosen-archive.json",
          prompt: "Write plainly.",
          stt_hints: "Kubernetes",
          dictionary_entries: [],
          snippet_entries: [],
        },
      }),
    );
  });

  /* The rule this half is arranged around, and it is the opposite of the
     archive's: an import that REPLACES has to say where the replaced state
     went, and an import that replaces NOTHING has to say that it did not. */
  it("adds an imported file as a new profile without replacing or switching one", async () => {
    const patch = vi.fn();
    const config = createAppConfig();
    config.text_profiles = [{ ...config.text_profiles[0], id: "p-1", label: "General writing" }];
    config.active_text_profile_id = "p-1";

    invoked.mockImplementation(async (command: string) => {
      if (command === "import_text_rules") {
        return {
          document: {
            schema_version: 1,
            prompt: "Imported prompt.",
            stt_hints: "Postgres",
            dictionary_entries: [{ id: "theirs-1", phrase: "hdb", replace_with: "Herzliche Grüße" }],
            snippet_entries: [],
          },
          analysis: { blocking: false },
        };
      }
      return undefined;
    });
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true, config, patch })} />);

    await userEvent.click(inRow("Import rules").getByRole("button", { name: "Import" }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const written = patch.mock.calls[0][0];
    expect(written.text_profiles).toHaveLength(2);
    expect(written.text_profiles[0].id).toBe("p-1");
    /* The profile that was here is untouched and still the active one. */
    expect(written.active_text_profile_id).toBe("p-1");

    const added = written.text_profiles[1];
    expect(added.label).toBe("Chosen archive");
    expect(added.prompt).toBe("Imported prompt.");
    /* THE WORDS SURVIVE THE SCHEMA GAP. The document has nowhere but its
       newline string to carry terms, and a profile whose terms live only there
       reaches no recognizer (ADR 0035) — so the import converts them. This is
       the door ADR 0112 kept when it removed the config migrations: an archive
       comes from another machine and another build, which this machine's disk
       does not. */
    expect(added.vocabulary_hints.map((hint: { phrase: string }) => hint.phrase)).toEqual([
      "Postgres",
    ]);
    /* And the rule ids are this machine's, for `duplicateTextProfile`'s reason:
       a file's ids were minted in somebody else's profile. */
    expect(added.dictionary_entries[0].id).not.toBe("theirs-1");
    expect(added.dictionary_entries[0].replace_with).toBe("Herzliche Grüße");

    expect(await screen.findByText(/no profile was replaced/)).toBeInTheDocument();
  });

  it("answers whether anything leaves with a fact, not with a door", () => {
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true })} />);
    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(screen.getByText(/There is no WordScript account/)).toBeInTheDocument();
  });

  it("heads the destructive pair with its consequence rather than a neighbourhood", () => {
    const { container } = render(
      <PrivacyScreen runtime={createWorkspaceRuntime({ active: true })} />,
    );
    expect(screen.getByRole("heading", { name: "Delete and reset" })).toBeInTheDocument();
    expect(screen.queryByText(/danger zone/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll(".ws-row[data-danger]")).toHaveLength(2);
  });
});
