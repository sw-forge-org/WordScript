import type { AppConfig } from "@/types/ipc";

/**
 * WHAT IS DRAWN AND NOT BUILT, IN ONE LIST, READ BY EVERY MARKER.
 *
 * The product marks unbuilt work in three shapes — a banner over a screen, a
 * tag beside a row, and a `preview` flag on a nav entry — and every one of them
 * used to be spelled where it was drawn. That is the defect this file takes: a
 * switch implemented as three dozen inline conditions is wrong within one
 * release, because the next preview surface will not know the switch exists.
 *
 * So a preview surface declares itself HERE, once, and the marker components
 * take an id rather than a sentence. `previewSurfaces.test.ts` walks `src/` and
 * fails on a marker spelled outside this list — the instrument shape the model
 * catalogue already has, for the same reason: a rule that lives only in a review
 * comment lasts one release.
 *
 * ## The two kinds, and why the split is the substance
 *
 * Developer Mode off is not "hide the chips". Hiding a caveat while leaving the
 * drawing in the nav is the fake-readiness defect `AGENTS.md` forbids in as many
 * words: a stranger opens Agents, sets something, and nothing happens. So each
 * entry says what OFF does to the thing it marks, and there are exactly two
 * answers:
 *
 * - **`remove`** — the thing does nothing, so off unmounts it. A whole surface
 *   goes with its nav row and its route; a row goes with its control. This is
 *   the honest answer for anything inert, and it is why the flag defaults off.
 * - **`unmark`** — the thing WORKS and the marker only qualifies how completely.
 *   Off keeps it and drops the chip. Home reads four real counters and one
 *   drawn inbox; removing Home would be absurd and marking it forever is the
 *   caveat readers learn to skip.
 *
 * A surface that is wired in part therefore keeps its screen and loses only its
 * marker, while the four that are drawn all the way down leave the nav.
 *
 * ## What this switch may never touch
 *
 * **The gallery.** `src/windows/gallery/` is the acceptance surface for drawn
 * screens and must keep seeing every one of them whatever this says. The filter
 * is the workspace's; the gallery renders the registry's contents and ignores
 * the flag.
 */
export type PreviewId =
  /* Surfaces drawn all the way down — off removes them from the workspace. */
  | "context"
  | "notesettings"
  | "agents"
  | "integrations"
  /* Surfaces wired in part — off keeps them and drops the chip. */
  | "home"
  | "models"
  /* Single rows on an otherwise wired surface — off removes the row. */
  | "activity-other-origins"
  | "privacy-context-objects"
  | "privacy-note-retention"
  | "privacy-copilot"
  | "models-local-lane"
  | "models-your-server-lane"
  | "models-bundled-runner"
  | "models-hold-model-loaded"
  | "models-acceleration"
  | "delivery-agent-bridge"
  /* Surfaces with no door into the workspace at all. They stand in the gallery
     (ADR 0055) and in `ia.tsx`'s `ENTRY_POINT_HOLES`, and they are listed here
     for the same reason the mounted ones are: the day one of them gets a door,
     the filter already covers it, and until then this list is what "drawn and
     not built" MEANS rather than a subset of it. */
  | "onboarding"
  | "onboarding-withheld-lane"
  | "onboarding-bundled-runner"
  | "onboarding-acceleration"
  | "onboarding-shortcut-registered"
  | "meeting"
  | "subtitles"
  | "conversation"
  | "translate"
  | "agent-overlay"
  | "handoff"
  | "commit";

export interface PreviewSurface {
  id: PreviewId;
  /**
   * What it will be, in the product's own voice. This is the sentence the
   * banner prints or the tag carries as its tooltip — moved here unchanged, so
   * that routing a marker through the registry is not also a copy edit.
   */
  says: string;
  /** The chip's word where `Preview` would be the wrong grade. */
  lead?: string;
  /** What Developer Mode OFF does to the thing this marks. See the two kinds. */
  whenOff: "remove" | "unmark";
}

