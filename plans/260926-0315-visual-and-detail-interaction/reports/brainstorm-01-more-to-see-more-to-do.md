# Brainstorm: more to look at, more to do inside a work

**Date:** 2026-09-26
**Trigger:** "bổ sung thêm tính năng nào vào project để tăng visual hơn không, thêm gì vào detail để tăng interaction"
**Outcome:** four features approved and built; two ideas rejected on measurement.

## What the screenshots said

The gallery was a flat grid of pictures; a card gave up only a title on hover.
The overlay showed the picture on its lead colour with a swatch, the palette,
the twin, Save and the museum link. Opening a work was a dead end: nothing led
to the work beside it except closing and clicking again.

## Measured before choosing

| Idea | Measurement | Verdict |
|---|---|---|
| **Step to the neighbour inside the overlay** | No route from a work to the next one existed at all. The order is already in memory; 0 requests. | **Strongest.** Built. |
| **Palette on the card, and as the overlay's ground** | Page-0 entries with a non-empty palette: **7,293 of 10,075 (72%)**. At hue 210, 36 of 60 cards are more than one colour. | Cheap, honest. Built. |
| Cards sliding to their new order on a hue change | View Transitions, native. 60 named cards snapshot in **27–101 ms** in software-rendered headless Chrome; **240 named cost 193 ms**. | Built, capped at 60 named cards. |
| Compare with the twin, side by side | Twins on every entry; the twin card was already there. | Built as a toggle. |
| Eyedropper / zoom to a colour on the picture | Met CDN times out on a CORS probe; CMA answers with no `Access-Control-Allow-Origin`. No pixel of an artwork can be read. | **Dead.** |
| 3x3 colour map in the detail | Hue varies across cells in **11%** of works; lightness in 56%. | Would mostly show one hue shaded. Rejected. |

## Built

### Stepping
- `detail-stepping.ts`: `neighbours(items, id)` and `nearEnd`. `use-detail-stepping.ts` wires them to the overlay and prefetches both neighbours' thumbnails.
- The order is whatever is behind the overlay: the grid, or the saved works. An activity, a twin or a search result is not in that order, so those get no chevrons.
- `replace()` in `use-detail-overlay.ts` rewrites the history entry (`replaceState`), so Back still closes the overlay in one move instead of retracing every step.
- Chevrons at the picture's edges (`overlay-step-buttons.tsx`) and ArrowLeft/ArrowRight; the arrows are ignored while the zoom viewer has focus, because it pans with them.
- Stepping within 5 of the end of the revealed grid calls `revealMore`, so the grid the reader returns to has kept up and the next page loads in time.
- `app.tsx` was at 191 lines; the reload banner moved to `reload-banner.tsx`.

### Palette
- `paletteGradient()`: hard-edged bands, left to right, each as wide as its share; the worn colour first, so a copy filed under its blue leads with blue. A work of one colour is that colour.
- Used as the strip on a hovered card, the ground of the overlay, and the ground of each figure in the comparison.

### View transitions
- `withViewTransition()` runs a discrete change inside `document.startViewTransition` with `flushSync`: a press on the ring, the ring's arrow keys, the hue buttons, a swatch jump, the monochrome toggle, Clear, and a new bucket arriving. Drags never go through it. Reduced motion and the first fill (LCP) never do either.
- Cards carry `view-transition-name: w-<id>` (dots sanitised) for the first 60 revealed only.

### Compare
- `useTwin` moved from the panel to the overlay. "Compare side by side" toggles `artwork-twin-compare.tsx`: two figures on their own colours, captioned with title, museum and hex. The zoom viewer unmounts while comparing and the poster covers until it paints again.

## Verified in the browser, on the real index

| Check | Result |
|---|---|
| Open the first card, ArrowRight x3, ArrowLeft, click Next | Stucco Fragment, Textile sample, Illustrated book, Fish hook, Illustrated book, Fish hook |
| `history.length` open / after 5 steps / after Back | 3 / 3 / 3; the overlay closed on Back |
| Previous at the first work | disabled |
| 60 steps forward | grid 60 -> 120 cards; Next still enabled |
| Palette at hue 210 | 36 of 60 cards banded; strip and overlay ground carry the same gradient |
| Transitions in one session | 10 ran; ready 27–101 ms at 60 named, 154 ms for a bucket arriving; still 60 named after the grid grew to 240 |
| Hash after a key step, a swatch jump, Clear | `#h=50`, `#h=40&l=80`, `#h=all` |
| Compare | 2 figures: "Miniature Vase · Cleveland Museum · #0a59a9", "The Birth of the Virgin · Metropolitan Museum · #175590"; viewer gone while comparing, back afterwards |
| Console errors | 0, apart from museum image timeouts in the harness |
| Tests / build / file sizes | **267** (from 254) / OK / every file under 200 lines (overlay 187, app 186) |

## Found while proving it

- `crawl-control > stops once the time limit passes` failed once on timing during a full run and passed 5 of 5 on its own. A flake in a test this work did not touch; its margin deserves widening.
- A skipped transition rejects its `ready` promise. The browser marks those handled, but the probe's `.then` without a `.catch` surfaced two as console errors. Nothing in the app touches those promises.
- After a step the overlay remounts and focus lands on the first enabled button, which is now a chevron. Escape and the Tab trap are unchanged.

## Skipped

- Swipe to step on touch: the chevrons work on touch. Add when asked.
- Scrolling the grid to the stepped-to work on close: the grid has grown to include it; the scroll stays at the top.
- Tone slider transitions: a native range cannot tell a click from a drag.
