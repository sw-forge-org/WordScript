import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { HistoryScreen, badgesFor, historyTime, rawOf } from "./History";
import { createAppConfig, createWorkspaceRuntime } from "@/test/factories";
import type { TranscriptionHistoryEntry } from "@/types/history";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => undefined) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn() }));

const invoked = vi.mocked(invoke);

/**
 * WHAT A PARTLY WIRED SCREEN'S TEST IS FOR. History is still in the gallery, so
 * its fidelity is still measured in `screens.test.tsx` against the drawing.
 * This file is the other half: which facts come from the runtime, which
 * controls act, and that the two that cannot are inert rather than absent.
 */

function entry(overrides: Partial<TranscriptionHistoryEntry> = {}): TranscriptionHistoryEntry {
  return {
    id: "e1",
    created_at_ms: Date.now(),
    status: "completed",
    source: "native_pipeline",
    retry_of: null,
    provider: "groq",
    model: "whisper-large-v3",
    language: null,
    active_profile: "General writing",
    work_mode: {
      rewrite_style: "clean",
      insert_behavior: "auto_paste",
      recovery_behavior: "standard",
      processing_mode: "cleanup",
    },
    effective_mode: "cleanup",
    title: "Die Umstrukturierung der Einstellungen",
    transcript_path: "/tmp/transcripts/2026/08/10-0942-e1.md",
    fallback_acknowledged: false,
    capture_integrity: null,
    input_level: null,
    provider_profile: null,
    local_prompt_strength: null,
    local_prompt_carry: null,
    local_beam_size: null,
    local_best_of: null,
    raw_transcript: "lets ship the settings restructure today",
    transformed_transcript: "Let's ship the settings restructure today.",
    corrected: true,
    applied_rules: [],
    transform_warning: null,
    insert_mode: "direct_paste",
    active_driver: "wl_copy",
    pasted: true,
    fallback_available: null,
    fallback_reason: null,
    recovery_action: null,
    recovery_message: null,
    clipboard_restore: null,
    error: null,
    audio_path: null,
    ...overrides,
  };
}

function mockRuntimeHistory(entries: TranscriptionHistoryEntry[]) {
  invoked.mockImplementation(async (command: string) => {
    if (command === "transcription_history_entries") return entries;
    if (command === "transcription_history_storage_status") {
      return { path: "/home/f/.local/share/wordscript/history.json" };
    }
    if (command === "transcript_store_status") {
      return { root: "/home/f/WordScript/transcripts", exists: true };
    }
    return undefined;
  });
}

beforeEach(() => {
  invoked.mockReset();
  mockRuntimeHistory([entry()]);
});

afterEach(cleanup);

