import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { DiagnosticsScreen } from "./Diagnostics";
import { createWorkspaceRuntime } from "@/test/factories";
import type { V1SliceResult, V1SliceStatus } from "@/types/v1Slice";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const invoked = vi.mocked(invoke);

/**
 * WHAT A WIRED SCREEN'S TEST IS FOR. Not fidelity — this screen has left the
 * gallery (ADR 0057) and there is no measurement any more — but WHICH facts
 * come from the runtime, and that the ones that do not are visibly absent
 * rather than invented (rule 7). This screen is the one Leg 3 gave up about a
 * thousand lines of real checks on, so the assertions that matter most are the
 * ones that would fail if it went back to being a drawing.
 */

function sliceStatus(overrides: Partial<V1SliceStatus> = {}): V1SliceStatus {
  return {
    stage: "idle",
    session_id: null,
    active_trigger: null,
    preferred_provider: "groq",
    architecture_mode: "native_runtime_slice",
    runtime_contract: {
      provider: "groq",
      provider_profile: "cloud_fast",
      model: "whisper-large-v3-turbo",
      work_mode: {
        processing_mode: "auto",
        rewrite_style: "clean",
        insert_behavior: "auto_paste",
        recovery_behavior: "standard",
      },
      provider_status: { ready: true, detail: null, local_setup: null },
      capture_status: {
        is_recording: false,
        muted: false,
        paused: false,
        device_name: "Yeti Nano Analog Stereo",
        silence_seconds: 3,
      },
      local: null,
    },
    last_transcript: null,
    last_insert_target: null,
    last_error: null,
    pipeline: [],
    capabilities: {
      cloud_transcription: true,
      local_transcription: false,
      insertion_fallback: true,
      typed_contracts: true,
      rebuild_lab: true,
    },
    next_milestones: [],
    ...overrides,
  };
}

function sliceResult(): V1SliceResult {
  return {
    status: sliceStatus({
      stage: "completed",
      session_id: "slice-7",
      pipeline: [
        { step: "capture", state: "completed", duration_ms: 12, error_code: null, detail: null },
        { step: "provider", state: "completed", duration_ms: 3, error_code: null, detail: null },
        { step: "transform", state: "completed", duration_ms: 1, error_code: null, detail: null },
        { step: "insert", state: "completed", duration_ms: 0, error_code: null, detail: null },
      ],
    }),
    transcript: {
      raw_text: "um wir shippen morgen",
      final_text: "Wir shippen morgen.",
      provider_mode: "cloud_fast",
      profile: "general",
      applied_rules: ["removed_fillers", "capitalized_sentence_start", "added_terminal_punctuation"],
    },
    insertion: {
      target: "editor_preview",
      mode: "in_app_preview",
      fallback: "clipboard fallback planned",
    },
  };
}

beforeEach(() => {
  invoked.mockReset();
  invoked.mockImplementation(async (command: string) => {
    if (command === "v1_slice_status" || command === "reset_v1_slice") return sliceStatus();
    if (command === "start_v1_slice_capture") return sliceStatus({ stage: "capturing", session_id: "slice-7" });
    if (command === "complete_v1_slice_capture") return sliceResult();
    if (command === "runtime_log_entries") return [];
    return undefined;
  });
});

afterEach(cleanup);

