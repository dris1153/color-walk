# Brainstorm: telling filters from view settings

**Date:** 2026-09-26
**Trigger:** "1 cái là filter sort, 1 cái là apply filter màu ... cho ảnh, nên tách ra ... đồng thời brainstorm thêm filter nữa vào group màu ảnh"
**Outcome:** approved: FILTER on the left, a View button with a panel on the
right; new view options Swatches only, Squint, palette strip and titles always,
card size S/M/L.

## The problem

Four identical selects did two different jobs. Kind / Time / Place change which
works appear and live in the URL; colour vision changes how they look and is the
reader's own. Rejected: "highlight only the chosen hue" (needs pixel access; the
Met and CMA send no CORS header).

## Built

- `view-settings.ts`: vision, pictures (original / squint / swatches), palette,
  titles, size; parsed through a gate from localStorage `cw:view`.
- `view-settings-provider.tsx` (was `vision-control.tsx`): context, persistence,
  the colour-vision SVG filters and the root filter.
- `view-panel.tsx`: an eye-icon View button with a dot when anything differs
  from the default; radios and checkboxes; Reset view; closes on Escape or an
  outside click.
- Toolbar: a FILTER label before the selects; View, Saved, Clear filters on the
  right. Phone: "Filter" and "View" buttons.
- Card: Swatches only renders no `<img>` at all (hex label instead); Squint is a
  6 px blur scaled 110%; the palette strip is drawn after the caption.
- `useGridColumns`: size S/M/L adds or removes a column; the landing ring still
  decides on the screen's own column count.

## Verified (1440 px and 390 px)

| Check | Result |
|---|---|
| Toolbar | FILTER, three selects, then View on the right; phone shows "Filter" and "View" |
| Squint | 60 of 60 images blurred |
| Swatches only | 0 images, 120 hex cards after scrolling, **0 museum image requests** while scrolling |
| All on (swatches, strip, titles, S, deuteranopia) | 6 columns, 72 strips, root filter set |
| Reload | every setting kept, dot shown |
| Reset view | back to 5 columns and images, filter cleared, dot gone |
| Phone panel | x 96-384 of 390, inside the screen |
| Tests | 360 (from 357) |
