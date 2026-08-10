import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openFileDialog, save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import {
  Button,
  Card,
  CardRows,
  Icon,
  Row,
  SectionHeader,
  Select,
  StatusBadge,
  ViewTop,
} from "@/components/shell";
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

export function PrivacyScreen({ banner, runtime }: WiredScreenProps) {
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  /* One line per row rather than a shared notice: three destructive doors sit
     within a screen of each other, and a single message would leave a reader
     guessing which one it answered. */
  const [busy, setBusy] = useState<"export" | "import" | "reset" | null>(null);
  const [exported, setExported] = useState<string | null>(null);
  const [imported, setImported] = useState<string | null>(null);
  const [reset, setReset] = useState<string | null>(null);

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
        description="History and context objects, on this machine."
      >
        <Card>
          <CardRows>
            <Row
              label="Stored transcripts"
              hint="The oldest is dropped when the cap is reached."
              control={
                <Select
                    value={String(runtime.config.history_limit)}
                    onChange={(event) =>
                      runtime.patch({ history_limit: Number(event.target.value) })
                    }
                    aria-label="Stored transcripts"
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
              hint="Older entries are pruned automatically."
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
            <Row
              label="Context objects"
              hint="Meetings, uploads and notes are files in a folder you chose. Nothing prunes them, and nothing will without asking."
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
              hint="An hour of recording is a different size of promise than a dictation's few seconds. Undecided."
              control={<StatusBadge tone="warning">Open decision</StatusBadge>}
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
            <Row
              label="Audio"
              hint="Sent to the selected provider for transcription, then discarded. The local lane sends nothing."
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

      <SectionHeader title="Export">
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
