import { useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { ExternalLink, FileJson, Stethoscope } from "lucide-react";
import { cn } from "../../lib/utils";
import { providerErrorActionLabel, useProvider } from "../../hooks/useProvider";
import {
  FormCard,
  FormRow,
  SegmentControl,
  Select,
  StatTiles,
  StatusBadge,
  Toggle,
} from "../shell";
import type { StatusTone } from "../shell";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { AppConfig, ProfileSpeechSettings } from "../../types/ipc";
import type {
  LocalProviderIssueCode,
  LocalProviderSetupStatus,
  ProviderCapabilities,
  ProviderId,
  ProviderProfile,
} from "../../types/providers";
import {
  buildProfileSpeechPatch,
  resolveActiveTextProfile,
  resolveProfileSpeechSettings,
} from "../../lib/textProfiles";

interface Props {
  config: AppConfig;
  onChange: (p: Partial<AppConfig>) => void;
  onOpenDiagnostics: () => void;
}

const WHISPER_MODELS = [
  "whisper-large-v3-turbo",
  "whisper-large-v3",
  "distil-whisper-large-v3-en",
];
const LOCAL_PREVIEW_MODELS = ["base", "small", "medium", "large-v3"];
const LOCAL_PROMPT_STRENGTH_OPTIONS: Array<{
  value: AppConfig["local_prompt_strength"];
  label: string;
}> = [
  { value: "off", label: "Off" },
  { value: "profile", label: "Profile context only" },
  { value: "profile_and_terms", label: "Profile + terms" },
];
const LOCAL_DECODE_OPTIONS = [1, 2, 3, 4, 5, 6, 8] as const;
const CORRECTION_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
];
const LOCAL_RUNTIME_CORRECTION_MODELS = [
  "llama3.2:latest",
  "qwen2.5:7b-instruct",
  "gemma3:4b",
];
const AGENT_MODEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "llama-3.3-70b-versatile", label: "llama-3.3-70b-versatile — Empfohlen (beste Qualität)" },
  { value: "llama-3.1-8b-instant",    label: "llama-3.1-8b-instant — Schnell, einfache Anweisungen" },
  { value: "mixtral-8x7b-32768",      label: "mixtral-8x7b-32768 — Ausgewogen" },
  { value: "gemma2-9b-it",            label: "gemma2-9b-it — Kompakt" },
];
const LOCAL_AGENT_MODEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "llama3.2:latest",         label: "llama3.2:latest — Empfohlen (beste lokale Qualität)" },
  { value: "qwen2.5:7b-instruct",     label: "qwen2.5:7b-instruct — Ausgewogen" },
  { value: "gemma3:4b",               label: "gemma3:4b — Kompakt" },
];
const LANGUAGES = ["Auto", "en", "de", "fr", "es", "it", "pt", "nl", "pl", "ru", "ja", "ko", "zh"];
const GROQ_CAPABILITIES: ProviderCapabilities = {
  transcription: true,
  chat_completion: true,
  local: false,
  requires_api_key: true,
  supports_prompt_bias: true,
  supports_language: true,
  supports_segments: true,
  model_management: false,
};
const LOCAL_PREVIEW_CAPABILITIES: ProviderCapabilities = {
  transcription: true,
  chat_completion: true,
  local: true,
  requires_api_key: false,
  supports_prompt_bias: true,
  supports_language: true,
  supports_segments: false,
  model_management: true,
};

function buildLocalPreviewFallbackProfiles(): ProviderProfile[] {
  return LOCAL_PREVIEW_MODELS.flatMap((model, index) => {
    const profiles: ProviderProfile[] = [
      {
        id: `local-preview-${model}-fast`,
        provider: "local_preview",
        mode: "fast",
        model,
        label: `Local preview ${model} fast profile (external whisper-cli)`,
        default: index === 0,
        requires_api_key: false,
      },
      {
        id: `local-preview-${model}-quality`,
        provider: "local_preview",
        mode: "quality",
        model,
        label: `Local preview ${model} quality profile (external whisper-cli)`,
        default: false,
        requires_api_key: false,
      },
    ];

    return profiles;
  });
}

function defaultLocalDecodeSettingsForProfileId(profileId: string | null | undefined) {
  return profileId?.endsWith("-quality")
    ? { beamSize: 5, bestOf: 5 }
    : { beamSize: 1, bestOf: 1 };
}

function defaultLocalPromptSettingsForProfileId() {
  return { promptStrength: "profile" as ProfileSpeechSettings["local_prompt_strength"], promptCarry: false };
}

