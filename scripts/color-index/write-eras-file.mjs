import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import facets from '../../src/lib/facets.json' with { type: 'json' };
import { hueToBucket } from './write-bucket-files.mjs';

const BUCKETS = 24;

export const eraOf = (year) => facets.eras.find((e) => year >= e.from && year < e.to)?.id ?? null;

/**
 * The colour of each era: for every era, how its works spread over the 24 hues
 * (by the colour each leads with, so a work counts once) plus how many are
 * monochrome. A few kB, so the whole collection's history fits in one request.
 */
export function buildEras(items, neutrals) {
  const rows = new Map(facets.eras.map((e) => [e.id, { id: e.id, n: 0, g: 0, h: new Array(BUCKETS).fill(0) }]));
  let undated = 0;
  for (const [list, grey] of [[items, false], [neutrals, true]]) {
    for (const item of list) {
      const row = typeof item.y === 'number' ? rows.get(eraOf(item.y)) : undefined;
      if (!row) {
        undated++;
        continue;
      }
      row.n++;
      if (grey) row.g++;
      else row.h[hueToBucket(item.hue)]++;
    }
  }
  return { undated, eras: [...rows.values()] };
}

export async function writeErasFile(items, neutrals, outDir) {
  const body = buildEras(items, neutrals);
  await writeFile(path.join(outDir, 'eras.json'), JSON.stringify(body));
  return body.eras.reduce((n, e) => n + e.n, 0);
}
