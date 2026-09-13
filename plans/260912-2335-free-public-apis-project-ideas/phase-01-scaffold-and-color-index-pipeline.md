---
phase: 1
title: "Scaffold + build-time color index"
status: complete
priority: P1
effort: "7h"
dependencies: []
---

# Phase 1: Scaffold + build-time color index


## Context Links
- Live probe results 2026-09-13 (ground truth, supersedes researcher-02): recorded in [plan.md](plan.md) Key Decisions
- [researcher-03 - Met API assessment, OSD](research/researcher-03-met-api-palette-extraction-openseadragon-helpers.md) - N+1 confirmed, v1.1 deprecation date
- [researcher-02 - ARTIC](research/researcher-02-artic-api-color-search-iiif.md) - **historical only, its IIIF/CORS conclusions are disproven**
- Met API docs: https://metmuseum.github.io/
- CMA Open Access API: https://openaccess-api.clevelandart.org/
- sharp: https://sharp.pixelplumbing.com/api-output#raw
- Vite: https://vite.dev/guide/ | Tailwind v4 + Vite: https://tailwindcss.com/docs/installation/using-vite | Vitest: https://vitest.dev/config/
- npm `save-exact`: https://docs.npmjs.com/cli/v10/using-npm/config#save-exact

## Overview
Two deliverables: an empty-but-correct Vite app, and a Node build script that turns two museum APIs into 24 committed JSON files.
Everything colour-related happens here, offline. Nothing in this phase runs in a user's browser except two smoke `<img>` loads.
Exit = `public/index/bucket-*.json` exist with real counts, `npm test` green, `npm run build` green, one Met and one CMA thumbnail render cross-origin from `localhost:5173`.

## Key Insights (verified 2026-09-13)
- **ARTIC images cannot be embedded by a third party.** `www.artic.edu/iiif/2/.../info.json`, `full/400,`, `full/843,` and tile URLs all return `403` + `Cf-Mitigated: challenge` for curl, headless Chrome, and a real headed Chrome loading them cross-origin as `<img>`/`fetch` - even after a top-level visit solved the challenge. Top-level navigation works; embedding does not. Delete every ARTIC concept: no query builder, no `AIC-User-Agent`, no IIIF URL builder.
- **Met:** `v1.1/search?q=*&hasImages=true&isPublicDomain=true&departmentId=11` -> 2721 objectIDs (v1 uses department 11 only; highlights deferred). Objects via `v1/objects/{id}` (CORS `*`, no key, 80 req/s). Search v1 is deprecated Oct 2026 - use **v1.1 for search, v1 for objects**. Fields we need: `objectID, title, artistDisplayName, objectDate, isPublicDomain, primaryImage, primaryImageSmall, objectURL, creditLine`.
- **Met images** (`images.metmuseum.org`) return 200 JPEG with no WAF, but **no `Access-Control-Allow-Origin` header on 200 responses**. Consequence: they can be displayed, never read back through canvas. That is why colour extraction must be build-time and why OSD must use `buildPyramid: false`.
- **CMA:** `?cc0=1&has_image=1&limit=1000&skip=N&fields=...` works (limit 1000 accepted), CORS `*`, 41,514 CC0-with-image total, of which **Painting 3957** (v1 slice). `images` has `web` / `print` / `full`, each `{url,width,height,filesize}`. Measured over 1000 CC0 records: **web median 719 px / 266 KB (p90 600 KB); print median 2713 px / 3.2 MB (p90 6.5 MB, max 10 MB), present on 999/1000; full median 5353 px / 84 MB - never use `full`.** Some records have non-object `images` entries -> guard every access.
- CMA display artist string is **`creators[0].description`** (e.g. `"John Singleton Copley (American, 1738-1815)"`), not `creators[0].name`.
- **`bigBytes` needs a HEAD request only for Met.** CMA gives it free as `images.print.filesize`. Roughly half of CMA prints fall under the 4 MB auto-load gate.
- **No lqip anywhere.** Neither API offers one. The placeholder is a solid fill of the extracted dominant `hex` - thematically correct, zero bytes, no library.
- **`w`/`h` are always known** because we download every thumbnail and read `sharp().metadata()`. No aspect-ratio fallback is needed, so zero layout shift is structural rather than best-effort.
- Download budget: **CMA ~1.0 GB + Met ~0.55 GB ~= 1.6 GB one-time**, cached in a gitignored `.cache/`.
- Output size: ~6.7k items x ~200 B ~= 1.4 MB across 25 files, ~60 KB per bucket, ~20 KB gzipped. Fine to commit and fine to fetch.
- **200-line rule applies from the first commit**, to `scripts/` as much as `src/`.

