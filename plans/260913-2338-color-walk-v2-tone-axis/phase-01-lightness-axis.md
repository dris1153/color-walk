---
phase: 1
title: "Lightness axis"
status: pending
priority: P1
effort: "4h"
dependencies: []
---

# Phase 1: Lightness axis

## Context Links
- [Brainstorm report](reports/brainstorm-01-tone-axis-and-favourites.md) - the measurements behind every choice here
- [v1 phase 2](../260912-2335-free-public-apis-project-ideas/phase-02-hue-wheel-and-masonry-gallery.md) - hash discipline, the Safari throttle finding, the sort-once contract
- `<input type="range">`: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/range
- `URLSearchParams`: https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams

## Overview
Add a second axis to the colour control so the 4,406-work warm bucket becomes navigable. Pure runtime work: `lig` is already on every index item, so no request, no index rebuild, no new dependency.

Exit = dragging the tone slider visibly reorders the grid with zero network, `#h=212` still works, `#h=212&l=30` round-trips, and every v1 check still passes.

## Key Insights
- **Lightness is the only axis worth exposing.** In bucket 2 the lightness bands are 399 / 1370 / 1364 / 1207 / 66; the saturation bands are 177 / 2953 / 1186 / 85 / 5. Saturation is nearly constant across the collection.
- **The weight is a feel choice, not a correctness one.** Top-60 overlap between dark and light at hue 30 is 0/60 at weights 0.3, 0.6 and 1.0. Start at 0.5.
- **The existing saturation tiebreak stays.** `(100 - sat) * 0.15` means "prefer the vivid one at equal hue". That is unrelated to a user-chosen lightness and should not be folded into the new term.
- **The reveal reset is already correct.** `useArtworksByHue` resets reveal and scroll in one effect keyed on the `items` memo. Since `items` is the memo of the sort, a tone change fires it automatically. Verify, do not re-implement.
- **The current parser will break.** `hash.replace(/^#/, '').split('h=')[1]` cannot survive `&l=`. It moves to `URLSearchParams`, which also fixes the reachable-but-unhandled `#l=30` case.
- **`commitHash` already takes an explicit value.** Added in v1 phase 4 to fix the All button; the slider needs exactly that, because it sets state and commits in the same tick.

## Requirements

### Functional
- F1. Tone state is `number | null`, 0-100, `null` meaning no preference. `null` reproduces v1 ordering exactly.
- F2. Native `<input type="range">`, vertical beside the wheel at >= 1024px, horizontal directly under it below that.
- F3. An "Any tone" reset appears only when tone is set, mirroring the wheel's centre "All" button.
- F4. Hash carries both: `#h=212&l=30`. `#h=212`, `#h=all` and `#l=30` all parse correctly.
- F5. Hash is written on `change` and `keyup` only, never on `input`.
- F6. Readout shows the tone alongside the hue, e.g. `H 212 / Cerulean - light`.
- F7. `document.title` keeps tracking hue; tone is not added to it.

### Non-functional
- Zero network requests on any tone change.
- Every file under 200 lines.
- Keyboard operable with a visible focus ring; `aria-label` and `aria-valuetext` on the slider.
- No horizontal scroll and no overlap with the grid at 390px.

## Architecture

### Sort
`src/lib/color-math.ts` replaces `sortByHueDistance` with:

```ts
export function sortByColorDistance<T extends { hue: number; sat: number; lig: number }>(
  items: readonly T[],
  targetH: number,
  targetL: number | null,
): T[];
// score = circularHueDistance(item.hue, targetH)
//       + (100 - item.sat) * 0.15                                  // existing vivid tiebreak
//       + (targetL === null ? 0 : Math.abs(item.lig - targetL) * TONE_WEIGHT)
// TONE_WEIGHT = 0.5, named and exported so the test pins it
```
Non-mutating and stable, like the function it replaces.

### Hash
`src/hooks/use-hue-from-url-hash.ts` becomes `src/hooks/use-view-from-url-hash.ts`:

```ts
export function useViewFromUrlHash(): {
  hue: number | null;
  tone: number | null;
  setHue: (h: number | null) => void;
  setTone: (l: number | null) => void;
  commitHash: (next?: { hue?: number | null; tone?: number | null }) => void;
};
```
- Parse with `new URLSearchParams(window.location.hash.slice(1))`. `h` absent or `all` gives `null`; otherwise clamp 0..359. `l` absent gives `null`; otherwise clamp 0..100.
- Write `#h=<hue|all>` plus `&l=<tone>` only when tone is not null, so a tone-free URL stays byte-identical to v1.
- Keep the 300 ms trailing throttle, the `try/catch`, and passing `history.state` through untouched.
- `commitHash` taking an object rather than a bare value keeps the same-tick escape hatch for both axes.

