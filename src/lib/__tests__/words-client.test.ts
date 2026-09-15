import { describe, expect, it } from 'vitest';
import { suggest, type WordColour } from '../words-client';

const word = (w: string, n = 50): WordColour => ({ w, n, h: Array.from({ length: 24 }, () => 0) });
const all = [word('dragon'), word('dragonfly'), word('sundragon'), word('garden'), word('virgin')];

describe('suggest', () => {
  it('offers words that start with what was typed before words that merely contain it', () => {
    expect(suggest(all, 'drag').map((w) => w.w)).toEqual(['dragon', 'dragonfly', 'sundragon']);
  });

  it('is unbothered by case and stray spaces', () => {
    expect(suggest(all, '  Gar ').map((w) => w.w)).toEqual(['garden']);
  });

  it('offers nothing for nothing', () => {
    expect(suggest(all, '')).toEqual([]);
    expect(suggest(all, '   ')).toEqual([]);
  });

  it('stops at the limit', () => {
    const many = Array.from({ length: 20 }, (_, i) => word(`word${i}`));
    expect(suggest(many, 'word', 8)).toHaveLength(8);
  });
});
