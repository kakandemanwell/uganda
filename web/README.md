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
| `GET /api/districts/:id/counties` | Counties/municipalities under a district (`:id` accepts the bare district slug, e.g. `mbarara`) |
| `GET /api/counties/:id/subcounties` | Subcounties/town councils/divisions under a county (`:id` accepts the bare county slug) |
| `GET /api/subcounties/:id/parishes` | Parishes/wards under a subcounty (parish/ward data, opt-in at the library level; `:id` accepts the bare subcounty slug) |
| `GET /api/units` | Any single level, filterable + paginated — `?level=region\|subregion\|district\|city\|county\|subcounty\|parish\|village`, plus `&regionId=&subregionId=&districtId=&q=&page=&pageSize=`. Powers `/explore`. Village data is read from `public/data/uganda-locations-full.csv` (see `lib/villages.mjs`) since villages aren't in the npm package at all. |
| `GET /api/units/:id` | A single unit + its ancestor chain + direct children. Not available for villages (no stable ids — see above). **Requires the fully-qualified id** (`district:mbarara`), not the bare slug — unlike the three routes above, this one isn't scoped to a known level, and slugs collide across levels for ~13% of units (e.g. `kampala` is both `district:kampala` and `subregion:kampala`), so a bare slug would be ambiguous rather than resolvable. |
| `GET /api/units/export` | Same filters as `/api/units`, unpaginated, as a CSV or JSON download (`&format=csv\|json`) |
| `GET /api/search?q=...` | Name/alias search (`&level=`, `&limit=`) |
| `GET /api/country` | Uganda country metadata — ISO codes, currency, flag/coat-of-arms paths, etc. |
| `GET /api/geo/districts` | GeoJSON FeatureCollection of all 136 district boundary polygons |
| `GET /api/geo/regions` | GeoJSON FeatureCollection of all 4 region boundary polygons |
| `GET /api/geo/subcounties` | GeoJSON FeatureCollection of subcounty/town_council/division boundaries (1,249/2,191, 57.0% coverage — partial by design) |
| `GET /api/geo/parishes` | GeoJSON FeatureCollection of parish/ward boundaries (423/10,717, 3.95% coverage — partial by design) |
| `GET /api/geo/roads` | GeoJSON FeatureCollection of the major road network (10,721 features, motorway-tertiary; not tied to any admin unit) |

Responses are cached at the edge for 24h (`CDN-Cache-Control` /
`Vercel-CDN-Cache-Control: public, s-maxage=86400,
stale-while-revalidate=86400`) since the data only changes on a new deploy,
not per request, plus a 1h browser cache (`Cache-Control: public,
max-age=3600`) — separate directives rather than one shared header because
Vercel's CDN strips `s-maxage`/`stale-while-revalidate` from what it echoes
back to the browser, so relying on a single header makes the actual edge TTL
unverifiable from the client side (see `web/lib/respond.mjs`). Applies to
`/api/units/export` too, alongside its `Content-Disposition: attachment`
for downloads.

## Deploy

Live at [uganda-omega.vercel.app](https://uganda-omega.vercel.app), soon to
move to `data.mnwll.tech`.
