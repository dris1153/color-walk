import { describe, expect, it } from 'vitest';
import { ALL_LIMIT, buildAll, buildBuckets, hueToBucket } from '../write-bucket-files.mjs';

const item = (hue: number, pct: number) => ({ id: `x-${hue}-${pct}`, hue, pct });

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
  it('takes the strongest works across every bucket, pct descending', () => {
    const items = Array.from({ length: 500 }, (_, i) => item(i % 360, i / 1000));
    const all = buildAll(items);
    expect(all.count).toBe(ALL_LIMIT);
    expect(all.items).toHaveLength(ALL_LIMIT);
    const pcts = all.items.map((i: { pct: number }) => i.pct);
    expect(pcts).toEqual([...pcts].sort((x, y) => y - x));
    expect(pcts[0]!).toBeCloseTo(0.499);
  });

  it('returns everything when there are fewer than the limit', () => {
    const all = buildAll([item(10, 0.1), item(20, 0.9)]);
    expect(all.count).toBe(2);
    expect(all.items[0]!.pct).toBe(0.9);
  });

  it('does not mutate its input order', () => {
    const items = [item(10, 0.1), item(20, 0.9)];
    buildAll(items);
    expect(items[0]!.pct).toBe(0.1);
  });
});
