import { kindFromMedium, regionFromText, yearFrom } from './facet-tables.mjs';
import { ALLOWED_IMAGE_HOSTS, ALLOWED_PAGE_HOSTS, clean, facetFields, isPlainObject, safeUrl } from './normalize-shared.mjs';

const KIND = { Painting: 'painting', Sculpture: 'sculpture' };

export function normalizeNga(raw) {
  if (!isPlainObject(raw)) return null;
  const id = String(raw.objectid ?? '');
  if (!/^\d{1,10}$/.test(id)) return null;
  const base = typeof raw.iiifurl === 'string' ? raw.iiifurl.replace(/\/$/, '') : '';
  if (!/^https:\/\/api\.nga\.gov\/iiif\/[0-9a-f-]{36}$/.test(base)) return null;

  const thumb = safeUrl(`${base}/full/!600,600/0/default.jpg`, ALLOWED_IMAGE_HOSTS);
  // The IIIF service itself, so the zoom viewer loads tiles, not the master file.
  const big = safeUrl(`${base}/info.json`, ALLOWED_IMAGE_HOSTS);
  const page = safeUrl(`https://www.nga.gov/collection/art-object-page.${id}.html`, ALLOWED_PAGE_HOSTS);
  if (!thumb || !big || !page) return null;

  return {
    id: `nga-${id}`,
    src: 'nga',
    t: clean(raw.title) || 'Untitled',
    a: clean(raw.attribution) || 'Unknown artist',
    d: clean(raw.displaydate),
    thumb,
    big,
    bigBytes: null,
    page,
    credit: clean(raw.creditline),
    ...facetFields({
      year: yearFrom(raw.beginyear, raw.endyear),
      kind: KIND[raw.classification] ?? kindFromMedium(raw.medium) ?? 'other',
      region: regionFromText(raw.nationality),
    }),
  };
}
