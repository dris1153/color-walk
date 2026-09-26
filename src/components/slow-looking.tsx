import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { loadSpine, type Item } from '../lib/color-index-client';
import { displayUrl } from '../lib/display-url';
import { nearestColorName } from '../lib/color-name-table';

type Props = {
  /** Where on the wheel to start: the hue the reader was looking at. */
  startHue: number | null;
  onOpen: (item: Item) => void;
  onClose: () => void;
};

/** Long enough to look, short enough that the wheel turns while someone watches. */
const DWELL_MS = 9000;
const CONTROL = 'border border-ink/25 bg-ground/60 px-3 py-1.5 font-mono text-[11px] tracking-widest uppercase text-ink/70 backdrop-blur hover:text-ink';

/**
 * The wheel as a slow slideshow: one work at a time, full screen, drifting
 * round the hues through the spine's 300-odd works. Made for a second screen or
 * a television; it keeps the screen awake while it plays.
 */
export function SlowLooking({ startHue, onOpen, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [works, setWorks] = useState<Item[] | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let stale = false;
    loadSpine().then(
      (spine) => {
        if (stale) return;
        const coloured = spine.filter((w) => w.sat > 0);
        setWorks(coloured);
        setIndex(Math.max(0, startHue === null ? 0 : coloured.findIndex((w) => w.hue >= startHue)));
      },
      () => !stale && setWorks([]),
    );
    return () => {
      stale = true;
    };
  }, [startHue]);

  const count = works?.length ?? 0;
  const step = useCallback((delta: number) => {
    setLoaded(false);
    setIndex((i) => (count ? (i + delta + count) % count : 0));
  }, [count]);

  useEffect(() => {
    if (!playing || count === 0) return;
    const timer = window.setTimeout(() => step(1), DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [playing, count, index, step]);

  // The next picture starts loading while this one is looked at.
  const current = works?.[index];
  const next = works?.[(index + 1) % Math.max(1, count)];
  useEffect(() => {
    if (next) new Image().src = displayUrl(next);
  }, [next]);

  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock?.request('screen').then((l) => (lock = l), () => undefined);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      void lock?.release().catch(() => undefined);
    };
  }, [onClose, step]);

  const fullscreen = () => void rootRef.current?.requestFullscreen?.().catch(() => undefined);
  // The detail overlay lives outside this element, so full screen would hide it.
  const openCurrent = async () => {
    if (!current) return;
    setPlaying(false);
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    onOpen(current);
  };
  const src = useMemo(() => (current ? displayUrl(current) : ''), [current]);

  // Portalled to the body: inside <main>, whose z-index makes a stacking
  // context, the colour controls drew over this layer. z-40 keeps the detail
  // overlay (z-50) above it when a work is opened from here.
  return createPortal(
    <div ref={rootRef} className="fixed inset-0 z-40 flex items-center justify-center transition-colors duration-[2000ms]" style={{ backgroundColor: current?.hex ?? '#0b0b0c' }} role="region" aria-label="Slow looking">
      {works?.length === 0 && <p className="font-mono text-xs text-ink/70">Could not load the works.</p>}
      {current && (
        <img key={current.id} src={src} alt={current.t} onLoad={() => setLoaded(true)} onClick={() => void openCurrent()} className="max-h-full max-w-full cursor-pointer object-contain p-8 transition-opacity duration-[2000ms]" style={{ opacity: loaded ? 1 : 0 }} />
      )}
      {current && (
        <p className="absolute bottom-4 left-4 max-w-[60%] bg-ground/60 px-3 py-2 font-mono text-[11px] text-ink/80 backdrop-blur">
          <span className="block truncate text-ink">{current.t}</span>
          {current.a} &middot; {nearestColorName(current.hue)}
        </p>
      )}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <button type="button" className={CONTROL} onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play'}</button>
        <button type="button" className={CONTROL} onClick={() => step(1)}>Next</button>
        <button type="button" className={CONTROL} onClick={fullscreen}>Full screen</button>
        <button type="button" className={CONTROL} onClick={onClose}>Close</button>
      </div>
    </div>,
    document.body,
  );
}
