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

/**
 * HOW LONG A VERDICT STANDS BEFORE THE OPPOSITE ONE MAY REPLACE IT.
 *
 * The runtime reports every 42 ms and a speaking voice crosses the speech
 * threshold on nearly every syllable and falls under it in every gap between
 * two words. Deciding the verdict per reading therefore made the line flip
 * between "Good" and "Too quiet" several times a sentence — technically each
 * frame was right and the readout was unusable, and because the two sentences
 * are different lengths the card resized underneath it.
 *
 * A VERDICT IS ABOUT A PHRASE, NOT ABOUT A FRAME. "Is this microphone set right"
 * is answered by whether speech reached the threshold at all in the last few
 * seconds, so that is the window it is measured over. The bar above it still
 * moves at the runtime's cadence — the measurement did not get slower, the
 * SENTENCE did, which is the one part of this row a person reads rather than
 * watches.
 */
const VERDICT_WINDOW_MS = 2_500;
/** A hot peak has to stand longer than it takes to say one loud word, or the
 *  warning would arrive after the take it was about. */
const HOT_WINDOW_MS = 1_500;
/** How often the numbers a person READS are allowed to change. Fast enough to
 *  feel live, slow enough that a dBFS figure can be finished being read. */
const TEXT_REFRESH_MS = 400;

export type LevelVerdictState = "measuring" | "silent" | "quiet" | "ok" | "hot";

/**
 * WHAT IS READ, as opposed to what is watched.
 *
 * Everything in here is a sentence or a colour: it changes when the answer
 * changes, and a person has to be able to finish reading it. The numbers that
 * MOVE are not in here at all — they are on the refs below, because a value
 * that changes twenty-four times a second has no business being React state on
 * a settings screen.
 */
export interface InputLevelReading {
  /** True once any level event has arrived, so the UI can distinguish
   *  "silent" from "not measuring yet". */
  active: boolean;
  /**
   * The verdict over `VERDICT_WINDOW_MS`, which is the thing the sentence and
   * the colour follow. Never derive one from an instantaneous peak: that is the
   * flicker this exists to end.
   */
  state: LevelVerdictState;
  /** The loudest peak in the verdict's window, 0..1 — the number the sentence
   *  quotes, so the figure and the verdict are about the same stretch of time. */
  windowPeak: number;
}

const IDLE: InputLevelReading = {
  active: false,
  state: "measuring",
  windowPeak: 0,
};

/** The moving numbers, as the meter needs them: amplitude, unscaled, because a
 *  threshold mark is only honest against the number it marks. */
export interface LiveMeterReading {
  /** Instantaneous peak, 0..1. */
  peak: number;
  /** Decaying peak hold, 0..1. */
  hold: number;
}

export interface InputLevelStream extends InputLevelReading {
  /**
   * THE LEVEL AS A DRAWING HEIGHT, WITHOUT A RENDER. The waveform's animation
   * loop reads this every frame; nothing subscribes to it, so the twenty-four
   * readings a second that drive the drawing cost no React work at all.
   *
   * That is not a micro-optimisation. Rendering a settings screen twenty-four
   * times a second is what took the frame rate down in the first place: the
   * animation and the layout were competing for the same main thread, and the
   * animation is the half you can see losing.
   */
  levelRef: { current: number };
  /** The same idea for the bar: amplitude and hold, read per frame by a meter
   *  that animates itself rather than being re-rendered into place. */
  meterRef: { current: LiveMeterReading };
}

/**
 * Live microphone level from the runtime, on either of the two channels that
 * carry one.
 *
 * `audio_level` is a CAPTURE reporting itself and exists only while one runs.
 * `input_monitor_level` is `core::input_monitor`, the same measurement taken
 * with nothing being recorded — which is the state a settings screen asks the
 * question in. Both are the runtime measuring one microphone, so the reading is
 * one reading; what differs is which of them is emitting, and a screen that
 * cared would be asserting a session state it does not own.
 *
 * IT RETURNS TWO THINGS AT TWO RATES, on purpose. `levelRef` carries every
 * reading and renders nothing, for the drawing. The reading itself is state and
 * changes at `TEXT_REFRESH_MS`, for the parts a person reads.
 *
 * Read-only: this measures what arrives, it never changes an input volume.
 * The operating system's microphone level is per device, not per application,
 * so writing it would re-level every other app on the same microphone.
 */
