import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import {
  MODEL_EVENT_CHANNEL,
  type ManagedModelRow,
  type ModelInstallEvent,
  type ModelLibrary,
} from "@/types/models";

/**
 * WHAT IS INSTALLED, WHAT IS INSTALLING, AND WHAT IS ONLY OFFERED (B5, ADR 0122).
 *
 * **One read plus one channel, not a poll.** `model_library` answers the whole
 * tab in a single call — it reads a directory and asks the local server once,
 * rather than once per row — and `wordscript-model-event` carries every change
 * after that. A download is minutes long and a poll fast enough to draw a
 * moving percentage would be a command every 250 ms for the length of it.
 *
 * **A progress event never re-reads the library.** It moves the row it names
 * and nothing else; only a terminal phase asks the runtime again, because only
 * a terminal phase changes what is on the disk. That is what keeps a 1.6 GB
 * download from issuing hundreds of `model_library` calls, each of which probes
 * a network endpoint.
 *
 * **A late event is dropped by id.** An install that reports after its cancel
 * moves nothing: the row has already left `installing`, and the event names an
 * install this hook is no longer following. The runtime discards the same
 * result on its own side and logs it; this is the surface half of the same
 * rule.
 */
export function useModelLibrary(enabled = true) {
  const [library, setLibrary] = useState<ModelLibrary | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* What the last event said about a running install, keyed by install id.
     Held beside the library rather than merged into it, so a re-read cannot
     wipe a percentage that arrived while it was in flight. */
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [failures, setFailures] = useState<Record<string, string>>({});
  const disposed = useRef(false);

  const read = useCallback(async () => {
    try {
      const answer = await invoke<ModelLibrary>("model_library");
      if (disposed.current) return;
      setLibrary(answer);
      setError(null);
    } catch (cause) {
      if (disposed.current) return;
      /* The library failing to read is not "nothing is installed", and saying
         so would be the fake-state defect this whole step removes. The rows
         keep whatever they last said and the error is stated beside them. */
      setError(String(cause));
    }
  }, []);

  useEffect(() => {
    disposed.current = false;
    if (!enabled) return;

    void read();

    let unlisten: (() => void) | null = null;
    /* Without the Tauri host — the gallery, a component test — there is no
       event bridge. A tab that cannot listen still renders; it must not take
       the surrounding view down with it. */
    Promise.resolve()
      .then(() =>
        listen<ModelInstallEvent>(MODEL_EVENT_CHANNEL, ({ payload }) => {
          if (disposed.current) return;

          if (payload.phase === "progress" || payload.phase === "started") {
            setProgress((current) => ({
              ...current,
              [payload.install_id]: payload.received_bytes,
            }));
            return;
          }

          setProgress((current) => {
            const next = { ...current };
            delete next[payload.install_id];
            return next;
          });

          if (payload.phase === "failed") {
            setFailures((current) => ({
              ...current,
              [payload.row]: payload.detail ?? "The install failed.",
            }));
          } else {
            setFailures((current) => {
              const next = { ...current };
              delete next[payload.row];
              return next;
            });
          }

          /* Only a terminal phase changes what is on the disk, so only a
             terminal phase costs a read. `verifying` is deliberately not one:
             nothing has been renamed into place yet. */
          if (payload.phase !== "verifying") void read();
        }),
      )
      .then((stop) => {
        if (disposed.current) {
          stop();
          return;
        }
        unlisten = stop;
      })
      .catch(() => {
        /* No host. The one read above still answered or still failed, and
           either is a truer surface than a tab that refuses to render. */
      });

    return () => {
      disposed.current = true;
      unlisten?.();
    };
  }, [enabled, read]);

  /* The rows with whatever a running install last reported folded in. The
     runtime's own `installing` state carries the bytes it knew at read time;
     the channel is what makes the number move between reads. */
  const rows = useMemo<ManagedModelRow[]>(() => {
    if (!library) return [];
    return library.rows.map((row) => {
      if (row.state.kind !== "installing") return row;
      const received = progress[row.state.install_id];
      if (received === undefined) return row;
      return { ...row, state: { ...row.state, received_bytes: received } };
    });
  }, [library, progress]);

  const install = useCallback(
    async (row: string) => {
      setFailures((current) => {
        const next = { ...current };
        delete next[row];
        return next;
      });
      try {
        await invoke<string>("install_model", { row });
      } catch (cause) {
        setFailures((current) => ({ ...current, [row]: String(cause) }));
      }
      await read();
    },
    [read],
  );

  const cancel = useCallback(
    async (installId: string) => {
      try {
        await invoke("cancel_model_install", { installId });
      } catch {
        /* Nothing is running under that id any more, which is the state the
           caller was asking for. */
      }
      await read();
    },
    [read],
  );

  const remove = useCallback(
    async (row: string) => {
      try {
        await invoke("remove_model", { row });
      } catch (cause) {
        /* **The refusal is the deliverable, not an error to swallow.** It names
           the profile that still runs this model, and a surface that dropped it
           would delete-and-fail silently, which is what ADR 0122 wrote the
           refusal to prevent. */
        setFailures((current) => ({ ...current, [row]: String(cause) }));
      }
      await read();
    },
    [read],
  );

  const openFolder = useCallback(async () => {
    try {
      await invoke("open_model_folder");
    } catch (cause) {
      setError(String(cause));
    }
  }, []);

  /**
   * THE TWO WAYS A MODEL THIS BUILD DOES NOT CURATE GETS IN (ADR 0159).
   *
   * **`importFile` copies, `addFolder` does not.** Both are real cases and the
   * owner asked for both: somebody with one `.bin` in their downloads wants it
   * in, and somebody with a library on a home server does not want a second
   * copy of a 1.6 GB file. The copy reports on the same channel a download
   * does, because a file that large takes long enough that a surface without
   * progress looks broken.
   */
  const importFile = useCallback(
    async (path: string) => {
      try {
        await invoke<string>("import_model_file", { path });
      } catch (cause) {
        /* Keyed by the file rather than by a row, because an import that is
           refused has no row yet — the refusal is about the name it would
           have landed under. */
        setFailures((current) => ({ ...current, [path]: String(cause) }));
      }
      await read();
    },
    [read],
  );

  const addFolder = useCallback(
    async (path: string) => {
      try {
        await invoke<string[]>("add_model_folder", { path });
        setError(null);
      } catch (cause) {
        setError(String(cause));
      }
      await read();
    },
    [read],
  );

  const removeFolder = useCallback(
    async (path: string) => {
      try {
        await invoke<string[]>("remove_model_folder", { path });
        setError(null);
      } catch (cause) {
        setError(String(cause));
      }
      await read();
    },
    [read],
  );

  /** The language half's way in: a tag the catalogue does not carry. */
  const pullTag = useCallback(
    async (tag: string) => {
      try {
        await invoke<string>("pull_model_tag", { tag });
      } catch (cause) {
        setFailures((current) => ({ ...current, [tag]: String(cause) }));
      }
      await read();
    },
    [read],
  );

  return {
    library,
    rows,
    folders: library?.folders ?? [],
    error,
    failures,
    read,
    install,
    cancel,
    remove,
    openFolder,
    importFile,
    addFolder,
    removeFolder,
    pullTag,
  };
}
