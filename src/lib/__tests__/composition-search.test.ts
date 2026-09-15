import { describe, expect, it } from 'vitest';
import {
  CELLS,
  EMPTY_PAINT,
  GOOD_MATCH,
  PALETTE,
  isCompositionEntry,
  scoreComposition,
  searchComposition,
  type CompositionEntry,
  type Paint,
} from '../composition-search';

const entry = (id: string, top: number | null, bottom: number | null): CompositionEntry => ({
  id,
  t: id,
  thumb: `https://images.metmuseum.org/${id}.jpg`,
  hex: '#123456',
  src: 'met',
  bucket: 2,
  page: 0,
  c: [
    ...([top, top, top] as const).map((h) => (h === null ? null : ([h, 50] as const))),
    null,
    null,
    null,
    ...([bottom, bottom, bottom] as const).map((h) => (h === null ? null : ([h, 50] as const))),
  ],
});

const paint = (top: number | null, bottom: number | null): Paint => [
  top, top, top, null, null, null, bottom, bottom, bottom,
];

describe('scoreComposition', () => {
  it('has nothing to say when nothing is painted', () => {
    expect(scoreComposition(entry('a', 210, 40), EMPTY_PAINT)).toBeNull();
  });

  it('is zero for an exact arrangement', () => {
    expect(scoreComposition(entry('a', 210, 40), paint(210, 40))).toBe(0);
  });

  it('averages over painted cells only', () => {
    // Top is 30 degrees off, bottom exact: mean over six painted cells is 15.
    expect(scoreComposition(entry('a', 240, 40), paint(210, 40))).toBe(15);
  });

  it('charges a painted cell the work has no colour in, rather than skipping it', () => {
    const score = scoreComposition(entry('a', 210, null), paint(210, 40))!;
    expect(score).toBeGreaterThan(GOOD_MATCH);
  });

  it('measures hue the short way round the wheel', () => {
    expect(scoreComposition(entry('a', 350, 350), paint(10, 10))).toBe(20);
  });
});

describe('searchComposition', () => {
  const pool = [entry('sky-ground', 210, 40), entry('ground-sky', 40, 210), entry('all-blue', 210, 210)];

  it('ranks the closest arrangement first and reports how many are good', () => {
    const { matches, total } = searchComposition(pool, paint(210, 40));
    expect(matches[0]!.entry.id).toBe('sky-ground');
    expect(total).toBe(1); // the others are far off on half their cells
  });

  it('answers a one-cell question with everything that has that colour there', () => {
    const p: Paint = [210, null, null, null, null, null, null, null, null];
    expect(searchComposition(pool, p).total).toBe(2);
  });

  it('returns nothing, honestly, for nothing painted', () => {
    expect(searchComposition(pool, EMPTY_PAINT)).toEqual({ matches: [], total: 0 });
  });

  it('respects the limit while still counting the whole', () => {
    const many = Array.from({ length: 80 }, (_, i) => entry(`w${i}`, 210, 40));
    const { matches, total } = searchComposition(many, paint(210, 40), 10);
    expect(matches).toHaveLength(10);
    expect(total).toBe(80);
  });
});

describe('the palette and the gate', () => {
  it('offers a hue every 30 degrees', () => {
    expect(PALETTE).toHaveLength(12);
    expect(PALETTE[7]).toBe(210);
  });

  it('accepts a sound entry and refuses a damaged one', () => {
    const good = entry('ok', 210, 40);
    expect(isCompositionEntry(good)).toBe(true);
    expect(isCompositionEntry({ ...good, c: good.c.slice(0, CELLS - 1) })).toBe(false);
    expect(isCompositionEntry({ ...good, c: [...good.c.slice(0, 8), [400, 50]] })).toBe(false);
    expect(isCompositionEntry({ ...good, hex: 'red' })).toBe(false);
    expect(isCompositionEntry({ ...good, src: 'louvre' })).toBe(false);
    expect(isCompositionEntry(null)).toBe(false);
  });
});
