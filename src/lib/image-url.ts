// Kept in step with scripts/color-index/normalize-shared.mjs and the CSP in vercel.json.
export const ALLOWED_IMAGE_HOSTS = [
  'images.metmuseum.org',
  'openaccess-cdn.clevelandart.org',
  'iiif.micr.io',
  'api.nga.gov',
] as const;

// CMA's API returns bare clevelandart.org, the Met returns www. Both spellings allowed.
export const ALLOWED_PAGE_HOSTS = [
  'www.metmuseum.org',
  'www.clevelandart.org',
  'clevelandart.org',
  'www.rijksmuseum.nl',
  'www.nga.gov',
] as const;

/** A IIIF image service rather than a single file: the zoom viewer walks its tiles. */
export const isIiifService = (u: string): boolean => isAllowedImageUrl(u) && u.endsWith('/info.json');

function isAllowedOn(u: string, hosts: readonly string[]): boolean {
  let parsed: URL;
  try {
    // Rejects protocol-relative ("//host/x") and malformed input by throwing.
    parsed = new URL(u);
  } catch {
    return false;
  }
  // Exact hostname match only: a prefix test would accept images.metmuseum.org.evil.com.
  return parsed.protocol === 'https:' && hosts.includes(parsed.hostname);
}

export function isAllowedImageUrl(u: string): boolean {
  return isAllowedOn(u, ALLOWED_IMAGE_HOSTS);
}

export function isAllowedPageUrl(u: string): boolean {
  return isAllowedOn(u, ALLOWED_PAGE_HOSTS);
}

/** `null` is the all-colours sample, `'grey'` the monochrome works. */
export const bucketFileUrl = (b: number | null | 'grey'): string =>
  b === null ? '/index/all.json'
  : b === 'grey' ? '/index/neutral.json'
  : `/index/bucket-${String(b).padStart(2, '0')}.json`;