### Control
`src/components/tone-slider.tsx`, new, roughly 60 lines:
- `<input type="range" min={0} max={100} step={1} value={tone ?? 50} />`
- `onChange` sets React state; `onPointerUp` / `onKeyUp` call `commitHash`.
- `aria-label="Lightness"`, `aria-valuetext` reading `Any tone` or e.g. `Lightness 30, dark`.
- Orientation from the same `useColumnCount` breakpoint the layout already uses, or a CSS-only vertical variant via `writing-mode`. Prefer CSS, no extra state.
- "Any tone" button rendered only when `tone !== null`; clicking it calls `setTone(null)` then `commitHash({ tone: null })`.

### Layout
`src/app.tsx` composes wheel and slider in the existing fixed dock. The dock grows by roughly 40 px at < 1024px, so `<main>`'s bottom padding moves from `pb-56` to whatever clears it; measure, do not guess.

## Related Code Files
- Create: `src/components/tone-slider.tsx`, `src/hooks/use-view-from-url-hash.ts`
- Modify: `src/lib/color-math.ts`, `src/hooks/use-artworks-by-hue.ts` (accept and forward `tone`), `src/app.tsx`, `src/components/hue-wheel.tsx` (readout text only), `src/lib/__tests__/color-math.test.ts`
- Delete: `src/hooks/use-hue-from-url-hash.ts` (renamed)

## Implementation Steps
1. Rewrite the sort in `color-math.ts`, export `TONE_WEIGHT`, and update `color-math.test.ts` to assert the third term rather than loosening the existing assertions.
2. Add hash tests first: `#h=212`, `#h=all`, `#h=212&l=30`, `#l=30`, `#h=999`, `#h=abc`, `#l=-5`, `#l=500`, empty. Then write the `URLSearchParams` parser against them.
3. Thread `tone` through `useArtworksByHue(hue, tone, columns)` into the `items` memo. Change nothing else in that hook.
4. **Verify, do not re-implement, the reveal reset**: change tone and confirm the existing `items` effect resets reveal and scroll.
5. Build `tone-slider.tsx` against a hardcoded tone before wiring state, and confirm the vertical and horizontal variants both look right.
6. Wire state, then `commitHash` on `change` and `keyup` only. Confirm in devtools that dragging writes nothing until release.
7. Compose in `app.tsx`; adjust the bottom padding at 390px until nothing overlaps.
8. Readout copy and `aria-valuetext`.
9. Re-run the v1 browser checks: one index request per hue, zero on revisit, zero non-image requests while scrolling, CLS 0, close matrix intact.

## Success Criteria
- [ ] Changing tone reorders the grid and issues **zero** network requests.
- [ ] At hue 30, top-60 overlap between tone 20 and tone 80 is 0.
- [ ] `#h=212` alone behaves exactly as v1, and the written hash for a tone-free view is byte-identical to v1's.
- [ ] `#h=212&l=30` restores both on reload; `#l=30` restores all-colours plus tone.
- [ ] A tone change resets the reveal window and scrolls to top, like a hue change.
- [ ] Dragging the slider writes the hash only on release; no history entries accumulate.
- [ ] Slider reachable and operable by keyboard with a visible focus ring.
- [ ] 390px: no overlap, no horizontal scroll.
- [ ] `npm test` and `npm run build` green; no file over 200 lines; CSP still violation-free.

## Risk Assessment
| Risk | L x I | Mitigation |
|---|---|---|
| Parser rewrite silently changes an existing URL's meaning | Med x High | Tests written before the parser, covering every v1 form |
| Writing `&l=` when tone is null would churn every existing bookmark | Med x Med | Tone omitted from the hash entirely when null; asserted byte-for-byte |
| Two controls, two ways to blow the Safari history cap | Med x Med | Commit on gesture end only for both, shared throttle, unchanged `try/catch` |
| Vertical range input styling is inconsistent across browsers | Med x Low | `writing-mode` with an explicit height, checked in Chrome; native behaviour accepted over a custom control |
| Re-sorting on every slider frame janks on a phone | Low x Med | Same profile as v1's hue drag; if it shows, throttle the sort input rather than the render |
