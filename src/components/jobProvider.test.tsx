import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";

import { JobProviderPicker } from "./jobProvider";
import { createWorkspaceRuntime } from "@/test/factories";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => undefined) }));

const invoked = vi.mocked(invoke);

/**
 * THE WIRING, WHICH NEITHER OF THE OTHER TWO HALVES WOULD CATCH (B7, ADR 0129).
 *
 * `providerSeam.test.ts` holds that the size outranks a credential and yields
 * to a missing adapter; `screens.test.tsx` holds that the picker is on both
 * surfaces and collapsed. **Both pass on a picker that never asks the runtime
 * about the file at all** — the logic would be correct, the control would be
 * present, and no vendor would ever grey. This file holds the join.
 */

const CAPABILITIES = {
  transcription: true,
  chat_completion: true,
  speech_synthesis: false,
  local: false,
  requires_api_key: true,
  supports_prompt_bias: true,
  supports_language: true,
  supports_segments: true,
  model_management: false,
};

const REGISTERED = [
  { provider: "groq", roles: ["speech", "chat"], capabilities: CAPABILITIES },
  { provider: "openai", roles: ["speech", "chat"], capabilities: CAPABILITIES },
];

const roleCredential = (role: string) => ({
  provider: "groq",
  role,
  kind: "api_key",
  configured: true,
  storage: "os_secret_store",
  key_preview: "gsk_…4f2a",
  missing: null,
});

const STATUS = {
  provider: "groq",
  default_profile: "fast",
  credential: { provider: "groq", configured: true, storage: "the OS secret store", key_preview: "gsk_…4f2a" },
  profiles: [],
  capabilities: CAPABILITIES,
  model_capabilities: {
    model: "whisper-large-v3-turbo",
    transcription_streaming: "unsupported",
    reports_detected_language: "unsupported",
    synthesis_streaming: "unsupported",
  },
  role_credentials: [roleCredential("speech"), roleCredential("chat")],
  local_setup: null,
};

const MIB = 1024 * 1024;

/** Groq refuses this file, OpenAI takes it — the split the picker must render. */
const SPLIT_VERDICT = [
  {
    provider: "groq",
    capacity: {
      kind: "too_large",
      max_bytes: 25 * MIB,
      max_seconds: 819,
      detail: "the 25 MiB upload size on your free plan",
    },
  },
  { provider: "openai", capacity: { kind: "fits", max_bytes: 100 * MIB, max_seconds: 3276 } },
];

beforeEach(() => {
  invoked.mockReset();
  invoked.mockImplementation(async (command: string) => {
    if (command === "registered_providers") return REGISTERED;
    if (command === "provider_status") return STATUS;
    if (command === "resolve_upload_capacity") return SPLIT_VERDICT;
    return undefined;
  });
});

afterEach(cleanup);

async function providerOptions(): Promise<HTMLOptionElement[]> {
  const select = await screen.findByLabelText("Provider");
  return [...within(select as HTMLElement).getAllByRole("option")] as HTMLOptionElement[];
}

describe("the picker at the point of use", () => {
  it("asks the runtime about the file it actually has", async () => {
    render(
      <JobProviderPicker jobKey="upload" cap="stt" runtime={createWorkspaceRuntime()} fileBytes={40 * MIB} />,
    );

    await waitFor(() => {
      expect(invoked).toHaveBeenCalledWith(
        "resolve_upload_capacity",
        expect.objectContaining({ bytes: 40 * MIB }),
      );
    });

    /* The candidates are the lane's drawn vendors as runtime ids — the same
       derivation `useProviderSeam` makes, so a lane the drawing grows is
       covered without a second list. */
    const call = invoked.mock.calls.find(([command]) => command === "resolve_upload_capacity")!;
    const candidates = (call[1] as { candidates: Array<{ provider: string }> }).candidates;
    expect(candidates.map((row) => row.provider)).toContain("groq");
    expect(candidates.map((row) => row.provider)).toContain("openai");
  });

  it("greys the vendor that cannot take this file and says why, without rerouting", async () => {
    render(
      <JobProviderPicker jobKey="upload" cap="stt" runtime={createWorkspaceRuntime()} fileBytes={40 * MIB} />,
    );

    await waitFor(async () => {
      const groq = (await providerOptions()).find((option) => option.value === "Groq")!;
      expect(groq.disabled).toBe(true);
    });

    const options = await providerOptions();
    const groq = options.find((option) => option.value === "Groq")!;
    expect(groq.title).toContain("25 MiB");
    expect(groq.title).toContain("40 MiB");

    /* AND THE ONE THAT FITS IS OFFERED RATHER THAN CHOSEN (ADR 0129). Sending
       a recording to a vendor the user did not pick is a data decision wearing
       the costume of a convenience — the donor's `transcriptionFallback.js`
       targets `skip` for the same reason. */
    const openai = options.find((option) => option.value === "OpenAI")!;
    expect(openai.disabled).toBe(false);
    expect(invoked).not.toHaveBeenCalledWith("save_config", expect.anything());
  });

  it("asks nothing before there is a file", async () => {
    render(<JobProviderPicker jobKey="upload" cap="stt" runtime={createWorkspaceRuntime()} />);

    await waitFor(() => expect(invoked).toHaveBeenCalledWith("registered_providers"));
    /* A constraint invented out of the surface's own latency would grey every
       vendor while the screen was merely open. */
    expect(invoked).not.toHaveBeenCalledWith("resolve_upload_capacity", expect.anything());

    const groq = (await providerOptions()).find((option) => option.value === "Groq")!;
    expect(groq.disabled).toBe(false);
  });

  it("asserts no runtime state in the gallery", async () => {
    render(<JobProviderPicker jobKey="upload" cap="stt" fileBytes={40 * MIB} />);

    expect(await screen.findByText(/Using Groq/)).toBeInTheDocument();
    /* The gallery is measured against the prototype property by property, and
       a command fired from it is a runtime answer leaking into a drawing. */
    expect(invoked).not.toHaveBeenCalled();
  });
});
