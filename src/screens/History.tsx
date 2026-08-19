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
  SegmentControl,
  Select,
  Toolbar,
  ToolbarSearch,
  TranscriptRow,
  UndoNotice,
  ViewTop,
} from "@/components/shell";
import type { ListItemBadge, RawTranscript } from "@/components/shell";
import { useTranscriptionHistory } from "@/hooks/useTranscriptionHistory";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
import { PROCESSING_MODE_LABELS } from "@/lib/transformRules";
import type {
  TranscriptionHistorySummary,
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
 * `TranscriptionHistorySummary` already carries, and stated here rather than in a
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
 *
 *    AND THE FIRST TWO ARE GREY (ADR 0193). They carried `warning`, which paints
 *    them in `--accent` — the product's orange, the same colour as its primary
 *    button. On a machine whose profile is clipboard-only that is every row in
 *    the list glowing amber about a setting the reader chose, which is the
 *    §11.20 defect stated in colour rather than in count: when the healthy case
 *    is loud, the failing one has nothing to stand out from. A DELIVERY MODE IS
 *    A FACT ABOUT HOW THE TEXT ARRIVED, NOT A WARNING. `Failed`, `Empty`,
 *    `Insert failed` and `Audio missing` keep `danger` and are unchanged: those
 *    four say something went wrong, and one of them says the text itself is
 *    incomplete.
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
 *  - `Audio missing` is the `short` verdict and nothing else (ADR 0079). It
 *    passes the same test the others do: a healthy capture is the expectation
 *    and draws nothing, and this badge marks the record whose text is missing
 *    content no downstream stage can see. It leads, because it is the only
 *    badge here that says the TEXT is wrong rather than that the delivery was.
 */
export function badgesFor(entry: TranscriptionHistorySummary): ListItemBadge[] {
  const badges: ListItemBadge[] = [];

  if (entry.capture_integrity?.verdict === "short") {
    badges.push({ text: "Audio missing", tone: "danger" });
  }

  if (entry.status === "failed") badges.push({ text: "Failed", tone: "danger" });
  else if (entry.status === "empty") badges.push({ text: "Empty", tone: "warning" });

  switch (entry.insert_mode) {
    case "clipboard_only":
      badges.push({ text: "Clipboard only", tone: "neutral" });
      break;
    case "clipboard_fallback":
      badges.push({ text: "Clipboard", tone: "neutral" });
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
 *
 * A SHORT CAPTURE OUTRANKS BOTH OTHER NOTES (ADR 0079). The other two describe
 * what the AI stage did to the text; this one says the text is missing content
 * that was never recorded, which changes how everything above it should be
 * read. A transform warning about an over-shortened correction is the smaller
 * fact when half the audio is gone, so it goes second.
 *
 * TEXTS THAT DIFFER GET A SENTENCE TOO NOW (ADR 0204). "The AI stage rewrote
 * it" was the panel's default for every one of them, and on 2026-08-16 it sent
 * a defect report at the wrong stage: the difference was WordScript's own
 * prompt strip, the AI stage had returned the text it was given, and the record
 * said which — `applied_rules` sat in this function, read one line above for
 * `stageRan` and never consulted for the sentence.
 */
export function rawOf(entry: TranscriptionHistorySummary): RawTranscript {
  /* THE PREVIEWS, AND `same` IS NOT DERIVED FROM THEM (ADR 0240). The row
     carries 160 characters of each text; two cuts can agree where the whole
     texts do not, so the comparison is made in the runtime against the full
     ones and travels as a flag. The panel fills in the rest of the text when
     the record arrives — see `openRecord` on the screen below. */
  const heard = entry.heard_preview;
  const written = entry.written_preview;
  const identical = entry.transcripts_identical;
  const stageRan = entry.corrected || entry.applied_rules.length > 0;

  return {
    heard,
    written,
    same: identical && !stageRan,
    /* The record's own file, which the drawing puts in this panel and which
       the runtime writes since ADR 0074. Absent on a record with no text. */
    path: entry.transcript_path ?? undefined,
    note:
      // Ahead of the gap note: a record that ends mid-sentence is explained by
      // the ceiling before it is explained by anything about the audio.
      stoppedByRuntimeNote(entry) ??
      captureGapNote(entry) ??
      entry.transform_warning ??
      (identical
        ? stageRan
          ? "The AI stage ran and changed nothing."
          : undefined
        : changedTextNote(entry, heard, written)),
  };
}

/**
 * WHAT CHANGED, WHERE THE RUNTIME NAMED IT — never a list of rule ids.
 *
 * Two things go into a sentence and neither is a string comparison on its own:
 *
 * **The rules WordScript ran itself**, which are deterministic, run before the
 * mode branch (ADR 0080, ADR 0081) and are the ones a reader keeps mistaking
 * for the AI stage. They are named, one clause each.
 *
 * **The shape of the difference**, which is the only thing this screen can
 * prove about the AI stage: if every word of *Written* appears in *Heard* in
 * the same order, then nothing was added and no word was swapped for another —
 * whatever else happened, the meaning was not rewritten. That is the claim
 * whose absence cost a wrong diagnosis, and it is checkable here.
 *
 * What it deliberately does not do: attribute a specific word to a specific
 * stage. The panel holds two texts and a rule list, not the text between the
 * stages, and a sentence claiming more than that is the failure class this
 * record belongs to committed by the instrument. `post_corrected` is on the
 * record that produced this defect and its whole effect there was one leading
 * and one trailing space, so "a rule fired" is not evidence of a rewrite and is
 * not treated as one.
 */
function changedTextNote(
  entry: TranscriptionHistorySummary,
  heard: string,
  written: string,
): string | undefined {
  const repairs = [
    entry.applied_rules.includes("prompt_echo_stripped")
      ? "removed its own prompt from this"
      : undefined,
    entry.applied_rules.includes("singular_address_restored")
      ? "repaired the address the recogniser pluralized"
      : undefined,
  ].filter((clause): clause is string => Boolean(clause));

  const removedOnly = onlyRemovedWords(heard, written);

  if (repairs.length === 0) {
    /* No rule of WordScript's own, so the difference is the AI stage's and the
       panel's own default says so. The one thing worth adding is the shape:
       a cleanup that dropped fillers and invented nothing is the case this
       cluster spends its time trying to tell apart from the other one. */
    return removedOnly ? "The AI stage removed words and added none." : undefined;
  }

  return (
    `WordScript ${repairs.join(" and ")}. ` +
    (removedOnly
      ? "Nothing else was added or reworded."
      : "Anything else that differs is the AI stage's.")
  );
}

/**
 * Whether *Written* is *Heard* with words taken out and none put in.
 *
 * A subsequence test over whitespace-separated words, which is the strongest
 * claim available from two strings: a word that was replaced breaks it, a word
 * that was added breaks it, and re-spacing does not. It is deliberately not a
 * diff — the panel does not need to know WHICH words went, only that nothing
 * arrived that the recogniser never said.
 */
function onlyRemovedWords(heard: string, written: string): boolean {
  const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);
  const source = words(heard);
  const kept = words(written);

  /* A delivery with no words left is not "words removed" in any sense a reader
     would recognise, and a sentence saying nothing was added would read as
     reassurance over a text that is gone. */
  if (kept.length === 0) return false;

  let at = 0;
  for (const word of kept) {
    while (at < source.length && source[at] !== word) at += 1;
    if (at >= source.length) return false;
    at += 1;
  }
  return true;
}

/**
 * The sentence a short capture puts on its record, or nothing at all.
 *
 * Only `short` produces one. `intact` is the expected case and gets no sentence
 * — a note on every healthy record is the same noise §11.20 rejects badges for
 * — and `not_measured` gets none either, because "we did not look" is not a
 * finding to report to the user; it is visible to a measurement reading the
 * field and that is where it belongs.
 */
export function captureGapNote(entry: TranscriptionHistorySummary): string | undefined {
  const integrity = entry.capture_integrity;
  if (!integrity || integrity.verdict !== "short") return undefined;

  const missing = Math.round(integrity.missing_ratio * 100);
  return (
    `This capture recorded ${Math.round(integrity.recorded_seconds)} s of the ` +
    `${Math.round(integrity.wall_seconds)} s it ran. ${missing} % of the audio was never ` +
    `captured, so the text is of what was recorded, not of what was said.`
  );
}

/**
 * The sentence a record puts on itself when the USER did not end the recording.
 *
 * The runtime already knows this and used to keep it to a log that rotates, so a
 * dictation the ceiling cut off mid-sentence read exactly like one the speaker
 * finished. That is the whole complaint this note answers: not that the ceiling
 * exists, but that nothing said it had been reached.
 *
 * Nothing on an ordinary stop — the reader released the key and is the reason.
 */
export function stoppedByRuntimeNote(
  entry: TranscriptionHistorySummary
): string | undefined {
  const reason = entry.capture_stop_reason?.trim();
  return reason ? `WordScript ended this recording: ${reason}` : undefined;
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
export function titleOf(entry: TranscriptionHistorySummary, shows: ShownText): string {
  if (shows === "title") {
    const named = (entry.title ?? "").trim();
    if (named) return named;
  }
  const text = shows === "heard" ? entry.heard_preview.trim() : entry.written_preview.trim();
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

/**
 * HOW MANY RECORDS STAND ON ONE PAGE (ADR 0184).
 *
 * TWENTY-FIVE IS THE DEFAULT AND IT IS THE FLOOR OF THE CAP RATHER THAN A ROUND
 * NUMBER. `history_limit` was clamped to 25–1000 in the runtime, so twenty-five
 * is the smallest record this product can hold: at the ceiling of a thousand it
 * is forty pages, and on the smallest possible history it is exactly one — the
 * page control appears when there is something to page through and not before.
 * ADR 0185 has since pinned that field to the ceiling, so a full index is now
 * the case to size for rather than the edge of one.
 *
 * A row here is three lines of text and six controls. Ten pages a record nobody
 * can scan; a hundred is a scroll a reader loses their place in, which is the
 * complaint that started this. Both are offered because *scan a lot quickly* and
 * *work through a few carefully* are different jobs on the same screen.
 */
const PAGE_SIZES = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

/** A record's month, as the filter keys it: `2026-08`, which sorts as a string
 *  and matches the `YYYY/MM/` folders the transcripts themselves are written
 *  into (ADR 0074). */
export function monthKey(at: number): string {
  const date = new Date(at);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** `2026-08` as `August 2026`. Through `Intl` rather than a table of twelve
 *  names, for the reason the calendar's language labels go through it: a second
 *  list of month names in this repository is a second list to get wrong. */
export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );
}

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
export function retryDisabledReason(entry: TranscriptionHistorySummary): string | undefined {
  /* The preview is empty exactly where the transcript is (ADR 0240) — the cut
     keeps 160 characters, so it can never empty a text that had one. */
  const hasTranscript = Boolean(entry.heard_preview.trim());
  if (hasTranscript || entry.audio_path) return undefined;
  return "Retry — no transcript and no recording left to re-run";
}

const REVEAL_HAS_NO_FILE =
  "Show in file manager — this run produced no text, so no file was written";

export function HistoryScreen({ banner, runtime }: WiredScreenProps) {
  const {
    entries,
    record,
    deliveredText,
    reveal,
    error,
    refresh,
    remove,
    retry,
    exportEntries,
  } = useTranscriptionHistory(runtime.active);

  const [openRaw, setOpenRaw] = useState<string | null>(null);
  /**
   * THE WHOLE TEXT OF THE ONE ROW THAT IS OPEN (ADR 0240).
   *
   * The list carries 160 characters of each transcript, which is the whole text
   * for most records — the median delivered text on the reporting machine is 135
   * characters. The panel opens on the preview IMMEDIATELY and fills in when the
   * record arrives, rather than waiting on a round trip: a spinner over text
   * that is already correct in half the cases is worse than a paragraph that
   * grows once.
   */
  const [openText, setOpenText] = useState<{
    id: string;
    heard: string;
    written: string;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | TranscriptionHistoryStatus>("");
  /* NOT A FILTER, WHICH IS WHY IT IS NOT A SELECT BESIDE THE ONE ABOVE IT: it
     narrows nothing and the count does not move. It is which of two texts the
     list is showing, and a segment shows both readings and the current one at
     once — a reader scanning for recogniser errors has to be able to see which
     text they are scanning without opening a control to find out. */
  const [shows, setShows] = useState<ShownText>("title");
  /* PAGED IN THE SCREEN AND NOT IN THE QUERY (ADR 0184). The runtime already
     hands over the whole filtered set — capped at `history_limit`, which is
     1000 at its widest — and it is the same set the count in the heading is read
     off. Asking the runtime for a window instead would mean two round trips per
     page and a count that no longer matches what was counted. */
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(0);
  /* ALL TIME IS THE DEFAULT AND THE MONTH IS THE EXCEPTION (ADR 0184). The
     transcripts are written into `YYYY/MM/` folders, and a reader who knows
     they wrote something *in June* has had no way to say so — but the list they
     land on is still the whole record, because the common question is *what did
     I dictate* and only the follow-up is *when*.

     IT NARROWS IN THE BROWSER RATHER THAN IN THE QUERY, unlike the search and
     the status, and that is not an inconsistency: the runtime's query has no
     month field, the whole set is already here, and adding one would mean the
     month list and the list itself could disagree about which months exist. */
  const [month, setMonth] = useState("");
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

  /* A NARROWED SET IS A NEW SET, so it starts at its own first page. Without
     this, searching from page four lands on a page the result does not have and
     the reader sees an empty card under a pager that counts matches. */
  useEffect(() => {
    setPage(0);
  }, [query, month]);

  /* THE MONTHS THE RECORD ACTUALLY HOLDS, newest first — never a run of twelve
     with nothing behind most of them. Read off the entries the runtime returned
     rather than off the month filter's own result, or choosing June would leave
     June as the only month there had ever been. */
  const months = useMemo(() => {
    const seen = new Set<string>();
    for (const item of entries) seen.add(monthKey(item.created_at_ms));
    return [...seen].sort((left, right) => right.localeCompare(left));
  }, [entries]);

  const act = useCallback(async (id: string, run: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await run();
    } finally {
      setBusyId(null);
    }
  }, []);

  /* DELETE IS HELD BACK FOR SIX SECONDS RATHER THAN CONFIRMED (ADR 0195). The
     runtime's delete takes the transcript file with it and cannot be undone, so
     the window is this screen holding the row back — the `invoke` fires when the
     window closes and not before. */
  const trash = useUndoableDelete(
    useCallback((id: string) => void act(id, () => remove(id)), [act, remove]),
  );

  /* A ROW INSIDE ITS UNDO WINDOW IS NOT DRAWN AND IS NOT DELETED (ADR 0195).
     The filter is here rather than at the render, so the count, the pager and
     the empty state all agree with the list — a record hidden from the rows
     while a pager still counted it would report `1–25 of 60` over
     twenty-four. */
  const visible = useMemo(() => {
    const inMonth = month
      ? entries.filter((item) => monthKey(item.created_at_ms) === month)
      : entries;
    return trash.pending ? inMonth.filter((item) => !trash.hides(item.id)) : inMonth;
  }, [entries, month, trash.pending, trash.hides]);

  useEffect(() => {
    if (!openRaw) {
      setOpenText(null);
      return;
    }
    let live = true;
    void record(openRaw).then((found) => {
      if (!live) return;
      /* A record the store no longer holds leaves the preview standing, which is
         the honest thing: it is what the row was drawn from. */
      if (!found) return;
      const heard = found.raw_transcript ?? "";
      setOpenText({
        id: openRaw,
        heard,
        written: found.transformed_transcript ?? heard,
      });
    });
    return () => {
      live = false;
    };
  }, [openRaw, record]);

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

  const rows: HistoryRow[] = visible.map((entry) => {
        /* The panel's own text where this is the open row and the record has
           come back, the preview until then (ADR 0240). */
        const whole = openText?.id === entry.id ? openText : null;
        const raw = rawOf(entry);
        return {
          id: entry.id,
          title: titleOf(entry, shows),
          meta: [
            historyTime(entry.created_at_ms),
            PROCESSING_MODE_LABELS[entry.processing_mode ?? "auto"],
            entry.active_profile ?? "No profile recorded",
          ],
          badges: badgesFor(entry),
          raw: whole ? { ...raw, heard: whole.heard, written: whole.written } : raw,
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
            /* Not `remove` — the window is (ADR 0195). The row goes now and the
               runtime is told in six seconds. */
            remove: () => trash.request(entry.id, titleOf(entry, shows)),
            /* THE WHOLE TEXT, FETCHED WHEN THE BUTTON IS PRESSED (ADR 0240).
               Placing or copying a preview would place or copy a truncated
               dictation — the one case where the cut would be a data loss
               rather than a display. One record over the bridge, on a press. */
            restore: () =>
              void act(entry.id, async () => {
                const text = await deliveredText(entry.id);
                if (text === null) return;
                await invoke("insert_text_native", {
                  request: { text, source: "history_restore", corrected: entry.corrected },
                });
              }),
            copy: () =>
              void deliveredText(entry.id).then((text) => {
                if (text === null) return;
                return navigator.clipboard.writeText(text);
              }),
          },
        };
  });

  const count = rows.length;
  /* Which set the list is showing — filtered or the whole record — which the
     empty state says in words when there is nothing to draw. */
  const filtered = Boolean(search || status || month);

  /* THE PAGE IS CLAMPED RATHER THAN REMEMBERED. Deleting the last record on page
     four, or typing one more letter into the search, leaves a page number with
     nothing behind it — and an empty list under a pager that counts thirty
     matches reads as a broken screen rather than as a page that ended. */
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const current = Math.min(page, pages - 1);
  const from = current * pageSize;
  const shown = rows.slice(from, from + pageSize);

  /* THE STANDING SENTENCE IS GONE (ADR 0184), and what it said is not lost —
     it is offered instead of recited. It named the transcripts folder, the
     index file, the retention days and the cap, on every visit, under every
     list, whether or not anybody was going to act on any of it: four facts of
     furniture at the foot of a working screen. The folder is a button now and
     the two numbers live in Privacy & Data, one press away on the same toolbar.
     What remains here is the one line that is NOT standing — what an export just
     did, which nothing else on the screen reports. */

  return (
    <>
      <ViewTop title="History" lead="Every transcription kept on this machine." banner={banner} />

      {/* THE TOOLBAR HAS THREE JOBS AND NOW READS IN THAT ORDER (ADR 0184).
          It grew one control at a time and ended up as a line of four unrelated
          things, so a reader had to read each one to find out what it did.
          Left to right: WHICH RECORDS (search, status) — WHAT A ROW SHOWS AND
          HOW MANY (the text segment, the page size) — WHAT TO DO WITH THE SET
          (export it, open the folder it lives in). The label follows: `Filters`
          was already wrong for the segment, and two more non-filters would have
          made it a lie. */}
      <Toolbar
        label="Records, view and actions"
        right={
          <>
            <Button variant="ghost" icon={<Icon name="download" />} onClick={() => void onExport()}>
              Export
            </Button>
            {/* THE FOLDER, WHICH THE FOOT HAS NAMED ALL ALONG. The sentence
                under the list has stated the path since ADR 0074 and left the
                reader to find it themselves; `reveal_transcript_in_file_manager`
                opens exactly that directory when it is handed no file, and
                creates it first on a machine that has not dictated yet. */}
            <Button variant="ghost" icon={<Icon name="folder" />} onClick={() => void reveal(null)}>
              Open folder
            </Button>
            {/* AND THE DOOR TO THE RULE THAT GOVERNS ALL OF THIS. The foot has
                stated for three legs how long a record is kept, and the only
                way to change it was to go and find Privacy & Data yourself.
                Since ADR 0185 there is one rule there rather than two, and the
                count is that screen's stated ceiling rather than a second
                picker. The folder itself is not settable —
                `transcripts_dir()` follows `WORDSCRIPT_DATA_DIR` and nothing in
                the UI — so what this button offers is what a reader can actually
                change, and it says which. */}
            {/* A SECTION AND NOT A VIEW, WHICH IS WHY THE FIRST BUILD OF THIS
                BUTTON DID NOTHING. `privacy` is in `SECTIONS` — Privacy & Data
                is a pane of the settings sheet, and `ViewId` is the four
                workspace views. `open` refuses an id neither list knows rather
                than guessing, so `{ view: "privacy" }` was a press that
                silently went nowhere. */}
            <Button
              variant="ghost"
              icon={<Icon name="arrow" />}
              title="How long these are kept — in Privacy & Data"
              onClick={() => runtime.open?.({ section: "privacy" })}
            >
              Retention rules
            </Button>
          </>
        }
      >
        {/* THE MONTH IS FIRST AND IS ALWAYS THERE. First because it is the
            coarsest of the three — you pick a stretch of time, then search
            inside it — and always because a control that appears once a record
            crosses a month boundary is a control nobody learns is there. On a
            one-month record it holds `All time` and that month, which is a
            question with one answer and is still worth the line: it says what
            this list is scoped to, which is the thing a reader coming back after
            a year needs to know first. */}
        <Select
          value={month}
          aria-label="Month"
          onChange={(event) => setMonth(event.target.value)}
        >
          <option value="">All time</option>
          {months.map((key) => (
            <option key={key} value={key}>
              {monthLabel(key)}
            </option>
          ))}
        </Select>
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
        <Select
          value={String(pageSize)}
          aria-label="Per page"
          onChange={(event) => {
            const next = Number(event.target.value);
            /* THE READER KEEPS THEIR PLACE. Changing the page size while on page
               four and landing back at page one is the same lost-your-place
               complaint this control exists to answer; the record at the top of
               the page stays at the top of the page. */
            setPage(Math.floor(from / next));
            setPageSize(next);
          }}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size} per page
            </option>
          ))}
        </Select>
      </Toolbar>

      {/* THE ROW THAT JUST LEFT, AND THE WAY BACK TO IT (ADR 0195). It stands
          where the list starts rather than floating over it, because the reader
          is looking at the list and the fact is about a row that was in it. */}
      {trash.pending && <UndoNotice what={trash.pending.title} onUndo={trash.undo} />}

      {/* NO COUNT OVER THE LIST ANY MORE (ADR 0184). `N transcriptions` was the
          heading of this section, and the pager under the list now says
          `26–50 of 60` — which is the same figure with the reader's position
          added, on the control they are already looking at when they want it.
          Two counts of one set is one more than a screen needs, and the one that
          went is the one that could only ever say how many. */}
      <Card
          /* THE PAGE CONTROL IS AT THE FOOT OF THE LIST IT PAGES, and only when
             there is more than one page: a control that says `1 of 1` is
             furniture, and this screen already refuses to draw a standing
             all-clear elsewhere. The range is spelled out rather than left to
             the page number, because *which records am I looking at* is the
             question a page number only half answers. */
          footer={
            pages > 1 ? (
              <span className="ws-pager">
                <Button
                  variant="ghost"
                  disabled={current === 0}
                  onClick={() => setPage(current - 1)}
                  aria-label="Previous page"
                >
                  Previous
                </Button>
                <span className="ws-pager-at">
                  {`${from + 1}–${Math.min(count, from + pageSize)} of ${count}`}
                  <span className="ws-sep">·</span>
                  {`page ${current + 1} of ${pages}`}
                </span>
                <Button
                  variant="ghost"
                  disabled={current >= pages - 1}
                  onClick={() => setPage(current + 1)}
                  aria-label="Next page"
                >
                  Next
                </Button>
              </span>
            ) : undefined
          }
        >
          {count === 0 ? (
            <EmptyState icon={<Icon name="history" />}>
              {error ??
                (filtered
                  ? "No transcription on this machine matches those filters."
                  : "Nothing has been transcribed on this machine yet.")}
            </EmptyState>
          ) : (
            <ListRows>
              {shown.map((row) => (
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

      {/* WHAT AN EXPORT JUST DID, AND NOTHING ELSE. The standing sentence that
          stood here — the folder, the index, the retention days, the cap — is
          gone with ADR 0184: it recited four facts under every visit, and all
          four are now behind controls on the toolbar. This appears only when
          there is something to report, which on this screen is one action.
          The link goes with it and acts, which it never did: it was an
          `<a href="#">` with no handler, the one door here that looked like a
          door and was a drawing. */}
      {notice && (
        <Note
          icon="privacy"
          tail={
            <DocLink onClick={() => runtime.open?.({ section: "privacy" })}>
              Privacy &amp; Data
            </DocLink>
          }
        >
          {notice}
        </Note>
      )}
    </>
  );
}
