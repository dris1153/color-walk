# Brainstorm: consolidate, then the camera and slow looking

**Date:** 2026-09-26
**Trigger:** "tiếp tục brainstorm sáng tạo ... thêm tính năng hay ho gì"
**Outcome:** advised consolidating and shipping before more features; the owner
chose consolidation plus two features (camera colour, slow looking).

## What the measurements said

| Measure (390 px phone) | Before |
|---|---|
| Toolbar above the grid | 127 px (three filter selects wrapped to two rows, vision on a third) |
| First work starts at | y = 151 |
| Colour panel | 265 px, 31% of the screen |
| Entry points | 8 links on three lines |
| Main JS | 311 kB (96 kB gz) |
| Today | 7 commits, 70 files in src, +2,694 lines |

Honest note given: nothing is deployed, four new views show "could not load"
until the post-crawl rebuild, and there are no users to say which features
matter.

## Built

- **Grouped entry points.** Explore (Walk, Eras, Echoes, Words, Arrange, Slow
  looking), Play, Your pictures (From a picture, Camera, Mosaic); a group opens
  a second row.
- **Toolbar.** On a phone, filters and vision sit behind one "Filters" button
  (with the active count); inline on wide screens. VisionControl stays mounted
  when hidden, since it applies the filter.
- **Camera.** getUserMedia, rear camera; one frame a second into a 48 px canvas,
  measured like "From a picture"; the grid follows only past 10 degrees of hue or
  8 of tone, through `commitHash` (history entry replaced, not added). Needs
  `Permissions-Policy: camera=(self)`.
- **Slow looking.** Full-screen slideshow through the spine's coloured works in
  hue order, starting at the wheel's hue; 9 s per work, crossfade, next image
  preloaded; 1600 px IIIF render, master file up to 4 MB, else thumbnail; wake
  lock; Space/arrows/Esc; clicking opens the work. Portalled to the body at
  z-40: inside `main` (a stacking context) the colour panel drew over it.

## Verified (production headers)

| Check | Result |
|---|---|
| Phone toolbar | 127 -> **31 px**; first work at y 151 -> **67** |
| Phone colour panel | 265 -> 242 px (31% -> 29%); the wheel is most of it |
| Filters button | opens 4 selects |
| Camera (Chrome's fake device) | grid moved to `#h=120&l=27`, "Green"; history length unchanged; Stop closes and ends the stream |
| Slow looking | first, next, auto-advance after 9 s, pause, open a work, close; starts at the wheel's hue |
| CSP / permission-policy / page errors | 0 / 0 / 0 |
| Tests | 357 (from 350) |
