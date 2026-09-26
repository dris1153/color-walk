# Brainstorm: echoes across time, guessing the era, colour-blind vision, palette cards

**Date:** 2026-09-26
**Trigger:** "tiếp tục brainstorm sáng tạo ... thêm tính năng hay ho gì vào project"
**Outcome:** all four approved; echoes in both the detail overlay and a carousel.

## Measured before choosing (committed index, no Met API while the crawl ran)

| Idea | Measurement |
|---|---|
| **Echoes** (same colour, >= 1,000 years apart) | Same cell = 3 deg hue, 4 lightness, 8 saturation. **76%** of dated works (53,549 of 70,767) have an echo. Pairs among saturated works: 982 >= 1,000 years, 463 >= 2,000, 846 across regions. Frog amulet 1418 BCE <-> Navajo "Eyedazzler" rug 1895 (#95403c); hand axe -9998 <-> belt buckle 1913 |
| **Guess the era** | History cells per era: 17-24, so five works a day from five different eras |
| **Colour-blind vision** | No data; Machado 2009 matrices as an SVG filter on the root element (exempt from becoming the fixed elements' containing block) |
| **Palette card** | Up to 3 colours per work; card drawn from colours and text only, so it exports |

## Built

- **Echoes.** `write-echoes.mjs`: per cell, oldest and newest dated work; each work's echo is the extreme further from it, if >= 1,000 years. Attached to every entry like the twin (bucket-14 page grew 0.9% gzipped). `echoes.json`: pairs >= 1,500 years apart, saturation >= 25, <= 16 per hue, dealt round the wheel (sorted by gap alone it opened on ancient browns). Overlay card "Its echo, 2,545 years later"; carousel with arrows.
- **When was it made?** A fourth game tab: five works a day from five eras (seeded by date), title hidden until the guess, a slider giving every era equal width, score 100 at the exact year and log-scaled to 0 at 3,000 years off, share text, result kept for the day.
- **See the collection as...** protanopia, deuteranopia, tritanopia, achromatopsia, applied to the whole page including the wheel and the museums' images.
- **Palette card.** In the overlay: a 1200x630 PNG of the colours in proportion with hex labels and title, and "Copy CSS" (custom properties with shares; text always shown). In the saved view: the saved works' colours in wheel order.
- `useTwin` became `useLinkedWork`; the twin and echo cards share `LinkedWorkCard`; `paletteBands` is shared by the gradient and the card.

## Verified (production CSP; echoes, histories and mosaic generated for the committed index into dist/)

| Check | Result |
|---|---|
| Echo card | "Its echo, 2,545 years later: Jar" on a Fragment; opens the Jar |
| Echoes carousel | 124 pairs, arrow keys step, a work opens; starts on the frog amulet and the Navajo rug |
| Era game | 5 rounds, share "▃▄▂▂▃ 149/500, furthest off: 689 years"; a reload shows the same result |
| Colour vision | root filter set and cleared; the wheel collapses to blue and yellow under deuteranopia |
| Palette card / CSS | PNG downloaded; CSS shown as custom properties with shares |
| CSP violations / page errors | 0 / 0 |
| Tests | 350 (from 331) |

As with histories and the mosaic, `echo` and `echoes.json` reach the committed
index with the rebuild after the owner's crawl.
