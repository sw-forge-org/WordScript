import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppConfig } from "../../test/factories";
import type { AppConfig } from "../../types/ipc";
import type { ProviderCommandError, ProviderStatus } from "../../types/providers";
import { ApiModelsTab } from "./ApiModelsTab";

const openUrlMock = vi.fn();
const revealItemInDirMock = vi.fn();
const invokeMock = vi.fn();

const groqCapabilities = {
  transcription: true,
  chat_completion: true,
  local: false,
  requires_api_key: true,
  supports_prompt_bias: true,
  supports_language: true,
  supports_segments: true,
  model_management: false,
};

const localPreviewCapabilities = {
  transcription: true,
  chat_completion: true,
  local: true,
  requires_api_key: false,
  supports_prompt_bias: true,
  supports_language: true,
  supports_segments: false,
  model_management: true,
};

const groqProviderState = {
  status: {
    provider: "groq",
    default_profile: "cloud-fast",
    credential: {
      provider: "groq",
      configured: false,
      storage: "os_secret_store",
      key_preview: null,
    },
    profiles: [
      {
        id: "cloud-fast",
        provider: "groq",
        mode: "fast",
        model: "whisper-large-v3-turbo",
        label: "Groq fast multilingual transcription",
        default: true,
        requires_api_key: true,
      },
    ],
    capabilities: groqCapabilities,
    local_setup: null,
  } as ProviderStatus,
  isLoading: false,
  error: null as string | null,
  lastError: null as ProviderCommandError | null,
  lastValidation: null,
  saveApiKey: vi.fn(),
  clearApiKey: vi.fn(),
  validateApiKey: vi.fn(),
};

const localPreviewProviderState = {
  status: {
    provider: "local_preview",
    default_profile: "local-preview-base-fast",
    credential: {
      provider: "local_preview",
      configured: false,
      storage: "local_runtime",
      key_preview: "install whisper-cli and set WORDSCRIPT_LOCAL_MODEL_PATH or WORDSCRIPT_LOCAL_MODEL_DIR",
    },
    profiles: [
      {
        id: "local-preview-base-fast",
        provider: "local_preview",
        mode: "fast",
        model: "base",
        label: "Local preview base fast profile (external whisper-cli)",
        default: true,
        requires_api_key: false,
      },
      {
        id: "local-preview-base-quality",
        provider: "local_preview",
        mode: "quality",
        model: "base",
        label: "Local preview base quality profile (external whisper-cli)",
        default: false,
        requires_api_key: false,
      },
    ],
    capabilities: localPreviewCapabilities,
    local_setup: {
      readiness: "setup_required" as const,
      runner_ready: false,
      model_ready: false,
      chat_ready: false,
      issue_code: "missing_runner_and_model" as const,
      resolved_runner: null,
      resolved_model: null,
      resolved_chat_base_url: null,
      resolved_chat_model: null,
      available_chat_models: [],
      guidance: "Local runtime requires whisper-cli plus a local STT model. Set WORDSCRIPT_LOCAL_WHISPER_CLI to the binary or install whisper-cli in PATH, then point WORDSCRIPT_LOCAL_MODEL_PATH to a ggml model file or WORDSCRIPT_LOCAL_MODEL_DIR to a directory containing ggml-base.bin.",
    },
  } as ProviderStatus,
  isLoading: false,
  error: null as string | null,
  lastError: null as ProviderCommandError | null,
  lastValidation: null,
  saveApiKey: vi.fn(),
  clearApiKey: vi.fn(),
  validateApiKey: vi.fn(),
};

afterEach(() => {
  cleanup();
});


