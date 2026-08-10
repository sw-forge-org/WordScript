import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

    expect(screen.getByLabelText("Stored transcripts")).toHaveValue("200");
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

    const select = screen.getByLabelText("Stored transcripts") as HTMLSelectElement;
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
       the commit that made it false (ADR 0057). */
    for (const name of ["Export", "Import", "Reset", "Clear"]) {
      expect(screen.getByRole("button", { name }), name).toBeEnabled();
    }
  });

  it("opens the two surfaces its rows name", async () => {
    const open = vi.fn();
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true, open })} />);

    await userEvent.click(screen.getByRole("button", { name: "Open Context" }));
    expect(open).toHaveBeenCalledWith({ view: "context" });
    await userEvent.click(screen.getByRole("button", { name: "Open AI Models" }));
    expect(open).toHaveBeenCalledWith({ section: "models" });
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

    await userEvent.click(screen.getByRole("button", { name: "Export" }));

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

    await userEvent.click(screen.getByRole("button", { name: "Import" }));

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
