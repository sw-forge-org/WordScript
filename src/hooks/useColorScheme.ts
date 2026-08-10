import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

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
 * THE HOST IS ASKED FIRST, AND THE MEDIA QUERY IS THE FALLBACK (§15.3, closed
 * by Leg 6). `window.theme()` is the desktop's own answer and the same one the
 * window decoration follows; `prefers-color-scheme` inside WebKitGTK reports
 * the GTK preference too, so it is not wrong, it is second-hand — and asking
 * the host removes the case where the two disagree. Both are subscribed while
 * `system` is chosen: Tauri emits `tauri://theme-changed` when the desktop
 * switches, and the media query still answers in a browser, where there is no
 * host at all.
 *
 * The chosen scheme is pushed BACK to the window, because a title bar does not
 * read a CSS attribute — picking Light on a dark desktop otherwise leaves a
 * light workspace inside a dark frame.
 *
 * BOTH ARE BEHIND `followHost`, AND THE DEFAULT IS OFF. This hook is the design
 * system's and the gallery uses it too, and the gallery calls no Tauri API at
 * all — its test asserts that by mocking `invoke` to throw (ADR 0055). So the
 * product surface opts in and the display surface stays a display surface.
 */
export function useColorScheme(initial: ColorScheme = "dark", followHost = false) {
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

  /* The host's own answer, and its own event. Both are guarded: outside the
     native host `invoke` rejects and `listen` never fires, which leaves the
     media query above as the only source — the state this hook was in before
     the native half existed. */
  useEffect(() => {
    if (!followHost) return;
    if (scheme !== "system") return;
    let cancelled = false;

    void invoke<string | null>("system_color_scheme")
      .then((next) => {
        if (!cancelled && next) setSystemDark(next !== "light");
      })
      .catch(() => {});

    const unlisten = listen<string>("tauri://theme-changed", ({ payload }) => {
      setSystemDark(String(payload).toLowerCase() !== "light");
    }).catch(() => () => {});

    return () => {
      cancelled = true;
      void unlisten.then((stop) => stop());
    };
  }, [scheme, followHost]);

  const resolved: ResolvedScheme =
    scheme === "system" ? (systemDark ? "dark" : "light") : scheme;

  /* The window chrome follows the RESOLVED value, which is what a decoration
     can be: there is no "system" title bar, there is a light one and a dark
     one. Pushed on every change rather than only on an explicit choice, so a
     desktop that switches at dusk under `system` moves the frame too. */
  useEffect(() => {
    if (!followHost) return;
    void invoke("set_window_color_scheme", { scheme }).catch(() => {});
  }, [followHost, scheme, resolved]);

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
