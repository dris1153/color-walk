import { describe, expect, it } from 'vitest';
import { ERA_ROUNDS, eraRounds, eraScore, eraShareText, positionToYear, yearToPosition } from '../era-game';
import { parseEraResult } from '../era-game-store';
import type { HistoryCell } from '../histories-client';

const cell = (id: string, e: string, y: number): HistoryCell => ({
  h: 14, e, id, t: id, a: '', y, thumb: 'x', hex: '#336699', src: 'met', bucket: 14, page: 0,
});

describe('the timeline slider', () => {
  it('maps position to year and back within an era', () => {
    for (const y of [-2500, -500, 250, 1250, 1650, 1950]) {
      expect(Math.abs(positionToYear(yearToPosition(y)) - y)).toBeLessThanOrEqual(1);
    }
  });

  it('gives every era the same width', () => {
    expect(positionToYear(0)).toBe(-5000);
    expect(positionToYear(8 / 12)).toBe(1600);
    expect(positionToYear(1)).toBeGreaterThan(2000);
  });
});

describe('eraScore', () => {
  it('rewards closeness on a log scale', () => {
    expect(eraScore(1650, 1650)).toBe(100);
    expect(eraScore(1600, 1650)).toBeGreaterThan(45);
    expect(eraScore(1600, 1650)).toBeLessThan(55);
    expect(eraScore(-3000, 1900)).toBe(0);
  });
});

describe('eraRounds', () => {
  const cells = ['early', 'bce', '1', '500', '1000', '1300', '1600', '1900'].flatMap((e, i) => [
    cell(`${e}-a`, e, i * 200 - 800),
    cell(`${e}-b`, e, i * 200 - 790),
  ]);

  it('draws five works from five different eras, the same for everyone on a day', () => {
    const today = eraRounds(cells, '2026-09-26');
    expect(today).toHaveLength(ERA_ROUNDS);
    expect(new Set(today.map((c) => c.e)).size).toBe(ERA_ROUNDS);
    expect(eraRounds(cells, '2026-09-26')).toEqual(today);
    expect(eraRounds(cells, '2026-09-27')).not.toEqual(today);
  });

  it('never draws a work older than the slider reaches', () => {
    const rounds = eraRounds([...cells, cell('hand-axe', 'early', -9998)], '2026-09-26');
    expect(rounds.map((c) => c.id)).not.toContain('hand-axe');
  });
});

describe('share text and stored results', () => {
  it('shows a bar per round, the total and the worst miss', () => {
    const text = eraShareText('2026-09-26', [
      { score: 100, y: 1650, guess: 1650 },
      { score: 0, y: -2000, guess: 1500 },
    ]);
    expect(text).toBe('Color Walk eras 26/09\n█▁ 100/200\nfurthest off: 3,500 years');
  });

  it('drops a stored result that has been tampered with', () => {
    expect(parseEraResult({ day: 'x', rounds: [] })).toBeNull();
    expect(parseEraResult({ day: '2026-09-26', rounds: [{ id: 'a', y: 1, guess: 1, score: 900 }] })!.rounds).toEqual([]);
  });
});
