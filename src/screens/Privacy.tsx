import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openFileDialog, save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import {
  Button,
  Card,
  CardRows,
  Field,
  Icon,
  PreviewTag,
  Row,
  SectionHeader,
  SegmentControl,
  Select,
  StatusBadge,
  ViewTop,
} from "@/components/shell";
import {
  buildTextProfilesPatch,
  resolveActiveTextProfile,
  textProfileFromRulesDocument,
  textRulesDocumentFromProfile,
} from "@/lib/textProfiles";
import type {
  RetainedCaptureStatus,
  TranscriptionHistoryStorageStatus,
  TranscriptStoreStatus,
} from "@/types/history";
import type { TextRulesAnalysis, TextRulesDocument } from "@/types/textRules";
import type { WiredScreenProps } from "./props";
import { useDeveloperMode } from "@/lib/developerMode";
import { previewVisible } from "@/lib/previewSurfaces";

/**
 * PRIVACY & DATA — `SCREENS.privacy`.
 *
 * THE RULE LIVES HERE, THE LIST LIVES IN HISTORY (§11.51). Both screens are
 * about the same records and neither is redundant, because they answer
 * different questions: History is the data — find one, read it, retry it,
 * delete one — and this is the policy: how many, how long, where. The pairing
 * is stated on both sides, so nobody has to discover which screen wins.
 *
 * IT COVERS CONTEXT OBJECTS TOO, and the heading says so: a meeting is a bigger
 * object than a transcript and an hour of audio is a different size of promise,
 * so a retention rule that silently governed only dictations would be the more
 * dangerous half unstated.
 *
 * A RULE NAMES THE COLLECTION IT GOVERNS, ON THE CARD IT SITS IN (ADR 0138).
 * Four rows under one heading made the cap read as covering everything above a
 * horizon it never touched: `Stored transcripts` sat two rows above
 * `Context objects`, and a meeting produces a transcript, so the natural reading
 * was that the picker capped meetings too. It never did —
 * `history_retention_days` governs the DICTATION history and nothing else, on
 * every one of the seven modes, because every path commits through the one
 * funnel `record_entry_with_work_mode` and the mode is a field on the record
 * rather than a second store (ADR 0074). One card per collection is what makes
 * that structural instead of a sentence somebody has to find.
 *
 * ONE RULE THE READER SETS, AND IT IS A DURATION (ADR 0185). Two pickers over
 * one list — a count and an age — meant neither could be read, because
 * `prune_entries` sweeps by age and THEN by count: `Keep all` still dropped the
 * 1001st record, and ninety days was a promise the count broke without saying
 * so. Nobody reasons about their own privacy in units of *the last two hundred
 * dictations*; they reason in months, which is now what the picker offers. The
 * count became the index's ceiling — stated in its own row, pinned in
 * `normalize_for_runtime`, and no longer anybody's preference.
 *
 * THE THIRD COLLECTION IS AUDIO'S, AND IT IS A CARD RATHER THAN A ROW. ADR 0039
 * keeps a failed capture for seven days or four gigabytes, and that row sat inside
 * `Dictation history` — under the very card whose rule is that a card names its
 * collection. A raw WAV is not a history entry. It is also the most sensitive
 * thing this product holds, so the card states what the rule ALLOWS and, since
 * ADR 0185, what is actually parked: `retained_capture_status` counts it and
 * `discard_retained_captures` is the one door that shortens the seven days.
 *
 * THE FOURTH IS THE TRANSCRIPT ARCHIVE, AND IT ONLY BECAME ONE WHEN IT STOPPED
 * SHARING A RULE (ADR 0237). Since ADR 0074 every dictation is also a Markdown
 * file in the reader's home directory, and the index retention deleted it: a
 * thousand-record ceiling chosen so a list stays fast was quietly the lifetime
 * of somebody's writing — about five days of it on the reporting machine. The
 * prune no longer touches the files, so the archive is kept until it is
 * deleted, and that rule needs the same two things the audio card has: a
 * reading (`transcript_store_status` counts and sizes it) and a door
 * (`purge_transcript_archive`). The door is not optional here. Once an index
 * entry is pruned nothing knows the file's path, so History cannot reach it and
 * this card is the only place the product admits it exists.
 *
 * WHAT MAY READ IT IS ITS OWN SECTION, and it exists because the question was
 * asked of the retention rows and they could not answer it. If the dictation
 * history fed the meeting copilot's index, `Keep all` would quietly be an
 * AI-reach setting; ADR 0138 rules that it does not, and the section states the
 * rule so the picker above stays what it looks like.
 *
 * "DANGER ZONE" WAS A THIRD RED SIGNAL on top of the red row label and the red
 * button, and the least useful of the three: it names a neighbourhood rather
 * than a consequence.
 *
 * EVERY DOOR ON THIS SCREEN ACTS. The retention rule is config
 * (`history_retention_days`), Clear is `clear_transcription_history_entries`,
 * and the three that had no command at all are `core::backup`:
 *
 *   - **Full export** is `export_full_backup` — the config, the history index
 *     and the transcript files as one archive, which is what "everything
 *     local" says. It is a different thing from History's own Export, which
 *     writes the index as JSON for a machine to read.
 *   - **Full import** is `import_full_backup`, and it writes a snapshot of
 *     what it replaces before it replaces anything. The row states where that
 *     snapshot went, because it is the way back.
 *   - **Reset all settings** is `reset_all_settings`, same snapshot rule, and
 *     it keeps the profiles and the history the hint promises to keep.
 *
 * THE API KEY IS NOT IN AN ARCHIVE and the import says so. It lives in the OS
 * secret store, which is the one thing about a machine that does not travel —
 * a restore that left somebody to discover that would have them debugging a
 * dead connection instead of typing a key.
 *
 * THE TWO DOORS ARE REAL: `Open Context` and `Open AI Models` are
 * `runtime.open`. `Open Context` still goes to a V2 screen, which is a fact
 * about Context and not about this row — the row's job is to say where the
 * rule about context objects is stated.
 *
 * PROFILE RULES ARE THE FOURTH AND FIFTH DOORS, AND THEY ARE A DIFFERENT SIZE
 * OF ARTIFACT FROM THE TWO ABOVE THEM (ADR 0090). The full archive is this
 * MACHINE — config, history, transcripts — and it is the thing you keep. A
 * rules file is one profile's CONTENT — its prompt, words, replacements and
 * snippets — and it is the thing you send somebody. `export_full_backup` was
 * never a substitute: a colleague who wants your abbreviations does not want
 * your history.
 *
 * THE EXPORT NAMES ITS PROFILE AND THE IMPORT MAKES ONE, which is the whole of
 * why the pair is split the way it is. Export also stands on the profile's own
 * row menu, where it acts on the row and needs no picker; import has no row to
 * act on, because the profile it produces does not exist yet. Drawing an Import
 * on a row would name a target it cannot have.
 *
 * NOTHING HERE SNAPSHOTS, AND THAT IS NOT AN OMISSION. `import_full_backup` and
 * `reset_all_settings` snapshot because they REPLACE what is on this machine.
 * An imported rules file is appended as a new profile: no existing profile is
 * read, changed or removed, so there is no previous state for a snapshot to
 * hold and the way back is deleting the profile the import just made — one
 * confirmed click on the screen the row points at.
 */
