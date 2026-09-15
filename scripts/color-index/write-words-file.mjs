import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BUCKET_COUNT, hueToBucket } from './write-bucket-files.mjs';

/**
 * What colour a word is, in this collection: for every word that titles at
 * least MIN_WORKS works, how those works spread over the 24 hues.
 *
 * Measured 2026-09-15 and found shallow: the twelve most distinctly coloured
 * words all lean red rather than orange, and "garden" looks like the whole
 * collection. Kept deliberately small - a histogram per word, no work lists -
 * so it costs ~10 kB and can be dropped in minutes if it proves as thin in use
 * as in measurement.
 */
export const MIN_WORKS = 40;
export const MIN_LETTERS = 4;
/** Function words and the catalogue boilerplate that titles nearly everything. */
export const STOP_WORDS = new Set(
  'the a an of and with in on at to for from by or de la le du des et von der und portrait man woman figure design pair set two with'.split(
    ' ',
  ),
);

export function wordsOf(title) {
  return new Set(
    String(title ?? '')
      .toLowerCase()
      .replace(/[^a-z ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= MIN_LETTERS && !STOP_WORDS.has(w)),
  );
}

/** Only coloured works count: a monochrome work carries no hue to file under. */
export function buildWords(items) {
  const byWord = new Map();
  for (const item of items) {
    if (item.sat === 0) continue;
    const bucket = hueToBucket(item.hue);
    for (const w of wordsOf(item.t)) {
      if (!byWord.has(w)) byWord.set(w, new Array(BUCKET_COUNT).fill(0));
      byWord.get(w)[bucket]++;
    }
  }
  return [...byWord.entries()]
    .map(([w, h]) => ({ w, n: h.reduce((a, b) => a + b, 0), h }))
    .filter((e) => e.n >= MIN_WORKS)
    .sort((a, b) => b.n - a.n || a.w.localeCompare(b.w));
}

export async function writeWordsFile(items, outDir) {
  const words = buildWords(items);
  await writeFile(path.join(outDir, 'words.json'), JSON.stringify({ count: words.length, items: words }));
  return words.length;
}
