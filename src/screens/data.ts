import type { ListItemBadge, RawTranscript } from "@/components/shell";
import { laneJobModels, modelId, providerLabel } from "@/lib/modelCatalogue";

/**
 * THE PROTOTYPE'S SAMPLE DATA, copied out of `demo.js`.
 *
 * A gallery screen carries sample data and asserts nothing (ADR 0055) — and
 * the sample data is part of the design, not filler chosen to fill a row. The
 * seventh history entry is what a swept record looks like; the fourth is a
 * delivery exception; the third has no `heard` at all, which is what Verbatim
 * produces. A port that invented its own rows would have drawn none of the
 * three states the list exists to show.
 *
 * `DESK_CAP` is the desk's display name, once, so the screens that name it
 * cannot drift apart.
 */

export const DESK = "the desk";
export const DESK_CAP = "The desk";

export type Transcript = {
  id: string;
  text: string;
  heard?: string;
  at: string;
  mode: string;
  profile: string;
  path: string;
  badges?: ListItemBadge[];
  restore?: boolean;
  /** `false` is a record whose audio has been swept — Retry has nothing to
   *  re-run (ADR 0039) and says so by disabling rather than by hiding. */
  audio?: boolean;
  rawNote?: string;
};

export function rawOf(entry: Transcript): RawTranscript {
  return {
    heard: entry.heard ?? entry.text,
    written: entry.text,
    same: !entry.heard,
    /* Absent unless the entry has something of its own to say. `RawPanel`
       carries the two default sentences; defaulting here meant the caller
       always won and the panel's "Identical" branch was unreachable. */
    note: entry.rawNote,
    path: entry.path,
  };
}

export const RECENT: Transcript[] = [
  {
    id: "r1",
    text: "Let’s ship the settings restructure today and review the overlay tab.",
    heard: "lets ship the settings restructure today and uh review the overlay tab",
    at: "2 min ago",
    mode: "Cleanup",
    profile: "General writing",
    path: "~/WordScript/transcripts/2026/08/03-0942-settings-restructure.md",
  },
  {
    id: "r2",
    text: "Hey WordScript, write a short reply confirming Thursday works.",
    heard: "hey wordscript write a short reply confirming thursday works",
    at: "18 min ago",
    mode: "Draft",
    profile: "General writing",
    path: "~/WordScript/transcripts/2026/08/03-0926-reply-thursday.md",
  },
  {
    id: "r3",
    text: "Consolidate insert recovery into a single home.",
    at: "1 h ago",
    mode: "Verbatim",
    profile: "General writing",
    path: "~/WordScript/transcripts/2026/08/03-0851-insert-recovery.md",
  },
  {
    id: "r4",
    text: "Kundenanfrage zum Lieferstatus, bitte freundlich beantworten.",
    heard: "kundenanfrage zum lieferstatus bitte freundlich beantworten",
    at: "Yesterday",
    mode: "Rewrite",
    profile: "Support reply",
    badges: [{ text: "Clipboard", tone: "warning" }],
    restore: true,
    path: "~/WordScript/transcripts/2026/08/02-1703-lieferstatus.md",
  },
  {
    id: "r5",
    text: "Structure this into a prompt for Claude Code with the constraints I listed.",
    heard: "structure this into a prompt for claude code with the constraints i listed",
    at: "Yesterday",
    mode: "Prompt Enhance",
    profile: "General writing",
    path: "~/WordScript/transcripts/2026/08/02-1540-claude-prompt.md",
  },
];

