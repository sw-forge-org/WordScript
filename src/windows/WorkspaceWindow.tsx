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
import { runtimeDefault } from "@/lib/modelCatalogue";
import {
  DEFAULT_PROVIDER_ID,
  drawnNameFor,
  laneForProviderId,
  SELF_HOSTED_PROVIDER_ID,
} from "@/lib/providerSeam";
import { LANE_LABEL } from "@/screens/data";
import { useColorScheme, type ColorScheme } from "@/hooks/useColorScheme";
import { useConfigDraft } from "@/hooks/useConfigDraft";
import { useNavRail } from "@/hooks/useNavRail";
import { useProvider } from "@/hooks/useProvider";
import { useRuntime } from "@/hooks/useRuntime";
import {
  profileSwitchLocked,
  resolveActiveTextProfile,
  activeConnection as activeConnectionOf,
  resolveJobProvider,
  textProfileInitials,
} from "@/lib/textProfiles";
import {
  SETTINGS_ANCHOR_TARGETS,
  settingsAnchorElementId,
  type SettingsAnchor,
} from "@/lib/settingsAnchors";
import type { WorkspaceRuntime } from "@/screens/props";
import type { ProviderCommandError, ProviderStatus } from "@/types/providers";
import { SettingsSheet } from "./workspace/SettingsSheet";
import { HelpMenu } from "./workspace/HelpMenu";
import { CommandPalette } from "./workspace/palette";
import {
  findSection,
  findView,
  navTag,
  surfaceBanner,
  visibleViews,
  type SectionId,
  type ViewId,
} from "./workspace/ia";
import { DeveloperModeProvider } from "@/lib/developerMode";
import { developerMode, previewVisible } from "@/lib/previewSurfaces";

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
     make the listening lane local.

     **ONE DERIVATION, AND IT IS THE STORED ID** (D1c). This was two: a
     `selectedProvider` here that collapsed every cloud vendor onto `groq`
     because `ProviderId` had two arms, and a `connectionProvider` further down
     that read the id properly for the strip's own sentence. So the strip named
     the connection and the chip beside it asked the runtime about a different
     one — two copies of *which vendor is this*, the defect ADR 0123 is about,
     with the copies visibly disagreeing on one line of the window. The union is
     gone; there is nothing left to collapse onto and nothing to keep in step. */
  const providerSource = form ?? state.config;
  /* THE ACCOUNT THE STRIP IS ABOUT, and the vendor read off it (ADR 0208). The
     profile names an account and the account names the vendor, so a machine
     dictating through its own server states that server's id rather than a
     machine-wide field no profile agreed to. */
  const connectionAccount = providerSource ? activeConnectionOf(providerSource) : undefined;
  const connectionProvider = connectionAccount?.provider ?? DEFAULT_PROVIDER_ID;
  /* The drawn name, for the sentences below. A registered id always has one —
     `providerSeam.test.ts` holds that direction — so the fallback is reachable
     only for an id the runtime has already refused, which the error branch
     answers before any sentence here is read. */
  const connectionName = drawnNameFor(connectionProvider) ?? "Groq";
  /* THE MODEL THE STATUS IS ASKED ABOUT FOLLOWS THE CONNECTION TOO, and for the
     same reason the strip's fact does: `form.model` is the CLOUD model field,
     and asking about it over a lane that is sent `self_hosted_model` is the
     wrong id one field over from the wrong vendor. It answers
     `model_capabilities`, which nothing on this window reads yet — so this is
     the half of the defect that was latent rather than visible, fixed in the
     same derivation rather than left for the surface that first reads it. */
  const selectedModel =
    connectionProvider === "local"
      ? form?.local_model ?? state.config?.local_model ?? "base"
      : connectionProvider === SELF_HOSTED_PROVIDER_ID
        ? connectionAccount?.model || null
        : form?.model ?? state.config?.model ?? null;
  /* The last fallback is the runtime's own default, read from the catalogue
     rather than spelled here (ADR 0115): a config that has never been written
     names no model, and a second copy of what `core::config` falls back to is a
     second thing to drift. `base` above stays a literal on purpose — it is a
     whisper.cpp file stem that `core::providers::local` resolves to
     `ggml-{stem}.bin`, not a vendor's model id. */
  const selectedCleanupModel =
    connectionProvider === "local"
      ? form?.local_correction_model ?? state.config?.local_correction_model ?? runtimeDefault("local_correction")
      : form?.correction_model ?? state.config?.correction_model ?? runtimeDefault("correction");
  /* **AND IT ASKS NOBODY UNTIL IT KNOWS WHO TO ASK** — found by rendering this
     window, not by the suite. `connectionProvider` falls back to the default so
     the sentences below have a name, and passing that name to the hook meant a
     `groq` keyring read on every launch whose answer was discarded the moment
     the config arrived. `null` is the seam's `pending` in one argument.

     **AND IT ASKS ABOUT THE ACCOUNT, WHICH IT DID NOT** (ADR 0208, ADR 0209).
     The fourth argument is the credential's scope and this call omitted it, so
     `useProvider` sent its `""` default and the runtime read the entry named
     `.speech.api_key` — a scope no writer can produce and every machine is
     therefore missing. ADR 0208's migration MOVES a key onto the account, so
     from the commit that landed it this strip has read `Needs key` on every
     machine, always, with the key present and the connection card showing it.
     Same defect ADR 0209 closed on the Models card, one surface over: a
     credential asked for by vendor when the vendor stopped being the scope.
     The account is derived four lines up and was simply not passed on. */
  const { status: providerStatus, lastError: providerError } = useProvider(
    providerSource ? connectionProvider : null,
    selectedModel,
    selectedCleanupModel,
    connectionAccount?.id ?? "",
  );

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

  /* WHAT THIS READER GETS. Developer Mode off drops the surfaces that are drawn
     all the way down — the nav row and the route together, because a row that
     opens a sketch is the fake affordance rule 7 forbids. Read once here and
     provided to the tree, so no screen asks the config and no marker carries an
     inline condition.

     ABOVE THE `!form` RETURN, because it owns a hook. `developerMode` reads a
     null config as off, which is also the honest answer while the runtime has
     not answered yet. */
  const developer = developerMode(form);
  const views = visibleViews(developer);

  /* TURNING DEVELOPER MODE OFF WHILE STANDING ON A DRAWN VIEW HAS TO LAND
     SOMEWHERE. Context is the only view the filter can take, and leaving it
     selected would show a sidebar with no content beside it. Home is where the
     workspace opens, so it is where it returns to. */
  const viewPresent = views.some((entry) => entry.id === view);
  useEffect(() => {
    if (!viewPresent) setView("home");
  }, [viewPresent]);

  /* ONE PREDICATE, THREE SURFACES (ADR 0197). Profiles refuses the same switch
     for the same reason now, so "recording or processing" is derived in
     `lib/textProfiles` rather than spelled here and again there. */
  const sessionActive = profileSwitchLocked(state);

  /* THE STRIP'S THREE FACTS, and every one is read rather than asserted. */
  const readiness = state.error
    ? { tone: "danger" as const, label: "Error", title: state.error }
    : state.status === "processing"
      ? { tone: "accent" as const, label: "Processing", title: "WordScript is transcribing the last capture." }
      : state.status === "recording"
        ? state.paused
          ? { tone: "warning" as const, label: "Paused", title: "Recording is paused." }
          : { tone: "accent" as const, label: "Recording", title: "Recording is active." }
        : connectionReadiness(connectionProvider, connectionName, providerStatus, providerError);

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
  /* WHAT THIS READER GETS. Developer Mode off drops the surfaces that are drawn
     all the way down — the nav row and the route together, because a row that
     opens a sketch is the fake affordance rule 7 forbids. It is read once here
     and provided to the tree, so no screen asks the config and no marker
     carries an inline condition. */
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
    /* AND WHETHER THAT DOOR ARRIVES. `open` refuses an id neither list knows;
       this refuses one this reader does not have, which since Developer Mode is
       a different question with the same consequence — a link that lands on
       General rather than on Agents looks like it worked. Screens that draw a
       door onto a preview surface ask this first. */
    canOpen: (target) => {
      const surface = "section" in target ? findSection(target.section) : findView(target.view);
      if (!surface) return false;
      return !surface.preview || previewVisible(surface.preview, developer);
    },
  };
  /* ADR 0067. `local` is a real runtime provider and the product does not
     offer it: the owner's instruction on 2026-08-10 was to treat it like every
     other unpublished provider EVERYWHERE it comes up, because it is not
     finished. So the strip keeps stating it — a config that says local is what
     is running and hiding that would be the lie — and marks it. ADR 0121
     renamed the lane and left this rule exactly where it was. */
  /* AND THE CLOUD BRANCH NAMED ONE VENDOR FOR ALL OF THEM (D1b, ADR 0165).
     `Groq cloud · {model}` was the only other answer this strip had, so a
     machine connected to OpenAI has read *Groq cloud* since D1 made that
     connection selectable — and a machine connected to its own server would
     have read it too, over `form.model`, which is the CLOUD model field and not
     the id that server is sent.

     **`connectionProvider` is derived once, at the top of this component**
     (D1c). It was derived twice: here for this fact, and as `selectedProvider`
     above for the chip, which folded every cloud vendor onto `groq`. Two
     derivations of one fact, side by side on one line, disagreeing — the strip
     naming OpenAI while the chip beside it reported the Groq key. */
  /* THE LANE IS ITS OWN FACT NOW, AND THAT IS THE POINT (ADR 0196). This line
     read `Groq cloud · llama-3.3-70b`, which welds two independent answers into
     one token: WHERE the work runs and WHO does it. They move independently —
     the same vendor exists on more than one lane, and the same lane holds
     several vendors — so a reader scanning for "am I on the machine or on the
     network" had to parse a vendor name to find out, and on the two lanes where
     the vendor IS the lane the word `cloud` simply was not there to look for.

     THE NAME COMES FROM `LANE_LABEL` AND IS NOT SPELLED HERE. That map is the
     one list of what a lane is called on a surface (ADR 0160), and a fourth
     spelling of `Your server` along the one edge of the window that is never
     scrolled away is exactly the drift ADR 0123 forbids. */
  const lane = LANE_LABEL[laneForProviderId(connectionProvider)];
  /* WHAT IS ANSWERING, ON THAT LANE. On Cloud that is a vendor and a model,
     because Cloud holds several vendors; on the other two the lane already
     named the vendor — `Your server` IS the provider — so restating it would
     print the same word twice with a dot between. `preview` stays on the local
     row: the product does not offer that lane and says so wherever it comes up
     (ADR 0067). */
  const engine =
    connectionProvider === "local"
      ? `${form.local_model} · preview`
      : connectionProvider === SELF_HOSTED_PROVIDER_ID
        ? connectionAccount?.model || "no model id"
        : `${connectionName} · ${form.model}`;
  const work = activeProfile.work_mode;
  const target = work?.insert_behavior === "clipboard_only" ? "Clipboard only" : "Insert at cursor";
  const mode = work?.processing_mode ?? "auto";

  return (
    <DeveloperModeProvider value={developer}>
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
                {views.map((entry) => (
                  <NavRow
                    key={entry.id}
                    icon={<Icon name={entry.icon} />}
                    label={entry.label}
                    tag={navTag(entry, developer)}
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
            {views.filter((entry) => visitedViews.includes(entry.id)).map((entry) => (
              <main
                key={entry.id}
                className="ws-content"
                data-layout={entry.layout}
                hidden={entry.id !== view}
              >
                <div className="ws-content-inner" data-layout={entry.layout}>
                  {entry.render({
                    banner: surfaceBanner(entry.preview),
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
            facts={[lane, engine, target]}
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
    </DeveloperModeProvider>
  );
}

/**
 * WHETHER THIS MACHINE CAN DICTATE, AND WHAT TO DO IF IT CANNOT (D1c).
 *
 * **Five answers where there were two**, and the two were `local` and *everyone
 * else is Groq missing a key*. On the one line of the window that is never
 * scrolled away, an OpenAI connection read `Needs key` about a Groq key it does
 * not use, a `Your server` connection with no URL typed read the same, and a
 * runtime that had not answered yet read it too — a warning asserted out of
 * this window's own latency.
 *
 * The order is the argument:
 *
 * 1. **A refusal is the runtime's sentence, not a guess at what it meant.** An
 *    id no adapter claims comes back from `registry::resolve_entry` saying so,
 *    and that sentence names the connection the reader has to change. Reading
 *    it as *missing key* would send them to a credential row for a vendor that
 *    has no row.
 * 2. **Nothing read yet claims nothing** — `providerSeam`'s `pending` rule at
 *    the one place that had never heard of it. The runtime may refine this
 *    answer; it may not be pre-empted by a warning.
 * 3. **`local` is a disk, not a credential**, which it always was.
 * 4. **The SPEECH role answers, not the folded `credential` block** (ADR 0105).
 *    The question this strip asks is *can I dictate*, and the fold is
 *    conservative across every role the vendor serves — on a vendor whose chat
 *    key is missing and whose speech key is not, the fold says no to a machine
 *    that can dictate perfectly well.
 * 5. **What is missing is the runtime's word for it where the runtime has one.**
 *    `Your server` is the lane that proves this is not pedantry: nothing is
 *    missing there that a key would fix — it is a URL, or a model id, and
 *    `LaneConfiguration::missing` already says which in a sentence written for
 *    a reader. A second copy of that reasoning here would be a fourth surface
 *    deriving this lane's state for itself, which is exactly what D1b's
 *    `self_hosted_endpoint` block exists to prevent.
 */
function connectionReadiness(
  provider: string,
  connectionName: string,
  status: ProviderStatus | null,
  error: ProviderCommandError | null,
) {
  if (error) {
    return { tone: "warning" as const, label: "Needs attention", title: error.message };
  }

  if (!status) {
    return {
      tone: "neutral" as const,
      label: "Checking",
      title: "Reading this connection's state from the runtime.",
    };
  }

  if (provider === "local") {
    return status.local_setup?.readiness === "ready"
      ? {
          tone: "success" as const,
          label: "Ready",
          title: status.local_setup?.guidance ?? "The local lane is configured.",
        }
      : {
          tone: "warning" as const,
          label: "Needs local setup",
          title:
            status.local_setup?.guidance ??
            "Configure whisper-cli, a local STT model and a local cleanup model.",
        };
  }

  const speech = status.role_credentials?.find((row) => row.role === "speech");

  /* The runtime answered and did not say what it holds for the role that
     dictates. `providerSeam`'s `not_answered`, in the same words and for the
     same reason: reading an absent field as `false` is a surface silently
     claiming a state nobody measured. */
  if (!speech) {
    return {
      tone: "neutral" as const,
      label: "Not read",
      title: `The runtime answered for ${connectionName} without saying what it holds for speech recognition.`,
    };
  }

  if (provider === SELF_HOSTED_PROVIDER_ID) {
    const endpoint = status.self_hosted_endpoint;
    return speech.configured
      ? {
          tone: "success" as const,
          label: "Ready",
          /* What it will do, not that it works: nothing here has asked the
             server anything, and `Reachability` on the connection card is the
             control that does — deliberately on demand (D1b). */
          title: `Dictations go to ${endpoint?.base_url ?? "your server"} as ${endpoint?.model ?? "the model id on the connection"}.`,
        }
      : {
          tone: "warning" as const,
          label: "Needs your server",
          title: speech.missing ?? "Configure the server on this connection.",
        };
  }

  return speech.configured
    ? {
        tone: "success" as const,
        label: "Ready",
        title: `The ${connectionName} key is present and the native runtime is configured.`,
      }
    : {
        tone: "warning" as const,
        label: "Needs key",
        title: `Add the ${connectionName} key before transcription can run.`,
      };
}
