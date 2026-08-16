import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** Renewed well inside the runtime's `MONITOR_LEASE_MS` (45 s), so a lease only
 *  ever runs out because the window that held it is gone. */
const RENEW_INTERVAL_MS = 15_000;

export interface InputMonitorReading {
  /** True while the runtime holds the microphone for this screen. */
  monitoring: boolean;
  /** The device the runtime actually opened — not always the configured one. */
  deviceName: string | null;
  /** Why it is not running, when that is a fact worth stating. */
  error: string | null;
}

interface NativeInputMonitorStatus {
  monitoring: boolean;
  device_name: string | null;
}

/**
 * ASK THE RUNTIME TO MEASURE THE MICROPHONE WHILE NOTHING IS BEING RECORDED.
 *
 * The measurement itself is `core::input_monitor`; this is the lease. It opens
 * the microphone when the screen is BOTH on screen and focused, and gives it
 * back on every path out — losing focus, leaving the screen, unmounting.
 *
 * FOCUS IS PART OF THE CONDITION, NOT A REFINEMENT. Visibility alone would
 * leave a microphone open behind whatever the user switched to, for as long as
 * a settings window sits forgotten on another workspace. Focus is what makes
 * "the meter is live" and "you are looking at the meter" the same state.
 *
 * IT ALSO RENEWS. A webview that disappears runs no cleanup, so the runtime
 * stops a monitor whose lease is not renewed; this is the renewal, and it stops
 * with the component that owns it.
 *
 * WITHOUT THE HOST there is nothing to ask — settings rendered outside the
 * shell, component tests — and this reports `monitoring: false` and takes
 * nothing down with it.
 */
export function useInputMonitor(enabled: boolean): InputMonitorReading {
  const [monitoring, setMonitoring] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* FALSE UNTIL THE HOST SAYS OTHERWISE. Starting optimistically and stopping
     a moment later when the answer arrives would open and close the device for
     nothing, which on some hosts is an audible click. */
  const [focused, setFocused] = useState(false);
  /** Whether this hook currently holds a lease, so it only ever hands back a
   *  microphone it actually asked for. */
  const heldRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    const apply = (next: boolean) => {
      if (disposed) return;
      setFocused(next);
    };

    /* THE WINDOW'S FOCUS, NOT THE DOCUMENT'S. `document.hasFocus()` is about
       this webview, and a window can be the one you are looking at while the
       focus sits in another view inside it — which would leave the meter dead
       until something was clicked. `isFocused()` answers the first frame, the
       event answers every one after it, and neither exists outside the host. */
    Promise.resolve()
      .then(async () => {
        const current = getCurrentWindow();
        apply(await current.isFocused());
        return current.onFocusChanged(({ payload }) => apply(payload));
      })
      .then((fn) => {
        if (disposed) {
          fn();
          return;
        }
        unlisten = fn;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const wanted = enabled && focused;

  useEffect(() => {
    if (!wanted) {
      setMonitoring(false);
      setDeviceName(null);
      // ONLY IF THIS HOOK EVER STARTED ONE. A screen nobody opened does not
      // speak to the runtime at all, and an unconditional stop here would have
      // it say "give the microphone back" about a microphone it never asked
      // for.
      if (heldRef.current) {
        heldRef.current = false;
        void invoke("stop_input_monitor").catch(() => undefined);
      }
      // Not `setError(null)`: a device that failed to open is still the answer
      // to "why is this meter not moving", and leaving the screen does not
      // change it. It is cleared when a start succeeds.
      return;
    }

    let disposed = false;
    heldRef.current = true;

    const start = async () => {
      try {
        const status = await invoke<NativeInputMonitorStatus>("start_input_monitor");
        if (disposed) return;
        setMonitoring(Boolean(status?.monitoring));
        setDeviceName(status?.device_name ?? null);
        setError(null);
      } catch (reason) {
        if (disposed) return;
        setMonitoring(false);
        setDeviceName(null);
        setError(String(reason));
      }
    };

    void start();
    const renewal = window.setInterval(() => {
      void invoke("renew_input_monitor").catch(() => undefined);
    }, RENEW_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(renewal);
      heldRef.current = false;
      void invoke("stop_input_monitor").catch(() => undefined);
    };
  }, [wanted]);

  return { monitoring, deviceName, error };
}
