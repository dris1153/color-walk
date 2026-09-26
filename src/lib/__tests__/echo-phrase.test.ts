import { describe, expect, it } from 'vitest';
import { echoPhrase, formatYear } from '../echo-phrase';

describe('echoPhrase', () => {
  it('says how far and which way', () => {
    expect(echoPhrase(1900, -400)).toBe('Its echo, 2,300 years earlier');
    expect(echoPhrase(-1418, 1895)).toBe('Its echo, 3,313 years later');
  });

  it('falls back when a year is missing', () => {
    expect(echoPhrase(undefined, 1900)).toBe('Its echo');
    expect(echoPhrase(1900, 1900)).toBe('Its echo');
  });
});

describe('formatYear', () => {
  it('writes years before the common era as BCE', () => {
    expect(formatYear(-1418)).toBe('1418 BCE');
    expect(formatYear(1650)).toBe('1650');
  });
});
