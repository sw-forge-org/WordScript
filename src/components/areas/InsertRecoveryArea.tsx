import { type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CheckCircle2, Circle, Play, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FormCard,
  FormRow,
  Select,
  StatusBadge,
  Toggle,
  VolumeSlider,
  type StatusTone,
} from "@/components/shell";
import { useNativeInsertion } from "@/hooks/useNativeInsertion";
import { relativeTime, truncate } from "@/lib/format";
import { buildTextProfilesPatch, clearTextProfileCuration, resolveActiveTextProfile } from "@/lib/textProfiles";
import { cn } from "@/lib/utils";
import type { AppConfig, TextProfileInsertBehavior } from "@/types/ipc";
import type {
  NativeClipboardRestoreStatus,
  NativeInsertDriver,
  NativeInsertReadiness,
  NativeInsertRecoveryAction,
} from "@/types/nativeInsertion";

interface Props {
  config: AppConfig;
  onChange: (p: Partial<AppConfig>) => void;
}

// Mirrors `core::sound::pack::SoundPack` and `core::sound::cue::SoundCue`.
// The runtime clamps unknown pack ids back to the default, so a stale entry
// here degrades to the default voice rather than to silence.
const SOUND_PACKS = [
  { id: "timber", label: "Timber — warm mallet" },
  { id: "glass", label: "Glass — soft bell" },
  { id: "air", label: "Air — breath" },
  { id: "tap", label: "Tap — short and dry" },
] as const;

const SOUND_CUES = [
  { id: "startup", label: "Startup" },
  { id: "listen", label: "Listen" },
  { id: "handoff", label: "Handoff" },
  { id: "done", label: "Done" },
  { id: "abort", label: "Abort" },
  { id: "error", label: "Error" },
] as const;

const tierTone: Record<string, StatusTone> = {
  tier1: "success",
  preview: "info",
  experimental: "warning",
};

function insertDriverLabel(value: NativeInsertDriver | undefined) {
  switch (value) {
    case "wl_copy":
      return "wl-copy";
    case "arboard":
      return "arboard clipboard";
    case "xdotool":
      return "xdotool";
    case "wtype":
      return "wtype";
    case "ydotool":
      return "ydotool";
    case "enigo":
      return "enigo";
    case "scratchpad":
      return "scratchpad recovery";
    default:
      return "Detecting current driver";
  }
}

function insertReadinessLabel(value: NativeInsertReadiness | null | undefined) {
  switch (value) {
    case "ready":
      return "Ready";
    case "recovery_only":
      return "Recovery only";
    default:
      return "Checking preflight";
  }
}

function recoveryActionLabel(value: NativeInsertRecoveryAction | null | undefined) {
  switch (value) {
    case "none":
      return "No recovery action needed";
    case "manual_paste":
      return "Manual paste";
    case "use_scratchpad":
      return "Use scratchpad";
    default:
      return "Recovery ready";
  }
}

function clipboardRestoreLabel(value: NativeClipboardRestoreStatus | null | undefined) {
  switch (value) {
    case "scheduled":
      return "previous clipboard restore scheduled";
    case "skipped_no_previous_clipboard":
      return "no previous clipboard to restore";
    case "not_attempted":
      return "clipboard restore not needed";
    default:
      return null;
  }
}

function MetaRow({
  label,
  value,
  code,
  divider = true,
}: {
  label: string;
  value: ReactNode;
  code?: ReactNode;
  divider?: boolean;
}) {
  return (
    <FormRow
      label={label}
      divider={divider}
      align={code ? "start" : "center"}
      control={
        <div className="flex flex-col items-end gap-0.5 text-right">
          <span className="text-[12px] text-fg-dim">{value}</span>
          {code && (
            <span
              className="max-w-[280px] truncate font-mono text-[11px] text-fg-muted"
              title={typeof code === "string" ? code : undefined}
            >
              {code}
            </span>
          )}
        </div>
      }
    />
  );
}

