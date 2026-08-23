//! THE ONE THING HISTORY CANNOT BE: A RECORD THAT DOES NOT FORGET.
//!
//! The index is pruned on every read, by age (`history_retention_days`) — and
//! until ADR 0241 by a record count as well. That is correct for what it is: a
//! list of records you can open, retry and delete. It is also why nothing built
//! on top of it can be lifetime-scoped, and deleting the count did not change
//! that one bit — a total summed from a list swept by AGE still runs BACKWARDS
//! the day the oldest records pass the window. A counter that goes down is a
//! counter nobody believes again.
//!
//! So the all-time figures do not come from history. They come from here.
//!
//! WHAT THIS STORES, AND WHY IT IS SMALL ENOUGH TO KEEP FOREVER. One row per
//! DAY, holding counts and durations — never text, never a transcript, never
//! which application was in front. A year is 365 rows of a dozen numbers. That
//! is the whole reason a ledger can promise what a record index cannot: it is an
//! aggregate, so keeping it costs nothing and it gives up nothing about what was
//! said. The one thing here that is not a duration or a count is a LANGUAGE TAG,
//! which is two letters and a tally — see `languages`.
//!
//! IT IS WRITTEN WHERE A RECORD COMES INTO EXISTENCE, which is
//! `history::record_entry_with_work_mode` and nowhere else — the same funnel
//! ADR 0074 put the transcript file on, for the same reason. Every path arrives
//! there: the native pipeline, an empty result, an insert failure, a
//! transcription failure and a retry.
//!
//! A RETRY IS NOT A DICTATION AND IS NOT COUNTED. It re-runs a transform over
//! text that was already spoken and already counted; counting it again would
//! inflate every all-time figure by however often somebody pressed Retry, which
//! is a number that has nothing to do with how much they dictate.
//!
//! NOTHING HERE EVER GOES DOWN, AND THAT IS ENFORCED BY THE SHAPE RATHER THAN BY
//! CARE (ADR 0176). Day rows still age out past `LEDGER_DAY_ROWS` — a file
//! on a machine somebody keeps for a decade may not grow without bound — but a
//! row that ages out is folded into its MONTH on the way out, and the month tier
//! is never pruned (ADR 0243). `totals()` is the months plus the days still
//! held, so it is monotone by construction: there is no sequence of writes,
//! prunes or restarts that can make it smaller. Deleting history does not touch
//! this file, and neither does deleting a single transcript. The one door that
//! lowers these figures is the reset in Privacy & Data, which is a button a
//! person presses on purpose.
//!
//! **AND NOTHING HERE IS EVER OPAQUE** (ADR 0244). There was a third tier — one
//! `retired` row that swallowed an aged-out day's shape and kept only its
//! figures — and it existed because pruning used to destroy that shape. The
//! month tier removed the reason, so the blob, its stamp and the schema
//! migrations that filled it were deleted rather than maintained: this product
//! has never shipped a release build, so no installation anywhere holds a file
//! they could convert.
//!
//! THE FIRST DAY IT SAW IS THE INSTALL DATE, as far as anything can honestly
//! say. Nothing in this product recorded when it was installed, so `started_on`
//! is the day this ledger first wrote a row — and unlike the pre-0176 build it
//! now SURVIVES the prune, because the month rows still speak for the days
//! behind it. What may not span that far is the CALENDAR, which draws day rows
//! and therefore draws only what `days` still holds (ADR 0172).

use std::{
    collections::BTreeMap,
    path::PathBuf,
    sync::{Mutex, OnceLock},
};

use serde::{Deserialize, Serialize};

use super::paths::user_data_dir;

/// How many DAY rows are kept. Two years and a bit: long enough that the
/// calendar — which draws a year at a time and is the only surface that needs
/// day resolution — can always reach the year before the one it is showing.
///
/// A row that ages out is folded into its MONTH on the way out (ADR 0243), so
/// this horizon bounds one tier's resolution and never the figures and never
/// the reach. Before 0243 it also bounded the reach: an aged-out day went into
/// one opaque total, which is why the *Years* tab could never hold more than
/// three buckets on an installation of any age.
const LEDGER_DAY_ROWS: i64 = 800;

/// What the derived counts in this file mean. See `LEDGER_SCHEMA`.
///
/// The turnaround shape a PERIOD carries, as opposed to the all-time one
/// (ADR 0243). Quarter-octave buckets from 25 ms: bucket `i` opens at
/// `25 × 2^(i/4)` milliseconds, so forty of them reach 25.6 seconds and the
/// forty-first is everything above.
///
/// WHY NOT THE FINE AXIS, WHICH ALREADY EXISTS. `turnaround_buckets` is 400
/// counters at 25 ms; on a day row that is twelve kilobytes a year of mostly
/// zeroes, which is the one thing a file kept forever may not be. Why not the
/// five bands the screen draws: the band EDGES are chosen per lane from three
/// sets at read time, so storing them would freeze a choice the display makes
/// after the fact. A log axis is band-set agnostic — any edge is a sum of
/// buckets plus at most one interpolated bucket — and its error is bounded by
/// one bucket's own width.
const TURNAROUND_LOG_BUCKETS: usize = 41;
const TURNAROUND_LOG_BASE_MS: f64 = 25.0;
/// Four buckets per doubling. Quarter-octave, so a bucket spans 19% of its own
/// lower edge and a median read off it is within that.
const TURNAROUND_LOG_PER_OCTAVE: f64 = 4.0;

/// The reserved cause key everything past `MAX_CAUSE_KEYS` is counted under
/// (ADR 0243).
///
/// IT CANNOT COLLIDE WITH A REAL ONE. Every real key is `format!("{provider}/{model}")`
/// and therefore contains a slash; this one does not.
const OTHER_CAUSE_KEY: &str = "other";

/// What the derived counts in this file mean. Bumped when a histogram changes
/// its DEFINITION rather than its width — which the width guard below cannot
/// see, because the axis is unchanged and the numbers are still plausible.
///
/// **2**: `rate_buckets` stopped being throughput over the open microphone and
/// became the speaking rate, over speech seconds with the thinking pauses taken
/// out (ADR 0177). The two differ by tens of words a minute, so mixing runs
/// counted under both would produce exactly the plausible wrong number this
/// module exists to avoid. On the bump the histogram is emptied and it is NOT
/// re-seeded: history holds no speech clock, so the old records cannot answer
/// the new question, and a tile with no reading is dark rather than wrong.
///
/// **3**: the month tier, the per-period accumulators and `measured_from`
/// (ADR 0243). **Nothing is discarded on this bump.** Every structure schema 2
/// wrote means exactly what it meant, and the new ones start empty and fill
/// forward — which is what `measured_from` exists to state, so no chart draws a
/// zero for a period that predates a field.
const LEDGER_SCHEMA: u32 = 3;

/// The rate histogram: four hundred buckets of one word a minute, 0 to 400.
///
/// WHY A HISTOGRAM AND NOT A LIST OF RATES. The tile wants a MEDIAN, and a
/// median needs the distribution rather than a running total — but keeping every
/// run's rate forever would make this file grow with use, which is the one thing
/// a ledger must not do. Four hundred counters is a fixed cost that answers the
/// same question to within half a bucket.
///
/// ONE wpm per bucket, because the tile draws a whole number: at this width the
/// median is exact at the resolution anybody reads it, and a wider bucket would
/// quantise a true 200 into a displayed 203. Four hundred counters is about a
/// kilobyte of JSON and it never grows.
const RATE_BUCKET_WPM: f64 = 1.0;
const RATE_BUCKETS: usize = 400;

/// The turnaround histogram: four hundred buckets of twenty-five milliseconds,
/// 0 to 10 seconds. Same fixed-cost trick as the rate histogram and the same
/// reason — a median needs a distribution, and a list of every run would make
/// the file grow with use.
///
/// Twenty-five milliseconds because nobody perceives a finer difference in a
/// wait, and ten seconds because a turnaround past that is a failure rather than
/// a measurement.
const TURNAROUND_BUCKET_MS: f64 = 25.0;
const TURNAROUND_BUCKETS: usize = 400;

/// How many `provider/model` pairs the cause histogram will hold (ADR 0240).
///
/// A BOUND BECAUSE THE KEY COMES FROM THE WIRE. Every other structure in this
/// file is fixed-width or keyed by something with a small closed range — a day,
/// a language code, a bucket index. This one is keyed by whatever a provider
/// called its model, so a vendor that renames on every release, or a reader
/// working through a local model library, would grow the file without limit.
/// Sixty-four is far above any real machine — the reporting one has three — and
/// far below a size that matters. Past it, known pairs keep counting and a new
/// one is dropped rather than evicting somebody else's history.
const MAX_CAUSE_KEYS: usize = 64;

/// One day, as counts. Everything here is summable and nothing here is text.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct LedgerDay {
    /// Dictations that produced words. Retries are excluded — see the module
    /// note.
    #[serde(default)]
    pub dictations: u64,
    /// Words DELIVERED — the transformed text, which is what reached the cursor.
    #[serde(default)]
    pub words: u64,
    /// Words SPOKEN — the recogniser's own output, before any mode transform ran
    /// over it (ADR 0177).
    ///
    /// The two differ by a few percent under Cleanup, which removes filler, and
    /// by an order of magnitude under Agent and Prompt Enhance, where a model
    /// writes two hundred words from fifteen spoken ones. Anything claiming to
    /// be a SPEAKING rate has to divide this one, or it reports how verbose the
    /// model is.
    #[serde(default)]
    pub spoken_words: u64,
    /// Summed `capture_integrity.recorded_seconds`, over the runs that carried a
    /// clock. It is the OPEN MICROPHONE and not the speech: the window runs from
    /// starting the capture to ending it, so a thinking pause is inside it.
    ///
    /// This is the right denominator for what a dictation COST you — the pause
    /// was your time too — and the wrong one for how fast you speak.
    #[serde(default)]
    pub recorded_seconds: f64,
    /// The same window with the thinking pauses taken out (ADR 0177), summed
    /// over the runs that measured it. Always `<= recorded_seconds`.
    #[serde(default)]
    pub speech_seconds: f64,
    /// How many of the day's dictations carried the capture clock at all.
    /// Without it a rate would divide real words by a denominator that silently
    /// skipped the runs which never measured themselves.
    #[serde(default)]
    pub timed: u64,
    /// How many of them carried the SPEECH clock, which is the newer of the two
    /// and absent on every record written before ADR 0177.
    #[serde(default)]
    pub voiced: u64,
    /// The three fields time saved is computed from, and they are kept as their
    /// own group rather than derived from the ones above for one reason: a
    /// figure whose numerator and denominator come from different sets of runs
    /// is wrong in a way nobody can see (ADR 0178).
    ///
    /// A run is credited when it carried a capture clock AND its mode did not
    /// GENERATE text. Agent and Prompt Enhance write prose nobody dictated and
    /// nobody would have typed either; crediting their output against a typing
    /// baseline invents time that was never saved.
    #[serde(default)]
    pub saved_runs: u64,
    /// Delivered words of the credited runs.
    #[serde(default)]
    pub saved_words: u64,
    /// `recorded_seconds` of exactly those runs — the open microphone, because
    /// that is what the dictation actually cost.
    #[serde(default)]
    pub saved_seconds: f64,
    #[serde(default)]
    pub longest_seconds: f64,
    /// How many of the period's dictations carried a turnaround clock, and the
    /// sum of what they cost (ADR 0243). Two numbers give the period an EXACT
    /// mean; the shape below gives it a median.
    #[serde(default, skip_serializing_if = "is_zero_u64")]
    pub turnaround_runs: u64,
    #[serde(default, skip_serializing_if = "is_zero_u64")]
    pub turnaround_ms_sum: u64,
    /// The period's wait distribution on the quarter-octave axis — see
    /// `TURNAROUND_LOG_BUCKETS`. Empty where the period counted none.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub turnaround_log: Vec<u32>,
    /// How many of the period's dictations came back in each language, keyed by
    /// the two-letter code. The all-time map one level up answers *which
    /// languages*; this answers *when* (ADR 0243).
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub languages: BTreeMap<String, u64>,
    /// Dictations whose language was ASKED FOR and came back empty — the text
    /// was too short for the detector to be sure of.
    ///
    /// THE OTHER HALF OF *NOT NAMED* IS DERIVED AND NOT STORED, and that is the
    /// whole point of splitting it (ADR 0243). Every dictation counted since the
    /// verdict existed increments either a language or this, so
    /// `dictations - languages - refused` is exactly the count of runs nothing
    /// ever asked about. Storing it as well would be a second copy of a fact the
    /// row already carries, and one that could disagree with itself after an
    /// import raised the parts and the whole separately.
    #[serde(default, skip_serializing_if = "is_zero_u64")]
    pub language_refused: u64,
}

/// `#[serde(skip_serializing_if)]` on the fields ADR 0243 added, and on those
/// only.
///
/// THE ELEVEN OLDER FIELDS KEEP WRITING THEIR ZEROES, deliberately: they are
/// present in every file this product has ever written, and making them
/// conditional would change what an existing row looks like on disk for no
/// reading's benefit. The new ones are absent far more often than not — a day
/// with no dictation in a given language is the normal case — and a row that
/// writes six empty structures is the file growing to say nothing.
fn is_zero_u64(value: &u64) -> bool {
    *value == 0
}

impl LedgerDay {
    /// Fold another day into this one. Sums everything summable and keeps the
    /// longest of what is a maximum.
    fn absorb(&mut self, other: &LedgerDay) {
        self.dictations += other.dictations;
        self.words += other.words;
        self.spoken_words += other.spoken_words;
        self.recorded_seconds += other.recorded_seconds;
        self.speech_seconds += other.speech_seconds;
        self.timed += other.timed;
        self.voiced += other.voiced;
        self.saved_runs += other.saved_runs;
        self.saved_words += other.saved_words;
        self.saved_seconds += other.saved_seconds;
        self.longest_seconds = self.longest_seconds.max(other.longest_seconds);
        /* THE ACCUMULATORS ADR 0243 ADDED, AND THEY ARE HERE BECAUSE THEY ARE
           MERGEABLE — which is the rule that lets a day become a month and a
           month a year without the reading losing its meaning. A counter adds, a
           histogram adds bucket by bucket, a tally adds key by key. Anything
           that cannot be folded this way does not belong in a row. */
        self.turnaround_runs += other.turnaround_runs;
        self.turnaround_ms_sum += other.turnaround_ms_sum;
        absorb_buckets(&mut self.turnaround_log, &other.turnaround_log, TURNAROUND_LOG_BUCKETS);
        for (code, count) in &other.languages {
            *self.languages.entry(code.clone()).or_insert(0) += *count;
        }
        self.language_refused += other.language_refused;
    }

    /// The larger of two rows, field by field.
    ///
    /// WHAT A MERGE MAY NOT DO IS ADD (ADR 0179). An import whose archive came
    /// off this same machine — the ordinary case, because the ordinary reason to
    /// import is a restore — would double every day it shares if the merge
    /// summed. Field-wise maximum is idempotent, so restoring the same archive
    /// twice changes nothing, and it is monotone, so a restore can only ever
    /// raise a figure. What it cannot do is combine two machines' disjoint work
    /// into one sum, and that is the deliberate trade: silently doubling a
    /// lifetime total is a worse failure than under-reporting a case nobody has.
    fn raise_to(&mut self, other: &LedgerDay) {
        self.dictations = self.dictations.max(other.dictations);
        self.words = self.words.max(other.words);
        self.spoken_words = self.spoken_words.max(other.spoken_words);
        self.recorded_seconds = self.recorded_seconds.max(other.recorded_seconds);
        self.speech_seconds = self.speech_seconds.max(other.speech_seconds);
        self.timed = self.timed.max(other.timed);
        self.voiced = self.voiced.max(other.voiced);
        self.saved_runs = self.saved_runs.max(other.saved_runs);
        self.saved_words = self.saved_words.max(other.saved_words);
        self.saved_seconds = self.saved_seconds.max(other.saved_seconds);
        self.longest_seconds = self.longest_seconds.max(other.longest_seconds);
        self.turnaround_runs = self.turnaround_runs.max(other.turnaround_runs);
        self.turnaround_ms_sum = self.turnaround_ms_sum.max(other.turnaround_ms_sum);
        raise_buckets(&mut self.turnaround_log, &other.turnaround_log, TURNAROUND_LOG_BUCKETS);
        for (code, count) in &other.languages {
            let own = self.languages.entry(code.clone()).or_insert(0);
            *own = (*own).max(*count);
        }
        self.language_refused = self.language_refused.max(other.language_refused);
    }

