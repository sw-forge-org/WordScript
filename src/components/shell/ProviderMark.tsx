import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BRAND_SYMBOLS, BRAND_TINTS } from "./brandSymbols";

/**
 * A PROVIDER'S MARK, OR NOTHING WHEN THE PROVIDER HAS NONE — ported from
 * `demo.js`'s `brand()` and `demo.css` §"Provider marks".
 *
 * Returning nothing rather than a placeholder is deliberate: a generic glyph
 * standing in for a brand reads as a brand nobody recognises. The callers that
 * need a fallback pass one; the ones that do not get an absent mark.
 *
 * A mark inherits `currentColor` where it has no colour of its own, so it dims
 * with the row it sits in rather than staying loud when the row is quiet.
 */

/** `demo.js`'s map, verbatim — including the ids that resolve to `null`. */
const BRAND_ALIASES: Record<string, string | null> = {
  groq: "groq",
  openai: "openai",
  anthropic: "anthropic",
  googlegemini: "gemini",
  gemini: "gemini",
  mistral: "mistral",
  xai: "xai",
  openrouter: "openrouter",
  awsbedrock: "bedrock",
  azureopenai: "azure",
  gcpvertexai: "vertexai",
  ollama: "ollama",
  lmstudio: "lmstudio",
  llama: "meta",
  qwen: "qwen",
  gemma: "gemma",
  llamacpp: "meta",
  yourserver: null,
};

export function brandSymbolId(name: string | null | undefined): string | null {
  const key = String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (key in BRAND_ALIASES) return BRAND_ALIASES[key];
  return BRAND_SYMBOLS[key] ? key : null;
}

export function ProviderMark({
  name,
  className,
  fallback = null,
}: {
  name: string | null | undefined;
  className?: string;
  fallback?: ReactNode;
}) {
  const id = brandSymbolId(name);
  if (!id) return <>{fallback}</>;
  const tint = BRAND_TINTS[id];
  return (
    <svg className={cn("ws-pmark", className)} style={tint ? { color: tint } : undefined} aria-hidden>
      <use href={`#pm-${id}`} />
    </svg>
  );
}

/**
 * THE SPRITE HOST. Mounted once per window, above everything that references
 * it. It is `position: absolute` at zero size rather than `display: none`,
 * because a hidden host makes its symbols unreferenceable in some engines.
 *
 * `dangerouslySetInnerHTML` is the honest tool here and not a shortcut: the
 * symbol bodies are a build-time constant copied byte for byte out of the
 * prototype, and re-typing fifteen upstream paths as JSX is fifteen chances to
 * silently change a curve.
 */
export function ProviderSprite() {
  const symbols = Object.entries(BRAND_SYMBOLS)
    .map(([key, body]) => `<symbol id="pm-${key}" viewBox="0 0 24 24">${body}</symbol>`)
    .join("");
  return (
    <svg
      className="ws-pmark-sprite"
      aria-hidden
      focusable="false"
      dangerouslySetInnerHTML={{ __html: symbols }}
    />
  );
}

/**
 * THE PROVIDER CHIP ROW — `demo.js`'s `provChips()`.
 *
 * A chip is a radio, not a button. Exactly one is on, the group is a
 * `radiogroup`, and the accent marks the chosen one because that is what the
 * accent means. The marks keep their brand tint: recognition is the entire
 * point, and a row of grey logos is a row of shapes.
 *
 * `custom` is the last chip and is not a provider: it is the door to an
 * OpenAI-compatible endpoint the user operates, which every cloud list needs
 * and no cloud list contains.
 */
export function ProviderChips({
  providers,
  value,
  onChange,
  custom = true,
  customIcon,
  fallbackIcon,
  label = "Provider",
}: {
  providers: string[];
  value: string;
  onChange?: (name: string) => void;
  custom?: boolean;
  customIcon?: ReactNode;
  fallbackIcon?: ReactNode;
  label?: string;
}) {
  return (
    <div className="ws-provrow" role="radiogroup" aria-label={label}>
      {providers.map((name) => {
        const on = name === value;
        return (
          <button
            key={name}
            type="button"
            className="ws-provchip"
            role="radio"
            aria-checked={on}
            data-on={on ? "" : undefined}
            onClick={() => onChange?.(name)}
          >
            <span className="ws-provchip-mark">
              <ProviderMark name={name} fallback={fallbackIcon} />
            </span>
            <span>{name}</span>
          </button>
        );
      })}
      {custom && (
        <button
          type="button"
          className="ws-provchip"
          role="radio"
          aria-checked={value === "Custom"}
          data-on={value === "Custom" ? "" : undefined}
          data-custom=""
          onClick={() => onChange?.("Custom")}
        >
          <span className="ws-provchip-mark">{customIcon}</span>
          <span>Custom</span>
        </button>
      )}
    </div>
  );
}
