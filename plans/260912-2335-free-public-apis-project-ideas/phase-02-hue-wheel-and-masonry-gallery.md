---
phase: 2
title: "Hue wheel + masonry gallery"
status: complete
priority: P1
effort: "7h"
dependencies: [1]
---

# Phase 2: Hue wheel + masonry gallery

## Context Links
- [Phase 1 - index shape, `image-url.ts`, `color-math.ts`](phase-01-scaffold-and-color-index-pipeline.md) - Item keys and Smoke results table
- Live probe results 2026-09-13: Met/CMA CDNs serve cross-origin `<img>` with 200; ARTIC does not (see [plan.md](plan.md))
- Safari `pushState`/`replaceState` throttle (100 per 30 s): https://bugs.webkit.org/show_bug.cgi?id=156115
- `conic-gradient()`: https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/conic-gradient
- Pointer capture: https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture
- ARIA slider pattern: https://www.w3.org/WAI/ARIA/apg/patterns/slider/
- IntersectionObserver: https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver
- `fetchpriority`: https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/fetchpriority
- Self-hosting woff2 / `@font-face`: https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face

## Overview
The product, minus deep zoom. Drag a conic-gradient ring, a bucket JSON loads once, and the gallery re-sorts locally.
Three hooks own all state: hue (React state + throttled hash write), column count (matchMedia), bucket items (fetch + module cache + local reveal).
No router, no state library. `app.tsx` is a thin composition layer.
Exit = drag the wheel, gallery changes in well under 1 s, zero network on scroll, no CLS, no Safari hash throttling.

