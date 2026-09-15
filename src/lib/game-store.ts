const KEY = 'cw:progress';
/** Rounds in a day's challenge; the share row is one mark per round. */
export const DAILY_ROUNDS = 5;

export type Progress = {
  /** Free play, "which is darker?". */
  bestStreak: number;
  /** The local date of the last challenge played, as YYYY-MM-DD. */
  lastDaily: string | null;
  /** Which of that day's rounds were right, so a reload shows the same result. */
  lastMarks: readonly boolean[];
  dailyStreak: number;
  bestDaily: number;
};

export const EMPTY_PROGRESS: Progress = {
  bestStreak: 0,
  lastDaily: null,
  lastMarks: [],
  dailyStreak: 0,
  bestDaily: 0,
};

/** Accessing localStorage itself throws when site data is blocked, so guard the lookup too. */
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const whole = (x: unknown, max: number): number =>
  typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= max ? x : 0;

/** `YYYY-MM-DD`, and a real date rather than merely the right shape. */
const isDateStamp = (x: unknown): x is string =>
  typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x));

/**
 * A stored snapshot is untrusted by the time it comes back: the reader, an
 * extension or another tab could have edited it. Anything that fails its check
 * falls back to the empty value rather than reaching the UI.
 */
export function parseProgress(raw: unknown): Progress {
  if (typeof raw !== 'object' || raw === null) return EMPTY_PROGRESS;
  const p = raw as Record<string, unknown>;
  const marks = Array.isArray(p.lastMarks)
    ? p.lastMarks.filter((m) => typeof m === 'boolean').slice(0, DAILY_ROUNDS)
    : [];
  return {
    bestStreak: whole(p.bestStreak, 100_000),
    lastDaily: isDateStamp(p.lastDaily) ? p.lastDaily : null,
    lastMarks: marks,
    dailyStreak: whole(p.dailyStreak, 100_000),
    bestDaily: whole(p.bestDaily, DAILY_ROUNDS),
  };
}

export function readProgress(): Progress {
  const store = storage();
  if (!store) return EMPTY_PROGRESS;
  try {
    return parseProgress(JSON.parse(store.getItem(KEY) ?? 'null'));
  } catch {
    return EMPTY_PROGRESS;
  }
}

/**
 * Silent on failure. A full or blocked store must not break the page: progress
 * still lives in React state, so it simply does not outlive the session.
 */
export function writeProgress(progress: Progress): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(progress));
  } catch {
    /* quota or private mode */
  }
}

/** The day before `stamp`, so a streak knows whether it was kept or broken. */
function dayBefore(stamp: string): string {
  const d = new Date(`${stamp}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Pure, so the streak rules are testable without a store or a clock. */
export function recordDaily(previous: Progress, today: string, marks: readonly boolean[]): Progress {
  if (previous.lastDaily === today) return previous; // a day is played once
  const score = marks.filter(Boolean).length;
  const kept = previous.lastDaily === dayBefore(today);
  const dailyStreak = kept ? previous.dailyStreak + 1 : 1;
  return {
    ...previous,
    lastDaily: today,
    lastMarks: marks.slice(0, DAILY_ROUNDS),
    dailyStreak,
    bestDaily: Math.max(previous.bestDaily, score),
  };
}

export const recordStreak = (previous: Progress, streak: number): Progress =>
  streak > previous.bestStreak ? { ...previous, bestStreak: streak } : previous;
