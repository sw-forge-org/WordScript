import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Palette,
  PaletteEmpty,
  PaletteField,
  PaletteFoot,
  PaletteGroup,
  PaletteList,
  PaletteRow,
} from "@/components/shell";
import type { IconName } from "@/components/shell";
import type { ColorScheme } from "@/hooks/useColorScheme";
import type { NativeInsertionStatus } from "@/types/nativeInsertion";
import type { WorkspaceRuntime } from "@/screens/props";
import { findSection, findView } from "./ia";
import { useDeveloperMode } from "@/lib/developerMode";
import { previewVisible } from "@/lib/previewSurfaces";

/**
 * WHAT THE PALETTE INDEXES, AND WHAT EACH ROW DOES — the workspace's half of
 * `demo.js:8031–8366`. The drawing is `components/shell/Palette.tsx`.
 *
 * THE INDEX IS THREE KINDS OF THING AND THEY ARE NOT WEIGHTED EQUALLY. A PLACE
 * is a view or a settings section — always findable, and the answer to "where
 * is X". A SETTING is an individual control, and it is the entry that makes the
 * palette worth having, because a control is what people actually go looking
 * for and it is the thing the information architecture buries by design. An
 * ACTION does something without navigating anywhere.
 *
 * IT IS THIRTY-ONE ENTRIES, NOT THE TWENTY-SIX THE RELAY SAYS. Counted off
 * `CMDK_INDEX`: twelve Go to, thirteen Settings, six Do. The relay's figure was
 * an estimate and is corrected in Leg 4d's record; the list below is the
 * prototype's, in the prototype's order, which is what the scoring's tie-break
 * depends on.
 *
 * TWENTY-FIVE OF THE THIRTY-ONE ARE NAVIGATIONS and `runtime.open` answers
 * every one — the seam grew that door in Leg 4b. Two `Go to` entries the
 * prototype indexes are places this window mounts (`Notes & Meetings` and
 * `Integrations` are NOT in the prototype's index and are therefore not here
 * either; porting an index means porting what it holds).
 *
 * WHAT CANNOT ACT IS DRAWN AND INERT, WITH THE REASON IN THE PATH COLUMN
 * (ADR 0065). That column normally names the room a setting lives in; on a row
 * that cannot act it names why, because a disabled control takes
 * `pointer-events: none` and a `title` on it is a reason nobody can reach —
 * Leg 4c's finding, one step further on.
 */

type PaletteAction =
  | { kind: "go"; target: { view: string } | { section: string } }
  | { kind: "theme"; scheme: ColorScheme }
  | { kind: "restore" }
  | { kind: "copy" }
  | { kind: "reveal" };

interface PaletteEntry {
  group: "Go to" | "Settings" | "Do";
  icon: IconName;
  label: string;
  /** The room it lives in. Absent on a place, which IS a room. */
  where?: string;
  action: PaletteAction;
}

export const PALETTE_INDEX: PaletteEntry[] = [
  { group: "Go to", icon: "home", label: "Home", action: { kind: "go", target: { view: "home" } } },
  { group: "Go to", icon: "history", label: "History", action: { kind: "go", target: { view: "history" } } },
  { group: "Go to", icon: "profiles", label: "Profiles", action: { kind: "go", target: { view: "profiles" } } },
  { group: "Go to", icon: "file", label: "Context", action: { kind: "go", target: { view: "context" } } },
  { group: "Go to", icon: "general", label: "General", where: "Settings", action: { kind: "go", target: { section: "general" } } },
  { group: "Go to", icon: "keyboard", label: "Hotkeys", where: "Settings", action: { kind: "go", target: { section: "hotkeys" } } },
  { group: "Go to", icon: "models", label: "AI Models", where: "Settings", action: { kind: "go", target: { section: "models" } } },
  { group: "Go to", icon: "agents", label: "Agents", where: "Settings", action: { kind: "go", target: { section: "agents" } } },
  { group: "Go to", icon: "check", label: "Delivery & Insert", where: "Settings", action: { kind: "go", target: { section: "delivery" } } },
  { group: "Go to", icon: "lock", label: "Privacy & Data", where: "Settings", action: { kind: "go", target: { section: "privacy" } } },
  { group: "Go to", icon: "diagnostics", label: "Diagnostics", where: "Settings", action: { kind: "go", target: { section: "diagnostics" } } },
  { group: "Go to", icon: "about", label: "About & Updates", where: "Settings", action: { kind: "go", target: { section: "about" } } },

  { group: "Settings", icon: "mic", label: "Input device", where: "General", action: { kind: "go", target: { section: "general" } } },
  { group: "Settings", icon: "mic", label: "Input level", where: "General", action: { kind: "go", target: { section: "general" } } },
  { group: "Settings", icon: "volume", label: "Play sound cues", where: "General", action: { kind: "go", target: { section: "general" } } },
  { group: "Settings", icon: "volume", label: "Sound pack", where: "General", action: { kind: "go", target: { section: "general" } } },
  { group: "Settings", icon: "keyboard", label: "Dictation shortcut", where: "Hotkeys", action: { kind: "go", target: { section: "hotkeys" } } },
  { group: "Settings", icon: "keyboard", label: "Push to talk or toggle", where: "Hotkeys", action: { kind: "go", target: { section: "hotkeys" } } },
  { group: "Settings", icon: "models", label: "Speech model", where: "AI Models", action: { kind: "go", target: { section: "models" } } },
  { group: "Settings", icon: "models", label: "Cleanup model", where: "AI Models", action: { kind: "go", target: { section: "models" } } },
  { group: "Settings", icon: "lock", label: "Groq API key", where: "AI Models", action: { kind: "go", target: { section: "models" } } },
  { group: "Settings", icon: "check", label: "Insert at cursor", where: "Delivery & Insert", action: { kind: "go", target: { section: "delivery" } } },
  { group: "Settings", icon: "copy", label: "Clipboard fallback", where: "Delivery & Insert", action: { kind: "go", target: { section: "delivery" } } },
  { group: "Settings", icon: "trash", label: "Keep audio after transcription", where: "Privacy & Data", action: { kind: "go", target: { section: "privacy" } } },
  { group: "Settings", icon: "restore", label: "Check for updates", where: "About & Updates", action: { kind: "go", target: { section: "about" } } },

  { group: "Do", icon: "restore", label: "Restore last clipboard insert", action: { kind: "restore" } },
  { group: "Do", icon: "copy", label: "Copy last transcript", action: { kind: "copy" } },
  { group: "Do", icon: "folderOpen", label: "Show transcripts in file manager", action: { kind: "reveal" } },
  { group: "Do", icon: "sun", label: "Switch to light theme", action: { kind: "theme", scheme: "light" } },
  { group: "Do", icon: "moon", label: "Switch to dark theme", action: { kind: "theme", scheme: "dark" } },
  { group: "Do", icon: "diagnostics", label: "Follow the system theme", action: { kind: "theme", scheme: "system" } },
];

