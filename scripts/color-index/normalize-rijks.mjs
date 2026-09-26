import { regionFromText, yearFromText } from './facet-tables.mjs';
import { ALLOWED_IMAGE_HOSTS, ALLOWED_PAGE_HOSTS, SAFE_ID, clean, facetFields, isPlainObject, safeUrl } from './normalize-shared.mjs';

/** Public Domain Mark or CC0; the feed also serves in-copyright images (InC). */
const OPEN = /^https?:\/\/creativecommons\.org\/publicdomain\/(mark|zero)\/1\.0\/?$/;

/** What each harvested set is, where the record itself does not say. */
const SET_KIND = { 261208: 'painting', 260242: 'ceramic', 261188: 'ceramic', 261234: 'ceramic', 26191: 'ceramic' };
const SET_REGION = { 261234: 'east-asia', 26191: 'west-asia', 260242: 'europe', 261188: 'europe', 261208: 'europe' };

const firstOf = (sets, table) => sets.map((s) => table[s]).find(Boolean) ?? null;

/** `https://iiif.micr.io/zNDdr/full/max/0/default.jpg` -> `https://iiif.micr.io/zNDdr`. */
const iiifBase = (url) => {
  const base = url.replace(/\/full\/[^/]+\/\d+\/default\.jpg$/, '');
  return base !== url && /^https:\/\/iiif\.micr\.io\/[A-Za-z0-9]+$/.test(base) ? base : null;
};

export function normalizeRijks(raw) {
  if (!isPlainObject(raw) || raw.deleted) return null;
  if (!OPEN.test(String(raw.rights ?? ''))) return null;

  const objectNumber = clean(raw.objectNumber);
  if (!SAFE_ID.test(objectNumber)) return null;
  const base = typeof raw.image === 'string' ? iiifBase(raw.image) : null;
  if (!base) return null;
  const thumb = safeUrl(`${base}/full/!600,600/0/default.jpg`, ALLOWED_IMAGE_HOSTS);
  // The IIIF service itself: the zoom viewer walks its tiles instead of
  // downloading a 100-megapixel master.
  const big = safeUrl(`${base}/info.json`, ALLOWED_IMAGE_HOSTS);
  const page = safeUrl(raw.page, ALLOWED_PAGE_HOSTS);
  if (!thumb || !big || !page) return null;

  const sets = Array.isArray(raw.sets) ? raw.sets.map(String) : [];
  const places = Array.isArray(raw.places) ? raw.places.join(' | ') : '';
  return {
    id: `rijks-${objectNumber}`,
    src: 'rijks',
    t: clean(raw.title) || 'Untitled',
    a: clean(raw.creator) || 'Unknown artist',
    d: clean(raw.created),
    thumb,
    big,
    bigBytes: null,
    page,
    credit: clean(raw.credit),
    ...facetFields({
      year: yearFromText(raw.created),
      kind: firstOf(sets, SET_KIND) ?? 'other',
      region: regionFromText(places) ?? firstOf(sets, SET_REGION),
    }),
  };
}
