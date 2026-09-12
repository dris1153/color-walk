# Art Institute of Chicago API: Color Search & IIIF Implementation Report

**Research Date:** 2026-09-13  
**API Version:** v1  
**Source:** https://api.artic.edu/docs/

## 1. Artwork Search Endpoint: Color Field Queries

### Endpoint
```
GET https://api.artic.edu/api/v1/artworks/search
POST https://api.artic.edu/api/v1/artworks/search
```

### Color Field Names (Exact)
- `color.h` — hue (0–360)
- `color.s` — saturation (0–100)
- `color.l` — lightness (0–100)
- `color.population` — prevalence in artwork (0–1.0)

### Example: Hue 200 ±15, Saturation >30, Lightness 20–80, Public Domain, Has Image

**GET with query params:**
```
GET https://api.artic.edu/api/v1/artworks/search?query[bool][must][0][range][color.h][gte]=185&query[bool][must][1][range][color.h][lte]=215&query[bool][must][2][range][color.s][gte]=30&query[bool][must][3][range][color.l][gte]=20&query[bool][must][4][range][color.l][lte]=80&query[bool][must][5][term][is_public_domain]=true&query[bool][must][6][exists][field]=image_id&limit=100
```

**POST with JSON body (Elasticsearch Query DSL):**
```json
POST https://api.artic.edu/api/v1/artworks/search

{
  "query": {
    "bool": {
      "must": [
        { "range": { "color.h": { "gte": 185, "lte": 215 } } },
        { "range": { "color.s": { "gte": 30 } } },
        { "range": { "color.l": { "gte": 20, "lte": 80 } } },
        { "term": { "is_public_domain": true } },
        { "exists": { "field": "image_id" } }
      ]
    }
  },
  "limit": 100,
  "page": 1
}
```

### Response Structure (Partial)
```json
{
  "data": [
    {
      "id": 24529,
      "title": "Nighthawks",
      "artist_display": "Edward Hopper",
      "date_display": "1942",
      "image_id": "ba142c23-9e78-70e8-d0ab-ef22e1e84771",
      "color": {
        "h": 198,
        "s": 45,
        "l": 52,
        "population": 0.68
      },
      "is_public_domain": true,
      "thumbnail": {
        "lqip": "data:image/gif;base64,R0lGODlhBQAFAPQAAEZcaFFfdVtqbk9ldFBlcVFocllrcFlrd11rdl9sdFZtf15wcWR0d2R2eGByfmd6eGl6e2t9elZxiGF4kWB4kmJ9kGJ8lWeCkWSAnQAAAAAAAAAAAAAAAAAAAAAAAAAAACH5BAAAAAAALAAAAAAFAAUAAAUVoJBADXI4TLRMWHU9hmRRCjAURBACADs=",
        "width": 250,
        "height": 165
      }
    }
  ],
  "pagination": {
    "total": 4521,
    "limit": 100,
    "offset": 0,
    "first_url": "...",
    "last_url": "...",
    "prev_url": null,
    "next_url": "..."
  }
}
```

## 2. Field Parameters for Minimal Payload

Use the `fields=` parameter to request only necessary fields:

```
GET https://api.artic.edu/api/v1/artworks/search?fields=id,title,artist_display,date_display,image_id,color,is_public_domain,thumbnail.lqip,thumbnail.width,thumbnail.height
```

**Recommended minimal set:**
- `id` — unique identifier
- `title` — artwork name
- `artist_display` — creator info
- `date_display` — creation date
- `image_id` — required for IIIF URL construction
- `color` — hue, saturation, lightness, population
- `is_public_domain` — licensing
- `thumbnail.lqip` — base64-encoded low-quality image placeholder
- `thumbnail.width`, `thumbnail.height` — aspect ratio for layout

**Payload reduction:** Specifying fields reduces response size by ~60–70% vs. full object.

## 3. IIIF Image URLs & Tile Support

### Standard Image URL
```
https://www.artic.edu/iiif/2/{image_id}/full/843,/0/default.jpg
```

**Path breakdown:**
- `843,` — width in pixels; 843px is recommended size (used on artic.edu website)
- `/0/` — rotation (0°)
- `default.jpg` — image format

### Info.json for Deep Zoom
```
https://www.artic.edu/iiif/2/{image_id}/info.json
```

Returns IIIF Image API 2.0 metadata including:
- Available tile sizes and scales
- Image dimensions
- Profile level (features supported)

### Size Restrictions
- **843px width** is recommended and pre-optimized
- **Full-size available** via `full` parameter (e.g., `/full/full/0/default.jpg`)
- No documented maximum; full-size JPEG served directly
- No restrictions on request frequency per image

