import { useEffect, useMemo, useState } from 'react';
import { loadHistories, type HistoryCell } from '../lib/histories-client';
import { hueShare } from '../lib/era-signature';
import type { EraRow } from '../lib/eras-client';
import { BUCKET_COUNT, BUCKET_WIDTH, hslToHex } from '../lib/color-math';
import { BUCKET_COLOR_NAMES } from '../lib/color-name-table';
import { ERAS } from '../lib/facets';
import { loadEntry, type Item } from '../lib/color-index-client';

type Props = {
  rows: readonly EraRow[];
  bucket: number;
  onBucket: (bucket: number) => void;
  onOpen: (item: Item) => void;
};

const BUCKETS = Array.from({ length: BUCKET_COUNT }, (_, b) => b);
const percent = (share: number) =>
  share >= 0.1 ? `${Math.round(share * 100)}%`
  : share >= 0.0005 ? `${Math.round(share * 1000) / 10}%`
  : share > 0 ? '<0.1%'
  : '0%';

/** One colour through time: the work that shows it best in each era, oldest first. */
export function ColourHistory({ rows, bucket, onBucket, onOpen }: Props) {
  const [cells, setCells] = useState<HistoryCell[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stale = false;
    loadHistories().then(
      (loaded) => !stale && setCells(loaded),
      () => !stale && setFailed(true),
    );
    return () => {
      stale = true;
    };
  }, []);

  const byEra = useMemo(() => new Map((cells ?? []).filter((c) => c.h === bucket).map((c) => [c.e, c])), [cells, bucket]);
  const name = BUCKET_COLOR_NAMES[bucket];

  const open = async (cell: HistoryCell) => {
    const item = await loadEntry(cell.bucket, cell.page, cell.id).catch(() => null);
    if (item) onOpen(item);
  };

  if (failed) return <p className="text-center font-mono text-xs text-ink/50">Could not load the colour histories.</p>;

  return (
    <div className="mb-6 flex flex-col gap-3" aria-label={`The history of ${name}`}>
      <p className="text-center font-mono text-xs tracking-widest uppercase text-ink/70">
        The history of <span className="text-ink">{name}</span>, one work per era
      </p>
      <div className="flex flex-wrap justify-center gap-1" role="group" aria-label="Choose a colour">
        {BUCKETS.map((b) => (
          <button
            key={b}
            type="button"
            aria-pressed={b === bucket}
            aria-label={BUCKET_COLOR_NAMES[b]}
            title={BUCKET_COLOR_NAMES[b]}
            onClick={() => onBucket(b)}
            className="h-5 w-5 border border-ink/20 hover:border-ink/60 aria-pressed:border-2 aria-pressed:border-ink"
            style={{ backgroundColor: hslToHex(b * BUCKET_WIDTH, 65, 50) }}
          />
        ))}
      </div>
      <ol className="flex gap-2 overflow-x-auto pb-2">
        {ERAS.map((era) => {
          const cell = byEra.get(era.id);
          const row = rows.find((r) => r.id === era.id);
          const share = row ? hueShare(row, bucket) : 0;
          return (
            <li key={era.id} className="flex w-28 shrink-0 flex-col gap-1">
              {cell ? (
                <button type="button" onClick={() => void open(cell)} className="group text-left" aria-label={`Open ${cell.t}, ${cell.y}`}>
                  <img src={cell.thumb} alt="" loading="lazy" className="aspect-square w-full object-cover group-hover:opacity-80" style={{ backgroundColor: cell.hex }} />
                  <span className="mt-1 block truncate text-[11px] text-ink/80 group-hover:underline">{cell.t}</span>
                </button>
              ) : (
                <span className="grid aspect-square w-full place-items-center border border-dashed border-ink/15 font-mono text-[10px] text-ink/30">none</span>
              )}
              <span className="font-mono text-[10px] tracking-widest uppercase text-ink/50">{era.label}</span>
              <span className="font-mono text-[10px] text-ink/40">{cell ? `${cell.y} · ` : ''}{percent(share)} {name}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
