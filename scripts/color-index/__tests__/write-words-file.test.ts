import { describe, expect, it } from 'vitest';
import { MIN_WORKS, buildWords, wordsOf } from '../write-words-file.mjs';
import { hueToBucket } from '../write-bucket-files.mjs';

const work = (t: string, hue: number, sat = 50) => ({ t, hue, sat });
const many = (t: string, hue: number, n = MIN_WORKS) => Array.from({ length: n }, () => work(t, hue));

describe('wordsOf', () => {
  it('keeps the words that carry meaning and drops the rest', () => {
    expect([...wordsOf('Portrait of a Man with a Dragon')]).toEqual(['dragon']);
  });

  it('is unbothered by case, punctuation and repeats', () => {
    expect([...wordsOf('Dragon, dragon; DRAGON!')]).toEqual(['dragon']);
    expect([...wordsOf(undefined)]).toEqual([]);
  });

  it('ignores short words, which are mostly noise', () => {
    expect([...wordsOf('Jar and Cup')]).toEqual([]);
  });
});

describe('buildWords', () => {
  it('gives a word the hue spread of the works that carry it', () => {
    const words = buildWords([...many('dragon', 30), ...many('dragon', 210, 10)]);
    const dragon = words.find((w: { w: string }) => w.w === 'dragon')!;
    expect(dragon.n).toBe(MIN_WORKS + 10);
    expect(dragon.h[hueToBucket(30)]).toBe(MIN_WORKS);
    expect(dragon.h[hueToBucket(210)]).toBe(10);
  });

  it('leaves out a word too rare to say anything about', () => {
    expect(buildWords(many('rare', 30, MIN_WORKS - 1))).toEqual([]);
  });

  it('does not let a monochrome work colour a word', () => {
    const words = buildWords([...many('ink', 0, MIN_WORKS - 1), work('ink', 0, 0)]);
    expect(words).toEqual([]);
  });

  it('lists the commonest word first, ties by name', () => {
    const words = buildWords([...many('zebra', 30, 50), ...many('apple', 30, 50), ...many('mango', 30, 60)]);
    expect(words.map((w: { w: string }) => w.w)).toEqual(['mango', 'apple', 'zebra']);
  });
});
