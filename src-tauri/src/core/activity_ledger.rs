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
//! which application was in front, never a language. A year is 365 rows of five
//! numbers. That is the whole reason a ledger can promise what a record index
//! cannot: it is an aggregate, so keeping it costs nothing and it gives up
//! nothing about what was said.
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
//! THE FIRST DAY IT SAW IS THE INSTALL DATE, as far as anything can honestly
//! say. Nothing in this product recorded when it was installed, so `started_on`
//! is the day this ledger first wrote a row — and a display that grows with the
//! installation now has a real clock to grow against instead of a guess.

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
const LEDGER_RETENTION_DAYS: i64 = 800;

/// The rate histogram: four hundred buckets of one word a minute, 0 to 400.
///
/// WHY A HISTOGRAM AND NOT A LIST OF RATES. The tile wants a MEDIAN, and a
/// median needs the distribution rather than a running total — but keeping every
/// run's rate forever would make this file grow with use, which is the one thing
/// a ledger must not do. Eighty counters is a fixed cost that answers the same
/// question to within half a bucket.
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
    #[serde(default)]
    pub words: u64,
    /// Summed `capture_integrity.recorded_seconds`, over the runs that carried a
    /// clock. It is the OPEN MICROPHONE and not the speech: the window runs from
    /// starting the capture to ending it, so a thinking pause is inside it. Any
    /// rate built on this is throughput rather than articulation, and the
    /// surface has to say so.
    #[serde(default)]
    pub recorded_seconds: f64,
    /// How many of the day's dictations carried that clock at all. Without it a
    /// rate would divide real words by a denominator that silently skipped the
    /// runs which never measured themselves.
    #[serde(default)]
    pub timed: u64,
    #[serde(default)]
    pub longest_seconds: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ActivityLedger {
    /// `YYYY-MM-DD` of the first row ever written. The closest thing to an
    /// install date this product has.
    #[serde(default)]
    pub started_on: Option<String>,
    /// Keyed `YYYY-MM-DD`, in a `BTreeMap` so the file is written in date order
    /// and a human opening it can read it.
    #[serde(default)]
    pub days: BTreeMap<String, LedgerDay>,
    /// How many runs landed in each bucket, all time. The distribution behind
    /// the median — see `RATE_BUCKETS`.
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
    /// counts — they are derived, and the seed rebuilds them.
    #[serde(default)]
    pub rate_bucket_wpm: f64,
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
        let total: u64 = self.turnaround_buckets.iter().map(|count| *count as u64).sum();
        if total == 0 {
            return None;
        }
        let midpoint = total / 2;
        let mut seen: u64 = 0;
        for (index, count) in self.turnaround_buckets.iter().enumerate() {
            seen += *count as u64;
            if seen > midpoint {
                return Some(index as f64 * TURNAROUND_BUCKET_MS);
            }
        }
        None
    }

    /// The middle run's rate, to the nearest bucket.
    ///
    /// A MEDIAN AND NOT A MEAN, and the difference is not academic. Measured on
    /// the machine this was written against: total-words-over-total-seconds gave
    /// 82.7, the mean of the per-run rates gave 95.3, and the median gave 87.6 —
    /// with a single two-second capture reporting 273 wpm because the recogniser
    /// invented ten words for it. An aggregate is dragged DOWN by long dictations
    /// full of thinking pauses and a mean is dragged UP by short hallucinated
    /// ones; the median is what a typical dictation actually ran at.
    pub fn median_rate(&self) -> Option<f64> {
        let total: u64 = self.rate_buckets.iter().map(|count| *count as u64).sum();
        if total == 0 {
            return None;
        }
        let midpoint = total / 2;
        let mut seen: u64 = 0;
        for (index, count) in self.rate_buckets.iter().enumerate() {
            seen += *count as u64;
            if seen > midpoint {
                /* The bucket's LOWER edge, not its middle. At one wpm per bucket
                   the two differ by half a word a minute, and the lower edge is
                   the one that never reports a rate higher than any run actually
                   reached. */
                return Some(index as f64 * RATE_BUCKET_WPM);
            }
        }
        None
    }

    /// Every day folded into one set of all-time figures.
    pub fn totals(&self) -> LedgerDay {
        let mut total = LedgerDay::default();
        for day in self.days.values() {
            total.dictations += day.dictations;
            total.words += day.words;
            total.recorded_seconds += day.recorded_seconds;
            total.timed += day.timed;
            total.longest_seconds = total.longest_seconds.max(day.longest_seconds);
        }
        total
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
    ledger
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
    pub words: u64,
    pub recorded_seconds: Option<f64>,
    pub turnaround_ms: Option<u64>,
}

/// What one finished record contributes. `None` for words means the record
/// produced no text and contributes nothing at all.
pub struct LedgerContribution {
    pub created_at_ms: u64,
    pub words: u64,
    pub recorded_seconds: Option<f64>,
    /// Milliseconds from the audio arriving to the text existing. `None` on
    /// every path that never ran that clock.
    pub turnaround_ms: Option<u64>,
}

