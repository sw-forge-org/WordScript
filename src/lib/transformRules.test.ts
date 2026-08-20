import { describe, expect, it } from "vitest";

import {
  PROCESSING_MODE_LABELS,
  PROCESSING_MODE_SHORT_LABELS,
} from "./transformRules";
import type { ProcessingMode } from "@/types/ipc";

/** Every mode the runtime has, written out rather than derived from either map
 *  under test — a list that reads its own subject cannot catch a missing row. */
const ALL_MODES: ProcessingMode[] = [
  "auto",
  "verbatim",
  "cleanup",
  "rewrite",
  "translate",
  "agent",
  "prompt_enhance",
];

/** The one entry the pill is allowed to shorten, and why (ADR 0245): the
 *  overlay window is 480px and a pill that outgrows it has its rounded ends
 *  clipped. Anything else that differs is drift. */
const DELIBERATELY_SHORTER: Partial<Record<ProcessingMode, string>> = {
  prompt_enhance: "Enhance",
};

describe("processingModeLabels", () => {
  it("names every mode the runtime can be in", () => {
    for (const mode of ALL_MODES) {
      expect(PROCESSING_MODE_LABELS[mode], mode).toBeTruthy();
      expect(PROCESSING_MODE_SHORT_LABELS[mode], mode).toBeTruthy();
    }
    expect(Object.keys(PROCESSING_MODE_LABELS).sort()).toEqual([...ALL_MODES].sort());
    expect(Object.keys(PROCESSING_MODE_SHORT_LABELS).sort()).toEqual([...ALL_MODES].sort());
  });

  /* The drift this file exists for. The pill carried its own switch, it
     answered `Agent` where every other surface said `Draft`, and nothing
     failed. */
  it("agrees with the pill everywhere the pill is not deliberately shorter", () => {
    for (const mode of ALL_MODES) {
      const expected = DELIBERATELY_SHORTER[mode] ?? PROCESSING_MODE_LABELS[mode];
      expect(PROCESSING_MODE_SHORT_LABELS[mode], mode).toBe(expected);
    }
  });

  /* ADR 0029 renamed the mode because ADR 0030 gives `Agent` to a different
     feature — one reachable by cycling the very same control on the pill. */
  it("never calls the draft mode Agent", () => {
    expect(PROCESSING_MODE_LABELS.agent).toBe("Draft");
    expect(PROCESSING_MODE_SHORT_LABELS.agent).toBe("Draft");
    expect(Object.values(PROCESSING_MODE_LABELS)).not.toContain("Agent");
    expect(Object.values(PROCESSING_MODE_SHORT_LABELS)).not.toContain("Agent");
  });
});
