import { useMemo, useState } from 'react';
import { useSpine } from '../hooks/use-spine';
import { buildWalk, type WalkPoint, type WalkStep } from '../lib/walk-route';
import { TONE_MAX, TONE_MIN, hslToHex } from '../lib/color-math';
import { nearestColorName } from '../lib/color-name-table';
import { HueWheel } from './hue-wheel';
import { ToneSlider } from './tone-slider';
import { WalkPlayer as Player } from './walk-player';
import type { Item } from '../lib/color-index-client';

type Props = {
  from: WalkPoint;
  target: WalkPoint | null;
  onStart: (to: WalkPoint) => void;
  onSelect: (item: Item) => void;
  onClose: () => void;
};

const MIDDLE = Math.round((TONE_MIN + TONE_MAX) / 2);

/** Somewhere else on the wheel, so the first suggestion is an actual journey. */
const suggest = (from: WalkPoint): WalkPoint => ({ hue: (from.hue + 180) % 360, tone: MIDDLE });

export function ColourWalk({ from, target, onStart, onSelect, onClose }: Props) {
  const { items, status } = useSpine();
  const [to, setTo] = useState<WalkPoint>(() => target ?? suggest(from));

  const steps: WalkStep[] = useMemo(
    () => (target && items.length ? buildWalk(items, from, target) : []),
    [items, from, target],
  );

  if (status === 'loading') return <p className="text-center font-mono text-xs text-ink/50">Loading the collection...</p>;
  if (status === 'error') return <p className="text-center font-mono text-xs text-ink/50">Could not load the collection.</p>;
  if (target && steps.length > 0) return <Player steps={steps} onSelect={(step) => onSelect(step.item)} onClose={onClose} />;

  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 py-4" aria-label="Plan a walk">
      <p className="text-center font-mono text-xs tracking-widest uppercase text-ink/70">
        Walk from {nearestColorName(from.hue)} to
      </p>
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="h-10 w-10 shrink-0 rounded-full border border-ink/20"
          style={{ backgroundColor: hslToHex(from.hue, 70, from.tone) }}
        />
        <span aria-hidden className="font-mono text-ink/30">to</span>
        <span
          aria-hidden
          className="h-10 w-10 shrink-0 rounded-full border border-ink/20"
          style={{ backgroundColor: hslToHex(to.hue, 70, to.tone) }}
        />
      </div>

      <HueWheel hue={to.hue} onHueChange={(hue) => setTo((t) => ({ ...t, hue: hue ?? t.hue }))} onGestureEnd={() => {}} />
      <div className="w-full max-w-xs">
        <ToneSlider
          hue={to.hue}
          tone={to.tone}
          onToneChange={(tone) => setTo((t) => ({ ...t, tone: tone ?? t.tone }))}
          onGestureEnd={() => {}}
          label="Where the walk ends"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onStart(to)}
          className="border border-ink/40 px-4 py-1.5 font-mono text-[11px] tracking-widest uppercase text-ink hover:border-ink"
        >
          Walk to {nearestColorName(to.hue)}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[11px] tracking-widest uppercase text-ink/50 underline underline-offset-4 hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
