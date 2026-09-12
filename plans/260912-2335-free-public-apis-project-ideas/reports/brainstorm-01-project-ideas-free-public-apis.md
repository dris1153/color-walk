# Brainstorm: what to build on freepublicapis.com's free APIs

**Date:** 2026-09-12
**Input:** [researcher-01-freepublicapis-catalog-report.md](../research/researcher-01-freepublicapis-catalog-report.md)
**Goal:** one project that is genuinely cool and visually beautiful, buildable on keyless free APIs, not a toy dashboard.

## Problem statement

651 APIs, ~60 worth using. Most "free API projects" (weather app, pokedex, recipe finder, crypto ticker, quote generator) are done ten thousand times and look like tutorials. Beauty comes from three data shapes: **geo** (maps/globes), **time series** (motion, rings, rivers of data), **images** (galleries, deep zoom). Coolness comes from **combining 3-5 sources into one story** the user did not know they wanted.

## Selection criteria

| Criterion | Weight | Why |
|---|---|---|
| Visual ceiling | high | user asked for beautiful |
| Uniqueness | high | must not be "another X" |
| API durability | high | institution-backed only; 13% of catalog is dead |
| Scope for MVP | medium | must ship in weeks, solo |
| Personal utility | medium | keeps the builder using it after launch |

## Rejected up front

Weather app, Pokedex, recipe finder, cocktail finder, crypto/forex dashboard, joke/quote wall, country explorer, generic "API playground". All saturated, all single-source, all look like Tailwind templates. Also rejected: anything on OpenF1 live (paid now) or football-data.org (10 req/min kills multi-user).

## Candidates

### 1. Sky Tonight - personal stargazing companion
**Story:** "Is tonight worth going outside?" One screen answers it.
**APIs:** 7Timer astro (cloud cover, seeing, transparency, 3-day at 3h steps), sunrise-sunset.org (civil/nautical/astro twilight), Open-Meteo (humidity, wind, temp per hour), TLE API or CelesTrak + satellite.js in-browser (ISS and bright satellite passes computed locally), JPL SBDB close-approach (asteroid flybys this week), Launch Library 2 (launches in next 7 days), NASA APOD (hero image, free key). Moon phase and altitude via suncalc, no API.
**Hero visual:** a 24h ring from dusk to dawn. Twilight bands shade the ring, cloud/seeing forecast paints it, ISS passes are arcs on top, moon rise/set marks the rim. Second view: horizon compass showing where satellites and planets rise. Dark-mode by nature; stars animate subtly.
**Why cool:** 7Timer astro forecast is a hidden gem nobody wraps. Local orbit propagation feels magical (no backend). Combines seven sources into one honest answer.
**Effort:** M. Core ring + passes in 2-3 weeks.
**Risks:** 7Timer is hobby-run (15+ years alive, still hobby). Launch Library 15 req/h unauth means server cache mandatory. Moon/planet math done locally, so correctness must be tested against a known ephemeris.
**Uniqueness:** high. **Visual ceiling:** very high. **Durability:** good.

### 2. Grid Pulse - live electricity map, UK + EU
**Story:** "How dirty is the electron you are using right now, and when should you plug in?"
**APIs:** Carbon Intensity UK (national + 14 regions, 30-min, 48h forecast, generation mix), Energy-Charts / Fraunhofer (per-country generation, price, CO2 for ~30 EU countries, 15-min), Elering (Nord Pool prices), Open-Meteo (wind/solar irradiance to explain the curve).
**Hero visual:** choropleth of Europe breathing green-to-brown over the day; particle flows for interconnectors; a 48h "carbon tide" chart with a "cheapest cleanest 2h window" pill for EV charging, laundry, compute jobs.
**Why cool:** real, useful, technical. Data is 15-min granular, so the map visibly moves.
**Effort:** M-L. Cartography and country boundary handling eat time.
**Risks:** electricitymaps.com already does this at a very high polish. Differentiation must be the personal "when to consume" angle plus API-free (no key) reproducibility. Energy-Charts CORS untested.
**Uniqueness:** medium. **Visual ceiling:** high. **Durability:** excellent.

### 3. Color Walk - museum explorer by hue
**Story:** pick a color, walk through 500k artworks that share it.
**APIs:** Art Institute of Chicago (search by dominant color h/s/l, IIIF deep-zoom tiles), Met Museum (470k objects, public-domain hi-res), The Color API (names and schemes), Datamuse (poetic word associations for the color), Pollinations text (two-line caption per artwork) and Pollinations image ("this painting reimagined at night", optional flourish).
**Hero visual:** a hue wheel; drag it and an infinite masonry re-sorts by color distance. Tap an artwork to open OpenSeadragon deep zoom on IIIF tiles. "Time of day" mode picks the palette from the local sky color (sunrise-sunset + Open-Meteo cloud cover).
**Why cool:** deep zoom on masterpieces is jaw-dropping and free. Color-sorted browsing is a genuinely different way to see a museum.
**Effort:** S-M. Fastest path to something gorgeous.
**Risks:** Pollinations anonymous throttle; keep it optional. Met API has no color field, so either ARTIC-only for color or compute palette client-side from thumbnails (canvas, cheap).
**Uniqueness:** medium-high. **Visual ceiling:** very high. **Durability:** excellent.

