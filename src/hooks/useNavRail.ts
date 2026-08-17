import { useCallback, useEffect, useRef, useState } from "react";

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
 *
 * AND THAT FIGURE MOVES WITH THE DISPLAY SCALE, WHICH IS WHY THE NARROW HALF IS
 * NOT THE RARE ONE (ADR 0198). The 1000 in `tauri.conf.json` lands as device
 * pixels, so the layout gets `1000 / scale` CSS px: 800 at the 1.25 ADR 0104
 * measured, and 625 at the 1.6 a 4K panel asks for — under the floor at every
 * width the window can be dragged to, since even `maxWidth: 1240` comes to 775.
 * On such a display the rail is the state the workspace opens in, so everything
 * about it is a main path rather than an edge, the toggle included.
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

  /* WHAT THIS HOOK WROTE ITSELF, SO IT CAN TELL ITS OWN ECHO FROM A NEW CHOICE
     — ADR 0198. `persist` writes into the window's config draft and the draft
     hands the field straight back as `preference`, so the toggle's own write
     arrives here as a CHANGE and re-enters the effect below. Re-deriving from
     it puts `windowIsNarrow()` back in front of a choice the user has just
     made, and in a narrow window that is the whole defect: expanding wrote
     `false`, the echo derived `narrow || false` = railed, and the sidebar shut
     again inside the same press. Collapsing agreed with the derivation by
     coincidence, which is why it took one press and expanding took two.

     A boolean is enough because the only value that can arrive equal to it and
     mean something else is one this hook already stands at. */
  const writtenRef = useRef<boolean | null>(null);

  /* The stored choice, adopted when the runtime answers and whenever it changes
     underneath — another window, or a config edited on disk. Keyed on the
     preference alone: a narrow window has already railed and stays railed,
     because `windowIsNarrow()` is checked first. Same shape as the colour
     scheme's adoption effect in `WorkspaceWindow`, and for the same reason. */
  useEffect(() => {
    if (preference === undefined) return;
    if (preference === writtenRef.current) return;
    setRailed(windowIsNarrow() || preference);
  }, [preference]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia(RAIL_QUERY);
    const onCross = (event: MediaQueryListEvent) => {
      // Narrow: the window rails regardless of the preference, because there is
      // no width to spend. Wide again: back to whatever the user chose.
      // The crossing is the one thing that DOES overrule the toggle, so the
      // toggle's claim on the preference ends here too.
      writtenRef.current = null;
      setRailed(event.matches || !!preference);
    };
    media.addEventListener("change", onCross);
    return () => media.removeEventListener("change", onCross);
  }, [preference]);

  /* THE PREFERENCE IS WRITTEN AFTER THE COLUMN HAS MOVED, NOT WITH IT —
     ADR 0202, and this is the whole defect the owner reported as juddering.
     Measured in the shipped engine, on the Profiles view, one press:

       the state change alone          31 frames in 500 ms, worst gap 17 ms
       the state change WITH the slide 31 frames,           worst gap 17 ms
       the config write alone          31 frames,           worst gap 18 ms
       both, the way a press did it    14 frames,     TWO gaps of ~145 ms

     Each half is free and the pair is not. The write is a `save_config` round
     trip whose settle and whose `ready` each re-render the window, and landing
     those renders on a frame where the sidebar's own style and layout are
     already dirty costs two full passes over a view that a re-render on a
     clean frame costs nothing for. Nothing in the app forces the layout —
     every geometry-reading API was patched and counted across a press, and the
     count was zero — so this is the engine, and the fix is to stop asking it
     to do both things at once.

     240 ms is past the 180 ms the column takes, which is what makes the two
     pieces of work land on different frames. **The delay is not what makes it
     correct** — the write is a preference and the surface is already showing
     the answer; this is the same bargain `useConfigDraft` strikes for a
     keystroke, and it flushes on unmount for the same reason. */
  const PREFERENCE_COMMIT_MS = 240;

  const persistRef = useRef(persist);
  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);

  const pendingRef = useRef<boolean | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const next = pendingRef.current;
    pendingRef.current = null;
    if (next !== null) persistRef.current(next);
  }, []);

  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // A choice made and then closed on is still the choice.
  useEffect(() => () => flushRef.current(), []);

  /* The current state, readable outside a state updater, so the toggle can
     schedule its write without doing work inside one. */
  const railedRef = useRef(railed);
  railedRef.current = railed;

  const toggle = useCallback(() => {
    const next = !railedRef.current;
    railedRef.current = next;
    writtenRef.current = next;
    setRailed(next);
    pendingRef.current = next;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      flushRef.current();
    }, PREFERENCE_COMMIT_MS);
  }, []);

  return { railed, toggle };
}
