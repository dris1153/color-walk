# Brainstorm: repo About panel and the new domain

**Date:** 2026-09-27
**Trigger:** "cập nhật lại thông tin repo: description, tags, url web: color-walk.drisdev.io"
**Outcome:** approved: count-free description, 20 topics, README live link, push to main.

## Checked first

- `https://color-walk.drisdev.io` answers 200 from Vercel; `og:url` and `og:image` already on that origin
  (VITE_APP_URL set in the Vercel project), CSP and HSTS present, `/c/210/` 200.
- Repo had no description, homepage `color-walk-omega.vercel.app`, no topics.

## Done

- Description: "Walk through public-domain museum art by colour: a hue wheel over the open-access
  collections of the Met, Cleveland, the Rijksmuseum and the NGA." No count, so a re-crawl never dates it.
- Homepage: `https://color-walk.drisdev.io`.
- Topics (20, the GitHub maximum): art, museum, color, public-domain, open-access, cultural-heritage,
  glam, metmuseum, rijksmuseum, clevelandart, national-gallery-of-art, react, typescript, vite,
  tailwindcss, openseadragon, iiif, static-site, data-visualization, color-palette.
- README: live link under the tagline, shields.io website badge (up/down, live), Deploying example
  now the real origin.
- "tags" read as GitHub topics; no git tag or release created.
