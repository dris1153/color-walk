---
phase: 4
title: "Polish, a11y and deploy"
status: pending
priority: P2
effort: "4h"
dependencies: [3]
---

# Phase 4: Polish, a11y and deploy

## Context Links
- [Phase 1 - Smoke results, rebuild command](phase-01-scaffold-and-color-index-pipeline.md)
- [Phase 2 - self-hosted fonts, CSP target](phase-02-hue-wheel-and-masonry-gallery.md)
- [Phase 3 - inline-style pressure from OSD](phase-03-deep-zoom-detail-overlay.md)
- Live probe 2026-09-13: The Color API sends `Access-Control-Allow-Origin: *` (Heroku - expect cold starts)
- Met Open Access: https://www.metmuseum.org/about-the-met/policies-and-documents/open-access
- CMA Open Access: https://www.clevelandart.org/open-access
- Cloudflare Pages `_headers`: https://developers.cloudflare.com/pages/configuration/headers/
- CSP `style-src-attr`: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/style-src-attr
- HSTS: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security
- Lighthouse scoring: https://developer.chrome.com/docs/lighthouse/performance/performance-scoring
- Facebook sharing debugger: https://developers.facebook.com/tools/debug/

## Overview
Close the gap between "works on my machine" and "shipped": honest empty/error states, reduced motion, a real CSP, OG tags with absolute URLs, a README that explains how to rebuild the index, and a live URL.
One optional nicety: The Color API for prettier hue names, with the local table as the always-present default.
Exit = deployed URL, Lighthouse mobile perf > 90 / a11y > 95, zero CSP violations, README documents rebuild + attribution.

