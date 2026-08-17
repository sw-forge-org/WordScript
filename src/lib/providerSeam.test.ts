import { describe, expect, it } from "vitest";

import {
  connectionCapabilitySentence,
  credentialStateFor,
  DEFAULT_CONNECTION_ID,
  isCompleteCapabilityBlock,
  NO_ANSWERS,
  operableProviderNames,
  PROVIDER_CAPABILITY_FIELDS,
  formatUploadSize,
  resolveProviderAnswer,
  resolveUploadAnswer,
  roleForDrawnCapability,
  RUNTIME_IDS,
  runtimeIdFor,
  selectableProviderNames,
} from "./providerSeam";
import { CATALOGUE } from "./modelCatalogue";
import { PROVIDERS } from "@/screens/data";
import type { ProviderCapabilities, ProviderStatus, RegisteredProvider } from "@/types/providers";

/**
 * THE GUARD ADR 0106 REQUIRED, and the reason no document may call the mirror a
 * guard until it exists. Two halves live in two files: this one holds that a
 * denied capability makes a row inert and that the drawn vocabulary and the
 * runtime's cannot drift apart; `src/types/providers.test.ts` holds that the
 * mirror still matches the struct it mirrors.
 */

function capabilities(overrides: Partial<ProviderCapabilities> = {}): ProviderCapabilities {
  return {
    transcription: true,
    chat_completion: true,
    speech_synthesis: false,
    local: false,
    requires_api_key: true,
    supports_prompt_bias: true,
    supports_language: true,
    supports_segments: true,
    model_management: false,
    ...overrides,
  };
}

function registered(overrides: Partial<RegisteredProvider> = {}): RegisteredProvider {
  return {
    provider: "groq",
    roles: ["speech", "chat"],
    capabilities: capabilities(),
    ...overrides,
  };
}

function status(overrides: Partial<ProviderStatus> = {}): ProviderStatus {
  return {
    provider: "groq",
    /* Which account the answer is about (ADR 0209) — the seeded one, since these
       cases are about capabilities and roles rather than about a machine holding
       two accounts on one vendor. */
    connection: DEFAULT_CONNECTION_ID,
    default_profile: "cloud-fast",
    credential: {
      provider: "groq",
      configured: true,
      storage: "the OS secret store",
      key_preview: "gsk_…4f2a",
    },
    profiles: [],
    capabilities: capabilities(),
    model_capabilities: {
      model: "whisper-large-v3-turbo",
      transcription_streaming: "unsupported",
      reports_detected_language: "unsupported",
      synthesis_streaming: "unsupported",
    },
    role_credentials: [
      {
        provider: "groq",
        role: "speech",
        kind: "api_key",
        configured: true,
        storage: "os_secret_store",
        key_preview: "gsk_…4f2a",
        missing: null,
      },
      {
        provider: "groq",
        role: "chat",
        kind: "api_key",
        configured: true,
        storage: "os_secret_store",
        key_preview: "gsk_…4f2a",
        missing: null,
      },
    ],
    local_setup: null,
    self_hosted_endpoint: null,
    ...overrides,
  };
}

/**
 * ADR 0128. The drawn override rows carried a literal green `Set` since Leg 6,
 * and the distinction that ends it is that **`unknown` is not `missing`** —
 * a vendor the screen never asked about has not been found to be without a key.
 */
describe("whether a role's credential is stored", () => {
  it("says `unknown` where no status was read, and never guesses", () => {
    expect(credentialStateFor("Groq", "speech", NO_ANSWERS)).toBe("unknown");

    /* Registered, and still unknown: `registered_providers` reads no keyring
       at all (ADR 0124), so an entry in that list says nothing about a key. */
    expect(
      credentialStateFor("Groq", "speech", { registered: [registered()], statuses: {} }),
    ).toBe("unknown");
  });

  it("reads the role's own entry rather than the connection's block", () => {
    const answers = {
      registered: [registered()],
      statuses: {
        groq: status({
          role_credentials: [
            { provider: "groq", role: "speech", kind: "api_key", configured: true, storage: "os_secret_store", key_preview: "gsk_…4f2a", missing: null },
            { provider: "groq", role: "chat", kind: "api_key", configured: false, storage: "os_secret_store", key_preview: null, missing: "an API key" },
          ],
        }),
      },
    };

    /* One vendor, two roles, two answers — which is A3's whole point and what
       a folded `credential.configured` boolean cannot say (ADR 0105). */
    expect(credentialStateFor("Groq", "speech", answers)).toBe("set");
    expect(credentialStateFor("Groq", "chat", answers)).toBe("missing");
  });

  it("says `unknown` for a vendor this repo has no id for", () => {
    expect(credentialStateFor("Nothing drawn by this name", "chat", NO_ANSWERS)).toBe("unknown");
  });
});

