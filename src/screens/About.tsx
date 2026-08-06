import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Button,
  Card,
  CardRows,
  Icon,
  Row,
  SectionHeader,
  StatusBadge,
  ViewTop,
  type StatusTone,
} from "@/components/shell";
import {
  APP_RELEASE_RUNBOOK_URL,
  APP_RELEASE_WORKFLOW_URL,
  APP_REPOSITORY_URL,
  APP_SITE_URL,
  APP_VERSION,
} from "@/lib/appMeta";
import type { AppUpdateStatus, AppUpdateStatusKind, ReleaseBuildState } from "@/types/updates";
import type { WiredScreenProps } from "./props";

/**
 * ABOUT & UPDATES — `SCREENS.about`, wired.
 *
 * The shipped card is careful about one thing and this keeps it: until a
 * release exists, this is release-path diagnostics, and it must not read as
 * though installers or in-app updates already work.
 *
 * The version, channel and install kind used to be three stat tiles across the
 * top. A version string is not a metric — it is a fact you copy into a bug
 * report — so it is the first row of the card that is about how this build got
 * here.
 *
 * "NOT BUILT" IS FOR WHAT HAS NO SCREEN AT ALL. A thing that has a screen
 * states its status there. The account row is back in this list because the
 * screen it pointed at no longer exists, and it reads differently now: "not
 * built yet" and "not going to be built" are not the same answer, and only the
 * second belongs in a list somebody reads to find out whether to keep waiting.
 *
 * WHAT IS READ AND WHAT CANNOT BE, because that is the whole of rule 7 here:
 *
 * - The version is the build's own, and the release check returns the RUNNING
 *   BINARY's `current_version`, so once the check has answered that is what
 *   stands. The two agreeing is the normal case; the two disagreeing is a real
 *   fault worth seeing rather than one worth hiding.
 * - Copy puts it on the clipboard, and the button says whether that worked.
 * - The release row is `check_app_update` in full: the badge is the status kind,
 *   the hint is the runtime's own summary, and "Check now" re-runs it. Nothing
 *   about a published release is stated here that GitHub did not just say.
 * - The build-lane badge is the runtime's `ReleaseBuildState`. Its hint is NOT:
 *   the drawing names "Linux AppImage, macOS universal, Windows MSI" and the
 *   runtime's own lanes are DMG, NSIS and AppImage + DEB. That is a fact-level
 *   disagreement between the gallery and the runtime, so it goes on the relay's
 *   §2.5 list for Leg 5 rather than being quietly edited here (ADR 0057).
 * - How you run it today is derived from the build itself — the dev server or a
 *   built bundle — which are the only two ways there are while there is no
 *   installer. WHICH package a built bundle came from (AppImage, a bare binary)
 *   is not knowable from here and is on the same list.
 * - The four project links open for real.
 * - "Not built" is a roadmap, not a runtime state. A row saying a thing does not
 *   exist cannot claim a readiness, so there is nothing to read.
 */

/** `npm run tauri dev` serves this bundle from Vite; a built one does not. */
const RUN_COMMAND = import.meta.env.DEV ? "npm run tauri dev" : "npm run tauri build";

const PROJECT_LINKS: { label: string; url: string }[] = [
  { label: "GitHub", url: APP_REPOSITORY_URL },
  { label: "SW labs", url: APP_SITE_URL },
  { label: "Release workflow", url: APP_RELEASE_WORKFLOW_URL },
  { label: "Release runbook", url: APP_RELEASE_RUNBOOK_URL },
];

function releaseLabel(kind: AppUpdateStatusKind | undefined, checking: boolean): string {
  if (checking) return "Checking";
  switch (kind) {
    case "update_available":
      return "Release found";
    case "up_to_date":
      return "Tracked";
    case "check_failed":
      return "Check failed";
    case "release_path_building":
      return "In progress";
    default:
      return "Not checked";
  }
}

function releaseTone(kind: AppUpdateStatusKind | undefined): StatusTone {
  switch (kind) {
    case "update_available":
    case "up_to_date":
      return "success";
    case "check_failed":
      return "danger";
    case "release_path_building":
      return "warning";
    default:
      return "plan";
  }
}

function buildLaneLabel(state: ReleaseBuildState | undefined): string {
  switch (state) {
    case "published":
      return "Published";
    case "building":
      return "Building";
    case "planned":
      return "Planned";
    default:
      return "Not checked";
  }
}

