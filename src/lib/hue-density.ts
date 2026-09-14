import indexMeta from '../../public/index/meta.json';

/**
 * How many works sit in each of the 24 hue buckets, normalised to 0..1 on a log
 * scale so the orange bucket's 4,406 does not flatten everything else to a line.
 * A zero stays zero: those buckets are drawn as gaps, not hairlines.
 *
 * Baked in at build time rather than fetched, so the ring is correct on first
 * paint with no request and no loading state. The cost is that rebuilding the
 * colour index without rebuilding the bundle leaves these thicknesses slightly
 * stale, which is cosmetic only.
 */
const counts: readonly number[] = indexMeta.byBucket;
const max = Math.max(...counts);

export const HUE_SEGMENT_WEIGHTS: readonly number[] = counts.map((n) =>
  n === 0 ? 0 : Math.log10(n + 1) / Math.log10(max + 1),
);