/** The three answers to *how fast do you type* that need no measurement
 *  (ADR 0178, shaped by ADR 0182).
 *
 *  THE BASELINE IS THE FIGURE. The same four weeks of dictation read 43 minutes
 *  saved against 40 words a minute and 15 against 60 — everything else on that
 *  tile is measured, and this one number swings it threefold. It was a constant
 *  in the frontend until somebody asked how accurate the tile actually was, and
 *  the honest answer was "as accurate as a guess nobody was shown".
 *
 *  THREE NAMED SPEEDS AND A FIELD, RATHER THAN EIGHT ANONYMOUS NUMBERS. A drop
 *  down of `20 · 30 · 40 …` asks the reader for a figure about themselves that
 *  almost nobody has ever measured, and offers no way to enter the one number
 *  somebody who HAS measured it actually knows. The presets answer the first
 *  reader — they describe how you type, not how fast — and the field answers the
 *  second, at whatever value they hold.
 *
 *  Forty is the ordinary figure for sustained prose typing and stays the
 *  default; thirty is two fingers looking at the keys; seventy is a touch
 *  typist who writes all day. */
export const TYPING_BASELINE_PRESETS: { value: number; label: string }[] = [
  { value: 30, label: "Two fingers" },
  { value: 40, label: "Average" },
  { value: 70, label: "Touch typist" },
];

/** What the field will take. The low end is below any real typist and the high
 *  end is above the world record; both exist to stop a hand-typed value from
 *  turning the tile into an absurdity, not to police the reader. */
const BASELINE_MIN = 10;
const BASELINE_MAX = 200;

/**
 * THE ONE CONTROL FOR THE ONE NUMBER `Time saved` IS DIVIDED BY, drawn here and
 * imported by Onboarding — the same precedent `InertSegment` sets, and for the
 * same reason: two copies of a control this load-bearing would drift.
 *
 * THE FIELD IS DRAFTED RATHER THAN LIVE. Typing `70` passes through `7`, and a
 * control that wrote every keystrokes' worth of value would put a 7 wpm baseline
 * on disk on the way to a valid one. The draft holds what is being typed, the
 * value is only handed over when it is inside the range, and a value outside it
 * marks the field instead of being swallowed.
 */
