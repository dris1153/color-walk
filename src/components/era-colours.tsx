import { useEffect, useState } from 'react';
import { loadEras, type EraRow } from '../lib/eras-client';
import { BUCKET_WIDTH, hslToHex } from '../lib/color-math';
import { BUCKET_COLOR_NAMES } from '../lib/color-name-table';
import { eraLabel } from '../lib/facets';

type Props = {
  /** A hue bucket's centre and an era, or just an era when the row itself is chosen. */
  onPick: (hue: number | null, era: string) => void;
  onClose: () => void;
};

const GREY = '#8a8a8a';

/**
 * The colour of each era: one band per era, each hue as wide as its share of
 * that era's works, in wheel order so the bands line up and can be compared.
 */
export function EraColours({ onPick, onClose }: Props) {
  const [rows, setRows] = useState<EraRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stale = false;
    loadEras().then(
      (loaded) => !stale && setRows(loaded),
      () => !stale && setFailed(true),
    );
    return () => {
      stale = true;
    };
  }, []);

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-2 py-4" aria-label="The colour of each era">
      <p className="mb-2 text-center font-mono text-xs tracking-widest uppercase text-ink/70">
        The colour of each era. Click a band to browse it.
      </p>
      {failed && <p className="text-center font-mono text-xs text-ink/50">Could not load the eras.</p>}
      {!rows && !failed && <p className="text-center font-mono text-xs text-ink/50">Loading</p>}
      {rows?.map((row) => (
        <div key={row.id} className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onPick(null, row.id)}
            disabled={row.n === 0}
            className="w-28 shrink-0 text-right font-mono text-[11px] tracking-widest uppercase text-ink/70 hover:text-ink disabled:text-ink/25"
          >
            {eraLabel(row.id)}
          </button>
          <div className="flex h-7 min-w-0 flex-1 overflow-hidden border border-ink/10" role="group" aria-label={`${eraLabel(row.id)}, ${row.n} works`}>
            {row.h.map((count, bucket) =>
              count === 0 ? null : (
                <button
                  key={bucket}
                  type="button"
                  onClick={() => onPick(Math.round(bucket * BUCKET_WIDTH), row.id)}
                  title={`${BUCKET_COLOR_NAMES[bucket]}: ${count}`}
                  aria-label={`${BUCKET_COLOR_NAMES[bucket]} in the ${eraLabel(row.id)}, ${count} works`}
                  className="h-full hover:brightness-125"
                  style={{ width: `${(count / row.n) * 100}%`, backgroundColor: hslToHex(bucket * BUCKET_WIDTH, 65, 50) }}
                />
              ),
            )}
            {row.g > 0 && (
              <span
                aria-hidden
                title={`Monochrome: ${row.g}`}
                className="h-full"
                style={{ width: `${(row.g / row.n) * 100}%`, backgroundColor: GREY }}
              />
            )}
          </div>
          <span className="w-14 shrink-0 font-mono text-[10px] text-ink/40">{row.n}</span>
        </div>
      ))}
      <button
        type="button"
        onClick={onClose}
        className="mt-3 self-center font-mono text-[11px] tracking-widest uppercase text-ink/50 underline underline-offset-4 hover:text-ink"
      >
        Back to browsing
      </button>
    </section>
  );
}
