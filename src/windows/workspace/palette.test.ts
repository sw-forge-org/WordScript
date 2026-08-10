import { describe, expect, it } from "vitest";
import { PALETTE_INDEX, paletteMatches, paletteTargetsResolve, scorePaletteLabel } from "./palette";

/**
 * THE INDEX AND THE SCORING, WHICH ARE THE PORTED HALF. `demo.js:8031–8366` is
 * the source; what is held here is the count, the grouping, that every place it
 * names is a place this window actually mounts, and the ranking rule the
 * prototype spells out — because a palette whose first row is wrong is one
 * people stop trusting after two tries.
 */

describe("the palette index", () => {
  /* THIRTY-ONE, NOT THE TWENTY-SIX THE RELAY ESTIMATED. Counted off
     `CMDK_INDEX`, and asserted rather than commented so the next leg reading
     the relay's figure finds the correction here. */
  it("carries the prototype's thirty-one entries in its three groups", () => {
    expect(PALETTE_INDEX).toHaveLength(31);
    const counted = PALETTE_INDEX.reduce<Record<string, number>>((all, entry) => {
      all[entry.group] = (all[entry.group] ?? 0) + 1;
      return all;
    }, {});
    expect(counted).toEqual({ "Go to": 12, Settings: 13, Do: 6 });
  });

  /* A row that opens nothing is the fake affordance rule 7 forbids, and
     `runtime.open` opens nothing rather than guessing when it does not
     recognise an id — so an index naming a place this window does not mount
     would fail silently at the one moment it is used. */
  it("names only places this window mounts", () => {
    expect(paletteTargetsResolve()).toBe(true);
  });

  it("keeps the groups contiguous, because the list renders one heading per run", () => {
    const runs = PALETTE_INDEX.map((entry) => entry.group).filter(
      (group, index, all) => group !== all[index - 1],
    );
    expect(runs).toEqual(["Go to", "Settings", "Do"]);
  });
});

describe("the palette's ranking", () => {
  it("puts a prefix above a word start above a substring, and misses at -1", () => {
    expect(scorePaletteLabel("Sound pack", "sound")).toBe(0);
    expect(scorePaletteLabel("Play sound cues", "sound")).toBe(1);
    expect(scorePaletteLabel("Clipboard fallback", "board")).toBe(2);
    expect(scorePaletteLabel("Home", "zzz")).toBe(-1);
  });

  /* The case the prototype names: a plain substring match puts "Sound pack"
     above "Sound cues" for "sound cue" unless position is scored. */
  it("reaches the second word of a two-word label, which is the common case", () => {
    const labels = paletteMatches("cue").map((entry) => entry.label);
    expect(labels[0]).toBe("Play sound cues");
  });

  /* All three score a word start, so the tie is broken by position in the
     index — which is why the array is the prototype's order and not sorted by
     anything. `AI Models` is a place and places come first. */
  it("breaks ties on the index's own order rather than alphabetically", () => {
    const labels = paletteMatches("model").map((entry) => entry.label);
    expect(labels).toEqual(["AI Models", "Speech model", "Cleanup model"]);
  });

  it("shows everything for an empty query, in the prototype's order", () => {
    expect(paletteMatches("").map((entry) => entry.label)).toEqual(
      PALETTE_INDEX.slice(0, 31).map((entry) => entry.label),
    );
  });
});
