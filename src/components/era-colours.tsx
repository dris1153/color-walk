import { useEffect, useState } from 'react';
import { loadEras, type EraRow } from '../lib/eras-client';
import { signatureOf } from '../lib/era-signature';
import { BUCKET_WIDTH, hslToHex } from '../lib/color-math';
import { BUCKET_COLOR_NAMES } from '../lib/color-name-table';
import { eraLabel } from '../lib/facets';
import type { Item } from '../lib/color-index-client';
import { ColourHistory } from './colour-history';

type Props = {
  /** The bucket the history opens on: the wheel's hue, if one is chosen. */
  initialBucket: number;
  /** A hue bucket's centre and an era, or just an era when the row itself is chosen. */
  onPick: (hue: number | null, era: string) => void;
  onOpen: (item: Item) => void;
  onClose: () => void;
};

const GREY = '#8a8a8a';
const swatch = (bucket: number) => hslToHex(bucket * BUCKET_WIDTH, 65, 50);

/**
 * The colour of each era: one band per era, each hue as wide as its share of
 * that era's works, in wheel order so the bands line up and can be compared.
 * Every band is mostly orange, so each also names its signature: the hue that
 * era has far more of than the collection as a whole.
 */
export function EraColours({ initialBucket, onPick, onOpen, onClose }: Props) {
  const [rows, setRows] = useState<EraRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [bucket, setBucket] = useState(initialBucket);

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
    <section className="mx-auto flex max-w-4xl flex-col gap-2 py-4" aria-label="The colour of each era">
      {failed && <p className="text-center font-mono text-xs text-ink/50">Could not load the eras.</p>}
      {!rows && !failed && <p className="text-center font-mono text-xs text-ink/50">Loading</p>}
      {rows && <ColourHistory rows={rows} bucket={bucket} onBucket={setBucket} onOpen={onOpen} />}
      {rows && (
        <p className="mb-2 text-center font-mono text-xs tracking-widest uppercase text-ink/70">
          The colour of each era. Click a band to browse it.
        </p>
      )}
      {rows?.map((row) => {
        const signature = signatureOf(row, rows);
        return (
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
              {row.h.map((count, b) =>
                count === 0 ? null : (
                  <button
                    key={b}
                    type="button"
                    onClick={() => onPick(Math.round(b * BUCKET_WIDTH), row.id)}
                    title={`${BUCKET_COLOR_NAMES[b]}: ${count}`}
                    aria-label={`${BUCKET_COLOR_NAMES[b]} in the ${eraLabel(row.id)}, ${count} works`}
                    className="h-full hover:brightness-125"
                    style={{ width: `${(count / row.n) * 100}%`, backgroundColor: swatch(b) }}
                  />
                ),
              )}
              {row.g > 0 && (
                <span aria-hidden title={`Monochrome: ${row.g}`} className="h-full" style={{ width: `${(row.g / row.n) * 100}%`, backgroundColor: GREY }} />
              )}
            </div>
            <span className="w-12 shrink-0 font-mono text-[10px] text-ink/40">{row.n}</span>
            {signature ? (
              <button
                type="button"
                onClick={() => setBucket(signature.bucket)}
                title={`${signature.count} works, ${signature.lift.toFixed(1)} times the collection's share`}
                className="flex w-32 shrink-0 items-center gap-1.5 text-left font-mono text-[10px] text-ink/60 hover:text-ink"
              >
                <span aria-hidden className="h-3 w-3 shrink-0" style={{ backgroundColor: swatch(signature.bucket) }} />
                {BUCKET_COLOR_NAMES[signature.bucket]} &times;{signature.lift.toFixed(1)}
              </button>
            ) : (
              <span className="w-32 shrink-0" />
            )}
          </div>
        );
      })}
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
