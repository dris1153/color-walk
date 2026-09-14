---
phase: 4
title: "Polish, a11y and deploy"
status: blocked
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

### `_headers` (Cloudflare Pages) - `public/_headers`
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
- `src/lib/color-name-service.ts`, `src/hooks/use-hue-name.ts` (optional pair)
- `public/favicon.svg`, `public/favicon-32.png`, `public/og.png`
- `public/_headers` **or** `vercel.json` - not both
- `README.md`

### Modify
- `index.html` - description, OG/Twitter (absolute URLs), icons
- `src/app.tsx` - title effect
- `src/components/gallery-status.tsx` - final copy + adjacent-hue buttons
- `src/components/hue-wheel.tsx` - use `useHueName` for the readout (optional)
- `package.json` - `wrangler` exact devDependency + `deploy` script

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
14. Final sweep: `grep -ri 'dangerouslySetInnerHTML\|artic\|iiif\|AIC-User-Agent' src scripts` -> zero hits; `npm audit` (incl. dev); `npm test`; `npm run build`; `wc -l` sweep under 200.

## Todo List
- [x] `gallery-status.tsx` final: empty + 2 adjacent-hue buttons, error, images-unavailable, end-of-list
- [x] Per-hue `document.title`
- [ ] Optional: The Color API - **DROPPED**, it contradicts the runtime no-third-party-API rule
- [x] Reduced motion verified in 3 places (card fade, tint, OSD)
- [x] `favicon.svg`, `favicon-32.png`, `og.png` (1200x630)
- [x] `wrangler` exact devDep + `npm run deploy` (no `npx`)
- [x] `_headers`: strict CSP attempt -> violations recorded -> `style-src-attr 'unsafe-inline'` landed
- [x] HSTS, `form-action 'none'`, `frame-ancestors 'none'`, `nosniff`, `Permissions-Policy`
- [x] Cache rules: `/index.html` no-cache, `/index/*` 300 s revalidate, `/assets/*` + `/fonts/*` immutable
- [ ] Deployed; URL recorded here - **BLOCKED, no Cloudflare credentials**
- [ ] OG/`og:url` absolute - **BLOCKED on the deploy**
- [x] Lighthouse mobile from local Chrome - numbers below; a11y met, perf not reachable
- [ ] Post-deploy image smoke - **BLOCKED on the deploy** (passes locally)
- [x] README incl. index-rebuild, attribution, and the ARTIC rationale
- [x] Final grep sweep, `npm audit`, `npm test`, `npm run build`, `wc -l` all clean

## Measured results (recorded 2026-09-13)

Measured against the built bundle served with `public/_headers` actually applied,
so the CSP and cache rules are the ones that will ship.

### Lighthouse, mobile emulation with default throttling
| Category | Target | Result |
|---|---|---|
| Accessibility | > 95 | **100** |
| SEO | - | **100** |
| Best Practices | > 90 | **77** |
| Performance | > 90 | **73** |

| Metric | Result |
|---|---|
| Cumulative Layout Shift | **0** |
| Total Blocking Time | **0 ms** |
| First Contentful Paint | 2.1 s |
| Speed Index | 2.1 s |
| Largest Contentful Paint | 9.7 s |

### Two targets are not reachable, and why

**Performance 73.** The blocker is LCP, and LCP here is a museum photograph.
Lighthouse's mobile profile simulates roughly 1.6 Mbps, where the largest
above-the-fold image alone (938 KB) takes about 4.7 s. Both museums already
serve their smallest published derivative: Met `primaryImageSmall` is around
600 px, Cleveland `web` has a median of 719 px, and there is nothing smaller to
ask for. Getting under 2.5 s would need images resized to the ~190 px slot they
are displayed in, which means an image proxy - a backend, explicitly out of
scope for v1.

Two fixes were applied first, and both are real wins for anyone on mobile data
regardless of the score:

| | before | after |
|---|---|---|
| images fetched on first load, 390 px | 41 | **24** |
| image bytes on first load | 10.7 MB | **4.8 MB** |
| Largest Contentful Paint | 14.8 s | **9.7 s** |
| Speed Index | 4.1 s | **2.1 s** |

The first was making the eager, high-priority count follow the column count
instead of a fixed 8, so a two-column phone stops putting four off-screen images
into the same race as the one that decides LCP. The second was making the
initial reveal follow the column count too: Chrome's lazy-load threshold is
thousands of pixels on a slow link, so rendering 60 cards made a phone fetch
about 40 images to show four. Twelve rows leaves desktop behaviour identical at
five columns and halves the mobile payload.

**Best Practices 77.** Both failing audits are the same fact: `Set-Cookie` on
image responses from `images.metmuseum.org`, namely `visid_incap_1661977`. That
is Imperva Incapsula's visitor cookie, set by the Met's own WAF. Only proxying
their images would remove it.

### CSP: strict first, then exactly one exception

Served with the strict `style-src 'self'` and no attribute exception, the result
was not what the plan predicted:

- **Gallery: zero violations.** React writes element styles through CSSOM
  (`style.setProperty`), and CSP polices inline style *attributes* at parse
  time, not CSSOM writes. So `style-src-attr 'unsafe-inline'` was never needed.
- **With an overlay open: one violation,** `style-src-elem`. OpenSeadragon 6.1.1
  injects a single `<style>` element carrying a media query that removes the
  focus outline on touch devices.