export const HISTORY: Transcript[] = [
  {
    id: "h1",
    text: "Let’s ship the settings restructure today and review the overlay tab.",
    heard: "lets ship the settings restructure today and uh review the overlay tab",
    at: "09:42",
    mode: "Cleanup",
    profile: "General writing",
    path: "~/WordScript/transcripts/2026/08/03-0942-settings-restructure.md",
  },
  {
    id: "h2",
    text: "Hey WordScript, write a short reply confirming Thursday works.",
    heard: "hey wordscript write a short reply confirming thursday works",
    at: "09:26",
    mode: "Draft",
    profile: "General writing",
    path: "~/WordScript/transcripts/2026/08/03-0926-reply-thursday.md",
  },
  {
    id: "h3",
    text: "Consolidate insert recovery into a single home.",
    at: "08:51",
    mode: "Verbatim",
    profile: "General writing",
    path: "~/WordScript/transcripts/2026/08/03-0851-insert-recovery.md",
  },
  {
    id: "h4",
    text: "Kundenanfrage zum Lieferstatus, bitte freundlich beantworten.",
    heard: "kundenanfrage zum lieferstatus bitte freundlich beantworten",
    at: "Yesterday 17:03",
    mode: "Rewrite",
    profile: "Support reply",
    badges: [{ text: "Insert failed", tone: "danger" }],
    restore: true,
    path: "~/WordScript/transcripts/2026/08/02-1703-lieferstatus.md",
  },
  {
    id: "h5",
    text: "Structure this into a prompt for Claude Code with the constraints I just listed.",
    heard: "structure this into a prompt for claude code with the constraints i just listed",
    at: "Yesterday 15:40",
    mode: "Prompt Enhance",
    profile: "General writing",
    badges: [{ text: "Retried once", tone: "plan" }],
    path: "~/WordScript/transcripts/2026/08/02-1540-claude-prompt.md",
  },
  {
    id: "h6",
    text: "Standup notes: overlay placement fixed, shortcuts still open.",
    heard: "standup notes overlay placement fixed shortcuts still open",
    at: "Yesterday 09:12",
    mode: "Cleanup",
    profile: "General writing",
    path: "~/WordScript/transcripts/2026/08/02-0912-standup.md",
  },
  {
    id: "h7",
    text: "Danke fuer die Rueckmeldung, ich schaue mir das heute noch an.",
    heard: "danke für die rückmeldung ich schaue mir das heute noch an",
    at: "Mon 16:22",
    mode: "Rewrite",
    profile: "Support reply",
    audio: false,
    badges: [
      { text: "Clipboard only", tone: "warning" },
      { text: "Audio swept", tone: "plan" },
    ],
    restore: true,
    path: "~/WordScript/transcripts/2026/07/31-1622-rueckmeldung.md",
  },
];

/* ── AI Models: the providers and the four lanes ────────────────────────────
   `demo.js`'s `PROVIDERS` and `LANES`, copied whole. It is data in the
   prototype too, and for the reason the lane switch exists at all: a lane
   decides what a provider even IS — a cloud account with a key, a binary on
   this disk, a URL you operate, an account with a region — and with it what a
   model is called, whether it can be downloaded, and whether a credential
   exists at all.

   THE MODEL NAMES CHANGE ACROSS LANES. `whisper-large-v3-turbo` is a Groq
   endpoint; `ggml-large-v3-turbo` is a file on this disk. They are the same
   weights and they are not the same thing — one is billed per request and
   bounded by an upload limit, the other costs 1.6 GB and a load. A surface that
   shows the same string in both lanes is hiding the only difference that
   matters.

   A JOB CAN BE UNAVAILABLE IN A LANE. No enterprise provider we would ship
   transcribes except Azure, and no self-hosted OpenAI-compatible endpoint does
   at all. Those jobs say so and name the lane that can run them, rather than
   offering a picker with nothing in it. */

export type LaneName = "Cloud" | "Local" | "Self-hosted" | "Enterprise";

export type Provider = {
  name: string;
  lane: LaneName;
  stt: boolean;
  llm: boolean;
  key?: boolean;
  desc: string;
};

export const PROVIDERS: Provider[] = [
  { name: "Groq", lane: "Cloud", stt: true, llm: true, key: true, desc: "Speech and language. The fastest lane, and today's default for both." },
  { name: "OpenAI", lane: "Cloud", stt: true, llm: true, key: true, desc: "Speech and language." },
  { name: "Anthropic", lane: "Cloud", stt: false, llm: true, key: true, desc: "Language only. No speech recognition." },
  { name: "Gemini", lane: "Cloud", stt: false, llm: true, desc: "Language only." },
  { name: "Mistral", lane: "Cloud", stt: true, llm: true, desc: "Speech and language." },
  { name: "xAI", lane: "Cloud", stt: true, llm: false, desc: "Speech only." },
  { name: "OpenRouter", lane: "Cloud", stt: false, llm: true, desc: "One key, many models. Reaches providers with no adapter of their own." },
  { name: "AWS Bedrock", lane: "Enterprise", stt: false, llm: true, desc: "Access key, secret and region — or the ambient AWS credential chain." },
  { name: "Azure OpenAI", lane: "Enterprise", stt: true, llm: true, desc: "Endpoint, deployment and key. The deployment name is the model id." },
  { name: "GCP Vertex AI", lane: "Enterprise", stt: false, llm: true, desc: "Service account JSON, project and location." },
];

