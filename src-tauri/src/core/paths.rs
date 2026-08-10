use std::{env, path::PathBuf};

/// Per-process scratch directory used instead of the real user data directory
/// while the test suite runs.
///
/// Without this every consumer of `user_data_dir` writes into the developer's
/// live `~/.config/WordScript`: `cargo test` appended its own lines to the real
/// `wordscript-runtime.log` and wrote synthetic entries into the real
/// `history.json`. That corrupts exactly the evidence the runtime log exists to
/// provide, so the diversion belongs at the root rather than in each consumer's
/// own opt-in override.
#[cfg(test)]
fn test_data_dir() -> PathBuf {
    use std::sync::OnceLock;

    static DIR: OnceLock<PathBuf> = OnceLock::new();
    DIR.get_or_init(|| {
        let dir = env::temp_dir().join(format!("wordscript-test-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        dir
    })
    .clone()
}

pub fn user_data_dir() -> PathBuf {
    // Explicit override, honoured in every build. Lets a second instance run
    // against isolated data without touching the primary installation.
    if let Some(override_dir) = env::var_os("WORDSCRIPT_DATA_DIR") {
        let dir = PathBuf::from(override_dir);
        let _ = std::fs::create_dir_all(&dir);
        return dir;
    }

    #[cfg(test)]
    {
        return test_data_dir();
    }

    #[cfg(not(test))]
    {
        platform_user_data_dir()
    }
}

#[cfg(not(test))]
fn platform_user_data_dir() -> PathBuf {
    let base = if cfg!(target_os = "windows") {
        env::var_os("APPDATA")
            .map(PathBuf::from)
            .or_else(|| {
                env::var_os("USERPROFILE")
                    .map(|home| PathBuf::from(home).join("AppData").join("Roaming"))
            })
            .unwrap_or_else(|| PathBuf::from("."))
    } else if cfg!(target_os = "macos") {
        home_dir()
            .map(|home| home.join("Library").join("Application Support"))
            .unwrap_or_else(|| PathBuf::from("."))
    } else {
        env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .or_else(|| home_dir().map(|home| home.join(".config")))
            .unwrap_or_else(|| PathBuf::from("."))
    };

    let dir = base.join("WordScript");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

pub fn config_file_path() -> PathBuf {
    user_data_dir().join("config.json")
}

pub fn scratchpad_file_path() -> PathBuf {
    user_data_dir().join("scratchpad.json")
}

pub fn history_file_path() -> PathBuf {
    user_data_dir().join("history.json")
}

/// Where a transcript is written as a Markdown file (ADR 0074).
///
/// NOT under the user data directory, and that is the whole point of it: the
/// data directory is the application's own bookkeeping, and this is a folder a
/// person opens. §11.23 puts it at `~/WordScript/transcripts` so that "your
/// transcripts are yours" is a path rather than a sentence.
///
/// It still follows `WORDSCRIPT_DATA_DIR` and the test diversion, because a
/// second instance running against isolated data must not write into the
/// primary installation's folder, and the suite must never reach the
/// developer's real one.
pub fn transcripts_dir() -> PathBuf {
    if let Some(override_dir) = env::var_os("WORDSCRIPT_DATA_DIR") {
        return PathBuf::from(override_dir).join("transcripts");
    }

    #[cfg(test)]
    {
        return test_data_dir().join("transcripts");
    }

    #[cfg(not(test))]
    {
        home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("WordScript")
            .join("transcripts")
    }
}

/// Terms seen mangled once, waiting for the second sighting that promotes them
/// into a profile (ADR 0035).
///
/// Its own file rather than a field on the config: a candidate is runtime
/// bookkeeping with a short life, and putting it in `config.json` would mean
/// every dictation rewrites the file the settings form owns.
pub fn vocabulary_candidates_file_path() -> PathBuf {
    user_data_dir().join("vocabulary-candidates.json")
}

#[cfg(not(test))]
fn home_dir() -> Option<PathBuf> {
    env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("USERPROFILE").map(PathBuf::from))
}

#[cfg(test)]
mod tests {
    use super::*;

    // The suite must never reach the developer's live data directory. Asserted
    // through the resolved path rather than by writing and looking, so the test
    // stays honest even if a consumer changes what it writes.
    #[test]
    fn user_data_dir_is_diverted_away_from_the_real_config_dir_under_test() {
        let dir = user_data_dir();

        // The real installation directory always ends in `WordScript`; the
        // diverted one never may, whichever seam resolved it.
        assert!(!dir.ends_with("WordScript"), "resolved to {dir:?}");

        if env::var_os("WORDSCRIPT_DATA_DIR").is_none() {
            assert!(dir.starts_with(env::temp_dir()), "resolved to {dir:?}");
        }
    }

    #[test]
    fn every_data_file_lives_inside_the_diverted_directory() {
        let dir = user_data_dir();

        for path in [
            config_file_path(),
            scratchpad_file_path(),
            history_file_path(),
            vocabulary_candidates_file_path(),
            // Lives outside the data directory in a real installation and
            // inside the diverted one under test — the diversion is the point
            // of asserting it here (ADR 0074).
            transcripts_dir(),
        ] {
            assert!(path.starts_with(&dir), "{path:?} escaped {dir:?}");
        }
    }
}
