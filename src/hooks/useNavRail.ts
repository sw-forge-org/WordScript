import { useCallback, useEffect, useState } from "react";

/**
 * THE SIDEBAR'S WIDTH, AND WHO DECIDES IT — ADR 0111.
 *
 * Two things want to decide, and they are not the same kind of thing:
 *
 *   - THE USER, by pressing the toggle. That is a PREFERENCE and it is
 *     remembered, in `AppConfig.workspace_nav_rail`, for the reason the colour
 *     scheme is remembered there — the choice belongs to the machine and has to
 *     survive a restart.
 *   - THE WINDOW, by being too narrow to afford a 232 px column. That is STATE.
 *     It is not written to the config, because a user who drags a window narrow
 *     and wide again has expressed nothing and must not come back to a rewritten
 *     preference.
 *
 * SO THE BREAKPOINT FIRES ON A CROSSING, NOT ON EVERY WIDTH. `matchMedia`'s
 * change event is exactly one event per crossing: shrink past the floor and the
 * sidebar rails; grow back past it and it returns to what the user chose. In
 * between, the toggle is the authority and nothing overrules it — a sidebar
 * that springs back open on the next resize tick is a control that does not
 * work.
 *
 * WHY 760 CSS PX. ADR 0104 measured the shipped window: `tauri.conf.json`
 * declares 1000 × 760 and the layout gets `1000 / 1.25 = 800` CSS px on the
 * owner's display, with the declared `minWidth: 880` landing at 704. So the
 * workspace lives between 704 and whatever the user drags to, the default is
 * 800, and a floor at 760 is the one number that leaves the default window
 * expanded while railing the window that cannot afford the column. It is a CSS
 * pixel figure, quoted with its viewport, exactly as ADR 0104 requires.
 */
export const NAV_RAIL_FLOOR = 760;

const RAIL_QUERY = `(max-width: ${NAV_RAIL_FLOOR - 1}px)`;

function windowIsNarrow(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(RAIL_QUERY).matches;
}

export interface NavRail {
  /** Whether the sidebar draws as a rail right now. */
  railed: boolean;
  /** The toggle. Writes the preference through `persist`. */
  toggle: () => void;
}

/**
 * `preference` is the stored choice and `persist` is what writes it. Both come
 * from the window's config draft, so this hook holds no config of its own and
 * cannot disagree with one.
 */
export function useNavRail(
  preference: boolean | undefined,
  persist: (next: boolean) => void,
): NavRail {
  const [railed, setRailed] = useState<boolean>(() => windowIsNarrow() || !!preference);

  /* The stored choice, adopted when the runtime answers and whenever it changes
     underneath — another window, or a config edited on disk. Keyed on the
     preference alone: a narrow window has already railed and stays railed,
     because `windowIsNarrow()` is checked first. Same shape as the colour
     scheme's adoption effect in `WorkspaceWindow`, and for the same reason. */
  useEffect(() => {
    if (preference === undefined) return;
    setRailed(windowIsNarrow() || preference);
  }, [preference]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia(RAIL_QUERY);
    const onCross = (event: MediaQueryListEvent) => {
      // Narrow: the window rails regardless of the preference, because there is
      // no width to spend. Wide again: back to whatever the user chose.
      setRailed(event.matches || !!preference);
    };
    media.addEventListener("change", onCross);
    return () => media.removeEventListener("change", onCross);
  }, [preference]);

  const toggle = useCallback(() => {
    setRailed((open) => {
      const next = !open;
      persist(next);
      return next;
    });
  }, [persist]);

  return { railed, toggle };
}
