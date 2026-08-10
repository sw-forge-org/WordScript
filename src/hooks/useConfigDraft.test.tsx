import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConfigDraft } from "./useConfigDraft";
import { createAppConfig } from "@/test/factories";
import type { AppConfig } from "@/types/ipc";

/**
 * P1, EXERCISED. It was built in Leg 4b and had no caller until Profiles — the
 * first screen in the product with a text field — so until now the debounce was
 * a mechanism nobody had run.
 *
 * What is asserted is the two claims the hook's header makes: that typing puts
 * the draft in the form immediately and the DISK WRITE is what waits, and that
 * a discrete patch cannot be overtaken by a keystroke that was typed before it.
 */

const CONFIG = createAppConfig();

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function setup(save = vi.fn(async (next: AppConfig) => next)) {
  const hook = renderHook(() => useConfigDraft(CONFIG, save));
  return { hook, save };
}

describe("useConfigDraft", () => {
  it("puts what you typed in the form on the keystroke", () => {
    const { hook } = setup();

    act(() => hook.result.current.patchText({ agent_name: "Wo" }));
    /* Not "after the debounce" — a form that lags the cursor is the defect P1
       is about, and it is why the draft and the write are separated at all. */
    expect(hook.result.current.form?.agent_name).toBe("Wo");
  });

  it("writes once for a burst of typing rather than once per keystroke", async () => {
    const { hook, save } = setup();

    act(() => {
      hook.result.current.patchText({ agent_name: "W" });
      hook.result.current.patchText({ agent_name: "Wo" });
      hook.result.current.patchText({ agent_name: "Wor" });
      hook.result.current.patchText({ agent_name: "Word" });
    });
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].agent_name).toBe("Word");
  });

  it("commits a pending draft when the surface asks it to", async () => {
    const { hook, save } = setup();

    act(() => hook.result.current.patchText({ agent_name: "Word" }));
    await act(async () => {
      hook.result.current.flushText();
    });

    expect(save).toHaveBeenCalledTimes(1);
    /* And the timer that was pending must not fire a second write. */
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("does not let a debounced keystroke land after a later toggle and revert it", async () => {
    const { hook, save } = setup();

    act(() => hook.result.current.patchText({ agent_name: "Word" }));
    act(() => hook.result.current.patch({ play_sounds: false }));

    /* The discrete patch flushes the text commit FIRST, so the write that
       carries the old `play_sounds` cannot arrive after the one that changed
       it. Without that the toggle reverts itself a fifth of a second later. */
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[0][0].agent_name).toBe("Word");
    expect(save.mock.calls[0][0].play_sounds).toBe(true);
    expect(save.mock.calls[1][0].agent_name).toBe("Word");
    expect(save.mock.calls[1][0].play_sounds).toBe(false);
  });

  it("loses nothing typed to an unmount", async () => {
    const { hook, save } = setup();

    act(() => hook.result.current.patchText({ agent_name: "Word" }));
    await act(async () => {
      hook.unmount();
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].agent_name).toBe("Word");
  });

  it("puts the form back to what the runtime holds when a save is refused", async () => {
    const save = vi.fn(async () => {
      throw new Error("nope");
    });
    const hook = renderHook(() => useConfigDraft(CONFIG, save));

    await act(async () => {
      hook.result.current.patch({ sound_pack: "glass" });
    });

    /* A value the runtime rejected may not stay on screen looking saved. */
    expect(hook.result.current.form?.sound_pack).toBe(CONFIG.sound_pack);
  });
});