function buildLaneTone(state: ReleaseBuildState | undefined): StatusTone {
  return state === "published" ? "success" : "plan";
}

export function AboutScreen({ banner, runtime }: WiredScreenProps) {
  const { active } = runtime;
  const [status, setStatus] = useState<AppUpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    setCheckError(null);
    try {
      setStatus(await invoke<AppUpdateStatus>("check_app_update"));
    } catch (error) {
      setStatus(null);
      setCheckError(error instanceof Error ? error.message : String(error));
    } finally {
      setChecking(false);
    }
  }, []);

  /* Once, when the section is first looked at. It is a network call to GitHub,
     so it does not run for a section nobody opened and it does not re-run every
     time the sheet is re-opened — "Check now" is the control that says re-run. */
  const asked = status !== null || checkError !== null;
  useEffect(() => {
    if (!active || asked || checking) return;
    void check();
  }, [active, asked, checking, check]);

  const version = status?.current_version ?? APP_VERSION;
  // Every lane the runtime reports carries the same state today; if that ever
  // stops being true, the row states the least advanced of them rather than the
  // most, because one published lane is not a published release.
  const laneState = status?.build_targets.reduce<ReleaseBuildState | undefined>((lowest, track) => {
    if (lowest === undefined) return track.state;
    if (lowest === "planned" || track.state === "planned") return "planned";
    if (lowest === "building" || track.state === "building") return "building";
    return "published";
  }, undefined);

  const copyVersion = async () => {
    try {
      await navigator.clipboard.writeText(version);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.error("copying the version failed:", error);
      setCopied(false);
    }
  };

  return (
    <>
      <ViewTop title="About & Updates" lead="Lightweight speech-to-text for your desktop." banner={banner} />

      <SectionHeader title="This build">
        <Card>
          <CardRows>
            <Row
              label="Version"
              control={
                <span className="ws-rowflex">
                  <span className="ws-mono ws-muted">{version}</span>
                  <Button variant="ghost" icon={<Icon name="copy" />} onClick={() => void copyVersion()}>
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </span>
              }
            />
            <Row
              label="How you run it today"
              hint="A developer build from source. There is no installer yet."
              control={<span className="ws-mono ws-muted">{RUN_COMMAND}</span>}
            />
            <Row
              label="Latest published release"
              hint={
                checkError
                  ? `The release check could not run: ${checkError}`
                  : status?.summary ??
                    (checking ? "Asking GitHub for the latest release…" : "Not checked yet.")
              }
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone={checkError ? "danger" : releaseTone(status?.status)}>
                    {checkError ? "Check failed" : releaseLabel(status?.status, checking)}
                  </StatusBadge>
                  <Button
                    variant="ghost"
                    icon={<Icon name="restore" />}
                    disabled={checking}
                    onClick={() => void check()}
                  >
                    Check now
                  </Button>
                </span>
              }
            />
            <Row
              label="Target build lanes"
              hint="Linux AppImage, macOS universal, Windows MSI."
              control={<StatusBadge tone={buildLaneTone(laneState)}>{buildLaneLabel(laneState)}</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader title="Project">
        <Card>
          <CardRows>
            {PROJECT_LINKS.map((link) => (
              <Row
                key={link.label}
                label={link.label}
                control={
                  <Button
                    variant="ghost"
                    icon={<Icon name="external" />}
                    onClick={() => {
                      void openUrl(link.url).catch((error) =>
                        console.error(`opening ${link.url} failed:`, error),
                      );
                    }}
                  >
                    Open
                  </Button>
                }
              />
            ))}
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader title="Not built" description="Named here so it is not looked for elsewhere.">
        <Card>
          <CardRows>
            <Row
              label="Translation mode"
              hint="Not decided. Recorded as a roadmap candidate with an open gate."
              control={<StatusBadge tone="plan">Candidate</StatusBadge>}
            />
            <Row
              label="Meeting capture"
              hint="Sketched as a preview. Needs system-audio capture and a second window."
              control={<StatusBadge tone="plan">Preview</StatusBadge>}
            />
            <Row
              label="Account, sign-in and sync"
              hint="Not planned, rather than not started. Everything is on this machine, there is nothing to sign in to, and no server of ours holds anything. The keys you do hold are model vendors' and live in AI Models."
              control={<StatusBadge tone="success">Never</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>
    </>
  );
}
