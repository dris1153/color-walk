import { describe, expect, it } from 'vitest';
import { NEAR_END, nearEnd, neighbours } from '../detail-stepping';

const items = ['a', 'b', 'c', 'd'].map((id) => ({ id }));

describe('neighbours', () => {
  it('finds both sides of a work in the middle', () => {
    expect(neighbours(items, 'b')).toEqual({ index: 1, prev: { id: 'a' }, next: { id: 'c' } });
  });

  it('has no previous at the start and no next at the end', () => {
    expect(neighbours(items, 'a')).toEqual({ index: 0, prev: null, next: { id: 'b' } });
    expect(neighbours(items, 'd')).toEqual({ index: 3, prev: { id: 'c' }, next: null });
  });

  it('offers nothing for a work that is not in the order', () => {
    expect(neighbours(items, 'twin')).toEqual({ index: -1, prev: null, next: null });
    expect(neighbours([], 'a')).toEqual({ index: -1, prev: null, next: null });
  });
});

describe('nearEnd', () => {
  it('fires within NEAR_END of the last shown work and not before', () => {
    expect(nearEnd(60 - NEAR_END, 60)).toBe(true);
    expect(nearEnd(59, 60)).toBe(true);
    expect(nearEnd(60 - NEAR_END - 1, 60)).toBe(false);
  });

  it('never fires for a work that is not in the order', () => {
    expect(nearEnd(-1, 0)).toBe(false);
  });
});
