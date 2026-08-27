/* THE MODEL CATALOGUE, READ AT BUILD TIME

   ADR 0115: a model id lives in shared/model_catalogue.json and nowhere else,
   and both runtimes name a row by its slug rather than by the vendor's model
   name. This page is a third reader of that file and it obeys the same rule --
   nothing below spells a model id, a vendor name or a count. They are read.

   That is the difference between a marketing table and this one. A hand-typed
   grid of vendors is stale the first time a row is added, and the page has no
   way to know; this one is wrong only if the file both runtimes load is wrong.
   It costs nothing at runtime: the import is resolved during the build and
   what ships is the rendered markup.

   ── WHY THIS FILE NO LONGER BUILDS A MATRIX ────────────────────────────────

   It used to produce an eight-by-three grid: every job against every lane,
   with the default model id printed in each of the twenty-four cells. The
   claim the section makes is that the jobs do not have to agree, and a matrix
   is the most complete possible statement of that claim. It is also the least
   readable one. Twenty-four model ids in mono is a wall a reader skims, and
   what they take from a wall is "there are a lot of models", which is not the
   claim; four of the cells said `none`, which is the only part anybody would
   act on and it was the quietest thing on the surface.

   Two objects replace it, and between them they carry the same information:

   - **The lanes.** Four cards. What the lane IS, what it costs you to use
     (which is the credential shape, and that is the thing that actually
     decides which one somebody picks), who runs on it, and how many of the
     eight jobs it serves. Nobody has to read a model id to choose a lane.
   - **One profile.** Four rows, three different lanes, drawn from the
     catalogue's own defaults. A single worked example proves "the jobs do not
     have to agree" in a way a full grid cannot, because a full grid has to be
     compared with itself before it says anything.

   ── AND WHY THERE ARE FOUR LANES HERE AND THREE IN THE FILE ───────────────

   The catalogue's `lanes` block has three keys, and the product has four. The
   fourth is `Self-hosted` -- *Your server* on the surface (`LANE_LABEL` in
   src/screens/data.ts) -- an OpenAI-compatible server the reader operates on
   another machine. It is absent from the catalogue for the reason that makes
   it a lane at all: **it has no catalogue rows, because the server is theirs
   and its model list belongs to whoever runs it.** `src/screens/data.ts` fills
   all eight of its job cells with the sentence "typed on the endpoint", which
   is a sentence standing where a model id would be, not a model id.

   So this file names that lane and spells no id for it, which is ADR 0115
   obeyed rather than bent: the rule is about model ids, and this lane's whole
   character is that it has none. Leaving it off the page was the actual defect
   -- the page listed three of the product's four lanes and the missing one is
   the one a self-hosting reader is looking for.

   The lane's facts come from docs/PROVIDERS.md ("The four lanes") and from
   ADR 0164 and ADR 0165, which are what gave it the three listening jobs. */
import catalogue from '../../../shared/model_catalogue.json';
import { isColour, type MarkId } from './marks';

type Row = {
  id: string;
  provider: string;
  role: string;
  model_id: string;
  read_date: string;
  languages?: string;
  /** Present only on rows the runtime knows how to fetch, which is the Local
   *  lane and nothing else. `core::model_install` fetches by these. */
  install?: { size_bytes: number };
};

const MODELS = catalogue.models as Row[];
const PROVIDERS = catalogue.providers as { id: string; label: string; lane: string }[];
const LANES = catalogue.lanes as Record<string, Record<string, { default: string; offered: string[] }>>;

const byId = new Map(MODELS.map(m => [m.id, m]));
const providerLabel = new Map(PROVIDERS.map(p => [p.id, p.label]));

/** The job axis, in the order a dictation meets it: the three ways in, then
 *  the four transforms, then the one thing that answers back. `JobKey` in
 *  src/types/ipc.ts is the same list; the labels are this page's. */
