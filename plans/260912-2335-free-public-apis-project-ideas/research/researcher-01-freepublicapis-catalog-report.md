# Research Report: freepublicapis.com catalog

**Date:** 2026-09-12 | **Sources:** site HTML, meta-API JSON (651 entries), 24 tag pages, 1 web search
**Raw data:** `apis-merged.json` (session scratchpad) - catalog joined with tag membership

## Executive Summary

freepublicapis.com = curated directory of free public APIs, run for students of FHGR (Grisons, CH). Every listed endpoint probed once per 24h; health score 0-100 derived from latency, error rate, reliability. Dead APIs sink and get purged. Site exposes its own JSON meta-API (no key, 1000 req/day, CORS on), so the catalog is fully scriptable.

Snapshot today: 651 entries, 509 with health >= 80, 51 at 100, 87 dead (health <= 25). Heavy long tail of toy quote/joke APIs and single-author "reverse-engineered" wrappers (l0v3m0n3y, abhi-api). Real signal sits in ~60 APIs: Open-Meteo family, USGS, NASA/JPL, Met Museum, Art Institute Chicago, MusicBrainz, HackerNews, PokeAPI, Scryfall, OpenF1, Launch Library 2, CelesTrak/TLE, Carbon Intensity UK, Energy-Charts, CityBikes, Swiss transport, Nominatim, REST Countries, Pollinations AI (free text+image gen, no key).

Key constraint for project design: almost everything is keyless GET, so static frontend + edge cache is enough. Rate limits are per-IP and low (1 req/s typical). Client-side fan-out is fine for demos; proxy + cache needed for anything public.

## Site Facts

| Item | Value |
|---|---|
| Listed APIs (homepage claim / JSON actual) | 676 / 651 |
| Categories | 24 real tags + meta tags (best, fastest, reliable, noerror, popular, new, dead, favorites, showcase) |
| Health formula | latency + error rate + reliability, tested daily |
| Meta-API | `GET https://www.freepublicapis.com/api/apis?limit=1000&sort=best`, `/api/apis/{id}`, `/api/random` |
| Meta-API pagination | `limit` works up to full set; `page` / `offset` / `skip` ignored |
| Meta-API fields | id, emoji, title, description, documentation, methods, health, popularity, avg_reliability, avg_error, avg_latency, source |
| Missing from JSON | tags/category, auth type, rate limit, CORS flag. Must scrape tag pages or read provider docs |
| Data quality issues | duplicates (AcousticBrainz x2, UV Index x2, Weather Data API x3); bogus popularity outliers (Kimi Quotes = 10,000,003,197); 66 healthy entries untagged; `health` can be null |

Category sizes (alive, health >= 80): public-data 151, development ~140, entertainment 93, geodata 56, work 49, gaming 37, science 34, finance 32, switzerland 28, weather 24, art 21, food 20, environment 19, music 19, sport 19, transportation 19, health 17, language 17, animals 15, travel 14, ai 13, nature 11, spiritual 10, reverse-engineered 9.

Note: tag pages inject 3-4 "featured" cards on every page (Pollinations AI, Abhi API, Joke Delivery API). They pollute per-tag lists.

## Notable APIs, grouped by what they enable

Health/latency from today's probe. Auth/limits from provider docs; verify before shipping.

