#!/usr/bin/env node
// One share image per hue, tiled from that hue's own works. Generated from the
// committed index and the thumbnail cache, then committed itself: a static host
// cannot make these per request, and the fragment in `#h=210` never reaches a
// crawler anyway.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { BUCKET_COUNT, BUCKET_WIDTH } from './write-bucket-files.mjs';
import { thumbPath } from './download-thumbnails.mjs';

const INDEX_DIR = path.join(import.meta.dirname, '..', '..', 'public', 'index');
const OUT_DIR = path.join(import.meta.dirname, '..', '..', 'public', 'og');
const WIDTH = 1200;
const HEIGHT = 630;
const COLS = 6;
const ROWS = 3;
const TILE_W = Math.ceil(WIDTH / COLS);
const TILE_H = Math.ceil(HEIGHT / ROWS);
const TILES = COLS * ROWS;

const read = async (name) => JSON.parse(await readFile(path.join(INDEX_DIR, name), 'utf8'));

/** Works whose colour fills the frame, so the card reads as that hue rather
 *  than as a row of objects on white studio grounds. */
const readsAsColour = (a, b) => b.sat * b.pct - a.sat * a.pct;

async function compose(items, file) {
  const chosen = [...items].sort(readsAsColour).slice(0, TILES);
  if (chosen.length === 0) return false;

  const tiles = [];
  for (let i = 0; i < TILES; i++) {
    const item = chosen[i % chosen.length];
    try {
      const buf = await sharp(await readFile(thumbPath(item.id)))
        .resize(TILE_W, TILE_H, { fit: 'cover', position: 'attention' })
        .toBuffer();
      tiles.push({
        input: buf,
        left: (i % COLS) * TILE_W,
        top: Math.floor(i / COLS) * TILE_H,
      });
    } catch {
      // A missing thumbnail just leaves the ground showing through.
    }
  }
  if (tiles.length === 0) return false;

  await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 3, background: '#0b0b0c' },
  })
    .composite(tiles)
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(path.join(OUT_DIR, file));
  return true;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const meta = await read('meta.json');
  const made = [];

  for (let b = 0; b < BUCKET_COUNT; b++) {
    if (meta.byBucket[b] === 0) continue;
    const bucket = await read(`bucket-${String(b).padStart(2, '0')}.json`);
    const hue = Math.round(b * BUCKET_WIDTH);
    const name = `h-${String(hue).padStart(3, '0')}.jpg`;
    if (await compose(bucket.items, name)) made.push(name);
  }

  const neutral = await read('neutral.json');
  // Neutral works all score 0 on saturation, so order them by tone instead.
  const spread = neutral.items
    .map((item) => ({ ...item, sat: 1, pct: 1 }))
    .sort((a, b) => a.lig - b.lig)
    .filter((_, i, all) => i % Math.max(1, Math.floor(all.length / TILES)) === 0);
  if (await compose(spread, 'grey.jpg')) made.push('grey.jpg');

  console.log(`wrote ${made.length} share images to public/og/`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
