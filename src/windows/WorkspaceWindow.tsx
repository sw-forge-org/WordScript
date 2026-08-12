import { useCallback, useEffect, useState, useTransition } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  Icon,
  Nav,
  NavFoot,
  NavGroup,
  NavHead,
  NavRow,
  NavSearch,
  ProfileSwitcher,
  ProviderSprite,
  StatusStrip,
  WindowBody,
  WindowShell,
} from "@/components/shell";
import { useColorScheme, type ColorScheme } from "@/hooks/useColorScheme";
import { useConfigDraft } from "@/hooks/useConfigDraft";
import { useNavRail } from "@/hooks/useNavRail";
import { useProvider } from "@/hooks/useProvider";
import { useRuntime } from "@/hooks/useRuntime";
import {
  resolveActiveTextProfile,
  resolveJobProvider,
  textProfileInitials,
} from "@/lib/textProfiles";
import {
  SETTINGS_ANCHOR_TARGETS,
  settingsAnchorElementId,
  type SettingsAnchor,
} from "@/lib/settingsAnchors";
import type { WorkspaceRuntime } from "@/screens/props";
import { SettingsSheet } from "./workspace/SettingsSheet";
import { HelpMenu } from "./workspace/HelpMenu";
import { CommandPalette } from "./workspace/palette";
import { VIEWS, findSection, findView, type SectionId, type ViewId } from "./workspace/ia";

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
 *
 * P1 AND P2 ARE FIXED AT THIS SEAM, not in a screen, because both are
 * properties of the seam rather than of anything drawn. P1 is `useConfigDraft`,
 * which every window that holds a config draft shares. P2 is below: a
 * navigation used to discard and rebuild the whole area, so every view a user
 * comes back to is kept mounted and hidden rather than rebuilt. Neither is
 * visible in a screen, which is the test that they are in the right place.
 */

const MAC = /Mac|iPhone|iPad/.test(
  typeof navigator === "undefined" ? "" : navigator.platform || navigator.userAgent,
);
const SETTINGS_SHORTCUT = MAC ? "⌘," : "Ctrl+,";
const SEARCH_SHORTCUT = MAC ? "⌘K" : "Ctrl K";

