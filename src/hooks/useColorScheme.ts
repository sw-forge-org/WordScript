import { useCallback, useEffect, useLayoutEffect, useState } from "react";

export type ColorScheme = "light" | "dark" | "system";
export type ResolvedScheme = "light" | "dark";

const QUERY = "(prefers-color-scheme: dark)";

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia(QUERY).matches;
}

/**
 * THREE SETTINGS, AND THE THIRD IS THE HONEST ONE: Light, Dark, System
 * (ADR 0048).
 *
 * `system` IS NOT A THIRD PALETTE. It is a deferral, resolved against
 * `prefers-color-scheme` at render time and re-resolved when the OS changes, so
 * a desktop that switches at dusk is followed without a restart. A value
 * sampled once at boot is a guess that goes stale.
 *
 * What lands on `<html data-theme>` is therefore always the RESOLVED value —
 * `dark` or `light`, never `system`. The token block keys off that, and with no
 * attribute at all it is dark, which is what the overlay window and every test
 * render get.
 *
 * TWO THINGS ABOUT THE MECHANISM ARE LOAD-BEARING.
 *
 * `resolved` is DERIVED, not stored. Storing it costs a second render pass in
 * which the surface is already showing the new scheme and every value read off
 * it is still the old one — which is exactly how the gallery's measured
 * contrast came out one commit behind the palette it was measuring.
 *
 * And the attribute is applied in a LAYOUT effect. React runs layout effects
 * child-first and then parent, and only afterwards the passive effects, so a
 * child that measures the resolved tokens in `useEffect` is guaranteed to run
 * after this. A passive effect here would paint one frame of the previous
 * scheme first, which on a full-window repaint is visible.
 *
 * The native half of this is still owed by `src-tauri/`: `window.theme()` and
 * the Tauri theme-changed event, so the shell follows the OS the way this
 * follows the media query (§15.3). Until then the media query is the only
 * source, and inside a WebKitGTK host it reports the GTK preference.
 */
export function useColorScheme(initial: ColorScheme = "dark") {
  const [scheme, setScheme] = useState<ColorScheme>(initial);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  /* Subscribed only while something depends on it: nothing listens when the
     answer is not being asked for. */
  useEffect(() => {
    if (scheme !== "system") return;
    if (typeof window === "undefined" || !window.matchMedia) return;

    const media = window.matchMedia(QUERY);
    setSystemDark(media.matches);
    const follow = () => setSystemDark(media.matches);
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, [scheme]);

  const resolved: ResolvedScheme =
    scheme === "system" ? (systemDark ? "dark" : "light") : scheme;

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute("data-theme");
    root.setAttribute("data-theme", resolved);
    return () => {
      if (previous === null) root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", previous);
    };
  }, [resolved]);

  return {
    scheme,
    resolved,
    setScheme: useCallback((next: ColorScheme) => setScheme(next), []),
  };
}
