import type { TranscriptionHistoryEntry } from "../types/history";

export type V1SliceState = {
  status: {
    stage: "idle" | "capturing" | "processing" | "completed" | "error";
    session_id: string | null;
    active_trigger: string | null;
    preferred_provider: string;
    architecture_mode: string;
    runtime_contract: {
      provider: string;
      provider_profile: string;
      model: string;
      work_mode: {
        rewrite_style: "verbatim" | "clean" | "polished";
        insert_behavior: "auto_paste" | "clipboard_only";
        recovery_behavior: "standard";
      };
      provider_status: {
        ready: boolean;
        detail: string | null;
        local_setup: {
          readiness: "ready" | "setup_required";
          runner_ready: boolean;
          model_ready: boolean;
          chat_ready: boolean;
          issue_code: string | null;
          resolved_runner: string | null;
          resolved_model: string | null;
          resolved_chat_base_url: string | null;
          resolved_chat_model: string | null;
          guidance: string;
        } | null;
      };
      capture_status: {
        is_recording: boolean;
        muted: boolean;
        paused: boolean;
        device_name: string | null;
        silence_seconds: number;
      };
      local: {
        provider_profile: string;
        model: string;
        prompt_strength: string;
        prompt_carry: boolean;
        beam_size: number;
        best_of: number;
      } | null;
    };
    last_transcript: string | null;
    last_insert_target: string | null;
    last_error: string | null;
    pipeline: Array<{
      step: "capture" | "provider" | "transform" | "insert";
      state: "idle" | "running" | "completed" | "failed" | "skipped";
      duration_ms: number | null;
      error_code: string | null;
      detail: string | null;
    }>;
    capabilities: {
      cloud_transcription: boolean;
      local_transcription: boolean;
      insertion_fallback: boolean;
      typed_contracts: boolean;
      rebuild_lab: boolean;
    };
    next_milestones: string[];
  } | null;
  result: {
    status: {
      stage: "idle" | "capturing" | "processing" | "completed" | "error";
      session_id: string | null;
      active_trigger: string | null;
      preferred_provider: string;
      architecture_mode: string;
      runtime_contract: {
        provider: string;
        provider_profile: string;
        model: string;
        work_mode: {
          rewrite_style: "verbatim" | "clean" | "polished";
          insert_behavior: "auto_paste" | "clipboard_only";
          recovery_behavior: "standard";
        };
        provider_status: {
          ready: boolean;
          detail: string | null;
          local_setup: {
            readiness: "ready" | "setup_required";
            runner_ready: boolean;
            model_ready: boolean;
            chat_ready: boolean;
            issue_code: string | null;
            resolved_runner: string | null;
            resolved_model: string | null;
            resolved_chat_base_url: string | null;
            resolved_chat_model: string | null;
            guidance: string;
          } | null;
        };
        capture_status: {
          is_recording: boolean;
          muted: boolean;
          paused: boolean;
          device_name: string | null;
          silence_seconds: number;
        };
        local: {
          provider_profile: string;
          model: string;
          prompt_strength: string;
          prompt_carry: boolean;
          beam_size: number;
          best_of: number;
        } | null;
      };
      last_transcript: string | null;
      last_insert_target: string | null;
      last_error: string | null;
      pipeline: Array<{
        step: "capture" | "provider" | "transform" | "insert";
        state: "idle" | "running" | "completed" | "failed" | "skipped";
        duration_ms: number | null;
        error_code: string | null;
        detail: string | null;
      }>;
      capabilities: {
        cloud_transcription: boolean;
        local_transcription: boolean;
        insertion_fallback: boolean;
        typed_contracts: boolean;
        rebuild_lab: boolean;
      };
      next_milestones: string[];
    };
    transcript: {
      raw_text: string;
      final_text: string;
      provider_mode: string;
      profile: string;
      applied_rules: string[];
    };
    insertion: {
      target: string;
      mode: "in_app_preview" | "clipboard_fallback_planned";
      fallback: string;
    };
  } | null;
  error: string | null;
  isPending: boolean;
  refresh: ReturnType<typeof import("vitest").vi.fn>;
  startCapture: ReturnType<typeof import("vitest").vi.fn>;
  completeCapture: ReturnType<typeof import("vitest").vi.fn>;
  reset: ReturnType<typeof import("vitest").vi.fn>;
};

export type RuntimeLogState = {
  entries: string[];
  error: string | null;
  isLoading: boolean;
  refresh: ReturnType<typeof import("vitest").vi.fn>;
  clear: ReturnType<typeof import("vitest").vi.fn>;
};

export type TranscriptionHistoryState = {
  entries: TranscriptionHistoryEntry[];
  storagePath: string | null;
  error: string | null;
  isLoading: boolean;
  refresh: ReturnType<typeof import("vitest").vi.fn>;
  clear: ReturnType<typeof import("vitest").vi.fn>;
  remove: ReturnType<typeof import("vitest").vi.fn>;
  retry: ReturnType<typeof import("vitest").vi.fn>;
  exportEntries: ReturnType<typeof import("vitest").vi.fn>;
};
