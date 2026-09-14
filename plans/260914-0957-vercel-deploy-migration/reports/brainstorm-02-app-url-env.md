# Brainstorm: extract the deployment origin into an environment variable

**Date:** 2026-09-14
**Trigger:** "tách ra env các biến cần thiết (gồm cả app_url)"
**Outcome:** agreed. Exactly one variable, `VITE_APP_URL`, through Vite's native HTML replacement, guarded by a build-time assertion.

## Inventory: what actually varies by environment

The whole codebase was scanned for candidates. **One** value genuinely differs between environments: the site origin, used by the `og:url` and `og:image` meta tags, still sitting as `CW_HOST` placeholders from v1 phase 4.

It must be injected at **build time**. Scrapers do not run JavaScript, so setting OG tags at runtime is useless.

## What must NOT become environment variables

The more valuable half of this analysis. "Extract env vars" slides easily into moving things that should never move:

| Value | Why it stays in code |
|---|---|
| `ALLOWED_IMAGE_HOSTS`, `ALLOWED_PAGE_HOSTS` | A security boundary. Env-configurable means one typo in a dashboard field points the browser at an arbitrary host, with no review and no test. The allowlist is worth something precisely because it is in code, reviewed and covered by hostile-fixture tests. |
| The CSP in `vercel.json` | Same argument. |
| `TONE_WEIGHT`, `AUTO_LOAD_MAX_BYTES`, `MIN_ITEMS`, `FAVOURITES_MAX`, `BUCKET_COUNT` | Measured, tuned and pinned by unit tests. An env var here means the tests assert one value while production runs another. |
| Museum API URLs in `scripts/color-index/` | Constants, used only by a hand-run build script. Changing them changes the product, not the environment. |
| Museum links in the attribution footer | Constants. |

## Two facts that shaped the design

1. **Vercel already publishes the right value.** `VERCEL_PROJECT_PRODUCTION_URL` is documented as *"always set, even in preview deployments. This is useful to reliably generate links that point to production such as OG-image URLs."* It carries no `https://` scheme and needs the "Enable access to System Environment Variables" checkbox.
2. **Vite leaves an unresolved placeholder in place.** If the variable behind `%VITE_APP_URL%` is undefined, Vite does not substitute anything - the literal `%VITE_APP_URL%` ships in the HTML. Silent, and exactly the class of failure this project has repeatedly hunted.

## Approaches considered

| Approach | Verdict |
|---|---|
| **Native `%VITE_APP_URL%`** plus a build-time guard | **Chosen.** Zero framework code, uses a documented Vite feature. The guard covers the silent-placeholder failure. Costs one manual variable in the Vercel dashboard. |
| A small Vite plugin deriving the value from `VERCEL_PROJECT_PRODUCTION_URL` | Rejected as more machinery than the problem needs. It would remove the manual dashboard step, but adds Vercel coupling inside `vite.config.ts` for a value set once. |
| Hardcode the production URL once the domain is known | Raised honestly as the YAGNI check, since a static site has one production domain that changes approximately never. Not chosen: the owner wants it configurable. |

## Design

1. **`.env`, committed**, holding the local default `VITE_APP_URL=http://localhost:5173`. No secrets exist in this project, so a shared default is safe. `.gitignore` already covers `.env.local` through its existing `*.local` rule, so nothing changes there.
2. **`index.html`**: both `CW_HOST` placeholders become `%VITE_APP_URL%`, and the now-resolved `TODO(absolute-og)` comment goes.
3. **`scripts/assert-html-env.mjs`**, wired into `npm run build`, failing on either of two conditions:
   - `dist/index.html` still contains a `%VITE_` placeholder, meaning the variable was never defined.
   - The build is running on Vercel (`process.env.VERCEL` is set) and the resolved URL contains `localhost`, meaning the dashboard variable was forgotten and the committed local default won.
4. **README**: a short subsection, including that `VITE_APP_URL` must carry no trailing slash.

### Why the second guard condition exists

With `.env` committed holding localhost, a forgotten dashboard variable does **not** produce a placeholder. It produces a well-formed URL pointing at `http://localhost:5173`, which the first check cannot see. That single extra condition turns a silently wrong production deploy into a red build.

## Success criteria

- A local `npm run build` resolves the OG tags to the `.env` value and passes the guard.
- Deleting the variable makes the build **fail**, rather than shipping a placeholder.
- Simulating a Vercel build with the localhost default makes the build **fail**.
- `grep CW_HOST` returns nothing.
- All existing checks still pass: 84 tests, clean build, zero CSP violations.

## Follow-up owned by the deploy

Set `VITE_APP_URL` in the Vercel project to the production origin, with no trailing slash. The sharing-debugger check already on v1 phase 4's outstanding list confirms the rendered card.