export const JOBS: { key: string; label: string; what: string }[] = [
  { key: 'dictation', label: 'Dictation',        what: 'what you said, into text' },
  { key: 'meetings',  label: 'Meetings',         what: 'a room, while it runs' },
  { key: 'upload',    label: 'Uploads and links', what: 'a file or a pasted URL' },
  { key: 'cleanup',   label: 'Cleanup',          what: 'repairs what you said' },
  { key: 'rewrite',   label: 'Rewrite',          what: 'changes how it reads' },
  { key: 'translate', label: 'Translate',        what: 'says it in another language' },
  { key: 'enhance',   label: 'Prompt Enhance',   what: 'turns a thought into a prompt' },
  { key: 'assistant', label: 'The agent',        what: 'answers, and can act' },
];

const jobByKey = new Map(JOBS.map(j => [j.key, j]));

/* ── The marks a vendor wears ──────────────────────────────────────────────
   Keyed by the catalogue's own provider id, so a provider the file gains and
   this table does not know simply rides as text. A missing mark must never be
   a missing vendor: the row below drops the glyph, never the name. */
const VENDOR_MARK: Record<string, MarkId> = {
  groq: 'groq',
  openai: 'openai',
  anthropic: 'anthropic',
  openrouter: 'openrouter',
  bedrock: 'bedrock',
};

/* The Local lane has one provider in the catalogue and it is a runner, not a
   vendor -- so the row a reader recognises is the model FAMILIES that run on
   it. Detected from the catalogue's own `model_id` values by their leading
   token, which is why no id is spelled: adding a family to the file puts it in
   this row, and removing one takes it out. */
const FAMILY_MARK: { token: string; label: string; mark: MarkId }[] = [
  // whisper.cpp ships the GGML conversions of OpenAI's Whisper
  { token: 'ggml',  label: 'Whisper', mark: 'openai' },
  { token: 'llama', label: 'Llama',   mark: 'meta' },
  { token: 'qwen',  label: 'Qwen',    mark: 'qwen' },
  { token: 'gemma', label: 'Gemma',   mark: 'gemma' },
];

/* A vendor as this page draws it: a name, the sprite symbol to point a `<use>`
   at, and whether that symbol carries its own colours. The path data is not
   here any more -- it is defined once in the sprite (../lib/marks) rather than
   inlined at every one of the forty-odd places a mark appears. */
export type Vendor = { label: string; mark: MarkId | null; colour: boolean };

const vendor = (label: string, mark: MarkId | null): Vendor =>
  ({ label, mark, colour: mark ? isColour(mark) : false });

/** How many of the eight jobs a catalogued lane serves. */
const served = (lane: string) =>
  JOBS.filter(j => LANES[lane]?.[j.key]?.default).length;

const cloudVendors = PROVIDERS
  .filter(p => p.lane === 'Cloud')
  .map(p => vendor(p.label, VENDOR_MARK[p.id] ?? null));

/* Local's row is the families, plus the runner the chat half talks to. The
   endpoint is `http://127.0.0.1:11434` by default (docs/PROVIDERS.md, Local),
   which is Ollama, and it is the one name on this card a reader will already
   have installed. */
const localVendors = [
  ...FAMILY_MARK
    .filter(f => MODELS.some(m => m.provider === 'local' && m.model_id.toLowerCase().startsWith(f.token)))
    .map(f => vendor(f.label, f.mark)),
  vendor('Ollama', 'ollama'),
];

export type LaneCard = {
  /** The key the seam resolves, which is not always what the surface says. */
  key: string;
  label: string;
  what: string;
  credential: string;
  vendors: Vendor[];
  /** How many of the eight jobs the lane serves. */
  jobs: number;
  /** The lane whose model list is the reader's own, so it draws a field rather
   *  than a vendor row. */
  typed?: boolean;
  /** What this lane runs for each of the eight jobs. Empty on the lane whose
   *  model list is the reader's own. */
  rows: JobRow[];
};

