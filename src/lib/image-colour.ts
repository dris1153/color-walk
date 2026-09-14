import { BUCKET_COUNT, normalizeHue } from './color-math';

/**
 * The reader's own picture, measured the way the index was measured. These
 * constants and the accumulation below mirror
 * scripts/color-index/extract-dominant-color.mjs: a build script is .mjs and
 * cannot import .ts, so the arithmetic lives in both places. Change one and the
 * other must follow, or a picture would land on a colour the index never used.
 */
export const SAMPLE_EDGE = 48;
const MIN_LIGHTNESS = 8;
const MAX_LIGHTNESS = 92;
const MIN_SATURATION = 12;
const MIN_CHROMATIC_SHARE = 0.02;
const BUCKET_WIDTH = 360 / BUCKET_COUNT;
const DEG = Math.PI / 180;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h =
    max === rn ? ((gn - bn) / d) % 6
    : max === gn ? (bn - rn) / d + 2
    : (rn - gn) / d + 4;
  return [normalizeHue(h * 60), s * 100, l * 100];
}

/**
 * RGBA from a canvas. A picture with no colour in it is not a failure: it has a
 * tone, and the monochrome works are a place to walk to. Null only when there
 * are no pixels at all.
 */
export function dominantColorFromPixels(
  data: Uint8ClampedArray,
  channels = 4,
): { neutral: boolean; hue: number; sat: number; lig: number } | null {
  const weight = new Float64Array(BUCKET_COUNT);
  const cos = new Float64Array(BUCKET_COUNT);
  const sin = new Float64Array(BUCKET_COUNT);
  const sat = new Float64Array(BUCKET_COUNT);
  const lig = new Float64Array(BUCKET_COUNT);
  let counted = 0;
  let total = 0;
  let ligAll = 0;

  for (let i = 0; i + channels <= data.length; i += channels) {
    total++;
    const [h, s, l] = rgbToHsl(data[i]!, data[i + 1]!, data[i + 2]!);
    ligAll += l; // every pixel, so a grey picture still has a tone to stand on
    if (l < MIN_LIGHTNESS || l > MAX_LIGHTNESS || s < MIN_SATURATION) continue;
    const w = s / 100; // saturated pixels carry more of the picture's identity
    // Bounded by the modulo, so every read below is in range.
    const b = Math.round(h / BUCKET_WIDTH) % BUCKET_COUNT;
    weight[b] = weight[b]! + w;
    cos[b] = cos[b]! + w * Math.cos(h * DEG);
    sin[b] = sin[b]! + w * Math.sin(h * DEG);
    sat[b] = sat[b]! + w * s;
    lig[b] = lig[b]! + w * l;
    counted += w;
  }

  if (total === 0) return null;
  const neutral = () => ({ neutral: true, hue: 0, sat: 0, lig: Math.round(ligAll / total) });
  if (counted / total < MIN_CHROMATIC_SHARE) return neutral();

  let win = 0;
  for (let b = 1; b < BUCKET_COUNT; b++) if (weight[b]! > weight[win]!) win = b;
  if (weight[win]! <= 0) return neutral();

  // Circular mean, so a bucket straddling 0 does not average to 180.
  return {
    neutral: false,
    hue: Math.round(normalizeHue(Math.atan2(sin[win]!, cos[win]!) / DEG)) % 360,
    sat: Math.round(sat[win]! / weight[win]!),
    lig: Math.round(lig[win]! / weight[win]!),
  };
}
