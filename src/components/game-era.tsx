import { useEffect, useMemo, useState } from 'react';
import { loadHistories, type HistoryCell } from '../lib/histories-client';
import { eraRounds, eraScore, eraShareText, positionToYear } from '../lib/era-game';
import { readEraResult, writeEraResult, type EraRound } from '../lib/era-game-store';
import { todayStamp } from '../lib/daily-challenge';
import { formatYear } from '../lib/echo-phrase';
import { eraLabel, eraOf } from '../lib/facets';

const BUTTON = 'border border-ink/25 px-3 py-1.5 font-mono text-[11px] tracking-widest uppercase text-ink/70 hover:text-ink';

/**
 * When was it made? Five works a day from five different eras; the title is
 * hidden until the guess, because "Tang dynasty" in a title gives it away.
 */
export function GameEra() {
  const [today] = useState(todayStamp);
  const [cells, setCells] = useState<HistoryCell[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [played, setPlayed] = useState<EraRound[]>(() => readEraResult(today));
  const [position, setPosition] = useState(0.5);
  const [revealed, setRevealed] = useState<EraRound | null>(null);
  const [copied, setCopied] = useState(false);

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

  const rounds = useMemo(() => (cells ? eraRounds(cells, today) : []), [cells, today]);
  if (failed) return <p className="font-mono text-xs text-ink/50">Could not load today&rsquo;s works.</p>;
  if (!cells) return <p className="font-mono text-xs text-ink/50">Loading</p>;

  const done = played.length >= rounds.length;
  const round = revealed ? rounds[played.length - 1] : rounds[played.length];
  const guessYear = positionToYear(position);

  const guess = () => {
    if (!round) return;
    const result = { id: round.id, y: round.y, guess: guessYear, score: eraScore(guessYear, round.y) };
    const next = [...played, result];
    setPlayed(next);
    setRevealed(result);
    writeEraResult(today, next);
  };

  if (done && !revealed) {
    const text = eraShareText(today, played);
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="font-mono text-sm text-ink">{played.reduce((s, r) => s + r.score, 0)} / {played.length * 100}</p>
        <pre className="select-all border border-ink/15 px-4 py-3 font-mono text-xs text-ink/80">{text}</pre>
        <button type="button" className={BUTTON} onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true), () => setCopied(false))}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        <p className="font-mono text-[11px] text-ink/50">New works tomorrow.</p>
      </div>
    );
  }
  if (!round) return null;

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3">
      <p className="font-mono text-[11px] tracking-widest uppercase text-ink/50">
        When was it made? {Math.min(played.length + (revealed ? 0 : 1), rounds.length)} / {rounds.length}
      </p>
      <img src={round.thumb} alt={revealed ? round.t : 'A work from the collection'} className="aspect-square w-full object-contain" style={{ backgroundColor: round.hex }} />
      {revealed ? (
        <>
          <p className="text-center text-sm text-ink">{round.t}</p>
          <p className="font-mono text-xs text-ink/70">
            Made {formatYear(round.y)} ({eraLabel(eraOf(round.y))}). You said {formatYear(revealed.guess)}: {revealed.score} points
          </p>
          <button type="button" className={BUTTON} onClick={() => { setRevealed(null); setPosition(0.5); }}>
            {played.length >= rounds.length ? 'See the result' : 'Next work'}
          </button>
        </>
      ) : (
        <>
          <label className="flex w-full flex-col items-center gap-1 font-mono text-xs text-ink/80">
            <input type="range" min={0} max={1} step={0.001} value={position} onChange={(e) => setPosition(Number(e.target.value))} className="w-full" aria-valuetext={formatYear(guessYear)} />
            {formatYear(guessYear)} &middot; {eraLabel(eraOf(guessYear))}
          </label>
          <button type="button" className={BUTTON} onClick={guess}>Guess</button>
        </>
      )}
    </div>
  );
}