## Key Insights (verified 2026-09-13)
- **The Color API sends `ACAO: *`** - so it works from the browser, unlike Datamuse. It is on Heroku, so cold starts of several seconds are normal. Therefore: 2 s timeout, one failure latches it off for the session, and the UI never waits on it.
- **`style-src 'self'` alone will break the app** (finding #11 lands here). React sets inline `style` attributes for aspect-ratio, hex fill and the wheel handle, and OSD sets them constantly. CSP3 splits the directive: keep `style-src 'self'` for `<style>`/`<link>` and add **`style-src-attr 'unsafe-inline'`** for attributes. Try the strict version first, record the violations, then land on the split - do not blanket-allow `style-src 'unsafe-inline'`.
- **Lighthouse can run from anywhere now.** The ARTIC WAF was the only reason datacenter IPs were a problem; Met and CMA CDNs serve them fine. Still prefer a local Chrome run for stable perf numbers, and note in the README that PSI is also usable.
- **OG images need absolute URLs.** `/og.png` is ignored by most scrapers; the value must be `https://<deployed-host>/og.png`, which means the tag can only be finalised after the first deploy. Same for `og:url`.
- **`/index/*.json` caching is a correctness issue, not a perf one.** Rebuilding the index and deploying while a browser holds a stale bucket file yields images that 404. Short max-age + revalidate.
- Empty buckets are now measurable, not hypothetical: phase 1's Smoke results table lists per-bucket counts. Wire the empty state to the real thin buckets.

## Requirements

### Functional
- F1. Empty state: "nothing in this hue yet, try nearby" + buttons for hue -15 and +15.
- F2. Error state already exists from phase 2; here it gets final copy and styling.
- F3. `document.title` tracks hue: `Color Walk - H 212 / Cerulean`, else `Color Walk`.
- F4. Favicon (SVG + 32 px PNG) and `public/og.png` (1200x630, static screenshot of the wheel).
- F5. Optional: The Color API hue names, cached per bucket, silent fallback to the local table.
- F6. `README.md`: what it is, run/test/build, **how to rebuild the index**, attribution, deploy.
- F7. Deployed to Cloudflare Pages via a pinned local `wrangler` (finding #10) - `npm run deploy`, never `npx wrangler`.

### Non-functional
- Lighthouse mobile: Performance > 90, Accessibility > 95, Best Practices > 90.
- Zero CSP violations on the live site, gallery and overlay.
- HSTS, `form-action 'none'`, `frame-ancestors 'none'`, `X-Content-Type-Options`.
- No new runtime npm dependency. Every file < 200 lines.

## Architecture

### Optional colour naming (`src/lib/color-name-service.ts`, ~40 lines)
```ts
const cache = new Map<number, string>();     // bucket -> name
let disabled = false;                         // latched off after one failure (Heroku cold start counts)

export async function hueName(bucket: number, hue: number): Promise<string> {
  const local = nearestColorName(hue);        // always available, always rendered first
  if (disabled) return local;
  const hit = cache.get(bucket);
  if (hit) return hit;
  try {
    const res = await fetch(`https://www.thecolorapi.com/id?hsl=${hue},70%,55%`,
                            { signal: AbortSignal.timeout(2000) });
    if (!res.ok) throw new Error('bad-status');
    const name = (await res.json())?.name?.value;
    if (typeof name !== 'string' || !name) throw new Error('bad-shape');
    cache.set(bucket, name.slice(0, 40));
    return cache.get(bucket)!;
  } catch { disabled = true; return local; }
}
```
`useHueName(hue)` renders the local name synchronously and swaps in the remote one if it arrives. Budget: <= 24 requests per session. If it feels like dead weight during implementation, delete it - the local table is the product (YAGNI).

### `gallery-status.tsx` final states
```
status === 'ready' && items.length === 0  -> "nothing in this hue yet, try nearby"  [H {hue-15}] [H {hue+15}]
status === 'error'                        -> "couldn't load this colour"            [Retry] (disabled during 2/4/8 s backoff)
imagesDown                                -> "images aren't loading right now - the museum's server may be blocking us"
revealed.length === items.length && >0    -> quiet "end of this hue" line
```

### `_headers` (Cloudflare Pages) - `color-walk/public/_headers`
```
/*
  Content-Security-Policy: default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data: https://images.metmuseum.org https://openaccess-cdn.clevelandart.org; font-src 'self'; connect-src 'self' https://www.thecolorapi.com
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  Permissions-Policy: geolocation=(), camera=(), microphone=()

/index.html
  Cache-Control: no-cache

/index/*
  Cache-Control: public, max-age=300, must-revalidate

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/fonts/*
  Cache-Control: public, max-age=31536000, immutable
```
Drop `https://www.thecolorapi.com` from `connect-src` if F5 is cut. Only write this file if the host is Cloudflare; for Vercel use `vercel.json` `headers` instead - never both (DRY).

## Related Code Files

### Create
- `color-walk/src/lib/color-name-service.ts`, `color-walk/src/hooks/use-hue-name.ts` (optional pair)
- `color-walk/public/favicon.svg`, `color-walk/public/favicon-32.png`, `color-walk/public/og.png`
- `color-walk/public/_headers` **or** `color-walk/vercel.json` - not both
- `color-walk/README.md`

### Modify
- `color-walk/index.html` - description, OG/Twitter (absolute URLs), icons
- `color-walk/src/app.tsx` - title effect
- `color-walk/src/components/gallery-status.tsx` - final copy + adjacent-hue buttons
- `color-walk/src/components/hue-wheel.tsx` - use `useHueName` for the readout (optional)
- `color-walk/package.json` - `wrangler` exact devDependency + `deploy` script

### Delete
- `color-name-service.ts` + `use-hue-name.ts` if the Color API proves not worth the complexity

## Implementation Steps
1. Finish `gallery-status.tsx`: empty state with two working adjacent-hue buttons (wrap mod 360), final error copy, images-unavailable copy, end-of-list line. Test the empty path against the thinnest bucket in phase 1's Smoke results table.
2. Title effect in `app.tsx`.
3. Optional F5: implement `color-name-service.ts` + `use-hue-name.ts` exactly as specced. Verify a cold-start delay (>2 s) silently falls back and never blocks the readout. Verify `disabled` latches after one failure (block the host in devtools).
4. Reduced-motion audit: enable OS reduced motion and verify (a) card fade is instant, (b) hue tint is instant, (c) OSD zoom is instant. Three separate mechanisms - check all three.
5. Favicon: `favicon.svg` (a filled ring in `#f2efe9` on `#0b0b0c`) + 32 px PNG export. Screenshot the wheel at 1200x630 for `og.png`.
6. Add head tags to `index.html` with **relative** paths for icons and a placeholder host for OG; leave a `TODO(absolute-og)` marker.
7. `npm i -D wrangler` (exact, per `.npmrc`). Add `"deploy": "npm run build && wrangler pages deploy dist --project-name color-walk"`. Never invoke `npx wrangler` (finding #10).
8. Write `public/_headers` with the **strict** `style-src 'self'` (no `style-src-attr` line yet), deploy, and record the console violations. Then add `style-src-attr 'unsafe-inline'`, redeploy, confirm zero violations - both in the gallery and with a deep-zoom overlay open. Document in the README why the attribute exception exists.
9. `npm run deploy`. Record the URL here.
10. Replace the OG placeholder with absolute `https://<host>/og.png` and `og:url`; redeploy; validate in the Facebook sharing debugger and one other scraper (finding #15).
11. Lighthouse mobile from a **local** Chrome against the deployed URL. Record Performance / Accessibility / Best Practices / SEO. Usual offenders: caption contrast, unlabelled icon buttons, missing `aria-valuenow`.
12. Re-run the phase-1 browser image smoke against the **deployed** origin (one Met, one CMA thumbnail, expect 200, no `Cf-Mitigated`). This is the pre-deploy ritual that would have caught the ARTIC failure.
13. `README.md` - sections: what it is + screenshot; `npm ci` / `npm run dev` / `npm test` / `npm run build` / `npm run deploy`; **Rebuilding the colour index** (`npm run build:index`, ~1.6 GB into a gitignored `.cache/`, hours on first run, `--limit=N` and `--source=` flags, `npm rebuild sharp --foreground-scripts` if sharp fails to load under `ignore-scripts=true`, commit `public/index/*`); **Attribution** ("Images and data: The Metropolitan Museum of Art Open Access (CC0) and Cleveland Museum of Art Open Access (CC0)", links to both policies); **Why not the Art Institute of Chicago** (one paragraph on the 2026-09-13 WAF finding, so nobody re-adds it); **Not included** (list below).
14. Final sweep: `grep -ri 'dangerouslySetInnerHTML\|artic\|iiif\|AIC-User-Agent' color-walk/src color-walk/scripts` -> zero hits; `npm audit` (incl. dev); `npm test`; `npm run build`; `wc -l` sweep under 200.

## Todo List
- [ ] `gallery-status.tsx` final: empty + 2 adjacent-hue buttons, error, images-unavailable, end-of-list
- [ ] Per-hue `document.title`
- [ ] Optional: `color-name-service.ts` (2 s timeout, latch-off) + `use-hue-name.ts`
- [ ] Reduced motion verified in 3 places (card fade, tint, OSD)
- [ ] `favicon.svg`, `favicon-32.png`, `og.png` (1200x630)
- [ ] `wrangler` exact devDep + `npm run deploy` (no `npx`)
- [ ] `_headers`: strict CSP attempt -> violations recorded -> `style-src-attr 'unsafe-inline'` landed
- [ ] HSTS, `form-action 'none'`, `frame-ancestors 'none'`, `nosniff`, `Permissions-Policy`
- [ ] Cache rules: `/index.html` no-cache, `/index/*` 300 s revalidate, `/assets/*` + `/fonts/*` immutable
- [ ] Deployed; URL recorded here
- [ ] OG/`og:url` absolute; sharing-debugger validated
- [ ] Lighthouse mobile from local Chrome: perf > 90, a11y > 95 - numbers recorded here
- [ ] Post-deploy image smoke (one Met, one CMA, 200, no `Cf-Mitigated`)
- [ ] README incl. index-rebuild, attribution, and the ARTIC rationale
- [ ] Final grep sweep, `npm audit`, `npm test`, `npm run build`, `wc -l` all clean

## Success Criteria
- Live URL loads; `#h=212` deep link restores hue 212 and its results.
- Lighthouse mobile on the deployed URL: Performance > 90, Accessibility > 95, Best Practices > 90 - numbers pasted into this file.
- Zero CSP violations in the console on the live site, with a deep-zoom overlay open, on both a Met and a CMA work.
- Response headers on the live site include CSP, HSTS, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy` (verify with `curl -sI`).
- The thinnest real bucket renders the empty state with two working adjacent-hue buttons.
- With OS reduced motion on, no animation exceeds ~10 ms anywhere, including OSD zoom.
- Blocking `thecolorapi.com` changes nothing a user can see; hue names still render.
- Sharing debugger renders the OG card with the absolute image URL.
- Post-deploy image smoke: both museum thumbnails 200, no `Cf-Mitigated` header.
- `grep` sweep for `dangerouslySetInnerHTML` / `artic` / `iiif` returns nothing; `npm audit` (incl. dev) shows no high/critical.

## Risk Assessment
| Risk | L x I | Mitigation |
|---|---|---|
| Strict `style-src` breaks React + OSD inline styles | High x Med | Expected; land on `style-src 'self'; style-src-attr 'unsafe-inline'` with the reason documented, rather than blanket `unsafe-inline` |
| The Color API cold-starts or dies | High x Low | 2 s timeout, latch off after one failure, local table is the default render path |
| Stale `/index/*.json` after an index rebuild -> 404 images | Med x Med | `max-age=300, must-revalidate` on `/index/*`, `no-cache` on `/index.html` |
| OG image ignored because the URL is relative | High x Low | Absolute URL set after the first deploy + sharing-debugger check (step 10) |
| Lighthouse perf < 90 | Med x Low | Fonts already self-hosted and preloaded; first 8 images eager; if still short, cut `og.png` from the critical path and re-check image sizes |
| Museum CDN starts challenging embeds between deploys | Low x High | Step 12 image smoke is part of every deploy, not a one-off |
| `wrangler` version drift breaks deploys | Low x Low | Exact devDependency + lockfile; `npm run deploy` only |

## Security Considerations
- CSP is the main deliverable: `default-src 'self'`, no `unsafe-eval`, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'none'`, `base-uri 'none'`, and the narrowest possible `img-src` (two museum hosts, nothing else).
- HSTS `max-age=31536000; includeSubDomains` (finding #11).
- The Color API response is untrusted: only `name.value` is read, only after `typeof === 'string'`, capped at 40 chars, rendered as a React text node - never as HTML, never into an attribute.
- Still zero `dangerouslySetInnerHTML` in the repo; the grep in step 14 is the gate.
- No analytics, no third-party scripts, no cookies, no storage. Nothing user-identifying leaves the browser - and with self-hosted fonts, no third party sees visitor IPs at all except the two museum CDNs serving images (unavoidable, and disclosed in the README).
- `npm audit` runs **including** dev dependencies: the index build script runs locally with network and filesystem access, so its dependency tree is in scope (finding #10).

## NOT in scope (and when to revisit)
- **Art Institute of Chicago** - re-add only if `www.artic.edu/iiif/...` starts serving cross-origin `<img>`/`fetch` requests without a `Cf-Mitigated: challenge` 403. Re-test with the phase-1 browser smoke; the API side already works, so it is a small addition if the WAF ever relaxes.
- **IIIF tiling of any kind** - neither remaining source offers IIIF. Revisit if CMA or the Met ships an IIIF endpoint; the single-image viewer would swap tile sources and nothing else.
- **Client-side palette extraction (colorthief)** - impossible for Met (no ACAO on images) and unnecessary: colour is precomputed. Only relevant if a source with CORS-enabled images is added.
- **Pollinations AI captions** - 15 s anonymous throttle cannot serve a grid. Revisit only with an API key and a caching layer, which means a backend.
- **Datamuse word associations** - CORS disabled. Backend-only; revisit if a backend exists for another reason.
- **Sky / time-of-day palette mode** (Open-Meteo + sunrise-sunset) - the best v2 candidate: it is just "compute a hue, call `setHue`". Add once the wheel is stable.
- **Favorites / collections** - needs storage. A `localStorage` version is ~1 hour if users ask for it.
- **User accounts** - only if favorites must sync across devices. Not before.
- **Backend / proxy / CI-generated index** - the index is committed precisely to avoid this. Revisit if index rebuilds become frequent enough to be a chore (say, weekly).
- **Router or multiple pages** - the hash covers every current need.
- **More departments / media types** (Met paintings 14,395 via `medium=Paintings`; CMA prints 10,744, drawings 1995) - deliberately deferred to keep the first index build tractable. Adding them is a flag change in `fetch-*.mjs` plus a rebuild.

## Next Steps
- Post-launch: re-run the image smoke weekly-ish; if a museum CDN starts challenging, drop that source and rebuild rather than proxying.
- Candidate v2, in order: sky mode, more Met departments / CMA types, localStorage favorites.
- If the index is rebuilt, redeploy within the `/index/*` cache window (5 min) so no client holds a stale bucket.