beforeEach(() => {
  openUrlMock.mockReset();
  revealItemInDirMock.mockReset();
  invokeMock.mockReset();
  invokeMock.mockImplementation(async (command: string) => {
    if (command === "app_config_file_path") {
      return "/tmp/wordscript/config.json";
    }

    throw new Error(`Unexpected invoke command: ${command}`);
  });
  groqProviderState.status = {
    provider: "groq",
    default_profile: "cloud-fast",
    credential: {
      provider: "groq",
      configured: false,
      storage: "os_secret_store",
      key_preview: null,
    },
    profiles: [
      {
        id: "cloud-fast",
        provider: "groq",
        mode: "fast",
        model: "whisper-large-v3-turbo",
        label: "Groq fast multilingual transcription",
        default: true,
        requires_api_key: true,
      },
    ],
    capabilities: groqCapabilities,
    local_setup: null,
  } as ProviderStatus;
  groqProviderState.isLoading = false;
  groqProviderState.error = null;
  groqProviderState.lastError = null;
  groqProviderState.lastValidation = null;
  groqProviderState.saveApiKey = vi.fn();
  groqProviderState.clearApiKey = vi.fn();
  groqProviderState.validateApiKey = vi.fn();
  localPreviewProviderState.status = {
    provider: "local_preview",
    default_profile: "local-preview-base-fast",
    credential: {
      provider: "local_preview",
      configured: false,
      storage: "local_runtime",
      key_preview: "install whisper-cli and set WORDSCRIPT_LOCAL_MODEL_PATH or WORDSCRIPT_LOCAL_MODEL_DIR",
    },
    profiles: [
      {
        id: "local-preview-base-fast",
        provider: "local_preview",
        mode: "fast",
        model: "base",
        label: "Local preview base fast profile (external whisper-cli)",
        default: true,
        requires_api_key: false,
      },
      {
        id: "local-preview-base-quality",
        provider: "local_preview",
        mode: "quality",
        model: "base",
        label: "Local preview base quality profile (external whisper-cli)",
        default: false,
        requires_api_key: false,
      },
    ],
    capabilities: localPreviewCapabilities,
    local_setup: {
      readiness: "setup_required",
      runner_ready: false,
      model_ready: false,
      chat_ready: false,
      issue_code: "missing_runner_and_model",
      resolved_runner: null,
      resolved_model: null,
      resolved_chat_base_url: null,
      resolved_chat_model: null,
      available_chat_models: [],
      guidance: "Local runtime requires whisper-cli plus a local STT model. Set WORDSCRIPT_LOCAL_WHISPER_CLI to the binary or install whisper-cli in PATH, then point WORDSCRIPT_LOCAL_MODEL_PATH to a ggml model file or WORDSCRIPT_LOCAL_MODEL_DIR to a directory containing ggml-base.bin.",
    },
  } as ProviderStatus;
  localPreviewProviderState.isLoading = false;
  localPreviewProviderState.error = null;
  localPreviewProviderState.lastError = null;
  localPreviewProviderState.lastValidation = null;
  localPreviewProviderState.saveApiKey = vi.fn();
  localPreviewProviderState.clearApiKey = vi.fn();
  localPreviewProviderState.validateApiKey = vi.fn();
});

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: (...args: unknown[]) => openUrlMock(...args),
  revealItemInDir: (...args: unknown[]) => revealItemInDirMock(...args),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("../../hooks/useProvider", () => ({
  providerErrorActionLabel: (action: string) => {
    if (action === "wait_and_retry") {
      return "Wait for the provider limit to reset, then retry.";
    }

    return "Check the provider setup.";
  },
  useProvider: (providerId: string) => providerId === "local_preview" ? localPreviewProviderState : groqProviderState,
}));

