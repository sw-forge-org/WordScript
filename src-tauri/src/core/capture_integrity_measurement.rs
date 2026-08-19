//! The measurement that joins this cluster together, and the reason it could
//! not be taken on 2026-08-10.
//!
//! Five open records describe one failure class — output that is fluent,
//! grammatical, plausible and wrong. The question that would tie them together
//! is whether a capture that lost audio also produces a transcript with more
//! mishearings in it. Answering it needs two things in the same place: what the
//! capture measured about itself, and what the recogniser returned.
//!
//! They were never in the same place. The capture numbers live in
//! `~/.config/WordScript/logs/wordscript-runtime.log`, the transcripts in
//! `~/.config/WordScript/history.json`, and the two have different retentions.
//! This harness joins them by timestamp and reports the OVERLAP first, because
//! on the first run the overlap was the finding: 138 history records, 608
//! captures, 10 of them short — and **9 of those 10 had outlived their
//! transcripts**. The correlation was not weak; it was untestable.
//!
//! That is what `capture_integrity` on the history record is for (ADR 0079).
//! Once records carry their own verdict this join stops being necessary, and
//! the harness reports that too: it counts records that answer for themselves
//! and says how many.
//!
//! Run explicitly. It spends nothing — every number it needs is already on
//! disk:
//!
//! ```text
//! cargo test measure_capture_integrity_against_transcripts -- --ignored --nocapture
//! ```
//!
//! **It reads the developer's live `~/.config/WordScript/`**, like the invented
//! token measurement beside it, and for the same reason: the profile, model and
//! mode that really ran beat today's approximation of them. Name the window it
//! covered in any write-up — the logs rotate, so two runs a week apart are not
//! measuring the same population.

use std::collections::HashMap;
use std::path::PathBuf;

use regex::Regex;

/// How close a capture's export line has to sit to a history record before the
/// two are taken to be the same session. Measured on 2026-08-10: every one of
/// 138 records fell between 1.3 s and 12.1 s after its export, and the gap is
/// the pipeline itself — a provider call plus a transform.
const JOIN_WINDOW_MS: i64 = 120_000;

/// How close an emit line has to sit to an export line to belong to it. The two
/// are written within milliseconds of each other at the end of a capture.
const PAIR_WINDOW_MS: i64 = 5_000;

/// The threshold under test, restated here rather than imported so the harness
/// can report the distribution AROUND it. Importing the constant would make the
/// measurement agree with the product by construction.
const GAP_THRESHOLD: f64 = 0.10;

fn wordscript_config_dir() -> PathBuf {
    PathBuf::from(std::env::var("HOME").expect("HOME"))
        .join(".config")
        .join("WordScript")
}

#[derive(Debug, Clone)]
struct CaptureRow {
    stopped_at_ms: i64,
    wall_seconds: f64,
    recorded_seconds: f64,
    shortfall_ratio: f64,
}

impl CaptureRow {
    fn missing_ratio(&self) -> f64 {
        if self.wall_seconds <= 0.0 {
            return 0.0;
        }
        (1.0 - self.recorded_seconds / self.wall_seconds).clamp(0.0, 1.0)
    }
}

fn read_runtime_logs() -> Vec<String> {
    let dir = wordscript_config_dir().join("logs");
    let mut lines = Vec::new();
    // Oldest first, so the pairing below always sees an emit line before the
    // export line it belongs to.
    for name in ["wordscript-runtime.log.1", "wordscript-runtime.log"] {
        if let Ok(body) = std::fs::read_to_string(dir.join(name)) {
            lines.extend(body.lines().map(str::to_string));
        }
    }
    lines
}

/// Pairs `Capture level emits` with `Native capture export done`.
///
/// Two lines, written by the same `stop_native_capture`, that nobody had
/// compared until 2026-08-03. The emit line carries the wall clock; the export
/// line carries the sample count, from which the recorded duration follows.
/// Their correlation across 324 long captures was r = 0.9985 — they are one
/// measurement read off two counters.
fn parse_captures(lines: &[String]) -> Vec<CaptureRow> {
    let emit = Regex::new(
        r"\[(\d+) \+[\d.]+\] \[WordScript\] Capture level emits wall_seconds=([\d.]+) expected=\d+ attempted=\d+ failed=\d+ shortfall_ratio=([\d.]+)",
    )
    .expect("emit pattern");
    let export = Regex::new(
        r"\[(\d+) \+[\d.]+\] \[WordScript\] Native capture export done input_rate=(\d+) input_channels=(\d+) output_rate=\d+ output_channels=\d+ input_samples=(\d+)",
    )
    .expect("export pattern");

    let mut pending: Option<(i64, f64, f64)> = None;
    let mut rows = Vec::new();

    for line in lines {
        if let Some(caps) = emit.captures(line) {
            pending = Some((
                caps[1].parse().unwrap_or_default(),
                caps[2].parse().unwrap_or_default(),
                caps[3].parse().unwrap_or_default(),
            ));
            continue;
        }

        if let Some(caps) = export.captures(line) {
            let stopped_at_ms: i64 = caps[1].parse().unwrap_or_default();
            let rate: f64 = caps[2].parse().unwrap_or(1.0);
            let channels: f64 = caps[3].parse().unwrap_or(1.0);
            let samples: f64 = caps[4].parse().unwrap_or_default();

            let Some((emit_ms, wall_seconds, shortfall_ratio)) = pending.take() else {
                continue;
            };
            if stopped_at_ms - emit_ms > PAIR_WINDOW_MS || stopped_at_ms < emit_ms {
                continue;
            }

            rows.push(CaptureRow {
                stopped_at_ms,
                wall_seconds,
                recorded_seconds: samples / (rate * channels).max(1.0),
                shortfall_ratio,
            });
        }
    }

    rows
}

