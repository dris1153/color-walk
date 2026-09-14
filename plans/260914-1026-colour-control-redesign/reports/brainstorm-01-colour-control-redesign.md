# Brainstorm: redesign the hue and tone control

**Date:** 2026-09-14
**Trigger:** "design lại UI phần setup màu + tone"
**Outcome:** agreed. Merge the two controls into one instrument on a real panel, shrink it, and make each part show what it does.

## Diagnosis, from the running build

Four states were screenshotted at 390x780 and 1440x900, browsing and with hue plus tone set. The screenshot that prompted this happened to sit over a black gap in the grid, which hid the worst defect entirely.

### Critical: the dock has no background

It floats directly over the artwork grid. On a phone the grid is full of pale sepia scrolls, so:

- `ALL COLOURS` and `ANY TONE` are close to unreadable.
- The slider track disappears into the painting behind it.
- The ring's hollow centre shows artwork through it, which makes the ring read as ornament rather than a control.

Desktop looks fine only because the left rail happened to land on a dark region. That is luck. Any hue whose first column holds a pale work breaks it.

This is a correctness-level defect. Everything below is polish by comparison.

### The rest

| Defect | Detail |
|---|---|
| The ring's centre is wasted | A large empty circle sits where the currently selected colour should be. The `All` reset lives there as dim 10px text, invisible over artwork. |
| The two controls read as unrelated | Ring, label, slider, label: four stacked blocks, two labels in identical type. Nothing groups them into one instrument. |
| The tone track says nothing | A uniform grey bar. Dark-to-light is its entire meaning and it is not shown. The hue ring displays its whole range; the tone track displays none of its own. |
| Two grammars for "unset" | The ring hides its handle when hue is null; the slider keeps its thumb and dims. |
| Two grammars for "reset" | A centre button labelled `All` for hue; a `×` glued to the end of the readout text for tone. |
| Footprint | 232px of a 780px phone viewport, 30%, and transparent - it covers art without replacing it. |

## Constraint carried from v2 phase 1

The tone control is a native `<input type="range">`, chosen deliberately for free keyboard, screen-reader and touch support. **Restyle it, never replace it.** A custom-drawn slider would mean rebuilding all of that.

## Approaches considered

| Approach | Verdict |
|---|---|
| **One merged instrument on a panel** | **Chosen.** Fixes legibility, and every other defect falls out of the merge rather than being patched individually. |
| Two horizontal gradient bars, no ring | Rejected. Clearest and most compact, but the hue wheel is the product's identity in the original design brief. Dropping it changes the product, not the UI. |
| Background only, layout untouched | Rejected as the cheap fix. Solves the critical defect and leaves the hollow centre, the meaningless grey track and the two mismatched resets in place. |

Footprint: **shrink but keep it always visible**, over a collapsing pill. A pill would reclaim more screen but adds a state, a gesture to learn, and another focus path to re-verify.

## Design

```
┌───────────────────────────┐
│      ╭─────────────╮      │  panel: bg-ground/90, backdrop blur,
│    ╭─┘   ▁▁▁▁▁▁    └─╮    │  hairline ink/10 border, square corners
│   │    ╱ ██████ ╲    │    │
│   │   │ ████████ │   │    │  centre = hsl(hue, 70%, tone)
│   │    ╲ ██████ ╱    │    │  and the reset button
│    ╰─┐   ▔▔▔▔▔▔    ┌─╯    │
│      ╰──────●──────╯      │  handle on the rim
│                           │
│   ████▓▓▓▒▒▒░░░▁▁▁        │  tone track: dark to light,
│      ─────●─────          │  tinted by the current hue
│                           │
│     CERULEAN · DARK       │  one readout, both axes
└───────────────────────────┘
```

