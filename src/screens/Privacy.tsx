import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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
import type { PartlyWiredScreenProps } from "./props";

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
 * WIRED IN PART, AND THE PART THAT IS NOT IS THE WHOLE EXPORT SECTION. Two of
 * the retention rules are config (`history_limit`, `history_retention_days`)
 * and Clear is `clear_transcription_history_entries`. The other three doors
 * have no command at all and are DISABLED with the reason on them (ADR 0065):
 *
 *   - **Full export.** `export_transcription_history` writes the HISTORY as
 *     JSON — History's own Export button is exactly that, and it is wired
 *     there. This row promises "everything local, as one archive", which is a
 *     different thing and nothing produces it.
 *   - **Full import.** There is no import of anything.
 *   - **Reset all settings.** There is no reset-to-defaults.
 *
 * Three Leg 5 contracts, already on the relay's §2.5 list, and they are why
 * this section still carries a banner.
 *
 * THE TWO DOORS ARE REAL: `Open Context` and `Open AI Models` are
 * `runtime.open`. `Open Context` still goes to a V2 screen, which is a fact
 * about Context and not about this row — the row's job is to say where the
 * rule about context objects is stated.
 */
const NO_COMMAND = "No command exists for this yet";

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

export function PrivacyScreen({ banner, runtime }: PartlyWiredScreenProps = {}) {
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  const clear = async () => {
    setClearing(true);
    try {
      await invoke("clear_transcription_history_entries");
      setCleared(true);
    } finally {
      setClearing(false);
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
                runtime ? (
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
                ) : (
                  <Select defaultValue="500" aria-label="Stored transcripts">
                    <option>50</option>
                    <option>100</option>
                    <option>200</option>
                    <option>500</option>
                    <option>1000</option>
                  </Select>
                )
              }
            />
            <Row
              label="Retention"
              hint="Older entries are pruned automatically."
              control={
                runtime ? (
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
                ) : (
                  <Select defaultValue="90 days" aria-label="Retention">
                    <option>7 days</option>
                    <option>30 days</option>
                    <option>90 days</option>
                    <option>1 year</option>
                    <option>Keep all</option>
                  </Select>
                )
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
                    onClick={runtime ? () => runtime.open?.({ view: "context" }) : undefined}
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
                  onClick={runtime ? () => runtime.open?.({ section: "models" }) : undefined}
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
              hint="Everything local, as one archive."
              control={
                <Button
                  icon={<Icon name="download" />}
                  disabled={Boolean(runtime)}
                  title={runtime ? NO_COMMAND : undefined}
                >
                  Export
                </Button>
              }
            />
            <Row
              label="Full import"
              hint="Restores from a previously exported archive."
              control={
                <Button variant="ghost" disabled={Boolean(runtime)} title={runtime ? NO_COMMAND : undefined}>
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
                  onClick={runtime ? () => void clear() : undefined}
                >
                  Clear
                </Button>
              }
            />
            <Row
              label="Reset all settings"
              hint="Restores every setting to its default. History and profiles stay."
              danger
              control={
                <Button
                  variant="danger"
                  disabled={Boolean(runtime)}
                  title={runtime ? NO_COMMAND : undefined}
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
