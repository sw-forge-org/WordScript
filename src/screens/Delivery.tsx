import {
  Button,
  Card,
  CardRows,
  CheckList,
  Disclosure,
  Icon,
  Row,
  ScopeTag,
  SectionHeader,
  StatusBadge,
  ViewTop,
} from "@/components/shell";
import type { ScreenProps } from "./props";

/**
 * DELIVERY & INSERT — `SCREENS.delivery`.
 *
 * Delivery is its own axis (ADR 0011a), but the choice on that axis is
 * per-profile in the runtime — the same value ADR 0024 was written about for
 * the mode. So the choice stands once, in the profile, and this section answers
 * the question only it can answer: can this machine deliver at all, and by what
 * route.
 *
 * TWO STAGES AND A FALLBACK, NOT ONE CHAIN. The screen drew one ordered chain
 * until it was corrected against `core/insertion.rs`, which had been right all
 * along. `NativeInsertDriver::role()` returns "clipboard" for wl-copy and
 * arboard, "paste" for xdotool/wtype/ydotool/enigo, and "recovery" for the
 * scratchpad; putting a clipboard writer, a paste driver and a fallback in one
 * list makes them look like alternatives for the same job, which is how three
 * of the eight drivers went unnoticed. And wtype and ydotool are excluded BY
 * DECISION rather than by an absent binary — the difference between "install a
 * package" and "this will never work here".
 */
export function DeliveryScreen({ banner }: ScreenProps = {}) {
  return (
    <>
      <ViewTop
        title="Delivery & Insert"
        lead="How a finished transcript reaches the app you are writing in."
        banner={banner}
      />

      <SectionHeader title="Where transcripts go">
        <Card>
          <CardRows>
            <Row
              label="General writing delivers"
              hint="Pastes at the cursor, then restores your clipboard."
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="accent">Insert at cursor</StatusBadge>
                  <ScopeTag profile="Change in profile" onOpen={() => undefined} />
                </span>
              }
            />
            <Row
              label="Agent bridge"
              hint="Returns the transcript to the waiting agent and inserts nothing. The caller decides this, not a profile."
              control={<StatusBadge tone="plan">Phase 8</StatusBadge>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader title="This machine">
        <Card description="Whether text can reach the focused app right now.">
          <CardRows>
            <Row
              label="Platform"
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="success">tier 1</StatusBadge>
                  <span className="ws-mono ws-muted">Linux · X11</span>
                </span>
              }
            />
            <Row
              label="Readiness"
              hint="Direct paste available. The previous clipboard is restored after every insert."
              control={<StatusBadge tone="success">Ready</StatusBadge>}
            />
            <Row
              label="Strategy"
              control={<span className="ws-mono ws-muted">auto_paste · xdotool</span>}
            />
          </CardRows>
        </Card>
      </SectionHeader>

      <SectionHeader title="How text gets there" description="Two stages and a fallback, not one chain.">
        <Card>
          <div className="ws-stack ws-gap4">
            <div className="ws-grp">
              <label>1 · Put it on the clipboard</label>
              <CheckList
                items={[
                  {
                    state: "todo",
                    label: "wl-copy",
                    detail: "Wayland clipboard. This session is X11, so it is not a candidate.",
                  },
                  {
                    state: "ok",
                    label: "arboard clipboard",
                    detail: "Cross-platform, always last, always available.",
                    trailing: <StatusBadge tone="accent">in use</StatusBadge>,
                  },
                ]}
              />
            </div>

            <div className="ws-grp">
              <label>2 · Make the target take it</label>
              <CheckList
                items={[
                  {
                    state: "ok",
                    label: "xdotool type",
                    detail: "Types the text directly, before either chain, for up to 800 characters.",
                    trailing: <StatusBadge tone="accent">in use</StatusBadge>,
                  },
                  {
                    state: "ok",
                    label: "xdotool",
                    detail: "Sends ctrl+v. The previous clipboard is restored afterwards.",
                  },
                  {
                    state: "todo",
                    label: "enigo",
                    detail: "The only paste driver on Windows and macOS. On Linux, hybrid sessions without xdotool.",
                  },
                  {
                    state: "fail",
                    label: "wtype · ydotool",
                    detail: "Excluded by design, not missing: both trigger a compositor privilege prompt per paste, which is what clipboard-only avoids.",
                  },
                ]}
              />
            </div>

            <div className="ws-grp">
              <label>When none of it works</label>
              <Card>
                <CardRows>
                  <Row
                    label="Recovery scratchpad"
                    hint="Not a driver and not in either chain — it is where a transcript waits when nothing could place it."
                    control={<StatusBadge tone="success">Always</StatusBadge>}
                  />
                </CardRows>
              </Card>
            </div>
          </div>
        </Card>
      </SectionHeader>

      {/* THE INCIDENT LEFT THIS CARD — §11.51. It carried the last failed
          transcript verbatim, with a Restore button. That same event is now a
          row in Home's decision inbox, where it has an expiry and an action,
          and a row in History, where it is the record. What is left is what
          only this screen can answer. */}
      <SectionHeader title="Recovery">
        <Card description="Where a transcript waits when nothing could place it.">
          <CardRows>
            <Row
              label="Scratchpad"
              hint="~/.local/state/wordscript/scratchpad.jsonl"
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="success">3 entries</StatusBadge>
                  <Button variant="ghost" icon={<Icon name="trash" />}>
                    Clear
                  </Button>
                </span>
              }
            />
            <Row
              label="Something waiting right now"
              hint="A failed insert is reported once, on Home, where the action that clears it lives. It is a record in History afterwards either way."
              control={
                <Button variant="ghost" icon={<Icon name="arrow" />}>
                  Open Home
                </Button>
              }
            />
          </CardRows>
        </Card>
      </SectionHeader>

      {/* Three rows, one badge, repeated three times: every one said "Not this
          session", which is the only thing they had in common and therefore the
          one thing worth saying once. */}
      <SectionHeader title="Limits on other platforms" description="None of these apply to this session.">
        <Card>
          <Disclosure summary="Wayland, elevated Windows targets, macOS permissions" count={3}>
            <Row
              label="Wayland"
              hint="The portal does not grant synthetic input to every compositor; those sessions fall back to clipboard-only. Here: compositor mutter, xdg-desktop-portal present, RemoteDesktop not reachable."
            />
            <Row
              label="Elevated Windows targets"
              hint="A non-elevated WordScript cannot paste into an elevated window."
            />
            <Row
              label="macOS permissions"
              hint="Accessibility and Input Monitoring are required for development builds."
            />
          </Disclosure>
        </Card>
      </SectionHeader>
    </>
  );
}
