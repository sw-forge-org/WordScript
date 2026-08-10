import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import {
  Button,
  Card,
  DocLink,
  EmptyState,
  Field,
  Icon,
  ListRows,
  Note,
  SectionHeader,
  SegmentControl,
  Select,
  Toolbar,
  ToolbarSearch,
  TranscriptRow,
  ViewTop,
} from "@/components/shell";
import type { ListItemBadge, RawTranscript } from "@/components/shell";
import { useTranscriptionHistory } from "@/hooks/useTranscriptionHistory";
import { PROCESSING_MODE_LABELS } from "@/lib/transformRules";
import type {
  TranscriptionHistoryEntry,
  TranscriptionHistoryStatus,
} from "@/types/history";
import type { WiredScreenProps } from "./props";

/**
 * HISTORY — `SCREENS.history`, WIRED IN PART, and the banner stays because of
 * the part that is not.
 *
 * The shipped surface spends a whole card of stacked `FormRow`s on three
 * filters — a search box, a status select and a toggle, each with a label in
 * the left column. Filters are a toolbar: they belong above the thing they
 * filter, on one line, and the count belongs to the list they produce.
 *
 * THREE FILTERS BECAME TWO. The shipped card carried a search box, a status
 * select AND an "Errors only" toggle — but the select already has a Failed
 * option, so two controls narrowed the list to the same set and could
 * contradict each other. The toggle is gone.
 *
 * AND A THIRD CONTROL THAT IS NOT A FILTER — `Written` / `Heard`, ADR 0070, the
 * one place Leg 4d departs from this drawing. The row title is the WRITTEN text
 * and that is right for a record of what you got; it is wrong for the job the
 * owner now needs this screen to do, because the surface you go to in order to
 * judge transcription accuracy was showing the AI's version first and the
 * recogniser's one fold deep, per record. The segment switches which text every
 * title carries. `Written` is the default, so the screen at rest is the drawing
 * unchanged, and *View raw* is untouched — the pair per record is still where
 * the two are compared side by side.
 *
 * ALL SIX ROW CONTROLS ACT (ADR 0074 closed the last one):
 *
 *  - **View raw** unfolds the record's two texts.
 *  - **Retry** is `retry_transcription_history_entry`, disabled on a record
 *    whose audio has been swept because there is nothing to re-run (ADR 0039).
 *    It re-runs the mode the record ran in rather than a correction (ADR 0075).
 *  - **Restore to cursor** is `insert_text_native` with the record's written
 *    text, offered only where the delivery did not reach the cursor.
 *  - **Copy** is the clipboard, the same call About's version row makes.
 *  - **Delete** is `delete_transcription_history_entry`, and it takes the
 *    record's file with it.
 *  - **Show in file manager** is `reveal_transcript_in_file_manager` on the
 *    record's own `transcript_path`. Disabled on the one record that has no
 *    file — a run that produced no text — with the reason as its tooltip
 *    (ADR 0065), which is the shape Retry already had.
 *
 * AND THE FOOT CLAIMS THE FOLDER AGAIN, because it is there. Leg 4c replaced
 * the drawn sentence with the one file the runtime kept, on the rule that a
 * product may not send somebody to a folder that does not exist. ADR 0074 built
 * the folder, so the drawing's sentence is true and comes back — with the
 * resolved root, because it follows `WORDSCRIPT_DATA_DIR` and this sentence is
 * about THIS machine.
 *
 * IN THE GALLERY IT IS THE DRAWING, VERBATIM — no runtime, the seven sample
 * rows, the drawn sentence, `port:diff` unchanged. The two paths differ in
 * where a row comes FROM and meet on one list and one render
 * (`PartlyWiredScreenProps`).
 */

/** The drawn clock, which is History's and not Home's: Home says "2 min ago"
 *  because a recent record is measured in elapsed time; History says "09:42"
 *  because a record you are looking for is found by when it happened. */
