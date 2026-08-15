import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { useModelLibrary } from "./useModelLibrary";
import type { ModelInstallEvent, ModelLibrary } from "@/types/models";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

const invoked = vi.mocked(invoke);
const listened = vi.mocked(listen);

/**
 * THE SURFACE HALF OF B5's RULES (ADR 0122).
 *
 * The runtime's own tests hold what happens on the disk. These hold the three
 * things that are only true up here: a progress event does not cost a command,
 * a terminal one does, and an event naming an install this hook is no longer
 * following moves nothing.
 */

/** Every listener the hook registered, so a test can push an event at it. */
let emit: (payload: ModelInstallEvent) => void = () => {};

function library(overrides: Partial<ModelLibrary> = {}): ModelLibrary {
  return {
    speech_dir: "/home/someone/.config/WordScript/models/speech",
    server: { base_url: "http://127.0.0.1:11434", reachable: true, detail: "Answering." },
    rows: [
      {
        row: "local-speech-base",
        model_id: "ggml-base",
        role: "speech",
        mechanism: "download",
        size_bytes: 147_951_465,
        quantization: null,
        state: { kind: "installing", install_id: "install-1", received_bytes: 0 },
        path: null,
        in_use_by: null,
      },
      {
        row: "local-chat-qwen-7b",
        model_id: "qwen2.5-7b-instruct",
        role: "chat",
        mechanism: "server_pull",
        size_bytes: 4_683_086_845,
        quantization: "Q4_K_M",
        state: { kind: "installable" },
        path: null,
        in_use_by: null,
      },
    ],
    ...overrides,
  };
}

function event(overrides: Partial<ModelInstallEvent> = {}): ModelInstallEvent {
  return {
    install_id: "install-1",
    row: "local-speech-base",
    phase: "progress",
    received_bytes: 0,
    total_bytes: 147_951_465,
    detail: null,
    ...overrides,
  };
}

beforeEach(() => {
  invoked.mockReset();
  invoked.mockImplementation(async (command: string) => {
    if (command === "model_library") return library();
    return undefined;
  });

  listened.mockReset();
  /* Cast, because `listen`'s real signature hands the callback a full `Event`
     with an id and a channel name and this hook reads neither. Typing the mock
     to the whole shape would be three fields of ceremony per emitted event. */
  listened.mockImplementation((async (
    _channel: string,
    handler: (message: { payload: ModelInstallEvent }) => void,
  ) => {
    emit = (payload) => handler({ payload });
    return () => undefined;
  }) as unknown as typeof listen);
});

function readCount() {
  return invoked.mock.calls.filter(([command]) => command === "model_library").length;
}

describe("useModelLibrary", () => {
  it("reads the whole tab in one command rather than once per row", async () => {
    const hook = renderHook(() => useModelLibrary());

    await waitFor(() => expect(hook.result.current.rows).toHaveLength(2));
    expect(readCount()).toBe(1);
  });

  /**
   * **A percentage does not cost a command.** A 1.6 GB download reports every
   * 250 ms; a hook that re-read the library on each of those would issue
   * hundreds of calls, every one of which probes a network endpoint.
   */
  it("moves a running install from the channel without re-reading", async () => {
    const hook = renderHook(() => useModelLibrary());
    await waitFor(() => expect(hook.result.current.rows).toHaveLength(2));

    act(() => emit(event({ received_bytes: 73_975_732 })));

    await waitFor(() => {
      const row = hook.result.current.rows[0];
      expect(row.state).toEqual({
        kind: "installing",
        install_id: "install-1",
        received_bytes: 73_975_732,
      });
    });
    expect(readCount()).toBe(1);
  });

  /* A terminal phase is the only one that changes what is on the disk, so it
     is the only one that costs a read. `verifying` is deliberately not one:
     nothing has been renamed into place yet. */
  it("re-reads only when a phase changed what is on the disk", async () => {
    const hook = renderHook(() => useModelLibrary());
    await waitFor(() => expect(hook.result.current.rows).toHaveLength(2));

    act(() => emit(event({ phase: "verifying" })));
    await waitFor(() => expect(readCount()).toBe(1));

    act(() => emit(event({ phase: "installed" })));
    await waitFor(() => expect(readCount()).toBe(2));
  });

  /**
   * **A late event moves nothing**, and it is dropped by install id rather than
   * by row. The runtime discards the same result on its own side and logs it;
   * this is the surface half of one rule.
   */
  it("ignores progress for an install it is no longer following", async () => {
    const hook = renderHook(() => useModelLibrary());
    await waitFor(() => expect(hook.result.current.rows).toHaveLength(2));

    act(() => emit(event({ install_id: "install-9", received_bytes: 140_000_000 })));

    await waitFor(() => {
      expect(hook.result.current.rows[0].state).toEqual({
        kind: "installing",
        install_id: "install-1",
        received_bytes: 0,
      });
    });
  });

  /**
   * **A refusal is the deliverable, not an error to swallow.** ADR 0122 refuses
   * to remove a model a profile resolves to and names the profile; a surface
   * that dropped that string would delete-and-fail silently, which is exactly
   * what the refusal was written to prevent.
   */
  it("keeps the refusal a removal answered with, against the row it names", async () => {
    invoked.mockImplementation(async (command: string) => {
      if (command === "model_library") return library();
      if (command === "remove_model") {
        throw new Error("Technical notes runs on ggml-base — change that profile's model first.");
      }
      return undefined;
    });

    const hook = renderHook(() => useModelLibrary());
    await waitFor(() => expect(hook.result.current.rows).toHaveLength(2));

    await act(async () => {
      await hook.result.current.remove("local-speech-base");
    });

    expect(hook.result.current.failures["local-speech-base"]).toMatch(/Technical notes/);
  });

  /**
   * **A library that will not read is not an empty machine.** Reporting nothing
   * installed because a command failed would be the fake-state defect this
   * whole step removes, one layer up from where it removed it.
   */
  it("says the read failed rather than reporting nothing installed", async () => {
    invoked.mockImplementation(async (command: string) => {
      if (command === "model_library") throw new Error("the runtime is not answering");
      return undefined;
    });

    const hook = renderHook(() => useModelLibrary());

    await waitFor(() => expect(hook.result.current.error).toMatch(/not answering/));
    expect(hook.result.current.library).toBeNull();
  });

  /* Without the Tauri host there is no event bridge. The tab still renders on
     whatever the one read answered; a listener that cannot attach must not take
     the surrounding view down with it. */
  it("still answers when there is no event bridge to listen on", async () => {
    listened.mockImplementation(async () => {
      throw new Error("no host");
    });

    const hook = renderHook(() => useModelLibrary());

    await waitFor(() => expect(hook.result.current.rows).toHaveLength(2));
    expect(hook.result.current.error).toBeNull();
  });

  it("asks nothing at all when it is not enabled", async () => {
    renderHook(() => useModelLibrary(false));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(readCount()).toBe(0);
    expect(listened).not.toHaveBeenCalled();
  });
});
