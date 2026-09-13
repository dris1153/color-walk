export const ALLOWED_IMAGE_HOSTS = new Set([
  'images.metmuseum.org',
  'openaccess-cdn.clevelandart.org',
]);
// CMA's API returns bare clevelandart.org, the Met returns www. Both spellings allowed.
export const ALLOWED_PAGE_HOSTS = new Set([
  'www.metmuseum.org',
  'www.clevelandart.org',
  'clevelandart.org',
]);

const MAX_STRING = 300;
// Must start alphanumeric, so ".." and dotfiles can never become cache filenames.
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;

const clean = (x) => String(x ?? '').trim().slice(0, MAX_STRING);

function safeUrl(value, hosts) {
  if (typeof value !== 'string' || value.length === 0) return null;
  let parsed;
  try {
    // Throws on protocol-relative and malformed input; rejects javascript: below.
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (!hosts.has(parsed.hostname)) return null;
  return parsed.toString();
}

const isPlainObject = (x) => typeof x === 'object' && x !== null && !Array.isArray(x);

function positiveBytes(x) {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function normalizeMet(raw) {
  if (!isPlainObject(raw)) return null;
  if (!Number.isInteger(raw.objectID) || raw.objectID <= 0) return null;
  if (raw.isPublicDomain !== true) return null;

  const thumb = safeUrl(raw.primaryImageSmall, ALLOWED_IMAGE_HOSTS);
  if (!thumb) return null;
  const big = safeUrl(raw.primaryImage, ALLOWED_IMAGE_HOSTS) ?? thumb;
  const page = safeUrl(raw.objectURL, ALLOWED_PAGE_HOSTS);
  if (!page) return null;

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
  };
}

function normalizeCma(raw) {
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
  };
}

/**
 * The only place untrusted API data becomes an Item. Returns null on any
 * violation and never throws, so a bad record costs one dropped row.
 */
export function normalizeArtwork(raw, src) {
  if (src === 'met') return normalizeMet(raw);
  if (src === 'cma') return normalizeCma(raw);
  return null;
}
