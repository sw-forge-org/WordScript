//! Route A of `capture-loses-half-the-recording.md`: hold the input stream open
//! and report what it delivers, unattended, with no app and no words.
//!
//! ```text
//! cargo run --release --bin capture-soak -- --hours 8
//! ```
//!
//! Fold step 4 of that record into the same night by watching PipeWire from the
//! other side at debug level, because the retrospective check at the default
//! level found nothing and that is weak evidence rather than a refutation:
//!
//! ```text
//! PIPEWIRE_DEBUG=3 journalctl --user -u pipewire -f
//! ```
//!
//! Every segment carries `epoch_ms_at_start`, which is what a journal window is
//! correlated against.

use std::path::PathBuf;
use std::process::ExitCode;

use wordscript_lib::core::capture_soak::{self, SoakOptions};

fn main() -> ExitCode {
    let options = match parse_args() {
        Ok(Some(options)) => options,
        Ok(None) => return ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("{error}");
            eprintln!();
            eprintln!("{USAGE}");
            return ExitCode::FAILURE;
        }
    };

    match capture_soak::run(options) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("[WordScript] Soak failed: {error}");
            ExitCode::FAILURE
        }
    }
}

const USAGE: &str = "\
Usage: capture-soak [options]

  --hours <n>        Run for n hours. At roughly one event per hour of open
                     stream, a night yields about eight.
  --minutes <n>      Run for n minutes.
  --seconds <n>      Run for n seconds.
  --segment <n>      Seconds per reported segment (default 300).
  --device <name>    Substring of the input device name. Defaults to the
                     device the app itself is configured to use.
  --log <path>       Log file. Defaults to the user data dir under
                     logs/wordscript-capture-soak.log.
  -h, --help         This text.

With no duration the soak runs until it is stopped. Closed segments are written
as they close, so an interrupted run loses at most the segment still open.";

fn parse_args() -> Result<Option<SoakOptions>, String> {
    let mut options = SoakOptions::default();
    let mut args = std::env::args().skip(1);

    while let Some(arg) = args.next() {
        let mut value = || {
            args.next()
                .ok_or_else(|| format!("{arg} needs a value."))
                .and_then(|raw| {
                    raw.parse::<u64>()
                        .map_err(|_| format!("{arg} needs a number, got '{raw}'."))
                })
        };

        match arg.as_str() {
            "--hours" => options.run_seconds = Some(value()? * 3_600),
            "--minutes" => options.run_seconds = Some(value()? * 60),
            "--seconds" => options.run_seconds = Some(value()?),
            "--segment" => options.segment_seconds = value()?,
            "--device" => {
                options.device_override = Some(
                    args.next()
                        .ok_or_else(|| "--device needs a value.".to_string())?,
                )
            }
            "--log" => {
                options.log_path = Some(PathBuf::from(
                    args.next()
                        .ok_or_else(|| "--log needs a value.".to_string())?,
                ))
            }
            "-h" | "--help" => {
                println!("{USAGE}");
                return Ok(None);
            }
            other => return Err(format!("Unknown option '{other}'.")),
        }
    }

    if options.segment_seconds == 0 {
        return Err("--segment must be at least 1.".to_string());
    }

    Ok(Some(options))
}
