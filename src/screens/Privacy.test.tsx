import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { PrivacyScreen } from "./Privacy";
import { createAppConfig, createWorkspaceRuntime } from "@/test/factories";

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

  it("keeps the three doors with no command drawn and inert", () => {
    render(<PrivacyScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* `export_transcription_history` writes the HISTORY as JSON and is wired on
       History. "Everything local, as one archive" is a different thing and
       nothing produces it; import and reset-to-defaults do not exist at all. */
    for (const name of ["Export", "Import", "Reset"]) {
      const control = screen.getByRole("button", { name });
      expect(control, name).toBeDisabled();
      expect(control, name).toHaveAttribute("title", "No command exists for this yet");
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

describe("Privacy & Data, in the gallery", () => {
  it("is the drawing, with every door live and nothing read", async () => {
    render(<PrivacyScreen />);

    for (const name of ["Export", "Import", "Reset", "Clear"]) {
      expect(screen.getByRole("button", { name }), name).not.toBeDisabled();
    }
    await waitFor(() => expect(invoked).not.toHaveBeenCalled());
  });
});