describe("Diagnostics", () => {
  it("opens on Checks, with the sub-tab row inside the masthead", async () => {
    const { container } = render(<DiagnosticsScreen runtime={createWorkspaceRuntime()} />);
    const top = container.querySelector(".ws-view-top")!;
    expect(top.querySelector(".ws-subtabs")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Runtime snapshot" })).toBeInTheDocument();
    await waitFor(() => expect(invoked).toHaveBeenCalledWith("v1_slice_status"));
  });

  it("states the snapshot the native runtime handed back, not a plausible one", async () => {
    render(<DiagnosticsScreen runtime={createWorkspaceRuntime()} />);
    expect(await screen.findByText("groq / whisper-large-v3-turbo")).toBeInTheDocument();
    expect(screen.getByText("Yeti Nano Analog Stereo")).toBeInTheDocument();
    expect(screen.getByText("no session armed")).toBeInTheDocument();
    // auto, resolved by the router to cleanup for a `clean` rewrite style.
    expect(screen.getByText("auto → cleanup")).toBeInTheDocument();
  });

  it("says a pipeline that has not run has not run", async () => {
    render(<DiagnosticsScreen runtime={createWorkspaceRuntime()} />);
    await screen.findByText("groq / whisper-large-v3-turbo");
    const pipeline = screen.getByText("Pipeline").closest(".ws-row")!;
    expect(within(pipeline as HTMLElement).getByText("not run")).toBeInTheDocument();
  });

  it("runs a real capture-to-insert pass and reports every stage's duration", async () => {
    render(<DiagnosticsScreen runtime={createWorkspaceRuntime()} />);
    await screen.findByText("groq / whisper-large-v3-turbo");

    await userEvent.click(screen.getByRole("button", { name: /Run check/ }));

    await waitFor(() => expect(invoked).toHaveBeenCalledWith("start_v1_slice_capture", expect.anything()));
    expect(invoked).toHaveBeenCalledWith("complete_v1_slice_capture", expect.anything());
    expect(
      await screen.findByText(
        "capture completed 12ms · provider completed 3ms · transform completed 1ms · insert completed 0ms",
      ),
    ).toBeInTheDocument();
  });

  it("offers the profiles this machine has, not three sample names", async () => {
    const runtime = createWorkspaceRuntime();
    render(<DiagnosticsScreen runtime={runtime} />);
    const select = screen.getByLabelText("Text profile") as HTMLSelectElement;
    expect([...select.options].map((option) => option.value)).toEqual(
      runtime.config.text_profiles.map((profile) => profile.id),
    );
  });

  it("shows raw beside transformed, and offers no commit action for it", async () => {
    render(<DiagnosticsScreen runtime={createWorkspaceRuntime()} />);
    await screen.findByText("groq / whisper-large-v3-turbo");
    await userEvent.click(screen.getByRole("tab", { name: "Preview" }));

    expect(screen.getByText("Raw")).toBeInTheDocument();
    expect(screen.getByText("Cleanup")).toBeInTheDocument();
    /* §11.15: a commit control here would commit a session nobody dictated.
       That is half the reason `Live preview & commit` is withdrawn. */
    expect(screen.queryByRole("button", { name: /commit/i })).not.toBeInTheDocument();
  });

  it("says nothing about a preview until a check has produced one", async () => {
    render(<DiagnosticsScreen runtime={createWorkspaceRuntime()} />);
    await screen.findByText("groq / whisper-large-v3-turbo");
    await userEvent.click(screen.getByRole("tab", { name: "Preview" }));

    expect(screen.getAllByText("not run").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No check has run in this session.")).toHaveLength(2);
    // The empty ring, not a tick: a probe that has not run.
    expect(document.querySelector('.ws-check[data-state="todo"]')).not.toBeNull();
  });

  it("decodes the rules the transform actually applied, and marks what changed", async () => {
    render(<DiagnosticsScreen runtime={createWorkspaceRuntime()} />);
    await screen.findByText("groq / whisper-large-v3-turbo");
    await userEvent.click(screen.getByRole("button", { name: /Run check/ }));
    await screen.findByText(/capture completed/);
    await userEvent.click(screen.getByRole("tab", { name: "Preview" }));

    expect(screen.getByText("Removed filler words")).toBeInTheDocument();
    expect(screen.getByText("Added final punctuation")).toBeInTheDocument();
    // A rule the runtime did not report is not listed. The vocabulary knows it.
    expect(screen.queryByText("AI post-correction applied")).toBeNull();
    // "Wir" and "morgen." are not in the raw text's word multiset; "shippen" is.
    const marks = [...document.querySelectorAll(".ws-diff-pane[data-side='out'] mark")].map(
      (mark) => mark.textContent,
    );
    expect(marks).toEqual(["Wir", "morgen."]);
  });

  it("leaves the log level empty, because the runtime log has no severity field", async () => {
    invoked.mockImplementation(async (command: string) => {
      if (command === "runtime_log_entries") {
        return ["[1770000000000 +12.345] [WordScript] capture: started, device=System default"];
      }
      if (command === "v1_slice_status") return sliceStatus();
      return undefined;
    });

    render(<DiagnosticsScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await userEvent.click(screen.getByRole("tab", { name: "Logs" }));

    const line = await screen.findByText(/capture: started/);
    expect(line).toBeInTheDocument();
    const levels = [...document.querySelectorAll(".ws-lv")];
    expect(levels).toHaveLength(1);
    expect(levels[0].getAttribute("data-l")).toBeNull();
    expect(levels[0].textContent).toBe("");
  });

  it("does not poll the runtime log for a tab nobody is looking at", async () => {
    render(<DiagnosticsScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await screen.findByText("groq / whisper-large-v3-turbo");
    expect(invoked).not.toHaveBeenCalledWith("runtime_log_entries");
  });
});