### 4. Earth Pulse - live 3D globe of what is happening now
**Story:** "The planet, last 24 hours."
**APIs:** USGS earthquakes (GeoJSON, minute-fresh), Open-Meteo flood (discharge anomalies), Open-Meteo air quality (PM2.5 grid samples), CelesTrak (satellites overhead), Launch Library (pads with countdowns), day/night terminator computed locally.
**Hero visual:** globe.gl or deck.gl globe; earthquakes as expanding rings scaled by magnitude; satellites as drifting dots; a time scrubber replaying the last 7 days.
**Why cool:** maximum wow.
**Effort:** L. Globes look easy and are not; performance and layer UX take weeks.
**Risks:** many globes exist; scope creep is guaranteed; air-quality is grid data, not points, so needs sampling strategy.
**Uniqueness:** medium. **Visual ceiling:** highest. **Durability:** good.

### 5. Paddock Replay - F1 telemetry replays
**Story:** replay any 2023-2025 race with live-looking car dots on a self-drawn track.
**APIs:** OpenF1 historical only (positions 3.7Hz, laps, pit, team radio, weather).
**Hero visual:** track outline derived from position data, 20 cars moving, speed traces, radio pops.
**Why cool:** looks like broadcast graphics.
**Effort:** M. **Risks:** live tier paid, so no "now"; audience narrow; single API dependency.
**Uniqueness:** medium. **Visual ceiling:** high. **Durability:** medium.

## Comparison

| | Sky Tonight | Grid Pulse | Color Walk | Earth Pulse | Paddock Replay |
|---|---|---|---|---|---|
| Visual ceiling | 5 | 4 | 5 | 5 | 4 |
| Uniqueness | 5 | 3 | 4 | 3 | 3 |
| Durability | 4 | 5 | 5 | 4 | 3 |
| MVP effort | M | M-L | S-M | L | M |
| Personal utility | 4 | 4 | 2 | 2 | 2 |
| Sources combined | 7 | 4 | 5 | 5 | 1 |

## Recommendation

**Build Sky Tonight.** Highest combined score, clearest story, one-screen product, dark aesthetic that flatters even simple SVG, and real reasons to reopen it. Nobody wraps 7Timer astro; local orbit propagation is a party trick that costs zero backend.

**Runner-up: Color Walk** if the priority is "gorgeous in a weekend". It is the cheapest route to something that looks expensive.

Earth Pulse is the trap: biggest wow in a screenshot, biggest chance of never shipping.

## Sky Tonight - proposed shape (not a plan yet)

- **Stack:** Astro or Next.js, React, Tailwind, D3 for the ring, satellite.js and suncalc client-side, later optional three.js star dome.
- **Backend:** one edge function (Cloudflare Worker or Vercel) that proxies and caches 7Timer, Launch Library, JPL, NASA with TTLs from 30 min to 6 h. Everything else fetched from the browser.
- **MVP (v0.1):** location via browser geolocation or Nominatim search (through proxy for User-Agent), tonight ring (twilight + cloud + seeing + moon), ISS passes above 10 degrees, "this week" cards (launches, asteroid flybys), APOD background.
- **v0.2:** horizon compass, bright-satellite catalog (Starlink trains, Tiangong), share card image, PWA.
- **Success metrics:** first meaningful paint under 2 s on 4G; ring correct against timeanddate.com for 3 test cities; ISS pass times within 1 min of heavens-above.
- **Ponytail notes:** no auth, no database, no user accounts. Location stored in localStorage. One check: a `test_passes.py` or Vitest file asserting a known ISS pass for a fixed TLE and location.

## Risks to validate before planning

1. 7Timer astro endpoint CORS and uptime over a week of polling.
2. Launch Library unauth quota (15/h) vs cache TTL; confirm no key is needed for the cached path.
3. suncalc moon accuracy is fine for phase and rise/set; planets need a small VSOP or astronomy-engine library if included.

## Next steps

- Pick one: Sky Tonight (recommended), Color Walk (fast beauty), Grid Pulse (useful), Earth Pulse (only if time is unlimited).
- Then run `/ck:plan` with the chosen section as context.