export function historyTime(ms: number, now = Date.now()): string {
  const at = new Date(ms);
  const clock = at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.floor((startOfToday.getTime() - at.getTime()) / 86_400_000) + 1;

  if (at.getTime() >= startOfToday.getTime()) return clock;
  if (days === 1) return `Yesterday ${clock}`;
  if (days < 7) return `${at.toLocaleDateString([], { weekday: "short" })} ${clock}`;
  return `${at.toLocaleDateString()} ${clock}`;
}

/**
 * WHICH BADGE FOLLOWS FROM WHICH FIELD. Decided by Leg 4c, from the fields
 * `TranscriptionHistoryEntry` already carries, and stated here rather than in a
 * commit message because the next person to add a badge has to agree with it.
 *
 * The governing rule is §11.20's: **a badge is for a status that is NOT
 * expected.** A transcription that completed and landed at the cursor carries
 * none, which is what leaves the three that matter something to stand out from.
 *
 *  - `Failed` / `Empty` come from `status`, and nothing else does. A run that
 *    produced no transcript and a run that produced an empty one are different
 *    failures, and the filter above already separates them.
 *  - The DELIVERY badge is one badge from `insert_mode`, never two.
 *    `clipboard_only` is the profile's own setting and reads `Clipboard only`;
 *    `clipboard_fallback` is a paste that was meant and did not happen, and
 *    reads `Clipboard`; `scratchpad_fallback` and a `direct_paste` that did not
 *    paste both read `Insert failed`, because in both the text reached neither
 *    the cursor nor the clipboard.
 *  - `Retried once` is `retry_of`, and it says "once" because the record links
 *    exactly one level — an entry names the entry it retried, and the runtime
 *    keeps no count. A second retry of the same capture is a third record, not
 *    a "twice".
 *  - `Audio swept` is NOT drawn on every record whose audio is gone, and this
 *    is the one place the derivation departs from the drawing's sample. A
 *    successful run deletes its audio, so that badge would sit on nearly every
 *    row — which is precisely the defect §11.20 names, two thirds of a list
 *    reporting that things went as expected. "The audio is gone" belongs on the
 *    control it affects, and it is already there: Retry disables itself and
 *    says why. The badge appears only where the fact is unexpected — a record
 *    that FAILED, which you would reasonably retry, and cannot.
 */
export function badgesFor(entry: TranscriptionHistoryEntry): ListItemBadge[] {
  const badges: ListItemBadge[] = [];

  if (entry.status === "failed") badges.push({ text: "Failed", tone: "danger" });
  else if (entry.status === "empty") badges.push({ text: "Empty", tone: "warning" });

  switch (entry.insert_mode) {
    case "clipboard_only":
      badges.push({ text: "Clipboard only", tone: "warning" });
      break;
    case "clipboard_fallback":
      badges.push({ text: "Clipboard", tone: "warning" });
      break;
    case "scratchpad_fallback":
      badges.push({ text: "Insert failed", tone: "danger" });
      break;
    case "direct_paste":
      if (entry.pasted === false) badges.push({ text: "Insert failed", tone: "danger" });
      break;
    default:
      break;
  }

  if (entry.retry_of) badges.push({ text: "Retried once", tone: "plan" });
  if (entry.status === "failed" && !entry.audio_path) {
    badges.push({ text: "Audio swept", tone: "plan" });
  }

  return badges;
}

/**
 * The record's two texts. `heard` is what the recogniser returned — the
 * provider's `response.text`, before any transform — and `written` is what was
 * delivered.
 *
 * THE FOOT'S SENTENCE IS NOT A STRING COMPARISON, and getting that wrong was a
 * real defect. `RawPanel`'s default reads "Identical — no AI stage ran on this
 * one", which is a claim about whether a STAGE RAN; equal texts are not
 * evidence for it. Measured against the owner's machine on 2026-08-10: 50 of
 * 142 records have identical texts and **an AI stage ran on all 50**, so the
 * default sentence would have been false on every one of them. The runtime
 * holds the evidence — `corrected` and `applied_rules` — so it is read here and
 * the third state gets its own sentence.
 */
