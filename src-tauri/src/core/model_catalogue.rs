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
///
/// 2 added the optional `install` block (ADR 0122). Additive, and there is no
/// migration because there is no on-disk state: the file is compiled in below.
const CATALOGUE_VERSION: u32 = 2;

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
    /// How this model gets onto this machine, where that is a question about
    /// this row at all (ADR 0122).
    ///
    /// **`None` is the answer for every hosted lane rather than an omission.**
    /// There is nothing to install for Groq or OpenAI, and a surface asking
    /// them is asking the wrong lane.
    #[serde(default)]
    pub install: Option<InstallSource>,
}

/// The two mechanisms, because there are two and they do not share a disk
/// (ADR 0122).
///
/// The local speech weights are a file WordScript fetches into a directory it
/// manages; the local language models belong to whatever server the user runs,
/// so WordScript asks that server to pull and never places a file beside them.
/// The same act that is correct for the first is inert for the second — a
/// `.gguf` dropped into a folder of our own is a file Ollama cannot see, cannot
/// load and will not list.
#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum InstallSource {
    Download {
        url: String,
        /// What the file is called in the managed directory.
        ///
        /// **Stated rather than derived from the URL.**
        /// `core::providers::local` resolves a recogniser by the
        /// `ggml-{stem}.bin` shape, and a URL is free to be spelled any way at
        /// all — a redirect, a query string, a mirror. Deriving the name from
        /// it would make an install land a file the discovery cannot see.
        file_name: String,
        size_bytes: u64,
        sha256: String,
        source: String,
        read_date: String,
    },
    ServerPull {
        runtime: String,
        /// **Carried beside `model_id`, never derived from it.**
        /// `qwen2.5:7b-instruct` and `qwen2.5-7b-instruct` are not the same
        /// string, and rewriting the punctuation would be a guess dressed as a
        /// lookup.
        tag: String,
        size_bytes: u64,
        quantization: String,
        source: String,
        read_date: String,
    },
}

impl InstallSource {
    /// What it costs on a disk — this machine's for a download, the server's
    /// for a pull.
    pub fn size_bytes(&self) -> u64 {
        match self {
            Self::Download { size_bytes, .. } | Self::ServerPull { size_bytes, .. } => *size_bytes,
        }
    }

    /// Where the URL, size and checksum were read, and when. ADR 0122 gives
    /// `docs/PROVIDERS.md` a maintenance duty over exactly these: a weights
    /// repository that moves a file breaks an install rather than a claim.
    pub fn source(&self) -> &str {
        match self {
            Self::Download { source, .. } | Self::ServerPull { source, .. } => source,
        }
    }

    pub fn read_date(&self) -> &str {
        match self {
            Self::Download { read_date, .. } | Self::ServerPull { read_date, .. } => read_date,
        }
    }

    /// The quantization where the mechanism knows one. A downloaded ggml file
    /// carries its quantization in the weights rather than in a column, so the
    /// download half answers `None` instead of inventing a label for it.
    pub fn quantization(&self) -> Option<&str> {
        match self {
            Self::Download { .. } => None,
            Self::ServerPull { quantization, .. } => Some(quantization),
        }
    }
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

/// Which vendor the catalogue attributes a model id to, for the one role it
/// would be run under.
///
/// **This is how an adapter tells "an id I do not know" apart from "an id that
/// belongs to somebody else"**, and the two need opposite treatment. A model id
/// this file has never seen is a user's own typed override and passes through
/// untouched (ADR 0115). A model id the file attributes to another vendor is a
/// stored value left behind by a connection change, and sending it would spend
/// a request to be told the model does not exist.
///
/// The role is part of the question because one vendor's speech id and another's
/// chat id have no reason to be distinguishable as strings.
pub fn provider_for_model_id(model_id: &str, role: ProviderRole) -> Option<&'static str> {
    let model_id = model_id.trim();
    catalogue()
        .models
        .iter()
        .find(|row| row.role == role && row.model_id == model_id)
        .map(|row| row.provider.as_str())
}