fn pearson(a: &[f64], b: &[f64]) -> f64 {
    let n = a.len() as f64;
    if n < 2.0 {
        return f64::NAN;
    }
    let mean_a = a.iter().sum::<f64>() / n;
    let mean_b = b.iter().sum::<f64>() / n;
    let numerator: f64 = a
        .iter()
        .zip(b)
        .map(|(x, y)| (x - mean_a) * (y - mean_b))
        .sum();
    let denominator = (a.iter().map(|x| (x - mean_a).powi(2)).sum::<f64>()
        * b.iter().map(|y| (y - mean_b).powi(2)).sum::<f64>())
    .sqrt();
    numerator / denominator
}

fn percentile(sorted: &[f64], fraction: f64) -> f64 {
    if sorted.is_empty() {
        return f64::NAN;
    }
    let index = ((sorted.len() - 1) as f64 * fraction).round() as usize;
    sorted[index]
}

/// The two prompt forms, normalised, as `strip_prompt_echo` sees them. Counted
/// here rather than imported from the strip so the harness measures the DEFECT
/// rather than what the fix happens to catch — the gap between the two numbers
/// is the interesting one.
fn prompt_leak_probes() -> [&'static str; 5] {
    [
        "diktierte notizen",
        "normale satze mit satzzeichen",
        "dictated notes",
        "normal sentences with punctuation",
        "likely phrases",
    ]
}

fn fold(text: &str) -> String {
    let lowered = text.to_lowercase();
    let mut out = String::with_capacity(lowered.len());
    let mut last_was_space = true;
    for ch in lowered.chars() {
        let mapped = match ch {
            'ä' => 'a',
            'ö' => 'o',
            'ü' => 'u',
            'ß' => 's',
            other if other.is_alphanumeric() => other,
            _ => ' ',
        };
        if mapped == ' ' {
            if !last_was_space {
                out.push(' ');
            }
            last_was_space = true;
        } else {
            out.push(mapped);
            last_was_space = false;
        }
    }
    out.trim().to_string()
}

