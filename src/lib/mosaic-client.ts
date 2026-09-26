import { BUCKET_COUNT } from './color-math';
import type { Lab } from './lab';
import { isSource, type Source } from './museums';

/** One atlas tile: the work, where its entry lives, and the tile's mean colour. */
export type MosaicTile = { id: string; t: string; src: Source; b: number | 'grey'; p: number; l: Lab };
export type Mosaic = { tile: number; cols: number; tiles: MosaicTile[]; atlas: HTMLImageElement };

const isTile = (x: unknown): x is MosaicTile => {
  if (typeof x !== 'object' || x === null) return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.t === 'string' &&
    isSource(e.src) &&
    (e.b === 'grey' || (Number.isInteger(e.b) && (e.b as number) >= 0 && (e.b as number) < BUCKET_COUNT)) &&
    Number.isInteger(e.p) &&
    (e.p as number) >= 0 &&
    Array.isArray(e.l) &&
    e.l.length === 3 &&
    e.l.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
};

let mosaic: Promise<Mosaic> | null = null;

/**
 * The manifest (~90 kB compressed) and the atlas (~1 MB), fetched when the
 * reader first opens the mosaic and kept for the session. Both come from this
 * site, so a canvas that draws the atlas can still be saved as a picture.
 */
export function loadMosaic(): Promise<Mosaic> {
  mosaic ??= Promise.all([
    fetch('/index/mosaic.json').then((res) => {
      if (!res.ok) throw new Error('index-load-failed');
      return res.json();
    }),
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('index-load-failed'));
      img.src = '/index/mosaic.jpg';
    }),
  ])
    .then(([data, atlas]: [unknown, HTMLImageElement]) => {
      const body = data as { tile?: unknown; cols?: unknown; items?: unknown };
      if (!Number.isInteger(body?.tile) || !Number.isInteger(body?.cols) || !Array.isArray(body?.items)) {
        throw new Error('index-load-failed');
      }
      // Kept in manifest order even when a tile fails the gate: its place in
      // the list is its place in the atlas.
      const tiles = body.items.map((t) => (isTile(t) ? t : null));
      if (tiles.some((t) => t === null)) throw new Error('index-load-failed');
      return { tile: body.tile as number, cols: body.cols as number, tiles: tiles as MosaicTile[], atlas };
    })
    .catch((err: unknown) => {
      mosaic = null; // never cache a failure, or a retry could not work
      throw err;
    });
  return mosaic;
}
