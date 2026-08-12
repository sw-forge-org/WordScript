/**
 * THE SEAM — the third thing, and until now the missing one (ADR 0106).
 *
 * `src/screens/data.ts` is the drawing: it states what the product intends to
 * offer, it is copied from the gallery, and `npm run port:diff` measures against
 * it. `core::providers` is the truth about what can be operated. **Neither is
 * edited into the other**, and the code that decides whether a drawn row can be
 * operated is this file.
 *
 * ADR 0094 claimed the TypeScript mirror was already that guard. It was not:
 * no field of `status.capabilities` was read anywhere in `src/`, and
 * `Models.test.tsx` mocked the whole block as `{}` with the suite passing. A
 * mirror is a precondition for a guard, not a guard — ADR 0106 records the
 * correction and this file plus its test is the guard it required.
 *
 * **Four answers, because three reasons plus a runtime that has not answered is
 * four states.** A drawn row may be inert because no adapter exists (ADR 0096),
 * because the lane denies the role (ADR 0106), or because the role has no
 * credential (ADR 0105). The fourth is not a capability answer at all: an
 * incomplete block means the runtime did not answer, and reading a missing
 * field as `false` would make a row silently inert — the same defect one layer
 * down, which ADR 0106 names explicitly.
 */
import { PROVIDERS, type LaneName } from "@/screens/data";
import type {
  ProviderCapabilities,
  ProviderRole,
  ProviderStatus,
  RegisteredProvider,
} from "@/types/providers";

/**
 * The runtime id behind each drawn vendor name.
 *
 * **A restated list with a test as its guard**, which is the arrangement
 * ADR 0106 endorses in its own consequences: the donor's `secretKeys.js` is a
 * single source its `preload.js` cannot import, so it restates the tuples and
 * names a test file as the keeper. The same gap is here, and it is wider —
 * `data.ts` may not carry a runtime id (ADR 0106 does not move it, and a field
 * the gallery has no copy of is one the next paste drops), and the model
 * catalogue may not carry a vendor with no model rows (its own test requires
 * every declared provider to carry one).
 *
 * **For a vendor with no adapter this is what this build would ask for**, not
 * what the registry answers — the registry answers nothing for it, which is the
 * point. `providerSeam.test.ts` holds the three directions that keep the guess
 * from surviving contact: every drawn name has an id, every id the catalogue
 * also declares agrees with it on label and lane, and **every id the registry
 * answers with is reachable from a drawn name** — so the first adapter that
 * lands under a different spelling fails here rather than reading as a vendor
 * with no adapter forever.
 */
export const RUNTIME_IDS: Record<string, string> = {
  Groq: "groq",
  OpenAI: "openai",
  Anthropic: "anthropic",
  Gemini: "gemini",
  Mistral: "mistral",
  xAI: "xai",
  OpenRouter: "openrouter",
  "AWS Bedrock": "bedrock",
  /* Qualified, because ADR 0117 exists to keep this vendor's two products
     apart: Azure Speech is a cloud credential and not a second ladder on this
     enterprise row. An unqualified `azure` is the ambiguity that record was
     written to prevent. */
  "Azure OpenAI": "azure_openai",
  "GCP Vertex AI": "vertex",
};

/** Every drawn name, with the id this build would ask the runtime by. */
export function runtimeIdFor(drawnName: string): string | undefined {
  return RUNTIME_IDS[drawnName];
}

/**
 * The drawn name behind a runtime id — the direction a stored value is read in.
 *
 * `runtimeIdFor` answers when the surface is about to ask the runtime
 * something; this answers when the runtime has already been asked and a config
 * value has to be shown. **An id with no drawn name returns `undefined` rather
 * than the id itself**, because a raw `azure_openai` rendered into a chip row
 * is this repo leaking a storage key onto a surface, and the caller that has a
 * sensible fallback is the one that should choose it.
 */
export function drawnNameFor(providerId: string): string | undefined {
  return Object.keys(RUNTIME_IDS).find((name) => RUNTIME_IDS[name] === providerId);
}

/**
 * Which kind of call a drawn job column makes.
 *
 * `data.ts` says `stt` and `llm` because that is what the drawing calls its two
 * axes; the runtime says `speech` and `chat` because that is what a credential
 * is keyed by (ADR 0105). One translation, here, rather than each caller
 * picking its own — `core::providers::JobKey::role` is the same bridge on the
 * other side and for the same reason.
 */
