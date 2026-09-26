/**
 * How the works look, as opposed to which works appear. Filters live in the
 * URL and can be shared; these are the reader's own and live in their browser.
 */
export const VISIONS = ['', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'] as const;
export const PICTURES = ['original', 'squint', 'swatches'] as const;
export const SIZES = ['S', 'M', 'L'] as const;

export type Vision = (typeof VISIONS)[number];
export type Pictures = (typeof PICTURES)[number];
export type CardSize = (typeof SIZES)[number];

export type ViewSettings = {
  vision: Vision;
  pictures: Pictures;
  /** The palette strip on every card, not only on hover. */
  palette: boolean;
  /** Titles on every card, not only on hover. */
  titles: boolean;
  size: CardSize;
};

export const DEFAULT_VIEW: ViewSettings = { vision: '', pictures: 'original', palette: false, titles: false, size: 'M' };

/** Smaller cards are more columns; larger, fewer. */
export const SIZE_COLUMN_DELTA: Record<CardSize, number> = { S: 1, M: 0, L: -1 };

const KEY = 'cw:view';
const oneOf = <T extends string>(list: readonly T[], x: unknown, fallback: T): T =>
  (list as readonly unknown[]).includes(x) ? (x as T) : fallback;

/** Stored settings come back through a gate: another tab or an extension may have edited them. */
export function parseViewSettings(raw: unknown): ViewSettings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_VIEW;
  const r = raw as Record<string, unknown>;
  return {
    vision: oneOf(VISIONS, r.vision, DEFAULT_VIEW.vision),
    pictures: oneOf(PICTURES, r.pictures, DEFAULT_VIEW.pictures),
    palette: r.palette === true,
    titles: r.titles === true,
    size: oneOf(SIZES, r.size, DEFAULT_VIEW.size),
  };
}

/** How many settings differ from the default, for the dot on the View button. */
export const changedCount = (s: ViewSettings): number =>
  (Object.keys(DEFAULT_VIEW) as (keyof ViewSettings)[]).filter((k) => s[k] !== DEFAULT_VIEW[k]).length;

export function readViewSettings(): ViewSettings {
  try {
    return parseViewSettings(JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null'));
  } catch {
    return DEFAULT_VIEW;
  }
}

export function writeViewSettings(s: ViewSettings): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(s));
  } catch {
    /* blocked site data: the settings last for this visit only */
  }
}
