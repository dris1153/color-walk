import { writeCompositionFile } from './write-composition-file.mjs';
import { writeHistoriesFile } from './write-histories-file.mjs';
import { writeMosaicFiles } from './write-mosaic-files.mjs';

/**
 * The side files whose entries open a work with one page fetch, so each needs
 * to know where that work's entry landed: a primary in its hue bucket, a
 * monochrome work in the neutral page it was dealt to.
 */
export async function writeLocatedSideFiles({ buckets, items, neutrals, neutralPage, pageSize, outDir, readThumb }) {
  const located = new Map();
  for (const b of buckets) {
    b.items.forEach((entry, index) => {
      if (!located.has(entry.id) && !(entry.p ?? []).some((c) => c[3] > entry.pct)) {
        located.set(entry.id, { bucket: b.bucket, page: Math.floor(index / pageSize) });
      }
    });
  }
  const locate = (id) => located.get(id);
  const composition = await writeCompositionFile(items, locate, outDir);
  const histories = await writeHistoriesFile(items, locate, outDir);
  // The mosaic reads thumbnails, so it is written only by a real build.
  const mosaic = readThumb
    ? await writeMosaicFiles(
        [
          ...items.map((i) => ({ ...i, ...locate(i.id) })),
          ...neutrals.map((n) => ({ ...n, bucket: 'grey', page: neutralPage.get(n.id) })),
        ],
        readThumb,
        outDir,
      )
    : 0;
  return { composition, histories, mosaic };
}