export const PREVIEW_SURFACES: readonly PreviewSurface[] = [
  {
    id: "context",
    says: "Planned for V2, and drawn rather than wired. The context object does not exist in the runtime.",
    whenOff: "remove",
  },
  {
    id: "notesettings",
    says: "Planned for V2, and drawn rather than wired.",
    whenOff: "remove",
  },
  {
    id: "agents",
    says: "Planned for Phase 8, and drawn rather than wired.",
    whenOff: "remove",
  },
  {
    id: "integrations",
    says: "Planned for Phase 8, and drawn rather than wired.",
    whenOff: "remove",
  },
  {
    id: "home",
    says: "All four counters report a measurement. The decision inbox receives a fallen-back delivery and nothing else — the desk (Phase 8) and a meeting's open questions (V2) have no receiver, and the calendar counts dictations only for the same reason.",
    lead: "Wired in part",
    whenOff: "unmark",
  },
  {
    id: "models",
    says: "Wired in part — the accounts, what each job runs on and On this machine are real; the two withheld lanes and the job settings beside the model are drawn and inert.",
    lead: "Wired in part",
    whenOff: "unmark",
  },
  {
    id: "activity-other-origins",
    says: "Neither origin exists yet. A meeting and an upload are recorded objects the context-objects track owns; until one can produce a day, this line states that rather than counting nought of them.",
    whenOff: "remove",
  },
  {
    id: "privacy-context-objects",
    says: "The rule is decided; the collection is not built. Nothing on this machine holds a context object yet.",
    whenOff: "remove",
  },
  {
    id: "privacy-note-retention",
    says: "Drawn on Notes & Meetings and not wired. The default stated here is that screen's own.",
    whenOff: "remove",
  },
  {
    id: "privacy-copilot",
    says: "Decided and not built. The copilot itself is behind roadmap gate 3; this row states the rule it will be bound by when it arrives.",
    whenOff: "remove",
  },
  {
    id: "models-local-lane",
    says: "Built and withheld, not drawn. The runtime carries this lane and On this machine installs for it; what is withheld is OFFERING it, until ROADMAP Phase 5 has finished it — the acceleration probe, whether Ollama ships with WordScript, and streaming.",
    whenOff: "remove",
  },
  {
    id: "models-your-server-lane",
    says: "Drawn, not built. The rows show the shape this lane will have; nothing behind it runs a job yet.",
    whenOff: "remove",
  },
  {
    id: "models-bundled-runner",
    says: "Not built. WordScript ships no Ollama today — no binary is bundled — so only Yours is real.",
    whenOff: "remove",
  },
  {
    id: "models-hold-model-loaded",
    says: "Not built. Nothing reads this toggle and no model is held loaded between dictations.",
    whenOff: "remove",
  },
  {
    id: "models-acceleration",
    says: "Not built. Nothing in the runtime detects CUDA, ROCm or Metal yet, so this badge is a drawing and not a reading of your hardware.",
    whenOff: "remove",
  },
  {
    id: "delivery-agent-bridge",
    says: "Planned for Phase 8. Nothing calls WordScript this way yet, so no dictation takes this route.",
    whenOff: "remove",
  },
  {
    id: "onboarding",
    says: "Planned for Phase 6. The flow's shape and order, not a working setup.",
    whenOff: "remove",
  },
  {
    id: "onboarding-withheld-lane",
    says: "Withheld rather than offered. The lane's own row says which of the two reasons applies.",
    whenOff: "remove",
  },
  {
    id: "onboarding-bundled-runner",
    says: "Not built. WordScript ships no Ollama today — no binary is bundled — so a server you already run is the only real answer.",
    whenOff: "remove",
  },
  {
    id: "onboarding-acceleration",
    says: "Not built. Nothing in the runtime detects CUDA, ROCm or Metal, or reads how much memory this machine has — the badge and the number are a drawing, not a reading of your hardware.",
    whenOff: "remove",
  },
  {
    id: "onboarding-shortcut-registered",
    says: "Not built. The flow registers nothing with the OS, so this badge is a drawing of the answer rather than the answer — the shortcut above is your choice, and whether the desktop accepts it is not known here.",
    whenOff: "remove",
  },
  {
    id: "meeting",
    says: "Planned for V2. No system audio is captured today.",
    whenOff: "remove",
  },
  {
    id: "subtitles",
    says: "Not built. Captions need system-audio capture; the echo needs partial results the pipeline does not emit yet.",
    whenOff: "remove",
  },
  {
    id: "conversation",
    says: "Not built. Uses the meeting window; needs speaker separation on one microphone.",
    whenOff: "remove",
  },
  {
    id: "translate",
    says: "Not built. Shape and rules only; needs a speech model per direction and text-to-speech.",
    whenOff: "remove",
  },
  {
    id: "agent-overlay",
    says: "Planned for Phase 8. This surface exists in no build.",
    whenOff: "remove",
  },
  {
    id: "handoff",
    says: "Planned for Phase 8.",
    whenOff: "remove",
  },
  {
    /* THE ONE STOP IN THE LIST, and it keeps its box and its border because a
       stop is exactly the case that has to interrupt. A screen the plan decided
       against still has to say so on itself, or the next reader builds from it. */
    id: "commit",
    says: "Not a target shape — do not build Phase 3 from this screen. Diagnostics already does this, better, and the decision cannot live in a settings-shaped view.",
    lead: "Withdrawn",
    whenOff: "remove",
  },
] as const;

const BY_ID = new Map<PreviewId, PreviewSurface>(
  PREVIEW_SURFACES.map((entry) => [entry.id, entry]),
);

export function findPreview(id: PreviewId): PreviewSurface {
  const entry = BY_ID.get(id);
  /* Not a soft failure. An id that is not in the list is a marker that escaped
     the registry, and rendering nothing would hide exactly what the registry
     exists to make visible. */
  if (!entry) throw new Error(`unknown preview surface: ${id}`);
  return entry;
}

/** The machine's answer, defaulted where the config predates the field. */
export function developerMode(config: Pick<AppConfig, "developer_mode"> | null | undefined): boolean {
  return config?.developer_mode === true;
}

/**
 * Whether the thing this id marks is on screen at all.
 *
 * True for everything when Developer Mode is on; with it off, true only for the
 * `unmark` kind, whose surface works and whose chip is the only casualty.
 */
export function previewVisible(id: PreviewId, developer: boolean): boolean {
  return developer || findPreview(id).whenOff === "unmark";
}

/** Whether the CHIP is drawn. Only Developer Mode ever shows one. */
export function previewMarked(developer: boolean): boolean {
  return developer;
}