/// Fold one record into the ledger and write it.
///
/// Errors are RETURNED AND NOT PROPAGATED INTO THE SESSION by the caller: a
/// dictation that reached the cursor has succeeded, and failing it because an
/// aggregate could not be written would be the tail wagging the dog.
pub fn record(contribution: LedgerContribution) -> Result<(), String> {
    if contribution.words == 0 {
        return Ok(());
    }

    let mut guard = ledger_store().lock().map_err(|error| error.to_string())?;
    let ledger = guard.get_or_insert_with(read_from_disk);

    let key = day_key(contribution.created_at_ms);
    let day = ledger.days.entry(key.clone()).or_default();
    day.dictations += 1;
    day.words += contribution.words;
    let rate_seconds = contribution.recorded_seconds.filter(|seconds| {
        seconds.is_finite() && *seconds > 0.0
    });
    if let Some(seconds) = rate_seconds {
        day.recorded_seconds += seconds;
        day.timed += 1;
        day.longest_seconds = day.longest_seconds.max(seconds);
    }
    if let Some(seconds) = rate_seconds {
        ledger.add_rate(contribution.words, seconds);
    }
    if let Some(milliseconds) = contribution.turnaround_ms {
        ledger.add_turnaround(milliseconds);
    }

    if ledger.started_on.is_none() {
        ledger.started_on = Some(key);
    }
    prune(ledger);

    write_to_disk(ledger)
}

