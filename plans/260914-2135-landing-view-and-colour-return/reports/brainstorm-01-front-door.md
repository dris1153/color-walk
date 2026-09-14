# Brainstorm: the front door, and the way back from a work

**Date:** 2026-09-14
**Trigger:** "có thêm ý tưởng nào hay ho để apply thêm cho project không"
**Outcome:** agreed. One measured defect to fix, one dead end to open, one of my own
concerns retracted after measuring it.

## The idea hunt found a defect instead

`all.json` is the `#h=all` view: the first screen anyone sees. It is the top 300
works by `pct`. What that actually produces today:

| | |
|---|---|
| Hue buckets represented | **2 of 24** - 299 from bucket 2, 1 from bucket 3 |
| `pct` across all 300 | 0.999 - 1.000 |
| Colour range | `#745f49` to `#d0c2b2` |
| `sat` p50 | 38 |

The first eight works on the front page: `#745f49`, `#bca687`, `#ac9479`,
`#d7bca2`, `#725e47`, `#d0bfab`, `#ccab8d`, `#d0c2b2`. Brown, beige, cream -
ink on silk and aged paper.

A site called Color Walk, whose premise is colour spread across a collection,
opens on a wall of aged paper.

**Cause.** `pct` is the dominant colour's coverage, so a near-flat image scores
~1.0. The index holds 268 works at `pct >= 0.999`, and bucket 2 (orange) holds
4,407 of 6,049 works, so it takes almost the whole top 300.

**It gets worse with the crawl, not better.** More works means more near-1.0
`pct`, still one bucket, still beige.

## Fix: a slice across the wheel, not a top-N

`buildAll` becomes:

- sort each bucket by `sat` descending
- allocate **smallest bucket first**: `share = ceil(remaining / bucketsLeft)`,
  take `min(share, available)`
- shortfall from thin buckets flows to the fat ones, so it lands on exactly 300
- order the result **by hue**, so the grid reads as a walk around the wheel

Measured on today's index:

| | before | after |
|---|---|---|
| Buckets represented | 2 | **19 of 19 occupied** |
| `sat` p50 | 38 | **57** |
| Distinct hex | 278 | 300 |
| Per-bucket | 299 / 1 | 30, 29, 29, 29, 30, 22, 15, 11, 10, 10, 10, 7, 3, 2, 1, 1, 1 |

Build-side only. No new request, no new UI, `ALL_LIMIT` stays 300. The verifier's
assertion changes from "sorted by pct" to "sorted by hue".

**Accepted risk:** the spectrum is uneven - some hues contribute a single work.
That is the truth about the collection, and the ring already reports density.

## Fix: the swatch becomes the way back

In the overlay, `H 30 / Orange` is dead text. Open a work and the only exits are
Close and the museum's own site; there is no way to say "more of this colour".

The swatch becomes a button: close the overlay, set hue to `item.hue` and tone to
`item.lig`, commit the hash.

**Deliberate: it sets both, not just hue.** The swatch shows one specific colour.
Setting hue alone would show that hue at every lightness, which is not what the
swatch promised.

`item.lig` spans 9-89 while the slider offers 15-80, so it needs clamping.
`clampTone` moves into `color-math.ts` and is shared with `view-hash.ts`, which
clamps inline today - the same rule `parseViewHash` already documents: the
displayed tone and the sorted tone must not drift apart.

`app.tsx` is at 198 of 200 lines, so per the note carried from the last
brainstorm, composition goes down **first**: the IntersectionObserver sentinel
effect moves to `src/hooks/use-reveal-on-scroll.ts`. Frees ~11 lines; the new
callback costs ~9.

A new button inside the overlay means re-running the focus and tab-order matrix.

## Retracted: git size is not a problem

I raised it, then measured it, and it is wrong.

| | |
|---|---|
| Four versions of `bucket-02.json`, 309 kB raw each | on disk: 69 B, 38.6 kB, 64 B, 25.8 kB |
| Whole `public/index` history | 7.5 MB raw -> **0.5 MB packed, 14.4x** |

Git deltas this JSON well, including a version whose item order was fully
reshuffled (38 kB against 309 kB). Projected to 100k works: ~51 MB raw, ~8x under
zlib alone, so roughly 6 MB packed, with later rebuilds costing only their
difference. Nothing to handle.

## Considered and rejected

| Idea | Why not |
|---|---|
| An era axis from `d` | 78% yield a bare year, ~95% if decade forms like "1800s" are parsed. Real, but it is a second product competing with colour for the interface. |
| `pct` as a third slider | Three sliders is where an instrument becomes a control panel. `pct`'s honest job is already done: it orders each bucket file. |
| A saturation axis | Measured p10 22 to p90 51, a 29-point band against tone's 19 to 70. Weaker than the axis that already exists. |

## Built and measured, 2026-09-14

`buildAll` run against the shipped 6,049-work index:

| | before | after |
|---|---|---|
| Buckets represented | 2 | **19 of 19 occupied** |
| `sat` p50 | 38 | **57** |
| Distinct hex | 278 | 300 |
| Hue-ordered | - | yes |

The 300 now walk: `#781616` crimson at the start, `#67743e` olive in the middle,
`#e0555a` back to red at the end.

Composition went down twice before anything was added, as the standing note
required: `use-reveal-on-scroll.ts` and `use-detail-overlay.ts` came out of
`app.tsx`, which went 198 -> 175 -> 185 with the new work in it.

### Two defects found by the browser checks

1. **The jump did nothing.** `browseColour` closed the overlay and then wrote the
   hash, but closing is a `history.back()` that lands *after* the current tick
   and restores the URL the write had just changed. Fixed by holding the work in
   `pendingColour` and applying it only once `selected` is null - that is, once
   the back navigation has actually landed.
2. **Back walked off the site.** `commitHash` uses `replaceState`, so the jump
   overwrote the entry the reader arrived from and Back left the document. A
   colour jump is a discrete navigation, not a drag, so it earns `pushHash` and
   its own entry. Back now returns to the previous colour.

### An instrument that lied

The first CLS reading on a hue view was 0.0303, and HEAD measured the same, so it
looked pre-existing. It was neither: the harness aborts requests to the museum
CDNs, so every `<img>` collapsed and faked a shift. Measured again with images
allowed, both builds report **CLS 0** on `#h=all`, `#h=30`, `#h=200` and
`#h=204&l=35`.

### Regression

| Check | Result |
|---|---|
| Tests | 100 (up from 100 - six `buildAll` tests replaced three) |
| Overlay close matrix | Escape, thrice, Close, backdrop, Back/Forward, hue-change-then-Back: all closed, all still on site |
| Focus | trap holds, the new button is a stop, focus returns, scroll lock restores 900px |
| Viewer teardown | 0 canvases and 0 OSD containers after 20 cycles |
| CSP | 0 violations on gallery and with an overlay, on this build and HEAD |
| Shared link | `#h=204&l=35` reproduces the same top work on a cold load |
| Largest file | `app.tsx` 185 |

**Not done:** `public/index` was not rewritten. The owner's crawl was mid-run and
owns that directory, so `buildAll` was verified against the shipped index
offline instead. The new landing view appears on the next `npm run build:index`.

## Success criteria

- `#h=all` shows every occupied bucket, `sat` p50 >= 55, and no work is there for
  having a high `pct`.
- Clicking a work's swatch closes the overlay and lands the grid on that work's
  hue and tone; the resulting `#h=&l=` link is shareable.
- No file over 200 lines.
- Still green: 97 tests, zero CSP violations, CLS 0, overlay close matrix, tab order.
