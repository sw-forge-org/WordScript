import type { TextProfileWorkMode } from "./ipc";

export type SliceStage = "idle" | "capturing" | "processing" | "completed" | "error";
export type SlicePipelineStep = "capture" | "provider" | "transform" | "insert";
export type SlicePipelineState = "idle" | "running" | "completed" | "failed" | "skipped";
export type InsertMode = "in_app_preview" | "clipboard_fallback_planned";

export interface SliceCapabilities {
  cloud_transcription: boolean;
  local_transcription: boolean;
  insertion_fallback: boolean;
  typed_contracts: boolean;
  rebuild_lab: boolean;
}

export interface SliceLocalContract {
  provider_profile: string;
  model: string;
  prompt_strength: string;
  prompt_carry: boolean;
  beam_size: number;
  best_of: number;
}

export interface SliceLocalProviderSetupContract {
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
}

export interface SliceProviderRuntimeStatus {
  ready: boolean;
  detail: string | null;
  local_setup: SliceLocalProviderSetupContract | null;
}

export interface SliceCaptureRuntimeStatus {
  is_recording: boolean;
  muted: boolean;
  paused: boolean;
  device_name: string | null;
  silence_seconds: number;
}

export interface SliceRuntimeContract {
  provider: string;
  provider_profile: string;
  model: string;
  work_mode: TextProfileWorkMode;
  provider_status: SliceProviderRuntimeStatus;
  capture_status: SliceCaptureRuntimeStatus;
  local: SliceLocalContract | null;
}

export interface SlicePipelineStepStatus {
  step: SlicePipelineStep;
  state: SlicePipelineState;
  duration_ms: number | null;
  error_code: string | null;
  detail: string | null;
}

export interface V1SliceStatus {
  stage: SliceStage;
  session_id: string | null;
  active_trigger: string | null;
  preferred_provider: string;
  architecture_mode: string;
  runtime_contract: SliceRuntimeContract;
  last_transcript: string | null;
  last_insert_target: string | null;
  last_error: string | null;
  pipeline: SlicePipelineStepStatus[];
  capabilities: SliceCapabilities;
  next_milestones: string[];
}

export interface StartCaptureRequest {
  trigger: string;
}

export interface CompleteCaptureRequest {
  raw_text: string;
  insert_target: string;
  profile: string;
}

export interface SliceTranscript {
  raw_text: string;
  final_text: string;
  provider_mode: string;
  profile: string;
  applied_rules: string[];
}

export interface SliceInsertionPlan {
  target: string;
  mode: InsertMode;
  fallback: string;
}

export interface V1SliceResult {
  status: V1SliceStatus;
  transcript: SliceTranscript;
  insertion: SliceInsertionPlan;
}