import { describe, expect, it } from 'vitest';
import { pickTiles } from '../write-mosaic-files.mjs';
import { buildHistories } from '../write-histories-file.mjs';
import { rgbToLab } from '../lab.mjs';

describe('rgbToLab', () => {
  it('matches the reference values for white, black and pure red', () => {
    expect(rgbToLab(255, 255, 255).map((v) => Math.round(v) + 0)).toEqual([100, 0, 0]);
    expect(rgbToLab(0, 0, 0).map((v) => Math.round(v) + 0)).toEqual([0, 0, 0]);
    expect(rgbToLab(255, 0, 0).map((v) => Math.round(v) + 0)).toEqual([53, 80, 67]);
  });
});

describe('pickTiles', () => {
  const beige = Array.from({ length: 50 }, (_, i) => ({ id: `beige-${i}`, lab: [60, 5, 20] }));
  const blue = [{ id: 'blue-0', lab: [40, 10, -50] }];

  it('reaches a rare colour before a common one fills the atlas', () => {
    const picked = pickTiles([...beige, ...blue], 2);
    expect(picked.map((p) => p.id)).toContain('blue-0');
  });

  it('is stable across runs and input order', () => {
    const a = pickTiles([...beige, ...blue], 10).map((p) => p.id);
    const b = pickTiles([...blue, ...beige].reverse(), 10).map((p) => p.id);
    expect(a).toEqual(b);
  });

  it('stops when every work is used', () => {
    expect(pickTiles([...beige, ...blue], 1000)).toHaveLength(51);
  });
});

describe('buildHistories', () => {
  const locate = () => ({ bucket: 14, page: 0 });

  it('keeps the work that reads most as its colour, per hue and era', () => {
    const cells = buildHistories(
      [
        { id: 'a', hue: 210, sat: 40, pct: 0.5, y: 1650, t: 'A' },
        { id: 'b', hue: 212, sat: 80, pct: 0.9, y: 1680, t: 'B' },
        { id: 'c', hue: 210, sat: 90, pct: 0.9, y: 1750, t: 'C' },
        { id: 'd', hue: 210, sat: 90, pct: 0.9, t: 'undated' },
      ],
      locate,
    );
    expect(cells.map((c) => [c.h, c.e, c.id])).toEqual([
      [14, '1600', 'b'],
      [14, '1700', 'c'],
    ]);
    expect(cells[0]).toMatchObject({ bucket: 14, page: 0, y: 1680 });
  });
});