/// Every row this build can put on a machine, in catalogue order.
///
/// The installer's whole input. A row without an install block is not in the
/// list at all rather than in it and refused — the surface that lists these is
/// *what is on this machine*, and a hosted vendor's model has no answer to give
/// it.
pub fn installable_rows() -> Vec<&'static ModelRow> {
    catalogue()
        .models
        .iter()
        .filter(|row| row.install.is_some())
        .collect()
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

    /// **The rule B5 states and nothing else could enforce.** A `Download` row
    /// without a checksum is a file that gets renamed into place unverified,
    /// which is the one window ADR 0122 exists to close; a row without a size
    /// is a free-space check that cannot run and a drawn size that is a guess.
    #[test]
    fn every_download_row_carries_a_size_and_a_checksum() {
        let mut checked = 0;

        for row in installable_rows() {
            let InstallSource::Download {
                url,
                file_name,
                size_bytes,
                sha256,
                ..
            } = row.install.as_ref().expect("installable_rows filtered")
            else {
                continue;
            };

            assert!(
                url.starts_with("https://"),
                "[{}] fetches over {url}, which is not https",
                row.id,
            );
            assert!(*size_bytes > 0, "[{}] carries no size", row.id);
            assert_eq!(
                sha256.len(),
                64,
                "[{}] checksum '{sha256}' is not a SHA256",
                row.id,
            );
            assert!(
                sha256.chars().all(|c| c.is_ascii_hexdigit() && !c.is_uppercase()),
                "[{}] checksum '{sha256}' is not lowercase hex",
                row.id,
            );
            /* The name the file lands under has to be one
               `core::providers::local` can discover. A download that lands
               something else is an install the runtime cannot see, which is
               the fake-installed state one step past the fake-available one
               this whole step removes. */
            assert!(
                file_name.starts_with("ggml-") && file_name.ends_with(".bin"),
                "[{}] would land '{file_name}', which local discovery cannot see",
                row.id,
            );
            checked += 1;
        }

        assert!(checked > 0, "the local speech lane carries download rows");
    }

    /// A pull tag is its own string, and the point of carrying it is that it is
    /// allowed to differ from the model id. Asserted rather than assumed
    /// because deriving one from the other is the shortcut ADR 0122 names.
    #[test]
    fn every_server_pull_row_names_its_own_tag() {
        let mut checked = 0;

        for row in installable_rows() {
            let InstallSource::ServerPull {
                runtime,
                tag,
                size_bytes,
                quantization,
                ..
            } = row.install.as_ref().expect("installable_rows filtered")
            else {
                continue;
            };

            assert_eq!(runtime, "ollama", "[{}] names an unknown runtime", row.id);
            assert!(!tag.trim().is_empty(), "[{}] carries no pull tag", row.id);
            assert!(*size_bytes > 0, "[{}] carries no size", row.id);
            assert!(
                !quantization.trim().is_empty(),
                "[{}] carries no quantization",
                row.id,
            );
            checked += 1;
        }

        assert!(checked > 0, "the local chat lane carries pull rows");
    }

    /// The install block's own facts are dated like every other row's
    /// (ADR 0122's consequence for `docs/PROVIDERS.md`).
    #[test]
    fn every_install_block_carries_a_source_and_a_read_date() {
        for row in installable_rows() {
            let install = row.install.as_ref().expect("installable_rows filtered");

            assert!(
                !install.source().trim().is_empty(),
                "[{}] install carries no source",
                row.id,
            );

            let date = install.read_date().as_bytes();
            assert!(
                date.len() == 10 && date[4] == b'-' && date[7] == b'-',
                "[{}] install read_date '{}' is not an ISO date",
                row.id,
                install.read_date(),
            );
        }
    }

    /// **A hosted lane carries no install block, and `None` is the answer
    /// rather than an omission.** There is nothing to install for Groq or
    /// OpenAI; a row that grew one would put a Download button under a vendor
    /// whose model has never been on anybody's disk.
    #[test]
    fn only_the_local_lane_is_installable() {
        let catalogue = catalogue();

        for row in &catalogue.models {
            let lane = catalogue
                .providers
                .iter()
                .find(|provider| provider.id == row.provider)
                .map(|provider| provider.lane.as_str())
                .expect("every row names a declared vendor");

            if row.install.is_some() {
                assert_eq!(
                    lane, "Local",
                    "[{}] is installable and sits on the {lane} lane",
                    row.id,
                );
            }
        }
    }
}
