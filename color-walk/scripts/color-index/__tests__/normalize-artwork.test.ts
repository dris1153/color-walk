import { describe, expect, it } from 'vitest';
import { normalizeArtwork } from '../normalize-artwork.mjs';

const metOk = () => ({
  objectID: 436535,
  isPublicDomain: true,
  title: 'Wheat Field with Cypresses',
  artistDisplayName: 'Vincent van Gogh',
  objectDate: '1889',
  primaryImage: 'https://images.metmuseum.org/CRDImages/ep/original/DT1567.jpg',
  primaryImageSmall: 'https://images.metmuseum.org/CRDImages/ep/web-large/DT1567.jpg',
  objectURL: 'https://www.metmuseum.org/art/collection/search/436535',
  creditLine: 'Purchase, The Annenberg Foundation Gift, 1993',
});

const cmaOk = () => ({
  id: 123,
  accession_number: '1915.534',
  share_license_status: 'CC0',
  title: 'The Biglin Brothers Turning the Stake',
  creators: [{ description: 'Thomas Eakins (American, 1844-1916)' }],
  creation_date: '1873',
  // The live API returns the bare host and string filesizes; both are covered here.
  url: 'https://clevelandart.org/art/1915.534',
  creditline: 'Hinman B. Hurlbut Collection',
  images: {
    web: { url: 'https://openaccess-cdn.clevelandart.org/1915.534/1915.534_web.jpg', filesize: '402404' },
    print: { url: 'https://openaccess-cdn.clevelandart.org/1915.534/1915.534_print.jpg', filesize: '5904910' },
  },
});

describe('normalizeArtwork - happy path', () => {
  it('maps a Met object', () => {
    const item = normalizeArtwork(metOk(), 'met');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('met-436535');
    expect(item!.src).toBe('met');
    expect(item!.a).toBe('Vincent van Gogh');
    expect(item!.bigBytes).toBeNull();
  });

  it('maps a CMA artwork, preferring the print image', () => {
    const item = normalizeArtwork(cmaOk(), 'cma');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('cma-1915.534');
    expect(item!.big).toContain('_print.jpg');
    expect(item!.bigBytes).toBe(5904910);
    expect(item!.a).toBe('Thomas Eakins (American, 1844-1916)');
  });

  it('accepts both the bare and www spellings of the CMA site', () => {
    expect(normalizeArtwork({ ...cmaOk(), url: 'https://www.clevelandart.org/art/1915.534' }, 'cma')).not.toBeNull();
    expect(normalizeArtwork({ ...cmaOk(), url: 'https://clevelandart.org/art/1915.534' }, 'cma')).not.toBeNull();
  });

  it('falls back to the web image when print is missing', () => {
    const raw = cmaOk();
    delete (raw.images as Record<string, unknown>).print;
    const item = normalizeArtwork(raw, 'cma');
    expect(item!.big).toContain('_web.jpg');
    expect(item!.bigBytes).toBe(402404);
  });

  it('rejects an unknown source', () => {
    expect(normalizeArtwork(metOk(), 'louvre')).toBeNull();
  });
});

describe('normalizeArtwork - hostile URLs', () => {
  it('rejects a foreign image host', () => {
    expect(normalizeArtwork({ ...metOk(), primaryImageSmall: 'https://evil.example/x.jpg' }, 'met')).toBeNull();
  });

  it('rejects a javascript: URL', () => {
    expect(normalizeArtwork({ ...metOk(), primaryImageSmall: 'javascript:alert(1)' }, 'met')).toBeNull();
  });

  it('rejects a protocol-relative URL', () => {
    expect(normalizeArtwork({ ...metOk(), primaryImageSmall: '//images.metmuseum.org/x.jpg' }, 'met')).toBeNull();
  });

  it('rejects a foreign page host', () => {
    expect(normalizeArtwork({ ...metOk(), objectURL: 'https://evil.example/art/1' }, 'met')).toBeNull();
  });

  it('ignores a poisoned big image and keeps the safe thumb', () => {
    const item = normalizeArtwork({ ...metOk(), primaryImage: 'https://evil.example/big.jpg' }, 'met');
    expect(item!.big).toBe(item!.thumb);
  });
});

describe('normalizeArtwork - hostile ids and shapes', () => {
  it('rejects a non-integer objectID', () => {
    expect(normalizeArtwork({ ...metOk(), objectID: '12; DROP' }, 'met')).toBeNull();
    expect(normalizeArtwork({ ...metOk(), objectID: -5 }, 'met')).toBeNull();
    expect(normalizeArtwork({ ...metOk(), objectID: 1.5 }, 'met')).toBeNull();
  });

  it('rejects an accession number that could escape the cache directory', () => {
    expect(normalizeArtwork({ ...cmaOk(), accession_number: '..' }, 'cma')).toBeNull();
    expect(normalizeArtwork({ ...cmaOk(), accession_number: '../../etc/passwd' }, 'cma')).toBeNull();
    expect(normalizeArtwork({ ...cmaOk(), accession_number: '' }, 'cma')).toBeNull();
  });

  it('rejects a string images field', () => {
    expect(normalizeArtwork({ ...cmaOk(), images: 'https://openaccess-cdn.clevelandart.org/x.jpg' }, 'cma')).toBeNull();
    expect(normalizeArtwork({ ...cmaOk(), images: null }, 'cma')).toBeNull();
    expect(normalizeArtwork({ ...cmaOk(), images: {} }, 'cma')).toBeNull();
  });

  it('rejects a non-object record', () => {
    expect(normalizeArtwork(null, 'met')).toBeNull();
    expect(normalizeArtwork('nope', 'cma')).toBeNull();
  });

  it('defaults a missing creators array', () => {
    const raw = cmaOk();
    delete (raw as Record<string, unknown>).creators;
    expect(normalizeArtwork(raw, 'cma')!.a).toBe('Unknown artist');
    expect(normalizeArtwork({ ...cmaOk(), creators: 'Eakins' }, 'cma')!.a).toBe('Unknown artist');
  });

  it('defaults a missing title', () => {
    expect(normalizeArtwork({ ...metOk(), title: '' }, 'met')!.t).toBe('Untitled');
  });

  it('caps a huge title at 300 characters', () => {
    const item = normalizeArtwork({ ...metOk(), title: 'x'.repeat(1_000_000) }, 'met');
    expect(item!.t).toHaveLength(300);
  });
});

describe('normalizeArtwork - licence enforcement', () => {
  it('rejects a Met object that is not public domain', () => {
    expect(normalizeArtwork({ ...metOk(), isPublicDomain: false }, 'met')).toBeNull();
    expect(normalizeArtwork({ ...metOk(), isPublicDomain: 'true' }, 'met')).toBeNull();
  });

  it('rejects a CMA artwork that is not CC0', () => {
    expect(normalizeArtwork({ ...cmaOk(), share_license_status: 'CC BY' }, 'cma')).toBeNull();
  });
});
