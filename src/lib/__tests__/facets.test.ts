import { describe, expect, it } from 'vitest';
import { NO_FILTER, eraLabel, eraOf, isFiltering, matchesFilter } from '../facets';

describe('matchesFilter', () => {
  const work = { y: 1650, k: 'ceramic', r: 'europe' };

  it('passes everything when nothing is chosen', () => {
    expect(isFiltering(NO_FILTER)).toBe(false);
    expect(matchesFilter({}, NO_FILTER)).toBe(true);
  });

  it('requires every chosen facet', () => {
    expect(matchesFilter(work, { kind: 'ceramic', era: '1600', region: 'europe' })).toBe(true);
    expect(matchesFilter(work, { ...NO_FILTER, era: '1700' })).toBe(false);
    expect(matchesFilter(work, { ...NO_FILTER, kind: 'glass' })).toBe(false);
  });

  it('never lets a work without the facet through', () => {
    expect(matchesFilter({ k: 'ceramic' }, { ...NO_FILTER, era: '1600' })).toBe(false);
    expect(matchesFilter({ y: 1650 }, { ...NO_FILTER, region: 'europe' })).toBe(false);
  });
});

describe('eras', () => {
  it('names the era a year falls in', () => {
    expect(eraOf(1650)).toBe('1600');
    expect(eraOf(-2500)).toBe('early');
    expect(eraLabel(eraOf(1650))).toBe('1600s');
  });
});