#[test]
#[ignore = "reads the developer's live history and logs; run explicitly with --ignored"]
fn measure_capture_integrity_against_transcripts() {
    let lines = read_runtime_logs();
    let captures = parse_captures(&lines);
    assert!(
        !captures.is_empty(),
        "no captures found in the runtime logs — nothing to measure"
    );

    /* THE INDEX IS A JOURNAL SINCE ADR 0241, so this reads it through the
       replay rather than parsing an array that is no longer there. Parsing it
       here would answer zero records, and this harness PRINTS its record count
       as a finding — a silent zero is the one failure mode a measurement must
       not have. */
    let history = super::super::history::stored_index_values(&wordscript_config_dir());

    println!("\n=== Capture integrity against transcripts ===");
    println!("captures paired from the runtime logs: {}", captures.len());
    println!("history records:                       {}", history.len());

    // ── 1. The correlation the cluster rests on ──────────────────────────────
    let long: Vec<&CaptureRow> = captures.iter().filter(|row| row.wall_seconds >= 20.0).collect();
    let shortfalls: Vec<f64> = long.iter().map(|row| row.shortfall_ratio).collect();
    let missing: Vec<f64> = long.iter().map(|row| row.missing_ratio()).collect();
    println!(
        "\ncaptures of at least 20 s: {}   Pearson r(shortfall_ratio, missing audio) = {:.4}",
        long.len(),
        pearson(&shortfalls, &missing)
    );

    let mut all_missing: Vec<f64> = captures.iter().map(|row| row.missing_ratio()).collect();
    all_missing.sort_by(|a, b| a.partial_cmp(b).expect("no NaN"));
    println!(
        "missing-audio distribution: median {:.2} %  p95 {:.2} %  p99 {:.2} %  max {:.2} %",
        percentile(&all_missing, 0.50) * 100.0,
        percentile(&all_missing, 0.95) * 100.0,
        percentile(&all_missing, 0.99) * 100.0,
        all_missing.last().copied().unwrap_or_default() * 100.0,
    );

    // ── 2. What the threshold separates ──────────────────────────────────────
    let short: Vec<&CaptureRow> = captures
        .iter()
        .filter(|row| row.wall_seconds >= 2.0 && row.missing_ratio() >= GAP_THRESHOLD)
        .collect();
    let healthy_max = captures
        .iter()
        .filter(|row| row.wall_seconds >= 2.0 && row.missing_ratio() < GAP_THRESHOLD)
        .map(|row| row.missing_ratio())
        .fold(0.0_f64, f64::max);
    let short_min = short
        .iter()
        .map(|row| row.missing_ratio())
        .fold(f64::INFINITY, f64::min);
    println!(
        "\nshort captures at the {:.0} % threshold: {}",
        GAP_THRESHOLD * 100.0,
        short.len()
    );
    println!(
        "the gap the threshold sits in: healthiest-worst {:.1} %  ..  smallest failure {:.1} %",
        healthy_max * 100.0,
        short_min * 100.0
    );
    for row in &short {
        println!(
            "  stop_ms={}  wall={:>7.1}s  recorded={:>7.1}s  missing={:>5.1} %",
            row.stopped_at_ms,
            row.wall_seconds,
            row.recorded_seconds,
            row.missing_ratio() * 100.0
        );
    }

    // ── 3. THE OVERLAP, which is the finding on the first run ────────────────
    let mut joined = 0;
    let mut joined_short = 0;
    let mut density: Vec<f64> = Vec::new();
    let mut density_short: Vec<f64> = Vec::new();

    for record in &history {
        let Some(created) = record["created_at_ms"].as_i64() else {
            continue;
        };
        let Some(row) = captures
            .iter()
            .filter(|row| created - row.stopped_at_ms >= 0 && created - row.stopped_at_ms <= JOIN_WINDOW_MS)
            .max_by_key(|row| row.stopped_at_ms)
        else {
            continue;
        };
        joined += 1;

        let raw = record["raw_transcript"].as_str().unwrap_or_default().trim();
        if row.recorded_seconds > 5.0 {
            let chars_per_second = raw.chars().count() as f64 / row.recorded_seconds;
            density.push(chars_per_second);
            if row.missing_ratio() >= GAP_THRESHOLD {
                density_short.push(chars_per_second);
            }
        }
        if row.missing_ratio() >= GAP_THRESHOLD {
            joined_short += 1;
        }
    }

    println!("\n--- the overlap ---");
    println!("history records joined to a capture: {joined} of {}", history.len());
    println!(
        "…of which the capture was short:     {joined_short} of {} short captures overall",
        short.len()
    );
    if joined_short < short.len() {
        println!(
            "*** {} short captures have outlived their transcripts. The shortfall/mishearing",
            short.len() - joined_short
        );
        println!("*** correlation is NOT ANSWERABLE on this data, and that is a retention");
        println!("*** artifact rather than a result. ADR 0079 puts the verdict on the record so");
        println!("*** the next run does not need this join at all.");
    }

    let with_verdict = history
        .iter()
        .filter(|record| !record["capture_integrity"].is_null())
        .count();
    println!(
        "records answering for themselves (capture_integrity present): {with_verdict} of {}",
        history.len()
    );

    density.sort_by(|a, b| a.partial_cmp(b).expect("no NaN"));
    if !density.is_empty() {
        println!(
            "\ntranscript density over recorded audio: median {:.2} chars/s across {} records",
            percentile(&density, 0.50),
            density.len()
        );
    }
    if !density_short.is_empty() {
        let mean = density_short.iter().sum::<f64>() / density_short.len() as f64;
        println!(
            "…on short captures: mean {:.2} chars/s across {} records",
            mean,
            density_short.len()
        );
    }

    // ── 4. The two defects that ARE measurable on the transcripts alone ──────
    let mut raw_leaks = 0;
    let mut delivered_leaks = 0;
    let mut by_probe: HashMap<&str, usize> = HashMap::new();
    for record in &history {
        let raw = fold(record["raw_transcript"].as_str().unwrap_or_default());
        let delivered = fold(record["transformed_transcript"].as_str().unwrap_or_default());
        let hits: Vec<&str> = prompt_leak_probes()
            .into_iter()
            .filter(|probe| raw.contains(probe))
            .collect();
        if !hits.is_empty() {
            raw_leaks += 1;
            for probe in hits {
                *by_probe.entry(probe).or_default() += 1;
            }
        }
        if prompt_leak_probes()
            .into_iter()
            .any(|probe| delivered.contains(probe))
        {
            delivered_leaks += 1;
        }
    }

    println!("\n--- the prompt leak, on the transcripts themselves ---");
    let total = history.len().max(1);
    println!(
        "raw transcripts carrying prompt text: {raw_leaks} ({:.1} %)",
        raw_leaks as f64 * 100.0 / total as f64
    );
    println!(
        "delivered still carrying it:          {delivered_leaks} ({:.1} %)",
        delivered_leaks as f64 * 100.0 / total as f64
    );
    let mut probes: Vec<(&&str, &usize)> = by_probe.iter().collect();
    probes.sort_by_key(|(probe, _)| **probe);
    for (probe, count) in probes {
        println!("  {probe:<34} {count}");
    }
    println!(
        "\nNOTE: these counts are of the DEFECT, not of what the strip catches. A drop here\n\
         after ADR 0080 ships means the recogniser leaked less; the strip does not touch\n\
         `raw_transcript`, deliberately, so this number stays readable either way."
    );
}
