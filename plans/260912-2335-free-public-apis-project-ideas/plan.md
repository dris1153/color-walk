---
title: "Color Walk - browse Met + Cleveland artworks by hue"
description: "Static React site where dragging a hue wheel re-sorts a build-time color index of ~6.7k public-domain paintings from the Met and Cleveland Museum of Art, with single-image deep zoom."
status: pending
priority: P1
effort: 23h
tags: [feature, frontend, api, experimental]
blockedBy: []
blocks: []
created: 2026-09-13
---

# Color Walk

## Overview
Pick a color, walk through the public-domain paintings that share it.
Runtime makes zero third-party API calls: a manually-run Node script precomputes a dominant-hue index into 24 static JSON files, committed to the repo.
Sources: Cleveland Museum of Art Open Access (CC0, 3957 paintings) + Met Open Access (public domain, European Paintings 2721). Images stream from the museums' own CDNs.
Tap a work -> full-screen OpenSeadragon single-image deep zoom (no IIIF anywhere).
Static deploy, no backend, no DB, no auth, no accounts.

## Key Decisions
- **ARTIC is OUT of v1.** Verified 2026-09-13: `www.artic.edu/iiif/...` returns `403` + `Cf-Mitigated: challenge` to curl, headless Chrome, and a real headed Chrome loading it cross-origin - even after a top-level visit cleared the challenge. Top-level navigation works, third-party embedding does not. `api.artic.edu` is fine but worthless without images. No ARTIC code, no `AIC-User-Agent`, no IIIF.
- **Color is computed at build time, not queried.** Met has no color field; CMA has none either. `sharp` extracts a dominant hue per work offline. This also removes the browser canvas/CORS problem (Met image responses carry no `Access-Control-Allow-Origin`).
- **Index is committed, not generated in CI.** `npm run build:index` is run by a human, output lands in `public/index/`. Rebuild is the fix for URL churn or new departments.
- **Runtime data layer = `fetch('/index/bucket-NN.json')`.** No rate limits, no debounce needed, no 429s. Paging is local array slicing.
- **Deep zoom = OSD `{ type: 'image', url, buildPyramid: false }`.** `buildPyramid: false` is load-bearing: it skips the canvas pyramid build, so no CORS headers are required on museum images.
- **Stack pinned exactly** (see Dependencies). Vite 8 / React 19 / TS 5.9 / Tailwind v4 / Vitest 5 / OSD 6.1.1. No router, no state library, no UI kit. Node 22.
- App lives in `color-walk/`. Every file under 200 lines, kebab-case. Design brief unchanged: `#0b0b0c` ground, `#f2efe9` ink, hue-tinted background, display serif, 6 px gapless masonry, hash URL state.

## Phases
| # | Phase | Effort | Priority | Depends on |
|---|---|---|---|---|
| 1 | [Scaffold + build-time color index](phase-01-scaffold-and-color-index-pipeline.md) | 7h | P1 | - |
| 2 | [Hue wheel + masonry gallery](phase-02-hue-wheel-and-masonry-gallery.md) | 7h | P1 | 1 |
| 3 | [Deep-zoom detail overlay](phase-03-deep-zoom-detail-overlay.md) | 5h | P1 | 2 |
| 4 | [Polish, a11y and deploy](phase-04-polish-and-deploy.md) | 4h | P2 | 3 |

## Dependencies
**Build-time APIs (keyless, dev machine only):** Met search `https://collectionapi.metmuseum.org/public/collection/v1.1/search?q=*&hasImages=true&isPublicDomain=true&departmentId=11` (2721; highlights deferred to v2); Met objects `.../v1/objects/{id}` (CORS `*`, 80 req/s); CMA `https://openaccess-api.clevelandart.org/api/artworks/?cc0=1&has_image=1&type=Painting&limit=1000&skip=N&fields=...` (CORS `*`, 41,514 CC0 total, 3957 paintings).
**Runtime hosts:** `images.metmuseum.org`, `openaccess-cdn.clevelandart.org` (both 200, no WAF challenge as of 2026-09-13), plus optional `https://www.thecolorapi.com` (`ACAO: *` confirmed, Heroku cold starts).
**npm, exact pins** (`.npmrc save-exact=true`, `package-lock.json` committed, build with `npm ci`): `react 19.x` `react-dom 19.x` `vite 8.3.0` `@vitejs/plugin-react 6.1.1` (peer vite ^8) `typescript 5.9.x` (**not** 7.0.2 until verified) `tailwindcss 4.x` `@tailwindcss/vite 4.x` `vitest 5.0.0` `openseadragon 6.1.1` `@types/openseadragon 6.0.0` `sharp` (dev, native) `wrangler` (dev, exact).
Fonts self-hosted in `public/fonts` - no Google Fonts origin at runtime.

## NOT in scope (v1)
ARTIC (until its WAF permits cross-origin embedding), IIIF tiling, Pollinations captions, Datamuse words, sky/time-of-day mode, favorites, accounts, any backend. Trigger-to-add for each is in phase 4.