### Weather / Earth / Environment (strongest cluster)
| API | Health | Lat | Auth | Limit | Why it matters |
|---|---|---|---|---|---|
| Open-Meteo forecast | 94 | 132ms | none | 10k/day non-commercial | hourly/daily, 80+ vars, historical back to 1940, global |
| Open-Meteo Air Quality | 95 | 104ms | none | same | PM2.5, pollen, AQI, 11km grid |
| Open-Meteo Flood | 100 | 89ms | none | same | river discharge 1984 to +7 months |
| 7Timer | 95 | 128ms | none | fair use | astro-seeing forecast (cloud, transparency). Unique |
| currentuvindex.com | 95 | 311ms | none | fair use | UV now + 5d hourly |
| sunrise-sunset.org | 95 | 242ms | none | fair use | golden hour, civil/nautical/astro twilight |
| USGS Earthquake FDSN | 95 | 391ms | none | none stated | GeoJSON, realtime feed, query by bbox/mag/time |
| Carbon Intensity UK (National Grid) | 90 | 543ms | none | none | live gCO2/kWh, 48h forecast, 14 regions, generation mix |
| Energy-Charts (Fraunhofer ISE) | 92 | 128ms | none | fair use | EU generation / price / CO2 per country, 15-min |
| Elering dashboard | 94 | 235ms | none | fair use | Baltic power/gas, Nord Pool price |
| openSenseMap | 80 | 680ms | none | fair use | citizen IoT sensors worldwide, geo-queryable |
| Water Quality Archive (EA UK) | 100 | - | none | fair use | sampling points + measurements |
| Website Carbon | 100 | - | none | fair use | CO2 per page view for any URL |
| Open-Elevation / Open Topo Data / elevation-api.eu | 92-95 | 112-230ms | none | ~1 req/s | elevation profiles |

### Space
| API | Health | Auth | Limit | Notes |
|---|---|---|---|---|
| NASA Open APIs (APOD, EPIC, NeoWs, Mars photos) | 85 | key | DEMO_KEY 30/h 50/d; free key 1000/h | slow (1.4s) |
| Launch Library 2 (TheSpaceDevs) | 94 | none | 15 req/h unauth | upcoming launches, pads, agencies, images |
| tle.ivanstanojevic.me | 89 | none | fair use | TLE by NORAD id, search |
| CelesTrak GP | 82 | none | cache >= 2h expected | full catalog TLE/OMM, JSON |
| JPL SBDB Close Approach | 90 | none | fair use | asteroid flybys, dates, distances |
| Nebulum Mars Rovers | 90 | none | unknown | latest Perseverance/Curiosity images |

### Culture / Art / Music
| API | Health | Auth | Limit | Notes |
|---|---|---|---|---|
| Met Museum Collection | 95 | none | 80 req/s | 470k objects, public-domain hi-res images |
| Art Institute of Chicago | 95 | none | fair use | IIIF image server, full-text search, dominant color per artwork |
| MusicBrainz | 95 | none | 1 req/s + User-Agent | canonical music metadata; pair with Cover Art Archive |
| TheAudioDB | 95 | test key "1" | limited | artist images, bios |
| Openwhyd | 92 | none | fair use | curated playlists |
| Datamuse | 95 | none | 100k/day | rhymes, related words, sounds-like |
| Free Dictionary API | 90 | none | fair use | Wiktionary definitions, phonetics, audio |
| The Color API | 95 | none | fair use | color names, schemes, conversions |

### Sport / Live data
| API | Health | Auth | Limit | Notes |
|---|---|---|---|---|
| OpenF1 | 87 | none for historical; live tier moved to account/paid in 2025 (verify) | fair use | 3.7Hz car telemetry, positions, radio, weather |
| TheSportsDB | 95 | test key "3" | limited | teams, events, badges |
| football-data.org | 90 | free key | 10 req/min | fixtures, standings, 12 competitions |
| NHL API (unofficial) | 92 | none | unknown | live game feeds |
| 5Dollar Football | 95 | unknown | unknown | brand new, popularity 0, unproven |

### Gaming / Fandom (polished, image-rich datasets)
PokeAPI (95, sprites, no key, cache please), Scryfall (90, 10 req/s, card images + prices), D&D 5e SRD (90), Valorant-API (95, all assets), Digimon, Dragon Ball, One Piece (slow 1.1s), Harry Potter, SWAPI, STAPI, Disney, Amiibo, Yu-Gi-Oh (ygoprodeck), GamerPower free games (95), FreeToGame (95), CheapShark deals (90), Open Trivia DB (95).

