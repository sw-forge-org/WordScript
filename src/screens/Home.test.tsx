import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { HomeScreen } from "./Home";
import { createAppConfig, createWorkspaceRuntime } from "@/test/factories";
import type { TranscriptionHistoryEntry } from "@/types/history";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => undefined) }));

const invoked = vi.mocked(invoke);

/**
 * Home is still in the gallery, so its fidelity is still measured in
 * `screens.test.tsx`. This is the other half — and the assertion that matters
 * most on this screen is the NEGATIVE one: the decision inbox is not drawn.
 */

const TRIGGER = {
  bindings: [
    {
      label: "capture",
      role: "capture",
      configured: "Ctrl+Super",
      display: "Ctrl + Super",
      registered: true,
      error: null,
      presses: 0,
      releases: 0,
      last_press_ms: null,
      last_release_ms: null,
    },
  ],
};

beforeEach(() => {
  invoked.mockReset();
  invoked.mockImplementation(async (command: string) => {
    if (command === "native_trigger_status") return TRIGGER;
    if (command === "resolve_current_processing_mode") {
      return { mode: "cleanup", auto_detected: false, detected_from: null };
    }
    if (command === "transcription_history_entries") return [];
    if (command === "read_activity_ledger") return { started_on: null, days: {} };
    if (command === "transcription_history_storage_status") return { path: "/tmp/history.json" };
    return undefined;
  });
});

/** A record shaped like one the runtime writes, for the inbox cases below. */
function historyEntry(
  overrides: Partial<TranscriptionHistoryEntry> = {},
): TranscriptionHistoryEntry {
  return {
    id: "e1",
    created_at_ms: Date.now(),
    status: "completed",
    source: "native_pipeline",
    retry_of: null,
    provider: "groq",
    model: null,
    language: null,
    active_profile: "General writing",
    work_mode: null,
    effective_mode: "cleanup",
    title: null,
    transcript_path: null,
    provider_profile: null,
    local_prompt_strength: null,
    local_prompt_carry: null,
    local_beam_size: null,
    local_best_of: null,
    raw_transcript: "roh",
    transformed_transcript: "Der Satz, der nicht ankam.",
    corrected: true,
    applied_rules: [],
    transform_warning: null,
    insert_mode: "direct_paste",
    active_driver: null,
    pasted: true,
    fallback_available: null,
    fallback_reason: null,
    recovery_action: null,
    recovery_message: null,
    clipboard_restore: null,
    error: null,
    audio_path: null,
    fallback_acknowledged: false,
    capture_integrity: null,
    input_level: null,
    ...overrides,
  };
}

/** A record of `words` words whose capture timed itself for `seconds`. */
function timedEntry(
  words: number,
  seconds: number,
  overrides: Partial<TranscriptionHistoryEntry> = {},
): TranscriptionHistoryEntry {
  return historyEntry({
    transformed_transcript: Array.from({ length: words }, (_, i) => `w${i}`).join(" "),
    capture_integrity: {
      wall_seconds: seconds,
      recorded_seconds: seconds,
      missing_ratio: 0,
      verdict: "intact",
    },
    ...overrides,
  });
}

/** The ledger the runtime would hold for a given set of records.
 *
 *  Home's figures come from `core::activity_ledger` and no longer from history,
 *  so a test that only mocks the record list mocks the wrong half. This folds
 *  the same records into the same shape the command returns, which keeps every
 *  assertion below meaning what it says. */
