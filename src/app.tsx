import { useCallback, useEffect, useState } from 'react';
import { useViewFromUrlHash } from './hooks/use-view-from-url-hash';
import { useColumnCount } from './hooks/use-column-count';
import { useArtworksByHue } from './hooks/use-artworks-by-hue';
import { ColourControls } from './components/colour-controls';
import { ArtworkMasonryGrid } from './components/artwork-masonry-grid';
import { ArtworkHueRing } from './components/artwork-hue-ring';
import {
  GalleryLoading,
  GalleryStatus,
  ImagesUnavailableBanner,
} from './components/gallery-status';
import { AttributionFooter } from './components/attribution-footer';
import { SavedToggle } from './components/saved-toggle';
import { useFavourites } from './hooks/use-favourites';
import { useRevealOnScroll } from './hooks/use-reveal-on-scroll';
import { useDetailOverlay } from './hooks/use-detail-overlay';
import { useDocumentChrome } from './hooks/use-document-chrome';
import { clampTone, type HueSelection } from './lib/color-math';
import { ArtworkDetailOverlay } from './components/artwork-detail-overlay';

export function App() {
  const { hue, tone, setHue, setTone, commitHash, pushHash } = useViewFromUrlHash();
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
  } = useArtworksByHue(hue, tone, columns);
  const { favourites, isSaved, toggle: toggleSave } = useFavourites();
  const [showingSaved, setShowingSaved] = useState(false);
  const sentinelRef = useRevealOnScroll(revealMore);
  /** The landing view becomes the wheel itself, but only where there is room
   *  for it: below 1024px a ring of this many works is unreadable. */
  const asRing = hue === null && tone === null && !showingSaved && columns >= 4;
  const { selected, open, requestClose } = useDetailOverlay();
  const [needsReload, setNeedsReload] = useState(false);
  const [pendingColour, setPendingColour] = useState<{ hue: number; lig: number } | null>(null);

  useDocumentChrome(hue);

  const browseHue = useCallback(
    (next: HueSelection) => {
      setShowingSaved(false);
      setHue(next);
    },
    [setHue],
  );

  const browseTone = useCallback(
    (next: number | null) => {
      setShowingSaved(false);
      setTone(next);
    },
    [setTone],
  );

  const jumpToHue = useCallback(
    (next: number) => {
      browseHue(next);
      commitHash({ hue: next });
    },
    [browseHue, commitHash],
  );

  // A work's own colour is the way back to the wheel. Both axes are set, not
  // just the hue: the swatch showed one colour, and hue alone would answer with
  // that hue at every lightness.
  const browseColour = useCallback(
    (hue: number, lig: number) => {
      setPendingColour({ hue, lig });
      requestClose();
    },
    [requestClose],
  );

  const jumpToColour = useCallback(
    (nextHue: HueSelection, lightness: number) => {
      const tone = clampTone(lightness);
      setShowingSaved(false);
      setHue(nextHue);
      setTone(tone);
      pushHash({ hue: nextHue, tone });
    },
    [setHue, setTone, pushHash],
  );

  // Closing the overlay is a history.back(), which lands after this tick and
  // would restore the URL this wrote. So the colour is applied only once the
  // overlay is actually gone.
  useEffect(() => {
    if (!pendingColour || selected) return;
    jumpToColour(pendingColour.hue, pendingColour.lig);
    setPendingColour(null);
  }, [pendingColour, selected, jumpToColour]);

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
      <div className="fixed bottom-3 left-1/2 z-30 -translate-x-1/2 lg:bottom-auto lg:left-8 lg:top-1/2 lg:translate-x-0 lg:-translate-y-1/2">
        <ColourControls
          hue={hue}
          tone={tone}
          topItem={items[0] ?? null}
          onHueChange={browseHue}
          onToneChange={browseTone}
          onGestureEnd={commitHash}
          onSelect={open}
          onColourFromImage={jumpToColour}
        />
      </div>

      <main className="relative z-10 px-1.5 pb-56 pt-6 lg:pb-12 lg:pl-[320px]">
        <h1 className="sr-only">Color Walk</h1>
        <SavedToggle
          count={favourites.length}
          showingSaved={showingSaved}
          onToggle={() => setShowingSaved((v) => !v)}
        />
        {imagesDown && !showingSaved && <ImagesUnavailableBanner />}
        {status === 'loading' && !showingSaved && <GalleryLoading />}
        {/* Reserves a viewport so the footer starts below the fold and the
            arriving grid cannot shift anything the reader can see. */}
        <div className="min-h-screen">
          {asRing ? (
            <ArtworkHueRing items={items} onSelect={open} />
          ) : (
            <ArtworkMasonryGrid
              items={showingSaved ? favourites : revealed}
              columns={columns}
              onSelect={open}
              onImageError={noteImageError}
              onImageLoad={noteImageLoad}
            />
          )}
          {!asRing && <div ref={sentinelRef} className="h-px" />}
          {!showingSaved && !asRing && (
            <GalleryStatus
              status={status}
              total={items.length}
              revealed={revealed.length}
              hue={hue}
              onHueChange={jumpToHue}
              retryDisabled={retryDisabled}
              onRetry={retry}
            />
          )}
        </div>
        <AttributionFooter />
      </main>

      {selected && (
        <ArtworkDetailOverlay
          key={selected.id}
          item={selected}
          isSaved={isSaved(selected.id)}
          onToggleSave={toggleSave}
          onRequestClose={requestClose}
          onBrowseColour={browseColour}
        />
      )}
    </>
  );
}
