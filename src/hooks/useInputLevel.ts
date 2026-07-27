import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { BackendEvent } from "../types/ipc";

const RUNTIME_EVENT_CHANNEL = "wordscript-event";

/** Peak below this never registers as speech — mirrors DEFAULT_VOICE_THRESHOLD
 *  in `core::capture`. A capture that stays under it is discarded entirely. */
export const VOICE_THRESHOLD = 0.02;
/** Comfortable speech peak. Above this headroom gets tight. */
export const TARGET_PEAK_HIGH = 0.9;
/** How long a peak stays visible, so a short syllable is readable. */
const HOLD_MS = 900;

export interface InputLevelReading {
  /** Instantaneous peak, 0..1. */
  peak: number;
  /** Decaying peak hold, 0..1. */
  hold: number;
  rms: number;
  /** True once any level event has arrived, so the UI can distinguish
   *  "silent" from "not measuring yet". */
  active: boolean;
}

/**
 * Live microphone level from the runtime's existing `audio_level` event.
 *
 * Read-only: this measures what arrives, it never changes an input volume.
 * The operating system's microphone level is per device, not per application,
 * so writing it would re-level every other app on the same microphone.
 */
export function useInputLevel(enabled = true): InputLevelReading {
  const [reading, setReading] = useState<InputLevelReading>({
    peak: 0,
    hold: 0,
    rms: 0,
    active: false,
  });
  const holdRef = useRef({ value: 0, at: 0 });

  useEffect(() => {
    if (!enabled) {
      holdRef.current = { value: 0, at: 0 };
      setReading({ peak: 0, hold: 0, rms: 0, active: false });
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | null = null;

    // Without the Tauri host (settings rendered outside the shell, component
    // tests) there is no event bridge. A meter that cannot measure shows
    // nothing; it must not take the surrounding view down with it.
    Promise.resolve()
      .then(() =>
        listen<BackendEvent>(RUNTIME_EVENT_CHANNEL, ({ payload }) => {
          if (payload.event !== "audio_level") return;

          const peak = Math.min(Math.max(payload.level ?? 0, 0), 1);
          const rms = Math.min(Math.max(payload.rms ?? 0, 0), 1);
          const now = Date.now();

          const elapsed = now - holdRef.current.at;
          const decayed =
            elapsed >= HOLD_MS ? 0 : holdRef.current.value * (1 - elapsed / HOLD_MS);
          holdRef.current =
            peak >= decayed ? { value: peak, at: now } : { value: decayed, at: now };

          setReading({ peak, hold: holdRef.current.value, rms, active: true });
        }),
      )
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
  }, [enabled]);

  return reading;
}

export function toDbfs(amplitude: number): number {
  if (amplitude <= 0) return -120;
  return Math.max(20 * Math.log10(amplitude), -120);
}
