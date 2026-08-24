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

/** One segment WordScript's confidence gate removed before any mode ran
 *  (ADR 0249) — with where in the audio it was and which of the recogniser's
 *  own metrics rejected it. */
export interface DroppedSegment {
  text: string;
  start: number;
  end: number;
  reason: string;
}

/** WHAT THE CONFIDENCE GATE TOOK OUT OF A HEARING (ADR 0249).
 *
 *  `raw_transcript` is the recogniser's own output, taken before this stage.
 *  Where the gate rejected a segment the transform ran on `kept_text` instead,
 *  and the difference between the two is `dropped`.
 *
 *  `null` on every record the gate left alone — and on every record written
 *  before ADR 0249, where it is also the honest answer: those kept the
 *  post-gate text under `raw_transcript` and nothing said so. */
export interface ConfidenceGateRecord {
  kept_text: string;
  dropped: DroppedSegment[];
}
export type TranscriptionHistorySource = "native_pipeline" | "retry";

export interface TranscriptionHistoryQuery {
  limit?: number;
  provider?: string;
  status?: TranscriptionHistoryStatus;
  source?: TranscriptionHistorySource;
  active_profile?: string;
  search?: string;
  include_errors_only?: boolean;
  /** Only deliveries that fell back and that nobody has answered for yet
   *  (ADR 0243). What Home asks instead of scanning every summary the store
   *  holds — an owed fallback can be arbitrarily old, so a limit cannot find
   *  one and only the runtime can. */
  owed_fallback_only?: boolean;
}

export interface ExportTranscriptionHistoryResponse {
  path: string;
  exported_count: number;
}

export interface TranscriptionHistoryStorageStatus {
  path: string;
  /** What the index costs on disk, against the two numbers it is read against
   *  (ADR 0241). **The figure is the instrument and the threshold is the
   *  backstop's voice**: at the reporting machine's rate 5 GB is decades away,
   *  so a row wired only to the threshold would never say anything. */
  bytes: number;
  warning_bytes: number;
  ceiling_bytes: number;
}

/** What a failed dictation left parked on this machine (ADR 0185).
 *
 *  A RAW RECORDING IS THE MOST SENSITIVE THING THE PRODUCT HOLDS, and until
 *  this shape existed Privacy & Data could only recite the rule — seven days,
 *  four gigabytes — without saying whether anything was under it. `count: 0` is
 *  the answer the screen is most often opened for.
 *
 *  `oldest_age_ms` is an age rather than a date because the rule it is read
 *  against is a duration, and it is absent when there is nothing to age. */
export interface RetainedCaptureStatus {
  count: number;
  bytes: number;
  oldest_age_ms: number | null;
  max_age_days: number;
  max_bytes: number;
  directory: string;
}

/** Where transcripts are written as files (ADR 0074). `exists` is false on a
 *  machine that has not dictated since the store existed — the root is still
 *  the true answer to where the next one lands, which is why it is stated
 *  either way. */
export interface TranscriptStoreStatus {
  root: string;
  exists: boolean;
  /** How many files the store's own layout accounts for, and how many bytes
   *  they are (ADR 0237). Since the index retention stopped taking the files
   *  with it, the archive can be arbitrarily larger than the index and nothing
   *  a screen already holds could tell you by how much. Files the reader put in
   *  the same folder are not counted — the purge would not touch them either. */
  files: number;
  bytes: number;
  /** The archive's own budget (ADR 0241), separate from the index's and with the
   *  same two numbers. Until that record the files had no lifetime at all —
   *  ADR 0237 decoupled them from the index retention and the answer to *when do
   *  they go* became *never, unless you press the button*. */
  warning_bytes: number;
  ceiling_bytes: number;
}

/**
 * ONE RECORD AS A LIST ROW NEEDS IT, WHICH IS NOT THE WHOLE RECORD (ADR 0240).
 *
 * **THE LIST USED TO BE SENT EVERY FIELD OF EVERY RECORD**, on a five-second
 * timer, with no limit: 2,452 bytes a row over the bridge on the reporting
 * machine, of which a screen read about a thousand. The microphone levels, the
 * recovery status, the clipboard restore, the local decoding parameters, the
 * provider profile and the spoken-language verdict are read by the RUNTIME and
 * by nothing on a screen.
 *
 * THE RECORD STILL HOLDS THEM ALL. This is the wire shape and not a storage
 * decision — `TranscriptionHistoryEntry` is unchanged, the export exports
 * everything it exported, and a screen that comes to need a field adds it back
 * here. `transcription_history_record` fetches one whole record by id, which is
 * how the raw panel, Copy and Restore get the text the previews below cut.
 */
export interface TranscriptionHistorySummary {
  id: string;
  created_at_ms: number;
  status: TranscriptionHistoryStatus;
  source: TranscriptionHistorySource;
  retry_of: string | null;
  provider: string;
  model: string | null;
  active_profile: string | null;
  /** `work_mode.processing_mode` and nothing else. The whole snapshot was 362
   *  bytes a row and the two surfaces that read it read this one field. */
  processing_mode: ProcessingMode | null;
  title: string | null;
  transcript_path: string | null;
  corrected: boolean;
  applied_rules: string[];
  transform_warning: string | null;
  insert_mode: NativeInsertMode | null;
  pasted: boolean | null;
  fallback_reason: string | null;
  fallback_acknowledged: boolean;
  error: string | null;
  audio_path: string | null;
  capture_integrity: CaptureIntegrity | null;
  capture_stop_reason: string | null;
  /** The recogniser's own text, cut to 160 characters. Empty where there was
   *  none — which is also how a surface tells there is nothing to retry from. */
  heard_preview: string;
  /** The delivered text under the same cut: transformed where a mode wrote one,
   *  otherwise the same as `heard_preview`. */
  written_preview: string;
  /** Whether the two FULL texts are identical, decided in the runtime because
   *  two cut strings can agree where the whole ones do not. */
  transcripts_identical: boolean;
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
  /** What the record was actually counted as speaking, which `language` above is
   *  not (ADR 0236): that one is the configured hint, usually left on Auto, and
   *  ADR 0180 forbids counting it. This is the verdict the runtime reached when
   *  the record was written — the naming model's answer where the mode kept the
   *  spoken language, the offline detector's otherwise — and it is stored so a
   *  rebuilt activity ledger can read it instead of re-measuring without the
   *  model.
   *
   *  `null` on records older than the field, on the paths that produced no text,
   *  and on a run neither instrument would name. */
  spoken_language?: string | null;
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
  /** The recogniser's own output — before the confidence gate, before the
   *  recogniser repair and before any mode (ADR 0249). This is the boundary
   *  every surface means by *Heard*. */
  raw_transcript: string | null;
  /** What was delivered, byte for byte: the string the clipboard or the
   *  keystroke driver was handed. `null` on the paths that delivered nothing. */
  transformed_transcript: string | null;
  /** What the gate removed from `raw_transcript`, and the text it left the
   *  transform (ADR 0249). `null` wherever it removed nothing. */
  confidence_gate?: ConfidenceGateRecord | null;
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
  /** Why the recording behind this record ended, when the user was not the one
   *  who ended it — today the recording ceiling and the stream-error autostop.
   *
   *  `null` on every ordinary dictation, which is most of them: the user let go
   *  of the key and already knows why it stopped. It exists because the opposite
   *  case was indistinguishable from an ordinary one — a dictation cut off
   *  mid-sentence at the ceiling was filed and displayed exactly like a finished
   *  one, which is why it was reported as inexplicable (2026-08-18). */
  capture_stop_reason?: string | null;
}