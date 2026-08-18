import { useEffect, useState } from "react";
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
  type CheckItem,
  type StatusTone,
} from "@/components/shell";
import { useNativeInsertion } from "@/hooks/useNativeInsertion";
import { resolveActiveTextProfile, resolveTextProfileWorkMode } from "@/lib/textProfiles";
import type {
  NativeInsertDriverStatus,
  NativeInsertReadiness,
  NativeSupportTier,
  PortalGrantStatus,
} from "@/types/nativeInsertion";
import type { WiredScreenProps } from "./props";

/**
 * DELIVERY & INSERT — `SCREENS.delivery`, wired.
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
 *
 * THE DRAWING TURNED OUT TO BE A SCREENSHOT OF `native_insertion_status`, which
 * is why wiring it is a mapping rather than a rebuild. The platform label, the
 * tier, the readiness sentence, the strategy, the active driver, all three
 * groups of the chain with their detail lines, the scratchpad's path and its
 * entry count, and the caveats behind the disclosure are that one command's
 * fields. Every driver row's `ok` / `todo` / `fail` is the runtime's
 * `available` and its role, never a guess: `available: false` with a
 * `paste_disabled_reason` is `fail` — excluded by decision — and `available:
 * false` without one is `todo`, which is a package away.
 *
 * WHAT IS NOT READ, AND SAYS SO. The Agent bridge is Phase 8 and states that
 * rather than a readiness. The three doors — the profile's scope tag, Open Home
 * — render only when the workspace passed an `open`, which the Diagnostics
 * pop-out does not; a button that opens nothing is the fake affordance rule 7
 * forbids.
 */

function tierLabel(tier: NativeSupportTier | undefined): string {
  switch (tier) {
    case "tier1":
      return "tier 1";
    case "preview":
      return "preview";
    case "experimental":
      return "experimental";
    default:
      return "not read";
  }
}

function tierTone(tier: NativeSupportTier | undefined): StatusTone {
  return tier === "tier1" ? "success" : tier === undefined ? "plan" : "warning";
}

function readinessLabel(readiness: NativeInsertReadiness | undefined): string {
  switch (readiness) {
    case "ready":
      return "Ready";
    case "recovery_only":
      return "Recovery only";
    default:
      return "Not read";
  }
}

/**
 * A driver's state is the runtime's `available` plus WHY it is not available.
 * `paste_disabled_reason` is the runtime saying a driver was ruled out by
 * decision — that is `fail`, the crossed mark. An unavailable driver with no
 * reason is `todo`, the empty ring: nothing is wrong with it, this session just
 * is not the one it serves.
 */
function driverCheck(driver: NativeInsertDriverStatus, excludedByDecision: boolean): CheckItem {
  return {
    state: driver.available ? "ok" : excludedByDecision ? "fail" : "todo",
    label: driver.label,
    detail: driver.detail,
    trailing: driver.active ? <StatusBadge tone="accent">in use</StatusBadge> : undefined,
  };
}

/**
 * THE ONE-TIME INPUT PERMISSION, AND WHY IT IS A BUTTON.
 *
 * On a Wayland session the only mechanism that can put text into a NATIVE
 * Wayland window is the RemoteDesktop portal, and it needs the desktop's
 * "Control input devices" permission once. Where that request lives was the
 * owner's decision and it was made against experience: an early WordScript
 * asked every single time, and the answer was "properly once in the settings,
 * or not at all". So it is here, it is pressed deliberately, and no dictation
 * ever raises it (ADR 0234). A run without the permission goes to the clipboard
 * and says which button fixes that.
 *
 * A REFUSAL IS REMEMBERED, NOT RE-ASKED. Saying no once means WordScript stops
 * asking; this button is how somebody takes that back, which is why its label
 * changes rather than the row disappearing.
 */
function grantTone(grant: PortalGrantStatus): StatusTone {
  switch (grant.phase) {
    case "granted":
      return "success";
    case "refused":
      return "warning";
    case "failed":
      return "danger";
    default:
      return "plan";
  }
}

