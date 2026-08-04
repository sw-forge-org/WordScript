import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A hotkey, drawn as the caps you press. `Ctrl+Super` splits on `+`; the caps
 * are 20 px minimum-width boxes on the elevated plane, which is what makes a
 * shortcut readable as a shortcut in a sentence.
 */
export function Keycaps({
  combo,
  className,
}: {
  /** `null` renders nothing — use `HotkeyButton` for the unset state. */
  combo: string;
  className?: string;
}) {
  return (
    <span className={cn("ws-kbd", className)}>
      {combo.split("+").map((key) => (
        <kbd key={key}>{key}</kbd>
      ))}
    </span>
  );
}

interface HotkeyButtonProps extends Omit<React.ComponentPropsWithoutRef<"button">, "type"> {
  /** `null` is the unset state: a dashed cap reading "not set", and the action
   *  word changes from Change to Set. */
  combo: string | null;
}

/**
 * A HOTKEY IS A TARGET YOU CLICK. The caps say what it is bound to and the
 * trailing word says what pressing this does about it — which is the whole
 * reason the caps are inside a button rather than beside one.
 */
export function HotkeyButton({ combo, className, ...props }: HotkeyButtonProps) {
  return (
    <button
      type="button"
      className={cn("ws-kbd-btn", className)}
      data-empty={combo ? undefined : ""}
      {...props}
    >
      {combo ? (
        <Keycaps combo={combo} />
      ) : (
        <span className="ws-kbd">
          <kbd>not set</kbd>
        </span>
      )}
      <span className="ws-kbd-edit">{combo ? "Change" : "Set"}</span>
    </button>
  );
}