export function rawOf(entry: TranscriptionHistoryEntry): RawTranscript {
  const heard = entry.raw_transcript ?? "";
  const written = entry.transformed_transcript ?? entry.raw_transcript ?? "";
  const identical = heard === written;
  const stageRan = entry.corrected || entry.applied_rules.length > 0;

  return {
    heard,
    written,
    same: identical && !stageRan,
    /* The record's own file, which the drawing puts in this panel and which
       the runtime writes since ADR 0074. Absent on a record with no text. */
    path: entry.transcript_path ?? undefined,
    note:
      entry.transform_warning ??
      (identical && stageRan ? "The AI stage ran and changed nothing." : undefined),
  };
}

/** Which of a record's three readings the row titles carry (ADR 0070, 0078). */
export type ShownText = "title" | "written" | "heard";

const SHOWN_TEXT_OPTIONS = [
  { value: "title", label: "Title" },
  { value: "written", label: "Written" },
  { value: "heard", label: "Heard" },
];

/**
 * WHICH OF A RECORD'S THREE READINGS ITS ROW CARRIES — ADR 0070, extended by
 * ADR 0078.
 *
 * `title` is the default and it is what the model named the record (ADR 0077).
 * A list of 174 rows each opening with the first sentence of a dictation cannot
 * be scanned — every row starts mid-thought, and the eye has nothing to land
 * on. The title is the same string the transcript's filename is built from, so
 * the folder and this list agree about what a record is called.
 *
 * `written` is the drawing's own reading and what the screen showed before: a
 * record of what you GOT, which is what was delivered.
 *
 * `heard` shows the recogniser's own words in the same rows, which is the
 * reading the screen could not give at all before ADR 0070 — the pair was one
 * click deep behind *View raw*, per record, and judging transcription accuracy
 * means scanning rather than opening 174 folds. That job is why the segment
 * keeps all three rather than being replaced by the title.
 *
 * TWO DIFFERENT FALLBACK RULES, AND THE DIFFERENCE IS THE POINT.
 *
 * `title` falls back to the written text, because a record from before ADR 0077
 * — or one the model could not name — still has to say something, and its own
 * words are the honest stand-in. Nothing is claimed by that: the segment says
 * `Title` and the row shows the record's opening, which is what a title would
 * have been made from.
 *
 * `heard` does NOT fall back. If the recogniser produced nothing, the row says
 * so; borrowing the transformed text under a control that says "Heard" would
 * put the AI's sentence behind a label promising the opposite, which is the
 * fake-readiness rule applied to a word instead of a state.
 */
export function titleOf(entry: TranscriptionHistoryEntry, shows: ShownText): string {
  if (shows === "title") {
    const named = (entry.title ?? "").trim();
    if (named) return named;
  }
  const text =
    shows === "heard"
      ? (entry.raw_transcript ?? "").trim()
      : (entry.transformed_transcript ?? entry.raw_transcript ?? "").trim();
  if (text) return text;
  if (entry.status === "failed") return entry.error ?? "Transcription failed.";
  return "Nothing was heard in this capture.";
}

/** THE ONE LIST BOTH PATHS PRODUCE. A drawn row carries no `act`, which is what
 *  keeps the gallery from asserting that anything can be done to it. */
interface HistoryRow {
  id: string;
  title: string;
  meta: string[];
  badges?: ListItemBadge[];
  raw: RawTranscript;
  retryDisabledReason?: string;
  restorable: boolean;
  /** The record's own file, where it wrote one (ADR 0074). */
  transcriptPath?: string | null;
  act?: {
    reveal: () => void;
    retry: () => void;
    remove: () => void;
    restore: () => void;
    copy: () => void;
  };
}

const STATUS_FILTERS: { value: "" | TranscriptionHistoryStatus; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "completed", label: "Completed" },
  { value: "empty", label: "Empty" },
  { value: "failed", label: "Failed" },
];