## Requirements

### Functional
- F1. `npm run build:index` produces `public/index/meta.json`, `bucket-00.json` .. `bucket-23.json`, `all.json`.
- F2. Met ingestion: search dept 11 (European Paintings) only, dedupe IDs, fetch objects at concurrency 6, keep only `isPublicDomain === true && primaryImageSmall`.
- F3. CMA ingestion: `type=Painting`, pages of 1000, keep only `share_license_status === 'CC0' && images.web.url`.
- F4. Thumbnail download is resumable, concurrency 4-6, exponential backoff, cached in `.cache/`.
- F5. Dominant colour extraction via sharp with the metric defined below; emits `hue,sat,lig,hex,pct,pal[4]`.
- F6. `normalize-artwork.mjs` is the **single** validation gate; returns `null` on any violation.
- F7. Bucket files are sorted by `pct` desc; `all.json` is the top 300 by `pct` across all buckets.
- F8. Pure runtime libs exist and are tested: `color-math.ts`, `masonry-distribute.ts`, `image-url.ts`.

### Non-functional
- TS `strict: true`, `noUncheckedIndexedAccess: true`. Scripts are Node 22 ESM `.mjs` (no build step for them).
- `.npmrc`: `save-exact=true`, `ignore-scripts=true`. Lockfile committed. CI/local builds use `npm ci`.
- Every file < 200 lines, scripts included.
- Re-running `build:index` with a warm cache completes without re-downloading anything.

## Architecture

### Pipeline
```
build-color-index.mjs  (orchestrator, sequential stages, resumable)
 ├─ fetch-met-objects.mjs    -> raw Met objects[]      (network: collectionapi.metmuseum.org)
 ├─ fetch-cma-artworks.mjs   -> raw CMA artworks[]     (network: openaccess-api.clevelandart.org)
 ├─ normalize-artwork.mjs    -> Item | null            (pure, validation gate)
 ├─ download-thumbnails.mjs  -> .cache/{id}.jpg + HEAD bigBytes for Met only
 ├─ extract-dominant-color.mjs -> {hue,sat,lig,hex,pct,pal,w,h} | null   (sharp)
 └─ write-bucket-files.mjs   -> public/index/*.json
```

### Item shape (short keys, ~200 B)
```jsonc
{
  "id": "met-436535",            // or "cma-1915.534"
  "src": "met",                  // "met" | "cma"
  "t": "The Harvesters",         // title
  "a": "Pieter Bruegel the Elder (Netherlandish, ...)",   // Met artistDisplayName | CMA creators[0].description
  "d": "1565",                   // Met objectDate | CMA creation_date
  "w": 600, "h": 428,            // from sharp metadata of the downloaded thumb - always present
  "thumb": "https://images.metmuseum.org/.../web-large/DT1567.jpg",
  "big":   "https://images.metmuseum.org/.../original/DT1567.jpg",
  "bigBytes": 8312904,           // Met: HEAD Content-Length. CMA: images.print.filesize. null allowed.
  "hue": 34, "sat": 41, "lig": 46, "hex": "#a6784b",
  "pct": 0.52,                   // share of counted pixels in the winning hue bucket
  "pal": ["#a6784b", "#4b5a6a", "#d8c9a8", "#2b2622"],
  "page": "https://www.metmuseum.org/art/collection/search/436535",
  "credit": "Rogers Fund, 1919"
}
```
CMA `big` = `images.print.url` when present (999/1000), else `images.web.url` with `bigBytes` from `images.web.filesize`.

