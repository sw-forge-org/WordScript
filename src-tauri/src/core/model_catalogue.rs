//! One versioned model catalogue, read by this runtime and by the drawing.
//!
//! ADR 0115, scoped by ADR 0120. A model id used to live in three places —
//! literals in `core/config.rs`, literals in `src/screens/data.ts`, dated prose
//! tables in `docs/PROVIDERS.md` — and nothing checked them against each other.
//! They had already drifted, and the survey said so about itself. Here a model
//! is one row in one file, `shared/model_catalogue.json`, loaded the way
//! `core::regression_corpus` loads its fixtures: `include_str!` behind a version
//! constant, with the schema beside the data.
//!
//! **Consumers name a row by its id, never by a model name.** The id is a stable
//! slug — `anthropic-chat-sonnet`, not `claude-sonnet-5` — so a vendor's next
//! generation is a change to one `model_id` here and to nothing anywhere else.
//! That is the property the step exists for: *take Bland Speech v3* stops being
//! an edit in two languages and becomes a line with a date and a source.
//!
//! **This is not `ModelCapabilities` and must not be derived from it or into
//! it.** A row records what a vendor's documentation says, refreshed by
//! re-reading that documentation; `ModelCapabilities` records what an adapter
//! asserts, held to the registry by a test. They disagree in the gap between
//! *catalogued* and *adapted*, and the local rows are the live example: they say
//! `streaming: supported` because whisper.cpp documents a streaming example and
//! a `whisper-server`, while `core::providers::local` answers `Unsupported`
//! because this build shells out to `whisper-cli`, which takes a file. Both are
//! right. Letting either become the other would turn a documentation claim into
//! a runtime promise, which is the shape of the error ADR 0106 found when a
//! mirror was described as a guard.
//!
//! **A catalogue is a snapshot and is wrong the moment a vendor ships**, so it
//! is not a whitelist either. A model absent from this file still round-trips
//! through the config as a typed override — an enterprise deployment name is in
//! no catalogue by construction, a self-hosted server's model list belongs to
//! whoever runs it, and a user who wants yesterday's release does not wait for
//! this repo.

use std::sync::OnceLock;

use serde::Deserialize;

use super::providers::{ModelSupport, ProviderRole};

/// Bumped when the file's shape changes in a way a reader cannot absorb.
const CATALOGUE_VERSION: u32 = 1;

/// Compiled in, like the regression corpus. There is no on-disk override door:
/// the catalogue is part of the build, and a machine-local one would be a
/// second answer to *what does this build route to*.
const EMBEDDED_CATALOGUE: &str = include_str!("../../../shared/model_catalogue.json");

#[derive(Debug, Clone, Deserialize)]
pub struct Catalogue {
    pub version: u32,
    pub providers: Vec<CatalogueProvider>,
    pub models: Vec<ModelRow>,
    pub runtime_defaults: RuntimeDefaults,
    /// What the `AI Models` matrix offers, keyed by lane and then by job. Parsed
    /// here although the drawing is the frontend's reader, because the file is
    /// compiled into this binary and a reference that resolves nowhere should
    /// fail `cargo test` rather than an npm run.
    pub lanes: std::collections::BTreeMap<String, std::collections::BTreeMap<String, LaneJob>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CatalogueProvider {
    pub id: String,
    pub label: String,
    pub lane: String,
}

/// What one vendor documents about one model.
#[derive(Debug, Clone, Deserialize)]
pub struct ModelRow {
    /// The slug consumers name. Not the model id, deliberately.
    pub id: String,
    pub provider: String,
    /// Which of the three roles this model serves — the vocabulary
    /// `core::providers::ProviderRole` already carries, rather than a second one
    /// invented for a data file.
    pub role: ProviderRole,
    /// What goes on the wire.
    pub model_id: String,
    /// What the **vendor documents** about streaming for this row's role. Never
    /// what this build can operate.
    pub streaming: ModelSupport,
    pub languages: String,
    /// Where the row was read, and when. A row without both does not belong in
    /// the file — the rule `docs/PROVIDERS.md` states in prose about itself, and
    /// the one this module's test finally enforces.
    pub source: String,
    pub read_date: String,
    #[serde(default)]
    pub note: Option<String>,
}

/// Which row each of the runtime's model defaults resolves to.
#[derive(Debug, Clone, Deserialize)]
pub struct RuntimeDefaults {
    pub speech: String,
    pub correction: String,
    pub local_correction: String,
    pub agent: String,
    pub local_agent: String,
}

/// What one lane offers one job: the row drawn as chosen, and the rows the
/// picker lists in drawn order.
#[derive(Debug, Clone, Deserialize)]
pub struct LaneJob {
    pub default: String,
    pub offered: Vec<String>,
}

/// The catalogue, parsed once.
///
/// Panics on a malformed file, and that is not a runtime risk: the file is
/// compiled into this binary, every accessor below is exercised by a test in
/// this module, and a build whose `cargo test` passes cannot reach the panic.
/// The alternative — a fallback catalogue — would be a second set of model ids
/// living in Rust, which is the thing this module exists to remove.
pub fn catalogue() -> &'static Catalogue {
    static CATALOGUE: OnceLock<Catalogue> = OnceLock::new();

