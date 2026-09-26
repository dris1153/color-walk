import { writeCompositionFile } from './write-composition-file.mjs';
import { attachEchoes, findEchoes, writeEchoPairsFile } from './write-echoes.mjs';
import { writeHistoriesFile } from './write-histories-file.mjs';
import { writeMosaicFiles } from './write-mosaic-files.mjs';

/**
 * Everything that points at a work so it can be opened with one page fetch,
 * and so needs to know where that work's entry landed: a primary in its hue
 * bucket, a monochrome work in the neutral page it was dealt to. Echoes are
 * attached to the bucket entries here too, before any page is written.
 */
export async function writeLocatedSideFiles({ buckets, items, dealt, pageSize, outDir, readThumb }) {
  const located = new Map();
  for (const b of buckets) {
    b.items.forEach((entry, index) => {
      if (!located.has(entry.id) && !(entry.p ?? []).some((c) => c[3] > entry.pct)) {
        located.set(entry.id, { bucket: b.bucket, page: Math.floor(index / pageSize) });
      }
    });
  }
  const locate = (id) => located.get(id);
  const echoes = findEchoes(items);
  attachEchoes(buckets, echoes, located);

  const composition = await writeCompositionFile(items, locate, outDir);
  const histories = await writeHistoriesFile(items, locate, outDir);
  const echoPairs = await writeEchoPairsFile(items, located, outDir);
  // The mosaic reads thumbnails, so it is written only by a real build.
  const mosaic = readThumb
    ? await writeMosaicFiles(
        [
          ...items.map((i) => ({ ...i, ...locate(i.id) })),
          ...dealt.dealt.flatMap((page, p) => page.map((n) => ({ ...n, bucket: 'grey', page: p }))),
        ],
        readThumb,
        outDir,
      )
    : 0;
  return { composition, histories, mosaic, echoes: echoes.size, echoPairs };
}
