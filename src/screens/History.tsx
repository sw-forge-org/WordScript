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
import { HISTORY, rawOf as drawnRawOf } from "./data";
import type { PartlyWiredScreenProps } from "./props";

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
 * FIVE OF THE SIX ROW CONTROLS ACT, and the sixth is one of the two reasons
 * this screen keeps its banner:
 *
 *  - **View raw** unfolds the record's two texts.
 *  - **Retry** is `retry_transcription_history_entry`, disabled on a record
 *    whose audio has been swept because there is nothing to re-run (ADR 0039).
 *  - **Restore to cursor** is `insert_text_native` with the record's written
 *    text, offered only where the delivery did not reach the cursor.
 *  - **Copy** is the clipboard, the same call About's version row makes.
 *  - **Delete** is `delete_transcription_history_entry`.
 *  - **Show in file manager has neither a path nor a command.** There is one
 *    `history.json` under the user data dir and no per-transcript file; no
 *    reveal command exists in the runtime at all. The button stays drawn and is
 *    DISABLED with the reason as its tooltip (ADR 0065).
 *
 * AND THE FOOT NO LONGER CLAIMS A FOLDER THAT IS NOT THERE — the second reason.
 * The drawing says "Every transcript is a Markdown file in
 * ~/WordScript/transcripts". It is not:
 * `transcription_history_storage_status` answers with the one file the runtime
 * actually keeps, and on the product that is what the sentence states. This is
 * the same shape as General's device hint — the drawing drew one member of a
 * runtime-derived sentence and the wired path produces the family — rather than
 * a copy edit to make wiring easier. The Markdown-file PROMISE is a Leg 5
 * contract and stays on the relay's §2.5 list; what may not happen is the
 * product telling somebody to look in a folder that does not exist. The
 * per-row path in the raw panel goes for the same reason: `RawTranscript.path`
 * is optional now and the wired path has none.
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

/** The record's two texts. `heard` is what the recogniser returned and
 *  `written` is what was delivered; `same` is the only fact that decides
 *  whether the pair is worth reading, and the runtime answers it exactly. */
function rawOf(entry: TranscriptionHistoryEntry): RawTranscript {
  const heard = entry.raw_transcript ?? "";
  const written = entry.transformed_transcript ?? entry.raw_transcript ?? "";
  return {
    heard,
    written,
    same: heard === written,
    note: entry.transform_warning ?? undefined,
  };
}

function titleOf(entry: TranscriptionHistoryEntry): string {
  const text = (entry.transformed_transcript ?? entry.raw_transcript ?? "").trim();
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
  audioKept: boolean;
  restorable: boolean;
  act?: {
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

/** The drawn foot, which is what the gallery is measured against. Its claim is
 *  the §2.5 contract entry; the wired path states the runtime instead. */
const DRAWN_FOOT =
  "Every transcript is a Markdown file in ~/WordScript/transcripts. Kept 90 days, capped at 500 entries.";

const REVEAL_HAS_NOWHERE_TO_GO =
  "Show in file manager — the runtime keeps one history file, not one per transcript";

export function HistoryScreen({ banner, runtime }: PartlyWiredScreenProps = {}) {
  const { entries, storagePath, error, refresh, remove, retry, exportEntries } =
    useTranscriptionHistory(Boolean(runtime?.active));

  const [openRaw, setOpenRaw] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | TranscriptionHistoryStatus>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = useMemo(
    () => ({ search: search || undefined, status: status || undefined }),
    [search, status],
  );

  useEffect(() => {
    if (!runtime?.active) return;
    if (searchTimer.current !== null) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void refresh(query, { background: true });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchTimer.current !== null) clearTimeout(searchTimer.current);
    };
  }, [runtime?.active, query, refresh]);

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

  const rows: HistoryRow[] = runtime
    ? entries.map((entry) => {
        const text = entry.transformed_transcript ?? entry.raw_transcript ?? "";
        return {
          id: entry.id,
          title: titleOf(entry),
          meta: [
            historyTime(entry.created_at_ms),
            PROCESSING_MODE_LABELS[entry.work_mode?.processing_mode ?? "auto"],
            entry.active_profile ?? "No profile recorded",
          ],
          badges: badgesFor(entry),
          raw: rawOf(entry),
          /* Kept audio is the only thing Retry can re-run, and the runtime says
             so by whether it still has a path. */
          audioKept: Boolean(entry.audio_path),
          /* Offered where the text did not reach the cursor — the one case
             where placing it again is a thing to do. */
          restorable:
            entry.insert_mode === "clipboard_only" ||
            entry.insert_mode === "clipboard_fallback" ||
            entry.insert_mode === "scratchpad_fallback",
          act: {
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
      })
    : HISTORY.map((entry) => ({
        id: entry.id,
        title: entry.text,
        meta: [entry.at, entry.mode, entry.profile],
        badges: entry.badges,
        raw: drawnRawOf(entry),
        audioKept: entry.audio !== false,
        restorable: Boolean(entry.restore),
      }));

  const count = rows.length;
  /* The count is the result of the filters, so it says which set it counted
     rather than implying it is everything on the machine. */
  const filtered = Boolean(search || status);
  const heading = filtered
    ? `${count} ${count === 1 ? "match" : "matches"}`
    : `${count} ${count === 1 ? "transcription" : "transcriptions"}`;

  const foot = runtime
    ? (notice ??
      `Every transcription is kept in ${
        storagePath ?? "the WordScript data directory"
      }. Kept ${runtime.config.history_retention_days} days, capped at ${
        runtime.config.history_limit
      } entries.`)
    : DRAWN_FOOT;

  return (
    <>
      <ViewTop title="History" lead="Every transcription kept on this machine." banner={banner} />

      <Toolbar
        label="Filters"
        right={
          <Button
            variant="ghost"
            icon={<Icon name="download" />}
            disabled={!runtime}
            onClick={() => void onExport()}
          >
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
                  audioKept={row.audioKept}
                  restorable={row.restorable}
                  busy={busyId === row.id}
                  open={openRaw === row.id}
                  onToggleRaw={() => setOpenRaw((id) => (id === row.id ? null : row.id))}
                  revealDisabledReason={runtime ? REVEAL_HAS_NOWHERE_TO_GO : undefined}
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
