import { pickTonePair, type TonePair } from './game-questions';
import { DAILY_ROUNDS } from './game-store';
import type { Item } from './color-index-client';

/**
 * The same five rounds for everyone, drawn from the date alone. A static site
 * cannot hand out a puzzle from a server, and it does not need to: the seed is
 * the day, so two browsers agree without ever talking to each other.
 */

/** Local, not UTC: the reader gets the puzzle for the day they are having. */
export function todayStamp(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** mulberry32: small, fast and identical everywhere, which is the whole point. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFor(stamp: string): number {
  let hash = 2166136261;
  for (let i = 0; i < stamp.length; i++) {
    hash ^= stamp.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Fewer than DAILY_ROUNDS only when the pool cannot make a fair question. */
export function dailyRounds(pool: readonly Item[], stamp: string): TonePair[] {
  const random = seededRandom(seedFor(stamp));
  const rounds: TonePair[] = [];
  for (let i = 0; i < DAILY_ROUNDS; i++) {
    const pair = pickTonePair(pool, random);
    if (!pair) break;
    rounds.push(pair);
  }
  return rounds;
}

const RIGHT = '\u25a0';
const WRONG = '\u25a1';

/**
 * Plain text and deliberately no link: a result someone pastes should be about
 * the day, not an advert. Filled and hollow squares rather than coloured emoji,
 * which is the same austerity the rest of the interface keeps.
 */
export function shareText(stamp: string, marks: readonly boolean[], dailyStreak: number): string {
  const [, month, day] = stamp.split('-');
  const row = marks.map((m) => (m ? RIGHT : WRONG)).join('');
  const score = marks.filter(Boolean).length;
  const streak = dailyStreak > 1 ? `\nstreak ${dailyStreak}` : '';
  return `Color Walk ${day}/${month}\n${row} ${score}/${marks.length}${streak}`;
}
