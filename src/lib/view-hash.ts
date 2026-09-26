import { clampTone, type HueSelection } from './color-math';
import { isEra, isKind, isRegion } from './facets';

export type ViewState = {
  hue: HueSelection;
  tone: number | null;
  /** Facet filters; absent rather than null, so a link without them reads as v1 did. */
  kind?: string;
  era?: string;
  region?: string;
};

/** Hash keys for the facets. An id the build never wrote is dropped, not shown. */
const FACET_KEYS = [
  ['kind', 'k', isKind],
  ['era', 'e', isEra],
  ['region', 'r', isRegion],
] as const;

const clampHue = (value: string | null): number | null => {
  if (value === null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(359, Math.max(0, Math.round(n)));
};

const parseTone = (value: string | null): number | null => {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? clampTone(n) : null;
};

/**
 * Kept pure and separate from the hook so it can be tested without a DOM.
 * `#h=212`, `#h=all`, `#h=grey`, `#h=212&l=30` and `#l=30` are all reachable,
 * and any of them can carry `&k=ceramic&e=1600&r=europe`.
 */
export function parseViewHash(hash: string): ViewState {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const rawHue = params.get('h');
  const view: ViewState = {
    hue:
      rawHue === null || rawHue === 'all' ? null
      : rawHue === 'grey' ? 'grey'
      : clampHue(rawHue),
    // Clamped to the same range the slider offers, so an old link cannot leave
    // the readout showing one value while the sort uses another.
    tone: parseTone(params.get('l')),
  };
  for (const [field, key, valid] of FACET_KEYS) {
    const value = params.get(key);
    if (valid(value)) view[field] = value;
  }
  return view;
}

/**
 * `l` and the facets are omitted when unset, so a plain view writes the exact
 * string v1 wrote and existing links keep round-tripping unchanged.
 */
export function formatViewHash(view: ViewState): string {
  let out = `#h=${view.hue === null ? 'all' : view.hue}`;
  if (view.tone !== null) out += `&l=${view.tone}`;
  for (const [field, key] of FACET_KEYS) {
    const value = view[field];
    if (value) out += `&${key}=${encodeURIComponent(value)}`;
  }
  return out;
}

/** `/c/210` and `/c/grey` are real pages so a shared link previews as that
 *  colour; only bucket centres have one. The fragment wins when both are set,
 *  because it is the more specific of the two. */
export function parseViewLocation(pathname: string, hash: string): ViewState {
  const fromHash = parseViewHash(hash);
  if (/(^|[#&])[hl]=/.test(hash)) return fromHash;
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length !== 2 || parts[0] !== 'c') return fromHash;
  const slug = parts[1]!;
  const n = Number(slug);
  const hue = slug === 'grey' ? 'grey' : Number.isInteger(n) && n >= 0 && n < 360 ? n : undefined;
  // A facet-only fragment narrows the page's own colour rather than replacing it.
  return hue === undefined ? fromHash : { ...fromHash, hue, tone: null };
}
