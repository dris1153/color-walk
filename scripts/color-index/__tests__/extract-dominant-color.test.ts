import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { MAX_PALETTE, MIN_PALETTE_SHARE, extractDominantColor } from '../extract-dominant-color.mjs';

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
  });

  it('ignores near-white pixels entirely', async () => {
    const color = await extractDominantColor(await banded(BLUE, 48, WHITE));
    expect(color).not.toBeNull();
    expect(Math.abs(color!.hue - 210)).toBeLessThanOrEqual(4);
    expect(color!.pct).toBeGreaterThan(0.97);
  });

  it('reports an achromatic image as neutral, keeping the tone it has', async () => {
    // These used to be thrown away. They are 36% of the Met's works, so they
    // now come back with no hue and the one thing they do have: a lightness.
    for (const [bg, tone] of [
      [GREY, 50],
      [WHITE, 100],
      [{ r: 4, g: 4, b: 4 }, 2],
    ] as const) {
      const color = await extractDominantColor(await solid(480, 480, bg));
      expect(color!.neutral).toBe(true);
      expect(color!.sat).toBe(0);
      expect(Math.abs(color!.lig - tone)).toBeLessThanOrEqual(2);
      // A grey is a grey: all three channels equal.
      const [r, g, b] = [1, 3, 5].map((i) => color!.hex.slice(i, i + 2));
      expect(new Set([r, g, b]).size).toBe(1);
    }
  });

  it('still calls a coloured work coloured', async () => {
    const color = await extractDominantColor(await solid(480, 480, BLUE));
    expect(color!.neutral).toBe(false);
    expect(Math.abs(color!.hue - 210)).toBeLessThanOrEqual(4);
  });

  it('reports a full share for a single-hue image', async () => {
    const color = await extractDominantColor(await solid(480, 480, BLUE));
    expect(color!.pct).toBe(1);
    expect(color!.hex).toMatch(/^#[0-9a-f]{6}$/);
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

describe('the colours a work also holds', () => {
  it('reports the runner-up, strongest first, without the winner', async () => {
    const color = await extractDominantColor(await banded(BLUE, 360, RED));
    expect(color!.p).toHaveLength(1);
    const [hue, , , share] = color!.p[0]! as number[];
    expect(Math.abs(hue! - 0)).toBeLessThanOrEqual(4);
    expect(Math.abs(share! - 0.25)).toBeLessThanOrEqual(0.03);
    // The winner is already on the item; repeating it here would be dead bytes.
    expect(color!.p.some(([h]: number[]) => Math.abs(h! - 210) <= 4)).toBe(false);
  });

  it('leaves out a colour too faint to be one', async () => {
    // 24px of 480 is 5%, under the share a colour has to reach.
    const color = await extractDominantColor(await banded(RED, 24, BLUE));
    expect(color!.p).toEqual([]);
  });

  it('keeps at most MAX_PALETTE of them', async () => {
    const top = await solid(480, 160, RED);
    const mid = await solid(480, 160, { r: 230, g: 200, b: 26 });
    const buf = await sharp({ create: { width: 480, height: 480, channels: 3, background: BLUE } })
      .composite([
        { input: top, top: 0, left: 0 },
        { input: mid, top: 160, left: 0 },
      ])
      .png()
      .toBuffer();
    const color = await extractDominantColor(buf);
    expect(color!.p.length).toBeLessThanOrEqual(MAX_PALETTE);
    for (const [, , , share] of color!.p) expect(share).toBeGreaterThanOrEqual(MIN_PALETTE_SHARE);
  });

  it('gives an achromatic work no palette at all, because it has no colour', async () => {
    expect((await extractDominantColor(await solid(64, 64, GREY)))!.p).toEqual([]);
  });
});
