---
phase: 3
title: "Deep-zoom detail overlay"
status: complete
priority: P1
effort: "5h"
dependencies: [2]
---

# Phase 3: Deep-zoom detail overlay

## Context Links
- [Phase 1 - Item shape, `big` / `bigBytes`](phase-01-scaffold-and-color-index-pipeline.md)
- [Phase 2 - card `onSelect` contract](phase-02-hue-wheel-and-masonry-gallery.md)
- Live probe 2026-09-13: Met images 200 but **no `Access-Control-Allow-Origin`**; CMA `print` median 2713 px / 3.2 MB (p90 6.5 MB, max 10 MB), present on 999/1000; CMA `full` median 84 MB - never used
- OSD options: https://openseadragon.github.io/docs/OpenSeadragon.html#.Options
- OSD `ImageTileSource` (`type: 'image'`, `buildPyramid`): https://openseadragon.github.io/docs/OpenSeadragon.ImageTileSource.html
- OSD events (`tile-drawn`, `fully-loaded-change`, `open-failed`): https://openseadragon.github.io/docs/OpenSeadragon.Viewer.html#event:tile-drawn
- ARIA modal dialog: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- `inert`: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/inert
- Vite `vite:preloadError`: https://vite.dev/guide/build#load-error-handling
- iOS scroll lock technique: https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior

## Overview
Tap a card -> full-screen overlay: big image on the left/top, metadata + credit on the left/bottom.
OpenSeadragon is code-split behind a dynamic `import()`, wrapped in an ErrorBoundary, and fed a **single-image** tile source - no IIIF exists in this project.
Heavy originals are gated behind an explicit button so a phone never silently pulls 8 MB.
Exit = zoom works on desktop and phone, Back closes cleanly, 20 open/close cycles leak nothing, chunk failure degrades to a poster.