    /// The period's middle wait, off the quarter-octave axis (ADR 0243).
    ///
    /// `None` where the period timed nothing — which is not a zero, and every
    /// surface that draws this has to keep the two apart (ADR 0172).
    pub fn median_turnaround_ms(&self) -> Option<f64> {
        median_of_log(&self.turnaround_log)
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ActivityLedger {
    /// What the derived counts in this file mean — see `LEDGER_SCHEMA`.
    #[serde(default)]
    pub schema: u32,
    /// `YYYY-MM-DD` of the first row ever written. It survives the prune because
    /// the month rows still speak for the days behind it.
    ///
    /// IT IS NOT THE INSTALL DATE AND THIS NOTE USED TO SAY IT WAS. It is the
    /// first day somebody DICTATED, which on a machine installed in March and
    /// first used in August is five months late — see `installed_on`.
    #[serde(default)]
    pub started_on: Option<String>,
    /// `YYYY-MM-DD` of the day this reader first installed WordScript
    /// (ADR 0190).
    ///
    /// IT LIVES HERE AND NOT IN `AppConfig`, and that is the load-bearing
    /// choice. The ledger travels in `BackupArchive` and is the one part of an
    /// archive that is MERGED rather than replaced (ADR 0179); the config is
    /// replaced wholesale on an import, so a field there would be overwritten by
    /// the exporting machine's on every restore and then be a claim about
    /// somebody else's install.
    ///
    /// EARLIEST WINS ACROSS MACHINES, AND THE FIELD MEANS WHAT THAT MAKES IT
    /// MEAN. `raise_to` takes the earlier of two, so importing an archive from
    /// an older machine moves this date BACK — which is correct for *when you
    /// first installed WordScript* and wrong for *when this machine got it*. The
    /// first reading is the one the merge rule already implements for
    /// `started_on`, so it is the one taken, and the surface says `WordScript
    /// installed` rather than naming a machine. A field whose label and whose
    /// merge rule disagree is a field that lies on exactly the machines where it
    /// matters.
    ///
    /// `None` IS A REAL ANSWER. On an installation that predates this field
    /// there may be nothing honest to write — see `backfill_installed_on`, which
    /// refuses rather than stamping today onto a machine that has run for
    /// months. A missing marker costs nothing; a wrong one is a claim the reader
    /// can check and find false.
    #[serde(default)]
    pub installed_on: Option<String>,
    /// One row per MONTH, keyed `YYYY-MM`, and **this tier is never pruned**
    /// (ADR 0243).
    ///
    /// THE TIERS ARE DISJOINT AND THAT IS THE WHOLE CONTRACT. A day is in
    /// `days` or, once it ages out, in its month here — never in both. So
    /// `totals()` is `months + days` with nothing counted twice, and a
    /// surface asking for one month's figures adds this row to whatever days of
    /// that month are still live. `month_totals` is the one implementation of
    /// that sum, on both sides of the bridge.
    ///
    /// WHY THE OTHER ARRANGEMENT WAS REJECTED. Writing every dictation into both
    /// tiers would spare the read side that addition and would store each fact
    /// twice — and a write path that updated one tier and not the other would
    /// diverge SILENTLY. This way the failure mode of forgetting the live days
    /// is a current month that reads empty, which somebody notices the same day.
    ///
    /// Twelve rows a year is under four kilobytes a year. Fifty years of them is
    /// smaller than one week of the index.
    #[serde(default)]
    pub months: BTreeMap<String, LedgerDay>,
    /// The first day each accumulator was written, keyed by the row field it
    /// belongs to (ADR 0243).
    ///
    /// A SERIES MAY NOT DRAW A PERIOD THAT BEGINS BEFORE ITS FIELD'S STAMP. A
    /// zero there is not a measurement of nought, it is the field not having
    /// existed — the same distinction ADR 0172 drew for the calendar's cells,
    /// made general so that the next field added does not need its own paragraph
    /// of prose. This track has written that paragraph twice already: once for
    /// the speech clock (ADR 0177) and once for the language verdict (ADR 0236).
    ///
    /// The EARLIER stamp wins on a merge, for the same reason `started_on` does.
    #[serde(default)]
    pub measured_from: BTreeMap<String, String>,
    /// When somebody last pressed reset, and the reason the reset STAYS reset.
    ///
    /// Without it the seed would undo the button: `seed_from_history` folds
    /// whatever history still holds into an empty ledger, and an empty ledger is
    /// exactly what a reset produces — so the next time Home opened, every
    /// record still on disk would come straight back and the reset would read as
    /// broken. A ledger that has been reset never seeds again; it counts from
    /// the next dictation.
    #[serde(default)]
    pub reset_at_ms: Option<u64>,
    /// Keyed `YYYY-MM-DD`, in a `BTreeMap` so the file is written in date order
    /// and a human opening it can read it.
    #[serde(default)]
    pub days: BTreeMap<String, LedgerDay>,
    /// How many runs landed in each bucket, all time. The distribution behind
    /// the median — see `RATE_BUCKETS`. Since schema 2 this is the SPEAKING
    /// rate, not throughput.
    #[serde(default)]
    pub rate_buckets: Vec<u32>,
    /// How many runs landed in each turnaround bucket, all time.
    #[serde(default)]
    pub turnaround_buckets: Vec<u32>,
    /// The width, in milliseconds, the turnaround buckets were counted at. Same
    /// argument as `rate_bucket_wpm`: a histogram without its axis is a
    /// plausible wrong number waiting to happen.
    #[serde(default)]
    pub turnaround_bucket_ms: f64,
    /// The width, in words a minute, the buckets above were counted at.
    ///
    /// IT IS STORED BECAUSE A HISTOGRAM IS MEANINGLESS WITHOUT ITS AXIS, and
    /// reading one at the wrong width is silent rather than loud: a file written
    /// at five wpm per bucket and read at one reported a median of 17 where the
    /// true figure was 88, because bucket 17 stopped meaning "85 to 90" and
    /// started meaning "17". Found on the running app. A mismatch discards the
    /// counts — they are derived, and living another day rebuilds them.
    #[serde(default)]
    pub rate_bucket_wpm: f64,
    /// The same turnaround distribution again, split by what produced it, keyed
    /// `provider/model` (ADR 0240).
    ///
    /// **THIS USED TO BE READ OFF THE HISTORY RECORDS AND COULD NOT BE.** The
    /// cause list under the turnaround view was the one reading on Home that was
    /// not all-time: the index was capped at a thousand records, which at the
    /// reporting machine's rate was about five days, so a lifetime figure sat
    /// above a five-day list and the surface had to explain the discrepancy.
    /// ADR 0241 has since deleted the cap, and the retention window that
    /// replaces it is just a longer list — still not all time. A
    /// distribution per recogniser is what the ledger is FOR — counts, no text,
    /// no growth with use — and it costs about eight hundred bytes per model.
    #[serde(default)]
    pub turnaround_causes: BTreeMap<String, LedgerCause>,
    /// The same distribution again, split by the MODE that ran rather than by
    /// the recogniser that answered, keyed by `effective_mode` (ADR 0243).
    ///
    /// TWO ONE-DIMENSIONAL CUTS OF ONE TOTAL, NEVER A CROSS-TAB. Model×mode is
    /// the product of two sets and is bounded only in the sense that a large
    /// number is finite; each cut on its own sums to `turnaround_buckets` and
    /// answers a question somebody actually asks — *which model is slow* and
    /// *what does this mode cost me*.
    ///
    /// It needs no key cap. `ProcessingMode` is an enum, so unlike a model name
    /// off the wire this map cannot be grown by a vendor.
    ///
    /// AND IT IS THE HALF OF THE WAIT THE OTHER CUT CANNOT SEE. The clock stops
    /// when the TEXT exists (ADR 0181), so a mode that rewrites what was said
    /// has a second model inside the same interval and `turnaround_causes` names
    /// only the recogniser. Cutting the same runs by mode is what makes that
    /// difference readable instead of merely disclosed in a note.
    #[serde(default)]
    pub mode_causes: BTreeMap<String, Vec<u32>>,
    /// The TRANSFORM's own share of those same waits, keyed the same way.
    ///
    /// WHAT NEITHER OF THE TWO MAPS ABOVE COULD EVER SAY. `turnaround_causes`
    /// and `mode_causes` both hold the WHOLE wait — one quantity filed under two
    /// different keys — so a model row and a mode row were the same number twice
    /// and a reader comparing them learnt nothing. Neither could answer *how much
    /// of this is the rewrite*, which is the only question a mode row is opened
    /// for. This map is the interval from the recogniser answering to the text
    /// being final; `LedgerCause::heard_buckets` is the interval before it. Same
    /// axis as every other turnaround histogram in this file.
    #[serde(default)]
    pub mode_transform_causes: BTreeMap<String, Vec<u32>>,
}

/// One recogniser's own turnaround distribution (ADR 0240).
///
/// The provider and the model are stored rather than parsed back out of the
/// key. A model id may contain a slash — several vendors namespace theirs that
/// way — so a reader splitting `provider/model` would be right on this machine
/// and wrong on somebody else's, which is the class of bug that only shows up
/// in the field.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct LedgerCause {
    pub provider: String,
    pub model: String,
    /// Counted at `turnaround_bucket_ms`, the SAME axis as `turnaround_buckets`.
    /// One width for both, so a median read off a row can never disagree with
    /// the bands drawn above it — the failure ADR 0181 recorded, one structure
    /// further out.
    #[serde(default)]
    pub buckets: Vec<u32>,
    /// The recogniser's OWN share of the same waits — the audio export plus the
    /// provider round trip, ending the moment there is text to transform.
    /// `buckets` holds the whole wait for exactly these runs, so what separates
    /// the two is what the mode cost.
    ///
    /// EMPTY FOR EVERY RUN COUNTED BEFORE THE SPLIT EXISTED, and no seed can
    /// fill it: a history record keeps one duration and never kept two. A row
    /// with counts here and a row without are both honest, and the surface draws
    /// the second without a figure rather than inventing one for it.
    #[serde(default)]
    pub heard_buckets: Vec<u32>,
}

impl ActivityLedger {
    fn add_rate(&mut self, words: u64, seconds: f64) {
        if words == 0 || !seconds.is_finite() || seconds <= 0.0 {
            return;
        }
        if self.rate_buckets.len() != RATE_BUCKETS {
            self.rate_buckets = vec![0; RATE_BUCKETS];
        }
        self.rate_bucket_wpm = RATE_BUCKET_WPM;
        let rate = (words as f64 / seconds) * 60.0;
        /* A rate past the top bucket is CLAMPED INTO IT rather than dropped. It
           is almost always a recogniser hallucination on a very short clip —
           ten words against two seconds of audio — and dropping it would be a
           silent edit of the distribution. Held at the edge, it counts as one
           run and cannot drag a median the way it drags a mean, which is the
           whole reason this tile reports a median. */
        let index = ((rate / RATE_BUCKET_WPM) as usize).min(RATE_BUCKETS - 1);
        self.rate_buckets[index] += 1;
    }

    /// One duration into one turnaround histogram, on the shared axis.
    ///
    /// Written once and called from the stage splits rather than copied a fifth
    /// time: a bucket index computed in five places is five chances to compute
    /// it differently, which is precisely the failure ADR 0181 recorded.
    fn count_turnaround(buckets: &mut Vec<u32>, milliseconds: u64) {
        if buckets.len() != TURNAROUND_BUCKETS {
            *buckets = vec![0; TURNAROUND_BUCKETS];
        }
        let index =
            ((milliseconds as f64 / TURNAROUND_BUCKET_MS) as usize).min(TURNAROUND_BUCKETS - 1);
        buckets[index] += 1;
    }

    fn add_turnaround(&mut self, milliseconds: u64) {
        if self.turnaround_buckets.len() != TURNAROUND_BUCKETS {
            self.turnaround_buckets = vec![0; TURNAROUND_BUCKETS];
        }
        self.turnaround_bucket_ms = TURNAROUND_BUCKET_MS;
        let index =
            ((milliseconds as f64 / TURNAROUND_BUCKET_MS) as usize).min(TURNAROUND_BUCKETS - 1);
        self.turnaround_buckets[index] += 1;
    }

    /// Count one wait against the recogniser that produced it (ADR 0240).
    ///
    /// Called from the same funnel as `add_turnaround` and under the same
    /// condition, so from the moment both exist the two describe the same set of
    /// runs and the per-model counts sum to the all-time histogram.
    ///
    /// A LEDGER SEEDED AFTER THE FACT STARTS A LITTLE SHORT, and it is worth
    /// naming rather than discovering. The histogram was already full on any
    /// machine that dictated before this map existed, so the map is filled from
    /// history — and history is the shallower record. On the reporting machine
    /// that cost exactly two runs out of 422: the seed skips a record that
    /// delivered no words, and the live funnel counts its wait. The gap is fixed
    /// at seed time and never widens.
    fn add_turnaround_cause(
        &mut self,
        provider: &str,
        model: Option<&str>,
        milliseconds: u64,
        /* THE SAME RUN'S HEARING TIME, where the run measured one. Passed beside
           the total rather than derived from it, because the difference between
           them belongs to the mode and this row is not the mode's. */
        heard_ms: Option<u64>,
    ) {
        let provider = provider.trim();
        /* A RECORD WITH NO MODEL NAME IS FILED UNDER ITS PROVIDER, which is what
           the frontend already did with the same records: the vendor is the
           coarser true answer, and dropping the run instead would make the rows
           stop summing to the histogram. With neither there is nothing to name,
           and an "unknown" bucket is a row nobody can act on. */
        let model = model.map(str::trim).filter(|name| !name.is_empty()).unwrap_or(provider);
        if model.is_empty() {
            return;
        }
        let mut key = format!("{provider}/{model}");
        let (mut provider, mut model) = (provider.to_string(), model.to_string());
        /* PAST THE CAP THE RUN IS COUNTED SOMEWHERE ELSE, NOT DROPPED
           (ADR 0243). It used to return here, which made the rows stop summing
           to `turnaround_buckets` with no signal at all — on an installation
           old enough to have seen sixty-five models, which is a decade of a
           vendor renaming on every release rather than anything exotic. The
           display's own note says the rows sum. Now they do, at every age. */
        if !self.turnaround_causes.contains_key(&key)
            && self.turnaround_causes.len() >= MAX_CAUSE_KEYS
        {
            key = OTHER_CAUSE_KEY.to_string();
            provider = OTHER_CAUSE_KEY.to_string();
            model = String::new();
        }

        let cause = self.turnaround_causes.entry(key).or_insert_with(|| LedgerCause {
            provider,
            model,
            buckets: Vec::new(),
            heard_buckets: Vec::new(),
        });
        Self::count_turnaround(&mut cause.buckets, milliseconds);
        /* THE SPLIT IS COUNTED ONLY WHERE IT WAS MEASURED, and the two
           histograms are therefore allowed to disagree on how many runs they
           hold. That is the honest shape: a machine that dictated before the
           split existed has a full `buckets` and an empty `heard_buckets`, and
           the surface reads the second as *not measured* rather than as *nought
           seconds*. */
        if let Some(heard) = heard_ms {
            Self::count_turnaround(&mut cause.heard_buckets, heard.min(milliseconds));
        }
    }