/** One job on one lane: what would actually run, or why nothing does. */
export type JobRow = {
  job: string;
  what: string;
  vendor: Vendor;
  /** The catalogue's model id, or empty where the lane serves no default. */
  model: string;
  /** Local only: what the model costs to have on the disk. */
  size?: string;
  /** Set where the lane does not serve this job at all. */
  none?: boolean;
};

/* ── WHAT A LANE RUNS, PER JOB ─────────────────────────────────────────────

   The section used to answer "which model runs my dictation" with four model
   ids in the profile block and nothing else, out of thirty-five rows in the
   file. A reader deciding between lanes could read the whole section and still
   not know what would actually run.

   THIS IS NOT THE MATRIX COMING BACK, AND THE DIFFERENCE IS WHO ASKED. The
   grid this file's header describes drew all twenty-four cells at once, and
   what a reader takes from twenty-four mono strings is "there are a lot of
   models" -- which is not the claim, and which cost the four `none` cells
   their visibility. These are the same values arranged so that one lane's
   eight are on screen at a time and the reader chose which lane. A wall nobody
   asked for is a wall; a column somebody opened is an answer.

   THE SIZE IS ON THE LOCAL ROWS AND ONLY THERE, because it is the deciding
   fact on exactly one lane. A cloud model costs a request; a local model costs
   disk and a load before it costs anything else, and the number is the first
   thing anybody weighing the local lane wants. It is `install.size_bytes` from
   the same rows `core::model_install` fetches by, so the number here and the
   number the download actually costs cannot disagree.

   The units are decimal and the rounding matches `formatModelSize` in
   src/lib/modelCatalogue.ts, which is what the app's own model library prints.
   Two surfaces stating one file's byte count have to state it the same way or
   one of them is wrong. */
const GB = 1_000_000_000;
const MB = 1_000_000;

/** `formatModelSize`, src/lib/modelCatalogue.ts. Decimal units, because that is
 *  what both upstreams publish; re-derived here rather than imported, because
 *  importing app source into the site build drags the app's module graph in
 *  behind it for four lines of arithmetic. */
const size = (bytes: number) =>
  bytes >= GB ? `${(bytes / GB).toFixed(1)} GB` : `${Math.round(bytes / MB)} MB`;

const jobRows = (lane: string): JobRow[] =>
  JOBS.map((j) => {
    const slug = LANES[lane]?.[j.key]?.default;
    const row = slug ? byId.get(slug) : undefined;

    if (!row) {
      return { job: j.label, what: j.what, vendor: vendor('', null), model: '', none: true };
    }

    /* A local row is named by its FAMILY rather than by its provider, because
       the provider on every local row is "Local runtime" -- the runner, which
       the lane already is. Whisper, Llama, Qwen and Gemma are what a reader
       recognises. */
    const family = row.provider === 'local'
      ? FAMILY_MARK.find(f => row.model_id.toLowerCase().startsWith(f.token))
      : undefined;

    return {
      job: j.label,
      what: j.what,
      vendor: family
        ? vendor(family.label, family.mark)
        : vendor(providerLabel.get(row.provider) ?? row.provider, VENDOR_MARK[row.provider] ?? null),
      model: row.model_id,
      size: row.install ? size(row.install.size_bytes) : undefined,
    };
  });

/* The four, in the order somebody choosing between them reads: the one most
   people start on, the one that answers the privacy question, the one for
   people who already run a box, and the one procurement asks for.

   Credential shapes are docs/PROVIDERS.md's four-lane table, shortened. They
   are the deciding fact on this card: a lane is picked on what it costs you to
   operate, not on which model it happens to default to. */
