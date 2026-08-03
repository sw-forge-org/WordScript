import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import {
  ActivitySquare,
  BookText,
  Bug,
  Cpu,
  History as HistoryIcon,
  Home,
  Info,
  Keyboard,
  MessageSquare,
  Monitor,
  NotebookPen,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  User,
  type LucideIcon,
} from "lucide-react";
import { useProvider } from "../hooks/useProvider";
import { useRuntime } from "../hooks/useRuntime";
import type { AppConfig } from "../types/ipc";
import type { ProviderId } from "../types/providers";
import type { ProfileHealthLevel, TextRulesAnalysis } from "../types/textRules";
import { ModesTab } from "../components/settings/ModesTab";
import { ApiModelsTab } from "../components/settings/ApiModelsTab";
import { InputTab } from "../components/settings/InputTab";
import { OverlayTab } from "../components/settings/OverlayTab";
import { OverlayDiagPanel } from "../components/settings/OverlayDiagPanel";
import { PromptsTab } from "../components/settings/PromptsTab";
import { AboutTab } from "../components/settings/AboutTab";
import { RebuildLabTab } from "../components/settings/RebuildLabTab";
import { HomeArea } from "../components/areas/HomeArea";
import { HistoryArea } from "../components/areas/HistoryArea";
import { InsertRecoveryArea } from "../components/areas/InsertRecoveryArea";
import { ChatArea } from "../components/areas/ChatArea";
import { UploadArea } from "../components/areas/UploadArea";
import { NotesArea } from "../components/areas/NotesArea";
import { AccountArea } from "../components/areas/AccountArea";
import { Sidebar, ProfileSwitcher, StatusBadge } from "../components/shell";
import {
  SETTINGS_ANCHOR_AREAS,
  settingsAnchorElementId,
  type SettingsAnchor,
} from "../lib/settingsAnchors";
import type { SidebarGroup } from "../components/shell";
import { Button } from "../components/ui/button";
import { TooltipProvider } from "../components/ui/tooltip";
import wordmarkLogo from "../../assets/logos/wordscipt-logo-transparent.png";

type AreaId =
  | "home"
  | "history"
  | "profiles"
  | "speech"
  | "modes"
  | "capture"
  | "overlay"
  | "overlay_diag"
  | "insert_recovery"
  | "diagnostics"
  | "about"
  | "chat"
  | "upload"
  | "notes"
  | "account";

interface AreaDef {
  id: AreaId;
  label: string;
  icon: LucideIcon;
  group: string;
  eyebrow: string;
  blurb: string;
  /** Does this area edit the persisted config draft (show the save bar)? */
  config?: boolean;
}

// DEV-only overlay diagnose area (plan 1784433288646, Phase 1.2). Inlined as
// a conditional spread so the entry is completely absent from production
// builds (import.meta.env.DEV is statically replaced by Vite at build time).
const DEV_OVERLAY_DIAG_AREA: AreaDef[] = import.meta.env.DEV
  ? [{ id: "overlay_diag", label: "Overlay Diag", icon: Bug, group: "System", eyebrow: "Dev Only", blurb: "Live overlay diagnostic log + DevTools access (dev builds only)." }]
  : [];

