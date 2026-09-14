import { clampTone } from './color-math';

export type ViewState = {
  hue: number | null;
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
 * `#h=212`, `#h=all`, `#h=212&l=30` and `#l=30` are all reachable URLs.
 */
export function parseViewHash(hash: string): ViewState {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const rawHue = params.get('h');
  return {
    hue: rawHue === null || rawHue === 'all' ? null : clampHue(rawHue),
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