function localProfilePromptSettingsForProfile(speech: ProfileSpeechSettings, profileId: string | null | undefined) {
  const fallback = defaultLocalPromptSettingsForProfileId();
  const normalizedProfileId = profileId?.trim();

  if (!normalizedProfileId) {
    return fallback;
  }

  const stored = speech.local_profile_prompt_settings.find((entry) => entry.profile_id === normalizedProfileId);
  if (!stored) {
    return fallback;
  }

  return {
    promptStrength: stored.prompt_strength,
    promptCarry: stored.prompt_carry,
  };
}

function upsertLocalProfilePromptSettings(
  settings: ProfileSpeechSettings["local_profile_prompt_settings"],
  profileId: string,
  promptStrength: ProfileSpeechSettings["local_prompt_strength"],
  promptCarry: boolean,
): ProfileSpeechSettings["local_profile_prompt_settings"] {
  const nextEntry = {
    profile_id: profileId,
    prompt_strength: promptStrength,
    prompt_carry: promptCarry,
  };
  const existingIndex = settings.findIndex((entry) => entry.profile_id === profileId);

  if (existingIndex === -1) {
    return [...settings, nextEntry];
  }

  const next = [...settings];
  next[existingIndex] = nextEntry;
  return next;
}

function localProfileDecodeSettingsForProfile(speech: ProfileSpeechSettings, profileId: string | null | undefined) {
  const fallback = defaultLocalDecodeSettingsForProfileId(profileId);
  const normalizedProfileId = profileId?.trim();

  if (!normalizedProfileId) {
    return fallback;
  }

  const stored = speech.local_profile_decode_settings.find((entry) => entry.profile_id === normalizedProfileId);
  if (!stored) {
    return fallback;
  }

  return {
    beamSize: stored.beam_size,
    bestOf: stored.best_of,
  };
}

function upsertLocalProfileDecodeSettings(
  settings: ProfileSpeechSettings["local_profile_decode_settings"],
  profileId: string,
  beamSize: number,
  bestOf: number,
): ProfileSpeechSettings["local_profile_decode_settings"] {
  const nextEntry = {
    profile_id: profileId,
    beam_size: beamSize,
    best_of: bestOf,
  };
  const existingIndex = settings.findIndex((entry) => entry.profile_id === profileId);

  if (existingIndex === -1) {
    return [...settings, nextEntry];
  }

  const next = [...settings];
  next[existingIndex] = nextEntry;
  return next;
}

function localSetupIssueLabel(issueCode: LocalProviderIssueCode | null | undefined) {
  switch (issueCode) {
    case "missing_runner":
      return "Runner missing";
    case "invalid_runner_path":
      return "Runner path invalid";
    case "runner_probe_failed":
      return "Runner health check failed";
    case "runner_probe_timed_out":
      return "Runner health check timed out";
    case "missing_model":
      return "Model missing";
    case "invalid_model_path":
      return "Model path invalid";
    case "unreadable_model_directory":
      return "Model directory unreadable";
    case "model_not_found":
      return "Model not found";
    case "missing_runner_and_model":
      return "Runner and model missing";
    case "invalid_chat_endpoint":
      return "Cleanup endpoint invalid";
    case "chat_backend_unavailable":
      return "Cleanup backend unavailable";
    case "missing_chat_model":
      return "Cleanup model missing";
    case "chat_model_not_found":
      return "Cleanup model not found";
    default:
      return "No setup blockers";
  }
}

function localCleanupModelOptions(speech: ProfileSpeechSettings, availableModels: string[] | undefined) {
  return Array.from(new Set([
    speech.local_correction_model.trim() || "llama3.2:latest",
    ...(availableModels ?? []),
    ...LOCAL_RUNTIME_CORRECTION_MODELS,
  ]));
}

function localAgentModelOptions(speech: ProfileSpeechSettings, availableModels: string[] | undefined): Array<{ value: string; label: string }> {
  const knownValues = new Set(LOCAL_AGENT_MODEL_OPTIONS.map((o) => o.value));
  const extra = Array.from(new Set([
    speech.local_agent_model.trim() || "llama3.2:latest",
    ...(availableModels ?? []),
  ])).filter((v) => !knownValues.has(v));
  return [
    ...LOCAL_AGENT_MODEL_OPTIONS,
    ...extra.map((v) => ({ value: v, label: v })),
  ];
}

function issueMatches(issueCode: LocalProviderIssueCode | null | undefined, codes: LocalProviderIssueCode[]) {
  return Boolean(issueCode && codes.includes(issueCode));
}

