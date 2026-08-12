/**
 * THE MODEL CATALOGUE, read from the same file the Rust runtime reads.
 *
 * ADR 0115, scoped by ADR 0120. `shared/model_catalogue.json` is the one place a
 * model id is spelled; `core::model_catalogue` loads it with `include_str!` and
 * this module imports it. Not a mirrored copy with a test guarding it — one
 * file, two readers — because hundreds of rows across a dozen vendors that
 * change on somebody else's calendar are not the small struct
 * `src/types/providers.ts` mirrors by hand.
 *
 * **A consumer names a row by its id, never by a model name.** The id is a
 * stable slug (`anthropic-chat-sonnet`), so a vendor's next generation is a
 * change to one `model_id` in the JSON and to nothing in this tree. That is why
 * `docs/PROVIDERS.md` open disagreement 5 — the drawn Anthropic ids being a
 * generation behind — is answered by this file rather than by an edit to the
 * strings.
 *
 * **It says what a vendor documents, never what this build can operate.** The
 * capability question is the runtime's (`provider_status().capabilities` and
 * `model_capabilities`), and reading a `streaming` column here as an answer to
 * it is the mistake ADR 0106 recorded and ADR 0115 repeated: a documentation
 * claim is not a runtime promise. The local rows are the live example — they
 * say `supported` because whisper.cpp ships a streaming server, while the lane
 * this build drives takes a file.
 */
import raw from "../../shared/model_catalogue.json";

export type ModelRole = "speech" | "chat" | "voice";

/** The three states `core::providers::ModelSupport` carries, same spelling. */
export type ModelSupport = "supported" | "unsupported" | "unknown";

export type CatalogueProvider = {
  id: string;
  label: string;
  lane: string;
};

export type ModelRow = {
  id: string;
  provider: string;
  role: ModelRole;
  model_id: string;
  streaming: ModelSupport;
  languages: string;
  source: string;
  read_date: string;
  note?: string;
};

export type LaneJobModels = {
  /** The row drawn as chosen. */
  default: string;
  /** The rows the picker lists, in drawn order. */
  offered: string[];
};

export type Catalogue = {
  version: number;
  providers: CatalogueProvider[];
  models: ModelRow[];
  runtime_defaults: Record<RuntimeDefaultSlot, string>;
  lanes: Record<string, Record<string, LaneJobModels>>;
};

export type RuntimeDefaultSlot =
  | "speech"
  | "correction"
  | "local_correction"
  | "agent"
  | "local_agent";

/* Cast once, here. TypeScript infers a union over the rows of a JSON array —
   `note` is present on some rows and not on others — and every consumer would
   otherwise narrow it again. The shape is asserted at runtime by this module's
   test and by `core::model_catalogue`'s, which reads the same bytes. */
export const CATALOGUE = raw as unknown as Catalogue;

/** The version this build was written against. */
export const CATALOGUE_VERSION = 1;

/**
 * The row an id names.
 *
 * Throws rather than returning a placeholder: a slug that resolves to nothing is
 * this repo naming its own data wrongly, and a picker quietly missing an option
 * is the failure that would follow.
 */
export function modelRow(id: string): ModelRow {
  const row = CATALOGUE.models.find((entry) => entry.id === id);
  if (!row) {
    throw new Error(`model catalogue has no row '${id}'`);
  }
  return row;
}

/** What goes on the wire for the row an id names. */
export function modelId(id: string): string {
  return modelRow(id).model_id;
}

/**
 * The vendor's drawn name.
 *
 * Separate from the model id because some rows are drawn as both — the desk's
 * voice preset reads *Cartesia Sonic-3*, which is a vendor and a model and not
 * one string that happens to contain a space.
 */
export function providerLabel(id: string): string {
  const provider = CATALOGUE.providers.find((entry) => entry.id === id);
  if (!provider) {
    throw new Error(`model catalogue declares no provider '${id}'`);
  }
  return provider.label;
}

/**
 * What a lane offers a job, as the drawing wants it: the chosen model and the
 * list, both as model ids.
 *
 * A lane or job with no entry answers `undefined` rather than an empty list —
 * Self-hosted types its model id and the listening jobs on Enterprise name the
 * lane that can run them, and neither is a picker with nothing in it.
 */
export function laneJobModels(
  lane: string,
  job: string,
): { model: string; models: string[] } | undefined {
  const entry = CATALOGUE.lanes[lane]?.[job];
  if (!entry) {
    return undefined;
  }

  return {
    model: modelId(entry.default),
    models: entry.offered.map(modelId),
  };
}

/** What the runtime falls back to when a config names no model. */
export function runtimeDefault(slot: RuntimeDefaultSlot): string {
  return modelId(CATALOGUE.runtime_defaults[slot]);
}
