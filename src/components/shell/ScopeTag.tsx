import * as React from "react";
/* The prototype's `profiles` glyph — a bound notebook, the same mark the nav
   row for Profiles carries, so the tag and the place it links to agree. */
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";

interface ScopeTagProps {
  /** The profile the value belongs to. Defaults to the general statement for a
   *  surface that does not know which profile is active. */
  profile?: React.ReactNode;
  /** Opens the profile the value belongs to. A tag that names an owner and
   *  cannot reach it makes the reader search for what it just told them about. */
  onOpen?: () => void;
  className?: string;
}

/**
 * A ROW STATES ITS SCOPE WHEN ITS VALUE IS NOT THE WINDOW'S. Plan §11.7.
 *
 * SETTINGS MEANS THIS MACHINE. Half the shipped settings are per-profile in the
 * runtime — delivery behaviour, the processing mode, language, bias, the
 * recording limits and the workspace-context switch — and every one of them was
 * presented in a section that reads as machine-wide. That is the shape of the
 * failure ADR 0024 exists because of: a value with one owner, edited from a
 * place that does not name the owner. It had already produced one duplicate
 * control.
 *
 * The values that stay in settings for findability carry this tag and link to
 * the profile that owns them, so "what stays global" is readable at a glance
 * rather than learned by accident.
 */
export function ScopeTag({ profile, onOpen, className }: ScopeTagProps) {
  const text = profile ?? "Per profile";

  if (!onOpen) {
    return (
      <span className={cn("ws-scope", className)}>
        <Icon name="profiles" />
        {text}
      </span>
    );
  }

  return (
    <button type="button" className={cn("ws-scope", className)} onClick={onOpen}>
      <Icon name="profiles" />
      {text}
    </button>
  );
}
