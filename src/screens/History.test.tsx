import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  HistoryScreen,
  badgesFor,
  historyTime,
  rawOf,
  stoppedByRuntimeNote,
} from "./History";
import { createAppConfig, createWorkspaceRuntime } from "@/test/factories";
import type {
  TranscriptionHistoryEntry,
  TranscriptionHistorySummary,
} from "@/types/history";

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

const HEARD = "lets ship the settings restructure today";
const WRITTEN = "Let's ship the settings restructure today.";

/** How much of a transcript the runtime puts on a row. Mirrors `PREVIEW_CHARS`
 *  in `core::history`; a case that needed the two to differ would be testing the
 *  wrong thing. */
const PREVIEW_CHARS = 160;

/** A ROW AS THE RUNTIME SENDS IT (ADR 0240) — a summary, not a record.
 *
 *  It still takes the two TEXTS, because that is what a case is about, and
 *  derives the previews the way `TranscriptionHistorySummary::of` does. Writing
 *  `heard_preview` by hand at every call site would let a case state a preview
 *  its own record could not have produced. */
function entry(
  overrides: Partial<TranscriptionHistorySummary> & {
    raw_transcript?: string | null;
    transformed_transcript?: string | null;
  } = {},
): TranscriptionHistorySummary {
  const { raw_transcript, transformed_transcript, ...rest } = overrides;
  const texts =
    raw_transcript !== undefined || transformed_transcript !== undefined
      ? previewsOf(raw_transcript ?? null, transformed_transcript ?? null)
      : {};
  return {
    id: "e1",
    created_at_ms: Date.now(),
    status: "completed",
    source: "native_pipeline",
    retry_of: null,
    provider: "groq",
    model: "whisper-large-v3",
    active_profile: "General writing",
    processing_mode: "cleanup",
    title: "Die Umstrukturierung der Einstellungen",
    transcript_path: "/tmp/transcripts/2026/08/10-0942-e1.md",
    fallback_acknowledged: false,
    capture_integrity: null,
    capture_stop_reason: null,
    heard_preview: HEARD,
    written_preview: WRITTEN,
    transcripts_identical: false,
    corrected: true,
    applied_rules: [],
    transform_warning: null,
    insert_mode: "direct_paste",
    pasted: true,
    fallback_reason: null,
    error: null,
    audio_path: null,
    ...texts,
    ...rest,
  };
}

/** The runtime's own derivation, once. */
function previewsOf(heard: string | null, written: string | null) {
  const cut = (text: string) => text.trim().slice(0, PREVIEW_CHARS);
  const heardText = heard ?? "";
  const writtenText = written ?? heardText;
  return {
    heard_preview: cut(heardText),
    written_preview: cut(writtenText),
    transcripts_identical: heardText === writtenText,
  };
}

/** The whole record behind a row, for the id fetch. Only the fields the screen
 *  reads off it — the two texts. */
function recordFor(row: TranscriptionHistorySummary): TranscriptionHistoryEntry {
  return {
    ...row,
    language: null,
    work_mode: null,
    effective_mode: null,
    provider_profile: null,
    local_prompt_strength: null,
    local_prompt_carry: null,
    local_beam_size: null,
    local_best_of: null,
    active_driver: null,
    fallback_available: null,
    recovery_action: null,
    recovery_message: null,
    clipboard_restore: null,
    input_level: null,
    raw_transcript: row.heard_preview || null,
    transformed_transcript: row.transcripts_identical ? null : row.written_preview,
  } as TranscriptionHistoryEntry;
}

/**
 * THE PANEL AS IT STANDS ONCE THE RECORD HAS COME BACK (ADR 0240).
 *
 * `rawOf` takes the whole texts as a second argument and withholds its shape
 * claim without them, because a claim about the WHOLE dictation may not be read
 * off a 160-character cut. Every case whose assertion IS that claim therefore
 * states the open panel rather than the closed row — which is the only place
 * the sentence is ever drawn.
 */
