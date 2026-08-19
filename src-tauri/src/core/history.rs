use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime};

use super::capture::{CaptureIntegrity, InputLevelSummary};
use super::config::{AppConfig, ProcessingMode, TextProfileWorkMode};
use super::insertion::{
    insert_transcription_from_legacy, NativeClipboardRestoreStatus, NativeInsertDriver,
    NativeInsertMode, NativeInsertRecoveryAction, NativeInsertResult,
};
use super::paths::{history_file_path, legacy_history_index_path};
use super::providers::JobKey;
use super::runtime_log;
use super::sessions::now_ms;
use super::transform::{finalize_with_text_rules, NativeTransformConfig, NativeTransformResult};

/// A capacity hint for the deque, and nothing else.
///
/// **THE PRODUCT HAS NO CAP ON HOW MANY DICTATIONS IT KEEPS** (ADR 0241). It had
/// one — a picker until ADR 0185, then a pinned `HISTORY_CEILING` — and both
/// were bounding the per-dictation write rather than the disk, because the index
/// was one JSON array rewritten whole. The journal made that write flat, so the
/// number bounding it was deleted rather than raised for a third time. What
/// bounds the store now is `history_retention_days`, in months, and a byte
/// budget behind it.
///
/// This is what `VecDeque::with_capacity` is told on a cold load. Allocating for
/// a year of dictation up front to hold the handful most installs have is the
/// reason it is small and is not derived from anything.
const DEFAULT_HISTORY_LIMIT: usize = 200;
const MS_PER_DAY: u64 = 86_400_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TranscriptionHistoryStatus {
    Completed,
    Empty,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TranscriptionHistorySource {
    NativePipeline,
    Retry,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionHistoryEntry {
    pub id: String,
    pub created_at_ms: u64,
    pub status: TranscriptionHistoryStatus,
    pub source: TranscriptionHistorySource,
    pub retry_of: Option<String>,
    pub provider: String,
    pub model: Option<String>,
    pub language: Option<String>,
    /// WHAT THE RECORD WAS ACTUALLY COUNTED AS SPEAKING, which the `language`
    /// above is not (ADR 0236). That one is the configured hint — a dropdown,
    /// usually left on Auto — and ADR 0180 already forbids counting it. This is
    /// the verdict `contributed_language` reached when the record was written:
    /// the naming model's answer where the mode kept the spoken language and
    /// there was enough text to name, and the offline detector's otherwise.
    ///
    /// IT IS STORED BECAUSE THE LEDGER CAN BE REBUILT AND THE NAMING CALL
    /// CANNOT. `activity_ledger::seed_from_history` re-folds the surviving
    /// records whenever the ledger file is missing or has been reset, and it
    /// cannot reach a call that happened weeks ago — so it re-measured with the
    /// offline detector alone, and every record under that detector's floor fell
    /// out of the language count on the way through. On 2026-08-18 the owner
    /// read the consequence off the tile: 91 of 447 dictations in no language
    /// bucket, on a machine whose runtime log carried a language for 74 of its
    /// 75 naming calls. The answer had existed every time; nothing kept it.
    ///
    /// `None` on records written before the field, on the paths that produced no
    /// text, and on a run neither instrument would name — which is a refusal
    /// rather than a gap (ADR 0180).
    #[serde(default)]
    pub spoken_language: Option<String>,
    pub active_profile: Option<String>,
    #[serde(default)]
    pub work_mode: Option<TextProfileWorkMode>,
    /// WHAT ACTUALLY RAN, which `work_mode.processing_mode` is not.
    ///
    /// The work mode is the profile's stored setting, and `Auto` stays `Auto`
    /// in it — the resolution happens once, in the pipeline, and was recorded
    /// nowhere. Two things need the answer: the transcript file states the mode
    /// its text was produced under (ADR 0074), and a retry has to re-run the
    /// mode the record ran in rather than a correction (ADR 0075).
    ///
    /// `None` on every entry written before the field existed, and on the paths
    /// that never reached a transform.
    #[serde(default)]
    pub effective_mode: Option<ProcessingMode>,
    /// What the model called this (ADR 0077). Kept on the record as well as in
    /// the file's name, because History's rows carry it too (ADR 0078) — and a
    /// row that had to read a file to draw a heading would make the index
    /// depend on the store it indexes.
    #[serde(default)]
    pub title: Option<String>,
    /// The Markdown file this record was written to (ADR 0074).
    ///
    /// `None` where there was no text to write, and on entries older than the
    /// store. It is also the ONLY thing that authorises a delete: the runtime
    /// removes paths an entry names and never walks the directory.
    #[serde(default)]
    pub transcript_path: Option<String>,
    pub provider_profile: Option<String>,
    pub local_prompt_strength: Option<String>,
    pub local_prompt_carry: Option<bool>,
    pub local_beam_size: Option<u8>,
    pub local_best_of: Option<u8>,
    pub raw_transcript: Option<String>,
    pub transformed_transcript: Option<String>,
    pub corrected: bool,
    pub applied_rules: Vec<String>,
    pub transform_warning: Option<String>,
    pub insert_mode: Option<NativeInsertMode>,
    pub active_driver: Option<NativeInsertDriver>,
    pub pasted: Option<bool>,
    pub fallback_available: Option<bool>,
    pub fallback_reason: Option<String>,
    pub recovery_action: Option<NativeInsertRecoveryAction>,
    pub recovery_message: Option<String>,
    pub clipboard_restore: Option<NativeClipboardRestoreStatus>,
    pub error: Option<String>,
    /// Where the capture this entry failed on is still sitting, when the
    /// runtime kept it for a retry. `None` on every entry that has nothing to
    /// retry from — a successful run deletes its audio, and so does an
    /// unrecoverable failure.
    #[serde(default)]
    pub audio_path: Option<String>,
    /// The delivery fell back and somebody has since dealt with it — restored
    /// the text, or said it did not matter (ADR 0076).
    ///
    /// A fact about the RECORD rather than about a window, which is why it is
    /// here: a question that came back every time the workspace was reopened
    /// would be the standing nag ADR 0044 exists against. Only ever set on an
    /// entry whose delivery fell back; meaningless and unread on any other.
    #[serde(default)]
    pub fallback_acknowledged: bool,
    /// How much of its own clock the capture behind this record actually kept
    /// (ADR 0079).
    ///
    /// `None` on every record written before the measurement existed, and on a
    /// retry — the number belongs to a capture, not to a transcription, and
    /// copying an earlier entry's verdict onto a new one would attribute a
    /// measurement to a run that never made it.
    ///
    /// It is here rather than only in the runtime log because the log rotates.
    /// The correlation this cluster needs — a short capture against a misheard
    /// transcript — was untestable on 2026-08-10 for exactly that reason: 9 of
    /// the 10 affected captures had outlived their transcripts.
    #[serde(default)]
    pub capture_integrity: Option<CaptureIntegrity>,
    /// Milliseconds from the audio arriving to the text existing — the one
    /// latency this product can honestly report, because both ends are inside
    /// the runtime and neither depends on where the text is delivered.
    ///
    /// `None` on every path that produced no text, on a retry, and on the parked
    /// delivery, whose delay is the park's rather than the runtime's.
    #[serde(default)]
    pub turnaround_ms: Option<u64>,
    /// What the microphone delivered into this transcription: peak, mean and
    /// the speech threshold they are read against.
    ///
    /// `transcription-accuracy.md` lists this as the cheapest step it was still
    /// missing. The numbers were already computed on every capture and thrown
    /// away unless the capture came back empty, which is the one case where
    /// they are least needed — an empty result already says something is wrong,
    /// while a fluent transcript from a too-quiet microphone says nothing at
    /// all. It is what separates "the recogniser is wrong" from "the microphone
    /// is quiet", and neither can be told from the text.
    ///
    /// `None` on records written before this existed, and on a retry: like the
    /// capture verdict, the measurement belongs to a capture and not to a
    /// transcription.
    #[serde(default)]
    pub input_level: Option<InputLevelSummary>,
    /// The recorded window with the thinking pauses taken out (ADR 0177), in
    /// seconds.
    ///
    /// It is the only honest denominator for a SPEAKING rate:
    /// `capture_integrity.recorded_seconds` is the open microphone, so a rate
    /// built on it drops by however long the reader spent working out their next
    /// sentence. `None` on a retry and on every record written before the speech
    /// clock existed — never zero, because a record that produced words cannot
    /// have had no speech in it, and a zero here would be a division nobody
    /// could see going wrong.
    #[serde(default)]
    pub speech_seconds: Option<f64>,
    /// Why the recording behind this record ended, when the user was not the one
    /// who ended it -- today the recording ceiling and the stream-error autostop.
    ///
    /// `None` on every ordinary dictation, which is most of them: the user
    /// released the key and already knows why it stopped. It exists because the
    /// opposite case was indistinguishable from an ordinary one. A dictation cut
    /// off mid-sentence at the ceiling was delivered, filed and displayed exactly
    /// like a finished one, and the only record of the ceiling was a line in a
    /// log that rotates -- which is why it was reported as inexplicable
    /// (2026-08-18).
    #[serde(default)]
    pub capture_stop_reason: Option<String>,
}

/// How much of a transcript the LIST is handed (ADR 0240).
///
/// A ROW SHOWS ONE LINE AND WAS SENT THE WHOLE DICTATION. The two transcripts
/// are 667 bytes a record on the reporting machine — 27% of the index — and the
/// longest single one is 4,192 characters, so the term is not merely large but
/// UNBOUNDED: one long dictation costs the list four kilobytes for a heading it
/// truncates anyway. That is the term that made a thousand-record ceiling feel
/// necessary.
///
/// A hundred and sixty because the median delivered text is 135 characters, so
/// most rows carry their whole text and read exactly as before; the ones that do
/// not were being cut by the heading's own width regardless. The full text is
/// one `transcription_history_record` away and every surface that needs it —
/// the raw panel, Copy, Restore — asks for it by id.
const PREVIEW_CHARS: usize = 160;

/// The first `PREVIEW_CHARS` characters, cut on a CHARACTER and never on a byte.
/// German dictation is most of this machine's corpus and `str::truncate` on a
/// byte index inside `ü` panics.
fn preview_of(text: Option<&str>) -> String {
    let text = text.unwrap_or_default().trim();
    if text.chars().count() <= PREVIEW_CHARS {
        return text.to_string();
    }
    text.chars().take(PREVIEW_CHARS).collect()
}

/// ONE RECORD AS A LIST ROW NEEDS IT, WHICH IS NOT THE WHOLE RECORD (ADR 0240).
///
/// **THE LIST USED TO BE SENT EVERY FIELD OF EVERY RECORD.** 2,452 bytes a row
/// on the reporting machine, of which the frontend read about a thousand: the
/// microphone levels, the recovery status, the clipboard restore, the local
/// decoding parameters, the provider profile and the spoken-language verdict are
/// all read by the runtime and by NOTHING on a screen — they are stored because
/// the record has to hold them and shipped because nobody had ever asked which
/// half was wanted.
///
/// THE FIELDS STAY ON DISK. This is a wire shape, not a storage decision: the
/// record keeps everything it kept, the export exports everything it exported,
/// and a later screen that needs a dropped field adds it back here. Confusing
/// the two would have thrown away measurements that took a release each to get
/// right.
///
/// `work_mode` IS ONE FIELD HERE AND WAS A SNAPSHOT. The whole profile work mode
/// travelled on every row — 362 bytes — and the two surfaces that read it read
/// `processing_mode` and nothing else. Sixty bytes.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TranscriptionHistorySummary {
    pub id: String,
    pub created_at_ms: u64,
    pub status: TranscriptionHistoryStatus,
    pub source: TranscriptionHistorySource,
    pub retry_of: Option<String>,
    /// Which lane produced it. Not read by a surface today; kept because a list
    /// that cannot say where a row came from is a list that needs changing
    /// again, and the pair costs about forty bytes.
    pub provider: String,
    pub model: Option<String>,
    pub active_profile: Option<String>,
    /// `work_mode.processing_mode`, the only part of that snapshot any surface
    /// reads.
    pub processing_mode: Option<ProcessingMode>,
    pub title: Option<String>,
    pub transcript_path: Option<String>,
    pub corrected: bool,
    pub applied_rules: Vec<String>,
    pub transform_warning: Option<String>,
    pub insert_mode: Option<NativeInsertMode>,
    pub pasted: Option<bool>,
    pub fallback_reason: Option<String>,
    pub fallback_acknowledged: bool,
    pub error: Option<String>,
    pub audio_path: Option<String>,
    pub capture_integrity: Option<CaptureIntegrity>,
    pub capture_stop_reason: Option<String>,
    /// The recogniser's own text, cut to `PREVIEW_CHARS`. Empty where there was
    /// none — which is also how a surface tells that there is nothing to retry
    /// from and nothing to copy.
    pub heard_preview: String,
    /// The delivered text — transformed where a mode wrote one, otherwise the
    /// same as `heard_preview`. Same cut.
    pub written_preview: String,
    /// Whether the two FULL texts are identical, decided here because a
    /// comparison of two cut strings would call a record unchanged whose tails
    /// differ. The raw panel's *the AI stage rewrote it* hangs off this.
    pub transcripts_identical: bool,
}

impl TranscriptionHistorySummary {
    fn of(entry: &TranscriptionHistoryEntry) -> Self {
        let heard = entry.raw_transcript.as_deref().unwrap_or_default();
        let written = entry
            .transformed_transcript
            .as_deref()
            .unwrap_or(heard);
        Self {
            id: entry.id.clone(),
            created_at_ms: entry.created_at_ms,
            status: entry.status.clone(),
            source: entry.source.clone(),
            retry_of: entry.retry_of.clone(),
            provider: entry.provider.clone(),
            model: entry.model.clone(),
            active_profile: entry.active_profile.clone(),
            processing_mode: entry
                .work_mode
                .as_ref()
                .map(|mode| mode.processing_mode.clone()),
            title: entry.title.clone(),
            transcript_path: entry.transcript_path.clone(),
            corrected: entry.corrected,
            applied_rules: entry.applied_rules.clone(),
            transform_warning: entry.transform_warning.clone(),
            insert_mode: entry.insert_mode.clone(),
            pasted: entry.pasted,
            fallback_reason: entry.fallback_reason.clone(),
            fallback_acknowledged: entry.fallback_acknowledged,
            error: entry.error.clone(),
            audio_path: entry.audio_path.clone(),
            capture_integrity: entry.capture_integrity.clone(),
            capture_stop_reason: entry.capture_stop_reason.clone(),
            heard_preview: preview_of(Some(heard)),
            written_preview: preview_of(Some(written)),
            transcripts_identical: heard == written,
        }
    }
}

#[derive(Debug, Clone)]
pub struct RecordHistoryEntryRequest {
    pub status: TranscriptionHistoryStatus,
    pub source: TranscriptionHistorySource,
    pub retry_of: Option<String>,
    pub provider: String,
    pub model: Option<String>,
    pub language: Option<String>,
    pub active_profile: Option<String>,
    /// The mode the transform actually ran in, where the caller knows it. The
    /// paths that never reached a transform pass `None`.
    pub effective_mode: Option<ProcessingMode>,
    /// What the model called this (ADR 0077), produced by the caller because
    /// the call is async and this funnel is not. `None` names the file from the
    /// first words instead.
    pub title: Option<String>,
    pub provider_profile: Option<String>,
    pub local_prompt_strength: Option<String>,
    pub local_prompt_carry: Option<bool>,
    pub local_beam_size: Option<u8>,
    pub local_best_of: Option<u8>,
    pub raw_transcript: Option<String>,
    pub transformed_transcript: Option<String>,
    pub corrected: bool,
    pub applied_rules: Vec<String>,
    pub transform_warning: Option<String>,
    pub insert_mode: Option<NativeInsertMode>,
    pub active_driver: Option<NativeInsertDriver>,
    pub pasted: Option<bool>,
    pub fallback_available: Option<bool>,
    pub fallback_reason: Option<String>,
    pub recovery_action: Option<NativeInsertRecoveryAction>,
    pub recovery_message: Option<String>,
    pub clipboard_restore: Option<NativeClipboardRestoreStatus>,
    pub error: Option<String>,
    pub audio_path: Option<String>,
    /// What the capture measured about itself (ADR 0079). `None` on the paths
    /// that have no capture of their own to report — a retry above all.
    pub capture_integrity: Option<CaptureIntegrity>,
    /// Milliseconds from the audio arriving to the text existing. `None`
    /// wherever the caller ran no such clock.
    pub turnaround_ms: Option<u64>,
    /// What the microphone delivered, from the same capture and on the same
    /// terms.
    pub input_level: Option<InputLevelSummary>,
    /// The recorded window with the thinking pauses removed (ADR 0177), from
    /// that same capture and absent in the same places.
    pub speech_seconds: Option<f64>,
    /// Why the recording ended, when the user did not end it. `None` on every
    /// ordinary stop and on every path with no recording of its own.
    pub capture_stop_reason: Option<String>,
}

/// The three things a CAPTURE knows about itself, carried as one.
///
/// They are one parameter rather than three because they travel together on
/// every path and are absent together on every other: a retry has no capture, a
/// parked delivery has no capture, and an upload has no capture. Passing them
/// separately meant a signature of eleven positional arguments where two
/// `Option<f64>` sat next to each other — and the next measurement would have
/// made it twelve.
#[derive(Debug, Clone, Default)]
pub struct CaptureFacts {
    /// How much of its own clock the capture kept (ADR 0079).
    pub integrity: Option<CaptureIntegrity>,
    /// What the microphone delivered: peak, mean, and the speech threshold.
    pub input_level: Option<InputLevelSummary>,
    /// The recorded window minus the thinking pauses (ADR 0177).
    pub speech_seconds: Option<f64>,
    /// Why the recording ended, for the paths where the user did not end it.
    pub stop_reason: Option<String>,
}

impl CaptureFacts {
    /// What a path with no capture of its own reports — a retry above all.
    pub fn none() -> Self {
        Self::default()
    }
}

/// Whether a mode's output may be credited against a typing baseline
/// (ADR 0178).
///
/// **Agent and Prompt Enhance GENERATE text.** Fifteen spoken words become two
/// hundred written ones, and none of the two hundred is time the reader saved by
/// not typing them — they would never have typed them at all. Counting that
/// output against a typing speed invents hours out of a model's verbosity, which
/// is the most flattering possible way to be wrong.
///
/// Everything else transcribes or tidies what was said, including Translate: a
/// translation is still the reader's own sentence and they would have had to
/// produce it somehow.
pub fn mode_credits_typing(mode: Option<&ProcessingMode>) -> bool {
    !matches!(
        mode,
        Some(ProcessingMode::Agent) | Some(ProcessingMode::PromptEnhance)
    )
}

/// Whether the delivered text is in the language it was SPOKEN in (ADR 0188).
///
/// Three modes answer no, and the languages tile was wrong in all three:
/// Translate delivers the language you asked for rather than the one you used,
/// and Agent and Prompt Enhance deliver a model's prose, which is in whatever
/// language the model chose. A tile asking *which languages do you dictate in*
/// was counting the output.
///
/// It decides two things at once, and that is why it is one function. The
/// measurement reads the SPOKEN text either way (the same correction ADR 0177
/// made to the rate) — and where this is false, the model's own answer is
/// discarded as well, because the naming call was shown the delivered text and
/// answered honestly about the file it was naming.
pub fn mode_keeps_the_spoken_language(mode: Option<&ProcessingMode>) -> bool {
    !matches!(
        mode,
        Some(ProcessingMode::Translate)
            | Some(ProcessingMode::Agent)
            | Some(ProcessingMode::PromptEnhance)
    )
}

/// The language one record contributes to the ledger, from whichever instrument
/// could answer (ADR 0188).
///
/// ORDER, AND IT IS NOT A PREFERENCE FOR MODELS: the naming call reaches short
/// runs that trigram statistics must refuse, so where it answered, it answers.
/// Where it did not — offline, no key, no chat model, a timeout, a `??` — the
/// offline detector reads the text, which is the guarantee ADR 0180 exists for.
/// Where neither can, the run is in no bucket at all, which is a refusal rather
/// than a gap.
pub fn contributed_language(
    named: Option<String>,
    spoken: &str,
    mode: Option<&ProcessingMode>,
) -> Option<String> {
    let keeps = mode_keeps_the_spoken_language(mode);
    named
        .map(|code| code.trim().to_lowercase())
        .filter(|code| !code.is_empty())
        .filter(|_| keeps && super::language_detect::long_enough_to_name(spoken))
        .or_else(|| super::language_detect::detect(spoken))
}

#[derive(Debug, Clone, Deserialize)]
pub struct DeleteTranscriptionHistoryEntryRequest {
    pub id: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RetryTranscriptionHistoryEntryRequest {
    pub id: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AcknowledgeFallbackRequest {
    pub id: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct TranscriptionHistoryQuery {
    pub limit: Option<usize>,
    pub provider: Option<String>,
    pub status: Option<TranscriptionHistoryStatus>,
    pub source: Option<TranscriptionHistorySource>,
    pub active_profile: Option<String>,
    pub search: Option<String>,
    pub include_errors_only: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ExportTranscriptionHistoryRequest {
    pub path: String,
    #[serde(default)]
    pub query: TranscriptionHistoryQuery,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExportTranscriptionHistoryResponse {
    pub path: String,
    pub exported_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct TranscriptionHistoryStorageStatus {
    pub path: String,
    /// What the index costs on disk, and the two numbers it is read against
    /// (ADR 0241). **THE FIGURE IS THE SURFACE AND THE THRESHOLD IS NOT**: 5 GB
    /// will not arrive this decade, so a row wired only to the threshold would
    /// be a row that never says anything.
    #[serde(flatten)]
    pub budget: super::storage_budget::StorageBudget,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TranscriptionHistoryExportDocument {
    exported_at_ms: u64,
    /// The rule the export was taken under, which since ADR 0241 is the only
    /// one there is. A document written by an older build also carries a
    /// `history_limit`; serde drops it, and so does this product.
    history_retention_days: u32,
    count: usize,
    entries: Vec<TranscriptionHistoryEntry>,
}

#[derive(Debug, Clone, Default)]
struct LocalHistoryContext {
    provider_profile: Option<String>,
    local_prompt_strength: Option<String>,
    local_prompt_carry: Option<bool>,
    local_beam_size: Option<u8>,
    local_best_of: Option<u8>,
}

/// Which kind of retry produced a record, and the record it retried (ADR 0205).
///
/// **The distinction is not bookkeeping — it decides what listened.** A retry
/// with a transcript re-runs the transform over text that already exists and
/// sends no audio anywhere; a retry without one re-transcribes the kept capture
/// through this machine's *current* profile, deliberately, because the retry
/// usually happens after a setting was changed.
pub enum RetryOrigin<'a> {
    /// Only the transform ran again. Nothing listened, so the recogniser fields
    /// belong to the record the transcript came from.
    Transformed(&'a TranscriptionHistoryEntry),
    /// The kept audio was sent again. A recogniser did run, and it is the one
    /// this machine is configured with now.
    Retranscribed(&'a TranscriptionHistoryEntry),
}

impl RetryOrigin<'_> {
    fn retried(&self) -> &TranscriptionHistoryEntry {
        match self {
            Self::Transformed(entry) | Self::Retranscribed(entry) => entry,
        }
    }
}

/// WHAT LISTENED — the four fields of a record that describe a recogniser, and
/// the one place that decides whose they are (ADR 0205).
///
/// `provider`, `model` and the local decode block are properties of the request
/// that produced `raw_transcript`. On every live path that is the active
/// profile, resolved now. On a transform-only retry it is **not**: the config
/// may have changed since, no request was made, and reading the current one
/// gives a record that names a recogniser which did not run — the same wrong
/// attribution ADR 0203 removed from the model field, one path further on.
struct SpeechAttribution {
    provider: String,
    model: Option<String>,
    local: LocalHistoryContext,
}

impl SpeechAttribution {
    /// This machine's active profile: every path where a recogniser ran for
    /// this record, the re-transcribing retry included.
    fn from_config(config: &AppConfig) -> Self {
        Self {
            provider: speech_provider(config),
            model: config.speech_model(),
            local: local_history_context(config),
        }
    }

    /// The record the transcript came out of, for a run that only transformed
    /// it. Copied whole, including a `None` model — a record that names no
    /// recogniser cannot lend one.
    fn inherited(entry: &TranscriptionHistoryEntry) -> Self {
        Self {
            provider: entry.provider.clone(),
            model: entry.model.clone(),
            local: LocalHistoryContext {
                provider_profile: entry.provider_profile.clone(),
                local_prompt_strength: entry.local_prompt_strength.clone(),
                local_prompt_carry: entry.local_prompt_carry,
                local_beam_size: entry.local_beam_size,
                local_best_of: entry.local_best_of,
            },
        }
    }

    fn for_retry(config: &AppConfig, retry: Option<&RetryOrigin<'_>>) -> Self {
        match retry {
            Some(RetryOrigin::Transformed(entry)) => Self::inherited(entry),
            Some(RetryOrigin::Retranscribed(_)) | None => Self::from_config(config),
        }
    }
}

#[derive(Debug, Default)]
struct TranscriptionHistoryStore {
    loaded: bool,
    entries: VecDeque<TranscriptionHistoryEntry>,
    /// HOW MANY LINES THE JOURNAL ON DISK HOLDS, which is not how many records
    /// the store does (ADR 0241). Every put and every tombstone ever appended
    /// is still in the file until a compaction; the gap between this and
    /// `entries.len()` is the dead weight, and it is the whole input to the
    /// decision to rewrite.
    ops: usize,
}

/// One line of the index, which is what the index now is (ADR 0241).
///
/// **THE FILE IS A LOG OF WHAT HAPPENED, NOT A PICTURE OF WHAT IS.** A record
/// is appended; a delete appends a tombstone; an edit appends the record again.
/// Writing dictation number 80,000 therefore costs what dictation number 1 cost,
/// which is the entire reason the count ceiling could be deleted rather than
/// raised for a third time.
///
/// The order in the file is oldest first, because that is the direction append
/// goes; the order in the store is newest first, because that is the direction
/// a list reads. `replay_journal` is the one place those two meet.
#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
enum JournalOp {
    /// The record as it now stands. Boxed because an entry is some hundreds of
    /// bytes and a tombstone is one string, and an enum is as large as its
    /// largest variant.
    Put(Box<TranscriptionHistoryEntry>),
    Tombstone { id: String },
}

/// The same two operations, borrowed, for the writing half.
///
/// It is a second type rather than a lifetime on the first because the reading
/// half must own what it parses and the writing half must not clone what it
/// already holds — an owned `Put` on the write path would copy every field of
/// the record onto the dictation path to serialise it.
#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
enum JournalWrite<'a> {
    Put(&'a TranscriptionHistoryEntry),
    Tombstone { id: &'a str },
}

/// Rewrite the journal when the operations behind it outnumber the records in
/// front of it, and never before 256 lines.
///
/// THE FLOOR IS WHAT KEEPS A SMALL STORE FROM COMPACTING CONSTANTLY. Without it
/// a machine holding four records rewrites the file on the ninth operation, and
/// again on the thirteenth — a rewrite is cheap there, but it is also pointless,
/// and a rule that fires on every install from the first week is a rule nobody
/// can reason about. Above the floor the test is a doubling: half the file being
/// dead is the point at which reading it costs twice what it should.
const JOURNAL_COMPACT_FLOOR: usize = 256;

fn history_store() -> &'static Mutex<TranscriptionHistoryStore> {
    static STORE: OnceLock<Mutex<TranscriptionHistoryStore>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(TranscriptionHistoryStore::default()))
}

#[cfg(test)]
fn history_path_override() -> &'static Mutex<Option<PathBuf>> {
    static OVERRIDE: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();
    OVERRIDE.get_or_init(|| Mutex::new(None))
}

#[cfg(test)]
fn history_policy_override() -> &'static Mutex<Option<u32>> {
    static OVERRIDE: OnceLock<Mutex<Option<u32>>> = OnceLock::new();
    OVERRIDE.get_or_init(|| Mutex::new(None))
}

fn resolved_history_file_path() -> PathBuf {
    #[cfg(test)]
    if let Ok(guard) = history_path_override().lock() {
        if let Some(path) = guard.clone() {
            return path;
        }
    }

    history_file_path()
}

/// The array this store used to be, beside wherever the journal resolved to.
///
/// A test points the journal at a directory of its own, and the file it is
/// converting from has to be in that same directory — otherwise the migration
/// test would read the developer's real history.
fn resolved_legacy_index_path() -> PathBuf {
    #[cfg(test)]
    if let Ok(guard) = history_path_override().lock() {
        if let Some(path) = guard.clone() {
            return path.with_extension("json");
        }
    }

    legacy_history_index_path()
}

/// Load once per process, then rewrite the file if it has gone slack.
///
/// **THIS IS THE "ON ACTIVATION" HALF OF COMPACTION (ADR 0241)**, and it is here
/// rather than on a timer or a command because it is the one moment the whole
/// journal has just been read anyway: the records are in hand, the cost of
/// writing them out is paid against a launch rather than against a dictation,
/// and a store that was pruned by retention on the way in sheds those lines
/// immediately instead of carrying them to the next launch.
fn ensure_loaded(store: &mut TranscriptionHistoryStore) {
    if store.loaded {
        return;
    }

    let (entries, ops) = load_history_entries();
    store.entries = entries;
    store.ops = ops;
    store.loaded = true;
    compact_if_slack(store);
}

/// Replay the journal, or convert the array that preceded it.
///
/// Answers the records AND how many lines produced them, because the second
/// number is what decides whether the file gets rewritten and cannot be derived
/// from the first: a thousand records that were each edited twice are three
/// thousand lines.
fn load_history_entries() -> (VecDeque<TranscriptionHistoryEntry>, usize) {
    let path = resolved_history_file_path();
    if let Ok(raw) = std::fs::read_to_string(&path) {
        let (mut entries, ops) = replay_journal(&raw);
        prune_entries_for_runtime(&mut entries);
        return (entries, ops);
    }

    /* NO JOURNAL, SO THE FILE THAT CAME BEFORE IT (ADR 0241 section 5). This is
       the whole of the migration the record allows itself, and it is here
       because the parse was already written: `history.json` is one JSON array
       and reading it once costs the six lines below. It is converted and then
       deleted, so this branch runs exactly once per install and never again. */
    let mut entries = load_legacy_index();
    prune_entries_for_runtime(&mut entries);
    if !entries.is_empty() && compact_journal(&entries).is_ok() {
        let _ = std::fs::remove_file(resolved_legacy_index_path());
    }
    let ops = entries.len();
    (entries, ops)
}

/// The one JSON array this index was until ADR 0241, parsed for conversion.
fn load_legacy_index() -> VecDeque<TranscriptionHistoryEntry> {
    let Ok(raw) = std::fs::read_to_string(resolved_legacy_index_path()) else {
        return VecDeque::with_capacity(DEFAULT_HISTORY_LIMIT);
    };

    serde_json::from_str::<VecDeque<TranscriptionHistoryEntry>>(&raw)
        .or_else(|_| {
            serde_json::from_str::<Vec<TranscriptionHistoryEntry>>(&raw).map(VecDeque::from)
        })
        .unwrap_or_else(|_| VecDeque::with_capacity(DEFAULT_HISTORY_LIMIT))
}

/// Fold the log back into the set it describes.
///
/// **ONE PASS AND A MAP, NOT A SCAN PER LINE.** A put of an id already held
/// replaces it IN PLACE rather than moving it to the end, because an edit is not
/// a re-arrival: acknowledging a fallback on the oldest record must not shuffle
/// it to the top of the reader's list. Slots are emptied rather than removed so
/// that every other id keeps its index, and the emptied ones are dropped in the
/// single collect at the bottom.
///
/// A LINE THAT WILL NOT PARSE IS SKIPPED AND COSTS THAT ONE RECORD. Appending
/// can be interrupted — a kill, a full disk — and what that leaves is a torn
/// last line rather than a torn file, which is the property the old whole-file
/// write did not have at all before ADR 0240 gave it a rename. Refusing to parse
/// the file for it would throw away every record on the machine to report a
/// half-written one.
fn replay_journal(raw: &str) -> (VecDeque<TranscriptionHistoryEntry>, usize) {
    let mut slots: Vec<Option<TranscriptionHistoryEntry>> = Vec::new();
    let mut at: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut ops = 0usize;

    for line in raw.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let Ok(op) = serde_json::from_str::<JournalOp>(line) else {
            continue;
        };
        ops += 1;
        match op {
            JournalOp::Put(entry) => match at.get(&entry.id) {
                Some(&index) => slots[index] = Some(*entry),
                None => {
                    at.insert(entry.id.clone(), slots.len());
                    slots.push(Some(*entry));
                }
            },
            JournalOp::Tombstone { id } => {
                if let Some(index) = at.remove(&id) {
                    slots[index] = None;
                }
            }
        }
    }

    /* OLDEST FIRST IN THE FILE, NEWEST FIRST IN THE STORE. Append only ever adds
       at the end, and a list only ever reads from the top. */
    (slots.into_iter().flatten().rev().collect(), ops)
}

/// The records a stored index holds, as loose JSON, for the measurement
/// harnesses that read the developer's LIVE store rather than the runtime's.
///
/// **THEY READ THE FILE AND THEY MUST NOT REIMPLEMENT THE REPLAY.** Both of them
/// parsed `history.json` as one array, which after ADR 0241 matches nothing and
/// yields zero records — and each of them then prints that zero as a finding. A
/// measurement that silently answers *no data* is worse than one that fails,
/// because somebody writes the zero down.
///
/// It takes the journal where there is one and the array otherwise, because a
/// machine that has not yet run a build with the journal in it still has a
/// history worth measuring.
#[cfg(test)]
pub fn stored_index_values(directory: &std::path::Path) -> Vec<serde_json::Value> {
    let entries = match std::fs::read_to_string(directory.join("history.jsonl")) {
        Ok(raw) => replay_journal(&raw).0,
        Err(_) => match std::fs::read_to_string(directory.join("history.json")) {
            Ok(raw) => serde_json::from_str::<VecDeque<TranscriptionHistoryEntry>>(&raw)
                .unwrap_or_default(),
            Err(_) => VecDeque::new(),
        },
    };

    entries
        .iter()
        .filter_map(|entry| serde_json::to_value(entry).ok())
        .collect()
}

/// Add lines to the end of the journal. **THIS IS THE DICTATION PATH** (ADR 0241).
///
/// One record is one line and the cost does not depend on how many lines are
/// already there — which is the whole change. ADR 0240 measured the write it
/// replaces at 4.8 ms over a thousand records, 24.9 over five thousand and 59.4
/// over ten thousand, because the file was one JSON array serialised and
/// replaced in full every time somebody spoke a sentence. `HISTORY_CEILING`
/// existed to bound that curve and there is now no curve to bound.
///
/// IT DOES NOT USE A TEMPORARY AND A RENAME, and that is not an oversight. The
/// rename was what made a whole-file replacement atomic; an append has nothing
/// to be atomic about — it cannot damage a byte that is already in the file, and
/// the worst an interrupted one leaves is a partial last line that
/// `replay_journal` skips.
fn append_journal(
    store: &mut TranscriptionHistoryStore,
    ops: &[JournalWrite<'_>],
) -> Result<(), String> {
    if ops.is_empty() {
        return Ok(());
    }

    let path = resolved_history_file_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let mut raw = String::new();
    for op in ops {
        raw.push_str(&serde_json::to_string(op).map_err(|error| error.to_string())?);
        raw.push('\n');
    }

    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|error| error.to_string())?;
    file.write_all(raw.as_bytes())
        .map_err(|error| error.to_string())?;

    store.ops += ops.len();
    Ok(())
}

/// Write the journal out as exactly the records the store holds. **NEVER ON THE
/// DICTATION PATH** (ADR 0241).
///
/// This is the O(records) write the append replaced, kept for the two moments
/// that are allowed to pay it: activation, and a set replaced wholesale. It is
/// what drops tombstoned records, superseded puts and everything retention
/// pruned out of memory — none of which leave the file any other way.
///
/// **IT IS NOT PRETTY-PRINTED** (ADR 0240). Indentation cost this file 16% —
/// 229 kB of the reporting machine's 1.4 MB — for a file nobody opens by hand;
/// `activity.json` keeps its `BTreeMap` ordering precisely so a human can read
/// it, and the export command exists for the case where somebody wants to look
/// at this one.
///
/// **AND IT DOES NOT TEAR.** Truncating and then writing leaves a half-written
/// index if a crash, a kill or a full disk lands between the two, and a
/// half-written index is every record on the machine. Writing a sibling and
/// renaming it makes the replacement atomic on every filesystem this product
/// runs on. The temporary lives beside the target rather than in `/tmp`, because
/// a rename across filesystems is a copy and is not atomic.
fn compact_journal(entries: &VecDeque<TranscriptionHistoryEntry>) -> Result<(), String> {
    let path = resolved_history_file_path();

    let mut raw = String::new();
    /* OLDEST FIRST, which is the direction the file grows and therefore the
       direction `replay_journal` reverses back out of it. Writing the store's
       own newest-first order here would silently invert the list on the next
       launch. */
    for entry in entries.iter().rev() {
        raw.push_str(
            &serde_json::to_string(&JournalWrite::Put(entry)).map_err(|error| error.to_string())?,
        );
        raw.push('\n');
    }

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let temporary = path.with_extension("jsonl.tmp");
    std::fs::write(&temporary, raw).map_err(|error| error.to_string())?;
    std::fs::rename(&temporary, &path).map_err(|error| {
        /* The rename is what makes it atomic, so a failure here leaves a stray
           sibling rather than a torn index. Sweep it: the next write would
           overwrite it anyway, and a leftover `.tmp` beside a data file is the
           kind of thing a reader opens Privacy & Data to ask about. */
        let _ = std::fs::remove_file(&temporary);
        error.to_string()
    })
}

/// The bytes the index costs on disk right now (ADR 0241).
///
/// One `metadata()`, which is what makes a byte budget affordable to check at
/// all: the answer does not depend on how many records are in the file. It is
/// the journal INCLUDING its dead weight, because that is what is actually on
/// the reader's disk and is what a figure on Privacy & Data has to mean.
pub fn journal_bytes() -> u64 {
    super::storage_budget::file_bytes(&resolved_history_file_path())
}

/// Bring the index back under `ceiling` by dropping its oldest records, and
/// answer with how many went (ADR 0241).
///
/// **A COMPACTION IS TRIED FIRST AND OFTEN ENDS IT.** The file holds tombstones,
/// superseded puts and everything retention pruned out of memory; none of that
/// is a record the reader would lose, and a store that is over its ceiling on
/// dead weight alone must not answer by deleting live history.
///
/// Only when the rewritten file is STILL over does anything get evicted, oldest
/// first, and then down to `target` rather than to the ceiling — see `EVICT_TO`.
/// The transcript FILES of evicted records are left alone, which is ADR 0237's
/// rule and is not weakened here: this is the index's budget, the archive has
/// its own, and a record leaving the list has never taken its text with it.
pub fn enforce_journal_ceiling(ceiling: u64, target: u64) -> usize {
    if journal_bytes() <= ceiling {
        return 0;
    }

    let Ok(mut store) = history_store().lock() else {
        return 0;
    };
    ensure_loaded(&mut store);

    if compact_journal(&store.entries).is_ok() {
        store.ops = store.entries.len();
    }
    if journal_bytes() <= ceiling {
        return 0;
    }

    /* THE OLDEST FIRST, AND MEASURED RATHER THAN GUESSED. Each candidate is
       serialised to learn what dropping it buys, which costs one pass over the
       records actually being removed and nothing over the ones that stay. */
    let mut bytes = journal_bytes();
    let mut evicted = 0usize;
    while bytes > target {
        let Some(oldest) = store.entries.pop_back() else {
            break;
        };
        let freed = serde_json::to_string(&JournalWrite::Put(&oldest))
            .map(|line| line.len() as u64 + 1)
            .unwrap_or(0);
        bytes = bytes.saturating_sub(freed);
        evicted += 1;
    }

    if evicted > 0 && compact_journal(&store.entries).is_ok() {
        store.ops = store.entries.len();
    }
    evicted
}

/// Compact when at least half the file is dead weight, above a floor.
///
/// A FAILED REWRITE IS NOT AN ERROR ANYBODY CAN ACT ON. The records are already
/// in memory and already on disk; all a failure here means is that the file
/// stays longer than it needed to be, and the next activation tries again. It is
/// therefore silent by design, and the callers that must report a write — the
/// ones that changed what the store holds — do their own.
fn compact_if_slack(store: &mut TranscriptionHistoryStore) {
    if store.ops <= JOURNAL_COMPACT_FLOOR || store.ops < store.entries.len().saturating_mul(2) {
        return;
    }
    if compact_journal(&store.entries).is_ok() {
        store.ops = store.entries.len();
    }
}

fn next_history_id(created_at_ms: u64, entries_len: usize) -> String {
    format!("history-{created_at_ms}-{entries_len}")
}

#[cfg(test)]
pub fn record_entry(
    request: RecordHistoryEntryRequest,
) -> Result<TranscriptionHistoryEntry, String> {
    record_entry_with_work_mode(request, None, None)
}

/// The same funnel with the naming call's answer in hand, which is the only way
/// to exercise the half of `spoken_language` no detector can reach.
#[cfg(test)]
pub fn record_entry_named(
    request: RecordHistoryEntryRequest,
    named_language: Option<String>,
) -> Result<TranscriptionHistoryEntry, String> {
    record_entry_with_work_mode(request, None, named_language)
}

/// `named_language` IS A PARAMETER AND NOT A REQUEST FIELD (ADR 0188), because
/// it is not a property of the record: it is one instrument's opinion, arriving
/// beside the title from the same call, and what the record keeps is the verdict
/// the two instruments reach together — `spoken_language`, decided below and
/// stored (ADR 0236) — rather than this input to it. Putting it on the request
/// would have added a line to eighteen literal constructions to carry a value
/// seventeen of them have no opinion about.
fn record_entry_with_work_mode(
    request: RecordHistoryEntryRequest,
    work_mode: Option<TextProfileWorkMode>,
    named_language: Option<String>,
) -> Result<TranscriptionHistoryEntry, String> {
    let mut store = history_store().lock().map_err(|error| error.to_string())?;
    ensure_loaded(&mut store);

    let created_at_ms = now_ms();
    let id = next_history_id(created_at_ms, store.entries.len());

    /* THE FILE IS WRITTEN HERE BECAUSE THIS IS WHERE A RECORD COMES INTO
       EXISTENCE (ADR 0074). Every path arrives at this function — the native
       pipeline, an empty result, an insert failure, a transcription failure and
       a retry — so "one file per session on every path" is structural rather
       than a rule five callers have to remember. A record with no written text
       gets no file, and `write_transcript` answers `None` for it. */
    let transcript_path = super::transcript_store::write_transcript(
        &super::transcript_store::TranscriptDocument {
            id: id.clone(),
            created_at_ms,
            written: request.transformed_transcript.clone().unwrap_or_default(),
            heard: request.raw_transcript.clone(),
            profile: request.active_profile.clone(),
            // What ran, falling back to what the profile was set to. The
            // fallback is only reached on paths that never resolved a mode,
            // and `Auto` is then the honest answer rather than a guess at
            // which concrete mode it would have become.
            mode: request
                .effective_mode
                .clone()
                .or_else(|| work_mode.as_ref().map(|mode| mode.processing_mode.clone())),
            provider: request.provider.clone(),
            model: request.model.clone(),
            insert_mode: request.insert_mode.clone(),
            /* THE LENGTH OF THE AUDIO, NOT OF THE SESSION (ADR 0085).
               `recorded_seconds` is what arrived from the microphone, which is
               the thing the `audio:` path beside it points at and the only one
               of the two a reader can check. `wall_seconds` is the clock, and
               where the two disagree that disagreement is the defect ADR 0079
               measures rather than a duration to publish. Absent on every path
               that measured nothing — a retry, an upload, a record older than
               the measurement. */
            duration_ms: request
                .capture_integrity
                .as_ref()
                .map(|integrity| (integrity.recorded_seconds * 1000.0).round().max(0.0) as u64),
            audio_path: request.audio_path.clone(),
            title: request.title.clone(),
        },
    );

    /* THE LANGUAGE IS DECIDED HERE, ONCE, AND THE RECORD KEEPS IT (ADR 0236).
       It used to be decided inside the ledger block at the foot of this function
       and thrown away with it, which left a rebuilt ledger nothing to read and
       forced it to re-measure with the offline detector alone. Deciding it
       before the record exists — on the same text, through the same function —
       means the record carries the answer and the rebuild reads it.

       MEASURED ON THE TEXT THAT WAS SPOKEN (ADR 0188), never read off
       `request.language`, which is the configured hint (ADR 0180) and would
       count how often a dropdown was changed. The delivered text is the wrong
       one in three modes: Translate delivers the language you asked for, Agent
       and Prompt Enhance whatever the model wrote in. The raw transcript is what
       was SAID, and it falls back to the delivered text only where the record
       kept no raw one.

       A RETRY IS MEASURED TOO AND STILL NOT COUNTED. The field says what this
       record's text is in, which is a fact about the record; whether it reaches
       the ledger is the separate question the block at the foot answers. */
    let spoken_language = {
        let delivered = request
            .transformed_transcript
            .as_deref()
            .or(request.raw_transcript.as_deref())
            .unwrap_or_default();
        contributed_language(
            named_language,
            request
                .raw_transcript
                .as_deref()
                .map(str::trim)
                .filter(|raw| !raw.is_empty())
                .unwrap_or(delivered),
            request.effective_mode.as_ref(),
        )
    };

    let entry = TranscriptionHistoryEntry {
        id,
        created_at_ms,
        status: request.status,
        source: request.source,
        retry_of: request.retry_of,
        provider: request.provider,
        model: request.model,
        language: request.language,
        spoken_language,
        active_profile: request.active_profile,
        work_mode,
        effective_mode: request.effective_mode,
        title: request.title.clone(),
        transcript_path,
        provider_profile: request.provider_profile,
        local_prompt_strength: request.local_prompt_strength,
        local_prompt_carry: request.local_prompt_carry,
        local_beam_size: request.local_beam_size,
        local_best_of: request.local_best_of,
        raw_transcript: request.raw_transcript,
        transformed_transcript: request.transformed_transcript,
        corrected: request.corrected,
        applied_rules: request.applied_rules,
        transform_warning: request.transform_warning,
        insert_mode: request.insert_mode,
        active_driver: request.active_driver,
        pasted: request.pasted,
        fallback_available: request.fallback_available,
        fallback_reason: request.fallback_reason,
        recovery_action: request.recovery_action,
        recovery_message: request.recovery_message,
        clipboard_restore: request.clipboard_restore,
        error: request.error,
        audio_path: request.audio_path,
        fallback_acknowledged: false,
        capture_integrity: request.capture_integrity,
        turnaround_ms: request.turnaround_ms,
        input_level: request.input_level,
        speech_seconds: request.speech_seconds,
        capture_stop_reason: request.capture_stop_reason,
    };

    store.entries.push_front(entry.clone());

    /* ONE LINE, APPENDED, AND THE COST IS THE SAME AT EVERY INDEX SIZE
       (ADR 0241). The prune runs after it and only in memory: what retention
       drops leaves the FILE at the next compaction, which is a launch away and
       is not this reader's problem right now. Appending before pruning also
       means the record just written can never be the one dropped by a policy
       read a microsecond later. */
    append_journal(&mut store, &[JournalWrite::Put(&entry)])?;
    prune_entries_for_runtime(&mut store.entries);

    /* THE ALL-TIME LEDGER, FOLDED HERE BECAUSE THIS IS THE ONE FUNNEL EVERY PATH
       ARRIVES AT — the same argument ADR 0074 used to put the transcript file on
       this function rather than on five callers.

       A RETRY IS NOT A DICTATION. It re-runs a transform over words that were
       already spoken and already counted, so counting it again would inflate
       every all-time figure by however often somebody pressed Retry.

       THE ERROR IS SWALLOWED INTO THE RUNTIME LOG AND NEVER FAILS THE RECORD. A
       dictation that reached the cursor has succeeded; failing it because an
       aggregate could not be written would be the tail wagging the dog. */
    if entry.retry_of.is_none() {
        /* TWO WORD COUNTS, BECAUSE THE TWO FIGURES ASK DIFFERENT QUESTIONS
           (ADR 0177). The delivered text is what reached the cursor and is what
           a typing baseline is measured against; the raw transcript is what was
           SAID, and it is the only numerator a speaking rate may divide. Under
           Cleanup they differ by the filler that was removed, and under Prompt
           Enhance by an order of magnitude. */
        let delivered = entry
            .transformed_transcript
            .as_deref()
            .or(entry.raw_transcript.as_deref())
            .unwrap_or_default();
        if let Err(error) = super::activity_ledger::record(super::activity_ledger::LedgerContribution {
            created_at_ms: entry.created_at_ms,
            words: super::activity_ledger::word_count(delivered),
            spoken_words: entry
                .raw_transcript
                .as_deref()
                .map(super::activity_ledger::word_count)
                .unwrap_or_default(),
            recorded_seconds: entry
                .capture_integrity
                .as_ref()
                .map(|integrity| integrity.recorded_seconds),
            speech_seconds: entry.speech_seconds,
            turnaround_ms: entry.turnaround_ms,
            /* WHO ANSWERED, so the turnaround histogram can be split by the
               thing that caused it (ADR 0240). The record already names both;
               reading them here rather than re-resolving the active profile is
               the same argument as `language` below — the funnel counts what
               the record says happened, never what the config currently says. */
            provider: entry.provider.clone(),
            model: entry.model.clone(),
            credited: mode_credits_typing(entry.effective_mode.as_ref()),
            /* THE VERDICT THE RECORD ALREADY CARRIES, not a second reading of
               the same text (ADR 0236). It was decided at the top of this
               function — against `entry.language`, which is the configured hint
               (ADR 0180), and against the delivered text, which is the wrong
               text in three modes (ADR 0188). Reaching for either again here
               would be a second place to decide it differently. */
            language: entry.spoken_language.clone(),
        }) {
            super::runtime_log::record(format!(
                "[WordScript] Activity ledger write failed error={error}"
            ));
        }
    }

    Ok(entry)
}

/// Every entry, for an archive (ADR 0074's export half). Unfiltered and
/// unpruned by the query, because "everything local" is what the row promises.
pub fn entries_for_backup() -> Result<Vec<TranscriptionHistoryEntry>, String> {
    entries_snapshot()
}

/// Replace the index with an archive's. Used only by the import, which has
/// already written its snapshot — this function does not check that, and the
/// only caller that may skip it does not exist.
///
/// The REPLACED entries' files are deliberately NOT deleted: the import writes
/// the archive's transcripts beside whatever is there, and a restore that
/// silently swept the files of the records it replaced would destroy the very
/// thing the snapshot exists to protect.
pub fn replace_entries_from_backup(
    entries: Vec<TranscriptionHistoryEntry>,
) -> Result<(), String> {
    let mut store = history_store().lock().map_err(|error| error.to_string())?;
    ensure_loaded(&mut store);
    store.entries = entries.into_iter().collect();
    /* A SET REPLACED WHOLESALE IS A COMPACTION, not a run of appends: every
       record in the journal is being superseded at once, and appending the
       archive's copies on top of the ones they replace would double the file to
       say so. This is one of the two moments allowed to pay the O(records)
       write (ADR 0241), and an import is as far from the dictation path as this
       module gets. */
    compact_journal(&store.entries)?;
    store.ops = store.entries.len();
    Ok(())
}

fn entries_snapshot() -> Result<Vec<TranscriptionHistoryEntry>, String> {
    let mut store = history_store().lock().map_err(|error| error.to_string())?;
    ensure_loaded(&mut store);
    prune_entries_for_runtime(&mut store.entries);
    Ok(store.entries.iter().cloned().collect())
}

/// The list, as summaries, WITHOUT CLONING A SINGLE RECORD (ADR 0240).
///
/// The old path was `entries_snapshot()` — which clones every entry out of the
/// store — followed by a filter that dropped most of them again, followed by
/// serde over the whole set. Two copies of 1.2 MB to answer a question about ten
/// rows. This one holds the lock, prunes, and maps the entries it keeps straight
/// into the wire shape.
fn summaries_snapshot(
    query: &TranscriptionHistoryQuery,
) -> Result<Vec<TranscriptionHistorySummary>, String> {
    let mut store = history_store().lock().map_err(|error| error.to_string())?;
    ensure_loaded(&mut store);
    prune_entries_for_runtime(&mut store.entries);

    let filter = HistoryFilter::of(query);
    let limit = query_limit(query).unwrap_or(usize::MAX);
    Ok(store
        .entries
        .iter()
        .filter(|entry| filter.admits(entry, query))
        .take(limit)
        .map(TranscriptionHistorySummary::of)
        .collect())
}

/// Every summary the store holds, for the paths that mutate and then hand the
/// list back. Same shape as the query command with no query.
fn all_summaries(store: &TranscriptionHistoryStore) -> Vec<TranscriptionHistorySummary> {
    store.entries.iter().map(TranscriptionHistorySummary::of).collect()
}

#[tauri::command]
pub fn transcription_history_summaries(
    query: Option<TranscriptionHistoryQuery>,
) -> Result<Vec<TranscriptionHistorySummary>, String> {
    summaries_snapshot(&query.unwrap_or_default())
}

/// ONE WHOLE RECORD, BY ID (ADR 0240).
///
/// The other half of the split: the list carries a 160-character preview, and
/// the three surfaces that need the actual text — the raw panel, Copy, Restore —
/// ask for the one record they are about. At most one at a time, against a list
/// that used to ship all of them on a five-second timer.
///
/// `None` rather than an error for an id the store does not hold: the record may
/// have been deleted or pruned between a row being drawn and somebody pressing
/// a button on it, and that is a stale surface rather than a fault.
#[tauri::command]
pub fn transcription_history_record(
    id: String,
) -> Result<Option<TranscriptionHistoryEntry>, String> {
    let mut store = history_store().lock().map_err(|error| error.to_string())?;
    ensure_loaded(&mut store);
    Ok(store.entries.iter().find(|entry| entry.id == id).cloned())
}

#[tauri::command]
pub fn transcription_history_storage_status() -> Result<TranscriptionHistoryStorageStatus, String> {
    Ok(TranscriptionHistoryStorageStatus {
        path: resolved_history_file_path().to_string_lossy().to_string(),
        budget: super::storage_budget::StorageBudget::of(journal_bytes()),
    })
}

/// Mark a fallen-back delivery as dealt with, so Home stops asking (ADR 0076).
///
/// Idempotent, and silent about an id it does not hold: the record may have
/// been pruned between the surface reading it and somebody pressing Dismiss,
/// and an error there would report a problem that has already resolved itself.
#[tauri::command]
pub fn acknowledge_transcription_fallback(
    request: AcknowledgeFallbackRequest,
) -> Result<Vec<TranscriptionHistorySummary>, String> {
    let mut store = history_store().lock().map_err(|error| error.to_string())?;
    ensure_loaded(&mut store);
    /* AN EDIT IS THE RECORD APPENDED AGAIN (ADR 0241), and `replay_journal`
       replaces it in place rather than moving it — acknowledging a fallback on
       last month's record must not shuffle that record to the top of the list.
       Nothing is written for an id the store does not hold, so a Dismiss on a
       row whose record was pruned adds no line. */
    let mut acknowledged: Option<TranscriptionHistoryEntry> = None;
    for entry in store.entries.iter_mut() {
        if entry.id == request.id {
            entry.fallback_acknowledged = true;
            acknowledged = Some(entry.clone());
        }
    }
    if let Some(entry) = acknowledged {
        append_journal(&mut store, &[JournalWrite::Put(&entry)])?;
        compact_if_slack(&mut store);
    }
    Ok(all_summaries(&store))
}

#[tauri::command]
pub fn clear_transcription_history_entries() -> Result<Vec<TranscriptionHistorySummary>, String> {
    let mut store = history_store().lock().map_err(|error| error.to_string())?;
    ensure_loaded(&mut store);
    // The record is the entry AND its file since ADR 0074. Clearing one and
    // leaving the other is the drift the ADR exists to prevent, and on this
    // command it is also what the button says it does.
    let cleared: Vec<TranscriptionHistoryEntry> = store.entries.drain(..).collect();
    /* CLEARING IS A COMPACTION TO NOTHING, which is one empty file rather than a
       tombstone per record — the reader asked for the index to be gone, and a
       journal of five thousand tombstones is not gone. */
    compact_journal(&store.entries)?;
    store.ops = 0;
    remove_transcript_files(&cleared);
    Ok(Vec::new())
}

#[tauri::command]
pub fn delete_transcription_history_entry(
    request: DeleteTranscriptionHistoryEntryRequest,
) -> Result<Vec<TranscriptionHistorySummary>, String> {
    let mut store = history_store().lock().map_err(|error| error.to_string())?;
    ensure_loaded(&mut store);
    let removed: Vec<TranscriptionHistoryEntry> = store
        .entries
        .iter()
        .filter(|entry| entry.id == request.id)
        .cloned()
        .collect();
    store.entries.retain(|entry| entry.id != request.id);
    /* A TOMBSTONE, and only where something was actually removed (ADR 0241).
       The record itself stays in the file until a compaction; what the line says
       is that it is no longer part of the set, which is what a replay needs to
       know and is one string rather than a rewrite of everything else. */
    if !removed.is_empty() {
        append_journal(&mut store, &[JournalWrite::Tombstone { id: &request.id }])?;
        compact_if_slack(&mut store);
    }
    remove_transcript_files(&removed);
    Ok(all_summaries(&store))
}

#[tauri::command]
pub fn export_transcription_history(
    request: ExportTranscriptionHistoryRequest,
) -> Result<ExportTranscriptionHistoryResponse, String> {
    let entries = filter_history_entries(entries_snapshot()?, &request.query);
    let path = PathBuf::from(request.path.trim());
    if path.as_os_str().is_empty() {
        return Err("Choose a file path for the history export.".to_string());
    }

    let document = TranscriptionHistoryExportDocument {
        exported_at_ms: now_ms(),
        history_retention_days: runtime_history_retention_days(),
        count: entries.len(),
        entries,
    };
    let raw = serde_json::to_string_pretty(&document).map_err(|error| error.to_string())?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    std::fs::write(&path, raw).map_err(|error| error.to_string())?;

    Ok(ExportTranscriptionHistoryResponse {
        path: path.to_string_lossy().to_string(),
        exported_count: document.count,
    })
}

/// Re-transcribe the capture an entry kept, and return the raw text.
///
/// The retry path for a failure that never produced a transcript. It rebuilds
/// the provider request from the *current* capture config rather than the one
/// the original run used: the retry happens because something was wrong, and
/// the fix is often a setting the user changed in between.
async fn transcribe_retained_capture(
    entry: &TranscriptionHistoryEntry,
) -> Result<String, String> {
    let audio_path = entry
        .audio_path
        .clone()
        .filter(|path| !path.trim().is_empty())
        .ok_or_else(|| {
            "This history entry has neither a transcript nor a kept recording, so there is nothing to re-process."
                .to_string()
        })?;

    // The path comes out of history.json, which is a plain file on disk. Anything
    // that can write it could otherwise point a retry at an arbitrary file and
    // have WordScript upload it to the transcription provider — turning a local
    // write into an exfiltration path. A retry may only ever re-send a capture
    // this app wrote, in the directory it writes them to.
    if !super::capture::is_retained_capture_path(&audio_path) {
        return Err(
            "This entry does not point at a WordScript recording, so it will not be re-sent."
                .to_string(),
        );
    }

    let metadata = std::fs::metadata(&audio_path).map_err(|_| {
        "The recording for this entry is no longer on disk. Kept recordings are pruned after seven days."
            .to_string()
    })?;

    // Duration from file size, because the export is a fixed-rate mono WAV and
    // the budget only needs it to size the wait. Reading the header to learn
    // what the writer already guarantees would be a second source for it.
    let audio_seconds = metadata.len() as f64 / super::capture_budget::EXPORT_BYTES_PER_SECOND as f64;
    let timeout_ms = super::capture_budget::transcription_timeout_ms(Some(audio_seconds));

    let capture_config = super::capture::NativeCaptureConfig::load_from_disk();
    let request = capture_config.resolve_transcription_request(&audio_path, timeout_ms);
    // The prompt THIS request sends, held before the request is consumed. A
    // retry is a fresh transcription and leaks exactly like any other, so it
    // gets the same repair the pipeline gives (ADR 0080, ADR 0081).
    let recognizer_prompt = request.prompt.clone();

    runtime_log::record(format!(
        "[WordScript] History retry from audio entry_id={} path={} audio_seconds={:.1} timeout_ms={}",
        entry.id, audio_path, audio_seconds, timeout_ms,
    ));

    let response = super::providers::transcribe_audio_file(request)
        .await
        .map_err(|error| error.message)?;

    let (repaired, signals) = super::recognizer_repair::repair_recognizer_output(
        &response.text,
        recognizer_prompt.as_deref(),
        // Detected first, configured second — the same order the pipeline uses,
        // and for the same reason: the German-only repair may not run over text
        // whose language nobody established.
        response
            .language
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .or(capture_config.language.as_str().into())
            .filter(|value| !value.trim().is_empty()),
    );
    if signals.changed_text() {
        runtime_log::record(format!(
            "[WordScript] Recognizer repair applied entry_id={} rules={} heard_len={} repaired_len={}",
            entry.id,
            signals.applied_rules().join(","),
            response.text.len(),
            repaired.len(),
        ));
    }

    let text = repaired.trim().to_string();
    if text.is_empty() {
        return Err("The recording was transcribed but produced no text.".to_string());
    }

    Ok(text)
}

#[tauri::command]
pub async fn retry_transcription_history_entry<R: Runtime>(
    app: AppHandle<R>,
    request: RetryTranscriptionHistoryEntryRequest,
) -> Result<TranscriptionHistoryEntry, String> {
    let existing = entries_snapshot()?
        .into_iter()
        .find(|entry| entry.id == request.id)
        .ok_or_else(|| format!("History entry '{}' was not found.", request.id))?;

    // Two kinds of retry, and which one this is depends on how far the original
    // run got. With a transcript, only the transform re-runs. Without one — a
    // transcription that timed out — the retry starts from the audio the
    // runtime kept, which is the whole reason it is kept.
    let (raw_transcript, retry_origin) = match existing
        .raw_transcript
        .clone()
        .filter(|value| !value.trim().is_empty())
    {
        Some(transcript) => (transcript, RetryOrigin::Transformed(&existing)),
        None => (
            transcribe_retained_capture(&existing).await?,
            RetryOrigin::Retranscribed(&existing),
        ),
    };

    let app_config = AppConfig::load_from_disk();
    let mut transform_config = transform_config_from_app_config(&app_config);
    /* WHOSE RECOGNISER THIS RECORD NAMES (ADR 0205), decided by which of the
       two retries just ran rather than by reading the config either way. */
    let attribution = SpeechAttribution::for_retry(&app_config, Some(&retry_origin));

    /* THE MODE THE RECORD RAN IN, not a correction (ADR 0075).
       This function used to call `apply_native_transform` for every entry,
       which is the cleanup family's transform and only theirs — so a retried
       Agent, Translate or Prompt Enhance record came back conservatively
       tidied instead of re-run.

       The record is the source, in this order: what actually ran, then the
       profile's stored mode as it was at record time, then this machine's
       current one for entries older than either field. Auto is resolved here
       rather than carried, because an Auto record has no concrete mode to
       repeat and the router is what decides one. */
    let retry_mode = resolve_retry_mode(&existing, &app_config);
    transform_config.apply_preset(retry_mode.transform_preset());

    // The job the retry is about to run, resolved once so the log line, the
    // empty-text record and the successful record all name the same vendor.
    // They used to name one machine-wide field while the live session that
    // produced the entry ran on the profile's — a retry could therefore reach a
    // different provider than the dictation it was retrying (ADR 0094).
    let retry_job = transform_config.mode_provider(&retry_mode);

    runtime_log::record(format!(
        "[WordScript] History retry start entry_id={} job={} provider={} overridden={} mode={} post_process={}",
        existing.id,
        retry_job.job.as_str(),
        retry_job.provider,
        retry_job.overridden,
        retry_mode.as_str(),
        transform_config.post_process,
    ));

    let active_profile = app_config
        .text_profiles
        .iter()
        .find(|profile| profile.id == app_config.active_text_profile_id);

    // Text rules are the pipeline's final stage and no longer run inside
    // `apply_native_transform`, so the retry has to finalize too — otherwise a
    // retried entry would come back without the profile's dictionary applied.
    let transformed = finalize_with_text_rules(
        super::mode_router::apply_mode_transform(
            &raw_transcript,
            &retry_mode,
            &transform_config,
            &app_config,
            active_profile,
        )
        .await,
        &transform_config,
    );
    let transformed_text = transformed.text.trim().to_string();

    let retried_entry = if transformed_text.is_empty() {
        record_entry_with_work_mode(
            RecordHistoryEntryRequest {
                status: TranscriptionHistoryStatus::Empty,
                source: TranscriptionHistorySource::Retry,
                retry_of: Some(existing.id.clone()),
                /* THE SAME VENDOR THE SUCCESSFUL RECORD NAMES, which is what
                   the resolution above asked for and did not get: this branch
                   named the transform job's vendor while the branch below named
                   the recogniser's, so one retry wrote two different answers to
                   the same field depending on whether it produced text. */
                provider: attribution.provider.clone(),
                model: attribution.model.clone(),
                language: optional_non_empty(&app_config.active_text_profile_speech_language()),
                active_profile: app_config.active_text_profile_label(),
                effective_mode: Some(retry_mode.clone()),
                title: None,
                provider_profile: attribution.local.provider_profile.clone(),
                local_prompt_strength: attribution.local.local_prompt_strength.clone(),
                local_prompt_carry: attribution.local.local_prompt_carry,
                local_beam_size: attribution.local.local_beam_size,
                local_best_of: attribution.local.local_best_of,
                raw_transcript: Some(raw_transcript),
                transformed_transcript: None,
                corrected: transformed.corrected,
                applied_rules: transformed.applied_rules,
                transform_warning: transformed.warning,
                insert_mode: None,
                active_driver: None,
                pasted: None,
                fallback_available: None,
                fallback_reason: None,
                recovery_action: None,
                recovery_message: None,
                clipboard_restore: None,
                error: Some("Retry produced no usable transcript.".to_string()),
                audio_path: None,
                // A retry re-transcribes audio an earlier session captured, so
                // it has no capture of its own to report. The original record
                // keeps the verdict that belongs to it.
                capture_integrity: None,
                turnaround_ms: None,
                input_level: None,
                speech_seconds: None,
                capture_stop_reason: None,
            },
            Some(app_config.resolved_active_text_profile_work_mode()),
            // Nothing was transformed, so nothing was named.
            None,
        )?
    } else {
        let insert_result = insert_transcription_from_legacy(
            &app,
            &transformed_text,
            transformed.corrected,
            Some(app_config.active_text_profile_auto_paste()),
        )
        .map_err(|error| error.to_string())?;

        /* A retry produces a new record and therefore a new file, so it is
           titled like any other (ADR 0077). From the retried text, because that
           is what the file will hold. */
        /* The title rides the assistant's resolution. ADR 0087 settled that the
           row states rather than sets — it resolves through the same chat model
           Agent, Translate and Prompt Enhance use and adds no setting of its
           own — so it has no override until that row is drawn (ADR 0094). */
        let naming = super::transcript_store::describe(
            &transformed_text,
            &app_config.job_provider(JobKey::Assistant),
            &app_config.chat_model_for_job(JobKey::Assistant),
        )
        .await;

        let entry = history_entry_from_insert_result(
            &app_config,
            Some(retry_origin),
            Some(raw_transcript),
            transformed,
            &insert_result,
            Some(retry_mode.clone()),
            naming,
            // A retry re-transcribes audio an earlier session captured. The
            // capture measurement belongs to that session's record and is not
            // copied forward onto a run that never made a capture — and neither
            // is a turnaround, which would time a re-run rather than a dictation.
            CaptureFacts::none(),
            None,
        )?;

        if insert_result.ok {
            let _ = app.emit(
                "wordscript-event",
                serde_json::json!({
                    "event": "transcription",
                    "text": transformed_text,
                    "corrected": entry.corrected,
                    "provider": entry.provider,
                    "active_profile": entry.active_profile,
                    "work_mode": entry.work_mode,
                    "raw_text": entry.raw_transcript,
                    "transform": {
                        "applied_rules": entry.applied_rules,
                        "warning": entry.transform_warning,
                    },
                    "history": {
                        "entry_id": entry.id,
                        "retry_of": entry.retry_of,
                    },
                    "delivery": insert_result.insert_mode.delivery_label(),
                    "insertion": insert_result,
                }),
            );
            // The retry's delivery point, next to the event that tells the UI
            // the same thing (ADR 0012).
            super::sound::play_if_enabled(super::sound::SoundCue::Done);
        } else {
            super::sound::play_if_enabled(super::sound::SoundCue::Error);
        }

        entry
    };

    runtime_log::record(format!(
        "[WordScript] History retry done entry_id={} retry_of={:?} status={:?}",
        retried_entry.id, retried_entry.retry_of, retried_entry.status,
    ));

    Ok(retried_entry)
}

pub fn history_entry_from_insert_result(
    app_config: &AppConfig,
    // Which record this re-ran and how (ADR 0205). `None` on the live paths,
    // where the session is its own origin. It carries the kind rather than just
    // the id because the kind is what decides whose recogniser the record
    // names: a transform-only retry sent no audio anywhere.
    retry: Option<RetryOrigin<'_>>,
    raw_transcript: Option<String>,
    transformed: NativeTransformResult,
    insert_result: &NativeInsertResult,
    // The mode the transform ran in, where the caller resolved one. `None` on
    // the paths that never consulted the mode router.
    effective_mode: Option<ProcessingMode>,
    // What the naming call answered (ADR 0077, ADR 0188): the file's name, or
    // `None` for the first words, and the language of the text, or `None` for
    // the offline detector.
    naming: super::transcript_store::TranscriptNaming,
    // What the capture measured about itself — integrity (ADR 0079), input
    // level, and the speech clock (ADR 0177). `CaptureFacts::none()` on a retry,
    // which has no capture of its own.
    capture: CaptureFacts,
    // Milliseconds from the capture STOPPING to the text existing (ADR 0181).
    // `None` wherever the caller did not run that clock — a retry, and the
    // parked path, whose delay is the park's rather than the runtime's.
    turnaround_ms: Option<u64>,
) -> Result<TranscriptionHistoryEntry, String> {
    let attribution = SpeechAttribution::for_retry(app_config, retry.as_ref());

    record_entry_with_work_mode(
        RecordHistoryEntryRequest {
            status: if insert_result.ok {
                TranscriptionHistoryStatus::Completed
            } else {
                TranscriptionHistoryStatus::Failed
            },
            source: if retry.is_some() {
                TranscriptionHistorySource::Retry
            } else {
                TranscriptionHistorySource::NativePipeline
            },
            retry_of: retry.as_ref().map(|origin| origin.retried().id.clone()),
            provider: attribution.provider,
            model: attribution.model,
            language: optional_non_empty(&app_config.active_text_profile_speech_language()),
            active_profile: app_config.active_text_profile_label(),
            effective_mode,
            title: naming.title,
            provider_profile: attribution.local.provider_profile,
            local_prompt_strength: attribution.local.local_prompt_strength,
            local_prompt_carry: attribution.local.local_prompt_carry,
            local_beam_size: attribution.local.local_beam_size,
            local_best_of: attribution.local.local_best_of,
            raw_transcript,
            transformed_transcript: Some(insert_result.text.clone()),
            corrected: transformed.corrected,
            applied_rules: transformed.applied_rules,
            transform_warning: transformed.warning,
            insert_mode: Some(insert_result.insert_mode.clone()),
            active_driver: Some(insert_result.active_driver),
            pasted: Some(insert_result.pasted),
            fallback_available: Some(insert_result.fallback_available),
            fallback_reason: insert_result.fallback_reason.clone(),
            recovery_action: Some(insert_result.recovery_action),
            recovery_message: Some(insert_result.recovery_message.clone()),
            clipboard_restore: Some(insert_result.clipboard_restore),
            error: insert_result.error.clone(),
            audio_path: None,
            capture_integrity: capture.integrity,
            input_level: capture.input_level,
            speech_seconds: capture.speech_seconds,
            capture_stop_reason: capture.stop_reason.clone(),
            /* THE CALLER'S CLOCK, WHICH THIS DROPPED ON THE FLOOR. It arrived
               as an argument and was written as `None`, so every record on the
               product's main path reported no turnaround at all and the
               histogram behind the tile could never fill. Found when the tile
               stayed dark on a machine with sixty dictations in it. */
            turnaround_ms,
        },
        Some(app_config.resolved_active_text_profile_work_mode()),
        naming.language,
    )
}

pub fn record_insert_failure(
    app_config: &AppConfig,
    raw_transcript: String,
    transformed_text: String,
    transformed: NativeTransformResult,
    error: String,
    effective_mode: Option<ProcessingMode>,
    // The naming call's two answers (ADR 0188), as everywhere else.
    naming: super::transcript_store::TranscriptNaming,
    // What the capture measured about itself, carried as one (ADR 0177).
    capture: CaptureFacts,
) -> Result<TranscriptionHistoryEntry, String> {
    let local_history = local_history_context(app_config);

    record_entry_with_work_mode(
        RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Failed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: speech_provider(app_config),
            model: app_config.speech_model(),
            language: optional_non_empty(&app_config.active_text_profile_speech_language()),
            active_profile: app_config.active_text_profile_label(),
            effective_mode,
            title: naming.title,
            provider_profile: local_history.provider_profile,
            local_prompt_strength: local_history.local_prompt_strength,
            local_prompt_carry: local_history.local_prompt_carry,
            local_beam_size: local_history.local_beam_size,
            local_best_of: local_history.local_best_of,
            raw_transcript: Some(raw_transcript),
            transformed_transcript: Some(transformed_text),
            corrected: transformed.corrected,
            applied_rules: transformed.applied_rules,
            transform_warning: transformed.warning,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: Some(error),
            audio_path: None,
            capture_integrity: capture.integrity,
            input_level: capture.input_level,
            speech_seconds: capture.speech_seconds,
            capture_stop_reason: capture.stop_reason.clone(),
            /* No turnaround on this path and that is not an oversight: the text
               never reached the reader, so there is no wait that ended. */
            turnaround_ms: None,
        },
        Some(app_config.resolved_active_text_profile_work_mode()),
        naming.language,
    )
}

/// Record a transcription that never produced text.
///
/// `audio_path` is `Some` when the runtime kept the capture because the failure
/// could succeed on a second attempt. It is what makes the entry retryable at
/// all: there is no transcript to re-run the transform from, so the audio is
/// the only thing left to work with.
pub fn record_transcription_failure(
    app_config: &AppConfig,
    provider: &str,
    model: Option<String>,
    language: Option<String>,
    error: String,
    audio_path: Option<String>,
    // What the capture measured about itself, carried as one (ADR 0177).
    capture: CaptureFacts,
) -> Result<TranscriptionHistoryEntry, String> {
    let local_history = local_history_context(app_config);

    record_entry_with_work_mode(
        RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Failed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: provider.to_string(),
            model,
            language,
            active_profile: app_config.active_text_profile_label(),
            // Nothing was transcribed, so no mode ever ran over anything.
            effective_mode: None,
            // …and nothing to title.
            title: None,
            provider_profile: local_history.provider_profile,
            local_prompt_strength: local_history.local_prompt_strength,
            local_prompt_carry: local_history.local_prompt_carry,
            local_beam_size: local_history.local_beam_size,
            local_best_of: local_history.local_best_of,
            raw_transcript: None,
            transformed_transcript: None,
            corrected: false,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: Some(error),
            audio_path,
            capture_integrity: capture.integrity,
            input_level: capture.input_level,
            speech_seconds: capture.speech_seconds,
            capture_stop_reason: capture.stop_reason.clone(),
            turnaround_ms: None,
        },
        Some(app_config.resolved_active_text_profile_work_mode()),
        // Nothing was transcribed, so there is no language to name.
        None,
    )
}

pub fn record_empty_result(
    app_config: &AppConfig,
    raw_transcript: String,
    transformed: NativeTransformResult,
    effective_mode: Option<ProcessingMode>,
    // What the capture measured about itself, carried as one (ADR 0177).
    capture: CaptureFacts,
) -> Result<TranscriptionHistoryEntry, String> {
    // An empty result has no text, so no file and nothing to name.
    let title: Option<String> = None;
    let local_history = local_history_context(app_config);

    record_entry_with_work_mode(
        RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Empty,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: speech_provider(app_config),
            model: app_config.speech_model(),
            language: optional_non_empty(&app_config.active_text_profile_speech_language()),
            active_profile: app_config.active_text_profile_label(),
            effective_mode,
            title,
            provider_profile: local_history.provider_profile,
            local_prompt_strength: local_history.local_prompt_strength,
            local_prompt_carry: local_history.local_prompt_carry,
            local_beam_size: local_history.local_beam_size,
            local_best_of: local_history.local_best_of,
            raw_transcript: Some(raw_transcript),
            transformed_transcript: None,
            corrected: transformed.corrected,
            applied_rules: transformed.applied_rules,
            transform_warning: transformed.warning,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: Some("Pipeline produced no usable transcript.".to_string()),
            audio_path: None,
            // The one place the verdict matters most: an empty result and a
            // capture that recorded nothing look identical on the record, and
            // only this number tells them apart.
            capture_integrity: capture.integrity,
            input_level: capture.input_level,
            speech_seconds: capture.speech_seconds,
            capture_stop_reason: capture.stop_reason.clone(),
            turnaround_ms: None,
        },
        Some(app_config.resolved_active_text_profile_work_mode()),
        // An empty result has no text, so nothing to name and no language.
        None,
    )
}

fn transform_config_from_app_config(config: &AppConfig) -> NativeTransformConfig {
    let active_profile = config.active_text_profile();
    // All three correction switches come from the active profile's mode. This
    // path used to take `post_process` from the global field while taking the
    // other two from the profile, so a re-transform could run under a mix of the
    // two that no live session would ever produce.
    let preset = config.active_text_profile_transform_preset();

    /* THE PROFILE'S TWO CORRECTION MODELS, CHOSEN NOWHERE HERE (ADR 0206).
       This path used to answer "which correction model" itself, off the
       connection-wide fields, while the live capture answered it off the
       PROFILE's — so a retry could correct on a different model than the
       session it was retrying, and neither of them had asked the correction
       job's lane in the same way. Both are carried now, both come from the
       profile, and the lane picks one where it is resolved. */
    let speech = active_profile.resolved_speech();

    NativeTransformConfig {
        providers: active_profile.resolved_providers(),
        profile_prompt: active_profile.prompt,
        dictionary_entries: active_profile.dictionary_entries,
        snippet_entries: active_profile.snippet_entries,
        post_process: preset.post_process,
        correction_model: speech.correction_model,
        local_correction_model: speech.local_correction_model,
        filter_fillers: preset.filter_fillers,
        professionalize: preset.professionalize,
        // Through the same resolver the live session uses. Reaching into
        // `profile.modes` here instead would let a re-transform run under a
        // style the session never had — the mixing defect this function's
        // comment above already records for the correction switches.
        style: config.active_text_profile_communication_style(),
        // Through the same resolver too, and for now it only travels: this path
        // runs the correction transform for every mode, so a retried Translate
        // record comes back cleaned up rather than translated, exactly as a
        // retried Agent or Prompt Enhance record does. That is the conservative
        // arm `ProcessingMode::transform_preset` documents, and routing the
        // retry by mode is one job for all three rather than one for Translate.
        translate: config.active_text_profile_translate_settings(),
        ..Default::default()
    }
}

/* THE MODEL A RECORD WAS TRANSCRIBED WITH IS `AppConfig::speech_model` AND NOT
   A SECOND ANSWER HERE (ADR 0203). This file used to carry its own two-arm
   version reading the connection-wide `model` and `local_model`, one axis older
   than the capture path it was describing: every record on a machine whose
   profile names a recogniser of its own was filed under a model no request
   carried, and the per-model rates measured off this file with it. The doc
   comment that stated the contract sits on the resolver now.

   ONE THING THIS FIX DOES NOT ANSWER, LEFT VISIBLE RATHER THAN QUIETLY DECIDED:
   the two retry sites above call the same resolver, and a retry re-runs the
   transform over a transcript that already exists — nothing listens. So a
   retried record names this machine's *current* recogniser for a request that
   never happened, next to a `provider` that deliberately names the transform
   job's vendor. Both readings are defensible and neither is measured; the
   record carries the question. */

/// Which vendor listened for this machine's active profile.
///
/// Every history field derived from "was this the local lane" asks this rather
/// than a connection-wide field: the decode settings a record carries are the
/// recogniser's, so the question is `Dictation`'s (ADR 0094).
fn speech_provider(config: &AppConfig) -> String {
    config.job_provider(JobKey::Dictation).provider
}

fn local_history_context(config: &AppConfig) -> LocalHistoryContext {
    if speech_provider(config) != super::providers::LOCAL_PROVIDER_ID {
        return LocalHistoryContext::default();
    }

    LocalHistoryContext {
        provider_profile: optional_non_empty(&config.local_profile),
        local_prompt_strength: optional_non_empty(&config.local_prompt_strength),
        local_prompt_carry: Some(config.local_prompt_carry),
        local_beam_size: Some(config.local_beam_size),
        local_best_of: Some(config.local_best_of),
    }
}

fn optional_non_empty(value: &str) -> Option<String> {
    let trimmed = value.trim();
    (!trimmed.is_empty()).then(|| trimmed.to_string())
}

/// The one rule that governs the index, in days (ADR 0241).
///
/// IT USED TO BE A PAIR, and the second half was the binding one without ever
/// saying so: at 217 dictations a day the ceiling of 5,000 arrived in 23 days
/// while the reader's own setting said 365, so the number they chose on Privacy
/// & Data was the number that never applied. Deleting the count leaves the
/// setting alone in charge, which is what it always read as.
fn runtime_history_retention_days() -> u32 {
    #[cfg(test)]
    if let Ok(guard) = history_policy_override().lock() {
        if let Some(history_retention_days) = *guard {
            return history_retention_days.min(3650);
        }
    }

    configured_history_retention_days(&AppConfig::load_from_disk())
}

fn configured_history_retention_days(config: &AppConfig) -> u32 {
    config.history_retention_days.min(3650)
}

/// WHICH MODE A RETRY RE-RUNS (ADR 0075).
///
/// Three sources in order, and the order is the point:
///
/// 1. `effective_mode` — what actually ran. Present on everything recorded
///    since the field existed, and the only source that is right for a record
///    dictated under `Auto`.
/// 2. `work_mode.processing_mode` — the profile's stored mode at record time.
///    Right for every concrete mode on an older entry.
/// 3. This machine's current active profile, for an entry that carries neither.
///
/// **`Auto` is resolved rather than repeated.** An Auto record has no concrete
/// mode to re-run; the router decides one from the transcript, exactly as it
/// did the first time. The classifier is deliberately not consulted here — that
/// arm is asynchronous and costs a model call, and `resolve_auto_mode` answers
/// deterministically for everything a retry can see. Where it cannot, Cleanup
/// is the conservative answer and is also what the retry did for every mode
/// before this record.
fn resolve_retry_mode(entry: &TranscriptionHistoryEntry, app_config: &AppConfig) -> ProcessingMode {
    let recorded = entry
        .effective_mode
        .clone()
        .or_else(|| {
            entry
                .work_mode
                .as_ref()
                .map(|work_mode| work_mode.processing_mode.clone())
        })
        .unwrap_or_else(|| {
            app_config
                .text_profiles
                .iter()
                .find(|profile| profile.id == app_config.active_text_profile_id)
                .map(|profile| profile.work_mode.effective_processing_mode())
                .unwrap_or_else(|| app_config.processing_mode.clone())
        });

    if !recorded.is_auto() {
        return recorded;
    }

    let text = entry
        .raw_transcript
        .as_deref()
        .or(entry.transformed_transcript.as_deref())
        .unwrap_or_default();

    match super::mode_router::resolve_auto_mode(text, None, &app_config.agent_name) {
        super::mode_router::AutoRoute::Decided { mode, .. } => mode,
        super::mode_router::AutoRoute::NeedsClassifier => ProcessingMode::Cleanup,
    }
}

/// Prune the index, and LEAVE THE FILES WHERE THEY ARE (ADR 0237).
///
/// ADR 0074 had this call take the pruned records' files with it, on the
/// reasoning that a retention rule true of one of two stores is worse than
/// none. That argument is right about a rule a screen prints and wrong about
/// which stores it governs: the index is a surface — what History lists, what
/// the cause list groups, what a filter reaches — and the archive is the
/// reader's writing, in a folder in their home directory, in a format made to
/// outlive this product. The index is swept by a retention rule measured in
/// months; it has no business deleting a year of somebody's transcripts on the
/// way past.
///
/// So this is housekeeping and it acts like it, the same cut ADR 0176 made for
/// the activity ledger. Wanting the writing gone is a separate intention and
/// has separate doors: deleting a record, clearing the history, and the purge
/// on Privacy & Data all still remove files.
///
/// THE COST IS THE ORPHAN, AND IT IS DELIBERATE. Once the entry is gone nothing
/// knows the path any more, so the file is unreachable from every entry-driven
/// path in the runtime. `purge_transcript_archive` is the answer to that and
/// the reason it may walk the directory at all.
fn prune_entries_for_runtime(entries: &mut VecDeque<TranscriptionHistoryEntry>) {
    prune_entries(entries, runtime_history_retention_days(), now_ms());
}

/// The files of records that are going away, and nothing else. Never a
/// directory walk (ADR 0074) — with the single exception ADR 0237 names, which
/// lives in `transcript_store` behind a button rather than here.
fn remove_transcript_files(entries: &[TranscriptionHistoryEntry]) {
    for entry in entries {
        if let Some(path) = entry.transcript_path.as_deref() {
            super::transcript_store::remove_transcript(path);
        }
    }
}

/// Answers with what it dropped, so the caller can decide what else that record
/// owned. Kept pure of side effects for the same reason it takes its clock as
/// an argument: the retention tests drive it directly.
fn prune_entries(
    entries: &mut VecDeque<TranscriptionHistoryEntry>,
    history_retention_days: u32,
    reference_now_ms: u64,
) -> Vec<TranscriptionHistoryEntry> {
    let mut dropped = Vec::new();

    if history_retention_days > 0 {
        let cutoff_ms =
            reference_now_ms.saturating_sub(u64::from(history_retention_days) * MS_PER_DAY);
        let mut kept = VecDeque::with_capacity(entries.len());
        for entry in entries.drain(..) {
            if entry.created_at_ms >= cutoff_ms {
                kept.push_back(entry);
            } else {
                dropped.push(entry);
            }
        }
        *entries = kept;
    }

    dropped
}

/// The query, resolved once instead of per entry.
///
/// It exists because the filter now runs over BORROWED entries as well as owned
/// ones (ADR 0240): the list builds summaries straight off the store without
/// cloning a record, and the export still walks a snapshot it owns. One
/// predicate, two callers, and no second place for a filter rule to drift.
struct HistoryFilter {
    provider: Option<String>,
    profile: Option<String>,
    search: Option<String>,
}

impl HistoryFilter {
    fn of(query: &TranscriptionHistoryQuery) -> Self {
        Self {
            provider: normalized_filter(&query.provider),
            profile: normalized_filter(&query.active_profile),
            search: normalized_filter(&query.search),
        }
    }

    fn admits(&self, entry: &TranscriptionHistoryEntry, query: &TranscriptionHistoryQuery) -> bool {
        if let Some(provider) = &self.provider {
            if !entry.provider.eq_ignore_ascii_case(provider) {
                return false;
            }
        }
        if let Some(status) = &query.status {
            if &entry.status != status {
                return false;
            }
        }
        if let Some(source) = &query.source {
            if &entry.source != source {
                return false;
            }
        }
        if let Some(profile) = &self.profile {
            if !entry
                .active_profile
                .as_deref()
                .map(|value| value.eq_ignore_ascii_case(profile))
                .unwrap_or(false)
            {
                return false;
            }
        }
        if query.include_errors_only && entry.error.as_deref().is_none() {
            return false;
        }
        if let Some(search) = &self.search {
            if !history_entry_matches_search(entry, search) {
                return false;
            }
        }
        true
    }
}

/// A caller's own window on the set.
///
/// **THE UPPER BOUND IS GONE WITH THE CEILING THAT SET IT** (ADR 0241). It was
/// the literal `1000`, which was the old ceiling wearing a different name; ADR
/// 0240 moved the ceiling to 5,000 and left this behind, so a query asking for
/// more rows than that was silently handed a number that had stopped meaning
/// anything. Clamping to a store with no cap would mean inventing one here,
/// which is the one place a limit must never be invented — the caller asked for
/// a window and the floor of 1 is the only thing wrong with asking for zero.
fn query_limit(query: &TranscriptionHistoryQuery) -> Option<usize> {
    query.limit.map(|value| value.max(1))
}

fn filter_history_entries(
    entries: Vec<TranscriptionHistoryEntry>,
    query: &TranscriptionHistoryQuery,
) -> Vec<TranscriptionHistoryEntry> {
    let filter = HistoryFilter::of(query);
    let mut filtered = entries
        .into_iter()
        .filter(|entry| filter.admits(entry, query))
        .collect::<Vec<_>>();

    if let Some(limit) = query_limit(query) {
        filtered.truncate(limit);
    }

    filtered
}

fn normalized_filter(value: &Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_lowercase())
}

