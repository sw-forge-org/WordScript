import groq from "@lobehub/icons-static-svg/icons/groq.svg";
import openai from "@lobehub/icons-static-svg/icons/openai.svg";
import anthropic from "@lobehub/icons-static-svg/icons/anthropic.svg";
import elevenlabs from "@lobehub/icons-static-svg/icons/elevenlabs.svg";
import ollama from "@lobehub/icons-static-svg/icons/ollama.svg";
import mistral from "@lobehub/icons-static-svg/icons/mistral-color.svg";

/**
 * Provider marks, from `@lobehub/icons-static-svg` (MIT).
 *
 * WHY THE STATIC PACKAGE AND NOT `@lobehub/icons`. The React package peer-
 * depends on React 19 and on antd — a whole second component library — for
 * what is, in this product, a set of logos beside a model name. Adopting a
 * rival UI framework to render six SVGs is not a trade worth making, and the
 * static package is the same artwork by the same authors with no runtime at
 * all.
 *
 * MONOCHROME BY DEFAULT, and the default is the interesting decision. A brand
 * mark's colour is part of the mark, and stripping it normally costs
 * recognition for nothing. Here it buys something specific: these marks appear
 * in a settings list where exactly one row may carry the accent, meaning
 * "overridden". Six brand colours in that column leaves the one row that needs
 * attention with nothing to stand out from. `color` renders the mark as
 * supplied, for the places it appears alone.
 */

const MARKS = { groq, openai, anthropic, elevenlabs, ollama, mistral } as const;

export type ProviderId = keyof typeof MARKS;

interface ProviderMarkProps {
  id: ProviderId;
  size?: number;
  /** Render the mark in its own brand colours. Use only when it stands alone. */
  color?: boolean;
}

export function ProviderMark({ id, size = 16, color = false }: ProviderMarkProps) {
  return (
    <img
      src={MARKS[id]}
      width={size}
      height={size}
      alt={id}
      className="ws-provider-mark"
      data-mono={color ? undefined : ""}
      loading="lazy"
    />
  );
}

export const PROVIDER_IDS = Object.keys(MARKS) as ProviderId[];
