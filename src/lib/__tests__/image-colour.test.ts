import { describe, expect, it } from 'vitest';
import { dominantColorFromPixels } from '../image-colour';
// The build's own extractor. Importing it here is the point of this file: the
// arithmetic exists twice because a .mjs build script cannot import .ts, and
// nothing but a test stops the two copies from drifting apart.
import { dominantColorFromRaw } from '../../../scripts/color-index/extract-dominant-color.mjs';

/** Flat RGB, the shape sharp hands the build extractor. */
const flat = (rgb: [number, number, number], pixels = 256): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(pixels * 3);
  for (let i = 0; i < pixels; i++) out.set(rgb, i * 3);
  return out;
};

const mix = (a: [number, number, number], b: [number, number, number], share: number) => {
  const total = 256;
  const out = new Uint8ClampedArray(total * 3);
  for (let i = 0; i < total; i++) out.set(i < total * share ? a : b, i * 3);
  return out;
};

describe('the browser extractor agrees with the build extractor', () => {
  const cases: Array<[string, Uint8ClampedArray]> = [
    ['pure red', flat([220, 20, 20])],
    ['slate blue', flat([74, 107, 138])],
    ['ochre', flat([188, 166, 135])],
    ['red over blue, 70/30', mix([220, 20, 20], [40, 60, 200], 0.7)],
    ['blue over red, 70/30', mix([40, 60, 200], [220, 20, 20], 0.7)],
    ['red straddling hue 0', mix([200, 30, 60], [200, 60, 30], 0.5)],
  ];

  for (const [name, pixels] of cases) {
    it(name, () => {
      const mine = dominantColorFromPixels(pixels, 3);
      const build = dominantColorFromRaw(pixels, 3) as {
        hue: number;
        sat: number;
        lig: number;
      } | null;
      expect(mine).not.toBeNull();
      expect(mine).toEqual({ hue: build!.hue, sat: build!.sat, lig: build!.lig });
    });
  }
});

describe('dominantColorFromPixels', () => {
  it('reads a picture with no colour in it as nothing to walk to', () => {
    expect(dominantColorFromPixels(flat([128, 128, 128]), 3)).toBeNull();
    expect(dominantColorFromPixels(flat([0, 0, 0]), 3)).toBeNull();
    expect(dominantColorFromPixels(flat([255, 255, 255]), 3)).toBeNull();
  });

  it('reads an empty buffer as nothing rather than throwing', () => {
    expect(dominantColorFromPixels(new Uint8ClampedArray(0), 3)).toBeNull();
  });

  it('takes RGBA from a canvas, ignoring the alpha channel', () => {
    const rgba = new Uint8ClampedArray(256 * 4);
    for (let i = 0; i < 256; i++) rgba.set([220, 20, 20, 255], i * 4);
    expect(dominantColorFromPixels(rgba)).toEqual(dominantColorFromPixels(flat([220, 20, 20]), 3));
  });
});
