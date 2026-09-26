import { metKind, regionOf, yearFrom } from './facet-tables.mjs';
import { ALLOWED_IMAGE_HOSTS, ALLOWED_PAGE_HOSTS, clean, facetFields, isPlainObject, safeUrl } from './normalize-shared.mjs';

export function normalizeMet(raw) {
  if (!isPlainObject(raw)) return null;
  if (!Number.isInteger(raw.objectID) || raw.objectID <= 0) return null;
  if (raw.isPublicDomain !== true) return null;

  const thumb = safeUrl(raw.primaryImageSmall, ALLOWED_IMAGE_HOSTS);
  if (!thumb) return null;
  const big = safeUrl(raw.primaryImage, ALLOWED_IMAGE_HOSTS) ?? thumb;
  const page = safeUrl(raw.objectURL, ALLOWED_PAGE_HOSTS);
  if (!page) return null;

  const words = [raw.culture, raw.country, raw.region, raw.subregion, raw.artistNationality].join(' | ');
  return {
    id: `met-${raw.objectID}`,
    src: 'met',
    t: clean(raw.title) || 'Untitled',
    a: clean(raw.artistDisplayName) || 'Unknown artist',
    d: clean(raw.objectDate),
    thumb,
    big,
    bigBytes: null, // filled by a HEAD request in download-thumbnails
    page,
    credit: clean(raw.creditLine),
    ...facetFields({
      year: yearFrom(raw.objectBeginDate, raw.objectEndDate),
      kind: metKind(raw),
      region: regionOf(raw.department, words),
    }),
  };
}
