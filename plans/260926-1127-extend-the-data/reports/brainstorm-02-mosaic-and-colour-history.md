# Brainstorm: a mosaic of the reader's picture, and the history of a colour

**Date:** 2026-09-26
**Trigger:** "tiếp tục brainstorm sáng tạo ... thêm tính năng hay ho gì vào project"
**Outcome:** two features approved and built: the mosaic (tint slider, default
0%, up to 40%) and the history of a colour with each era's signature hue.
Colour-name search and a 90k-dot galaxy were offered; the galaxy was advised
against (it repeats the landing ring at ~600 kB).

## Measured before choosing

| Idea | Measurement | Verdict |
|---|---|---|
| **Mosaic** | 16,000 cached thumbnails: 188 of 1,184 Lab bins occupied (15.9%), tile chroma p50 8.3, p90 19.5. 4,096 tiles at 32 px: **0.92 MB** atlas. Van Gogh wheat field rebuilt at mean dE **8.6** with 2,178 works; a synthetic saturated sky at dE **35** (grey-blue) | Strongest. Faces and earth tones come out well; saturated colour goes grey, so tint is optional and off by default |
| **History of a colour** | 260 of 288 (hue x era) cells hold a work | Cheap; the new year facet makes it possible |
| **Era signatures** | Every era is mostly orange (distance from the whole 0.02-0.17), but lifts tell stories: azure x5.8 before 1000 BCE, violet x24.9 in 1000-1 BCE, blue x5.1 in the 1300s, cerulean x2.1 in the 1600s | Computed client-side from eras.json |
| Colour-name search | xkcd survey: 949 names, CC0 | Offered, not chosen |
| Galaxy of 90k dots | ~600 kB gz | Advised against |

## Built

- Build: `extract-dominant-color` also returns the mean colour `m`;
  `write-mosaic-files.mjs` picks 4,096 tiles round-robin over 10-unit Lab bins
  (stable FNV order), writes `mosaic.jpg` + `mosaic.json` (tile mean Lab and
  where each work lives, monochrome works included). `write-histories-file.mjs`
  keeps, per hue bucket and era, the work maximising sat x pct.
  `write-located-side-files.mjs` gathers the side files that open a work with
  one page fetch; `m` is stripped before anything else is written.
- Client: `mosaic-match.ts` (brute-force nearest tile in Lab, reuse penalty 4),
  `mosaic-maker.tsx` (FileReader, canvas, hover title, click opens, tint, save
  PNG), `era-signature.ts`, `colour-history.tsx` inside the Eras view,
  `loadEntry` for any side file that names a bucket and page, and
  `read-image-file.ts` shared with "From a picture".

## Verified (under the production CSP, side files generated for the committed index into dist/)

| Check | Result |
|---|---|
| Portrait uploaded | 64 x 92 cells, **2,684** different works, matched in ~1.3 s |
| Hover / click a tile | "Mother and Child - click to open"; the overlay opens on it |
| Save as PNG | 3.85 MB file downloaded |
| History, default | Cerulean: 12 of 12 eras filled; card opens its work |
| History, Violet | 8 of 12 filled, empty eras say "none" |
| Signatures | 9 of 12 eras have one (azure x5.8 ... rose x3.0) |
| CSP violations / page errors | 0 / 0 |
| Tests | 331 (from 317) |

## Not yet in the committed index

`histories.json` and the mosaic files are written by `build:index`, and the
owner's crawl was running (its process predates this code). They arrive with the
rebuild after the crawl; until then the two views say they could not load.
