/**
 * WHAT IS ON THIS MACHINE — the mirror of `core::model_install` (B5, ADR 0122).
 *
 * Its own file rather than a section of `src/types/providers.ts`, because it
 * answers a different question. That file mirrors what a vendor *can do*; this
 * one mirrors what is *on the disk*, and the whole point of the step is that a
 * catalogued model with no file is neither available nor missing but
 * **installable**, which is a third sentence and needs a type of its own to say
 * it.
 *
 * Hand-written and held to the Rust struct by a test, like every other mirror
 * across this seam — `models.test.ts` walks the same fields
 * `providers.test.ts` walks for its half.
 */
import type { ProviderRole } from "./providers";

/**
 * The state of one catalogued row on this machine.
 *
 * **`unknown` is not `installable`.** Only ever the language half: the server
 * that owns those files is usually not running, and reporting *not installed*
 * about a disk nobody looked at would be the same defect ADR 0106 recorded one
 * layer up, where a missing capability field read as `false`.
 */
export type ManagedModelState =
  | { kind: "installable" }
  | { kind: "installing"; install_id: string; received_bytes: number }
  | { kind: "installed"; bytes: number }
  | { kind: "unknown"; detail: string };

/**
 * Whether this build knows the row from its catalogue or found the file on the
 * disk (ADR 0159).
 *
 * **`yours` is the answer B5 could not give.** That step listed the catalogue
 * and called the result *what is on this machine*, which stopped being true the
 * moment somebody put their own `ggml-*.bin` in the folder: the runtime
 * discovered it, resolved it, would transcribe with it, and the surface did not
 * show it.
 */
export type ModelOrigin = "catalogue" | "yours";

export interface ManagedModelRow {
  /** The catalogue slug, or the file's stem for a model no row claims. */
  row: string;
  model_id: string;
  role: ProviderRole;
  /** `download` (ours) or `server_pull` (the server's). */
  mechanism: "download" | "server_pull";
  origin: ModelOrigin;
  size_bytes: number;
  quantization: string | null;
  state: ManagedModelState;
  path: string | null;
  /** Which folder it came from, when it is not the managed one. */
  folder: string | null;
  /** Which profile runs it, when one does — the reason a removal is refused. */
  in_use_by: string | null;
}

/**
 * One place this build looks for a speech model (ADR 0159).
 *
 * **The listing unions every folder; the order decides which file runs.** Two
 * folders holding `ggml-small.bin` are one model as far as a picker is
 * concerned, and the higher-ranked one is the file that transcribes.
 */
export interface ModelFolder {
  path: string;
  /** Which kind of source it is, in the reader's words. */
  kind: string;
  /** Whether this surface may remove it. Only a folder added here. */
  removable: boolean;
  /** Whether it is there at all — an unmounted share is not an empty folder. */
  exists: boolean;
}

export interface LocalServerAnswer {
  base_url: string;
  reachable: boolean;
  detail: string;
}

export interface ModelLibrary {
  /** The directory the runtime manages, resolved by the runtime. */
  speech_dir: string;
  /** Every place a speech model may come from, highest rank first. */
  folders: ModelFolder[];
  server: LocalServerAnswer;
  rows: ManagedModelRow[];
}

export type ModelInstallPhase =
  | "started"
  | "progress"
  | "verifying"
  | "installed"
  | "failed"
  | "cancelled";

/**
 * One message on `wordscript-model-event`.
 *
 * **Its own channel, and never one of the two session channels.** ADR 0018 and
 * ADR 0019 spent a leg each establishing that a session ends in exactly one
 * reducer commit; a download is not a session and must not be able to reach the
 * reducer at all, so it does not get the door.
 */
export interface ModelInstallEvent {
  install_id: string;
  row: string;
  phase: ModelInstallPhase;
  received_bytes: number;
  total_bytes: number;
  detail: string | null;
}

export const MODEL_EVENT_CHANNEL = "wordscript-model-event";
