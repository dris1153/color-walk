import { ERAS } from './facets';
import { seededRandom, seedFor } from './daily-challenge';
import type { HistoryCell } from './histories-client';

export const ERA_ROUNDS = 5;
/** The slider starts here: the oldest era runs back to 100,000 BCE on paper. */
const EARLIEST = -5000;
const LATEST = 2025;
/** A guess this many years out scores nothing. */
const ZERO_AT = 3000;

/** Each era an equal slice of the slider, linear inside it, so 5,000 years of
 *  antiquity do not crowd the last five centuries into a sliver. */
const slices = ERAS.map((e) => ({ from: Math.max(e.from, EARLIEST), to: Math.min(e.to, LATEST) }));

export function positionToYear(p: number): number {
  const x = Math.min(0.999999, Math.max(0, p)) * slices.length;
  const s = slices[Math.floor(x)]!;
  return Math.round(s.from + (x - Math.floor(x)) * (s.to - s.from));
}

export function yearToPosition(y: number): number {
  const i = slices.findIndex((s) => y < s.to);
  const at = i < 0 ? slices.length - 1 : i;
  const s = slices[at]!;
  return (at + Math.min(1, Math.max(0, (y - s.from) / (s.to - s.from)))) / slices.length;
}

/** 100 for the right year, about 50 at fifty years out, nothing past 3,000. */
export function eraScore(guess: number, actual: number): number {
  const off = Math.abs(guess - actual);
  return Math.round(100 * Math.max(0, 1 - Math.log10(1 + off) / Math.log10(1 + ZERO_AT)));
}

/** Five works from five different eras, the same for everyone on a given day. */
export function eraRounds(cells: readonly HistoryCell[], stamp: string): HistoryCell[] {
  const random = seededRandom(seedFor(`eras:${stamp}`));
  const byEra = new Map<string, HistoryCell[]>();
  for (const c of cells) {
    if (c.y < EARLIEST) continue; // off the slider's scale, so unguessable
    if (!byEra.has(c.e)) byEra.set(c.e, []);
    byEra.get(c.e)!.push(c);
  }
  const eras = [...byEra.keys()].sort();
  for (let i = eras.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [eras[i], eras[j]] = [eras[j]!, eras[i]!];
  }
  return eras.slice(0, ERA_ROUNDS).map((e) => {
    const list = byEra.get(e)!.slice().sort((a, b) => a.id.localeCompare(b.id));
    return list[Math.floor(random() * list.length)]!;
  });
}

/** Plain text, like the daily challenge: a bar per round, filled by score. */
export function eraShareText(stamp: string, rounds: readonly { score: number; y: number; guess: number }[]): string {
  const [, month, day] = stamp.split('-');
  const bars = rounds.map((r) => '▁▂▃▄▅▆▇█'[Math.min(7, Math.floor(r.score / 12.5))]).join('');
  const total = rounds.reduce((sum, r) => sum + r.score, 0);
  const worst = rounds.reduce((w, r) => Math.max(w, Math.abs(r.guess - r.y)), 0);
  return `Color Walk eras ${day}/${month}\n${bars} ${total}/${rounds.length * 100}\nfurthest off: ${worst.toLocaleString('en-US')} years`;
}
