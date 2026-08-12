import { describe, expect, it } from "vitest";

import {
  connectionCapabilitySentence,
  credentialStateFor,
  isCompleteCapabilityBlock,
  NO_ANSWERS,
  operableProviderNames,
  PROVIDER_CAPABILITY_FIELDS,
  resolveProviderAnswer,
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
   */
  it("says the lane denies the role when the runtime denies it", () => {
    const answer = resolveProviderAnswer("Groq", "speech", {
      registered: [registered()],
      statuses: {
        groq: status({ capabilities: capabilities({ transcription: false }) }),
      },
    });

    expect(answer.operable).toBe(false);
    expect(answer.operable === false && answer.reason.kind).toBe("role_denied");
    expect(answer.operable === false && answer.reason.sentence).toContain("speech recognition");
    /* And the same vendor, same read, still serves the role it does serve. */
    expect(
      resolveProviderAnswer("Groq", "chat", {
        registered: [registered()],
        statuses: {
          groq: status({ capabilities: capabilities({ transcription: false }) }),
        },
      }).operable,
    ).toBe(true);
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

    const chatOnly = {
      registered: [registered()],
      statuses: { groq: status({ capabilities: capabilities({ transcription: false }) }) },
    };
    expect(connectionCapabilitySentence("Groq", chatOnly)).toContain("Language only");

    /* xAI is drawn `stt: true, llm: false` and is one of the open disagreements
       in `docs/PROVIDERS.md`. The seam does not correct the drawing — ADR 0106
       forbids that — it declines to answer a runtime question from it. */
    const noAdapter = { registered: [registered()], statuses: {} };
    expect(connectionCapabilitySentence("xAI", noAdapter)).toContain("no adapter");
  });
});