    /// Count one wait against the MODE that produced it (ADR 0243). Same funnel,
    /// same condition and the same axis as `add_turnaround`, so this cut and the
    /// model cut describe the same set of runs from the day both exist.
    fn add_mode_cause(
        &mut self,
        mode: Option<&str>,
        milliseconds: u64,
        /* WHAT THIS MODE ITSELF COST — the interval after the recogniser
           answered. `Some(0)` is a real reading and not a missing one: Verbatim
           runs no model and genuinely adds nothing, which is a fact worth
           drawing. `None` is a run counted before the split was measured. */
        transform_ms: Option<u64>,
    ) {
        let Some(mode) = mode.map(str::trim).filter(|value| !value.is_empty()) else {
            /* A run whose mode the record does not name is counted in the
               histogram and in no row of this cut, exactly as a run with no
               model name would be — and unlike that case there is no coarser
               true answer to file it under. The rows then sum to less than the
               total, which the surface states rather than papers over. */
            return;
        };
        Self::count_turnaround(
            self.mode_causes.entry(mode.to_string()).or_default(),
            milliseconds,
        );
        if let Some(transform) = transform_ms {
            Self::count_turnaround(
                self.mode_transform_causes.entry(mode.to_string()).or_default(),
                transform.min(milliseconds),
            );
        }
    }

    /// The middle dictation's wait, in milliseconds.
    ///
    /// A MEDIAN FOR THE SAME REASON THE RATE IS ONE: one cold start behind a
    /// model that had to load, or one request that queued, is not what the next
    /// dictation will cost. Measured over 84 real sessions the spread was 810 ms
    /// to 7,250 ms around a median of 1,210 — a mean would sit visibly above
    /// anything typical.
    pub fn median_turnaround_ms(&self) -> Option<f64> {
        median_of(&self.turnaround_buckets, TURNAROUND_BUCKET_MS)
    }

    /// The middle run's speaking rate, to the nearest bucket.
    ///
    /// A MEDIAN AND NOT A MEAN, and the difference is not academic. Measured on
    /// the machine this was written against: total-words-over-total-seconds gave
    /// 82.7, the mean of the per-run rates gave 95.3, and the median gave 87.6 —
    /// with a single two-second capture reporting 273 wpm because the recogniser
    /// invented ten words for it. An aggregate is dragged DOWN by long dictations
    /// and a mean is dragged UP by short hallucinated ones; the median is what a
    /// typical dictation actually ran at.
    pub fn median_rate(&self) -> Option<f64> {
        median_of(&self.rate_buckets, RATE_BUCKET_WPM)
    }

    /// Every day folded into one set of all-time figures, INCLUDING the days
    /// that have aged out of the file. This is the number that may never fall.
    ///
    /// TWO TIERS AND THEY ARE DISJOINT (ADR 0243, ADR 0244): the month rows a
    /// day is folded into when it ages out, and the live days. A day is in
    /// exactly one of them, so this adds rather than picks.
    pub fn totals(&self) -> LedgerDay {
        let mut total = LedgerDay::default();
        for month in self.months.values() {
            total.absorb(month);
        }
        for day in self.days.values() {
            total.absorb(day);
        }
        total
    }

    /// One calendar month's figures, whichever tier they are sitting in
    /// (ADR 0243).
    ///
    /// THE ONE IMPLEMENTATION OF THE TIER SUM, and the reason it is a method
    /// rather than a line at each call site: a caller that read `months` alone
    /// would report the CURRENT month as empty until the day it ages out, which
    /// is the whole month a reader is most likely to be looking at.
    pub fn month_totals(&self, month_key: &str) -> LedgerDay {
        let mut total = self.months.get(month_key).cloned().unwrap_or_default();
        for (key, day) in &self.days {
            if key.len() >= 7 && &key[..7] == month_key {
                total.absorb(day);
            }
        }
        total
    }

    /// The first day a given accumulator was written, or `None` where it has
    /// never been written at all (ADR 0243).
    pub fn measured_from(&self, field: &str) -> Option<&str> {
        self.measured_from.get(field).map(String::as_str)
    }

    /// Stamp an accumulator's first day, keeping the earliest ever seen.
    fn stamp_measured(&mut self, field: &str, day: &str) {
        let entry = self.measured_from.entry(field.to_string()).or_insert_with(|| day.to_string());
        if day < entry.as_str() {
            *entry = day.to_string();
        }
    }

    /// Raise every figure here to the larger of itself and the archive's
    /// (ADR 0179). Used by the import and by nothing else.
    pub fn raise_to(&mut self, other: &ActivityLedger) {
        for (key, row) in &other.days {
            self.days.entry(key.clone()).or_default().raise_to(row);
        }
        /* THE MONTH TIER RAISES EXACTLY LIKE THE DAY TIER (ADR 0243). It has to:
           an archive from a machine that has run longer carries months this one
           has never had a day for, and taking them whole is the only way a
           restore can reach further back than the local file. Field-wise
           maximum keeps it idempotent — the same archive imported twice changes
           nothing — which is ADR 0179's rule and not a new one. */
        for (key, row) in &other.months {
            self.months.entry(key.clone()).or_default().raise_to(row);
        }
        /* The EARLIER start wins: an archive that reaches further back is
           evidence this installation is older than the local file knows. */
        if let Some(started) = &other.started_on {
            if self.started_on.as_deref().map_or(true, |own| own > started.as_str()) {
                self.started_on = Some(started.clone());
            }
        }
        /* SAME RULE FOR THE INSTALL DATE, AND THE FIELD MEANS WHAT THIS MAKES IT
           MEAN (ADR 0190): *when you first installed WordScript*, not *when this
           machine got it*. An archive that reaches further back is evidence the
           reader has been running this product for longer than the local file
           knows, and the marker on the calendar is named accordingly. */
        if let Some(installed) = &other.installed_on {
            if self.installed_on.as_deref().map_or(true, |own| own > installed.as_str()) {
                self.installed_on = Some(installed.clone());
            }
        }
        raise_buckets(&mut self.rate_buckets, &other.rate_buckets, RATE_BUCKETS);
        raise_buckets(
            &mut self.turnaround_buckets,
            &other.turnaround_buckets,
            TURNAROUND_BUCKETS,
        );
        if !self.rate_buckets.is_empty() {
            self.rate_bucket_wpm = RATE_BUCKET_WPM;
        }
        if !self.turnaround_buckets.is_empty() {
            self.turnaround_bucket_ms = TURNAROUND_BUCKET_MS;
        }
        /* THE SAME FIELD-WISE MAXIMUM, ONE LEVEL DOWN (ADR 0179, ADR 0240). A
           pair the archive knows and this machine does not is taken whole; one
           both know is raised bucket by bucket, so importing twice changes
           nothing and importing once can only raise. The key cap applies here
           too — an archive from a machine that saw more models than this one
           may not push it past the bound. */
        for (key, cause) in &other.turnaround_causes {
            if !self.turnaround_causes.contains_key(key)
                && self.turnaround_causes.len() >= MAX_CAUSE_KEYS
            {
                continue;
            }
            let own = self.turnaround_causes.entry(key.clone()).or_insert_with(|| LedgerCause {
                provider: cause.provider.clone(),
                model: cause.model.clone(),
                buckets: Vec::new(),
                heard_buckets: Vec::new(),
            });
            raise_buckets(&mut own.buckets, &cause.buckets, TURNAROUND_BUCKETS);
            raise_buckets(&mut own.heard_buckets, &cause.heard_buckets, TURNAROUND_BUCKETS);
        }
        /* NO CAP ON THIS ONE, because the key is an enum and not a wire value —
           see the field's own note. */
        for (mode, buckets) in &other.mode_causes {
            let own = self.mode_causes.entry(mode.clone()).or_default();
            raise_buckets(own, buckets, TURNAROUND_BUCKETS);
        }
        for (mode, buckets) in &other.mode_transform_causes {
            let own = self.mode_transform_causes.entry(mode.clone()).or_default();
            raise_buckets(own, buckets, TURNAROUND_BUCKETS);
        }
        /* THE EARLIER STAMP WINS, and for the same reason `started_on` does: an
           archive that measured a field sooner is evidence this reader has been
           measuring it for longer than the local file knows. Taking the later
           one would hide periods the record can genuinely speak for. */
        for (field, day) in &other.measured_from {
            self.stamp_measured(field, day);
        }
    }
}

/// `YYYY-MM` from a `YYYY-MM-DD` day key, which is the first seven characters
/// and nothing cleverer — the day keys are written by `day_key` and are always
/// that shape.
fn month_key(day: &str) -> String {
    day.chars().take(7).collect()
}

/// Which quarter-octave bucket a wait lands in — see `TURNAROUND_LOG_BUCKETS`.
///
/// Anything under the base lands in bucket 0 and anything past the top lands in
/// the overflow, which is the same clamping rule the rate histogram uses and for
/// the same reason: an outlier held at the edge counts as one run and cannot
/// drag a median, where a dropped one is a silent edit of the distribution.
fn turnaround_log_index(milliseconds: u64) -> usize {
    if milliseconds as f64 <= TURNAROUND_LOG_BASE_MS {
        return 0;
    }
    let octaves = (milliseconds as f64 / TURNAROUND_LOG_BASE_MS).log2();
    ((octaves * TURNAROUND_LOG_PER_OCTAVE) as usize).min(TURNAROUND_LOG_BUCKETS - 1)
}

/// The lower edge of a quarter-octave bucket, in milliseconds.
fn turnaround_log_edge(index: usize) -> f64 {
    TURNAROUND_LOG_BASE_MS * 2f64.powf(index as f64 / TURNAROUND_LOG_PER_OCTAVE)
}

/// The middle run's wait off the log axis, at its bucket's lower edge.
fn median_of_log(buckets: &[u32]) -> Option<f64> {
    let total: u64 = buckets.iter().map(|count| *count as u64).sum();
    if total == 0 {
        return None;
    }
    let midpoint = total / 2;
    let mut seen: u64 = 0;
    for (index, count) in buckets.iter().enumerate() {
        seen += *count as u64;
        if seen > midpoint {
            return Some(turnaround_log_edge(index));
        }
    }
    None
}

/// Add one histogram into another, widening the target where it is empty.
///
/// A HISTOGRAM OF THE WRONG WIDTH IS DROPPED RATHER THAN PADDED, exactly as
/// `raise_buckets` drops one: a file whose axis does not match this build's
/// means something else, and folding it in would put runs in buckets they were
/// never counted into.
fn absorb_buckets(own: &mut Vec<u32>, other: &[u32], expected: usize) {
    if other.len() != expected {
        return;
    }
    if own.len() != expected {
        *own = vec![0; expected];
    }
    for (index, count) in other.iter().enumerate() {
        own[index] = own[index].saturating_add(*count);
    }
}

/// The middle of a sorted histogram, at its bucket's LOWER edge — the edge that
/// never reports a figure higher than any run actually reached.
fn median_of(buckets: &[u32], width: f64) -> Option<f64> {
    let total: u64 = buckets.iter().map(|count| *count as u64).sum();
    if total == 0 {
        return None;
    }
    let midpoint = total / 2;
    let mut seen: u64 = 0;
    for (index, count) in buckets.iter().enumerate() {
        seen += *count as u64;
        if seen > midpoint {
            return Some(index as f64 * width);
        }
    }
    None
}

fn raise_buckets(own: &mut Vec<u32>, other: &[u32], expected: usize) {
    if other.len() != expected {
        return;
    }
    if own.len() != expected {
        *own = vec![0; expected];
    }
    for (index, count) in other.iter().enumerate() {
        own[index] = own[index].max(*count);
    }
}

pub fn ledger_file_path() -> PathBuf {
    user_data_dir().join("activity.json")
}

fn ledger_store() -> &'static Mutex<Option<ActivityLedger>> {
    static STORE: OnceLock<Mutex<Option<ActivityLedger>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(None))
}

fn read_from_disk() -> ActivityLedger {
    let path = ledger_file_path();
    let Ok(raw) = std::fs::read_to_string(&path) else {
        /* A LEDGER THIS BUILD CREATES STATES THIS BUILD'S SHAPE (ADR 0244). It
           used to be born at schema 0 and get stamped on the NEXT read — so a
           first run that wrote the install date and nothing else left a file
           claiming a shape no build has ever had. Harmless while nothing reads
           the stamp; not harmless from the release that does. */
        return ActivityLedger { schema: LEDGER_SCHEMA, ..ActivityLedger::default() };
    };
    /* A LEDGER THAT WILL NOT PARSE IS REPLACED, NOT SURFACED AS AN ERROR. It is
       derived bookkeeping and every figure in it can be rebuilt by living
       another day; refusing to start a dictation because an aggregate file is
       corrupt would trade the product for its statistics. */
    let mut ledger: ActivityLedger = serde_json::from_str(&raw).unwrap_or_default();
    migrate(&mut ledger);
    ledger
}

/// Bring a file written by an older build up to what this one means.
///
/// ONLY DERIVED COUNTS ARE EVER DISCARDED HERE. The day rows are observations
/// and survive every migration; the histograms are interpretations of those
/// observations and can be wrong in a way that reads as plausible, which is the
/// one failure this module is built against.
fn migrate(ledger: &mut ActivityLedger) {
    /* THE AXIS HAS TO MATCH OR THE COUNTS MEAN NOTHING. Anything else is a
       median read off the wrong scale, which looks like a plausible number and
       is not one. */
    if ledger.rate_bucket_wpm != RATE_BUCKET_WPM || ledger.rate_buckets.len() != RATE_BUCKETS {
        ledger.rate_buckets = Vec::new();
        ledger.rate_bucket_wpm = RATE_BUCKET_WPM;
    }
    if ledger.turnaround_bucket_ms != TURNAROUND_BUCKET_MS
        || ledger.turnaround_buckets.len() != TURNAROUND_BUCKETS
    {
        ledger.turnaround_buckets = Vec::new();
        ledger.turnaround_bucket_ms = TURNAROUND_BUCKET_MS;
    }

    /* NOTHING HERE CONVERTS BETWEEN SCHEMA VERSIONS, AND THAT IS A DECISION
       RATHER THAN AN OMISSION (ADR 0244). This product has never shipped a
       release build, so no installation outside this repository holds a file an
       older shape could have written. The `schema < 2` and `schema < 3` branches
       that stood here were maintained for exactly one machine — the developer's
       own — and their output reached the screen as an arithmetic that did not
       add up. The stamp below stays, because the first release is where it
       starts meaning something and from that day forward every user is owed a
       path.

       WHAT THE GUARDS ABOVE AND BELOW DO IS NOT MIGRATION. They drop a histogram
       counted on an axis THIS build does not use — a defence against a constant
       being edited in the present, which fires on a developer rather than on an
       upgrade. Counts in buckets they were not counted into are a plausible
       wrong number, which is the failure this module is built against. */
    for day in ledger.days.values_mut().chain(ledger.months.values_mut()) {
        if !day.turnaround_log.is_empty() && day.turnaround_log.len() != TURNAROUND_LOG_BUCKETS {
            day.turnaround_log = Vec::new();
            day.turnaround_runs = 0;
            day.turnaround_ms_sum = 0;
        }
    }
    /* EVERY HISTOGRAM ON THE SHARED AXIS, INCLUDING THE ONE A CAUSE ROW KEEPS
       BESIDE ITS STAGE. ADR 0247 added `heard_buckets` to this walk and left
       `buckets` — the total that sits in the same struct — out of it, which made
       one field of a pair defended and its sibling not. The top-level
       `turnaround_buckets` above is dropped on an axis change and these are read
       against the same constant, so they answer to the same rule. */
    for buckets in ledger
        .mode_causes
        .values_mut()
        .chain(ledger.mode_transform_causes.values_mut())
        .chain(
            ledger
                .turnaround_causes
                .values_mut()
                .flat_map(|cause| [&mut cause.buckets, &mut cause.heard_buckets]),
        )
    {
        if !buckets.is_empty() && buckets.len() != TURNAROUND_BUCKETS {
            *buckets = Vec::new();
        }
    }
    ledger.mode_causes.retain(|_, buckets| !buckets.is_empty());
    ledger.mode_transform_causes.retain(|_, buckets| !buckets.is_empty());
    /* A CAUSE ROW WITH NOTHING LEFT TO COUNT IS A ROW, NOT A GAP. It can only
       arise from the guard above having just emptied it, and it would otherwise
       sit in the file carrying a provider and a model and no runs. The mode cuts
       beside it have dropped theirs since ADR 0243. */
    ledger.turnaround_causes.retain(|_, cause| !cause.buckets.is_empty());

    ledger.schema = LEDGER_SCHEMA;
}