/**
 * PREFIX FIRST, THEN WORD START, THEN SUBSTRING. A plain substring match over
 * an index this size puts "Sound pack" above "Sound cues" for the query "sound
 * cue" unless position is scored, and a palette whose first row is wrong is one
 * people stop trusting after two tries.
 *
 * The word-start rank exists because a user typing the SECOND word of a
 * two-word label is the common case rather than the edge: "cue" has to reach
 * "Play sound cues".
 */
export function scorePaletteLabel(label: string, query: string): number {
  const value = label.toLowerCase();
  if (value.indexOf(query) === 0) return 0;
  if (value.indexOf(` ${query}`) > -1) return 1;
  if (value.indexOf(query) > -1) return 2;
  return -1;
}

/**
 * THE PALETTE IS A DOOR LIKE ANY OTHER, AND IT MAY NOT OPEN WHAT THE NAV WOULD
 * NOT.
 *
 * `Context` and `Agents` are indexed as places, and with Developer Mode off
 * those places are not mounted — the row would either open nothing or reinstate
 * exactly the surface the switch removed, which is worse than the nav row it
 * was meant to replace. So the index is filtered by the same predicate the
 * sidebar uses, on the way in.
 */
function reachable(entry: PaletteEntry, developer: boolean): boolean {
  if (entry.action.kind !== "go") return true;
  const target = entry.action.target;
  const surface = "view" in target ? findView(target.view) : findSection(target.section);
  return !surface?.preview || previewVisible(surface.preview, developer);
}

/** Ties break on the index's own order, which is why the array above is the
 *  prototype's order rather than sorted by anything. */
export function paletteMatches(query: string, developer = false): PaletteEntry[] {
  const needle = query.trim().toLowerCase();
  return PALETTE_INDEX.filter((entry) => reachable(entry, developer)).map((entry, index) => ({
    entry,
    score: needle ? scorePaletteLabel(entry.label, needle) : 0,
    index,
  }))
    .filter((row) => row.score > -1)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, 40)
    .map((row) => row.entry);
}

const NOTHING_TRANSCRIBED_YET = "nothing transcribed yet";

