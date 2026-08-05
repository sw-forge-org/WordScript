import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  BrandMark,
  Icon,
  Nav,
  NavFoot,
  NavGroup,
  NavRow,
  ProfileSwitcher,
  ProviderSprite,
  StatusStrip,
  WindowBody,
  WindowShell,
} from "@/components/shell";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useProvider } from "@/hooks/useProvider";
import { useRuntime } from "@/hooks/useRuntime";
import { resolveActiveTextProfile, textProfileInitials } from "@/lib/textProfiles";
import {
  SETTINGS_ANCHOR_TARGETS,
  settingsAnchorElementId,
  type SettingsAnchor,
} from "@/lib/settingsAnchors";
import type { AppConfig } from "@/types/ipc";
import { SettingsSheet } from "./workspace/SettingsSheet";
import { VIEWS, findView, type SectionId, type ViewId } from "./workspace/ia";

/**
 * THE WORKSPACE — one window, four views, and settings as a sheet over it.
 *
 * This file was `SettingsWindow.tsx`: a settings window with fourteen flat
 * areas in one sidebar. It stops being the settings window and becomes the
 * workspace (plan §4.1, §4.2), and settings becomes a modal sheet laid over it
 * at its own scale (§11.22), reached with Cmd+, and closed with Escape.
 * ADR 0054 is why the fourteen areas are deleted in the same commit rather than
 * aliased: `0.2.2-alpha` is installed by nobody, so there is no habit to
 * protect and no half-state to keep safe.
 *
 * WHAT IS WIRED HERE AND WHAT IS NOT, because the difference is the whole of
 * rule 7. The SHELL reads the runtime: the status strip states the session
 * status, the lane and the delivery target from `useRuntime`; the profile row
 * switches the active profile through `switch_active_text_profile` and refuses
 * during a session because the runtime does; the settings anchor still
 * resolves, which is the one runtime contract ADR 0054 exempts. The VIEWS do
 * not: every one of them is the ported drawing carrying sample data, and every
 * one of them says so on itself until Leg 4 wires it. `windows/workspace/ia.tsx`
 * is where each of those statements lives, and deleting one is what wiring a
 * section looks like.
 *
 * WHY THE SHELL IS WIRED AND THE VIEWS ARE NOT. The strip is not a section that
 * Leg 4 could come back to: it is on screen under every view, it is never
 * scrolled away, and a permanently green "Ready" that nobody measured would be
 * the fake-readiness defect at the one place on the surface that is always
 * visible. Everything it states is a fact this window already had in hand.
 */

const MAC = /Mac|iPhone|iPad/.test(
  typeof navigator === "undefined" ? "" : navigator.platform || navigator.userAgent,
);
const SETTINGS_SHORTCUT = MAC ? "⌘," : "Ctrl+,";