/// What an installation that predates the field stamps as its install date
/// (ADR 0190).
///
/// THE ONLY WRONG ANSWER IS TODAY. Writing *today* into a field named *installed
/// on*, on a machine that has run for months, fabricates a date the reader can
/// check against their own memory and find false — on the one display whose
/// entire argument is that every circle on it asserts something true. So this
/// takes evidence where there is evidence and refuses where there is none:
///
///  1. **`started_on`**, the first day this ledger ever wrote a row. It is late
///     rather than wrong — nobody installs a dictation product and waits — and
///     it is the closest thing to an install date the product ever recorded.
///  2. **The config file's creation time**, which is written on the first launch
///     and therefore predates any dictation. Better than (1) where the platform
///     records it; several do not, and `created()` says so rather than guessing.
///  3. **Nothing.** The calendar draws one marker instead of two, which is a
///     display with one fact on it rather than a display with a lie on it.
///
/// A FRESH INSTALL NEVER REACHES ANY OF THIS: it has no ledger and no config
/// yet, so its first launch writes today and today is the truth.
fn backfill_installed_on(ledger: &ActivityLedger) -> Option<String> {
    /* The config file is the earlier of the two where it can be read at all, so
       it is tried first — the ledger's first row is bounded below by it. */
    if let Some(stamp) = created_day(&super::paths::config_file_path()) {
        return Some(stamp);
    }
    ledger.started_on.clone()
}

/// A file's creation day in local time, where the platform records one.
///
/// `created()` is `Err` on filesystems that keep no birth time, which is a
/// refusal and not a zero: falling back to `modified()` would read the last
/// config WRITE, and a config is written every time a toggle moves.
fn created_day(path: &std::path::Path) -> Option<String> {
    let created = std::fs::metadata(path).ok()?.created().ok()?;
    let since = created.duration_since(std::time::UNIX_EPOCH).ok()?;
    Some(day_key(since.as_millis() as u64))
}

/// Write the ledger, ATOMICALLY and COMPACTLY (ADR 0243).
///
/// **THIS IS THE ONE FILE IN THE PRODUCT THAT CANNOT BE REBUILT FROM ANYTHING
/// ELSE** (ADR 0179), and until this ADR it was the one written the least
/// carefully: `to_string_pretty` into `std::fs::write`, which truncates in place.
/// A crash between the truncate and the last byte left no ledger and no second
/// copy to replay from. Stage G found exactly this on `history.json` — *the
/// write is whole-file, non-atomic and pretty-printed* — and Stage H fixed it
/// for the index, which is the collection that CAN be rebuilt.
///
/// So: temporary plus rename, the same shape `compact_journal` uses. The rename
/// is what makes it atomic; a failed one leaves a stray sibling, which is swept,
/// rather than a torn ledger, which is unrecoverable.
///
/// AND MINIFIED, WHICH WAS 73% OF THE FILE. Measured on the reporting machine:
/// 21,326 bytes on disk against 5,634 bytes of content. Indentation nobody reads
/// paid for on every dictation.
///
/// WHAT IS DELIBERATELY UNCHANGED IS THE FREQUENCY. Every dictation still
/// writes. The ledger is an accumulator over a file bounded by construction, not
/// a log over an unbounded one, so the argument that made the index a journal
/// (ADR 0241) does not reach it — there is no second copy to replay a skipped
/// write from, and at the sizes the tier ladder permits the write is a fraction
/// of a millisecond.
fn write_to_disk(ledger: &ActivityLedger) -> Result<(), String> {
    let path = ledger_file_path();
    let raw = serde_json::to_string(ledger).map_err(|error| error.to_string())?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let temporary = path.with_extension("json.tmp");
    std::fs::write(&temporary, raw).map_err(|error| error.to_string())?;
    std::fs::rename(&temporary, &path).map_err(|error| {
        let _ = std::fs::remove_file(&temporary);
        error.to_string()
    })
}

/// Seconds, at the precision a second is worth storing to.
///
/// `recorded_seconds` arrived as `4647.276553287982`: twelve decimal places of
/// which three carry a measurement and nine are the float's own shape, written
/// out in full on every dictation, for a figure the screen reports in whole
/// minutes. Rounding on ACCUMULATE rather than at write time keeps what is in
/// memory identical to what is on disk — the alternative drifts the two apart
/// and makes a test that reads the file disagree with one that reads the store.
fn round_seconds(value: f64) -> f64 {
    (value * 1000.0).round() / 1000.0
}

/// `YYYY-MM-DD` in LOCAL time, because a calendar of your days is a calendar of
/// YOUR days — a dictation at half past midnight belongs to the date the clock
/// on the wall showed, not to whatever UTC thought.
pub fn day_key(at_ms: u64) -> String {
    let seconds = (at_ms / 1000) as i64;
    let local = time_of(seconds);
    format!("{:04}-{:02}-{:02}", local.0, local.1, local.2)
}