export const LANE_CARDS: LaneCard[] = [
  {
    key: 'Cloud',
    label: 'Cloud',
    what: "A vendor's own hosted API, on an account you hold.",
    credential: "a key, in your operating system's secret store",
    vendors: cloudVendors,
    jobs: served('Cloud'),
    rows: jobRows('Cloud'),
  },
  {
    key: 'Local',
    label: 'Local',
    what: 'On this machine, on its own disk and memory.',
    credential: 'none, by construction',
    vendors: localVendors,
    jobs: served('Local'),
    rows: jobRows('Local'),
  },
  {
    key: 'Self-hosted',
    /* `LANE_LABEL`, src/screens/data.ts: the identifier does not move, because
       it is a key the seam resolves, and what a lane is CALLED belongs on the
       surface. "Self-hosted" reads as a category; the lane is a place. */
    label: 'Your server',
    what: 'An OpenAI-compatible server you run, on another machine.',
    credential: 'a base URL, a typed model id, a token if you set one',
    vendors: [],
    /* All eight since ADR 0164: `/v1/audio/transcriptions` is a de-facto
       standard and a user-run server answers on it, so the three listening
       jobs stopped being a refusal. */
    jobs: JOBS.length,
    typed: true,
    /* NO ROWS, AND THE EMPTINESS IS THE LANE. Eight rows all reading the same
       sentence is a wall that says less than the sentence does once. What this
       lane draws instead is the two fields it actually takes. */
    rows: [],
  },
  {
    key: 'Enterprise',
    label: 'Enterprise',
    /* THE THREE MISSING JOBS ARE NAMED, because they are the only thing on
       this card somebody could act on and be wrong about. The old grid said it
       in four cells reading `none`, which was its quietest text; a lane that
       serves five of eight has to say which five it does not. */
    what: 'A cloud account with a region, a tenant and an audit trail. Only Azure transcribes among the three, so the listening jobs go elsewhere.',
    credential: 'three shapes, one per vendor',
    /* Only Bedrock has catalogue rows today; the lane is three vendors and
       docs/PROVIDERS.md's four-lane table is what says so. The count under the
       section is deliberately worded as a count of the CATALOGUE, so a reader
       who counts marks and gets more than that is not being contradicted. */
    vendors: [
      vendor('AWS Bedrock', 'bedrock'),
      vendor('Azure OpenAI', 'azureai'),
      vendor('GCP Vertex AI', 'vertexai'),
    ],
    jobs: served('Enterprise'),
    rows: jobRows('Enterprise'),
  },
];

/* ── One profile, mixed ────────────────────────────────────────────────────
   The section's claim in four rows. Each names a job, the lane it is set to
   and what that lane runs for it by default -- and the four rows are on three
   different lanes, which is the whole statement.

   The models are read, not chosen: `pick` looks the default up in the
   catalogue for that (lane, job) pair, so a row here says what the runtime
   would actually do. The Translate row is on the lane that has no default to
   read, and it prints the sentence that stands where a model id would. */
export type ProfileRow = {
  job: string;
  what: string;
  lane: string;
  vendor: Vendor;
  model: string;
  why: string;
};

const pick = (lane: string, job: string, why: string): ProfileRow => {
  const j = jobByKey.get(job)!;
  const slug = LANES[lane]?.[job]?.default;
  const row = slug ? byId.get(slug) : undefined;
  const providerId = row?.provider ?? '';
  const card = LANE_CARDS.find(c => c.key === lane)!;

  /* Local rows are named by their family rather than by the runner, because
     "Local runtime" is what the lane already says one line up. */
  const family = row && providerId === 'local'
    ? FAMILY_MARK.find(f => row.model_id.toLowerCase().startsWith(f.token))
    : undefined;

  return {
    job: j.label,
    what: j.what,
    lane: card.label,
    vendor: family
      ? vendor(family.label, family.mark)
      : vendor(providerLabel.get(providerId) ?? 'Your server', VENDOR_MARK[providerId] ?? null),
    model: row?.model_id ?? 'typed on the endpoint',
    why,
  };
};

export const PROFILE: ProfileRow[] = [
  pick('Cloud', 'dictation', 'the fastest lane, and you are waiting on this one'),
  pick('Local', 'cleanup', 'a repair job a small model does well, and it never leaves the machine'),
  pick('Self-hosted', 'translate', 'the box in the next room, already running'),
  pick('Cloud', 'assistant', 'the one job worth a frontier model'),
];