describe("the drawn name and the runtime id", () => {
  /* Direction one: the drawing cannot outgrow the seam. A vendor added to
     `PROVIDERS` with no id is a row the seam can ask nothing about, and it
     would read as *no adapter* forever without anybody noticing. */
  it("gives every drawn vendor an id to ask the runtime by", () => {
    for (const provider of PROVIDERS) {
      expect(runtimeIdFor(provider.name), `${provider.name} has no runtime id`).toBeTruthy();
    }
  });

  it("gives no two drawn vendors the same id", () => {
    const ids = Object.values(RUNTIME_IDS);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /* Direction two: where the model catalogue also declares the vendor, the two
     lists agree. They are separate because the catalogue's own test requires a
     declared vendor to carry model rows and four drawn vendors carry none —
     which is a reason for two lists, not a licence for them to disagree. */
  it("agrees with the model catalogue wherever both declare a vendor", () => {
    for (const [drawnName, id] of Object.entries(RUNTIME_IDS)) {
      const declared = CATALOGUE.providers.find((provider) => provider.id === id);
      if (!declared) continue;

      expect(declared.label, `${id} label`).toBe(drawnName);
      const drawn = PROVIDERS.find((provider) => provider.name === drawnName);
      expect(declared.lane, `${id} lane`).toBe(drawn?.lane);
    }
  });

  /**
   * **Direction three, and the one that matters when an adapter lands.** The
   * registry is allowed to know vendors the drawing does not name — but a
   * vendor the drawing DOES name must be reachable under the id the registry
   * answers with. `openai` under a different spelling would read as a vendor
   * with no adapter forever, on a screen that draws it.
   */
  it("reaches the registry's own ids for every vendor the drawing names", () => {
    const answers = {
      registered: [
        registered({ provider: "groq" }),
        registered({ provider: "local", capabilities: capabilities({ local: true }) }),
        registered({ provider: "openai" }),
      ],
      statuses: {},
    };

    for (const id of answers.registered.map((row) => row.provider)) {
      const drawnName = Object.keys(RUNTIME_IDS).find((name) => RUNTIME_IDS[name] === id);
      /* `local` is a lane rather than a chip on the drawn provider row, so it
         has no drawn name — the assertion is about the ones that do. */
      if (!drawnName) {
        expect(PROVIDERS.some((provider) => provider.name.toLowerCase() === id)).toBe(false);
        continue;
      }
      expect(resolveProviderAnswer(drawnName, "chat", answers).operable).toBe(true);
    }
  });
});

describe("the four answers", () => {
  it("says no adapter for a vendor the registry does not carry", () => {
    const answer = resolveProviderAnswer("Gemini", "chat", {
      registered: [registered()],
      statuses: {},
    });

    expect(answer.operable).toBe(false);
    expect(answer.operable === false && answer.reason.kind).toBe("no_adapter");
    expect(answer.operable === false && answer.reason.sentence).toContain("Gemini");
    expect(answer.operable === false && answer.reason.sentence).toContain("no adapter");
  });

  /**
   * **The state this step exists to create** (ADR 0106): a row that is drawn,
   * named, and not operable because the lane behind it says so. Distinct from
   * the one above, and the difference is the next action the reader takes.
   *
   * **The example is Anthropic and it used to be Groq** (D1a, ADR 0164). It has
   * to be a vendor the DRAWING agrees does not serve the role — `stt: false` on
   * that row is the vendor's own refusal — because a vendor the drawing says
   * does serve it and the registry does not is the other answer below.
   */
  it("says the lane denies the role when the drawing and the runtime agree it does not", () => {
    const anthropic = registered({
      provider: "anthropic",
      roles: ["chat"],
      capabilities: capabilities({ transcription: false }),
    });
    const answer = resolveProviderAnswer("Anthropic", "speech", {
      registered: [anthropic],
      statuses: {},
    });

    expect(answer.operable).toBe(false);
    expect(answer.operable === false && answer.reason.kind).toBe("role_denied");
    expect(answer.operable === false && answer.reason.sentence).toContain("speech recognition");
    /* And the same vendor, same read, still serves the role it does serve. */
    expect(
      resolveProviderAnswer("Anthropic", "chat", {
        registered: [anthropic],
        statuses: {},
      }).operable,
    ).toBe(true);
  });

  /**
   * **THE ANSWER D1a MADE REACHABLE, AND THE SENTENCE IT KEPT FROM BEING FALSE**
   * (ADR 0164).
   *
   * Until this step every registered provider served every role its drawn row
   * claimed, so *the runtime does not serve this role* and *the vendor does not
   * serve this role* were the same fact and one sentence could say both.
   * OpenRouter separates them: `data.ts` draws it `llm: true` and
   * `docs/PROVIDERS.md` documents `/chat/completions`, while D1a registers the
   * speech role alone because ADR 0113 leaves the chat role to G3. The old
   * derivation would have printed *"OpenRouter does not do chat completion"* —
   * a sentence about the vendor, on a screen, that the vendor's own
   * documentation contradicts.
   *
   * **The two halves were both already in the tree.** The drawn `stt`/`llm`
   * booleans are what the vendor does — ADR 0128 corrected OpenRouter's `stt`
   * on exactly that basis — and the capability block is what this build can
   * operate. `no_adapter` is what the gap between them is called, and it was
   * only ever answerable for a whole vendor before.
   */
  it("says no adapter, not role denied, when the vendor serves a role this build has not built", () => {
    const answer = resolveProviderAnswer("OpenRouter", "chat", {
      registered: [
        registered({
          provider: "openrouter",
          roles: ["speech"],
          capabilities: capabilities({ chat_completion: false }),
        }),
      ],
      statuses: {},
    });

    expect(answer.operable).toBe(false);
    expect(answer.operable === false && answer.reason.kind).toBe("no_adapter");
    expect(answer.operable === false && answer.reason.kind).not.toBe("role_denied");
    /* It names the role, because the vendor IS reachable — for the other one. */
    expect(answer.operable === false && answer.reason.sentence).toContain("chat completion");
    expect(answer.operable === false && answer.reason.sentence).toContain("OpenRouter");
    /* And it must not say the vendor does not do it. That is the false half. */
    expect(answer.operable === false && answer.reason.sentence).not.toContain(
      "OpenRouter does not do",
    );
  });

  /**
   * The connection card reads the same pair, and it is the surface where the
   * false sentence would have been read first (B12's finding: four defects
   * survived a green suite and were caught on the rendered card).
   */
  it("tells the connection card which half of a half-built vendor is missing", () => {
    const sentence = connectionCapabilitySentence("OpenRouter", {
      registered: [
        registered({
          provider: "openrouter",
          roles: ["speech"],
          capabilities: capabilities({ chat_completion: false }),
        }),
      ],
      statuses: {},
    });

    expect(sentence).toContain("chat completion");
    expect(sentence).not.toContain("OpenRouter does not do");
  });

  it("names the missing credential rather than calling the vendor unintegrated", () => {
    const answer = resolveProviderAnswer("Groq", "speech", {
      registered: [registered()],
      statuses: {
        groq: status({
          role_credentials: [
            {
              provider: "groq",
              role: "speech",
              kind: "api_key",
              configured: false,
              storage: "os_secret_store",
              key_preview: null,
              missing: "an API key for speech recognition",
            },
          ],
        }),
      },
    });

    expect(answer.operable).toBe(false);
    expect(answer.operable === false && answer.reason.kind).toBe("no_credential");
    expect(answer.operable === false && answer.reason.sentence).toContain(
      "an API key for speech recognition",
    );
  });

  /**
   * **The fourth answer, and the reason the empty mock stops passing.**
   * `capabilities: {}` is what `Models.test.tsx` mocked while the suite went
   * green. JavaScript reads a missing field as falsy, so without this the block
   * would make every lane read as denied and no test would notice — a row
   * silently inert, which ADR 0106 calls the same defect one layer down.
   */
  it("refuses to read an incomplete capability block as a denial", () => {
    const answer = resolveProviderAnswer("Groq", "speech", {
      registered: [registered()],
      statuses: {
        groq: status({ capabilities: {} as unknown as ProviderCapabilities }),
      },
    });

    expect(answer.operable).toBe(false);
    expect(answer.operable === false && answer.reason.kind).toBe("not_answered");
    expect(answer.operable === false && answer.reason.kind).not.toBe("role_denied");
  });

  /**
   * **Three states that all mean "not operable" and must not be one state.**
   * A read that has not come back claims nothing, so a surface keeps whatever
   * reason it had; a read that came back malformed is a defect and is loud; an
   * empty registry is a real answer meaning this build carries no adapters at
   * all. Folding the first into either of the others is how a screen still
   * loading comes to look like a screen whose runtime is broken.
   */
  it("tells a read that has not come back from one that came back empty", () => {
    expect(resolveProviderAnswer("Groq", "speech", NO_ANSWERS)).toMatchObject({
      operable: false,
      reason: { kind: "pending" },
    });

    expect(
      resolveProviderAnswer("Groq", "speech", { registered: [], statuses: {} }),
    ).toMatchObject({ operable: false, reason: { kind: "no_adapter" } });
  });

  it("holds every field of the block to a boolean before reading any of it", () => {
    expect(isCompleteCapabilityBlock(capabilities())).toBe(true);
    expect(isCompleteCapabilityBlock({} as unknown as ProviderCapabilities)).toBe(false);
    expect(isCompleteCapabilityBlock(null)).toBe(false);

    for (const field of PROVIDER_CAPABILITY_FIELDS) {
      const missing = { ...capabilities() } as Record<string, unknown>;
      delete missing[field];
      expect(
        isCompleteCapabilityBlock(missing as unknown as ProviderCapabilities),
        `${field} missing`,
      ).toBe(false);
    }
  });
});

describe("what the surface asks", () => {
  it("translates the drawing's two axes onto the runtime's roles", () => {
    expect(roleForDrawnCapability("stt")).toBe("speech");
    expect(roleForDrawnCapability("llm")).toBe("chat");
  });

  /* A chip picks a connection, not a job. A vendor that listens and does not
     write is a connection worth having; which of its jobs run is the job rows'
     question, one row at a time. */
  it("offers a chip for a registered vendor even where one role is denied", () => {
    const answers = {
      registered: [registered()],
      statuses: { groq: status({ capabilities: capabilities({ chat_completion: false }) }) },
    };

    expect(selectableProviderNames("Cloud", answers)).toEqual(["Groq"]);
    expect(operableProviderNames("Cloud", "chat", answers)).toEqual([]);
    expect(operableProviderNames("Cloud", "speech", answers)).toEqual(["Groq"]);
  });

  it("offers no chip at all before the runtime answers", () => {
    expect(selectableProviderNames("Cloud", NO_ANSWERS)).toEqual([]);
  });

  it("states what the connection does from the runtime, not from the drawn booleans", () => {
    const both = {
      registered: [registered()],
      statuses: { groq: status() },
    };
    expect(connectionCapabilitySentence("Groq", both)).toBe("Speech and language.");

    /* **Anthropic rather than a Groq that denies its own drawn row** (D1a,
       ADR 0164). *Language only* is the sentence for a vendor that genuinely
       serves one role — Anthropic is drawn `stt: false` and says so on its own
       row — and it stopped being the sentence for a vendor whose listening half
       this build has not written, which is now named as the gap it is. */
    const chatOnly = {
      registered: [
        registered({
          provider: "anthropic",
          roles: ["chat"],
          capabilities: capabilities({ transcription: false }),
        }),
      ],
      statuses: {},
    };
    expect(connectionCapabilitySentence("Anthropic", chatOnly)).toContain("Language only");

    /* xAI is drawn `stt: true, llm: false` and is one of the open disagreements
       in `docs/PROVIDERS.md`. The seam does not correct the drawing — ADR 0106
       forbids that — it declines to answer a runtime question from it. */
    const noAdapter = { registered: [registered()], statuses: {} };
    expect(connectionCapabilitySentence("xAI", noAdapter)).toContain("no adapter");
  });
});

/**
 * THE SIZE CONSTRAINT (B7, ADR 0129).
 *
 * The other four `InertReason` kinds answer about a vendor; this one answers
 * about a vendor AND the file, which is why it cannot be known until there is
 * one — and why the choice moved to the point of use at all.
 */
describe("the upload size constraint", () => {
  const answers = {
    registered: [registered()],
    statuses: { groq: status() },
  };

  const tooLarge = {
    kind: "too_large" as const,
    max_bytes: 25 * 1024 * 1024,
    max_seconds: 819,
    detail: "the 25 MiB upload size on your free plan",
  };

  it("greys a vendor too small for this file and names both numbers", () => {
    const answer = resolveUploadAnswer("Groq", "speech", answers, 40 * 1024 * 1024, tooLarge);
    expect(answer.operable).toBe(false);
    if (answer.operable) throw new Error("unreachable");
    expect(answer.reason.kind).toBe("upload_too_large");
    /* Both sizes, because one of them alone leaves the reader doing the
       comparison the surface already did. */
    expect(answer.reason.sentence).toContain("25 MiB");
    expect(answer.reason.sentence).toContain("40 MiB");
    expect(answer.reason.sentence).toContain("free plan");
  });

  it("lets a file that fits through untouched", () => {
    const fits = { kind: "fits" as const, max_bytes: 25 * 1024 * 1024, max_seconds: 819 };
    expect(resolveUploadAnswer("Groq", "speech", answers, 20 * 1024 * 1024, fits).operable).toBe(
      true,
    );
  });

  it("claims nothing before there is a file", () => {
    /* A surface that greyed every vendor while waiting for an answer would be
       inventing a constraint out of its own latency. */
    expect(resolveUploadAnswer("Groq", "speech", answers, null, undefined).operable).toBe(true);
  });

  it("keeps a harder answer rather than replacing it with the size", () => {
    /* A vendor with no adapter cannot take the file for a reason that has
       nothing to do with how big it is, and saying "too large" there would
       send the fix in the wrong direction. */
    const answer = resolveUploadAnswer("Mistral", "speech", answers, 40 * 1024 * 1024, tooLarge);
    expect(answer.operable).toBe(false);
    if (answer.operable) throw new Error("unreachable");
    expect(answer.reason.kind).toBe("no_adapter");
  });

  it("outranks a missing credential, because no key makes the file smaller", () => {
    const missingKey = {
      registered: [registered()],
      statuses: {
        groq: status({
          role_credentials: [
            {
              provider: "groq",
              role: "speech" as const,
              kind: "api_key" as const,
              configured: false,
              storage: "os_secret_store",
              key_preview: null,
              missing: "an API key",
            },
          ],
        }),
      },
    };

    /* Without the file it is the credential that is worth saying. */
    const withoutFile = resolveUploadAnswer("Groq", "speech", missingKey, null, undefined);
    expect(withoutFile.operable).toBe(false);
    if (withoutFile.operable) throw new Error("unreachable");
    expect(withoutFile.reason.kind).toBe("no_credential");

    /* With it, the harder constraint is the one the user is told about.  */
    const withFile = resolveUploadAnswer(
      "Groq",
      "speech",
      missingKey,
      40 * 1024 * 1024,
      tooLarge,
    );
    expect(withFile.operable).toBe(false);
    if (withFile.operable) throw new Error("unreachable");
    expect(withFile.reason.kind).toBe("upload_too_large");
  });

  it("states a size in the units the vendors document theirs in", () => {
    /* MiB, because that is what `docs/PROVIDERS.md`, `groq.rs` and `openai.rs`
       all say. "26.2 MB" against a runtime saying "25 MiB" is two numbers for
       one limit. */
    expect(formatUploadSize(25 * 1024 * 1024)).toBe("25 MiB");
    expect(formatUploadSize(1.5 * 1024 * 1024)).toBe("1.5 MiB");
    expect(formatUploadSize(400 * 1024)).toBe("400 KiB");
  });
});