Rather than blanket-allow inline styles, that one element is covered by its
hash, `sha256-9xTiqzfwFaL2SGb1rmr8gysEwVVjIvqWAgmZgqFqpEE=`, which matches what
Chrome itself reported. The shipped policy contains **no `unsafe-inline` and no
`unsafe-eval` anywhere**, and `connect-src` is `'self'` only. Re-measured:
**zero violations on the gallery and with a deep-zoom overlay open.**

The hash is pinned to OpenSeadragon 6.1.1, which the lockfile pins exactly.
Bumping OpenSeadragon means recomputing it; the failure mode is a console
violation when an overlay opens, and a focus outline returning on touch devices.
This is recorded in a comment at the top of `public/_headers`.

### Headers verified on the wire
`curl -sI` against the served build returns the CSP, `Strict-Transport-Security:
max-age=31536000; includeSubDomains`, `Referrer-Policy`, `X-Content-Type-Options:
nosniff` and `Permissions-Policy`, plus `Cache-Control: public, max-age=300,
must-revalidate` on `/index/*` and `immutable` on `/assets/*` and `/fonts/*`.

### Regression after the phase 4 changes
Phase 2 and phase 3 browser checks were re-run against the final build: one
index request per hue and zero on revisit, zero non-image requests while
scrolling, the thin-hue padding still leading with the nearest colours, the full
close matrix, focus return, scroll-lock restore, and no canvases left after 20
open/close cycles. The console is now clean: the favicon 404 is gone.

## Changes to the plan made during phase 4

1. **The Color API (F5) was dropped, not deferred.** It is a third-party call at
   runtime, and the project's standing rule is that the runtime calls no
   third-party API at all. Dropping it also lets `connect-src` stay `'self'`,
   which is tighter than the policy the plan drafted. The local 24-name table is
   the only source of colour names.
2. **`style-src-elem` with a hash replaced `style-src-attr 'unsafe-inline'`,**
   for the reasons measured above.
3. **The empty state is effectively unreachable.** Phase 2's neighbour padding
   means a hue only shows nothing if every bucket file is empty. The state and
   its two adjacent-hue buttons are implemented as specified, but they could not
   be exercised against real data, and the thinnest-bucket test the plan called
   for no longer has a thin bucket to test.
4. **A bug was found and fixed while wiring the adjacent-hue buttons.** The
   centre "All" button called `setHue` and then committed the hash in the same
   tick, so the hash was written from the pre-render value. It only appeared
   correct in earlier tests because the 300 ms throttle happened to defer the
   write until after the re-render. `commitHash` now takes the value explicitly
   when the caller is committing in the same tick.
5. **`public/robots.txt` was added,** which took SEO from 92 to 100.

## Blocked: the deploy

`npm run deploy` is wired and `wrangler` is pinned at 4.131.1 in
`devDependencies`, but **no deploy happened.** There are no Cloudflare
credentials on this machine: no `CLOUDFLARE_API_TOKEN`, no
`CLOUDFLARE_ACCOUNT_ID`, no `~/.wrangler/config`, and `wrangler whoami` reports
"You are not authenticated". `wrangler login` needs an interactive browser flow.

Wrangler offers `--temporary` to publish under an anonymous preview account.
That was deliberately not used: it would put the site on an account the owner
does not control.

Three items therefore remain, all of which need the deploy first:

1. Run `npx wrangler login`, then `npm run deploy`, and record the URL.
2. Set `VITE_APP_URL` in the Vercel project to the deployed origin, with no
   trailing slash, then redeploy and check the card in a sharing debugger.
   Superseded 2026-09-14: the `CW_HOST` placeholders became `%VITE_APP_URL%`,
   resolved at build time, and `npm run build` now fails rather than shipping an
   unresolved placeholder or a localhost URL. Relative OG URLs are ignored by
   most scrapers, which is why this is baked in at build time at all.
3. Re-run the browser image smoke against the deployed origin: one Met and one
   Cleveland thumbnail, both 200, neither carrying `Cf-Mitigated`. It passes
   locally; running it against the real origin is the pre-deploy ritual that
   would catch a museum starting to block embeds.

## Host changed to Vercel, 2026-09-14

This phase was built and measured against Cloudflare Pages' `_headers` format.
The project now ships on Vercel, so `public/_headers` was deleted, `wrangler`
and the `deploy` script were removed, and the same policy moved verbatim into
`vercel.json`. Deployment runs through Vercel's Git integration, so there is no
deploy command and no local credential.

The CSP string is unchanged byte for byte, hash included. What changed is the
pattern syntax: Vercel's `source` is path-to-regexp, so `/index/*` became
`/index/:path*` and `/*` became `/(.*)`.

**A latent gap in this phase's own config surfaced during that translation.**
Header rules match the request pathname, and a visitor loading the site requests
`/`, not `/index.html`. The `no-cache` rule written here almost certainly never
applied to the page anyone actually loads. It went unnoticed because the site
was never deployed. `vercel.json` declares both paths, and a local server that
applies the real config now confirms `/` carries `Cache-Control: no-cache`.

The three items still blocked on a live URL are unchanged, only the mechanism
differs: push to GitHub and connect the repo on Vercel, set `VITE_APP_URL` in
the project settings, and re-run the image smoke and Lighthouse against the
deployed origin.

Reasoning and the full verification list: [the Vercel migration brainstorm](../260914-0957-vercel-deploy-migration/reports/brainstorm-01-cloudflare-to-vercel.md).

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
