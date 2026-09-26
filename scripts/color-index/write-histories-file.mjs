import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { eraOf } from './write-eras-file.mjs';
import { hueToBucket } from './write-bucket-files.mjs';

/** The work that most reads as its colour: saturated, and mostly that colour. */
const readsAsColour = (item) => item.sat * item.pct;

/**
 * The history of each colour: for every hue and era, the one work that shows
 * that colour best. Measured on the index of 2026-09-26: 260 of the 288 cells
 * hold a work, so a hue's history has at most a gap or two. Each entry carries
 * what the timeline draws and where the full entry lives.
 */
export function buildHistories(items, locate) {
  const best = new Map();
  for (const item of items) {
    if (typeof item.y !== 'number') continue;
    const era = eraOf(item.y);
    if (!era) continue;
    const key = `${hueToBucket(item.hue)}|${era}`;
    const current = best.get(key);
    const score = readsAsColour(item);
    // Tie-broken by id so a rebuild cannot reshuffle equal works.
    if (!current || score > current.score || (score === current.score && item.id < current.item.id)) {
      best.set(key, { item, score });
    }
  }
  return [...best.entries()]
    .map(([key, { item }]) => {
      const [h, e] = key.split('|');
      const { bucket, page } = locate(item.id);
      return { h: Number(h), e, id: item.id, t: item.t, a: item.a, y: item.y, thumb: item.thumb, hex: item.hex, src: item.src, bucket, page };
    })
    .sort((a, b) => a.h - b.h || a.y - b.y);
}

export async function writeHistoriesFile(items, locate, outDir) {
  const cells = buildHistories(items, locate);
  await writeFile(path.join(outDir, 'histories.json'), JSON.stringify({ count: cells.length, items: cells }));
  return cells.length;
}
