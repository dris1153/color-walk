import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeEntities, parseListRecords, pickTitle } from '../parse-edm-record.mjs';

const page = readFileSync(path.join(import.meta.dirname, 'fixtures', 'rijks-oai-page.xml'), 'utf8');

describe('parseListRecords on a real Rijksmuseum page', () => {
  const { records, token, size } = parseListRecords(page);

  it('reads the paging state', () => {
    expect(records).toHaveLength(1);
    expect(size).toBe(1515);
    expect(token).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it('reads the fields the index uses', () => {
    expect(records[0]).toMatchObject({
      id: 'https://id.rijksmuseum.nl/200112191',
      deleted: false,
      objectNumber: 'BK-18748',
      title: 'Plaque with a View of Overschie near Rotterdam',
      creator: 'Frederik van Frytom',
      created: 'c. 1670 - c. 1700',
      places: ['Delft'],
      image: 'https://iiif.micr.io/zNDdr/full/max/0/default.jpg',
      rights: 'http://creativecommons.org/publicdomain/mark/1.0/',
    });
    expect(records[0]!.sets).toContain('260242');
  });
});

describe('pickTitle', () => {
  it('prefers the title that reads as English, whatever the feed tagged it', () => {
    expect(pickTitle(['Plaat met een gezicht op Overschie', 'Plaque with a View of Overschie'])).toBe(
      'Plaque with a View of Overschie',
    );
    expect(pickTitle(['Cat at Play', 'Katjesspel'])).toBe('Cat at Play');
    expect(pickTitle(["Apen in een kooi, genaamd 'Heimwee'"])).toBe("Apen in een kooi, genaamd 'Heimwee'");
    expect(pickTitle([])).toBe('');
  });
});

describe('decodeEntities', () => {
  it('decodes named and numeric entities and nothing else', () => {
    expect(decodeEntities('Henri&#235;tte &amp; co &#x2013; &lt;b&gt;')).toBe('Henriëtte & co – <b>');
    expect(decodeEntities('&nonsense;')).toBe('&nonsense;');
  });
});

describe('parseListRecords on an OAI error', () => {
  it('throws on an expired token rather than ending the set quietly', () => {
    expect(() => parseListRecords('<OAI-PMH><error code="badResumptionToken">expired</error></OAI-PMH>')).toThrow(
      /badResumptionToken/,
    );
  });

  it('reads "no records" as an empty set', () => {
    expect(parseListRecords('<OAI-PMH><error code="noRecordsMatch"/></OAI-PMH>')).toEqual({ records: [], token: null, size: 0 });
  });

  it('takes rights from the aggregation, not from a web resource', () => {
    const xml = page.replace(
      '<edm:WebResource rdf:about=',
      '<edm:WebResource><edm:rights rdf:resource="http://rightsstatements.org/vocab/InC/1.0/"/></edm:WebResource><edm:WebResource rdf:about=',
    );
    expect(parseListRecords(xml).records[0]!.rights).toBe('http://creativecommons.org/publicdomain/mark/1.0/');
  });
});