/** A filter is not config, so the search box debounces its own query rather
 *  than reaching for `patchText` — nothing here is saved anywhere. */
const SEARCH_DEBOUNCE_MS = 250;

/** A record that produced no text has no file (ADR 0074), and that is the only
 *  remaining case — the same shape Retry already has on a record whose audio
 *  was swept. The reason IS the label, because `IconButton`'s label is its
 *  tooltip and a disabled control with no explanation is the same defect
 *  quieter. */
/**
 * WHY A RETRY CANNOT RUN, OR NOTHING — and it is the RUNTIME's rule rather than
 * a guess at it.
 *
 * `retry_transcription_history_entry` has two paths: with a raw transcript it
 * re-runs the transform, and only without one does it need the kept capture to
 * re-transcribe from. So the single condition that matters is "is there
 * anything left to work from", and a record that has neither says which.
 *
 * The screen used to disable Retry on a missing `audio_path` alone. A
 * successful run deletes its audio, so that greyed the control out on every
 * completed record — the entire set somebody would actually want to re-run
 * after fixing a profile or changing a model, which since ADR 0075 re-runs in
 * the record's own mode.
 */
export function retryDisabledReason(entry: TranscriptionHistoryEntry): string | undefined {
  const hasTranscript = Boolean((entry.raw_transcript ?? "").trim());
  if (hasTranscript || entry.audio_path) return undefined;
  return "Retry — no transcript and no recording left to re-run";
}

const REVEAL_HAS_NO_FILE =
  "Show in file manager — this run produced no text, so no file was written";