export function InsertRecoveryArea({ config, onChange }: Props) {
  const insertion = useNativeInsertion();
  const platform = insertion.status?.platform;
  const last = insertion.status?.last_transcript;
  const scratchpadCount = insertion.status?.scratchpad_entries.length ?? 0;
  const scratchpadLabel = scratchpadCount === 1 ? "1 fallback entry" : `${scratchpadCount} fallback entries`;
  const activeDriverLabel = insertDriverLabel(platform?.active_driver);
  const insertPreflightLabel = insertReadinessLabel(platform?.readiness);
  const driverChain = platform?.driver_chain ?? [];
  const driverChainSummary = driverChain.length > 0
    ? driverChain.map((item) => item.label).join(" -> ")
    : "Detecting current insert chain.";
  const activeProfile = resolveActiveTextProfile(config);
  const profileInsertBehavior = activeProfile.work_mode?.insert_behavior ?? "auto_paste";
  const deliveryLabel = profileInsertBehavior === "clipboard_only" ? "Clipboard only" : "Insert at cursor";
  const deliverySummary = profileInsertBehavior === "clipboard_only"
    ? "Clipboard only keeps the transcript ready for manual paste and never sends a paste shortcut into the active app."
    : "Direct insert copies the transcript, pastes it at the cursor and restores your previous clipboard afterwards.";
  const soundSummary = config.play_sounds
    ? "Listen when capture starts, handoff when it stops, done when the text landed, plus abort and error."
    : "Native sound cues are off. Preview still works.";
  const deliveryDriverSummary = platform
    ? `${insertPreflightLabel}: ${platform.readiness_message} Current driver: ${activeDriverLabel}. ${platform.platform_label} reports ${driverChainSummary}.`
    : "WordScript is checking the current native insert chain.";
  const portalDiagnosticSummary = platform
    ? [
        platform.portal_capabilities
          ? `Compositor: ${String(platform.portal_capabilities.compositor).replace(/_/g, " ")} · xdg-desktop-portal: ${
              platform.portal_capabilities.has_xdg_desktop_portal_daemon ? "present" : "missing"
            } · RemoteDesktop: ${
              platform.portal_capabilities.has_remote_desktop_portal ? "reachable" : "not reachable"
            }`
          : null,
        platform.paste_disabled_reason ? `Why auto-paste is restricted: ${platform.paste_disabled_reason}` : null,
      ]
        .filter((value): value is string => value !== null)
        .join(" · ")
    : "";
  const latestFallbackReason = insertion.lastRestore?.fallback_reason
    ?? insertion.status?.last_transcript?.fallback_reason
    ?? null;
  const latestRecoveryAction = insertion.lastRestore?.recovery_action
    ?? insertion.status?.last_transcript?.recovery_action
    ?? null;
  const latestRecoveryMessage = insertion.lastRestore?.recovery_message
    ?? insertion.status?.last_transcript?.recovery_message
    ?? latestFallbackReason
    ?? null;
  const latestClipboardRestore = insertion.lastRestore?.clipboard_restore
    ?? insertion.status?.last_transcript?.clipboard_restore
    ?? null;
  const latestClipboardRestoreLabel = clipboardRestoreLabel(latestClipboardRestore);

  return (
    <div className="flex flex-col gap-8">
      <FormCard
        title="Insert readiness"
        description="Whether WordScript can place transcribed text into the focused app, and which native driver it uses right now."
        action={
          <Button
            size="sm"
            variant="outline"
            disabled={insertion.isLoading}
            onClick={() => void insertion.refresh()}
          >
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        }
      >
        {platform ? (
          <>
            <FormRow
              label="Platform"
              control={
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-fg-dim">{platform.platform_label}</span>
                  <StatusBadge tone={tierTone[platform.support_tier] ?? "neutral"}>
                    {platform.support_tier}
                  </StatusBadge>
                </div>
              }
            />
            <FormRow
              label="Readiness"
              hint={platform.readiness_message}
              control={
                <StatusBadge tone={platform.readiness === "ready" ? "success" : "warning"} dot>
                  {platform.readiness === "ready" ? "Ready" : "Recovery only"}
                </StatusBadge>
              }
            />
            <MetaRow label="Insert driver" value={activeDriverLabel} code={platform.insert_strategy ?? "detecting"} />
            <MetaRow label="Insert preflight" value={insertPreflightLabel} code={platform.support_tier ?? "detecting"} />
            <MetaRow
              label="Insert strategy"
              divider={false}
              value={
                <span className="font-mono text-[12px] text-fg-dim">
                  {platform.insert_strategy} · {platform.active_driver}
                </span>
              }
            />
          </>
        ) : (
          <div className="py-6 text-center text-[12px] text-fg-muted">
            Checking the native insert chain…
          </div>
        )}
      </FormCard>

      {platform && driverChain.length > 0 && (
        <FormCard title="Driver chain" description="Order WordScript tries to deliver text.">
          <ul className="flex flex-col">
            {driverChain.map((driver) => (
              <li
                key={driver.driver}
                className="flex items-start gap-3 border-b border-border py-2.5 last:border-b-0"
              >
                {driver.available ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--green)]" />
                ) : (
                  <Circle className="mt-0.5 size-4 shrink-0 text-fg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-foreground">{driver.label}</span>
                    {driver.active && <StatusBadge tone="accent">active</StatusBadge>}
                  </div>
                  <p className="mt-0.5 text-[12px] text-fg-dim">{driver.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </FormCard>
      )}

      {platform && (platform.prerequisites.length > 0 || platform.caveats.length > 0) && (
        <FormCard title="Prerequisites & limits">
          {platform.prerequisites.map((item, i) => (
            <FormRow key={`pre-${i}`} label={<span className="font-normal text-fg-dim">{item}</span>} />
          ))}
          {platform.caveats.map((item, i) => (
            <FormRow
              key={`cav-${i}`}
              divider={i < platform.caveats.length - 1}
              label={<span className="font-normal text-[var(--orange)]">{item}</span>}
            />
          ))}
        </FormCard>
      )}

      <FormCard
        title="Delivery"
        description="How the finished transcript reaches the focused app."
      >
        <FormRow
          label="Transcript delivery"
          hint={deliverySummary}
          align="start"
          control={
            <Select
              aria-label="Transcript delivery"
              className="w-[240px]"
              value={profileInsertBehavior}
              onChange={(event) => {
                const nextBehavior = event.target.value as TextProfileInsertBehavior;
                const nextProfiles = config.text_profiles.map((profile) =>
                  profile.id === activeProfile.id
                    ? clearTextProfileCuration({
                      ...profile,
                      work_mode: { ...profile.work_mode!, insert_behavior: nextBehavior },
                    })
                    : profile,
                );
                onChange(buildTextProfilesPatch(config, nextProfiles, activeProfile.id));
              }}
            >
              <option value="auto_paste">Copy and insert at cursor</option>
              <option value="clipboard_only">Copy to clipboard only</option>
            </Select>
          }
        />
        <FormRow
          label="Native insert chain"
          hint={deliveryDriverSummary}
          align="start"
          divider={Boolean(portalDiagnosticSummary)}
          control={
            <StatusBadge tone={platform?.readiness === "ready" ? "success" : "warning"} dot>
              {activeDriverLabel}
            </StatusBadge>
          }
        />
        {portalDiagnosticSummary && (
          <FormRow
            label="Linux portal diagnostics"
            hint={portalDiagnosticSummary}
            hintTone="danger"
            align="start"
            divider={false}
          />
        )}
      </FormCard>

      <FormCard
        title="Sound"
        description="Audio cues report what the runtime is actually doing: listening, handing off to the pipeline, and confirming that text landed."
      >
        <FormRow
          label="Play sound cues"
          hint={soundSummary}
          htmlFor="play-sounds-toggle"
          control={
            <Toggle
              id="play-sounds-toggle"
              checked={config.play_sounds}
              onCheckedChange={(checked) => onChange({ play_sounds: checked })}
            />
          }
        />
        <FormRow
          label="Play the signature at launch"
          hint="The full G-major theme, once when WordScript starts. The operational cues are fragments of it."
          htmlFor="startup-sound-toggle"
          control={
            <Toggle
              id="startup-sound-toggle"
              checked={config.play_startup_sound}
              disabled={!config.play_sounds}
              onCheckedChange={(checked) => onChange({ play_startup_sound: checked })}
            />
          }
        />
        <FormRow
          label="Sound pack"
          hint="All packs play the same motif, so cues stay recognisable across packs."
          htmlFor="sound-pack-select"
          control={
            <Select
              id="sound-pack-select"
              value={config.sound_pack}
              onChange={(event) => onChange({ sound_pack: event.target.value })}
            >
              {SOUND_PACKS.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.label}
                </option>
              ))}
            </Select>
          }
        />
        <FormRow
          label="Cue volume"
          hint="How loud the cues are within WordScript. How loud WordScript is against other apps stays yours to set in the system mixer, where it appears as its own entry — the two are deliberately separate, the same way Discord, Slack or Spotify handle it."
          htmlFor="sound-volume-slider"
          control={
            <VolumeSlider
              id="sound-volume-slider"
              value={config.sound_volume}
              onChange={(value) => onChange({ sound_volume: value })}
            />
          }
        />
        <FormRow
          label="Preview"
          hint="Plays through the native runtime, so this is exactly what you will hear in use — also while cues are switched off."
          layout="stacked"
          divider={false}
          control={
            <div className="flex flex-wrap gap-1.5">
              {SOUND_CUES.map((cue) => (
                <Button
                  key={cue.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void invoke("preview_sound_cue", {
                      cue: cue.id,
                      pack: config.sound_pack,
                      volume: config.sound_volume,
                    }).catch(() => undefined);
                  }}
                >
                  <Play className="size-3" />
                  {cue.label}
                </Button>
              ))}
            </div>
          }
        />
      </FormCard>

      <FormCard
        title="Recovery"
        description="Use recovery when direct insert failed, the target app ignored paste, or you want the latest transcript back without reopening diagnostics."
      >
        <FormRow
          label="Last recoverable transcript"
          hint={last ? truncate(last.text, 90) : "Nothing buffered."}
          align="start"
          control={
            <div className="flex flex-col items-end gap-1">
              {last ? (
                <span className="text-[11px] tabular-nums text-fg-muted">
                  {relativeTime(last.created_at_ms)}
                </span>
              ) : null}
              <StatusBadge tone={last ? "success" : "neutral"} dot>
                {last ? "Available" : "No transcript stored yet"}
              </StatusBadge>
              {last && (
                <span className="font-mono text-[11px] text-fg-muted">
                  {`${last.insert_mode} · ${recoveryActionLabel(latestRecoveryAction)}`}
                </span>
              )}
            </div>
          }
        />
        <FormRow
          label="Recovery scratchpad"
          hint={insertion.status?.scratchpad_path ?? "Loading recovery path"}
          align="start"
          control={
            <StatusBadge tone={scratchpadCount > 0 ? "success" : "neutral"} dot>
              {scratchpadLabel}
            </StatusBadge>
          }
        />
        <div className="flex flex-wrap gap-2 border-t border-border py-3">
          <Button
            size="sm"
            variant="outline"
            disabled={insertion.isLoading || !last}
            onClick={() => void insertion.restoreLastTranscript()}
          >
            <RotateCcw /> Restore recoverable transcript
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={insertion.isLoading || !insertion.status?.scratchpad_entries.length}
            onClick={() => void insertion.clearScratchpad()}
          >
            <Trash2 /> Clear recovery scratchpad
          </Button>
        </div>
        <p
          className={cn(
            "text-[12px] leading-snug",
            insertion.error ? "text-[var(--red)]" : insertion.lastRestore ? "text-[var(--green)]" : "text-fg-dim",
          )}
        >
          {insertion.error
            ?? latestRecoveryMessage
            ?? (insertion.lastRestore
              ? "Recoverable transcript restored through native insertion."
              : `${scratchpadLabel} ready for recovery if direct insert fails.`)}
          {latestClipboardRestoreLabel ? ` ${latestClipboardRestoreLabel}.` : ""}
        </p>
      </FormCard>
    </div>
  );
}