export function roleForDrawnCapability(cap: "stt" | "llm"): ProviderRole {
  return cap === "stt" ? "speech" : "chat";
}

/**
 * How a role is named in a sentence. Mirrors `core::providers::ProviderRole::label`.
 */
export function roleLabel(role: ProviderRole): string {
  switch (role) {
    case "speech":
      return "speech recognition";
    case "chat":
      return "chat completion";
    case "voice":
      return "speech synthesis";
  }
}

/**
 * The nine fields `core::providers::ProviderCapabilities` declares.
 *
 * Listed as data rather than only as a type, because a type cannot be counted
 * at runtime and **the whole failure this step exists to end is a block that
 * arrived without them**. `providers.test.ts` holds this list against the Rust
 * struct; `isCompleteCapabilityBlock` holds an answer against this list.
 */
export const PROVIDER_CAPABILITY_FIELDS = [
  "transcription",
  "chat_completion",
  "speech_synthesis",
  "local",
  "requires_api_key",
  "supports_prompt_bias",
  "supports_language",
  "supports_segments",
  "model_management",
] as const;

/**
 * Whether the runtime answered the capability question at all.
 *
 * **A missing field is not a `false`.** ADR 0106: a capability defaulting to
 * absent is a row silently inert, and the mirror has to fail loudly instead.
 * JavaScript reads `undefined` as falsy, so without this check an empty block
 * would make every lane read as denied and no test would notice — which is
 * exactly the state that record found and this step ends.
 */
export function isCompleteCapabilityBlock(
  value: ProviderCapabilities | null | undefined,
): value is ProviderCapabilities {
  if (!value || typeof value !== "object") return false;
  const fields = value as unknown as Record<string, unknown>;
  return PROVIDER_CAPABILITY_FIELDS.every((field) => typeof fields[field] === "boolean");
}

/**
 * Why a drawn row cannot be operated.
 *
 * The three ADR 0106 names, plus two states that are not capability answers at
 * all and must not be dressed as one:
 *
 * - `pending` — the read is outstanding. **Nothing has been claimed**, so a
 *   surface keeps whatever reason it already had; the runtime can only refine
 *   it, never retract it.
 * - `not_answered` — the runtime answered and the block was incomplete. That is
 *   a defect and it is loud, because reading a missing field as `false` is a
 *   row silently inert (ADR 0106).
 *
 * Keeping them apart is what stops a screen still loading from looking like a
 * screen whose runtime is broken.
 */
export type InertReason = {
  kind: "no_adapter" | "role_denied" | "no_credential" | "not_answered" | "pending";
  sentence: string;
};

export type ProviderAnswer =
  | { operable: true; provider: string }
  | { operable: false; reason: InertReason };

/**
 * What the surface has read from the runtime so far.
 *
 * `registered` is `null` before the command answers — which is *not* an empty
 * registry, and the difference is the fourth answer. `statuses` carries the
 * per-provider status for the ones the screen asked, keyed by runtime id.
 */
export type RuntimeAnswers = {
  registered: RegisteredProvider[] | null;
  statuses: Record<string, ProviderStatus>;
};

export const NO_ANSWERS: RuntimeAnswers = { registered: null, statuses: {} };

/**
 * Whether a drawn vendor can be operated for one role, and if not, why.
 *
 * **The capability block comes from `provider_status` where the screen holds
 * one**, and from the registered list otherwise. That order is deliberate: the
 * status is the per-provider answer the surface already asks for and carries
 * `role_credentials` beside it, so the credential sentence and the role
 * sentence come from one read rather than from two that can disagree.
 */
