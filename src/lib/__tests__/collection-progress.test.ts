import { describe, expect, it } from 'vitest';
import { COLLECTABLE, collectedBuckets } from '../collection-progress';
import { hueToBucket } from '../color-math';

const saved = (hue: number, sat = 50) => ({ hue, sat });

describe('collectedBuckets', () => {
  it('counts one hue once, however many are saved from it', () => {
    expect(collectedBuckets([saved(30), saved(31), saved(32)]).size).toBe(1);
  });

  it('files a work under the same bucket the wheel would', () => {
    const found = collectedBuckets([saved(210)]);
    expect(found.has(hueToBucket(210))).toBe(true);
  });

  it('keeps the red wrap together, as the wheel does', () => {
    expect(collectedBuckets([saved(358), saved(4)]).size).toBe(1);
  });

  it('will not award red for a monochrome work', () => {
    // They carry hue 0 as a placeholder, not as a colour.
    expect(collectedBuckets([saved(0, 0)]).size).toBe(0);
    expect(collectedBuckets([saved(0, 0), saved(5, 60)]).size).toBe(1);
  });

  it('starts at nothing', () => {
    expect(collectedBuckets([]).size).toBe(0);
    expect(COLLECTABLE).toBe(24);
  });
});