describe("History, wired", () => {
  it("reads nothing for a view nobody opened", () => {
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: false })} />);
    expect(invoked).not.toHaveBeenCalled();
  });

  it("lists this machine's records rather than the drawing's seven", async () => {
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await waitFor(() => expect(invoked).toHaveBeenCalledWith("transcription_history_entries", expect.anything()));
    /* The row opens with what the model named it (ADR 0078). */
    expect(await screen.findByText("Die Umstrukturierung der Einstellungen")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "1 transcription" })).toBeInTheDocument();
    /* The drawing's rows are the gallery's and must not leak onto the product. */
    expect(screen.queryByText("Consolidate insert recovery into a single home.")).not.toBeInTheDocument();
  });

  it("says the list is empty instead of drawing seven records that are not there", async () => {
    mockRuntimeHistory([]);
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(
      await screen.findByText("Nothing has been transcribed on this machine yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "0 transcriptions" })).toBeInTheDocument();
  });

  it("reveals a record's own file, on the path the record names", async () => {
    const user = userEvent.setup();
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const reveal = await screen.findByRole("button", { name: "Show in file manager" });
    expect(reveal).toBeEnabled();
    await user.click(reveal);

    expect(invoked).toHaveBeenCalledWith("reveal_transcript_in_file_manager", {
      request: { path: "/tmp/transcripts/2026/08/10-0942-e1.md" },
    });
  });

  /* ADR 0074: the one record that has no file is one that produced no text.
     ADR 0065 then applies unchanged — drawn, disabled, reason on the control —
     which is the shape Retry already has on a record with no audio. */
  it("disables the reveal on a record that produced no text, with the reason on it", async () => {
    mockRuntimeHistory([entry({ status: "empty", transformed_transcript: null, transcript_path: null })]);
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const reveal = await screen.findByRole("button", {
      name: /Show in file manager — this run produced no text/,
    });
    expect(reveal).toBeDisabled();
  });

  it("states the folder of Markdown files again, because ADR 0074 built it", async () => {
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(
      await screen.findByText(/Every transcript is a Markdown file in \/home\/f\/WordScript\/transcripts/),
    ).toBeInTheDocument();
    /* The index is still named, because it is where a retry reads from. */
    expect(
      screen.getByText(/indexed in \/home\/f\/.local\/share\/wordscript\/history.json/),
    ).toBeInTheDocument();
  });

  it("takes both retention numbers from the config rather than from the drawing", async () => {
    const runtime = createWorkspaceRuntime({
      active: true,
      config: createAppConfig({ history_retention_days: 30, history_limit: 50 }),
    });
    render(<HistoryScreen runtime={runtime} />);

    expect(await screen.findByText(/Kept 30 days, capped at 50 entries/)).toBeInTheDocument();
  });

  it("deletes and retries through the runtime's own commands", async () => {
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(invoked).toHaveBeenCalledWith("delete_transcription_history_entry", {
        request: { id: "e1" },
      }),
    );
  });

  /* THE RUNTIME'S RULE, NOT HALF OF IT. `retry_transcription_history_entry`
     re-runs the transform when the record holds a raw transcript and only needs
     the kept capture when it does not. A successful run deletes its audio, so
     disabling on `audio_path` alone greyed the control out on every completed
     record while the runtime would have re-run any of them. */
  it("retries a record that kept its transcript, with no audio left", async () => {
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(retry).toBeEnabled();
  });

  it("refuses only where there is neither a transcript nor a recording", async () => {
    mockRuntimeHistory([entry({ raw_transcript: null, transformed_transcript: null, audio_path: null })]);
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const dead = await screen.findByRole("button", {
      name: "Retry — no transcript and no recording left to re-run",
    });
    expect(dead).toBeDisabled();
  });

  it("offers Restore to cursor only where the text did not reach the cursor", async () => {
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    expect(screen.queryByRole("button", { name: "Restore to cursor" })).not.toBeInTheDocument();

    cleanup();
    mockRuntimeHistory([entry({ insert_mode: "clipboard_fallback", pasted: false })]);
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    expect(await screen.findByRole("button", { name: "Restore to cursor" })).toBeInTheDocument();
  });

  it("unfolds the two texts and names the file the record was written to", async () => {
    const { container } = render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await userEvent.click(await screen.findByRole("button", { name: "View raw transcript" }));
    expect(screen.getByText("lets ship the settings restructure today")).toBeInTheDocument();
    expect(container.querySelector(".ws-raw-path")).toHaveTextContent(
      "/tmp/transcripts/2026/08/10-0942-e1.md",
    );
  });

  /* THE THREE THAT CAME OFF THE FIDELITY SUITE when this screen left the
     gallery. A retired screen has no measurement left (Leg 4c did the same for
     Hotkeys), so what they hold moves here rather than being dropped. */
  it("filters on a toolbar, with two controls rather than the shipped three", async () => {
    const { container } = render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await screen.findByText("Die Umstrukturierung der Einstellungen");

    const toolbar = container.querySelector(".ws-toolbar") as HTMLElement;
    expect(within(toolbar).getByPlaceholderText("Search transcripts…")).toBeInTheDocument();
    expect(within(toolbar).getByLabelText("Status")).toBeInTheDocument();
    /* The "Errors only" toggle is gone: the select already has Failed, so two
       controls narrowed the list to the same set and could contradict. */
    expect(within(toolbar).queryByRole("switch")).not.toBeInTheDocument();
  });

  it("carries the pairing with Privacy & Data as a note, not as a second rule", async () => {
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    expect(
      await screen.findByRole("link", { name: "Change the rule in Privacy & Data" }),
    ).toBeInTheDocument();
  });

  it("narrows the list through the runtime's query rather than in the browser", async () => {
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await screen.findByText("Die Umstrukturierung der Einstellungen");

    await userEvent.selectOptions(screen.getByLabelText("Status"), "failed");
    await waitFor(() =>
      expect(invoked).toHaveBeenCalledWith("transcription_history_entries", {
        query: { status: "failed" },
      }),
    );
    /* And the heading says which set it counted. */
    expect(screen.getByRole("heading", { name: /match/ })).toBeInTheDocument();
  });
});

