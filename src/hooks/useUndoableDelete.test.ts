import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UNDO_WINDOW_MS, useUndoableDelete } from "./useUndoableDelete";

/**
 * THE CLOCK IS GRADED HERE AND NOT ON THE SCREENS THAT USE IT (ADR 0195).
 *
 * Both callers debounce a search box and re-read the index on a runtime event,
 * so a case that drove one of them on fake timers would be making a statement
 * about those two as well — the first version of the History case did exactly
 * that and hung. (It was a five-second poll on both until ADR 0240 replaced it
 * with the event; the argument is the same one and the machinery is less.) The
 * hook has none of it around it, which is what makes the three cases ADR 0195
 * had to answer gradeable at all.
 */

describe("the undo window", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("tells the runtime nothing until the window has closed", () => {
    const commit = vi.fn();
    const { result } = renderHook(() => useUndoableDelete(commit));

    act(() => result.current.request("e1", "A record"));
    expect(commit).not.toHaveBeenCalled();
    expect(result.current.pending).toEqual({ id: "e1", title: "A record" });
    expect(result.current.hides("e1")).toBe(true);

    /* One tick short of the window, because a case that only advanced past it
       would pass on a build that committed immediately. */
    act(() => void vi.advanceTimersByTime(UNDO_WINDOW_MS - 1));
    expect(commit).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(1));
    expect(commit).toHaveBeenCalledWith("e1");
    expect(result.current.pending).toBeNull();
  });

  it("never tells it at all when the window is abandoned", () => {
    const commit = vi.fn();
    const { result } = renderHook(() => useUndoableDelete(commit));

    act(() => result.current.request("e1", "A record"));
    act(() => result.current.undo());

    expect(result.current.pending).toBeNull();
    expect(result.current.hides("e1")).toBe(false);
    act(() => void vi.advanceTimersByTime(UNDO_WINDOW_MS * 2));
    expect(commit).not.toHaveBeenCalled();
  });

  /** Case 3. One pending row, never a queue — the notice can only name one, and
   *  a stack of undos is a stack of decisions the reader has to hold. */
  it("carries out the first delete when a second is asked for inside its window", () => {
    const commit = vi.fn();
    const { result } = renderHook(() => useUndoableDelete(commit));

    act(() => result.current.request("e1", "First"));
    act(() => void vi.advanceTimersByTime(UNDO_WINDOW_MS / 2));
    act(() => result.current.request("e2", "Second"));

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith("e1");
    /* And the second gets a FULL window rather than the remainder of the
       first's, or the last row of a run would be the least undoable. */
    act(() => void vi.advanceTimersByTime(UNDO_WINDOW_MS - 1));
    expect(commit).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(1));
    expect(commit).toHaveBeenCalledWith("e2");
  });

  /** Case 1. Leaving the screen ends the window by carrying it out — a row
   *  hidden on one screen and present on another is one record with two
   *  answers. */
  it("carries out a pending delete when the screen goes away", () => {
    const commit = vi.fn();
    const { result, unmount } = renderHook(() => useUndoableDelete(commit));

    act(() => result.current.request("e1", "A record"));
    unmount();

    expect(commit).toHaveBeenCalledWith("e1");
  });

  /** Case 2. The webview closing must not lose the delete — a row that came
   *  back on the next launch would be the request silently dropped. */
  it("carries out a pending delete when the window is closing", () => {
    const commit = vi.fn();
    const { result } = renderHook(() => useUndoableDelete(commit));

    act(() => result.current.request("e1", "A record"));
    act(() => void window.dispatchEvent(new Event("pagehide")));

    expect(commit).toHaveBeenCalledWith("e1");
    /* And exactly once: the unmount that follows a closing window must not
       repeat a command the runtime has already been given. */
    act(() => void vi.advanceTimersByTime(UNDO_WINDOW_MS * 2));
    expect(commit).toHaveBeenCalledTimes(1);
  });
});
