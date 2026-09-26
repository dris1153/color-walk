import facets from './facets.json';

/** Year, kind and region: the build maps every museum's own vocabulary onto
 *  these lists, so the client only ever sees these ids. */
export const KINDS = facets.kinds;
export const REGIONS = facets.regions;
export const ERAS = facets.eras;

const KIND_IDS = new Set(KINDS.map((k) => k.id));
const REGION_IDS = new Set(REGIONS.map((r) => r.id));
const ERA_IDS = new Set(ERAS.map((e) => e.id));

export const isKind = (x: unknown): x is string => typeof x === 'string' && KIND_IDS.has(x);
export const isRegion = (x: unknown): x is string => typeof x === 'string' && REGION_IDS.has(x);
export const isEra = (x: unknown): x is string => typeof x === 'string' && ERA_IDS.has(x);

export const eraOf = (year: number): string | null =>
  ERAS.find((e) => year >= e.from && year < e.to)?.id ?? null;

const labelIn = (list: readonly { id: string; label: string }[], id: string | null | undefined) =>
  list.find((x) => x.id === id)?.label ?? null;
export const kindLabel = (id: string | null | undefined) => labelIn(KINDS, id);
export const regionLabel = (id: string | null | undefined) => labelIn(REGIONS, id);
export const eraLabel = (id: string | null | undefined) => labelIn(ERAS, id);

export type Filter = { kind: string | null; era: string | null; region: string | null };
export const NO_FILTER: Filter = { kind: null, era: null, region: null };

export const isFiltering = (f: Filter): boolean => f.kind !== null || f.era !== null || f.region !== null;

/** A work with no year, kind or region never matches a filter on that facet:
 *  showing an undated work under "1600s" would be a claim the index cannot back. */
export function matchesFilter(item: { y?: number; k?: string; r?: string }, f: Filter): boolean {
  if (f.kind !== null && item.k !== f.kind) return false;
  if (f.region !== null && item.r !== f.region) return false;
  if (f.era !== null && (item.y === undefined || eraOf(item.y) !== f.era)) return false;
  return true;
}