export function providerNames(cap: "stt" | "llm", lane?: LaneName): string[] {
  return PROVIDERS.filter((p) => p[cap] && (!lane || p.lane === lane)).map((p) => p.name);
}

/** What a lane offers a job. `none` is the sentence that stands where a model
 *  would; `mark: null` takes the row off the connection's axis entirely. */
export type LaneJob = {
  model?: string;
  models?: string[];
  override?: string;
  mark?: string | null;
  none?: string;
};

export type JobKey =
  | "dictation" | "meetings" | "upload"
  | "cleanup" | "rewrite" | "translate" | "enhance" | "assistant";

/** What stands where a model id would on the lane that has no list to offer. */
const TYPED_ON_THE_ENDPOINT = "typed on the endpoint";

/* THE MODEL NAMES ARE NO LONGER HERE (ADR 0115). What each lane offers each job
   is `shared/model_catalogue.json`, read by this file and by
   `core::model_catalogue` — the same rows, with a source and a read-date on
   each. What stays here is everything the catalogue is not: which provider a
   job overrides to, which brand mark the row carries, and the sentence a lane
   that cannot run a job says instead.

   The Anthropic ids moved a generation in the process, which is the answer
   `docs/PROVIDERS.md` open disagreement 5 has been waiting for rather than a
   drawing change: the drawn names were `claude-sonnet-4-6` and
   `claude-opus-4-7` and the vendor serves `claude-sonnet-5` and
   `claude-opus-5`. Correcting them by hand was refused twice on the grounds
   that it is the same work twice; the catalogue is where it is done once. */
function offered(lane: LaneName, job: JobKey): LaneJob {
  const entry = laneJobModels(lane, job);
  if (!entry) {
    throw new Error(`the catalogue offers nothing for ${lane}/${job}`);
  }
  return entry;
}

export const LANES: Record<LaneName, { provider: string; jobs: Record<JobKey, LaneJob> }> = {
  Cloud: {
    provider: "Groq",
    jobs: {
      dictation: offered("Cloud", "dictation"),
      meetings: offered("Cloud", "meetings"),
      upload: { ...offered("Cloud", "upload"), override: "OpenAI" },
      cleanup: offered("Cloud", "cleanup"),
      rewrite: offered("Cloud", "rewrite"),
      translate: { ...offered("Cloud", "translate"), override: "Anthropic" },
      enhance: offered("Cloud", "enhance"),
      assistant: { ...offered("Cloud", "assistant"), override: "Anthropic" },
    },
  },
  Local: {
    provider: "llama.cpp",
    jobs: {
      dictation: { ...offered("Local", "dictation"), mark: "openai" },
      meetings: { ...offered("Local", "meetings"), mark: "openai" },
      upload: { ...offered("Local", "upload"), mark: "openai" },
      cleanup: { ...offered("Local", "cleanup"), mark: "llama" },
      rewrite: { ...offered("Local", "rewrite"), mark: "qwen" },
      translate: { ...offered("Local", "translate"), mark: "qwen" },
      enhance: { ...offered("Local", "enhance"), mark: "qwen" },
      assistant: { ...offered("Local", "assistant"), mark: "qwen" },
    },
  },
  "Self-hosted": {
    provider: "your server",
    /* NO CATALOGUE ROWS, AND THAT IS THE LANE. "typed on the endpoint" is a
       sentence standing where a model id would, not a model id — the server is
       the user's and its model list belongs to whoever runs it, which is the
       free-typed field ADR 0115 keeps beside every catalogue list. */
    jobs: {
      dictation: { none: "Speech has no OpenAI-compatible shape to talk to. Use Cloud or Local for the listening jobs." },
      meetings: { none: "Same — a self-hosted chat endpoint does not transcribe." },
      upload: { none: "Same — a self-hosted chat endpoint does not transcribe." },
      cleanup: { model: TYPED_ON_THE_ENDPOINT, models: [TYPED_ON_THE_ENDPOINT], mark: null },
      rewrite: { model: TYPED_ON_THE_ENDPOINT, models: [TYPED_ON_THE_ENDPOINT], mark: null },
      translate: { model: TYPED_ON_THE_ENDPOINT, models: [TYPED_ON_THE_ENDPOINT], mark: null },
      enhance: { model: TYPED_ON_THE_ENDPOINT, models: [TYPED_ON_THE_ENDPOINT], mark: null },
      assistant: { model: TYPED_ON_THE_ENDPOINT, models: [TYPED_ON_THE_ENDPOINT], mark: null },
    },
  },
  Enterprise: {
    provider: "AWS Bedrock",
    jobs: {
      dictation: { none: "Only Azure OpenAI transcribes among the three. Switch the provider above, or use Cloud or Local." },
      meetings: { none: "Only Azure OpenAI transcribes among the three." },
      upload: { none: "Only Azure OpenAI transcribes among the three." },
      cleanup: { ...offered("Enterprise", "cleanup"), mark: "bedrock" },
      rewrite: { ...offered("Enterprise", "rewrite"), mark: "bedrock" },
      translate: { ...offered("Enterprise", "translate"), mark: "bedrock" },
      enhance: { ...offered("Enterprise", "enhance"), mark: "bedrock" },
      assistant: { ...offered("Enterprise", "assistant"), mark: "bedrock" },
    },
  },
};