fn history_entry_matches_search(entry: &TranscriptionHistoryEntry, search: &str) -> bool {
    let contains = |value: Option<&str>| {
        value
            .map(|candidate| candidate.to_ascii_lowercase().contains(search))
            .unwrap_or(false)
    };

    entry.provider.to_ascii_lowercase().contains(search)
        || contains(entry.model.as_deref())
        || contains(entry.language.as_deref())
        || contains(entry.active_profile.as_deref())
        || contains(
            entry
                .work_mode
                .as_ref()
                .map(|work_mode| work_mode.rewrite_style.as_str()),
        )
        || contains(
            entry
                .work_mode
                .as_ref()
                .map(|work_mode| work_mode.insert_behavior.as_str()),
        )
        || contains(
            entry
                .work_mode
                .as_ref()
                .map(|work_mode| work_mode.recovery_behavior.as_str()),
        )
        || contains(entry.provider_profile.as_deref())
        || contains(entry.local_prompt_strength.as_deref())
        || contains(entry.raw_transcript.as_deref())
        || contains(entry.transformed_transcript.as_deref())
        || contains(entry.transform_warning.as_deref())
        || contains(entry.fallback_reason.as_deref())
        || contains(entry.recovery_message.as_deref())
        || contains(entry.error.as_deref())
}