1. **Panel.** `bg-ground/90` plus `backdrop-blur`, a hairline `ink/10` border, square corners to match the gapless hard-edged grid. Reuses the idiom already used by the overlay's zoom controls, so it is not a new visual language.
2. **The ring's centre becomes the selected colour**, filled with `hsl(hue, 70%, tone)`. Both axes converge on one shape, so the instrument explains itself. Neutral grey when nothing is chosen.
3. **The centre is also the reset**, a real `<button>`, `disabled` when both axes are already clear so it never advertises an action it will not perform.
4. **The tone track becomes a gradient**, dark to light, tinted by the current hue, through `::-webkit-slider-runnable-track` and `::-moz-range-track` in `global.css`. The gradient is passed in as a CSS custom property set inline from React, which is a CSSOM write and therefore invisible to CSP - no new inline `<style>`, no policy change.
5. **One readout, names before numbers**: `CERULEAN · DARK`, or `ALL COLOURS · ANY TONE`. Numbers stay in `aria-valuetext`, so screen readers keep the precision while the eye gets the meaning. The longest string fits 160px at 10px mono.
6. **Smaller**: ring 160 to 128px on phones, 220 to 180px on desktop; the dock drops from 232px to roughly 190px. `main`'s bottom padding then follows - **measured, not guessed**, after the earlier lesson that an infinite-scroll page never reaches its end in a single `scrollTo`.

### The trade-off taken

Merging into one readout leaves no room for a per-axis `×`, so **the centre swatch clears both axes** rather than only the hue. Clearing one axis alone is no longer possible. Judged acceptable because either axis is reset by one drag, and the alternative is a second affordance crowding a 160px-wide readout. Flagged explicitly so it can be reversed.

## Must not regress

Wheel geometry with 0 degrees at twelve o'clock; the hash written only on gesture end; top-60 overlap still 0 between tone extremes at hue 30; Tab reaching ring, then centre, then slider; visible focus rings; CLS 0; no new inline style and no CSP change; no new dependency; every file under 200 lines.


## Built and measured, 2026-09-14

| Metric | Before | After |
|---|---|---|
| Dock height, phone | 232px | **200px** |
| Dock width, phone | 160px | 176px |
| Dock size, desktop | 220 x 292px | **208 x 248px** |
| `main` bottom padding | `pb-64`, 256px | `pb-56`, 224px |
| Footer clearance at the true end of scroll | 13px | 12px |
| Readability over pale artwork | labels and track effectively invisible | solid panel, legible |

Verified in the browser:

- Tab order runs **Hue, Clear colour and tone, Lightness, first card**.
- The swatch renders `rgb(23, 77, 130)` for hue 210 at tone 30 - the colour the two axes actually add up to.
- Clicking the swatch takes `#h=210&l=30` straight to `#h=all`, and the button then reports `disabled`.
- Wheel geometry unchanged: 0 degrees at `left 50%, top 8%`, 90 degrees at `left 92%, top 50%`.
- Tone axis unchanged: top-60 overlap 0, zero network requests, scroll reset 1200 to 0, hash written only on release, history unchanged.
- Full regression green: 84 tests, zero CSP violations on gallery and overlay, CLS 0 on load and scroll, the whole overlay close matrix, focus return, no canvases left after 20 cycles, favourites and the saved view intact.

## A bug in the first draft of this redesign

The swatch was initially placed **inside** the ring, which carries `role="slider"` and the pointer handlers. Clicking it bubbled into the ring's own drag handler, so the click set a hue from the pointer position before the button cleared it. The old `All` button had exactly the same flaw; it looked correct only because the two effects happened to cancel out, leaving a wasted history commit and a colour flash in between.

The swatch is now a **sibling** of the ring, absolutely positioned over it. That removes the bubbling entirely and fixes the ARIA at the same time: a `<button>` inside `role="slider"` was never right.

## Note for whoever touches this next

`src/app.tsx` is at 196 lines against the project's 200-line limit. The next thing added there should push composition down into a component instead.

## Success criteria

- The readout and both controls are legible over the palest artwork in the collection, verified by screenshot over a sepia-heavy hue.
- The centre swatch matches the chosen hue and tone, and is `disabled` when both are clear.
- The tone track renders a dark-to-light gradient that follows the hue.
- The dock is measurably shorter, and the footer still clears it at the true end of scroll.
- Four before-and-after screenshots at both breakpoints.
- Full regression green: 84 tests, clean build, zero CSP violations, CLS 0.