function openRawOf(overrides: Parameters<typeof entry>[0] = {}) {
  const row = entry(overrides);
  /* THE TEXTS THE CASE WROTE, not the previews derived from them — that is
     what `transcription_history_record` hands back, whitespace and all. */
  const heard = overrides.raw_transcript ?? "";
  const written = overrides.transformed_transcript ?? heard;
  return rawOf(row, { id: row.id, heard, written });
}

function mockRuntimeHistory(entries: TranscriptionHistorySummary[]) {
  invoked.mockImplementation(async (command: string, args?: unknown) => {
    if (command === "transcription_history_summaries") return entries;
    if (command === "transcription_history_record") {
      const id = (args as { id?: string } | undefined)?.id;
      const found = entries.find((row) => row.id === id);
      return found ? recordFor(found) : null;
    }
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

    await waitFor(() => expect(invoked).toHaveBeenCalledWith("transcription_history_summaries", expect.anything()));
    /* The row opens with what the model named it (ADR 0078). */
    expect(await screen.findByText("Die Umstrukturierung der Einstellungen")).toBeInTheDocument();
    /* The drawing's rows are the gallery's and must not leak onto the product. */
    expect(screen.queryByText("Consolidate insert recovery into a single home.")).not.toBeInTheDocument();
  });

  it("says the list is empty instead of drawing seven records that are not there", async () => {
    mockRuntimeHistory([]);
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(
      await screen.findByText("Nothing has been transcribed on this machine yet."),
    ).toBeInTheDocument();
    /* ADR 0184: no count over the list. An empty record says so in words, which
       is the reading `0 transcriptions` only ever approximated. */
    expect(screen.queryByRole("heading", { name: /transcription/ })).toBeNull();
  });

  /**
   * FOUR OF THE SIX ROW VERBS ARE IN A MENU NOW (ADR 0194), so every case that
   * grades one has to open it first. It is a helper rather than six copies of
   * two lines because the thing being asserted is what the verb DOES — a case
   * that spelled the opening out would be graded on the opening.
   */
  async function rowMenu(user: ReturnType<typeof userEvent.setup>) {
    await user.click((await screen.findAllByRole("button", { name: "More actions" }))[0]);
    return screen.getByRole("menu");
  }

  it("reveals a record's own file, on the path the record names", async () => {
    const user = userEvent.setup();
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const menu = await rowMenu(user);
    const reveal = within(menu).getByRole("menuitem", { name: /Show in file manager/ });
    expect(reveal).toBeEnabled();
    await user.click(reveal);

    expect(invoked).toHaveBeenCalledWith("reveal_transcript_in_file_manager", {
      request: { path: "/tmp/transcripts/2026/08/10-0942-e1.md" },
    });
  });

  /**
   * ADR 0194 — WHAT STAYED OUTSIDE THE MENU, AND IT IS THE POINT OF THE MOVE.
   *
   * Six controls per row gave a list rows of two widths, because Restore is
   * conditional. Two stay: the row's own disclosure, and the verb somebody
   * repeats down a whole list. The rest is one control wide on every row.
   */
  it("draws two controls and one menu on every row, whatever the record is", async () => {
    mockRuntimeHistory([
      entry({ id: "e1" }),
      /* The row that used to be one control wider than its neighbour. */
      entry({ id: "e2", insert_mode: "clipboard_fallback", pasted: false }),
    ]);
    const { container } = render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findAllByRole("button", { name: "Copy" });
    const runs = [...container.querySelectorAll(".ws-list-actions")];
    expect(runs).toHaveLength(2);
    for (const run of runs) {
      expect([...run.querySelectorAll("button")].map((button) => button.getAttribute("aria-label")))
        .toEqual(["View raw transcript", "Copy", "More actions"]);
    }
  });

  /** ADR 0082 already answers a right-click with the row's verbs, and ADR 0194
   *  keeps that promise to ONE list: the `…` and the right-click open the same
   *  menu rather than two arrangements of the same commands. */
  it("answers a right-click with the same verb list the button opens", async () => {
    const user = userEvent.setup();
    const { container } = render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByText("Die Umstrukturierung der Einstellungen");
    const fromButton = [...(await rowMenu(user)).querySelectorAll("[role='menuitem']")].map(
      (item) => item.textContent,
    );
    await user.keyboard("{Escape}");

    fireEvent.contextMenu(container.querySelector(".ws-list-item-text")!);
    const fromPointer = [...screen.getByRole("menu").querySelectorAll("[role='menuitem']")].map(
      (item) => item.textContent,
    );
    expect(fromPointer).toEqual(fromButton);
  });

  /* ADR 0074: the one record that has no file is one that produced no text.
     ADR 0065 then applies unchanged — drawn, disabled, reason on the control —
     which is the shape Retry already has on a record with no audio. */
  it("disables the reveal on a record that produced no text, with the reason on it", async () => {
    const user = userEvent.setup();
    mockRuntimeHistory([entry({ status: "empty", transformed_transcript: null, transcript_path: null })]);
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* ADR 0065 survives the move into the menu (ADR 0194): drawn, inert, and
       carrying the reason — which the menu has room to state in full rather
       than hiding in a tooltip. */
    const reveal = within(await rowMenu(user)).getByRole("menuitem", {
      name: /Show in file manager/,
    });
    expect(reveal).toBeDisabled();
    expect(reveal).toHaveTextContent("this run produced no text");
  });

  /* ADR 0184. The foot recited the folder, the index file, the retention days
     and the cap under every visit — four facts of furniture on a working screen,
     none of them actionable where they stood. The folder is a button, the two
     numbers are one press away in Privacy & Data, and the index was never
     anything a reader of this screen could act on at all. */
  it("recites nothing under the list — the folder is a door instead", async () => {
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByText("Die Umstrukturierung der Einstellungen");
    expect(screen.queryByText(/Every transcript is a Markdown file/)).toBeNull();
    expect(screen.queryByText(/indexed in/)).toBeNull();
    expect(screen.queryByText(/Kept 30 days/)).toBeNull();
    expect(screen.getByRole("button", { name: "Open folder" })).toBeInTheDocument();
  });

  /**
   * DELETE IS HELD BACK RATHER THAN CONFIRMED (ADR 0195), and this screen grades
   * the half it owns: the row leaves at once, the way back is offered, and the
   * runtime has been told NOTHING. A case that only asserted the `invoke` would
   * pass on a build with no undo window at all.
   *
   * THE CLOCK ITSELF IS GRADED IN `useUndoableDelete.test.ts` AND DELIBERATELY
   * NOT HERE. This screen debounces its search and re-reads the index whenever
   * the runtime says a record landed (ADR 0240 — it was a five-second poll
   * before that); driving it on fake timers means every assertion is also a
   * statement about those, and the first version of this case hung on exactly
   * that. The timing rule belongs to the hook, which has no such machinery
   * around it.
   */
  it("takes the row out and offers it back, without telling the runtime", async () => {
    const user = userEvent.setup();
    /* TWO RECORDS, SO THE LIST STILL EXISTS AFTERWARDS. With one, holding it
       back empties the set and the card draws its empty state — which is right,
       and grades the empty state rather than the row leaving it. */
    mockRuntimeHistory([entry({ id: "e1" }), entry({ id: "e2", title: "The other record" })]);
    const { container } = render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByText("Die Umstrukturierung der Einstellungen");
    await user.click(within(await rowMenu(user)).getByRole("menuitem", { name: "Delete" }));

    /* IN THE LIST, NOT ON THE SCREEN. The notice NAMES the row it is offering
       back, so the title is still on the page and has to be — a `queryByText`
       over the whole document reads the notice and calls the row present. */
    const list = within(container.querySelector(".ws-list")!);
    expect(list.queryByText("Die Umstrukturierung der Einstellungen")).toBeNull();
    expect(list.getByText("The other record")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(invoked).not.toHaveBeenCalledWith(
      "delete_transcription_history_entry",
      expect.anything(),
    );
  });

  /** The whole point of the window: the runtime is never told at all. */
  it("puts the row back and tells the runtime nothing when the undo is pressed", async () => {
    const user = userEvent.setup();
    const { container } = render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByText("Die Umstrukturierung der Einstellungen");
    await user.click(within(await rowMenu(user)).getByRole("menuitem", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect(
      within(container.querySelector(".ws-list")!).getByText(
        "Die Umstrukturierung der Einstellungen",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(invoked).not.toHaveBeenCalledWith(
      "delete_transcription_history_entry",
      expect.anything(),
    );
  });

  /**
   * THE PAGER AND THE LIST AGREE ABOUT A HELD-BACK ROW (ADR 0195). The filter
   * runs before the count rather than at the render, or a record hidden from the
   * rows would still be counted by the foot — `1–25 of 60` over twenty-four
   * rows, which reads as a broken screen rather than as a pending delete.
   */
  it("counts the held-back row out of the set, not just out of the rows", async () => {
    const user = userEvent.setup();
    mockRuntimeHistory(
      Array.from({ length: 21 }, (_, index) =>
        entry({ id: `e${index}`, title: `Record ${index}` }),
      ),
    );
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByText("Record 0");
    await user.selectOptions(screen.getByLabelText("Per page"), "10");
    expect(screen.getByText(/1–10 of 21/)).toBeInTheDocument();

    await user.click(within(await rowMenu(user)).getByRole("menuitem", { name: "Delete" }));
    expect(screen.queryByText(/of 21/)).toBeNull();
    expect(screen.getByText(/1–10 of 20/)).toBeInTheDocument();
  });

  /* THE RUNTIME'S RULE, NOT HALF OF IT. `retry_transcription_history_entry`
     re-runs the transform when the record holds a raw transcript and only needs
     the kept capture when it does not. A successful run deletes its audio, so
     disabling on `audio_path` alone greyed the control out on every completed
     record while the runtime would have re-run any of them. */
  it("retries a record that kept its transcript, with no audio left", async () => {
    const user = userEvent.setup();
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    expect(within(await rowMenu(user)).getByRole("menuitem", { name: "Retry" })).toBeEnabled();
  });

  it("refuses only where there is neither a transcript nor a recording", async () => {
    const user = userEvent.setup();
    mockRuntimeHistory([entry({ raw_transcript: null, transformed_transcript: null, audio_path: null })]);
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const dead = within(await rowMenu(user)).getByRole("menuitem", { name: /Retry/ });
    expect(dead).toBeDisabled();
    expect(dead).toHaveTextContent("no transcript and no recording left to re-run");
  });

  it("offers Restore to cursor only where the text did not reach the cursor", async () => {
    const user = userEvent.setup();
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    expect(
      within(await rowMenu(user)).queryByRole("menuitem", { name: "Restore to cursor" }),
    ).not.toBeInTheDocument();

    cleanup();
    mockRuntimeHistory([entry({ insert_mode: "clipboard_fallback", pasted: false })]);
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    expect(
      within(await rowMenu(user)).getByRole("menuitem", { name: "Restore to cursor" }),
    ).toBeInTheDocument();
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

  /* The pairing with Privacy & Data, from this side (§11.51): this screen is
     the records, that one is the rule about them. It was a sentence with a dead
     link under the list; since ADR 0184 it is a control on the toolbar. */
  it("carries the pairing with Privacy & Data as a control, not as a standing note", async () => {
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    expect(
      await screen.findByRole("button", { name: "Retention rules" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Privacy & Data/ })).toBeNull();
  });

  it("narrows the list through the runtime's query rather than in the browser", async () => {
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    await screen.findByText("Die Umstrukturierung der Einstellungen");

    await userEvent.selectOptions(screen.getByLabelText("Status"), "failed");
    await waitFor(() =>
      expect(invoked).toHaveBeenCalledWith("transcription_history_summaries", {
        query: { status: "failed" },
      }),
    );
    /* The runtime does the narrowing, which is the whole assertion: the browser
       holds no second copy of the rule. */
  });
});

/**
 * ADR 0184. A record that is capped at 1000 entries and drawn as one scroll is a
 * screen a reader loses their place in — so the list is paged, the size is the
 * reader's, and the two doors the foot has only ever described in prose are
 * controls now.
 */
describe("the pages, the folder and the rule", () => {
  const many = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      entry({ id: `e${index}`, title: `Record ${index}` }),
    );

  it("draws one page of records and says which page of what", async () => {
    mockRuntimeHistory(many(60));
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    /* Twenty-five is the default, so sixty records are three pages, and the
       pager states the whole set as well as the slice — since ADR 0184 it is the
       only place this screen counts at all. */
    expect(await screen.findByText("Record 0")).toBeInTheDocument();
    expect(screen.queryByText("Record 25")).not.toBeInTheDocument();
    expect(screen.getByText(/1–25 of 60/)).toBeInTheDocument();
    expect(screen.getByText(/page 1 of 3/)).toBeInTheDocument();
  });

  it("moves a page at a time, and holds the ends", async () => {
    mockRuntimeHistory(many(60));
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByText("Record 0");
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Record 25")).toBeInTheDocument();
    expect(screen.queryByText("Record 0")).not.toBeInTheDocument();
    expect(screen.getByText(/26–50 of 60/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText(/51–60 of 60/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("keeps the reader's place when the page size changes", async () => {
    mockRuntimeHistory(many(60));
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByText("Record 0");
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Record 25")).toBeInTheDocument();

    /* Record 25 was at the top of the page; at ten a page it is on page three,
       and landing back at page one would be the same lost place this control
       exists to prevent. */
    await userEvent.selectOptions(screen.getByLabelText("Per page"), "10");
    expect(screen.getByText(/21–30 of 60/)).toBeInTheDocument();
    expect(screen.getByText("Record 25")).toBeInTheDocument();
  });

  it("draws no page control where there is only one page", async () => {
    mockRuntimeHistory(many(3));
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByText("Record 0");
    /* A control that says `1 of 1` is furniture, which this screen refuses
       elsewhere too. */
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
  });

  it("starts a narrowed set at its own first page", async () => {
    mockRuntimeHistory(many(60));
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByText("Record 0");
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText(/26–50 of 60/)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Status"), "failed");
    await waitFor(() => expect(screen.getByText(/1–25 of 60/)).toBeInTheDocument());
  });

  /* ADR 0184. The transcripts are written into `YYYY/MM/` folders and the list
     was the only place that could not be read that way. All time stays the
     default: the common question is *what did I dictate*, and only the follow-up
     is *when*. */
  it("lists every month together until a month is asked for", async () => {
    mockRuntimeHistory([
      entry({ id: "a", title: "August one", created_at_ms: new Date(2026, 7, 3).getTime() }),
      entry({ id: "b", title: "June one", created_at_ms: new Date(2026, 5, 9).getTime() }),
    ]);
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    const picker = (await screen.findByLabelText("Month")) as HTMLSelectElement;
    expect(picker).toHaveValue("");
    expect([...picker.options].map((option) => option.textContent)).toEqual([
      "All time",
      "August 2026",
      "June 2026",
    ]);
    expect(screen.getByText("August one")).toBeInTheDocument();
    expect(screen.getByText("June one")).toBeInTheDocument();

    await userEvent.selectOptions(picker, "2026-06");
    expect(screen.getByText("June one")).toBeInTheDocument();
    expect(screen.queryByText("August one")).toBeNull();

    /* And the months are still all of them: choosing June may not leave June as
       the only month there has ever been. */
    expect([...picker.options]).toHaveLength(3);
  });

  it("keeps the month picker on a one-month record, because a control that comes and goes is not learned", async () => {
    mockRuntimeHistory([entry({ created_at_ms: new Date(2026, 7, 3).getTime() })]);
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByText("Die Umstrukturierung der Einstellungen");
    const picker = screen.getByLabelText("Month") as HTMLSelectElement;
    expect([...picker.options].map((option) => option.textContent)).toEqual([
      "All time",
      "August 2026",
    ]);
    /* And it says what the list is scoped to, which is the first thing a reader
       coming back after a year needs to know. */
    expect(picker).toHaveValue("");
  });

  it("starts a month at its own first page", async () => {
    mockRuntimeHistory([
      ...many(40).map((record, index) => ({
        ...record,
        created_at_ms: new Date(2026, 7, 1 + (index % 28)).getTime(),
      })),
      entry({ id: "june", title: "June one", created_at_ms: new Date(2026, 5, 9).getTime() }),
    ]);
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await screen.findByText("Record 0");
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText(/26–41 of 41/)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Month"), "2026-06");
    /* One record in June, so there is no page control left at all — and
       certainly not page two of it. */
    expect(screen.getByText("June one")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
  });

  it("opens the folder the foot names, with no file to reveal", async () => {
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);

    await userEvent.click(await screen.findByRole("button", { name: "Open folder" }));
    /* No path is the runtime's own way of saying *the directory itself*, and it
       creates it first on a machine that has not dictated yet. */
    expect(invoked).toHaveBeenCalledWith("reveal_transcript_in_file_manager", {
      request: { path: null },
    });
  });

  it("offers the rule as a control and not only as a sentence", async () => {
    const open = vi.fn();
    render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true, open })} />);

    /* The foot has described the retention rule for three legs and left the
       reader to go and find it. The toolbar is where the actions on this set
       live, so the door belongs beside Export and the folder. */
    await userEvent.click(await screen.findByRole("button", { name: "Retention rules" }));
    /* A SECTION: Privacy & Data is a pane of the settings sheet, not
       one of the four workspace views, and `open` refuses an id neither list
       knows — so `{ view: "privacy" }` was a press that went nowhere. */
    expect(open).toHaveBeenCalledWith({ section: "privacy" });
  });
});

describe("why a recording ended", () => {
  it("says so when the runtime ended it, not the speaker", () => {
    // The complaint this answers was never that the ceiling exists. It was that
    // a dictation cut off mid-sentence was filed exactly like a finished one.
    expect(
      stoppedByRuntimeNote(
        entry({ capture_stop_reason: "Max recording duration reached." })
      )
    ).toBe("WordScript ended this recording: Max recording duration reached.");
  });

  it("stays silent on an ordinary stop, where the speaker is the reason", () => {
    expect(stoppedByRuntimeNote(entry())).toBeUndefined();
    expect(stoppedByRuntimeNote(entry({ capture_stop_reason: "  " }))).toBeUndefined();
  });

  it("outranks the capture-gap note on a record that has both", () => {
    // A record that ends mid-sentence is explained by the ceiling before it is
    // explained by anything about the audio, so the ordering is the assertion.
    const both = entry({
      capture_stop_reason: "Max recording duration reached.",
      capture_integrity: {
        wall_seconds: 60,
        recorded_seconds: 30,
        missing_ratio: 0.5,
        verdict: "short",
      },
    });
    expect(rawOf(both).note).toBe(
      "WordScript ended this recording: Max recording duration reached."
    );
  });
});

describe("the badge derivation", () => {
  it("gives a record that completed and landed at the cursor no badge at all", () => {
    /* §11.20 — a badge is for a status that is NOT expected. Two thirds of a
       list reporting success is what leaves the one row needing a decision
       nothing to stand out from. */
    expect(badgesFor(entry())).toEqual([]);
  });

  /* ADR 0193: a delivery mode is a fact, not a warning. The two healthy ones
     went grey and the failures did not — which is what the second half of this
     case is for, because a change that greyed all four would pass a case that
     only graded the first two. */
  it("reads the delivery badge off insert_mode, and never two of them", () => {
    expect(badgesFor(entry({ insert_mode: "clipboard_only" }))).toEqual([
      { text: "Clipboard only", tone: "neutral" },
    ]);
    expect(badgesFor(entry({ insert_mode: "clipboard_fallback", pasted: false }))).toEqual([
      { text: "Clipboard", tone: "neutral" },
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

  /* THE RECORD THIS SENTENCE WAS WRITTEN FOR — `history-1786910918745-50`,
     2026-08-16, abridged to the tail where the two texts part. The owner read
     "The AI stage rewrote it" on this pair and reported a cleanup defect; the
     whole difference is WordScript's own prompt strip plus one leading and one
     trailing space, which is also why `post_corrected` is on it. */
  it("names the strip on the record whose foot sent a defect report to the wrong stage", () => {
    const stripped = openRawOf({
      raw_transcript: " in die Neuronen verwendet wird. Likely phrases:\" Commit.",
      transformed_transcript: "in die Neuronen verwendet wird. Commit. ",
      corrected: true,
      applied_rules: ["prompt_echo_stripped", "post_corrected"],
    });

    expect(stripped.note).toBe(
      "WordScript removed its own prompt from this. Nothing else was added or reworded.",
    );
    expect(stripped.note).not.toContain("AI stage");
  });

  /* The claim is about the diff, so it has to fall the moment the diff stops
     supporting it: one word swapped for another and the sentence stops saying
     nothing was reworded. */
  it("stops exonerating the AI stage as soon as a word was swapped", () => {
    const both = openRawOf({
      raw_transcript: "Absetzt davon. Likely phrases: Commit.",
      transformed_transcript: "Abgesehen davon. Commit.",
      corrected: true,
      applied_rules: ["prompt_echo_stripped", "post_corrected"],
    });

    expect(both.note).toBe(
      "WordScript removed its own prompt from this. Anything else that differs is the AI stage's.",
    );
  });

  it("names the address repair as WordScript's own, not the AI stage's", () => {
    const repaired = openRawOf({
      raw_transcript: "Sagt mir bitte Bescheid.",
      transformed_transcript: "Sag mir bitte Bescheid.",
      corrected: true,
      applied_rules: ["singular_address_restored", "post_correction_no_change"],
    });

    expect(repaired.note).toContain("WordScript repaired the address the recogniser pluralized.");
  });

  /* A cleanup that dropped fillers and invented nothing is the case this
     cluster spends its time telling apart from the other one, so the panel
     says which of the two it is looking at. */
  it("says when the AI stage only took words out", () => {
    const trimmed = openRawOf({
      raw_transcript: "also ähm das ist so ein Fall",
      transformed_transcript: "also das ist so ein Fall",
      corrected: true,
      applied_rules: ["post_corrected"],
    });

    expect(trimmed.note).toBe("The AI stage removed words and added none.");
  });

  /* And a genuine rewrite gets no caller sentence at all: the panel's own
     default is true there, and a second sentence saying the same thing is the
     rule dump the record warned against. */
  it("leaves a real rewrite to the panel's own default", () => {
    const rewritten = openRawOf({
      raw_transcript: "kannst du mir das mal eben zusammenfassen",
      transformed_transcript: "Bitte fasse mir das kurz zusammen.",
      corrected: true,
      applied_rules: ["post_corrected"],
    });

    expect(rewritten.note).toBeUndefined();
  });

  /* ADR 0240 PUT A CUT BETWEEN THIS SENTENCE AND ITS EVIDENCE. A row carries
     160 characters of each text, and the shape claim is a claim about the WHOLE
     dictation: a pair whose first line only drops fillers and whose tail was
     rewritten wholesale looks like pure removal to both previews. The panel may
     say it once the record is in hand and not before. */
  it("withholds the shape claim while it has only the row's cut of the text", () => {
    /* A dictation whose first line the AI stage did not touch, and whose TAIL
       it added a sentence to. The two previews are therefore identical — so a
       panel reading them would exonerate a stage that invented a sentence.
       Spanish, because the cases around it are German and the cut is a rule
       about characters rather than about one corpus. */
    const opening = "bueno este es uno de esos casos que deberiamos revisar pronto. ".repeat(4);
    const heard = `${opening}Gracias.`;
    const written = `${opening}Gracias. El modelo se invento esta frase.`;

    const texts = {
      raw_transcript: heard,
      transformed_transcript: written,
      corrected: true,
      applied_rules: ["post_corrected"],
    };

    const cut = rawOf(entry(texts));
    expect(cut.heard.length).toBe(PREVIEW_CHARS);
    expect(cut.heard).toBe(cut.written);
    /* The row still knows the whole texts differ — that flag is the runtime's,
       measured on the full pair — so the panel says the stage rewrote it and
       stops there. Its own default, and true. */
    expect(cut.same).toBe(false);
    expect(cut.note).toBeUndefined();

    /* With the record in hand the claim is refused on the evidence rather than
       withheld for want of it: a word arrived the recogniser never said. */
    expect(openRawOf(texts).note).toBeUndefined();
  });

  /* And where the whole texts DO support it, the record coming back is what
     turns the claim on — the panel earns the sentence rather than assuming it. */
  it("makes the shape claim once the record behind the row has come back", () => {
    /* French, and the filler is that language's own: every corpus this product
       meets has one, and the rule under test is *nothing was added* rather than
       anything about which word was dropped. */
    const opening = "donc euh c'est un cas dont nous devrions parler bientot. ".repeat(4);
    const texts = {
      raw_transcript: `${opening}Merci.`,
      transformed_transcript: `${opening.replace(/euh /g, "")}Merci.`,
      corrected: true,
      applied_rules: ["post_corrected"],
    };

    expect(rawOf(entry(texts)).note).toBeUndefined();
    expect(openRawOf(texts).note).toBe("The AI stage removed words and added none.");
  });

  /* The other half of the same rule: the panel shows the WHOLE text once the
     record lands, not the 160 characters the row was drawn from. */
  it("replaces the row's cut with the whole text when the record comes back", () => {
    const heard = "um dois tres ".repeat(20);

    const cut = rawOf(entry({ raw_transcript: heard, transformed_transcript: heard }));
    expect(cut.heard.length).toBe(PREVIEW_CHARS);

    const open = openRawOf({ raw_transcript: heard, transformed_transcript: heard });
    expect(open.heard).toBe(heard);
    expect(open.written).toBe(heard);
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
  it("narrows nothing, because it is not a filter", async () => {
    mockRuntimeHistory([pair, entry({ id: "second" })]);
    const { container } = render(<HistoryScreen runtime={createWorkspaceRuntime({ active: true })} />);
    /* Both records carry the same title, so this is the plural query on
       purpose — the assertion is the COUNT of rows, not which one is which. */
    await screen.findAllByText("Die Umstrukturierung der Einstellungen");
    const before = container.querySelectorAll(".ws-list-item").length;
    expect(before).toBe(2);

    await userEvent.click(screen.getByRole("button", { name: "Heard" }));
    /* The same records, showing their other text. A control that sat beside the
       status filter and quietly changed the set would be worse than no control. */
    expect(container.querySelectorAll(".ws-list-item")).toHaveLength(before);
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
