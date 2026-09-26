import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hueToBucket } from './write-bucket-files.mjs';

/** An echo is the same colour at least this far away in time. */
export const ECHO_MIN_YEARS = 1000;
/** Pairs worth browsing on their own: further apart, and clearly coloured. */
const PAIR_MIN_YEARS = 1500;
const PAIR_MIN_SAT = 25;
const PAIRS = 200;
const PAIRS_PER_HUE = 16;

/**
 * "The same colour" as a cell 3 degrees of hue, 4 of lightness and 8 of
 * saturation wide: close enough that the two swatches read as one. Measured on
 * the index of 2026-09-26: 76% of dated works share a cell with a work at least
 * a thousand years away.
 */
const cellOf = (item) => `${Math.round(item.hue / 3)}|${Math.round(item.lig / 4)}|${Math.round(item.sat / 8)}`;

function extremes(items) {
  const cells = new Map();
  for (const item of items) {
    if (typeof item.y !== 'number') continue;
    const key = cellOf(item);
    const c = cells.get(key);
    // Tie-broken by id so a rebuild cannot swap equal works.
    if (!c) cells.set(key, { oldest: item, newest: item });
    else {
      if (item.y < c.oldest.y || (item.y === c.oldest.y && item.id < c.oldest.id)) c.oldest = item;
      if (item.y > c.newest.y || (item.y === c.newest.y && item.id < c.newest.id)) c.newest = item;
    }
  }
  return cells;
}

/** Map of id -> the work of the same colour furthest from it in time, if a thousand years or more. */
export function findEchoes(items) {
  const cells = extremes(items);
  const echoes = new Map();
  for (const item of items) {
    if (typeof item.y !== 'number') continue;
    const { oldest, newest } = cells.get(cellOf(item));
    const far = item.y - oldest.y >= newest.y - item.y ? oldest : newest;
    if (Math.abs(far.y - item.y) >= ECHO_MIN_YEARS) echoes.set(item.id, far);
  }
  return echoes;
}

/** Every entry of a work carries its echo, copies included, like its twin. */
export function attachEchoes(buckets, echoes, located) {
  for (const b of buckets) {
    for (const entry of b.items) {
      const echo = echoes.get(entry.id);
      const at = echo && located.get(echo.id);
      if (at) entry.echo = { id: echo.id, ...at };
    }
  }
}

const light = (item, at) => ({
  id: item.id, t: item.t, y: item.y, thumb: item.thumb, hex: item.hex, src: item.src, r: item.r ?? null, ...at,
});

/**
 * The widest-apart pairs, a few per hue, dealt round the wheel: sorted by gap
 * alone the carousel opened on a run of ancient browns, since the oldest works
 * are stone, bronze and clay.
 */
export function buildEchoPairs(items, located) {
  const byHue = new Map();
  const widestFirst = [...extremes(items.filter((i) => i.sat >= PAIR_MIN_SAT)).values()]
    .filter(({ oldest, newest }) => newest.y - oldest.y >= PAIR_MIN_YEARS)
    .sort((a, b) => b.newest.y - b.oldest.y - (a.newest.y - a.oldest.y) || a.oldest.id.localeCompare(b.oldest.id));
  for (const pair of widestFirst) {
    const hue = hueToBucket(pair.oldest.hue);
    if (!byHue.has(hue)) byHue.set(hue, []);
    if (byHue.get(hue).length < PAIRS_PER_HUE) byHue.get(hue).push(pair);
  }
  const lists = [...byHue.entries()].sort(([a], [b]) => a - b).map(([, list]) => list);
  const dealt = [];
  for (let round = 0; dealt.length < PAIRS && lists.some((l) => l.length > round); round++) {
    for (const list of lists) if (list[round] && dealt.length < PAIRS) dealt.push(list[round]);
  }
  return dealt.map(({ oldest, newest }) => ({ a: light(oldest, located.get(oldest.id)), b: light(newest, located.get(newest.id)) }));
}

export async function writeEchoPairsFile(items, located, outDir) {
  const pairs = buildEchoPairs(items, located);
  await writeFile(path.join(outDir, 'echoes.json'), JSON.stringify({ count: pairs.length, items: pairs }));
  return pairs.length;
}
