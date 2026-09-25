import { hslToHex } from './color-math';
import type { Item } from './index-item';

type Band = readonly [hex: string, share: number];

/**
 * The colours of a work as hard-edged bands, left to right, each as wide as
 * its share of the picture. The colour the entry wears comes first, so a copy
 * filed under its blue leads with blue. A work of one colour is that colour.
 * The result is a value for the `background` shorthand.
 */
export function paletteGradient(item: Pick<Item, 'hex' | 'pct' | 'p'>): string {
  const bands: Band[] = [
    [item.hex, item.pct],
    ...(item.p ?? []).map(([h, s, l, share]): Band => [hslToHex(h, s, l), share]),
  ];
  const total = bands.reduce((sum, [, share]) => sum + share, 0);
  if (bands.length < 2 || !(total > 0)) return item.hex;

  let at = 0;
  const stops = bands.map(([hex, share]) => {
    const from = at;
    at += (share / total) * 100;
    return `${hex} ${from.toFixed(1)}% ${at.toFixed(1)}%`;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
}
