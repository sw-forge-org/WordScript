//! THE ONE THING HISTORY CANNOT BE: A RECORD THAT DOES NOT FORGET.
//!
//! `history.json` is pruned on every read, by age (`history_retention_days`) and
//! by count (`history_limit`). That is correct for what it is — a list of
//! records you can open, retry and delete, which has to stay a size a person can
//! live with. It is also why nothing built on top of it can be lifetime-scoped:
//! a total summed from a pruned list grows, sticks at the limit, and then runs
//! BACKWARDS as the oldest records fall off. A counter that goes down is a
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
//! CARE (ADR 0176). Day rows still age out past `LEDGER_RETENTION_DAYS` — a file
//! on a machine somebody keeps for a decade may not grow without bound — but a
//! row that ages out is ADDED INTO `retired` on its way out instead of being
//! dropped. `totals()` is `retired` plus the days still held, so it is monotone
//! by construction: there is no sequence of writes, prunes or restarts that can
//! make it smaller. Deleting history does not touch this file, and neither does
//! deleting a single transcript. The one door that lowers these figures is the
//! reset in Privacy & Data, which is a button a person presses on purpose.
//!
//! THE FIRST DAY IT SAW IS THE INSTALL DATE, as far as anything can honestly
//! say. Nothing in this product recorded when it was installed, so `started_on`
//! is the day this ledger first wrote a row — and unlike the pre-0176 build it
//! now SURVIVES the prune, because `retired` still speaks for the days behind
//! it. What may not span that far is the CALENDAR, which draws day rows and
//! therefore draws only what `days` still holds (ADR 0172).

use std::{
    collections::BTreeMap,
    path::PathBuf,
    sync::{Mutex, OnceLock},
};

use serde::{Deserialize, Serialize};

use super::paths::user_data_dir;

