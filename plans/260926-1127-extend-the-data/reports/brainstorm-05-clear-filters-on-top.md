# Brainstorm: clear filters at the top

**Date:** 2026-09-26
**Trigger:** "Phần clear filter đẩy lên trên cùng ... nằm sát phải, chứ nếu để dưới mà nhiều item quá user sẽ scroll khá mệt"
**Outcome:** approved: one "Clear filters" button, top right; the toolbar sticks
to the top; the bottom Clear button and the small × beside the selects removed.

## Built

- `gallery-toolbar.tsx`: `sticky top-0` with a translucent ground; "Clear
  filters" flush right (the Saved toggle to its left), shown only while a
  filter is active and filters apply; visible on phones without opening Filters.
- `gallery-filters.tsx`: the × removed. `filter-status.tsx`: the end-of-grid
  message and "Keep looking" stay, the Clear button goes.

## Verified (desktop 1440 and phone 390)

| Check | Result |
|---|---|
| Button position at load | top 32 px, 6 px from the right edge |
| After scrolling to the end | still on screen, top 8 px |
| Click | hash `#h=210&k=ceramic` -> `#h=210`, button gone, page at the top |
| All-colours sample end | message shown, no Clear button down there |