function localRuntimeSetupSteps(localSetup: LocalProviderSetupStatus | null, speech: ProfileSpeechSettings) {
  const issueCode = localSetup?.issue_code ?? null;
  const cleanupEndpointBlocked = issueMatches(issueCode, ["invalid_chat_endpoint", "chat_backend_unavailable"]);
  const cleanupModelBlocked = issueMatches(issueCode, ["invalid_chat_endpoint", "chat_backend_unavailable", "missing_chat_model", "chat_model_not_found"]);
  const cleanupEndpointReady = Boolean(localSetup?.chat_ready || (localSetup?.resolved_chat_base_url && !cleanupEndpointBlocked));
  const cleanupModelReady = Boolean(localSetup?.chat_ready || (localSetup?.resolved_chat_model && !cleanupModelBlocked));

  return [
    {
      id: "runner",
      label: "Speech runner",
      ready: localSetup?.runner_ready === true,
      state: localSetup?.runner_ready ? "Ready" : localSetupIssueLabel(issueCode),
      detail: localSetup?.resolved_runner ?? "Install whisper-cli in PATH or set WORDSCRIPT_LOCAL_WHISPER_CLI.",
      action: localSetup?.runner_ready ? "Probe passed" : "Install or point runner",
    },
    {
      id: "model",
      label: "STT model",
      ready: localSetup?.model_ready === true,
      state: localSetup?.model_ready ? "Ready" : localSetupIssueLabel(issueCode),
      detail: localSetup?.resolved_model ?? "Set WORDSCRIPT_LOCAL_MODEL_PATH or WORDSCRIPT_LOCAL_MODEL_DIR to a ggml model.",
      action: localSetup?.model_ready ? "Model resolved" : "Select local model",
    },
    {
      id: "cleanup-endpoint",
      label: "Cleanup endpoint",
      ready: cleanupEndpointReady,
      state: cleanupEndpointReady ? "Ready" : localSetupIssueLabel(issueCode),
      detail: localSetup?.resolved_chat_base_url ?? "Run Ollama locally or set WORDSCRIPT_LOCAL_CHAT_BASE_URL.",
      action: cleanupEndpointReady ? "Endpoint reachable" : "Start local AI runtime",
    },
    {
      id: "cleanup-model",
      label: "Cleanup model",
      ready: cleanupModelReady,
      state: cleanupModelReady ? "Ready" : localSetupIssueLabel(issueCode),
      detail: localSetup?.resolved_chat_model ?? (speech.local_correction_model.trim() || "Install a local Ollama cleanup model."),
      action: cleanupModelReady ? "Model available" : "Pull cleanup model",
    },
  ];
}

function MetaRow({
  label,
  value,
  mono,
  divider = true,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  divider?: boolean;
}) {
  return (
    <FormRow
      label={label}
      divider={divider}
      control={
        <span
          className={cn(
            "max-w-[300px] truncate text-right text-[12px] text-fg-dim",
            mono && "font-mono text-[11px]",
          )}
          title={typeof value === "string" ? value : undefined}
        >
          {value}
        </span>
      }
    />
  );
}

