# Brainstorm: Color Walk v2

**Date:** 2026-09-13
**Input:** shipped v1 (commits 1550ac1..da4d9f7), its measured index and Lighthouse numbers
**Outcome:** agreed. Add a lightness axis, keep the site fully static, add localStorage favourites, replace the proxy leak check with a real heap snapshot.

## Problem

v1 works and is verified, but two measurements say the core interaction is weak:

- Hue buckets 1-3 hold **95%** of 6,048 works. Buckets 17-21 are empty. Runtime neighbour padding hides the emptiness but cannot create variety: drag from 240 deg to 300 deg and you largely see the same works.
- Bucket 2 alone holds **4,406 works** with no way to navigate inside it. The gallery reveals 60 at a time; the other 4,346 are unreachable in practice.

Secondary, already measured and understood: Lighthouse mobile Performance 73 and Best Practices 77, both capped by museum image sizes and the Met WAF cookie. Deploy still blocked on Cloudflare credentials.

## Hypotheses tested, with results

Every option below was measured against live APIs or the committed index, not argued.

### H1. Widening the collection fixes the dead wheel. REJECTED

Sampled 80 works per CMA object type through the project's own extractor.

| Type | Buckets occupied | Top bucket share | Cool share (120-300 deg) | Achromatic |
|---|---|---|---|---|
| Painting | 10/24 | 0.58 | 0.09 | 2/80 |
| Ceramic | 7/24 | 0.44 | 0.15 | 18/80 |
| Textile | 5/24 | 0.67 | 0.03 | 1/80 |
| Glass | 11/24 | 0.38 | 0.18 | 19/80 |
| Jewelry | 7/24 | 0.52 | 0.11 | 16/80 |
| Enamel | 8/24 | 0.49 | 0.14 | 6/80 |
| Manuscript | 4/24 | 0.72 | 0.01 | 1/80 |
| Print | 5/24 | 0.61 | 0.02 | 18/80 |

Objects are warm too. Manuscripts and prints are worse than paintings. The best spread, Glass, has only 394 works in the whole collection. Ceramics, glass and jewelry also lose ~23% of works to the achromatic floor, since they are shot on white backgrounds.

A 300-work random sample across all 41,514 CMA CC0 works projects the full index:

| | v1 (paintings) | projected full CMA |
|---|---|---|
| Total works | 6,048 | ~33,000 |
| Top 3 buckets | 95% | **92%** |
| Bucket 2 | 4,406 | **~22,700** |
| `bucket-02.json` gzipped | 372 KB | ~1.9 MB |
| Empty buckets in sample | 5 | 13/24 |

Widening multiplies the warm mass roughly fivefold, leaves the cold half near empty, and breaks the one-file-per-bucket architecture. It makes the product worse.

### H2. Re-cut the wheel into equal-population slices. REJECTED

Sorting the 6,048 works by hue and cutting 24 slices of 252 puts **sixteen slices inside the 27-34 deg band**, several of them 0 deg wide, while the last slice spans 312 deg. The control would be hypersensitive across the warm needle and inert everywhere else. Worse than today.

### H3. Add a second axis inside the warm mass. ACCEPTED

Distribution within bucket 2:

| Band | Lightness | Saturation |
|---|---|---|
| 0-20 | 399 | 177 |
| 20-40 | 1,370 | **2,953** |
| 40-60 | 1,364 | 1,186 |
| 60-80 | 1,207 | 85 |
| 80-100 | 66 | 5 |

Lightness spreads across the middle three bands. Saturation collapses: 67% in one band, 90 works total in the top two. **Expose lightness only.** A saturation control would do nothing across most of its travel.

Top-60 overlap between tone extremes, target hue 30, at three candidate weights:

| Weights (lig, sat) | dark vs light | muted vs vivid |
|---|---|---|
| 0.3, 0.2 | 0/60 | 0/60 |
| 0.6, 0.4 | 0/60 | 0/60 |
| 1.0, 0.6 | 0/60 | 0/60 |

Completely disjoint result sets at every weighting. Neutral versus dark is also 0/60.

Value scales with density, which is the honest caveat:

| Hue | Works loaded | dark vs light overlap |
|---|---|---|
| 30 (warm mass) | 4,406 | 0/60 |
| 210 (cool, padded from neighbours) | 113 | 30/60 |

The feature is strongest exactly where the problem is.

### H4. Sky mode, the plan's top v2 candidate. REJECTED