### Geo / Transport
Nominatim (95, 1 req/s, User-Agent required, no bulk), REST Countries (95), Zippopotam (100), Postcodes.io UK (95), Brasil API (95), Nager.Date holidays 100+ countries (95), CityBikes (95, worldwide bike-share stations live), transport.opendata.ch (90, Swiss stationboard/connections), iRail BE, MBTA v3, Lisbon Metro, Autobahn.de, Railway Station Photos (95), ip-api.com (100, 18ms, 45 req/min, HTTP only on free tier), ipapi.is (95).

### Food
TheMealDB / TheCocktailDB (95, key "1"), OpenFoodFacts (95, User-Agent required, ~100 req/min), Open Brewery DB (95), Fruityvice (95), UK Food Hygiene (90), PunkAPI mirror (95).

### Finance
World Bank Indicators (92, no key, huge), ExchangeRate-API open endpoint (100, no key, daily), UniRate (100), Coinpaprika (95, 20k/month), financialdata.net (90), Yahoo via yfinance (library scraping, fragile), Federal Register (100), 2026 Tax Figures (95).

### Dev / Utility
HackerNews Firebase (95, no key, no limit), JSONPlaceholder, randomuser.me, picsum.photos, Fake Store, GitHub REST (60/h unauth), Microlink (100, 50/day, screenshots + metadata), html2pdf.fly.dev, Imgflip meme (needs account for caption), PurgoMalum profanity filter, useragentlookup, InternetDB Shodan (95, open ports by IP).

### AI (only one real one)
Pollinations AI (95, 169ms): `https://image.pollinations.ai/prompt/{text}` and `https://text.pollinations.ai/{prompt}`. No key, free image + text generation, OpenAI-compatible chat endpoint. Big enabler for generative flourishes. Anonymous tier throttled (roughly 1 req per several seconds per IP); verify current policy.

## Constraints and Gotchas

- **Keyless != unlimited.** Typical 1 req/s per IP. Browser fan-out from many users gets banned. Ship a tiny proxy with cache (Cloudflare Worker / Vercel edge) for anything public.
- **User-Agent mandatory** on Nominatim, MusicBrainz, OpenFoodFacts, Scryfall. Browsers cannot set UA header, so proxy required for those.
- **CORS not guaranteed.** Open-Meteo, USGS, PokeAPI, Met, ARTIC, HN, Carbon Intensity, Launch Library, TLE API: CORS ok. Many small ones: no. Test each.
- **HTTP-only:** ip-api.com free tier. Mixed content blocks it on HTTPS sites.
- **Non-commercial clauses:** Open-Meteo free tier, TheSportsDB/MealDB test keys, Scryfall (no paywalling card data).
- **Latency spread:** 18ms (ip-api) to 2.4s (HK gov). Anything > 800ms needs skeleton UI or prefetch.
- **Volatility:** 87 of 651 dead today. Hobby APIs on Render/Vercel free tiers cold-start or vanish. Prefer institution-backed sources (USGS, NASA, National Grid, Fraunhofer, Met, ARTIC, MusicBrainz, OSM).
- **Catalog noise:** duplicates, bogus popularity, featured-card pollution. Do not rank by `popularity`; use health + latency + provenance.

## Recommendations for project selection

1. Pick from the institution-backed set. Survival odds high.
2. Favor APIs returning images, geo (lat/lon, GeoJSON) or time series. That is what makes UI beautiful: maps, globes, charts, galleries.
3. Combine 2-4 APIs into one narrative rather than 1 API = 1 widget.
4. Cache at edge; budget under 1 req/s upstream per API.
5. Use Pollinations for generative flourish (captions, art) without paying for LLM keys.

## Unresolved questions

- OpenF1 live-data pricing changed in 2025. Historical still free? Confirm before building anything live-F1.
- Pollinations anonymous rate limit; do they now require referrer or registration?
- CORS status untested for: Energy-Charts, Elering, CityBikes, currentuvindex, 7Timer.
- 5Dollar Football API legitimacy.

## Sources

- https://www.freepublicapis.com/ , /about , /api , /tags/best , /tags/{category}
- https://www.freepublicapis.com/api/apis?limit=1000 (raw JSON)
- Provider docs linked per API above
