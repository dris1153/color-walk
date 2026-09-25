import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useBodyScrollLock } from '../hooks/use-body-scroll-lock';
import { useInertSiblings } from '../hooks/use-inert-siblings';
import { isAllowedImageUrl } from '../lib/image-url';
import { paletteGradient } from '../lib/palette-gradient';
import { useTwin } from '../hooks/use-twin';
import { DeepZoomErrorBoundary } from './deep-zoom-error-boundary';
import { ArtworkMetadataPanel } from './artwork-metadata-panel';
import { ArtworkTwinCompare } from './artwork-twin-compare';
import { OverlayStepButtons } from './overlay-step-buttons';
import type { Item } from '../lib/color-index-client';

const ArtworkDeepZoomViewer = lazy(() => import('./artwork-deep-zoom-viewer'));

/** Above this a phone would silently pull several megabytes, so ask first. */
const AUTO_LOAD_MAX_BYTES = 4_000_000;
/**
 * OSD sets tabIndex on its container, so a button/link-only query would miss it.
 * Disabled buttons are excluded: the zoom controls start disabled, and wrapping
 * focus onto one of them silently does nothing and strands Tab on the close button.
 */
const FOCUSABLE = 'button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

type Props = {
  item: Item;
  isSaved: boolean;
  /** The works either side in the order being browsed; null at an end. */
  prev: Item | null;
  next: Item | null;
  onStep: (delta: -1 | 1) => void;
  onToggleSave: (item: Item) => void;
  onRequestClose: () => void;
  onBrowseColour: (hue: number, lightness: number) => void;
  onOpen: (item: Item) => void;
};

export function ArtworkDetailOverlay({
  item,
  isSaved,
  prev,
  next,
  onStep,
  onToggleSave,
  onRequestClose,
  onBrowseColour,
  onOpen,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canZoom = isAllowedImageUrl(item.big);
  const [posterVisible, setPosterVisible] = useState(true);
  const [viewerFailed, setViewerFailed] = useState(false);
  const [wantsBig, setWantsBig] = useState(
    canZoom && item.bigBytes !== null && item.bigBytes <= AUTO_LOAD_MAX_BYTES,
  );
  const twin = useTwin(item.twin);
  const [comparing, setComparing] = useState(false);

  useBodyScrollLock();
  useInertSiblings(rootRef);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    rootRef.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onRequestClose();
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        // The zoom viewer pans with the arrows once it has focus; a step must not fire under a pan.
        if ((event.target as Element | null)?.closest?.('.openseadragon-container')) return;
        onStep(event.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = rootRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onRequestClose, onStep]);

  const handleFirstPaint = useCallback(() => setPosterVisible(false), []);
  // Leaving the comparison unmounts the zoom viewer, so the poster covers until it paints again.
  const toggleCompare = useCallback(() => {
    setComparing((v) => !v);
    setPosterVisible(true);
  }, []);
  const handleFail = useCallback(() => {
    setViewerFailed(true);
    setPosterVisible(true);
  }, []);

  const sizeLabel =
    item.bigBytes !== null
      ? `Load full resolution (${(item.bigBytes / 1e6).toFixed(1)} MB)`
      : 'Load full resolution (size unknown)';

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={item.t}
      onClick={(e) => {
        if (e.target === e.currentTarget) onRequestClose();
      }}
      className="fixed inset-0 z-50 bg-ground/95 lg:p-6"
    >
      <div className="flex h-full w-full flex-col overflow-hidden bg-ground lg:flex-row">
        <div className="relative min-h-0 flex-1" style={{ background: paletteGradient(item) }}>
          {comparing && twin ? (
            <ArtworkTwinCompare item={item} twin={twin} />
          ) : (
            <>
              <img
                src={item.thumb}
                alt={item.t}
                className="absolute inset-0 h-full w-full object-contain transition-opacity duration-500"
                style={{ opacity: posterVisible ? 1 : 0 }}
              />
              {wantsBig && !viewerFailed && (
                <DeepZoomErrorBoundary fallback={null}>
                  <Suspense fallback={null}>
                    <ArtworkDeepZoomViewer
                      bigUrl={item.big}
                      onFirstPaint={handleFirstPaint}
                      onFail={handleFail}
                    />
                  </Suspense>
                </DeepZoomErrorBoundary>
              )}
              {canZoom && !wantsBig && (
                <button
                  type="button"
                  onClick={() => setWantsBig(true)}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 border border-ink/30 bg-ground/80 px-4 py-2 font-mono text-xs tracking-widest uppercase text-ink/80 backdrop-blur hover:text-ink"
                >
                  {sizeLabel}
                </button>
              )}
            </>
          )}
          <OverlayStepButtons prev={prev} next={next} onStep={onStep} />
        </div>

        <aside className="max-h-[45%] w-full shrink-0 border-t border-ink/10 lg:max-h-none lg:w-90 lg:border-l lg:border-t-0">
          <ArtworkMetadataPanel
            item={item}
            twin={twin}
            comparing={comparing}
            onCompare={toggleCompare}
            isSaved={isSaved}
            onToggleSave={onToggleSave}
            onBrowseColour={onBrowseColour}
            onOpen={onOpen}
          />
        </aside>
      </div>

      <button
        type="button"
        onClick={onRequestClose}
        aria-label="Close"
        className="absolute right-2 top-2 z-20 h-10 w-10 border border-ink/20 bg-ground/70 font-mono text-ink/80 backdrop-blur hover:text-ink lg:right-8 lg:top-8"
      >
        &times;
      </button>
    </div>
  );
}