const AREAS: AreaDef[] = [
  ...DEV_OVERLAY_DIAG_AREA,
  { id: "home", label: "Home", icon: Home, group: "Workspace", eyebrow: "Overview", blurb: "Runtime readiness, recent dictations and quick recovery." },
  { id: "history", label: "History", icon: HistoryIcon, group: "Workspace", eyebrow: "Transcriptions", blurb: "Searchable transcription history, export and retention.", config: true },
  { id: "profiles", label: "Profiles", icon: BookText, group: "Workspace", eyebrow: "Text Rules", blurb: "Context, dictionary, snippets, transcription bias and profile defaults.", config: true },
  { id: "speech", label: "Speech & AI", icon: Cpu, group: "Engine", eyebrow: "Provider & Models", blurb: "Cloud BYOK or local lane, language, STT and cleanup models.", config: true },
  { id: "modes", label: "Modes", icon: SlidersHorizontal, group: "Engine", eyebrow: "AI Reaction", blurb: "Verbatim, cleanup, rewrite, agent or prompt enhancement, plus per-mode hotkeys.", config: true },
  { id: "capture", label: "Capture", icon: Keyboard, group: "Engine", eyebrow: "Input", blurb: "Shortcuts, activation and microphone.", config: true },
  { id: "overlay", label: "Overlay", icon: Monitor, group: "Engine", eyebrow: "Placement", blurb: "Overlay placement, display, anchor and result timeout.", config: true },
  { id: "insert_recovery", label: "Insert & Recovery", icon: ShieldCheck, group: "System", eyebrow: "Delivery & Recovery", blurb: "Insert readiness, driver chain, delivery, portal diagnostics and recovery scratchpad.", config: true },
  { id: "diagnostics", label: "Diagnostics", icon: ActivitySquare, group: "System", eyebrow: "Runtime", blurb: "Capture, transform and insert pipeline diagnostics.", config: true },
  { id: "about", label: "About", icon: Info, group: "System", eyebrow: "Support", blurb: "Version, release path and project links." },
  { id: "chat", label: "Chat", icon: MessageSquare, group: "More", eyebrow: "AI Chat", blurb: "AI chat on transcription context, dictionary and profiles." },
  { id: "upload", label: "Upload", icon: Upload, group: "More", eyebrow: "Batch", blurb: "Audio upload and batch transcription queue." },
  { id: "notes", label: "Notes", icon: NotebookPen, group: "More", eyebrow: "Meeting", blurb: "Meeting notes with speaker diarization and AI enhancement." },
  { id: "account", label: "Account", icon: User, group: "More", eyebrow: "Sync", blurb: "Local account, self-hosting sync and full data export." },
];

interface ConfiguredTriggerStatus {
  hotkey: string;
  pause_hotkey: string;
  abort_hotkey: string;
  registered_hotkey: string | null;
  registered_pause_hotkey: string | null;
  registered_abort_hotkey: string | null;
}

