import { useEffect, useId, useRef, useState } from 'react';
import { DEFAULT_VIEW, changedCount, type CardSize, type Pictures, type Vision } from '../lib/view-settings';
import { useViewSettings } from './view-settings-provider';

const VISION_OPTIONS: readonly [Vision, string][] = [
  ['', 'Normal'],
  ['protanopia', 'Protanopia (no red)'],
  ['deuteranopia', 'Deuteranopia (no green)'],
  ['tritanopia', 'Tritanopia (no blue)'],
  ['achromatopsia', 'No colour'],
];
const PICTURE_OPTIONS: readonly [Pictures, string][] = [
  ['original', 'Original'],
  ['squint', 'Squint'],
  ['swatches', 'Swatches only'],
];
const SIZES: readonly CardSize[] = ['S', 'M', 'L'];

const BUTTON =
  'flex items-center gap-1.5 border border-ink/20 bg-ground px-2 py-1.5 font-mono text-[11px] tracking-widest uppercase text-ink/70 hover:border-ink/60 hover:text-ink aria-expanded:border-ink/60 aria-expanded:text-ink';
const LEGEND = 'mb-1 font-mono text-[10px] tracking-widest uppercase text-ink/40';
const OPTION = 'flex items-center gap-2 py-0.5 text-xs text-ink/80';

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
    };
  }, [open]);

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
          <fieldset>
            <legend className={LEGEND}>Colour vision</legend>
            {VISION_OPTIONS.map(([value, label]) => (
              <label key={value || 'normal'} className={OPTION}>
                <input type="radio" name={`${panelId}-vision`} checked={settings.vision === value} onChange={() => update({ vision: value })} />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend className={LEGEND}>Pictures</legend>
            {PICTURE_OPTIONS.map(([value, label]) => (
              <label key={value} className={OPTION}>
                <input type="radio" name={`${panelId}-pictures`} checked={settings.pictures === value} onChange={() => update({ pictures: value })} />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend className={LEGEND}>Cards</legend>
            <label className={OPTION}>
              <input type="checkbox" checked={settings.palette} onChange={(e) => update({ palette: e.target.checked })} />
              Palette strip always
            </label>
            <label className={OPTION}>
              <input type="checkbox" checked={settings.titles} onChange={(e) => update({ titles: e.target.checked })} />
              Titles always
            </label>
            <div className="mt-1 flex items-center gap-2 text-xs text-ink/80" role="radiogroup" aria-label="Card size">
              Size
              {SIZES.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={settings.size === s} onClick={() => update({ size: s })} className="h-6 w-6 border border-ink/20 font-mono text-[11px] text-ink/60 hover:text-ink aria-checked:border-ink aria-checked:text-ink">
                  {s}
                </button>
              ))}
            </div>
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
