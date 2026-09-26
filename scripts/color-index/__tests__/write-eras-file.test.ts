import { describe, expect, it } from 'vitest';
import { buildEras, eraOf } from '../write-eras-file.mjs';

describe('eraOf', () => {
  it('places a year in its era, the ends included where they belong', () => {
    expect(eraOf(1650)).toBe('1600');
    expect(eraOf(1600)).toBe('1600');
    expect(eraOf(1699)).toBe('1600');
    expect(eraOf(0)).toBe('bce');
    expect(eraOf(-2500)).toBe('early');
    expect(eraOf(1250)).toBe('1000');
  });
});

describe('buildEras', () => {
  it('counts each work once, by the colour it leads with, and greys apart', () => {
    const { eras, undated } = buildEras(
      [
        { hue: 210, y: 1650 },
        { hue: 30, y: 1690 },
        { hue: 30 }, // undated
      ],
      [{ hue: 0, y: 1620 }],
    );
    const row = eras.find((e) => e.id === '1600')!;
    expect(row.n).toBe(3);
    expect(row.g).toBe(1);
    expect(row.h[14]).toBe(1);
    expect(row.h[2]).toBe(1);
    expect(row.h.reduce((a: number, b: number) => a + b, 0) + row.g).toBe(row.n);
    expect(undated).toBe(1);
    expect(eras).toHaveLength(12);
  });
});
