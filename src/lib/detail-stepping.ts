/** Within this many of the last work on screen, a step forward asks for more. */
export const NEAR_END = 5;

export type Neighbours<T> = { index: number; prev: T | null; next: T | null };

/**
 * Where a work sits in the order being browsed, and what lies either side. A
 * work opened from elsewhere (a twin, a search result) is not in that order,
 * and then there is nothing to step to.
 */
export function neighbours<T extends { id: string }>(
  items: readonly T[],
  id: string,
): Neighbours<T> {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return { index, prev: null, next: null };
  return { index, prev: items[index - 1] ?? null, next: items[index + 1] ?? null };
}

/** True once a position is within NEAR_END of the end of what is shown. */
export const nearEnd = (index: number, shown: number): boolean =>
  index >= 0 && index + NEAR_END >= shown;