export function ApiModelsTab({ config, onChange, onOpenDiagnostics }: Props) {
  const [showTypedKey, setShowTypedKey] = useState(false);
  const [pendingKey, setPendingKey] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [configPath, setConfigPath] = useState<string | null>(null);
  
  // Read speech settings from active profile
  const activeProfile = resolveActiveTextProfile(config);
  const speech = resolveProfileSpeechSettings(activeProfile);
  
  const selectedProvider: ProviderId = speech.provider === "local_preview" ? "local_preview" : "groq";
  const previewLaneSelected = selectedProvider === "local_preview";
  const selectedLocalModel = previewLaneSelected ? speech.local_model : null;
  const selectedCleanupModel = previewLaneSelected ? speech.local_correction_model : speech.correction_model;
  const providerLabel = previewLaneSelected ? "Local runtime" : "Groq cloud";
  const {
    status,
    isLoading,
    error,
    lastError,
    lastValidation,
    saveApiKey,
    clearApiKey,
    validateApiKey,
  } = useProvider(selectedProvider, selectedLocalModel, selectedCleanupModel);

  const fallbackProfiles: ProviderProfile[] = previewLaneSelected
    ? buildLocalPreviewFallbackProfiles()
    : WHISPER_MODELS.map((model, index) => ({
        id: `groq-${model}`,
        provider: "groq",
        mode: index === 0 ? "fast" : "quality",
        model,
        label: model,
        default: index === 0,
        requires_api_key: true,
      }));
  const providerProfiles = status?.profiles.length ? status.profiles : fallbackProfiles;
  const providerCapabilities = status?.capabilities ?? (previewLaneSelected ? LOCAL_PREVIEW_CAPABILITIES : GROQ_CAPABILITIES);
  const providerRequiresKey = providerCapabilities.requires_api_key;
  const localSetup = previewLaneSelected ? status?.local_setup ?? null : null;
  const activeLocalProfileId = previewLaneSelected
    ? speech.local_profile || providerProfiles.find((profile) => profile.default)?.id || "local-preview-base-fast"
    : null;
  const activeProviderProfile = previewLaneSelected
    ? providerProfiles.find((profile) => profile.id === activeLocalProfileId)
      ?? providerProfiles.find((profile) => profile.default)
      ?? providerProfiles[0]
    : providerProfiles.find((profile) => profile.model === speech.model)
      ?? providerProfiles.find((profile) => profile.default)
      ?? providerProfiles[0];
  const previewReady = localSetup?.readiness === "ready";
  const hasTypedKey = pendingKey.trim().length > 0;
  const storedKey = previewLaneSelected ? previewReady : status?.credential.configured ?? false;
  const activeModel = previewLaneSelected
    ? activeProviderProfile?.model || speech.local_model || "base"
    : speech.model || activeProviderProfile?.model || "whisper-large-v3-turbo";
  const activeMode = activeProviderProfile?.mode ?? (previewLaneSelected ? "fast" : "fast");
  const activeLocalPrompt = localProfilePromptSettingsForProfile(speech, activeLocalProfileId);
  const activeLocalPromptStrength = activeLocalPrompt.promptStrength;
  const activeLocalPromptCarry = activeLocalPrompt.promptCarry;
  const activeLocalDecode = localProfileDecodeSettingsForProfile(speech, activeLocalProfileId);
  const activeLocalBeamSize = activeLocalDecode.beamSize;
  const activeLocalBestOf = activeLocalDecode.bestOf;
  const localCleanupModels = localCleanupModelOptions(speech, localSetup?.available_chat_models);
  const localSetupSteps = previewLaneSelected ? localRuntimeSetupSteps(localSetup, speech) : [];
  const validationState = previewLaneSelected
    ? storedKey
      ? "ok"
      : "missing"
    : error
      ? "error"
      : lastValidation?.ok
        ? "ok"
        : storedKey
          ? "stored"
          : "missing";
  const statusTitle = previewLaneSelected
    ? storedKey
      ? "Local runtime ready"
      : "Local runtime setup required"
    : validationState === "ok"
      ? "Stored key validated"
      : validationState === "stored"
        ? "Stored key available"
        : validationState === "error"
          ? "Groq key check failed"
          : "No local Groq key stored";
  const statusCopy = previewLaneSelected
    ? localSetup?.guidance ?? "Configure whisper-cli, a local ggml STT model, and a local Ollama cleanup model before using this local runtime lane."
    : validationState === "ok"
      ? "Validated and ready."
      : validationState === "stored"
        ? "Stored locally. Validate after changes."
        : validationState === "error"
          ? "The last provider action failed. Check the status line below."
          : "Save a Groq key to enable transcription.";
  const validationSource = previewLaneSelected
    ? localSetup?.issue_code ? localSetupIssueLabel(localSetup.issue_code) : "Local transcription + cleanup lane"
    : lastValidation?.checked_with === "provided_key"
      ? "Typed key"
      : lastValidation?.checked_with === "stored_key"
        ? "Stored key"
        : "Not checked in this session";
  const actionSaveLabel = storedKey ? "Replace key" : "Save locally";
  const actionValidateLabel = hasTypedKey ? "Validate typed key" : "Validate stored key";

  const handleProviderChange = (provider: ProviderId) => {
    setLocalError(null);
    setStatusMessage(null);
    const nextLocalProfile = speech.local_profile.trim() || "local-preview-base-fast";
    const nextLocalPrompt = localProfilePromptSettingsForProfile(speech, nextLocalProfile);
    const nextLocalDecode = localProfileDecodeSettingsForProfile(speech, nextLocalProfile);
    onChange(buildProfileSpeechPatch(config, {
      provider,
      ...(provider === "local_preview"
        ? {
            local_model: speech.local_model.trim() || "base",
            local_correction_model: speech.local_correction_model.trim() || "llama3.2:latest",
            local_profile: nextLocalProfile,
            local_prompt_strength: nextLocalPrompt.promptStrength,
            local_prompt_carry: nextLocalPrompt.promptCarry,
            local_beam_size: nextLocalDecode.beamSize,
            local_best_of: nextLocalDecode.bestOf,
            local_profile_prompt_settings: upsertLocalProfilePromptSettings(
              speech.local_profile_prompt_settings,
              nextLocalProfile,
              nextLocalPrompt.promptStrength,
              nextLocalPrompt.promptCarry,
            ),
            local_profile_decode_settings: upsertLocalProfileDecodeSettings(
              speech.local_profile_decode_settings,
              nextLocalProfile,
              nextLocalDecode.beamSize,
              nextLocalDecode.bestOf,
            ),
          }
        : {}),
      ...(provider === "groq" && !speech.model.trim() ? { model: "whisper-large-v3-turbo" } : {}),
    }));
  };

  const handleProfileChange = (value: string) => {
    if (previewLaneSelected) {
      const selectedProfile = providerProfiles.find((profile) => profile.id === value);
      if (!selectedProfile) {
        return;
      }

      const storedPrompt = localProfilePromptSettingsForProfile(speech, selectedProfile.id);
      const storedDecode = localProfileDecodeSettingsForProfile(speech, selectedProfile.id);

      onChange(buildProfileSpeechPatch(config, {
        local_profile: selectedProfile.id,
        local_model: selectedProfile.model,
        local_prompt_strength: storedPrompt.promptStrength,
        local_prompt_carry: storedPrompt.promptCarry,
        local_beam_size: storedDecode.beamSize,
        local_best_of: storedDecode.bestOf,
        local_profile_prompt_settings: upsertLocalProfilePromptSettings(
          speech.local_profile_prompt_settings,
          selectedProfile.id,
          storedPrompt.promptStrength,
          storedPrompt.promptCarry,
        ),
        local_profile_decode_settings: upsertLocalProfileDecodeSettings(
          speech.local_profile_decode_settings,
          selectedProfile.id,
          storedDecode.beamSize,
          storedDecode.bestOf,
        ),
      }));
      return;
    }

    onChange(buildProfileSpeechPatch(config, { model: value }));
  };

  const resolveConfigPath = async () => {
    if (configPath) {
      return configPath;
    }

    try {
      const nextPath = await invoke<string>("app_config_file_path");
      setConfigPath(nextPath);
      return nextPath;
    } catch (cause) {
      setLocalError(`Could not resolve config JSON path: ${cause instanceof Error ? cause.message : String(cause)}`);
      return null;
    }
  };

  const handleSaveKey = async () => {
    setLocalError(null);
    const saved = await saveApiKey(pendingKey);
    if (!saved) return;
    setPendingKey("");
    setShowTypedKey(false);
    setStatusMessage(storedKey
      ? "Stored Groq key replaced in the local OS secret store."
      : "Groq key saved to the local OS secret store.");
  };

  const handleValidate = async () => {
    setLocalError(null);
    const validation = await validateApiKey(pendingKey || undefined);
    if (!validation) return;
    setStatusMessage(
      validation.checked_with === "provided_key"
        ? "Typed key validated. Save it locally if you want to replace the stored slot."
        : "Stored Groq key validated.",
    );
  };

  const handleClear = async () => {
    setLocalError(null);
    const cleared = await clearApiKey();
    if (!cleared) return;
    setPendingKey("");
    setShowTypedKey(false);
    setStatusMessage("Stored Groq key removed from the local OS secret store.");
  };

  const handleOpenGroqKeys = async () => {
    setLocalError(null);
    try {
      await openUrl("https://console.groq.com/keys");
    } catch (cause) {
      setLocalError(`Could not open Groq keys: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  };

  const handleRevealConfigJson = async () => {
    setLocalError(null);
    const path = await resolveConfigPath();
    if (!path) {
      return;
    }

    try {
      await revealItemInDir(path);
      setStatusMessage("Config JSON revealed in the file manager.");
    } catch (cause) {
      setLocalError(`Could not reveal config JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  };

  const handleOpenDiagnostics = () => {
    setLocalError(null);
    onOpenDiagnostics();
    setStatusMessage("Diagnostics opened.");
  };

  const credentialTone: StatusTone =
    validationState === "ok"
      ? "success"
      : validationState === "stored"
        ? "accent"
        : validationState === "error"
          ? "error"
          : "warning";
  const credentialBadge =
    validationState === "ok"
      ? "Validated"
      : validationState === "stored"
        ? "Stored"
        : validationState === "error"
          ? "Failed"
          : storedKey
            ? "Ready"
            : "Setup";

  return (
    <div className="flex flex-col gap-8">
      <StatTiles
        items={[
          {
            label: "Lane",
            value: providerLabel,
            hint: providerCapabilities.local
              ? "Local transcription + local AI cleanup."
              : "Cloud transcription with local BYOK.",
          },
          {
            label: "Active model",
            value: activeModel,
            hint: `${activeMode.replace("_", " ")} transcription mode`,
          },
          {
            label: "Status",
            value: statusTitle,
            hint: validationSource,
            accent: validationState === "ok" || validationState === "stored",
          },
        ]}
      />

      <FormCard
        title={providerRequiresKey ? "Credential status" : "Local runtime status"}
        description={statusCopy}
        action={
          <StatusBadge tone={credentialTone} dot>
            {credentialBadge}
          </StatusBadge>
        }
      >
        <MetaRow
          label={providerRequiresKey ? "Storage" : "Setup"}
          value={
            providerRequiresKey
              ? status?.credential.storage ?? "os_secret_store"
              : previewReady
                ? "Ready"
                : "Setup required"
          }
          mono={providerRequiresKey}
        />
        <MetaRow
          label={providerRequiresKey ? "Stored preview" : "Runner"}
          value={
            providerRequiresKey
              ? status?.credential.key_preview ?? "No stored preview"
              : localSetup?.resolved_runner ?? "No runner resolved"
          }
          mono
        />
        <MetaRow
          label={providerRequiresKey ? "Last check" : "Model"}
          value={providerRequiresKey ? validationSource : localSetup?.resolved_model ?? "No model resolved"}
        />
        {!providerRequiresKey && <MetaRow label="Issue" value={validationSource} />}
        {!providerRequiresKey && (
          <MetaRow label="Cleanup endpoint" value={localSetup?.resolved_chat_base_url ?? "No endpoint resolved"} mono />
        )}
        {!providerRequiresKey && (
          <MetaRow
            label="Cleanup model"
            value={(localSetup?.resolved_chat_model ?? config.local_correction_model) || "No cleanup model resolved"}
          />
        )}
        <MetaRow label="Cleanup" value={providerCapabilities.chat_completion ? "Available" : "Unavailable"} />
        <MetaRow label="Context bias" value={providerCapabilities.supports_prompt_bias ? "Supported" : "Not supported"} />
        <MetaRow
          label="Segments"
          value={providerCapabilities.supports_segments ? "Available" : "Unavailable"}
          divider={false}
        />
        <div className="flex flex-wrap gap-2 border-t border-border py-3">
          {providerRequiresKey && (
            <Button size="sm" variant="outline" onClick={() => void handleOpenGroqKeys()}>
              <ExternalLink /> Groq keys
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => void handleRevealConfigJson()}>
            <FileJson /> Reveal config
          </Button>
          <Button size="sm" variant="outline" onClick={handleOpenDiagnostics}>
            <Stethoscope /> Diagnostics
          </Button>
        </div>
      </FormCard>

      {providerRequiresKey ? (
        <FormCard
          title={storedKey ? "Replace local key" : "Add local key"}
          description={
            hasTypedKey
              ? "Validate first, save after."
              : storedKey
                ? "Paste only when you want to rotate the stored key."
                : "Paste one Groq key and save it locally."
          }
        >
          <FormRow label={storedKey ? "New key" : "Key"} htmlFor="groq-key-input" layout="stacked">
            <div className="flex items-center gap-2">
              <Input
                id="groq-key-input"
                type={showTypedKey ? "text" : "password"}
                value={pendingKey}
                onChange={(e) => setPendingKey(e.target.value)}
                placeholder={storedKey ? "Paste replacement gsk_..." : "Paste gsk_..."}
                spellCheck={false}
                autoComplete="off"
                className="font-mono"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!hasTypedKey}
                onClick={() => setShowTypedKey((current) => !current)}
              >
                {showTypedKey ? "Hide" : "Show"}
              </Button>
            </div>
          </FormRow>
          <FormRow
            label="Manage key"
            hint="Keys are stored locally in the OS secret store."
            divider={false}
            control={
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" disabled={isLoading || !hasTypedKey} onClick={() => void handleSaveKey()}>
                  {actionSaveLabel}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isLoading || (!hasTypedKey && !storedKey)}
                  onClick={() => void handleValidate()}
                >
                  {actionValidateLabel}
                </Button>
                <Button size="sm" variant="ghost" disabled={isLoading || !storedKey} onClick={() => void handleClear()}>
                  Clear
                </Button>
              </div>
            }
          />
        </FormCard>
      ) : (
        <FormCard
          title="Local runtime setup"
          description="WordScript needs a speech runner, one ggml STT model, a local cleanup endpoint and the selected cleanup model before this lane is ready."
        >
          <div className="flex flex-col" role="group" aria-label="Local runtime setup checklist">
            {localSetupSteps.map((step) => (
              <FormRow
                key={step.id}
                label={step.label}
                hint={step.detail}
                align="start"
                control={
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge tone={step.ready ? "success" : "warning"} dot>
                      {step.state}
                    </StatusBadge>
                    <span className="text-right text-[11px] text-fg-muted">{step.action}</span>
                  </div>
                }
              />
            ))}
          </div>
          <p className="border-t border-border py-3 text-[12px] leading-snug text-fg-dim">
            {localSetup?.guidance ??
              "This lane uses the same runtime path for capture, insert and diagnostics, but now expects both local STT and local cleanup to be reachable."}
          </p>
        </FormCard>
      )}
      {(statusMessage || lastValidation || error || localError) && (
        <p
          className={cn(
            "px-1 text-[12px] leading-snug",
            error || localError ? "text-[var(--red)]" : "text-[var(--green)]",
          )}
        >
          {error ?? localError ?? statusMessage ?? (!previewLaneSelected && lastValidation?.ok ? "Groq key validated." : "")}
          {lastError ? ` ${providerErrorActionLabel(lastError.user_action)}` : ""}
        </p>
      )}

      <FormCard
        title="Speech-to-text"
        description={
          previewLaneSelected
            ? "Local runtime runs speech-to-text through whisper-cli; the profile controls latency vs. quality."
            : "Profile controls speed vs. accuracy. Language can usually stay on Auto."
        }
      >
        <FormRow
          label="Provider"
          hint="Cloud BYOK or the fully local lane."
          control={
            <SegmentControl
              aria-label="Provider"
              value={selectedProvider}
              onChange={(value) => handleProviderChange(value as ProviderId)}
              options={[
                { value: "groq", label: "Groq cloud" },
                { value: "local_preview", label: "Local" },
              ]}
            />
          }
        />
        <FormRow
          label="Profile"
          htmlFor="profile-select"
          control={
            <Select
              id="profile-select"
              className="w-[280px]"
              value={previewLaneSelected ? activeLocalProfileId ?? "" : activeModel}
              onChange={(e) => handleProfileChange(e.target.value)}
            >
              {providerProfiles.map((profile) => (
                <option key={profile.id} value={previewLaneSelected ? profile.id : profile.model}>
                  {profile.label}
                </option>
              ))}
            </Select>
          }
        />
        <FormRow
          label="Language"
          htmlFor="language-select"
          control={
            <Select
              id="language-select"
              className="w-[160px]"
              value={speech.language || "Auto"}
              onChange={(e) => onChange(buildProfileSpeechPatch(config, { language: e.target.value === "Auto" ? "" : e.target.value }))}
            >
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </Select>
          }
        />
        {speech.language !== "" && (
          <FormRow
            label="Pin this language"
            hint="Speaking another language inside a sentence stays untouched either way. This only makes WordScript quicker to drop a whole passage that another script wrote and that the audio does not support."
            htmlFor="language-locked"
            control={
              <Toggle
                id="language-locked"
                checked={speech.language_locked}
                onCheckedChange={(nextLanguageLocked) =>
                  onChange(buildProfileSpeechPatch(config, { language_locked: nextLanguageLocked }))
                }
              />
            }
          />
        )}
        {previewLaneSelected && providerCapabilities.supports_prompt_bias && (
          <>
            <FormRow
              label="Bias strength"
              hint="Uses the active Text Rules profile to bias the initial whisper prompt."
              htmlFor="local-prompt-strength-select"
              control={
                <Select
                  id="local-prompt-strength-select"
                  className="w-[200px]"
                  value={activeLocalPromptStrength}
                  onChange={(e) => {
                    const nextPromptStrength = e.target.value as ProfileSpeechSettings["local_prompt_strength"];
                    const profileId = activeLocalProfileId ?? "local-preview-base-fast";
                    onChange(buildProfileSpeechPatch(config, {
                      local_prompt_strength: nextPromptStrength,
                      local_profile_prompt_settings: upsertLocalProfilePromptSettings(
                        speech.local_profile_prompt_settings,
                        profileId,
                        nextPromptStrength,
                        activeLocalPromptCarry,
                      ),
                    }));
                  }}
                >
                  {LOCAL_PROMPT_STRENGTH_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              }
            />
            <FormRow
              label="Carry initial prompt"
              hint="Keeps the bias across decoder windows."
              htmlFor="local-prompt-carry"
              control={
                <Toggle
                  id="local-prompt-carry"
                  checked={activeLocalPromptCarry}
                  onCheckedChange={(nextPromptCarry) => {
                    const profileId = activeLocalProfileId ?? "local-preview-base-fast";
                    onChange(buildProfileSpeechPatch(config, {
                      local_prompt_carry: nextPromptCarry,
                      local_profile_prompt_settings: upsertLocalProfilePromptSettings(
                        speech.local_profile_prompt_settings,
                        profileId,
                        activeLocalPromptStrength,
                        nextPromptCarry,
                      ),
                    }));
                  }}
                />
              }
            />
          </>
        )}
        {previewLaneSelected && (
          <>
            <FormRow
              label="Beam size"
              hint="Higher values trade latency for a broader local decode pass."
              htmlFor="local-beam-size-select"
              control={
                <Select
                  id="local-beam-size-select"
                  className="w-[100px]"
                  value={activeLocalBeamSize}
                  onChange={(e) => {
                    const nextBeamSize = Number(e.target.value);
                    const profileId = activeLocalProfileId ?? "local-preview-base-fast";
                    onChange(buildProfileSpeechPatch(config, {
                      local_beam_size: nextBeamSize,
                      local_profile_decode_settings: upsertLocalProfileDecodeSettings(
                        speech.local_profile_decode_settings,
                        profileId,
                        nextBeamSize,
                        activeLocalBestOf,
                      ),
                    }));
                  }}
                >
                  {LOCAL_DECODE_OPTIONS.map((value) => (
                    <option key={`beam-${value}`} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              }
            />
            <FormRow
              label="Best of"
              htmlFor="local-best-of-select"
              control={
                <Select
                  id="local-best-of-select"
                  className="w-[100px]"
                  value={activeLocalBestOf}
                  onChange={(e) => {
                    const nextBestOf = Number(e.target.value);
                    const profileId = activeLocalProfileId ?? "local-preview-base-fast";
                    onChange(buildProfileSpeechPatch(config, {
                      local_best_of: nextBestOf,
                      local_profile_decode_settings: upsertLocalProfileDecodeSettings(
                        speech.local_profile_decode_settings,
                        profileId,
                        activeLocalBeamSize,
                        nextBestOf,
                      ),
                    }));
                  }}
                >
                  {LOCAL_DECODE_OPTIONS.map((value) => (
                    <option key={`best-of-${value}`} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              }
            />
          </>
        )}
      </FormCard>

      <FormCard
        title="Cleanup model"
        description={
          previewLaneSelected
            ? "Local Ollama chat model used for cleanup. Keep it installed to stay offline. Cleanup behavior (fillers, rewrites) is configured in Modes."
            : "Groq model used for cleanup. Runs after speech-to-text and can fall back to the original transcript. Cleanup behavior (fillers, rewrites) is configured in Modes."
        }
      >
        <FormRow
          label="Model"
          hint={
            previewLaneSelected
              ? "Local Ollama chat model. Keep it installed to stay offline."
              : "Runs after speech-to-text and can fall back to the original transcript."
          }
          htmlFor="correction-model-select"
          divider={false}
          control={
            <Select
              id="correction-model-select"
              className="w-[260px]"
              value={previewLaneSelected ? speech.local_correction_model : speech.correction_model}
              onChange={(e) =>
                onChange(
                  buildProfileSpeechPatch(config, previewLaneSelected
                    ? { local_correction_model: e.target.value }
                    : { correction_model: e.target.value })
                )
              }
            >
              {(previewLaneSelected ? localCleanupModels : CORRECTION_MODELS).map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          }
        />
      </FormCard>

      <FormCard
        title="Agent model"
        description="Model used when agent mode is active. Agent mode itself (enable, agent name) is configured in Modes."
      >
        <FormRow
          label="Model"
          hint={
            previewLaneSelected
              ? "Local Ollama model for intent + execution. Requires the local chat endpoint."
              : "Groq model for intent classification and instruction execution."
          }
          htmlFor="agent-model-select"
          divider={false}
          control={
            <Select
              id="agent-model-select"
              className="w-[300px]"
              value={previewLaneSelected ? speech.local_agent_model : speech.agent_model}
              onChange={(e) =>
                onChange(
                  buildProfileSpeechPatch(config, previewLaneSelected
                    ? { local_agent_model: e.target.value }
                    : { agent_model: e.target.value })
                )
              }
            >
              {(previewLaneSelected
                ? localAgentModelOptions(speech, localSetup?.available_chat_models)
                : AGENT_MODEL_OPTIONS
              ).map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          }
        />
      </FormCard>
    </div>
  );
}
