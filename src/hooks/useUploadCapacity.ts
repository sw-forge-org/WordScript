import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { runtimeIdFor } from "@/lib/providerSeam";
import { PROVIDERS, type LaneName } from "@/screens/data";
import type { ProviderUploadCapacity, UploadCapacity } from "@/types/providers";

/**
 * WHICH VENDORS ON THIS LANE TAKE THIS FILE (B7, ADR 0129, ADR 0131).
 *
 * The other half of `useProviderSeam`, and it exists as its own hook for the
 * reason that record moved the choice in the first place: **the answer depends
 * on a file, so it cannot be read when the screen opens.** `useProviderSeam`
 * asks what a vendor can do and is answered once; this asks what it will accept
 * and is re-answered every time the file changes.
 *
 * **Nothing is asked before there is a file.** `fileBytes` of `null` returns an
 * empty map and invokes nothing — a picker with no file yet has no constraint
 * to apply, and asking the runtime "does this vendor accept zero bytes" would
 * be manufacturing an answer to a question nobody put.
 *
 * **The plan is not passed.** The runtime reads `provider_tier` off the config
 * itself, so a picker cannot answer against a plan the pipeline is not on.
 */
export function useUploadCapacity(
  fileBytes: number | null,
  lane: LaneName,
  model?: string | null,
) {
  const [capacities, setCapacities] = useState<Record<string, UploadCapacity>>({});

  /* The ids this lane draws, recomputed from the drawing rather than stored —
     the same derivation `useProviderSeam` makes, and for the same reason: a
     lane the drawing grows is covered without a second list to keep correct. */
  const drawnIds = useMemo(
    () =>
      PROVIDERS.filter((provider) => provider.lane === lane)
        .map((provider) => runtimeIdFor(provider.name))
        .filter((id): id is string => Boolean(id)),
    [lane],
  );

  /* Joined rather than passed as an array: a fresh array literal every render
     would re-invoke on every keystroke elsewhere on the screen. */
  const candidateKey = drawnIds.join(",");

  const read = useCallback(async () => {
    if (fileBytes === null) {
      setCapacities({});
      return;
    }

    const answered = await invoke<ProviderUploadCapacity[]>("resolve_upload_capacity", {
      bytes: fileBytes,
      candidates: candidateKey
        .split(",")
        .filter(Boolean)
        .map((provider) => ({ provider, model: model?.trim() ?? "" })),
    });

    setCapacities(
      Object.fromEntries(answered.map((row) => [row.provider, row.capacity])),
    );
  }, [fileBytes, candidateKey, model]);

  useEffect(() => {
    /* A failed read leaves the map empty, which the seam reads as *not asked*
       rather than as *nothing fits*. Swallowing the failure into a refusal
       would grey every vendor on the picker because a command did not answer —
       a constraint invented out of the surface's own latency. */
    void read().catch(() => setCapacities({}));
  }, [read]);

  return { capacities, refresh: read };
}
