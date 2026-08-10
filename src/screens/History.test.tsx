import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
    expect(await screen.findByText("Let's ship the settings restructure today.")).toBeInTheDocument();
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

  it("keeps Show in file manager drawn and inert, because nothing can reveal a record", async () => {
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const reveal = await screen.findByRole("button", {
      name: /Show in file manager — the runtime keeps one history file/,
    });
    /* ADR 0065: a control that cannot act is disabled, not deleted and not left
       looking settable — and the reason is its tooltip, because a disabled
       control with no explanation is the same defect one step quieter. */
    expect(reveal).toBeDisabled();
  });

  it("states the file the runtime actually keeps, not a folder of Markdown files", async () => {
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(
      await screen.findByText(/Every transcription is kept in \/home\/f\/.local\/share\/wordscript\/history.json/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Markdown file/)).not.toBeInTheDocument();
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

  it("cannot retry a record whose audio the runtime no longer has", async () => {
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* `audio_path` null is the runtime saying there is nothing to re-run
       (ADR 0039), and the control says so by disabling rather than hiding. */
    const swept = await screen.findByRole("button", { name: "Retry — audio no longer kept" });
    expect(swept).toBeDisabled();
  });

  it("offers Restore to cursor only where the text did not reach the cursor", async () => {
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    expect(screen.queryByRole("button", { name: "Restore to cursor" })).not.toBeInTheDocument();

    cleanup();
    mockRuntimeHistory([entry({ insert_mode: "clipboard_fallback", pasted: false })]);
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    expect(await screen.findByRole("button", { name: "Restore to cursor" })).toBeInTheDocument();
  });

  it("unfolds the two texts with no path, because there is no file to name", async () => {
    const { container } = render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await userEvent.click(await screen.findByRole("button", { name: "View raw transcript" }));
    expect(screen.getByText("lets ship the settings restructure today")).toBeInTheDocument();
    expect(container.querySelector(".ws-raw-path")).toBeNull();
  });

  it("narrows the list through the runtime's query rather than in the browser", async () => {
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await screen.findByText("Let's ship the settings restructure today.");

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

  it("shows the recogniser's own text as Heard, never the rewritten one", () => {
    const pair = rawOf(
      entry({ raw_transcript: "lets ship it", transformed_transcript: "Let's ship it." }),
    );
    expect(pair.heard).toBe("lets ship it");
    expect(pair.written).toBe("Let's ship it.");
    expect(pair.same).toBe(false);
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
