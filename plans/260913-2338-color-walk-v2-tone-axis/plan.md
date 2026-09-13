---
title: "Color Walk v2 - lightness axis, favourites, real leak check"
description: "Make the 4,406-work warm mass navigable by adding a lightness axis to the existing hue wheel, save works to localStorage from the detail overlay, and replace the DOM-node leak proxy with a heap snapshot. No new network, no backend, no new dependency."
status: pending
priority: P1
effort: 7h
tags: [feature, frontend, ux]
blockedBy: []
blocks: []
created: 2026-09-13
---

# Color Walk v2

## Overview
v1 ships a working hue wheel over 6,048 public-domain works, but 95% of them sit in three of 24 hue buckets and bucket 2 alone holds 4,406 with no way to filter inside it. v2 adds the axis the data actually varies on.

Everything here is runtime-only: `lig` is already on every index item, so the new axis costs zero requests and needs no index rebuild.

## Key Decisions
- **Lightness, not saturation.** Measured inside bucket 2: lightness spreads 399 / 1370 / 1364 / 1207 / 66 across five bands; saturation collapses with 2,953 of 4,406 in one band and 90 works total in the top two. A saturation control would be inert across most of its travel.
- **Sort, never filter.** Consistent with the neighbour padding already in `loadBucketNear`: results are reordered by distance, so no combination of hue and tone can ever produce an empty grid.
- **Measured weight.** `|lig - targetL| * 0.5`. Top-60 overlap between dark and light at hue 30 is 0/60 at weights 0.3, 0.6 and 1.0, so the exact value is a feel choice, not a correctness one.
- **Favourites in the overlay only.** The card is a `<button>`; HTML forbids nesting one. A card-level control would mean restructuring a tested component and doubling the grid's tab stops.
- **Snapshots, not ids.** A saved work may live in a bucket that is not loaded; refetching a whole bucket to render one card is waste.
- **Nothing widens.** A 300-work sample projects the full CMA collection at 92% in three buckets with bucket 2 at ~22,700. More sources make the wheel worse, not better.

## Phases
| # | Phase | Effort | Priority | Depends on | Status |
|---|---|---|---|---|---|
| 1 | [Lightness axis](phase-01-lightness-axis.md) | 4h | P1 | - | pending |
| 2 | [Favourites in the overlay](phase-02-favourites.md) | 2h | P2 | 1 | pending |
| 3 | [Heap-snapshot leak check](phase-03-heap-leak-check.md) | 1h | P3 | 2 | pending |

Phase 3 runs last on purpose: its value is verifying the overlay *after* phase 2 adds state to it.

## Relationship to v1
v1 ([plan](../260912-2335-free-public-apis-project-ideas/plan.md)) is complete through phase 3; its phase 4 is blocked only on Cloudflare credentials. Neither plan blocks the other. If v1 deploys first, v2 simply needs a redeploy; v2 touches neither `public/_headers` nor the OG placeholders. The one hard constraint the deploy creates is backward compatibility: any `#h=212` link that exists in the wild must keep working, which phase 1 tests explicitly.

## Context
- [Brainstorm report, with all measurements](reports/brainstorm-01-tone-axis-and-favourites.md) - read before starting
- Index shape and the `pct` metric: [v1 phase 1](../260912-2335-free-public-apis-project-ideas/phase-01-scaffold-and-color-index-pipeline.md)
- Hash discipline and the Safari throttle finding: [v1 phase 2](../260912-2335-free-public-apis-project-ideas/phase-02-hue-wheel-and-masonry-gallery.md)
- Overlay, focus and scroll-lock contracts: [v1 phase 3](../260912-2335-free-public-apis-project-ideas/phase-03-deep-zoom-detail-overlay.md)

## Constraints carried from v1
Every file under 200 lines. Kebab-case filenames. Code and comments 100% English. Exact pins via `.npmrc save-exact`, builds with `npm ci`. No new runtime dependency, no third-party API at runtime, so `connect-src` stays `'self'`. CSP keeps no `unsafe-inline` and no `unsafe-eval`. No `dangerouslySetInnerHTML`. All existing checks keep passing: 56 tests, clean build, zero CSP violations, CLS 0.

## NOT in scope
Widening the index, any saturation control, an equal-population wheel, sky mode, an image proxy or any backend, the deploy itself, and the Art Institute of Chicago. Each is argued in the brainstorm report.

## Risks summary
| Risk | L x I | Mitigation |
|---|---|---|
| Hash parser rewrite breaks existing `#h=` links | Med x High | `URLSearchParams` over the hash body; tests pin `#h=212`, `#h=all`, `#l=30` alone, `#h=999`, `#h=abc` and empty |
| Slider crowds the bottom dock at 390px | Med x Med | Horizontal under the wheel, grid bottom padding grows to match, checked at 390px before merge |
| Two controls both re-sorting 4,406 items per frame | Med x Low | Same cost profile as v1's hue drag, which measured fine; the new term is one subtraction per comparison |
| Tone feels inert on thin hues | High x Low | Measured: 30/60 overlap at hue 210 versus 0/60 at hue 30. A property of the data, documented rather than hidden |
| Saved snapshots go stale after an index rebuild | Low x Low | Snapshots re-validated against the host allowlist before render; a dead image degrades to the hex fill exactly like a gallery card |
| localStorage throws or is full | Med x Low | Every access in try/catch, 200-entry cap, in-memory fallback, page never breaks |
| The wheel becomes a dead control in the saved view | Med x Med | Touching the wheel exits the saved view back to browsing; specified in phase 2 |

## Red Team Review
Reviewed 2026-09-13 against the v1 findings that still apply.

| # | Sev | Finding | Applied to |
|---|---|---|---|
| 1 | High | A second control doubles the ways to write history; Safari's 100-per-30s cap still applies | ph1: slider commits on `change` and `keyup` only, never on `input`, reusing `commitHash(value)` |
| 2 | High | `#l=30` with no `h=` is a reachable URL the old parser never had to handle | ph1: parsed as all-colours plus tone, pinned by test |
| 3 | Med | Changing tone must reset reveal and scroll, or the reader is silently reordered | ph1: no new code needed, the existing effect keys on the `items` memo; verified rather than assumed |
| 4 | Med | `sortByHueDistance` is exported and unit-tested; changing its signature breaks those tests silently if they are only loosened | ph1: tests rewritten to assert the new third term, not deleted |
| 5 | Med | Favourites add a tab stop and state to a dialog with a verified focus trap | ph2: full close matrix and focus-return checks re-run after the change |
| 6 | Med | A saved snapshot is untrusted input by the time it is read back | ph2: `isAllowedImageUrl` and `isAllowedPageUrl` re-checked on read, same gate as index items |
| 7 | Low | Storage writes on every toggle could thrash on rapid clicks | ph2: single synchronous write per toggle, capped list, no batching needed at 200 entries |