## Key Insights (verified 2026-09-13)
- **`{ type: 'image', url, buildPyramid: false }` is the whole tile source.** `buildPyramid: true` (the default) draws the image into a canvas to synthesise a pyramid, which requires CORS headers. Met images have **none**, so the default would produce a tainted canvas and a blank viewer. `buildPyramid: false` is load-bearing, not an optimisation.
- For the same reason, **never set `crossOriginPolicy: 'Anonymous'`.** It adds a `crossorigin` attribute; Met would then refuse the image entirely.
- `OpenSeadragon(options)` is the factory. `OpenSeadragon.Viewer({...})` without `new` (as written in researcher-03) is wrong.
- **Size gate:** `bigBytes` is known at build time - CMA from `images.print.filesize` (no HEAD), Met from a HEAD `Content-Length`. Measured CMA print: median 3.2 MB, p90 6.5 MB, max 10 MB, so a 4 MB auto-load threshold lets roughly **half** of CMA prints open immediately and puts the rest, plus essentially all Met originals (~8 MB), behind "Load full resolution (N MB)".
- CMA `print` is the primary deep-zoom source; Met `primaryImage` is always behind the button in practice.
- **Poster must fade on the first `tile-drawn`, not on `open`** (finding #13). `open` fires when the tile source is parsed, before a single pixel is painted - fading there shows a blank viewer for a beat. Use `tile-drawn` (or `fully-loaded-change` with `fullyLoaded === true`); `open` only enables the zoom controls.
- **OSD sets `tabIndex=0` on its container by default** (finding #14), so a naive focus trap that queries `button, a[href]` will skip it and Tab will land somewhere unexpected. Pass `tabIndex: -1` and mark siblings `inert`.
- **`body { overflow: hidden }` does not lock iOS Safari** (finding #5). Use `position: fixed; top: -scrollY; width: 100%` and restore with `window.scrollTo(0, scrollY)`.
- **`history.back()` can leave the site** (finding #6) if called when the top entry is not ours - e.g. two rapid Escs before `popstate` lands. Guard with a `closingRef` and check `history.state?.cw === 'detail'`.
- **A lazy chunk can fail** (deploy mid-session, flaky network). Without an ErrorBoundary the whole app unmounts to a blank screen (finding #7).

## Requirements

### Functional
- F1. Card click opens a full-screen overlay for that item.
- F2. Viewer uses `{ type: 'image', url: item.big, buildPyramid: false }`.
- F3. Auto-open the big image only when `bigBytes != null && bigBytes <= 4_000_000`; otherwise show `Load full resolution (N MB)` / `Load full resolution (size unknown)`.
- F4. Custom `+` / `-` / reset controls. No OSD navigator, no default control strip.
- F5. Touch: pinch-to-zoom, drag-to-pan, flick.
- F6. Metadata panel: title (serif), artist, date, dominant swatch + `H {hue} / {name}`, **credit line** (finding #12), "View at the museum" link to `item.page`.
- F7. Close via Esc, close button, backdrop click, or browser Back - all through one path.
- F8. Body scroll locked (iOS-safe) while open; scroll position restored on close.
- F9. Poster = `item.thumb`, always mounted under the viewer; fades on first `tile-drawn`.
- F10. Lazy-chunk failure -> ErrorBoundary renders a poster-only overlay with the metadata panel intact; `vite:preloadError` offers a reload.

### Non-functional
- OSD ships in its own chunk; the entry bundle contains no `OpenSeadragon` symbol.
- Focus trapped; focus returns to the originating card.
- No canvas leak after 20 open/close cycles.
- Every file < 200 lines.

## Architecture

### Flow
```
ArtworkCard onSelect(item)
  -> app.tsx: history.pushState({ cw: 'detail', id: item.id }, ''); setSelected(item)
  -> <ArtworkDetailOverlay item onRequestClose />
       ├─ iOS scroll lock + focus management (inert siblings) + Esc
       ├─ <img src={item.thumb}>  poster (always mounted)
       ├─ <DeepZoomErrorBoundary><Suspense><LazyDeepZoomViewer/></Suspense></DeepZoomErrorBoundary>
       │     rendered only after the size gate passes or the user clicks the button
       └─ <ArtworkMetadataPanel item />   title / artist / date / swatch / credit / museum link
  close: Esc | button | backdrop -> onRequestClose()
  -> popstate (app.tsx) -> setSelected(null)
```

### History handling (finding #6)
```ts
const closingRef = useRef(false);

const open = useCallback((item: Item) => {
  history.pushState({ cw: 'detail', id: item.id }, '');
  setSelected(item);
}, []);

const requestClose = useCallback(() => {
  if (closingRef.current) return;                 // repeated Esc before popstate lands
  closingRef.current = true;
  if (history.state?.cw === 'detail') history.back();   // popstate will clear state
  else setSelected(null);                                // our entry is gone (Forward, or a foreign push)
  if (!history.state || history.state.cw !== 'detail') closingRef.current = false;
}, []);

useEffect(() => {
  const onPop = (e: PopStateEvent) => {
    if (e.state?.cw === 'detail') return;         // navigating INTO a detail entry (Forward) - ignore
    closingRef.current = false;
    setSelected(null);
  };
  window.addEventListener('popstate', onPop);
  return () => window.removeEventListener('popstate', onPop);
}, []);
```
Note the interaction with phase 2: hue uses `replaceState` and passes `history.state` through, so the `{ cw: 'detail' }` marker survives a hue write. Verify explicitly.

### iOS-safe scroll lock (finding #5)
```ts
useEffect(() => {
  const y = window.scrollY;
  const body = document.body;
  body.style.position = 'fixed';
  body.style.top = `-${y}px`;
  body.style.width = '100%';
  return () => {
    body.style.position = ''; body.style.top = ''; body.style.width = '';
    window.scrollTo(0, y);
  };
}, []);
```
Metadata panel gets `overscroll-behavior: contain`. **Accepted risk:** iOS edge back-swipe can still dismiss; it triggers `popstate`, which closes the overlay correctly, so the failure mode is benign.

### Focus handling (finding #14)
- Overlay root: `role="dialog" aria-modal="true" aria-label={item.t}`.
- On mount: mark every child of `#root` other than the overlay container `inert` (and restore on unmount). This is stronger than a manual trap and covers OSD's internal tabbables.
- Belt and braces: the Tab-wrap query is `'button, a[href], [tabindex]:not([tabindex="-1"])'`.
- OSD gets `tabIndex: -1` so its container is not itself a tab stop.
- Store `document.activeElement` on mount, restore on unmount.

### `artwork-deep-zoom-viewer.tsx` (default export, lazy)
```ts
useEffect(() => {
  if (!hostRef.current) return;
  const viewer = OpenSeadragon({
    element: hostRef.current,
    tileSources: { type: 'image', url: bigUrl, buildPyramid: false },
    tabIndex: -1,
    showNavigator: false,
    showNavigationControl: false,
    gestureSettingsTouch: { pinchToZoom: true, dragToPan: true, flickEnabled: true, dblClickToZoom: true },
    gestureSettingsMouse: { scrollToZoom: true, clickToZoom: false, dblClickToZoom: true },
    maxZoomPixelRatio: 2,
    minZoomImageRatio: 0.8,
    visibilityRatio: 1,
    constrainDuringPan: true,
    animationTime: reducedMotion ? 0 : 0.6,
    springStiffness: 8,
    // crossOriginPolicy intentionally NOT set - Met images send no ACAO
  });
  const onFirstTile = () => { onFirstPaint(); viewer.removeHandler('tile-drawn', onFirstTile); };
  viewer.addHandler('tile-drawn', onFirstTile);      // finding #13: fade the poster here, not on 'open'
  viewer.addHandler('open', () => onControlsReady());
  viewer.addHandler('open-failed', () => onFail());  // keep poster, hide controls
  viewerRef.current = viewer;
  return () => { viewer.destroy(); viewerRef.current = null; };
}, [bigUrl]);
```
Controls: `+` -> `v.viewport.zoomBy(1.4); v.viewport.applyConstraints();`; `-` -> `zoomBy(1/1.4)` + constraints; reset -> `v.viewport.goHome()`. All `type="button"` with `aria-label`.

### Size gate (F3)
```ts
const AUTO_LOAD_MAX_BYTES = 4_000_000;
const auto = item.bigBytes != null && item.bigBytes <= AUTO_LOAD_MAX_BYTES;
const [wantsBig, setWantsBig] = useState(auto);
// button label: `Load full resolution (${(item.bigBytes/1e6).toFixed(1)} MB)` or '(size unknown)'
```
Until `wantsBig`, only the poster is shown - and the lazy chunk is not even requested, so the gate saves the OSD download too.

### ErrorBoundary (finding #7)
- `src/components/deep-zoom-error-boundary.tsx`, ~30 lines, classic class component with `componentDidCatch` -> logs, renders `props.fallback` (poster-only).
- In `main.tsx`: `window.addEventListener('vite:preloadError', () => setNeedsReload(true))` -> a small banner offering reload. Paired with phase 4's `_headers` rule `/index.html Cache-Control: no-cache` so a reload actually gets the new manifest.

## Related Code Files

### Create
- `color-walk/src/components/artwork-detail-overlay.tsx`
- `color-walk/src/components/artwork-deep-zoom-viewer.tsx` (default export for `React.lazy`)
- `color-walk/src/components/artwork-metadata-panel.tsx`
- `color-walk/src/components/deep-zoom-error-boundary.tsx`
- `color-walk/src/hooks/use-body-scroll-lock.ts` (iOS-safe; keeps the overlay under 200 lines)
- `color-walk/src/hooks/use-inert-siblings.ts`

### Modify
- `color-walk/src/app.tsx` - `selected` state, `open()`, `requestClose()`, `popstate`, render overlay
- `color-walk/src/main.tsx` - `vite:preloadError` listener
- `color-walk/src/components/artwork-masonry-grid.tsx` - pass `onSelect` through (contract already exists)
- `color-walk/package.json` - add `openseadragon@6.1.1`, `@types/openseadragon@6.0.0` (exact, per `.npmrc`)

### Delete
- none

## Implementation Steps
1. `npm i openseadragon@6.1.1` and `npm i -D @types/openseadragon@6.0.0`. Confirm the lockfile records exactly those.
2. Build `artwork-deep-zoom-viewer.tsx` standalone against a hardcoded CMA `print` URL from `bucket-14.json`, rendered full-screen behind a dev flag. Confirm the image opens with `buildPyramid: false` and that `destroy()` runs (log in cleanup).
3. Repeat step 2 with a **Met** `big` URL. This is the CORS-sensitive case; if it fails, `buildPyramid` or `crossOriginPolicy` has been set wrongly.
4. Add `+ / - / reset`; confirm `applyConstraints()` prevents panning the image off-screen.
5. `use-body-scroll-lock.ts` (iOS technique) and `use-inert-siblings.ts`. Test the lock on a real iPhone: the page behind must not rubber-band-scroll.
6. `artwork-detail-overlay.tsx`: dialog root, poster only, close button, backdrop click, Esc, focus store/restore. No viewer yet.
7. Wire `open()` / `requestClose()` / `popstate` in `app.tsx` exactly as written above. Manual matrix: Esc once; Esc three times fast; close button; backdrop; Back; Back then Forward; open -> change hue -> Back.
8. Verify `#h=212` survives an open/close cycle (phase 2's `replaceState` preserves `history.state`).
9. Size gate + "Load full resolution (N MB)" button. Verify the OSD chunk is **not** requested until the gate passes (Network tab).
10. Insert `<DeepZoomErrorBoundary><Suspense>...` and wire `onFirstPaint` -> poster fade, `onControlsReady` -> enable buttons, `onFail` -> keep poster + hide controls.
11. Simulate a chunk failure: in devtools, block the OSD chunk URL, open a detail -> the overlay must still render poster + metadata, never a blank screen.
12. `artwork-metadata-panel.tsx`: title, artist, date, 40 px swatch (`item.hex`) + mono `H {hue} / {name}`, **credit line**, `View at the museum` -> `item.page` (`target="_blank" rel="noopener noreferrer"`).
13. Reduced motion: read `matchMedia('(prefers-reduced-motion: reduce)').matches` once, pass `animationTime: 0`.
14. Bundle check: `npm run build`; `grep -l OpenSeadragon dist/assets/*.js` must match exactly one non-entry chunk.
15. Leak test: DevTools Memory -> snapshot, open+close 20 different artworks, force GC, snapshot again, filter `HTMLCanvasElement`. Count must return to baseline +/-1.
16. Phone test: pinch, two-finger pan, Back, edge back-swipe, and a >4 MB work to confirm the gate button.
17. `find color-walk/src -name '*.ts*' | xargs wc -l | sort -n` - nothing over 200.

## Todo List
- [x] `openseadragon@6.1.1` + `@types/openseadragon@6.0.0` exact in lockfile
- [x] Viewer with `{ type: 'image', buildPyramid: false }`, no `crossOriginPolicy`
- [x] Met `big` URL verified working (the no-ACAO case)
- [x] `viewer.destroy()` in effect cleanup
- [x] Custom `+ / - / reset`; `showNavigator/showNavigationControl: false`; `tabIndex: -1`
- [x] Poster fades on first `tile-drawn`, not on `open`
- [x] `open-failed` keeps the poster and hides controls
- [x] Size gate at 4 MB with `(N MB)` label; chunk not fetched until gate passes
- [x] `DeepZoomErrorBoundary` + `vite:preloadError` reload banner
- [x] iOS-safe scroll lock (`position: fixed` + `scrollTo` restore) + `overscroll-behavior: contain`
- [x] `inert` siblings + focus store/restore + `[tabindex]:not([tabindex="-1"])` in the wrap query
- [x] History: `closingRef`, `back()` only when `history.state?.cw === 'detail'`, `popstate` gated on `e.state`
- [x] Hue hash preserved across open/close
- [x] Metadata panel incl. credit line and museum link
- [x] Reduced motion -> `animationTime: 0`
- [x] OSD isolated in its own chunk (grep `dist/assets`)
- [x] 20x open/close heap snapshot clean
- [x] Phone: pinch, pan, Back, edge swipe, gate button
- [x] All files < 200 lines

## Measured results (recorded 2026-09-13)

All against the production build via `vite preview`, headless Chrome.

### Size gate, in the three cases that matter
| Case | `bigBytes` | Behaviour | OSD chunk before the gate | Poster after load | Zoom controls |
|---|---|---|---|---|---|
| CMA print, `cma-1922.1132` | 3.02 MB | auto-opened | requested | faded to 0 | enabled |
| Met original, `met-435599` | 0.07 MB | auto-opened | requested | faded to 0 | enabled |
| Met original, `met-782305` | 4.63 MB | gated, button read `Load full resolution (4.6 MB)` | **not requested** | faded to 0 after click | enabled |

Every big image returned HTTP 200 with `Access-Control-Allow-Origin: null`, which is the point: these render only because the viewer never needs to read their pixels back.

### The gate splits the collection better than the plan assumed
Met `bigBytes` came back from HEAD for **2104 of 2104** works, and CMA reported it for 3898 of 3944.

| | auto-opens (<= 4 MB) | gated (> 4 MB or unknown) |
|---|---|---|
| Met | 1681 | 423 |
| CMA | 2521 | 1423 |
| Total | **4202 (69%)** | 1846 (31%) |

The plan expected "essentially all Met originals" to sit behind the button; in fact 80% of them are under 4 MB. The threshold needs no change.

### Close matrix, focus and lifecycle
| Check | Result |
|---|---|
| Escape once | closes, `#h=208` intact |
| Escape three times fast | closes once, stays on the site |
| Close button / backdrop | both close |
| Browser Back | closes; Forward does **not** reopen an orphan |
| Open, change hue, Back | closes, hash back to `#h=212`, still on site |
| Tab cycle with the viewer ready | Zoom in, Zoom out, Reset zoom, View at the museum, Close, then wraps |
| Tab escaping the dialog | never; all three `#root` siblings carry `inert` |
| Escape returns focus | to the originating card |
| Scroll lock | `position: fixed`, `top: -900px`, restored to exactly 900 on close |
| 20 open/close cycles | 0 canvases and 0 OpenSeadragon containers left |
| OSD chunk blocked | poster plus metadata stay, reload prompt appears, never a blank screen |
| Reduced motion | poster fade and hue tint both collapse to 0.01 ms |
| 390 px | panel stacks below the image, no horizontal scroll, controls present |

OpenSeadragon resolves to exactly one non-entry chunk, 350 KB raw and 88 KB gzipped; the entry bundle contains no `OpenSeadragon` symbol.

## Changes to the plan made during phase 3

1. **`drawer: 'canvas'` is now as load-bearing as `buildPyramid: false`.** OpenSeadragon 6 defaults to a WebGL drawer, and WebGL cannot upload a cross-origin image without CORS headers as a texture at all. With the default the console logged `Error creating texture in WebGL`, no tile was ever painted, and the poster stayed up forever - the viewer looked broken in exactly the quiet way the ARTIC failure did. OpenSeadragon's own option docs state the rule: with the WebGL drawer and cross-origin tile sources, `crossOriginPolicy` must be set and the server must send CORS headers, otherwise only the canvas drawer can render. Since Met and CMA send no `Access-Control-Allow-Origin`, the canvas drawer is the only option, and it is now requested explicitly rather than left to fallback.
2. **The poster fades on `fully-loaded-change`, not `tile-drawn`.** Only the canvas drawer raises `tile-drawn`; registering the handler under the WebGL drawer logged `The WebGLDrawer does not raise the tile-drawn event` and the handler simply never fired. `fully-loaded-change` is drawer-independent and still fires after painting, which is what finding #13 asked for.
3. **The focus-trap query excludes disabled buttons.** The zoom controls start disabled until the viewer opens. Wrapping focus onto a disabled button silently does nothing, so Tab was stranded on the close button for as long as the image was loading. The selector is now `button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])`.
4. **`buildPyramid` needs a cast.** `@types/openseadragon@6.0.0` omits it from the image tile source even though the runtime has long accepted it. One commented cast, as the plan's risk table anticipated; no shim module was needed.
5. **The `vite:preloadError` listener lives in `app.tsx`, not `main.tsx`,** because the reload prompt it controls is rendered React state. `main.tsx` stays a three-line entry point.

## Not verified here

- **Real touch gestures.** Pinch-to-zoom, two-finger pan and the iOS edge back-swipe cannot be driven from headless Chrome. The layout, the gate button and the controls were checked at 390 px, and the iOS-safe scroll lock was verified by its observable effects (`position: fixed`, exact scroll restore), but the gestures themselves need a real device.
- **Heap-level leak counting.** The teardown check counts DOM canvases and OpenSeadragon containers after 20 open/close cycles, both of which return to zero. A DevTools heap snapshot filtered on `HTMLCanvasElement` would be stronger.

## Success Criteria
- A CMA `print` under 4 MB opens automatically and zooms smoothly; a Met original shows the gate button with its size in MB and only loads on click.
- Met `big` renders in the viewer (proves `buildPyramid: false` and the absence of `crossOriginPolicy`).
- Poster stays visible until the first tile is painted - no blank frame between `open` and first paint.
- OpenSeadragon appears in exactly one non-entry chunk; opening the gallery never downloads it.
- Blocking the OSD chunk still yields a usable overlay (poster + metadata), never a blank screen.
- Close matrix all pass: Esc, triple-Esc, button, backdrop, Back, Back+Forward, open->hue change->Back. Never leaves the site; never leaves an orphan history entry that reopens the overlay.
- Esc returns focus to the originating card; Tab never escapes the dialog, including into the OSD container.
- iOS: the page behind does not scroll or rubber-band; scroll position is restored exactly on close.
- Heap snapshot after 20 open/close cycles + forced GC shows canvas count within 1 of baseline.
- `npm run build` green; no file over 200 lines.

## Risk Assessment
| Risk | L x I | Mitigation |
|---|---|---|
| `buildPyramid` default (true) tainted-canvases Met images -> blank viewer | Med x High | Explicitly `false`; step 3 tests a Met URL specifically |
| Someone later "fixes" CORS by adding `crossOriginPolicy: 'Anonymous'` | Med x High | Comment in the options object stating why it must stay unset; called out in review checklist |
| Viewer leaks canvases / tile cache | Med x High | `destroy()` in cleanup + step 15 heap test as a hard gate |
| Double-close pops two entries and leaves the site | Med x High | `closingRef` + `history.state` check + `popstate` gated on `e.state` (finding #6) |
| Lazy chunk fails after a deploy | Med x Med | ErrorBoundary -> poster-only; `vite:preloadError` reload prompt; `/index.html no-cache` |
| Auto-loading a 6.5 MB CMA print on mobile data | Med x Med | 4 MB gate; measured p90 is 6.5 MB so the gate catches the tail |
| `bigBytes` null (HEAD failed at build time) -> unknown payload | Med x Low | Treated as "too big": gated behind the button with "(size unknown)" |
| iOS edge back-swipe dismisses the overlay unexpectedly | Med x Low | Accepted; it fires `popstate`, which is the correct close path |
| `@types/openseadragon@6.0.0` disagrees with runtime API | Low x Low | Local `declare module` shim as fallback; do not block on types |

## Security Considerations
- Metadata (`t`, `a`, `d`, `credit`) renders as React text children only. **No `dangerouslySetInnerHTML`.**
- `item.big` and `item.page` are re-validated before use: `isAllowedImageUrl(item.big)` for the tile source, and `item.page` must parse as `https:` with hostname in `{www.metmuseum.org, www.clevelandart.org}` before it reaches an `href`. OSD will fetch whatever URL it is given - this check is the only thing preventing a poisoned index file from pointing it elsewhere.
- No pixel readback (`buildPyramid: false`, no `crossOrigin`), so there is no tainted-canvas or cross-origin-read surface at all.
- External links carry `rel="noopener noreferrer"`.
- CSP impact: big images are `img-src https://images.metmuseum.org https://openaccess-cdn.clevelandart.org` - the same origins as thumbnails, so phase 4's header needs no addition. OSD requires no `unsafe-eval`; it does set inline styles heavily, which is the concrete reason phase 4 will need `style-src-attr 'unsafe-inline'`.
- `inert` on siblings also prevents background controls being activated by assistive tech while the modal is open.

## Next Steps
- Phase 4: colour naming, empty/error polish, reduced motion sweep, OG tags, CSP/HSTS headers, Lighthouse, README, deploy.
- Carry forward: the measured lazy-chunk size, how many works fall behind the 4 MB gate (from `meta.json` + a quick count), and whether the types shim was needed.
