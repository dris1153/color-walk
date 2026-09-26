// Kept in step with src/lib/image-url.ts and the CSP in vercel.json.
export const ALLOWED_IMAGE_HOSTS = new Set([
  'images.metmuseum.org',
  'openaccess-cdn.clevelandart.org',
  'iiif.micr.io',
  'api.nga.gov',
]);
// CMA's API returns bare clevelandart.org, the Met returns www. Both spellings allowed.
export const ALLOWED_PAGE_HOSTS = new Set([
  'www.metmuseum.org',
  'www.clevelandart.org',
  'clevelandart.org',
  'www.rijksmuseum.nl',
  'www.nga.gov',
]);

const MAX_STRING = 300;
// Must start alphanumeric, so ".." and dotfiles can never become cache filenames.
export const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;

export const clean = (x) => String(x ?? '').trim().slice(0, MAX_STRING);

export function safeUrl(value, hosts) {
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

export const isPlainObject = (x) => typeof x === 'object' && x !== null && !Array.isArray(x);

export function positiveBytes(x) {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Year, kind and region ride on the item only when known, so an undated work
 *  costs no bytes and never claims a year it does not have. */
export const facetFields = ({ year, kind, region }) => ({
  ...(year !== null && year !== undefined && { y: year }),
  ...(kind && { k: kind }),
  ...(region && { r: region }),
});
