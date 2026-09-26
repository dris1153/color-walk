import { normalizeCma } from './normalize-cma.mjs';
import { normalizeMet } from './normalize-met.mjs';
import { normalizeNga } from './normalize-nga.mjs';
import { normalizeRijks } from './normalize-rijks.mjs';

export { ALLOWED_IMAGE_HOSTS, ALLOWED_PAGE_HOSTS } from './normalize-shared.mjs';

const BY_SOURCE = { met: normalizeMet, cma: normalizeCma, rijks: normalizeRijks, nga: normalizeNga };
export const SOURCES = Object.keys(BY_SOURCE);

/**
 * The only place untrusted API data becomes an Item. Returns null on any
 * violation and never throws, so a bad record costs one dropped row.
 */
export function normalizeArtwork(raw, src) {
  const normalize = BY_SOURCE[src];
  if (!normalize) return null;
  try {
    return normalize(raw);
  } catch {
    return null;
  }
}
