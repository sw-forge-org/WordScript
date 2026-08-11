import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "./Card";

export interface LaneOption {
  id: string;
  /** A 15 px glyph. It sits in a 30 px tile that tints with the selection. */
  icon?: React.ReactNode;
  name: React.ReactNode;
  /** One line — and how long that is has never been measured, because nothing
   *  outside the gallery mounts this component. It said "at most 90
   *  characters", which ADR 0092 measured as wrong everywhere it could reach;
   *  the number is not carried forward here rather than replaced with a second
   *  unmeasured one. Measure it in the native host on the surface that first
   *  ships a lane card. */
  description?: React.ReactNode;
  /** A status that is NOT expected. An expected status is a dot and a word, or
   *  nothing (§11.20). The selected lane's own `Active` mark is drawn by this
   *  component and must not be passed here. */
  badge?: React.ReactNode;
  disabled?: boolean;
}

interface LaneCardProps {
  options: LaneOption[];
  value: string;
  onChange: (id: string) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Names the group for assistive technology when there is no visible title. */
  label?: string;
  /** The mark on the selected row. Pass `null` where the surface already says
   *  which lane is running and a second statement would be furniture. */
  activeBadge?: React.ReactNode;
  className?: string;
}

/**
 * ONE CARD OF RADIO ROWS: icon tile, name, one line, radio.
 *
 * Replaces `SegmentControl` plus one card per provider — a segmented control
 * can hold a word per option and a provider needs a sentence, so the shipped
 * surface had been drawing the choice twice: once as a segment and again as the
 * cards underneath it. Plan §5.3.
 *
 * The radio is drawn on integers — 16 px box, 2 px border, 8 px dot — because a
 * control that must look centred has no integer centre at 17 px with a 1.5 px
 * border and its dot sits visibly off-centre at any device pixel ratio
 * (§11.17). The geometry is in `shell.css`, not here.
 */
export function LaneCard({
  options,
  value,
  onChange,
  title,
  description,
  label,
  activeBadge = "Active",
  className,
}: LaneCardProps) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

  /** A radiogroup is arrow-navigated, and the arrows move the selection with
   *  the focus — that is what distinguishes it from a list of buttons. */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;
    if (step === 0) return;

    const usable = options.filter((option) => !option.disabled);
    if (usable.length === 0) return;
    const current = usable.findIndex((option) => option.id === value);
    const next = usable[(current + step + usable.length) % usable.length];
    if (!next) return;

    event.preventDefault();
    onChange(next.id);
    refs.current[options.indexOf(next)]?.focus();
  };

  return (
    <Card title={title} description={description} className={className}>
      <div className="ws-lane" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
        {options.map((option, index) => {
          const checked = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={option.disabled}
              tabIndex={checked ? 0 : -1}
              ref={(node) => {
                refs.current[index] = node;
              }}
              className="ws-lane-row"
              onClick={() => onChange(option.id)}
            >
              {option.icon && <span className="ws-lane-tile">{option.icon}</span>}
              <span className="ws-lane-text">
                <b>
                  {option.name}
                  {checked && activeBadge && (
                    <span className="ws-badge" data-tone="success">
                      {activeBadge}
                    </span>
                  )}
                  {option.badge && (
                    <span className="ws-badge" data-tone="plan">
                      {option.badge}
                    </span>
                  )}
                </b>
                {option.description && <span>{option.description}</span>}
              </span>
              <span className={cn("ws-radio")} aria-hidden />
            </button>
          );
        })}
      </div>
    </Card>
  );
}
