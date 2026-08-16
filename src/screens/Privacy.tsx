import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openFileDialog, save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import {
  Button,
  Card,
  CardRows,
  Icon,
  PreviewTag,
  Row,
  SectionHeader,
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
import type { TextRulesAnalysis, TextRulesDocument } from "@/types/textRules";
import type { WiredScreenProps } from "./props";

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
 * was that the picker capped meetings too. It never did — `history_limit` and
 * `history_retention_days` govern the DICTATION history and nothing else, on
 * every one of the seven modes, because every path commits through the one
 * funnel `record_entry_with_work_mode` and the mode is a field on the record
 * rather than a second store (ADR 0074). One card per collection is what makes
 * that structural instead of a sentence somebody has to find.
 *
 * THE THIRD RULE IS AUDIO'S AND IT WAS MISSING ENTIRELY. ADR 0039 keeps a
 * failed capture for seven days or twenty files. Two rules drawn and a third
 * omitted is worse than three drawn, because the omitted one covers the
 * recording rather than the text.
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
 * EVERY DOOR ON THIS SCREEN ACTS. The retention rules are config
 * (`history_limit`, `history_retention_days`), Clear is
 * `clear_transcription_history_entries`, and the three that had no command at
 * all are `core::backup`:
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
const HISTORY_LIMITS = [50, 100, 200, 500, 1000];

/** The drawn options, with the value each one means. `Keep all` is 0 in the
 *  config, which is the runtime's own encoding of "do not prune". */
const RETENTIONS: { value: number; label: string }[] = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
  { value: 0, label: "Keep all" },
];

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
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  /* One line per row rather than a shared notice: three destructive doors sit
     within a screen of each other, and a single message would leave a reader
     guessing which one it answered. */
  const [busy, setBusy] = useState<
    "export" | "import" | "reset" | "rules-export" | "rules-import" | null
  >(null);
  const [exported, setExported] = useState<string | null>(null);
  const [imported, setImported] = useState<string | null>(null);
  const [reset, setReset] = useState<string | null>(null);
  const [rulesExported, setRulesExported] = useState<string | null>(null);
  const [rulesImported, setRulesImported] = useState<string | null>(null);

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
        description="Two collections and one recording, each under its own rule."
      >
        <Card
          title="Dictation history"
          description="Every dictation, whatever mode ran on it — the failed ones too."
        >
          <CardRows>
            <Row
              label="Stored dictations"
              hint="The oldest is dropped when the cap is reached."
              control={
                <Select
                    value={String(runtime.config.history_limit)}
                    onChange={(event) =>
                      runtime.patch({ history_limit: Number(event.target.value) })
                    }
                    aria-label="Stored dictations"
                  >
                    {/* A stored cap the drawing does not offer stays selectable,
                        so the row shows what is set rather than silently moving
                        the user to a neighbouring value. */}
                    {(HISTORY_LIMITS.includes(runtime.config.history_limit)
                      ? HISTORY_LIMITS
                      : [...HISTORY_LIMITS, runtime.config.history_limit].sort((a, b) => a - b)
                    ).map((limit) => (
                      <option key={limit} value={limit}>
                        {limit}
                      </option>
                    ))}
                  </Select>
              }
            />
            <Row
              label="Retention"
              /* BOTH RULES BIND, AND THE OLD SENTENCE HID THE SECOND ONE.
                 `prune_entries` sweeps by age first and then by count, so a
                 reader who set `Keep all` still loses the 1001st dictation. A
                 retention row that says only "older entries are pruned" is
                 describing half of its own mechanism. */
              hint="Whichever binds first: this age, or the cap above."
              control={
                <Select
                    value={String(runtime.config.history_retention_days)}
                    onChange={(event) =>
                      runtime.patch({ history_retention_days: Number(event.target.value) })
                    }
                    aria-label="Retention"
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
            {/* THE THIRD RETENTION RULE IN THE PRODUCT, AND THIS SCREEN DID NOT
                CARRY IT. ADR 0039 keeps a capture when a second attempt could
                survive the failure and sweeps it at seven days or twenty files.
                It is built (`core::capture::prune_retained_captures`), it is a
                raw recording of everything the microphone heard, and a privacy
                screen that lists two rules and omits the one covering audio is
                omitting the most sensitive of the three. It states rather than
                sets: the numbers are ADR 0039's, not a preference. */}
            <Row
              label="A failure's audio"
              hint="Kept so a retry can use it. A successful dictation's is discarded at once."
              control={<StatusBadge tone="plan">7 days · 20 files</StatusBadge>}
            />
          </CardRows>
        </Card>

        <Card
          title="Context objects"
          description="Meetings, uploads, links, notes and kept conversations."
        >
          <CardRows>
            <Row
              label="Pruning"
              hint="Nothing prunes them, and nothing will without asking."
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="plan">Kept until you delete</StatusBadge>
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
              hint="Its own budget, set where a meeting is configured."
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="plan">Own budget</StatusBadge>
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
        description="Nothing on a schedule, and the copilot's reach is bounded."
      >
        <Card>
          <CardRows>
            <Row
              label="The copilot's index"
              tag={
                <PreviewTag title="Decided in ADR 0138 and not built. The copilot itself is the context-object track's Stage E5, behind roadmap gate 3; this row states the rule that step is bound by." />
              }
              hint="Its hints come from meetings, uploads and notes, never from dictations."
              control={<StatusBadge tone="success">Context objects only</StatusBadge>}
            />
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
              hint="In the OS secret store. Never written to the JSON config and never returned to this window."
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
              hint="No. There is no WordScript account, no cloud of ours and no sync — nothing to sign up for and no server of ours holding anything."
              control={<StatusBadge tone="success">Never</StatusBadge>}
            />
            <Row
              label="The accounts you do have"
              hint="Groq, Anthropic, an enterprise tenant. Those belong to model vendors, they are the only thing audio is ever sent to, and they are set where the model is chosen."
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
        title="Delete and reset"
        description="Both take effect immediately and cannot be undone."
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