function grantLabel(grant: PortalGrantStatus): string {
  switch (grant.phase) {
    case "granted":
      return "Granted";
    case "refused":
      return "Refused";
    case "failed":
      return "Could not restore";
    default:
      return "Not granted";
  }
}

export function DeliveryScreen({ banner, runtime }: WiredScreenProps) {
  const { config, active, open } = runtime;
  const { status, error, isLoading, refresh, clearScratchpad, requestPortalGrant } =
    useNativeInsertion();

  /* `useNativeInsertion` reads once on mount, which is what a section the user
     just opened wants. It is re-read when the section comes back into view,
     because a driver can be installed and a session can change while the sheet
     is closed. */
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!active) {
      setSeen(false);
      return;
    }
    if (seen) return;
    setSeen(true);
    void refresh();
  }, [active, seen, refresh]);

  const platform = status?.platform ?? null;
  const workMode = resolveTextProfileWorkMode(resolveActiveTextProfile(config));
  const profileLabel = resolveActiveTextProfile(config).label;
  const clipboardOnly = workMode.insert_behavior === "clipboard_only";
  /* This row is the one place the product states its delivery behaviour in
     words, and both switches change that behaviour. It said "then restores your
     clipboard" unconditionally, which stops being true the moment the profile
     asks to keep it -- a promise the runtime would no longer keep. */
  const deliveryHint = clipboardOnly
    ? workMode.clipboard_immediately
      ? "Puts the transcript on the clipboard as soon as it exists and leaves it to you to paste."
      : "Puts the transcript on the clipboard when the preview closes, and leaves it to you to paste."
    : workMode.keep_on_clipboard
      ? "Pastes at the cursor and leaves the transcript on your clipboard."
      : "Pastes at the cursor, then restores your clipboard.";

  const chain = platform?.driver_chain ?? [];
  const excluded = new Set(
    platform?.paste_disabled_reason
      ? chain.filter((driver) => !driver.available && driver.role === "paste").map((d) => d.driver)
      : [],
  );
  const clipboardStage = chain.filter((driver) => driver.role === "clipboard");
  const pasteStage = chain.filter((driver) => driver.role === "paste");
  const recovery = chain.find((driver) => driver.role === "recovery") ?? null;

  /* `null` where there is nothing to grant -- a desktop with no RemoteDesktop
     portal, or a platform that never had this problem. An absent permission and
     an ungranted one are different states, and only one of them is a button. */
  const grant = status?.portal_grant ?? null;
  const caveats = platform?.caveats ?? [];
  const scratchpadCount = status?.scratchpad_entries.length ?? 0;

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
              label={`${profileLabel} delivers`}
              hint={deliveryHint}
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone="accent">
                    {clipboardOnly ? "Clipboard only" : "Insert at cursor"}
                  </StatusBadge>
                  {open && (
                    <ScopeTag profile="Change in profile" onOpen={() => open({ view: "profiles" })} />
                  )}
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
                  <StatusBadge tone={tierTone(platform?.support_tier)}>
                    {tierLabel(platform?.support_tier)}
                  </StatusBadge>
                  <span className="ws-mono ws-muted">
                    {platform?.platform_label ?? (isLoading ? "reading…" : "not read")}
                  </span>
                </span>
              }
            />
            <Row
              label="Readiness"
              hint={error ?? platform?.readiness_message ?? undefined}
              control={
                <StatusBadge
                  tone={
                    error
                      ? "danger"
                      : platform?.readiness === "ready"
                        ? "success"
                        : platform
                          ? "warning"
                          : "plan"
                  }
                >
                  {error ? "Could not read" : readinessLabel(platform?.readiness)}
                </StatusBadge>
              }
            />
            <Row
              label="Strategy"
              control={
                <span className="ws-mono ws-muted">
                  {platform ? `${platform.insert_strategy} · ${platform.active_driver}` : "not read"}
                </span>
              }
            />
          </CardRows>
        </Card>
      </SectionHeader>

      {grant && (
        <SectionHeader title="Insert on Wayland">
          <Card description="Native Wayland windows only accept typed input from an app the desktop has given permission to. It is asked for once, here.">
            <CardRows>
              <Row
                label="Input permission"
                hint={grant.detail}
                control={
                  <span className="ws-rowflex">
                    <StatusBadge tone={grantTone(grant)}>{grantLabel(grant)}</StatusBadge>
                    {grant.can_request && (
                      <Button
                        variant="ghost"
                        icon={<Icon name="key" />}
                        disabled={isLoading}
                        onClick={() => void requestPortalGrant()}
                      >
                        {grant.phase === "refused" ? "Ask again" : "Grant access"}
                      </Button>
                    )}
                  </span>
                }
              />
              <Row
                label="Desktop"
                hint="The compositor that owns the permission and the windows it applies to."
                control={<span className="ws-mono ws-muted">{grant.compositor}</span>}
              />
            </CardRows>
          </Card>
        </SectionHeader>
      )}

      <SectionHeader title="How text gets there" description="Two stages and a fallback, not one chain.">
        <Card>
          <div className="ws-stack ws-gap4">
            <div className="ws-grp">
              <label>1 · Put it on the clipboard</label>
              <CheckList
                items={
                  clipboardStage.length
                    ? clipboardStage.map((driver) => driverCheck(driver, false))
                    : [{ state: "todo", label: "Not read", detail: "The runtime has not reported a driver chain." }]
                }
              />
            </div>

            <div className="ws-grp">
              <label>2 · Make the target take it</label>
              <CheckList
                items={
                  pasteStage.length
                    ? pasteStage.map((driver) => driverCheck(driver, excluded.has(driver.driver)))
                    : [{ state: "todo", label: "Not read", detail: "The runtime has not reported a driver chain." }]
                }
              />
            </div>

            <div className="ws-grp">
              <label>When none of it works</label>
              <Card>
                <CardRows>
                  <Row
                    label={recovery?.label ?? "Recovery scratchpad"}
                    hint={
                      recovery?.detail ??
                      "Not a driver and not in either chain — it is where a transcript waits when nothing could place it."
                    }
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
              hint={status?.scratchpad_path ?? "The runtime has not reported a path."}
              control={
                <span className="ws-rowflex">
                  <StatusBadge tone={scratchpadCount > 0 ? "success" : "plan"}>
                    {status ? `${scratchpadCount} ${scratchpadCount === 1 ? "entry" : "entries"}` : "not read"}
                  </StatusBadge>
                  <Button
                    variant="ghost"
                    icon={<Icon name="trash" />}
                    disabled={isLoading || scratchpadCount === 0}
                    onClick={() => void clearScratchpad()}
                  >
                    Clear
                  </Button>
                </span>
              }
            />
            {open && (
              <Row
                label="Something waiting right now"
                hint="A failed insert is reported once, on Home, where the action that clears it lives. It is a record in History afterwards either way."
                control={
                  <Button variant="ghost" icon={<Icon name="arrow" />} onClick={() => open({ view: "home" })}>
                    Open Home
                  </Button>
                }
              />
            )}
          </CardRows>
        </Card>
      </SectionHeader>

      {/* Three rows, one badge, repeated three times: every one said "Not this
          session", which is the only thing they had in common and therefore the
          one thing worth saying once. The list is the runtime's `caveats` now,
          so a session where one of them DOES apply says so. */}
      {caveats.length > 0 && (
        <SectionHeader
          title="Limits on other platforms"
          description={
            platform?.readiness === "ready"
              ? "None of these apply to this session."
              : "One of these is why this session cannot paste."
          }
        >
          <Card>
            <Disclosure
              summary={caveats.length === 1 ? "One limit" : `${caveats.length} limits`}
              count={caveats.length}
            >
              {caveats.map((caveat) => (
                <Row key={caveat} label={caveat} />
              ))}
            </Disclosure>
          </Card>
        </SectionHeader>
      )}
    </>
  );
}
