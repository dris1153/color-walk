import { cmaKind, regionOf, yearFrom, yearFromText } from './facet-tables.mjs';
import {
  ALLOWED_IMAGE_HOSTS,
  ALLOWED_PAGE_HOSTS,
  SAFE_ID,
  clean,
  facetFields,
  isPlainObject,
  positiveBytes,
  safeUrl,
} from './normalize-shared.mjs';

export function normalizeCma(raw) {
  if (!isPlainObject(raw)) return null;
  if (raw.share_license_status !== 'CC0') return null;

  const accession = clean(raw.accession_number);
  if (!SAFE_ID.test(accession)) return null;

  const images = raw.images;
  if (!isPlainObject(images)) return null;
  const web = isPlainObject(images.web) ? images.web : null;
  const print = isPlainObject(images.print) ? images.print : null;

  const thumb = safeUrl(web?.url, ALLOWED_IMAGE_HOSTS);
  if (!thumb) return null;
  const printUrl = safeUrl(print?.url, ALLOWED_IMAGE_HOSTS);
  const big = printUrl ?? thumb;
  const bigBytes = positiveBytes(printUrl ? print?.filesize : web?.filesize);

  const page = safeUrl(raw.url, ALLOWED_PAGE_HOSTS);
  if (!page) return null;

  const creators = Array.isArray(raw.creators) ? raw.creators : [];
  const artist = isPlainObject(creators[0]) ? clean(creators[0].description) : '';
  const culture = Array.isArray(raw.culture) ? raw.culture.join(' | ') : clean(raw.culture);

  return {
    id: `cma-${accession}`,
    src: 'cma',
    t: clean(raw.title) || 'Untitled',
    a: artist || 'Unknown artist',
    d: clean(raw.creation_date),
    thumb,
    big,
    bigBytes,
    page,
    credit: clean(raw.creditline),
    ...facetFields({
      // The numeric pair arrived with the second cache; older records have
      // only the free-text date, which still carries the years.
      year: yearFrom(raw.creation_date_earliest, raw.creation_date_latest) ?? yearFromText(raw.creation_date),
      kind: cmaKind(raw),
      region: regionOf(raw.department, `${culture} | ${artist}`),
    }),
  };
}
