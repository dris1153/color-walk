import { useState } from 'react';
import { useSpine } from '../hooks/use-spine';
import { GameDaily } from './game-daily';
import { GameDarker } from './game-darker';
import { GameEra } from './game-era';
import { GameTone } from './game-tone';

type Props = { onClose: () => void };

const GAMES = [
  { id: 'daily', label: 'Today' },
  { id: 'darker', label: 'Which is darker?' },
  { id: 'tone', label: 'How light is it?' },
  { id: 'era', label: 'When was it made?' },
] as const;

const TAB =
  'border px-3 py-1.5 font-mono text-[11px] tracking-widest uppercase aria-pressed:border-ink aria-pressed:text-ink border-ink/25 text-ink/60 hover:text-ink';

/**
 * Deliberately not in the URL. What is worth sharing about a game is a score,
 * which this does not keep, and threading a play mode through the view hash
 * would complicate every other reader of it for nothing.
 */
export function ColourGames({ onClose }: Props) {
  const [game, setGame] = useState<(typeof GAMES)[number]['id']>('daily');
  const { items, status } = useSpine();

  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-5 py-4" aria-label="Colour games">
      <div className="flex items-center gap-2">
        {GAMES.map((g) => (
          <button key={g.id} type="button" aria-pressed={game === g.id} onClick={() => setGame(g.id)} className={TAB}>
            {g.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onClose}
          className="ml-2 font-mono text-[11px] tracking-widest uppercase text-ink/50 underline underline-offset-4 hover:text-ink"
        >
          Back to browsing
        </button>
      </div>

      {/* Draws from the colour histories, not the spine, so it does not wait for it. */}
      {game === 'era' && <GameEra />}
      {game !== 'era' && status === 'loading' && <p className="font-mono text-xs text-ink/50">Loading the collection...</p>}
      {game !== 'era' && status === 'error' && <p className="font-mono text-xs text-ink/50">Could not load the collection.</p>}
      {status === 'ready' && game === 'daily' && <GameDaily pool={items} />}
      {status === 'ready' && game === 'darker' && <GameDarker pool={items} />}
      {status === 'ready' && game === 'tone' && <GameTone pool={items} />}
    </section>
  );
}