describe("the badge derivation", () => {
  it("gives a record that completed and landed at the cursor no badge at all", () => {
    /* §11.20 — a badge is for a status that is NOT expected. Two thirds of a
       list reporting success is what leaves the one row needing a decision
       nothing to stand out from. */
    expect(badgesFor(entry())).toEqual([]);
  });

  it("reads the delivery badge off insert_mode, and never two of them", () => {
    expect(badgesFor(entry({ insert_mode: "clipboard_only" }))).toEqual([
      { text: "Clipboard only", tone: "warning" },
    ]);
    expect(badgesFor(entry({ insert_mode: "clipboard_fallback", pasted: false }))).toEqual([
      { text: "Clipboard", tone: "warning" },
    ]);
    expect(badgesFor(entry({ insert_mode: "scratchpad_fallback", pasted: false }))).toEqual([
      { text: "Insert failed", tone: "danger" },
    ]);
    expect(badgesFor(entry({ insert_mode: "direct_paste", pasted: false }))).toEqual([
      { text: "Insert failed", tone: "danger" },
    ]);
  });

  it("says Retried once because the record links exactly one level", () => {
    /* The runtime keeps `retry_of`, not a count. A second retry of the same
       capture is a third record, not a "twice". */
    expect(badgesFor(entry({ retry_of: "e0" }))).toEqual([{ text: "Retried once", tone: "plan" }]);
  });

  it("does not brand every successful record Audio swept", () => {
    /* A successful run deletes its audio, so keying the badge off `audio_path`
       alone would put it on nearly every row. It is only unexpected on a record
       you would reasonably retry and cannot. */
    expect(badgesFor(entry({ status: "completed", audio_path: null }))).toEqual([]);
    expect(badgesFor(entry({ status: "failed", audio_path: null, insert_mode: null }))).toEqual([
      { text: "Failed", tone: "danger" },
      { text: "Audio swept", tone: "plan" },
    ]);
    expect(
      badgesFor(entry({ status: "failed", audio_path: "/tmp/a.wav", insert_mode: null })),
    ).toEqual([{ text: "Failed", tone: "danger" }]);
  });
});

describe("the raw panel's foot", () => {
  /* Measured against the owner's machine on 2026-08-10: 50 of 142 records have
     identical texts and an AI stage ran on ALL 50, so a foot keyed off string
     equality claimed "no AI stage ran on this one" 50 times and was wrong every
     time. Equal texts are not evidence that nothing ran. */
  it("does not claim nothing ran just because the two texts match", () => {
    const unchanged = rawOf(
      entry({
        raw_transcript: "same text",
        transformed_transcript: "same text",
        corrected: true,
        applied_rules: ["post_corrected"],
      }),
    );
    expect(unchanged.same).toBe(false);
    expect(unchanged.note).toBe("The AI stage ran and changed nothing.");
  });

  it("keeps the Identical sentence for a record nothing ran on", () => {
    const untouched = rawOf(
      entry({
        raw_transcript: "same text",
        transformed_transcript: "same text",
        corrected: false,
        applied_rules: [],
      }),
    );
    /* `same` is the panel's own sentence and it is true here, so no note. */
    expect(untouched.same).toBe(true);
    expect(untouched.note).toBeUndefined();
  });

  it("lets a transform warning outrank both sentences", () => {
    const warned = rawOf(
      entry({ transform_warning: "The correction was rejected as over-shortened." }),
    );
    expect(warned.note).toBe("The correction was rejected as over-shortened.");
  });

  /**
   * ADR 0079. A short capture outranks the transform warning because it is the
   * larger fact: one says the AI stage did something questionable to the text,
   * the other says the text is missing content that was never recorded.
   */
  it("lets a short capture outrank even a transform warning", () => {
    const short = rawOf(
      entry({
        transform_warning: "The correction was rejected as over-shortened.",
        capture_integrity: {
          wall_seconds: 405.7,
          recorded_seconds: 194.3,
          missing_ratio: 0.521,
          verdict: "short",
        },
      }),
    );

    expect(short.note).toContain("194 s of the 406 s it ran");
    expect(short.note).toContain("52 % of the audio was never captured");
    expect(short.note).toContain("not of what was said");
  });

  it("says nothing about a capture that kept its audio", () => {
    const intact = rawOf(
      entry({
        transform_warning: null,
        corrected: false,
        applied_rules: [],
        raw_transcript: "same text",
        transformed_transcript: "same text",
        capture_integrity: {
          wall_seconds: 100,
          recorded_seconds: 99.8,
          missing_ratio: 0.002,
          verdict: "intact",
        },
      }),
    );

    // A note on every healthy record is the noise §11.20 rejects badges for.
    expect(intact.note).toBeUndefined();
  });

  it("marks a short capture in the list, so the fold does not have to be opened", () => {
    const badges = badgesFor(
      entry({
        capture_integrity: {
          wall_seconds: 405.7,
          recorded_seconds: 194.3,
          missing_ratio: 0.521,
          verdict: "short",
        },
      }),
    );

    // It leads: every other badge here says the DELIVERY went sideways, this
    // one says the text itself is missing content.
    expect(badges[0]).toEqual({ text: "Audio missing", tone: "danger" });
  });

  it("draws no badge for a capture that was fine or was never measured", () => {
    const intact = badgesFor(
      entry({
        capture_integrity: {
          wall_seconds: 100,
          recorded_seconds: 99.8,
          missing_ratio: 0.002,
          verdict: "intact",
        },
      }),
    );
    const unmeasured = badgesFor(
      entry({
        capture_integrity: {
          wall_seconds: 1.2,
          recorded_seconds: 0.9,
          missing_ratio: 0.25,
          verdict: "not_measured",
        },
      }),
    );

    expect(intact.some((badge) => badge.text === "Audio missing")).toBe(false);
    expect(unmeasured.some((badge) => badge.text === "Audio missing")).toBe(false);
  });

  it("shows the recogniser's own text as Heard, never the rewritten one", () => {
    const pair = rawOf(
      entry({ raw_transcript: "lets ship it", transformed_transcript: "Let's ship it." }),
    );
    expect(pair.heard).toBe("lets ship it");
    expect(pair.written).toBe("Let's ship it.");
    expect(pair.same).toBe(false);
  });
});

