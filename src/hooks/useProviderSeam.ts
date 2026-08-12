import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { NO_ANSWERS, runtimeIdFor, type RuntimeAnswers } from "@/lib/providerSeam";
import { PROVIDERS, type LaneName } from "@/screens/data";
import type { ProviderStatus, RegisteredProvider } from "@/types/providers";

/**
 * What the runtime says about the vendors a lane draws (ADR 0124, ADR 0106).
 *
 * **Two commands, and they answer different questions.**
 * `registered_providers` answers *which vendors have an adapter at all* for the
 * whole table in one call, reading no credential; `provider_status` answers
 * *what this one vendor can do and what it is missing*, and reads the OS secret
 * store to do it. So the second is asked only for vendors the first admitted
 * to — which is at most as many as the registry carries, never as many as the
 * drawing names.
 *
 * **Ten `provider_status` calls was the alternative and it was rejected**
 * (ADR 0124): it is ten keyring reads and a local-runtime probe for a screen
 * that merely opened, with eight of the ten answering `Err`.
 */
export function useProviderSeam(lane: LaneName, model?: string | null) {
  const [registered, setRegistered] = useState<RegisteredProvider[] | null>(null);
  const [statuses, setStatuses] = useState<Record<string, ProviderStatus>>({});

  /* The ids this lane draws, as ids. Recomputed from the drawing rather than
     stored, so a lane the drawing grows is covered without a second list. */
  const drawnIds = useMemo(
    () =>
      PROVIDERS.filter((provider) => provider.lane === lane)
        .map((provider) => runtimeIdFor(provider.name))
        .filter((id): id is string => Boolean(id)),
    [lane],
  );

  const read = useCallback(async () => {
    const listed = await invoke<RegisteredProvider[]>("registered_providers");
    setRegistered(listed);

    const wanted = listed.filter((row) => drawnIds.includes(row.provider));
    const answered = await Promise.allSettled(
      wanted.map(async (row) => {
        const status = await invoke<ProviderStatus>("provider_status", {
          request: {
            provider: row.provider,
            model: model?.trim() ? model.trim() : null,
            correction_model: null,
          },
        });
        return [row.provider, status] as const;
      }),
    );

    setStatuses(
      Object.fromEntries(
        answered
          .filter(
            (result): result is PromiseFulfilledResult<readonly [string, ProviderStatus]> =>
              result.status === "fulfilled" && Boolean(result.value[1]),
          )
          .map((result) => result.value),
      ),
    );
  }, [drawnIds, model]);

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