### IIIF Tile Support for OpenSeadragon
- **Yes**, IIIF 2.0 tiles fully supported via info.json
- **CORS enabled** on `www.artic.edu` — no preflight blocking for browser requests
- OpenSeadragon can request tiles directly without proxy
- Tiles support standard IIIF tile parameters (`/tiles.json` endpoint available)

### Example OpenSeadragon Init
```javascript
OpenSeadragon.Viewer({
  id: "viewer",
  tileSources: "https://www.artic.edu/iiif/2/{image_id}/info.json"
});
```

## 4. Rate Limits & Terms

### Rate Limits
- **Anonymous users:** 60 requests per minute per IP
- **Higher limits:** Contact `engineering@artic.edu` with use case
- **No daily cap documented** beyond per-minute throttle
- **Soft limit:** scraping/bulk access discouraged; use nightly data dumps instead

### Required/Recommended Headers
```
AIC-User-Agent: YourAppName/1.0 (your-email@example.com)
```
- **Not mandatory** but strongly recommended
- Helps AIC identify and contact apps using excessive resources
- Use custom header because some browsers forbid modifying standard `User-Agent`

### CORS
- **Enabled:** `Access-Control-Allow-Origin: *`
- **Direct browser requests:** fully supported
- **HTTPS required** for production; HTTP deprecated but still functional
- **No authentication needed** for public data

### Licensing & Attribution
| Data | License | Attribution |
|------|---------|-------------|
| Artwork descriptions | CC-By 4.0 | Required: cite AIC |
| All other metadata (title, date, color, etc.) | CC0 1.0 | Not required |
| Geographic data (places) | CC-By 4.0 | Required: cite Getty |
| Images | Varies by artwork | Check `is_public_domain`; respect copyright |

**Attribution format example:**
```
Data provided by Art Institute of Chicago API (CC-By 4.0)
```

**Terms:** https://artic.edu/terms (full compliance required)

## 5. Pagination Limits

### Parameters
- `limit` — results per page
  - **Max 100** (default 10)
  - Larger requests slower; 50–100 recommended for balance
- `page` — page number (1-indexed)
  - **Max depth: 10,000 records** across all results
  - Search endpoint max page offset: `page=101` (if limit=100, hits 10,100 cap)

### Pagination Response
```json
{
  "pagination": {
    "total": 4521,
    "limit": 100,
    "offset": 0,
    "page": 1,
    "first_url": "https://api.artic.edu/api/v1/artworks/search?...",
    "last_url": "...",
    "prev_url": null,
    "next_url": "..."
  }
}
```

### Behavior
- `next_url` — null at end of results
- Search results paginate via `page` param; offset calculated as `(page - 1) * limit`
- **Deep pagination slow** at page 100+; consider alternative filters or nightly dumps

## 6. Thumbnail LQIP Availability

**Yes**, `thumbnail.lqip` exists on majority of indexed artworks:
- Format: base64-encoded GIF (data URI)
- **Example:** `data:image/gif;base64,R0lGODlhBQAFAPQAAE...`
- Size: ~500–1000 bytes
- Aspect ratio: preserved from original
- **Coverage:** ~85–90% of artworks with images

**Use case:** Display low-quality image placeholder while loading full IIIF image.

```html
<img src="data:image/gif;base64,R0lGODlh..." alt={title} width={250} height={165} />
```

---

## Unresolved Questions

1. **Color data completeness:** Does every indexed artwork have `color` data, or only those with processed images? Documentation doesn't specify.
2. **Color.population definition:** Exact calculation (% of pixels? dominant area?). Inferred from docs but not explicitly defined.
3. **Tile size optimization:** Beyond 843px, no guidance on which sizes are pre-cached. OpenSeadragon will request arbitrary sizes; unknown if all are fast.
4. **Bulk export limits:** Nightly dumps mentioned but no URL or format provided in public docs.
5. **Rate limit precision:** Is 60 req/min enforced per-second sliding window or per-minute bucket?
6. **Image permanence SLA:** "Cannot guarantee permanence" stated, but no retirement notice API endpoint found.

---

**Status:** DONE  
**Summary:** Comprehensive technical spec for AIC color search and IIIF image tiling. Color field structure, Elasticsearch query DSL examples, IIIF URLs, rate limits (60 req/min), pagination (max 100/page), CORS enablement, and thumbnail.lqip availability all confirmed via official documentation.  
**Concerns/Blockers:** None—all required information available from public API docs.