### `extract-dominant-color.mjs` - the metric (finding #8)
```js
// resize to 48px longest edge, raw RGB
const { data, info } = await sharp(buf).resize(48, 48, { fit: 'inside' })
  .removeAlpha().raw().toBuffer({ resolveWithObject: true });
```
For each pixel -> RGB to HSL, then:
- **Skip** if `l < 8` (near-black) or `l > 92` (near-white) or `s < 12` (grey). These are background, canvas and varnish, not colour.
- `weight = s / 100` (saturated pixels count more).
- `bucket = Math.round(h / 15) % 24`; accumulate `weight`, and `weight*cos(h)`, `weight*sin(h)`, `weight*s`, `weight*l` per bucket.
- `countedWeight = sum of all bucket weights`.
- **Winner** = bucket with max weight. **`pct = winnerWeight / countedWeight`** - "share of the colour in this image that sits in the winning 15-degree bucket", 0..1. It is *not* a share of all pixels; document this in a comment because it is the number the whole index is sorted by.
- `hue = atan2(sumSin, sumCos)` of the winning bucket, normalised to 0..359 (circular mean, so a bucket straddling 0 does not average to 180).
- `sat`, `lig` = weighted means within the winning bucket. `hex = hslToHex(hue, sat, lig)`.
- `pal` = top 4 buckets by weight, each as its own circular-mean hex; pad with `hex` if fewer than 4 buckets have weight.
- **Return `null`** if `countedWeight / totalPixels < 0.02` (essentially achromatic work). Orchestrator drops it and counts it in `meta.json.dropped.achromatic`.

