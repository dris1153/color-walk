import { useCallback, useState } from 'react';
import { useViewFromUrlHash } from './hooks/use-view-from-url-hash';
import { useColumnCount } from './hooks/use-column-count';
import { useArtworksByHue } from './hooks/use-artworks-by-hue';
import { ColourControls } from './components/colour-controls';
import { ArtworkMasonryGrid } from './components/artwork-masonry-grid';
import { ArtworkHueRing } from './components/artwork-hue-ring';
import { CollectionRing } from './components/collection-ring';
import { ActivityView } from './components/activity-view';
import type { Activity } from './components/activity-links';
import { useWalkState } from './hooks/use-walk-state';
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
import { useDetailStepping } from './hooks/use-detail-stepping';
import { ReloadBanner } from './components/reload-banner';
import { useDocumentChrome } from './hooks/use-document-chrome';
import { useColourJump } from './hooks/use-colour-jump';
import type { HueSelection } from './lib/color-math';
import { withViewTransition } from './lib/view-transition';
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
  const { selected, open, replace, requestClose } = useDetailOverlay();
  // Play and compose are local; the walk keeps its own state because it lives in the URL.
  const [activity, setActivity] = useState<Exclude<Activity, 'walk'> | null>(null);
  const walk = useWalkState({ hue, tone });
  const current: Activity | null = walk.walking ? 'walk' : activity;
  const busy = current !== null;
  // Arrows step through what is behind the overlay; an activity has its own order.
  const { prev, next, step } = useDetailStepping({
    items: busy ? [] : showingSaved ? favourites : items,
    shown: showingSaved ? favourites.length : revealed.length,
    selected,
    replace,
    revealMore: showingSaved ? undefined : revealMore,
  });

  useDocumentChrome(hue);

  const leaveSaved = useCallback(() => setShowingSaved(false), []);
  const { browseColour, jumpToColour } = useColourJump({
    selected,
    requestClose,
    setHue,
    setTone,
    pushHash,
    onLeaveSaved: leaveSaved,
  });

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
      withViewTransition(() => browseHue(next));
      commitHash({ hue: next });
    },
    [browseHue, commitHash],
  );

  return (
    <>
      <div className="hue-tint" />
      <ReloadBanner />
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
          onActivity={(a) => (a === 'walk' ? walk.plan() : setActivity(a))}
        />
      </div>

      <main className="relative z-10 px-1.5 pb-56 pt-6 lg:pb-12 lg:pl-[320px]">
        <h1 className="sr-only">Color Walk</h1>
        <SavedToggle
          count={favourites.length}
          showingSaved={showingSaved}
          onToggle={() => setShowingSaved((v) => !v)}
        />
        {imagesDown && !showingSaved && !busy && <ImagesUnavailableBanner />}
        {status === 'loading' && !showingSaved && !busy && <GalleryLoading />}
        {/* Reserves a viewport so the footer starts below the fold and the
            arriving grid cannot shift anything the reader can see. */}
        <div className="min-h-screen">
          {current ? (
            <ActivityView
              activity={current}
              walk={walk}
              from={{ hue: typeof hue === 'number' ? hue : 30, tone: tone ?? 50 }}
              onOpen={open}
              onJumpToHue={jumpToHue}
              onClose={() => (walk.walking ? walk.end() : setActivity(null))}
            />
          ) : asRing ? (
            <ArtworkHueRing items={items} onSelect={open} />
          ) : (
            <>
              {showingSaved && <CollectionRing items={favourites} />}
              <ArtworkMasonryGrid
                items={showingSaved ? favourites : revealed}
                columns={columns}
                onSelect={open}
                onImageError={noteImageError}
                onImageLoad={noteImageLoad}
              />
            </>
          )}
          {!asRing && !busy && <div ref={sentinelRef} className="h-px" />}
          {!showingSaved && !asRing && !busy && (
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
          onOpen={open}
          prev={prev}
          next={next}
          onStep={step}
        />
      )}
    </>
  );
}
