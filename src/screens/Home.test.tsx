import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { HomeScreen } from "./Home";
import { createAppConfig, createWorkspaceRuntime } from "@/test/factories";
import type { TranscriptionHistoryEntry } from "@/types/history";

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

/** A record shaped like one the runtime writes, for the inbox cases below. */
function historyEntry(
  overrides: Partial<TranscriptionHistoryEntry> = {},
): TranscriptionHistoryEntry {
  return {
    id: "e1",
    created_at_ms: Date.now(),
    status: "completed",
    source: "native_pipeline",
    retry_of: null,
    provider: "groq",
    model: null,
    language: null,
    active_profile: "General writing",
    work_mode: null,
    effective_mode: "cleanup",
    title: null,
    transcript_path: null,
    provider_profile: null,
    local_prompt_strength: null,
    local_prompt_carry: null,
    local_beam_size: null,
    local_best_of: null,
    raw_transcript: "roh",
    transformed_transcript: "Der Satz, der nicht ankam.",
    corrected: true,
    applied_rules: [],
    transform_warning: null,
    insert_mode: "direct_paste",
    active_driver: null,
    pasted: true,
    fallback_available: null,
    fallback_reason: null,
    recovery_action: null,
    recovery_message: null,
    clipboard_restore: null,
    error: null,
    audio_path: null,
    fallback_acknowledged: false,
    ...overrides,
  };
}

/** The base mock with a chosen set of records behind it. */
function mockRuntimeHistory(entries: TranscriptionHistoryEntry[]) {
  invoked.mockImplementation(async (command: string) => {
    if (command === "native_trigger_status") return TRIGGER;
    if (command === "resolve_current_processing_mode") {
      return { mode: "cleanup", auto_detected: false, detected_from: null };
    }
    if (command === "transcription_history_entries") return entries;
    if (command === "transcription_history_storage_status") return { path: "/tmp/history.json" };
    if (command === "transcript_store_status") {
      return { root: "/tmp/WordScript/transcripts", exists: true };
    }
    return undefined;
  });
}

afterEach(cleanup);

describe("Home, wired", () => {
  it("invents no question for the two sources that have no receiver", async () => {
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* ADR 0044's inbox is the one place on this surface where inventing content
       would invent a QUESTION. The desk's and the meeting's rows are drawn in
       the gallery and must never reach the product (ADR 0076). */
    expect(screen.queryByText(/Budget for Q2 headcount/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Should I update the overlay test/)).not.toBeInTheDocument();
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

/**
 * THE ONE INBOX SOURCE THAT HAS A RECEIVER (ADR 0076). What is held here is
 * the rule as much as the rendering: nothing is drawn when nothing is owed.
 */
describe("Home · the decision inbox", () => {
  it("draws nothing at all when no delivery fell back", async () => {
    mockRuntimeHistory([historyEntry({ insert_mode: "direct_paste" })]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByRole("heading", { name: /Recent/ });
    expect(screen.queryByRole("heading", { name: /Waiting for you/ })).not.toBeInTheDocument();
  });

  it("asks about a delivery that fell back, and states what doing nothing costs", async () => {
    mockRuntimeHistory([historyEntry({ insert_mode: "clipboard_fallback" })]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(await screen.findByRole("heading", { name: "Waiting for you · 1" })).toBeInTheDocument();
    expect(screen.getByText("One insert fell back to the clipboard")).toBeInTheDocument();
    expect(
      screen.getByText("The text is lost the next time you copy anything."),
    ).toBeInTheDocument();
  });

  /* The scratchpad's cost is a different one, and saying "lost when you copy"
     about it would be wrong in the direction that makes somebody act too late. */
  it("states the scratchpad's own cost rather than the clipboard's", async () => {
    mockRuntimeHistory([historyEntry({ insert_mode: "scratchpad_fallback" })]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(
      await screen.findByText("It is in the scratchpad and goes when the runtime restarts."),
    ).toBeInTheDocument();
  });

  it("stops asking once the record says it was dealt with", async () => {
    mockRuntimeHistory([
      historyEntry({ insert_mode: "clipboard_fallback", fallback_acknowledged: true }),
    ]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByRole("heading", { name: /Recent/ });
    expect(screen.queryByRole("heading", { name: /Waiting for you/ })).not.toBeInTheDocument();
  });

  it("answers the question on the record rather than in this window", async () => {
    mockRuntimeHistory([historyEntry({ insert_mode: "clipboard_fallback" })]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await userEvent.click(await screen.findByRole("button", { name: "Dismiss" }));

    expect(invoked).toHaveBeenCalledWith("acknowledge_transcription_fallback", {
      request: { id: "e1" },
    });
  });
});
