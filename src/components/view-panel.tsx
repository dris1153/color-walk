import { useEffect, useId, useRef, useState } from 'react';
import { DEFAULT_VIEW, changedCount, type CardSize, type Pictures, type Vision } from '../lib/view-settings';
import { useViewSettings } from './view-settings-provider';

/** Value, label, and what choosing it does. */
type Option<T> = readonly [T, string, string];

const VISION_OPTIONS: readonly Option<Vision>[] = [
  ['', 'Normal', 'Colour as most eyes see it.'],
  ['protanopia', 'Protanopia (no red)', 'Missing red cones, about 1 in 100 men. Reds go dark and muddy, close to browns and greens.'],
  ['deuteranopia', 'Deuteranopia (no green)', 'Missing green cones, about 1 in 100 men. Reds and greens merge into ochres.'],
  ['tritanopia', 'Tritanopia (no blue)', 'Missing blue cones, rare. Blues drift to teal, yellows to pink.'],
  ['achromatopsia', 'No colour', 'Lightness only. Shows which works lean on tone rather than hue.'],
];
const PICTURE_OPTIONS: readonly Option<Pictures>[] = [
  ['original', 'Original', 'The photographs as the museums publish them.'],
  ['squint', 'Squint', 'Blurs each work into its colour masses, as painters squint. Detail goes, the sort shows.'],
  ['swatches', 'Swatches only', "Each work's main colour, no images loaded. The sort, bare."],
];
const CARD_HINTS = {
  palette: "The work's colours in proportion, along the bottom of every card.",
  titles: 'Title and artist on every card.',
  size: 'Smaller cards fit more per row; larger show more of each work.',
  unticked: 'Unticked, the strip and titles show only on hover.',
};
const SIZES: readonly CardSize[] = ['S', 'M', 'L'];

const BUTTON =
  'flex items-center gap-1.5 border border-ink/20 bg-ground px-2 py-1.5 font-mono text-[11px] tracking-widest uppercase text-ink/70 hover:border-ink/60 hover:text-ink aria-expanded:border-ink/60 aria-expanded:text-ink';
const LEGEND = 'mb-1 font-mono text-[10px] tracking-widest uppercase text-ink/40';
const OPTION = 'flex items-center gap-2 py-0.5 text-xs text-ink/80';
// Two lines held for every hint: a hint that shrank would pull the next group up under the pointer.
const HINT = 'mt-1 min-h-[2lh] text-[11px] leading-snug text-ink/50';

const hintOf = <T,>(options: readonly Option<T>[], value: T) => options.find(([v]) => v === value)?.[2] ?? '';

/** An eye: this changes how the works look, not which ones appear. */
const Eye = () => (
  <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3">
    <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z" />
    <circle cx="8" cy="8" r="2" />
  </svg>
);

export function ViewPanel() {
  const { settings, update } = useViewSettings();
  const [open, setOpen] = useState(false);
  // The option under the pointer or focus; without one, each group describes its current choice.
  // Touch has no hover, so the hint is a line under the group rather than a popup.
  const [peek, setPeek] = useState<{ group: string; hint: string } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const changed = changedCount(settings);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      setPeek(null);
    };
  }, [open]);

  const peekAt = (group: string, hint: string) => ({
    onMouseEnter: () => setPeek({ group, hint }),
    onFocus: () => setPeek({ group, hint }),
  });
  const unpeek = { onMouseLeave: () => setPeek(null), onBlur: () => setPeek(null) };
  const hint = (group: string, current: string) => (
    <p aria-live="polite" className={HINT}>
      {peek?.group === group ? peek.hint : current}
    </p>
  );

  return (
    <div ref={rootRef} className="relative">
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)} className={BUTTON}>
        <Eye />
        View
        {changed > 0 && <span aria-label={`${changed} changed`} className="h-1.5 w-1.5 rounded-full bg-ink" />}
      </button>
      {open && (
        <div id={panelId} className="absolute right-0 top-full z-30 mt-2 flex w-72 flex-col gap-3 border border-ink/20 bg-ground p-3 shadow-xl">
          <p className="text-[11px] leading-snug text-ink/50">Changes how the works look, not which ones appear. Kept in this browser.</p>
          <fieldset {...unpeek}>
            <legend className={LEGEND}>Colour vision</legend>
            {VISION_OPTIONS.map(([value, label, what]) => (
              <label key={value || 'normal'} className={OPTION} {...peekAt('vision', what)}>
                <input type="radio" name={`${panelId}-vision`} checked={settings.vision === value} onChange={() => update({ vision: value })} />
                {label}
              </label>
            ))}
            {hint('vision', hintOf(VISION_OPTIONS, settings.vision))}
          </fieldset>
          <fieldset {...unpeek}>
            <legend className={LEGEND}>Pictures</legend>
            {PICTURE_OPTIONS.map(([value, label, what]) => (
              <label key={value} className={OPTION} {...peekAt('pictures', what)}>
                <input type="radio" name={`${panelId}-pictures`} checked={settings.pictures === value} onChange={() => update({ pictures: value })} />
                {label}
              </label>
            ))}
            {hint('pictures', hintOf(PICTURE_OPTIONS, settings.pictures))}
          </fieldset>
          <fieldset {...unpeek}>
            <legend className={LEGEND}>Cards</legend>
            <label className={OPTION} {...peekAt('cards', CARD_HINTS.palette)}>
              <input type="checkbox" checked={settings.palette} onChange={(e) => update({ palette: e.target.checked })} />
              Palette strip always
            </label>
            <label className={OPTION} {...peekAt('cards', CARD_HINTS.titles)}>
              <input type="checkbox" checked={settings.titles} onChange={(e) => update({ titles: e.target.checked })} />
              Titles always
            </label>
            <div className="mt-1 flex items-center gap-2 text-xs text-ink/80" role="radiogroup" aria-label="Card size" {...peekAt('cards', CARD_HINTS.size)}>
              Size
              {SIZES.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={settings.size === s} onClick={() => update({ size: s })} className="h-6 w-6 border border-ink/20 font-mono text-[11px] text-ink/60 hover:text-ink aria-checked:border-ink aria-checked:text-ink">
                  {s}
                </button>
              ))}
            </div>
            {hint('cards', CARD_HINTS.unticked)}
          </fieldset>
          {changed > 0 && (
            <button type="button" onClick={() => update(DEFAULT_VIEW)} className="self-start font-mono text-[10px] tracking-widest uppercase text-ink/50 underline underline-offset-4 hover:text-ink">
              Reset view
            </button>
          )}
        </div>
      )}
    </div>
  );
}
