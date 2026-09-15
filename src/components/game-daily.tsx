import { useMemo, useState } from 'react';
import { dailyRounds, shareText, todayStamp } from '../lib/daily-challenge';
import { recordDaily } from '../lib/game-store';
import { useProgress } from '../hooks/use-progress';
import type { Item } from '../lib/color-index-client';

type Props = { pool: readonly Item[] };

const BUTTON =
  'border border-ink/25 px-3 py-1.5 font-mono text-[11px] tracking-widest uppercase text-ink/70 hover:text-ink';

export function GameDaily({ pool }: Props) {
  // Fixed when the challenge opens: midnight passing under an open page must
  // not swap the questions half way through.
  const [today] = useState(todayStamp);
  const rounds = useMemo(() => dailyRounds(pool, today), [pool, today]);
  const { progress, update } = useProgress();
  const [marks, setMarks] = useState<boolean[]>([]);
  const [copied, setCopied] = useState(false);

  const alreadyPlayed = progress.lastDaily === today;
  const done = alreadyPlayed || marks.length === rounds.length;
  const shown = alreadyPlayed ? progress.lastMarks : marks;

  if (rounds.length === 0) {
    return <p className="text-center font-mono text-xs text-ink/50">No challenge today.</p>;
  }

  const round = rounds[marks.length];

  const answer = (choice: Item) => {
    if (!round || done) return;
    const next = [...marks, choice.id === round.darker.id];
    setMarks(next);
    if (next.length === rounds.length) update((previous) => recordDaily(previous, today, next));
  };

  // The text is always on screen, and the button is only a shortcut to it.
  // navigator.clipboard is denied often enough - no user gesture Chrome will
  // trust, Firefox's rules, a locked-down browser - that a button alone would
  // sometimes do nothing at all and say nothing about it.
  const result = shareText(today, shown, progress.dailyStreak);
  const copy = () => {
    navigator.clipboard?.writeText(result).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-mono text-xs tracking-widest uppercase text-ink/70">
        Today - {shown.length ? `${shown.filter(Boolean).length} of ${rounds.length}` : `${rounds.length} rounds`}
      </p>

      <ol className="flex gap-1.5" aria-label="Today's rounds">
        {rounds.map((r, i) => (
          <li
            key={r.a.id}
            aria-label={shown[i] === undefined ? 'not played' : shown[i] ? 'right' : 'wrong'}
            className={`h-3 w-3 border ${
              shown[i] === undefined
                ? 'border-ink/25'
                : shown[i]
                  ? 'border-ink bg-ink'
                  : 'border-ink/40'
            }`}
          />
        ))}
      </ol>

      {!done && round && (
        <div className="grid w-full max-w-2xl grid-cols-2 gap-3">
          {[round.a, round.b].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => answer(item)}
              aria-label={item.t}
              className="aspect-square w-full overflow-hidden border border-ink/15 hover:border-ink/60"
            >
              <img src={item.thumb} alt="" className="h-full w-full object-cover" style={{ backgroundColor: item.hex }} />
            </button>
          ))}
        </div>
      )}
      {!done && <p className="font-mono text-xs tracking-widest uppercase text-ink/50">Which is darker?</p>}

      {done && (
        <div className="flex flex-col items-center gap-3" role="status">
          <p className="font-mono text-xs text-ink/70">
            {shown.filter(Boolean).length}/{rounds.length}
            {progress.dailyStreak > 1 && ` - streak ${progress.dailyStreak}`}
            {` - best ${progress.bestDaily}`}
          </p>
          <pre className="select-all border border-ink/15 px-4 py-2 text-center font-mono text-xs leading-relaxed text-ink/80">
            {result}
          </pre>
          <button type="button" onClick={copy} className={BUTTON}>
            {copied ? 'Copied' : 'Copy'}
          </button>
          <p className="text-center font-mono text-[10px] text-ink/40">Come back tomorrow for a new one.</p>
        </div>
      )}
    </div>
  );
}
