# uganda-locale-web

A Next.js app that serves the [`uganda-locale`](../README.md) dataset as a
JSON API, plus a full interactive site: a live district map (d3-geo
choropleth, toggle between population/region coloring), a MapLibre map
explorer (choropleths at region/sub-region/district/county/subcounty/parish
level, a hierarchy view of every level's boundaries, satellite basemap and
3D terrain, click-anywhere "what's here" lookup, unassigned-land and
refugee-settlement overlays, drill-down district → county → subcounty →
parish → village, roads, GeoJSON/CSV/PNG export), Cmd/Ctrl+K
search, a filterable/paginated data browser with
CSV/JSON export, per-unit detail pages, and a static-file download page.
Built with [shadcn/ui](https://ui.shadcn.com) (Base UI primitives) and
Tailwind v4, dark mode by default. Depends on the `uganda-locale` package in
the parent directory via `file:..` — no publish required to develop this
locally.

## Develop

```bash
npm install
npm run dev
```

`predev`/`prebuild` automatically run `scripts/sync-data.mjs`, which copies
the small/medium `dist/` outputs into `public/data/` (so they're both
directly downloadable and readable by the village-CSV API route — see
`lib/villages.mjs`). Re-run `npm run sync-data` manually if you rebuild the
root package's `dist/` mid-session and want the copy refreshed without a
full restart. The same script copies MapLibre's web worker into
`public/vendor/maplibre/<version>/` — MapLibre 6 runs its worker as an ES
module that can't be resolved from inside a webpack bundle, so the map
points MapLibre at that static copy instead.

Then open `http://localhost:3002` (pinned away from 3000, which is blocked/in use by another local service).

Optional: set `ESRI_API_KEY` in `web/.env.local` (untracked) or in the
deployment's environment to serve the map's satellite basemap from the
ArcGIS Location Platform basemap service. Without it, the tile proxy falls
back to Esri's public World Imagery tile endpoint. The key is only ever
read server-side — see [The map](#the-map).

`npm test` runs `scripts/api-smoke-test.mjs` against the API routes (60
tests, including the sub-region and settlement layers and a `/api/geo/at`
lookup that resolves a central-Kampala point down to its parish and
cells).

## Pages

| Route | Description |
|---|---|
| `/` | Landing page — hero, stats, the population/region choropleth, hierarchy explorer, boundary coverage, country info (flag/coat of arms/colors), API reference |
| `/explore` | Every level of the hierarchy, filterable (region/sub-region/district/search) and paginated, with CSV/JSON export of the current filter (`?level=` to deep-link a specific level) |
| `/map` | MapLibre map explorer — see [The map](#the-map) below. All state is in the URL: `?level=&metric=&layers=&focus=<unit id>&at=lon,lat,zoom&base=satellite&op=0..100&mode=hierarchy&terrain=1` |
| `/unit/[id]` | A single unit's full detail — ancestors, population (if applicable), and direct children |
| `/data` | Static file downloads — every per-level JSON/CSV export and boundary GeoJSON, with live file sizes |

## The map

`/map` is [MapLibre GL JS](https://maplibre.org) 6.12.0 (pinned) on an
[OpenFreeMap](https://openfreemap.org) vector basemap (positron in light
mode, dark in dark mode). OpenFreeMap needs no API key and allows commercial
use; CARTO's free basemap tier doesn't. It replaced a d3-geo SVG map that
re-rendered every path through React on each zoom.

- **Choropleth** of any of 6 levels — region, sub-region, district,
  county, subcounty, parish — by population (2024; district figures
  include the city carved out of each district, since the city sits inside
  the district polygon; county and subcounty figures are UBOS's
  per-subcounty census counts, a county marked partial when one of its
  subcounties has no figure), people/km², subcounties, parishes, villages,
  villages/km², land area, subcounty map coverage, or — at subcounty level
  — **boundary agreement** (IoU with UBOS's own NPHC 2024 polygon for the
  unit; see `data/qa/boundary-agreement.csv`). The parish level offers
  villages, villages/km² and land area. Quantile classes on a single-hue
  sequential ramp with separate light/dark steps; the legend keeps "no
  data" and "unshaded: no boundary polygon" entries, because a few units
  still have no polygon and a missing polygon shouldn't read as a low
  value. Boundaries are processed UBOS data, built bottom-up — see
  [`docs/DATA_QUALITY.md`](../docs/DATA_QUALITY.md).
- **Display modes — Data / Hierarchy.** Data is the choropleth. Hierarchy
  draws every level's boundaries in its own colour — region orange,
  sub-region aqua, district yellow, county magenta, subcounty green,
  parish violet (slots 2–7 of the dataviz reference categorical palette;
  adjacent pairs validated at ΔE ≥ 8.4 under colour-vision deficiency and
  ≥ 19.3 for normal vision, in both light and dark mode; in light mode,
  per-level line weights and a labelled legend carry the contrast the
  colours alone can't) — with only a faint tint of the chosen level, so
  you can read how the levels nest. The same level colours are used for
  overlay lines in Data mode. `?mode=hierarchy`.
- **Basemap switch — Map / Satellite.** Map is OpenFreeMap; Satellite is
  Esri World Imagery, fetched through the app's own tile proxy
  (`GET /api/tiles/esri/{z}/{y}/{x}`) so an API key never reaches the
  browser, with "Powered by Esri" attribution. A **fill-opacity slider**
  (default 20%) lets the basemap show through the choropleth; the fill
  fades out on the way in (gone by about z15 at parish level, earlier for
  coarser levels), leaving only boundaries over the imagery, and a
  **Colour fill** switch (`fill=0`) removes it altogether. On
  satellite the selection outline is white, since yellow is the district
  level colour. The map zooms to 18.
- **3D terrain** toggle: AWS Terrain Tiles (Mapzen terrarium encoding,
  public, no key) as a terrain mesh (exaggeration 1.4) plus a hillshade
  layer under the data; turning it on tilts the camera to 55°.
  `?terrain=1`.
- **Point of view**: right-drag (or Ctrl+drag) rotates and tilts (pitch up
  to 70°), two fingers on touch; the compass shows the pitch and resets
  it. Map controls sit bottom-right.
- **Overlays**: unassigned land (`gaps.geojson`, hatched; hover explains
  why it's unassigned and lists the candidate units), refugee settlements
  (`settlements.geojson` — outlines only; the land belongs to the host
  subcounties, split between them by inference), parish / subcounty /
  county / district / sub-region / region lines, major roads and names,
  each toggle showing its coverage count. Inferred boundaries (units
  deduced from leftover land under the territorial rule) are drawn
  dashed, with a hover note saying so.
- **Click anywhere** → "This place" in the details panel, from
  `GET /api/geo/at`: the full hierarchy at that point (region, sub-region,
  district/city, county, subcounty, parish) with level colour chips,
  P-codes and UBOS codes, subcounty and district population, parish area,
  inferred flags, the parish's villages, and whether the point is in a
  refugee settlement or unassigned land. The parish is outlined on the
  map with a pin at the point. A click selects the district without
  moving the camera; copy buttons give the coordinates and a text summary.
  Villages have no polygons, so they're listed per parish rather than
  drawn.
- **Right-click** (without dragging) → a context menu: the coordinates in
  decimal and DMS (copy), a place summary, Inspect this place, Centre map
  here, Copy place details, and links to Google Maps, Google Street View,
  Mapillary and OpenStreetMap — street-level imagery lives there, and the
  links need no API key.
- **Hover** shows the value, P-code and UBOS code; the district drill
  panel lists stats, then counties → subcounties → parishes → villages.
  Picking a county, subcounty or parish there outlines just that unit,
  fetched on its own via `/api/geo/export?ids=` — so a click never loads
  the 11 MB parish layer. In-view totals, cursor coordinates, fullscreen,
  and the header search jumps to a district.
- **Frosted-glass panels**: the control panel, details panel, hover card,
  status bar and right-click menu are translucent with a backdrop blur, so
  the map shows through. On desktop the details panel floats over the map
  (no longer a solid sidebar) and both panels still collapse; on phones
  the panels sit below the map.
- **Export** the current view, the selected district, or all of Uganda as
  GeoJSON or CSV (via `/api/geo/export`, with per-scope polygon counts), or
  as a captioned PNG with title, legend and attribution.
- All state is mirrored in the URL
  (`?level=&metric=&layers=&focus=&at=&base=satellite&op=0..100&mode=hierarchy&terrain=1`),
  so any view can be shared.

Satellite imagery is display-only: tiles are cached by the browser (7 days)
and the CDN (30 days) but never copied into `public/` or `dist/`, so the
CC BY dataset carries no Esri pixels. The proxy only accepts integer tile
coordinates inside the tile grid, with z ≤ 19 — it fetches from a fixed
upstream and isn't an open relay. Terrain tiles aren't proxied: the
browser fetches them straight from AWS's public bucket, and nothing from
them is stored either.

## API Routes

| Route | Description |
|---|---|
| `GET /api/regions` | All 4 administrative regions |
| `GET /api/subregions` | All 17 cultural/traditional sub-regions (Buganda, Acholi, Ankole, ...) |
| `GET /api/districts` | All 136 districts (`?regionId=` or `?subregionId=` to filter), each with a `population` field (2024 census) |
| `GET /api/cities` | All 10 cities, each with a `population` field (2024 census) |
| `GET /api/districts/:id/counties` | Counties/municipalities under a district (`:id` accepts the bare district slug, e.g. `mbarara`) |
| `GET /api/counties/:id/subcounties` | Subcounties/town councils/divisions under a county (`:id` accepts the bare county slug) |
| `GET /api/subcounties/:id/parishes` | Parishes/wards under a subcounty (parish/ward data, opt-in at the library level; `:id` accepts the bare subcounty slug) |
| `GET /api/units` | Any single level, filterable + paginated — `?level=region\|subregion\|district\|city\|county\|subcounty\|parish\|village`, plus `&regionId=&subregionId=&districtId=&countyId=&subcountyId=&parishId=&q=&page=&pageSize=`. The id filters mean "inside this unit" at every level (a city's parent is its namesake district, so `districtId=district:arua` also takes in Arua City). `&groupBy=` (any parent level above `level`: `region\|subregion\|district\|county\|subcounty\|parish`) sorts results into contiguous groups and adds a `groups` array (`id`, `name`, `type`, `parent`, `total`, `count` on this page, `continued` from the previous page) plus `groupCount`. Every item carries an `ancestry` block (`district`/`county`/`subcounty`/`parish` → `{id, name}`). Powers `/explore`. Village data is read from `public/data/uganda-locations-full.csv` (see `lib/villages.mjs`) since villages aren't in the npm package at all. |
| `GET /api/units/:id` | A single unit + its ancestor chain + direct children, plus (for a parish/ward) a `villages` array of its village rows, joined by `parish_id`. Not available for villages themselves (no stable ids — see above). **Requires the fully-qualified id** (`district:mbarara`), not the bare slug — unlike the three routes above, this one isn't scoped to a known level, and slugs collide across levels for ~13% of units (e.g. `kampala` is both `district:kampala` and `subregion:kampala`), so a bare slug would be ambiguous rather than resolvable. |
| `GET /api/units/export` | Same filters as `/api/units`, unpaginated, as a CSV or JSON download (`&format=csv\|json`) |
| `GET /api/search?q=...` | Name/alias search (`&level=`, `&limit=`). `level` accepts the same values as `/api/units` **except `village`** (village rows aren't indexed for search — see above) |
| `GET /api/country` | Uganda country metadata — ISO codes, currency, flag/coat-of-arms paths, etc. |
| `GET /api/geo/districts` | GeoJSON FeatureCollection of all 136 district boundary polygons (processed UBOS data, land-clipped; each includes any city carved from it) |
| `GET /api/geo/cities` | GeoJSON FeatureCollection of all 10 city boundary polygons |
| `GET /api/geo/regions` | GeoJSON FeatureCollection of all 4 region boundary polygons |
| `GET /api/geo/subregions` | GeoJSON FeatureCollection of all 17 sub-region polygons (dissolved from the districts by `subregion_id`) |
| `GET /api/geo/counties` | GeoJSON FeatureCollection of county/municipality boundaries (322/322), each with `population` summed from its subcounties (`partial: true` when one has no figure) |
| `GET /api/geo/subcounties` | GeoJSON FeatureCollection of subcounty/town_council/division boundaries (2,190/2,191), with 2024 `population` (where UBOS has a figure) and `agreement: { ubos_nphc_iou, hdx_iou }` |
| `GET /api/geo/parishes` | GeoJSON FeatureCollection of parish/ward boundaries (10,634/10,717, ~11 MB) — real UBOS parish polygons; the earlier, retracted "parish" layer (which was subcounty-tier) is gone, see `docs/DATA_QUALITY.md` |
| `GET /api/geo/gaps` | GeoJSON FeatureCollection of unassigned land (23 features, all parish-level): a subcounty's leftover land that 2+ unmapped parishes could be, each with `candidate_ids`/`candidate_names` |
| `GET /api/geo/settlements` | GeoJSON FeatureCollection of the 15 refugee-settlement outlines (UBOS census units, not admin units) — informational; each lists the `host_subcounty_ids` its land was split between |
| `GET /api/geo/at?lon=&lat=` | Everything known about one point: the full hierarchy (region, sub-region, district/city, county, subcounty, parish) with codes, population and area, inferred flags, the parish's villages and polygon, and whether the point is in a refugee settlement or unassigned land. Point-in-polygon on the parish layer first, then up the levels. Powers the map's place panel and right-click menu |
| `GET /api/geo/roads` | GeoJSON FeatureCollection of the major road network (10,721 features, motorway-tertiary; not tied to any admin unit) |
| `GET /api/geo/stats?level=` | Per-polygon map metric values for `region\|subregion\|district\|county\|subcounty\|parish`, keyed by unit id — what the `/map` choropleth colours by |
| `GET /api/geo/export?level=` | Boundary polygons (any of the six levels, incl. `subregion` and `parish`) joined with their map metrics, `hdx_pcode`, `hdx_within_pcode`, `ubos_code`, `subcounty`, `geometry_source` (`ubos` or `inferred`) and centroid. Optional, combinable filters: `&within=<unit id>`, `&bbox=w,s,e,n`, `&ids=a,b,c`. `&format=geojson` (default; includes attribution/licence members) or `&format=csv` (no geometry; adds `centroid_lon`/`centroid_lat`) |
| `GET /api/tiles/esri/{z}/{y}/{x}` | Esri World Imagery tile proxy for the map's satellite basemap (uses `ESRI_API_KEY` when set, else Esri's public tile endpoint). Integer coordinates inside the tile grid only, `z ≤ 19`; cached 7 days in the browser, 30 days at the edge |

Every boundary feature carries `properties.id`, `area_km2` (land area),
`hdx_pcode` (its OCHA COD-AB P-code, where an exact one exists) and
`ubos_code` (where UBOS has the same unit); districts, cities, counties and
subcounties also carry `population`. Inferred units carry `inferred: true` and an `inference`
note; island parishes that keep their full legal outline carry
`includes_water: true`. The boundary layers are processed UBOS data (cite
UBOS), the P-codes CC BY-IGO (OCHA/UBOS) and the roads ODbL — see
[`LICENSE-DATA.md`](../LICENSE-DATA.md).

Responses are cached at the edge for 24h (`CDN-Cache-Control` /
`Vercel-CDN-Cache-Control: public, s-maxage=86400,
stale-while-revalidate=86400`) since the data only changes on a new deploy,
not per request, plus a 1h browser cache (`Cache-Control: public,
max-age=3600`) — separate directives rather than one shared header because
Vercel's CDN strips `s-maxage`/`stale-while-revalidate` from what it echoes
back to the browser, so relying on a single header makes the actual edge TTL
unverifiable from the client side (see `web/lib/respond.mjs`). Applies to
`/api/units/export` too, alongside its `Content-Disposition: attachment`
for downloads. (The Esri tile proxy sets its own, longer cache headers —
see above.)

The map requests its geo and stats URLs with the dataset's build timestamp
appended (`?v=<generated_at>` from `dist/data-quality-report.json`), so a
rebuilt dataset gets new URLs and is never masked by a cached layer from
the previous build, even though each response is cacheable for an hour.

The `/data` page lists every downloadable file, including
`geo/citys.geojson`, `geo/subregions.geojson`, `geo/gaps.geojson`,
`geo/settlements.geojson` and `crosswalk/ubos-2024.csv`.

## Deploy

Live at [uganda-omega.vercel.app](https://uganda-omega.vercel.app), soon to
move to `data.mnwll.tech`.