Two third-party runtime calls, which contradicts the standing rule that the runtime calls no third-party API. That rule already cost The Color API in phase 4, and dropping it is what keeps `connect-src 'self'`. Worse, at midday it picks a blue hue that lands in a near-empty region and falls back to neighbour padding, so the headline feature would feel broken.

### H5. Image proxy for performance. DEFERRED BY DECISION

The only route to LCP under 2.5s and to removing the Met WAF cookie. Rejected for v2 to keep the site fully static with no backend, no cost and no new failure mode. Performance 73 and Best Practices 77 are accepted as the price.

## Agreed design

### Lightness axis

- Native `<input type="range">`, 0-100, for free keyboard, screen reader and touch support. Vertical beside the wheel at >= 1024px, horizontal directly under it below that. Costs ~40px of height at the bottom dock, so the grid's bottom padding grows.
- State is `number | null`. `null` means no tone preference and reproduces v1 behaviour exactly. An "Any tone" button appears only when a tone is set, mirroring the wheel's centre "All" button.
- Sort becomes:
  ```
  score = circularHueDistance(hue, targetH)
        + (100 - sat) * 0.15                              // existing vivid tiebreak, unchanged
        + (targetL === null ? 0 : |lig - targetL| * 0.5)   // new, weight tunable and unit-tested
  ```
- Hash becomes `#h=212&l=30`. The current parser splits on the literal `h=` and will break, so it moves to `URLSearchParams` over the hash body. `#h=212` and `#h=all` must keep working byte for byte.
- **Zero network cost.** `lig` is already on every item; the axis only reorders what is loaded. The reveal reset and scroll-to-top also come free, because the existing effect keys on `items`, which is the memo of the sort.
- Hash writes follow the existing discipline: React state during the drag, `commitHash(value)` on pointerup and keyup only. `commitHash` already accepts an explicit value, added in phase 4.

### Favourites

- Button lives **in the detail overlay only**. The card is a `<button>` and HTML forbids nesting a button inside one, so a card-level control would mean restructuring a tested component and doubling the grid's tab stops. Saving while looking closely at a work is also the natural moment.
- localStorage key holds **item snapshots, not ids**, because a saved work may sit in a bucket that is not loaded and refetching a whole bucket to render one card is waste. ~400 B per item, capped at 200 entries, roughly 80 KB.
- Every read and write wrapped in `try/catch`: localStorage throws in private mode and when site data is blocked. Degrade to in-memory, never break the page.
- Viewing saved works swaps the grid source behind a "Saved (n)" toggle. No router, no new page.

### Heap leak test

Scratchpad script driving CDP `HeapProfiler`, counting `HTMLCanvasElement` before and after 20 open/close cycles with a forced GC. Replaces the current DOM-node proxy check. Not a project dependency.

## Explicitly out of scope

Widening the index, a saturation control, an equal-population wheel, sky mode, any image proxy or backend, and the deploy itself. ARTIC remains out under the standing decision.

## Risks

| Risk | L x I | Mitigation |
|---|---|---|
| Slider crowds the bottom dock at 390px | Med x Med | Horizontal under the wheel, bottom padding of the grid grows to match; check at 390px before merge |
| Hash parser rewrite breaks existing `#h=` links | Med x High | `URLSearchParams` over the hash body, with unit tests pinning `#h=212`, `#h=all`, `#h=999`, `#h=abc`, empty, and the new `&l=` forms |
| Tone weight 0.5 feels wrong in use | Med x Low | Named constant in one place, unit-tested, three candidate weights already measured as equivalent on overlap |
| Tone feels inert on thin hues | High x Low | Measured and accepted: 30/60 overlap at hue 210. Not a defect, a property of the data |
| localStorage throws or is full | Med x Low | try/catch everywhere, 200-entry cap, in-memory fallback |
| Saved snapshots go stale when the index is rebuilt | Low x Low | Snapshots are self-contained and re-validated against the host allowlist before rendering, same as index items |

## Success criteria

- Changing tone reorders the grid and issues **zero** network requests.
- At hue 30, top-60 overlap between the dark and light extremes is 0.
- `#h=212` with no tone behaves exactly as v1; `#h=212&l=30` restores both on reload.
- A tone change resets the reveal window and scrolls to the top, like a hue change.
- The slider is keyboard operable and writes the hash only on gesture end.
- Favourites survive a reload, cap at 200, and a blocked localStorage leaves the page fully working.
- Heap snapshot after 20 open/close cycles returns canvas count to baseline within 1.
- All v1 checks still pass: 56 tests, clean build, zero CSP violations, CLS 0, no file over 200 lines.

## Next steps

Run `/ck:plan` against this report to produce the phased implementation plan.
