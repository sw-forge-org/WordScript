import type { IconName, StatusTone } from "@/components/shell";

/**
 * CONTEXT'S SAMPLE DATA — copied out of `demo.js`, where it is data too.
 *
 * THE OBJECT LIST: one type, five states, four origins. Ordered by time and
 * not by state, because a list that groups by state is a list the reader has to
 * re-learn every time something finishes. What is running is visible because it
 * says so on the row, not because it was hoisted.
 */
export type ContextObject = {
  title: string;
  when: string;
  origin: "calendar" | "meeting" | "upload" | "link" | "dictation";
  sub: string;
  icon: IconName;
  on?: boolean;
  state?: { text: string; tone: StatusTone };
};

export const CTX: ContextObject[] = [
  {
    title: "Acme — quarterly review",
    when: "14:00",
    origin: "calendar",
    sub: "in 2 h · 4 attendees · 3 open from last time",
    icon: "calendar",
    state: { text: "Scheduled", tone: "plan" },
  },
  {
    title: "Product Sync",
    when: "10:30",
    origin: "meeting",
    sub: "Action items from the weekly",
    icon: "users",
    on: true,
  },
  {
    title: "Planning — Q3 scope",
    when: "Now",
    origin: "meeting",
    sub: "08:12 elapsed",
    icon: "users",
    state: { text: "Recording", tone: "danger" },
  },
  {
    title: "acme-call.wav",
    when: "09:58",
    origin: "upload",
    sub: "31.8 MB · 2:14 of 34:18",
    icon: "upload",
    state: { text: "Transcribing", tone: "warning" },
  },
  {
    title: "Ep. 142 — Shipping desktop software",
    when: "09:41",
    origin: "link",
    sub: "youtube.com · resolving stream",
    icon: "link",
    state: { text: "Fetching", tone: "warning" },
  },
  {
    title: "Voice pipeline",
    when: "09:15",
    origin: "meeting",
    sub: "Architecture notes for the runtime",
    icon: "users",
  },
  {
    title: "Settings restructure",
    when: "09:42",
    origin: "dictation",
    sub: "Cleanup · General writing",
    icon: "mic",
  },
  {
    title: "interview-recording.mp3",
    when: "Yest.",
    origin: "upload",
    sub: "413 request_too_large — over the 25 MiB limit",
    icon: "upload",
    state: { text: "Failed", tone: "danger" },
  },
  {
    title: "Weekly standup",
    when: "Yest.",
    origin: "meeting",
    sub: "Sprint progress and blockers",
    icon: "users",
  },
];

export const FOLDERS = [
  { name: "Personal", n: 5 },
  { name: "Meetings", n: 9, on: true },
  { name: "Work", n: 2 },
];

/**
 * TWO KINDS, ONE LIST — ADR 0044, §11.43.
 *
 * An action was one thing: a prompt the assistant runs over this object, right
 * now, producing text. That covers everything the assistant can do and nothing
 * beyond it, and "collect the decisions from these three meetings and open a
 * PR" is a sentence people will write into this box.
 *
 * So an action declares who runs it, and the two kinds differ in every way that
 * matters to the person about to press the button:
 *
 *   assistant   seconds · produces text · no effects · runs on this object
 *   desk        minutes · produces effects · runs somewhere else · confirmed
 *               by key before it starts
 *
 * A desk action is also where the assistant and the desk are visibly not
 * rivals. It BEGINS at the assistant — gathering the material out of the
 * objects is a read, which is exactly what the assistant is allowed to do — and
 * hands over an assembled prompt. The desk never had to search for anything;
 * that is the division of labour the effect line produces.
 */
export type ActionEntry = {
  name: string;
  icon: IconName;
  builtin?: boolean;
  kind: "assistant" | "desk";
  desc: string;
  file: string;
  prompt: string;
  target?: string;
  role?: string;
};

export const ACTIONS: ActionEntry[] = [
  {
    name: "Enhance notes",
    icon: "sparkle",
    builtin: true,
    kind: "assistant",
    desc: "Clean up, structure and enhance what you wrote",
    file: "built-in",
    prompt:
      "Rewrite the note below as clean prose. Keep every fact and every\nnumber. Remove filler and false starts. Do not add anything that is\nnot in the source.",
  },
  {
    name: "Meeting summary",
    icon: "users",
    builtin: true,
    kind: "assistant",
    desc: "Decisions, owners and open questions",
    file: "built-in",
    prompt:
      "From the transcript and notes below, produce: Decisions, Action\nitems with an owner each, and Open questions. Omit a heading that\nwould be empty.",
  },
  {
    name: "Standup from notes",
    icon: "list",
    kind: "assistant",
    desc: "Yesterday, today, blockers",
    file: "_actions/standup-from-notes.md",
    prompt:
      "Turn the note into a standup update with exactly three headings:\nYesterday, Today, Blockers. One line per item. Write nothing under\nBlockers if there are none — omit the heading.",
  },
  {
    name: "Kundenanfrage beantworten",
    icon: "type",
    kind: "assistant",
    desc: "German support reply in the client register",
    file: "_actions/kundenanfrage-beantworten.md",
    prompt:
      "Beantworte die Anfrage unten auf Deutsch, in der Sie-Form.\nFreundlich, knapp, ohne Floskeln. Nenne einen konkreten nächsten\nSchritt. Erfinde keine Zusagen zu Terminen oder Preisen.",
  },
  {
    name: "Turn this into a PR",
    icon: "handoff",
    kind: "desk",
    desc: "Collect the decisions, hand them to the desk, open a pull request",
    file: "_actions/turn-this-into-a-pr.md",
    target: "WordScript",
    role: "work",
    prompt:
      "Read the decisions and tasks on the objects I selected. Write them\nup as a change description, then implement it in the target and open\na pull request. Ask me before touching anything outside src/.",
  },
  {
    name: "Follow up by mail",
    icon: "mail",
    kind: "desk",
    desc: "Draft and send the follow-up to everyone who was in the meeting",
    file: "_actions/follow-up-by-mail.md",
    target: "General",
    role: "work",
    prompt:
      "Take the summary and the open questions from this meeting. Write one\nfollow-up mail per attendee with only the parts that concern them.\nShow me each mail before sending it.",
  },
];
