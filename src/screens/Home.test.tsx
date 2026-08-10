import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { HomeScreen } from "./Home";
import { createAppConfig, createWorkspaceRuntime } from "@/test/factories";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => undefined) }));

const invoked = vi.mocked(invoke);

/**
 * Home is still in the gallery, so its fidelity is still measured in
 * `screens.test.tsx`. This is the other half — and the assertion that matters
 * most on this screen is the NEGATIVE one: the decision inbox is not drawn.
 */

const TRIGGER = {
  bindings: [
    {
      label: "capture",
      role: "capture",
      configured: "Ctrl+Super",
      display: "Ctrl + Super",
      registered: true,
      error: null,
      presses: 0,
      releases: 0,
      last_press_ms: null,
      last_release_ms: null,
    },
  ],
};

beforeEach(() => {
  invoked.mockReset();
  invoked.mockImplementation(async (command: string) => {
    if (command === "native_trigger_status") return TRIGGER;
    if (command === "resolve_current_processing_mode") {
      return { mode: "cleanup", auto_detected: false, detected_from: null };
    }
    if (command === "transcription_history_entries") return [];
    if (command === "transcription_history_storage_status") return { path: "/tmp/history.json" };
    return undefined;
  });
});

afterEach(cleanup);

describe("Home, wired", () => {
  it("draws no decision inbox, because none of its three sources has a receiver", async () => {
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* ADR 0044's inbox is the one place on this surface where inventing content
       would invent a QUESTION. The drawing's own rule is that nothing is drawn
       when nothing is owed. */
    expect(screen.queryByText(/Waiting for you/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Budget for Q2 headcount/)).not.toBeInTheDocument();
  });

  it("says what the activation mode actually does, not what the drawing assumed", async () => {
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* The shipped default is `tap`, and "Release to stop" is true of exactly
       one of the three modes. */
    expect(await screen.findByText("Press in any app to dictate")).toBeInTheDocument();
    expect(screen.queryByText("Hold in any app to dictate")).not.toBeInTheDocument();
  });

  it("keeps the drawing's sentence for the mode the drawing drew", async () => {
    const runtime = createWorkspaceRuntime({
      active: true,
      config: createAppConfig({ activation_mode: "hold" }),
    });
    render(<HomeScreen runtime={runtime} />);

    expect(await screen.findByText("Hold in any app to dictate")).toBeInTheDocument();
    expect(
      screen.getByText("Release to stop. What it produces goes to the cursor you left."),
    ).toBeInTheDocument();
  });

  it("shows the trigger the runtime resolved as caps, never the raw token", async () => {
    const { container } = render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await waitFor(() => expect(invoked).toHaveBeenCalledWith("native_trigger_status"));
    const caps = [...container.querySelectorAll(".ws-keycap")].map((cap) => cap.textContent);
    expect(caps).toEqual(["Ctrl", "Super"]);
  });

  it("states which mode is effective right now from the router, not from the config", async () => {
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await waitFor(() => expect(invoked).toHaveBeenCalledWith("resolve_current_processing_mode"));
    expect(await screen.findByText("Cleanup")).toBeInTheDocument();
  });

  it("lists this machine's last five records rather than the drawing's five", async () => {
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(await screen.findByRole("heading", { name: "Recent · 0" })).toBeInTheDocument();
    expect(
      screen.queryByText("Let’s ship the settings restructure today and review the overlay tab."),
    ).not.toBeInTheDocument();
  });

  it("reads nothing for a view nobody opened", () => {
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: false })} />);
    expect(invoked).not.toHaveBeenCalled();
  });
});

describe("Home, in the gallery", () => {
  it("is the drawing, inbox and all, and reads nothing", () => {
    render(<HomeScreen />);

    expect(screen.getByRole("heading", { name: "Waiting for you · 3" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent · 5" })).toBeInTheDocument();
    expect(screen.getByText("Hold in any app to dictate")).toBeInTheDocument();
    expect(invoked).not.toHaveBeenCalled();
  });
});
