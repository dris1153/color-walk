import { TONE_WEIGHT, circularHueDistance, normalizeHue } from './color-math';
import type { Item } from './color-index-client';

export const WALK_STEPS = 20;
/** Past this the step is a lurch rather than a step, and the walk says so. */
export const ROUGH_STEP = 30;

export type WalkPoint = { hue: number; tone: number };
export type WalkStep = { item: Item; hue: number; tone: number; gap: number };

/**
 * The shorter way round the wheel. Walking crimson to violet the long way would
 * cross every hue the collection is thin in, for no reason.
 */
export function hueDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

/**
 * A path from one colour to another, one work per step, each the closest the
 * collection has to that point and never repeated. `gap` is how far the work
 * actually sits from the step it stands in for: small is a smooth walk, large
 * means the collection has nothing there and the walk lurches. The caller shows
 * that rather than hiding it.
 */
export function buildWalk(
  pool: readonly Item[],
  from: WalkPoint,
  to: WalkPoint,
  steps = WALK_STEPS,
): WalkStep[] {
  // Monochrome works carry a placeholder hue, so they would answer for any
  // colour once the real ones ran out.
  const candidates = pool.filter((item) => item.sat > 0);
  if (candidates.length === 0 || steps < 1) return [];

  const delta = hueDelta(from.hue, to.hue);
  const used = new Set<string>();
  const walk: WalkStep[] = [];

  for (let step = 0; step < steps; step++) {
    const t = steps === 1 ? 0 : step / (steps - 1);
    const hue = normalizeHue(from.hue + delta * t);
    const tone = from.tone + (to.tone - from.tone) * t;

    let best: Item | null = null;
    let bestGap = Infinity;
    for (const item of candidates) {
      if (used.has(item.id)) continue;
      const gap = circularHueDistance(item.hue, hue) + Math.abs(item.lig - tone) * TONE_WEIGHT;
      if (gap < bestGap) {
        bestGap = gap;
        best = item;
      }
    }
    if (!best) break; // the pool ran out before the path did
    used.add(best.id);
    walk.push({ item: best, hue: Math.round(hue), tone: Math.round(tone), gap: Math.round(bestGap) });
  }
  return walk;
}

/** `#h=30&l=50&walk=210,45`: the start is the view already in the hash. */
export function parseWalkTarget(hash: string): WalkPoint | null {
  const raw = new URLSearchParams(hash.replace(/^#/, '')).get('walk');
  if (raw === null) return null;
  const parts = raw.split(',').map(Number);
  if (parts.length !== 2) return null;
  const [hue, tone] = parts as [number, number];
  if (!Number.isFinite(hue) || !Number.isFinite(tone)) return null;
  return { hue: normalizeHue(hue), tone: Math.min(100, Math.max(0, tone)) };
}

export const formatWalkTarget = ({ hue, tone }: WalkPoint): string =>
  `walk=${Math.round(hue)},${Math.round(tone)}`;
