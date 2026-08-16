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
    groq, local, openai, openrouter, self_hosted, ChatCompletionRequest, CredentialKind,
    ModelCapabilities, ProviderCapabilities, ProviderCaptureLimits, ProviderCommandError,
    ProviderCredentialStatus, ProviderRole, ProviderStatus, ProviderStatusRequest, ProviderTier,
    RoleCredentialStatus, TranscribeAudioFileRequest, TranscriptionResponse,
    ValidateProviderApiKeyResponse, DEFAULT_PROVIDER_ID, LOCAL_PROVIDER_ID,
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
/// The credential half lives here rather than on the three role traits below,
/// and it now takes the role as an argument (ADR 0105): a provider holds a
/// credential *set*, and which member answers is a property of the pair
/// `(provider, role)`. Putting it on the role traits instead would put the same
/// three methods in three places and still leave a provider unable to say what
/// it holds for a role it does not serve — which is exactly the answer the
/// registry already gives.
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

    /// Which credential kinds this vendor accepts, in preference order.
    ///
    /// Empty means the lane needs none at all — Local is not a lane missing a
    /// credential, it is a lane with nothing to authenticate against. A kind
    /// absent from this list is refused at the door with the vendor named,
    /// which is where ADR 0102's *no vendor but OpenAI carries a subscription*
    /// is enforced for storage.
    fn credential_kinds(&self) -> &'static [CredentialKind];

    /// What answers for one role, or the name of what is missing (ADR 0105).
    ///
    /// Asked per role and never folded here: the fold is
    /// `providers::aggregate_credential`, and it is conservative on purpose.
    fn credential_status(
        &self,
        role: ProviderRole,
    ) -> Result<RoleCredentialStatus, ProviderCommandError>;

    /// Stores a credential for exactly one `(role, kind)`.
    ///
    /// Fanning one save across several roles is the resolver's job
    /// (`providers::credential_target_roles`), because which roles exist is the
    /// registry's answer and not an adapter's.
    fn save_api_key(
        &self,
        role: ProviderRole,
        kind: CredentialKind,
        api_key: &str,
    ) -> Result<ProviderCredentialStatus, ProviderCommandError>;

    /// Clears exactly one `(role, kind)`. **Clearing one role must not clear
    /// another's**, which is the single bug this signature exists to prevent.
    fn clear_api_key(
        &self,
        role: ProviderRole,
        kind: CredentialKind,
    ) -> Result<ProviderCredentialStatus, ProviderCommandError>;

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
    /// The roles this id registered, in the order a credential is looked for.
    ///
    /// **The one answer to "which roles exist here"**, so a credential cannot
    /// be stored for a role with no implementation any more than a job can be
    /// dispatched to one. Derived from the entry rather than declared beside
    /// it, because a second declaration is a second thing to drift.
    pub fn roles(&self) -> Vec<ProviderRole> {
        let mut roles = Vec::new();
        if self.speech.is_some() {
            roles.push(ProviderRole::Speech);
        }
        if self.chat.is_some() {
            roles.push(ProviderRole::Chat);
        }
        if self.voice.is_some() {
            roles.push(ProviderRole::Voice);
        }
        roles
    }

    /// The speech role, or the reason there is none.
    ///
    /// Still unreachable: every entry registered today listens. It becomes
    /// reachable the moment a lane that transforms but does not listen is
    /// registered — Anthropic is the drawn candidate — and it answers with the
    /// provider's name rather than a generic failure.
    pub fn require_speech(&self) -> Result<&'static dyn SpeechProvider, ProviderCommandError> {
        self.speech
            .ok_or_else(|| role_unavailable(self.id, "speech recognition"))
    }

    /// The chat role, or the reason there is none — **and D1a made this one
    /// reachable** (ADR 0164).
    ///
    /// `openrouter` and `self_hosted` register speech and not chat, so a job
    /// routed to either for a writing role lands here. **It is not only a log
    /// line**: `transform.rs` turns a failed correction into a warning carrying
    /// this message and returns the uncorrected text, so the sentence is read
    /// by a user. `role_unavailable` below is worded for that, and it says what
    /// this build lacks rather than what the vendor cannot do — both of these
    /// vendors serve chat, and ADR 0113 leaves that role to G3.
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
    /* **The step this registry was built for** (ADR 0096, D1). Two roles on one
       key: OpenAI serves `voice` too and no `VoiceProvider` is registered for
       it, because that trait carries no method until F1 (ADR 0114) and no
       adapter lands before the row that operates it (ADR 0109). */
    ProviderEntry {
        id: openai::OPENAI_PROVIDER_ID,
        aliases: &[],
        provider: &openai::OPENAI,
        speech: Some(&openai::OPENAI),
        chat: Some(&openai::OPENAI),
        voice: None,
    },
    /* **THE FIRST TWO ENTRIES THAT REGISTER FEWER ROLES THAN THEIR LANE DRAWS**
       (D1a, ADR 0113, ADR 0164).

       Everything above serves every role its drawn row claims, which is why
       `require_speech` below could describe its own error as unreachable. These
       two make it reachable, and they make something else reachable with it:
       until now, *this entry does not register the role* and *the vendor does
       not offer the role* were the same fact. OpenRouter serves
       `/chat/completions` and this build has no adapter for it; the registry
       states the second half and `src/lib/providerSeam.ts` was corrected in the
       same step so a surface does not report it as the first.

       **Both are the shared shape with a different base URL**, which is the
       whole of ADR 0113: `openai_compatible::CompatibleClient` with
       `https://openrouter.ai/api/v1` and with whatever the user typed. A third
       OpenAI-compatible vendor after these costs a base URL and one of these
       blocks. */
    ProviderEntry {
        id: openrouter::OPENROUTER_PROVIDER_ID,
        aliases: &[],
        provider: &openrouter::OPENROUTER,
        speech: Some(&openrouter::OPENROUTER),
        chat: None,
        voice: None,
    },
    /* Not a vendor and not a chip on the drawn provider row — a lane, like
       `local`, which is why it has no entry in `RUNTIME_IDS` and why
       `providerSeam.test.ts`'s third direction expects none. */
    ProviderEntry {
        id: self_hosted::SELF_HOSTED_PROVIDER_ID,
        aliases: &[],
        provider: &self_hosted::SELF_HOSTED,
        speech: Some(&self_hosted::SELF_HOSTED),
        chat: None,
        voice: None,
    },
    ProviderEntry {
        id: LOCAL_PROVIDER_ID,
        aliases: &[],
        provider: &local::LOCAL,
        speech: Some(&local::LOCAL),
        chat: Some(&local::LOCAL),
        voice: None,
    },
];

