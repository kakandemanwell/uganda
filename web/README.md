# uganda-locale-web

A Next.js app that serves the [`uganda-locale`](../README.md) dataset as a
JSON API, plus a full interactive site: a live district map (d3-geo
choropleth, toggle between population/region coloring), a zoomable/
pannable drill-down map (district → county → subcounty → parish → village,
with roads), Cmd/Ctrl+K search, a filterable/paginated data browser with
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
full restart.

Then open `http://localhost:3002` (pinned away from 3000, which is blocked/in use by another local service).

## Pages

| Route | Description |
|---|---|
| `/` | Landing page — hero, stats, the population/region choropleth, hierarchy explorer, boundary coverage, country info (flag/coat of arms/colors), API reference |
| `/explore` | Every level of the hierarchy, filterable (region/sub-region/district/search) and paginated, with CSV/JSON export of the current filter (`?level=` to deep-link a specific level) |
| `/map` | Zoomable/pannable map — click a district to zoom in and drill through county → subcounty → parish → village (with a roads overlay); subcounties/parishes without boundary data show as a plain list rather than being silently omitted (`?focus=<unit id>` to deep-link a district) |
| `/unit/[id]` | A single unit's full detail — ancestors, population (if applicable), and direct children |
| `/data` | Static file downloads — every per-level JSON/CSV export and boundary GeoJSON, with live file sizes |

## API Routes

| Route | Description |
|---|---|
| `GET /api/regions` | All 4 administrative regions |
| `GET /api/subregions` | All 17 cultural/traditional sub-regions (Buganda, Acholi, Ankole, ...) |
| `GET /api/districts` | All 136 districts (`?regionId=` or `?subregionId=` to filter), each with a `population` field (2024 census) |
| `GET /api/cities` | All 10 cities, each with a `population` field (2024 census) |
| `GET /api/districts/:id/counties` | Counties/municipalities under a district |
| `GET /api/counties/:id/subcounties` | Subcounties/town councils/divisions under a county |
| `GET /api/subcounties/:id/parishes` | Parishes/wards under a subcounty (parish/ward data, opt-in at the library level) |
| `GET /api/units` | Any single level, filterable + paginated — `?level=region\|subregion\|district\|city\|county\|subcounty\|parish\|village`, plus `&regionId=&subregionId=&districtId=&q=&page=&pageSize=`. Powers `/explore`. Village data is read from `public/data/uganda-locations-full.csv` (see `lib/villages.mjs`) since villages aren't in the npm package at all. |
| `GET /api/units/:id` | A single unit + its ancestor chain + direct children. Not available for villages (no stable ids — see above). |
| `GET /api/units/export` | Same filters as `/api/units`, unpaginated, as a CSV or JSON download (`&format=csv\|json`) |
| `GET /api/search?q=...` | Name/alias search (`&level=`, `&limit=`) |
| `GET /api/country` | Uganda country metadata — ISO codes, currency, flag/coat-of-arms paths, etc. |
| `GET /api/geo/districts` | GeoJSON FeatureCollection of all 136 district boundary polygons |
| `GET /api/geo/regions` | GeoJSON FeatureCollection of all 4 region boundary polygons |
| `GET /api/geo/subcounties` | GeoJSON FeatureCollection of subcounty/town_council/division boundaries (1,249/2,191, 57.0% coverage — partial by design) |
| `GET /api/geo/parishes` | GeoJSON FeatureCollection of parish/ward boundaries (423/10,717, 3.95% coverage — partial by design) |
| `GET /api/geo/roads` | GeoJSON FeatureCollection of the major road network (10,721 features, motorway-tertiary; not tied to any admin unit) |

`:id` accepts either the full id (`district:mbarara`) or the bare slug
(`mbarara`).

Responses are cached at the edge (`Cache-Control: public, max-age=3600,
s-maxage=86400`) since the data only changes on a new deploy, not per
request — except `/api/units/export`, which sets `Content-Disposition:
attachment` for downloads instead.

## Deploy

Not yet deployed. `vercel deploy` creates a public URL under the project
owner's Vercel account — holding until explicitly requested, same caution
applied to the original GitHub push. See
[`../docs/ROADMAP.md`](../docs/ROADMAP.md) Phase 4.