export function CommandPalette({
  runtime,
  onScheme,
  onClose,
}: {
  runtime: Omit<WorkspaceRuntime, "active">;
  onScheme: (next: ColorScheme) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const field = useRef<HTMLInputElement>(null);
  const listbox = useRef<HTMLDivElement>(null);

  /* THE TWO `Do` ROWS THAT DEPEND ON THERE BEING SOMETHING TO ACT ON ASK THE
     RUNTIME RATHER THAN GUESSING. `state.lastResult` is this window's memory of
     this session and the native scratchpad is the runtime's, and they disagree
     the moment the window is reopened over a running process — so the authority
     is `native_insertion_status.last_transcript`. Read once per opening,
     because that is exactly how long the answer has to stay true. */
  const [scratchpad, setScratchpad] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void invoke<NativeInsertionStatus>("native_insertion_status")
      .then((status) => {
        if (!cancelled) setScratchpad(status?.last_transcript?.text ?? null);
      })
      .catch(() => {
        if (!cancelled) setScratchpad(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const lastTranscript = runtime.state.lastResult?.final_text ?? scratchpad;

  /** Why a row cannot act, or nothing. It reads as the row's path column. */
  const blocked = useCallback(
    (action: PaletteAction): string | undefined => {
      switch (action.kind) {
        case "restore":
        case "copy":
          return lastTranscript ? undefined : NOTHING_TRANSCRIBED_YET;
        default:
          return undefined;
      }
    },
    [lastTranscript],
  );

  /* The same predicate the sidebar spends, so the palette can never be the way
     back into a surface Developer Mode removed. */
  const developer = useDeveloperMode();
  const rows = useMemo(() => {
    return paletteMatches(query, developer).map((entry) => ({ entry, reason: blocked(entry.action) }));
  }, [query, blocked, developer]);

  /* Arrow keys land only where Return has something to run. A selection resting
     on an inert row makes Return do nothing at all, which is a worse answer
     than not stopping there — and the row is still on screen with its reason,
     which is the whole point of drawing it. */
  const runnable = useMemo(
    () => rows.map((row, index) => ({ row, index })).filter(({ row }) => !row.reason),
    [rows],
  );

  useEffect(() => {
    setSelected(runnable.length ? runnable[0].index : -1);
  }, [runnable]);

  useEffect(() => {
    field.current?.focus();
  }, []);

  const run = useCallback(
    (action: PaletteAction) => {
      onClose();
      switch (action.kind) {
        case "go":
          runtime.open?.(action.target);
          return;
        case "theme":
          onScheme(action.scheme);
          return;
        case "restore":
          void invoke("restore_last_transcript");
          return;
        case "copy":
          if (lastTranscript) void navigator.clipboard.writeText(lastTranscript);
          return;
        /* The COLLECTION rather than one record, which is why it takes no
           path: History's row reveals the transcript you are looking at, and
           this row is "where are they kept" (ADR 0074). */
        case "reveal":
          void invoke("reveal_transcript_in_file_manager", { request: { path: null } });
          return;
      }
    },
    [lastTranscript, onClose, onScheme, runtime],
  );

  /* CAPTURE ON `window`, AND THAT IS LOAD-BEARING FOR EXACTLY ONE KEY. Escape
     dismisses the topmost transient thing, and the settings sheet listens for
     it on `window` too. A capture listener on `window` runs before every bubble
     listener on it, and stopping propagation there means the event never
     reaches the sheet — so Escape closes the palette and leaves the sheet it
     was opened over standing. The prototype states the stack and never had to
     build it, because it renders one document. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        if (!runnable.length) return;
        const at = runnable.findIndex(({ index }) => index === selected);
        const step = event.key === "ArrowDown" ? 1 : runnable.length - 1;
        /* Wraps. A list this short with a hard stop at each end makes the user
           check where they are; wrapping never does. */
        setSelected(runnable[(Math.max(0, at) + step) % runnable.length].index);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        const hit = rows[selected];
        if (hit && !hit.reason) run(hit.entry.action);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, rows, run, runnable, selected]);

  /* Follow the keyboard, so a selection walked past the fold is not a selection
     nobody can see. `nearest` and not `center`: a list that recentres on every
     arrow press moves under the reader for no reason. */
  useEffect(() => {
    /* Optional call, because jsdom has no `scrollIntoView` at all and a palette
       that throws in the test environment is a palette nothing can assert. */
    listbox.current?.querySelector<HTMLElement>("[data-sel]")?.scrollIntoView?.({
      block: "nearest",
    });
  }, [selected]);

  let group: string | null = null;

  return (
    <Palette label="Search WordScript" onClose={onClose}>
      <PaletteField
        ref={field}
        value={query}
        onValue={(next) => setQuery(next)}
        placeholder="Search settings, screens and transcripts"
      />
      <PaletteList ref={listbox}>
        {rows.length === 0 ? (
          <PaletteEmpty>Nothing matches “{query}”.</PaletteEmpty>
        ) : (
          rows.map(({ entry, reason }, index) => {
            const head = entry.group === group ? null : entry.group;
            group = entry.group;
            return (
              <Fragment key={`${entry.group}-${entry.label}`}>
                {head && <PaletteGroup>{head}</PaletteGroup>}
                <PaletteRow
                  icon={entry.icon}
                  label={entry.label}
                  query={query}
                  where={reason ?? entry.where}
                  selected={index === selected}
                  disabled={Boolean(reason)}
                  onRun={() => run(entry.action)}
                  onPoint={() => setSelected(index)}
                />
              </Fragment>
            );
          })
        )}
      </PaletteList>
      <PaletteFoot />
    </Palette>
  );
}

/** Every `go:` in the index resolves against the window's own tables, so an
 *  entry naming a place this window does not mount is a test failure rather
 *  than a row that opens nothing. */
export function paletteTargetsResolve(): boolean {
  return PALETTE_INDEX.every((entry) => {
    if (entry.action.kind !== "go") return true;
    const target = entry.action.target;
    return "view" in target ? Boolean(findView(target.view)) : Boolean(findSection(target.section));
  });
}
