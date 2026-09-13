import { useEffect, useRef, useState } from 'react';
import OpenSeadragon from 'openseadragon';

type Props = {
  bigUrl: string;
  onFirstPaint: () => void;
  onFail: () => void;
};

const ZOOM_STEP = 1.4;
const controlClass =
  'h-10 w-10 border border-ink/30 bg-ground/70 font-mono text-sm text-ink/80 backdrop-blur hover:text-ink disabled:opacity-30';

export default function ArtworkDeepZoomViewer({ bigUrl, onFirstPaint, onFail }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const viewer = OpenSeadragon({
      element: host,
      // Three settings here are load-bearing for cross-origin museum images,
      // which arrive with no Access-Control-Allow-Origin header:
      //   drawer: 'canvas'  - OpenSeadragon 6 defaults to WebGL, and WebGL
      //     cannot upload a non-CORS image as a texture at all. Leaving the
      //     default logs "Error creating texture in WebGL" and paints nothing.
      //   buildPyramid: false - the default synthesises a pyramid by reading
      //     the image back out of a canvas, which CORS forbids.
      //   crossOriginPolicy stays unset - adding a crossorigin attribute would
      //     make the Met refuse to serve the image at all.
      drawer: 'canvas',
      tileSources: {
        type: 'image',
        url: bigUrl,
        buildPyramid: false,
        // @types/openseadragon 6.0.0 omits buildPyramid from the image tile
        // source even though ImageTileSource has long accepted it.
      } as unknown as OpenSeadragon.Options['tileSources'],
      tabIndex: -1,
      showNavigator: false,
      showNavigationControl: false,
      gestureSettingsTouch: {
        pinchToZoom: true,
        dragToPan: true,
        flickEnabled: true,
        dblClickToZoom: true,
      },
      gestureSettingsMouse: { scrollToZoom: true, clickToZoom: false, dblClickToZoom: true },
      maxZoomPixelRatio: 2,
      minZoomImageRatio: 0.8,
      visibilityRatio: 1,
      constrainDuringPan: true,
      animationTime: reducedMotion ? 0 : 0.6,
      springStiffness: 8,
    });
    viewerRef.current = viewer;

    // 'open' fires when the tile source is parsed, before a single pixel is
    // painted, so fading the poster there shows a blank frame. 'tile-drawn'
    // would be the obvious alternative but only the canvas drawer raises it;
    // 'fully-loaded-change' is drawer-independent and fires after painting.
    const onLoaded = (event: { fullyLoaded: boolean }) => {
      if (!event.fullyLoaded) return;
      onFirstPaint();
      viewer.removeHandler('fully-loaded-change', onLoaded);
    };
    viewer.addHandler('fully-loaded-change', onLoaded);
    viewer.addHandler('open', () => setReady(true));
    viewer.addHandler('open-failed', () => {
      setReady(false);
      onFail();
    });

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [bigUrl, onFirstPaint, onFail]);

  const zoom = (factor: number) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.viewport.zoomBy(factor);
    viewer.viewport.applyConstraints();
  };

  return (
    <>
      <div ref={hostRef} className="absolute inset-0" />
      <div className="absolute bottom-4 right-4 z-10 flex gap-2">
        <button
          type="button"
          aria-label="Zoom in"
          disabled={!ready}
          onClick={() => zoom(ZOOM_STEP)}
          className={controlClass}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          disabled={!ready}
          onClick={() => zoom(1 / ZOOM_STEP)}
          className={controlClass}
        >
          &minus;
        </button>
        <button
          type="button"
          aria-label="Reset zoom"
          disabled={!ready}
          onClick={() => viewerRef.current?.viewport.goHome()}
          className={controlClass}
        >
          &#8634;
        </button>
      </div>
    </>
  );
}
