import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { HomeScreen } from "./Home";
import { createAppConfig, createWorkspaceRuntime } from "@/test/factories";
import type {
  TranscriptionHistoryEntry,
  TranscriptionHistoryQuery,
  TranscriptionHistorySummary,
} from "@/types/history";
import type { LedgerDay } from "@/lib/activity";

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
    if (command === "transcription_history_summaries") return [];
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
/** A record with both clocks on it: the capture window, and the speech window
 *  inside it (ADR 0177). They are equal here unless a case says otherwise, so a
 *  test that does not care about pauses reads the rate it expects. */
function timedEntry(
  words: number,
  seconds: number,
  overrides: Partial<TranscriptionHistoryEntry> = {},
): TranscriptionHistoryEntry {
  const text = Array.from({ length: words }, (_, i) => `w${i}`).join(" ");
  return historyEntry({
    raw_transcript: text,
    transformed_transcript: text,
    capture_integrity: {
      wall_seconds: seconds,
      recorded_seconds: seconds,
      missing_ratio: 0,
      verdict: "intact",
    },
    speech_seconds: seconds,
    ...overrides,
  });
}

/** The ledger the runtime would hold for a given set of records.
 *
 *  Home's figures come from `core::activity_ledger` and no longer from history,
 *  so a test that only mocks the record list mocks the wrong half. This folds
 *  the same records into the same shape the command returns, which keeps every
 *  assertion below meaning what it says. */
