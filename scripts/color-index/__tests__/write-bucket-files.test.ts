import { describe, expect, it } from 'vitest';
import { ALL_LIMIT, buildAll, buildBuckets, hueToBucket } from '../write-bucket-files.mjs';

const item = (hue: number, pct: number, sat = 50) => ({ id: `x-${hue}-${pct}-${sat}`, hue, pct, sat });

describe('hueToBucket', () => {
  it('keeps the red wrap together in bucket 0', () => {
    expect(hueToBucket(358)).toBe(0);
    expect(hueToBucket(7)).toBe(0);
    expect(hueToBucket(8)).toBe(1);
    expect(hueToBucket(352.5)).toBe(0);
  });

  it('agrees with the runtime bucket for every whole hue', () => {
    for (let h = 0; h < 360; h++) {
      expect(hueToBucket(h)).toBe(Math.round(h / 15) % 24);
    }
  });
});

describe('buildBuckets', () => {
  const buckets = buildBuckets([
    item(358, 0.4),
    item(7, 0.9),
    item(8, 0.5),
    item(210, 0.2),
    item(210, 0.8),
  ]);

  it('produces 24 buckets with correct centres', () => {
    expect(buckets).toHaveLength(24);
    expect(buckets[0]!.center).toBe(0);
    expect(buckets[14]!.center).toBe(210);
  });

  it('routes items by hue', () => {
    expect(buckets[0]!.count).toBe(2);
    expect(buckets[1]!.count).toBe(1);
    expect(buckets[14]!.count).toBe(2);
    expect(buckets[5]!.count).toBe(0);
  });

  it('sorts every bucket by pct descending', () => {
    for (const b of buckets) {
      const pcts = b.items.map((i: { pct: number }) => i.pct);
      expect(pcts).toEqual([...pcts].sort((x, y) => y - x));
    }
  });
});

describe('buildAll', () => {
  it('covers every occupied bucket instead of crowding into one', () => {
    // 1,000 works in bucket 2 against 10 each elsewhere: the shape that made the
    // old top-by-pct landing view 299/300 orange.
    const items = [
      ...Array.from({ length: 1000 }, (_, i) => item(30, 0.99, i % 100)),
      ...Array.from({ length: 5 }, (_, b) => Array.from({ length: 10 }, (_, i) => item(60 + b * 30, 0.5, i))).flat(),
    ];
    const all = buildAll(buildBuckets(items));
    expect(all.count).toBe(ALL_LIMIT);
    const buckets = new Set(all.items.map((i: { hue: number }) => hueToBucket(i.hue)));
    expect(buckets.size).toBe(6);
  });

  it('lets a thin bucket give what it has and passes the rest on', () => {
    const items = [...Array.from({ length: 400 }, (_, i) => item(30, 0.9, i % 90)), item(200, 0.9, 40)];
    const all = buildAll(buildBuckets(items));
    expect(all.count).toBe(ALL_LIMIT);
    // The lone cold work is in, and the warm bucket covers the shortfall.
    expect(all.items.filter((i: { hue: number }) => i.hue === 200)).toHaveLength(1);
  });

  it('prefers the most saturated work of each bucket', () => {
    const items = [item(30, 0.1, 90), item(30, 0.99, 10)];
    const all = buildAll(buildBuckets(items));
    expect(all.items[0]!.sat).toBe(90);
  });

  it('orders the result by hue, so the grid reads as a walk round the wheel', () => {
    const items = [item(300, 0.5), item(10, 0.5), item(150, 0.5)];
    const hues = buildAll(buildBuckets(items)).items.map((i: { hue: number }) => i.hue);
    expect(hues).toEqual([10, 150, 300]);
  });

  it('returns everything when there are fewer than the limit', () => {
    const all = buildAll(buildBuckets([item(10, 0.1), item(20, 0.9)]));
    expect(all.count).toBe(2);
  });

  it('does not reorder the bucket items it was handed', () => {
    const buckets = buildBuckets([item(10, 0.1, 90), item(10, 0.9, 10)]);
    buildAll(buckets);
    expect(buckets[1]!.items.map((i: { pct: number }) => i.pct)).toEqual([0.9, 0.1]);
  });
});

describe('a work filed under every colour it holds', () => {
  const withPalette = (hue: number, pct: number, p: number[][]) => ({
    id: `w-${hue}-${pct}`,
    hue,
    sat: 50,
    lig: 50,
    hex: '#000000',
    pct,
    p,
  });

  it('appears in the bucket of each of its colours', () => {
    const buckets = buildBuckets([withPalette(30, 0.6, [[210, 60, 45, 0.28]])]);
    expect(buckets[hueToBucket(30)]!.count).toBe(1);
    expect(buckets[hueToBucket(210)]!.count).toBe(1);
  });

  it('wears the colour of the bucket it is filed under', () => {
    const buckets = buildBuckets([withPalette(30, 0.6, [[210, 60, 45, 0.28]])]);
    const copy = buckets[hueToBucket(210)]!.items[0]! as Record<string, unknown>;
    expect(copy.hue).toBe(210);
    expect(copy.lig).toBe(45);
    expect(copy.pct).toBe(0.28);
    // Derived, not the original's, or the blue hue would show an ochre swatch.
    expect(copy.hex).not.toBe('#000000');
  });

  it('lists its other colours from where it now stands', () => {
    const buckets = buildBuckets([withPalette(30, 0.6, [[210, 60, 45, 0.28]])]);
    const copy = buckets[hueToBucket(210)]!.items[0]! as Record<string, unknown>;
    expect(copy.p).toEqual([[30, 50, 50, 0.6]]);
  });

  it('is filed once when two of its colours share a slice', () => {
    // 30 and 32 are the same 15-degree bucket.
    const buckets = buildBuckets([withPalette(30, 0.6, [[32, 60, 45, 0.28]])]);
    expect(buckets[hueToBucket(30)]!.count).toBe(1);
    expect(buckets.reduce((n, b) => n + b.count, 0)).toBe(1);
  });

  it('leaves a work with no other colours exactly where it was', () => {
    const buckets = buildBuckets([withPalette(30, 0.6, [])]);
    expect(buckets.reduce((n, b) => n + b.count, 0)).toBe(1);
  });
});
