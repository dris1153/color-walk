import type { Lab } from './lab';

export const MOSAIC_COLS = 64;
const MIN_ROWS = 16;
const MAX_ROWS = 96;
/**
 * Added to a tile's distance each time it is used, in Lab units. Without it a
 * flat sky becomes one work repeated three hundred times; measured on a test
 * picture, 4 spreads a 64x51 grid over ~2,200 different works.
 */
export const REUSE_PENALTY = 4;

/** Rows for a picture of this shape, at the fixed column count. */
export function gridRows(width: number, height: number): number {
  const rows = Math.round((MOSAIC_COLS * height) / Math.max(1, width));
  return Math.min(MAX_ROWS, Math.max(MIN_ROWS, rows));
}

/**
 * For each cell, the index of the tile nearest its colour, cells read left to
 * right, top to bottom. Brute force: 6,000 cells against 4,096 tiles is ~25M
 * distances, a fraction of a second, and exact.
 */
export function matchCells(cells: readonly Lab[], tiles: readonly Lab[], penalty = REUSE_PENALTY): number[] {
  const used = new Uint16Array(tiles.length);
  return cells.map(([L, a, b]) => {
    let best = -1;
    let bestD = Infinity;
    for (let t = 0; t < tiles.length; t++) {
      const tile = tiles[t]!;
      const d = Math.hypot(tile[0] - L, tile[1] - a, tile[2] - b) + used[t]! * penalty;
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    if (best >= 0) used[best] = used[best]! + 1;
    return best;
  });
}
