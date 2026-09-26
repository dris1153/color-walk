import { describe, expect, it } from 'vitest';
import { normalizeArtwork } from '../normalize-artwork.mjs';
import { parseArgs } from '../build-args.mjs';

const rijksOk = () => ({
  id: 'https://id.rijksmuseum.nl/200112191',
  deleted: false,
  sets: ['260242', '261188'],
  objectNumber: 'BK-18748',
  title: 'Plaque with a View of Overschie near Rotterdam',
  creator: 'Frederik van Frytom',
  created: 'c. 1670 - c. 1700',
  credit: '',
  places: ['Delft'],
  image: 'https://iiif.micr.io/zNDdr/full/max/0/default.jpg',
  page: 'https://www.rijksmuseum.nl/nl/collectie/object/BK-18748--c0f3b5141ed8abdeb9e646569f43f6b4',
  rights: 'http://creativecommons.org/publicdomain/mark/1.0/',
});

const ngaOk = () => ({
  objectid: '46159',
  title: 'Woman Holding a Balance',
  attribution: 'Johannes Vermeer',
  displaydate: 'c. 1664',
  beginyear: '1662',
  endyear: '1665',
  medium: 'oil on canvas',
  classification: 'Painting',
  creditline: 'Widener Collection',
  iiifurl: 'https://api.nga.gov/iiif/00007f61-4922-417b-8f27-893ea328206c',
  nationality: 'Dutch',
});

describe('normalizeArtwork - Rijksmuseum', () => {
  it('maps a record to an item served by IIIF', () => {
    const item = normalizeArtwork(rijksOk(), 'rijks');
    expect(item).toMatchObject({
      id: 'rijks-BK-18748',
      src: 'rijks',
      a: 'Frederik van Frytom',
      thumb: 'https://iiif.micr.io/zNDdr/full/!600,600/0/default.jpg',
      big: 'https://iiif.micr.io/zNDdr/info.json',
      y: 1685,
      k: 'ceramic',
      r: 'europe',
    });
  });

  it('drops a work the feed marks as in copyright', () => {
    expect(normalizeArtwork({ ...rijksOk(), rights: 'http://rightsstatements.org/vocab/InC/1.0/' }, 'rijks')).toBeNull();
  });

  it('drops an image or page on any other host, and a deleted record', () => {
    expect(normalizeArtwork({ ...rijksOk(), image: 'https://evil.example/zNDdr/full/max/0/default.jpg' }, 'rijks')).toBeNull();
    expect(normalizeArtwork({ ...rijksOk(), page: 'https://evil.example/x' }, 'rijks')).toBeNull();
    expect(normalizeArtwork({ ...rijksOk(), deleted: true }, 'rijks')).toBeNull();
  });

  it('takes the region from the set when the place says nothing', () => {
    const kraak = { ...rijksOk(), sets: ['261234'], places: ['Jingdezhen'] };
    expect(normalizeArtwork(kraak, 'rijks')!.r).toBe('east-asia');
  });
});

describe('normalizeArtwork - National Gallery of Art', () => {
  it('maps a joined CSV row to an item served by IIIF', () => {
    expect(normalizeArtwork(ngaOk(), 'nga')).toMatchObject({
      id: 'nga-46159',
      src: 'nga',
      a: 'Johannes Vermeer',
      thumb: 'https://api.nga.gov/iiif/00007f61-4922-417b-8f27-893ea328206c/full/!600,600/0/default.jpg',
      big: 'https://api.nga.gov/iiif/00007f61-4922-417b-8f27-893ea328206c/info.json',
      page: 'https://www.nga.gov/collection/art-object-page.46159.html',
      y: 1664,
      k: 'painting',
      r: 'europe',
    });
  });

  it('refuses an image service that is not the gallery’s', () => {
    expect(normalizeArtwork({ ...ngaOk(), iiifurl: 'https://api.nga.gov.evil.example/iiif/x' }, 'nga')).toBeNull();
    expect(normalizeArtwork({ ...ngaOk(), objectid: '../x' }, 'nga')).toBeNull();
  });
});

describe('parseArgs', () => {
  it('defaults to every museum, and keeps "both" meaning the first two', () => {
    expect(parseArgs([]).sources).toEqual(['met', 'cma', 'rijks', 'nga']);
    expect(parseArgs(['--source=both']).sources).toEqual(['met', 'cma']);
    expect(parseArgs(['--source=rijks,nga']).sources).toEqual(['rijks', 'nga']);
  });

  it('reads the new lists', () => {
    const args = parseArgs(['--met-queries=turquoise,faience', '--rijks-sets=260242', '--nga-classes=Painting']);
    expect(args.metQueries).toEqual(['turquoise', 'faience']);
    expect(args.rijksSets).toEqual(['260242']);
    expect(args.ngaClasses).toEqual(['Painting']);
  });

  it('refuses a museum it does not know', () => {
    expect(() => parseArgs(['--source=louvre'])).toThrow(/bad --source/);
  });
});
