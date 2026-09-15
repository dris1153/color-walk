import { useEffect, useMemo, useState } from 'react';
import { loadComposition } from '../lib/composition-client';
import {
  CELLS,
  EMPTY_PAINT,
  PALETTE,
  searchComposition,
  type CompositionEntry,
  type Paint,
} from '../lib/composition-search';
import { hslToHex } from '../lib/color-math';
import { nearestColorName } from '../lib/color-name-table';
import { loadTwin, type Item } from '../lib/color-index-client';

type Props = {
  onOpen: (item: Item) => void;
  onClose: () => void;
};

const swatch = (hue: number) => hslToHex(hue, 70, 55);

/**
 * Paint where a colour should sit, see what the collection has arranged that
 * way. The count is shown before the results on purpose: "blue over gold" has
 * many answers and "three colours in a row" has few, and the reader should see
 * that the search is honest rather than broken.
 */
export function CompositionSearch({ onOpen, onClose }: Props) {
  const [entries, setEntries] = useState<CompositionEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [paint, setPaint] = useState<Paint>(EMPTY_PAINT);
  const [brush, setBrush] = useState<number>(PALETTE[7]!);

  useEffect(() => {
    let stale = false;
    loadComposition().then(
      (loaded) => !stale && setEntries(loaded),
      () => !stale && setFailed(true),
    );
    return () => {
      stale = true;
    };
  }, []);

  const { matches, total } = useMemo(
    () => (entries ? searchComposition(entries, paint) : { matches: [], total: 0 }),
    [entries, paint],
  );
  const painted = paint.some((p) => p !== null);

  const dab = (i: number) =>
    setPaint((p) => p.map((cell, j) => (j === i ? (cell === brush ? null : brush) : cell)));

  const open = async (entry: CompositionEntry) => {
    const item = await loadTwin({ id: entry.id, bucket: entry.bucket, page: entry.page }).catch(() => null);
    if (item) onOpen(item);
  };

  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-4 py-4" aria-label="Search by arrangement">
      <p className="font-mono text-xs tracking-widest uppercase text-ink/70">Where should the colour sit?</p>

      <div className="flex flex-wrap justify-center gap-1.5" role="radiogroup" aria-label="Brush">
        {PALETTE.map((hue) => (
          <button
            key={hue}
            type="button"
            role="radio"
            aria-checked={brush === hue}
            aria-label={nearestColorName(hue)}
            onClick={() => setBrush(hue)}
            style={{ backgroundColor: swatch(hue) }}
            className="h-6 w-6 rounded-full border border-ink/20 aria-checked:border-ink aria-checked:ring-1 aria-checked:ring-ink"
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1" role="group" aria-label="The frame, top to bottom">
        {Array.from({ length: CELLS }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => dab(i)}
            aria-label={paint[i] === null ? `cell ${i + 1}, empty` : `cell ${i + 1}, ${nearestColorName(paint[i]!)}`}
            style={paint[i] === null ? undefined : { backgroundColor: swatch(paint[i]!) }}
            className="h-14 w-14 border border-ink/20 hover:border-ink/60"
          />
        ))}
      </div>

      <p className="font-mono text-xs text-ink/70" role="status">
        {failed ? 'Could not load the collection.'
        : !entries ? 'Loading...'
        : !painted ? 'Paint a cell to begin.'
        : `${total} ${total === 1 ? 'work' : 'works'} arranged like that`}
      </p>

      {matches.length > 0 && (
        <ul className="grid w-full grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {matches.map(({ entry }) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => void open(entry)}
                aria-label={entry.t}
                className="block aspect-square w-full overflow-hidden border border-ink/15 hover:border-ink/60"
              >
                <img src={entry.thumb} alt="" loading="lazy" className="h-full w-full object-cover" style={{ backgroundColor: entry.hex }} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3">
        {painted && (
          <button
            type="button"
            onClick={() => setPaint(EMPTY_PAINT)}
            className="border border-ink/25 px-3 py-1.5 font-mono text-[11px] tracking-widest uppercase text-ink/70 hover:text-ink"
          >
            Clear
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[11px] tracking-widest uppercase text-ink/50 underline underline-offset-4 hover:text-ink"
        >
          Back to browsing
        </button>
      </div>
    </section>
  );
}
