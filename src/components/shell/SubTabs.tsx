import * as React from "react";
import { cn } from "@/lib/utils";

/** `"|"` renders the dividing rule, not a tab. */
export type SubTabItem = { id: string; label: React.ReactNode } | "|";

interface SubTabsProps {
  items: SubTabItem[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  className?: string;
}

const isRule = (item: SubTabItem): item is "|" => item === "|";

/**
 * A pill row under a section header. Depth goes here, never into the sidebar
 * (§4.3 rule 2) — a settings surface that answers a third level by adding a
 * third level of navigation has stopped being navigable.
 *
 * `"|"` IN THE ITEM LIST RENDERS A RULE (§11.30, §11.31). A tab bar is a claim
 * that its entries are the same kind of thing, and two places were making that
 * claim falsely. The rule marks the boundary and the control stays one control
 * — cheaper than a second bar and cheaper than a heading. It lives here rather
 * than in the screen that first needed it because the second caller already
 * existed when it was written.
 */
export function SubTabs({ items, value, onChange, label, className }: SubTabsProps) {
  const tabs = items.filter((item): item is Exclude<SubTabItem, "|"> => !isRule(item));
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0 || tabs.length === 0) return;

    const current = tabs.findIndex((tab) => tab.id === value);
    const next = tabs[(current + step + tabs.length) % tabs.length];
    if (!next) return;

    event.preventDefault();
    onChange(next.id);
    refs.current[next.id]?.focus();
  };

  return (
    <div
      className={cn("ws-subtabs", className)}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {items.map((item, index) =>
        isRule(item) ? (
          <span key={`rule-${index}`} className="ws-subtabs-rule" aria-hidden />
        ) : (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === value}
            tabIndex={item.id === value ? 0 : -1}
            ref={(node) => {
              refs.current[item.id] = node;
            }}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
