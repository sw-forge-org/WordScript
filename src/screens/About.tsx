import {
  Button,
  Card,
  CardRows,
  Icon,
  Row,
  SectionHeader,
  StatusBadge,
  ViewTop,
} from "@/components/shell";
import type { ScreenProps } from "./props";

/**
 * ABOUT & UPDATES — `SCREENS.about`.
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
 */
export function AboutScreen({ banner }: ScreenProps = {}) {
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
                  <span className="ws-mono ws-muted">0.2.2-alpha</span>
                  <Button variant="ghost" icon={<Icon name="copy" />}>
                    Copy
                  </Button>
                </span>
              }
            />
            <Row
              label="How you run it today"
              hint="A developer build from source. There is no installer yet."
              control={<span className="ws-mono ws-muted">npm run tauri dev</span>}
            />
            <Row
              label="Latest published release"
              hint="None yet — the cross-platform release path is still being assembled."
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="warning">In progress</StatusBadge>
                  <Button variant="ghost" icon={<Icon name="restore" />}>
                    Check now
                  </Button>
                </span>
              }
            />
            <Row
              label="Target build lanes"
              hint="Linux AppImage, macOS universal, Windows MSI."
              control={<StatusBadge tone="plan">Planned</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader title="Project">
        <Card>
          <CardRows>
            {["GitHub", "SW labs", "Release workflow", "Release runbook"].map((label) => (
              <Row
                key={label}
                label={label}
                control={
                  <Button variant="ghost" icon={<Icon name="external" />}>
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
