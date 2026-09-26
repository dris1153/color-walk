import { describe, expect, it } from 'vitest';
import { rgbToLab } from '../lab';
import { MOSAIC_COLS, gridRows, matchCells } from '../mosaic-match';

describe('rgbToLab', () => {
  it('agrees with the build script on reference colours', () => {
    expect(rgbToLab(255, 0, 0).map((v) => Math.round(v))).toEqual([53, 80, 67]);
    expect(rgbToLab(255, 255, 255).map((v) => Math.round(v) + 0)).toEqual([100, 0, 0]);
  });
});

describe('gridRows', () => {
  it('keeps the picture shape at a fixed column count, within bounds', () => {
    expect(gridRows(640, 480)).toBe(48);
    expect(gridRows(100, 10_000)).toBe(96);
    expect(gridRows(10_000, 100)).toBe(16);
    expect(MOSAIC_COLS).toBe(64);
  });
});

describe('matchCells', () => {
  const red = rgbToLab(200, 30, 30);
  const blue = rgbToLab(30, 30, 200);
  const nearRed = rgbToLab(190, 40, 40);

  it('picks the nearest tile for each cell', () => {
    expect(matchCells([red, blue], [blue, nearRed])).toEqual([1, 0]);
  });

  it('spreads a flat area over similar tiles instead of repeating one', () => {
    const cells = Array.from({ length: 6 }, () => red);
    const picks = matchCells(cells, [nearRed, rgbToLab(185, 45, 45), blue], 4);
    expect(new Set(picks).size).toBe(2);
    expect(picks).not.toContain(2);
  });

  it('without a penalty, repeats the single best tile', () => {
    expect(new Set(matchCells([red, red, red], [nearRed, blue], 0))).toEqual(new Set([0]));
  });
});
