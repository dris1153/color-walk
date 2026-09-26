import { describe, expect, it } from 'vitest';
import { cmaKind, metKind, regionOf, yearFrom, yearFromText } from '../facet-tables.mjs';

describe('yearFrom', () => {
  it('takes the middle of a span', () => {
    expect(yearFrom(1700, 1799)).toBe(1750);
    expect(yearFrom(-664, -332)).toBe(-498);
  });

  it('reads the Met pair (0, 0) as undated, and uses one end when that is all there is', () => {
    expect(yearFrom(0, 0)).toBeNull();
    expect(yearFrom(1650, null)).toBe(1650);
    expect(yearFrom('x', 1650)).toBe(1650);
    expect(yearFrom(null, undefined)).toBeNull();
  });

  it('refuses years no work in a museum has', () => {
    expect(yearFrom(99999, 99999)).toBeNull();
  });
});

describe('yearFromText', () => {
  it('reads the span out of a free-text date', () => {
    expect(yearFromText('c. 1670 - c. 1700')).toBe(1685);
    expect(yearFromText('1889')).toBe(1889);
    expect(yearFromText('664-332 BC')).toBe(-498);
    expect(yearFromText('mid-century')).toBeNull();
  });
});

describe('kinds', () => {
  it('maps Met classifications, most specific first', () => {
    expect(metKind({ classification: 'Ceramics-Porcelain' })).toBe('ceramic');
    expect(metKind({ classification: 'Accessory-Jewelry-Womenswear' })).toBe('jewellery');
    expect(metKind({ classification: 'Accessory-Headwear' })).toBe('textile');
    expect(metKind({ classification: 'Woodblocks' })).toBe('print');
    expect(metKind({ classification: 'Woodwork' })).toBe('other');
    expect(metKind({ classification: 'Lacquer' })).toBe('other');
  });

  it('falls back to the medium where the Met leaves the classification blank', () => {
    expect(metKind({ classification: '', medium: 'Faience' })).toBe('ceramic');
    expect(metKind({ classification: '', medium: 'Limestone, paint' })).toBe('sculpture');
    expect(metKind({ classification: '', medium: '' })).toBe('other');
  });

  it('maps CMA types', () => {
    expect(cmaKind({ type: 'Bound Volume' })).toBe('book');
    expect(cmaKind({ type: 'Portrait Miniature' })).toBe('painting');
    expect(cmaKind({ type: 'Spindle Whorl' })).toBe('other');
  });
});

describe('regionOf', () => {
  it('lets a decisive department win over the words', () => {
    expect(regionOf('Egyptian Art', 'Egypt')).toBe('ancient');
    expect(regionOf('Islamic Art', 'Egypt')).toBe('west-asia');
  });

  it('reads the culture words, Americas before India', () => {
    expect(regionOf('Asian Art', 'India | ')).toBe('south-asia');
    expect(regionOf('Asian Art', 'Indonesia')).toBe('se-asia');
    expect(regionOf('Modern and Contemporary Art', 'American Indian')).toBe('americas');
    expect(regionOf('Prints', 'Thomas Eakins (American, 1844-1916)')).toBe('americas');
    expect(regionOf(undefined, 'China, Qing dynasty (1644-1912)')).toBe('east-asia');
  });

  it("falls back to the department's default, and to nothing", () => {
    expect(regionOf('Asian Art', '')).toBe('east-asia');
    expect(regionOf('Photographs', '')).toBeNull();
  });
});

describe('the review cases', () => {
  it('reads decades, centuries and BCE the way curators write them', () => {
    expect(yearFromText('1670s')).toBe(1675);
    expect(yearFromText('early 1600s')).toBe(1650);
    expect(yearFromText('1700s-1800s')).toBe(1800);
    expect(yearFromText('300 B.C.')).toBe(-300);
    expect(yearFromText('300 BC - AD 100')).toBe(-100);
    expect(yearFromText('No. 5')).toBeNull();
  });

  it('files an export ware under the place that made it', () => {
    expect(regionOf('Asian Art', 'Chinese, for American market')).toBe('east-asia');
    expect(regionOf(undefined, 'British, for Indian market')).toBe('europe');
  });

  it('does not take a silkscreen for silk, or glazes on canvas for a pot', () => {
    expect(metKind({ classification: '', medium: 'Screenprint (silkscreen)' })).toBe('other');
    expect(metKind({ classification: '', medium: 'Oil and glazes on canvas' })).toBe('painting');
  });
});
