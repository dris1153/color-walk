import { useCallback, useState } from 'react';
import { useViewFromUrlHash } from './hooks/use-view-from-url-hash';
import { useColumnCount } from './hooks/use-column-count';
import { useArtworksByHue } from './hooks/use-artworks-by-hue';
import { ColourControls } from './components/colour-controls';
import { ActivityView } from './components/activity-view';
import type { Activity, Entry } from './components/activity-links';
import { CameraColour } from './components/camera-colour';
import { useWalkState } from './hooks/use-walk-state';
import { GalleryLoading, ImagesUnavailableBanner } from './components/gallery-status';
import { GalleryBody } from './components/gallery-body';
import { GalleryToolbar } from './components/gallery-toolbar';
import { AttributionFooter } from './components/attribution-footer';
import { SavedToggle } from './components/saved-toggle';
import { useFavourites } from './hooks/use-favourites';
import { useRevealOnScroll } from './hooks/use-reveal-on-scroll';
import { useDetailOverlay } from './hooks/use-detail-overlay';
import { useDetailStepping } from './hooks/use-detail-stepping';
import { ReloadBanner } from './components/reload-banner';
import { useDocumentChrome } from './hooks/use-document-chrome';
import { filterToView, useColourJump } from './hooks/use-colour-jump';
import type { HueSelection } from './lib/color-math';
import { isFiltering, NO_FILTER, type Filter } from './lib/facets';
import { withViewTransition } from './lib/view-transition';
import { ArtworkDetailOverlay } from './components/artwork-detail-overlay';

export function App() {
  const { hue, tone, setHue, setTone, filter, setFilter, commitHash, pushHash } = useViewFromUrlHash();
  const columns = useColumnCount();
  const gallery = useArtworksByHue(hue, tone, columns, filter);
  const { items, revealed, status, revealMore, imagesDown } = gallery;
  const { favourites, isSaved, toggle: toggleSave } = useFavourites();
  const [showingSaved, setShowingSaved] = useState(false);
  const sentinelRef = useRevealOnScroll(revealMore);
  /** The landing view becomes the wheel itself, but only where there is room
   *  for it: below 1024px a ring of this many works is unreadable. A filter
   *  turns it back into a grid, which can say how many matched. */
  const asRing = hue === null && tone === null && !showingSaved && columns >= 4 && !isFiltering(filter);
  const { selected, open, replace, requestClose } = useDetailOverlay();
  // Play and compose are local; the walk keeps its own state because it lives in the URL.
  const [activity, setActivity] = useState<Exclude<Activity, 'walk'> | null>(null);
  const walk = useWalkState({ hue, tone, ...filterToView(filter) });
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
  const { browseColour, jumpToColour, followColour } = useColourJump({
    selected,
    requestClose,
    setHue,
    setTone,
    setFilter,
    pushHash,
    commitHash,
    onLeaveSaved: leaveSaved,
  });
  const [cameraOn, setCameraOn] = useState(false);
  // The camera drives the grid, so it closes whatever activity is covering it.
  const startEntry = (entry: Entry) => {
    if (entry === 'camera') {
      setActivity(null);
      setCameraOn(true);
    } else if (entry === 'walk') walk.plan();
    else setActivity(entry);
  };

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

  // A filter is a discrete choice, so it earns a history entry like a colour jump.
  const changeFilter = useCallback(
    (next: Partial<Filter>) => {
      setFilter(next);
      pushHash(filterToView(next));
    },
    [setFilter, pushHash],
  );

  const browseEra = useCallback(
    (nextHue: number | null, era: string) => {
      const facet = { ...NO_FILTER, era };
      setShowingSaved(false);
      if (nextHue !== null) setHue(nextHue);
      setFilter(facet);
      pushHash({ ...(nextHue !== null && { hue: nextHue }), ...filterToView(facet) });
    },
    [setHue, setFilter, pushHash],
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
          onActivity={startEntry}
        />
      </div>

      <main className="relative z-10 px-1.5 pb-56 pt-6 lg:pb-12 lg:pl-[320px]">
        <h1 className="sr-only">Color Walk</h1>
        <GalleryToolbar
          filter={filter}
          onFilter={changeFilter}
          showFilters={!showingSaved && !busy}
          saved={<SavedToggle count={favourites.length} showingSaved={showingSaved} onToggle={() => setShowingSaved((v) => !v)} />}
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
              wheelHue={typeof hue === 'number' ? hue : null}
              onOpen={open}
              onJumpToHue={jumpToHue}
              onBrowseEra={browseEra}
              onClose={() => (walk.walking ? walk.end() : setActivity(null))}
            />
          ) : (
            <GalleryBody
              gallery={gallery}
              filter={filter}
              hue={hue}
              columns={columns}
              asRing={asRing}
              showingSaved={showingSaved}
              favourites={favourites}
              sentinelRef={sentinelRef}
              onOpen={open}
              onJumpToHue={jumpToHue}
            />
          )}
        </div>
        <AttributionFooter />
      </main>

      {cameraOn && <CameraColour onColour={followColour} onClose={() => setCameraOn(false)} />}
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
