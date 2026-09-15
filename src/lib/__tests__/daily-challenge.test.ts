import { describe, expect, it } from 'vitest';
import { dailyRounds, seedFor, seededRandom, shareText, todayStamp } from '../daily-challenge';
import { MIN_TONE_GAP } from '../game-questions';
import { DAILY_ROUNDS } from '../game-store';
import type { Item } from '../color-index-client';

const work = (id: string, lig: number): Item =>
  ({ id, lig, hue: 30, sat: 50, hex: '#b37a33', pct: 0.5 }) as Item;
const pool = Array.from({ length: 60 }, (_, i) => work(`w${i}`, (i % 20) * 5));

describe('todayStamp', () => {
  it('reads the local day, not the UTC one', () => {
    // 23:30 local on the 15th is already the 16th in UTC; the reader is having
    // the 15th, so that is the puzzle they should get.
    const late = new Date(2026, 8, 15, 23, 30);
    expect(todayStamp(late)).toBe('2026-09-15');
  });

  it('pads a single-digit month and day', () => {
    expect(todayStamp(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('the day is the seed', () => {
  it('gives two browsers the same five rounds', () => {
    const a = dailyRounds(pool, '2026-09-15').map((r) => `${r.a.id}/${r.b.id}`);
    const b = dailyRounds(pool, '2026-09-15').map((r) => `${r.a.id}/${r.b.id}`);
    expect(a).toEqual(b);
    expect(a).toHaveLength(DAILY_ROUNDS);
  });

  it('gives a different day a different puzzle', () => {
    const today = dailyRounds(pool, '2026-09-15').map((r) => r.a.id).join();
    const tomorrow = dailyRounds(pool, '2026-09-16').map((r) => r.a.id).join();
    expect(today).not.toBe(tomorrow);
  });

  it('keeps every round fair', () => {
    for (const stamp of ['2026-01-01', '2026-06-30', '2026-12-31']) {
      for (const round of dailyRounds(pool, stamp)) {
        expect(Math.abs(round.a.lig - round.b.lig)).toBeGreaterThanOrEqual(MIN_TONE_GAP);
      }
    }
  });

  it('asks nothing rather than something unfair when the pool is flat', () => {
    expect(dailyRounds([work('a', 50), work('b', 51)], '2026-09-15')).toEqual([]);
  });

  it('hashes a date to a stable seed', () => {
    expect(seedFor('2026-09-15')).toBe(seedFor('2026-09-15'));
    expect(seedFor('2026-09-15')).not.toBe(seedFor('2026-09-16'));
  });

  it('produces numbers in range', () => {
    const random = seededRandom(1);
    for (let i = 0; i < 200; i++) {
      const n = random();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe('shareText', () => {
  it('reads as a result and carries no link', () => {
    const text = shareText('2026-09-15', [true, true, false, true, true], 3);
    expect(text).toBe('Color Walk 15/09\n\u25a0\u25a0\u25a1\u25a0\u25a0 4/5\nstreak 3');
    // A URL, not any slash: the date itself is written 15/09.
    expect(text).not.toMatch(/https?:|www\.|\.(com|org|app|dev)/);
  });

  it('leaves out a streak of one, which is not yet a streak', () => {
    expect(shareText('2026-09-15', [true], 1)).toBe('Color Walk 15/09\n\u25a0 1/1');
  });
});