    CATALOGUE.get_or_init(|| {
        let parsed: Catalogue = serde_json::from_str(EMBEDDED_CATALOGUE)
            .unwrap_or_else(|error| panic!("parse model catalogue: {error}"));

        assert_eq!(
            parsed.version, CATALOGUE_VERSION,
            "model catalogue version mismatch: file={} expected={}",
            parsed.version, CATALOGUE_VERSION
        );

        parsed
    })
}

/// The row a slug names, or nothing.
pub fn row(id: &str) -> Option<&'static ModelRow> {
    catalogue().models.iter().find(|row| row.id == id)
}

/// What goes on the wire for the row a slug names.
///
/// Panics with the slug in the message when the row is gone, because the caller
/// is this repo naming its own data: every slug spelled in Rust is spelled in a
/// test below too, so a rename that misses one fails the suite rather than a
/// user's dictation.
pub fn model_id(id: &str) -> &'static str {
    row(id)
        .unwrap_or_else(|| panic!("model catalogue has no row '{id}'"))
        .model_id
        .as_str()
}

pub fn default_speech_model() -> &'static str {
    model_id(&catalogue().runtime_defaults.speech)
}

pub fn default_correction_model() -> &'static str {
    model_id(&catalogue().runtime_defaults.correction)
}

pub fn default_local_correction_model() -> &'static str {
    model_id(&catalogue().runtime_defaults.local_correction)
}

pub fn default_agent_model() -> &'static str {
    model_id(&catalogue().runtime_defaults.agent)
}