## Risks summary
| Risk | L x I | Mitigation |
|---|---|---|
| Index goes stale; museum image URLs churn -> broken tiles | High x Med | `npm run build:index` is the documented fix; runtime "images unavailable" banner after >8 consecutive `<img>` errors surfaces it instead of hiding it |
| CMA/Met CDN adds a WAF challenge later (as ARTIC did) | Med x High | Phase 1 browser smoke (one thumb per source loaded cross-origin from `localhost:5173`) is repeated before every deploy; it is the exact check that would have caught ARTIC |
| ~1.6 GB one-time thumbnail download (CMA ~1.0 GB + Met ~0.55 GB); multi-hour build | High x Low | Resumable `.cache/` (gitignored), concurrency 4-6, backoff; re-runs are incremental |
| `sharp` native install fails on the dev machine | Med x Med | Exact pin + documented `npm rebuild sharp --foreground-scripts` fallback; build script is the only consumer, runtime is unaffected |
| Big images are heavy (Met original ~8 MB; CMA print median 3.2 MB, p90 6.5 MB) | High x Med | `bigBytes` known at build time (CMA `images.print.filesize`, Met HEAD); >4 MB or null gated behind an explicit "Load full resolution (N MB)" button |
| Dominant-hue metric produces visually wrong buckets | Med x Med | `pct` defined precisely and unit-tested against sharp-generated synthetic images; phase 1 records per-bucket counts for eyeball review |

## Red Team Review
Session 2026-09-13 - 15 findings, 15 accepted, 0 rejected (2 Critical / 8 High / 5 Medium).

| # | Sev | Finding | Applied To |
|---|---|---|---|
| 1 | Critical | ARTIC IIIF host behind Cloudflare WAF; cross-origin embeds 403, fails silently | Whole-plan pivot to Met+CMA; ph1 browser thumbnail smoke; ph2 images-unavailable state |
| 2 | Critical | `replaceState` per pointermove exceeds Safari's 100/30 s cap | ph2: React state per move, hash written on pointerup/keyup only, throttled >=300 ms, try/catch, Safari 5 s drag test |
| 3 | High | Re-sorting on page append reshuffles masonry and remounts images | ph2: sort key changes only with hue, and every change resets reveal to 60 + `scrollTo(0,0)`; appends never re-sort |
| 4 | High | Rate-limit / 429 / preflight accounting and AIC header fallback | ph1: all ARTIC client logic deleted; ph2: bucket-file fetch gets its own error state, 2/4/8 s backoff, Retry disabled while backing off |
| 5 | High | `body{overflow:hidden}` does not lock iOS Safari | ph3: `position:fixed; top:-scrollY; width:100%` + `scrollTo` restore; `overscroll-behavior:contain` on panel; edge back-swipe accepted |
| 6 | High | Repeated `history.back()` leaves the site; Forward orphans an entry | ph3: `closingRef` guard, `back()` only when `history.state?.cw === 'detail'`, `popstate` gated on `event.state` |
| 7 | High | Lazy OSD chunk failure has no ErrorBoundary | ph3: ErrorBoundary -> poster-only overlay; `vite:preloadError` -> reload prompt; ph4 `_headers` `/index.html no-cache` |
| 8 | High | Color metric semantics wrong (`population` is a pixel count) | ph1: own metric in `extract-dominant-color.mjs`; `pct` defined; synthetic 2-colour sharp image unit test |
| 9 | High | Input validation asserted but never implemented | ph1: `normalize-artwork.mjs` as single validation point + hostile-fixture tests; ph2 runtime re-check in `image-url.ts` |
| 10 | High | Supply chain: intent-only pins, unpinned `npx wrangler` | ph1: `.npmrc save-exact` + `ignore-scripts`, lockfile committed, `npm ci`, wrangler as exact devDep via `npm run deploy`, `npm audit` incl. dev |
| 11 | Medium | Google Fonts leaks visitor IPs; `unsafe-inline` unjustified; no HSTS | ph2: self-hosted woff2; ph4: `style-src 'self'` attempted first, HSTS + `form-action 'none'` added |
| 12 | Medium | PD filtering unenforced; attribution text inaccurate | ph1: build enforces Met `isPublicDomain===true` / CMA `share_license_status==='CC0'` with tests; ph3 per-work credit line; ph4 corrected footer |
| 13 | Medium | Poster fades on OSD `open`, before any tile is drawn | ph3: fade on first `tile-drawn` / `fully-loaded-change`; `open` only enables controls |
| 14 | Medium | Focus trap ignores OSD's default `tabIndex=0` | ph3: OSD `tabIndex: -1`, `inert` on `#root` siblings, focusable selector includes `[tabindex]:not([tabindex="-1"])` |
| 15 | Medium | First-load perf + metadata gaps | ph2: first 8 images `loading="eager" fetchpriority="high"`; ph1 exact version pins; ph4 absolute `og:image`/`og:url` + sharing-debugger check |
