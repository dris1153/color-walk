# Brainstorm: move the deploy target from Cloudflare Pages to Vercel

**Date:** 2026-09-14
**Trigger:** the project will ship on Vercel, not Cloudflare Pages.
**Outcome:** agreed. Translate the headers into `vercel.json`, delete every Cloudflare trace, deploy through Vercel's Git integration.

## Problem

v1 phase 4 built and measured a security and caching posture on Cloudflare Pages' `_headers` format. Vercel ignores that file completely.

**The sharp edge: changing host without changing the file ships the site with no Content-Security-Policy at all.** Every measurement from phase 4 - zero CSP violations, no `unsafe-inline`, the OpenSeadragon hash, HSTS - would silently evaporate. Nothing would break visibly; the page would just be unprotected.

Nothing was ever deployed to Cloudflare, so this is a migration on paper only. No live URL, no DNS, no users to move.

## Current state

| | |
|---|---|
| Git remote | `github.com/dris1153/color-walk`, configured, **nothing pushed** |
| Local commits | 10, on `main` |
| Cloudflare artefacts | `public/_headers`, `wrangler@4.131.1` devDependency, `npm run deploy` |
| Vercel artefacts | none: no `vercel.json`, no `.vercel`, no CLI |

## What actually has to change

Mechanical, and small:

1. `public/_headers` becomes `vercel.json`. **Not a copy-paste:** Vercel's `source` is path-to-regexp, not a glob.

   | Cloudflare | Vercel |
   |---|---|
   | `/*` | `/(.*)` |
   | `/index/*` | `/index/:path*` |
   | `/assets/*` | `/assets/:path*` |

2. Drop `wrangler` from devDependencies and drop the `deploy` script: Git integration needs no local deploy command.
3. README deploy section.
4. A note in v1's phase 4 recording the host change.

**Unchanged:** the CSP string byte for byte including `sha256-9xTiqzfwFaL2SGb1rmr8gysEwVVjIvqWAgmZgqFqpEE=`, the image host allowlist, and every line of application code. All host-independent.

## Findings from the Vercel docs

- **`headers` in `vercel.json` is the right mechanism**, with `source` patterns like `/(.*)` and `/:path*`.
- **"Vercel doesn't allow bypassing the cache for static files by design."** Whether a browser-facing `no-cache` on the entry document survives that is **not settled by the docs**. It gets verified with `curl -sI` against the real deployment, not assumed.
- **Static files are CDN-cached per deployment.** The classic "stale index.html points at a deleted hashed asset" problem is therefore weaker on Vercel than on a naive static host.
- **`/index/*` staleness is a separate and still-real correctness issue.** Bucket files carry no content hash, so a browser holding an old one after an index rebuild requests images that 404. `max-age=300, must-revalidate` carries over unchanged.

## A latent bug found while writing the config

Header rules match the **request pathname**. A visitor loading the site requests `/`, not `/index.html`.

So the `/index.html` rule never applies to the page anyone actually loads. **v1's `_headers` almost certainly carried the same gap**, undetected because the site was never deployed. The Vercel config declares both `/` and `/index.html`, and which one actually takes effect gets confirmed by `curl` after the first deploy.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Deploy mechanism | **Git integration** | Auth happens once in a browser. The CLI needs `vercel login`, the same interactive OAuth that blocked `wrangler` in this session. Also removes a dependency and a script rather than swapping them. |
| Who pushes | **The owner** | Pushing 10 commits to GitHub is public and hard to undo. Not an agent's call. |
| Cloudflare artefacts | **Deleted** | v1's own plan said "never both (DRY)". A dead `_headers` is worse than no file: the next reader assumes the CSP is live. |
| `no-cache` on the entry document | **Declare `/` and `/index.html`** | Four extra lines of JSON against a real risk. Verify after deploy which one binds. |
| JSON has no comments | **Move the explanation to the README** | The five lines explaining the OpenSeadragon hash and what breaks when it is bumped must survive the format change. |

## Rejected

- **Keeping both header files** for host portability. Two sources of truth for a security policy drift, and the drift is silent.
- **Vercel CLI as the primary path.** Same interactive-login blocker, plus a pinned dependency to maintain, for no gain over Git integration on a project that deploys from one branch.

## Must be verified on the real URL

Not assumed, not inferred from docs:

| Check | Why it matters |
|---|---|
| `curl -sI /` | Does `no-cache` survive Vercel's static-file cache rules |
| `curl -sI /index/all.json` | `max-age=300, must-revalidate` - correctness, not speed |
| `curl -sI /assets/<hashed>.js` | `immutable` |
| Security headers on `/` | CSP, HSTS, Referrer-Policy, `nosniff`, Permissions-Policy |
| CSP in a browser | Zero violations on the gallery and with a deep-zoom overlay open |
| Image smoke | One Met and one Cleveland thumbnail, both 200, neither carrying `Cf-Mitigated` |

Two items parked since v1 phase 4 unblock once a URL exists: replacing the `CW_HOST` placeholders in `index.html` with the real origin, and running Lighthouse against the deployed site.

## Two traps on the Vercel side

1. **Do not enable Vercel Analytics or Speed Insights.** Both inject a third-party script, breaking `script-src 'self'` and the standing rule that the runtime calls no third-party API. That rule already cost The Color API in phase 4.
2. **Set the Node version to 22** in project settings to match `.nvmrc`.

## Success criteria

- The deployed site returns the full CSP, with no `unsafe-inline` and no `unsafe-eval`.
- Zero CSP violations in a browser, gallery and overlay alike.
- `/index/*` responses carry `max-age=300, must-revalidate`.
- `grep -ri 'cloudflare\|wrangler'` over the source and config returns nothing.
- All existing checks still pass: 84 tests, clean build, CLS 0.

## Next step

Small enough to implement directly. No phased plan.
