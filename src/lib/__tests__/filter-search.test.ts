import { describe, expect, it } from 'vitest';
import { AUTO_PAGES, isSearching, mayFetch } from '../filter-search';

const base = {
  filtering: true,
  ready: true,
  pageFailed: false,
  found: 3,
  wanted: 60,
  more: true,
  loaded: 2,
  limit: AUTO_PAGES,
};

describe('isSearching', () => {
  it('searches while a filtered grid is short and pages remain in the budget', () => {
    expect(isSearching(base)).toBe(true);
  });

  it('stops at the budget, at the end of the hue, once full, and on a failed page', () => {
    expect(isSearching({ ...base, loaded: AUTO_PAGES })).toBe(false);
    expect(isSearching({ ...base, more: false })).toBe(false);
    expect(isSearching({ ...base, found: 60 })).toBe(false);
    expect(isSearching({ ...base, pageFailed: true })).toBe(false);
  });

  it('never runs without a filter', () => {
    expect(isSearching({ ...base, filtering: false })).toBe(false);
  });
});

describe('mayFetch', () => {
  it('lets scrolling fetch freely without a filter, and only within budget with one', () => {
    expect(mayFetch({ filtering: false, loaded: 90, limit: AUTO_PAGES })).toBe(true);
    expect(mayFetch({ filtering: true, loaded: AUTO_PAGES, limit: AUTO_PAGES })).toBe(false);
    expect(mayFetch({ filtering: true, loaded: AUTO_PAGES, limit: AUTO_PAGES * 2 })).toBe(true);
  });
});
