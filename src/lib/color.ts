/**
 * Colour measurement for the design-system gallery.
 *
 * ADR 0055 asks Foundations for "tokens in all three schemes, MEASURED
 * contrast". The prototype hardcoded its figures because it is a static mock,
 * and one of them was wrong for a whole pass before §11.1 caught it — a number
 * typed beside a colour is a number that stops being true the moment the colour
 * moves. So the gallery measures the live tokens instead, and the figures
 * cannot go stale when a value is adjusted or when the scheme switches.
 *
 * ADR 0048 makes that obligation explicit for the second scheme: "contrast has
 * to be re-measured on the light side; a theme shipped without its own
 * measurements is a theme nobody checked."
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Parses the colour forms the token block actually uses — `#rgb`, `#rrggbb`,
 * `rgb()` and `rgba()`. A token carrying `color-mix()` is not measurable from
 * its declared text and returns null rather than a guess; nothing measured on
 * this surface is one.
 */
export function parseColor(value: string): Rgb | null {
  const text = value.trim();
  if (text === "") return null;

  if (text.startsWith("#")) {
    const hex = text.slice(1);
    if (hex.length === 3) {
      const [r, g, b] = hex;
      return {
        r: parseInt(`${r}${r}`, 16),
        g: parseInt(`${g}${g}`, 16),
        b: parseInt(`${b}${b}`, 16),
      };
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
    return null;
  }

  const match = text.match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return null;
  const parts = match[1].split(/[,/\s]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null;
  return { r: parts[0], g: parts[1], b: parts[2] };
}

const linear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance. */
export function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio, 1 to 21. AA for body text is 4.5:1. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * CIE L*, which is what the ladder is spaced on. Two surfaces 9 luminance
 * points apart are not 9 points apart to the eye; L* is, which is why §5.1
 * argues the lift in it and why the crush range §2.3 names is an L* range.
 */
export function lStar(color: Rgb): number {
  const y = luminance(color);
  const f = y > (6 / 29) ** 3 ? Math.cbrt(y) : y / (3 * (6 / 29) ** 2) + 4 / 29;
  return 116 * f - 16;
}

/** Reads a custom property off an element, resolved for the active scheme. */
export function readToken(name: string, element?: Element | null): string {
  const target = element ?? (typeof document === "undefined" ? null : document.documentElement);
  if (!target) return "";
  return getComputedStyle(target).getPropertyValue(name).trim();
}