#[cfg(test)]
fn set_history_path_override_for_tests(path: PathBuf) {
    if let Ok(mut guard) = history_path_override().lock() {
        *guard = Some(path);
    }
}

#[cfg(test)]
fn set_history_policy_override_for_tests(history_retention_days: u32) {
    if let Ok(mut guard) = history_policy_override().lock() {
        *guard = Some(history_retention_days);
    }
}

#[cfg(test)]
fn reset_store_for_tests() {
    if let Ok(mut store) = history_store().lock() {
        store.loaded = false;
        store.entries.clear();
        store.ops = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /* THE LEDGER'S LOCK, NOT A SECOND ONE. Recording a history entry writes
       into the activity ledger, and the ledger's own tests count what is in it —
       two locks would let those two run at once and put this module's words into
       that module's assertions. */
    fn test_lock() -> &'static Mutex<()> {
        super::super::activity_ledger::test_lock()
    }

    fn test_history_path(test_name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("wordscript-history-tests-{test_name}"));
        let _ = std::fs::create_dir_all(&dir);
        dir.join("history.jsonl")
    }

    fn prepare_test_history_path(test_name: &str) -> PathBuf {
        let path = test_history_path(test_name);
        let _ = std::fs::remove_file(&path);
        // The array a migration would convert. A test that does not write one
        // must not inherit the previous test's.
        let _ = std::fs::remove_file(path.with_extension("json"));
        set_history_path_override_for_tests(path.clone());
        set_history_policy_override_for_tests(90);
        reset_store_for_tests();
        path
    }

    /// ADR 0188. The naming call reaches what the trigrams must refuse — five
    /// words of English are a Hungarian coin flip to a trigram model and are
    /// obvious to a language one — so where it answered, it answers.
    #[test]
    fn a_named_language_wins_over_the_detector_and_a_missing_one_falls_back_to_it() {
        assert_eq!(
            contributed_language(
                Some("EN ".to_string()),
                "Whats up my fellow American",
                Some(&ProcessingMode::Cleanup),
            )
            .as_deref(),
            Some("en"),
        );

        /* Nothing named it — offline, no key, a timeout, a `??`. The detector
           reads the text, which is the guarantee ADR 0180 exists for. */
        assert_eq!(
            contributed_language(
                None,
                "Ich habe heute den ganzen Vormittag an der neuen Auswertung gearbeitet.",
                Some(&ProcessingMode::Cleanup),
            )
            .as_deref(),
            Some("de"),
        );

        /* And where neither instrument can answer, the run is in no bucket at
           all — a refusal rather than a gap. */
        assert_eq!(
            contributed_language(None, "Removing", Some(&ProcessingMode::Cleanup)),
            None,
        );
    }

    /// The floor under a named language: a model never refuses, so it would name
    /// one for `Ja` and for `Removing`, and a counter that tallies interjections
    /// drifts toward whatever short exclamations look like.
    #[test]
    fn a_named_language_needs_more_than_a_word_or_two() {
        assert_eq!(
            contributed_language(
                Some("de".to_string()),
                "Ja",
                Some(&ProcessingMode::Cleanup),
            ),
            None,
        );
        assert_eq!(
            contributed_language(
                Some("de".to_string()),
                "Ja genau das",
                Some(&ProcessingMode::Cleanup),
            )
            .as_deref(),
            Some("de"),
        );
    }

    /// ADR 0236. The naming call happens once and the record has to keep its
    /// answer, because the ledger it feeds is rebuilt from these records
    /// whenever the file is reset or lost — and a rebuild cannot make the call
    /// again. A run over the naming floor and under the trigram one is exactly
    /// the run that used to disappear on the way through.
    #[test]
    fn the_record_keeps_the_language_it_was_counted_as() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("spoken-language");

        let entry = record_entry_named(completed_request("Hi there"), Some("EN ".to_string()))
            .expect("history entry");

        /* Trimmed and lowercased on the way in, and stored BESIDE the configured
           hint rather than instead of it: the two are different facts and the
           record states both. */
        assert_eq!(entry.spoken_language.as_deref(), Some("en"));
        assert_eq!(entry.language.as_deref(), Some("de"));

        /* And without the field this run is in no bucket at all, which is what
           every rebuild used to do to it: the same text through the same
           function with no model answer to pass refuses, because three words are
           under the trigram floor. */
        assert_eq!(
            contributed_language(None, "Hi there uh", Some(&ProcessingMode::Cleanup)),
            None,
        );

        /* THE WHOLE RECORD, because `spoken_language` is one of the fields the
           list shape does not carry (ADR 0240) — the runtime reads it, no screen
           does, and this case is about what was STORED. */
        let read_back = transcription_history_record(entry.id.clone())
            .expect("history record")
            .expect("the entry we just wrote");
        assert_eq!(read_back.spoken_language.as_deref(), Some("en"));

        if let Some(path) = read_back.transcript_path.as_deref() {
            super::super::transcript_store::remove_transcript(path);
        }
    }

    /// The three modes whose output is not the reader's own language. The tile
    /// asks which languages you DICTATE in, and the naming call was shown the
    /// file it was naming — so its answer is discarded and the spoken text is
    /// what gets measured.
    #[test]
    fn a_translating_or_generating_mode_reports_what_was_spoken() {
        let spoken = "Ich habe heute den ganzen Vormittag an der neuen Auswertung gearbeitet.";
        for mode in [
            ProcessingMode::Translate,
            ProcessingMode::Agent,
            ProcessingMode::PromptEnhance,
        ] {
            assert_eq!(
                contributed_language(Some("en".to_string()), spoken, Some(&mode)).as_deref(),
                Some("de"),
                "{mode:?} must not report the language it delivered",
            );
        }

        /* Every other mode delivers the language it was given, so the model's
           answer about the delivered text is an answer about the spoken one. */
        for mode in [
            ProcessingMode::Cleanup,
            ProcessingMode::Verbatim,
            ProcessingMode::Rewrite,
        ] {
            assert_eq!(
                contributed_language(Some("en".to_string()), spoken, Some(&mode)).as_deref(),
                Some("en"),
                "{mode:?} keeps the language it was spoken in",
            );
        }
    }

    #[test]
    fn records_and_reads_history_entries_with_retention() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let path = prepare_test_history_path("retention");

        for index in 0..(DEFAULT_HISTORY_LIMIT + 5) {
            record_entry(RecordHistoryEntryRequest {
                status: TranscriptionHistoryStatus::Completed,
                source: TranscriptionHistorySource::NativePipeline,
                retry_of: None,
                provider: "groq".to_string(),
                model: Some("whisper-large-v3-turbo".to_string()),
                language: Some("de".to_string()),
                active_profile: None,
                effective_mode: None,
                title: None,
                provider_profile: None,
                local_prompt_strength: None,
                local_prompt_carry: None,
                local_beam_size: None,
                local_best_of: None,
                raw_transcript: Some(format!("raw-{index}")),
                transformed_transcript: Some(format!("final-{index}")),
                corrected: false,
                applied_rules: Vec::new(),
                transform_warning: None,
                insert_mode: None,
                active_driver: None,
                pasted: None,
                fallback_available: None,
                fallback_reason: None,
                recovery_action: None,
                recovery_message: None,
                clipboard_restore: None,
                error: None,
                audio_path: None,
                capture_integrity: None,
                turnaround_ms: None,
                input_level: None,
                speech_seconds: None,
                capture_stop_reason: None,
            })
            .expect("record history entry");
        }

        let entries = transcription_history_summaries(None).expect("history entries");

        /* NOTHING IS DROPPED BY COUNT ANY MORE (ADR 0241), and this test is
           where that shows: it writes past the old cap on purpose and used to
           assert that the oldest five had been swept, with `raw-5` standing at
           the bottom of the list as the proof. All of them are here, oldest
           included, because the rule that governs this store is measured in
           months. */
        assert_eq!(entries.len(), DEFAULT_HISTORY_LIMIT + 5);
        assert!(path.is_file());
        assert_eq!(
            entries.last().map(|entry| entry.heard_preview.as_str()),
            Some("raw-0"),
            "the oldest record was swept by a cap that no longer exists",
        );
    }

    #[test]
    fn deletes_history_entries_by_id() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("delete");

        let first = record_entry(RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Completed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: "groq".to_string(),
            model: None,
            language: None,
            active_profile: None,
            effective_mode: None,
            title: None,
            provider_profile: None,
            local_prompt_strength: None,
            local_prompt_carry: None,
            local_beam_size: None,
            local_best_of: None,
            raw_transcript: Some("eins".to_string()),
            transformed_transcript: Some("eins".to_string()),
            corrected: false,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: None,
            audio_path: None,
            capture_integrity: None,
            turnaround_ms: None,
            input_level: None,
            speech_seconds: None,
            capture_stop_reason: None,
        })
        .expect("first history entry");
        record_entry(RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Completed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: "groq".to_string(),
            model: None,
            language: None,
            active_profile: None,
            effective_mode: None,
            title: None,
            provider_profile: None,
            local_prompt_strength: None,
            local_prompt_carry: None,
            local_beam_size: None,
            local_best_of: None,
            raw_transcript: Some("zwei".to_string()),
            transformed_transcript: Some("zwei".to_string()),
            corrected: false,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: None,
            audio_path: None,
            capture_integrity: None,
            turnaround_ms: None,
            input_level: None,
            speech_seconds: None,
            capture_stop_reason: None,
        })
        .expect("second history entry");

        let remaining =
            delete_transcription_history_entry(DeleteTranscriptionHistoryEntryRequest {
                id: first.id,
            })
            .expect("delete history entry");

        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].heard_preview, "zwei");
    }

    #[test]
    fn filters_history_entries_by_provider_status_and_search() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("filtering");

        record_entry(RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Completed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: "groq".to_string(),
            model: Some("whisper-large-v3-turbo".to_string()),
            language: Some("de".to_string()),
            active_profile: Some("developer".to_string()),
            effective_mode: None,
            title: None,
            provider_profile: None,
            local_prompt_strength: None,
            local_prompt_carry: None,
            local_beam_size: None,
            local_best_of: None,
            raw_transcript: Some("ship release notes".to_string()),
            transformed_transcript: Some("Ship release notes.".to_string()),
            corrected: true,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: None,
            audio_path: None,
            capture_integrity: None,
            turnaround_ms: None,
            input_level: None,
            speech_seconds: None,
            capture_stop_reason: None,
        })
        .expect("groq history entry");

        record_entry(RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Failed,
            source: TranscriptionHistorySource::Retry,
            retry_of: Some("history-old".to_string()),
            provider: "local".to_string(),
            model: Some("base.en".to_string()),
            language: Some("en".to_string()),
            active_profile: Some("support".to_string()),
            effective_mode: None,
            title: None,
            provider_profile: Some("local-base-quality".to_string()),
            local_prompt_strength: Some("profile_and_terms".to_string()),
            local_prompt_carry: Some(true),
            local_beam_size: Some(5),
            local_best_of: Some(5),
            raw_transcript: Some("follow up".to_string()),
            transformed_transcript: None,
            corrected: false,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: Some("Model missing".to_string()),
            audio_path: None,
            capture_integrity: None,
            turnaround_ms: None,
            input_level: None,
            speech_seconds: None,
            capture_stop_reason: None,
        })
        .expect("local runtime history entry");

        let filtered = transcription_history_summaries(Some(TranscriptionHistoryQuery {
            provider: Some("local".to_string()),
            status: Some(TranscriptionHistoryStatus::Failed),
            source: Some(TranscriptionHistorySource::Retry),
            search: Some("model missing".to_string()),
            include_errors_only: true,
            ..TranscriptionHistoryQuery::default()
        }))
        .expect("filtered history entries");

        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].provider, "local");
        assert_eq!(filtered[0].active_profile.as_deref(), Some("support"));
        /* `provider_profile` is stored and not listed (ADR 0240), so the check
           that it survived the write goes to the record rather than the row. */
        let whole = transcription_history_record(filtered[0].id.clone())
            .expect("history record")
            .expect("the row names a record that exists");
        assert_eq!(whole.provider_profile.as_deref(), Some("local-base-quality"));
    }

    #[test]
    fn exports_filtered_history_entries_with_policy_metadata() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let export_path = test_history_path("export").with_file_name("history-export.json");
        let _ = std::fs::remove_file(&export_path);
        prepare_test_history_path("export");

        record_entry(RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Completed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: "groq".to_string(),
            model: Some("whisper-large-v3-turbo".to_string()),
            language: Some("de".to_string()),
            active_profile: Some("developer".to_string()),
            effective_mode: None,
            title: None,
            provider_profile: None,
            local_prompt_strength: None,
            local_prompt_carry: None,
            local_beam_size: None,
            local_best_of: None,
            raw_transcript: Some("eins".to_string()),
            transformed_transcript: Some("eins".to_string()),
            corrected: false,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: None,
            audio_path: None,
            capture_integrity: None,
            turnaround_ms: None,
            input_level: None,
            speech_seconds: None,
            capture_stop_reason: None,
        })
        .expect("first export history entry");
        record_entry(RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Completed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: "local".to_string(),
            model: Some("base".to_string()),
            language: Some("en".to_string()),
            active_profile: Some("support".to_string()),
            effective_mode: None,
            title: None,
            provider_profile: Some("local-base-fast".to_string()),
            local_prompt_strength: Some("profile".to_string()),
            local_prompt_carry: Some(false),
            local_beam_size: Some(1),
            local_best_of: Some(1),
            raw_transcript: Some("zwei".to_string()),
            transformed_transcript: Some("zwei".to_string()),
            corrected: false,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: None,
            audio_path: None,
            capture_integrity: None,
            turnaround_ms: None,
            input_level: None,
            speech_seconds: None,
            capture_stop_reason: None,
        })
        .expect("second export history entry");

        let response = export_transcription_history(ExportTranscriptionHistoryRequest {
            path: export_path.to_string_lossy().to_string(),
            query: TranscriptionHistoryQuery {
                provider: Some("groq".to_string()),
                ..TranscriptionHistoryQuery::default()
            },
        })
        .expect("export history response");

        let raw = std::fs::read_to_string(export_path).expect("read export file");
        let document: TranscriptionHistoryExportDocument =
            serde_json::from_str(&raw).expect("parse export document");

        assert_eq!(response.exported_count, 1);
        assert_eq!(document.count, 1);
        assert_eq!(document.history_retention_days, 90);
        assert_eq!(document.entries[0].provider, "groq");
    }

    #[test]
    fn prune_entries_drops_entries_past_the_retention_window() {
        let cutoff_reference = 10 * MS_PER_DAY;
        let mut entries = VecDeque::from(vec![
            TranscriptionHistoryEntry {
                capture_stop_reason: None,
                id: "old".to_string(),
                created_at_ms: cutoff_reference.saturating_sub(8 * MS_PER_DAY),
                status: TranscriptionHistoryStatus::Completed,
                source: TranscriptionHistorySource::NativePipeline,
                retry_of: None,
                provider: "groq".to_string(),
                model: None,
                language: None,
                spoken_language: None,
                active_profile: None,
                work_mode: None,
                effective_mode: None,
                title: None,
                transcript_path: None,
                provider_profile: None,
                local_prompt_strength: None,
                local_prompt_carry: None,
                local_beam_size: None,
                local_best_of: None,
                raw_transcript: Some("old".to_string()),
                transformed_transcript: Some("old".to_string()),
                corrected: false,
                applied_rules: Vec::new(),
                transform_warning: None,
                insert_mode: None,
                active_driver: None,
                pasted: None,
                fallback_available: None,
                fallback_reason: None,
                recovery_action: None,
                recovery_message: None,
                clipboard_restore: None,
                error: None,
                audio_path: None,
                fallback_acknowledged: false,
                capture_integrity: None,
                input_level: None,
                speech_seconds: None,
                turnaround_ms: None,
            },
            TranscriptionHistoryEntry {
                capture_stop_reason: None,
                id: "fresh-a".to_string(),
                created_at_ms: cutoff_reference.saturating_sub(MS_PER_DAY),
                status: TranscriptionHistoryStatus::Completed,
                source: TranscriptionHistorySource::NativePipeline,
                retry_of: None,
                provider: "groq".to_string(),
                model: None,
                language: None,
                spoken_language: None,
                active_profile: None,
                work_mode: None,
                effective_mode: None,
                title: None,
                transcript_path: None,
                provider_profile: None,
                local_prompt_strength: None,
                local_prompt_carry: None,
                local_beam_size: None,
                local_best_of: None,
                raw_transcript: Some("fresh-a".to_string()),
                transformed_transcript: Some("fresh-a".to_string()),
                corrected: false,
                applied_rules: Vec::new(),
                transform_warning: None,
                insert_mode: None,
                active_driver: None,
                pasted: None,
                fallback_available: None,
                fallback_reason: None,
                recovery_action: None,
                recovery_message: None,
                clipboard_restore: None,
                error: None,
                audio_path: None,
                fallback_acknowledged: false,
                capture_integrity: None,
                input_level: None,
                speech_seconds: None,
                turnaround_ms: None,
            },
            TranscriptionHistoryEntry {
                capture_stop_reason: None,
                id: "fresh-b".to_string(),
                created_at_ms: cutoff_reference,
                status: TranscriptionHistoryStatus::Completed,
                source: TranscriptionHistorySource::NativePipeline,
                retry_of: None,
                provider: "groq".to_string(),
                model: None,
                language: None,
                spoken_language: None,
                active_profile: None,
                work_mode: None,
                effective_mode: None,
                title: None,
                transcript_path: None,
                provider_profile: None,
                local_prompt_strength: None,
                local_prompt_carry: None,
                local_beam_size: None,
                local_best_of: None,
                raw_transcript: Some("fresh-b".to_string()),
                transformed_transcript: Some("fresh-b".to_string()),
                corrected: false,
                applied_rules: Vec::new(),
                transform_warning: None,
                insert_mode: None,
                active_driver: None,
                pasted: None,
                fallback_available: None,
                fallback_reason: None,
                recovery_action: None,
                recovery_message: None,
                clipboard_restore: None,
                error: None,
                audio_path: None,
                fallback_acknowledged: false,
                capture_integrity: None,
                input_level: None,
                speech_seconds: None,
                turnaround_ms: None,
            },
        ]);

        prune_entries(&mut entries, 3, cutoff_reference);

        /* AGE IS THE ONLY RULE LEFT (ADR 0241). This used to be called
           `..._before_limit_is_applied` and passed a limit of 1, so the second
           surviving record was cut by the count rather than kept by the
           retention window — which made the assertion below read as evidence for
           a rule it was not testing. */
        assert_eq!(entries.len(), 2, "a record inside the window was dropped");
        assert!(
            !entries.iter().any(|entry| entry.id == "old"),
            "the record past the window survived",
        );
        assert_eq!(entries[0].id, "fresh-a");
    }

    #[test]
    fn history_entry_preserves_insert_recovery_semantics() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("insert-recovery-semantics");

        let entry = history_entry_from_insert_result(
            &AppConfig::default(),
            None,
            Some("raw text".to_string()),
            NativeTransformResult {
                text: "final text".to_string(),
                corrected: false,
                applied_rules: vec!["removed_fillers".to_string()],
                warning: None,
            },
            &NativeInsertResult {
                ok: false,
                text: "final text".to_string(),
                insert_mode: NativeInsertMode::ClipboardFallback,
                active_driver: NativeInsertDriver::Arboard,
                clipboard_written: true,
                paste_attempted: true,
                pasted: false,
                scratchpad_entry: super::super::insertion::ScratchpadEntry {
                    id: "scratch-1".to_string(),
                    text: "final text".to_string(),
                    source: "native_insert".to_string(),
                    created_at_ms: 1,
                    corrected: false,
                    insert_mode: NativeInsertMode::ClipboardFallback,
                    active_driver: NativeInsertDriver::Arboard,
                    clipboard_written: true,
                    paste_attempted: true,
                    pasted: false,
                    fallback_reason: Some("xdotool failed".to_string()),
                    error: Some("xdotool failed".to_string()),
                    recovery_action: NativeInsertRecoveryAction::ManualPaste,
                    recovery_message: Some(
                        "Transcript is on the clipboard. Paste manually.".to_string(),
                    ),
                    clipboard_restore: NativeClipboardRestoreStatus::NotAttempted,
                },
                fallback_available: true,
                fallback_reason: Some("xdotool failed".to_string()),
                error: Some("xdotool failed".to_string()),
                recovery_action: NativeInsertRecoveryAction::ManualPaste,
                recovery_message: "Transcript is on the clipboard. Paste manually.".to_string(),
                clipboard_restore: NativeClipboardRestoreStatus::NotAttempted,
            },
            None,
            super::super::transcript_store::TranscriptNaming::default(),
            CaptureFacts::none(),
            None,
        )
        .expect("history entry from insert result");

        assert_eq!(
            entry.recovery_action,
            Some(NativeInsertRecoveryAction::ManualPaste)
        );
        assert_eq!(
            entry
                .work_mode
                .as_ref()
                .map(|work_mode| work_mode.rewrite_style.as_str()),
            Some("clean")
        );
        assert_eq!(
            entry.clipboard_restore,
            Some(NativeClipboardRestoreStatus::NotAttempted)
        );
        assert_eq!(
            entry.recovery_message.as_deref(),
            Some("Transcript is on the clipboard. Paste manually.")
        );
    }

    /// The worst capture in the 2026-08-03 measurement, as a verdict: 405.7 s
    /// on the clock, 194.3 s of audio.
    /// A microphone that never got near the speech threshold: the case the
    /// level exists to make visible, because the transcript it produces reads
    /// like any other.
    fn quiet_input() -> InputLevelSummary {
        InputLevelSummary::quiet_for_tests()
    }

    fn short_capture() -> CaptureIntegrity {
        CaptureIntegrity {
            wall_seconds: 405.7,
            recorded_seconds: 194.3,
            missing_ratio: 0.52,
            verdict: super::super::capture::CaptureIntegrityVerdict::Short,
        }
    }

    /// A helper shaped like the funnel's happy path, so the ADR 0074 tests read
    /// as "record something, then look at what else the record owns".
    fn completed_request(text: &str) -> RecordHistoryEntryRequest {
        RecordHistoryEntryRequest {
            status: TranscriptionHistoryStatus::Completed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: "groq".to_string(),
            model: Some("whisper-large-v3-turbo".to_string()),
            language: Some("de".to_string()),
            active_profile: Some("General writing".to_string()),
            effective_mode: Some(ProcessingMode::Cleanup),
            title: None,
            provider_profile: None,
            local_prompt_strength: None,
            local_prompt_carry: None,
            local_beam_size: None,
            local_best_of: None,
            raw_transcript: Some(format!("{text} uh")),
            transformed_transcript: Some(text.to_string()),
            corrected: true,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: Some(NativeInsertMode::DirectPaste),
            active_driver: None,
            pasted: Some(true),
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: None,
            audio_path: None,
            capture_integrity: None,
            turnaround_ms: None,
            input_level: None,
            speech_seconds: None,
            capture_stop_reason: None,
        }
    }

    /// ADR 0240. The list is a wire shape and the record is storage; a case that
    /// only checked the row would let the cut become a data loss silently.
    #[test]
    fn a_long_transcript_reaches_the_row_as_a_preview_and_the_record_whole() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("summary-preview");

        /* GERMAN, ON PURPOSE. It is most of this machine's corpus and every
           umlaut is two bytes, so a cut at a byte index inside one panics —
           `PREVIEW_CHARS` counts characters for exactly this reason. */
        let long = "Über Größen und Maße: ".repeat(40);
        assert!(long.chars().count() > PREVIEW_CHARS);
        let mut request = completed_request(&long);
        request.raw_transcript = Some(long.clone());
        let recorded = record_entry_with_work_mode(
            request,
            Some(TextProfileWorkMode {
                processing_mode: ProcessingMode::Cleanup,
                ..TextProfileWorkMode::default()
            }),
            None,
        )
        .expect("history entry");

        let row = transcription_history_summaries(None)
            .expect("history entries")
            .into_iter()
            .find(|entry| entry.id == recorded.id)
            .expect("the entry we just wrote");
        assert_eq!(row.heard_preview.chars().count(), PREVIEW_CHARS);
        assert!(long.starts_with(&row.heard_preview));
        assert!(row.transcripts_identical, "one text written twice");
        /* The whole profile work mode was 362 bytes a row and two surfaces read
           one field of it. */
        assert_eq!(row.processing_mode, Some(ProcessingMode::Cleanup));

        let whole = transcription_history_record(recorded.id.clone())
            .expect("history record")
            .expect("the row names a record that exists");
        assert_eq!(whole.raw_transcript.as_deref(), Some(long.as_str()));
    }

    /// A short one is not cut at all, and a row whose texts differ says so —
    /// the raw panel's *the AI stage rewrote it* hangs off that flag, and two
    /// cut strings could agree where the full ones do not.
    #[test]
    fn a_short_transcript_is_its_own_preview_and_a_rewrite_is_visible() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("summary-short");

        let recorded = record_entry(completed_request("Kurz und knapp.")).expect("history entry");

        let row = transcription_history_summaries(None)
            .expect("history entries")
            .into_iter()
            .find(|entry| entry.id == recorded.id)
            .expect("the entry we just wrote");
        assert_eq!(row.heard_preview, "Kurz und knapp. uh");
        assert_eq!(row.written_preview, "Kurz und knapp.");
        assert!(!row.transcripts_identical);
    }

    /// The record may be gone by the time a button on its row is pressed — the
    /// surface is stale, which is not a fault to report.
    #[test]
    fn a_record_the_store_does_not_hold_is_nothing_rather_than_an_error() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("summary-missing");

        let answer =
            transcription_history_record("history-0-0".to_string()).expect("no error either way");
        assert!(answer.is_none());
    }

    /// **THE MEASUREMENT H1 IS ACCEPTED ON** (ADR 0241), against ADR 0240's own.
    ///
    /// That record measured the write it replaced on a release build at four
    /// index sizes -- 4.8 ms at 1,000 records, 9.2 at 2,000, 24.9 at 5,000 and
    /// 59.4 at 10,000 -- and the curve is the reason `HISTORY_CEILING` existed.
    /// This runs both writes at the same four sizes in one pass, so the claim
    /// *the append does not depend on how many records are already there* is
    /// read off two columns rather than against a number from another day and
    /// another build.
    ///
    /// ```text
    /// cargo test --release measure_the_index_write_against_index_size -- --ignored --nocapture
    /// ```
    ///
    /// Debug figures are 15 to 20 times worse and are not what ships; run it
    /// released or do not quote it.
    #[test]
    #[ignore = "a measurement, not an assertion; run explicitly with --ignored"]
    fn measure_the_index_write_against_index_size() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        const SIZES: [usize; 4] = [1_000, 2_000, 5_000, 10_000];
        const RUNS: usize = 200;

        println!("\n=== The index write against index size (ADR 0241) ===");
        println!("{:>8}  {:>14}  {:>14}", "records", "append (ms)", "rewrite (ms)");

        for size in SIZES {
            let path = prepare_test_history_path("write-cost");

            /* A store of `size` records, built once and not through the funnel:
               what is being measured is the write, not the transcript file or
               the ledger beside it. */
            let mut entries: VecDeque<TranscriptionHistoryEntry> = VecDeque::with_capacity(size);
            for index in 0..size {
                let mut entry = sample_entry_for_mode(None, ProcessingMode::Auto);
                entry.id = format!("history-{index}-0");
                entry.created_at_ms = now_ms();
                entry.raw_transcript = Some("Ein Satz mittlerer Laenge, wie er hier steht.".repeat(3));
                entry.transformed_transcript = entry.raw_transcript.clone();
                entries.push_front(entry);
            }
            compact_journal(&entries).expect("the journal is written");

            let mut store = TranscriptionHistoryStore {
                loaded: true,
                entries,
                ops: size,
            };

            /* THE APPEND: one line at the end of a file of `size` lines. */
            let one = sample_entry_for_mode(None, ProcessingMode::Auto);
            let started = std::time::Instant::now();
            for _ in 0..RUNS {
                append_journal(&mut store, &[JournalWrite::Put(&one)]).expect("the append lands");
            }
            let append_ms = started.elapsed().as_secs_f64() * 1_000.0 / RUNS as f64;

            /* THE WRITE IT REPLACED: the whole set serialised and renamed into
               place, which is what every dictation used to cost. */
            let started = std::time::Instant::now();
            for _ in 0..RUNS {
                compact_journal(&store.entries).expect("the rewrite lands");
            }
            let rewrite_ms = started.elapsed().as_secs_f64() * 1_000.0 / RUNS as f64;

            println!("{size:>8}  {append_ms:>14.3}  {rewrite_ms:>14.3}");
            let _ = std::fs::remove_file(&path);
        }
        println!();
    }

    /// ADR 0241. A store over its ceiling on DEAD WEIGHT must not answer by
    /// deleting live history.
    #[test]
    fn a_journal_over_its_ceiling_on_slack_alone_is_compacted_and_loses_nothing() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let path = prepare_test_history_path("budget-slack");

        let kept = record_entry(completed_request("Bleibt.")).expect("history entry");
        for index in 0..40 {
            let entry =
                record_entry(completed_request(&format!("Geht wieder {index}."))).expect("entry");
            delete_transcription_history_entry(DeleteTranscriptionHistoryEntryRequest {
                id: entry.id,
            })
            .expect("the delete lands");
        }

        let fat = std::fs::metadata(&path).expect("the journal").len();
        let evicted = enforce_journal_ceiling(fat / 2, fat / 4);

        assert_eq!(evicted, 0, "live records were evicted to shed dead weight");
        let (entries, _ops) = load_history_entries();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries.front().map(|entry| entry.id.clone()), Some(kept.id));
    }

    /// And when the rewrite is not enough, the oldest go — never the newest.
    #[test]
    fn a_journal_still_over_its_ceiling_evicts_its_oldest_records() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let path = prepare_test_history_path("budget-evict");

        let oldest = record_entry(completed_request("Der aelteste Satz.")).expect("entry");
        for index in 0..19 {
            record_entry(completed_request(&format!("Satz Nummer {index}."))).expect("entry");
        }
        let newest = record_entry(completed_request("Der neueste Satz.")).expect("entry");

        let full = std::fs::metadata(&path).expect("the journal").len();
        let evicted = enforce_journal_ceiling(full / 2, full / 2);

        assert!(evicted > 0, "nothing was evicted from a store over its ceiling");
        assert!(
            std::fs::metadata(&path).expect("the journal").len() <= full / 2,
            "the journal is still over the target it was told to reach",
        );

        let (entries, _ops) = load_history_entries();
        assert!(
            entries.iter().any(|entry| entry.id == newest.id),
            "the newest record was evicted",
        );
        assert!(
            !entries.iter().any(|entry| entry.id == oldest.id),
            "the oldest record survived an eviction that took newer ones",
        );
    }

    /// The case every install is in, and stays in for about fifty years.
    #[test]
    fn a_journal_under_its_ceiling_loses_nothing() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("budget-under");

        record_entry(completed_request("Eins.")).expect("history entry");
        record_entry(completed_request("Zwei.")).expect("history entry");

        assert_eq!(
            enforce_journal_ceiling(super::super::storage_budget::STORAGE_CEILING_BYTES, 1),
            0,
        );
        let (entries, _ops) = load_history_entries();
        assert_eq!(entries.len(), 2);
    }

    /// ADR 0241. The dictation path appends and does not rewrite, which is what
    /// makes the write cost the same at every index size.
    #[test]
    fn a_dictation_appends_one_line_and_leaves_the_lines_before_it_alone() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let path = prepare_test_history_path("journal-append");

        let first = record_entry(completed_request("Eins.")).expect("history entry");
        let after_one = std::fs::read_to_string(&path).expect("the journal reads back");
        record_entry(completed_request("Zwei.")).expect("history entry");
        record_entry(completed_request("Drei.")).expect("history entry");

        let raw = std::fs::read_to_string(&path).expect("the journal reads back");
        let lines: Vec<&str> = raw.lines().collect();
        assert_eq!(lines.len(), 3, "one dictation is one line");
        assert!(
            raw.starts_with(&after_one),
            "the two later records were appended; the first line was rewritten",
        );
        assert!(
            !raw.contains("\n  "),
            "the journal is compact — pretty printing cost 16% of the file",
        );

        /* OLDEST FIRST IN THE FILE. The reader sees the newest at the top, and
           the append can only ever add at the bottom, so the two orders are
           opposites and the replay is where they meet. */
        let opening = serde_json::from_str::<JournalOp>(lines[0]).expect("a journal line");
        match opening {
            JournalOp::Put(entry) => assert_eq!(entry.id, first.id),
            JournalOp::Tombstone { .. } => panic!("a record was written as a tombstone"),
        }
    }

    /// The store's newest-first order survives a round trip through a file that
    /// only grows at the end.
    #[test]
    fn the_journal_replays_into_the_order_the_list_reads() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("journal-order");

        record_entry(completed_request("Eins.")).expect("history entry");
        record_entry(completed_request("Zwei.")).expect("history entry");
        let newest = record_entry(completed_request("Drei.")).expect("history entry");

        reset_store_for_tests();
        let (entries, ops) = load_history_entries();
        assert_eq!(ops, 3);
        assert_eq!(entries.front().map(|entry| entry.id.clone()), Some(newest.id));
    }

    /// A delete is one appended string, and the replay honours it.
    #[test]
    fn a_delete_appends_a_tombstone_rather_than_rewriting_the_set() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let path = prepare_test_history_path("journal-tombstone");

        let first = record_entry(completed_request("Eins.")).expect("history entry");
        record_entry(completed_request("Zwei.")).expect("history entry");

        delete_transcription_history_entry(DeleteTranscriptionHistoryEntryRequest {
            id: first.id.clone(),
        })
        .expect("the delete lands");

        let raw = std::fs::read_to_string(&path).expect("the journal reads back");
        assert_eq!(raw.lines().count(), 3, "two puts and a tombstone");

        reset_store_for_tests();
        let (entries, _ops) = load_history_entries();
        assert!(
            !entries.iter().any(|entry| entry.id == first.id),
            "the tombstoned record came back on replay",
        );
    }

    /// An edit is the record appended again, and it must not move.
    #[test]
    fn acknowledging_a_fallback_rewrites_the_record_in_place_on_replay() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("journal-edit");

        let oldest = record_entry(completed_request("Eins.")).expect("history entry");
        record_entry(completed_request("Zwei.")).expect("history entry");
        let newest = record_entry(completed_request("Drei.")).expect("history entry");

        acknowledge_transcription_fallback(AcknowledgeFallbackRequest {
            id: oldest.id.clone(),
        })
        .expect("the acknowledgement lands");

        reset_store_for_tests();
        let (entries, _ops) = load_history_entries();
        assert_eq!(
            entries.front().map(|entry| entry.id.clone()),
            Some(newest.id),
            "an edit on the oldest record moved it to the top of the list",
        );
        assert!(
            entries
                .iter()
                .find(|entry| entry.id == oldest.id)
                .expect("the edited record")
                .fallback_acknowledged,
            "the appended record did not supersede the one before it",
        );
    }

    /// ADR 0241 section 5. The one migration this record allows itself.
    #[test]
    fn the_array_this_index_used_to_be_is_read_once_and_then_deleted() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let path = prepare_test_history_path("journal-migration");
        let legacy = path.with_extension("json");

        let mut entry = sample_entry_for_mode(None, ProcessingMode::Auto);
        // Inside the retention window, or the conversion would correctly drop it
        // and the test would be measuring the prune instead of the migration.
        entry.created_at_ms = now_ms();
        std::fs::write(
            &legacy,
            serde_json::to_string(&vec![entry.clone()]).expect("the old shape serialises"),
        )
        .expect("the old index is written");

        reset_store_for_tests();
        let (entries, ops) = load_history_entries();

        assert_eq!(ops, 1);
        assert_eq!(entries.front().map(|held| held.id.clone()), Some(entry.id));
        assert!(path.is_file(), "the journal was not written");
        assert!(
            !legacy.exists(),
            "the converted array is deleted, or it would be converted again",
        );
    }

    /// An interrupted append leaves a partial last line. It costs that one
    /// record and never the file.
    #[test]
    fn a_torn_last_line_costs_one_record_and_not_the_index() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let path = prepare_test_history_path("journal-torn");

        let first = record_entry(completed_request("Eins.")).expect("history entry");
        record_entry(completed_request("Zwei.")).expect("history entry");

        let raw = std::fs::read_to_string(&path).expect("the journal reads back");
        let mut lines: Vec<&str> = raw.lines().collect();
        let torn = lines.pop().expect("a last line");
        let mut wounded = lines.join("\n");
        wounded.push('\n');
        wounded.push_str(&torn[..torn.len() / 2]);
        std::fs::write(&path, wounded).expect("the torn journal is written");

        reset_store_for_tests();
        let (entries, _ops) = load_history_entries();
        assert_eq!(entries.len(), 1, "the whole index went with the torn line");
        assert_eq!(entries.front().map(|entry| entry.id.clone()), Some(first.id));
    }

    /// ADR 0240's rename, on the write that still replaces the whole file.
    #[test]
    fn a_compaction_is_replaced_by_a_rename_and_leaves_no_scratch_file() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let path = prepare_test_history_path("journal-compaction");

        record_entry(completed_request("Eins.")).expect("history entry");
        clear_transcription_history_entries().expect("the clear lands");

        assert!(path.is_file());
        assert!(
            !path.with_extension("jsonl.tmp").exists(),
            "the scratch file is renamed away, not left beside the journal",
        );
        assert_eq!(
            std::fs::read_to_string(&path).expect("the journal reads back"),
            "",
            "clearing writes an empty journal, not a file of tombstones",
        );
    }

    /// The rewrite runs where it is allowed to and not on the dictation path.
    #[test]
    fn the_journal_is_rewritten_when_half_of_it_is_dead_weight() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let path = prepare_test_history_path("journal-slack");

        let kept = record_entry(completed_request("Bleibt.")).expect("history entry");
        /* Past the floor, and every one of them deleted again, so the file is
           almost entirely dead by the time the last tombstone lands. */
        for index in 0..JOURNAL_COMPACT_FLOOR {
            let entry =
                record_entry(completed_request(&format!("Geht wieder {index}."))).expect("entry");
            delete_transcription_history_entry(DeleteTranscriptionHistoryEntryRequest {
                id: entry.id,
            })
            .expect("the delete lands");
        }

        let lines = std::fs::read_to_string(&path)
            .expect("the journal reads back")
            .lines()
            .count();
        assert_eq!(lines, 1, "the journal kept its dead weight");

        reset_store_for_tests();
        let (entries, _ops) = load_history_entries();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries.front().map(|entry| entry.id.clone()), Some(kept.id));
    }

    #[test]
    fn a_recorded_transcript_is_also_a_file_and_the_entry_names_it() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("transcript-file");

        let entry = record_entry(completed_request("Der Beleg wird eine Datei."))
            .expect("history entry");

        let path = entry.transcript_path.clone().expect("a transcript path");
        let body = std::fs::read_to_string(&path).expect("the file");
        assert!(body.contains(&format!("id: {}", entry.id)));
        assert!(body.contains("Der Beleg wird eine Datei."));
        // The heard text differed, so it is kept under its own heading.
        assert!(body.contains("## Heard"));

        super::super::transcript_store::remove_transcript(&path);
    }

    /// A short capture's verdict has to survive the write, because reading it
    /// back off the record is the whole point: the runtime log rotates and the
    /// record is what is still there a week later (ADR 0079).
    #[test]
    fn a_short_capture_is_still_short_when_the_record_is_read_back() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("capture-integrity");

        let mut request = completed_request("Die Hälfte fehlt.");
        request.capture_integrity = Some(short_capture());
        let recorded = record_entry(request).expect("history entry");

        let read_back = transcription_history_summaries(None)
            .expect("history entries")
            .into_iter()
            .find(|entry| entry.id == recorded.id)
            .expect("the entry we just wrote");
        let integrity = read_back.capture_integrity.expect("a verdict on the record");

        assert!(integrity.is_short());
        assert!((integrity.missing_ratio - 0.52).abs() < 0.001);

        if let Some(path) = read_back.transcript_path.as_deref() {
            super::super::transcript_store::remove_transcript(path);
        }
    }

    /// An older record predates the measurement. It must read back as absent,
    /// never as a clean verdict somebody could mistake for evidence.
    #[test]
    fn a_record_written_before_the_measurement_carries_no_verdict() {
        let json = serde_json::json!({
            "id": "history-1",
            "created_at_ms": 1_786_000_000_000u64,
            "status": "completed",
            "source": "native_pipeline",
            "retry_of": null,
            "provider": "groq",
            "model": "whisper-large-v3",
            "language": null,
            "active_profile": "General writing",
            "raw_transcript": "Alles da.",
            "transformed_transcript": "Alles da.",
            "corrected": true,
            "applied_rules": [],
            "transform_warning": null,
            "insert_mode": null,
            "active_driver": null,
            "pasted": null,
            "fallback_available": null,
            "fallback_reason": null,
            "recovery_action": null,
            "recovery_message": null,
            "clipboard_restore": null,
            "error": null,
            "provider_profile": null,
            "local_prompt_strength": null,
            "local_prompt_carry": null,
            "local_beam_size": null,
            "local_best_of": null,
        });

        let entry: TranscriptionHistoryEntry =
            serde_json::from_value(json).expect("a pre-ADR-0079 record");

        assert!(entry.capture_integrity.is_none());
        assert!(entry.input_level.is_none());
    }

    /// The input level has to survive the write for the same reason the verdict
    /// does: it is read weeks later, against a transcript nobody can ask what
    /// the microphone was doing.
    #[test]
    fn the_input_level_is_still_on_the_record_when_it_is_read_back() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("input-level");

        let mut request = completed_request("Das Mikrofon war leise.");
        request.input_level = Some(quiet_input());
        let recorded = record_entry(request).expect("history entry");

        /* Stored, not listed (ADR 0240): the microphone levels are 161 bytes a
           row and the frontend has never read one off a history entry. */
        let read_back = transcription_history_record(recorded.id.clone())
            .expect("history record")
            .expect("the entry we just wrote");
        let level = read_back.input_level.expect("a level on the record");

        assert!((level.rms_dbfs - quiet_input().rms_dbfs).abs() < 0.001);
        assert!((level.peak_dbfs - quiet_input().peak_dbfs).abs() < 0.001);
        assert!(level.rms_dbfs < level.voice_threshold_dbfs);

        if let Some(path) = read_back.transcript_path.as_deref() {
            super::super::transcript_store::remove_transcript(path);
        }
    }

    /// A retry re-transcribes an earlier session's audio and makes no capture
    /// of its own. Copying the level forward would attribute a microphone
    /// measurement to a run that never touched a microphone — the same argument
    /// ADR 0079 makes for the verdict.
    #[test]
    fn a_retry_carries_neither_a_verdict_nor_a_level() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("retry-carries-nothing");

        let mut request = completed_request("Noch einmal.");
        request.source = TranscriptionHistorySource::Retry;
        request.capture_integrity = None;
        request.input_level = None;
        let entry = record_entry(request).expect("history entry");

        assert!(entry.capture_integrity.is_none());
        assert!(entry.input_level.is_none());

        if let Some(path) = entry.transcript_path.as_deref() {
            super::super::transcript_store::remove_transcript(path);
        }
    }

    /// The `Empty` and `Failed` paths reach the same funnel and must not leave
    /// an empty document behind (ADR 0074).
    #[test]
    fn a_record_without_text_names_no_file() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("transcript-file-empty");

        let mut request = completed_request("ignored");
        request.status = TranscriptionHistoryStatus::Empty;
        request.transformed_transcript = None;

        let entry = record_entry(request).expect("history entry");
        assert_eq!(entry.transcript_path, None);
    }

    #[test]
    fn deleting_a_record_deletes_the_file_it_named() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("transcript-file-delete");

        let entry = record_entry(completed_request("Wird wieder geloescht."))
            .expect("history entry");
        let path = entry.transcript_path.clone().expect("a transcript path");
        assert!(PathBuf::from(&path).exists());

        delete_transcription_history_entry(DeleteTranscriptionHistoryEntryRequest {
            id: entry.id.clone(),
        })
        .expect("delete");

        assert!(!PathBuf::from(&path).exists(), "the file outlived its record");
    }

    #[test]
    fn clearing_the_history_clears_the_files_with_it() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        prepare_test_history_path("transcript-file-clear");

        let first = record_entry(completed_request("Erster Satz.")).expect("first");
        let second = record_entry(completed_request("Zweiter Satz.")).expect("second");
        let paths: Vec<String> = [first, second]
            .iter()
            .filter_map(|entry| entry.transcript_path.clone())
            .collect();
        assert_eq!(paths.len(), 2);

        clear_transcription_history_entries().expect("clear");

        for path in paths {
            assert!(!PathBuf::from(&path).exists(), "{path} outlived the clear");
        }
    }

    /// ADR 0237 reverses what this test used to assert. The index prune is
    /// housekeeping over a list swept by a retention rule in months; the file is
    /// the reader's writing and outlives it. Every intentional delete still
    /// takes the file — the two tests above this one are those, and they are the
    /// reason this one is a decision rather than an oversight.
    ///
    /// **IT USED TO PUSH A RECORD OUT WITH THE COUNT CAP** (ADR 0241 deleted
    /// it), which was the easy way to make something drop and was also the wrong
    /// rule to be testing: what sweeps this index is age. The record is aged in
    /// the journal instead, which is the only way to have one older than the
    /// process that wrote it.
    #[test]
    fn retention_drops_the_entry_and_leaves_its_file_alone() {
        let _guard = test_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let path = prepare_test_history_path("transcript-file-retention");
        set_history_policy_override_for_tests(30);

        let first = record_entry(completed_request("Faellt aus der Aufbewahrung.")).expect("first");
        let dropped = first.transcript_path.clone().expect("a transcript path");
        let second = record_entry(completed_request("Bleibt.")).expect("second");
        let kept = second.transcript_path.clone().expect("a transcript path");

        /* AGE THE FIRST RECORD IN THE FILE. `record_entry` stamps `now`, so
           nothing written through the funnel can be old enough for a retention
           rule to reach; rewriting the line is what a machine that has been
           running for two months has, and the replay is what reads it. */
        let raw = std::fs::read_to_string(&path).expect("the journal reads back");
        let aged: Vec<String> = raw
            .lines()
            .map(|line| {
                let mut op: serde_json::Value =
                    serde_json::from_str(line).expect("a journal line");
                if op["put"]["id"] == serde_json::json!(first.id) {
                    op["put"]["created_at_ms"] =
                        serde_json::json!(now_ms() - 60 * MS_PER_DAY);
                }
                serde_json::to_string(&op).expect("the line serialises")
            })
            .collect();
        std::fs::write(&path, format!("{}\n", aged.join("\n"))).expect("the aged journal");

        reset_store_for_tests();
        let (indexed, _ops) = load_history_entries();

        assert!(
            !indexed.iter().any(|entry| entry.id == first.id),
            "the record outlived a retention window it is twice as old as",
        );
        assert!(
            indexed.iter().any(|entry| entry.id == second.id),
            "the prune took a record inside the window with it",
        );
        assert!(
            PathBuf::from(&dropped).exists(),
            "the index prune deleted a transcript the reader still owns",
        );

        super::super::transcript_store::remove_transcript(&dropped);
        super::super::transcript_store::remove_transcript(&kept);
    }

    /// ADR 0075's precedence, and the reason the field exists: an `Auto` record
    /// carries `auto` in its work mode and the concrete mode nowhere else.
    #[test]
    fn a_retry_runs_what_the_record_ran() {
        let mut entry = sample_entry_for_mode(Some(ProcessingMode::Translate), ProcessingMode::Auto);
        let config = AppConfig::default();
        assert_eq!(resolve_retry_mode(&entry, &config), ProcessingMode::Translate);

        // No `effective_mode` — an entry older than the field falls back to the
        // profile's stored mode.
        entry.effective_mode = None;
        entry.work_mode = Some(TextProfileWorkMode {
            processing_mode: ProcessingMode::Agent,
            ..TextProfileWorkMode::default()
        });
        assert_eq!(resolve_retry_mode(&entry, &config), ProcessingMode::Agent);
    }

    #[test]
    fn a_retry_of_an_auto_record_resolves_auto_rather_than_repeating_it() {
        let entry = sample_entry_for_mode(None, ProcessingMode::Auto);
        let resolved = resolve_retry_mode(&entry, &AppConfig::default());
        assert!(!resolved.is_auto(), "Auto reached the transform");
    }

    // ── What a retry names, and why it depends on which retry ran (ADR 0205) ──

    /// A machine whose active profile listens on Groq's turbo model, so a
    /// record that names anything else on it names something that did not run
    /// here.
    fn config_listening_on_turbo() -> AppConfig {
        use super::super::config::{ProfileSpeechSettings, TextProfile};

        AppConfig {
            model: "whisper-large-v3".to_string(),
            active_text_profile_id: "founder-ops".to_string(),
            text_profiles: vec![TextProfile {
                id: "founder-ops".to_string(),
                speech: Some(ProfileSpeechSettings {
                    model: "whisper-large-v3-turbo".to_string(),
                    ..Default::default()
                }),
                ..TextProfile::default()
            }],
            ..AppConfig::default()
        }
    }

    fn record_from_another_lane() -> TranscriptionHistoryEntry {
        let mut entry = sample_entry_for_mode(Some(ProcessingMode::Cleanup), ProcessingMode::Cleanup);
        entry.provider = "local".to_string();
        entry.model = Some("large-v3-q5_0".to_string());
        entry.provider_profile = Some("local-large-quality".to_string());
        entry.local_prompt_strength = Some("profile".to_string());
        entry.local_prompt_carry = Some(true);
        entry.local_beam_size = Some(5);
        entry.local_best_of = Some(5);
        entry
    }

    /// **A transform-only retry sends no audio anywhere**, so the record it
    /// writes describes the recogniser that produced the transcript it re-ran —
    /// which is the retried record's, whatever this machine is set to now.
    #[test]
    fn a_transform_only_retry_names_the_recogniser_that_produced_the_transcript() {
        let retried = record_from_another_lane();
        let config = config_listening_on_turbo();

        let attribution =
            SpeechAttribution::for_retry(&config, Some(&RetryOrigin::Transformed(&retried)));

        assert_eq!(attribution.provider, "local");
        assert_eq!(attribution.model.as_deref(), Some("large-v3-q5_0"));
        // The decode settings are the same claim about the same request, so
        // they travel with it rather than being re-read off a config that was
        // not asked anything.
        assert_eq!(
            attribution.local.provider_profile.as_deref(),
            Some("local-large-quality"),
        );
        assert_eq!(attribution.local.local_beam_size, Some(5));
        assert_eq!(attribution.local.local_best_of, Some(5));
    }

    /// **A retry without a transcript re-transcribes the kept capture**, and it
    /// does so through the current config on purpose — the retry usually
    /// happens because a setting was changed. A recogniser ran, so the record
    /// names it.
    #[test]
    fn a_retry_that_sent_the_audio_again_names_this_machines_recogniser() {
        let retried = record_from_another_lane();
        let config = config_listening_on_turbo();

        let attribution =
            SpeechAttribution::for_retry(&config, Some(&RetryOrigin::Retranscribed(&retried)));

        assert_eq!(attribution.provider, "groq");
        assert_eq!(attribution.model.as_deref(), Some("whisper-large-v3-turbo"));
        // Not the retried record's local decode block: nothing local ran.
        assert_eq!(attribution.local.provider_profile, None);
        assert_eq!(attribution.local.local_beam_size, None);
    }

    /// A record that names no recogniser cannot lend one, and the retry does
    /// not fill the gap with this machine's answer.
    #[test]
    fn a_retried_record_with_no_model_lends_no_model() {
        let mut retried = record_from_another_lane();
        retried.model = None;

        let attribution = SpeechAttribution::for_retry(
            &config_listening_on_turbo(),
            Some(&RetryOrigin::Transformed(&retried)),
        );

        assert_eq!(attribution.model, None);
    }

    /// **A retry corrects on the model the session would have** (ADR 0206).
    /// The retry builder read the connection-wide fields while the capture read
    /// the profile's, so a profile with a correction model of its own was
    /// retried on a different one — silently, because the two agree on a
    /// machine that never set one.
    #[test]
    fn a_retry_carries_the_same_correction_models_the_capture_does() {
        use super::super::config::{ProfileSpeechSettings, TextProfile};

        let config = AppConfig {
            correction_model: "the-connections-choice".to_string(),
            local_correction_model: "the-connections-local-choice".to_string(),
            active_text_profile_id: "founder-ops".to_string(),
            text_profiles: vec![TextProfile {
                id: "founder-ops".to_string(),
                speech: Some(ProfileSpeechSettings {
                    correction_model: "the-profiles-choice".to_string(),
                    local_correction_model: "the-profiles-local-choice".to_string(),
                    ..Default::default()
                }),
                ..TextProfile::default()
            }],
            ..AppConfig::default()
        };

        let live = super::super::capture::NativeCaptureConfig::from_app_config(config.clone());
        let retried = transform_config_from_app_config(&config);

        assert_eq!(retried.correction_model, "the-profiles-choice");
        assert_eq!(retried.correction_model, live.correction_model);
        assert_eq!(retried.local_correction_model, live.local_correction_model);
    }

    /// The live paths are unchanged by all of this: no origin, this machine's
    /// profile.
    #[test]
    fn a_session_of_its_own_names_the_profile_that_ran_it() {
        let attribution = SpeechAttribution::for_retry(&config_listening_on_turbo(), None);

        assert_eq!(attribution.provider, "groq");
        assert_eq!(attribution.model.as_deref(), Some("whisper-large-v3-turbo"));
    }

    fn sample_entry_for_mode(
        effective_mode: Option<ProcessingMode>,
        stored: ProcessingMode,
    ) -> TranscriptionHistoryEntry {
        TranscriptionHistoryEntry {
            capture_stop_reason: None,
            id: "history-1-0".to_string(),
            created_at_ms: 1,
            status: TranscriptionHistoryStatus::Completed,
            source: TranscriptionHistorySource::NativePipeline,
            retry_of: None,
            provider: "groq".to_string(),
            model: None,
            language: None,
            spoken_language: None,
            active_profile: None,
            work_mode: Some(TextProfileWorkMode {
                processing_mode: stored,
                ..TextProfileWorkMode::default()
            }),
            effective_mode,
            title: None,
            transcript_path: None,
            provider_profile: None,
            local_prompt_strength: None,
            local_prompt_carry: None,
            local_beam_size: None,
            local_best_of: None,
            raw_transcript: Some("Bitte den Absatz aufraeumen.".to_string()),
            transformed_transcript: None,
            corrected: false,
            applied_rules: Vec::new(),
            transform_warning: None,
            insert_mode: None,
            active_driver: None,
            pasted: None,
            fallback_available: None,
            fallback_reason: None,
            recovery_action: None,
            recovery_message: None,
            clipboard_restore: None,
            error: None,
            audio_path: None,
            fallback_acknowledged: false,
            capture_integrity: None,
            input_level: None,
            speech_seconds: None,
            turnaround_ms: None,
        }
    }
}