export default function SettingsWindow() {
  const { state, saveConfig } = useRuntime();
  const [form, setForm] = useState<AppConfig | null>(null);
  const [active, setActive] = useState<AreaId>("home");
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [textRulesAnalysis, setTextRulesAnalysis] = useState<TextRulesAnalysis | null>(null);
  const [profileHealthLevel, setProfileHealthLevel] = useState<ProfileHealthLevel | null>(null);

  // Guards the form against a stale `ready` event clobbering an in-flight
  // user edit. `save_config` emits a `ready` carrying the SAVED config; under
  // the Rust config lock overlapping saves resolve in call order (A then B),
  // so ready(A) can land AFTER the user already edited further to B. The
  // unconditional `setForm({ ...state.config })` sync would then revert the
  // form A→B→A→B ("insert_behavior keeps switching"). We count in-flight
  // saves and suppress the external-sync effect while any is pending, then
  // re-sync once from the authoritative runtime config when the last one
  // settles. (plan P1, candidate root C1)
  const inFlightSaveCountRef = useRef(0);
  const [formResyncNonce, setFormResyncNonce] = useState(0);
  const latestConfigRef = useRef<AppConfig | null>(null);
  useEffect(() => {
    latestConfigRef.current = state.config;
  }, [state.config]);

  const selectedProvider: ProviderId =
    (form?.provider ?? state.config?.provider) === "local_preview" ? "local_preview" : "groq";
  const selectedLocalModel =
    selectedProvider === "local_preview"
      ? form?.local_model ?? state.config?.local_model ?? "base"
      : null;
  const selectedCleanupModel =
    selectedProvider === "local_preview"
      ? form?.local_correction_model ?? state.config?.local_correction_model ?? "llama3.2:latest"
      : form?.correction_model ?? state.config?.correction_model ?? "llama-3.3-70b-versatile";
  const { status: providerStatus } = useProvider(selectedProvider, selectedLocalModel, selectedCleanupModel);
  const providerReady =
    selectedProvider === "local_preview"
      ? providerStatus?.local_setup?.readiness === "ready"
      : providerStatus?.credential.configured;

  const navigate = (id: string) => startTransition(() => setActive(id as AreaId));

  // Deep links from outside the settings window — today the overlay's auto-stop
  // tab, which states a number and then offers the control that sets it.
  //
  // The event carries a semantic anchor, not an area id: the settings surface
  // is being reworked and controls move between areas with it, so the mapping
  // lives in one place (`settingsAnchors.ts`) and updating it there is what
  // keeps every link working. An unknown anchor navigates nowhere rather than
  // guessing an area.
  useEffect(() => {
    const unlisten = listen<{ target?: string }>("wordscript-settings-target", ({ payload }) => {
      const anchor = payload.target as SettingsAnchor | undefined;
      if (!anchor) return;
      const area = SETTINGS_ANCHOR_AREAS[anchor];
      if (!area) return;

      navigate(area);
      // After the area has rendered. The row may not exist until the
      // transition commits, so scrolling in the same tick finds nothing.
      requestAnimationFrame(() => {
        const element = document.getElementById(settingsAnchorElementId(anchor));
        if (!element) return;
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        // A brief highlight, because a scroll alone does not say *which* row
        // was meant when several look alike.
        element.setAttribute("data-anchor-flash", "true");
        setTimeout(() => element.removeAttribute("data-anchor-flash"), 1600);
      });
    });
    return () => { void unlisten.then((fn) => fn()); };
  }, []);

  // Populate form when the runtime provides config; route to Speech if not ready.
  useEffect(() => {
    if (state.config && !form) {
      setForm({ ...state.config });
      if (!providerReady) setActive("speech");
    }
  }, [state.config, form, providerReady]);

  // Keep form in sync if config reloads externally — but NEVER clobber an
  // in-flight user edit. While a save is pending, `ready` events carrying
  // older snapshots are skipped (see `inFlightSaveCountRef`); once the last
  // save settles we re-sync from the authoritative runtime config via the
  // nonce. (plan P1, candidate root C1)
  useEffect(() => {
    if (inFlightSaveCountRef.current > 0) return;
    if (state.config) setForm({ ...state.config });
  }, [state.config, formResyncNonce]);

  // Instant save: every patch is immediately persisted. There is no "unsaved
  // changes" state — the form is always in sync with the runtime config.
  // This removes the cognitive overhead of remembering to press "Save changes"
  // and eliminates the class of bugs where a user closes the window and loses
  // their edits. Hotkey / capture / insertion changes also trigger the native
  // runtime reconfiguration immediately.
  const patch = useCallback((partial: Partial<AppConfig>) => {
    setForm((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };

      // Check whether this patch touches native-runtime fields that need
      // immediate reconfiguration beyond just persisting the config.
      const touchesCaptureHotkeys = "hotkey" in partial || "pause_hotkey" in partial || "abort_hotkey" in partial || "activation_mode" in partial;
      const touchesModeHotkeys =
        "mode_picker_hotkey" in partial ||
        "mode_auto_hotkey" in partial || "mode_verbatim_hotkey" in partial ||
        "mode_cleanup_hotkey" in partial || "mode_rewrite_hotkey" in partial ||
        "mode_agent_hotkey" in partial || "mode_prompt_enhance_hotkey" in partial;
      const touchesHotkeys = touchesCaptureHotkeys || touchesModeHotkeys;
      const touchesCapture = "audio_device" in partial || "max_recording_seconds" in partial || "silence_timeout_seconds" in partial;

      // Mark this save as in-flight so the external form-sync effect cannot
      // clobber `next` with a stale `ready` snapshot emitted by an earlier,
      // now-superseded save. (plan P1, candidate root C1)
      inFlightSaveCountRef.current += 1;
      const settle = () => {
        inFlightSaveCountRef.current = Math.max(0, inFlightSaveCountRef.current - 1);
        if (inFlightSaveCountRef.current === 0) {
          // No more in-flight edits: re-sync from the authoritative runtime
          // config (which reflects the latest `ready`, including any change a
          // concurrent path — profile switch / mode hotkey — made in between).
          if (latestConfigRef.current) setForm({ ...latestConfigRef.current });
          setFormResyncNonce((n) => n + 1);
        }
      };

      void saveConfig(next)
        .then(async (saved) => {
          if (touchesHotkeys) {
            try {
              const triggerStatus = await invoke<ConfiguredTriggerStatus>("configure_native_trigger", {
                request: {
                  hotkey: saved.hotkey,
                  pause_hotkey: saved.pause_hotkey,
                  abort_hotkey: saved.abort_hotkey,
                  activation_mode: saved.activation_mode,
                  hold_watchdog_seconds: saved.hold_watchdog_seconds ?? null,
                },
              });
              setForm((f) => f ? {
                ...f,
                hotkey: triggerStatus.registered_hotkey ?? triggerStatus.hotkey,
                pause_hotkey: triggerStatus.registered_pause_hotkey ?? triggerStatus.pause_hotkey,
                abort_hotkey: triggerStatus.registered_abort_hotkey ?? triggerStatus.abort_hotkey,
              } : f);
            } catch (e) {
              setStatus({ msg: `✗  Hotkey registration failed: ${e}`, ok: false });
            }
          }
          if (touchesCapture) {
            try {
              await invoke("configure_native_capture", {
                request: {
                  audio_device: saved.audio_device,
                  max_recording_seconds: saved.max_recording_seconds,
                  silence_timeout_seconds: saved.silence_timeout_seconds,
                },
              });
            } catch { /* non-fatal */ }
          }
          settle();
        })
        .catch((e: unknown) => {
          // Revert the form to the previous state so the invalid hotkey does
          // not linger in the UI, then surface the collision/validation error.
          setForm(prev);
          const message = typeof e === "string" ? e : (e instanceof Error ? e.message : String(e));
          setStatus({ msg: `✗  ${message}`, ok: false });
          settle();
        });

      return next;
    });
  }, [saveConfig]);

  const activeArea = AREAS.find((area) => area.id === active) ?? AREAS[0];

  const groups: SidebarGroup[] = useMemo(() => {
    const order = ["Workspace", "Engine", "System", "More"];
    return order.map((label) => ({
      label,
      items: AREAS.filter((area) => area.group === label).map((area) => ({
        id: area.id,
        label: area.label,
        icon: area.icon,
      })),
    }));
  }, []);

  const readiness = state.error
    ? { label: "Error", title: state.error, ok: false }
    : state.status === "processing"
      ? { label: "Processing", title: "WordScript is currently transcribing the last capture.", ok: true }
      : state.status === "recording"
        ? {
            label: state.paused ? "Paused" : "Recording",
            title: state.paused ? "Recording is paused." : "Recording is active.",
            ok: true,
          }
        : providerReady
          ? {
              label: selectedProvider === "local_preview" ? "Local ready" : "Ready",
              title:
                selectedProvider === "local_preview"
                  ? providerStatus?.local_setup?.guidance ??
                    "Local runtime helper, STT model and cleanup model are configured for the native runtime."
                  : "Groq key is present and the native runtime is configured.",
              ok: true,
            }
          : {
              label: selectedProvider === "local_preview" ? "Needs local setup" : "Needs key",
              title:
                selectedProvider === "local_preview"
                  ? providerStatus?.local_setup?.guidance ??
                    "Configure whisper-cli, a local STT model and a local cleanup model before the local runtime lane can run."
                  : "Add a Groq key before transcription can run.",
              ok: false,
            };

  const laneLabel = selectedProvider === "local_preview" ? "Local runtime" : "Groq cloud";

  const handleCancel = async () => {
    getCurrentWindow().minimize();
  };

  const handleOpenDiagnosticsWindow = async () => {
    try {
      await invoke("open_rebuild_lab_window");
      setStatus({ msg: "✓  Diagnostics window opened.", ok: true });
      setTimeout(() => setStatus(null), 1500);
    } catch (error) {
      setStatus({
        msg: `✗  ${error instanceof Error ? error.message : String(error)}`,
        ok: false,
      });
    }
  };

  if (!form) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-fg-dim">
        Connecting to runtime…
      </div>
    );
  }

  const renderArea = () => {
    switch (active) {
      case "home":
        return (
          <HomeArea
            isActive
            config={form}
            readiness={readiness}
            providerReady={Boolean(providerReady)}
            laneLabel={laneLabel}
            onNavigate={navigate}
          />
        );
      case "history":
        return <HistoryArea isActive config={form} onChange={patch} />;
      case "profiles":
        return (
          <PromptsTab
            config={form}
            onChange={patch}
            onValidationChange={setTextRulesAnalysis}
            onHealthChange={(s) => setProfileHealthLevel(s?.level ?? null)}
          />
        );
      case "speech":
        return <ApiModelsTab config={form} onChange={patch} onOpenDiagnostics={() => navigate("diagnostics")} />;
      case "modes":
        return <ModesTab config={form} onChange={patch} />;
      case "capture":
        return <InputTab config={form} onChange={patch} />;
      case "overlay":
        return <OverlayTab config={form} onChange={patch} />;
      case "overlay_diag":
        return <OverlayDiagPanel />;
      case "insert_recovery":
        return <InsertRecoveryArea config={form} onChange={patch} />;
      case "diagnostics":
        return <RebuildLabTab isActive config={form} onChange={patch} />;
      case "about":
        return <AboutTab isActive />;
      case "chat":
        return <ChatArea />;
      case "upload":
        return <UploadArea />;
      case "notes":
        return <NotesArea />;
      case "account":
        return <AccountArea />;
      default:
        return null;
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full w-full overflow-hidden text-foreground">
        <Sidebar
          groups={groups}
          activeId={active}
          onSelect={navigate}
          header={
            <div className="flex items-center justify-center -ml-4 px-7 pb-4 pt-6">
              <img 
                src={wordmarkLogo} 
                alt="WordScript" 
                className="h-auto w-full max-w-[180px] object-contain"
                style={{ 
                  display: 'block',
                  background: 'transparent',
                  filter: 'none',
                  WebkitFilter: 'none',
                  mixBlendMode: 'normal'
                }} 
              />
            </div>
          }
          footer={
            <ProfileSwitcher
              config={form}
              onChange={patch}
              onEdit={() => navigate("profiles")}
              sessionActive={state.status === "recording" || state.status === "processing"}
            />
          }
        />

        <main className="flex min-w-0 flex-1 flex-col">
          {/* Toolbar header (sits under the native title bar) */}
          <header className="flex min-w-0 shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-strong text-fg-dim">
                <activeArea.icon className="size-[18px]" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-[17px] font-semibold leading-tight tracking-[-0.01em]">
                  {activeArea.label}
                </h1>
                <p className="truncate text-[12px] leading-tight text-fg-muted">
                  {activeArea.eyebrow}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge tone="success" dot>
                Auto-saved
              </StatusBadge>
              <StatusBadge tone={readiness.ok ? "success" : "warning"} dot>
                {readiness.label}
              </StatusBadge>
              {active === "diagnostics" && (
                <Button size="sm" variant="outline" onClick={() => void handleOpenDiagnosticsWindow()}>
                  Pop out
                </Button>
              )}
            </div>
          </header>

          {/* Scrollable content area (relative so an Inspector slide-over can anchor here) */}
          <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden contain-layout contain-paint">
            <div className="h-full overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable] [will-change:scroll-position]">
              <div className="flex w-full flex-col gap-8 px-8 py-6 pb-12 [contain:content]">
                <div key={active}>
                  {renderArea()}
                </div>
              </div>
            </div>
          </div>

          {/* Footer status bar — no manual save needed, changes are instant. */}
          <footer className="flex min-w-0 shrink-0 items-center justify-between gap-4 border-t border-border px-6 py-4">
            <div className="min-w-0">
              <span
                className={`block truncate text-[12px] ${
                  status
                    ? status.ok
                      ? "text-[var(--green)]"
                      : "text-[var(--red)]"
                    : textRulesAnalysis?.blocking
                      ? "text-[var(--red)]"
                      : "text-fg-muted"
                }`}
              >
                {status?.msg ??
                  (textRulesAnalysis?.blocking
                    ? "Fix blocking text-rule issues in Profiles."
                    : "Changes are saved automatically.")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleCancel}>
                Close
              </Button>
            </div>
          </footer>
        </main>
      </div>
    </TooltipProvider>
  );
}
