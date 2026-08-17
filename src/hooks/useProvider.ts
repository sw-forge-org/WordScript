import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_PROVIDER_ID } from "@/lib/providerSeam";
import type {
  ProviderCommandError,
  ProviderErrorAction,
  ProviderCredentialStatus,
  ProviderStatus,
  ValidateProviderApiKeyResponse,
} from "../types/providers";

function isProviderCommandError(error: unknown): error is ProviderCommandError {
  return typeof error === "object" && error !== null && "message" in error && "kind" in error && "user_action" in error;
}

function providerErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error) {
    return (error as ProviderCommandError).message;
  }
  return String(error);
}

export function providerErrorActionLabel(action: ProviderErrorAction) {
  switch (action) {
    case "configure_credential":
      return "Check or save the provider credential.";
    case "check_secret_store":
      return "Check the operating-system secret store.";
    case "change_request":
      return "Change the model, audio, or request settings before retrying.";
    case "wait_and_retry":
      return "Wait for the provider limit to reset, then retry.";
    case "retry":
      return "Retry the request.";
    case "check_network":
      return "Check the network connection, then retry.";
    case "check_provider_status":
      return "Check the provider status and retry later.";
    case "check_local_setup":
      return "Check the local helper and model setup.";
  }
}

/**
 * One vendor's status, asked by the id the config actually holds (D1c).
 *
 * **The parameter was `ProviderId = "groq" | "local"` for four adapters longer
 * than the runtime had a closed set**, and a caller cannot narrow to a union
 * that has no arm for the value it holds — so `WorkspaceWindow` folded every
 * cloud vendor onto `groq` and the credential chip reported the wrong vendor's
 * key. `string` is what `provider_status` takes; an id no adapter claims comes
 * back as a `ProviderCommandError` on `lastError`, which is an answer to show
 * rather than a type error to prevent.
 *
 * **`null` MEANS DO NOT ASK YET, and it is not the same as the default.** Found
 * by rendering the window: every workspace launch read the secret store for
 * `groq` before the config had arrived, because the caller had to name someone
 * and the default is the only name available before there is a config to read
 * one from. That answer was then thrown away when the real connection resolved
 * — a keyring read per window for a vendor this machine may not use, which is
 * the cost ADR 0124 refused at ten and is no more justified at one. A caller
 * that does not yet know who to ask says so, and gets the `pending` state
 * rather than a stale vendor's answer.
 */
export function useProvider(
  providerId: string | null = DEFAULT_PROVIDER_ID,
  model?: string | null,
  correctionModel?: string | null,
  /** Which account this vendor is reached with (ADR 0208). Empty asks about
   *  the vendor with no account named, which is what the lane that stores no
   *  credential sends — and what a caller with no config yet has. */
  connectionId: string = "",
) {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<ProviderCommandError | null>(null);
  const [lastValidation, setLastValidation] = useState<ValidateProviderApiKeyResponse | null>(null);

  const refresh = useCallback(async () => {
    if (!providerId) return null;
    setIsLoading(true);
    try {
      const next = await invoke<ProviderStatus>("provider_status", {
        request: {
          provider: providerId,
          connection: connectionId,
          model: model?.trim() ? model.trim() : null,
          correction_model: correctionModel?.trim() ? correctionModel.trim() : null,
        },
      });
      setStatus(next);
      setError(null);
      setLastError(null);
      return next;
    } catch (cause) {
      setLastError(isProviderCommandError(cause) ? cause : null);
      setError(providerErrorMessage(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [connectionId, correctionModel, model, providerId]);

  /* THE THREE CREDENTIAL DOORS TAKE THE SAME GUARD. A `null` provider is *no
     connection resolved yet*, and `resolve_entry` reads an empty provider as
     the default — so an unguarded save would write somebody's key to `groq`
     because the config had not loaded. Nothing calls these with `null` today;
     the guard is what keeps that true. */
  const saveApiKey = useCallback(async (apiKey: string) => {
    if (!providerId) return null;
    setIsLoading(true);
    try {
      const credential = await invoke<ProviderCredentialStatus>("save_provider_api_key", {
        request: { provider: providerId, connection: connectionId, api_key: apiKey },
      });
      await refresh();
      setLastValidation(null);
      setError(null);
      setLastError(null);
      return credential;
    } catch (cause) {
      setLastError(isProviderCommandError(cause) ? cause : null);
      setError(providerErrorMessage(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [providerId, refresh]);

  const clearApiKey = useCallback(async () => {
    if (!providerId) return null;
    setIsLoading(true);
    try {
      const credential = await invoke<ProviderCredentialStatus>("clear_provider_api_key", {
        request: { provider: providerId, connection: connectionId },
      });
      await refresh();
      setLastValidation(null);
      setError(null);
      setLastError(null);
      return credential;
    } catch (cause) {
      setLastError(isProviderCommandError(cause) ? cause : null);
      setError(providerErrorMessage(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [providerId, refresh]);

  const validateApiKey = useCallback(async (apiKey?: string) => {
    if (!providerId) return null;
    setIsLoading(true);
    try {
      const validation = await invoke<ValidateProviderApiKeyResponse>("validate_provider_api_key", {
        request: {
          provider: providerId,
          connection: connectionId,
          api_key: apiKey?.trim() ? apiKey : null,
        },
      });
      setLastValidation(validation);
      setError(null);
      setLastError(null);
      return validation;
    } catch (cause) {
      setLastValidation(null);
      setLastError(isProviderCommandError(cause) ? cause : null);
      setError(providerErrorMessage(cause));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    status,
    isLoading,
    error,
    lastError,
    lastValidation,
    refresh,
    saveApiKey,
    clearApiKey,
    validateApiKey,
  };
}