# Debug: the dev server takes minutes before the first page

**Date:** 2026-09-26
**Trigger:** "mỗi lần tôi start dev xong, page vào load rất lâu, có thể tận vài phút"

## Cause

`scripts/color-index/.cache` holds 89,908 files (19 GB of thumbnails) inside
the project, and a crawl keeps writing to it. Vite watches the project root.
When the dependency cache is cold, the optimizer globs `**/*.html` across the
project (18 s on its own) and then scans while the watcher walks 90k files and
receives the crawl's writes; the browser waits for the scan.

Measured with a separate dev server on port 5199 and its own dependency cache,
the crawl running alongside (timeline from `DEBUG=vite:*`: listening at 1.3 s,
"Crawling dependencies" at 18.6 s, nothing more within 90 s):

| Run | First work on screen |
|---|---|
| As configured, cold dependency cache | **over 10 min, never finished** (twice) |
| As configured, warm cache | 0.56 s |
| Fixed, cold cache | **1.2 s** after a 1.6 s start (0.6-0.7 s with inline config) |
| Fixed, warm cache | 0.6 s |

## Fix (`vite.config.ts`)

- `server.watch.ignored`: the crawl cache, `dist`, `plans`. `public/index` stays
  watched: a file added there while the server runs is served (checked: 200,
  `application/json`), so a rebuilt index needs no restart.
- `optimizeDeps.entries: ['index.html']`: no whole-project glob.

## Not done (offered)

- Moving the crawl cache out of the project (after the crawl) would also spare
  VS Code's watcher and search and the virus scanner.
- `.vscode/settings.json` excludes for the cache.

An early measurement deleted `node_modules/.vite` while the owner's dev server
was running; a restart of `pnpm dev` rebuilds it. Later runs used their own cache.