### `normalize-artwork.mjs` - the validation gate (finding #9)
```js
export const ALLOWED_IMAGE_HOSTS = new Set(['images.metmuseum.org', 'openaccess-cdn.clevelandart.org']);
export function normalizeArtwork(raw, src) { /* returns Item | null */ }
```
Rejects (returns `null`, never throws) when:
- Met `objectID` is not a positive integer; CMA `id` / accession number is not `/^[A-Za-z0-9._-]{1,32}$/`.
- Any of `thumb` / `big` / `page` fails `new URL()`, is not `https:`, or its hostname is not in the allowlist (`page` allowlist is `www.metmuseum.org`, `www.clevelandart.org`).
- `isPublicDomain !== true` (Met) or `share_license_status !== 'CC0'` (CMA) - **enforced here, tested here** (finding #12).
Coerces: all strings via `String(x ?? '').trim().slice(0, 300)`; missing title -> `'Untitled'`; missing artist -> `'Unknown artist'`.

### `write-bucket-files.mjs`
- `bucket = Math.round(item.hue / 15) % 24`, so bucket centre = `bucket * 15` and bucket 0 covers the 352.5-360 / 0-7.5 wrap naturally.
- Each `bucket-NN.json` = `{ bucket, center, count, items: [...] }`, items sorted `pct` desc.
- `all.json` = `{ count, items }`, top 300 by `pct` across all buckets (wheel-centre "all colours" mode).
- `meta.json` = `{ generatedAt, total, bySource: {met, cma}, byBucket: [24 numbers], dropped: {validation, achromatic, download} }`.

### Runtime libs (used by phase 2, written and tested here)
```ts
// src/lib/image-url.ts   (replaces iiif-url.ts; no IIIF)
export const ALLOWED_IMAGE_HOSTS = ['images.metmuseum.org', 'openaccess-cdn.clevelandart.org'] as const;
export function isAllowedImageUrl(u: string): boolean;   // re-checked at runtime before any <img src>
export const bucketFileUrl = (b: number | null) => b === null ? '/index/all.json' : `/index/bucket-${String(b).padStart(2,'0')}.json`;

// src/lib/color-math.ts
export function circularHueDistance(a: number, b: number): number;      // 0..180
export function hueToBucket(h: number): number;                          // 0..23
export function bucketCenter(b: number): number;
export function hslToHex(h: number, s: number, l: number): string;
export function sortByHueDistance<T extends {hue:number; sat:number}>(items: T[], targetH: number): T[];
// score = circularHueDistance(item.hue, targetH) + (100 - item.sat) * 0.15, ascending, non-mutating, stable

// src/lib/masonry-distribute.ts
export function distributeToColumns<T extends {w:number; h:number}>(items: T[], n: number): T[][];
```

## Related Code Files

### Create - app shell
- `index.html`, `package.json`, `package-lock.json` (committed)
- `.npmrc` (`save-exact=true`, `ignore-scripts=true`), `.nvmrc` (`22`), `.gitignore` (adds `scripts/color-index/.cache/`)
- `vite.config.ts` (react + tailwind plugins, `test:` block), `tsconfig.json`, `tsconfig.node.json`
- `src/main.tsx`, `src/app.tsx` (smoke-only placeholder), `src/styles/global.css`

### Create - build scripts (Node 22 ESM)
- `scripts/color-index/build-color-index.mjs`
- `scripts/color-index/fetch-met-objects.mjs`
- `scripts/color-index/fetch-cma-artworks.mjs`
- `scripts/color-index/download-thumbnails.mjs`
- `scripts/color-index/extract-dominant-color.mjs`
- `scripts/color-index/normalize-artwork.mjs`
- `scripts/color-index/write-bucket-files.mjs`
- `scripts/color-index/http-util.mjs` (concurrency pool + backoff, shared - keeps the others under 200 lines)

### Create - runtime libs + tests
- `src/lib/color-math.ts`, `src/lib/color-name-table.ts`, `src/lib/masonry-distribute.ts`, `src/lib/image-url.ts`
- `src/lib/__tests__/color-math.test.ts`, `masonry-distribute.test.ts`, `image-url.test.ts`
- `scripts/color-index/__tests__/normalize-artwork.test.ts`
- `scripts/color-index/__tests__/extract-dominant-color.test.ts`
- `scripts/color-index/__tests__/write-bucket-files.test.ts`

### Create - committed data
- `public/index/meta.json`, `bucket-00.json` .. `bucket-23.json`, `all.json`

### Delete / never create
- Any `artic-*.ts`, `iiif-url.ts`, `AIC-User-Agent` handling. Vite template leftovers: `src/App.css`, `src/assets/react.svg`, `public/vite.svg`.

## Implementation Steps
1. `npm create vite@latest color-walk -- --template react-ts`. Immediately write `.npmrc` (`save-exact=true`, `ignore-scripts=true`) **before** installing anything, so every pin is exact.
2. Install exact: `npm i react@19 react-dom@19` ; `npm i -D vite@8.3.0 @vitejs/plugin-react@6.1.1 typescript@5.9.x vitest@5.0.0 tailwindcss@4 @tailwindcss/vite@4 sharp`. Do **not** take typescript 7.0.2 yet. Commit `package-lock.json`.
3. If `import('sharp')` throws, run `npm rebuild sharp --foreground-scripts` (needed because `ignore-scripts=true`); document this line in the README in phase 4.
4. `vite.config.ts`: react + tailwind plugins; `test: { environment: 'node', include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'] }`. `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `allowJs: true`, `checkJs: false` (so `.test.ts` can import `.mjs`). Scripts: `dev`, `build` (`tsc -b && vite build`), `test`, `build:index` (`node scripts/color-index/build-color-index.mjs`).
5. `global.css`: `@import "tailwindcss";` + the base cursor rule (Tailwind v4 Preflight no longer sets `cursor: pointer`):
   ```css
   @layer base {
     button:not(:disabled), [role="button"]:not(:disabled) { cursor: pointer; }
     button:disabled { cursor: not-allowed; }
   }
   ```
6. `http-util.mjs`: `pool(items, n, fn)` bounded-concurrency map; `getJson(url, {retries:4})` with backoff 1s/2s/4s/8s + jitter; `head(url)` returning `Content-Length | null`. Every request sets `User-Agent: ColorWalk-index/0.1 (build script)`.
7. `fetch-met-objects.mjs`: one v1.1 search (dept 11), `pool(ids, 6, id => getJson('/v1/objects/'+id))`. Log progress every 200. Expect ~2.7k ids before filtering.
8. `fetch-cma-artworks.mjs`: loop `skip` by 1000 until `data.length < 1000`, `type=Painting&cc0=1&has_image=1`, `fields=id,title,creators,creation_date,images,type,url,accession_number,creditline,share_license_status`. Expect 3957.
9. `normalize-artwork.mjs` per the spec above. Write it **before** the download step so nothing unvalidated ever reaches the network layer.
10. `download-thumbnails.mjs`: `pool(items, 5, ...)`; skip if `.cache/{id}.jpg` exists with size > 0; backoff on 429/5xx; 150 ms courtesy delay between CMA requests. Second pass: for `src === 'met'` only, `head(item.big)` -> `bigBytes`; for CMA take `images.print.filesize` (no HEAD). Persist a `.cache/manifest.json` so a re-run resumes.
11. `extract-dominant-color.mjs` exactly per the metric above, plus `sharp(buf).metadata()` for `w`/`h`.
12. `write-bucket-files.mjs` per the spec. Pretty-print off (`JSON.stringify(x)`) - saves ~30%.
13. `build-color-index.mjs`: stages in order, each logging counts in and out; `--source=met|cma` and `--limit=N` flags for fast iteration; final summary printed and written to `meta.json`.
14. Tests - `normalize-artwork.test.ts` (hostile fixtures, finding #9): foreign hostname (`https://evil.example/x.jpg`), `javascript:alert(1)` URL, protocol-relative `//images.metmuseum.org/x.jpg`, string `objectID` (`"12; DROP"`), 1 MB title, `isPublicDomain: false`, `share_license_status: 'CC BY'`, `images` present but a string not an object, missing `creators`. Each must return `null` (or, for the long title, a 300-char trimmed string).
15. Tests - `extract-dominant-color.test.ts` (finding #8): build inputs with sharp `create` + `composite`: (a) 64x64, 75% `hsl(210 80% 50%)` / 25% `hsl(0 80% 50%)` -> expect `hue` within +/-4 of 210 and `pct` within +/-0.03 of 0.75; (b) 90% white + 10% `hsl(210 80% 50%)` -> `pct` ~ 1.0 (white excluded) and `hue` ~ 210; (c) pure `#808080` -> returns `null` (achromatic).
16. Tests - `write-bucket-files.test.ts`: item with `hue: 358` lands in bucket 0; `hue: 7` also bucket 0; `hue: 8` in bucket 1; each bucket's items are `pct`-descending; `all.json` has exactly `min(300, total)` items and is `pct`-descending.
17. Tests - `color-math.test.ts` (`circularHueDistance(350,10) === 20`, `(10,350) === 20`, `(0,180) === 180`, handles 370 / -10; sort order + saturation penalty; input not mutated), `masonry-distribute.test.ts` (5 square items into 3 columns -> `[[0,3],[1,4],[2]]`; one tall item first pushes the next two into other columns; `n=1`; empty input), `image-url.test.ts` (allowlist accepts both hosts, rejects `http:`, subdomain spoof `images.metmuseum.org.evil.com`, and `javascript:`).
18. Run `npm run build:index -- --limit=50` end-to-end first. Only then the full run (expect hours and ~1.6 GB into `.cache/`).
19. Fill in the Smoke results table below from `meta.json`.
20. **Browser smoke (finding #1).** In `src/app.tsx`, temporarily render: a `fetch('/index/bucket-14.json')` count, one `<img>` with a Met `thumb`, one `<img>` with a CMA `thumb`, each with `onError` logging. `npm run dev`, open `localhost:5173`, confirm **both images paint** and Network shows `200` (not `403`, no `Cf-Mitigated` header). This is the check that ARTIC failed; repeat it before every deploy.
21. `npm test`, `npm run build`, `npm audit` (including dev deps). `find src scripts -name '*.ts' -o -name '*.mjs' | xargs wc -l | sort -n` - nothing over 200.

## Smoke results (recorded 2026-09-13)
| Metric | Value |
|---|---|
| Met objects fetched / kept | 2721 search ids -> 2641 objects fetched (80 gone, HTTP 404) -> **2104 indexed** |
| CMA artworks fetched / kept | 3957 fetched -> **3945 indexed** |
| Dropped: validation / achromatic / download-failed | 282 / 267 / 0 |
| Total indexed | **6049** |
| Per-bucket counts (00..23) | 76, 352, 4407, 995, 45, 22, 15, 1, 1, 2, 7, 10, 11, 43, 38, 10, 1, 0, 0, 0, 0, 0, 3, 10 |
| Smallest / largest bucket | 0 (buckets 17-21, Indigo..Fuchsia, all empty) / 4407 (bucket 02, Orange 30 deg) |
| `all.json` size (raw / gz) | 161 KB / 19 KB |
| `bucket-02.json` size (raw / gz) | 2360 KB / 448 KB - see "Distribution finding" below |
| Met thumbnail cross-origin from localhost | **200, paints** (599x408), no `Cf-Mitigated` header |
| CMA thumbnail cross-origin from localhost | **200, paints** (900x689), no `Cf-Mitigated` header |
| Cache size on disk | 1.4 GB (`scripts/color-index/.cache/`, gitignored) |
| Wall-clock build time | Met object crawl 55 min + CMA thumbnails 33 min + final assembly 9 min. Warm-cache re-run: **22 s, 0 downloads, 0 HEAD** |
| `public/index/` on disk | 3.4 MB across 26 files |

### Deviations from the written plan (all forced by live API behaviour)
1. **Met v1.1 search caps a page at 500 ids** regardless of `limit`, while reporting `total: 2721`. A single call returns only 100. `fetch-met-objects.mjs` now offset-pages at 500.
2. **`collectionapi.metmuseum.org` is behind Imperva/Incapsula.** The documented 80 req/s is not what the WAF enforces: ~75 requests earn a `403` block lasting 1-3 minutes, at 2.5 req/s as readily as at 30 req/s. The stage now crawls sequentially at ~1.25 req/s, caches every object in `.cache/met-objects.json`, and cools down 90 s on a 403 instead of failing. At that rate the full 2647-object crawl completed with **zero** blocks. `images.metmuseum.org` is unaffected (a plain CDN; a 12-wide burst is fine).
3. **CMA `url` is `https://clevelandart.org/...`, without `www`.** The planned page allowlist rejected every CMA record. Both spellings are now allowed, in `normalize-artwork.mjs` and `src/lib/image-url.ts`.
4. **CMA `images.*.filesize` is a string**, not a number. Coerced in the normalizer.
5. **`npm create vite` was not used.** The scaffold is hand-written, so the template leftovers the plan asks to delete (`src/App.css`, `src/assets/react.svg`, `public/vite.svg`) were never created, and `.npmrc` existed before the first install.
6. **`tsconfig.node.json` emits declarations** into `node_modules/.tmp/` rather than setting `noEmit`, because `tsc -b` refuses a referenced project that disables emit (TS6310).
7. **Added `scripts/color-index/verify-index.mjs`** (`npm run verify:index`), the "10-line check script" the Success Criteria allow, asserting host allowlists, hue/pct ranges, per-bucket sort order, bucket membership and the 5000 floor over the real committed output.

### Distribution finding (blocks a phase 2 decision)
The metric is correct - spot checks confirm bucket 13/14 hold genuinely blue works (Monet *Low Tide at Pourville*, *Boy in a Blue Coat*) and bucket 22 genuinely pink ones - but the **collection** is overwhelmingly warm:

- Buckets 01-03 (Vermilion, Orange, Amber) hold **5754 of 6049 items, 95%**.
- Bucket 02 alone holds 4407 (73%), making `bucket-02.json` 448 KB gzipped, far above the ~20 KB the plan budgeted, and it is the bucket a visitor is most likely to land in.
- Buckets 17-21 (Indigo, Violet, Purple, Magenta, Fuchsia) are **empty**; buckets 07, 08, 16 hold a single work each.

Most of the hue wheel is therefore dead, and the one live arc is a 2.4 MB download. This needs a decision before phase 2 builds the wheel against it.

## Todo List
- [x] `.npmrc` written **before** first install; exact pins; lockfile committed
- [x] Vite + React 19 + TS 5.9 + Tailwind v4 + Vitest 5 scaffold; template leftovers deleted
- [x] `sharp` importable (`npm rebuild sharp` documented if needed)
- [x] `http-util.mjs` (pool, backoff, head)
- [x] `fetch-met-objects.mjs` (v1.1 search, v1 objects, concurrency 6)
- [x] `fetch-cma-artworks.mjs` (pages of 1000, type=Painting)
- [x] `normalize-artwork.mjs` (single validation gate, PD/CC0 enforced)
- [x] `download-thumbnails.mjs` (resumable, backoff, Met-only HEAD for `bigBytes`)
- [x] `extract-dominant-color.mjs` (documented `pct` metric, circular mean, achromatic drop)
- [x] `write-bucket-files.mjs` (24 buckets + `all.json` + `meta.json`)
- [x] `build-color-index.mjs` orchestrator with `--limit` / `--source`
- [x] Runtime libs: `color-math`, `color-name-table`, `masonry-distribute`, `image-url`
- [x] 6 test files incl. hostile fixtures and synthetic sharp images
- [x] `--limit=50` dry run, then full index build
- [x] Smoke results table filled in
- [x] Browser smoke: bucket JSON + one Met thumb + one CMA thumb from `localhost:5173`
- [x] `npm test`, `npm run build`, `npm audit` green; no file over 200 lines

## Success Criteria
- `public/index/` contains `meta.json`, 24 bucket files and `all.json`; `meta.json.total` >= 5000.
- Every bucket file parses; no item fails `isAllowedImageUrl`; no item has `pct <= 0` or `hue` outside 0..359 (assert with a 10-line check script or a test over the real output).
- `npm test` exits 0 with >= 30 assertions; the three hostile-fixture groups and the three synthetic-image cases all pass.
- `localhost:5173` paints one Met and one CMA thumbnail cross-origin, HTTP 200, no `Cf-Mitigated` response header.
- Re-running `npm run build:index` with a warm cache issues zero image downloads.
- `npm run build` exits 0; `npm audit` (incl. dev) shows no high/critical.
- No `.ts`/`.mjs` file over 200 lines; zero occurrences of `artic`, `iiif`, or `AIC-User-Agent` in the repo (`grep -ri`).

## Risk Assessment
| Risk | L x I | Mitigation |
|---|---|---|
| Met/CMA CDN starts challenging cross-origin embeds (the ARTIC failure mode) | Low x Critical | Step 20 browser smoke is mandatory and repeated pre-deploy; if it ever fails, the affected source is dropped, not worked around |
| `sharp` native install fails under `ignore-scripts=true` | Med x Med | `npm rebuild sharp --foreground-scripts` documented; build script is the only consumer |
| Full build takes hours / disk fills | High x Low | `--limit` dry run first, resumable cache, 1.6 GB budget stated up front |
| Dominant-hue metric puts works in visually wrong buckets | Med x Med | Metric documented + unit-tested; per-bucket counts reviewed by eye in step 19; thresholds (`s<12`, `l<8/>92`, 0.02 achromatic) are named constants, tunable in one place |
| Met `artistDisplayName` empty on many works | Med x Low | Coerced to `'Unknown artist'` in the normalizer; count reported in `meta.json` |
| CMA `images` occasionally not an object | Med x Med | Every access guarded; such records are dropped and counted as validation drops |
| Committed 1.4 MB of JSON bloats the repo on each rebuild | Med x Low | Minified JSON, 25 files; acceptable. If rebuild churn becomes painful, move to a release asset - not before |

## Security Considerations
- `normalize-artwork.mjs` is the **only** place untrusted API data becomes an Item. Nothing bypasses it. Hostname allowlist + `https:` only + `new URL()` parse. `javascript:` and protocol-relative URLs are rejected by construction.
- Runtime re-checks the allowlist in `image-url.ts` before any `<img src>` (defence in depth: a hand-edited index file must not be able to point the browser at an arbitrary host).
- All strings are length-capped at 300 chars and rendered later as React text nodes only. **No `dangerouslySetInnerHTML` anywhere in this repo** - grep is part of phase 4's checklist.
- Supply chain (finding #10): `save-exact=true`, `ignore-scripts=true`, committed lockfile, `npm ci`, `npm audit` **including** dev dependencies (the build script runs on a dev machine with network and filesystem access - dev deps are in scope).
- Build script writes only to `.cache/` and `public/index/`; no shell interpolation of API data anywhere.
- No secrets, no keys, no `.env`.

## Next Steps
- Phase 2 consumes `bucketFileUrl`, `isAllowedImageUrl`, `sortByHueDistance`, `distributeToColumns`, `hueToBucket`, and the committed `public/index/*.json`.
- Carry forward: the Smoke results table (drives phase 2's empty-state work and phase 4's expectations) and the observed `bigBytes` distribution (drives phase 3's 4 MB gate).
