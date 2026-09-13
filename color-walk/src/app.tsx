import { useCallback, useEffect, useRef, useState } from 'react';
import { useHueFromUrlHash } from './hooks/use-hue-from-url-hash';
import { useColumnCount } from './hooks/use-column-count';
import { useArtworksByHue } from './hooks/use-artworks-by-hue';
import { HueWheel } from './components/hue-wheel';
import { ArtworkMasonryGrid } from './components/artwork-masonry-grid';
import {
  GalleryLoading,
  GalleryStatus,
  ImagesUnavailableBanner,
} from './components/gallery-status';
import { AttributionFooter } from './components/attribution-footer';
import { nearestColorName } from './lib/color-name-table';
import { ArtworkDetailOverlay } from './components/artwork-detail-overlay';
import type { Item } from './lib/color-index-client';

const NEUTRAL_ACCENT = '#6b7280';

const isDetailEntry = (state: unknown) =>
  (state as { cw?: string } | null)?.cw === 'detail';

export function App() {
  const { hue, setHue, commitHash } = useHueFromUrlHash();
  const columns = useColumnCount();
  const {
    items,
    revealed,
    status,
    revealMore,
    retry,
    retryDisabled,
    noteImageError,
    noteImageLoad,
    imagesDown,
  } = useArtworksByHue(hue, columns);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const closingRef = useRef(false);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--accent',
      hue === null ? NEUTRAL_ACCENT : `hsl(${hue} 70% 55%)`,
    );
  }, [hue]);

  useEffect(() => {
    document.title = hue === null ? 'Color Walk' : `Color Walk - H ${hue} / ${nearestColorName(hue)}`;
  }, [hue]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) revealMore();
      },
      { rootMargin: '100% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [revealMore]);

  const jumpToHue = useCallback(
    (next: number) => {
      setHue(next);
      commitHash(next);
    },
    [setHue, commitHash],
  );

  const open = useCallback((item: Item) => {
    history.pushState({ cw: 'detail', id: item.id }, '');
    setSelected(item);
  }, []);

  // Repeated Escape before popstate lands must not pop a second entry and walk
  // the visitor off the site; a Forward-orphaned entry must still close.
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (isDetailEntry(history.state)) history.back();
    else setSelected(null);
    if (!isDetailEntry(history.state)) closingRef.current = false;
  }, []);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      if (isDetailEntry(event.state)) return; // navigating into a detail entry
      closingRef.current = false;
      setSelected(null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const onPreloadError = () => setNeedsReload(true);
    window.addEventListener('vite:preloadError', onPreloadError as EventListener);
    return () =>
      window.removeEventListener('vite:preloadError', onPreloadError as EventListener);
  }, []);

  return (
    <>
      <div className="hue-tint" />
      {needsReload && (
        <div className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-3 bg-ground/95 p-2 text-center font-mono text-xs text-ink/80">
          A newer version of this page is available.
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="border border-ink/30 px-3 py-1 hover:text-ink"
          >
            Reload
          </button>
        </div>
      )}
      <div className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 lg:bottom-auto lg:left-8 lg:top-1/2 lg:translate-x-0 lg:-translate-y-1/2">
        <HueWheel hue={hue} onHueChange={setHue} onGestureEnd={commitHash} />
      </div>

      <main className="relative z-10 px-1.5 pb-56 pt-6 lg:pb-12 lg:pl-[320px]">
        <h1 className="sr-only">Color Walk</h1>
        {imagesDown && <ImagesUnavailableBanner />}
        {status === 'loading' && <GalleryLoading />}
        {/* Reserves a viewport so the footer starts below the fold and the
            arriving grid cannot shift anything the reader can see. */}
        <div className="min-h-screen">
          <ArtworkMasonryGrid
            items={revealed}
            columns={columns}
            onSelect={open}
            onImageError={noteImageError}
            onImageLoad={noteImageLoad}
          />
          <div ref={sentinelRef} className="h-px" />
          <GalleryStatus
            status={status}
            total={items.length}
            revealed={revealed.length}
            hue={hue}
            onHueChange={jumpToHue}
            retryDisabled={retryDisabled}
            onRetry={retry}
          />
        </div>
        <AttributionFooter />
      </main>

      {selected && (
        <ArtworkDetailOverlay
          key={selected.id}
          item={selected}
          onRequestClose={requestClose}
        />
      )}
    </>
  );
}
