import { writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * One small file that reaches every corner of the collection. The bucket files
 * are organised for browsing one hue at a time, so anything that needs to move
 * across hues - a walk from one colour to another, a game drawing fair pairs -
 * would otherwise have to fetch a dozen of them. This is 187 works in 11 kB.
 */
export const SPINE_HUE_STEPS = 72;
export const SPINE_TONE_BANDS = 5;
export const SPINE_NEUTRAL_STEPS = 20;

const HUE_STEP = 360 / SPINE_HUE_STEPS;
const TONE_STEP = 100 / SPINE_TONE_BANDS;

/** The work that most reads as its cell's colour, rather than merely sitting in it. */
const readsAsColour = (item) => item.sat * item.pct;

export const spineHueCell = (hue) => Math.floor(hue / HUE_STEP) % SPINE_HUE_STEPS;
export const spineToneBand = (lig) => Math.min(SPINE_TONE_BANDS - 1, Math.floor(lig / TONE_STEP));
export const spineNeutralStep = (lig) =>
  Math.min(SPINE_NEUTRAL_STEPS - 1, Math.floor((lig / 100) * SPINE_NEUTRAL_STEPS));

function bestPerCell(items, cellOf, scoreOf) {
  const best = new Map();
  for (const item of items) {
    const cell = cellOf(item);
    const current = best.get(cell);
    const score = scoreOf(item);
    // Tie-broken by id so a rebuild cannot reshuffle equal works.
    if (!current || score > current.score || (score === current.score && item.id < current.item.id)) {
      best.set(cell, { item, score });
    }
  }
  return best;
}

export function buildSpine(items, neutrals) {
  const coloured = bestPerCell(
    items,
    (i) => `${spineHueCell(i.hue)}:${spineToneBand(i.lig)}`,
    readsAsColour,
  );
  const grey = bestPerCell(neutrals, (i) => spineNeutralStep(i.lig), (i) => i.pct);

  const byHueThenTone = (a, b) => a.hue - b.hue || a.lig - b.lig || a.id.localeCompare(b.id);
  return [
    ...[...coloured.values()].map((c) => c.item).sort(byHueThenTone),
    // Neutrals last and in tone order: they have no hue to sort by.
    ...[...grey.values()].map((c) => c.item).sort((a, b) => a.lig - b.lig || a.id.localeCompare(b.id)),
  ];
}

export async function writeSpineFile(items, neutrals, outDir) {
  const spine = buildSpine(items, neutrals);
  await writeFile(
    path.join(outDir, 'spine.json'),
    JSON.stringify({
      count: spine.length,
      hueSteps: SPINE_HUE_STEPS,
      toneBands: SPINE_TONE_BANDS,
      items: spine,
    }),
  );
  return spine.length;
}
