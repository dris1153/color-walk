# Color Walk

Pick a colour, then walk through the public-domain paintings that share it.

Dragging the hue wheel re-sorts a gallery of 6,048 works from the Metropolitan
Museum of Art and the Cleveland Museum of Art by how close their dominant
colour is to the one you picked. Tapping a work opens a full-screen deep-zoom
viewer.

![Color Walk](public/og.png)

The site is static. At runtime it calls no third-party API at all: it fetches
colour-index JSON from its own origin and loads images from the two museums'
CDNs. There is no backend, no database, no account, no cookie and no analytics.

## Running it

Requires Node 22 (see `.nvmrc`).

```bash
npm ci          # exact versions from package-lock.json
npm run dev     # http://localhost:5173
npm test        # unit tests (vitest)
npm run build   # type-check and bundle into dist/
npm run preview # serve the built bundle
```

## Deploying

The site deploys to Vercel through its Git integration: connect the repository
once in the Vercel dashboard and every push to `main` ships. There is no deploy
command and no deploy credential on your machine, which is the point.

Two settings matter on the Vercel side:

- **Node version 22**, to match `.nvmrc`.
- **Analytics and Speed Insights stay off.** Both inject a third-party script.
  That breaks `script-src 'self'` and the standing rule that this site calls no
  third-party API at runtime - the rule that already cost it a colour-naming
  API.

`vercel.json` carries the response headers. It is the only place they live:
Vercel ignores Cloudflare's `_headers` format, so a stray copy of that file
would leave the site with no Content-Security-Policy while looking protected.

After the first deploy, confirm the headers actually arrived rather than
assuming they did:

```bash
curl -sI https://<host>/               # CSP, HSTS, Referrer-Policy, nosniff, Permissions-Policy
curl -sI https://<host>/index/all.json # public, max-age=300, must-revalidate
```

The second one is a correctness check, not a performance one. Bucket files carry
no content hash, so a browser holding a stale one after an index rebuild asks
for images that no longer exist.

Note that `.npmrc` sets both `save-exact=true` and `ignore-scripts=true`, so
every dependency is pinned to an exact version and no package install script
runs. Install new packages with plain `npm i <name>` and the exact version is
recorded automatically.

## Rebuilding the colour index

`public/index/` holds the committed colour index: `meta.json`, `all.json` and
24 bucket files, one per 15 degrees of hue. Nothing rebuilds it automatically.
Regenerate it by hand when museum image URLs drift or when you widen the source
query:

```bash
npm run build:index -- --limit=50   # smoke run first, a couple of minutes
npm run build:index                 # the real thing
npm run verify:index                # assert the output before committing it
git add public/index && git commit
```

What to expect on a cold cache:

- About **1.4 GB** of thumbnails downloaded into `scripts/color-index/.cache/`,
  which is gitignored. A warm re-run issues zero downloads and finishes in
  about 20 seconds.
- **Roughly an hour** for the Met stage alone. `collectionapi.metmuseum.org`
  sits behind Imperva: the documented 80 requests per second is not what the
  WAF enforces, and about 75 requests in quick succession earn a 403 block
  lasting one to three minutes, at 2.5 req/s as readily as at 30 req/s. The
  script therefore crawls at roughly 1.25 req/s, caches every object it
  receives, and cools down for 90 seconds whenever it is refused. A run that
  ends early loses nothing: the next one resumes from the cache.
- `--source=met` and `--source=cma` restrict the run to one museum, and
  `--limit=N` caps how many records each source contributes.

If `import('sharp')` fails, run `npm rebuild sharp --foreground-scripts`. That
is needed because `ignore-scripts=true` suppresses sharp's install script.

### How a work gets its colour

`extract-dominant-color.mjs` downsamples each thumbnail to 48 pixels on its
long edge, converts every pixel to HSL, and discards the ones that carry no
colour information: darker than 8% lightness, lighter than 92%, or less than
12% saturated. Those are canvas, varnish and frame, not colour. What remains is
accumulated into 24 hue buckets weighted by saturation, and the bucket holding
the most weight wins. Its hue is a circular mean, so a bucket straddling 0
degrees does not average to 180.

