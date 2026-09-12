# Research: Met Museum API, Color Extraction, OpenSeadragon & Helper APIs

**Date:** 2026-09-13  
**Researcher:** buzzspacetechdev@gmail.com  
**Scope:** Evaluating supporting technologies for "browse museum artworks by color" web app

---

## A. Met Museum Collection API Assessment

**Docs:** https://metmuseum.github.io/

### Endpoints & Data Model
- **Search:** `GET /public/collection/v1.1/search?q=...&hasImages=true&isPublicDomain=true`
  - Returns `objectIDs` array only (no details in response)
  - **v1 deprecated as of October 1, 2026** — must use v1.1
  - Returns pagination via `total` field
- **Object Details:** `GET /public/collection/v1/objects/{objectID}`
  - Returns full object metadata: medium, dimensions, title, artist, date, etc.
  - **NO color field present** — confirmed in documentation

### Critical N+1 Problem
**NO batch endpoint exists.** Must call `/objects/{id}` individually for each search result. For search returning 1000+ objects, this means 1000+ sequential requests.

### Rate Limiting
- **80 requests per second** documented limit
- **No API key required**
- At 80 req/s, fetching 1000 objects = ~12.5 seconds minimum (plus network latency)

### Image Handling
- **Fields:** `primaryImage` (JPEG URL), `primaryImageSmall` (lower-res JPEG), `additionalImages` (array)
- **CORS on Images: NOT DOCUMENTED** — critical gap for client-side canvas pixel reading
  - If images lack `Access-Control-Allow-Origin: *` headers, client-side palette extraction will fail (tainted canvas)
  - Must test manually before deployment

### CORS for API Calls
- **Browser CORS: NOT DOCUMENTED** — likely enabled (no explicit "CORS disabled" warning), but needs confirmation

### Viability Assessment
**BLUNT:** Met Museum is a secondary-only source for v1, not primary. N+1 + no color data + undocumented image CORS = 3 blockers. Use for supplemental deep-dive links, not primary browse experience. If you hit image CORS issues, Met becomes completely non-viable for client-side processing.

---

## B. Client-Side Dominant Color Extraction

### Library Comparison

| Library | Bundle Size | Algorithm | CORS Requirement | Notes |
|---------|-------------|-----------|------------------|-------|
| **fast-average-color** | ~7KB min | Simple average | `crossOrigin="anonymous"` | Lightweight, calculates mean color across image |
| **colorthief** | ~10KB | MMCQ (Median Cut) | `crossOrigin="anonymous"` | Better palette diversity; production-ready |
| **node-vibrant** | ~20KB browser build | Android Palette API | `crossOrigin="anonymous"` | Semantic swatches (Vibrant, Muted, Dark); richest output |
| **Hand-rolled (40 lines)** | 0KB | Median cut or k-means | `crossOrigin="anonymous"` | Canvas downsample + array sort or clustering |

### Critical CORS Requirement
All methods use HTML5 Canvas to read pixel data. Images **MUST** have `crossOrigin="anonymous"` attribute AND server must return `Access-Control-Allow-Origin: *` headers. Failure = tainted canvas = no data extraction.

### Recommendation: static site, no backend
**Choose: `colorthief`**
- Sweet spot: 10KB bundle, proven MMCQ algorithm, handles palette well
- Simpler than node-vibrant for "dominant hue" use case
- More robust than hand-rolled (edge cases already solved)
- NPM: https://www.npmjs.com/package/colorthief
- GitHub: https://github.com/lokesh/color-thief

**Minimal usage:**
```js
import ColorThief from 'colorthief';

const img = new Image();
img.crossOrigin = 'Anonymous'; // CRITICAL
img.src = artworkUrl;
img.onload = () => {
  const palette = new ColorThief().getPalette(img, 8); // 8 colors
  const dominant = palette[0]; // [r, g, b]
};
```

---

## C. OpenSeadragon for IIIF Deep Zoom

**Homepage:** https://openseadragon.github.io/

### Current Stable
- **Version:** 6.1.1 (latest as of 2026-09)
- **CDN:** `cdn.jsdelivr.net/npm/openseadragon@6.1.1/`
  - Provides full distribution at `cdn.jsdelivr.net/npm/openseadragon@6.1.1/build/`
  - **cdnjs not explicitly documented** — use jsDelivr instead
- **Bundle size:** Not specified on homepage; npm package likely 150-200KB (unminified)

### Mobile/Touch Support
- Documented as supporting "desktop and mobile"
- Touch gestures included (pinch-zoom, pan)
- Specific gesture API not detailed on homepage

### IIIF Initialization (Minimal)
**Documentation gap:** Homepage references IIIF support but provides no minimal code snippet.

**Inferred from IIIF standard:**
```js
const viewer = OpenSeadragon.Viewer({
  id: 'osd-canvas',
  tileSources: {
    "@context": "http://iiif.io/api/image/2/context.json",
    "@id": "https://example.com/iiif/image/manifest.json",
    "profile": ["http://iiif.io/api/image/2/level2.json"],
    "protocol": "http://iiif.io/api/image",
    "width": 4000,
    "height": 3000,
    "tiles": [{"width": 256, "scaleFactors": [1,2,4,8]}]
  }
});
```
**Note:** See examples/ in OSD repo for tested snippets. Recommend checking official guides.

### React Integration
- **No official React wrapper mentioned.**
- Approach: `useEffect` + `useRef` (standard pattern)
  ```js
  useEffect(() => {
    const viewer = OpenSeadragon.Viewer({
      id: containerRef.current.id,
      tileSources: iiifUrl
    });
    return () => viewer.destroy();
  }, [iiifUrl]);
  ```

---

## D. Small Keyless Helper APIs

