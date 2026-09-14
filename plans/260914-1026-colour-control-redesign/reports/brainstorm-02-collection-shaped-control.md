# Brainstorm: make the colour control belong to this collection

**Date:** 2026-09-14
**Trigger:** "phần chọn màu vẫn chưa wow lắm"
**Outcome:** agreed. Three changes, built and measured one at a time, that turn a generic colour picker into an instrument shaped by the actual index.

## Why it does not land

The panel redesign fixed legibility, but what sits on it is still a **generic colour picker**. It could be pasted into any application. Nothing about it says *this collection, these paintings*. That is the root of the flat feeling, not a shortage of effects.

## Two measured defects behind the instinct

### The swatch collapses at both ends of the tone range

`hslToHex(hue, 70, tone)` at the extremes, for every hue:

| tone | result |
|---|---|
| 0 | `#000000` - all but identical to the `#0b0b0c` page ground, so the centre becomes a hole and the clear button disappears |
| 100 | `#ffffff` - a blinding white disc on a dark interface, which is exactly the screenshot that prompted this |

At both ends the hue signal is gone entirely.

### Those ends are also nearly empty

Lightness across all 6,048 works: min 9, p1 13, p50 46, p99 83, max 89.

| | |
|---|---|
| Works below tone 15 | 159 |
| Works above tone 80 | 124 |
| Outside 15-80 | 283, **4.7%** |

**65 of the slider's 100 units hold 95.3% of the collection.** A third of the travel goes to almost nothing, and that same third is where the swatch breaks.

## The direction

Make the control out of the collection. The data already exists.

Log-scaled `byBucket`, the 24 hue segments:

```
0.52 0.70 1.00 0.82 0.46 0.37 0.33 0.08 0.08 0.13 0.25 0.29
0.30 0.45 0.44 0.29 0.08 0.00 0.00 0.00 0.00 0.00 0.17 0.29
      ^ orange                        ^ five wholly empty segments
```

## Rejected, and why

| Idea | Why not |
|---|---|
| Spring or bounce on the handle | Generic, and `prefers-reduced-motion` has to switch it off anyway, so it cannot carry the identity. |
| Glow, shadow, bloom | Fights the design brief: `#0b0b0c` ground, no shadows, no rounded corners on cards. |
| Rotate the ring so the selection sits at the top | Disorienting. The hue-to-angle mapping is the one thing a colour wheel must keep still. |

## Agreed design, in three independent steps

### 1. Tone travel limited to where the works are

`min={15} max={80}` on the range input, with the bounds named once and shared with the hash parser so displayed and sorted values cannot drift apart. The value space stays 0-100, so existing links keep working and the sort is untouched. Two attributes close both measured defects at once: the dead travel disappears, and tone can no longer reach the values where the swatch degenerates.

### 2. The ring shows where the art actually is

The CSS conic gradient becomes an SVG of 24 arc segments, each solid at its bucket's centre hue, with `stroke-width` scaled logarithmically by the number of works, and **no segment at all for the five empty buckets**. `pointToHue` reads the bounding rect, so the geometry is unchanged and 0 degrees stays at twelve o'clock.

The 24 counts are imported from `meta.json` at build time: no runtime request, and the ring is correct on first paint with no loading state. Cost: rebuilding the index without rebuilding the bundle leaves the thicknesses slightly stale. Cosmetic only, and documented.

**Accepted risk:** the current gradient is continuous; 24 discrete segments will show visible banding. That reads more like a data visualisation than a colour picker, which is the point, but if it looks cheap in the real thing the fallback is a smooth gradient with density carried by opacity instead of thickness. That call is mine to make on sight.

### 3. The centre becomes the top match

`items[0]` rendered as a circular thumbnail. It is already in cache, being the first card in the grid. Clicking it opens that work in the deep-zoom overlay, which is what a picture invites. Clear moves to a small cross in the panel corner.

**Deliberate detail:** while a drag is in progress the centre keeps the flat colour disc; on release the artwork resolves into it. That avoids both a flickering image and a burst of thumbnail loads at 60 Hz, and it makes releasing the handle a moment rather than a stop.

## Risks

| Risk | Handling |
|---|---|
| The segmented ring looks cheap | Screenshot and judge before committing; fall back to smooth plus opacity |
| The centre becomes a new tab stop | Re-run the full focus and tab-order checks |
| `app.tsx` is at 196 of 200 lines | Push composition down into a component before adding anything |
| Three changes in one diff would be hard to bisect | Built and measured separately, in the order above |
| Baked density drifts from a rebuilt index | Documented in the README beside the index-rebuild instructions |


## Built and measured, 2026-09-14

All three steps landed. Screenshots taken at 390x780 and 1440x900 in both the
browsing and the chosen-colour state.

| Check | Result |
|---|---|
| Ring segments drawn | **19 of 24** - the five empty buckets draw nothing, so the gap is visible |
| Tone travel | 15 to 80; the swatch can no longer reach `#000000` or `#ffffff` |
| Old `#l=` links | still resolve, clamped to the nearest tone that has works behind it |
| Centre at rest | the top-ranked work, e.g. `Open A Rathor Noble Visiting a Holy Man at a Vishnu Shrine` |
| Centre during a drag | falls back to the flat colour disc |
| Centre after release | resolves to the new top match |
| Clicking the centre | opens that exact work: clicked `Saint Catherine of Alexandria`, dialog title matched |
| Clear | `#h=45&l=70` to `#h=all` |
| Tab order from a fresh load | Hue, Open [work], Lightness, Clear, first card |
| Page errors | none |

Regression unchanged: 84 tests, zero CSP violations on gallery and overlay, CLS
0 on load and scroll, tone overlap still 0 with zero requests, hash still
written only on release with no history growth, the full overlay close matrix,
focus return, and nothing left after 20 open/close cycles.

## What the ring turned out to look like

The banding risk did not need its fallback. Twenty-four arcs with a sliver of
ground between them read as counted parts rather than a broken gradient: orange
and amber swell, the greens and cyans taper, blue is a sliver, and the run from
indigo to fuchsia is simply absent. It looks like a data visualisation, which
was the intent.

## Two test artifacts worth recording

1. A phone screenshot came back as an empty panel. Re-running it twice with the
   DOM inspected showed 19 paths, the right readout and the right swatch, with
   no page errors. A capture-timing artifact, not a defect - worth checking
   before believing a blank screenshot.
2. The tab order appeared to skip the ring and the centre. It had been measured
   after a sequence that left focus mid-panel; `document.body.focus()` does not
   reset it, because the body is not focusable. From a fresh load the order is
   correct, and all four controls report `tabIndex=0`.

## Note carried forward

`src/app.tsx` is now **198 of 200 lines**. The next change that touches it has
to push composition into a component first, not after.

## Success criteria

- Tone can no longer reach a value where the swatch is pure black or pure white, and existing `#l=` links still resolve.
- The ring visibly thins toward the cold hues and breaks at the five empty buckets.
- The centre shows the work that the current hue and tone actually rank first, and opens it on click.
- During a drag the centre stays a flat colour; it resolves to the artwork on release.
- Everything still green: 84 tests, zero CSP violations, CLS 0, wheel geometry, hash on gesture end only, overlay close matrix, favourites.