pub fn default_local_agent_model() -> &'static str {
    model_id(&catalogue().runtime_defaults.local_agent)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::providers::{model_capabilities, resolves_to_a_known_provider};

    #[test]
    fn the_file_parses_at_the_version_this_build_expects() {
        let catalogue = catalogue();

        assert_eq!(catalogue.version, CATALOGUE_VERSION);
        assert!(!catalogue.models.is_empty(), "the catalogue carries rows");
    }

    #[test]
    fn every_row_has_an_id_of_its_own() {
        let mut ids: Vec<&str> = catalogue()
            .models
            .iter()
            .map(|row| row.id.as_str())
            .collect();
        let total = ids.len();
        ids.sort_unstable();
        ids.dedup();

        assert_eq!(ids.len(), total, "row ids must be unique");
    }

    /// **The rule `docs/PROVIDERS.md` holds itself to in prose and nothing
    /// enforced.** A row without a source and a date is a model name somebody
    /// remembered, which is the state this whole step exists to leave.
    #[test]
    fn every_row_carries_a_source_and_a_read_date() {
        for row in &catalogue().models {
            assert!(
                !row.source.trim().is_empty(),
                "[{}] carries no source",
                row.id
            );
            assert!(
                !row.model_id.trim().is_empty(),
                "[{}] carries no model id",
                row.id
            );
            assert!(
                !row.languages.trim().is_empty(),
                "[{}] says nothing about languages",
                row.id
            );

            let date = row.read_date.as_bytes();
            assert!(
                date.len() == 10
                    && date[4] == b'-'
                    && date[7] == b'-'
                    && date
                        .iter()
                        .enumerate()
                        .all(|(index, byte)| index == 4 || index == 7 || byte.is_ascii_digit()),
                "[{}] read_date '{}' is not an ISO date",
                row.id,
                row.read_date,
            );
        }
    }

    /// Every row names a vendor the file declares, and every declared vendor
    /// carries at least one row.
    ///
    /// **This is the registry question asked in the only direction that holds.**
    /// A row may not be asked to resolve against `core::providers::registry`,
    /// because a catalogue that could name only registered vendors could not
    /// carry the rows an adapter is written against — ADR 0115 requires
    /// catalogued-but-unadapted to be expressible, and three of this file's six
    /// vendors are exactly that today. What the registry *is* held to is the
    /// other direction, below.
    #[test]
    fn every_row_names_a_vendor_the_file_declares_and_every_vendor_carries_rows() {
        let catalogue = catalogue();

        for row in &catalogue.models {
            assert!(
                catalogue
                    .providers
                    .iter()
                    .any(|provider| provider.id == row.provider),
                "[{}] names undeclared provider '{}'",
                row.id,
                row.provider,
            );
        }

        for provider in &catalogue.providers {
            assert!(
                catalogue
                    .models
                    .iter()
                    .any(|row| row.provider == provider.id),
                "provider '{}' ({}) is declared and carries no row",
                provider.id,
                provider.label,
            );
        }
    }

    /// **A lane this build can operate has rows to operate it with.** The
    /// registry direction that does hold: an adapter without a catalogued model
    /// is a lane whose picker has nothing in it and whose default resolves to a
    /// literal somewhere else, which is the state before this file existed.
    #[test]
    fn every_registered_vendor_carries_a_row_for_every_role_it_serves() {
        let catalogue = catalogue();

        for provider in &catalogue.providers {
            if !resolves_to_a_known_provider(&provider.id) {
                continue;
            }

            for role in [ProviderRole::Speech, ProviderRole::Chat] {
                assert!(
                    catalogue
                        .models
                        .iter()
                        .any(|row| row.provider == provider.id && row.role == role),
                    "registered provider '{}' carries no {} row",
                    provider.id,
                    role.label(),
                );
            }
        }
    }

    /// **The trap ADR 0115 names, tested rather than trusted.** A row whose
    /// vendor has no adapter is a documentation claim, and the runtime answers
    /// `Unknown` for it — never `supported`, whatever the row says about
    /// streaming.
    #[test]
    fn a_catalogued_model_with_no_adapter_answers_unknown() {
        let mut checked = 0;

        for row in &catalogue().models {
            if resolves_to_a_known_provider(&row.provider) {
                continue;
            }

            let answer = model_capabilities(&row.provider, &row.model_id);

            assert_eq!(answer.model, row.model_id);
            assert_eq!(answer.transcription_streaming, ModelSupport::Unknown);
            assert_eq!(answer.reports_detected_language, ModelSupport::Unknown);
            assert_eq!(answer.synthesis_streaming, ModelSupport::Unknown);
            checked += 1;
        }

        assert!(
            checked > 0,
            "the file carries rows for vendors with no adapter, and this test is the reason they are safe to carry",
        );
    }

    /// The other half of the same distinction, on the lane where the two
    /// answers actually disagree today: whisper.cpp documents a streaming
    /// shape, this build drives `whisper-cli`, and the catalogue is not allowed
    /// to make the adapter say otherwise.
    #[test]
    fn a_documented_streaming_shape_is_not_a_capability() {
        let documented = row("local-speech-base").expect("the local base row");

        assert_eq!(documented.streaming, ModelSupport::Supported);
        assert_eq!(
            model_capabilities(&documented.provider, &documented.model_id).transcription_streaming,
            ModelSupport::Unsupported,
            "the adapter answers for the shape it drives, not for the one the vendor documents",
        );
    }

    #[test]
    fn every_runtime_default_resolves_to_a_row() {
        for id in [
            default_speech_model(),
            default_correction_model(),
            default_local_correction_model(),
            default_agent_model(),
            default_local_agent_model(),
        ] {
            assert!(!id.trim().is_empty());
        }

        let defaults = &catalogue().runtime_defaults;
        for slug in [
            &defaults.speech,
            &defaults.correction,
            &defaults.local_correction,
            &defaults.agent,
            &defaults.local_agent,
        ] {
            let row = row(slug).unwrap_or_else(|| panic!("runtime default '{slug}' has no row"));
            assert!(
                resolves_to_a_known_provider(&row.provider),
                "runtime default '{}' sits on '{}', which this build cannot operate",
                slug,
                row.provider,
            );
        }
    }

    /// The drawing's half, checked here because the file is compiled in: a lane
    /// that offers a row which does not exist draws an empty picker, and a
    /// default outside its own offered list draws a chosen value the picker
    /// cannot show.
    #[test]
    fn every_lane_offer_resolves_and_every_default_is_offered() {
        for (lane, jobs) in &catalogue().lanes {
            for (job, entry) in jobs {
                assert!(
                    !entry.offered.is_empty(),
                    "{lane}/{job} offers nothing",
                );
                for slug in &entry.offered {
                    assert!(
                        row(slug).is_some(),
                        "{lane}/{job} offers '{slug}', which has no row",
                    );
                }
                assert!(
                    entry.offered.contains(&entry.default),
                    "{lane}/{job} defaults to '{}', which it does not offer",
                    entry.default,
                );
            }
        }
    }

    /// **A speech job is offered speech models.** The one consistency the
    /// drawing's own sample data does not have across providers — `Cloud.upload`
    /// offers a Groq id under an OpenAI override, which this file made visible
    /// and `docs/PROVIDERS.md` now records as open disagreement 12 — but the
    /// role axis holds everywhere, and a picker that offered a chat model to a
    /// listening job would be a routing error rather than a drawing one.
    #[test]
    fn a_lane_offers_each_job_the_role_that_job_runs() {
        for (lane, jobs) in &catalogue().lanes {
            for (job, entry) in jobs {
                let expected = match job.as_str() {
                    "dictation" | "meetings" | "upload" => ProviderRole::Speech,
                    _ => ProviderRole::Chat,
                };

                for slug in &entry.offered {
                    let row = row(slug).expect("checked by the test above");
                    assert_eq!(
                        row.role, expected,
                        "{lane}/{job} offers '{slug}', which serves {}",
                        row.role.label(),
                    );
                }
            }
        }
    }

    /// Naming a row that is gone fails loudly and says which name, rather than
    /// resolving to something plausible.
    #[test]
    fn a_slug_with_no_row_is_not_quietly_answered() {
        assert!(row("no-such-row").is_none());
    }
}