/* ── The drawn model library ────────────────────────────────────────────────
   What `AI Models`' machine tab and onboarding's download step list, and what
   the catalogue cannot answer: a size on this disk, a sentence about who the
   model suits, and whether it is installed. **The catalogue says what a vendor
   documents; a library row says what is on this machine**, which is why the two
   are not the same list and why the real one will eventually come off
   `core::providers::local`'s model directory rather than from either.

   What the library does NOT carry is the name. That comes off the same
   catalogue row the lane picker offers, so a renamed model is renamed in one
   place and both surfaces follow. */
const LIBRARY: Record<string, { brand: string; size: string; detail: string }> = {
  "local-speech-base": { brand: "openai", size: "142 MB", detail: "multilingual · the recommended balance" },
  "local-speech-base-en": { brand: "openai", size: "142 MB", detail: "English only, more accurate on English" },
  "local-speech-small": { brand: "openai", size: "466 MB", detail: "multilingual · better on accents" },
  "local-speech-medium": { brand: "openai", size: "1.5 GB", detail: "multilingual · noticeably slower on CPU" },
  "local-speech-large-v3-turbo": { brand: "openai", size: "1.6 GB", detail: "multilingual · the best that still runs in real time" },
  "local-chat-qwen-7b": { brand: "qwen", size: "4.4 GB", detail: "Q4_K_M · the general recommendation" },
  "local-chat-qwen-14b": { brand: "qwen", size: "8.4 GB", detail: "Q4_K_M · needs a GPU to be pleasant" },
  "local-chat-llama-3b": { brand: "llama", size: "2.0 GB", detail: "Q4_K_M · fast enough for cleanup on CPU" },
  "local-chat-gemma-4b": { brand: "gemma", size: "2.5 GB", detail: "Q4_K_M · strong on German" },
};

/* The two voice presets the desk draws, composed once for the three surfaces
   that show them: `AI Models`' Speaking group, the Agents screen and the agent
   overlay. Each is a vendor and a model rather than one string that happens to
   contain a space, which is why the label comes off the provider row and the
   name off the model row. Neither is operated by anything — ADR 0109 gates the
   voice adapter on the job that runs it, and that job does not exist yet. */
export const DESK_VOICE_PRESET = `${providerLabel("cartesia")} ${modelId("cartesia-voice-sonic-3")}`;
export const LOCAL_VOICE_PRESET = `${modelId("local-voice-kokoro")} (local)`;

/** One library row: the catalogue's name plus what only this disk knows. */
export function libraryModel(id: string): { brand: string; name: string; size: string; detail: string } {
  const drawn = LIBRARY[id];
  if (!drawn) {
    throw new Error(`no drawn library row for '${id}'`);
  }
  return { ...drawn, name: modelId(id) };
}