export function useInputLevel(enabled = true): InputLevelStream {
  const [reading, setReading] = useState<InputLevelReading>(IDLE);
  const levelRef = useRef(0);
  const meterRef = useRef<LiveMeterReading>({ peak: 0, hold: 0 });
  const liveRef = useRef({
    peak: 0,
    hold: 0,
    holdAt: 0,
    rms: 0,
    active: false,
    /** Last time the signal was unambiguously speech, and last time it was too
     *  hot. The verdict is a question about these two clocks. */
    lastVoiceAt: 0,
    lastHotAt: 0,
    /** Loudest peak inside the current verdict window, with the time it was
     *  seen, so the quoted figure decays with the window instead of standing
     *  forever. */
    windowPeak: 0,
    windowPeakAt: 0,
  });

  useEffect(() => {
    if (!enabled) {
      levelRef.current = 0;
      meterRef.current = { peak: 0, hold: 0 };
      liveRef.current = {
        peak: 0,
        hold: 0,
        holdAt: 0,
        rms: 0,
        active: false,
        lastVoiceAt: 0,
        lastHotAt: 0,
        windowPeak: 0,
        windowPeakAt: 0,
      };
      setReading(IDLE);
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
          // The monitor handing the microphone back is not a quiet room, and
          // holding the last reading would state a level nothing is measuring.
          if (payload.event === "input_monitor_stopped") {
            levelRef.current = 0;
            meterRef.current = { peak: 0, hold: 0 };
            liveRef.current = {
              peak: 0,
              hold: 0,
              holdAt: 0,
              rms: 0,
              active: false,
              lastVoiceAt: 0,
              lastHotAt: 0,
              windowPeak: 0,
              windowPeakAt: 0,
            };
            setReading(IDLE);
            return;
          }

          if (payload.event !== "audio_level" && payload.event !== "input_monitor_level") {
            return;
          }

          const peak = Math.min(Math.max(payload.level ?? 0, 0), 1);
          const rms = Math.min(Math.max(payload.rms ?? 0, 0), 1);
          const now = Date.now();
          const live = liveRef.current;

          const elapsed = now - live.holdAt;
          const decayed = elapsed >= HOLD_MS ? 0 : live.hold * (1 - elapsed / HOLD_MS);
          live.hold = peak >= decayed ? peak : decayed;
          live.holdAt = now;
          live.peak = peak;
          live.rms = rms;
          live.active = true;

          if (peak > VOICE_THRESHOLD) live.lastVoiceAt = now;
          if (peak >= TARGET_PEAK_HIGH) live.lastHotAt = now;

          // The window's peak stands until the window has moved past it, so the
          // quoted dBFS belongs to the stretch the verdict is about.
          if (peak >= live.windowPeak || now - live.windowPeakAt >= VERDICT_WINDOW_MS) {
            live.windowPeak = peak;
            live.windowPeakAt = now;
          }

          levelRef.current = toDisplayLevel({ peak, rms });
          meterRef.current = { peak, hold: live.hold };
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

    // ONE PUBLISHER FOR THE PARTS THAT ARE READ. Committing on every event
    // would re-render the whole screen twenty-four times a second for a
    // sentence that says the same thing each time.
    const publish = window.setInterval(() => {
      const live = liveRef.current;
      const now = Date.now();
      const next: InputLevelReading = {
        active: live.active,
        state: verdictFor(live, now),
        windowPeak: live.windowPeak,
      };
      setReading((current) => (sameReading(current, next) ? current : next));
    }, TEXT_REFRESH_MS);

    return () => {
      disposed = true;
      window.clearInterval(publish);
      unlisten?.();
    };
  }, [enabled]);

  return { ...reading, levelRef, meterRef };
}

interface LiveState {
  peak: number;
  hold: number;
  active: boolean;
  lastVoiceAt: number;
  lastHotAt: number;
}

/**
 * The verdict, over time rather than over one reading.
 *
 * `hot` OUTRANKS `quiet` AND DECAYS SLOWER. Clipping is the failure you cannot
 * repair afterwards, and it happens in bursts — a warning that vanished with
 * the syllable that caused it would never be read.
 */
function verdictFor(live: LiveState, now: number): LevelVerdictState {
  if (!live.active) return "measuring";
  if (live.lastHotAt > 0 && now - live.lastHotAt <= HOT_WINDOW_MS) return "hot";
  if (live.lastVoiceAt > 0 && now - live.lastVoiceAt <= VERDICT_WINDOW_MS) return "ok";
  // Nothing has crossed the threshold in the window. Which of the two that is
  // depends on whether anything was heard at all.
  return live.hold > 0 || live.peak > 0 ? "quiet" : "silent";
}

/** Renders are the cost this hook exists not to pay, so an unchanged reading is
 *  not committed. The quoted peak is compared at the resolution it is PRINTED
 *  at — a whole dBFS — because a change too small to reach the sentence is a
 *  render for nothing. */
function sameReading(a: InputLevelReading, b: InputLevelReading): boolean {
  return (
    a.state === b.state &&
    a.active === b.active &&
    Math.round(toDbfs(a.windowPeak)) === Math.round(toDbfs(b.windowPeak))
  );
}

/**
 * The reading as a 0..1 HEIGHT, which is a different question from the reading
 * itself.
 *
 * `LevelMeter` draws the amplitude unchanged, because a threshold mark is only
 * honest against the number it marks. A waveform has no threshold and one job —
 * showing the shape of a voice — and ordinary speech peaks somewhere around
 * 0.1..0.4, so drawn unchanged it is a flat smear along the bottom of the row.
 *
 * The curve is the overlay's, from `levelFromPayload` in `OverlayWindow.tsx`,
 * so one voice reaches the same height in the overlay and in Settings. Its gate
 * is deliberately NOT carried over: the overlay suppresses a quiet room because
 * it is reporting a dictation, and this row exists partly to show whether the
 * room floor is audible under the speech.
 */
export function toDisplayLevel({ peak, rms }: { peak: number; rms: number }): number {
  return Math.min(Math.max(Math.max(peak * 3.15, rms * 3.45), 0), 1);
}

export function toDbfs(amplitude: number): number {
  if (amplitude <= 0) return -120;
  return Math.max(20 * Math.log10(amplitude), -120);
}