/// How many days of rows are kept. Two years and a bit: long enough that no
/// display this product will ever draw runs off the end, short enough that the
/// file cannot grow without bound on a machine somebody keeps for a decade.
///
/// A row that ages out is retired into `retired` rather than dropped, so this
/// horizon bounds the FILE and never the FIGURES.
const LEDGER_RETENTION_DAYS: i64 = 800;

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
const LEDGER_SCHEMA: u32 = 2;

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
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ActivityLedger {
    /// What the derived counts in this file mean — see `LEDGER_SCHEMA`.
    #[serde(default)]
    pub schema: u32,
    /// `YYYY-MM-DD` of the first row ever written. It survives the prune because
    /// `retired` still speaks for the days behind it.
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
    /// Every day that has aged out of `days`, summed. The reason a total can
    /// promise never to fall (ADR 0176).
    #[serde(default)]
    pub retired: LedgerDay,
    /// The last day `retired` speaks for, so a surface can say where the
    /// day-by-day record starts without claiming the totals start there too.
    #[serde(default)]
    pub retired_through: Option<String>,
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
    /// How many dictations came back in each language, all time, keyed by the
    /// two-letter code (ADR 0180).
    ///
    /// THE LANGUAGE OF THE TEXT AND NOT OF THE SETTING. `entry.language` is the
    /// configured hint, so counting it would count how often somebody changed a
    /// dropdown. This is measured on the delivered text by
    /// `core::language_detect`, which is why it works on the lanes that never
    /// report one — Groq and the local runtime among them.
    #[serde(default)]
    pub languages: BTreeMap<String, u64>,
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

    fn add_turnaround(&mut self, milliseconds: u64) {
        if self.turnaround_buckets.len() != TURNAROUND_BUCKETS {
            self.turnaround_buckets = vec![0; TURNAROUND_BUCKETS];
        }
        self.turnaround_bucket_ms = TURNAROUND_BUCKET_MS;
        let index =
            ((milliseconds as f64 / TURNAROUND_BUCKET_MS) as usize).min(TURNAROUND_BUCKETS - 1);
        self.turnaround_buckets[index] += 1;
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
    pub fn totals(&self) -> LedgerDay {
        let mut total = self.retired.clone();
        for day in self.days.values() {
            total.absorb(day);
        }
        total
    }

    /// Raise every figure here to the larger of itself and the archive's
    /// (ADR 0179). Used by the import and by nothing else.
    pub fn raise_to(&mut self, other: &ActivityLedger) {
        for (key, row) in &other.days {
            self.days.entry(key.clone()).or_default().raise_to(row);
        }
        self.retired.raise_to(&other.retired);
        if let Some(through) = &other.retired_through {
            if self.retired_through.as_deref().map_or(true, |own| own < through.as_str()) {
                self.retired_through = Some(through.clone());
            }
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
        for (code, count) in &other.languages {
            let own = self.languages.entry(code.clone()).or_insert(0);
            *own = (*own).max(*count);
        }
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
        return ActivityLedger::default();
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

    /* SCHEMA 1 COUNTED A DIFFERENT QUANTITY AT THE SAME WIDTH, which the guard
       above cannot see: the axis is identical and every count is plausible. Its
       rate histogram is throughput over the open microphone, and this build's is
       the speaking rate; one run of each in the same distribution is a median
       that belongs to neither. It is dropped rather than converted, because the
       conversion factor is the pause share and nothing recorded it. */
    if ledger.schema < 2 {
        ledger.rate_buckets = Vec::new();
    }
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

fn write_to_disk(ledger: &ActivityLedger) -> Result<(), String> {
    let path = ledger_file_path();
    let raw = serde_json::to_string_pretty(ledger).map_err(|error| error.to_string())?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    std::fs::write(path, raw).map_err(|error| error.to_string())
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
    /// Whether this record's mode may be credited against a typing baseline.
    pub credited: bool,
    /// The language measured on the delivered text, not the configured one.
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
    /// False for the modes that GENERATE text rather than tidy it — Agent and
    /// Prompt Enhance. Their output may not be credited against typing, because
    /// nobody would have typed it (ADR 0178).
    pub credited: bool,
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
        day.recorded_seconds += seconds;
        day.timed += 1;
        day.longest_seconds = day.longest_seconds.max(seconds);
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
        day.speech_seconds += seconds;
        day.voiced += 1;
    }

    /* THE THREE FIELDS TIME SAVED READS, WRITTEN AS ONE GROUP. Words and seconds
       from the SAME run or neither, so the figure can never divide one set of
       runs by another (ADR 0178). */
    if contribution.credited && contribution.words > 0 {
        if let Some(seconds) = recorded {
            day.saved_runs += 1;
            day.saved_words += contribution.words;
            day.saved_seconds += seconds;
        }
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
    }
    if let Some(code) = contribution.language.as_deref() {
        let code = code.trim().to_lowercase();
        if !code.is_empty() {
            *ledger.languages.entry(code).or_insert(0) += 1;
        }
    }

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

/// Retire rows past the retention horizon into the all-time totals.
///
/// THE ROW LEAVES AND THE FIGURES DO NOT (ADR 0176). Before this, a pruned day
/// was simply removed, which meant every lifetime total silently began falling
/// after two years and two months of use — the exact failure this module was
/// built to prevent, reintroduced by the code that keeps the file small.
fn prune(ledger: &mut ActivityLedger) {
    if ledger.days.len() as i64 <= LEDGER_RETENTION_DAYS {
        return;
    }
    let excess = ledger.days.len() - LEDGER_RETENTION_DAYS as usize;
    let doomed: Vec<String> = ledger.days.keys().take(excess).cloned().collect();
    for key in doomed {
        if let Some(day) = ledger.days.remove(&key) {
            ledger.retired.absorb(&day);
            ledger.retired_through = Some(key);
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
                    credited: super::history::mode_credits_typing(entry.effective_mode.as_ref()),
                    /* THE SPOKEN TEXT AND THE SAME RULE THE LIVE PATH USES
                       (ADR 0188), through the same function — a second place
                       deciding what a record's language is would be a second
                       place to decide it differently. The seed has no model
                       answer to pass: nothing stores one, so a rebuilt ledger
                       re-measures with the offline detector alone. */
                    language: super::history::contributed_language(
                        None,
                        entry
                            .raw_transcript
                            .as_deref()
                            .map(str::trim)
                            .filter(|raw| !raw.is_empty())
                            .unwrap_or(delivered),
                        entry.effective_mode.as_ref(),
                    ),
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
        || ledger.languages.is_empty()
        || needs_credited_seed(ledger)
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

    /* THREE SEEDS, BECAUSE EACH ARRIVED AFTER THE DAYS DID. A ledger written
       before the turnaround existed has rows but no distribution, and re-folding
       its days would double every one of them — so each case fills its own
       structure ALONE. All three are idempotent and none runs twice. */
    let seed_days = ledger.days.is_empty();
    let seed_turnarounds = ledger.turnaround_buckets.iter().all(|count| *count == 0);
    let seed_languages = ledger.languages.is_empty();
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
                day.recorded_seconds += value;
                day.timed += 1;
                day.longest_seconds = day.longest_seconds.max(value);
                if record.credited && record.words > 0 {
                    day.saved_runs += 1;
                    day.saved_words += record.words;
                    day.saved_seconds += value;
                }
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
        if seed_languages {
            if let Some(code) = record.language.as_deref() {
                let code = code.trim().to_lowercase();
                if !code.is_empty() {
                    *ledger.languages.entry(code).or_insert(0) += 1;
                }
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
    write_to_disk(ledger)
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
            credited: true,
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

    /// ADR 0176. The retention horizon may shrink the FILE and may not shrink a
    /// FIGURE — before this, every lifetime total began falling after 800 days.
    #[test]
    fn a_day_that_ages_out_is_retired_into_the_totals_rather_than_dropped() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        /* One row per day, one day past the horizon. The oldest is retired on
           the write that overflows the file. */
        for day in 0..=(LEDGER_RETENTION_DAYS as u64) {
            record(dictation(AUG_16 + day * DAY_MS, 10, Some(6.0))).unwrap();
        }

        let ledger = snapshot().unwrap();
        assert_eq!(ledger.days.len(), LEDGER_RETENTION_DAYS as usize);
        assert_eq!(ledger.retired.dictations, 1, "the oldest day was retired");
        let totals = ledger.totals();
        assert_eq!(totals.dictations, LEDGER_RETENTION_DAYS as u64 + 1);
        assert_eq!(totals.words, (LEDGER_RETENTION_DAYS as u64 + 1) * 10);
        assert_eq!(
            ledger.started_on.as_deref(),
            Some(day_key(AUG_16).as_str()),
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
            SeedRecord { created_at_ms: AUG_16, words: 100, spoken_words: 104, recorded_seconds: Some(60.0), turnaround_ms: Some(1200), credited: true, language: Some("de".into()) },
            SeedRecord { created_at_ms: AUG_16, words: 50, spoken_words: 50, recorded_seconds: None, turnaround_ms: None, credited: true, language: None },
        ];
        seed_from_history(&records).unwrap();
        /* Second call, same records: a ledger with rows in it is already seeded
           and re-folding history would double every day the two share. */
        seed_from_history(&records).unwrap();

        let ledger = snapshot().unwrap();
        let totals = ledger.totals();
        assert_eq!(totals.dictations, 2);
        assert_eq!(totals.words, 150);
        assert_eq!(ledger.languages.get("de").copied(), Some(1));
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
            credited: true,
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
            SeedRecord { created_at_ms: AUG_16, words: 100, spoken_words: 104, recorded_seconds: Some(60.0), turnaround_ms: None, credited: true, language: None },
            /* Generated prose. Its words are on the day and may not be credited
               against typing (ADR 0178). */
            SeedRecord { created_at_ms: AUG_16, words: 50, spoken_words: 8, recorded_seconds: Some(30.0), turnaround_ms: None, credited: false, language: None },
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
            credited: true,
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

    /// ADR 0177's migration. Same axis, same plausible counts, different
    /// question — the width guard cannot see this one, so the schema stamp has
    /// to.
    #[test]
    fn a_throughput_histogram_from_the_old_schema_is_dropped_and_the_days_are_not() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        let path = ledger_file_path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let mut throughput = vec![0u32; RATE_BUCKETS];
        throughput[87] = 50;
        let raw = serde_json::to_string(&serde_json::json!({
            "started_on": "2026-08-16",
            "days": { "2026-08-16": { "dictations": 50, "words": 3325, "recorded_seconds": 2397.6, "timed": 50 } },
            "rate_buckets": throughput,
            "rate_bucket_wpm": 1.0,
        }))
        .unwrap();
        std::fs::write(&path, raw).unwrap();

        let ledger = snapshot().unwrap();
        assert!(ledger.median_rate().is_none(), "the old rate is not read as a new one");
        assert_eq!(ledger.totals().dictations, 50, "the observations survive");
        assert_eq!(ledger.schema, LEDGER_SCHEMA);
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
            credited: false,
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
            credited: false,
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
            credited: true,
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
