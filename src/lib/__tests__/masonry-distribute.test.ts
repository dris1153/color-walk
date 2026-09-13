import { describe, expect, it } from 'vitest';
import { distributeToColumns } from '../masonry-distribute';

const square = (id: number) => ({ id, w: 100, h: 100 });
const ids = (cols: { id: number }[][]) => cols.map((c) => c.map((i) => i.id));

describe('distributeToColumns', () => {
  it('deals equal items round-robin across columns', () => {
    const out = distributeToColumns([0, 1, 2, 3, 4].map(square), 3);
    expect(ids(out)).toEqual([[0, 3], [1, 4], [2]]);
  });

  it('sends the next items elsewhere after a tall one', () => {
    const items = [{ id: 0, w: 100, h: 300 }, square(1), square(2), square(3)];
    expect(ids(distributeToColumns(items, 3))).toEqual([[0], [1, 3], [2]]);
  });

  it('puts everything in one column when n is 1', () => {
    expect(ids(distributeToColumns([0, 1, 2].map(square), 1))).toEqual([[0, 1, 2]]);
  });

  it('returns empty columns for empty input', () => {
    expect(distributeToColumns([], 3)).toEqual([[], [], []]);
  });

  it('returns no columns when n is not positive', () => {
    expect(distributeToColumns([square(0)], 0)).toEqual([]);
  });

  it('keeps every item exactly once', () => {
    const items = Array.from({ length: 37 }, (_, i) => ({ id: i, w: 100, h: 60 + i }));
    const flat = distributeToColumns(items, 4).flat().map((i) => i.id).sort((a, b) => a - b);
    expect(flat).toEqual(items.map((i) => i.id));
  });

  it('survives zero-sized items without dividing by zero', () => {
    const out = distributeToColumns([{ id: 0, w: 0, h: 0 }, square(1)], 2);
    expect(ids(out)).toEqual([[0], [1]]);
  });
});