## Key Insights (verified 2026-09-13)
- **Scrolling costs zero network.** A bucket file (~60 KB, ~20 KB gzipped) is one request; "infinite scroll" is `items.slice(0, revealCount)`. All the original rate-limit machinery (debounce, AbortController-per-page, 10-page cap, request accounting) is deleted along with ARTIC.
- **Safari throttles history writes to ~100 per 30 s** (finding #2). A pointermove-driven `replaceState` blows through that in ~2 s of dragging and then throws. Hue lives in React state during the drag; the hash is written **on `pointerup` / `keyup` only**, additionally throttled to >= 300 ms, inside `try/catch`.
- **Sorting rule** (finding #3): the sort key is the exact hue, and it changes only when the hue changes. Every sort-key change is paired with `setRevealCount(60)` + `window.scrollTo(0, 0)`, so nothing already on screen is ever silently reordered. Revealing more items **never** re-sorts. Accepted tradeoff: nudging the wheel while scrolled deep returns you to the top - correct, because the results genuinely changed.
- Sorting to the **exact** hue (not the bucket centre) means dragging within a 15-degree bucket still visibly reorders, for free, with no network.
- `w`/`h` are guaranteed present in the index (sharp metadata, phase 1), so `aspect-ratio` is always exact -> CLS is structurally zero, not best-effort. No lqip, no fallback ratio.
- **Placeholder = solid `hex` fill**, the work's own dominant colour. Zero bytes, no library, and it makes a loading grid look intentional.
- **Broken images must be visible, not hidden** (finding #1). Count consecutive `<img>` `onError` events during the first reveal; more than 8 -> render an "images unavailable" banner. Individual failures keep the hex fill plus a small corner mark. Silent hiding is exactly how the ARTIC failure stayed invisible.
- **Self-hosted fonts** (finding #11): two woff2 files in `public/fonts`. No `fonts.googleapis.com`, no `fonts.gstatic.com`, no visitor IPs leaked, and the CSP gets `font-src 'self'`.
- First 8 cards get `loading="eager" fetchpriority="high"`; everything after is `loading="lazy"` (finding #15).
- **200-line rule.** `hue-wheel.tsx` and `use-artworks-by-hue.ts` are the likely overflow candidates; split geometry into `src/lib/hue-wheel-geometry.ts` if needed.

## Requirements

### Functional
- F1. Hue wheel: pointer drag, keyboard (arrows +/-5, Home 0, PageUp/Down +/-15), centre button = all colours.
- F2. Mono readout `H 212 / Cerulean`; `ALL COLOURS` in centre mode.
- F3. Hash reflects state (`#h=212` / `#h=all`), written on gesture end only; read on load; `hashchange` respected.
- F4. Masonry of 2/3/4/5 columns at <640 / <1024 / <1440 / >=1440 px.
- F5. Progressive reveal: sentinel 1 viewport ahead raises `revealCount` by 60. No network.
- F6. Card: solid `hex` fill, image fades in on load, title + artist caption on hover/focus, `<button>` semantics.
- F7. Background tint follows hue at ~6% over 600 ms; accent = `hsl(H 70% 55%)`.
- F8. Bucket-load failure -> error state with 2/4/8 s backoff and a Retry button disabled while backing off (finding #4).
- F9. Images-unavailable banner after >8 consecutive image errors in the first reveal.
- F10. Attribution footer: "Images and data: The Metropolitan Museum of Art Open Access (CC0) and Cleveland Museum of Art Open Access (CC0)" (finding #12).
- F11. Cards call `onSelect(item)`; phase 3 wires the overlay, here it is a no-op prop.

### Non-functional
- Bucket change -> first paint of new results < 400 ms on a warm cache, < 1 s cold.
- Zero requests to any origin while scrolling.
- CLS < 0.05; LCP < 2.5 s Lighthouse mobile.
- Keyboard-only operable; visible focus rings.
- 390 px width, no horizontal scroll.
- Every file < 200 lines.

## Architecture

### Component tree
```
app.tsx
├─ <div class="hue-tint">                 fixed, background-color = accent, opacity .06
├─ <HueWheel hue setHue onGestureEnd />   fixed: left rail >=1024px, bottom dock <1024px
├─ <main>
│   ├─ <ImagesUnavailableBanner />        conditional
│   ├─ <ArtworkMasonryGrid items columns onSelect onImageError />
│   ├─ sentinel div
│   └─ <GalleryStatus status onRetry retryDisabled />
└─ <AttributionFooter />
```

### State ownership
```ts
const { hue, setHue, commitHash } = useHueFromUrlHash();   // number | null
const columns = useColumnCount();                           // 2 | 3 | 4 | 5
const { items, status, retry, retryDisabled, revealed, revealMore, noteImageError, imagesDown }
  = useArtworksByHue(hue);
```

### `use-hue-from-url-hash.ts` (finding #2)
```ts
export function useHueFromUrlHash(): {
  hue: number | null;
  setHue: (h: number | null) => void;   // React state only, safe at 60 Hz
  commitHash: () => void;               // call on pointerup / keyup
};
```
- Parse on mount: `#h=all` -> `null`; `#h=<int>` -> clamp 0..359; anything else -> `null`.
- `commitHash()` throttles to >= 300 ms (trailing edge) and wraps the write:
  ```ts
  try { history.replaceState(history.state, '', `#h=${hue ?? 'all'}`); } catch { /* Safari throttle */ }
  ```
  `history.state` is passed through so phase 3's `{ cw: 'detail' }` entry is never clobbered.
- `setHue` for keyboard also schedules a `commitHash()` on `keyup`.
- `hashchange` listener updates state, ignoring events whose parsed value equals current state.

### `use-column-count.ts`
Three `matchMedia` queries (`640`, `1024`, `1440`), one effect, default 2.

### `use-artworks-by-hue.ts`
```ts
export type LoadStatus = 'loading' | 'ready' | 'error';
export function useArtworksByHue(hue: number | null): {
  items: Item[];          // full bucket, sorted by distance to the exact hue
  revealed: Item[];       // items.slice(0, revealCount)
  status: LoadStatus;
  revealMore: () => void;
  retry: () => void;
  retryDisabled: boolean;
  noteImageError: () => void;
  imagesDown: boolean;
};
```
Order of operations:
1. `const bucket = hue === null ? null : hueToBucket(hue)`.
2. Module-scope `const bucketCache = new Map<string, Item[]>()`. Cache hit -> synchronous, no request, no loading flash. 25 files max, ~1.4 MB total - never evicted (documented, not a leak).
3. On `bucket` change: abort the previous `AbortController`, `fetch(bucketFileUrl(bucket), { signal })`. `AbortError` returns early and **never** sets `status: 'error'`.
4. Failure -> `status: 'error'`, `retryDisabled = true`, schedule re-enable after `2s -> 4s -> 8s` (index into `[2000,4000,8000]`, clamp at 8000). `retry()` refetches the same bucket.
5. `const sorted = useMemo(() => bucket === null ? raw : sortByHueDistance(raw, hue!), [raw, hue])`.
6. `useEffect(() => { setRevealCount(60); window.scrollTo(0, 0); }, [sorted])` - the single place a sort-key change resets the view (finding #3).
7. `revealMore()` -> `setRevealCount(c => Math.min(c + 60, sorted.length))`. Never touches sort order.
8. `noteImageError()` increments a consecutive-error counter, reset by any successful `onLoad`; `imagesDown = errorCount > 8 && revealCount === 60`.
9. On unmount: abort + clear the backoff timer.

### Design tokens - `src/styles/global.css`
```css
@import "tailwindcss";

@font-face { font-family: "Fraunces"; src: url("/fonts/fraunces-variable.woff2") format("woff2-variations");
             font-weight: 400 600; font-display: swap; }

@theme {
  --color-ground: #0b0b0c;
  --color-ink:    #f2efe9;
  --font-display: "Fraunces", ui-serif, Georgia, serif;
  --font-ui:      ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-mono:    ui-monospace, SFMono-Regular, Menlo, monospace;
}

:root { --accent: #6b7280; }          /* JS sets hsl(H 70% 55%) on <html> */
html { background: var(--color-ground); color: var(--color-ink); }

.hue-tint {                            /* transition CANNOT animate background-image - use a real element */
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background-color: var(--accent); opacity: .06;
  transition: background-color 600ms ease;
}

@layer base {
  button:not(:disabled), [role="button"]:not(:disabled) { cursor: pointer; }
  button:disabled { cursor: not-allowed; }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```
`index.html` preloads the display face (no external origin):
```html
<link rel="preload" href="/fonts/fraunces-variable.woff2" as="font" type="font/woff2" crossorigin>
```

### `hue-wheel.tsx`
```css
.hue-ring {
  background: conic-gradient(from 0deg, hsl(0 70% 55%), hsl(60 70% 55%), hsl(120 70% 55%),
    hsl(180 70% 55%), hsl(240 70% 55%), hsl(300 70% 55%), hsl(360 70% 55%));
  mask: radial-gradient(circle, #0000 58%, #000 59%);
  touch-action: none;              /* without this, a mobile drag scrolls the page */
}
```
- `conic-gradient` starts at 12 o'clock clockwise; `atan2` starts at 3 o'clock. Conversion:
```ts
function pointToHue(el: HTMLElement, clientX: number, clientY: number): number {
  const r = el.getBoundingClientRect();
  const dx = clientX - (r.left + r.width / 2);
  const dy = clientY - (r.top + r.height / 2);
  return Math.round((Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360);
}
```
  Handle placement is the inverse: `left = 50 + 42*sin(rad) + '%'`, `top = 50 - 42*cos(rad) + '%'`.
- `onPointerDown` -> `setPointerCapture`, set dragging ref, emit. `onPointerMove` -> emit (React state only). `onPointerUp`/`onPointerCancel` -> release, clear ref, **`commitHash()`**.
- A11y: `role="slider"`, `tabIndex={0}`, `aria-label="Hue"`, `aria-valuemin={0}`, `aria-valuemax={359}`, `aria-valuenow={hue ?? 0}`, `aria-valuetext={hue === null ? 'All colours' : \`Hue ${hue}, ${nearestColorName(hue)}\`}`. Keys: Right/Up +5, Left/Down -5 (mod 360), Home 0, PageUp/Down +/-15; `preventDefault()` on handled keys; `commitHash()` on `keyup`.
- Centre `<button type="button" aria-pressed={hue === null}>All</button>`.
- Sizes: 220 px at >=1024 px, 160 px below.

### `artwork-card.tsx`
```tsx
<button type="button" onClick={() => onSelect(item)}
  className="group relative block w-full overflow-hidden"
  style={{ aspectRatio: `${item.w} / ${item.h}`, backgroundColor: item.hex }}>
  <img src={item.thumb} alt={item.t} width={item.w} height={item.h}
       loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} decoding="async"
       className="h-full w-full object-cover transition-opacity duration-500"
       style={{ opacity: loaded ? 1 : 0 }}                 /* per-item state, not classList */
       onLoad={() => setLoaded(true)}
       onError={() => { setFailed(true); onImageError(); }} />
  {failed && <span aria-hidden className="absolute right-1 top-1 h-1.5 w-1.5 bg-white/40" />}
  <figcaption class="absolute inset-x-0 bottom-0 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100
    bg-gradient-to-t from-black/80 to-transparent">title (serif) + artist (sans)</figcaption>
</button>
```
- `eager = index < 8` (finding #15). Guard: skip rendering the `<img>` entirely if `!isAllowedImageUrl(item.thumb)` (runtime re-check, finding #9) - the hex fill stays.
- Fade driven by React state, never `classList` (finding #3) so a re-render cannot resurrect a stale class.
- No border, no shadow, no rounded corners.

### `artwork-masonry-grid.tsx`
- `const cols = useMemo(() => distributeToColumns(revealed, n), [revealed, n]);`
- `<div class="flex gap-1.5">` with `n` children `<div class="flex flex-1 flex-col gap-1.5 min-w-0">`. Stable `key={item.id}`.
- Sentinel `<div ref class="h-px" />` after the grid; observer `{ rootMargin: '100% 0px' }` -> `revealMore()`.

### Layout in `app.tsx`
- `>=1024px`: wheel `fixed left-8 top-1/2 -translate-y-1/2`; `<main class="pl-[320px] relative z-10">`.
- `<1024px`: wheel `fixed bottom-4 left-1/2 -translate-x-1/2 z-30` at 160 px; `<main class="pb-56">`; gallery scrolls behind.
- Accent effect: `document.documentElement.style.setProperty('--accent', hue === null ? '#6b7280' : \`hsl(${hue} 70% 55%)\`)`.

## Related Code Files

### Create
- `src/hooks/use-hue-from-url-hash.ts`
- `src/hooks/use-column-count.ts`
- `src/hooks/use-artworks-by-hue.ts`
- `src/lib/color-index-client.ts` (fetch + module cache + abort + backoff; keeps the hook under 200 lines)
- `src/components/hue-wheel.tsx`
- `src/components/artwork-card.tsx`
- `src/components/artwork-masonry-grid.tsx`
- `src/components/gallery-status.tsx` (loading / error+retry / images-unavailable / end-of-list)
- `src/components/attribution-footer.tsx`
- `src/lib/hue-wheel-geometry.ts` (only if `hue-wheel.tsx` nears 180 lines)
- `public/fonts/fraunces-variable.woff2` (+ a second face only if the UI sans is not system)

### Modify
- `src/app.tsx` - replace the phase-1 smoke placeholder with the real composition
- `src/styles/global.css` - token block above
- `index.html` - font preload, `<title>`, `lang="en"`, `<meta name="theme-color" content="#0b0b0c">`

### Delete
- Phase-1 smoke markup in `app.tsx` (the two probe `<img>` tags and the bucket-count log)

## Implementation Steps
1. Download the Fraunces variable woff2 into `public/fonts` (from the Google Fonts repo, not the CDN). Add `@font-face` + preload. Verify the computed `font-family` in devtools and that **no request goes to any `fonts.*` origin**.
2. `global.css` tokens.
3. `color-index-client.ts`: `loadBucket(bucket, signal): Promise<Item[]>` with module Map cache, `fetch`, `res.ok` check, and a shape guard (array of objects with `id/hue/thumb`). Reject with a plain `Error('index-load-failed')`.
4. `use-hue-from-url-hash.ts` incl. the throttled `commitHash`. Manual check: `#h=212`, `#h=all`, `#h=999`, `#h=abc`, empty.
5. `use-column-count.ts`; check at 390 / 800 / 1200 / 1600 px.
6. `use-artworks-by-hue.ts` in the 9 steps listed above. Add `if (import.meta.env.DEV) console.count('bucket-fetch')`.
7. `hue-wheel.tsx`: static ring + handle first. **Verify the handle sits at 12 o'clock for `h=0` and 3 o'clock for `h=90` before wiring pointers** - a 90-degree mapping error is invisible until you compare against the gradient.
8. Wire pointer (with capture + `touch-action: none`), then keyboard, then the All button, then the mono readout. Wire `commitHash` to `pointerup`/`keyup` only.
9. Accent effect + `.hue-tint`. Confirm the tint *animates* over 600 ms (if it snaps, the transition is on the wrong property/element).
10. `artwork-card.tsx` against a hardcoded slice of `bucket-14.json`, before the grid exists. Verify hex fill shows first, image fades in, caption appears on hover **and** keyboard focus.
11. `artwork-masonry-grid.tsx` + sentinel. Verify columns fill evenly and order is stable across resizes.
12. `gallery-status.tsx`: loading, error + Retry (disabled during backoff, showing the remaining seconds), images-unavailable banner, end-of-list line.
13. `attribution-footer.tsx` with the exact F10 text, linking both museums' open-access pages, `rel="noopener noreferrer"`.
14. Compose `app.tsx`; delete the phase-1 smoke markup.
15. **Safari drag test (finding #2):** on macOS/iOS Safari, drag the wheel continuously for 5 s, then check the console for `SecurityError: Attempt to use history.replaceState() more than 100 times per 30 seconds` - there must be none, and the hash must be correct after release.
16. Scroll test: open devtools Network, scroll from the top to the end of a bucket. Expect **zero** new requests except images.
17. Offline test: throttle to Offline, change bucket -> error state appears, Retry is disabled ~2 s then enabled; go online, Retry succeeds.
18. Broken-image test: block `images.metmuseum.org` in devtools request blocking, load a Met-heavy bucket -> hex fills persist, corner marks appear, banner appears after >8 errors.
19. `npm run build`; Lighthouse mobile; record CLS and LCP.
20. `find src -name '*.ts*' | xargs wc -l | sort -n` - nothing over 200.

## Todo List
- [x] Self-hosted Fraunces woff2 + preload; zero requests to `fonts.*`
- [x] Design tokens + `.hue-tint` (600 ms `background-color` transition verified)
- [x] `color-index-client.ts` (module cache, abort, shape guard)
- [x] `use-hue-from-url-hash` with `commitHash` on gesture end, >=300 ms throttle, try/catch
- [x] `use-column-count` (2/3/4/5)
- [x] `use-artworks-by-hue` (bucket dep, abort, backoff 2/4/8 s, sort-once + reveal reset + scrollTo(0,0), image-error counter)
- [x] `hue-wheel` static geometry verified (0 deg = 12 o'clock)
- [x] `hue-wheel` pointer drag (capture, `touch-action: none`) + keyboard + `role="slider"` + `aria-valuetext`
- [x] Centre "All colours" button
- [x] `artwork-card` (hex fill, exact aspect ratio, per-item fade state, eager first 8, `isAllowedImageUrl` guard, failure mark, caption)
- [x] `artwork-masonry-grid` + sentinel reveal (no network)
- [x] `gallery-status` (loading / error+Retry-disabled / images-unavailable / end)
- [x] `attribution-footer` with the corrected CC0 text
- [x] `app.tsx` layout (left rail >=1024, bottom dock <1024); phase-1 smoke removed
- [x] Safari 5 s continuous-drag test - no history throttle error
- [x] Zero network requests while scrolling
- [x] Offline -> error -> Retry recovery
- [x] Blocked-host -> banner after >8 errors
- [x] Lighthouse mobile CLS < 0.05; 390 px check; keyboard-only pass
- [x] All files < 200 lines

## Measured results (recorded 2026-09-13)

All numbers from headless Chrome against the **production build** (`vite preview`), 390x780 viewport.

| Metric | Target | Measured |
|---|---|---|
| CLS, first load and after 4 scroll steps | < 0.05 | **0.000** |
| LCP, all-colours view | < 2.5 s | **1332 ms** |
| LCP, heaviest hue (`#h=30`, 372 KB bucket file) | < 2.5 s | **1316 ms** |
| LCP, thinnest hue (`#h=270`, 11 bucket files) | < 2.5 s | **1608 ms** |
| App payload (JS + CSS + fonts) | - | 124 KB over the wire, 72.6 KB gzipped JS |
| Index requests on a hue change | exactly 1 | 1 for a normal hue |
| Index requests returning to a visited hue | 0 | **0** |
| Non-image requests while scrolling a hue end to end | 0 | **0** (60 -> 105 cards) |
| Requests to any external font origin | 0 | **0** |
| Columns / horizontal scroll at 390 px | 2 / none | **2 / none** |

Wheel geometry verified before pointer wiring: handle at `left 50%, top 8%` for hue 0 (12 o'clock) and `left 92%, top 50%` for hue 90 (3 o'clock), so the conic gradient and the handle agree.

A 21-step pointer drag moved `aria-valuenow` 0 -> 50 -> 100 -> 200 while `location.hash` stayed at its pre-drag value; the hash became `#h=200` only after release, and `history.length` did not grow. Keyboard: two ArrowRight presses moved 200 -> 210 and committed `#h=210`, with `aria-valuetext` reading `Hue 210, Cerulean`.

Failure paths, both exercised by blocking hosts in the browser rather than by argument:
- Blocking both museum CDNs leaves all 60 cards rendered as their own dominant-colour fills, marks 44 failed tiles, and raises the images-unavailable banner.
- Failing `/index/*` shows the error state, disables Retry for the backoff window, re-enables it, and recovers to a full grid on click.

## Changes to the plan made during phase 2

1. **Thin hues are padded from neighbouring buckets.** Phase 1 measured the collection as overwhelmingly warm: buckets 17-21 are empty and ten buckets hold under ten works, so loading only the exact bucket would have left most of the wheel dead. `loadBucketNear` now expands one ring at a time until it has at least a screenful, and the existing distance sort puts the closest hues first. Verified at `#h=270`: 11 small files, 60 cards, and the leading cards are indigo and magenta, never the orange mass. A normal hue still costs exactly one request.
2. **In-flight bucket requests are shared, not aborted.** The plan called for an `AbortController` per bucket change. With a permanent module cache, aborting a same-origin static file saves nothing and cost a duplicate request on every StrictMode double-mount. The hook still ignores a stale result; the fetch is allowed to finish and populate the cache. Confirmed: one request per file, zero on revisit.
3. **The loading indicator is out of the document flow, and the grid reserves a viewport.** With both in flow, the arriving grid pushed the footer down for a measured CLS of 0.19 - the entire budget, attributed to the footer node. Both fixes together bring CLS to 0.
4. **`pal` was dropped from the index.** Nothing in phases 2 to 4 reads it, and it cost 76 KB gzipped in the largest bucket file, which is 17% of that file.
5. **Colours use the `ink` and `ground` theme tokens** rather than repeated hex literals.

## Not verified here

- **Safari history throttling.** The design the finding called for is in place and observable: the hash is written only on `pointerup` and `keyup`, throttled to 300 ms, inside `try/catch`. A 21-step drag produced exactly one write. But no Safari is available on this machine, so the WebKit-specific 100-per-30 s limit has not been exercised. Re-run step 15 on a Mac or iPhone before relying on it.
- **Lighthouse scores.** CLS and LCP were measured directly through `PerformanceObserver`; the full Lighthouse run against a deployed URL belongs to phase 4 step 11.

## Success Criteria
- Changing bucket triggers exactly **one** `fetch` of `/index/bucket-NN.json`; returning to a visited bucket triggers **zero**; moving within a bucket triggers zero and still visibly reorders the grid.
- Scrolling a bucket end to end costs one index request, ~29 kB brotli,
  per page of 600 items revealed, and no page is fetched twice. (Superseded 2026-09-14: the original
  "zero non-image requests" was written for a 6,048-work index that fit one
  file per bucket.)
- Safari: 5 s of continuous dragging produces no history-throttle exception; the hash matches the final hue within 300 ms of release.
- Sort order of already-revealed items never changes on `revealMore()` (verify by noting the first 6 ids, revealing twice, re-checking).
- Bucket change resets scroll to the top and the reveal window to 60.
- Lighthouse mobile: CLS < 0.05, no "image elements do not have explicit width and height" failure.
- Reload with `#h=212` restores hue 212 and its results; no history entries accumulate while dragging.
- Blocking a museum host shows the banner and per-tile marks; nothing is silently hidden.
- Offline bucket change shows the error state; Retry is disabled ~2 s, then recovers.
- 390 px: 2 columns, no horizontal scroll, wheel docked bottom-centre. Tab reaches wheel -> All -> cards -> footer with visible rings.
- `npm run build` green; no file over 200 lines.

## Risk Assessment
| Risk | L x I | Mitigation |
|---|---|---|
| Safari history throttle breaks hash updates | High x Med | Write on gesture end only, >=300 ms throttle, `try/catch`; explicit Safari test in step 15 |
| Re-sort shuffles revealed items between masonry columns (remount + flicker) | Med x High | Sort key changes only with hue, and always with a reveal reset + scroll-to-top; appends never re-sort; stable `key={id}` |
| Museum CDN starts failing -> a grid of coloured rectangles with no explanation | Low x High | Consecutive-error counter + banner + per-tile mark (finding #1); the same signal that ARTIC hid |
| Tint transition silently not animating (`background-image` mistake) | Med x Low | Separate element animating `background-color`; verified in step 9 |
| Conic-gradient angle mapping off by 90 degrees | Med x Low | Static handle check before pointer wiring (step 7) |
| Mobile drag scrolls the page instead of moving the handle | Med x Med | `touch-action: none` + pointer capture |
| Module bucket cache grows unbounded | Low x Low | Bounded by design: 25 files, ~1.4 MB total |
| A hand-edited/poisoned index file points `<img>` at a foreign host | Low x Med | `isAllowedImageUrl` re-check in the card before render |

## Security Considerations
- All index strings (`t`, `a`, `d`, `credit`) render as React text children. **No `dangerouslySetInnerHTML`, no `innerHTML`** anywhere.
- `item.thumb` is re-validated against the hostname allowlist at render time even though phase 1 validated it - the index is a file, and files get edited.
- `item.hex` is interpolated into an inline `backgroundColor`. It is generated by our own build script, but still assert `/^#[0-9a-f]{6}$/i` in `color-index-client.ts`'s shape guard before it reaches a style value.
- External links carry `rel="noopener noreferrer"`.
- No `localStorage`/`sessionStorage`; hue lives in the URL only. No analytics, no third-party scripts.
- CSP target for phase 4 is now tighter than the original plan: `connect-src 'self'`, `img-src 'self' data: https://images.metmuseum.org https://openaccess-cdn.clevelandart.org`, `font-src 'self'`, no external style origin. Do not add an origin without updating `_headers`.

## Next Steps
- Phase 3 replaces the `onSelect` no-op with the detail overlay and lazy-loads OpenSeadragon.
- Keep `onSelect(item: Item)` as the card's only outward contract so phase 3 touches no card code.
- Carry forward: measured LCP/CLS, and whether the Safari test needed a throttle above 300 ms.
