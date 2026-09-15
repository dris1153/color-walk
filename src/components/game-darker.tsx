import { useCallback, useEffect, useState } from 'react';
import { pickTonePair, type TonePair } from '../lib/game-questions';
import { recordStreak } from '../lib/game-store';
import { useProgress } from '../hooks/use-progress';
import type { Item } from '../lib/color-index-client';

type Props = { pool: readonly Item[] };

const CARD =
  'group relative aspect-square w-full overflow-hidden border border-ink/15 hover:border-ink/60 focus-visible:border-ink disabled:hover:border-ink/15';

export function GameDarker({ pool }: Props) {
  const [pair, setPair] = useState<TonePair | null>(null);
  const [answered, setAnswered] = useState<Item | null>(null);
  const [streak, setStreak] = useState(0);
  const { progress, update } = useProgress();

  const deal = useCallback(() => {
    setAnswered(null);
    setPair(pickTonePair(pool, Math.random));
  }, [pool]);

  useEffect(deal, [deal]);

  if (!pair) {
    return <p className="text-center font-mono text-xs text-ink/50">Not enough works to ask fairly.</p>;
  }

  const answer = (choice: Item) => {
    if (answered) return;
    setAnswered(choice);
    const next = choice.id === pair.darker.id ? streak + 1 : 0;
    setStreak(next);
    update((previous) => recordStreak(previous, next));
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-mono text-xs tracking-widest uppercase text-ink/70">Which is darker?</p>
      <div className="grid w-full max-w-2xl grid-cols-2 gap-3">
        {[pair.a, pair.b].map((item) => (
          <button
            key={item.id}
            type="button"
            className={CARD}
            disabled={answered !== null}
            onClick={() => answer(item)}
            aria-label={item.t}
          >
            <img src={item.thumb} alt="" className="h-full w-full object-cover" style={{ backgroundColor: item.hex }} />
            {answered && (
              <span className="absolute inset-x-0 bottom-0 bg-ground/85 py-1 text-center font-mono text-[11px] text-ink">
                tone {item.lig}
                {item.id === pair.darker.id ? ' - darker' : ''}
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="font-mono text-xs text-ink/70" role="status">
        {answered
          ? `${answered.id === pair.darker.id ? 'Right' : 'Wrong'} - streak ${streak}, best ${progress.bestStreak}`
          : `Streak ${streak}, best ${progress.bestStreak}`}
      </p>
      {answered && (
        <button
          type="button"
          onClick={deal}
          className="border border-ink/25 px-3 py-1.5 font-mono text-[11px] tracking-widest uppercase text-ink/70 hover:text-ink"
        >
          Next
        </button>
      )}
    </div>
  );
}