### 1. The Color API
**Docs:** https://www.thecolorapi.com/docs

- **Endpoints:**
  - `/id?hex=FF5733` — returns color name, RGB, HSL, CMYK, XYZ, contrast data
  - `/scheme?hex=FF5733&mode=triad&count=5` — generates color schemes (monochrome, analogic, complement, triad, quad)
  - Supports input: `hex`, `rgb`, `hsl`, `cmyk`
- **Response:** JSON (default), HTML, SVG
- **CORS:** Not explicitly documented, but API structure suggests enabled
- **Rate Limit:** Not documented — assume reasonable (test before production)
- **No API Key Required**

**Use case:** Label extracted colors by name, generate complementary palettes for UI.

### 2. Datamuse API
**Docs:** https://www.datamuse.com/api/

- **Endpoints:** `/words?ml={word}` (means-like), `/words?rel_trg={word}` (related trigger)
  - Example: `/words?ml=scarlet` → returns words semantically similar to "scarlet"
  - Can chain: `/words?ml=sunset&sp=...` for pattern matching
- **Rate Limit:** 
  - Free: **100,000 requests/day** until January 1, 2027
  - After Jan 1, 2027: API key required, limit remains 100k/day per key
  - Current date: Sep 2026 → **keyless free access still available**
- **CORS:** **DISABLED** (not available for browser client-side requests)
  - Must proxy through your own backend or use CORS middleware
- **No API Key Required (until 2027-01-01)**

**Use case:** Find color-related words for tagging/descriptions. Example: user clicks "blue" → Datamuse returns "azure, navy, cobalt, cerulean" for suggestions.

### 3. Pollinations Text Endpoint
**Docs:** https://raw.githubusercontent.com/pollinations/pollinations/master/APIDOCS.md  
**Endpoint:** `https://text.pollinations.ai/{prompt}`

- **Anonymous Access:**
  - **Rate Limit:** 1 request every 15 seconds
  - **Status (Sep 2026):** Active, no signup required
  - Example: `https://text.pollinations.ai/describe%20this%20artwork%20in%20one%20sentence`
- **Authenticated (with sk_ key):**
  - **Rate Limit:** None (unlimited for server-side)
  - Requires `Authorization: Bearer sk_...` header
- **CORS:** Documentation doesn't specify; likely enabled for public endpoint
- **Cost:** Free (but rate-limited for anonymous)

**Use case:** Generate artwork descriptions/tags dynamically. Anonymous tier sufficient for low-traffic demo; upgrade to key for production.

---

## Integration Feasibility Summary

| Component | Viability | Blocker | Recommendation |
|-----------|-----------|---------|-----------------|
| **Met API** | ⚠️ Secondary only | N+1 + image CORS risk | Use ARTIC instead (primary); Met for supplemental links |
| **colorthief** | ✅ Excellent | None | Primary color extraction |
| **OpenSeadragon** | ✅ Good | Init snippet gap | Use with IIIF-compliant image servers |
| **The Color API** | ✅ Good | CORS undocumented | For color naming & schemes |
| **Datamuse** | ⚠️ Backend only | CORS disabled | Requires proxy; free until 2027-01-01 |
| **Pollinations** | ✅ Good | 15s rate limit | Anonymous tier OK for prototype; upgrade for production |

---

## Unresolved Questions

1. **Met Museum Image CORS Headers** — Do Met's image URLs actually return `Access-Control-Allow-Origin: *`? 
   - **Impact:** If not, client-side color extraction fails completely.
   - **Test required:** Fetch a primaryImage URL, check response headers before finalizing Met integration.

2. **The Color API Rate Limit & Uptime** — No rate limit documented. What's the practical limit? 
   - **Impact:** Affects scalability for real-time color naming on high-traffic site.
   - **Test required:** Load-test with 100+ simultaneous requests.

3. **Datamuse CORS Workaround** — Can Datamuse work client-side with a CORS proxy (e.g., https://cors-anywhere.herokuapp.com/)? 
   - **Impact:** Determines if we need backend proxy or can keep entirely client-side.
   - **Test required:** Try CORS proxy in development; check if Datamuse terms updated.

4. **Pollinations Text Endpoint Stability** — Is `text.pollinations.ai` guaranteed stable long-term, or experimental? 
   - **Impact:** If experimental, may deprecate. Should it be primary or fallback?
   - **Test required:** Check GitHub issues for deprecation notices.

5. **OpenSeadragon IIIF Examples** — Where are the tested IIIF + OSD integration examples? 
   - **Impact:** Init snippet I inferred may be incomplete.
   - **Test required:** Run official examples before building custom wrapper.

---

## Sources

- [Metropolitan Museum Collection API](https://metmuseum.github.io/)
- [The Color API Docs](https://www.thecolorapi.com/docs)
- [fast-average-color - npm](https://www.npmjs.com/package/fast-average-color)
- [Color Thief GitHub](https://github.com/lokesh/color-thief)
- [OpenSeadragon](https://openseadragon.github.io/)
- [Datamuse API](https://www.datamuse.com/api/)
- [Pollinations API Docs](https://raw.githubusercontent.com/pollinations/pollinations/master/APIDOCS.md)

---

**Status:** DONE  
**Summary:** Met Museum API confirmed N+1 + no color field (secondary only); colorthief chosen for color extraction; OpenSeadragon 6.1.1 via jsDelivr with IIIF support (init gap); The Color API + Pollinations free/low-cost for naming/descriptions; Datamuse requires backend proxy due to CORS.  
**Concerns/Blockers:** Met image CORS headers untested; Datamuse CORS workaround needs validation; Pollinations stability unknown; OpenSeadragon IIIF examples not reviewed.
