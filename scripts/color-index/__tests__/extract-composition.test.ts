import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { GRID, compositionFromRaw, extractComposition, hasVariation } from '../extract-composition.mjs';
import { buildComposition } from '../write-composition-file.mjs';

type Cells = ([number, number] | null)[];

const BLUE = { r: 26, g: 128, b: 230 };
const RED = { r: 230, g: 26, b: 26 };
const GREY = { r: 128, g: 128, b: 128 };
const solid = (w: number, h: number, bg: typeof BLUE) =>
  sharp({ create: { width: w, height: h, channels: 3, background: bg } }).png().toBuffer();

async function topOver(top: typeof BLUE, base: typeof BLUE) {
  const band = await solid(300, 100, top);
  return sharp({ create: { width: 300, height: 300, channels: 3, background: base } })
    .composite([{ input: band, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

describe('compositionFromRaw', () => {
  it('reads nine cells and puts each colour where it is', async () => {
    const cells = (await extractComposition(await topOver(BLUE, RED))) as Cells;
    expect(cells).toHaveLength(GRID * GRID);
    for (let i = 0; i < 3; i++) expect(Math.abs(cells[i]![0] - 210)).toBeLessThanOrEqual(4);
    for (let i = 6; i < 9; i++) expect(Math.abs(cells[i]![0] - 0)).toBeLessThanOrEqual(4);
  });

  it('leaves a cell with no colour in it empty rather than inventing one', async () => {
    const cells = await extractComposition(await solid(90, 90, GREY));
    expect(cells.every((c: unknown) => c === null)).toBe(true);
  });

  it('maps the grid onto a tall frame without cropping it', async () => {
    const band = await solid(100, 200, BLUE);
    const tall = await sharp({ create: { width: 100, height: 600, channels: 3, background: RED } })
      .composite([{ input: band, top: 0, left: 0 }])
      .png()
      .toBuffer();
    const cells = (await extractComposition(tall)) as Cells;
    expect(Math.abs(cells[0]![0] - 210)).toBeLessThanOrEqual(4);
    expect(Math.abs(cells[8]![0] - 0)).toBeLessThanOrEqual(4);
  });

  it('works on raw pixels of any size, so a test need not go through sharp', () => {
    const w = 6;
    const h = 6;
    const data = new Uint8ClampedArray(w * h * 3);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 3;
        const c = y < 2 ? BLUE : RED;
        data[i] = c.r;
        data[i + 1] = c.g;
        data[i + 2] = c.b;
      }
    }
    const cells = compositionFromRaw(data, 3, w, h) as Cells;
    expect(cells[1]![0]).toBeCloseTo(210, 0);
    expect(cells[7]![0]).toBeCloseTo(0, 0);
  });
});

describe('hasVariation', () => {
  it('is true when cells disagree by more than a slice of the wheel', () => {
    expect(hasVariation([[210, 50], [0, 50], null])).toBe(true);
  });

  it('is false for one colour everywhere, and for nothing at all', () => {
    expect(hasVariation([[30, 50], [32, 60], [29, 40]])).toBe(false);
    expect(hasVariation([null, null, null])).toBe(false);
  });
});

describe('buildComposition', () => {
  const locate = () => ({ bucket: 2, page: 0 });
  it('keeps only works that vary, with just what a result needs', () => {
    const varied = { id: 'v', t: 'V', thumb: 'x', hex: '#000000', src: 'met', c: [[210, 50], [0, 50]] };
    const flat = { id: 'f', t: 'F', thumb: 'x', hex: '#000000', src: 'met', c: [[30, 50], [31, 50]] };
    const out = buildComposition([varied, flat, { id: 'n', c: null }], locate);
    expect(out.map((e: { id: string }) => e.id)).toEqual(['v']);
    expect(Object.keys(out[0]!).sort()).toEqual(['bucket', 'c', 'hex', 'id', 'page', 'src', 't', 'thumb']);
  });
});
