import { useEffect, useRef } from 'react';
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

const NEUTRAL_ACCENT = '#6b7280';

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
  } = useArtworksByHue(hue);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--accent',
      hue === null ? NEUTRAL_ACCENT : `hsl(${hue} 70% 55%)`,
    );
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

  return (
    <>
      <div className="hue-tint" />
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
            onSelect={() => {}}
            onImageError={noteImageError}
            onImageLoad={noteImageLoad}
          />
          <div ref={sentinelRef} className="h-px" />
          <GalleryStatus
            status={status}
            total={items.length}
            revealed={revealed.length}
            retryDisabled={retryDisabled}
            onRetry={retry}
          />
        </div>
        <AttributionFooter />
      </main>
    </>
  );
}