export default function WorkspaceWindow() {
  const { state, saveConfig } = useRuntime();
  /* `true` is the native half (§15.3): the host answers `system` and the window
     chrome follows the choice. The gallery's own call leaves it off. */
  const { resolved, scheme, setScheme } = useColorScheme("dark", true);
  const { form, patch, patchText, flushText } = useConfigDraft(state.config, saveConfig);
  const [view, setView] = useState<ViewId>("home");
  const [section, setSection] = useState<SectionId | null>(null);
  const [palette, setPalette] = useState(false);
  const [, startTransition] = useTransition();
  /* THE SIDEBAR'S WIDTH (ADR 0111). The preference is read off the draft and
     the toggle writes it back through the same `patch` every other discrete
     control uses, so the sidebar has no second store and cannot disagree with
     the config. The window's own narrow-width rail is the hook's, and it is
     deliberately NOT written back — see `useNavRail`. */
  const { railed, toggle: toggleRail } = useNavRail(
    form?.workspace_nav_rail,
    useCallback(
      (next: boolean) => patch({ workspace_nav_rail: next }),
      [patch],
    ),
  );


  /* The stored scheme, adopted when the runtime answers and whenever it changes
     underneath — another window, or a config edited on disk. Keyed on the
     runtime's config rather than on the draft, so the window follows what was
     actually saved; a write from this window arrives back with the value it
     just set, which is a no-op. Before the config loads the hook's own default
     stands, and that default is what every window rendered before this field
     existed. */
  useEffect(() => {
    const stored = state.config?.color_scheme;
    if (stored && stored !== scheme) setScheme(stored);
  }, [state.config?.color_scheme]);

  /* The recogniser's vendor. This block decides whether the workspace reads
     ready to dictate, so it is `dictation`'s job on the provider axis and not a
     machine-wide field (ADR 0094) — a profile that cleans up locally does not
     make the listening lane local. */
  const providerSource = form ?? state.config;
  const selectedProvider =
    providerSource && resolveJobProvider(resolveActiveTextProfile(providerSource), "dictation")
      .provider === "local"
      ? "local"
      : "groq";
  const selectedLocalModel =
    selectedProvider === "local"
      ? form?.local_model ?? state.config?.local_model ?? "base"
      : null;
  const selectedCleanupModel =
    selectedProvider === "local"
      ? form?.local_correction_model ?? state.config?.local_correction_model ?? "llama3.2:latest"
      : form?.correction_model ?? state.config?.correction_model ?? "llama-3.3-70b-versatile";
  const { status: providerStatus } = useProvider(selectedProvider, selectedLocalModel, selectedCleanupModel);
  const providerReady =
    selectedProvider === "local"
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

  /* Cmd/Ctrl+K TOGGLES rather than opens, which is the prototype's behaviour
     and the right one: the chord that summoned the palette is the chord the
     hand is already on when it wants it gone. It is a frontend shortcut for the
     same reason Cmd+, is — it means nothing outside a focused window, and
     registering it globally would take the chord away from every other
     application on the machine. It is deliberately NOT the only way in: the
     search field in the sidebar is, and the chord is printed on it. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey) || event.altKey) {
        return;
      }
      event.preventDefault();
      setPalette((open) => !open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Leaving a screen commits what was typed on it, so a draft cannot outlive
     the surface it was typed on. `flushText` is stable for a given `saveConfig`
     and is deliberately not in the dependency list: this effect exists to fire
     on a NAVIGATION, and re-running it because the writer identity changed
     would commit a draft the user is still typing. */
  useEffect(() => {
    flushText();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, section]);

  /* P2 — A VIEW A USER COMES BACK TO IS NOT REBUILT.
     The pre-port window wrapped its area in `<div key={active}>`, which forced
     React to discard and rebuild the subtree on every sidebar click. Leg 3
     dropped the key, but a rendered element of a different type unmounts the old
     one just the same, so the remount survived the rewrite. Every view the user
     has actually opened stays mounted and the inactive ones are `hidden`: each
     keeps its own scroll box and its own `data-layout`, which is why they are
     siblings rather than one container with a swapped child, and a view nobody
     opened costs nothing. `active` is passed down so a screen that polls the
     runtime idles while it is off screen.

     Tracked by an effect rather than by a navigate() helper because `view` is
     also set from outside this window — the settings anchor — and a helper only
     the sidebar calls would leave a deep-linked view out of the set. */
  const [visitedViews, setVisitedViews] = useState<ViewId[]>([view]);
  useEffect(() => {
    setVisitedViews((seen) => (seen.includes(view) ? seen : [...seen, view]));
  }, [view]);

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
                selectedProvider === "local"
                  ? providerStatus?.local_setup?.guidance ?? "The local lane is configured."
                  : "The Groq key is present and the native runtime is configured.",
            }
          : {
              tone: "warning" as const,
              label: selectedProvider === "local" ? "Needs local setup" : "Needs key",
              title:
                selectedProvider === "local"
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
  /* One writer for the scheme, and it does both halves: the window switches
     immediately and the config keeps the choice. Doing only the first is what
     the palette did for a leg — three rows that changed this window and lost
     the choice on the next launch. `patch` is the discrete-control path, which
     is what a theme row is. */
  const writeScheme = (next: ColorScheme) => {
    setScheme(next);
    patch({ color_scheme: next });
  };
  /* THE RUNTIME, AS A WIRED SCREEN SEES IT. One reader per window: `useRuntime`
     opens two event channels and loads the config, so a screen that called it
     for itself would double every listener and hold a second opinion of one
     config. `active` is per surface and is filled in at the call site below. */
  const runtime: Omit<WorkspaceRuntime, "active"> = {
    config: form,
    state,
    patch,
    patchText,
    flushText,
    /* A door from one surface to another. A view closes the sheet and a section
       opens it, for the reason the settings anchor has to: a row scrolled to
       behind a scrim is a row nobody can read. An id neither list knows opens
       nothing rather than guessing, which is the same rule the anchor follows. */
    open: (target) => {
      if ("section" in target) {
        if (!findSection(target.section)) return;
        startTransition(() => setSection(target.section as SectionId));
        return;
      }
      if (!findView(target.view)) return;
      startTransition(() => {
        setSection(null);
        setView(target.view as ViewId);
      });
    },
  };
  /* ADR 0067. `local` is a real runtime provider and the product does not
     offer it: the owner's instruction on 2026-08-10 was to treat it like every
     other unpublished provider EVERYWHERE it comes up, because it is not
     finished. So the strip keeps stating it — a config that says local is what
     is running and hiding that would be the lie — and marks it. ADR 0121
     renamed the lane and left this rule exactly where it was. */
  const lane =
    selectedProvider === "local"
      ? `Local runtime · ${form.local_model} · preview`
      : `Groq cloud · ${form.model}`;
  const work = activeProfile.work_mode;
  const target = work?.insert_behavior === "clipboard_only" ? "Clipboard only" : "Insert at cursor";
  const mode = work?.processing_mode ?? "auto";

  return (
    <WindowShell
      data-frost-shell={section ? "" : undefined}
      data-frost-stack={palette ? "" : undefined}
    >
      {/* The provider marks are a sprite and the sprite is a per-window
          resource: every `<use href="#pm-…">` resolves against this one host,
          and it sits outside the layer the sheet blurs so the symbols are not
          re-resolved when the sheet opens. */}
      <ProviderSprite />

      {/* THE LAYERS THAT RECEDE, AND THEY NEST RATHER THAN RUN IN PARALLEL
          (ADR 0051). `.ws-frost-shell` is the application and goes soft behind
          the sheet — one element, so the nav, the content and the strip blur
          together instead of each blurring against transparency at its own
          edges and leaving seams. `.ws-frost-stack` is the application PLUS the
          sheet and goes soft behind the palette. Opening the palette from
          inside settings therefore takes BOTH back one step, which is the only
          arrangement in which the depth order stays true — and it is why the
          two flags on the window are independent rather than exclusive. */}
      <div className="ws-frost-stack">
        <div className="ws-frost-shell">
          <WindowBody>
            <Nav label="Workspace" collapsed={railed}>
              <NavHead scheme={resolved} collapsed={railed} onToggle={toggleRail} />

              {/* MOUNTED IN LEG 4D, AFTER THREE LEGS OF DELIBERATE ABSENCE.
                  `NavSearch` was ported 1:1 in Leg 2 and stood in no window,
                  because it opens the command palette and the port carried none —
                  a field that opens nothing is the fake affordance rule 7
                  forbids. macOS puts it at the top of the sidebar, above the
                  first group, and the chord is printed on the control it
                  accelerates rather than left to be discovered. */}
              <NavSearch shortcut={SEARCH_SHORTCUT} onOpen={() => setPalette(true)} />

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
                {/* MOUNTED IN THE COMMIT THAT BUILT WHAT IT OPENS (ADR 0066,
                    as ADR 0069 redrew it). Three legs refused to mount it and
                    every one recorded the same reason — there was nothing
                    behind it. Leg 3 wrote the condition rather than the answer:
                    "mount each when there is something to open." The row and
                    its popover are one component, because the panel opens over
                    the row and has to be anchored to it. */}
                <HelpMenu />
                <ProfileSwitcher
                  config={form}
                  onChange={patch}
                  sessionActive={sessionActive}
                  subtitle={`${mode[0].toUpperCase()}${mode.slice(1).replace("_", " ")} · ${target}`}
                />
              </NavFoot>
            </Nav>

            {/* P2. One scroll box per visited view, only one of them shown. */}
            {VIEWS.filter((entry) => visitedViews.includes(entry.id)).map((entry) => (
              <main
                key={entry.id}
                className="ws-content"
                data-layout={entry.layout}
                hidden={entry.id !== view}
              >
                <div className="ws-content-inner" data-layout={entry.layout}>
                  {entry.render({
                    banner: entry.banner,
                    runtime: { ...runtime, active: entry.id === view && section === null },
                  })}
                </div>
              </main>
            ))}
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
            runtime={runtime}
            onSection={setSection}
            onClose={() => setSection(null)}
            /* The Escape stack: while the palette is up the key is its. */
            closeOnEscape={!palette}
            onSearch={() => setPalette(true)}
            searchShortcut={SEARCH_SHORTCUT}
            sessionActive={sessionActive}
          />
        )}

      </div>

      {/* Outside the stack, because the stack is what it makes recede. */}
      {palette && (
        <CommandPalette
          runtime={runtime}
          onScheme={writeScheme}
          onClose={() => setPalette(false)}
        />
      )}
    </WindowShell>
  );
}
