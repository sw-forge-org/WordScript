import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useColorScheme } from "./useColorScheme";

/** A controllable `prefers-color-scheme: dark`, because jsdom's always answers
 *  false and a deferral that is never re-resolved cannot be told from one that
 *  resolved once at boot — which is the whole distinction ADR 0048 draws. */
function mockSystem(dark: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    matches: dark,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media),
  );
  return {
    change(next: boolean) {
      media.matches = next;
      for (const fn of listeners) fn();
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-theme");
});

describe("useColorScheme", () => {
  it("writes the chosen scheme onto the document", () => {
    const { result } = renderHook(() => useColorScheme("dark"));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    act(() => result.current.setScheme("light"));

    expect(result.current.resolved).toBe("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  /* `system` is a deferral, not a third palette: what lands on <html> is always
     `dark` or `light`, because the token block has no third ladder to key off. */
  it("resolves system against the OS rather than writing it", () => {
    mockSystem(false);
    const { result } = renderHook(() => useColorScheme("system"));

    act(() => result.current.setScheme("system"));

    expect(result.current.scheme).toBe("system");
    expect(result.current.resolved).toBe("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  /* A value sampled once at boot is a guess that goes stale. A desktop that
     switches at dusk is followed without a restart. */
  it("follows the OS when it changes", () => {
    const system = mockSystem(true);
    const { result } = renderHook(() => useColorScheme("system"));

    expect(result.current.resolved).toBe("dark");

    act(() => system.change(false));

    expect(result.current.resolved).toBe("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("stops following once a scheme is chosen explicitly", () => {
    const system = mockSystem(true);
    const { result } = renderHook(() => useColorScheme("system"));

    act(() => result.current.setScheme("light"));
    expect(system.listenerCount).toBe(0);

    act(() => system.change(true));
    expect(result.current.resolved).toBe("light");
  });

  /* With no attribute at all the ladder is dark — which is what the overlay
     window and every test render get, so unmounting has to restore that. */
  it("leaves the document as it found it", () => {
    const { unmount } = renderHook(() => useColorScheme("light"));

    expect(document.documentElement).toHaveAttribute("data-theme", "light");

    unmount();

    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });
});
