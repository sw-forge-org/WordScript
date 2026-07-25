import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isShortcutCommand, shortcutInvokeDouble } from "../../test/shortcutRuntime";
import { HotkeyRecorder } from "./HotkeyRecorder";

// The widget that carries the whole assignment flow had no test at all (D10),
// and was mocked out wherever it would have been exercised. These cover the
// lifecycle rules from T1 and the vocabulary rules from T2/T3.

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

async function startRecording() {
  const pill = await screen.findByRole("button", { name: /record shortcut/i });
  fireEvent.click(pill);
  await screen.findByText(/press your shortcut/i);
  return pill;
}

describe("HotkeyRecorder", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockImplementation((command: string, args?: Record<string, unknown>) =>
      Promise.resolve(isShortcutCommand(command) ? shortcutInvokeDouble(command, args) : undefined),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("does not commit when a modifier is tapped and released", async () => {
    // D1: the recorder used to finalize as soon as the held set became empty,
    // so tapping Ctrl wrote `ctrl_l` and closed the recorder — which is why no
    // further key could be added.
    const onChange = vi.fn();
    render(<HotkeyRecorder value="" onChange={onChange} />);
    await startRecording();

    fireEvent.keyDown(window, { code: "ControlLeft", key: "Control" });
    fireEvent.keyUp(window, { code: "ControlLeft", key: "Control" });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/recording shortcut/i)).toBeInTheDocument();
  });

  it("accumulates a chord and commits it on Enter", async () => {
    const onChange = vi.fn();
    render(<HotkeyRecorder value="" onChange={onChange} />);
    await startRecording();

    fireEvent.keyDown(window, { code: "ControlLeft", key: "Control" });
    fireEvent.keyDown(window, { code: "KeyA", key: "a" });
    fireEvent.keyUp(window, { code: "KeyA", key: "a" });
    fireEvent.keyUp(window, { code: "ControlLeft", key: "Control" });

    // Releasing everything must not commit; the user confirms explicitly.
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { code: "Enter", key: "Enter" });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("Ctrl+A"));
  });

  it("keeps the largest chord when the modifier is released first", async () => {
    const onChange = vi.fn();
    render(<HotkeyRecorder value="" onChange={onChange} />);
    await startRecording();

    fireEvent.keyDown(window, { code: "ControlLeft", key: "Control" });
    fireEvent.keyDown(window, { code: "AltLeft", key: "Alt" });
    fireEvent.keyDown(window, { code: "Space", key: " " });
    fireEvent.keyUp(window, { code: "ControlLeft", key: "Control" });
    fireEvent.keyUp(window, { code: "AltLeft", key: "Alt" });
    fireEvent.keyUp(window, { code: "Space", key: " " });

    fireEvent.keyDown(window, { code: "Enter", key: "Enter" });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("Ctrl+Alt+Space"));
  });

  it("treats Escape as a chord member while a modifier is held", async () => {
    // D8: Escape was hardwired to "cancel" before modifiers were considered,
    // so the default abort shortcut could not be reproduced with the recorder
    // that manages it.
    const onChange = vi.fn();
    render(<HotkeyRecorder value="" onChange={onChange} />);
    await startRecording();

    fireEvent.keyDown(window, { code: "ControlLeft", key: "Control" });
    fireEvent.keyDown(window, { code: "AltLeft", key: "Alt" });
    fireEvent.keyDown(window, { code: "Escape", key: "Escape" });
    fireEvent.keyUp(window, { code: "ControlLeft", key: "Control" });
    fireEvent.keyUp(window, { code: "AltLeft", key: "Alt" });

    fireEvent.keyDown(window, { code: "Enter", key: "Enter" });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("Ctrl+Alt+Escape"));
  });

  it("cancels on a bare Escape without changing anything", async () => {
    const onChange = vi.fn();
    render(<HotkeyRecorder value="Ctrl+F9" onChange={onChange} />);
    await startRecording();

    fireEvent.keyDown(window, { code: "KeyB", key: "b" });
    fireEvent.keyDown(window, { code: "Escape", key: "Escape" });

    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("resume_native_trigger"));
  });

  it("refuses a single bare modifier with a stated reason", async () => {
    // D2/T3: a single modifier used to be registered as a bare desktop-wide
    // grab on that modifier.
    const onChange = vi.fn();
    render(<HotkeyRecorder value="" onChange={onChange} />);
    await startRecording();

    fireEvent.keyDown(window, { code: "ControlLeft", key: "Control" });
    // The stated reason has to be the current one: not the retired grab
    // argument, and not an absolute — a single modifier is allowed where the
    // session reports an interrupted hold, and the message names that.
    expect(await screen.findByText(/interrupts the hold/i)).toBeInTheDocument();
    expect(screen.getByText(/fire while typing/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { code: "Enter", key: "Enter" });
    await waitFor(() => expect(screen.getByLabelText(/recording shortcut/i)).toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("names a key it cannot register instead of dropping it silently", async () => {
    render(<HotkeyRecorder value="" onChange={vi.fn()} />);
    await startRecording();

    fireEvent.keyDown(window, { code: "ControlLeft", key: "Control" });
    fireEvent.keyDown(window, { code: "MediaPlayPause", key: "MediaPlayPause" });

    expect(await screen.findByText(/is not a key wordscript can register/i)).toBeInTheDocument();
  });

  it("rejects a combination that another shortcut already uses", async () => {
    const onChange = vi.fn();
    render(<HotkeyRecorder value="" onChange={onChange} takenValues={["Ctrl+F9"]} />);
    await startRecording();

    fireEvent.keyDown(window, { code: "ControlLeft", key: "Control" });
    fireEvent.keyDown(window, { code: "F9", key: "F9" });
    fireEvent.keyUp(window, { code: "ControlLeft", key: "Control" });
    fireEvent.keyDown(window, { code: "Enter", key: "Enter" });

    expect(await screen.findByText(/already used by another shortcut/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("confirms via the check mark while the keys are still held", async () => {
    // Enter is a chord member while a modifier is down, so the button is the
    // way to confirm without releasing first.
    const onChange = vi.fn();
    render(<HotkeyRecorder value="" onChange={onChange} />);
    await startRecording();

    fireEvent.keyDown(window, { code: "ControlLeft", key: "Control" });
    fireEvent.keyDown(window, { code: "F9", key: "F9" });

    const confirmButton = await screen.findByRole("button", { name: /confirm shortcut/i });
    await waitFor(() => expect(confirmButton).not.toBeDisabled());
    fireEvent.click(confirmButton);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("Ctrl+F9"));
  });

  it("releases the OS grabs while recording and restores them afterwards", async () => {
    // D3/T4: a grabbed combination is delivered to the grab owner, not to this
    // window, so without a real release the shortcut in use is invisible here.
    render(<HotkeyRecorder value="" onChange={vi.fn()} />);
    await startRecording();

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("pause_native_trigger"));

    fireEvent.keyDown(window, { code: "Escape", key: "Escape" });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("resume_native_trigger"));
  });

  it("cancels and restores the grabs when the pill loses focus", async () => {
    const onChange = vi.fn();
    render(<HotkeyRecorder value="" onChange={onChange} />);
    const pill = await startRecording();

    fireEvent.blur(pill);

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("resume_native_trigger"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("times out instead of leaving the lane ungrabbed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onChange = vi.fn();
    render(<HotkeyRecorder value="" onChange={onChange} />);

    const pill = await screen.findByRole("button", { name: /record shortcut/i });
    fireEvent.click(pill);
    await screen.findByText(/press your shortcut/i);

    await vi.advanceTimersByTimeAsync(11_000);

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("resume_native_trigger"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders a stored value as a human shortcut", async () => {
    render(<HotkeyRecorder value="Ctrl+F9" display="Ctrl + F9" onChange={vi.fn()} />);

    expect(await screen.findByText("Ctrl")).toBeInTheDocument();
    expect(screen.getByText("F9")).toBeInTheDocument();
  });
});
