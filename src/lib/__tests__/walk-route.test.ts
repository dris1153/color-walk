import { describe, expect, it } from 'vitest';
import { ROUGH_STEP, buildWalk, formatWalkTarget, hueDelta, parseWalkTarget } from '../walk-route';
import type { Item } from '../color-index-client';

const work = (id: string, hue: number, lig = 50, sat = 50): Item =>
  ({ id, hue, lig, sat, hex: '#b37a33', pct: 0.5 }) as Item;

/** A work every 10 degrees, so a walk has something to stand on everywhere. */
const evenPool = () => Array.from({ length: 36 }, (_, i) => work(`w${i * 10}`, i * 10));

describe('hueDelta', () => {
  it('picks one consistent way round when both are equally short', () => {
    // Exact opposites have no shorter way; the walk must still be repeatable,
    // or the same shared link would give two different journeys.
    expect(hueDelta(30, 210)).toBe(-180);
    expect(hueDelta(30, 210)).toBe(hueDelta(30, 210));
  });

  it('takes the shorter way round', () => {
    expect(hueDelta(10, 50)).toBe(40);
    expect(hueDelta(350, 10)).toBe(20);
    expect(hueDelta(10, 350)).toBe(-20);
    expect(hueDelta(0, 200)).toBe(-160);
  });
});

describe('buildWalk', () => {
  it('walks the requested number of steps, never repeating a work', () => {
    const walk = buildWalk(evenPool(), { hue: 0, tone: 50 }, { hue: 180, tone: 50 }, 10);
    expect(walk).toHaveLength(10);
    expect(new Set(walk.map((s) => s.item.id)).size).toBe(10);
  });

  it('starts where it was asked to and ends where it was sent', () => {
    const walk = buildWalk(evenPool(), { hue: 0, tone: 20 }, { hue: 90, tone: 80 }, 10);
    expect(walk[0]!.hue).toBe(0);
    expect(walk[0]!.tone).toBe(20);
    expect(walk[walk.length - 1]!.hue).toBe(90);
    expect(walk[walk.length - 1]!.tone).toBe(80);
  });

  it('crosses zero the short way rather than round the houses', () => {
    const hues = buildWalk(evenPool(), { hue: 350, tone: 50 }, { hue: 10, tone: 50 }, 5).map((s) => s.hue);
    expect(hues.every((h) => h >= 340 || h <= 20)).toBe(true);
  });

  it('reports a large gap where the collection has nothing, instead of hiding it', () => {
    // Everything is warm; a walk to 180 has to stand somewhere far from its path.
    const warm = [work('a', 10), work('b', 20), work('c', 30), work('d', 40)];
    const walk = buildWalk(warm, { hue: 0, tone: 50 }, { hue: 180, tone: 50 }, 4);
    expect(Math.max(...walk.map((s) => s.gap))).toBeGreaterThan(ROUGH_STEP);
  });

  it('leaves the monochrome works out, because they answer for every hue', () => {
    const pool = [work('grey', 0, 50, 0), work('red', 5)];
    const walk = buildWalk(pool, { hue: 0, tone: 50 }, { hue: 30, tone: 50 }, 2);
    expect(walk.map((s) => s.item.id)).toEqual(['red']);
  });

  it('stops when the pool runs out rather than repeating itself', () => {
    expect(buildWalk([work('one', 10)], { hue: 0, tone: 50 }, { hue: 90, tone: 50 }, 5)).toHaveLength(1);
    expect(buildWalk([], { hue: 0, tone: 50 }, { hue: 90, tone: 50 })).toEqual([]);
  });
});

describe('the walk in the URL', () => {
  it('round-trips', () => {
    expect(parseWalkTarget(`#h=30&l=50&${formatWalkTarget({ hue: 210, tone: 45 })}`)).toEqual({
      hue: 210,
      tone: 45,
    });
  });

  it('is absent when nobody asked for a walk', () => {
    expect(parseWalkTarget('#h=30&l=50')).toBeNull();
    expect(parseWalkTarget('')).toBeNull();
  });

  it('treats junk as no walk rather than walking somewhere arbitrary', () => {
    for (const hash of ['#walk=abc', '#walk=210', '#walk=', '#walk=1,2,3']) {
      expect(parseWalkTarget(hash)).toBeNull();
    }
  });

  it('brings a wild target back into range', () => {
    expect(parseWalkTarget('#walk=400,150')).toEqual({ hue: 40, tone: 100 });
  });
});
