import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { extractDominantColor } from '../extract-dominant-color.mjs';

const BLUE = { r: 26, g: 128, b: 230 }; // hsl(210 80% 50%)
const RED = { r: 230, g: 26, b: 26 }; // hsl(0 80% 50%)
const WHITE = { r: 255, g: 255, b: 255 };
const GREY = { r: 128, g: 128, b: 128 };

const solid = (width: number, height: number, background: typeof BLUE) =>
  sharp({ create: { width, height, channels: 3, background } }).png().toBuffer();

/** Bands are exact tenths of a 480px edge, so the 48px sample has no blend rows. */
async function banded(topColor: typeof BLUE, topHeight: number, base: typeof BLUE) {
  const top = await solid(480, topHeight, topColor);
  return sharp({ create: { width: 480, height: 480, channels: 3, background: base } })
    .composite([{ input: top, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

describe('extractDominantColor', () => {
  it('reports the majority hue and its share', async () => {
    const color = await extractDominantColor(await banded(BLUE, 360, RED));
    expect(color).not.toBeNull();
    expect(Math.abs(color!.hue - 210)).toBeLessThanOrEqual(4);
    expect(Math.abs(color!.pct - 0.75)).toBeLessThanOrEqual(0.03);
    expect(color!.w).toBe(480);
    expect(color!.h).toBe(480);
    expect(color!.hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(color!.pal).toHaveLength(4);
  });

  it('ignores near-white pixels entirely', async () => {
    const color = await extractDominantColor(await banded(BLUE, 48, WHITE));
    expect(color).not.toBeNull();
    expect(Math.abs(color!.hue - 210)).toBeLessThanOrEqual(4);
    expect(color!.pct).toBeGreaterThan(0.97);
  });

  it('returns null for an achromatic image', async () => {
    expect(await extractDominantColor(await solid(480, 480, GREY))).toBeNull();
    expect(await extractDominantColor(await solid(480, 480, WHITE))).toBeNull();
    expect(await extractDominantColor(await solid(480, 480, { r: 4, g: 4, b: 4 }))).toBeNull();
  });

  it('pads the palette when only one hue is present', async () => {
    const color = await extractDominantColor(await solid(480, 480, BLUE));
    expect(color!.pal).toEqual([color!.hex, color!.hex, color!.hex, color!.hex]);
    expect(color!.pct).toBe(1);
  });

  it('keeps sat and lig inside 0..100 and hue inside 0..359', async () => {
    const color = await extractDominantColor(await banded(RED, 240, BLUE));
    expect(color!.hue).toBeGreaterThanOrEqual(0);
    expect(color!.hue).toBeLessThan(360);
    expect(color!.sat).toBeGreaterThanOrEqual(0);
    expect(color!.sat).toBeLessThanOrEqual(100);
    expect(color!.lig).toBeGreaterThanOrEqual(0);
    expect(color!.lig).toBeLessThanOrEqual(100);
  });
});
