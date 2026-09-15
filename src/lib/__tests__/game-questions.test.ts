import { describe, expect, it } from 'vitest';
import { MIN_TONE_GAP, pickTonePair, pickToneQuestion, toneVerdict } from '../game-questions';
import type { Item } from '../color-index-client';

const work = (id: string, lig: number): Item =>
  ({ id, lig, hue: 30, sat: 50, hex: '#b37a33', pct: 0.5 }) as Item;

/** Walks the pool in order, so a test says exactly which draws happen. */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe('pickTonePair', () => {
  it('never asks a question the reader cannot fairly answer', () => {
    const flat = [work('a', 50), work('b', 51), work('c', 52)];
    expect(pickTonePair(flat, () => 0.5)).toBeNull();
  });

  it('names the darker of the two', () => {
    const pool = [work('dark', 20), work('light', 80)];
    const pair = pickTonePair(pool, sequence(0, 0.9))!;
    expect(pair.darker.id).toBe('dark');
  });

  it('is not fooled by the order they were drawn in', () => {
    const pool = [work('dark', 20), work('light', 80)];
    expect(pickTonePair(pool, sequence(0.9, 0))!.darker.id).toBe('dark');
  });

  it('keeps the gap it promises', () => {
    const pool = Array.from({ length: 40 }, (_, i) => work(`w${i}`, i * 2.5));
    for (let seed = 0; seed < 50; seed++) {
      const pair = pickTonePair(pool, () => ((seed * 37) % 100) / 100);
      if (pair) expect(Math.abs(pair.a.lig - pair.b.lig)).toBeGreaterThanOrEqual(MIN_TONE_GAP);
    }
  });

  it('never pairs a work with itself', () => {
    const pool = [work('only', 50), work('other', 90)];
    const pair = pickTonePair(pool, sequence(0, 0.6));
    if (pair) expect(pair.a.id).not.toBe(pair.b.id);
  });

  it('has nothing to ask about an empty or single-work pool', () => {
    expect(pickTonePair([], () => 0)).toBeNull();
    expect(pickTonePair([work('a', 10)], () => 0)).toBeNull();
  });
});

describe('pickToneQuestion', () => {
  it('draws from the pool', () => {
    const pool = [work('a', 20), work('b', 70)];
    expect(pickToneQuestion(pool, () => 0.9)!.id).toBe('b');
    expect(pickToneQuestion(pool, () => 0)!.id).toBe('a');
  });

  it('never asks about a work the slider cannot reach', () => {
    const pool = [work('tooDark', 5), work('tooLight', 95), work('fair', 50)];
    for (let i = 0; i < 20; i++) {
      expect(pickToneQuestion(pool, () => i / 20)!.id).toBe('fair');
    }
  });

  it('says so rather than asking an unanswerable question', () => {
    expect(pickToneQuestion([work('tooDark', 5), work('tooLight', 95)], () => 0)).toBeNull();
    expect(pickToneQuestion([], () => 0)).toBeNull();
  });
});

describe('toneVerdict', () => {
  it('reads as a verdict, widest band last', () => {
    expect(toneVerdict(0)).toBe('Dead on');
    expect(toneVerdict(4)).toBe('Dead on');
    expect(toneVerdict(9)).toBe('Close');
    expect(toneVerdict(18)).toBe('In the region');
    expect(toneVerdict(40)).toBe('Off');
  });
});
