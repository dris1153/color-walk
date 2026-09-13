/**
 * Greedy shortest-column-first packing. Columns are equal width, so an item's
 * cost is its aspect ratio h/w; ties go to the leftmost column, which keeps the
 * order stable and the reading direction natural.
 */
export function distributeToColumns<T extends { w: number; h: number }>(
  items: readonly T[],
  n: number,
): T[][] {
  if (n <= 0) return [];
  const columns: T[][] = Array.from({ length: n }, () => []);
  const heights = new Array<number>(n).fill(0);

  for (const item of items) {
    let target = 0;
    for (let i = 1; i < n; i++) {
      if ((heights[i] as number) < (heights[target] as number)) target = i;
    }
    (columns[target] as T[]).push(item);
    const w = item.w > 0 ? item.w : 1;
    const h = item.h > 0 ? item.h : 1;
    heights[target] = (heights[target] as number) + h / w;
  }
  return columns;
}
