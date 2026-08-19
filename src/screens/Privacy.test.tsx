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

/** Since ADR 0185 the collections answer the same question in the same words —
 *  `Kept for` — so a row query alone is ambiguous by design and the card is
 *  what disambiguates it, for the test as for the reader. */
function inCard(title: string) {
  const card = screen.getByText(title).closest(".ws-card");
  if (!card) throw new Error(`No card titled ${title}`);
  return within(card as HTMLElement);
}

/** A row inside a named card, which `On this machine now` needs since ADR 0237:
 *  two collections now state a reading under that label, and neither of them is
 *  the other's. */
function inCardRow(card: string, label: string) {
  const row = inCard(card).getByText(label).closest(".ws-row");
  if (!row) throw new Error(`No row labelled ${label} in ${card}`);
  return within(row as HTMLElement);
}

const parkedRow = () => inCardRow("Audio from a failed dictation", "On this machine now");
const archiveRow = () => inCardRow("Transcript files", "On this machine now");

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
      config: createAppConfig({ history_retention_days: 30 }),
      patch,
    });
    render(<PrivacyScreen runtime={runtime} />);

    expect(screen.getByLabelText("Kept for")).toHaveValue("30");

    await userEvent.selectOptions(screen.getByLabelText("Kept for"), "0");
    /* `No age limit` is 0 in the config, which is the runtime's own encoding of
       "do not prune by age" rather than a sentinel invented here. */
    expect(patch).toHaveBeenCalledWith({ history_retention_days: 0 });
  });

  /**
   * ADR 0185, then ADR 0241. Two pickers over one list meant neither could be
   * read: the count swept after the age, so `Keep all` still dropped the 1001st
   * record. ADR 0185 stopped offering the count and stated it instead; ADR 0241
   * deleted it, because a bound on stored dictations is a bound in bytes and a
   * number of records was the wrong unit in either presentation. **NO NUMBER OF
   * DICTATIONS APPEARS ON THIS SCREEN AT ALL**, which is what this asserts.
   */
  it("offers no count cap and no longer states one", () => {
    const patch = vi.fn();
    render(
      <PrivacyScreen
        runtime={createWorkspaceRuntime({
          active: true,
          config: createAppConfig({ history_retention_days: 90 }),
          patch,
        })}
      />,
    );

    expect(screen.queryByLabelText("Stored dictations")).toBeNull();
    expect(screen.queryByText("The index's ceiling")).toBeNull();
    expect(screen.queryByText(/^Newest \d/)).toBeNull();

    /* Reading a rule must not write one: a screen that patched on render would
       put its own opinion of the retention on disk. */
    expect(patch).not.toHaveBeenCalled();
  });

  it("asks how long in months rather than in days nobody counts", () => {
    render(
      <PrivacyScreen
        runtime={createWorkspaceRuntime({
          active: true,
          config: createAppConfig({ history_retention_days: 90 }),
        })}
      />,
    );

    const select = screen.getByLabelText("Kept for") as HTMLSelectElement;
    expect([...select.options].map((option) => option.textContent)).toEqual([
      "7 days",
      "1 month",
      "3 months",
      "1 year",
      "No age limit",
    ]);
    /* Never `Keep all`, which is the one thing the runtime has never done. */
    expect(screen.queryByText("Keep all")).toBeNull();
  });

  it("keeps a stored retention the drawing does not offer rather than moving the user", () => {
    render(
      <PrivacyScreen
        runtime={createWorkspaceRuntime({
          active: true,
          config: createAppConfig({ history_retention_days: 45 }),
        })}
      />,
    );

    const select = screen.getByLabelText("Kept for") as HTMLSelectElement;
    expect(select).toHaveValue("45");
    expect([...select.options].map((option) => option.value)).toEqual([
      "7",
      "30",
      "90",
      "365",
      "0",
      "45",
    ]);
  });

  /**
   * ADR 0185, the other half. The screen recited ADR 0039's rule — seven days,
   * twenty files — and could not say whether anything was under it, which is
   * the question a privacy screen is actually opened with. A raw WAV of
   * everything the microphone heard is the most sensitive thing this product
   * holds, so the count is read from the runtime and never assumed.
   */
  it("says nothing is parked when nothing is, and draws no door onto an empty folder", async () => {
    invoked.mockImplementation(async (command) =>
      command === "retained_capture_status"
        ? {
            count: 0,
            bytes: 0,
            oldest_age_ms: null,
            max_age_days: 7,
            max_files: 20,
            directory: "/tmp/ws",
          }
        : undefined,
    );
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await waitFor(() => {
      expect(parkedRow().getByText("Nothing kept")).toBeTruthy();
    });
    /* A button that would delete nothing is the fake affordance rule 7
       forbids. */
    expect(parkedRow().queryByRole("button", { name: "Delete now" })).toBeNull();
  });

  it("counts what a failure left behind and deletes it on request", async () => {
    invoked.mockImplementation(async (command) => {
      if (command === "retained_capture_status") {
        return {
          count: 3,
          bytes: 4_200_000,
          oldest_age_ms: 2 * 24 * 3_600_000,
          max_age_days: 7,
          max_files: 20,
          directory: "/tmp/ws",
        };
      }
      if (command === "discard_retained_captures") {
        return {
          count: 0,
          bytes: 0,
          oldest_age_ms: null,
          max_age_days: 7,
          max_files: 20,
          directory: "/tmp/ws",
        };
      }
      return undefined;
    });
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await waitFor(() => {
      expect(parkedRow().getByText("3 files · 4.2 MB · oldest 2 days old")).toBeTruthy();
    });

    await userEvent.click(parkedRow().getByRole("button", { name: "Delete now" }));

    expect(invoked).toHaveBeenCalledWith("discard_retained_captures");
    /* The row redraws from the answer rather than from an assumption about what
       the command did, and it names the cost: the retry the file was kept for
       is gone with it. */
    await waitFor(() => {
      expect(parkedRow().getByText("Nothing kept")).toBeTruthy();
    });
    expect(
      screen.getByText(/can no longer be retried from its audio/),
    ).toBeTruthy();
  });

  /**
   * ADR 0241. Both collections are bounded in bytes now, and both state what
   * they weigh. **THE FIGURE IS THE INSTRUMENT AND THE THRESHOLD IS NOT**: at
   * the reporting machine's 217 dictations a day, 5 GB of index is decades
   * away, so a row wired only to the threshold would be a row that never says
   * anything in the life of an install.
   */
  it("states what the index weighs, against a ceiling it is nowhere near", async () => {
    invoked.mockImplementation(async (command) => {
      if (command === "transcription_history_storage_status") {
        return {
          path: "/home/me/.config/WordScript/history.jsonl",
          bytes: 1_208_861,
          warning_bytes: 5_368_709_120,
          ceiling_bytes: 10_737_418_240,
        };
      }
      return undefined;
    });
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const row = () => inCardRow("Dictation history", "On this machine now");
    await waitFor(() => {
      expect(row().getByText("1.2 MB")).toBeTruthy();
    });
    expect(row().getByText(/backstop against a runaway and nothing you will reach/))
      .toBeTruthy();
    /* And it must not read as a warning at a thousandth of the threshold. */
    expect(row().queryByText(/the oldest records start dropping out/)).toBeNull();
  });

  /** And when it does arrive, the row is the one that says so. */
  it("warns on the index once it is past five gigabytes", async () => {
    invoked.mockImplementation(async (command) => {
      if (command === "transcription_history_storage_status") {
        return {
          path: "/home/me/.config/WordScript/history.jsonl",
          bytes: 6_000_000_000,
          warning_bytes: 5_368_709_120,
          ceiling_bytes: 10_737_418_240,
        };
      }
      return undefined;
    });
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const row = () => inCardRow("Dictation history", "On this machine now");
    await waitFor(() => {
      expect(row().getByText("6.0 GB")).toBeTruthy();
    });
    expect(row().getByText(/the oldest records start dropping out/)).toBeTruthy();
  });

  /**
   * ADR 0237. The archive stopped sharing the index's rule, so it needs the
   * same two things the card above has — and the reading matters more here,
   * because a file whose entry the retention already dropped has no row in
   * History at all. This count is the only place it is admitted to.
   */
  it("counts the transcript archive apart from the index and purges it on request", async () => {
    invoked.mockImplementation(async (command) => {
      if (command === "transcript_store_status") {
        return {
          root: "/home/me/WordScript/transcripts",
          exists: true,
          files: 394,
          bytes: 812_000,
          warning_bytes: 5_368_709_120,
          ceiling_bytes: 10_737_418_240,
        };
      }
      if (command === "purge_transcript_archive") {
        return {
          root: "/home/me/WordScript/transcripts",
          exists: true,
          files: 0,
          bytes: 0,
          warning_bytes: 5_368_709_120,
          ceiling_bytes: 10_737_418_240,
        };
      }
      return undefined;
    });
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await waitFor(() => {
      expect(archiveRow().getByText("394 files · 812 KB")).toBeTruthy();
    });
    /* The rule the card states is the one that changed: the age picker above
       does not reach these, and since ADR 0241 a byte ceiling does. */
    expect(
      inCard("Transcript files").getByText(/Nothing prunes them by age/),
    ).toBeTruthy();

    await userEvent.click(archiveRow().getByRole("button", { name: "Delete now" }));

    expect(invoked).toHaveBeenCalledWith("purge_transcript_archive");
    await waitFor(() => {
      expect(archiveRow().getByText("Nothing stored")).toBeTruthy();
    });
    /* And it says what it did NOT delete, because the command walks a folder
       the reader also keeps their own files in. */
    expect(screen.getByText(/added to that folder yourself were left/)).toBeTruthy();
  });

  it("draws no purge door onto an empty archive", async () => {
    invoked.mockImplementation(async (command) =>
      command === "transcript_store_status"
        ? { root: "/home/me/WordScript/transcripts", exists: false, files: 0, bytes: 0 }
        : undefined,
    );
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await waitFor(() => {
      expect(archiveRow().getByText("Nothing stored")).toBeTruthy();
    });
    expect(archiveRow().queryByRole("button", { name: "Delete now" })).toBeNull();
  });

  it("claims nothing about the disk when the runtime does not answer", async () => {
    invoked.mockImplementation(async (command) => {
      if (command === "retained_capture_status") throw new Error("no such folder");
      if (command === "transcript_store_status") throw new Error("no such folder");
      return undefined;
    });
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await waitFor(() => {
      expect(parkedRow().getByText("Not read")).toBeTruthy();
    });
    /* Not `Nothing kept`: a status the screen could not read is not a statement
       that the folder is empty. */
    expect(parkedRow().queryByText("Nothing kept")).toBeNull();
    /* And the same for the archive, which fails the same way for the same
       reason (ADR 0237). */
    expect(archiveRow().getByText("Not read")).toBeTruthy();
    expect(archiveRow().queryByText("Nothing stored")).toBeNull();
  });

  /**
   * ADR 0182. The baseline was eight anonymous numbers in a dropdown, which
   * asks the reader for a figure about themselves that almost nobody has
   * measured and offers no way to enter the one a person who HAS measured it
   * knows. Three descriptions and a field, and the field is what these cases
   * are about: it is the half a `Select` could not do.
   */
  it("takes a typing baseline nobody offered, and presses no preset for it", async () => {
    const patch = vi.fn();
    const runtime = createWorkspaceRuntime({
      active: true,
      config: createAppConfig({ typing_baseline_wpm: 40 }),
      patch,
    });
    render(<PrivacyScreen runtime={runtime} />);

    const field = screen.getByLabelText("Typing baseline in words a minute");
    await userEvent.clear(field);
    await userEvent.type(field, "58");

    expect(patch).toHaveBeenLastCalledWith({ typing_baseline_wpm: 58 });

    /* And once the config holds it, no preset claims it: a hand-entered figure
       is the reader's own, and a pressed segment beside it would say the
       product had rounded them into a category. Rendered from the stored value
       rather than asserted after the keystrokes, because the runtime in a test
       records the patch instead of applying it. */
    cleanup();
    render(
      <PrivacyScreen
        runtime={createWorkspaceRuntime({
          active: true,
          config: createAppConfig({ typing_baseline_wpm: 58 }),
        })}
      />,
    );
    expect(screen.getByLabelText("Typing baseline in words a minute")).toHaveValue("58");
    for (const name of ["Two fingers · 30", "Average · 40", "Touch typist · 70"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("writes no baseline at all for a value that is not one", async () => {
    const patch = vi.fn();
    const runtime = createWorkspaceRuntime({
      active: true,
      config: createAppConfig({ typing_baseline_wpm: 40 }),
      patch,
    });
    render(<PrivacyScreen runtime={runtime} />);

    const field = screen.getByLabelText("Typing baseline in words a minute");
    await userEvent.clear(field);
    /* Typing `7` on the way to `70` must not put a 7 wpm divisor on disk, and
       an empty field is not a baseline of nothing. */
    expect(patch).not.toHaveBeenCalled();
    await userEvent.type(field, "7");
    expect(patch).not.toHaveBeenCalled();
    expect(field).toHaveAttribute("data-invalid");

    await userEvent.type(field, "0");
    expect(patch).toHaveBeenLastCalledWith({ typing_baseline_wpm: 70 });
  });

  it("takes a preset as the whole answer for a reader who does not know theirs", async () => {
    const patch = vi.fn();
    const runtime = createWorkspaceRuntime({
      active: true,
      config: createAppConfig({ typing_baseline_wpm: 40 }),
      patch,
    });
    render(<PrivacyScreen runtime={runtime} />);

    expect(screen.getByRole("button", { name: "Average · 40" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Touch typist · 70" }));
    expect(patch).toHaveBeenLastCalledWith({ typing_baseline_wpm: 70 });
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

    /* The age rule sits under `Dictation history`; the parked recording and the
       context objects are cards of their own, which is the whole of what four
       rows under one heading could not say. The ceiling row that used to stand
       beside the rule went with ADR 0241. */
    const dictation = screen.getByText("Dictation history").closest(".ws-card");
    expect(dictation).not.toBeNull();
    const inDictation = within(dictation as HTMLElement);
    expect(inDictation.getByLabelText("Kept for")).toBeInTheDocument();
    expect(
      screen.getByText("Every dictation, whatever mode ran on it — the failed ones too."),
    ).toBeInTheDocument();

    const context = screen.getByText("Context objects").closest(".ws-card");
    expect(context).not.toBeNull();
    expect(within(context as HTMLElement).queryByLabelText("Kept for")).toBeNull();
  });

  /**
   * ADR 0185, completed by ADR 0241. The sentence this replaces — "whichever
   * binds first: this age, or the cap above" — was true, and its existence was
   * the defect: it only had to be written because the screen offered two rules
   * over one list. ADR 0185 left one rule and one stated ceiling; ADR 0241 left
   * **one rule**, so there is nothing on this card for a reconciliation
   * sentence to reconcile.
   */
  it("states one rule for the reader and nothing to weigh it against", () => {
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(
      inCard("Dictation history").getByText(
        "This drops the record from History. Your transcript files are kept — they have their own rule below.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Beyond this the oldest drops out/)).toBeNull();
    expect(screen.queryByText("Whichever binds first: this age, or the cap above.")).toBeNull();
  });

  it("gives the audio a failure parks a card of its own", () => {
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* ADR 0039's rule is not a dictation-history row: a raw recording of
       everything the microphone heard is its own collection, and ADR 0185 moved
       it out of the card whose rule is that a card names what it governs. */
    const audio = screen.getByText("Audio from a failed dictation").closest(".ws-card");
    expect(audio).not.toBeNull();
    const inAudio = within(audio as HTMLElement);
    expect(inAudio.getByText("7 days · 20 files")).toBeInTheDocument();
    expect(inAudio.getByText("On this machine now")).toBeInTheDocument();

    expect(
      inRow("Audio").getByText("Sent to the provider, then discarded — a failure's is kept here for a retry."),
    ).toBeInTheDocument();
  });

  /* The context collection has no store in the runtime, so both rows state a
     decided rule rather than an observed one — and say which (rule 7). */
  it("marks the context rules as decided rather than observed", () => {
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const context = inCard("Context objects");
    expect(context.getByText("Until you delete them")).toBeInTheDocument();
    expect(context.getAllByText("Preview")).toHaveLength(2);
    const meeting = inRow("Meeting audio");
    expect(meeting.getByText("Preview")).toBeInTheDocument();
    /* `Own budget` named the existence of a setting instead of the rule. */
    expect(meeting.getByText("Until the note is saved")).toBeInTheDocument();
    expect(screen.queryByText("Own budget")).toBeNull();
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
    /* Three since ADR 0176: clearing the history no longer takes the lifetime
       figures with it, so wanting those gone is its own door. */
    expect(container.querySelectorAll(".ws-row[data-danger]")).toHaveLength(3);
  });

  /* ADR 0176. The figures are their own file — deleting transcripts must not
     cost somebody their record of a year's dictation — so the one control that
     clears them says so where a reader looks for destructive doors. */
  it("clears the lifetime figures through their own door, not through the history's", async () => {
    const user = userEvent.setup();
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await user.click(screen.getByRole("button", { name: "Clear figures" }));

    expect(invoked).toHaveBeenCalledWith("reset_activity_ledger");
    expect(
      await screen.findByText(/Every all-time figure is back to nothing/),
    ).toBeInTheDocument();
  });
});
