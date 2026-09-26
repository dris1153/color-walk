import { ERA_ROUNDS } from './era-game';

const KEY = 'cw:eras';

export type EraRound = { id: string; y: number; guess: number; score: number };
export type EraResult = { day: string; rounds: EraRound[] };

const isRound = (x: unknown): x is EraRound => {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    Number.isInteger(r.y) &&
    Number.isInteger(r.guess) &&
    Number.isInteger(r.score) &&
    (r.score as number) >= 0 &&
    (r.score as number) <= 100
  );
};

/** Read back through a gate: the reader or another tab may have edited it. */
export function parseEraResult(raw: unknown): EraResult | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.day) || !Array.isArray(r.rounds)) return null;
  const rounds = r.rounds.filter(isRound).slice(0, ERA_ROUNDS);
  return { day: r.day, rounds };
}

/** Today's rounds so far, so a reload shows the same result instead of a fresh game. */
export function readEraResult(day: string): EraRound[] {
  try {
    const parsed = parseEraResult(JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null'));
    return parsed?.day === day ? parsed.rounds : [];
  } catch {
    return [];
  }
}

export function writeEraResult(day: string, rounds: readonly EraRound[]): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify({ day, rounds }));
  } catch {
    /* blocked site data: the game still plays, it just does not remember */
  }
}
