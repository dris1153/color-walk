import sharp from 'sharp';
import { hslToHex } from './hsl-to-hex.mjs';

export const SAMPLE_EDGE = 48;
/** Near-black, near-white and grey pixels are canvas, varnish and frame, not colour. */
export const MIN_LIGHTNESS = 8;
export const MAX_LIGHTNESS = 92;
export const MIN_SATURATION = 12;
/** Below this average chroma per pixel the work is effectively achromatic. */
export const MIN_CHROMATIC_SHARE = 0.02;
/** A runner-up bucket is a colour of the work, not a stray pixel, from here up.
 *  Measured over 1,197 works: 0.87 extra colours each, and it lifts the thinnest
 *  hues several-fold without inventing hues the art does not contain. */
export const MIN_PALETTE_SHARE = 0.1;
export const MAX_PALETTE = 2;

const BUCKETS = 24;
const BUCKET_WIDTH = 360 / BUCKETS;
const DEG = Math.PI / 180;

const wrap360 = (h) => ((h % 360) + 360) % 360;
function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [wrap360(h * 60), s * 100, l * 100];
}

function accumulate(data, channels) {
  const weight = new Float64Array(BUCKETS);
  const cos = new Float64Array(BUCKETS);
  const sin = new Float64Array(BUCKETS);
  const sat = new Float64Array(BUCKETS);
  const lig = new Float64Array(BUCKETS);
  let counted = 0;
  let total = 0;
  let ligAll = 0;

  for (let i = 0; i + channels <= data.length; i += channels) {
    total++;
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    ligAll += l; // every pixel, so an achromatic work still has a tone to stand on
    if (l < MIN_LIGHTNESS || l > MAX_LIGHTNESS || s < MIN_SATURATION) continue;
    const w = s / 100; // saturated pixels carry more of the work's colour identity
    const b = Math.round(h / BUCKET_WIDTH) % BUCKETS;
    weight[b] += w;
    cos[b] += w * Math.cos(h * DEG);
    sin[b] += w * Math.sin(h * DEG);
    sat[b] += w * s;
    lig[b] += w * l;
    counted += w;
  }
  return { weight, cos, sin, sat, lig, counted, total, ligAll };
}

/** Circular mean, so a bucket straddling 0 does not average to 180. */
const bucketHue = (acc, b) => wrap360(Math.atan2(acc.sin[b], acc.cos[b]) / DEG);

/**
 * `pct` is the winning bucket's share of the COUNTED colour weight, not of all
 * pixels. The whole index is sorted by it, so read it as "how much of this
 * work's colour sits in this 15-degree slice".
 */
export function dominantColorFromRaw(data, channels) {
  const acc = accumulate(data, channels);
  if (acc.total === 0) return null;

  // Ink, calligraphy, prints and monochrome ceramics: 36% of the Met's works
  // measured 2026-09-14, at saturation p50 0. They have no hue to file under,
  // only a tone, so they are reported as neutral rather than thrown away.
  const neutral = () => {
    const lig = Math.round(acc.ligAll / acc.total);
    return { neutral: true, hue: 0, sat: 0, lig, hex: hslToHex(0, 0, lig), pct: 1, p: [] };
  };
  if (acc.counted / acc.total < MIN_CHROMATIC_SHARE) return neutral();

  let win = 0;
  for (let b = 1; b < BUCKETS; b++) if (acc.weight[b] > acc.weight[win]) win = b;
  if (acc.weight[win] <= 0) return neutral();

  const hue = bucketHue(acc, win);
  const s = acc.sat[win] / acc.weight[win];
  const l = acc.lig[win] / acc.weight[win];

  return {
    neutral: false,
    hue: Math.round(hue) % 360,
    sat: Math.round(s),
    lig: Math.round(l),
    hex: hslToHex(hue, s, l),
    pct: Number((acc.weight[win] / acc.counted).toFixed(4)),
    p: runnersUp(acc, win),
  };
}

/**
 * The colours the work also holds, strongest first, as [hue, sat, lig, share].
 * `hex` is left out and derived at read time: four numbers cost fewer bytes than
 * three plus a string, and the index ships ~6,000 of these.
 */
function runnersUp(acc, win) {
  const out = [];
  for (let b = 0; b < BUCKETS; b++) {
    if (b === win || acc.weight[b] <= 0) continue;
    const share = acc.weight[b] / acc.counted;
    if (share < MIN_PALETTE_SHARE) continue;
    const s = acc.sat[b] / acc.weight[b];
    const l = acc.lig[b] / acc.weight[b];
    out.push([Math.round(bucketHue(acc, b)) % 360, Math.round(s), Math.round(l), Number(share.toFixed(3))]);
  }
  return out.sort((a, b) => b[3] - a[3]).slice(0, MAX_PALETTE);
}

/** Returns { w, h, neutral, hue, sat, lig, hex, pct, p }, or null only when the
 *  image holds no pixels at all. `neutral` works carry a tone and no hue. */
export async function extractDominantColor(buf) {
  const meta = await sharp(buf).metadata();
  const { data, info } = await sharp(buf)
    .resize(SAMPLE_EDGE, SAMPLE_EDGE, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const color = dominantColorFromRaw(data, info.channels);
  if (!color) return null;
  return { w: meta.width ?? info.width, h: meta.height ?? info.height, ...color };
}
