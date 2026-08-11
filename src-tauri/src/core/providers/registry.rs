//! The provider contract: three roles, one registry, and no enum.
//!
//! Replaces the closed `ProviderId` dispatch described in ADR 0094. Two
//! providers were two arms in eight functions and cost nothing; the drawn
//! target is ten ids across four lanes, which is eighty arms in eight places
//! that must not drift apart. Here a provider is a module that implements the
//! roles it serves, plus one entry in `REGISTRY`.
//!
//! **A provider that does not serve a role does not implement it.** There is no
//! stub returning "unsupported" — the absence is a `None` in the entry, and it
//! cannot be turned into a `Some` without an implementation the compiler has
//! seen. `VoiceProvider` is declared here and implemented by nobody.
//!
//! **A capability is asked on one of two axes, and they are not the same
//! question.** *Which roles does this vendor serve* is the provider's
//! (`capabilities`); *what does this model do inside one of them* is the
//! model's (`model_capabilities`, ADR 0110). One OpenAI key serves a model that
//! streams and a model that does not, so a contract that answered the second
//! question from the provider alone would force a lie on whichever model lost
//! the vote.
//!
//! Dispatch stays static in the sense ADR 0094 means: no dynamic loading, no
//! plugin surface, no configuration file that names a Rust type. `REGISTRY` is
//! a frozen table of `&'static` implementations, and the many-to-one shape the
//! donor ships — several ids over one implementation — is two entries pointing
//! at the same static.

use std::future::Future;
use std::pin::Pin;

use super::{
    groq, local_preview, ChatCompletionRequest, ModelCapabilities, ProviderCapabilities,
    ProviderCaptureLimits, ProviderCommandError, ProviderCredentialStatus, ProviderStatus,
    ProviderStatusRequest, ProviderTier, TranscribeAudioFileRequest, TranscriptionResponse,
    ValidateProviderApiKeyResponse, DEFAULT_PROVIDER_ID, LOCAL_PREVIEW_PROVIDER_ID,
};

/// What an asynchronous provider call returns.
///
/// Boxed rather than `async fn` in the trait, because the registry holds
/// `&'static dyn` implementations and an `async fn` in a trait is not
/// dyn-compatible. The future owns its request and borrows nothing from the
/// provider, so it is `'static`.
pub type ProviderFuture<T> =
    Pin<Box<dyn Future<Output = Result<T, ProviderCommandError>> + Send + 'static>>;

/// What every provider answers, whichever roles it serves.
///
/// The credential half lives here because a provider holds one credential
/// today. ADR 0105 splits it per role, and this is the trait that grows the
/// role argument when it does — not the three below, which are the roles
/// themselves.
pub trait Provider: Send + Sync {
    fn status(
        &self,
        request: &ProviderStatusRequest,
    ) -> Result<ProviderStatus, ProviderCommandError>;

    /// Which roles this provider serves, and how it must be talked to.
    ///
    /// Separate from `status()` because `status()` reads the OS secret store
    /// and probes the local runtime, and **a capability question must be
    /// answerable without either** — including by a test that must not touch a
    /// developer's keyring. `status()` carries the same answer for the surface.
    fn capabilities(&self) -> ProviderCapabilities;

    /// What one of this provider's models does inside a role it serves
    /// (ADR 0110).
    ///
    /// The model is an argument and never a default the caller cannot see:
    /// answering *does this stream* from the provider alone is precisely the
    /// mistake that record corrects. A provider whose model list is somebody
    /// else's answers `Unknown` for an id it has not seen; one whose endpoint
    /// decides the matter answers for every id, including ids it does not ship.
    fn model_capabilities(&self, model: &str) -> ModelCapabilities;

    fn save_api_key(
        &self,
        api_key: &str,
    ) -> Result<ProviderCredentialStatus, ProviderCommandError>;

    fn clear_api_key(&self) -> Result<ProviderCredentialStatus, ProviderCommandError>;

    fn validate_api_key(
        &self,
        api_key: Option<String>,
    ) -> ProviderFuture<ValidateProviderApiKeyResponse>;
}

/// Recognition, and whatever shape it comes in.
///
/// The plans and the capture ceiling sit here rather than on `Provider`,
/// because a plan is today entirely a statement about how much audio may be
/// uploaded: a provider with no speech role has no plans to choose between.
pub trait SpeechProvider: Send + Sync {
    fn transcribe_audio_file(
        &self,
        request: TranscribeAudioFileRequest,
    ) -> ProviderFuture<TranscriptionResponse>;

    fn tiers(&self) -> Vec<ProviderTier>;

    /// Both arguments, always. A cloud lane is bound by the plan and a local
    /// one by the model, and the caller knows which lane it is on least of all.
    fn capture_limits(&self, model: &str, tier_id: &str) -> ProviderCaptureLimits;
}

