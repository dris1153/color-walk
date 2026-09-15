import { PAGE_SIZE } from './write-bucket-files.mjs';

/**
 * Every work's nearest colour at the other museum. Measured 2026-09-15 over
 * 385 Met works: the closest CMA work sits at a median distance of 1.2, and
 * 91% are within 5 - a Chinese disk and an American hillside sharing one hex.
 *
 * Confined to the work's own bucket, so opening a twin costs at most one page
 * fetch. The price is a work at a bucket's edge missing a marginally closer
 * twin just over the line.
 */
const hueDistance = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};
export const colourDistance = (a, b) =>
  hueDistance(a.hue, b.hue) + Math.abs(a.lig - b.lig) * 0.5 + Math.abs(a.sat - b.sat) * 0.3;

/** The entry that carries the work's strongest colour, not a copy filed for a
 *  colour it merely also holds: a twin should match what the work leads with. */
export const isPrimary = (entry) => !(entry.p ?? []).some((c) => c[3] > entry.pct);

/** Map of id -> { id, bucket, page } for every primary that has a twin. */
export function findTwins(buckets) {
  const twins = new Map();
  for (const b of buckets) {
    const primaries = b.items
      .map((entry, index) => ({ entry, page: Math.floor(index / PAGE_SIZE) }))
      .filter(({ entry }) => isPrimary(entry));
    const bySource = new Map();
    for (const p of primaries) {
      if (!bySource.has(p.entry.src)) bySource.set(p.entry.src, []);
      bySource.get(p.entry.src).push(p);
    }
    for (const { entry, page: _ } of primaries) {
      let best = null;
      let bestDistance = Infinity;
      for (const [src, others] of bySource) {
        if (src === entry.src) continue;
        for (const other of others) {
          const d = colourDistance(entry, other.entry);
          if (d < bestDistance) {
            bestDistance = d;
            best = other;
          }
        }
      }
      if (best) twins.set(entry.id, { id: best.entry.id, bucket: b.bucket, page: best.page });
    }
  }
  return twins;
}

/** Every entry for a work carries its twin, copies included, so the overlay
 *  can show it from whichever bucket the work was reached through. */
export function attachTwins(buckets, twins) {
  for (const b of buckets) {
    for (const entry of b.items) {
      const twin = twins.get(entry.id);
      if (twin) entry.twin = twin;
    }
  }
}
