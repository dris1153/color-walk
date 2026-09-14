import { describe, expect, it } from 'vitest';
import { ITEM_FRACTION, packHueRing } from '../hue-ring-layout';

const at = (hue: number) => ({ id: `h${hue}`, hue });
const spread = (n: number) => Array.from({ length: n }, (_, i) => at(Math.round((i * 360) / n)));

describe('packHueRing', () => {
  it('puts a work at its own hue angle, twelve o\'clock being zero', () => {
    const [top] = packHueRing([at(0)]);
    expect(top!.left).toBeCloseTo(50, 5);
    expect(top!.top).toBeLessThan(50);

    const [right] = packHueRing([at(90)]);
    expect(right!.left).toBeGreaterThan(50);
    expect(right!.top).toBeCloseTo(50, 5);
  });

  it('keeps every work on a ring clear of its neighbour', () => {
    const placed = packHueRing(spread(300));
    const byRing = new Map<number, number[]>();
    for (const p of placed) byRing.set(p.ring, [...(byRing.get(p.ring) ?? []), p.item.hue]);
    for (const [ring, hues] of byRing) {
      const radius = [0.45, 0.32, 0.19][ring]!;
      const gap = (ITEM_FRACTION / (2 * Math.PI * radius)) * 360;
      for (let i = 1; i < hues.length; i++) {
        expect(hues[i]! - hues[i - 1]!).toBeGreaterThanOrEqual(gap - 1e-9);
      }
      // And the ring closes: the last must clear the first across 360.
      if (hues.length > 1) expect(hues[0]! + 360 - hues[hues.length - 1]!).toBeGreaterThanOrEqual(gap - 1e-9);
    }
  });

  it('pushes a crowded hue inward rather than dropping or overlapping it', () => {
    const crowded = Array.from({ length: 8 }, (_, i) => at(30 + i));
    const placed = packHueRing(crowded);
    expect(new Set(placed.map((p) => p.ring)).size).toBeGreaterThan(1);
  });

  it('never places more than the cap, whatever the collection holds', () => {
    expect(packHueRing(spread(1000), 40)).toHaveLength(40);
  });

  it('places the same works whatever the screen size, because nothing here is in pixels', () => {
    const a = packHueRing(spread(300)).map((p) => p.item.id);
    const b = packHueRing(spread(300)).map((p) => p.item.id);
    expect(a).toEqual(b);
  });

  it('is unbothered by an empty collection', () => {
    expect(packHueRing([])).toEqual([]);
  });
});
