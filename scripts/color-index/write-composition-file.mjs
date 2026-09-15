import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hasVariation } from './extract-composition.mjs';

/**
 * Only works whose map varies, and only what the search needs to draw a result
 * and open it: title, thumb, hex, museum, and where the full entry lives.
 * Measured ~4,500 works, so roughly 60 kB compressed rather than the whole
 * index again.
 */
export function buildComposition(items, locate) {
  return items
    .filter((item) => item.c && hasVariation(item.c))
    .map((item) => {
      const { bucket, page } = locate(item.id);
      return {
        id: item.id,
        t: item.t,
        thumb: item.thumb,
        hex: item.hex,
        src: item.src,
        bucket,
        page,
        c: item.c,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function writeCompositionFile(items, locate, outDir) {
  const entries = buildComposition(items, locate);
  await writeFile(
    path.join(outDir, 'composition.json'),
    JSON.stringify({ count: entries.length, items: entries }),
  );
  return entries.length;
}