/// Every entry this build registered, in table order.
///
/// **The absence of an id from this list is an answer, not a gap** (ADR 0124).
/// A surface drawing ten vendors and holding adapters for two has to tell *no
/// adapter exists* apart from *the lane denies the role*, and the only place
/// that difference is stated is the table itself. Exposing it read-only is
/// cheaper and more honest than asking `resolve_entry` ten times and reading
/// eight errors as the normal answer.
pub fn entries() -> &'static [ProviderEntry] {
    REGISTRY
}

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

/// **The runtime's half of ADR 0164's sentence, and it had the same defect the
/// surface did.**
///
/// It read *"Provider 'x' does not perform y"* — a claim about the vendor,
/// built from the absence of an implementation here. Unreachable while every
/// entry served every role, and reachable the moment D1a registered two that do
/// not: `transform.rs` degrades a failed correction into a warning carrying
/// this text, so it is read by a user and not only by a log.
///
/// **It cannot consult the drawing the way `providerSeam.ts` does** — the drawn
/// `stt`/`llm` booleans are the frontend's and the runtime does not read them
/// (ADR 0106 keeps the drawing on one side of the seam). So it says the one
/// thing it can say truthfully from here: *WordScript has no adapter for this*,
/// which is a fact about this build and is true whichever the vendor's answer
/// would have been.
fn role_unavailable(provider: &str, role: &str) -> ProviderCommandError {
    ProviderCommandError::invalid_request(format!(
        "WordScript has no {role} adapter for '{provider}'. Route this job to a provider it can run, or leave it on the connection's default.",
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

    /// **A credential set is keyed by the roles the entry registered**, and the
    /// entry is the only place that answer comes from. A table walked here
    /// rather than two entries checked, so the tenth adapter is held to it
    /// without editing the test.
    #[test]
    fn every_entry_answers_a_credential_for_exactly_the_roles_it_registered() {
        for entry in REGISTRY {
            let roles = entry.roles();

            assert_eq!(
                roles.contains(&ProviderRole::Speech),
                entry.speech.is_some(),
                "{} registers speech={} and lists it as a credential role={}",
                entry.id,
                entry.speech.is_some(),
                roles.contains(&ProviderRole::Speech),
            );
            assert_eq!(roles.contains(&ProviderRole::Chat), entry.chat.is_some());
            assert_eq!(roles.contains(&ProviderRole::Voice), entry.voice.is_some());

            for role in &roles {
                let credential = entry
                    .provider
                    .credential_status(*role)
                    .expect("a registered role answers for its credential");
                assert_eq!(credential.role, *role);
                assert_eq!(credential.provider, entry.id);
                assert_eq!(
                    credential.configured,
                    credential.missing.is_none(),
                    "{} answers configured={} for {} while naming missing={:?}",
                    entry.id,
                    credential.configured,
                    role.label(),
                    credential.missing,
                );
            }
        }
    }

    /// **A lane that demands a key accepts one, and a lane that accepts no kind
    /// can store nothing** (D1b, ADR 0165).
    ///
    /// **This was one equality and the equality was wrong.**
    /// `requires_api_key == kinds.contains(ApiKey)` held for as long as every
    /// registered lane answered *may* and *must* the same way, and it read as
    /// one claim from two directions because no counterexample existed yet.
    /// `self_hosted` is the counterexample: it **accepts** a bearer token,
    /// because speaches and LocalAI may issue one, and **requires** none,
    /// because `whisper-server` issues none at all. Under the equality that
    /// lane had to pick a side, and each side is a false statement about the
    /// commonest server behind it.
    ///
    /// **The implication is the half that was ever load-bearing**: a lane that
    /// demands a credential while accepting no kind for it is a lane nobody can
    /// configure. The other direction is not dropped but strengthened — an
    /// empty list now has to mean the save door refuses, which is a claim about
    /// behaviour rather than two booleans agreeing with each other. `local` is
    /// the lane it runs against, and its refusal writes nothing anywhere.
    #[test]
    fn a_lane_that_demands_a_key_accepts_one_and_a_lane_that_accepts_none_stores_none() {
        for entry in REGISTRY {
            let kinds = entry.provider.credential_kinds();

            if entry.provider.capabilities().requires_api_key {
                assert!(
                    kinds.contains(&CredentialKind::ApiKey),
                    "{} demands an API key and accepts {:?}",
                    entry.id,
                    kinds,
                );
            }

            if kinds.is_empty() {
                let role = entry
                    .roles()
                    .first()
                    .copied()
                    .expect("a registered entry serves at least one role");

                assert!(
                    entry
                        .provider
                        .save_api_key(role, CredentialKind::ApiKey, "a-key-nobody-asked-for")
                        .is_err(),
                    "{} accepts no credential kind and took one anyway",
                    entry.id,
                );
            }
        }
    }

    /// ADR 0102's refusal, held by the table rather than by a sentence: **no
    /// vendor but OpenAI carries a subscription kind**, until one permits it in
    /// writing. The cost of being wrong is the user's account, not a failed
    /// request, so this fails on the entry rather than at the call.
    #[test]
    fn no_lane_but_openai_may_carry_a_subscription() {
        for entry in REGISTRY {
            if entry
                .provider
                .credential_kinds()
                .contains(&CredentialKind::Subscription)
            {
                assert_eq!(
                    entry.id, "openai",
                    "{} claims a subscription credential; ADR 0102 permits one vendor",
                    entry.id,
                );
            }
        }
    }

    /// One vendor, one credential, one endpoint, **two answers**.
    ///
    /// This is the shape ADR 0110 corrects, and OpenAI is the real case: it
    /// serves `gpt-4o-transcribe` (streams, names the languages it heard) and
    /// `whisper-1` (documented as not streaming) on one key.
    ///
    /// **D1 landed that vendor and this fixture stayed**, which is not
    /// duplication. `openai.rs` asserts what one vendor answers; this asserts
    /// that the *registry* carries the pair through at all, on an entry that
    /// owes nothing to a real vendor's current model list. The two fail for
    /// different reasons, and a vendor rotating a model id must not be able to
    /// take the contract test with it.
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

        fn credential_kinds(&self) -> &'static [CredentialKind] {
            &[CredentialKind::ApiKey]
        }

        fn credential_status(
            &self,
            _role: ProviderRole,
        ) -> Result<RoleCredentialStatus, ProviderCommandError> {
            Err(ProviderCommandError::invalid_request("fixture"))
        }

        fn save_api_key(
            &self,
            _role: ProviderRole,
            _kind: CredentialKind,
            _api_key: &str,
        ) -> Result<ProviderCredentialStatus, ProviderCommandError> {
            Err(ProviderCommandError::invalid_request("fixture"))
        }

        fn clear_api_key(
            &self,
            _role: ProviderRole,
            _kind: CredentialKind,
        ) -> Result<ProviderCredentialStatus, ProviderCommandError> {
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

    /// **A role nothing implements is reported as this build's gap, not as the
    /// vendor's** (D1a, ADR 0164).
    ///
    /// Unreachable until two entries registered fewer roles than their drawn
    /// row claims. It matters because it is not a log line: `transform.rs`
    /// degrades a failed correction into a warning carrying this text and
    /// returns the uncorrected transcript, so a user picking OpenRouter as
    /// their Cloud connection reads this sentence — about a vendor whose own
    /// documentation says it does serve chat.
    #[test]
    fn a_role_no_entry_implements_names_this_builds_gap_rather_than_the_vendors() {
        let openrouter = resolve_entry("openrouter").expect("openrouter is registered");
        let refused = openrouter
            .require_chat()
            .err()
            .expect("the chat role is G3's");

        assert!(refused.message.contains("WordScript has no"));
        assert!(refused.message.contains("chat completion"));
        assert!(refused.message.contains("openrouter"));
        // The half that would have been false. OpenRouter serves this role.
        assert!(!refused.message.contains("does not perform"));

        // And the role it DOES register resolves rather than erroring.
        assert!(openrouter.require_speech().is_ok());
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
