import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isShortcutCommand, shortcutInvokeDouble } from "../../test/shortcutRuntime";
import { HotkeyRecorder } from "./HotkeyRecorder";

// The widget that carries the whole assignment flow had no test at all (D10),
// and was mocked out wherever it would have been exercised. These cover the
// lifecycle rules from T1 as ADR 0201 narrowed them, and the vocabulary rules
// from T2/T3.

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

/** The click-to-start path, which is what a caller that has not spent a click
 *  getting here still gets. */
async function startRecording() {
  const pill = await screen.findByRole("button", { name: /record shortcut/i });
  fireEvent.click(pill);
  await screen.findByText(/press your shortcut/i);
  return pill;
}

/** The `autoStart` path: no click at all, because the caller already spent it. */
async function awaitRecording() {
  await screen.findByText(/press your shortcut/i);
  return screen.getByLabelText(/recording shortcut/i);
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

  it("is recording on its first frame, before the vocabulary has arrived", () => {
    // Deliberately not awaited. Starting from an effect painted the idle pill
    // first — stored caps, no ring — and replaced it once the vocabulary round
    // trip came back, which is long enough to see and was reported as such.
    render(<HotkeyRecorder autoStart value="Ctrl+F9" display="Ctrl + F9" onChange={vi.fn()} />);

    expect(screen.getByLabelText(/recording shortcut, press your keys/i)).toBeInTheDocument();
    expect(screen.getByText(/press your shortcut/i)).toBeInTheDocument();
    expect(screen.queryByText("F9")).not.toBeInTheDocument();
  });

  it("records from the moment it mounts when autoStart is set", async () => {
    // The row that renders this has already spent the user's click getting
    // here. Without autoStart that click bought a widget that only looks like
    // it is listening, which is the "I have to press twice" report (ADR 0201).
    render(<HotkeyRecorder autoStart value="" onChange={vi.fn()} />);

    await awaitRecording();
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("pause_native_trigger"));
  });

  it("does not commit when a modifier is tapped and released", async () => {
    // D1: the recorder used to finalize as soon as the held set became empty,
    // so tapping Ctrl wrote `ctrl_l` and closed the recorder — which is why no
    // further key could be added. A modifier-only chord is still the one shape
    // a release edge must not decide: it is a prefix of everything the user
    // might still be reaching for.
    const onChange = vi.fn();
    render(<HotkeyRecorder value="" onChange={onChange} />);
    await startRecording();

    fireEvent.keyDown(window, { code: "ControlLeft", key: "Control" });
    fireEvent.keyUp(window, { code: "ControlLeft", key: "Control" });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/recording shortcut/i)).toBeInTheDocument();
  });

  it("commits a chord with a key as soon as the last key is released", async () => {
    const onChange = vi.fn();
    render(<HotkeyRecorder value="" onChange={onChange} />);
    await startRecording();

    fireEvent.keyDown(window, { code: "ControlLeft", key: "Control" });
    fireEvent.keyDown(window, { code: "KeyA", key: "a" });
    fireEvent.keyUp(window, { code: "KeyA", key: "a" });

    // Still holding Ctrl — the grip is not over, so nothing is written yet.
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyUp(window, { code: "ControlLeft", key: "Control" });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("Ctrl+A"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("confirms a modifier-only chord on Enter", async () => {
    const onChange = vi.fn();
    render(<HotkeyRecorder value="" onChange={onChange} />);
    await startRecording();

    fireEvent.keyDown(window, { code: "ControlLeft", key: "Control" });
    fireEvent.keyDown(window, { code: "AltLeft", key: "Alt" });
    fireEvent.keyUp(window, { code: "ControlLeft", key: "Control" });
    fireEvent.keyUp(window, { code: "AltLeft", key: "Alt" });

    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { code: "Enter", key: "Enter" });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("Ctrl+Alt"));
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

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("Ctrl+Alt+Space"));
  });

  it("commits once when the release arrives twice", async () => {
    // X11 delivered duplicated press/release pairs in the S0 measurement, so
    // the second release is a measured case rather than a hypothetical one.
    const onChange = vi.fn();
    render(<HotkeyRecorder value="" onChange={onChange} />);
    await startRecording();

    fireEvent.keyDown(window, { code: "ControlLeft", key: "Control" });
    fireEvent.keyDown(window, { code: "KeyA", key: "a" });
    fireEvent.keyUp(window, { code: "ControlLeft", key: "Control" });
    fireEvent.keyUp(window, { code: "KeyA", key: "a" });
    fireEvent.keyUp(window, { code: "KeyA", key: "a" });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("Ctrl+A"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("holds back a shortcut the runtime warned about until it is confirmed", async () => {
    // A bare function key is a desktop-wide grab. The runtime accepts it with a
    // stated warning, which is exactly the thing a release edge must not decide
    // on the user's behalf.
    const onChange = vi.fn();
    render(<HotkeyRecorder value="" onChange={onChange} />);
    await startRecording();

    fireEvent.keyDown(window, { code: "F1", key: "F1" });
    fireEvent.keyUp(window, { code: "F1", key: "F1" });

    expect(await screen.findByText(/registered globally without a modifier/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { code: "Enter", key: "Enter" });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("F1"));
  });

  it("clears the shortcut on Backspace without asking for a replacement", async () => {
    // T7: an empty value is "disabled", so removing a shortcut does not require
    // choosing another one first. There was no affordance for it at all.
    const onChange = vi.fn();
    render(<HotkeyRecorder autoStart value="Ctrl+F9" display="Ctrl + F9" onChange={onChange} />);
    await awaitRecording();

    fireEvent.keyDown(window, { code: "Backspace", key: "Backspace" });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(""));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("resume_native_trigger"));
  });

  it("treats Backspace as a chord member while a modifier is held", async () => {
    const onChange = vi.fn();
    render(<HotkeyRecorder value="" onChange={onChange} />);
    await startRecording();

    fireEvent.keyDown(window, { code: "ControlLeft", key: "Control" });
    fireEvent.keyDown(window, { code: "Backspace", key: "Backspace" });
    fireEvent.keyUp(window, { code: "Backspace", key: "Backspace" });
    fireEvent.keyUp(window, { code: "ControlLeft", key: "Control" });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("Ctrl+Backspace"));
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
    fireEvent.keyUp(window, { code: "Escape", key: "Escape" });

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

    fireEvent.keyUp(window, { code: "ControlLeft", key: "Control" });
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
    fireEvent.keyUp(window, { code: "F9", key: "F9" });

    expect(await screen.findByText(/already used by another shortcut/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("starts a fresh chord after a rejected one instead of growing it", async () => {
    // The largest grip wins WITHIN one grip. Across two of them the older one
    // is a leftover, and after a rejected chord it is a leftover the user is
    // trying to replace.
    const onChange = vi.fn();
    render(<HotkeyRecorder value="" onChange={onChange} takenValues={["Ctrl+A"]} />);
    await startRecording();

    fireEvent.keyDown(window, { code: "ControlLeft", key: "Control" });
    fireEvent.keyDown(window, { code: "KeyA", key: "a" });
    fireEvent.keyUp(window, { code: "ControlLeft", key: "Control" });
    fireEvent.keyUp(window, { code: "KeyA", key: "a" });
    expect(await screen.findByText(/already used by another shortcut/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { code: "AltLeft", key: "Alt" });
    fireEvent.keyDown(window, { code: "KeyB", key: "b" });
    fireEvent.keyUp(window, { code: "AltLeft", key: "Alt" });
    fireEvent.keyUp(window, { code: "KeyB", key: "b" });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("Alt+B"));
  });

  it("offers no confirm or cancel button, because the keys already do both", async () => {
    // A check mark and a cross beside a pill that commits on release are two
    // controls for gestures the widget performs by itself.
    render(<HotkeyRecorder autoStart value="" onChange={vi.fn()} />);
    await awaitRecording();

    expect(screen.queryByRole("button", { name: /confirm shortcut/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel recording/i })).not.toBeInTheDocument();
  });

  it("says what the keys do in one line, not two", async () => {
    render(<HotkeyRecorder autoStart value="" onChange={vi.fn()} />);
    await awaitRecording();

    expect(screen.getByText("Esc cancels · Backspace clears")).toBeInTheDocument();
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

  it("re-arms the timeout on every key event", async () => {
    // Ten seconds from the first click is a budget for deciding, not one for
    // pressing keys — a user who thinks for eight seconds and then records a
    // chord used to lose it mid-grip.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<HotkeyRecorder autoStart value="" onChange={vi.fn()} />);
    await awaitRecording();

    await vi.advanceTimersByTimeAsync(8_000);
    fireEvent.keyDown(window, { code: "ControlLeft", key: "Control" });
    await vi.advanceTimersByTimeAsync(8_000);

    expect(screen.getByLabelText(/recording shortcut/i)).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalledWith("resume_native_trigger");
  });

  it("renders a stored value as a human shortcut", async () => {
    render(<HotkeyRecorder value="Ctrl+F9" display="Ctrl + F9" onChange={vi.fn()} />);

    expect(await screen.findByText("Ctrl")).toBeInTheDocument();
    expect(screen.getByText("F9")).toBeInTheDocument();
  });
});
