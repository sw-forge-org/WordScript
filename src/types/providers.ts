export type ProviderId = "groq" | "local";

export type ProviderErrorKind =
  | "missing_api_key"
  | "secret_store_unavailable"
  | "invalid_request"
  | "unauthorized"
  | "rate_limited"
  | "timeout"
  | "network"
  | "provider_status"
  | "parse"
  | "io"
  | "local_setup";

export type ProviderErrorAction =
  | "configure_credential"
  | "check_secret_store"
  | "change_request"
  | "wait_and_retry"
  | "retry"
  | "check_network"
  | "check_provider_status"
  | "check_local_setup";

export interface ProviderCommandError {
  kind: ProviderErrorKind;
  message: string;
  status: number | null;
  retry_after_seconds: number | null;
  retryable: boolean;
  user_action: ProviderErrorAction;
}

/**
 * Which role a credential answers for (ADR 0105).
 *
 * A credential resolves from the pair `(provider, role)` and never from the
 * provider alone: one account may hold an API key for recognition and a
 * subscription for chat at the same time. Mirrors
 * `core::providers::ProviderRole`.
 */
export type ProviderRole = "speech" | "chat" | "voice";

/**
 * How a role is paid for (ADR 0102).
 *
 * Admissibility lives in the runtime's type, not in a request that fails: a
 * subscription reaches the five chat jobs and there is no speech call to make
 * with it. Mirrors `core::providers::CredentialKind`.
 */
export type CredentialKind = "api_key" | "subscription";

/**
 * The connection-level answer, folded from the per-role ones.
 *
 * `configured` is conservative: it means every role this provider serves has a
 * credential. Which role is missing is answered by
 * `ProviderStatus.role_credentials`, never by widening this block.
 */
export interface ProviderCredentialStatus {
  provider: string;
  configured: boolean;
  storage: string;
  key_preview: string | null;
}

/**
 * What answers for one `(provider, role)` pair — or the name of what does not.
 *
 * A role with no credential is inert and says which one it is missing; it never
 * falls back to the kind the same provider holds for another role. `kind` is
 * `null` when the lane needs no credential at all, which is what Local *is*
 * rather than a Local that is missing one. Mirrors
 * `core::providers::RoleCredentialStatus`.
 */
export interface RoleCredentialStatus {
  provider: string;
  role: ProviderRole;
  kind: CredentialKind | null;
  configured: boolean;
  storage: string;
  key_preview: string | null;
  missing: string | null;
}

export type ProviderMode = "fast" | "quality" | "local" | "self_hosted";

export interface ProviderProfile {
  id: string;
  provider: string;
  mode: ProviderMode;
  model: string;
  label: string;
  default: boolean;
  requires_api_key: boolean;
}

/**
 * The provider axis: which roles this vendor serves, as this build operates it.
 *
 * What a particular model does inside one of those roles is the other axis and
 * lives on `ModelCapabilities` (ADR 0110). Mirrors
 * `core::providers::ProviderCapabilities`.
 */
export interface ProviderCapabilities {
  transcription: boolean;
  chat_completion: boolean;
  /** Whether this vendor speaks at all here. False for every lane today. */
  speech_synthesis: boolean;
  local: boolean;
  requires_api_key: boolean;
  supports_prompt_bias: boolean;
  supports_language: boolean;
  supports_segments: boolean;
  model_management: boolean;
}

/**
 * One provider the runtime holds an adapter for, and what it serves.
 *
 * The answer to the seam's first question (ADR 0124), from the
 * `registered_providers` command. **A vendor missing from this list has no
 * adapter** (ADR 0096) — which is a different sentence from one whose `roles`
 * omit a role (the lane denies it, ADR 0106) and from one whose role has no
 * credential (ADR 0105). Mirrors `core::providers::RegisteredProvider`.
 *
 * It carries no credential: the answer is free of the OS secret store, which is
 * why it can be asked for the whole table at once.
 */
export interface RegisteredProvider {
  provider: string;
  roles: ProviderRole[];
  capabilities: ProviderCapabilities;
}

/**
 * What a model does, or whether the runtime knows.
 *
 * Three states and not a boolean: one drawn lane serves a model list that
 * belongs to somebody else, and **a model whose capability is unknown is not a
 * model that streams** (ADR 0110). A surface reading this says "unknown"
 * rather than resolving it to either answer.
 */
export type ModelSupport = "supported" | "unsupported" | "unknown";

/**
 * The model axis: what one model does inside a role its provider serves.
 *
 * One OpenAI key serves `gpt-4o-transcribe`, which streams, and `whisper-1`,
 * which does not — so a caller holding only the provider is holding half a
 * question. Mirrors `core::providers::ModelCapabilities`.
 */
export interface ModelCapabilities {
  /** The model this answer describes — the resolved one, not the requested. */
  model: string;
  transcription_streaming: ModelSupport;
  reports_detected_language: ModelSupport;
  synthesis_streaming: ModelSupport;
}

export type LocalProviderReadiness = "ready" | "setup_required";

export type LocalProviderIssueCode =
  | "missing_runner"
  | "invalid_runner_path"
  | "runner_probe_failed"
  | "runner_probe_timed_out"
  | "missing_model"
  | "invalid_model_path"
  | "unreadable_model_directory"
  | "model_not_found"
  | "missing_runner_and_model"
  | "invalid_chat_endpoint"
  | "chat_backend_unavailable"
  | "missing_chat_model"
  | "chat_model_not_found";

export interface LocalProviderSetupStatus {
  readiness: LocalProviderReadiness;
  runner_ready: boolean;
  model_ready: boolean;
  chat_ready: boolean;
  issue_code: LocalProviderIssueCode | null;
  resolved_runner: string | null;
  resolved_model: string | null;
  resolved_chat_base_url: string | null;
  resolved_chat_model: string | null;
  available_chat_models: string[];
  guidance: string;
}

export interface ProviderStatus {
  provider: string;
  default_profile: string;
  credential: ProviderCredentialStatus;
  profiles: ProviderProfile[];
  capabilities: ProviderCapabilities;
  /** Answered for the model the request named — ask again to ask about another. */
  model_capabilities: ModelCapabilities;
  /**
   * One entry per role this provider registered (ADR 0105).
   *
   * `credential` above is the fold of exactly these. A surface drawing a key
   * row for chat and a missing-key row for speech on one provider reads this;
   * until such a row is drawn in the gallery, it travels unread on purpose.
   */
  role_credentials: RoleCredentialStatus[];
  local_setup: LocalProviderSetupStatus | null;
}

export interface ProviderStatusRequest {
  provider: string;
  model: string | null;
  correction_model?: string | null;
}

export type GroqProviderStatus = ProviderStatus;

export interface ValidateProviderApiKeyResponse {
  ok: boolean;
  provider: string;
  checked_with: string;
}

export type ValidateGroqApiKeyResponse = ValidateProviderApiKeyResponse;