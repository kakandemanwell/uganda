# uganda-locale-web

A Next.js app that serves the [`uganda-locale`](../README.md) dataset as a
JSON API, plus an interactive demo UI: a live district map (d3-geo choropleth,
toggle between population/region coloring), Cmd/Ctrl+K search, and a
region → sub-region → district → county → subcounty → parish drill-down
explorer. Built with [shadcn/ui](https://ui.shadcn.com) (Base UI primitives)
and Tailwind v4, dark mode by default. Depends on the `uganda-locale` package
in the parent directory via `file:..` — no publish required to develop this
locally.

## Develop

```bash
npm install
npm run dev
```

Then open `http://localhost:3002` (pinned away from 3000, which is blocked/in use by another local service).

## Routes

| Route | Description |
|---|---|
| `GET /api/regions` | All 4 administrative regions |
| `GET /api/subregions` | All 17 cultural/traditional sub-regions (Buganda, Acholi, Ankole, ...) |
| `GET /api/districts` | All 136 districts (`?regionId=` or `?subregionId=` to filter), each with a `population` field (2024 census) |
| `GET /api/cities` | All 10 cities, each with a `population` field (2024 census) |
| `GET /api/districts/:id/counties` | Counties/municipalities under a district |
| `GET /api/counties/:id/subcounties` | Subcounties/town councils/divisions under a county |
| `GET /api/subcounties/:id/parishes` | Parishes/wards under a subcounty (parish/ward data, opt-in at the library level) |
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
request.

## Deploy

Not yet deployed. `vercel deploy` creates a public URL under the project
owner's Vercel account — holding until explicitly requested, same caution
applied to the original GitHub push. See
[`../docs/ROADMAP.md`](../docs/ROADMAP.md) Phase 4.

Village-level data isn't available through this API yet (the underlying
package doesn't bundle it — see the root README's "Using the data"
section); it's on the roadmap alongside the zone/polling-station layer.