export function HistoryScreen({ banner, runtime }: WiredScreenProps) {
  const {
    entries,
    storagePath,
    transcriptRoot,
    reveal,
    error,
    refresh,
    remove,
    retry,
    exportEntries,
  } = useTranscriptionHistory(runtime.active);

  const [openRaw, setOpenRaw] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | TranscriptionHistoryStatus>("");
  /* NOT A FILTER, WHICH IS WHY IT IS NOT A SELECT BESIDE THE ONE ABOVE IT: it
     narrows nothing and the count does not move. It is which of two texts the
     list is showing, and a segment shows both readings and the current one at
     once — a reader scanning for recogniser errors has to be able to see which
     text they are scanning without opening a control to find out. */
  const [shows, setShows] = useState<ShownText>("title");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = useMemo(
    () => ({ search: search || undefined, status: status || undefined }),
    [search, status],
  );

  useEffect(() => {
    if (!runtime.active) return;
    if (searchTimer.current !== null) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void refresh(query, { background: true });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchTimer.current !== null) clearTimeout(searchTimer.current);
    };
  }, [runtime.active, query, refresh]);

  const act = useCallback(async (id: string, run: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await run();
    } finally {
      setBusyId(null);
    }
  }, []);

  const onExport = useCallback(async () => {
    const path = await save({
      defaultPath: "wordscript-history.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    const response = await exportEntries(path, query);
    if (response) {
      setNotice(
        `Exported ${response.exported_count} ${
          response.exported_count === 1 ? "entry" : "entries"
        } to ${response.path}.`,
      );
    }
  }, [exportEntries, query]);

  const rows: HistoryRow[] = entries.map((entry) => {
        const text = entry.transformed_transcript ?? entry.raw_transcript ?? "";
        return {
          id: entry.id,
          title: titleOf(entry, shows),
          meta: [
            historyTime(entry.created_at_ms),
            PROCESSING_MODE_LABELS[entry.work_mode?.processing_mode ?? "auto"],
            entry.active_profile ?? "No profile recorded",
          ],
          badges: badgesFor(entry),
          raw: rawOf(entry),
          retryDisabledReason: retryDisabledReason(entry),
          /* Offered where the text did not reach the cursor — the one case
             where placing it again is a thing to do. */
          restorable:
            entry.insert_mode === "clipboard_only" ||
            entry.insert_mode === "clipboard_fallback" ||
            entry.insert_mode === "scratchpad_fallback",
          /* The file exists exactly where the record names one. */
          transcriptPath: entry.transcript_path,
          act: {
            reveal: () => void reveal(entry.transcript_path),
            retry: () => void act(entry.id, () => retry(entry.id)),
            remove: () => void act(entry.id, () => remove(entry.id)),
            restore: () =>
              void act(entry.id, () =>
                invoke("insert_text_native", {
                  request: { text, source: "history_restore", corrected: entry.corrected },
                }),
              ),
            copy: () => void navigator.clipboard.writeText(text),
          },
        };
  });

  const count = rows.length;
  /* The count is the result of the filters, so it says which set it counted
     rather than implying it is everything on the machine. */
  const filtered = Boolean(search || status);
  const heading = filtered
    ? `${count} ${count === 1 ? "match" : "matches"}`
    : `${count} ${count === 1 ? "transcription" : "transcriptions"}`;

  /* THE DRAWN SENTENCE IS TRUE AGAIN (ADR 0074). Leg 4c replaced it with the
     one file the runtime kept, because a product may not send somebody to a
     folder that is not there. The folder is there now, so the claim goes back
     — with the resolved root rather than the drawing's `~/WordScript/…`, since
     the root follows `WORDSCRIPT_DATA_DIR` and this sentence is about THIS
     machine. The index is named after it: it is where a retry reads from and
     is the second thing a reader of this foot may want to find. */
  const foot =
    notice ??
    `Every transcript is a Markdown file in ${
      transcriptRoot ?? "~/WordScript/transcripts"
    }. Kept ${runtime.config.history_retention_days} days, capped at ${
      runtime.config.history_limit
    } entries${storagePath ? `, indexed in ${storagePath}` : ""}.`;

  return (
    <>
      <ViewTop title="History" lead="Every transcription kept on this machine." banner={banner} />

      <Toolbar
        label="Filters"
        right={
          <Button variant="ghost" icon={<Icon name="download" />} onClick={() => void onExport()}>
            Export
          </Button>
        }
      >
        <ToolbarSearch>
          <Field
            placeholder="Search transcripts…"
            aria-label="Search transcripts"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </ToolbarSearch>
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value as "" | TranscriptionHistoryStatus)}
          aria-label="Status"
        >
          {STATUS_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </Select>
        <SegmentControl
          aria-label="Show"
          value={shows}
          onChange={(next) => setShows(next as ShownText)}
          options={SHOWN_TEXT_OPTIONS}
        />
      </Toolbar>

      <SectionHeader title={heading}>
        <Card>
          {count === 0 ? (
            <EmptyState icon={<Icon name="history" />}>
              {error ??
                (filtered
                  ? "No transcription on this machine matches those filters."
                  : "Nothing has been transcribed on this machine yet.")}
            </EmptyState>
          ) : (
            <ListRows>
              {rows.map((row) => (
                <TranscriptRow
                  key={row.id}
                  title={row.title}
                  meta={row.meta}
                  badges={row.badges}
                  raw={row.raw}
                  retryDisabledReason={row.retryDisabledReason}
                  restorable={row.restorable}
                  busy={busyId === row.id}
                  open={openRaw === row.id}
                  onToggleRaw={() => setOpenRaw((id) => (id === row.id ? null : row.id))}
                  revealDisabledReason={
                    row.transcriptPath ? undefined : REVEAL_HAS_NO_FILE
                  }
                  onReveal={row.act?.reveal}
                  onRetry={row.act?.retry}
                  onDelete={row.act?.remove}
                  onRestore={row.act?.restore}
                  onCopy={row.act?.copy}
                />
              ))}
            </ListRows>
          )}
        </Card>
      </SectionHeader>

      {/* The pairing with Privacy & Data, stated from this side too (§11.51):
          this screen is the records, that one is the rule about them. */}
      <Note icon="privacy" tail={<DocLink>Change the rule in Privacy &amp; Data</DocLink>}>
        {foot}
      </Note>
    </>
  );
}
