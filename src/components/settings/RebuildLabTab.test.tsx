import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppConfig } from "../../test/factories";
import { RebuildLabTab } from "./RebuildLabTab";
import type { V1SliceState, RuntimeLogState, TranscriptionHistoryState } from "../../test/types";

let v1SliceState: V1SliceState;
let runtimeLogState: RuntimeLogState;
let transcriptionHistoryState: TranscriptionHistoryState;

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(),
}));

vi.mock("../../hooks/useV1Slice", () => ({
  useV1Slice: () => v1SliceState,
}));

vi.mock("../../hooks/useRuntimeLogs", () => ({
  useRuntimeLogs: () => runtimeLogState,
}));

vi.mock("../../hooks/useTranscriptionHistory", () => ({
  useTranscriptionHistory: () => transcriptionHistoryState,
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  const baseStatus: NonNullable<typeof v1SliceState.status> = {
    stage: "completed" as const,
    session_id: "slice-1",
    active_trigger: "diagnostic_demo",
    preferred_provider: "cloud-fast",
    architecture_mode: "native-rebuild-slice",
    runtime_contract: {
      provider: "groq",
      provider_profile: "cloud-fast",
      model: "whisper-large-v3-turbo",
      work_mode: {
        rewrite_style: "clean",
        insert_behavior: "auto_paste",
        recovery_behavior: "standard",
      },
      provider_status: {
        ready: true,
        detail: "API key loaded",
        local_setup: null,
      },
      capture_status: {
        is_recording: false,
        muted: false,
        paused: false,
        device_name: null,
        silence_seconds: 0,
      },
      local_preview: null,
    },
    last_transcript: "Original transcript",
    last_insert_target: "editor_preview",
    last_error: null,
    pipeline: [
      {
        step: "capture" as const,
        state: "completed" as const,
        duration_ms: 18,
        error_code: null,
        detail: "Capture finished and handed text to the provider preview stage.",
      },
      {
        step: "provider" as const,
        state: "completed" as const,
        duration_ms: 4,
        error_code: null,
        detail: "Simulated cloud-fast transcription response prepared.",
      },
      {
        step: "transform" as const,
        state: "completed" as const,
        duration_ms: 3,
        error_code: null,
        detail: "Applied 2 runtime rules to the transcript.",
      },
      {
        step: "insert" as const,
        state: "completed" as const,
        duration_ms: 1,
        error_code: null,
        detail: "Planned InAppPreview toward editor_preview with fallback clipboard_fallback_planned.",
      },
    ],
    capabilities: {
      cloud_transcription: true,
      local_transcription: false,
      insertion_fallback: true,
      typed_contracts: true,
      rebuild_lab: true,
    },
    next_milestones: [],
  };

  v1SliceState = {
    status: baseStatus,
    result: {
      status: baseStatus,
      transcript: {
        raw_text: "ähm wir shippen das morgen",
        final_text: "Wir shippen das morgen.",
        provider_mode: "cloud-fast",
        profile: "developer",
        applied_rules: ["correction_guardrail_fallback", "removed_fillers"],
      },
      insertion: {
        target: "editor_preview",
        mode: "in_app_preview",
        fallback: "clipboard_fallback_planned",
      },
    },
    error: null,
    isPending: false,
    refresh: vi.fn(),
    startCapture: vi.fn(),
    completeCapture: vi.fn(),
    reset: vi.fn(),
  };

  runtimeLogState = {
    entries: [],
    error: null,
    isLoading: false,
    refresh: vi.fn(),
    clear: vi.fn(),
  };

  transcriptionHistoryState = {
    entries: [
      {
        id: "history-1",
        created_at_ms: Date.UTC(2026, 4, 13, 10, 15),
        status: "completed",
        source: "native_pipeline",
        retry_of: null,
        audio_path: null,
        provider: "groq",
        model: "whisper-large-v3-turbo",
        language: "de",
        active_profile: null,
        work_mode: {
          rewrite_style: "clean",
          insert_behavior: "auto_paste",
          recovery_behavior: "standard",
        },
        provider_profile: null,
        local_prompt_strength: null,
        local_prompt_carry: null,
        local_beam_size: null,
        local_best_of: null,
        raw_transcript: "ähm wir shippen das morgen",
        transformed_transcript: "Wir shippen das morgen.",
        corrected: false,
        applied_rules: ["removed_fillers"],
        transform_warning: null,
        insert_mode: "direct_paste",
        active_driver: "xdotool",
        pasted: true,
        fallback_available: false,
        fallback_reason: null,
        recovery_action: "none",
        recovery_message: "Inserted at the cursor. No recovery action is needed.",
        clipboard_restore: "scheduled",
        error: null,
      },
    ],
    storagePath: "/tmp/wordscript-history.json",
    error: null,
    isLoading: false,
    refresh: vi.fn(),
    clear: vi.fn(),
    remove: vi.fn(),
    retry: vi.fn(),
    exportEntries: vi.fn(),
  };
});

describe("RebuildLabTab", () => {
  it("renders friendly explanations for transcript rule ids on the diagnostics preview panel", async () => {
    const user = userEvent.setup();
    render(<RebuildLabTab isActive config={createAppConfig()} onChange={vi.fn()} />);

    await user.click(screen.getByRole("tab", { name: /open diagnostics preview panel/i }));

    expect(screen.getAllByText("Guardrail kept original transcript")).toHaveLength(2);
    expect(screen.getByText(/the model returned a rewrite, but the runtime kept the safer original transcript/i)).toBeInTheDocument();
    expect(screen.getAllByText("Removed filler words")).toHaveLength(2);
    expect(screen.getByText(/common spoken fillers such as ähm, äh or um were removed/i)).toBeInTheDocument();
    expect(screen.queryByText("correction_guardrail_fallback")).not.toBeInTheDocument();
  });

  it("keeps raw runtime logs visible and adds decoded rule hints separately", async () => {
    const user = userEvent.setup();
    if (v1SliceState.result) {
      v1SliceState.result = {
        ...v1SliceState.result,
        transcript: {
          ...v1SliceState.result.transcript,
          applied_rules: [],
        },
      };
    }

    runtimeLogState.entries = [
      "[WordScript] Native pipeline transform done elapsed_ms=812 corrected=false output_len=26 rules=correction_guardrail_fallback,removed_fillers",
    ];

    render(<RebuildLabTab isActive config={createAppConfig()} onChange={vi.fn()} />);

    await user.click(screen.getByRole("tab", { name: /open runtime logs panel/i }));

    expect(
      screen.getByDisplayValue(
        "[WordScript] Native pipeline transform done elapsed_ms=812 corrected=false output_len=26 rules=correction_guardrail_fallback,removed_fillers",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Decoded transform rules")).toBeInTheDocument();
    expect(screen.getByText("Original transcript kept in this pass")).toBeInTheDocument();
    expect(screen.getAllByText("Guardrail kept original transcript")).toHaveLength(2);
    expect(screen.getAllByText("Removed filler words")).toHaveLength(2);
  });

  it("surfaces local decode and prompt controls in diagnostics and history", () => {
    if (v1SliceState.status) {
      v1SliceState.status = {
        ...v1SliceState.status,
        preferred_provider: "local-preview-base-quality",
        runtime_contract: {
          provider: "local_preview",
          provider_profile: "local-preview-base-quality",
          model: "base",
          work_mode: {
            rewrite_style: "clean",
            insert_behavior: "auto_paste",
            recovery_behavior: "standard",
          },
          provider_status: {
            ready: true,
            detail: "/usr/bin/whisper-cli · ggml-base.bin",
            local_setup: {
              readiness: "ready",
              runner_ready: true,
              model_ready: true,
              chat_ready: true,
              issue_code: null,
              resolved_runner: "/usr/bin/whisper-cli",
              resolved_model: "/models/ggml-base.bin",
              resolved_chat_base_url: "http://127.0.0.1:11434",
              resolved_chat_model: "llama3.2:latest",
              guidance: "Local runtime is ready.",
            },
          },
          capture_status: {
            is_recording: false,
            muted: false,
            paused: false,
            device_name: "Built-in Mic",
            silence_seconds: 0,
          },
          local_preview: {
            provider_profile: "local-preview-base-quality",
            model: "base",
            prompt_strength: "profile_and_terms",
            prompt_carry: true,
            beam_size: 5,
            best_of: 5,
          },
        },
        capabilities: {
          ...v1SliceState.status.capabilities,
          cloud_transcription: false,
          local_transcription: true,
        },
      };
    }
    if (v1SliceState.result) {
      v1SliceState.result = {
        ...v1SliceState.result,
        status: v1SliceState.status!,
        transcript: {
          ...v1SliceState.result.transcript,
          provider_mode: "local-preview-base-quality",
        },
      };
    }
    transcriptionHistoryState.entries = [
      {
        ...transcriptionHistoryState.entries[0],
        provider: "local_preview",
        model: "base",
        provider_profile: "local-preview-base-quality",
        local_prompt_strength: "profile_and_terms",
        local_prompt_carry: true,
        local_beam_size: 5,
        local_best_of: 5,
      },
    ];

    render(
      <RebuildLabTab
        isActive
        config={createAppConfig({
          provider: "local_preview",
          local_model: "base",
          local_profile: "local-preview-base-quality",
          local_prompt_strength: "profile_and_terms",
          local_prompt_carry: true,
          local_beam_size: 5,
          local_best_of: 5,
        })}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Local runtime contract")).toBeInTheDocument();
    expect(screen.getAllByText("local-preview-base-quality").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Prompt bias profile + terms").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Carry initial prompt").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Beam 5").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Best of 5").length).toBeGreaterThan(0);
    expect(screen.getByText("/usr/bin/whisper-cli")).toBeInTheDocument();
    expect(screen.getByText("/models/ggml-base.bin")).toBeInTheDocument();
    expect(screen.getByText("Built-in Mic")).toBeInTheDocument();
  });

  it("shows when the unsaved local draft differs from the native runtime contract", () => {
    if (v1SliceState.status) {
      v1SliceState.status = {
        ...v1SliceState.status,
        preferred_provider: "local-preview-base-fast",
        runtime_contract: {
          provider: "local_preview",
          provider_profile: "local-preview-base-fast",
          model: "base",
          work_mode: {
            rewrite_style: "clean",
            insert_behavior: "auto_paste",
            recovery_behavior: "standard",
          },
          provider_status: {
            ready: false,
            detail: "Missing local setup",
            local_setup: {
              readiness: "setup_required",
              runner_ready: false,
              model_ready: false,
              chat_ready: false,
              issue_code: "missing_runner_and_model",
              resolved_runner: null,
              resolved_model: null,
              resolved_chat_base_url: null,
              resolved_chat_model: null,
              guidance: "Install whisper-cli and configure a local model.",
            },
          },
          capture_status: {
            is_recording: false,
            muted: false,
            paused: false,
            device_name: null,
            silence_seconds: 0,
          },
          local_preview: {
            provider_profile: "local-preview-base-fast",
            model: "base",
            prompt_strength: "profile",
            prompt_carry: false,
            beam_size: 1,
            best_of: 1,
          },
        },
      };
    }

    render(
      <RebuildLabTab
        isActive
        config={createAppConfig({
          provider: "local_preview",
          local_model: "base",
          local_profile: "local-preview-base-quality",
          local_prompt_strength: "profile_and_terms",
          local_prompt_carry: true,
          local_beam_size: 5,
          local_best_of: 5,
          local_profile_decode_settings: [
            {
              profile_id: "local-preview-base-fast",
              beam_size: 1,
              best_of: 1,
            },
            {
              profile_id: "local-preview-base-quality",
              beam_size: 5,
              best_of: 5,
            },
          ],
        })}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/unsaved draft differs from runtime/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/profile runtime local-preview-base-fast differs from unsaved draft local-preview-base-quality/i)).toBeInTheDocument();
    expect(screen.getByText(/beam size runtime 1 differs from unsaved draft 5/i)).toBeInTheDocument();
  });
});