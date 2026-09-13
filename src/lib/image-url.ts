export const ALLOWED_IMAGE_HOSTS = [
  'images.metmuseum.org',
  'openaccess-cdn.clevelandart.org',
] as const;

// CMA's API returns bare clevelandart.org, the Met returns www. Both spellings allowed.
export const ALLOWED_PAGE_HOSTS = [
  'www.metmuseum.org',
  'www.clevelandart.org',
  'clevelandart.org',
] as const;

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

export const bucketFileUrl = (b: number | null): string =>
  b === null ? '/index/all.json' : `/index/bucket-${String(b).padStart(2, '0')}.json`;