function ledgerFor(
  entries: TranscriptionHistoryEntry[],
  /* The language tally is measured by the RUNTIME on the delivered text
     (ADR 0180) and is not a field on the record, so a test that wants one says
     so rather than having it derived from `w0 w1 w2`. */
  languages: Record<string, number> = {},
) {
  const days: Record<string, LedgerDay> = {};
  /* The rate histogram the runtime keeps: one bucket per word a minute, over
     SPOKEN words and SPEECH seconds (ADR 0177). The median is read off this and
     not off the day rows, so a mock without it mocks the wrong half. */
  const rate_buckets = new Array<number>(400).fill(0);
  const turnaround_buckets = new Array<number>(400).fill(0);

  for (const entry of entries) {
    if (entry.retry_of) continue;
    const delivered = entry.transformed_transcript ?? entry.raw_transcript ?? "";
    const words = wordsIn(delivered);
    const spoken = wordsIn(entry.raw_transcript ?? "");
    if (words === 0 && spoken === 0) continue;

    const at = new Date(entry.created_at_ms);
    const key = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(
      at.getDate(),
    ).padStart(2, "0")}`;
    const seconds = entry.capture_integrity?.recorded_seconds ?? 0;
    const speech = entry.speech_seconds ?? 0;
    /* Generated prose is delivered and is not credited against typing
       (ADR 0178) — the runtime decides this from the mode, and so does this. */
    const credited = entry.effective_mode !== "agent" && entry.effective_mode !== "prompt_enhance";
    const day = (days[key] ??= {
      dictations: 0,
      words: 0,
      spoken_words: 0,
      recorded_seconds: 0,
      speech_seconds: 0,
      timed: 0,
      voiced: 0,
      saved_runs: 0,
      saved_words: 0,
      saved_seconds: 0,
      longest_seconds: 0,
    });

    day.dictations += 1;
    day.words += words;
    day.spoken_words += spoken;
    if (seconds > 0) {
      day.recorded_seconds += seconds;
      day.timed += 1;
      day.longest_seconds = Math.max(day.longest_seconds, seconds);
      if (credited && words > 0) {
        day.saved_runs += 1;
        day.saved_words += words;
        day.saved_seconds += seconds;
      }
    }
    if (speech > 0) {
      day.speech_seconds += speech;
      day.voiced += 1;
      if (spoken > 0) rate_buckets[Math.min(Math.floor((spoken / speech) * 60), 399)] += 1;
    }
    if (typeof entry.turnaround_ms === "number") {
      turnaround_buckets[Math.min(Math.floor(entry.turnaround_ms / 25), 399)] += 1;
    }
  }

  /* THE LANGUAGES GO ON A ROW, WHICH IS WHERE THE RUNTIME PUTS THEM (ADR 0244).
     There used to be a lifetime map beside the tiers and the two drifted; the
     tiers are the only counter now, so a fixture that set the map would be
     testing a field no build writes. */
  const oldest = Object.keys(days).sort()[0] ?? "2026-08-16";
  if (Object.keys(languages).length > 0) {
    const host = (days[oldest] ??= {
      dictations: 0,
      words: 0,
      spoken_words: 0,
      recorded_seconds: 0,
      speech_seconds: 0,
      timed: 0,
      voiced: 0,
      saved_runs: 0,
      saved_words: 0,
      saved_seconds: 0,
      longest_seconds: 0,
    });
    host.languages = { ...(host.languages ?? {}), ...languages };
    const named = Object.values(languages).reduce((sum, count) => sum + count, 0);
    if (host.dictations < named) host.dictations = named;
  }

  return {
    started_on: Object.keys(days).sort()[0] ?? null,
    days,
    rate_buckets,
    turnaround_buckets,
  };
}

function wordsIn(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** THE RUNTIME'S OWN DERIVATION (ADR 0240). The cases here write records —
 *  which is what the ledger is folded from — and the list is sent the summary
 *  the runtime would have made of each. Building the row by hand instead would
 *  let a case state a preview its own record could not produce. */
function summaryOf(entry: TranscriptionHistoryEntry): TranscriptionHistorySummary {
  const heard = entry.raw_transcript ?? "";
  const written = entry.transformed_transcript ?? heard;
  return {
    id: entry.id,
    created_at_ms: entry.created_at_ms,
    status: entry.status,
    source: entry.source,
    retry_of: entry.retry_of,
    provider: entry.provider,
    model: entry.model,
    active_profile: entry.active_profile,
    processing_mode: entry.work_mode?.processing_mode ?? null,
    title: entry.title,
    transcript_path: entry.transcript_path,
    corrected: entry.corrected,
    applied_rules: entry.applied_rules,
    transform_warning: entry.transform_warning,
    insert_mode: entry.insert_mode,
    pasted: entry.pasted,
    fallback_reason: entry.fallback_reason,
    fallback_acknowledged: entry.fallback_acknowledged,
    error: entry.error,
    audio_path: entry.audio_path,
    capture_integrity: entry.capture_integrity,
    capture_stop_reason: entry.capture_stop_reason ?? null,
    heard_preview: heard.trim().slice(0, 160),
    written_preview: written.trim().slice(0, 160),
    transcripts_identical: heard === written,
  };
}

/** The base mock with a chosen set of records behind it. */
function mockRuntimeHistory(
  entries: TranscriptionHistoryEntry[],
  languages: Record<string, number> = {},
) {
  invoked.mockImplementation(async (command: string, args?: unknown) => {
    if (command === "transcription_history_record") {
      const id = (args as { id?: string } | undefined)?.id;
      return entries.find((entry) => entry.id === id) ?? null;
    }
    if (command === "native_trigger_status") return TRIGGER;
    if (command === "resolve_current_processing_mode") {
      return { mode: "cleanup", auto_detected: false, detected_from: null };
    }
    /* THE MOCK HONOURS THE QUERY, AND IT HAS TO SINCE ADR 0243. Home asks two
       narrow questions of this command instead of one wide one — five rows, and
       the fallbacks nobody has answered for — so a stub that ignored the query
       would hand the owed list every record on the machine and the inbox would
       draw for records that never fell back. Filtering here is what makes these
       cases stand in for the runtime rather than for an old shape of it. */
    if (command === "transcription_history_summaries") {
      const query = (args as { query?: TranscriptionHistoryQuery } | undefined)?.query ?? {};
      let rows = entries;
      if (query.owed_fallback_only) {
        rows = rows.filter(
          (entry) =>
            !entry.fallback_acknowledged &&
            (entry.insert_mode === "clipboard_fallback" ||
              entry.insert_mode === "scratchpad_fallback"),
        );
      }
      if (query.limit !== undefined) rows = rows.slice(0, query.limit);
      return rows.map(summaryOf);
    }
    if (command === "read_activity_ledger") return ledgerFor(entries, languages);
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

  /**
   * ADR 0186. The row read `Next dictation runs as Cleanup · Founder ops notes
   * on Cleanup` — the same word twice, and a third of a line spent saying
   * nothing. The profile keeps its mode only where the mode is a SECOND fact.
   */
  it("names the mode once when the profile and the router agree on it", async () => {
    const config = createAppConfig();
    config.text_profiles = config.text_profiles.map((profile) =>
      profile.id === "general"
        ? ({
            ...profile,
            work_mode: { ...profile.work_mode, processing_mode: "cleanup" },
          } as typeof profile)
        : profile,
    );
    const { container } = render(
      <HomeScreen runtime={createWorkspaceRuntime({ active: true, config })} />,
    );

    await waitFor(() => expect(invoked).toHaveBeenCalledWith("resolve_current_processing_mode"));
    const facts = container.querySelector(".ws-hero-facts")!;
    await waitFor(() => expect(facts).toHaveTextContent("Next dictation runs as Cleanup"));
    expect(facts).toHaveTextContent("General writing");
    expect(facts).not.toHaveTextContent("on Cleanup");
  });

  /* …and where they disagree it is the one thing on the row worth reading: the
     profile asks for Auto, the router resolved Cleanup. */
  it("keeps the profile's own mode where it differs from the effective one", async () => {
    const { container } = render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await waitFor(() => expect(invoked).toHaveBeenCalledWith("resolve_current_processing_mode"));
    const facts = container.querySelector(".ws-hero-facts")!;
    await waitFor(() => expect(facts).toHaveTextContent("General writing on Auto"));
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

  /* THE GATE IS THE RECORD AND NOT ANY ONE TILE (ADR 0177's correction). It
     was `wordsPerMinute !== null` until the rate became a speaking rate — and
     every record written before the speech clock existed has none, so an
     installation with months of dictation behind it was shown the instruction
     again, as if it had never started. A tile with no reading of its own draws a
     dark display; a reader with no dictations at all gets the instruction. */
  it("shows the display to a record that has something to say, whatever any one tile knows", async () => {
    mockRuntimeHistory([
      historyEntry({ id: "old", transformed_transcript: "words but no clock at all" }),
    ]);
    const { container } = render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByRole("heading", { name: /Recent/ });
    expect(container.querySelector(".ws-home-display")).not.toBeNull();
    expect(screen.queryByText("Press in any app to dictate")).not.toBeInTheDocument();
    /* And the rate says it has nothing rather than inventing one. */
    expect(screen.getByLabelText("No speaking rate measured yet")).toBeInTheDocument();
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

    /* The foot names the scope and the count it was read off: one of the two
       records carried the speech clock, and the median is that one run. A foot
       that said `all time` alone would let a reader take a single run for a
       settled figure. */
    expect(await screen.findByText("median · 1 dictations")).toBeInTheDocument();
    expect(screen.queryByText(/runs timed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/of 2/)).not.toBeInTheDocument();
  });

  it("marks time saved as an approximation, because its baseline is an assumption", async () => {
    mockRuntimeHistory([timedEntry(400, 120)]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* 400 words at the 40 wpm baseline is 10 minutes of typing; they were said
       in two. The `≈` is on the tile because the baseline was never measured.

       AND THE SPAN IS ONE DAY, SO THE FOOT SAYS SO (ADR 0233). This record was
       written today; the window is still four weeks wide and the record reaches
       over exactly one of its days, which are two different claims and only one
       of them is what a reader takes the figure for. */
    expect(await screen.findByLabelText("About 8 minutes saved today")).toBeInTheDocument();
    const tile = screen.getByText("Time saved").closest(".ws-tile") as HTMLElement;
    expect(tile).toHaveTextContent("≈ minutes · today");
    /* ADR 0182: the baseline is UNDER the figure and not behind a hover. It is
       not context about this reading — it is the divisor, and the same four
       weeks read 43 minutes at 40 wpm and 15 at 60. */
    expect(tile).toHaveTextContent("vs 40 wpm typing");
    /* ADR 0186 moved the hover onto the tile; what it may not say is unchanged. */
    expect(tile.getAttribute("title")).not.toMatch(/40 wpm/);
  });

  /**
   * THE RAMP (ADR 0233). The complaint that opened this: a three-day-old record
   * reporting `last 4 weeks`, which is true of the window and false of what the
   * reader takes from it. The label counts the days the record reaches over and
   * settles on the window once it gets there — it does NOT reset the sum, which
   * was the alternative and would drop the counter to nothing every 28 days.
   */
  it("names the days the record reaches over while it is younger than the window", async () => {
    const day = 24 * 60 * 60 * 1000;
    mockRuntimeHistory([
      timedEntry(400, 120, { id: "a", created_at_ms: Date.now() - 2 * day }),
      timedEntry(400, 120, { id: "b", created_at_ms: Date.now() }),
    ]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const tile = (await screen.findByText("Time saved")).closest(".ws-tile") as HTMLElement;
    expect(tile).toHaveTextContent("≈ minutes · last 3 days");
    expect(tile).not.toHaveTextContent("last 4 weeks");
  });

  /**
   * THE UNIT CLIMBS BEFORE THE COUNTER RUNS OUT OF ROOM (ADR 0233). Four weeks of
   * the owner's own dictation is a four-digit count of minutes — a number the
   * counter would draw honestly and nobody could read. The tile is the wiring
   * check; the ladder's own thresholds are tested in `lib/activity`.
   */
  it("reads in hours once minutes stop being something a reader can hold", async () => {
    /* 8,000 words at the 40 wpm baseline is 200 minutes of typing, less the two
       spent dictating them. */
    mockRuntimeHistory([timedEntry(8000, 120)]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(await screen.findByLabelText("About 3.3 hours saved today")).toBeInTheDocument();
    const tile = screen.getByText("Time saved").closest(".ws-tile") as HTMLElement;
    expect(tile).toHaveTextContent("≈ hours · today");
  });

  it("STATES AN EMPTY WINDOW WHILE THE ALL-TIME RATE SURVIVES IT", async () => {
    const longAgo = Date.now() - 200 * 24 * 60 * 60 * 1000;
    mockRuntimeHistory([timedEntry(400, 120, { created_at_ms: longAgo })]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* The two scopes on one row, and the case exists to hold them apart: the
       rate is all-time and reads two hundred months later; time saved is four
       weeks and has nothing in it, which is a dark display rather than a zero. */
    expect(await screen.findByLabelText("200 words per minute")).toBeInTheDocument();
    /* The span settled at the window two hundred days ago, so this is the one
       reading where `last 4 weeks` is the whole truth: four weeks of record with
       nothing in them (ADR 0233). */
    expect(screen.getByLabelText("No reading for the last 4 weeks")).toBeInTheDocument();
    expect(screen.getByText("nothing yet · last 4 weeks")).toBeInTheDocument();
  });

  /**
   * ADR 0161's rule, and the sharpest instance of it on this surface: an
   * invented 3 is worse than a visible gap. The two drawn tiles carry the tag at
   * their own label and light no pixel at all.
   */
  /**
   * NOT ONE TILE ON THIS ROW IS A SKETCH ANY MORE (ADR 0180). `Apps` was retired
   * because the target application is unobservable on a clipboard delivery, and
   * `Languages` carried a tag while the plan was to pass the provider's
   * `response.language` through — which would never have arrived on the two
   * lanes this product runs on. It is measured on the delivered text now.
   */
  it("carries no preview tag at all, because every tile reports a measurement", async () => {
    mockRuntimeHistory([timedEntry(400, 120)], { de: 30, en: 4 });
    const { container } = render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByLabelText("200 words per minute");
    expect(screen.queryByText("Apps")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".ws-ptag")).toHaveLength(0);

    for (const label of ["Words per minute", "Time saved", "Turnaround", "Languages"]) {
      const tile = screen.getByText(label).closest(".ws-tile") as HTMLElement;
      expect(tile.querySelector(".ws-ptag"), label).toBeNull();
    }
  });

  /* ADR 0180. The tile counts what came BACK, and names the languages under the
     figure so a `2` is not a number the reader has to interpret. */
  it("counts the languages the text came back in, most-used first", async () => {
    mockRuntimeHistory([timedEntry(400, 120)], { de: 30, en: 4, sv: 1 });
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(await screen.findByLabelText("3 languages dictated")).toBeInTheDocument();
    /* THE FOOT NAMES ONE AND SAYS HOW MUCH OF THE RECORD IT IS. Ten languages
       on one line is a smear, and the figure above already says how many there
       are — what it cannot say is which one the reader actually works in, and
       whether that is nine dictations in ten or six. Named through
       `Intl.DisplayNames`, so a language this product does not translate
       between is still a name rather than a code.

       30 of 35 MEASURED runs, not of the dictations: a text too short to be
       sure of is in no language bucket at all (ADR 0180), and dividing by the
       day count would drop the share every time somebody dictates a sentence. */
    expect(screen.getByText("mostly German · 86 %")).toBeInTheDocument();
    /* ADR 0182: the hover says where the figure comes from and states no
       reading of its own. ADR 0186: it hangs on the tile, so it answers over
       the figure and the foot as well as over the label. */
    const tile = screen.getByText("Languages").closest(".ws-tile") as HTMLElement;
    expect(tile.getAttribute("title")).toMatch(/Measured on the text/);
    expect(tile.getAttribute("title")).not.toMatch(/German/);
    expect(tile.querySelector(".ws-tile-label")?.getAttribute("title")).toBeNull();
  });

  /**
   * THE DEFECT ADR 0186 IS NAMED FOR. The record held 107 dictations and 67
   * language readings; the tile said `only German` to somebody who had also
   * dictated in English, and they reported the measurement as broken. It was
   * not — the two English runs were five words and one, and nothing can name a
   * language from that. The sentence was what lied.
   */
  it("does not claim one language exclusively while runs went unread", async () => {
    mockRuntimeHistory(
      [timedEntry(400, 120, { id: "a" }), timedEntry(200, 60, { id: "b" }), timedEntry(100, 30, { id: "c" })],
      { de: 2 },
    );
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByLabelText("1 languages dictated");
    const tile = screen.getByText("Languages").closest(".ws-tile") as HTMLElement;
    expect(tile).toHaveTextContent("German");
    expect(tile).not.toHaveTextContent("only German");
    /* The basis, under the figure where ADR 0182 puts it: two of the three
       dictations could be read, and the third is why the tile says `1`. */
    expect(tile).toHaveTextContent("measured on 2 of 3");
  });

  /* The same shortfall beside a second language: the share stays against the
     runs that WERE read (ADR 0180), and the count underneath says how many
     that was. */
  it("counts the share against the measured runs and states how many they were", async () => {
    mockRuntimeHistory(
      [timedEntry(400, 120, { id: "a" }), timedEntry(200, 60, { id: "b" }), timedEntry(100, 30, { id: "c" })],
      { de: 1, en: 1 },
    );
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByLabelText("2 languages dictated");
    const tile = screen.getByText("Languages").closest(".ws-tile") as HTMLElement;
    expect(tile).toHaveTextContent("mostly German · 50 %");
    expect(tile).toHaveTextContent("measured on 2 of 3");
  });

  /* One language is not "mostly" anything, and a `100 %` beside a figure that
     says `2` would have the tile contradicting itself (ADR 0182). */
  it("says only, not mostly, where one language is the whole record", async () => {
    mockRuntimeHistory([timedEntry(400, 120)], { de: 12 });
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(await screen.findByText("only German")).toBeInTheDocument();
  });

  it("never rounds the share up to a hundred while a second language exists", async () => {
    mockRuntimeHistory([timedEntry(400, 120)], { de: 499, en: 1 });
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* 99.8 % rounds to 100, and the figure above says two. The cap keeps the
       two halves of the tile agreeing. */
    expect(await screen.findByText("mostly German · 99 %")).toBeInTheDocument();
  });

  /* A counter with no reading is dark rather than zero (ADR 0161), and that
     holds for the newest measurement on the row as much as for the oldest. */
  it("draws no language figure at all until something has been measured", async () => {
    mockRuntimeHistory([timedEntry(400, 120)]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByLabelText("200 words per minute");
    const tile = screen.getByText("Languages").closest(".ws-tile") as HTMLElement;
    expect(tile.querySelector(".ws-counter")).toHaveAttribute("data-unlit");
    expect(tile.querySelectorAll(".matrix-pixel-active")).toHaveLength(0);
    expect(screen.getByText("from your next dictation")).toBeInTheDocument();
  });
});

/**
 * HOME'S ROWS ARE HISTORY'S ROWS (ADR 0078), AND THE CUT IS WHERE THAT COMES
 * APART. Since ADR 0240 the list is sent a 160-character preview of each
 * transcript; the first build fetched the whole record when a row was opened on
 * History and not on Home, so the same disclosure showed the whole dictation on
 * one screen and a silent truncation of it on the other.
 */
describe("Home · the raw panel", () => {
  it("shows the whole dictation, not the row's cut of it", async () => {
    /* Swedish, on the same argument the Rust preview test uses German: the cut
       is a rule about characters, and a suite that only ever states it in one
       language is stating it about one corpus. */
    const heard = "ett två tre fyra fem sex sju åtta nio tio ".repeat(6).trim();
    mockRuntimeHistory([
      historyEntry({
        id: "long",
        title: "En lång diktering",
        raw_transcript: heard,
        transformed_transcript: heard,
      }),
    ]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByRole("heading", { name: /Recent/ });
    await userEvent.click(await screen.findByRole("button", { name: "View raw transcript" }));

    /* The whole text, both columns — the summary carried 160 characters of it
       and `transcription_history_record` carries the rest. */
    expect(heard.length).toBeGreaterThan(160);
    await waitFor(() => expect(screen.getAllByText(heard)).toHaveLength(2));
    expect(screen.queryByText(heard.slice(0, 160))).not.toBeInTheDocument();
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

  /**
   * ADR 0184. The dots were `aria-hidden` decoration, so the only way to change
   * the view was to guess that a block of read-outs is clickable. They are two
   * buttons now — and buttons that SELECT rather than toggle, because with
   * exactly two views "go to the calendar" is a shorter thought than "go to the
   * other one", and pressing the one you are on should do nothing.
   */
  it("changes the view from the dots, without needing anyone to guess the block is a button", async () => {
    const patch = vi.fn();
    mockRuntimeHistory([timedEntry(100, 60)]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true, patch })} />);

    const calendar = await screen.findByRole("button", { name: "Activity calendar" });
    expect(calendar).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Counters" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await userEvent.click(calendar);
    expect(patch).toHaveBeenCalledWith({ home_activity_calendar: true });
  });

  it("writes the view it names rather than flipping, so the dot you are on is a no-op", async () => {
    const patch = vi.fn();
    mockRuntimeHistory([timedEntry(100, 60)]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true, patch })} />);

    await userEvent.click(await screen.findByRole("button", { name: "Counters" }));
    /* Already on the counters: the write says so rather than bouncing the
       reader into the calendar. */
    expect(patch).toHaveBeenCalledWith({ home_activity_calendar: false });
  });

  /**
   * ADR 0186. The hover belongs to the TILE and not to its label: the label is
   * one line of small caps at the top of a narrow column, and a reader pointing
   * at the figure — the thing they are asking about — used to get nothing at
   * all, which is what "the tooltips do not work" meant.
   */
  it("explains every counter from anywhere on it, not from its label alone", async () => {
    mockRuntimeHistory([timedEntry(400, 120)], { de: 30, en: 4 });
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByText("Words per minute");
    for (const label of ["Words per minute", "Time saved", "Turnaround", "Languages"]) {
      const tile = screen.getByText(label).closest(".ws-tile") as HTMLElement;
      expect(tile.getAttribute("title"), label).toBeTruthy();
      expect(tile.querySelector(".ws-tile-label")?.getAttribute("title"), label).toBeNull();
    }
  });

  /**
   * THE TILE'S CLICK CHANGED HANDS (ADR 0235). It used to fall through to the
   * swap layer, which was ADR 0186's correction; a tile now opens its own view
   * of the block, and the swap keeps everything else — the margins, the foot,
   * the space around the grid — plus the dots, which were made the real control
   * for this in ADR 0184.
   *
   * BOTH HALVES ARE ONE CASE ON PURPOSE. The failure this guards against is a
   * tile that opens the detail AND swaps the view on the way, which is what a
   * bubbling click does and what it did in the first build of this.
   */
  it("opens the metric from its tile without swapping the view underneath", async () => {
    const patch = vi.fn();
    mockRuntimeHistory([timedEntry(100, 60)]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true, patch })} />);

    const tile = (await screen.findByText("Turnaround")).closest(".ws-tile") as HTMLElement;
    await userEvent.click(tile);

    expect(patch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Turnaround/ })).toBeInTheDocument();
    expect(document.querySelector(".ws-home-display")).toBeNull();
  });

  /* THE BACKGROUND IS STILL THE SWAP, which is the half of decision 9 the detail
     view had to leave standing. */
  it("still swaps the view from the space around the counters", async () => {
    const patch = vi.fn();
    mockRuntimeHistory([timedEntry(100, 60)]);
    const { container } = render(
      <HomeScreen runtime={createWorkspaceRuntime({ active: true, patch })} />,
    );

    await screen.findByText("Turnaround");
    await userEvent.click(container.querySelector(".ws-home-switch-body") as HTMLElement);
    expect(patch).toHaveBeenCalledWith({ home_activity_calendar: true });
  });

  /* AND NEITHER IS THE DOT, WHICH IS THE HALF THE FIRST BUILD LEFT OPEN
     (ADR 0236). The background stopped swapping under an open metric and the
     dots did not, so the one control still standing took the reader from a chart
     straight to the calendar — a jump out of a view they had drilled into, with
     nothing saying what happened to it. Disabling them was then the SECOND half
     left open: the owner reported the pair still sitting under the chart as an
     offer, because a lit dot with an unlit twin reads as a choice however inert
     it is. So they go — off the screen and out of the accessibility tree, with
     their space held, because this row is the last thing on the block. */
  it("takes its view dots off the screen inside a metric, without moving it", async () => {
    const patch = vi.fn();
    mockRuntimeHistory([timedEntry(100, 60)]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true, patch })} />);

    const tile = (await screen.findByText("Turnaround")).closest(".ws-tile") as HTMLElement;
    await userEvent.click(tile);

    expect(screen.queryByRole("button", { name: "Activity calendar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Counters" })).toBeNull();

    /* Still in the document, and still holding its height — hidden is not
       unmounted, or the chart above would jump by the row's height. */
    const dots = document.querySelector(".ws-home-dots") as HTMLElement;
    expect(dots).not.toBeNull();
    expect(dots.hasAttribute("data-parked")).toBe(true);
    expect(dots.querySelectorAll("button:disabled")).toHaveLength(2);

    /* And the view behind is where it was: nothing reached the patch. */
    expect(patch).not.toHaveBeenCalled();
    expect(document.querySelector(".ws-metric")).not.toBeNull();
  });

  /* AND THE WAY BACK IS A CONTROL, because the background is not one here: a
     click on the white space beside a chart would otherwise take the reader to
     the calendar, which is not where they were. */
  it("comes back from a metric to the counters", async () => {
    mockRuntimeHistory([timedEntry(100, 60)]);
    render(<HomeScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const tile = (await screen.findByText("Languages")).closest(".ws-tile") as HTMLElement;
    await userEvent.click(tile);
    await userEvent.click(screen.getByRole("button", { name: /Languages/ }));

    expect(document.querySelector(".ws-home-display")).not.toBeNull();
    expect(document.querySelector(".ws-metric")).toBeNull();
  });

  /**
   * ADR 0183's defect, which the layer that catches those clicks must not bring
   * back: the calendar's own controls bubble through the same element, and a
   * handler that fired for them would swap the view on every arrow press.
   */
  it("does not swap the view when the calendar's own controls are pressed", async () => {
    const patch = vi.fn();
    mockRuntimeHistory([timedEntry(100, 60)]);
    render(
      <HomeScreen
        runtime={createWorkspaceRuntime({
          active: true,
          patch,
          config: createAppConfig({ home_activity_calendar: true }),
        })}
      />,
    );

    await waitFor(() => expect(document.querySelector(".ws-cal")).not.toBeNull());
    /* The guard is the attribute: no `data-swaps`, no handler on the layer the
       calendar's controls bubble through. */
    expect(document.querySelector(".ws-home-switch-body")).not.toHaveAttribute("data-swaps");

    const cell = document.querySelector(".ws-cal-cell") as HTMLElement;
    await userEvent.click(cell);
    expect(patch).not.toHaveBeenCalled();
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
