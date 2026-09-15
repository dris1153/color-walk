import { useState } from 'react';
import { useSpine } from '../hooks/use-spine';
import { GameDarker } from './game-darker';
import { GameTone } from './game-tone';

type Props = { onClose: () => void };

const GAMES = [
  { id: 'darker', label: 'Which is darker?' },
  { id: 'tone', label: 'How light is it?' },
] as const;

const TAB =
  'border px-3 py-1.5 font-mono text-[11px] tracking-widest uppercase aria-pressed:border-ink aria-pressed:text-ink border-ink/25 text-ink/60 hover:text-ink';

/**
 * Deliberately not in the URL. What is worth sharing about a game is a score,
 * which this does not keep, and threading a play mode through the view hash
 * would complicate every other reader of it for nothing.
 */
export function ColourGames({ onClose }: Props) {
  const [game, setGame] = useState<(typeof GAMES)[number]['id']>('darker');
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

      {status === 'loading' && <p className="font-mono text-xs text-ink/50">Loading the collection...</p>}
      {status === 'error' && <p className="font-mono text-xs text-ink/50">Could not load the collection.</p>}
      {status === 'ready' && (game === 'darker' ? <GameDarker pool={items} /> : <GameTone pool={items} />)}
    </section>
  );
}
