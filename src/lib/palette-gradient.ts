import { hslToHex } from './color-math';
import type { Item } from './index-item';

export type Band = readonly [hex: string, share: number];

/**
 * The colours of a work, the one the entry wears first (so a copy filed under
 * its blue leads with blue), shares normalised to sum to 1. A work of one
 * colour, or with unusable shares, is that one colour.
 */
export function paletteBands(item: Pick<Item, 'hex' | 'pct' | 'p'>): Band[] {
  const bands: Band[] = [
    [item.hex, item.pct],
    ...(item.p ?? []).map(([h, s, l, share]): Band => [hslToHex(h, s, l), share]),
  ];
  const total = bands.reduce((sum, [, share]) => sum + share, 0);
  if (bands.length < 2 || !(total > 0)) return [[item.hex, 1]];
  return bands.map(([hex, share]) => [hex, share / total]);
}

/** The bands as hard-edged stops, left to right: a value for the `background` shorthand. */
export function paletteGradient(item: Pick<Item, 'hex' | 'pct' | 'p'>): string {
  const bands = paletteBands(item);
  if (bands.length < 2) return item.hex;
  let at = 0;
  const stops = bands.map(([hex, share]) => {
    const from = at;
    at += share * 100;
    return `${hex} ${from.toFixed(1)}% ${at.toFixed(1)}%`;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
}
