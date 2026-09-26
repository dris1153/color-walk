# Brainstorm: README refresh and badges

**Date:** 2026-09-27
**Trigger:** "check README rồi update lại cho chuẩn giúp tôi là được, thêm các badge để README trông đẹp hơn"
**Outcome:** approved: one README with a contents list; badges for stack, data/privacy
and work count; MIT licence; stray `info.json` removed.

## Found stale or missing

- Index described as 24 bucket files; it is paged (600 per page) plus neutral pages and side files.
- Thumbnail cache "about 1.4 GB"; the wide crawl reached 19 GB at 90k files. "Warm re-run in 20 s" unmeasured at this size, dropped.
- "Two settings matter" listed three.
- Warm-collection figures (95%, five empty hues) were from the first index; now 86% of entries, no empty hue (2026-09-26 index).
- "Not included" listed favourites, which exist (Saved).
- No feature overview, scripts table, stack, layout or licence.
- `info.json` at the root: a Cloudflare "Just a moment..." page committed with the scaffold, read by nothing.

## Options weighed

| Option | Verdict |
|---|---|
| One README, new top part, deep sections kept and fixed | **chosen**: nothing lost, one place |
| Short README + `docs/` split | tidier for visitors, knowledge split across files |
| CI workflow + status badge | not chosen; `ignore-scripts` may need a sharp rebuild step |

## Built

- README: badges (7 stack, 6 data/privacy/licence, shields.io static), contents, features by UI group,
  quick start, scripts table, stack, layout; stale facts fixed; licence section.
- `LICENSE`: MIT, dris1153, 2026. Code only; images and data stay under the museums' terms.
- `git rm info.json`.

## Verified

- 20 internal anchors resolve; linked files exist.
- 13 badge URLs return 200; all six logos resolve.
- Rendered through GitHub's markdown API: 14 images, none broken; badges sit on two rows.

## Follow-up after the crawl

- Rebuild index, `verify:index`, commit `public/index`.
- Update the `works` badge and the warm-collection figures from the new `meta.json`.
