import { clampTone, type HueSelection } from './color-math';

export type ViewState = {
  hue: HueSelection;
  tone: number | null;
};

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
 * `#h=212`, `#h=all`, `#h=grey`, `#h=212&l=30` and `#l=30` are all reachable.
 */
export function parseViewHash(hash: string): ViewState {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const rawHue = params.get('h');
  return {
    hue:
      rawHue === null || rawHue === 'all' ? null
      : rawHue === 'grey' ? 'grey'
      : clampHue(rawHue),
    // Clamped to the same range the slider offers, so an old link cannot leave
    // the readout showing one value while the sort uses another.
    tone: parseTone(params.get('l')),
  };
}

/**
 * `l` is omitted entirely when no tone is set, so a tone-free view writes the
 * exact string v1 wrote and existing links keep round-tripping unchanged.
 */
export function formatViewHash({ hue, tone }: ViewState): string {
  const base = `#h=${hue === null ? 'all' : hue}`;
  return tone === null ? base : `${base}&l=${tone}`;
}

/** `/c/210` and `/c/grey` are real pages so a shared link previews as that
 *  colour; only bucket centres have one. The fragment wins when both are set,
 *  because it is the more specific of the two. */
export function parseViewLocation(pathname: string, hash: string): ViewState {
  if (hash.includes('h=') || hash.includes('l=')) return parseViewHash(hash);
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length !== 2 || parts[0] !== 'c') return parseViewHash(hash);
  const slug = parts[1]!;
  if (slug === 'grey') return { hue: 'grey', tone: null };
  const n = Number(slug);
  return Number.isInteger(n) && n >= 0 && n < 360 ? { hue: n, tone: null } : parseViewHash(hash);
}