describe("ApiModelsTab", () => {
  it("keeps authentication compact and reveals the config file in the system file manager", async () => {
    render(<ApiModelsTab config={createAppConfig()} onChange={vi.fn()} onOpenDiagnostics={vi.fn()} />);

    expect(screen.queryByText(/one local groq key, one speech path, one place for logs/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/full key reveal stays off by design/i)).not.toBeInTheDocument();
    expect(screen.getByText("Storage")).toBeInTheDocument();
    expect(screen.getByText("Last check")).toBeInTheDocument();
    expect(screen.getAllByText("Not checked in this session").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /groq keys/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reveal config/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /diagnostics/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save locally/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /validate stored key/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /reveal config/i }));

    await waitFor(() => expect(revealItemInDirMock).toHaveBeenCalledWith("/tmp/wordscript/config.json"));
  });

  it("shows local runtime as a full local lane without key actions", () => {
    const config = createAppConfig();
    // Set provider to local_preview in the active profile's speech settings
    config.text_profiles = config.text_profiles.map((p) =>
      p.id === "general"
        ? {
            ...p,
            speech: {
              ...p.speech!,
              provider: "local_preview",
              local_model: "base",
              local_profile: "local-preview-base-fast",
              local_correction_model: "llama3.2:latest",
            },
          }
        : p,
    );
    render(
      <ApiModelsTab
        config={config}
        onChange={vi.fn()}
        onOpenDiagnostics={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/local runtime setup required/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/runner and model missing/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/^local runtime setup$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/local runtime setup checklist/i)).toBeInTheDocument();
    expect(screen.getByText("Speech runner")).toBeInTheDocument();
    expect(screen.getByText("STT model")).toBeInTheDocument();
    expect(screen.getAllByText("Cleanup endpoint").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cleanup model").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/install whisper-cli in path/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/wordscript_local_model_path/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/run ollama locally/i)).toBeInTheDocument();
    expect(screen.getByText("Start local AI runtime")).toBeInTheDocument();
    expect(screen.getByText("Pull cleanup model")).toBeInTheDocument();
    expect(screen.getAllByText(/wordscript_local_whisper_cli/i).length).toBeGreaterThan(0);
    /* `SegmentControl` is a group of pressed buttons, not a tablist: a segment
       sets a value and reveals nothing, and the prototype draws the two things
       differently on purpose (`.seg` is aria-pressed, `.subtabs` is a tablist).
       Leg 2 of the GUI port corrected the role. */
    expect(screen.getByRole("button", { name: /local/i, pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /profile/i })).toHaveValue("local-preview-base-fast");
    expect(screen.getByText(/fast transcription mode/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /bias strength/i })).toHaveValue("profile");
    expect(screen.getByRole("switch", { name: /carry initial prompt/i })).not.toBeChecked();
    expect(screen.getByRole("combobox", { name: /beam size/i })).toHaveValue("1");
    expect(screen.getByRole("combobox", { name: /best of/i })).toHaveValue("1");
    const cleanupModelCard = screen.getByText("Cleanup model", { selector: "h3" }).closest("section");
    expect(cleanupModelCard).not.toBeNull();
    expect(within(cleanupModelCard as HTMLElement).getByRole("combobox", { name: /^model$/i })).toHaveValue("llama3.2:latest");
    expect(screen.getByText(/^supported$/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /groq keys/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save locally/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: /^ai cleanup$/i })).not.toBeInTheDocument();
  });

  it("renders discovered local models from the native provider status", () => {
    localPreviewProviderState.status = {
      ...localPreviewProviderState.status,
      default_profile: "local-preview-large-v3-q5_0-quality",
      profiles: [
        {
          id: "local-preview-large-v3-q5_0-fast",
          provider: "local_preview",
          mode: "fast",
          model: "large-v3-q5_0",
          label: "Local preview large-v3-q5_0 fast profile (discovered)",
          default: false,
          requires_api_key: false,
        },
        {
          id: "local-preview-large-v3-q5_0-quality",
          provider: "local_preview",
          mode: "quality",
          model: "large-v3-q5_0",
          label: "Local preview large-v3-q5_0 quality profile (discovered)",
          default: true,
          requires_api_key: false,
        },
      ],
      local_setup: {
        ...localPreviewProviderState.status.local_setup!,
        model_ready: true,
        chat_ready: true,
        resolved_model: "/models/ggml-large-v3-q5_0.bin",
        resolved_chat_base_url: "http://127.0.0.1:11434",
        resolved_chat_model: "qwen2.5:7b-instruct",
        available_chat_models: ["qwen2.5:7b-instruct"],
      },
    } as ProviderStatus;

    const config = createAppConfig();
    // Set local preview settings in the active profile's speech settings
    config.text_profiles = config.text_profiles.map((p) =>
      p.id === "general"
        ? {
            ...p,
            speech: {
              ...p.speech!,
              provider: "local_preview",
              local_model: "large-v3-q5_0",
              local_profile: "local-preview-large-v3-q5_0-quality",
              local_correction_model: "qwen2.5:7b-instruct",
              local_prompt_strength: "profile_and_terms",
              local_prompt_carry: true,
              local_beam_size: 5,
              local_best_of: 5,
              local_profile_prompt_settings: [
                {
                  profile_id: "local-preview-base-fast",
                  prompt_strength: "profile",
                  prompt_carry: false,
                },
                {
                  profile_id: "local-preview-large-v3-q5_0-quality",
                  prompt_strength: "profile_and_terms",
                  prompt_carry: true,
                },
              ],
              local_profile_decode_settings: [
                {
                  profile_id: "local-preview-base-fast",
                  beam_size: 1,
                  best_of: 1,
                },
                {
                  profile_id: "local-preview-large-v3-q5_0-quality",
                  beam_size: 5,
                  best_of: 5,
                },
              ],
            },
          }
        : p,
    );

    render(
      <ApiModelsTab
        config={config}
        onChange={vi.fn()}
        onOpenDiagnostics={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: /profile/i })).toHaveValue("local-preview-large-v3-q5_0-quality");
    expect(screen.getByRole("option", { name: /local preview large-v3-q5_0 quality profile \(discovered\)/i })).toBeInTheDocument();
    expect(screen.getByText(/quality transcription mode/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /bias strength/i })).toHaveValue("profile_and_terms");
    expect(screen.getByRole("switch", { name: /carry initial prompt/i })).toBeChecked();
    expect(screen.getByRole("combobox", { name: /beam size/i })).toHaveValue("5");
    expect(screen.getByRole("combobox", { name: /best of/i })).toHaveValue("5");
    const cleanupModelCard = screen.getByText("Cleanup model", { selector: "h3" }).closest("section");
    expect(cleanupModelCard).not.toBeNull();
    expect(within(cleanupModelCard as HTMLElement).getByRole("combobox", { name: /^model$/i })).toHaveValue("qwen2.5:7b-instruct");
    expect(screen.getAllByText("/models/ggml-large-v3-q5_0.bin").length).toBeGreaterThan(0);
    expect(screen.getAllByText("http://127.0.0.1:11434").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Endpoint reachable").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Model available").length).toBeGreaterThan(0);
  });

  it("loads stored local prompt and decode controls when the profile changes", () => {
    const onChange = vi.fn();
    const config = createAppConfig();
    // Set local preview settings in the active profile's speech settings
    config.text_profiles = config.text_profiles.map((p) =>
      p.id === "general"
        ? {
            ...p,
            speech: {
              ...p.speech!,
              provider: "local_preview",
              local_model: "base",
              local_profile: "local-preview-base-fast",
              local_prompt_strength: "off",
              local_prompt_carry: false,
              local_beam_size: 3,
              local_best_of: 4,
              local_profile_prompt_settings: [
                {
                  profile_id: "local-preview-base-fast",
                  prompt_strength: "off",
                  prompt_carry: false,
                },
                {
                  profile_id: "local-preview-base-quality",
                  prompt_strength: "profile_and_terms",
                  prompt_carry: true,
                },
              ],
              local_profile_decode_settings: [
                {
                  profile_id: "local-preview-base-fast",
                  beam_size: 3,
                  best_of: 4,
                },
                {
                  profile_id: "local-preview-base-quality",
                  beam_size: 7,
                  best_of: 6,
                },
              ],
            },
          }
        : p,
    );

    render(
      <ApiModelsTab
        config={config}
        onChange={onChange}
        onOpenDiagnostics={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: /profile/i }), {
      target: { value: "local-preview-base-quality" },
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const patch = onChange.mock.calls[0][0] as Partial<AppConfig>;
    expect(patch.text_profiles).toBeDefined();
    const profiles = patch.text_profiles!;
    const activeProfile = profiles.find((p) => p.id === "general");
    expect(activeProfile).toBeDefined();
    expect(activeProfile!.speech?.local_profile).toBe("local-preview-base-quality");
    expect(activeProfile!.speech?.local_model).toBe("base");
    expect(activeProfile!.speech?.local_prompt_strength).toBe("profile_and_terms");
    expect(activeProfile!.speech?.local_prompt_carry).toBe(true);
    expect(activeProfile!.speech?.local_beam_size).toBe(7);
    expect(activeProfile!.speech?.local_best_of).toBe(6);
  });

  it("shows the recovery action for classified provider errors", () => {
    groqProviderState.error = "Groq returned HTTP 429.";
    groqProviderState.lastError = {
      kind: "rate_limited",
      message: "Groq returned HTTP 429.",
      status: 429,
      retry_after_seconds: 3,
      retryable: true,
      user_action: "wait_and_retry",
    };

    render(<ApiModelsTab config={createAppConfig()} onChange={vi.fn()} onOpenDiagnostics={vi.fn()} />);

    expect(screen.getByText(/wait for the provider limit to reset, then retry/i)).toBeInTheDocument();
  });
});
