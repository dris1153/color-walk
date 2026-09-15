import { useEffect, useMemo, useState } from 'react';
import { loadWords, suggest, type WordColour } from '../lib/words-client';
import { BUCKET_WIDTH, hslToHex } from '../lib/color-math';
import { ringSegments } from '../lib/hue-wheel-geometry';
import { BUCKET_COLOR_NAMES } from '../lib/color-name-table';

type Props = {
  onJumpToHue: (hue: number) => void;
  onClose: () => void;
};

/**
 * What colour a word is, in this collection. Deliberately the smallest thing
 * that answers the question: a ring of the word's hue spread and a count, no
 * work list. Measured shallow before it was built, so it is built to be cheap
 * to keep and cheap to drop.
 */
export function WordColour({ onJumpToHue, onClose }: Props) {
  const [all, setAll] = useState<WordColour[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [typed, setTyped] = useState('');
  const [chosen, setChosen] = useState<WordColour | null>(null);

  useEffect(() => {
    let stale = false;
    loadWords().then(
      (loaded) => !stale && setAll(loaded),
      () => !stale && setFailed(true),
    );
    return () => {
      stale = true;
    };
  }, []);

  const options = useMemo(() => (all ? suggest(all, typed) : []), [all, typed]);

  // Log-scaled like the control ring, so a word's one big hue does not flatten the rest.
  const segments = useMemo(() => {
    if (!chosen) return [];
    const max = Math.log1p(Math.max(...chosen.h));
    const weights = chosen.h.map((n) => (max > 0 ? Math.log1p(n) / max : 0));
    return ringSegments(weights, (hue) => hslToHex(hue, 70, 55));
  }, [chosen]);

  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 py-4" aria-label="The colour of a word">
      <label className="flex w-full flex-col gap-1">
        <span className="font-mono text-xs tracking-widest uppercase text-ink/70">What colour is a word?</span>
        <input
          type="search"
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            setChosen(null);
          }}
          placeholder={all ? 'dragon, virgin, landscape...' : 'Loading...'}
          disabled={!all}
          className="border border-ink/25 bg-transparent px-3 py-2 font-mono text-sm text-ink placeholder:text-ink/30 focus:border-ink focus:outline-none"
        />
      </label>

      {failed && <p className="font-mono text-xs text-ink/50">Could not load the words.</p>}

      {!chosen && options.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-2" aria-label="Words that match">
          {options.map((o) => (
            <li key={o.w}>
              <button
                type="button"
                onClick={() => setChosen(o)}
                className="border border-ink/25 px-2 py-1 font-mono text-[11px] text-ink/70 hover:text-ink"
              >
                {o.w} <span className="text-ink/40">{o.n}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!chosen && typed.trim() && all && options.length === 0 && (
        <p className="font-mono text-xs text-ink/50">No word like that titles 40 works or more.</p>
      )}

      {chosen && (
        <div className="flex flex-col items-center gap-2" role="status">
          <svg viewBox="0 0 100 100" className="h-40 w-40" role="img" aria-label={`${chosen.w}: ${chosen.n} works by hue`}>
            {segments.map((s) => (
              <path
                key={s.bucket}
                d={s.d}
                stroke={s.color}
                strokeWidth={s.width}
                fill="none"
                className="cursor-pointer"
                onClick={() => onJumpToHue(Math.round(s.bucket * BUCKET_WIDTH))}
              >
                <title>{`${BUCKET_COLOR_NAMES[s.bucket]}: ${chosen.h[s.bucket]}`}</title>
              </path>
            ))}
          </svg>
          <p className="font-mono text-xs text-ink/70">
            <span className="text-ink">{chosen.w}</span> - {chosen.n} works. Click a hue to browse it.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        className="font-mono text-[11px] tracking-widest uppercase text-ink/50 underline underline-offset-4 hover:text-ink"
      >
        Back to browsing
      </button>
    </section>
  );
}