/// Drop rows past the retention horizon. Cheap, and it runs on write rather than
/// on read so a display never pays for it.
fn prune(ledger: &mut ActivityLedger) {
    if ledger.days.len() as i64 <= LEDGER_RETENTION_DAYS {
        return;
    }
    let excess = ledger.days.len() - LEDGER_RETENTION_DAYS as usize;
    let doomed: Vec<String> = ledger.days.keys().take(excess).cloned().collect();
    for key in doomed {
        ledger.days.remove(&key);
    }
    /* `started_on` FOLLOWS THE PRUNING. It answers "how far back does this go",
       and a date whose row has been dropped answers it wrongly in the one
       direction that matters — it would claim a depth the file no longer has. */
    if let Some(first) = ledger.days.keys().next() {
        ledger.started_on = Some(first.clone());
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
#[tauri::command]
pub fn read_activity_ledger() -> Result<ActivityLedger, String> {
    if let Ok(entries) = super::history::entries_for_backup() {
        let records: Vec<SeedRecord> = entries
            .iter()
            .filter(|entry| entry.retry_of.is_none())
            .map(|entry| SeedRecord {
                created_at_ms: entry.created_at_ms,
                words: entry
                    .transformed_transcript
                    .as_deref()
                    .or(entry.raw_transcript.as_deref())
                    .map(|text| text.split_whitespace().count() as u64)
                    .unwrap_or(0),
                recorded_seconds: entry
                    .capture_integrity
                    .as_ref()
                    .map(|integrity| integrity.recorded_seconds),
                turnaround_ms: entry.turnaround_ms,
            })
            .collect();
        let _ = seed_from_history(&records);
    }
    snapshot()
}

/// Fold whatever history still holds into an empty ledger, once.
///
/// THE LEDGER STARTS THE DAY IT IS INSTALLED AND CANNOT INVENT A PAST. What it
/// CAN do is not throw away the records that are still on disk when it first
/// runs — on a fresh install that is nothing, and on an existing one it is
/// however much history was retained. It is a one-time seed and never runs
/// again, because after that the ledger is the deeper of the two records and
/// re-folding history would double every day they share.
pub fn seed_from_history(records: &[SeedRecord]) -> Result<(), String> {
    let mut guard = ledger_store().lock().map_err(|error| error.to_string())?;
    let ledger = guard.get_or_insert_with(read_from_disk);

    /* TWO SEEDS, BECAUSE THE HISTOGRAM ARRIVED AFTER THE DAYS DID. A ledger
       written before the median existed has rows but no distribution, and
       re-folding its days would double every one of them — so the second case
       fills the buckets ALONE. Both are idempotent and neither runs again. */
    let seed_days = ledger.days.is_empty();
    let seed_rates = ledger.rate_buckets.iter().all(|count| *count == 0);
    ledger.rate_bucket_wpm = RATE_BUCKET_WPM;
    ledger.turnaround_bucket_ms = TURNAROUND_BUCKET_MS;
    if !seed_days && !seed_rates && !ledger.turnaround_buckets.iter().all(|count| *count == 0) {
        return Ok(());
    }

    let seed_turnarounds = ledger.turnaround_buckets.iter().all(|count| *count == 0);

    for record in records {
        if record.words == 0 {
            continue;
        }
        let measured = record
            .recorded_seconds
            .filter(|value| value.is_finite() && *value > 0.0);

        if seed_days {
            let day = ledger.days.entry(day_key(record.created_at_ms)).or_default();
            day.dictations += 1;
            day.words += record.words;
            if let Some(value) = measured {
                day.recorded_seconds += value;
                day.timed += 1;
                day.longest_seconds = day.longest_seconds.max(value);
            }
        }
        if seed_rates {
            if let Some(value) = measured {
                ledger.add_rate(record.words, value);
            }
        }
        if seed_turnarounds {
            if let Some(milliseconds) = record.turnaround_ms {
                ledger.add_turnaround(milliseconds);
            }
        }
    }

    if ledger.days.is_empty() {
        return Ok(());
    }
    if seed_days {
        ledger.started_on = ledger.days.keys().next().cloned();
    }
    write_to_disk(ledger)
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
    use std::sync::Mutex as StdMutex;

    fn test_lock() -> &'static StdMutex<()> {
        static LOCK: OnceLock<StdMutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| StdMutex::new(()))
    }

    /// 2026-08-16, mid-afternoon local time.
    const AUG_16: u64 = 1_786_900_000_000;
    const DAY_MS: u64 = 24 * 60 * 60 * 1000;

    #[test]
    fn a_day_sums_its_dictations_words_and_clock_and_keeps_the_longest() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(LedgerContribution { created_at_ms: AUG_16, words: 100, recorded_seconds: Some(60.0), turnaround_ms: None }).unwrap();
        record(LedgerContribution { created_at_ms: AUG_16, words: 50, recorded_seconds: Some(240.0), turnaround_ms: None }).unwrap();
        /* A record that never measured itself: its words count, its silence does
           not become a zero in the denominator. */
        record(LedgerContribution { created_at_ms: AUG_16, words: 4, recorded_seconds: None, turnaround_ms: None }).unwrap();

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

        record(LedgerContribution { created_at_ms: AUG_16, words: 0, recorded_seconds: Some(9.0), turnaround_ms: None }).unwrap();
        assert!(snapshot().unwrap().days.is_empty());
    }

    #[test]
    fn totals_survive_what_history_would_have_pruned() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        /* The whole reason this module exists: three hundred days apart is well
           past any retention horizon history keeps, and both still count. */
        record(LedgerContribution { created_at_ms: AUG_16 - 300 * DAY_MS, words: 400, recorded_seconds: Some(120.0), turnaround_ms: None }).unwrap();
        record(LedgerContribution { created_at_ms: AUG_16, words: 600, recorded_seconds: Some(180.0), turnaround_ms: None }).unwrap();

        let totals = snapshot().unwrap().totals();
        assert_eq!(totals.dictations, 2);
        assert_eq!(totals.words, 1000);
        assert_eq!(totals.timed, 2);
        assert!((totals.recorded_seconds - 300.0).abs() < 1e-6);
    }

    #[test]
    fn the_first_day_it_saw_is_where_it_says_it_starts() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(LedgerContribution { created_at_ms: AUG_16, words: 10, recorded_seconds: None, turnaround_ms: None }).unwrap();
        record(LedgerContribution { created_at_ms: AUG_16 + DAY_MS, words: 10, recorded_seconds: None, turnaround_ms: None }).unwrap();

        assert_eq!(snapshot().unwrap().started_on.as_deref(), Some(day_key(AUG_16).as_str()));
    }

    #[test]
    fn it_survives_a_reload_from_disk() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        record(LedgerContribution { created_at_ms: AUG_16, words: 42, recorded_seconds: Some(30.0), turnaround_ms: None }).unwrap();
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
            SeedRecord { created_at_ms: AUG_16, words: 100, recorded_seconds: Some(60.0), turnaround_ms: Some(1200) },
            SeedRecord { created_at_ms: AUG_16, words: 50, recorded_seconds: None, turnaround_ms: None },
        ];
        seed_from_history(&records).unwrap();
        /* Second call, same records: a ledger with rows in it is already seeded
           and re-folding history would double every day the two share. */
        seed_from_history(&records).unwrap();

        let totals = snapshot().unwrap().totals();
        assert_eq!(totals.dictations, 2);
        assert_eq!(totals.words, 150);
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

    #[test]
    fn the_median_is_the_middle_run_and_an_outlier_does_not_move_it() {
        let _guard = test_lock().lock().unwrap_or_else(|error| error.into_inner());
        reset_for_tests();

        /* Five runs at 60, 80, 90, 110 and one hallucinated 1800 wpm — ten words
           the recogniser invented for a third of a second. The mean of those is
           428; the middle one is 90. */
        for (words, seconds) in [(10u64, 10.0f64), (20, 15.0), (30, 20.0), (110, 60.0), (10, 0.33)] {
            record(LedgerContribution {
                created_at_ms: AUG_16,
                words,
                recorded_seconds: Some(seconds),
                turnaround_ms: None,
            })
            .unwrap();
        }

        let median = snapshot().unwrap().median_rate().expect("five runs have a middle one");
        assert!((median - 90.0).abs() < 1.5, "median was {median}");
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
