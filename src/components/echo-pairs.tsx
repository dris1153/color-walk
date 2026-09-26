import { useCallback, useEffect, useState } from 'react';
import { loadEchoes, type EchoPair, type EchoWork } from '../lib/echoes-client';
import { formatYear } from '../lib/echo-phrase';
import { regionLabel } from '../lib/facets';
import { MUSEUMS } from '../lib/museums';
import { loadEntry, type Item } from '../lib/color-index-client';

type Props = { onOpen: (item: Item) => void; onClose: () => void };

const BUTTON = 'h-10 w-10 border border-ink/30 font-mono text-ink/80 hover:text-ink disabled:opacity-30';

/** The same colour, far apart in time: two works side by side, one pair at a time. */
export function EchoPairs({ onOpen, onClose }: Props) {
  const [pairs, setPairs] = useState<EchoPair[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let stale = false;
    loadEchoes().then(
      (loaded) => !stale && setPairs(loaded),
      () => !stale && setFailed(true),
    );
    return () => {
      stale = true;
    };
  }, []);

  const count = pairs?.length ?? 0;
  const step = useCallback((delta: number) => setIndex((i) => (count ? (i + delta + count) % count : 0)), [count]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The overlay has its own arrows; this only steps while nothing sits on top.
      if (document.querySelector('[role=dialog]')) return;
      if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [step]);

  const open = async (w: EchoWork) => {
    const item = await loadEntry(w.bucket, w.page, w.id).catch(() => null);
    if (item) onOpen(item);
  };

  const pair = pairs?.[index];
  return (
    <section className="mx-auto flex max-w-5xl flex-col items-center gap-4 py-4" aria-label="Echoes across time">
      <p className="text-center font-mono text-xs tracking-widest uppercase text-ink/70">
        Echoes: the same colour, far apart in time
      </p>
      {failed && <p className="font-mono text-xs text-ink/50">Could not load the echoes.</p>}
      {!pairs && !failed && <p className="font-mono text-xs text-ink/50">Loading</p>}
      {pair && (
        <>
          <div className="grid w-full gap-3 sm:grid-cols-2" role="group" aria-label={`Pair ${index + 1} of ${count}`}>
            {[pair.a, pair.b].map((w) => (
              <button key={w.id} type="button" onClick={() => void open(w)} className="group flex flex-col text-left" style={{ backgroundColor: w.hex }}>
                <img src={w.thumb} alt={w.t} className="aspect-square w-full object-contain p-4" />
                <span className="bg-ground/85 px-3 py-2 font-mono text-[11px] text-ink/70">
                  <span className="block truncate text-ink group-hover:underline">{w.t}</span>
                  {formatYear(w.y)} &middot; {regionLabel(w.r) ?? 'place unknown'} &middot; {MUSEUMS[w.src]}
                </span>
              </button>
            ))}
          </div>
          <p className="font-mono text-xs text-ink/70">
            <span aria-hidden className="mr-2 inline-block h-3 w-3 align-middle" style={{ backgroundColor: pair.a.hex }} />
            {pair.a.hex} &middot; {(pair.b.y - pair.a.y).toLocaleString('en-US')} years apart
          </p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => step(-1)} aria-label="Previous pair" className={BUTTON}>&larr;</button>
            <span className="font-mono text-[11px] text-ink/50">{index + 1} / {count}</span>
            <button type="button" onClick={() => step(1)} aria-label="Next pair" className={BUTTON}>&rarr;</button>
          </div>
        </>
      )}
      <button type="button" onClick={onClose} className="font-mono text-[11px] tracking-widest uppercase text-ink/50 underline underline-offset-4 hover:text-ink">
        Back to browsing
      </button>
    </section>
  );
}