`pct` is the winning bucket's share of the counted colour weight, **not** of all
pixels: read it as "how much of this work's colour sits in this 15-degree
slice". A work where less than 2% of pixels carry any colour is dropped as
achromatic.

### The collection is warm, and the gallery compensates

The measured distribution is heavily skewed: buckets 1 to 3, vermilion through
amber, hold 95% of the collection, and five buckets from indigo to fuchsia are
empty. Many Cleveland "paintings" are ink-on-paper scrolls that are almost
monochrome sepia.

Loading only the exact bucket would therefore leave most of the wheel dead, so
`loadBucketNear` pads a thin hue from its neighbouring buckets one ring at a
time until it has at least a screenful. The results are still sorted by
distance to the exact hue, so the closest colours lead and the warm mass sinks
to the bottom. A well-populated hue still costs exactly one request.

## Attribution

Images and data: **The Metropolitan Museum of Art Open Access (CC0)** and
**Cleveland Museum of Art Open Access (CC0)**.

- https://www.metmuseum.org/about-the-met/policies-and-documents/open-access
- https://www.clevelandart.org/open-access

The build enforces the licence rather than assuming it: a Met object is kept
only when `isPublicDomain === true`, and a Cleveland artwork only when
`share_license_status === 'CC0'`.

Visitors' browsers contact the two museum CDNs to fetch images, which is
unavoidable for a site that shows their pictures. Fonts are self-hosted, so no
font CDN sees a visitor either.

## Why not the Art Institute of Chicago

The Art Institute's API can search by dominant colour, which would have made
this project far easier, and it was the original plan. Its image host cannot be
used.

Verified on 2026-09-13: `www.artic.edu/iiif/...` returns `403` with a
`Cf-Mitigated: challenge` header to curl, to headless Chrome, and to a real
headed Chrome loading the URL cross-origin as an `<img>`, even after a
top-level visit had already cleared the challenge. Top-level navigation works;
third-party embedding does not. `api.artic.edu` is fine but worthless without
images.

Re-add it only if that host starts serving cross-origin image requests without
the challenge. The check is the browser smoke below.

## The pre-deploy check that matters

Before every deploy, load the site and confirm that one Met thumbnail and one
Cleveland thumbnail both paint, both return HTTP 200, and neither response
carries a `Cf-Mitigated` header. This is precisely the check the Art Institute
failed, and it is how you would learn that another museum had started blocking
embeds, instead of shipping a grid of coloured rectangles.

## Security notes

`normalize-artwork.mjs` is the only place untrusted API data becomes an item.
It enforces an exact hostname allowlist and `https:`, caps every string at 300
characters, and returns `null` rather than throwing. The runtime re-checks the
same allowlist before any URL reaches an `<img>` or the viewer, because the
index is a file and files get edited.

`vercel.json` carries the Content-Security-Policy. It contains no
`unsafe-inline` and no `unsafe-eval`.

The single inline `<style>` on the page is the rule OpenSeadragon 6.1.1 injects
to drop a focus outline on touch devices, covered by the `style-src-elem` hash
`sha256-9xTiqzfwFaL2SGb1rmr8gysEwVVjIvqWAgmZgqFqpEE=`. **Bumping OpenSeadragon
means recomputing that hash**; a mismatch shows up as a console violation the
moment an overlay opens, and the focus outline returns on touch devices. JSON
has no comments, so this note is the only place that warning lives.

React writes element styles through CSSOM, which CSP does not police, so
`style-src-attr` stays strict.

There is no `dangerouslySetInnerHTML` anywhere in the repository.

## Not included

Art Institute of Chicago, IIIF tiling of any kind, client-side palette
extraction, AI captions, word-association lookups, a sky or time-of-day palette
mode, favourites, accounts, and any backend. Each was considered and left out;
`plans/` records why, and what would have to change to revisit it.
