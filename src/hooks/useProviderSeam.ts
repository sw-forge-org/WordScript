import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import {
  accountsToRead,
  NO_ANSWERS,
  type RuntimeAnswers,
} from "@/lib/providerSeam";
import type { ProviderStatus, RegisteredProvider } from "@/types/providers";
import type { AppConfig } from "@/types/ipc";

/**
 * What the runtime says about the vendors this build carries and the accounts
 * this machine holds (ADR 0124, ADR 0106).
 *
 * **Two commands, and they answer different questions.**
 * `registered_providers` answers *which vendors have an adapter at all* for the
 * whole table in one call, reading no credential; `provider_status` answers
 * *what this one account can do and what it is missing*, and reads the OS secret
 * store to do it. So the second is asked only for accounts that exist — which is
 * a number the reader chose, never the length of the drawing.
 *
 * **IT ASKED ONCE PER VENDOR AND NOW ASKS ONCE PER ACCOUNT, AND THAT IS NOT
 * ADR 0124 REVERSED.** That record refused ten `provider_status` calls for a
 * screen that merely opened, on the argument that eight of them would answer
 * `Err` for vendors nobody had configured — ten reads for nothing. This asks
 * about accounts, and an account exists because somebody made it: a fresh
 * install reads one, the case this whole axis exists for reads two. The cost
 * scales with what the reader owns rather than with what the drawing names.
 *
 * **And it is no longer scoped to a lane.** A job may run on any account on the
 * machine (ADR 0211), so a surface that only read the shown lane's vendors left
 * every cross-lane job row answering *not read* about an account it was pointing
 * at. The lane groups; it does not decide what is known.
 */
export function useProviderSeam(
  /** The accounts to ask about, and the model to ask with. */
  config?: AppConfig,
  model?: string | null,
) {
  const [registered, setRegistered] = useState<RegisteredProvider[] | null>(null);
  const [statuses, setStatuses] = useState<Record<string, ProviderStatus>>({});

  /* The accounts, as a stable string — `config` is a fresh object on every
     optimistic patch, and a dependency on it alone would re-read the keyring on
     every keystroke that touches an unrelated setting. What this read depends on
     is which accounts exist and whose vendor each one is. */
  const accountKey = useMemo(
    () =>
      config
        ? accountsToRead(config)
            .map((entry) => `${entry.id}:${entry.provider}`)
            .join("|")
        : "",
    [config],
  );

  const read = useCallback(async () => {
    const listed = await invoke<RegisteredProvider[]>("registered_providers");
    setRegistered(listed);

    /* An account whose vendor has no adapter is not asked about: the command
       answers `Err` for it, which is the same nothing the registry already
       stated by leaving the vendor out (ADR 0124). */
    const wanted = accountKey
      .split("|")
      .filter(Boolean)
      .map((entry) => {
        const [id, provider] = entry.split(":");
        return { id, provider };
      })
      .filter((account) => listed.some((row) => row.provider === account.provider));

    const answered = await Promise.allSettled(
      wanted.map((account) =>
        invoke<ProviderStatus>("provider_status", {
          request: {
            provider: account.provider,
            connection: account.id,
            model: model?.trim() ? model.trim() : null,
            correction_model: null,
          },
        }),
      ),
    );

    /* KEYED BY THE RUNTIME'S ECHO AND NOT BY THE ID WE ASKED WITH (ADR 0209).
       `provider_status` stamps the account it answered about; filing under that
       value is what makes it impossible for one account's answer to be found
       under another's name. An answer that echoes nothing lands under `""` and
       `accountStatus` never looks there. */
    setStatuses(
      Object.fromEntries(
        answered
          .filter(
            (result): result is PromiseFulfilledResult<ProviderStatus> =>
              result.status === "fulfilled" && Boolean(result.value),
          )
          .map((result) => [result.value.connection, result.value] as const)
          .filter(([connection]) => Boolean(connection)),
      ),
    );
  }, [accountKey, model]);

  useEffect(() => {
    /* A failed read leaves `registered` at `null`, which the seam reads as
       *the runtime has not answered* rather than as an empty registry. The
       difference is the fourth sentence, and swallowing it into `[]` would
       tell every drawn vendor it has no adapter. */
    void read().catch(() => undefined);
  }, [read]);

  const answers: RuntimeAnswers = useMemo(
    () => (registered === null ? NO_ANSWERS : { registered, statuses }),
    [registered, statuses],
  );

  return { answers, refresh: read };
}