export function TypingBaseline({
  value,
  onChange,
}: {
  value: number;
  onChange: (wpm: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);
  const parsed = Number(shown.trim());
  const usable =
    /^\d{1,3}$/.test(shown.trim()) && parsed >= BASELINE_MIN && parsed <= BASELINE_MAX;

  return (
    <span className="ws-rowflex">
      <SegmentControl
        aria-label="How you type"
        /* A value no segment holds presses none of them, which is what a
           hand-entered 58 should look like: the reader set a number of their
           own and the presets are not claiming it. */
        value={String(value)}
        options={TYPING_BASELINE_PRESETS.map((preset) => ({
          value: String(preset.value),
          label: `${preset.label} · ${preset.value}`,
        }))}
        onChange={(next) => {
          setDraft(null);
          onChange(Number(next));
        }}
      />
      <Field
        w="52px"
        inputMode="numeric"
        value={shown}
        invalid={!usable}
        aria-label="Typing baseline in words a minute"
        onChange={(event) => {
          setDraft(event.target.value);
          const next = Number(event.target.value.trim());
          if (
            /^\d{1,3}$/.test(event.target.value.trim()) &&
            next >= BASELINE_MIN &&
            next <= BASELINE_MAX
          ) {
            onChange(next);
          }
        }}
        /* Leaving the field gives the display back to the config, so an
           abandoned half-typed number does not sit there looking like a
           setting. */
        onBlur={() => setDraft(null)}
      />
      <span className="ws-muted">wpm</span>
    </span>
  );
}

/** The drawn options, with the value each one means (ADR 0185).
 *
 *  MONTHS, BECAUSE THAT IS THE UNIT THE QUESTION IS ASKED IN. Nobody holds an
 *  opinion about thirty days; they hold one about a month. The config stores
 *  days either way — the label is the reader's unit and the number is the
 *  runtime's.
 *
 *  `No age limit` is 0, which is the runtime's own encoding of "do not prune by
 *  age". It is NOT "keep all", which is what this option used to say and what
 *  the runtime has never done: the ceiling below still drops the oldest. A
 *  picker may not promise what the sweep beside it takes back. */
const RETENTIONS: { value: number; label: string }[] = [
  { value: 7, label: "7 days" },
  { value: 30, label: "1 month" },
  { value: 90, label: "3 months" },
  { value: 365, label: "1 year" },
  { value: 0, label: "No age limit" },
];

/** What a collection of files on this machine weighs, in the decimal units the
 *  rest of the product states file sizes in (`formatModelSize`'s reasoning, one
 *  or two orders down: these are megabytes of WAV and kilobytes of Markdown,
 *  not gigabytes of model).
 *
 *  The `Math.max(1, …)` floor is why nothing calls this with a zero: a
 *  collection with nothing in it gets a sentence, not `1 KB`. */
function formatStoredSize(bytes: number): string {
  /* GB IS NOT DECORATION HERE, it is the unit the two thresholds are stated in
     (ADR 0241). A store that reaches its ceiling reads `10.0 GB` beside a
     sentence about ten gigabytes, and a reading that said `10240.0 MB` instead
     would be the same number failing to answer the question the row asks. */
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/** How old the oldest parked recording is, against a rule stated in days. Whole
 *  words rather than `2d`, because this row is read once and in prose. */
function formatCaptureAge(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "under an hour old";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} old`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} old`;
}

/** The profile a rules file becomes, named after the file it came from. The
 *  export's own suggested name is stripped back off, so a round trip does not
 *  produce a profile called "wordscript rules support reply". */
function labelFromFile(path: string) {
  const base = (path.split(/[\\/]/).pop() ?? "")
    .replace(/\.json$/i, "")
    .replace(/^wordscript-rules-/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (!base) return "Imported rules";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function PrivacyScreen({ banner, runtime }: WiredScreenProps) {
  /* THREE ROWS ON THIS SCREEN STATE A RULE FOR A COLLECTION THAT DOES NOT
     EXIST. Outside Developer Mode they are not marked, they are absent: a
     retention rule for a store nothing writes is a promise about nothing, and
     the reader has no way to tell it from the four rules above it that are
     real. Read once here, so no row asks the config. */
  const developer = useDeveloperMode();
  const showsContextObjects = previewVisible("privacy-context-objects", developer);
  const showsCopilot = previewVisible("privacy-copilot", developer);

  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  /* One line per row rather than a shared notice: three destructive doors sit
     within a screen of each other, and a single message would leave a reader
     guessing which one it answered. */
  const [busy, setBusy] = useState<
    | "export"
    | "import"
    | "reset"
    | "rules-export"
    | "rules-import"
    | "activity"
    | "captures"
    | "archive"
    | null
  >(null);
  const [exported, setExported] = useState<string | null>(null);
  const [imported, setImported] = useState<string | null>(null);
  const [reset, setReset] = useState<string | null>(null);
  const [rulesExported, setRulesExported] = useState<string | null>(null);
  const [rulesImported, setRulesImported] = useState<string | null>(null);
  const [activityReset, setActivityReset] = useState<string | null>(null);

  /* WHAT IS PARKED, READ FROM THE RUNTIME RATHER THAN ASSUMED (ADR 0185). The
     row states a count, so it may only draw one the runtime produced — `null`
     while nothing has answered yet, and the row says nothing about files in the
     meantime rather than claiming zero. */
  const [captures, setCaptures] = useState<RetainedCaptureStatus | null>(null);
  const [capturesNote, setCapturesNote] = useState<string | null>(null);

  const readCaptures = useCallback(async () => {
    try {
      const answer = await invoke<RetainedCaptureStatus>("retained_capture_status");
      setCaptures(typeof answer?.count === "number" ? answer : null);
    } catch {
      /* Silent: a status this row could not read is a row that states the rule
         and no reading, which is what `null` already draws. A privacy screen
         must not turn its own failure into a claim about the disk. */
      setCaptures(null);
    }
  }, []);

  useEffect(() => {
    if (!runtime.active) return;
    void readCaptures();
  }, [runtime.active, readCaptures]);

  /* WHAT THE ARCHIVE HOLDS, FOR THE SAME REASON AND WITH THE SAME `null`
     (ADR 0237). The count is the only place the product admits an orphaned file
     exists — one whose index entry the retention already dropped — so it may
     never be guessed at. A status this row could not read states the rule and
     no reading. */
  const [archive, setArchive] = useState<TranscriptStoreStatus | null>(null);
  const [archiveNote, setArchiveNote] = useState<string | null>(null);
  /* THE INDEX GETS THE READING THE ARCHIVE ALREADY HAD (ADR 0241). Both
     collections are bounded in bytes now, and a threshold that never fires — 5
     GB is decades away at any real rate — is not a feature. The figure is, and
     it is the same figure the ceiling is measured against, so the row cannot
     drift from the rule the way a second copy of a number would. */
  const [index, setIndex] = useState<TranscriptionHistoryStorageStatus | null>(null);

  const readArchive = useCallback(async () => {
    try {
      const answer = await invoke<TranscriptStoreStatus>("transcript_store_status");
      setArchive(typeof answer?.files === "number" ? answer : null);
    } catch {
      setArchive(null);
    }
  }, []);

  const readIndex = useCallback(async () => {
    try {
      const answer = await invoke<TranscriptionHistoryStorageStatus>(
        "transcription_history_storage_status",
      );
      setIndex(typeof answer?.bytes === "number" ? answer : null);
    } catch {
      setIndex(null);
    }
  }, []);

  useEffect(() => {
    if (!runtime.active) return;
    void readArchive();
    void readIndex();
  }, [runtime.active, readArchive, readIndex]);

  /* WHICH PROFILE THE EXPORT MEANS. It opens on the active one because that is
     the profile the reader is currently being written by, and it is a local
     selection rather than a config write — picking what to export changes
     nothing about the machine, so it must not land on disk. */
  const activeProfileId = resolveActiveTextProfile(runtime.config).id;
  const [rulesProfileId, setRulesProfileId] = useState(activeProfileId);
  const rulesProfile =
    runtime.config.text_profiles.find((entry) => entry.id === rulesProfileId) ??
    resolveActiveTextProfile(runtime.config);

  const clear = async () => {
    setClearing(true);
    try {
      await invoke("clear_transcription_history_entries");
      setCleared(true);
    } finally {
      setClearing(false);
    }
  };

  /* THE ONE DOOR THAT LOWERS THE LIFETIME FIGURES (ADR 0176), and it is here
     rather than a side effect of the row above it. Deleting a transcript is
     housekeeping and must not cost somebody their record of a year's dictation;
     wanting that record gone is a separate intention and gets a control that
     says what it does. */
  const resetActivity = async () => {
    setBusy("activity");
    try {
      await invoke("reset_activity_ledger");
      setActivityReset("Every all-time figure is back to nothing. Counting starts again with your next dictation.");
    } catch (cause) {
      setActivityReset(String(cause));
    } finally {
      setBusy(null);
    }
  };

  /* THE DOOR THAT SHORTENS THE SEVEN DAYS. Everything else about a retained
     capture is automatic, so before this the only way to be rid of a recording
     of your own voice was to wait a week. It costs the retry the file was kept
     for, which is why the row says so and the runtime never does this by
     itself. */
  const discardCaptures = async () => {
    setBusy("captures");
    try {
      const answer = await invoke<RetainedCaptureStatus>("discard_retained_captures");
      setCaptures(typeof answer?.count === "number" ? answer : null);
      setCapturesNote("Deleted. A failed dictation can no longer be retried from its audio.");
    } catch (cause) {
      setCapturesNote(String(cause));
    } finally {
      setBusy(null);
    }
  };

  /* THE DOOR ONTO A FOLDER NOTHING ELSE CAN REACH (ADR 0237). Deleting a record
     in History takes its file; the retention sweep no longer does. So a file
     whose entry has aged out has no row to delete and no path anybody holds,
     and this is the only call in the product that will remove it. It walks the
     directory, which is why the runtime bounds it by the store's own naming
     shape rather than by "every .md in there". */
  const purgeArchive = async () => {
    setBusy("archive");
    try {
      const answer = await invoke<TranscriptStoreStatus>("purge_transcript_archive");
      setArchive(typeof answer?.files === "number" ? answer : null);
      setArchiveNote(
        "Deleted. Files you added to that folder yourself were left where they are.",
      );
    } catch (cause) {
      setArchiveNote(String(cause));
    } finally {
      setBusy(null);
    }
  };

  const runExport = async () => {
    const path = await saveFileDialog({
      title: "Export everything local",
      defaultPath: `wordscript-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "WordScript archive", extensions: ["json"] }],
    });
    if (!path) return;

    setBusy("export");
    try {
      const answer = await invoke<{ history_count: number; transcript_count: number }>(
        "export_full_backup",
        { request: { path } },
      );
      setExported(
        `${answer.history_count} records and ${answer.transcript_count} transcript files written to ${path}.`,
      );
    } catch (cause) {
      setExported(String(cause));
    } finally {
      setBusy(null);
    }
  };

  const runImport = async () => {
    const path = await openFileDialog({
      title: "Restore from an archive",
      multiple: false,
      filters: [{ name: "WordScript archive", extensions: ["json"] }],
    });
    if (typeof path !== "string") return;

    setBusy("import");
    try {
      const answer = await invoke<{
        snapshot_path: string;
        history_count: number;
        transcript_count: number;
      }>("import_full_backup", { request: { path } });
      /* The snapshot is named because it is the way back, and a restore that
         did not say where the replaced state went would be asking for trust it
         has not earned. The key is named because it is the one thing an
         archive cannot carry. */
      setImported(
        `Restored ${answer.history_count} records and ${answer.transcript_count} transcript files. What was here went to ${answer.snapshot_path}. The API key is not in an archive — it stays in this machine's secret store.`,
      );
    } catch (cause) {
      setImported(String(cause));
    } finally {
      setBusy(null);
    }
  };

  const runRulesExport = async () => {
    const path = await saveFileDialog({
      title: `Export rules of ${rulesProfile.label}`,
      defaultPath: "wordscript-rules.json",
      filters: [{ name: "WordScript text rules", extensions: ["json"] }],
    });
    if (!path) return;

    setBusy("rules-export");
    try {
      const answer = await invoke<{ path: string; analysis: TextRulesAnalysis }>(
        "export_text_rules",
        { request: { path, ...textRulesDocumentFromProfile(rulesProfile) } },
      );
      setRulesExported(
        `${rulesProfile.label} — ${rulesProfile.vocabulary_hints.length} words, ${rulesProfile.dictionary_entries.length} replacements and ${rulesProfile.snippet_entries.length} snippets — written to ${answer.path}.`,
      );
    } catch (cause) {
      setRulesExported(String(cause));
    } finally {
      setBusy(null);
    }
  };

  const runRulesImport = async () => {
    const path = await openFileDialog({
      title: "Import profile rules",
      multiple: false,
      filters: [{ name: "WordScript text rules", extensions: ["json"] }],
    });
    if (typeof path !== "string") return;

    setBusy("rules-import");
    try {
      /* THE RUNTIME PARSES AND JUDGES THE FILE, and this call is how — the
         schema check, the merge and the analysis all live in `text_rules.rs`
         and a second reader here would be the second implementation ADR 0055
         exists against. The current-* fields are empty and the resolution is
         `replace_current` because there is nothing to resolve against: the
         file becomes a profile of its own, so the merge branch has no work to
         do and its absence is what makes this import unable to overwrite. */
      const answer = await invoke<{ document: TextRulesDocument; analysis: TextRulesAnalysis }>(
        "import_text_rules",
        {
          request: {
            path,
            current_prompt: "",
            current_stt_hints: "",
            current_dictionary_entries: [],
            current_snippet_entries: [],
            sample_text: null,
            resolution: "replace_current",
          },
        },
      );

      const created = textProfileFromRulesDocument(answer.document, labelFromFile(path));
      runtime.patch(
        buildTextProfilesPatch(
          runtime.config,
          [...runtime.config.text_profiles, created],
          /* The new profile is NOT made active. An import is a thing arriving,
             not a decision to be written by it — switching would change how the
             very next dictation comes out on the strength of a file the reader
             has not looked at yet. */
          runtime.config.active_text_profile_id,
        ),
      );

      const blocking = answer.analysis.blocking
        ? " It has a blocking issue — Profiles shows which."
        : "";
      setRulesImported(
        `Added as the profile ${created.label}: ${created.vocabulary_hints.length} words, ${created.dictionary_entries.length} replacements and ${created.snippet_entries.length} snippets. Nothing else changed and no profile was replaced.${blocking}`,
      );
    } catch (cause) {
      setRulesImported(String(cause));
    } finally {
      setBusy(null);
    }
  };

  const runReset = async () => {
    setBusy("reset");
    try {
      const answer = await invoke<{ snapshot_path: string; kept_profiles: number }>(
        "reset_all_settings",
      );
      setReset(
        `Every setting is back to its default. ${answer.kept_profiles} profiles and the history stayed. The previous settings went to ${answer.snapshot_path}.`,
      );
    } catch (cause) {
      setReset(String(cause));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <ViewTop title="Privacy & Data" lead="What stays on this machine, and how long." banner={banner} />

      <SectionHeader
        title="How long things are kept"
        description="Each collection under its own rule, and only the first is yours to set."
      >
        <Card
          title="Dictation history"
          description="Every dictation, whatever mode ran on it — the failed ones too."
        >
          <CardRows>
            <Row
              label="Kept for"
              /* THE ONE RULE, AND ITS HINT NO LONGER HAS TO EXPLAIN A SECOND
                 ONE. It used to read "whichever binds first: this age, or the
                 cap above" — a sentence that only exists because the screen
                 offered two rules over one list (ADR 0185).

                 AND IT NO LONGER CLAIMS THE FILES. Until ADR 0237 it read
                 "older dictations are deleted with their transcript files",
                 which was true and is the thing that record reversed: this rule
                 governs the index, and the card below governs the writing. */
              hint="This drops the record from History. Your transcript files are kept — they have their own rule below."
              control={
                <Select
                    value={String(runtime.config.history_retention_days)}
                    onChange={(event) =>
                      runtime.patch({ history_retention_days: Number(event.target.value) })
                    }
                    aria-label="Kept for"
                  >
                    {(RETENTIONS.some((r) => r.value === runtime.config.history_retention_days)
                      ? RETENTIONS
                      : [
                          ...RETENTIONS,
                          {
                            value: runtime.config.history_retention_days,
                            label: `${runtime.config.history_retention_days} days`,
                          },
                        ]
                    ).map((retention) => (
                      <option key={retention.value} value={retention.value}>
                        {retention.label}
                      </option>
                    ))}
                  </Select>
              }
            />
            {/* THE FIGURE, WHICH IS THE INSTRUMENT — AND NOT THE THRESHOLD,
                WHICH IS THE BACKSTOP'S VOICE (ADR 0241). The index is bounded
                in bytes now rather than in records: 10 GB is about 4.1 million
                dictations and roughly fifty years at this machine's rate, so
                the ceiling is a promise that the application cannot fill a disk
                without saying so, and the number beside it is the only part a
                reader will ever see move. */}
            <Row
              label="On this machine now"
              hint={
                index === null
                  ? "Read from the file the records are written to."
                  : index.bytes >= index.warning_bytes
                    ? `In ${index.path}. Past ${formatStoredSize(index.warning_bytes)}; at ${formatStoredSize(index.ceiling_bytes)} the oldest records start dropping out whatever the rule above says.`
                    : `In ${index.path}. The rule above is what governs it — the ${formatStoredSize(index.ceiling_bytes)} ceiling is a backstop against a runaway and nothing you will reach.`
              }
              control={
                index === null ? (
                  <StatusBadge tone="neutral">Not read</StatusBadge>
                ) : (
                  <StatusBadge tone={index.bytes >= index.warning_bytes ? "warning" : "plan"}>
                    {formatStoredSize(index.bytes)}
                  </StatusBadge>
                )
              }
            />
          </CardRows>
        </Card>

        {/* THE WRITING, WHICH IS NOT THE INDEX (ADR 0237). Every dictation is
            also a Markdown file in the reader's own home directory, and until
            this record the card above deleted it — the thousand-record ceiling
            that keeps a list fast was the lifetime of a year's transcripts. The
            two stores answer different questions, so they get different rules
            and different cards. */}
        <Card
          title="Transcript files"
          description="A Markdown file per dictation, in a folder you own."
        >
          <CardRows>
            <Row
              label="Kept for"
              /* No picker, and deliberately not a second one: two durations
                 over two stores would rebuild the two-controls defect ADR 0185
                 removed, one store further out. The folder is the reader's.

                 IT NO LONGER SAYS *NOTHING PRUNES THEM* (ADR 0241). That was
                 true and was the gap that record closed: ADR 0237 gave the
                 files their own lifetime and then left it infinite, so the
                 honest answer to *when do these go* was *never*. They now have
                 a backstop of their own, on the same two numbers as the index
                 and out of the same budget as nothing else. */
              hint={`Nothing prunes them by age. Deleting a record in History takes its file, and past ${formatStoredSize(archive?.ceiling_bytes ?? 10_000_000_000)} the oldest go.`}
              control={<StatusBadge tone="plan">Until you delete them</StatusBadge>}
            />
            {/* THE READING IS NOT OPTIONAL HERE, unlike on the card below where
                it is merely better. Once a record ages out of the index nothing
                holds its file's path any more — no row, no Reveal, no Retry —
                so this count is the only place the product admits those files
                exist at all. */}
            <Row
              label="On this machine now"
              hint={
                archiveNote ??
                (archive === null
                  ? "Read from the folder they are written to."
                  : archive.files === 0
                    ? `Nothing is stored. The next dictation writes one to ${archive.root}.`
                    : `In ${archive.root}. Deleting them removes your copy of every dictation, including the ones History no longer lists. Files you put in that folder yourself are left alone.`)
              }
              control={
                <span className="ws-rowflex">
                  {archive === null ? (
                    <StatusBadge tone="neutral">Not read</StatusBadge>
                  ) : archive.files === 0 ? (
                    <StatusBadge tone="success">Nothing stored</StatusBadge>
                  ) : (
                    <StatusBadge
                      tone={archive.bytes >= archive.warning_bytes ? "warning" : "plan"}
                    >
                      {archive.files} file{archive.files === 1 ? "" : "s"} ·{" "}
                      {formatStoredSize(archive.bytes)}
                    </StatusBadge>
                  )}
                  {archive !== null && archive.files > 0 && (
                    <Button
                      variant="danger"
                      busy={busy === "archive"}
                      disabled={busy !== null}
                      onClick={() => void purgeArchive()}
                    >
                      Delete now
                    </Button>
                  )}
                </span>
              }
            />
          </CardRows>
        </Card>

        {/* ITS OWN CARD, BECAUSE IT IS ITS OWN COLLECTION. This stood as a
            fourth row inside `Dictation history` — under the card whose rule is
            that a card names what it governs. ADR 0039 keeps a capture when a
            second attempt could survive the failure; a raw WAV of everything
            the microphone heard is not a history entry, and it is the most
            sensitive thing this product holds. */}
        <Card
          title="Audio from a failed dictation"
          description="Kept so a retry can use it. A successful dictation's recording is discarded at once."
        >
          <CardRows>
            <Row
              label="Kept for"
              /* It states rather than sets: the numbers are ADR 0039's, not a
                 preference, and the row draws them from the runtime's own
                 answer rather than repeating them here. */
              hint="Whichever comes first. Set by the product, not by you."
              control={
                <StatusBadge tone="plan">
                  {captures
                    ? `${captures.max_age_days} days · ${formatStoredSize(captures.max_bytes)}`
                    : "7 days · 4.0 GB"}
                </StatusBadge>
              }
            />
            {/* A RULE WITHOUT A READING IS HALF AN ANSWER. "Seven days, four
                gigabytes" says what MAY be kept; the question this screen is opened
                with is whether anything IS — and `Nothing kept` is the most
                reassuring sentence it can print. The button appears only when
                there is something to delete, because a door onto an empty
                directory is the fake affordance rule 7 forbids. */}
            <Row
              label="On this machine now"
              hint={
                capturesNote ??
                (captures === null
                  ? "Read from the folder these are written to."
                  : captures.count === 0
                    ? "Nothing is parked. Every capture so far was either transcribed or swept."
                    : `In ${captures.directory}. Deleting them now means a failed dictation can no longer be retried from its audio.`)
              }
              control={
                <span className="ws-rowflex">
                  {captures === null ? (
                    <StatusBadge tone="neutral">Not read</StatusBadge>
                  ) : captures.count === 0 ? (
                    <StatusBadge tone="success">Nothing kept</StatusBadge>
                  ) : (
                    <StatusBadge tone="warning">
                      {captures.count} file{captures.count === 1 ? "" : "s"} ·{" "}
                      {formatStoredSize(captures.bytes)}
                      {captures.oldest_age_ms === null
                        ? ""
                        : ` · oldest ${formatCaptureAge(captures.oldest_age_ms)}`}
                    </StatusBadge>
                  )}
                  {captures !== null && captures.count > 0 && (
                    <Button
                      variant="danger"
                      busy={busy === "captures"}
                      disabled={busy !== null}
                      onClick={() => void discardCaptures()}
                    >
                      Delete now
                    </Button>
                  )}
                </span>
              }
            />
          </CardRows>
        </Card>

        {showsContextObjects && (
        <Card
          title="Context objects"
          description="Meetings, uploads, links, notes and kept conversations."
        >
          <CardRows>
            {/* THE COLLECTION DOES NOT EXIST YET, AND THE ROWS MAY NOT IMPLY
                THAT IT DOES. There is no context store in the runtime, so both
                rows state a decided rule rather than an observed one — which is
                exactly what `PreviewTag` marks (rule 7, ADR 0161). "Pruning"
                also went: it named the mechanism where the reader asks about
                the outcome. */}
            {/* THE SAME QUESTION IN THE SAME WORDS, ONCE PER CARD. Four
                collections each answer `Kept for`, so the screen reads as one
                question asked four times rather than four rules that happen
                to be nearby — and the answers differ in the badge, which is
                where a difference belongs. */}
            <Row
              label="Kept for"
              tag={<PreviewTag id="privacy-context-objects" />}
              hint="Nothing prunes them on a schedule, and nothing will without asking."
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="plan">Until you delete them</StatusBadge>
                  <Button
                    variant="ghost"
                    icon={<Icon name="arrow" />}
                    onClick={() => runtime.open?.({ view: "context" })}
                  >
                    Open Context
                  </Button>
                </span>
              }
            />
            <Row
              label="Meeting audio"
              tag={<PreviewTag id="privacy-note-retention" />}
              /* "OWN BUDGET" NAMED NOTHING. A reader of a retention section
                 wants the rule, and the rule is drawn one door away as `Keep
                 the audio` — so this row states its default instead of pointing
                 at the existence of a setting. */
              hint="An hour of a call is a different promise from a dictation, so it has its own rule where a meeting is configured."
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="plan">Until the note is saved</StatusBadge>
                  {/* THE DOOR WAS DRAWN AND DEAD. It carried an arrow, named a
                      screen and had no handler, on the one surface whose own
                      docblock claims every door acts — which is ADR 0020's
                      defect surviving inside the file that states the rule.
                      `notesettings` is a section, so it is where `Keep the
                      audio` actually stands. */}
                  <Button
                    variant="ghost"
                    icon={<Icon name="arrow" />}
                    onClick={() => runtime.open?.({ section: "notesettings" })}
                  >
                    Notes &amp; Meetings
                  </Button>
                </span>
              }
            />
          </CardRows>
        </Card>
        )}
      </SectionHeader>

      {/* WHAT IS KEPT AND WHAT MAY READ IT ARE TWO QUESTIONS, and this screen
          answered only the first. The retention rows above look like tidying
          until a reader learns that a model is given some of what they hold —
          at which point the same picker is the strongest privacy control in the
          product and never said so. ADR 0138 settles the reach so that it is
          NOT: the copilot's index is the context-object collection, and the
          dictation history is not in it. */}
      <SectionHeader
        title="What may read what is kept"
        description="Nothing reads it on a schedule, and keeping more shows a model no more."
      >
        <Card>
          <CardRows>
            {showsCopilot && (
              <Row
                label="The copilot's index"
                tag={<PreviewTag id="privacy-copilot" />}
                hint="Its hints come from meetings, uploads and notes, never from dictations."
                control={<StatusBadge tone="success">Context objects only</StatusBadge>}
              />
            )}
            <Row
              label="The rules above"
              hint="They govern disk, not reach. Keeping more shows a model nothing more."
              control={<StatusBadge tone="success">No AI consequence</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader title="Where things live">
        <Card>
          <CardRows>
            <Row
              label="API keys"
              hint="In the OS secret store, never in the JSON config."
              control={<StatusBadge tone="success">OS secret store</StatusBadge>}
            />
            <Row
              label="Transcripts, context, profiles, settings"
              hint="Files on this machine, under paths you can open."
              control={<StatusBadge tone="success">This machine</StatusBadge>}
            />
            {/* "THEN DISCARDED" WAS TRUE OF THE SUCCESSFUL HALF ONLY. A
                retryable failure keeps its capture on this machine (ADR 0039),
                which is the opposite of discarded and is the case a reader of a
                privacy screen most wants to know about. The numbers stay in the
                retention section, where a duration belongs; this row owns the
                question that section does not answer — whether it leaves. */}
            <Row
              label="Audio"
              hint="Sent to the provider, then discarded — a failure's is kept here for a retry."
              control={<StatusBadge tone="plan">Provider, then discarded</StatusBadge>}
            />
            <Row
              label="Whether any of it leaves"
              hint="No. There is no WordScript account and no server of ours to hold anything."
              control={<StatusBadge tone="success">Never</StatusBadge>}
            />
            <Row
              label="The accounts you do have"
              hint="Model vendors, set where the model is chosen. The only place audio is sent."
              control={
                <Button
                  variant="ghost"
                  icon={<Icon name="arrow" />}
                  onClick={() => runtime.open?.({ section: "models" })}
                >
                  Open AI Models
                </Button>
              }
            />
          </CardRows>
        </Card>
      </SectionHeader>

      {/* THE HEADING CARRIES WHAT THE TWO PAIRS ARE, because the rows below it
          cannot. A row's hint is one line, and the two rules rows spend their
          width on a control — a picker plus a button — so the column left for
          their text is roughly thirty characters where the archive rows have
          fifty. The sentence explaining what a rules file IS does not fit
          there and belongs here anyway (donor rule: a section header is a
          descriptive line, a row is at most one). */}
      <SectionHeader
        title="Export"
        description="Everything on this machine as one archive, or one profile's rules as a file you can send."
      >
        <Card>
          <CardRows>
            <Row
              label="Full export"
              hint={exported ?? "Everything local, as one archive."}
              control={
                <Button
                  icon={<Icon name="download" />}
                  busy={busy === "export"}
                  disabled={busy !== null}
                  onClick={() => void runExport()}
                >
                  Export
                </Button>
              }
            />
            <Row
              label="Full import"
              hint={imported ?? "Restores from a previously exported archive."}
              control={
                <Button
                  variant="ghost"
                  busy={busy === "import"}
                  disabled={busy !== null}
                  onClick={() => void runImport()}
                >
                  Import
                </Button>
              }
            />
            {/* THE PICKER IS THE CONTROL AND THE BUTTON IS BESIDE IT, because
                the row has to say WHICH profile before it can offer to write
                one. The two archive rows above need no such thing — there is
                one machine.

                THE HINT IS SHORT BECAUSE THE PICKER IS WIDE, and that is a
                measurement rather than a preference: `.ws-row-ctl` is
                `flex: none`, so every pixel the control takes comes off the
                text column. The first build of this row ran 79 characters —
                inside the ≤ 90 one-line budget every row on the surface was
                then written to — and drew THREE lines in WebKitGTK against
                neighbours that drew one, because the budget is a function of
                what the control costs and the neighbours' control is a single
                button. That is the measurement ADR 0092 came out of, and the
                `≤ 90` it names is no longer a rule anywhere. jsdom reports the
                string and cannot report the wrap. */}
            <Row
              label="Profile rules"
              hint={rulesExported ?? "Prompt, words and snippets."}
              control={
                <span className="ws-rowflex">
                  <Select
                    value={rulesProfileId}
                    onChange={(event) => setRulesProfileId(event.target.value)}
                    aria-label="Profile to export"
                  >
                    {runtime.config.text_profiles.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.label}
                      </option>
                    ))}
                  </Select>
                  <Button
                    icon={<Icon name="download" />}
                    busy={busy === "rules-export"}
                    disabled={busy !== null}
                    onClick={() => void runRulesExport()}
                  >
                    Export
                  </Button>
                </span>
              }
            />
            <Row
              label="Import rules"
              /* Same width rule as the row above: two buttons, so the second
                 sentence — that nothing is replaced and nothing is switched —
                 is in the ANSWER, where it is read at the moment it matters
                 and has the whole row to be read in. */
              hint={rulesImported ?? "Lands as a new profile."}
              control={
                <span className="ws-rowflex">
                  <Button
                    variant="ghost"
                    busy={busy === "rules-import"}
                    disabled={busy !== null}
                    onClick={() => void runRulesImport()}
                  >
                    Import
                  </Button>
                  <Button
                    variant="ghost"
                    icon={<Icon name="arrow" />}
                    onClick={() => runtime.open?.({ view: "profiles" })}
                  >
                    Open Profiles
                  </Button>
                </span>
              }
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="Activity figures"
        description="What Home's counters are measured against, kept apart from the history above."
      >
        <Card
          title="Time saved"
          description="The one figure on Home derived from an assumption rather than from a measurement."
        >
          <CardRows>
            <Row
              label="Typing baseline"
              /* STACKED, BECAUSE THE CONTROL IS THREE SEGMENTS AND A FIELD.
                 ADR 0092's rule is that `.ws-row-ctl` takes its width off the
                 text column; a composite this wide on an inline row would leave
                 the hint reading ten characters to a line. */
              layout="stack"
              /* THE ROW STATES THE SWING RATHER THAN THE UNIT. A reader who does
                 not know that this number IS the figure will leave it at 40 and
                 take the result for a measurement — which is exactly the reading
                 the ≈ on the tile exists to prevent. */
              hint="Your dictated words at this speed, less the time you spent dictating them."
              control={
                <TypingBaseline
                  value={runtime.config.typing_baseline_wpm ?? 40}
                  onChange={(wpm) => runtime.patch({ typing_baseline_wpm: wpm })}
                />
              }
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader
        title="Delete and reset"
        description="All three take effect immediately and cannot be undone."
      >
        <Card>
          <CardRows>
            <Row
              label="Clear transcription history"
              hint={
                cleared
                  ? "Every stored transcript was deleted. Profiles and settings stayed."
                  : "Deletes every stored transcript. Profiles and settings stay."
              }
              danger
              control={
                <Button
                  variant="danger"
                  busy={clearing}
                  disabled={clearing}
                  onClick={() => void clear()}
                >
                  Clear
                </Button>
              }
            />
            <Row
              label="Reset activity statistics"
              /* IT NAMES WHAT SURVIVES CLEARING HISTORY, because that is the
                 question this row answers: the figures are their own file and
                 deleting transcripts does not touch them (ADR 0176). */
              hint={
                activityReset ??
                "Clears every all-time figure on Home — dictations, words, rates, languages. Your transcripts and settings stay. Clearing the history above does NOT do this."
              }
              danger
              control={
                <Button
                  variant="danger"
                  busy={busy === "activity"}
                  disabled={busy !== null}
                  onClick={() => void resetActivity()}
                >
                  Clear figures
                </Button>
              }
            />
            <Row
              label="Reset all settings"
              hint={reset ?? "Restores every setting to its default. History and profiles stay."}
              danger
              control={
                <Button
                  variant="danger"
                  busy={busy === "reset"}
                  disabled={busy !== null}
                  onClick={() => void runReset()}
                >
                  Reset
                </Button>
              }
            />
          </CardRows>
        </Card>
      </SectionHeader>
    </>
  );
}
