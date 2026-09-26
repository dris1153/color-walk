/**
 * One Rijksmuseum OAI-PMH record (Europeana Data Model, RDF/XML) reduced to the
 * plain fields the index uses. The feed is regular enough for patterns, which
 * saves an XML dependency; anything missing simply comes back empty and the
 * normaliser drops the record.
 */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeEntities(text) {
  return String(text ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

const all = (xml, re) => [...xml.matchAll(re)].map((m) => m);
const resource = (xml, tag) =>
  all(xml, new RegExp(`<${tag}\\s[^>]*?rdf:resource="([^"]*)"`, 'g')).map((m) => decodeEntities(m[1]));

/** Text of every `tag`, English first where the feed says which is which. */
function texts(xml, tag) {
  const found = all(xml, new RegExp(`<${tag}(\\s[^>]*)?>([^<]*)</${tag}>`, 'g')).map((m) => ({
    lang: (m[1] ?? '').match(/xml:lang="([^"]*)"/)?.[1] ?? '',
    text: decodeEntities(m[2]).trim(),
  }));
  return [...found.filter((f) => f.lang === 'en'), ...found.filter((f) => f.lang !== 'en')].map((f) => f.text).filter(Boolean);
}

/** The English prefLabel of the entity `about`, found anywhere in the record. */
function labelOf(xml, element, about) {
  const block = xml.match(new RegExp(`<${element}\\s+rdf:about="${about.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>([\\s\\S]*?)</${element}>`));
  return block ? (texts(block[1], 'skos:prefLabel')[0] ?? '') : '';
}

const DUTCH = /\b(de|het|een|met|van|op|bij|en|voor|naar|uit|aan|in het)\b/gi;
const ENGLISH = /\b(the|with|of|a|and|at|on|in the|by)\b/gi;

/** The feed tags Dutch titles as English and the reverse, so the title is the
 *  one that reads most like English, the first on a tie. */
export function pickTitle(titles) {
  let best = titles[0] ?? '';
  let bestScore = Infinity;
  for (const t of titles) {
    const score = (t.match(DUTCH)?.length ?? 0) - (t.match(ENGLISH)?.length ?? 0);
    if (score < bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best;
}

export function parseEdmRecord(record) {
  const id = (record.match(/<identifier>([^<]*)<\/identifier>/) ?? [])[1] ?? '';
  const deleted = /<header[^>]*status="deleted"/.test(record);
  const cho = (record.match(/<edm:ProvidedCHO[\s\S]*?<\/edm:ProvidedCHO>/) ?? [])[0] ?? '';
  // Image, page and rights come from the aggregation only: a WebResource can
  // carry its own rights, and the object's are the ones that count.
  const aggregation = (record.match(/<ore:Aggregation[\s\S]*?<\/ore:Aggregation>/) ?? [])[0] ?? '';
  const creator = resource(cho, 'dc:creator')[0];
  return {
    id,
    deleted,
    sets: all(record, /<setSpec>([^<]*)<\/setSpec>/g).map((m) => m[1]),
    objectNumber: texts(cho, 'dc:identifier')[0] ?? '',
    title: pickTitle(texts(cho, 'dc:title')),
    creator: creator ? labelOf(record, 'edm:Agent', creator) : '',
    created: texts(cho, 'dcterms:created')[0] ?? '',
    credit: texts(cho, 'mrel:spn')[0] ?? '',
    places: resource(cho, 'dcterms:spatial').map((p) => labelOf(record, 'edm:Place', p)).filter(Boolean),
    image: resource(aggregation, 'edm:isShownBy')[0] ?? '',
    page: resource(aggregation, 'edm:isShownAt')[0] ?? '',
    rights: resource(aggregation, 'edm:rights')[0] ?? '',
  };
}

/**
 * The records on one ListRecords page, and the token for the next, if any.
 * An OAI error (an expired token, say) throws: read as an empty last page it
 * would end the set quietly with the rest of it missing.
 */
export function parseListRecords(xml) {
  const error = xml.match(/<error\s+code="([^"]*)"/)?.[1];
  if (error === 'noRecordsMatch') return { records: [], token: null, size: 0 };
  if (error) throw new Error(`oai error ${error}`);
  const records = xml.split(/<record[\s>]/).slice(1).map((r) => parseEdmRecord(r));
  const token = decodeEntities((xml.match(/<resumptionToken[^>]*>([^<]+)</) ?? [])[1] ?? '').trim();
  const size = Number((xml.match(/completeListSize="(\d+)"/) ?? [])[1]);
  return { records, token: token || null, size: Number.isFinite(size) ? size : null };
}