/**
 * ADR 0070 — the one control on this screen the prototype does not draw, and
 * the reason it is here: the surface you go to in order to judge transcription
 * accuracy was showing the AI's version of every row first.
 */
describe("Written and Heard", () => {
  const pair = entry({
    raw_transcript: "lets ship the settings restructure today",
    transformed_transcript: "Let's ship the settings restructure today.",
  });

  it("titles the rows with what the model named them until asked otherwise", async () => {
    mockRuntimeHistory([pair]);
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(await screen.findByText("Die Umstrukturierung der Einstellungen")).toBeInTheDocument();
  });

  /* A record from before ADR 0077 has no title, and its own words are the
     honest stand-in — the segment says `Title` and shows the opening, which is
     what a title would have been made from. */
  it("falls back to the written text on a record the model never named", async () => {
    mockRuntimeHistory([entry({ title: null })]);
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(
      await screen.findByText("Let's ship the settings restructure today."),
    ).toBeInTheDocument();
  });

  it("swaps every title to the written text, then to the recogniser's own words", async () => {
    mockRuntimeHistory([pair]);
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await screen.findByText("Die Umstrukturierung der Einstellungen");

    await userEvent.click(screen.getByRole("button", { name: "Written" }));
    expect(screen.getByText("Let's ship the settings restructure today.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Heard" }));
    expect(screen.getByText("lets ship the settings restructure today")).toBeInTheDocument();
    expect(
      screen.queryByText("Let's ship the settings restructure today."),
    ).not.toBeInTheDocument();
  });

  /* It narrows nothing, so the count may not move — a control that looked like
     the status filter beside it and did not behave like one would be worse
     than no control. */
  it("changes no count, because it is not a filter", async () => {
    mockRuntimeHistory([pair, entry({ id: "second" })]);
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await screen.findByRole("heading", { name: "2 transcriptions" });

    await userEvent.click(screen.getByRole("button", { name: "Heard" }));
    expect(screen.getByRole("heading", { name: "2 transcriptions" })).toBeInTheDocument();
  });

  /* No fallback under Heard: borrowing the transformed text would put the AI's
     sentence behind a label promising the opposite. */
  it("says nothing was heard rather than borrowing the written text", async () => {
    mockRuntimeHistory([
      entry({ title: null, raw_transcript: null, transformed_transcript: "Cleaned up." }),
    ]);
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await screen.findByText("Cleaned up.");

    await userEvent.click(screen.getByRole("button", { name: "Heard" }));
    expect(screen.getByText("Nothing was heard in this capture.")).toBeInTheDocument();
  });
});

describe("the history clock", () => {
  it("says the time for today and names the day before that", () => {
    const now = new Date("2026-08-10T14:00:00").getTime();
    expect(historyTime(new Date("2026-08-10T09:42:00").getTime(), now)).toMatch(/09:42/);
    expect(historyTime(new Date("2026-08-09T17:03:00").getTime(), now)).toMatch(/^Yesterday /);
    expect(historyTime(new Date("2026-08-06T16:22:00").getTime(), now)).toMatch(/^Thu /);
  });
});