function ledgerFor(entries: TranscriptionHistoryEntry[]) {
  const days: Record<string, unknown> = {};
  for (const entry of entries) {
    if (entry.retry_of) continue;
    const text = entry.transformed_transcript ?? entry.raw_transcript ?? "";
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    if (words === 0) continue;

    const at = new Date(entry.created_at_ms);
    const key = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(
      at.getDate(),
    ).padStart(2, "0")}`;
    const seconds = entry.capture_integrity?.recorded_seconds ?? 0;
    const day = (days[key] ??= {
      dictations: 0,
      words: 0,
      recorded_seconds: 0,
      timed: 0,
      longest_seconds: 0,
    }) as Record<string, number>;

    day.dictations += 1;
    day.words += words;
    if (seconds > 0) {
      day.recorded_seconds += seconds;
      day.timed += 1;
      day.longest_seconds = Math.max(day.longest_seconds, seconds);
    }
  }
  /* The rate histogram the runtime keeps: one bucket per word a minute. The
     median is read off this and not off the day rows, so a mock without it
     mocks the wrong half. */
  const rate_buckets = new Array<number>(400).fill(0);
  for (const entry of entries) {
    if (entry.retry_of) continue;
    const text = entry.transformed_transcript ?? entry.raw_transcript ?? "";
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const seconds = entry.capture_integrity?.recorded_seconds ?? 0;
    if (words === 0 || seconds <= 0) continue;
    rate_buckets[Math.min(Math.floor((words / seconds) * 60), 399)] += 1;
  }
  return { started_on: Object.keys(days).sort()[0] ?? null, days, rate_buckets };
}

/** The base mock with a chosen set of records behind it. */
function mockRuntimeHistory(entries: TranscriptionHistoryEntry[]) {
  invoked.mockImplementation(async (command: string) => {
    if (command === "native_trigger_status") return TRIGGER;
    if (command === "resolve_current_processing_mode") {
      return { mode: "cleanup", auto_detected: false, detected_from: null };
    }
    if (command === "transcription_history_entries") return entries;
    if (command === "read_activity_ledger") return ledgerFor(entries);
    if (command === "transcription_history_storage_status") return { path: "/tmp/history.json" };
    if (command === "transcript_store_status") {
      return { root: "/tmp/WordScript/transcripts", exists: true };
    }
    return undefined;
  });
}

afterEach(cleanup);

describe("Home, wired", () => {
  it("invents no question for the two sources that have no receiver", async () => {
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* ADR 0044's inbox is the one place on this surface where inventing content
       would invent a QUESTION. The desk's and the meeting's rows are drawn in
       the gallery and must never reach the product (ADR 0076). */
    expect(screen.queryByText(/Budget for Q2 headcount/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Should I update the overlay test/)).not.toBeInTheDocument();
  });

  it("says what the activation mode actually does, not what the drawing assumed", async () => {
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* The shipped default is `tap`, and "Release to stop" is true of exactly
       one of the three modes. */
    expect(await screen.findByText("Press in any app to dictate")).toBeInTheDocument();
    expect(screen.queryByText("Hold in any app to dictate")).not.toBeInTheDocument();
  });

  it("keeps the drawing's sentence for the mode the drawing drew", async () => {
    const runtime = createWorkspaceRuntime({
      active: true,
      config: createAppConfig({ activation_mode: "hold" }),
    });
    render(<HomeScreen runtime={runtime} />);

    expect(await screen.findByText("Hold in any app to dictate")).toBeInTheDocument();
    expect(
      screen.getByText("Release to stop. What it produces goes to the cursor you left."),
    ).toBeInTheDocument();
  });

  /**
   * MOVED, NOT DELETED. This case read the 42 px cap block Home opened on, which
   * the activity display replaced — and the shortcut is still displayed, in the
   * fact line, so the assertion follows it there rather than disappearing. What
   * it holds is unchanged and is the reason it exists: the caps are the
   * runtime's RESOLVED display and never the raw token (T9).
   */
  it("shows the trigger the runtime resolved as caps, never the raw token", async () => {
    const { container } = render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await waitFor(() => expect(invoked).toHaveBeenCalledWith("native_trigger_status"));
    const facts = container.querySelector(".ws-hero-facts")!;
    const caps = [...facts.querySelectorAll(".ws-kbd kbd")].map((cap) => cap.textContent);
    expect(caps).toEqual(["Ctrl", "Super"]);
    /* `Ctrl + Super` is the runtime's spelling and `Ctrl+Super` the config's;
       neither may reach a cap with a space inside it. */
    expect(caps.some((cap) => cap !== cap?.trim())).toBe(false);
    /* And the block that used to draw them is gone from the tree entirely.
       Matched on the substring rather than on the class it had, so a cap that
       comes back under any spelling fails here. */
    expect(container.querySelector('[class*="keycap"]')).toBeNull();
  });

  it("states which mode is effective right now from the router, not from the config", async () => {
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await waitFor(() => expect(invoked).toHaveBeenCalledWith("resolve_current_processing_mode"));
    expect(await screen.findByText("Cleanup")).toBeInTheDocument();
  });

  it("lists this machine's last five records rather than the drawing's five", async () => {
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(await screen.findByRole("heading", { name: "Recent · 0" })).toBeInTheDocument();
    expect(
      screen.queryByText("Let’s ship the settings restructure today and review the overlay tab."),
    ).not.toBeInTheDocument();
  });

  it("reads nothing for a view nobody opened", () => {
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: false })} />);
    expect(invoked).not.toHaveBeenCalled();
  });
});

describe("Home, in the gallery", () => {
  it("is the drawing, inbox and all, and reads nothing", () => {
    render(<HomeScreen />);

    expect(screen.getByRole("heading", { name: "Waiting for you · 3" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent · 5" })).toBeInTheDocument();
    expect(screen.getByText("Hold in any app to dictate")).toBeInTheDocument();
    expect(invoked).not.toHaveBeenCalled();
  });

  /* No runtime is no records is no readings, so the gallery gets the
     instruction by the screen's own rule rather than by a branch written for
     it. One implementation, two sources of rows (ADR 0055). */
  it("draws no counter, because it measured nothing to put in one", () => {
    const { container } = render(<HomeScreen />);
    expect(container.querySelector(".ws-home-display")).toBeNull();
    expect(container.querySelector(".ws-counter")).toBeNull();
  });
});

/**
 * THE OPENING BLOCK'S TWO LIVES — the home activity track, decision 7.
 *
 * A zero in a counter does not read as *nothing yet*, it reads as *broken*, so
 * the instruction is the state before the first measured dictation and the
 * display is the state after. What is held here is that rule as much as the
 * arithmetic: no readings, no counters, and no counter carries a figure the
 * runtime did not produce.
 */
describe("Home · the display", () => {
  it("shows a profile with no dictations the instruction, not four zeroes", async () => {
    mockRuntimeHistory([]);
    const { container } = render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByRole("heading", { name: /Recent/ });
    expect(screen.getByText("Press in any app to dictate")).toBeInTheDocument();
    expect(container.querySelector(".ws-home-display")).toBeNull();
  });

  /* The other face of the same defect: records exist, none of them timed
     itself, so there is nothing to display. A display with nothing to display
     is four dark boxes, which reads as broken for the same reason four zeroes
     do. */
  it("keeps the instruction where every record predates the capture clock", async () => {
    mockRuntimeHistory([
      historyEntry({ id: "old", transformed_transcript: "words but no clock at all" }),
    ]);
    const { container } = render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByRole("heading", { name: /Recent/ });
    expect(container.querySelector(".ws-home-display")).toBeNull();
    expect(screen.getByText("Press in any app to dictate")).toBeInTheDocument();
  });

  it("reads words per minute out of the record and drops the instruction", async () => {
    mockRuntimeHistory([timedEntry(400, 120)]);
    const { container } = render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* 400 words in 120 s. */
    expect(await screen.findByLabelText("200 words per minute")).toBeInTheDocument();
    expect(screen.queryByText("Press in any app to dictate")).not.toBeInTheDocument();
    expect(container.querySelector(".ws-home-display")).not.toBeNull();
  });

  /* `capture_integrity` is null on a retry and on every record older than the
     measurement. A rate over a denominator that silently skipped them is a
     plausible wrong number, so the tile states both counts on itself. */
  it("names the SCOPE of each figure and nothing more", async () => {
    /* The foot used to print `1 of 2 runs timed` beside it. That count is a fact
       about the measurement rather than about the reader, and on a home screen
       it is noise — the scope is the part that changes how the number is read. */
    mockRuntimeHistory([
      timedEntry(400, 120, { id: "timed" }),
      historyEntry({ id: "untimed", transformed_transcript: "a retry with no capture" }),
    ]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(await screen.findByText("median · all time")).toBeInTheDocument();
    expect(screen.queryByText(/runs timed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/of 2/)).not.toBeInTheDocument();
  });

  it("marks time saved as an approximation, because its baseline is an assumption", async () => {
    mockRuntimeHistory([timedEntry(400, 120)]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* 400 words at the 40 wpm baseline is 10 minutes of typing; they were said
       in two. The `≈` is on the tile because the baseline was never measured. */
    expect(
      await screen.findByLabelText("About 8 minutes saved in the last four weeks"),
    ).toBeInTheDocument();
    expect(screen.getByText("≈ minutes · last 4 weeks")).toBeInTheDocument();
  });

  it("STATES AN EMPTY WINDOW WHILE THE ALL-TIME RATE SURVIVES IT", async () => {
    const longAgo = Date.now() - 200 * 24 * 60 * 60 * 1000;
    mockRuntimeHistory([timedEntry(400, 120, { created_at_ms: longAgo })]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* The two scopes on one row, and the case exists to hold them apart: the
       rate is all-time and reads two hundred months later; time saved is four
       weeks and has nothing in it, which is a dark display rather than a zero. */
    expect(await screen.findByLabelText("200 words per minute")).toBeInTheDocument();
    expect(screen.getByLabelText("No reading for the last four weeks")).toBeInTheDocument();
    expect(screen.getByText("nothing yet · last 4 weeks")).toBeInTheDocument();
  });

  /**
   * ADR 0161's rule, and the sharpest instance of it on this surface: an
   * invented 3 is worse than a visible gap. The two drawn tiles carry the tag at
   * their own label and light no pixel at all.
   */
  it("draws the one remaining sketch with a tag and no figure whatsoever", async () => {
    mockRuntimeHistory([timedEntry(400, 120)]);
    const { container } = render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByLabelText("200 words per minute");

    /* `Apps` used to stand beside this one and could never work: the target
       application is only resolved where the text is pasted directly, and a
       clipboard delivery has no target to name. It was replaced by Turnaround,
       which is measured at both ends inside the runtime. */
    expect(screen.queryByText("Apps")).not.toBeInTheDocument();

    for (const label of ["Languages"]) {
      const tile = screen.getByText(label).closest(".ws-tile") as HTMLElement;
      expect(tile.querySelector(".ws-ptag"), label).not.toBeNull();
      /* No lit pixel, and the counter says so on itself so the surface can dim
         it. A lit `0` would claim the runtime counted none. */
      expect(tile.querySelector(".ws-counter"), label).toHaveAttribute("data-unlit");
      expect(tile.querySelectorAll(".matrix-pixel-active"), label).toHaveLength(0);
    }

    /* And the two measured tiles carry no tag: the marker is what separates a
       drawing from a reading, so it may not sit on a reading. */
    for (const label of ["Words per minute", "Time saved", "Turnaround"]) {
      const tile = screen.getByText(label).closest(".ws-tile") as HTMLElement;
      expect(tile.querySelector(".ws-ptag"), label).toBeNull();
    }
  });

  it("names what each drawn tile is waiting for, on the tag rather than in the row", async () => {
    mockRuntimeHistory([timedEntry(400, 120)]);
    const { container } = render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByLabelText("200 words per minute");
    const tags = [...container.querySelectorAll(".ws-ptag")].map((tag) => tag.getAttribute("title"));
    /* One left. `Apps` was not wired up, it was retired: the target application
       is unobservable on a clipboard delivery, which is most of them. */
    expect(tags).toHaveLength(1);
    /* The language on a record is the SETTING. A tile counting it today would
       count how often the setting was changed. */
    expect(tags[0]).toContain("not the recognised one");
  });
});

/**
 * THE ONE INBOX SOURCE THAT HAS A RECEIVER (ADR 0076). What is held here is
 * the rule as much as the rendering: nothing is drawn when nothing is owed.
 */
describe("Home · the decision inbox", () => {
  it("draws nothing at all when no delivery fell back", async () => {
    mockRuntimeHistory([historyEntry({ insert_mode: "direct_paste" })]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByRole("heading", { name: /Recent/ });
    expect(screen.queryByRole("heading", { name: /Waiting for you/ })).not.toBeInTheDocument();
  });

  it("asks about a delivery that fell back, and states what doing nothing costs", async () => {
    mockRuntimeHistory([historyEntry({ insert_mode: "clipboard_fallback" })]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(await screen.findByRole("heading", { name: "Waiting for you · 1" })).toBeInTheDocument();
    expect(screen.getByText("One insert fell back to the clipboard")).toBeInTheDocument();
    expect(
      screen.getByText("The text is lost the next time you copy anything."),
    ).toBeInTheDocument();
  });

  /* The scratchpad's cost is a different one, and saying "lost when you copy"
     about it would be wrong in the direction that makes somebody act too late. */
  it("states the scratchpad's own cost rather than the clipboard's", async () => {
    mockRuntimeHistory([historyEntry({ insert_mode: "scratchpad_fallback" })]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(
      await screen.findByText("It is in the scratchpad and goes when the runtime restarts."),
    ).toBeInTheDocument();
  });

  it("stops asking once the record says it was dealt with", async () => {
    mockRuntimeHistory([
      historyEntry({ insert_mode: "clipboard_fallback", fallback_acknowledged: true }),
    ]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByRole("heading", { name: /Recent/ });
    expect(screen.queryByRole("heading", { name: /Waiting for you/ })).not.toBeInTheDocument();
  });

  it("answers the question on the record rather than in this window", async () => {
    mockRuntimeHistory([historyEntry({ insert_mode: "clipboard_fallback" })]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await userEvent.click(await screen.findByRole("button", { name: "Dismiss" }));

    expect(invoked).toHaveBeenCalledWith("acknowledge_transcription_fallback", {
      request: { id: "e1" },
    });
  });
});

/**
 * ONE DERIVATION FOR BOTH LISTS (ADR 0078). Home draws the same records on the
 * same builder, so what a row is called cannot differ between the two screens.
 */
describe("Home · what a row is called", () => {
  it("opens a row with what the model named the record", async () => {
    mockRuntimeHistory([historyEntry({ title: "Der Rebuild und seine Freigabe" })]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(await screen.findByText("Der Rebuild und seine Freigabe")).toBeInTheDocument();
    expect(screen.queryByText("Der Satz, der nicht ankam.")).not.toBeInTheDocument();
  });

  it("falls back to the record's own words where the model never named it", async () => {
    mockRuntimeHistory([historyEntry({ title: null })]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(await screen.findByText("Der Satz, der nicht ankam.")).toBeInTheDocument();
  });

  /* The segment is History's, and its absence here is the decision rather than
     an omission: five rows of the last few minutes is not the surface anybody
     scans for recogniser errors. */
  it("draws no reading segment, because Home is not the scanning surface", async () => {
    mockRuntimeHistory([historyEntry()]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByRole("heading", { name: /Recent/ });
    expect(screen.queryByRole("button", { name: "Heard" })).not.toBeInTheDocument();
  });
});

/**
 * THE OPENING BLOCK'S SECOND VIEW — A5, decision 9.
 *
 * The load-bearing pair here is *the control is the block* and *the choice is
 * written where a restart can find it*. A toggle that only moved local state
 * would pass any test that clicked it and lose the choice on the next launch,
 * which is the failure the sidebar's rail had for a whole leg — so the case
 * asserts the CONFIG WRITE, not the swapped DOM alone.
 */
describe("Home · the two views of the opening block", () => {
  it("shows the counters by default and offers the calendar", async () => {
    mockRuntimeHistory([timedEntry(100, 60)]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(await screen.findByText("Words per minute")).toBeInTheDocument();
    expect(document.querySelector(".ws-cal")).toBeNull();
    expect(screen.getByRole("button", { name: "Show the activity calendar" })).toBeInTheDocument();
  });

  it("draws the calendar instead of the counters when the config says so", async () => {
    mockRuntimeHistory([timedEntry(100, 60)]);
    render(
      <HomeScreen
        runtime={createWorkspaceRuntime({
          active: true,
          config: createAppConfig({ home_activity_calendar: true }),
        })}
      />,
    );

    await waitFor(() => expect(document.querySelector(".ws-cal")).not.toBeNull());
    /* ALTERNATIVES, NOT COMPANIONS (decision 1). Both at once would be the one
       block doing both jobs, which is the arrangement this track undid. */
    expect(screen.queryByText("Words per minute")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show the counters" })).toBeInTheDocument();
  });

  it("WRITES THE CHOICE TO THE CONFIG WHEN THE BLOCK IS CLICKED", async () => {
    const patch = vi.fn();
    mockRuntimeHistory([timedEntry(100, 60)]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true, patch })} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Show the activity calendar" }),
    );
    /* Persisted, not merely swapped: this is the assertion that separates a
       preference from a piece of local state. */
    expect(patch).toHaveBeenCalledWith({ home_activity_calendar: true });
  });

  it("adds no settings row for it — the control is the display", async () => {
    mockRuntimeHistory([timedEntry(100, 60)]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByText("Words per minute");
    expect(screen.queryByRole("switch", { name: /calendar/i })).not.toBeInTheDocument();
  });

  it("keeps the instruction rather than either view when nothing was measured", async () => {
    /* Decision 7 outranks the preference: a profile with no reading sees the
       instruction, and a calendar of nothing but grey is the same defect as
       four zeroes wearing a different face. */
    mockRuntimeHistory([]);
    render(
      <HomeScreen
        runtime={createWorkspaceRuntime({
          active: true,
          config: createAppConfig({ home_activity_calendar: true }),
        })}
      />,
    );

    expect(await screen.findByText(/in any app to dictate/)).toBeInTheDocument();
    expect(document.querySelector(".ws-cal")).toBeNull();
    expect(screen.queryByText("Words per minute")).not.toBeInTheDocument();
  });
});
