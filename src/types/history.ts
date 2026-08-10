import type {
  NativeClipboardRestoreStatus,
  NativeInsertDriver,
  NativeInsertMode,
  NativeInsertRecoveryAction,
} from "./nativeInsertion";
import type { ProcessingMode, TextProfileWorkMode } from "./ipc";

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

/** Where transcripts are written as files (ADR 0074). `exists` is false on a
 *  machine that has not dictated since the store existed — the root is still
 *  the true answer to where the next one lands, which is why it is stated
 *  either way. */
export interface TranscriptStoreStatus {
  root: string;
  exists: boolean;
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
  /** What actually ran, which `work_mode.processing_mode` is not: the work mode
   *  is the profile's stored setting and keeps `auto` for an Auto record
   *  (ADR 0075). `null` on entries older than the field. */
  effective_mode: ProcessingMode | null;
  /** The Markdown file this record was written to (ADR 0074). `null` where
   *  there was no text to write, and on entries older than the store. */
  transcript_path: string | null;
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
  /** The delivery fell back and somebody has since dealt with it — restored the
   *  text, or said it did not matter (ADR 0076). Only ever set on an entry
   *  whose delivery fell back. */
  fallback_acknowledged: boolean;
}