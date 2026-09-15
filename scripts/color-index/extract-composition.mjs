import sharp from 'sharp';
import { MAX_LIGHTNESS, MIN_LIGHTNESS, MIN_SATURATION, rgbToHsl } from './extract-dominant-color.mjs';

/**
 * Where the colour sits, not only what it is: a 3x3 map of the frame, one
 * (hue, lightness) per cell. Measured 2026-09-15 over 1,200 works: 33% vary by
 * more than 30 degrees across cells, 11% have a top unlike their bottom. Only
 * works that vary are worth keeping - a vase on a white ground has one colour
 * everywhere and can match no arrangement a reader paints.
 */
export const GRID = 3;
export const SAMPLE_EDGE = 48;
export const MIN_VARIATION = 30;
const DEG = Math.PI / 180;
const wrap360 = (h) => ((h % 360) + 360) % 360;

const hueDistance = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** Nine cells of [hue, lightness], or null where a cell holds no colour. */
export function compositionFromRaw(data, channels, width, height) {
  const cells = Array.from({ length: GRID * GRID }, () => ({ cos: 0, sin: 0, lig: 0, w: 0 }));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
      if (l < MIN_LIGHTNESS || l > MAX_LIGHTNESS || s < MIN_SATURATION) continue;
      const cell = cells[Math.floor((y * GRID) / height) * GRID + Math.floor((x * GRID) / width)];
      const w = s / 100;
      cell.cos += w * Math.cos(h * DEG);
      cell.sin += w * Math.sin(h * DEG);
      cell.lig += w * l;
      cell.w += w;
    }
  }
  const pixelsPerCell = (width * height) / (GRID * GRID);
  return cells.map((c) =>
    // Under 2% of a cell's pixels carrying colour is a stray, not a colour.
    c.w / pixelsPerCell < 0.02
      ? null
      : [Math.round(wrap360(Math.atan2(c.sin, c.cos) / DEG)) % 360, Math.round(c.lig / c.w)],
  );
}

/** Whether the map says anything a single dominant colour does not. */
export function hasVariation(cells) {
  const hues = cells.filter(Boolean).map((c) => c[0]);
  for (const a of hues) for (const b of hues) if (hueDistance(a, b) > MIN_VARIATION) return true;
  return false;
}

/** Resized to fill, not to fit: the grid must map onto the whole frame whatever its shape. */
export async function extractComposition(buf) {
  const { data, info } = await sharp(buf)
    .resize(SAMPLE_EDGE, SAMPLE_EDGE, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return compositionFromRaw(data, info.channels, info.width, info.height);
}
