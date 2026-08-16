import type {
  NativeClipboardRestoreStatus,
  NativeInsertDriver,
  NativeInsertMode,
  NativeInsertRecoveryAction,
} from "./nativeInsertion";
import type {
  CaptureIntegrity,
  InputLevelSummary,
  ProcessingMode,
  TextProfileWorkMode,
} from "./ipc";

export type { CaptureIntegrity, CaptureIntegrityVerdict, InputLevelSummary } from "./ipc";

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

/** What a failed dictation left parked on this machine (ADR 0185).
 *
 *  A RAW RECORDING IS THE MOST SENSITIVE THING THE PRODUCT HOLDS, and until
 *  this shape existed Privacy & Data could only recite the rule — seven days,
 *  twenty files — without saying whether anything was under it. `count: 0` is
 *  the answer the screen is most often opened for.
 *
 *  `oldest_age_ms` is an age rather than a date because the rule it is read
 *  against is a duration, and it is absent when there is nothing to age. */
export interface RetainedCaptureStatus {
  count: number;
  bytes: number;
  oldest_age_ms: number | null;
  max_age_days: number;
  max_files: number;
  directory: string;
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
  /** What the model called this (ADR 0077). Also the row's heading on History
   *  (ADR 0078), which is why it is on the record and not only in the file's
   *  name. `null` on entries older than the field. */
  title: string | null;
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
  /** How much of its own clock the capture behind this record kept (ADR 0079).
   *  `null` on entries older than the measurement and on a retry, which has no
   *  capture of its own. */
  capture_integrity: CaptureIntegrity | null;
  /** What the microphone delivered into this transcription — peak, mean and the
   *  speech threshold they are read against. `null` on entries older than the
   *  measurement and on a retry, which never touched a microphone.
   *
   *  It is what separates "the recogniser is wrong" from "the microphone is
   *  quiet", and neither can be told from the text
   *  (`docs/known-issues/transcription-accuracy.md`). */
  input_level: InputLevelSummary | null;
  /** The recorded window with the thinking pauses taken out (ADR 0177), in
   *  seconds. The only honest denominator for a SPEAKING rate: the capture clock
   *  beside it is the open microphone, so a rate built on it drops by however
   *  long the reader spent working out their next sentence.
   *
   *  `null` on a retry and on every entry written before the speech clock
   *  existed — never zero, because a record that produced words cannot have had
   *  no speech in it. */
  speech_seconds?: number | null;
  /** Milliseconds from the capture stopping to the text existing (ADR 0181).
   *  `null` wherever that clock never ran. */
  turnaround_ms?: number | null;
}