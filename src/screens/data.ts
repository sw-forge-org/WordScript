import type { ListItemBadge, RawTranscript } from "@/components/shell";

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

export const LANES: Record<LaneName, { provider: string; jobs: Record<JobKey, LaneJob> }> = {
  Cloud: {
    provider: "Groq",
    jobs: {
      dictation: { model: "whisper-large-v3-turbo", models: ["whisper-large-v3-turbo", "whisper-large-v3", "distil-whisper-large-v3-en"] },
      meetings: { model: "whisper-large-v3", models: ["whisper-large-v3", "whisper-large-v3-turbo"] },
      upload: { model: "whisper-1", models: ["whisper-1", "gpt-4o-transcribe", "whisper-large-v3"], override: "OpenAI" },
      cleanup: { model: "llama-3.1-8b-instant", models: ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"] },
      rewrite: { model: "llama-3.3-70b-versatile", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"] },
      translate: { model: "claude-sonnet-4-6", models: ["claude-sonnet-4-6", "claude-haiku-4-5", "claude-opus-4-7"], override: "Anthropic" },
      enhance: { model: "llama-3.3-70b-versatile", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"] },
      assistant: { model: "claude-sonnet-4-6", models: ["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5"], override: "Anthropic" },
    },
  },
  Local: {
    provider: "llama.cpp",
    jobs: {
      dictation: { model: "ggml-base", models: ["ggml-base", "ggml-base.en", "ggml-small"], mark: "openai" },
      meetings: { model: "ggml-small", models: ["ggml-small", "ggml-base", "ggml-medium"], mark: "openai" },
      upload: { model: "ggml-small", models: ["ggml-small", "ggml-medium", "ggml-large-v3-turbo"], mark: "openai" },
      cleanup: { model: "llama-3.2-3b-instruct", models: ["llama-3.2-3b-instruct", "qwen2.5-7b-instruct"], mark: "llama" },
      rewrite: { model: "qwen2.5-7b-instruct", models: ["qwen2.5-7b-instruct", "llama-3.2-3b-instruct"], mark: "qwen" },
      translate: { model: "qwen2.5-7b-instruct", models: ["qwen2.5-7b-instruct", "gemma-3-4b-it"], mark: "qwen" },
      enhance: { model: "qwen2.5-7b-instruct", models: ["qwen2.5-7b-instruct", "llama-3.2-3b-instruct"], mark: "qwen" },
      assistant: { model: "qwen2.5-7b-instruct", models: ["qwen2.5-7b-instruct", "gemma-3-4b-it"], mark: "qwen" },
    },
  },
  "Self-hosted": {
    provider: "your server",
    jobs: {
      dictation: { none: "Speech has no OpenAI-compatible shape to talk to. Use Cloud or Local for the listening jobs." },
      meetings: { none: "Same — a self-hosted chat endpoint does not transcribe." },
      upload: { none: "Same — a self-hosted chat endpoint does not transcribe." },
      cleanup: { model: "typed on the endpoint", models: ["typed on the endpoint"], mark: null },
      rewrite: { model: "typed on the endpoint", models: ["typed on the endpoint"], mark: null },
      translate: { model: "typed on the endpoint", models: ["typed on the endpoint"], mark: null },
      enhance: { model: "typed on the endpoint", models: ["typed on the endpoint"], mark: null },
      assistant: { model: "typed on the endpoint", models: ["typed on the endpoint"], mark: null },
    },
  },
  Enterprise: {
    provider: "AWS Bedrock",
    jobs: {
      dictation: { none: "Only Azure OpenAI transcribes among the three. Switch the provider above, or use Cloud or Local." },
      meetings: { none: "Only Azure OpenAI transcribes among the three." },
      upload: { none: "Only Azure OpenAI transcribes among the three." },
      cleanup: { model: "anthropic.claude-haiku-4-5", models: ["anthropic.claude-haiku-4-5", "anthropic.claude-sonnet-4-6"], mark: "bedrock" },
      rewrite: { model: "anthropic.claude-sonnet-4-6", models: ["anthropic.claude-sonnet-4-6", "anthropic.claude-haiku-4-5"], mark: "bedrock" },
      translate: { model: "anthropic.claude-sonnet-4-6", models: ["anthropic.claude-sonnet-4-6"], mark: "bedrock" },
      enhance: { model: "anthropic.claude-haiku-4-5", models: ["anthropic.claude-haiku-4-5"], mark: "bedrock" },
      assistant: { model: "anthropic.claude-sonnet-4-6", models: ["anthropic.claude-sonnet-4-6", "anthropic.claude-opus-4-7"], mark: "bedrock" },
    },
  },
};
