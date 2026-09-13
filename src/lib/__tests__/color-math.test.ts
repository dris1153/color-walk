import { describe, expect, it } from 'vitest';
import {
  bucketCenter,
  circularHueDistance,
  hslToHex,
  hueToBucket,
  normalizeHue,
  sortByColorDistance,
  TONE_WEIGHT,
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

describe('sortByColorDistance', () => {
  const items = [
    { id: 'far', hue: 300, sat: 90, lig: 50 },
    { id: 'near', hue: 215, sat: 90, lig: 50 },
    { id: 'exact', hue: 210, sat: 90, lig: 50 },
  ];

  it('orders by distance to the target hue', () => {
    expect(sortByColorDistance(items, 210, null).map((i) => i.id)).toEqual([
      'exact',
      'near',
      'far',
    ]);
  });

  it('penalises washed-out works at the same hue', () => {
    const pair = [
      { id: 'grey', hue: 210, sat: 10, lig: 50 },
      { id: 'vivid', hue: 214, sat: 95, lig: 50 },
    ];
    expect(sortByColorDistance(pair, 210, null).map((i) => i.id)).toEqual(['vivid', 'grey']);
  });

  it('ignores lightness entirely when no tone is chosen', () => {
    const pair = [
      { id: 'dark', hue: 210, sat: 90, lig: 10 },
      { id: 'light', hue: 210, sat: 90, lig: 90 },
    ];
    expect(sortByColorDistance(pair, 210, null).map((i) => i.id)).toEqual(['dark', 'light']);
    expect(sortByColorDistance(pair, 210, 95).map((i) => i.id)).toEqual(['light', 'dark']);
  });

  it('lets a closer tone outrank a closer hue once the gap is wide enough', () => {
    const pair = [
      { id: 'hue-match', hue: 210, sat: 90, lig: 10 },
      { id: 'tone-match', hue: 225, sat: 90, lig: 80 },
    ];
    // hue-match: 0 + 1.5 + 70*0.5 = 36.5 | tone-match: 15 + 1.5 + 0 = 16.5
    expect(sortByColorDistance(pair, 210, 80).map((i) => i.id)).toEqual([
      'tone-match',
      'hue-match',
    ]);
  });

  it('weighs a lightness point at the documented fraction of a hue degree', () => {
    expect(TONE_WEIGHT).toBe(0.5);
    const pair = [
      { id: 'a', hue: 200, sat: 50, lig: 50 }, // 10 hue away, tone exact
      { id: 'b', hue: 210, sat: 50, lig: 29 }, // hue exact, 21 lightness away
    ];
    // a: 10 + 7.5 + 0 = 17.5 | b: 0 + 7.5 + 21*0.5 = 18
    expect(sortByColorDistance(pair, 210, 50).map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('orders by tone alone when there is no hue preference', () => {
    const spread = [
      { id: 'light-red', hue: 5, sat: 80, lig: 85 },
      { id: 'dark-blue', hue: 220, sat: 80, lig: 15 },
      { id: 'mid-green', hue: 130, sat: 80, lig: 50 },
    ];
    expect(sortByColorDistance(spread, null, 15).map((i) => i.id)).toEqual([
      'dark-blue',
      'mid-green',
      'light-red',
    ]);
    expect(sortByColorDistance(spread, null, 85).map((i) => i.id)).toEqual([
      'light-red',
      'mid-green',
      'dark-blue',
    ]);
  });

  it('does not mutate its input', () => {
    const before = items.map((i) => i.id);
    sortByColorDistance(items, 300, 20);
    expect(items.map((i) => i.id)).toEqual(before);
  });
});