/// Completions.
pub trait ChatProvider: Send + Sync {
    fn create_chat_completion(&self, request: ChatCompletionRequest) -> ProviderFuture<String>;
}

/// Synthesis. **Declared, implemented by nobody.**
///
/// It carries no method yet on purpose. The synthesis shape is not decided —
/// ADR 0097 owns the output stream it writes to, ADR 0109 owns the job that
/// operates it, and neither has landed — so a signature invented here would be
/// a guess the compiler cannot check. What the trait does carry is the third
/// role's place in the registry, so the provider that eventually synthesises is
/// a `voice:` entry rather than an exception bolted on beside the other two.
pub trait VoiceProvider: Send + Sync {}

/// One id, and the implementations registered behind it.
///
/// Adding a provider is a module plus one of these. Nothing in
/// `providers::mod`'s resolvers moves for it.
pub struct ProviderEntry {
    /// The canonical id. `normalize_provider_value` answers with this and never
    /// with an alias.
    pub id: &'static str,
    /// Ids that resolve here without being the canonical one.
    pub aliases: &'static [&'static str],
    pub provider: &'static dyn Provider,
    pub speech: Option<&'static dyn SpeechProvider>,
    pub chat: Option<&'static dyn ChatProvider>,
    pub voice: Option<&'static dyn VoiceProvider>,
}

/// Printed as the id and the roles behind it, never as the implementations.
/// A registry that cannot be printed is a registry nobody can assert against,
/// and what a test wants to see is which roles an id registered.
impl std::fmt::Debug for ProviderEntry {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("ProviderEntry")
            .field("id", &self.id)
            .field("aliases", &self.aliases)
            .field("speech", &self.speech.is_some())
            .field("chat", &self.chat.is_some())
            .field("voice", &self.voice.is_some())
            .finish()
    }
}

impl ProviderEntry {
    /// The speech role, or the reason there is none.
    ///
    /// Unreachable for the two providers registered today, and that is the
    /// point: it becomes reachable the moment a lane that transforms but does
    /// not listen is registered, and it answers with the provider's name rather
    /// than a generic failure.
    pub fn require_speech(&self) -> Result<&'static dyn SpeechProvider, ProviderCommandError> {
        self.speech
            .ok_or_else(|| role_unavailable(self.id, "speech recognition"))
    }

    pub fn require_chat(&self) -> Result<&'static dyn ChatProvider, ProviderCommandError> {
        self.chat
            .ok_or_else(|| role_unavailable(self.id, "chat completion"))
    }
}

/// Every provider this build can operate.
static REGISTRY: &[ProviderEntry] = &[
    ProviderEntry {
        id: DEFAULT_PROVIDER_ID,
        aliases: &[],
        provider: &groq::GROQ,
        speech: Some(&groq::GROQ),
        chat: Some(&groq::GROQ),
        voice: None,
    },
    ProviderEntry {
        id: LOCAL_PREVIEW_PROVIDER_ID,
        aliases: &["local"],
        provider: &local_preview::LOCAL_PREVIEW,
        speech: Some(&local_preview::LOCAL_PREVIEW),
        chat: Some(&local_preview::LOCAL_PREVIEW),
        voice: None,
    },
];

/// The entry a stored provider value names.
///
/// An empty value is the default provider rather than an error: a config that
/// has never been written names nothing, and refusing it would make a fresh
/// install inert.
pub fn resolve_entry(provider: &str) -> Result<&'static ProviderEntry, ProviderCommandError> {
    let normalized = provider.trim().to_ascii_lowercase();
    let requested = if normalized.is_empty() {
        DEFAULT_PROVIDER_ID
    } else {
        normalized.as_str()
    };

    REGISTRY
        .iter()
        .find(|entry| entry.id == requested || entry.aliases.contains(&requested))
        .ok_or_else(|| {
            ProviderCommandError::invalid_request(format!(
                "Provider '{}' is not supported yet.",
                requested
            ))
        })
}