export default function WorkspaceWindow() {
  const { state, saveConfig } = useRuntime();
  const { resolved } = useColorScheme("dark");
  const [form, setForm] = useState<AppConfig | null>(null);
  const [view, setView] = useState<ViewId>("home");
  const [section, setSection] = useState<SectionId | null>(null);
  const [, startTransition] = useTransition();

  // Guards the form against a stale `ready` event clobbering an in-flight user
  // edit. `save_config` emits a `ready` carrying the SAVED config; under the
  // Rust config lock overlapping saves resolve in call order (A then B), so
  // ready(A) can land AFTER the user already edited further to B. The
  // unconditional sync would then revert the form A→B→A→B. (plan P1, root C1)
  const inFlightSaveCountRef = useRef(0);
  const [formResyncNonce, setFormResyncNonce] = useState(0);
  const latestConfigRef = useRef<AppConfig | null>(null);
  useEffect(() => {
    latestConfigRef.current = state.config;
  }, [state.config]);

  const selectedProvider = (form?.provider ?? state.config?.provider) === "local_preview"
    ? "local_preview"
    : "groq";
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

  /* Deep links from outside this window — today the overlay's auto-stop tab,
     which states a number and then offers the control that sets it.

     The event carries a semantic anchor, not a section id, because controls
     move between sections and the mapping lives in one place. Every anchored
     A target names a SURFACE as well as an id, because settings is a sheet
     now: an anchor in a section has to open the sheet before it can scroll,
     and an anchor in a view has to close it, or the row is scrolled behind a
     scrim. The one anchor that exists is the second kind — §11.7 moved
     auto-stop into the profile. An unknown anchor opens nothing rather than
     guessing. */
  useEffect(() => {
    const unlisten = listen<{ target?: string }>("wordscript-settings-target", ({ payload }) => {
      const anchor = payload.target as SettingsAnchor | undefined;
      if (!anchor) return;
      const target = SETTINGS_ANCHOR_TARGETS[anchor];
      if (!target) return;

      startTransition(() => {
        if (target.surface === "section") {
          setSection(target.id as SectionId);
        } else {
          setSection(null);
          setView(target.id as ViewId);
        }
      });
      // After the sheet has rendered. The row does not exist until the
      // transition commits, so scrolling in the same tick finds nothing.
      requestAnimationFrame(() => {
        const element = document.getElementById(settingsAnchorElementId(anchor));
        if (!element) return;
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        // A brief highlight, because a scroll alone does not say WHICH row was
        // meant when several look alike.
        element.setAttribute("data-anchor-flash", "true");
        setTimeout(() => element.removeAttribute("data-anchor-flash"), 1600);
      });
    });
    return () => { void unlisten.then((fn) => fn()); };
  }, []);

  /* Cmd+, opens the sheet, and it is a FRONTEND shortcut rather than a Rust
     one. Every shortcut ADR 0006 owns is global: it fires in whatever app has
     focus, which is the whole reason it needs the native trigger. This one is
     scoped to a focused window and means nothing outside it, so registering it
     globally would take the chord away from every other application on the
     machine to serve a window that is not in front. Escape is the sheet's own
     and is caught there. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "," || !(event.metaKey || event.ctrlKey) || event.altKey) return;
      event.preventDefault();
      setSection((open) => open ?? "general");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Populate the form when the runtime provides config.
  useEffect(() => {
    if (state.config && !form) setForm({ ...state.config });
  }, [state.config, form]);

  // Keep the form in sync if config reloads externally — but NEVER clobber an
  // in-flight user edit. (plan P1, root C1)
  useEffect(() => {
    if (inFlightSaveCountRef.current > 0) return;
    if (state.config) setForm({ ...state.config });
  }, [state.config, formResyncNonce]);

  /* Instant save: every patch is persisted immediately. There is no "unsaved
     changes" state, which is the fact the sheet's foot states once. */
  const patch = useCallback((partial: Partial<AppConfig>) => {
    setForm((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };

      inFlightSaveCountRef.current += 1;
      const settle = () => {
        inFlightSaveCountRef.current = Math.max(0, inFlightSaveCountRef.current - 1);
        if (inFlightSaveCountRef.current === 0) {
          if (latestConfigRef.current) setForm({ ...latestConfigRef.current });
          setFormResyncNonce((n) => n + 1);
        }
      };

      void saveConfig(next).then(settle).catch(() => {
        // The runtime refused it, so the form goes back to what the runtime
        // still holds rather than showing a value it rejected.
        setForm(prev);
        settle();
      });

      return next;
    });
  }, [saveConfig]);

  const sessionActive = state.status === "recording" || state.status === "processing";

  /* THE STRIP'S THREE FACTS, and every one is read rather than asserted. */
  const readiness = state.error
    ? { tone: "danger" as const, label: "Error", title: state.error }
    : state.status === "processing"
      ? { tone: "accent" as const, label: "Processing", title: "WordScript is transcribing the last capture." }
      : state.status === "recording"
        ? state.paused
          ? { tone: "warning" as const, label: "Paused", title: "Recording is paused." }
          : { tone: "accent" as const, label: "Recording", title: "Recording is active." }
        : providerReady
          ? {
              tone: "success" as const,
              label: "Ready",
              title:
                selectedProvider === "local_preview"
                  ? providerStatus?.local_setup?.guidance ?? "The local lane is configured."
                  : "The Groq key is present and the native runtime is configured.",
            }
          : {
              tone: "warning" as const,
              label: selectedProvider === "local_preview" ? "Needs local setup" : "Needs key",
              title:
                selectedProvider === "local_preview"
                  ? providerStatus?.local_setup?.guidance ??
                    "Configure whisper-cli, a local STT model and a local cleanup model."
                  : "Add a Groq key before transcription can run.",
            };

  if (!form) {
    return (
      <WindowShell>
        <div className="ws-content">
          <div className="ws-content-inner">Connecting to runtime…</div>
        </div>
      </WindowShell>
    );
  }

  const activeProfile = resolveActiveTextProfile(form);
  const current = findView(view) ?? VIEWS[0];
  const lane =
    selectedProvider === "local_preview"
      ? `Local runtime · ${form.local_model}`
      : `Groq cloud · ${form.model}`;
  const work = activeProfile.work_mode;
  const target = work?.insert_behavior === "clipboard_only" ? "Clipboard only" : "Insert at cursor";
  const mode = work?.processing_mode ?? "auto";

  return (
    <WindowShell data-frost-shell={section ? "" : undefined}>
      {/* The provider marks are a sprite and the sprite is a per-window
          resource: every `<use href="#pm-…">` resolves against this one host,
          and it sits outside the layer the sheet blurs so the symbols are not
          re-resolved when the sheet opens. */}
      <ProviderSprite />

      {/* THE LAYER THAT RECEDES. `.ws-frost-shell` is the application, and it
          is what goes soft behind the sheet — one element, so the nav, the
          content and the strip blur together instead of each blurring against
          transparency at its own edges and leaving seams. `.ws-frost-stack`,
          the application PLUS the sheet, is what would recede behind the
          command palette; there is no palette yet, so that layer is not drawn
          (ADR 0051 carries the nesting). */}
      <div className="ws-frost-shell">
        <WindowBody>
          <Nav label="Workspace">
            <BrandMark scheme={resolved} />

            {/* No search field here, and it is the same decision the gallery
                took: `.ws-nav-search` is ported and `NavSearch` is in the
                library, but it opens the command palette and there is no
                palette. A field that opens nothing is the fake affordance
                rule 7 forbids. Mount it when the palette exists. */}

            <NavGroup title="Workspace">
              {VIEWS.map((entry) => (
                <NavRow
                  key={entry.id}
                  icon={<Icon name={entry.icon} />}
                  label={entry.label}
                  tag={entry.preview ? "preview" : undefined}
                  current={entry.id === view}
                  onClick={() => startTransition(() => setView(entry.id))}
                />
              ))}
            </NavGroup>

            <NavFoot>
              <NavRow
                icon={<Icon name="settings" />}
                label="Settings"
                tag={SETTINGS_SHORTCUT}
                onClick={() => setSection("general")}
              />
              {/* `Help` is drawn in the prototype's sidebar and is not mounted,
                  for the reason the search field is not: there is nothing
                  behind it. It goes back the moment there is. */}
              <ProfileSwitcher
                config={form}
                onChange={patch}
                sessionActive={sessionActive}
                subtitle={`${mode[0].toUpperCase()}${mode.slice(1).replace("_", " ")} · ${target}`}
              />
            </NavFoot>
          </Nav>

          <main className="ws-content" data-layout={current.layout}>
            <div className="ws-content-inner" data-layout={current.layout}>
              {current.render({ banner: current.banner })}
            </div>
          </main>
        </WindowBody>

        <StatusStrip
          tone={readiness.tone}
          label={readiness.label}
          title={readiness.title}
          facts={[lane, target]}
        />
      </div>

      {section && (
        <SettingsSheet
          section={section}
          onSection={setSection}
          onClose={() => setSection(null)}
          profile={{ initials: textProfileInitials(activeProfile), name: activeProfile.label }}
          onOpenProfiles={() => {
            setSection(null);
            startTransition(() => setView("profiles"));
          }}
        />
      )}
    </WindowShell>
  );
}
