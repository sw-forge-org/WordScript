//! Renders every sound pack and cue to WAV so they can be listened to without
//! building and running the app.
//!
//!     cargo run --example audition_cues -- --out /tmp/ws-cues
//!     pw-play /tmp/ws-cues/timber_listen.wav
//!
//! `--sequence` additionally writes one file per pack containing the full
//! Listen -> Handoff -> Done phrase with realistic gaps, which is the only way
//! to judge whether the three cues actually work together.

use std::{env, fs, path::PathBuf, process};

use hound::{SampleFormat, WavSpec, WavWriter};
use wordscript_lib::core::sound::{
    cue::ALL_CUES,
    pack::ALL_PACKS,
    synth::{self},
};

const SAMPLE_RATE: u32 = 48_000;

/// Rough real-world timing of one dictation: speak for a while, wait for the
/// pipeline, then the text lands.
const SEQUENCE_GAPS_MS: [f32; 2] = [1_400.0, 900.0];

fn main() {
    let mut out = PathBuf::from("target/audition");
    let mut sequence = false;

    let mut args = env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--out" | "-o" => match args.next() {
                Some(value) => out = PathBuf::from(value),
                None => fail("--out needs a directory"),
            },
            "--sequence" | "-s" => sequence = true,
            "--help" | "-h" => {
                println!("usage: audition_cues [--out DIR] [--sequence]");
                return;
            }
            other => fail(&format!("unknown argument: {other}")),
        }
    }

    if let Err(error) = fs::create_dir_all(&out) {
        fail(&format!("cannot create {}: {error}", out.display()));
    }

    let mut written = 0_usize;
    for pack in ALL_PACKS {
        for cue in ALL_CUES {
            let samples = synth::render(cue, pack, SAMPLE_RATE);
            let path = out.join(format!("{}_{}.wav", pack.as_str(), cue.as_str()));
            write_wav(&path, &samples);
            println!(
                "{:<28} {:>6.0} ms  peak {:.3}",
                path.file_name().unwrap_or_default().to_string_lossy(),
                samples.len() as f32 / (SAMPLE_RATE as f32 / 1000.0),
                peak(&samples),
            );
            written += 1;
        }

        if sequence {
            let path = out.join(format!("{}_sequence.wav", pack.as_str()));
            write_wav(&path, &render_sequence(pack));
            println!("{}", path.file_name().unwrap_or_default().to_string_lossy());
            written += 1;
        }
    }

    println!("\n{written} files in {}", out.display());
}

fn render_sequence(pack: wordscript_lib::core::sound::SoundPack) -> Vec<f32> {
    use wordscript_lib::core::sound::SoundCue;

    let mut combined = Vec::new();
    for (index, cue) in [SoundCue::Listen, SoundCue::Handoff, SoundCue::Done]
        .into_iter()
        .enumerate()
    {
        combined.extend_from_slice(&synth::render(cue, pack, SAMPLE_RATE));
        if let Some(gap_ms) = SEQUENCE_GAPS_MS.get(index) {
            let gap = ((gap_ms / 1000.0) * SAMPLE_RATE as f32) as usize;
            combined.extend(std::iter::repeat_n(0.0_f32, gap));
        }
    }
    combined
}

fn write_wav(path: &PathBuf, samples: &[f32]) {
    let spec = WavSpec {
        channels: 1,
        sample_rate: SAMPLE_RATE,
        bits_per_sample: 32,
        sample_format: SampleFormat::Float,
    };
    let mut writer = match WavWriter::create(path, spec) {
        Ok(writer) => writer,
        Err(error) => fail(&format!("cannot write {}: {error}", path.display())),
    };
    for sample in samples {
        if let Err(error) = writer.write_sample(*sample) {
            fail(&format!("cannot write {}: {error}", path.display()));
        }
    }
    if let Err(error) = writer.finalize() {
        fail(&format!("cannot finalize {}: {error}", path.display()));
    }
}

fn peak(samples: &[f32]) -> f32 {
    samples.iter().fold(0.0_f32, |acc, s| acc.max(s.abs()))
}

fn fail(message: &str) -> ! {
    eprintln!("audition_cues: {message}");
    process::exit(1);
}