fn role_unavailable(provider: &str, role: &str) -> ProviderCommandError {
    ProviderCommandError::invalid_request(format!(
        "Provider '{provider}' does not perform {role}. Route this job to one that does.",
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::providers::ModelSupport;

    /// **The role axis cannot be claimed, only implemented.**
    ///
    /// `speech_synthesis: true` on a provider with `voice: None` would be a
    /// surface offering a job the registry cannot dispatch — the same defect
    /// class as a drawn row that looks settable and does nothing. This runs
    /// over the whole table rather than over the two entries registered today,
    /// so the tenth adapter is held to it without editing the test.
    #[test]
    fn every_entry_states_exactly_the_roles_it_registered() {
        for entry in REGISTRY {
            let capabilities = entry.provider.capabilities();

            assert_eq!(
                capabilities.transcription,
                entry.speech.is_some(),
                "{} states transcription={} and registers speech={}",
                entry.id,
                capabilities.transcription,
                entry.speech.is_some(),
            );
            assert_eq!(
                capabilities.chat_completion,
                entry.chat.is_some(),
                "{} states chat_completion={} and registers chat={}",
                entry.id,
                capabilities.chat_completion,
                entry.chat.is_some(),
            );
            assert_eq!(
                capabilities.speech_synthesis,
                entry.voice.is_some(),
                "{} states speech_synthesis={} and registers voice={}",
                entry.id,
                capabilities.speech_synthesis,
                entry.voice.is_some(),
            );
        }
    }

    /// One vendor, one credential, one endpoint, **two answers**.
    ///
    /// This is the shape ADR 0110 corrects, and OpenAI is the real case: it
    /// serves `gpt-4o-transcribe` (streams, names the languages it heard) and
    /// `whisper-1` (documented as not streaming) on one key. ADR 0096 schedules
    /// that adapter first and it is not built, so the shape is proved here
    /// against a fixture rather than left unproved until the vendor lands —
    /// **the axis has to be right before an adapter hard-codes the wrong one**,
    /// which is the whole reason this step precedes D1.
    struct TwoModelVendor;

    impl Provider for TwoModelVendor {
        fn status(
            &self,
            _request: &ProviderStatusRequest,
        ) -> Result<ProviderStatus, ProviderCommandError> {
            Err(ProviderCommandError::invalid_request(
                "the fixture answers capability questions and nothing else",
            ))
        }

        fn capabilities(&self) -> ProviderCapabilities {
            ProviderCapabilities {
                transcription: true,
                chat_completion: false,
                speech_synthesis: false,
                local: false,
                requires_api_key: true,
                supports_prompt_bias: true,
                supports_language: true,
                supports_segments: true,
                model_management: false,
            }
        }

        fn model_capabilities(&self, model: &str) -> ModelCapabilities {
            match model.trim() {
                "gpt-4o-transcribe" => ModelCapabilities {
                    model: model.trim().to_string(),
                    transcription_streaming: ModelSupport::Supported,
                    reports_detected_language: ModelSupport::Supported,
                    synthesis_streaming: ModelSupport::Unsupported,
                },
                "whisper-1" => ModelCapabilities {
                    model: model.trim().to_string(),
                    transcription_streaming: ModelSupport::Unsupported,
                    reports_detected_language: ModelSupport::Unsupported,
                    synthesis_streaming: ModelSupport::Unsupported,
                },
                other => ModelCapabilities::unknown(other),
            }
        }

        fn save_api_key(
            &self,
            _api_key: &str,
        ) -> Result<ProviderCredentialStatus, ProviderCommandError> {
            Err(ProviderCommandError::invalid_request("fixture"))
        }

        fn clear_api_key(&self) -> Result<ProviderCredentialStatus, ProviderCommandError> {
            Err(ProviderCommandError::invalid_request("fixture"))
        }

        fn validate_api_key(
            &self,
            _api_key: Option<String>,
        ) -> ProviderFuture<ValidateProviderApiKeyResponse> {
            Box::pin(async { Err(ProviderCommandError::invalid_request("fixture")) })
        }
    }

    #[test]
    fn the_two_axes_answer_differently_for_one_provider() {
        let vendor = TwoModelVendor;

        // The role axis says the same thing for both models: this vendor
        // listens. It is the only question it can answer.
        assert!(vendor.capabilities().transcription);

        let streaming = vendor.model_capabilities("gpt-4o-transcribe");
        let batch = vendor.model_capabilities("whisper-1");

        assert_eq!(
            streaming.transcription_streaming,
            ModelSupport::Supported,
            "one model on this key streams",
        );
        assert_eq!(
            batch.transcription_streaming,
            ModelSupport::Unsupported,
            "and the other, on the same key, does not",
        );
        assert_eq!(
            streaming.reports_detected_language,
            ModelSupport::Supported
        );
        assert_eq!(
            batch.reports_detected_language,
            ModelSupport::Unsupported
        );
    }

    /// The OpenRouter case, which ADR 0110 stops treating as an exception: the
    /// model list is somebody else's, so an id this build has not seen is not
    /// an id that streams, and it is not an id that refuses to either.
    #[test]
    fn a_model_this_build_has_not_seen_answers_unknown_rather_than_no() {
        let answer = TwoModelVendor.model_capabilities("some-vendors-newest-model");

        assert_eq!(answer.model, "some-vendors-newest-model");
        assert_eq!(answer.transcription_streaming, ModelSupport::Unknown);
        assert_eq!(answer.reports_detected_language, ModelSupport::Unknown);
        assert_eq!(answer.synthesis_streaming, ModelSupport::Unknown);
    }
}