export function resolveProviderAnswer(
  drawnName: string,
  role: ProviderRole,
  answers: RuntimeAnswers,
): ProviderAnswer {
  const providerId = runtimeIdFor(drawnName);

  /* A drawn name with no id is this repo naming its own vendors inconsistently,
     not a vendor without an adapter — and not a runtime that failed either, so
     it is loud rather than pending. The test that walks `PROVIDERS` fails long
     before a user sees it. */
  if (!providerId) {
    return notAnswered(drawnName);
  }

  if (answers.registered === null) {
    return {
      operable: false,
      reason: {
        kind: "pending",
        sentence: `Not read yet — the runtime has not answered for ${drawnName}.`,
      },
    };
  }

  const entry = answers.registered.find((row) => row.provider === providerId);
  if (!entry) {
    return {
      operable: false,
      reason: {
        kind: "no_adapter",
        sentence: `${drawnName} is not integrated yet — WordScript has no adapter for it.`,
      },
    };
  }

  const status = answers.statuses[providerId];
  const capabilities = status ? status.capabilities : entry.capabilities;

  if (!isCompleteCapabilityBlock(capabilities)) {
    return notAnswered(drawnName);
  }

  if (!servesRole(capabilities, role)) {
    return {
      operable: false,
      reason: {
        kind: "role_denied",
        sentence: `${drawnName} does not do ${roleLabel(role)} — this job stays on a provider that can.`,
      },
    };
  }

  /* The credential is the last question, and only where a status was read. A
     provider whose key is missing is drawn, named and correct about what it
     does — it is one action away from working, and saying "not integrated" to
     that is the conflation ADR 0106 is about. */
  const credential = status?.role_credentials?.find((row) => row.role === role);
  if (credential && !credential.configured) {
    return {
      operable: false,
      reason: {
        kind: "no_credential",
        sentence: `${drawnName} is missing ${credential.missing ?? "a credential"} — add it on the connection above.`,
      },
    };
  }

  return { operable: true, provider: providerId };
}

/** Which drawn vendors on a lane can be operated for a role, by drawn name. */
export function operableProviderNames(
  lane: LaneName,
  role: ProviderRole,
  answers: RuntimeAnswers,
): string[] {
  return PROVIDERS.filter((provider) => provider.lane === lane)
    .filter((provider) => resolveProviderAnswer(provider.name, role, answers).operable)
    .map((provider) => provider.name);
}

/**
 * Which vendors on a lane can be operated at all, for any role they serve.
 *
 * What a connection chip asks: picking a vendor is not picking a job, and a
 * vendor that listens but does not write is still a connection worth having —
 * the jobs it cannot serve say so on their own rows.
 */
export function selectableProviderNames(lane: LaneName, answers: RuntimeAnswers): string[] {
  return PROVIDERS.filter((provider) => provider.lane === lane)
    .filter((provider) => {
      const id = runtimeIdFor(provider.name);
      return Boolean(id && answers.registered?.some((row) => row.provider === id));
    })
    .map((provider) => provider.name);
}

/**
 * The sentence a connection states about what a vendor does here.
 *
 * The drawn version reads `chosen.stt && chosen.llm` — the drawing answering a
 * runtime question, which is the line ADR 0106 names. This answers it from the
 * runtime where there is a runtime answer, and says so plainly where there is
 * not: a vendor with no adapter is not a vendor that cannot listen.
 */
export function connectionCapabilitySentence(
  drawnName: string,
  answers: RuntimeAnswers,
): string | null {
  const speech = resolveProviderAnswer(drawnName, "speech", answers);
  const chat = resolveProviderAnswer(drawnName, "chat", answers);

  /* Nothing read yet is not a sentence about the vendor. The caller keeps the
     drawn one until there is a runtime answer to prefer over it — a hint that
     flickers through "not read" on every open is noise, not honesty. */
  if (!speech.operable && speech.reason.kind === "pending") return null;

  const blocked = [speech, chat].find(
    (answer) => !answer.operable && answer.reason.kind !== "role_denied",
  );
  if (blocked && !blocked.operable) {
    return blocked.reason.sentence;
  }

  if (speech.operable && chat.operable) return "Speech and language.";
  if (chat.operable) {
    return "Language only — the listening jobs stay on whichever provider can hear.";
  }
  if (speech.operable) {
    return "Speech only — the writing jobs stay on whichever provider can write.";
  }
  return `${drawnName} serves neither the listening nor the writing jobs here.`;
}

function servesRole(capabilities: ProviderCapabilities, role: ProviderRole): boolean {
  switch (role) {
    case "speech":
      return capabilities.transcription;
    case "chat":
      return capabilities.chat_completion;
    case "voice":
      return capabilities.speech_synthesis;
  }
}

/* "Not read" is the drawing's own word for a runtime that did not answer —
   `WiredCeilingBadge` says it where the capture budget is absent rather than
   printing a plausible number. The same word for the same fact, and the wording
   below says which of the two it is: an answer arrived and did not contain the
   capability, which is a different thing from an answer that has not arrived. */
function notAnswered(drawnName: string): ProviderAnswer {
  return {
    operable: false,
    reason: {
      kind: "not_answered",
      sentence: `Not read — the runtime answered for ${drawnName} without saying what it can do.`,
    },
  };
}
