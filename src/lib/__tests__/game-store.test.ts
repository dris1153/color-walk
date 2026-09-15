import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DAILY_ROUNDS,
  EMPTY_PROGRESS,
  parseProgress,
  readProgress,
  recordDaily,
  recordStreak,
  writeProgress,
} from '../game-store';

const store = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => map.set(k, v),
    removeItem: (k: string) => map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
};

afterEach(() => vi.unstubAllGlobals());

describe('parseProgress - the snapshot is untrusted when it comes back', () => {
  it('reads a sound snapshot', () => {
    const sound = { bestStreak: 7, lastDaily: '2026-09-15', lastMarks: [true, false], dailyStreak: 2, bestDaily: 4 };
    expect(parseProgress(sound)).toEqual(sound);
  });

  it('refuses a hand-edited score', () => {
    expect(parseProgress({ bestStreak: -5 }).bestStreak).toBe(0);
    expect(parseProgress({ bestStreak: 1.5 }).bestStreak).toBe(0);
    expect(parseProgress({ bestStreak: 'lots' }).bestStreak).toBe(0);
    expect(parseProgress({ bestDaily: DAILY_ROUNDS + 1 }).bestDaily).toBe(0);
  });

  it('refuses a date that is not one', () => {
    for (const bad of ['yesterday', '2026-13-45', '15/09/2026', 42, null]) {
      expect(parseProgress({ lastDaily: bad }).lastDaily).toBeNull();
    }
    expect(parseProgress({ lastDaily: '2026-09-15' }).lastDaily).toBe('2026-09-15');
  });

  it('keeps only booleans, and no more marks than there are rounds', () => {
    expect(parseProgress({ lastMarks: [true, 'yes', false, null] }).lastMarks).toEqual([true, false]);
    expect(parseProgress({ lastMarks: Array(50).fill(true) }).lastMarks).toHaveLength(DAILY_ROUNDS);
    expect(parseProgress({ lastMarks: 'ok' }).lastMarks).toEqual([]);
  });

  it('treats junk as no progress rather than throwing', () => {
    for (const junk of [null, 'x', 42, []]) expect(parseProgress(junk)).toEqual(EMPTY_PROGRESS);
  });
});

describe('the store degrades rather than breaking the page', () => {
  it('round-trips through a working store', () => {
    vi.stubGlobal('localStorage', store());
    const progress = { ...EMPTY_PROGRESS, bestStreak: 9 };
    writeProgress(progress);
    expect(readProgress()).toEqual(progress);
  });

  it('reads nothing when site data is blocked', () => {
    vi.stubGlobal('localStorage', {
      get getItem(): never {
        throw new Error('blocked');
      },
    });
    expect(readProgress()).toEqual(EMPTY_PROGRESS);
  });

  it('swallows a full store on write', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    } as unknown as Storage);
    expect(() => writeProgress(EMPTY_PROGRESS)).not.toThrow();
  });
});

describe('recordDaily', () => {
  const marks = [true, true, false, true, true];

  it('keeps the streak when yesterday was played', () => {
    const before = { ...EMPTY_PROGRESS, lastDaily: '2026-09-14', dailyStreak: 3 };
    expect(recordDaily(before, '2026-09-15', marks).dailyStreak).toBe(4);
  });

  it('starts again after a missed day', () => {
    const before = { ...EMPTY_PROGRESS, lastDaily: '2026-09-12', dailyStreak: 9 };
    expect(recordDaily(before, '2026-09-15', marks).dailyStreak).toBe(1);
  });

  it('keeps a streak across the turn of a month', () => {
    const before = { ...EMPTY_PROGRESS, lastDaily: '2026-08-31', dailyStreak: 2 };
    expect(recordDaily(before, '2026-09-01', marks).dailyStreak).toBe(3);
  });

  it('will not let the same day be banked twice', () => {
    const played = recordDaily(EMPTY_PROGRESS, '2026-09-15', marks);
    expect(recordDaily(played, '2026-09-15', [true, true, true, true, true])).toBe(played);
  });

  it('remembers the day\'s best score, not the latest', () => {
    const first = recordDaily(EMPTY_PROGRESS, '2026-09-14', [true, true, true, true, true]);
    const second = recordDaily(first, '2026-09-15', [false, false, false, false, false]);
    expect(second.bestDaily).toBe(5);
  });
});

describe('recordStreak', () => {
  it('only ever climbs', () => {
    const at5 = recordStreak(EMPTY_PROGRESS, 5);
    expect(at5.bestStreak).toBe(5);
    expect(recordStreak(at5, 2)).toBe(at5);
    expect(recordStreak(at5, 8).bestStreak).toBe(8);
  });
});
