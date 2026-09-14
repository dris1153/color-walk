/**
 * Its own module so the bucket writer can use it without pulling in sharp.
 * Mirrors src/lib/color-math.ts: a .mjs build script cannot import .ts, so the
 * conversion exists on both sides and the two must stay in step.
 */
const wrap360 = (h) => ((h % 360) + 360) % 360;

/** h 0..360, s and l 0..100. */
export function hslToHex(h, s, l) {
  const hue = wrap360(h);
  const sat = Math.min(100, Math.max(0, s)) / 100;
  const lig = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig - c / 2;
  const seg = Math.floor(hue / 60) % 6;
  const rgb =
    seg === 0 ? [c, x, 0]
    : seg === 1 ? [x, c, 0]
    : seg === 2 ? [0, c, x]
    : seg === 3 ? [0, x, c]
    : seg === 4 ? [x, 0, c]
    : [c, 0, x];
  return `#${rgb.map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}
