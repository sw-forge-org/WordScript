import type {
  NativeClipboardRestoreStatus,
  NativeInsertDriver,
  NativeInsertMode,
  NativeInsertRecoveryAction,
} from "./nativeInsertion";
import type { TextProfileWorkMode } from "./ipc";

export type TranscriptionHistoryStatus = "completed" | "empty" | "failed";
export type TranscriptionHistorySource = "native_pipeline" | "retry";

export interface TranscriptionHistoryQuery {
  limit?: number;
  provider?: string;
  status?: TranscriptionHistoryStatus;
  source?: TranscriptionHistorySource;
  active_profile?: string;
  search?: string;
  include_errors_only?: boolean;
}

export interface ExportTranscriptionHistoryResponse {
  path: string;
  exported_count: number;
}

export interface TranscriptionHistoryStorageStatus {
  path: string;
}

export interface TranscriptionHistoryEntry {
  id: string;
  created_at_ms: number;
  status: TranscriptionHistoryStatus;
  source: TranscriptionHistorySource;
  retry_of: string | null;
  provider: string;
  model: string | null;
  language: string | null;
  active_profile: string | null;
  work_mode: TextProfileWorkMode | null;
  provider_profile: string | null;
  local_prompt_strength: string | null;
  local_prompt_carry: boolean | null;
  local_beam_size: number | null;
  local_best_of: number | null;
  raw_transcript: string | null;
  transformed_transcript: string | null;
  corrected: boolean;
  applied_rules: string[];
  transform_warning: string | null;
  insert_mode: NativeInsertMode | null;
  active_driver: NativeInsertDriver | null;
  pasted: boolean | null;
  fallback_available: boolean | null;
  fallback_reason: string | null;
  recovery_action: NativeInsertRecoveryAction | null;
  recovery_message: string | null;
  clipboard_restore: NativeClipboardRestoreStatus | null;
  error: string | null;
  /** Where the capture this entry failed on is still sitting, when the runtime
   *  kept it for a retry. `null` on every entry with nothing to retry from — a
   *  successful run deletes its audio, and so does an unrecoverable failure. */
  audio_path: string | null;
}