/// Civil date from a Unix timestamp, in local time.
///
/// Hand-rolled rather than pulled in as a dependency: this needs exactly one
/// thing from a date library and the runtime already carries its own offset
/// lookup. Howard Hinnant's `civil_from_days`, which is the algorithm every
/// implementation of this uses.
fn time_of(unix_seconds: i64) -> (i64, u32, u32) {
    let offset = local_offset_seconds(unix_seconds);
    let local = unix_seconds + offset;
    let days = local.div_euclid(86_400);

    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// The machine's UTC offset at a moment, in seconds.
///
/// `libc::localtime_r` is the only thing that knows this without a timezone
/// database of our own, and it is what the platform layer already relies on.
fn local_offset_seconds(unix_seconds: i64) -> i64 {
    #[cfg(unix)]
    {
        use std::mem::MaybeUninit;
        unsafe {
            let mut tm = MaybeUninit::<libc::tm>::zeroed();
            let time = unix_seconds as libc::time_t;
            if libc::localtime_r(&time, tm.as_mut_ptr()).is_null() {
                return 0;
            }
            tm.assume_init().tm_gmtoff as i64
        }
    }
    #[cfg(not(unix))]
    {
        let _ = unix_seconds;
        0
    }
}

/// One history record, as the seed reads it.
pub struct SeedRecord {
    pub created_at_ms: u64,
    /// Delivered words.
    pub words: u64,
    /// Recogniser words, where the record still holds the raw transcript.
    pub spoken_words: u64,
    pub recorded_seconds: Option<f64>,
    pub turnaround_ms: Option<u64>,
    /// The recogniser's own share of that wait. ALWAYS `None` from a history
    /// record and the field is here anyway: the seed and the live funnel take
    /// the same shape, so the one place that decides what a stage split means is
    /// `add_turnaround_cause` rather than two callers agreeing by accident. What
    /// it costs is one word per record; what leaving it out costs is a rebuild
    /// that quietly files pre-split runs as nought-second hearings.
    pub heard_ms: Option<u64>,
    /// The pair that produced it, for the cause histogram (ADR 0240).
    pub provider: String,
    pub model: Option<String>,
    /// Whether this record's mode may be credited against a typing baseline.
    pub credited: bool,
    /// Which mode ran, for the mode cut of the turnaround (ADR 0243).
    pub mode: Option<String>,
    /// The language this record was credited with — read off the record where
    /// it kept one (ADR 0236), re-measured from its text where it predates the
    /// field. Never the configured one (ADR 0180).
    pub language: Option<String>,
}

/// What one finished record contributes.
pub struct LedgerContribution {
    pub created_at_ms: u64,
    /// Words DELIVERED — the transformed text. Zero means nothing reached the
    /// cursor and the record contributes nothing at all.
    pub words: u64,
    /// Words SPOKEN — the recogniser's output before any mode transform. The
    /// only numerator a speaking rate may use (ADR 0177).
    pub spoken_words: u64,
    /// The open microphone, from `capture_integrity`. `None` on every path that
    /// ran no capture of its own.
    pub recorded_seconds: Option<f64>,
    /// The same window with the thinking pauses removed. `None` wherever the
    /// speech clock did not run — a retry, and every payload written before
    /// ADR 0177.
    pub speech_seconds: Option<f64>,
    /// Milliseconds from the capture stopping to the text existing. `None` on
    /// every path that never ran that clock.
    pub turnaround_ms: Option<u64>,
    /// How much of that wait was spent GETTING THE WORDS — the audio export plus
    /// the provider round trip. What is left over is the mode transform, and the
    /// two together are the whole figure above.
    ///
    /// `None` wherever the run predates the split. It is not zero, and the
    /// difference matters at the surface: a missing reading draws no figure, a
    /// zero draws one.
    pub heard_ms: Option<u64>,
    /// Who produced the text, so the wait above can be filed under it
    /// (ADR 0240). Read straight off the record being written, which is the
    /// same pair the record itself names.
    pub provider: String,
    pub model: Option<String>,
    /// False for the modes that GENERATE text rather than tidy it — Agent and
    /// Prompt Enhance. Their output may not be credited against typing, because
    /// nobody would have typed it (ADR 0178).
    pub credited: bool,
    /// Which mode actually ran, so the wait can be cut by it as well as by the
    /// recogniser (ADR 0243). The record's own `effective_mode` — never the
    /// profile's default, which is what the reader CHOSE rather than what
    /// happened.
    pub mode: Option<String>,
    /// The language of the delivered text, as `core::language_detect` measured
    /// it. `None` where the text was too short to be sure, which is a refusal
    /// rather than a gap.
    pub language: Option<String>,
}

/// Fold one record into the ledger and write it.
///
/// Errors are RETURNED AND NOT PROPAGATED INTO THE SESSION by the caller: a
/// dictation that reached the cursor has succeeded, and failing it because an
/// aggregate could not be written would be the tail wagging the dog.
pub fn record(contribution: LedgerContribution) -> Result<(), String> {
    if contribution.words == 0 && contribution.spoken_words == 0 {
        return Ok(());
    }

    let mut guard = ledger_store().lock().map_err(|error| error.to_string())?;
    let ledger = guard.get_or_insert_with(read_from_disk);

    let key = day_key(contribution.created_at_ms);
    let day = ledger.days.entry(key.clone()).or_default();
    day.dictations += 1;
    day.words += contribution.words;
    day.spoken_words += contribution.spoken_words;

    let recorded = contribution
        .recorded_seconds
        .filter(|seconds| seconds.is_finite() && *seconds > 0.0);
    if let Some(seconds) = recorded {
        day.recorded_seconds = round_seconds(day.recorded_seconds + seconds);
        day.timed += 1;
        day.longest_seconds = round_seconds(day.longest_seconds.max(seconds));
    }

    /* CLAMPED TO THE WINDOW IT IS A PART OF. Speech seconds are measured in the
       audio callback and recorded seconds from the sample count; the two are
       the same clock read two ways, and a rounding disagreement that let speech
       exceed the capture would put a rate above what the microphone was even
       open for. */
    let speaking = contribution
        .speech_seconds
        .filter(|seconds| seconds.is_finite() && *seconds > 0.0)
        .map(|seconds| match recorded {
            Some(window) => seconds.min(window),
            None => seconds,
        });
    if let Some(seconds) = speaking {
        day.speech_seconds = round_seconds(day.speech_seconds + seconds);
        day.voiced += 1;
    }

    /* THE THREE FIELDS TIME SAVED READS, WRITTEN AS ONE GROUP. Words and seconds
       from the SAME run or neither, so the figure can never divide one set of
       runs by another (ADR 0178). */
    if contribution.credited && contribution.words > 0 {
        if let Some(seconds) = recorded {
            day.saved_runs += 1;
            day.saved_words += contribution.words;
            day.saved_seconds = round_seconds(day.saved_seconds + seconds);
        }
    }

    /* THE PERIOD'S OWN TURNAROUND (ADR 0243), written in the same statement as
       the all-time one below so that no run can ever land in one and not the
       other — the rule ADR 0240 set for the cause map, one tier further down.
       Two counters give the period an exact mean and the log histogram gives it
       a median; neither is stored as a figure, because a figure cannot be
       merged when the day becomes a month. */
    if let Some(milliseconds) = contribution.turnaround_ms {
        day.turnaround_runs += 1;
        day.turnaround_ms_sum += milliseconds;
        if day.turnaround_log.len() != TURNAROUND_LOG_BUCKETS {
            day.turnaround_log = vec![0; TURNAROUND_LOG_BUCKETS];
        }
        day.turnaround_log[turnaround_log_index(milliseconds)] += 1;
    }

    /* THE LANGUAGE, PER PERIOD AND SPLIT (ADR 0243). Every dictation counted
       from here on increments EXACTLY ONE of these two — a code, or the refusal
       — which is what makes the third population derivable rather than stored:
       whatever the day counted and neither of these two accounts for is a run
       nothing ever asked about. */
    match contribution.language.as_deref().map(str::trim).filter(|code| !code.is_empty()) {
        Some(code) => *day.languages.entry(code.to_lowercase()).or_insert(0) += 1,
        None => day.language_refused += 1,
    }

    /* THE RATE IS SPOKEN WORDS OVER SPEECH SECONDS AND NOTHING ELSE. Without a
       speech clock there is no rate — a run counted against the open microphone
       would sit tens of words a minute below the ones counted properly, and the
       median would drift with the ratio of the two. */
    if let (Some(seconds), true) = (speaking, contribution.spoken_words > 0) {
        ledger.add_rate(contribution.spoken_words, seconds);
    }
    if let Some(milliseconds) = contribution.turnaround_ms {
        ledger.add_turnaround(milliseconds);
        /* ONE CONDITION FOR ALL THREE, so no live run can ever land in one and
           not the others (ADR 0240, extended by ADR 0243). */
        /* THE TWO STAGES, DERIVED ONCE AND HANDED TO BOTH CUTS. The recogniser's
           share is measured; the transform's is what the total has left over, so
           the pair can never sum to something other than the wait the histogram
           above just counted. Saturating because a clock read twice can come
           back out of order by a millisecond, and a wrapped u64 here would land
           in the top bucket as a fifty-eight-thousand-year rewrite. */
        let heard = contribution.heard_ms.map(|heard| heard.min(milliseconds));
        let transform = heard.map(|heard| milliseconds.saturating_sub(heard));
        ledger.add_turnaround_cause(
            &contribution.provider,
            contribution.model.as_deref(),
            milliseconds,
            heard,
        );
        ledger.add_mode_cause(contribution.mode.as_deref(), milliseconds, transform);
        ledger.stamp_measured("turnaround_runs", &key);
    }
    /* THE STAMP GOES DOWN WHETHER OR NOT A LANGUAGE WAS NAMED, because what it
       dates is the ASKING and not the answer (ADR 0243). A day on which every
       run was too short still measured them all, and a chart that skipped it
       would be hiding a period the record can speak for perfectly well. */
    ledger.stamp_measured("languages", &key);

    if ledger.started_on.is_none() {
        ledger.started_on = Some(key.clone());
    }
    /* THE INSTALL DATE, WHERE THIS IS THE FIRST TIME ANYTHING HAS ASKED
       (ADR 0190). On a fresh machine the backfill finds a config written minutes
       ago and answers with today, which is the truth; on one that has run for
       months it answers with the evidence, or refuses. `key` is the last
       fallback — this dictation's own day — and it is reached only where there
       is no config file and no earlier row, which is a machine with no history
       at all. */
    if ledger.installed_on.is_none() {
        let stamp = backfill_installed_on(ledger).unwrap_or(key);
        ledger.installed_on = Some(stamp);
    }
    ledger.schema = LEDGER_SCHEMA;
    prune(ledger);

    write_to_disk(ledger)
}

/// Fold day rows past the horizon into their month.
///
/// THE ROW LEAVES AND THE FIGURES DO NOT (ADR 0176). **AND SINCE ADR 0243 THE
/// SHAPE DOES NOT EITHER.** An aged-out day used to be absorbed into one opaque
/// `retired` total, which kept every lifetime figure honest and cost the record
/// its resolution — so `series.ts` started every chart after that horizon, the
/// *Months* tab could never hold more than 26 buckets and **the *Years* tab
/// could never hold more than three, on an installation of any age**. A product
/// whose tabs stop learning after two years is not all-time in anything but its
/// totals.
///
/// A day now goes into its month row, and the month tier is never pruned. The
/// tiers stay disjoint: the day leaves `days` in the same statement it joins
/// `months`, so nothing is ever counted in both — and there is no third tier to
/// keep a stamp for, which is why ADR 0244 deleted the one that stood here.
fn prune(ledger: &mut ActivityLedger) {
    if ledger.days.len() as i64 <= LEDGER_DAY_ROWS {
        return;
    }
    let excess = ledger.days.len() - LEDGER_DAY_ROWS as usize;
    let doomed: Vec<String> = ledger.days.keys().take(excess).cloned().collect();
    for key in doomed {
        if let Some(day) = ledger.days.remove(&key) {
            ledger.months.entry(month_key(&key)).or_default().absorb(&day);
        }
    }
}

/// The ledger as it stands, for a surface to read.
pub fn snapshot() -> Result<ActivityLedger, String> {
    let mut guard = ledger_store().lock().map_err(|error| error.to_string())?;
    Ok(guard.get_or_insert_with(read_from_disk).clone())
}

/// What Home reads for its all-time figures.
///
/// The seed runs here rather than at startup so it costs nothing on a launch
/// nobody opens the workspace on, and it is idempotent — a ledger with rows is
/// already seeded and returns immediately.
/// Fill in the install date if nothing has yet, and keep it once it is there.
///
/// IT RUNS ON THE READ AND NOT ONLY ON A DICTATION, because the marker it feeds
/// is on a display somebody can open before they have dictated anything — and
/// because on a machine that has run for months the evidence for it is on disk
/// NOW and is not getting any better. Idempotent: a ledger that already carries
/// one is left alone and not written.
fn stamp_install() -> Result<(), String> {
    let mut guard = ledger_store().lock().map_err(|error| error.to_string())?;
    let ledger = guard.get_or_insert_with(read_from_disk);
    if ledger.installed_on.is_some() {
        return Ok(());
    }
    let Some(stamp) = backfill_installed_on(ledger) else {
        /* No config file and no row: nothing on this machine can say when it
           arrived, so the field stays empty and the calendar draws one marker
           rather than two. */
        return Ok(());
    };
    ledger.installed_on = Some(stamp);
    write_to_disk(ledger)
}

#[tauri::command]
pub fn read_activity_ledger() -> Result<ActivityLedger, String> {
    let _ = stamp_install();
    /* THE CHEAP CHECK FIRST. Reading history, counting its words and measuring
       the language of every record is real work, and on every open after the
       first there is nothing for it to seed. */
    let current = snapshot()?;
    if !needs_seed(&current) {
        return Ok(current);
    }
    if let Ok(entries) = super::history::entries_for_backup() {
        let records: Vec<SeedRecord> = entries
            .iter()
            .filter(|entry| entry.retry_of.is_none())
            .map(|entry| {
                let delivered = entry
                    .transformed_transcript
                    .as_deref()
                    .or(entry.raw_transcript.as_deref())
                    .unwrap_or_default();
                SeedRecord {
                    created_at_ms: entry.created_at_ms,
                    words: word_count(delivered),
                    spoken_words: entry
                        .raw_transcript
                        .as_deref()
                        .map(word_count)
                        .unwrap_or_default(),
                    recorded_seconds: entry
                        .capture_integrity
                        .as_ref()
                        .map(|integrity| integrity.recorded_seconds),
                    turnaround_ms: entry.turnaround_ms,
                    /* WHATEVER THE RECORD KEPT, WHICH FOR EVERY RUN OLDER THAN
                       the split is nothing. Read rather than hardcoded to
                       `None`: from here on records DO carry it, and a rebuild
                       that threw the split away would leave a reseeded machine
                       permanently unable to draw a column its own records could
                       fill. */
                    heard_ms: entry.heard_ms,
                    provider: entry.provider.clone(),
                    model: entry.model.clone(),
                    credited: super::history::mode_credits_typing(entry.effective_mode.as_ref()),
                    mode: entry.effective_mode.as_ref().map(|mode| mode.as_str().to_string()),
                    /* THE ANSWER THE RECORD KEPT (ADR 0236), which is the only
                       way a rebuild can be as good as the live path was. The
                       naming model saw this dictation once, weeks ago; the seed
                       cannot ask it again, and for records that stored nothing
                       it never could.

                       THE FALLBACK IS THE SAME FUNCTION THE LIVE PATH CALLS, on
                       the spoken text and with no model answer to pass
                       (ADR 0188) — a second place deciding what a record's
                       language is would be a second place to decide it
                       differently. It is also exactly the gap that made the
                       field necessary: the offline detector refuses under eight
                       words, so before ADR 0236 every rebuild silently dropped
                       the short runs out of the count. Records older than the
                       field still lose them; nothing can recover an answer that
                       was never written down. */
                    language: entry.spoken_language.clone().or_else(|| {
                        super::history::contributed_language(
                            None,
                            entry
                                .raw_transcript
                                .as_deref()
                                .map(str::trim)
                                .filter(|raw| !raw.is_empty())
                                .unwrap_or(delivered),
                            entry.effective_mode.as_ref(),
                        )
                    }),
                }
            })
            .collect();
        let _ = seed_from_history(&records);
    }
    snapshot()
}

/// Every figure back to zero, on purpose and on request.
///
/// THE ONE DOOR THAT LOWERS THESE NUMBERS, and it is a red button in Privacy &
/// Data rather than a side effect of clearing history (ADR 0176). Deleting a
/// transcript is housekeeping and must not cost the reader their lifetime
/// record; wanting the record gone is a separate intention and gets a separate
/// control that says what it does.
///
/// The file is REPLACED WITH AN EMPTY LEDGER rather than deleted, and the empty
/// one CARRIES THE DATE OF ITS RESET. Without that stamp the seed would quietly
/// undo the button: an empty ledger is the state that invites a fold of whatever
/// history still holds, so the next time Home opened, every retained record
/// would come back and the reset would read as broken.
#[tauri::command]
pub fn reset_activity_ledger() -> Result<ActivityLedger, String> {
    let mut guard = ledger_store().lock().map_err(|error| error.to_string())?;
    /* THE INSTALL DATE SURVIVES THE RESET, AND IT IS THE ONLY THING THAT DOES
       (ADR 0190). This button is about what was RECORDED — how much you
       dictated, how fast, how long it took — and when the product arrived on
       this machine is not one of those. Clearing it would also be
       unrecoverable in a way none of the figures are: a count can be rebuilt by
       living another day, and a date that has passed cannot be measured again.
       The reader who wants the date gone can delete the file. */
    let installed_on = guard
        .get_or_insert_with(read_from_disk)
        .installed_on
        .clone();
    let fresh = ActivityLedger {
        schema: LEDGER_SCHEMA,
        rate_bucket_wpm: RATE_BUCKET_WPM,
        turnaround_bucket_ms: TURNAROUND_BUCKET_MS,
        reset_at_ms: Some(super::sessions::now_ms()),
        installed_on,
        ..ActivityLedger::default()
    };
    write_to_disk(&fresh)?;
    super::runtime_log::record("[WordScript] Activity ledger reset by request".to_string());
    *guard = Some(fresh.clone());
    Ok(fresh)
}

/// Raise the stored ledger to an archive's figures (ADR 0179). The import calls
/// this; nothing else does.
pub fn merge_from_archive(archive: &ActivityLedger) -> Result<(), String> {
    let mut guard = ledger_store().lock().map_err(|error| error.to_string())?;
    let ledger = guard.get_or_insert_with(read_from_disk);
    let mut incoming = archive.clone();
    migrate(&mut incoming);
    ledger.raise_to(&incoming);
    ledger.schema = LEDGER_SCHEMA;
    write_to_disk(ledger)
}

/// Words, counted the one way this product counts them.
pub fn word_count(text: &str) -> u64 {
    text.split_whitespace().count() as u64
}

/// Whether folding history in could still add anything.
///
/// A LEDGER THAT HAS BEEN RESET NEVER SEEDS AGAIN, whatever it looks like
/// otherwise. That is the whole difference between a reset and an empty file:
/// both have no rows, and only one of them was made empty on purpose.
fn needs_seed(ledger: &ActivityLedger) -> bool {
    if ledger.reset_at_ms.is_some() {
        return false;
    }
    ledger.days.is_empty()
        || ledger.turnaround_buckets.iter().all(|count| *count == 0)
        /* ADR 0240, and the ONLY reason it is in this list. On the reporting
           machine every other structure is full — days, buckets, languages — so
           without this line the gate returns false, the seed never runs, and the
           cause list would start empty on exactly the installation that has the
           records sitting there to fill it from. It filled three rows and 420 of
           422 runs there on the first launch after the change. */
        || ledger.turnaround_causes.is_empty()
        || needs_credited_seed(ledger)
        /* ADR 0243, and both are here for the same reason ADR 0240's line above
           is: on any machine that dictated before this build, every older
           structure is full and these two are empty — which is exactly the
           installation with the records still on disk to fill them from. */
        || ledger.mode_causes.is_empty()
        || needs_period_detail_seed(ledger)
}

/// Whether the day rows predate the per-period accumulators (ADR 0243).
///
/// Same shape of question as `needs_credited_seed` and the same answer: the
/// fields cannot be derived from a day's totals, because which run waited how
/// long and which came back in which language is a property of the RECORDS.
/// What history still holds is folded in once; what it no longer holds is gone,
/// and nothing can recover it.
fn needs_period_detail_seed(ledger: &ActivityLedger) -> bool {
    !ledger.days.is_empty()
        && ledger
            .days
            .values()
            .all(|day| day.turnaround_runs == 0 && day.languages.is_empty())
}

/// Whether the day rows predate the credited-run fields (ADR 0178).
///
/// A ledger written under schema 1 has `words` and `recorded_seconds` on every
/// day and no `saved_*` at all, so time saved would read nothing on an
/// installation with months of dictation behind it — and Home, whose display
/// gate asks whether the record has anything to say, would drop back to the
/// instruction the reader stopped needing on day one.
///
/// The fields cannot be derived from the row: which runs were generative and
/// which carried a clock is a property of the RECORDS, not of the day's totals.
/// So they are folded from whatever history still holds, exactly like the
/// turnaround and the languages before them.
fn needs_credited_seed(ledger: &ActivityLedger) -> bool {
    !ledger.days.is_empty() && ledger.days.values().all(|day| day.saved_runs == 0)
}

/// Fold whatever history still holds into an empty ledger, once.
///
/// THE LEDGER STARTS THE DAY IT IS INSTALLED AND CANNOT INVENT A PAST. What it
/// CAN do is not throw away the records that are still on disk when it first
/// runs — on a fresh install that is nothing, and on an existing one it is
/// however much history was retained. It is a one-time seed and never runs
/// again, because after that the ledger is the deeper of the two records and
/// re-folding history would double every day they share.
///
/// WHAT IT DELIBERATELY DOES NOT SEED IS THE RATE (ADR 0177). History carries no
/// speech clock, so an old record cannot answer how fast its words were spoken —
/// only how fast they arrived over an open microphone, which is a different
/// question by tens of words a minute. The histogram fills from the next
/// dictation onwards and the tile is dark until it does.
pub fn seed_from_history(records: &[SeedRecord]) -> Result<(), String> {
    let mut guard = ledger_store().lock().map_err(|error| error.to_string())?;
    let ledger = guard.get_or_insert_with(read_from_disk);
    if !needs_seed(ledger) {
        return Ok(());
    }

    /* EACH SEED ARRIVED AFTER THE DAYS DID. A ledger written
       before the turnaround existed has rows but no distribution, and re-folding
       its days would double every one of them — so each case fills its own
       structure ALONE. All four are idempotent and none runs twice. */
    let seed_days = ledger.days.is_empty();
    let seed_turnarounds = ledger.turnaround_buckets.iter().all(|count| *count == 0);
    /* ITS OWN FLAG, NOT `seed_turnarounds`. The two structures arrived in
       different releases, so on any machine that dictated before ADR 0240 the
       histogram is full and this map is empty — the exact state the shared flag
       would skip. */
    let seed_causes = ledger.turnaround_causes.is_empty();
    /* ADR 0243's three, each on its own flag for the reason the four above are:
       they arrived in different releases, so a machine can perfectly well hold
       one and not the others. `seed_period` fills structures that are empty by
       definition when its own guard is true, so it adds rather than clearing —
       unlike `seed_credited`, which runs over rows that already carry figures. */
    let seed_modes = ledger.mode_causes.is_empty();
    let seed_period = !seed_days && needs_period_detail_seed(ledger);
    /* The one seed that runs over rows that already exist, so it CLEARS before
       it accumulates. Every other seed here fills a structure that is empty by
       definition and can simply add; this one would double what it found if it
       ever ran twice, and "somebody dictates only in Agent mode" is a real state
       in which it would keep finding nothing to write. */
    let seed_credited = !seed_days && needs_credited_seed(ledger);
    if seed_credited {
        for day in ledger.days.values_mut() {
            day.spoken_words = 0;
            day.saved_runs = 0;
            day.saved_words = 0;
            day.saved_seconds = 0.0;
        }
    }
    ledger.schema = LEDGER_SCHEMA;
    ledger.rate_bucket_wpm = RATE_BUCKET_WPM;
    ledger.turnaround_bucket_ms = TURNAROUND_BUCKET_MS;

    for record in records {
        if record.words == 0 && record.spoken_words == 0 {
            continue;
        }
        let measured = record
            .recorded_seconds
            .filter(|value| value.is_finite() && *value > 0.0);

        if seed_days {
            let day = ledger.days.entry(day_key(record.created_at_ms)).or_default();
            day.dictations += 1;
            day.words += record.words;
            day.spoken_words += record.spoken_words;
            if let Some(value) = measured {
                day.recorded_seconds = round_seconds(day.recorded_seconds + value);
                day.timed += 1;
                day.longest_seconds = round_seconds(day.longest_seconds.max(value));
                if record.credited && record.words > 0 {
                    day.saved_runs += 1;
                    day.saved_words += record.words;
                    day.saved_seconds = round_seconds(day.saved_seconds + value);
                }
            }
            absorb_period_detail(day, record);
        }
        if seed_period {
            /* Only days the ledger already holds, for the reason `seed_credited`
               says: history may reach back past them or not far enough, and
               either way this fills in what a row is missing rather than
               inventing one. */
            if let Some(day) = ledger.days.get_mut(&day_key(record.created_at_ms)) {
                absorb_period_detail(day, record);
            }
        }
        if seed_credited {
            /* Only days the ledger already holds. History may reach back past
               them or not far enough, and either way this fills in what the
               rows are missing rather than inventing a row. */
            if let Some(day) = ledger.days.get_mut(&day_key(record.created_at_ms)) {
                day.spoken_words += record.spoken_words;
                if let Some(value) = measured {
                    if record.credited && record.words > 0 {
                        day.saved_runs += 1;
                        day.saved_words += record.words;
                        day.saved_seconds += value;
                    }
                }
            }
        }
        if seed_turnarounds {
            if let Some(milliseconds) = record.turnaround_ms {
                ledger.add_turnaround(milliseconds);
            }
        }
        if seed_causes {
            if let Some(milliseconds) = record.turnaround_ms {
                ledger.add_turnaround_cause(
                    &record.provider,
                    record.model.as_deref(),
                    milliseconds,
                    record.heard_ms,
                );
            }
        }
        if seed_modes {
            if let Some(milliseconds) = record.turnaround_ms {
                ledger.add_mode_cause(
                    record.mode.as_deref(),
                    milliseconds,
                    record.heard_ms.map(|heard| milliseconds.saturating_sub(heard)),
                );
            }
        }
    }

    if ledger.days.is_empty() {
        return Ok(());
    }
    let _ = seed_credited;
    if seed_days {
        ledger.started_on = ledger.days.keys().next().cloned();
    }
    /* THE STAMP GOES DOWN WHERE THE SEED ACTUALLY REACHED, NOT AT TODAY
       (ADR 0243). A seeded day carries a real split — of the records history
       still holds — so a chart may draw it; what it may not do is draw the days
       before the oldest one the seed touched, and this is the line that says
       where that is. Under-claiming would hide months the record can speak for;
       over-claiming would draw a zero where a field did not exist. */
    if seed_days || seed_period {
        if let Some(first) = ledger
            .days
            .iter()
            .find(|(_, day)| day.turnaround_runs > 0)
            .map(|(key, _)| key.clone())
        {
            ledger.stamp_measured("turnaround_runs", &first);
        }
        if let Some(first) = ledger
            .days
            .iter()
            .find(|(_, day)| !day.languages.is_empty() || day.language_refused > 0)
            .map(|(key, _)| key.clone())
        {
            ledger.stamp_measured("languages", &first);
        }
    }
    write_to_disk(ledger)
}

/// Fold one seed record's per-period accumulators into a day row (ADR 0243).
///
/// ONE FUNCTION BECAUSE THE SEED HAS TWO ENTRANCES. A ledger being built from
/// scratch and one being filled in behind a new field are different flags and
/// the same arithmetic, and the live funnel's version of this is the one thing
/// it must agree with — two implementations of "what a record contributes to a
/// day" is exactly how a seeded row and a live row start meaning different
/// things.
fn absorb_period_detail(day: &mut LedgerDay, record: &SeedRecord) {
    if let Some(milliseconds) = record.turnaround_ms {
        day.turnaround_runs += 1;
        day.turnaround_ms_sum += milliseconds;
        if day.turnaround_log.len() != TURNAROUND_LOG_BUCKETS {
            day.turnaround_log = vec![0; TURNAROUND_LOG_BUCKETS];
        }
        day.turnaround_log[turnaround_log_index(milliseconds)] += 1;
    }
    /* A SEEDED RECORD WITH NO LANGUAGE WAS ASKED AND REFUSED. The seed
       re-measures with the same detector the live path uses, so a record history
       still holds has been asked by definition — which is what keeps the seeded
       rows on the same identity the live path guarantees: every counted
       dictation increments exactly one of these two, so the two together are the
       runs a language was asked of and there is no third population to name
       (ADR 0244). */
    match record.language.as_deref().map(str::trim).filter(|code| !code.is_empty()) {
        Some(code) => *day.languages.entry(code.to_lowercase()).or_insert(0) += 1,
        None => day.language_refused += 1,
    }
}

/// The lock EVERY test that can touch this ledger takes, including the history
/// tests — which write into it through `record_entry_with_work_mode` without
/// ever naming it.
///
/// One lock rather than one per module, because the store and the file behind it
/// are process-wide: a history test recording an entry while a ledger test
/// counts its own writes adds words to somebody else's assertion. That is not
/// hypothetical, it is what two of these tests started reporting the day the
/// history tests began contributing spoken words as well as delivered ones.
#[cfg(test)]
pub(crate) fn test_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

#[cfg(test)]
pub fn reset_for_tests() {
    if let Ok(mut guard) = ledger_store().lock() {
        *guard = None;
    }
    let _ = std::fs::remove_file(ledger_file_path());
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 2026-08-16, mid-afternoon local time.
    const AUG_16: u64 = 1_786_900_000_000;
    const DAY_MS: u64 = 24 * 60 * 60 * 1000;

    fn dictation(created_at_ms: u64, words: u64, seconds: Option<f64>) -> LedgerContribution {
        LedgerContribution {
            created_at_ms,
            words,
            spoken_words: words,
            recorded_seconds: seconds,
            speech_seconds: seconds,
            turnaround_ms: None,
            heard_ms: None,
            provider: "groq".into(),
            model: Some("whisper-large-v3-turbo".into()),
            credited: true,
            mode: Some("cleanup".into()),
            language: None,
        }
    }

    #[test]
    fn a_day_sums_its_dictations_words_and_clock_and_keeps_the_longest() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(dictation(AUG_16, 100, Some(60.0))).unwrap();
        record(dictation(AUG_16, 50, Some(240.0))).unwrap();
        /* A record that never measured itself: its words count, its silence does
           not become a zero in the denominator. */
        record(dictation(AUG_16, 4, None)).unwrap();

        let ledger = snapshot().unwrap();
        let day = ledger.days.get(&day_key(AUG_16)).expect("the day is in the ledger");
        assert_eq!(day.dictations, 3);
        assert_eq!(day.words, 154);
        assert_eq!(day.timed, 2);
        assert!((day.recorded_seconds - 300.0).abs() < 1e-6);
        assert!((day.longest_seconds - 240.0).abs() < 1e-6);
    }

    #[test]
    fn a_record_with_no_words_contributes_nothing() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(dictation(AUG_16, 0, Some(9.0))).unwrap();
        assert!(snapshot().unwrap().days.is_empty());
    }

    #[test]
    fn totals_survive_what_history_would_have_pruned() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        /* The whole reason this module exists: three hundred days apart is well
           past any retention horizon history keeps, and both still count. */
        record(dictation(AUG_16 - 300 * DAY_MS, 400, Some(120.0))).unwrap();
        record(dictation(AUG_16, 600, Some(180.0))).unwrap();

        let totals = snapshot().unwrap().totals();
        assert_eq!(totals.dictations, 2);
        assert_eq!(totals.words, 1000);
        assert_eq!(totals.timed, 2);
        assert!((totals.recorded_seconds - 300.0).abs() < 1e-6);
    }

    /// ADR 0176, and since ADR 0243 one assertion more. The horizon may shrink
    /// the FILE and may not shrink a FIGURE — and it may no longer flatten the
    /// SHAPE either, which is what this case gained when the retired day went
    /// into its month instead of into one opaque total.
    ///
    /// **IT USED TO ASSERT `retired.dictations == 1` AND THAT IS THE REVERSAL.**
    /// The old mechanism was the assertion, so the honest change was not to
    /// delete the case but to make it name the fact underneath: the day is still
    /// counted, and now it is still findable. ADR 0244 then deleted the blob it
    /// used to land in, which cost this case one assertion and no coverage —
    /// there is no longer a second place a day could have gone.
    #[test]
    fn a_day_that_ages_out_is_folded_into_its_month_rather_than_into_one_total() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        /* One row per day, one day past the horizon. The oldest is folded on
           the write that overflows the file. */
        for day in 0..=(LEDGER_DAY_ROWS as u64) {
            record(dictation(AUG_16 + day * DAY_MS, 10, Some(6.0))).unwrap();
        }

        let ledger = snapshot().unwrap();
        assert_eq!(ledger.days.len(), LEDGER_DAY_ROWS as usize);
        let oldest = day_key(AUG_16);
        let month = month_key(&oldest);
        assert_eq!(
            ledger.months.get(&month).map(|row| row.dictations),
            Some(1),
            "the oldest day went into its month and kept its place in time",
        );
        /* THE FIGURE THE WHOLE MECHANISM EXISTS FOR, unchanged by the tier it
           now travels through. */
        let totals = ledger.totals();
        assert_eq!(totals.dictations, LEDGER_DAY_ROWS as u64 + 1);
        assert_eq!(totals.words, (LEDGER_DAY_ROWS as u64 + 1) * 10);

        /* AND THE TIERS ARE DISJOINT, which is the contract every reading on the
           other side of the bridge composes against: the month that still holds
           live days answers for both, and answers once. */
        let live_in_month =
            ledger.days.keys().filter(|key| month_key(key) == month).count() as u64;
        assert!(live_in_month > 0, "the folded day's month still holds live days");
        assert_eq!(
            ledger.month_totals(&month).dictations,
            1 + live_in_month,
            "a month's figures are its row plus whatever days of it are still live",
        );

        assert_eq!(
            ledger.started_on.as_deref(),
            Some(oldest.as_str()),
            "the install date survives the prune because the totals still speak for it",
        );
    }

    #[test]
    fn the_first_day_it_saw_is_where_it_says_it_starts() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(dictation(AUG_16, 10, None)).unwrap();
        record(dictation(AUG_16 + DAY_MS, 10, None)).unwrap();

        assert_eq!(snapshot().unwrap().started_on.as_deref(), Some(day_key(AUG_16).as_str()));
    }

    #[test]
    fn it_survives_a_reload_from_disk() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(dictation(AUG_16, 42, Some(30.0))).unwrap();
        /* Drop the in-memory copy without deleting the file — the next read has
           to come back off disk. */
        if let Ok(mut guard) = ledger_store().lock() {
            *guard = None;
        }

        assert_eq!(snapshot().unwrap().totals().words, 42);
    }

    #[test]
    fn the_seed_runs_once_and_never_doubles_a_day() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        let records = [
            SeedRecord { created_at_ms: AUG_16, words: 100, spoken_words: 104, recorded_seconds: Some(60.0), turnaround_ms: Some(1200), heard_ms: None, provider: "groq".into(), model: Some("whisper-large-v3".into()), credited: true, mode: Some("cleanup".into()), language: Some("de".into()) },
            SeedRecord { created_at_ms: AUG_16, words: 50, spoken_words: 50, recorded_seconds: None, turnaround_ms: None, heard_ms: None, provider: "groq".into(), model: None, credited: true, mode: Some("cleanup".into()), language: None },
        ];
        seed_from_history(&records).unwrap();
        /* Second call, same records: a ledger with rows in it is already seeded
           and re-folding history would double every day the two share. */
        seed_from_history(&records).unwrap();

        let ledger = snapshot().unwrap();
        let totals = ledger.totals();
        assert_eq!(totals.dictations, 2);
        assert_eq!(totals.words, 150);
        assert_eq!(totals.languages.get("de").copied(), Some(1));
    }

    /// ADR 0177. History has no speech clock, so it cannot answer the question
    /// the rate now asks — and answering it with the old one would fill the
    /// histogram with runs measured against a different denominator.
    #[test]
    fn the_seed_leaves_the_rate_alone_because_history_never_timed_the_speech() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        seed_from_history(&[SeedRecord {
            created_at_ms: AUG_16,
            words: 100,
            spoken_words: 100,
            recorded_seconds: Some(60.0),
            turnaround_ms: None,
            heard_ms: None,
            provider: "groq".into(),
            model: None,
            credited: true,
            mode: Some("cleanup".into()),
            language: None,
        }])
        .unwrap();

        let ledger = snapshot().unwrap();
        assert_eq!(ledger.totals().dictations, 1, "the day is seeded");
        assert!(ledger.median_rate().is_none(), "the rate is not");
    }

    /// ADR 0178's migration. A ledger written under schema 1 has day rows and no
    /// credited fields, so time saved would read nothing on an installation with
    /// months of dictation behind it — and Home would drop back to the
    /// instruction the reader stopped needing on their first day.
    #[test]
    fn day_rows_from_before_the_credited_fields_are_filled_in_from_history() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        let path = ledger_file_path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let raw = serde_json::to_string(&serde_json::json!({
            "started_on": day_key(AUG_16),
            "days": { day_key(AUG_16): { "dictations": 2, "words": 150, "recorded_seconds": 90.0, "timed": 2 } },
        }))
        .unwrap();
        std::fs::write(&path, raw).unwrap();

        seed_from_history(&[
            SeedRecord { created_at_ms: AUG_16, words: 100, spoken_words: 104, recorded_seconds: Some(60.0), turnaround_ms: None, heard_ms: None, provider: "groq".into(), model: None, credited: true, mode: Some("cleanup".into()), language: None },
            /* Generated prose. Its words are on the day and may not be credited
               against typing (ADR 0178). */
            SeedRecord { created_at_ms: AUG_16, words: 50, spoken_words: 8, recorded_seconds: Some(30.0), turnaround_ms: None, heard_ms: None, provider: "groq".into(), model: None, credited: false, mode: Some("cleanup".into()), language: None },
        ])
        .unwrap();

        let day = snapshot().unwrap().days.get(&day_key(AUG_16)).cloned().unwrap();
        assert_eq!(day.dictations, 2, "the observations are not re-counted");
        assert_eq!(day.words, 150);
        assert_eq!(day.spoken_words, 112, "what was said is filled in");
        assert_eq!(day.saved_runs, 1);
        assert_eq!(day.saved_words, 100);
        assert!((day.saved_seconds - 60.0).abs() < 1e-6);
    }

    /// The same seed run twice. It is the one seed that writes over rows which
    /// already exist, so it clears before it accumulates — and a reader who
    /// dictates only in Agent mode leaves it with nothing to write and therefore
    /// eligible forever.
    #[test]
    fn filling_the_credited_fields_in_twice_does_not_double_them() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        let path = ledger_file_path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let raw = serde_json::to_string(&serde_json::json!({
            "started_on": day_key(AUG_16),
            "days": { day_key(AUG_16): { "dictations": 1, "words": 100, "recorded_seconds": 60.0, "timed": 1 } },
        }))
        .unwrap();
        std::fs::write(&path, raw).unwrap();

        let records = [SeedRecord {
            created_at_ms: AUG_16,
            words: 100,
            spoken_words: 104,
            recorded_seconds: Some(60.0),
            turnaround_ms: None,
            heard_ms: None,
            provider: "groq".into(),
            model: None,
            credited: true,
            mode: Some("cleanup".into()),
            language: None,
        }];
        seed_from_history(&records).unwrap();
        seed_from_history(&records).unwrap();

        let day = snapshot().unwrap().days.get(&day_key(AUG_16)).cloned().unwrap();
        assert_eq!(day.saved_runs, 1);
        assert_eq!(day.saved_words, 100);
        assert_eq!(day.spoken_words, 104);
    }

    #[test]
    fn a_histogram_written_at_another_width_is_discarded_rather_than_misread() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        /* The measured failure: a file written when a bucket was five words a
           minute, read back when a bucket is one. Bucket 17 meant "85 to 90"
           and would be read as "17" — a plausible number that is wrong by
           seventy. */
        let path = ledger_file_path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let mut stale = vec![0u32; 80];
        stale[17] = 9;
        let raw = serde_json::to_string(&serde_json::json!({
            "started_on": "2026-08-16",
            "days": {},
            "rate_buckets": stale,
            "rate_bucket_wpm": 5.0,
        }))
        .unwrap();
        std::fs::write(&path, raw).unwrap();

        let ledger = snapshot().unwrap();
        assert!(ledger.rate_buckets.iter().all(|count| *count == 0));
        assert!(ledger.median_rate().is_none());
    }

    /// ADR 0244. A ledger this build CREATES states this build's shape.
    ///
    /// Nothing on any screen shows a schema stamp, so this is a fact that can
    /// move without anybody noticing — which is what earns it a case. It used to
    /// be born at 0 and stamped on the next read, so a first run that wrote the
    /// install date and nothing else left a file claiming a shape no build has
    /// ever had. Harmless until the release that reads the stamp; this is the
    /// record's insurance against arriving at that release with it broken.
    #[test]
    fn a_ledger_created_from_nothing_states_this_builds_schema() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        let path = ledger_file_path();
        let _ = std::fs::remove_file(&path);

        assert_eq!(snapshot().unwrap().schema, LEDGER_SCHEMA);
    }

    /// **THIS CASE ASSERTED A MIGRATION AND THE MIGRATION IS GONE** (ADR 0244).
    ///
    /// It covered ADR 0177's schema arm: a rate histogram on the same axis with
    /// the same plausible counts, measuring throughput rather than the speaking
    /// rate, which the width guard cannot see and the schema stamp therefore
    /// had to. That arm was maintained for one machine — this repository's own
    /// — and it is deleted, because no installation outside it has ever held a
    /// file to convert.
    ///
    /// What it is now is the guard against that being quietly undone. The stamp
    /// is raised and the observations survive, and **nothing branches on the
    /// version it came in with.** If a later session re-adds a `schema < N` arm,
    /// this case is where the question *whose file is that for* gets asked. The
    /// answer changes at the first release build and not before — see the sister
    /// case above, which covers the guard that DID stay, because an axis width
    /// this build does not use is a defence against an edited constant rather
    /// than against an older build.
    #[test]
    fn an_older_schema_is_stamped_and_never_converted() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        let path = ledger_file_path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let mut buckets = vec![0u32; RATE_BUCKETS];
        buckets[87] = 50;
        let raw = serde_json::to_string(&serde_json::json!({
            "schema": 1,
            "started_on": "2026-08-16",
            "days": { "2026-08-16": { "dictations": 50, "words": 3325, "recorded_seconds": 2397.6, "timed": 50 } },
            "rate_buckets": buckets,
            "rate_bucket_wpm": RATE_BUCKET_WPM,
        }))
        .unwrap();
        std::fs::write(&path, raw).unwrap();

        let ledger = snapshot().unwrap();
        assert_eq!(ledger.totals().dictations, 50, "the observations survive");
        assert_eq!(ledger.schema, LEDGER_SCHEMA, "the stamp is raised");
        assert!(
            ledger.median_rate().is_some(),
            "the histogram is read as it stands — no version branch touches it",
        );
    }

    #[test]
    fn the_median_is_the_middle_run_and_an_outlier_does_not_move_it() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        /* Five runs at 60, 80, 90, 110 and one hallucinated 1800 wpm — ten words
           the recogniser invented for a third of a second. The mean of those is
           428; the middle one is 90. */
        for (words, seconds) in [(10u64, 10.0f64), (20, 15.0), (30, 20.0), (110, 60.0), (10, 0.33)] {
            record(dictation(AUG_16, words, Some(seconds))).unwrap();
        }

        let median = snapshot().unwrap().median_rate().expect("five runs have a middle one");
        assert!((median - 90.0).abs() < 1.5, "median was {median}");
    }

    /// ADR 0177. The rate divides what was SAID by how long it was SAID FOR —
    /// not what a model wrote, and not how long the microphone was open.
    #[test]
    fn the_rate_reads_the_spoken_words_over_the_speech_clock() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        /* Sixty seconds of open microphone, twenty of them thinking. Ninety
           words were spoken and Prompt Enhance delivered nine hundred. The
           throughput reading is 900 wpm, the old honest one 90, and the true
           speaking rate 135. */
        record(LedgerContribution {
            created_at_ms: AUG_16,
            words: 900,
            spoken_words: 90,
            recorded_seconds: Some(60.0),
            speech_seconds: Some(40.0),
            turnaround_ms: None,
            heard_ms: None,
            provider: "groq".into(),
            model: Some("whisper-large-v3-turbo".into()),
            credited: false,
            mode: Some("cleanup".into()),
            language: None,
        })
        .unwrap();

        let median = snapshot().unwrap().median_rate().expect("one run has a middle");
        assert!((median - 135.0).abs() < 1.5, "median was {median}");
    }

    /// ADR 0178. A generated essay was never dictated and would never have been
    /// typed, so it may not be credited against a typing baseline.
    #[test]
    fn a_generative_mode_contributes_words_and_no_saved_time() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(LedgerContribution {
            created_at_ms: AUG_16,
            words: 900,
            spoken_words: 90,
            recorded_seconds: Some(60.0),
            speech_seconds: Some(40.0),
            turnaround_ms: None,
            heard_ms: None,
            provider: "groq".into(),
            model: Some("whisper-large-v3-turbo".into()),
            credited: false,
            mode: Some("cleanup".into()),
            language: None,
        })
        .unwrap();
        record(dictation(AUG_16, 100, Some(60.0))).unwrap();

        let day = snapshot().unwrap().days.get(&day_key(AUG_16)).cloned().unwrap();
        assert_eq!(day.words, 1000, "both delivered their words");
        assert_eq!(day.saved_runs, 1, "one of them may be credited");
        assert_eq!(day.saved_words, 100);
        assert!(
            (day.saved_seconds - 60.0).abs() < 1e-6,
            "and its seconds come from the same run as its words",
        );
    }

    /// ADR 0178's other half: the numerator and the denominator come from one
    /// set of runs, so an untimed record cannot add words to a figure whose
    /// seconds it never contributed to.
    #[test]
    fn an_untimed_record_adds_no_words_to_the_saved_figure() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(dictation(AUG_16, 100, Some(60.0))).unwrap();
        record(dictation(AUG_16, 500, None)).unwrap();

        let day = snapshot().unwrap().days.get(&day_key(AUG_16)).cloned().unwrap();
        assert_eq!(day.words, 600);
        assert_eq!(day.saved_words, 100);
        assert_eq!(day.saved_runs, 1);
    }


    /// One timed run, from a named recogniser. ADR 0240.
    /// One dictation that came back in a named language, or in none.
    fn spoken(created_at_ms: u64, language: Option<&str>) -> LedgerContribution {
        LedgerContribution {
            language: language.map(str::to_string),
            ..dictation(created_at_ms, 10, Some(6.0))
        }
    }

    fn timed(
        created_at_ms: u64,
        provider: &str,
        model: Option<&str>,
        turnaround_ms: u64,
    ) -> LedgerContribution {
        split(created_at_ms, provider, model, turnaround_ms, None)
    }

    /// The same dictation with its stage split stated. `None` is a run counted
    /// before the split was measured, which is every run this machine already
    /// holds.
    fn split(
        created_at_ms: u64,
        provider: &str,
        model: Option<&str>,
        turnaround_ms: u64,
        heard_ms: Option<u64>,
    ) -> LedgerContribution {
        LedgerContribution {
            created_at_ms,
            words: 100,
            spoken_words: 100,
            recorded_seconds: Some(60.0),
            speech_seconds: Some(40.0),
            turnaround_ms: Some(turnaround_ms),
            heard_ms,
            provider: provider.into(),
            model: model.map(str::to_string),
            credited: true,
            mode: Some("cleanup".into()),
            language: None,
        }
    }

    fn cause_runs(ledger: &ActivityLedger, key: &str) -> u64 {
        ledger
            .turnaround_causes
            .get(key)
            .map(|cause| cause.buckets.iter().map(|count| *count as u64).sum())
            .unwrap_or_default()
    }

    /// ADR 0240. The two structures are written under one condition, so a reader
    /// who adds the rows up gets the histogram back — not almost.
    #[test]
    fn every_wait_lands_in_its_recognisers_row_and_in_the_all_time_one() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(timed(AUG_16, "groq", Some("whisper-large-v3-turbo"), 800)).unwrap();
        record(timed(AUG_16, "groq", Some("whisper-large-v3-turbo"), 900)).unwrap();
        record(timed(AUG_16, "groq", Some("whisper-large-v3"), 5_800)).unwrap();
        record(timed(AUG_16, "openai", Some("whisper-large-v3-turbo"), 1_100)).unwrap();
        /* No clock, so it belongs in neither. */
        record(dictation(AUG_16, 100, Some(60.0))).unwrap();

        let ledger = snapshot().unwrap();
        let histogram: u64 = ledger.turnaround_buckets.iter().map(|count| *count as u64).sum();
        let rows: u64 = ledger
            .turnaround_causes
            .values()
            .map(|cause| cause.buckets.iter().map(|count| *count as u64).sum::<u64>())
            .sum();
        assert_eq!(histogram, 4, "four runs carried a clock");
        assert_eq!(rows, histogram, "the rows sum to the histogram");

        assert_eq!(cause_runs(&ledger, "groq/whisper-large-v3-turbo"), 2);
        assert_eq!(cause_runs(&ledger, "groq/whisper-large-v3"), 1);
        /* THE SAME MODEL NAME UNDER TWO VENDORS IS TWO ROWS, which is the whole
           reason the key carries the provider: the reporting machine really does
           run `whisper-large-v3-turbo` on both, at 0.8 s and at 1.1 s. */
        assert_eq!(cause_runs(&ledger, "openai/whisper-large-v3-turbo"), 1);

        let slow = ledger.turnaround_causes.get("groq/whisper-large-v3").unwrap();
        assert_eq!(
            median_of(&slow.buckets, TURNAROUND_BUCKET_MS),
            Some(5_800.0),
            "the row is read on the same axis as the bands above it",
        );
    }

    /// ADR 0247. A wait that was measured in two stages is filed as two stages,
    /// and the row that hears is not the row that rewrites.
    ///
    /// THIS IS THE CASE THE SURFACE USED TO GET WRONG WITHOUT SAYING SO. Both
    /// cause maps held the same end-to-end figure, so a 1.2 s dictation put 1.2 s
    /// against the recogniser AND 1.2 s against the mode — two rows, one number,
    /// and a reader comparing them was comparing a figure with itself.
    #[test]
    fn a_measured_wait_splits_into_the_hearing_and_the_rewriting() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(split(AUG_16, "groq", Some("whisper-large-v3-turbo"), 1_200, Some(700))).unwrap();

        let ledger = snapshot().unwrap();
        let row = ledger.turnaround_causes.get("groq/whisper-large-v3-turbo").unwrap();
        assert_eq!(
            median_of(&row.buckets, TURNAROUND_BUCKET_MS),
            Some(1_200.0),
            "the whole wait is still the whole wait",
        );
        assert_eq!(
            median_of(&row.heard_buckets, TURNAROUND_BUCKET_MS),
            Some(700.0),
            "the recogniser is charged only for the part it was there for",
        );
        assert_eq!(
            median_of(ledger.mode_transform_causes.get("cleanup").unwrap(), TURNAROUND_BUCKET_MS),
            Some(500.0),
            "and the mode is charged the remainder rather than the total",
        );
        assert_eq!(
            median_of(ledger.mode_causes.get("cleanup").unwrap(), TURNAROUND_BUCKET_MS),
            Some(1_200.0),
            "while the end-to-end cut keeps reporting end to end",
        );
    }

    /// A run counted before the split existed leaves the stage histograms EMPTY,
    /// and that is the whole distinction the surface reads.
    ///
    /// Nought is a reading — Verbatim genuinely rewrites in no time — so a run
    /// that was never measured may not be counted as an instant one. Filed as
    /// zero it would drag every median on the machine towards nothing and the
    /// column would look measured.
    #[test]
    fn a_wait_with_no_split_measured_is_absent_from_the_stages_rather_than_nought() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(split(AUG_16, "groq", Some("whisper-large-v3-turbo"), 1_200, None)).unwrap();

        let ledger = snapshot().unwrap();
        let row = ledger.turnaround_causes.get("groq/whisper-large-v3-turbo").unwrap();
        assert_eq!(row.buckets.iter().map(|count| *count as u64).sum::<u64>(), 1);
        assert!(
            row.heard_buckets.iter().all(|count| *count == 0),
            "the recogniser's own share was never measured, so nothing is claimed about it",
        );
        assert!(
            ledger.mode_transform_causes.get("cleanup").is_none(),
            "and the mode's share is a row that does not exist rather than a row of nought",
        );
    }

    /// ONE ROW, TWO POPULATIONS — the state every installation is in from the
    /// day the split ships until the day its old runs age out, and neither of
    /// the two cases above it.
    ///
    /// The surface prints both counts because of what this asserts: the total
    /// histogram carries every run and the stage histogram carries only the ones
    /// that measured a stage, in ONE row, so a median off each is a median over a
    /// different set. Read as though they shared a denominator, `heard in`
    /// subtracted from `in total` is a rewriting time nobody measured.
    #[test]
    fn one_row_can_hold_more_runs_than_it_holds_splits() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(split(AUG_16, "groq", Some("whisper-large-v3-turbo"), 1_200, None)).unwrap();
        record(split(AUG_16, "groq", Some("whisper-large-v3-turbo"), 1_200, None)).unwrap();
        record(split(AUG_16, "groq", Some("whisper-large-v3-turbo"), 1_000, Some(600))).unwrap();

        let ledger = snapshot().unwrap();
        let row = ledger.turnaround_causes.get("groq/whisper-large-v3-turbo").unwrap();
        assert_eq!(
            row.buckets.iter().map(|count| *count as u64).sum::<u64>(),
            3,
            "every run is in the total, split or not",
        );
        assert_eq!(
            row.heard_buckets.iter().map(|count| *count as u64).sum::<u64>(),
            1,
            "and only the measured one is in the stage",
        );
        assert_eq!(
            median_of(&row.heard_buckets, TURNAROUND_BUCKET_MS),
            Some(600.0),
            "the stage median is read off the runs that have one and not off the rest",
        );
        assert_eq!(
            ledger
                .mode_transform_causes
                .get("cleanup")
                .map(|buckets| buckets.iter().map(|count| *count as u64).sum::<u64>()),
            Some(1),
            "the mode cut counts the same one, so the two cuts agree on what is missing",
        );
    }

    /// A lane that names no model still has a vendor, and the vendor is the
    /// coarser true answer. Dropping the run instead would break the sum.
    #[test]
    fn a_run_with_no_model_name_is_filed_under_its_provider() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(timed(AUG_16, "local", None, 2_000)).unwrap();
        record(timed(AUG_16, "local", Some("   "), 2_100)).unwrap();

        let ledger = snapshot().unwrap();
        assert_eq!(cause_runs(&ledger, "local/local"), 2, "both under the vendor");
        let row = ledger.turnaround_causes.get("local/local").unwrap();
        assert_eq!(row.provider, "local");
        assert_eq!(row.model, "local");
    }

    /// The key comes off the wire, so the map is bounded. Past the bound the
    /// pairs already known keep counting — a new name may not evict a history
    /// somebody has — **and the run is counted under `other` rather than
    /// dropped (ADR 0243)**, so the rows go on summing to the histogram at every
    /// age of the installation.
    ///
    /// THE ASSERTION THAT INVERTED IS THE LAST ONE. It used to say a pair past
    /// the bound is *dropped, not swapped in*, and dropped is what made the
    /// display's own claim quietly false. Both halves of the old rule survive:
    /// nothing is evicted, and nothing new takes a named slot.
    #[test]
    fn the_cause_map_stops_naming_at_its_bound_and_never_stops_counting() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        let overflow = 12;
        for index in 0..(MAX_CAUSE_KEYS + overflow) {
            record(timed(AUG_16, "groq", Some(&format!("model-{index}")), 1_000)).unwrap();
        }
        record(timed(AUG_16, "groq", Some("model-0"), 1_000)).unwrap();

        let ledger = snapshot().unwrap();
        let named = ledger
            .turnaround_causes
            .keys()
            .filter(|key| key.as_str() != OTHER_CAUSE_KEY)
            .count();
        assert_eq!(named, MAX_CAUSE_KEYS, "the NAMED rows are what is bounded");
        assert_eq!(cause_runs(&ledger, "groq/model-0"), 2, "a known pair still counts");
        assert!(
            !ledger.turnaround_causes.contains_key("groq/model-70"),
            "a pair that arrived past the bound is not swapped in",
        );
        assert_eq!(
            cause_runs(&ledger, OTHER_CAUSE_KEY),
            overflow as u64,
            "every run past the bound is counted somewhere",
        );

        /* THE FACT THE CHANGE EXISTS FOR, and the one the screen states: the
           rows sum to the histogram. Nothing else in this case would notice if
           they stopped. */
        let rows: u64 = ledger
            .turnaround_causes
            .values()
            .map(|cause| cause.buckets.iter().map(|count| *count as u64).sum::<u64>())
            .sum();
        let histogram: u64 = ledger.turnaround_buckets.iter().map(|count| *count as u64).sum();
        assert_eq!(rows, histogram, "the rows sum to the all-time histogram");
    }

    /// ADR 0243, rewritten by ADR 0244. *Not named* was one counter over two
    /// populations, and the split is what made the label sayable. The THIRD
    /// population this case used to assert — the runs nothing ever asked about
    /// — is gone with the legacy data it only ever described.
    ///
    /// **WHAT REPLACED IT IS THE IDENTITY THAT MADE IT REMOVABLE**, and it is
    /// worth a case of its own because a surface now states a denominator built
    /// on it: every counted dictation increments EXACTLY ONE of the two halves,
    /// so `named + refused` is the count of runs a language was asked of, and on
    /// the live path that is every run there is. A future path that counts a
    /// dictation without asking would break the screen's arithmetic silently,
    /// and this is what would catch it.
    #[test]
    fn every_counted_dictation_lands_in_exactly_one_half_of_the_language_split() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(spoken(AUG_16, Some("de"))).unwrap();
        record(spoken(AUG_16, Some("de"))).unwrap();
        record(spoken(AUG_16, Some("en"))).unwrap();
        /* Asked and came back empty — too short for either instrument to name. */
        record(spoken(AUG_16, None)).unwrap();
        /* A blank is not a language, and it is not a fifth population either. */
        record(spoken(AUG_16, Some("   "))).unwrap();

        let ledger = snapshot().unwrap();
        let day = ledger.days.get(&day_key(AUG_16)).unwrap();
        assert_eq!(day.languages.get("de").copied(), Some(2));
        assert_eq!(day.languages.get("en").copied(), Some(1));
        assert_eq!(day.language_refused, 2, "the empty verdict and the blank");

        let named: u64 = day.languages.values().sum();
        assert_eq!(
            named + day.language_refused,
            day.dictations,
            "the two halves account for every dictation the day counted",
        );

        /* AND THE IDENTITY SURVIVES A FOLD, which is what lets a month row carry
           the same denominator a day row does. */
        let totals = ledger.totals();
        let named_all: u64 = totals.languages.values().sum();
        assert_eq!(named_all + totals.language_refused, totals.dictations);
    }

    /// ADR 0243. A period's wait shape is a log histogram, and a histogram read
    /// off the wrong axis is the plausible wrong number this module exists
    /// against — the same failure the `rate_bucket_wpm` note records, one
    /// structure further in.
    #[test]
    fn a_periods_turnaround_keeps_a_mean_and_a_median_that_survive_a_fold() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        for milliseconds in [400u64, 800, 1_200, 1_600, 30_000] {
            record(timed(AUG_16, "groq", Some("whisper"), milliseconds)).unwrap();
        }

        let ledger = snapshot().unwrap();
        let day = ledger.days.get(&day_key(AUG_16)).unwrap().clone();
        assert_eq!(day.turnaround_runs, 5);
        assert_eq!(day.turnaround_ms_sum, 34_000, "the mean is exact, not binned");

        /* THE MIDDLE RUN IS 1,200 ms, and a quarter-octave bucket is 19% wide —
           so the median is at or just below it and never above any run that
           actually happened. */
        let median = day.median_turnaround_ms().unwrap();
        assert!(median <= 1_200.0 && median > 1_200.0 * 0.82, "median {median} off the log axis");

        /* THE OUTLIER IS HELD AT THE EDGE RATHER THAN DROPPED, so it counts as
           one run and cannot drag the median — the rate histogram's rule, and
           the reason a mean and a median are both kept. */
        assert_eq!(
            day.turnaround_log.iter().map(|count| *count as u64).sum::<u64>(),
            5,
            "every run is in a bucket, the 30-second one included",
        );

        /* AND IT FOLDS. A month is a day plus a day, and the median of the fold
           is read off the same axis — which is the property that lets a day
           become a month and a month a year without the reading changing what it
           means. */
        let mut folded = day.clone();
        folded.absorb(&day);
        assert_eq!(folded.turnaround_runs, 10);
        assert_eq!(folded.median_turnaround_ms(), day.median_turnaround_ms());
    }

    /// ADR 0243. A field that did not exist may not be drawn as a zero, and the
    /// stamp is what a chart asks. The merge takes the EARLIER one, for the same
    /// reason `started_on` does.
    #[test]
    fn an_accumulator_says_which_day_it_started_being_measured() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(timed(AUG_16 + 3 * DAY_MS, "groq", Some("whisper"), 900)).unwrap();
        let ledger = snapshot().unwrap();
        let stamped = day_key(AUG_16 + 3 * DAY_MS);
        assert_eq!(ledger.measured_from("turnaround_runs"), Some(stamped.as_str()));
        assert_eq!(ledger.measured_from("languages"), Some(stamped.as_str()));
        assert_eq!(ledger.measured_from("nothing_named_this"), None);

        let mut archive = ActivityLedger::default();
        archive
            .measured_from
            .insert("turnaround_runs".into(), day_key(AUG_16));
        merge_from_archive(&archive).unwrap();
        assert_eq!(
            snapshot().unwrap().measured_from("turnaround_runs"),
            Some(day_key(AUG_16).as_str()),
            "an archive that measured it sooner moves the stamp back",
        );
    }

    /// ADR 0243. The one file that cannot be rebuilt is written through a
    /// rename, and leaves no sibling behind — the same shape `compact_journal`
    /// uses for the index, which is the collection that CAN be rebuilt.
    #[test]
    fn the_ledger_is_written_through_a_temporary_and_lands_minified() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(dictation(AUG_16, 10, Some(6.0))).unwrap();

        let path = ledger_file_path();
        let raw = std::fs::read_to_string(&path).unwrap();
        assert!(
            !path.with_extension("json.tmp").exists(),
            "the temporary is renamed away, not left beside the ledger",
        );
        assert!(!raw.contains("\n  "), "written minified, not pretty-printed");
        assert!(
            serde_json::from_str::<ActivityLedger>(&raw).is_ok(),
            "and it is still a ledger",
        );
    }

    /// ADR 0243. Seconds are stored at the precision a second is worth, so a
    /// figure the screen reports in minutes stops carrying nine digits of float
    /// noise into a file kept forever.
    #[test]
    fn seconds_are_stored_to_the_millisecond_and_no_further() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(dictation(AUG_16, 10, Some(1.0 / 3.0))).unwrap();
        record(dictation(AUG_16, 10, Some(1.0 / 3.0))).unwrap();

        let ledger = snapshot().unwrap();
        let day = ledger.days.get(&day_key(AUG_16)).unwrap();
        /* 0.666 AND NOT 0.667, WHICH IS THE ROUNDING BEING ON THE ACCUMULATE
           RATHER THAN ON THE WRITE: each 0.3333… lands as 0.333 and the sum of
           two of them is 0.666. A millisecond per addition, unbiased, so a
           lifetime of dictations wanders by a fraction of a second on a figure
           reported in minutes — and in exchange what is in memory is exactly
           what is on disk, which is the property a test reading either one
           depends on. */
        assert_eq!(day.recorded_seconds, 0.666);
        let raw = std::fs::read_to_string(ledger_file_path()).unwrap();
        assert!(
            !raw.contains("0.6666666"),
            "the file carries the measurement and not the float's shape",
        );
    }

    /// The reserved key cannot be minted by a provider (ADR 0243). Every real
    /// key carries a slash; a vendor literally called `other` still lands under
    /// `other/other` and leaves the overflow bucket alone.
    #[test]
    fn a_provider_called_other_cannot_collide_with_the_overflow_row() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(timed(AUG_16, OTHER_CAUSE_KEY, Some(OTHER_CAUSE_KEY), 1_000)).unwrap();

        let ledger = snapshot().unwrap();
        assert_eq!(cause_runs(&ledger, "other/other"), 1);
        assert!(!ledger.turnaround_causes.contains_key(OTHER_CAUSE_KEY));
    }

    /// ADR 0179 one level down. Importing the same archive twice may not double
    /// a row, and importing one this machine has never seen takes it whole.
    #[test]
    fn a_merge_raises_a_recognisers_row_and_never_doubles_it() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(timed(AUG_16, "groq", Some("whisper-large-v3-turbo"), 800)).unwrap();
        record(timed(AUG_16, "openai", Some("whisper-large-v3-turbo"), 1_100)).unwrap();
        let archive = snapshot().unwrap();

        reset_for_tests();
        record(timed(AUG_16, "groq", Some("whisper-large-v3-turbo"), 800)).unwrap();
        merge_from_archive(&archive).unwrap();
        merge_from_archive(&archive).unwrap();

        let ledger = snapshot().unwrap();
        assert_eq!(
            cause_runs(&ledger, "groq/whisper-large-v3-turbo"),
            1,
            "the same bucket at one on both sides raises to one, not two",
        );
        assert_eq!(
            cause_runs(&ledger, "openai/whisper-large-v3-turbo"),
            1,
            "a pair only the archive had is taken whole",
        );
    }

    /// ADR 0240. On every machine that dictated before the map existed the
    /// histogram is already full, and the shared turnaround flag would skip the
    /// seed on exactly those installations.
    #[test]
    fn the_seed_fills_the_causes_on_a_ledger_whose_histogram_is_already_full() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(timed(AUG_16, "groq", Some("whisper-large-v3-turbo"), 800)).unwrap();
        {
            let mut guard = ledger_store().lock().unwrap_or_else(|error| error.into_inner());
            let ledger = guard.as_mut().expect("the run above wrote one");
            ledger.turnaround_causes.clear();
        }

        seed_from_history(&[SeedRecord {
            created_at_ms: AUG_16,
            words: 100,
            spoken_words: 100,
            recorded_seconds: Some(60.0),
            turnaround_ms: Some(1_200),
            heard_ms: None,
            provider: "groq".into(),
            model: Some("whisper-large-v3".into()),
            credited: true,
            mode: Some("cleanup".into()),
            language: Some("de".into()),
        }])
        .unwrap();

        let ledger = snapshot().unwrap();
        assert_eq!(cause_runs(&ledger, "groq/whisper-large-v3"), 1, "the causes seeded");
        assert_eq!(
            ledger.totals().dictations,
            1,
            "and the day rows it already had were not folded a second time",
        );
    }

    /// ADR 0179. The ordinary reason to import is a restore, and the ordinary
    /// archive came off this same machine.
    #[test]
    fn a_merge_raises_and_never_doubles() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(dictation(AUG_16, 100, Some(60.0))).unwrap();
        let archive = snapshot().unwrap();

        merge_from_archive(&archive).unwrap();
        merge_from_archive(&archive).unwrap();

        let totals = snapshot().unwrap().totals();
        assert_eq!(totals.dictations, 1, "the same archive twice is still one day");
        assert_eq!(totals.words, 100);
    }

    #[test]
    fn a_merge_takes_the_deeper_of_two_records() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(dictation(AUG_16, 100, Some(60.0))).unwrap();

        let mut archive = ActivityLedger {
            schema: LEDGER_SCHEMA,
            started_on: Some(day_key(AUG_16 - 400 * DAY_MS)),
            rate_bucket_wpm: RATE_BUCKET_WPM,
            turnaround_bucket_ms: TURNAROUND_BUCKET_MS,
            ..ActivityLedger::default()
        };
        archive.days.insert(
            day_key(AUG_16 - 400 * DAY_MS),
            LedgerDay { dictations: 7, words: 900, ..LedgerDay::default() },
        );
        /* The same day the local file has, but recorded when it held more. */
        archive.days.insert(
            day_key(AUG_16),
            LedgerDay { dictations: 3, words: 400, ..LedgerDay::default() },
        );
        merge_from_archive(&archive).unwrap();

        let ledger = snapshot().unwrap();
        let totals = ledger.totals();
        assert_eq!(totals.dictations, 10, "7 from the archive's day, 3 from the raised one");
        assert_eq!(totals.words, 1300);
        assert_eq!(
            ledger.started_on.as_deref(),
            Some(day_key(AUG_16 - 400 * DAY_MS).as_str()),
            "an archive that reaches further back moves the install date back",
        );
    }

    /// The reset is the ONE door that lowers these figures, and it has to leave
    /// a file behind — an absent one would be re-seeded from history on the next
    /// read and hand back a fraction of what was just cleared.
    #[test]
    fn a_reset_clears_the_figures_and_leaves_a_ledger_that_will_not_reseed() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(dictation(AUG_16, 100, Some(60.0))).unwrap();
        reset_activity_ledger().unwrap();

        let after = snapshot().unwrap();
        assert!(after.days.is_empty());
        assert_eq!(after.totals().words, 0);
        assert!(after.started_on.is_none());
        /* ADR 0190. The one field the reset does not take: it is about what was
           RECORDED, and when the product arrived is not a recording. */
        assert!(after.installed_on.is_some(), "the install date survives a reset");
        assert!(ledger_file_path().exists(), "the file is replaced, not removed");

        /* The failure this stamp exists against: clearing the figures while the
           records that produced them are still on disk, and having Home fold
           them straight back in on the next open. */
        seed_from_history(&[SeedRecord {
            created_at_ms: AUG_16,
            words: 100,
            spoken_words: 100,
            recorded_seconds: Some(60.0),
            turnaround_ms: Some(900),
            heard_ms: None,
            provider: "groq".into(),
            model: Some("whisper-large-v3".into()),
            credited: true,
            mode: Some("cleanup".into()),
            language: Some("de".into()),
        }])
        .unwrap();
        assert_eq!(
            snapshot().unwrap().totals().words,
            0,
            "a reset ledger never seeds again — it counts from the next dictation",
        );
    }

    #[test]
    fn a_corrupt_file_is_replaced_rather_than_failing_the_read() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        let path = ledger_file_path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        std::fs::write(&path, "{ not json at all").unwrap();

        /* Derived bookkeeping. Refusing to dictate because an aggregate will not
           parse would trade the product for its statistics. */
        assert!(snapshot().unwrap().days.is_empty());
    }
}
