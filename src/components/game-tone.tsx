import { useCallback, useEffect, useState } from 'react';
import { pickToneQuestion, toneVerdict } from '../lib/game-questions';
import { TONE_MAX, TONE_MIN, clampTone } from '../lib/color-math';
import { ToneSlider } from './tone-slider';
import type { Item } from '../lib/color-index-client';

type Props = { pool: readonly Item[] };

const MIDDLE = Math.round((TONE_MIN + TONE_MAX) / 2);

export function GameTone({ pool }: Props) {
  const [item, setItem] = useState<Item | null>(null);
  const [guess, setGuess] = useState(MIDDLE);
  const [submitted, setSubmitted] = useState(false);

  const deal = useCallback(() => {
    setSubmitted(false);
    setGuess(MIDDLE);
    setItem(pickToneQuestion(pool, Math.random));
  }, [pool]);

  useEffect(deal, [deal]);

  if (!item) {
    return <p className="text-center font-mono text-xs text-ink/50">Nothing to ask about yet.</p>;
  }

  // The work's own tone is clamped the same way the slider is, or a work at
  // tone 5 would be unanswerable on a track that stops at 15.
  const answer = clampTone(item.lig);
  const error = Math.abs(guess - answer);

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-mono text-xs tracking-widest uppercase text-ink/70">How light is this?</p>
      <div className="w-full max-w-sm overflow-hidden border border-ink/15">
        <img
          src={item.thumb}
          alt={item.t}
          className="aspect-square w-full object-cover"
          style={{ backgroundColor: submitted ? item.hex : undefined }}
        />
      </div>

      {/* A grey track: the hue is not the question, and colouring it would hand
          over half the answer. */}
      <div className="w-full max-w-sm">
        <ToneSlider
          hue={null}
          tone={guess}
          onToneChange={(next) => !submitted && setGuess(next ?? MIDDLE)}
          onGestureEnd={() => {}}
          label="Your guess"
        />
      </div>

      <p className="font-mono text-xs text-ink/70" role="status">
        {submitted ? `${toneVerdict(error)} - you said ${guess}, it is ${answer}` : `You say ${guess}`}
      </p>

      <button
        type="button"
        onClick={() => (submitted ? deal() : setSubmitted(true))}
        className="border border-ink/25 px-3 py-1.5 font-mono text-[11px] tracking-widest uppercase text-ink/70 hover:text-ink"
      >
        {submitted ? 'Next' : 'Check'}
      </button>
    </div>
  );
}