/** What the catalogue holds, stated as a count of the catalogue rather than as
 *  a count of the product: two of the vendors this page names have no rows in
 *  it yet, and neither does the lane whose model list is the reader's own. */
export const COUNTS = {
  models: MODELS.length,
  vendors: PROVIDERS.length,
  lanes: LANE_CARDS.length,
  /** The newest read-date in the file, so the page can say when it last looked
   *  rather than implying the table is timeless. */
  read: MODELS.map(m => m.read_date).sort().at(-1)!,
};

/* WHAT THE LOCAL LANE COSTS ON DISK, AT BOTH ENDS

   ── A SINGLE TOTAL WAS A PREDICTION AND THIS FILE CANNOT MAKE ONE ─────────

   The first version of this exported one figure: the sum of every distinct
   file behind the Local lane's eight defaults. It was correct arithmetic and
   the wrong claim. Nothing here knows which models somebody installs. A reader
   who only ever dictates fetches one speech model and never sees the rest, and
   printing the full set as "what it costs" told them they owed seven gigabytes
   for a job that costs a hundred and fifty megabytes. That is the same defect
   as printing a language count nobody measured, one step further along: a
   number that is arithmetically true and describes a machine that does not
   exist.

   ── SO IT STATES BOTH ENDS, AND THE SPREAD IS THE POINT ───────────────────

   The section's whole argument is that a profile decides each job separately.
   The disk figure has to say the same thing or it contradicts the paragraph
   above it. Two ends:

   - THE FLOOR is the single file behind the `dictation` default -- the one
     model somebody who only dictates ever fetches, and the smallest thing that
     is a working install.
   - THE CEILING is every distinct file behind all eight defaults, deduped,
     which is what somebody who runs the whole lane locally ends up holding.

   THE CEILING IS DEDUPED BY MODEL AND THAT IS NOT A DETAIL. Eight jobs resolve
   to four files: one small speech model, one larger one shared by two jobs,
   and two chat models of which the bigger serves four. Summing the eight ROWS
   would count the same weights up to four times and report about triple the
   truth. Disk is charged per file, so the sum is per file.

   It throws on a local default with no install block, for the same reason
   `jobRows` prints a size only where there is one: a total missing one of its
   models is not a smaller number, it is a wrong one, and a card whose promise
   is that the number is the runtime's cannot round down silently. */
const localFiles = (() => {
  const files = new Map<string, number>();
  for (const j of JOBS) {
    const slug = LANES.Local?.[j.key]?.default;
    if (!slug) continue;
    const row = byId.get(slug);
    const bytes = row?.install?.size_bytes;
    if (!bytes) {
      throw new Error(
        `catalogue: the Local default for '${j.key}' ('${slug}') has no ` +
        'install.size_bytes, so the lane figures would be short by one model.',
      );
    }
    files.set(slug, bytes);
  }
  return files;
})();

const dictationSlug = LANES.Local?.dictation?.default;
const dictationBytes = dictationSlug ? localFiles.get(dictationSlug) : undefined;
if (!dictationBytes) {
  throw new Error(
    'catalogue: the Local lane has no dictation default with an install size, ' +
    'so the floor of the disk range cannot be stated.',
  );
}

/** What the Local lane costs on disk at both ends: one model for dictation
 *  alone, and every distinct file behind all eight jobs. Nobody can be told
 *  which of the two they will end up at, so the card states both. */
export const LOCAL_INSTALL = {
  /** Dictation only, on the lane's own default speech model. */
  floor: size(dictationBytes),
  /** All eight jobs on the lane's defaults, counted once per file. */
  ceiling: size([...localFiles.values()].reduce((a, b) => a + b, 0)),
  /** How many distinct files the ceiling is, so the card can say why the
   *  visible rows above it do not add up to it. */
  files: localFiles.size,
};
