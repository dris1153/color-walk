import { describe, expect, it } from 'vitest';
import {
  bucketCenter,
  circularHueDistance,
  hslToHex,
  hueToBucket,
  normalizeHue,
  sortByHueDistance,
} from '../color-math';

describe('circularHueDistance', () => {
  it('measures the short way around the circle', () => {
    expect(circularHueDistance(350, 10)).toBe(20);
    expect(circularHueDistance(10, 350)).toBe(20);
    expect(circularHueDistance(0, 180)).toBe(180);
    expect(circularHueDistance(200, 200)).toBe(0);
  });

  it('wraps out-of-range hues before comparing', () => {
    expect(circularHueDistance(370, 10)).toBe(0);
    expect(circularHueDistance(-10, 350)).toBe(0);
    expect(circularHueDistance(-10, 10)).toBe(20);
  });
});

describe('normalizeHue', () => {
  it('wraps into 0..359', () => {
    expect(normalizeHue(370)).toBe(10);
    expect(normalizeHue(-10)).toBe(350);
    expect(normalizeHue(720)).toBe(0);
    expect(normalizeHue(Number.NaN)).toBe(0);
  });
});

describe('hueToBucket', () => {
  it('keeps the red wrap in bucket 0', () => {
    expect(hueToBucket(358)).toBe(0);
    expect(hueToBucket(7)).toBe(0);
    expect(hueToBucket(8)).toBe(1);
    expect(hueToBucket(210)).toBe(14);
    expect(hueToBucket(359)).toBe(0);
  });

  it('never leaves 0..23', () => {
    for (let h = 0; h < 360; h++) {
      const b = hueToBucket(h);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(24);
    }
  });
});

describe('bucketCenter', () => {
  it('is the bucket index times 15', () => {
    expect(bucketCenter(0)).toBe(0);
    expect(bucketCenter(14)).toBe(210);
    expect(bucketCenter(23)).toBe(345);
  });
});

describe('hslToHex', () => {
  it('converts known colours', () => {
    expect(hslToHex(0, 100, 50)).toBe('#ff0000');
    expect(hslToHex(120, 100, 50)).toBe('#00ff00');
    expect(hslToHex(240, 100, 50)).toBe('#0000ff');
    expect(hslToHex(60, 100, 50)).toBe('#ffff00');
    expect(hslToHex(0, 0, 50)).toBe('#808080');
    // 210/80/50 lands on a .5 rounding boundary, so allow either neighbour.
    expect(['#1980e6', '#1a80e6']).toContain(hslToHex(210, 80, 50));
  });

  it('clamps out-of-range saturation and lightness', () => {
    expect(hslToHex(0, 500, 50)).toBe('#ff0000');
    expect(hslToHex(0, 100, -20)).toBe('#000000');
    expect(hslToHex(0, 100, 200)).toBe('#ffffff');
  });
});

describe('sortByHueDistance', () => {
  const items = [
    { id: 'far', hue: 300, sat: 90 },
    { id: 'near', hue: 215, sat: 90 },
    { id: 'exact', hue: 210, sat: 90 },
  ];

  it('orders by distance to the target hue', () => {
    expect(sortByHueDistance(items, 210).map((i) => i.id)).toEqual(['exact', 'near', 'far']);
  });

  it('penalises washed-out works at the same hue', () => {
    const pair = [
      { id: 'grey', hue: 210, sat: 10 },
      { id: 'vivid', hue: 214, sat: 95 },
    ];
    expect(sortByHueDistance(pair, 210).map((i) => i.id)).toEqual(['vivid', 'grey']);
  });

  it('does not mutate its input', () => {
    const before = items.map((i) => i.id);
    sortByHueDistance(items, 300);
    expect(items.map((i) => i.id)).toEqual(before);
  });
});
