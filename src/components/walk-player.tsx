import { useCallback, useEffect, useState } from 'react';
import { hslToHex } from '../lib/color-math';
import { ROUGH_STEP, type WalkStep } from '../lib/walk-route';

type Props = {
  steps: readonly WalkStep[];
  onSelect: (step: WalkStep) => void;
  onClose: () => void;
};

const SWATCH_SATURATION = 70;
const BUTTON =
  'border border-ink/25 px-3 py-1.5 font-mono text-[11px] tracking-widest uppercase text-ink/70 hover:text-ink disabled:opacity-40 disabled:hover:text-ink/70';

export function WalkPlayer({ steps, onSelect, onClose }: Props) {
  const [at, setAt] = useState(0);
  const last = steps.length - 1;
  const step = steps[Math.min(at, last)];

  const go = useCallback(
    (delta: number) => setAt((current) => Math.min(last, Math.max(0, current + delta))),
    [last],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
      else if (event.key === 'Escape') onClose();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  if (!step) return null;

  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center gap-4 py-2" aria-label="A walk through colour">
      {/* The path itself: every step's colour, the current one raised. */}
      <ol className="flex w-full gap-px" aria-hidden>
        {steps.map((s, i) => (
          <li
            key={s.item.id}
            style={{ backgroundColor: hslToHex(s.hue, SWATCH_SATURATION, s.tone) }}
            className={`h-2 flex-1 ${i === at ? 'ring-1 ring-ink' : ''}`}
          />
        ))}
      </ol>

      <button
        type="button"
        onClick={() => onSelect(step)}
        className="w-full overflow-hidden border border-ink/15 hover:border-ink/60"
        aria-label={`Open ${step.item.t}`}
      >
        <img
          src={step.item.thumb}
          alt=""
          className="max-h-[52vh] w-full object-contain"
          style={{ backgroundColor: step.item.hex }}
        />
      </button>

      <div className="text-center">
        <p className="font-display text-lg leading-tight text-ink">{step.item.t}</p>
        <p className="font-mono text-[11px] tracking-widest uppercase text-ink/50">
          step {at + 1} of {steps.length}
          {step.gap > ROUGH_STEP && ' - the collection thins here'}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" className={BUTTON} onClick={() => go(-1)} disabled={at === 0}>
          Back
        </button>
        <button type="button" className={BUTTON} onClick={() => go(1)} disabled={at === last}>
          Next
        </button>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 font-mono text-[11px] tracking-widest uppercase text-ink/50 underline underline-offset-4 hover:text-ink"
        >
          End walk
        </button>
      </div>
    </section>
  );
}
