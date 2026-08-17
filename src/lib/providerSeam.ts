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
import type { AppConfig, Connection } from "@/types/ipc";
import {
  activeConnection,
  connectionById,
  DEFAULT_CONNECTION_ID,
  resolveConnections,
} from "@/lib/textProfiles";

export {
  activeConnection as activeConnectionOf,
  connectionById,
  DEFAULT_CONNECTION_ID,
  resolveConnections,
};
import type {
  ProviderCapabilities,
  ProviderRole,
  ProviderStatus,
  RegisteredProvider,
  UploadCapacity,
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
export const SELF_HOSTED_PROVIDER_ID = "self_hosted";

/**
 * The id a config that names nothing resolves to. Mirrors
 * `core::providers::DEFAULT_PROVIDER_ID`.
 *
 * **A default, not a fallback for a value that failed to resolve.** The runtime
 * reads an empty provider as this one, because a config that has never been
 * written names nothing and refusing it would make a fresh install inert
 * (`registry::resolve_entry`); an id that IS written and is not in the registry
 * gets an error there and a sentence here, and must never be quietly replaced
 * by this constant. That substitution is what the two-valued `ProviderId` did
 * to every cloud vendor until D1c.
 */
export const DEFAULT_PROVIDER_ID = "groq";

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
  /* NOT A CHIP, AND STILL A NAME THE SEAM HAS TO ANSWER FOR (D1b, ADR 0165).
     `Your server` is a lane rather than a vendor on the provider row — nothing
     in `PROVIDERS` draws it — but a job on that lane still asks *can this run*,
     and without an id here the answer was built for the string `your server`
     and came back *no adapter*: a false sentence about a lane whose adapter
     landed in D1a. The label is `LANE_LABEL["Self-hosted"]` and the id is what
     the registry answers with. */
  "Your server": SELF_HOSTED_PROVIDER_ID,
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
 * The vendor a lane IS, where the lane is the vendor (D1b, ADR 0165).
 *
 * **Two lanes have no chip row because there is nothing to choose between**:
 * `Local` is a runtime on this disk and `Your server` is a URL you operate, so
 * the lane and the vendor are one thing. Every other lane draws its vendors in
 * `PROVIDERS` and this map is empty for them.
 *
 * **`Local` is deliberately absent from the seam's read** — see
 * `useProviderSeam`, which is the only caller that treats this as a list to ask
 * the runtime about. Its status probes the disk, and `useLocalSetup` already
 * does that once for both tabs (ADR 0124).
 */
export const LANE_PROVIDER_IDS: Partial<Record<LaneName, string>> = {
  "Self-hosted": SELF_HOSTED_PROVIDER_ID,
  Local: "local",
};

/**
 * Which lane a stored connection puts the card on (D1b).
 *
 * **The lane stopped being a thing the screen remembers and became a thing the
 * config says.** A machine dictating through its own server that opened `AI
 * Models` on the Cloud card would be describing somebody else's connection —
 * and every row under it would belong to a lane the runtime is not using.
 */
export function laneForProviderId(providerId: string): LaneName {
  const lane = (Object.keys(LANE_PROVIDER_IDS) as LaneName[]).find(
    (name) => LANE_PROVIDER_IDS[name] === providerId,
  );
  if (lane) return lane;

  const drawnName = drawnNameFor(providerId);
  return PROVIDERS.find((provider) => provider.name === drawnName)?.lane ?? "Cloud";
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
  kind:
    | "no_adapter"
    | "role_denied"
    | "no_credential"
    | "not_answered"
    | "pending"
    /**
     * The file is past what this vendor accepts in one request (B7, ADR 0129).
     *
     * **A constraint the runtime can compute, and the first of its family.**
     * The other four are answers about the vendor; this one is an answer about
     * the vendor AND the thing being sent, so it cannot be known until there is
     * a file — which is the whole argument for moving the choice to the point
     * of use. ADR 0131 names a sibling that has not landed yet, a lane that
     * cannot stream under a control that needs streaming, and says explicitly
     * that it must reuse this mechanism rather than invent a second.
     */
    | "upload_too_large";
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
    return roleUnavailable(drawnName, role);
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

/**
 * Whether one role of one drawn vendor has a credential — three-valued.
 *
 * **`unknown` is not `missing`, and that distinction is the whole reason this
 * exists** (ADR 0128). The drawn override rows carried a literal
 * `StatusBadge tone="success">Set` since Leg 6: a green badge asserting a
 * stored credential for a vendor the screen had never asked about, and on
 * `translate` and `assistant` for Anthropic, which has no adapter and therefore
 * no secret-store entry at all. A drawing may show what a row WILL hold; it may
 * not claim what is stored.
 *
 * `resolveProviderAnswer` cannot answer this on its own: it reports `operable`
 * when no status was read, because a missing status is not a missing key. Here
 * the absence of a status is exactly what has to be said out loud.
 */
export type CredentialState = "set" | "missing" | "unknown";

export function credentialStateFor(
  drawnName: string,
  role: ProviderRole,
  answers: RuntimeAnswers,
): CredentialState {
  const providerId = runtimeIdFor(drawnName);
  if (!providerId) return "unknown";

  const status = answers.statuses[providerId];
  const credential = status?.role_credentials?.find((row) => row.role === role);
  if (!credential) return "unknown";

  return credential.configured ? "set" : "missing";
}

/**
 * A size in the units the vendors themselves document limits in.
 *
 * MiB because that is what every recorded ceiling in `docs/PROVIDERS.md` is
 * stated in and what `groq.rs` and `openai.rs` print in their own refusals. A
 * surface that said "26.2 MB" against a runtime that said "25 MiB" would be two
 * numbers for one limit, which is the drift ADR 0034 is about.
 */
export function formatUploadSize(bytes: number): string {
  const mib = bytes / (1024 * 1024);
  if (mib >= 10) return `${Math.round(mib)} MiB`;
  if (mib >= 1) return `${mib.toFixed(1)} MiB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KiB`;
}

/**
 * Whether a vendor can be operated for a role AND take this particular file
 * (B7, ADR 0129).
 *
 * **The size is asked after the vendor and before the credential, and the order
 * is the finding.** A vendor with no adapter or a denied role cannot take the
 * file for a reason that has nothing to do with its size, so those answers
 * stand. A missing credential is one action away from working; a file past the
 * ceiling is not — no key makes it smaller — so the harder constraint is the
 * one the user is told about.
 *
 * **`capacity` undefined means not asked yet, and it changes nothing.** The
 * runtime cannot be read before there is a file, and a surface that greyed
 * every vendor while waiting for the answer would be inventing a constraint out
 * of its own latency — the `pending` rule one axis over.
 */
export function resolveUploadAnswer(
  drawnName: string,
  role: ProviderRole,
  answers: RuntimeAnswers,
  fileBytes: number | null,
  capacity: UploadCapacity | undefined,
): ProviderAnswer {
  const base = resolveProviderAnswer(drawnName, role, answers);

  /* Everything except a missing credential is a harder answer than the size,
     so it wins. `not_answered` and `pending` included: a runtime that has not
     said what a vendor can do has not said what it accepts either. */
  if (!base.operable && base.reason.kind !== "no_credential") return base;

  if (capacity?.kind !== "too_large" || fileBytes === null) return base;

  return {
    operable: false,
    reason: {
      kind: "upload_too_large",
      sentence: `${drawnName} accepts ${formatUploadSize(capacity.max_bytes)} per file and this one is ${formatUploadSize(fileBytes)} — ${capacity.detail}.`,
    },
  };
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
 * Writes one connection, leaving every other account alone (ADR 0208).
 *
 * **`patch` is a shallow merge over `AppConfig`**, so writing `connections`
 * means writing the whole list. A row that built it from its own account would
 * drop every other one — the defect ADR 0167 recorded on the plan map, one
 * object over, and the reason both doors are functions rather than inline
 * object literals at the call site.
 *
 * An id that matches nothing is appended, which is how *New connection* lands.
 */
export function buildConnectionsPatch(
  config: AppConfig,
  connection: Connection,
): Partial<AppConfig> {
  const current = resolveConnections(config);
  const next = current.some((entry) => entry.id === connection.id)
    ? current.map((entry) => (entry.id === connection.id ? connection : entry))
    : [...current, connection];
  return { connections: next };
}

/**
 * Removes one account, and never repoints the profiles that named it.
 *
 * **A profile keeps naming what it named** (ADR 0208): its jobs go inert with
 * that name in the sentence, because choosing a different account for somebody
 * is choosing who pays. The surface states how many profiles are about to lose
 * their connection BEFORE this is called; that count is
 * `profilesUsingConnection`.
 */
export function buildConnectionRemovalPatch(
  config: AppConfig,
  connectionId: string,
): Partial<AppConfig> {
  return {
    connections: resolveConnections(config).filter((entry) => entry.id !== connectionId),
  };
}

/** How many profiles name this account, for the sentence a deletion owes. */
export function profilesUsingConnection(config: AppConfig, connectionId: string): number {
  return config.text_profiles.filter((profile) => {
    const axis = profile.providers;
    if (!axis) return connectionId === DEFAULT_CONNECTION_ID;
    return (
      axis.default === connectionId ||
      Object.values(axis.overrides ?? {}).includes(connectionId)
    );
  }).length;
}

/** The first account this machine holds on one vendor, if any. */
export function connectionForVendor(
  config: AppConfig,
  vendorId: string,
): Connection | undefined {
  return resolveConnections(config).find((entry) => entry.provider === vendorId);
}

/** An id no account on this machine is using yet.
 *
 *  **Readable and derived rather than random**, matching the ids the migration
 *  writes: an entry name in the OS secret store is the one string a person may
 *  actually have to look at, and `connection-groq-2` says more there than a
 *  UUID does. */
function unusedConnectionId(config: AppConfig, vendorId: string): string {
  const taken = new Set(resolveConnections(config).map((entry) => entry.id));
  const base = `connection-${vendorId}`;
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * The account a vendor is reached with, creating one when this machine holds
 * none (ADR 0208).
 *
 * **Picking a lane picks an account**, which is what keeps the lane chips
 * working exactly as they did: a reader who has never heard the word
 * *connection* switches to `Your server`, gets an account for it, and types a
 * URL into the rows below. The second account is the thing they go looking for,
 * and it is one button away.
 *
 * Returns the patch that creates it — empty when nothing had to be created —
 * beside the id to point a profile at.
 */
export function buildVendorConnectionPatch(
  config: AppConfig,
  vendorId: string,
): { patch: Partial<AppConfig>; connectionId: string } {
  const existing = connectionForVendor(config, vendorId);
  if (existing) return { patch: {}, connectionId: existing.id };

  const created: Connection = {
    id: unusedConnectionId(config, vendorId),
    label: drawnNameFor(vendorId) ?? vendorId,
    provider: vendorId,
    base_url: "",
    model: "",
    plan: "",
  };
  return { patch: buildConnectionsPatch(config, created), connectionId: created.id };
}

/**
 * A second account on one vendor — the case the whole axis exists for.
 *
 * Named after the vendor with a number rather than left blank, because an
 * account with no name is the one thing this object must never be: the reader
 * renames it to *Employer* the moment they know which one it is.
 */
export function buildNewConnectionPatch(
  config: AppConfig,
  vendorId: string,
): { patch: Partial<AppConfig>; connectionId: string } {
  const sameVendor = resolveConnections(config).filter((entry) => entry.provider === vendorId);
  const created: Connection = {
    id: unusedConnectionId(config, vendorId),
    label: `${drawnNameFor(vendorId) ?? vendorId} ${sameVendor.length + 1}`,
    provider: vendorId,
    base_url: "",
    model: "",
    plan: "",
  };
  return { patch: buildConnectionsPatch(config, created), connectionId: created.id };
}

/**
 * Writes one connection's account plan.
 *
 * **A default plan is stored as absence**, and that is why an empty id clears
 * the field rather than writing a name. The runtime resolves an empty plan to
 * the vendor's default (`groq::capture_limits`); storing the default's own id
 * as well would be a second spelling of one answer, and the two drift the day a
 * vendor renames its free plan.
 */
export function buildConnectionPlanPatch(
  config: AppConfig,
  connectionId: string,
  planId: string,
): Partial<AppConfig> {
  const connection = resolveConnections(config).find((entry) => entry.id === connectionId);
  if (!connection) return {};
  return buildConnectionsPatch(config, { ...connection, plan: planId.trim() });
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

/**
 * WHY A REGISTERED VENDOR CANNOT SERVE ONE OF ITS ROLES — and there are two
 * reasons, not one (D1a, ADR 0164).
 *
 * **Until D1a the two could not come apart.** Every registered provider served
 * every role its drawn row claimed, so *this build has no adapter for the role*
 * and *the vendor does not offer the role* were one fact, and `role_denied`
 * could speak for both. OpenRouter separates them: the drawing says `llm: true`
 * and `docs/PROVIDERS.md` documents `/chat/completions`, while ADR 0113 leaves
 * that role to G3 and D1a registers the speech half alone. The old sentence
 * would have said *"OpenRouter does not do chat completion"* on a screen, about
 * a vendor whose own documentation says it does.
 *
 * **Both halves were already here.** The drawn `stt` / `llm` booleans are what
 * the VENDOR does — ADR 0128 corrected OpenRouter's `stt` on exactly that
 * evidence — and the capability block is what THIS BUILD can operate.
 * `no_adapter` is the name the gap between them already had; it was simply
 * only answerable for a whole vendor, because absence from the registry is the
 * only way the runtime had to state it.
 *
 * **`voice` keeps the denial**, because the drawing has no third column: the
 * matrix draws `stt` and `llm` and nothing claims a vendor synthesises, so
 * there is no drawn assertion to contradict. F1 is the step that gives that
 * role a row, and ADR 0109 keeps the adapter behind it.
 */
function roleUnavailable(drawnName: string, role: ProviderRole): ProviderAnswer {
  const drawn = PROVIDERS.find((provider) => provider.name === drawnName);
  const vendorClaimsRole =
    role === "speech" ? drawn?.stt : role === "chat" ? drawn?.llm : undefined;

  if (vendorClaimsRole) {
    return {
      operable: false,
      reason: {
        kind: "no_adapter",
        sentence: `WordScript has no ${roleLabel(role)} adapter for ${drawnName} yet — the vendor serves it, this build does not.`,
      },
    };
  }

  return {
    operable: false,
    reason: {
      kind: "role_denied",
      sentence: `${drawnName} does not do ${roleLabel(role)} — this job stays on a provider that can.`,
    },
  };
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
