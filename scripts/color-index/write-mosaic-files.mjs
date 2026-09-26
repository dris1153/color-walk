import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { meanRgb, rgbToLab } from './lab.mjs';

export const MOSAIC_TILES = 4096;
export const TILE_PX = 32;
const COLS = 64;
/** Lab bins of this size; one tile per bin per round, so a rare colour is never crowded out. */
const BIN = 10;

/** Stable pseudo-random order, so a rebuild picks the same tiles and does not
 *  favour one museum's id prefix. FNV-1a. */
const hash = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
};

/**
 * Tiles spread evenly over the colours the collection has. Measured on 16,000
 * works: they occupy 188 of 1,184 Lab bins, and the busiest bins (browns,
 * greys) hold thousands, so taking the nearest works first would spend the
 * atlas on beige. Round-robin over bins instead.
 */
export function pickTiles(works, count = MOSAIC_TILES) {
  const bins = new Map();
  for (const w of works) {
    const [L, a, b] = w.lab;
    const key = `${Math.floor(L / BIN)}|${Math.floor(a / BIN)}|${Math.floor(b / BIN)}`;
    if (!bins.has(key)) bins.set(key, []);
    bins.get(key).push(w);
  }
  const lists = [...bins.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, list]) => list.sort((x, y) => hash(x.id) - hash(y.id) || x.id.localeCompare(y.id)));
  const picked = [];
  for (let round = 0; picked.length < count; round++) {
    let any = false;
    for (const list of lists) {
      if (round >= list.length) continue;
      any = true;
      picked.push(list[round]);
      if (picked.length === count) break;
    }
    if (!any) break;
  }
  return picked;
}

/**
 * The mosaic's tiles as one atlas image and a manifest. Served from this site,
 * so the reader's browser can draw them into a canvas and save the result: the
 * museums' own images carry no CORS header and could not be exported.
 * `works` carry `m` (mean RGB) and a location; `readThumb` reads a cached thumbnail.
 */
export async function writeMosaicFiles(works, readThumb, outDir) {
  const candidates = works.filter((w) => Array.isArray(w.m)).map((w) => ({ ...w, lab: rgbToLab(...w.m) }));
  const picked = pickTiles(candidates);
  const rows = Math.ceil(picked.length / COLS);
  const width = COLS * TILE_PX;
  const atlas = Buffer.alloc(width * rows * TILE_PX * 3);
  const items = [];
  for (const [i, w] of picked.entries()) {
    const { data } = await sharp(await readThumb(w.id))
      .resize(TILE_PX, TILE_PX, { fit: 'cover' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const ox = (i % COLS) * TILE_PX;
    const oy = Math.floor(i / COLS) * TILE_PX;
    for (let y = 0; y < TILE_PX; y++) {
      data.copy(atlas, ((oy + y) * width + ox) * 3, y * TILE_PX * 3, (y + 1) * TILE_PX * 3);
    }
    // The tile's own mean, cropped as it is drawn, is what a cell is matched against.
    const lab = rgbToLab(...meanRgb(data, 3)).map((v) => Math.round(v * 10) / 10);
    items.push({ id: w.id, t: w.t, src: w.src, b: w.bucket, p: w.page, l: lab });
  }
  const jpeg = await sharp(atlas, { raw: { width, height: rows * TILE_PX, channels: 3 } })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();
  await writeFile(path.join(outDir, 'mosaic.jpg'), jpeg);
  await writeFile(
    path.join(outDir, 'mosaic.json'),
    JSON.stringify({ tile: TILE_PX, cols: COLS, count: items.length, items }),
  );
  return items.length;
}
