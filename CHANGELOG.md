# Changelog

## [0.10.0] - 2026-10-17 — Every boundary level from UBOS, built bottom-up; P-codes; sub-regions and settlements; subcounty population; satellite and 3D map (web 0.4.0)

### Added
- **Territorial rule** (documented in `docs/DATA_QUALITY.md`) as the basis
  of all boundary work: no new land is ever created; a new unit is always
  carved out of existing ones (a new subcounty regroups old parishes, a new
  parish regroups villages); an unmapped area inside a mapped parent *is*
  the missing unit(s).
- **Boundary layers for every level, built bottom-up from UBOS's own
  current polygons** — `scripts/ingest-ubos-boundaries.mjs`, from UBOS's
  NPHC 2024 API (district and subcounty polygons) and Baseline Education
  Census 2025 API (parish polygons), matched onto the EC's July 2022 units.
  Each UBOS parish is matched to an EC parish (10,466 exact, 98 fuzzy);
  every piece of land is given an owning EC subcounty; and each level is the
  union of the one below. Coverage: districts 136/136, cities 10/10,
  regions 4/4, counties **322/322** (0.9.1 had no county layer),
  subcounties **2,190/2,191** (0.9.1: 1,249; only Makerere University,
  which UBOS folds into Kawempe, has none), parishes **10,634/10,717
  (99.2%)**. 215,579 km² of land.
- **Real parish polygons**: `parishs.geojson` / `parishBoundaries()` /
  `/api/geo/parishes` now return UBOS parish polygons.
- **Cities layer**: `data/geo/citys.geojson`, `geo.cityBoundaries()`,
  `GET /api/geo/cities`. Each district polygon includes any city carved
  out of it.
- **Inference and explicit gaps**: 73 parishes and 3 subcounties inferred
  from leftover land (`inferred: true` + `inference` note); land no single
  unit can be given yet goes to `data/geo/gaps.geojson` (23 features,
  ~722 km², all parish-level, listing their candidate parishes) —
  `geo.gaps()`, `GET /api/geo/gaps`.
- **Tessellation cleaning** (`scripts/lib/tessellate.mjs`, step "4b" of
  the UBOS ingest). UBOS's BEC 2025 parish polygons aren't one topology:
  per district they overlap their neighbours by ~0.3–0.4 km² and leave
  ~4 km² of gaps against the district outline in 1,000–1,800 slivers
  (Alebtong: 4.25 km² in ~1,854 parts, ~420 of them 0.01–10 ha — visible
  wedges between parishes). Per district, every parish is clipped to the
  UBOS district (land only), overlaps go to the parish earlier in UBOS-code
  order, gaps < 100 m² are ignored, ≤ 2 ha go to the nearest neighbour,
  2 ha–5 km² are split between the touching parishes by nearest-neighbour
  allocation (triangulated with earcut; a Voronoi version was abandoned
  after it sent polyclip into a 6 GB runaway on one Mityana sliver), and
  anything > 5 km² is published as a gap (`kind: "unassigned_chunk"`)
  instead. Clipping retries once on 6-dp-truncated input and falls back
  rather than crashing (0 fallbacks). Nationally: 53.2 km² of overlaps
  removed, 409.5 km² of gaps filled (43,157 slivers, 5,307 equidistant
  splits), 1 piece fully overlapped, 0 unassigned chunks. Alebtong's gaps
  went from 4.25 km² to 0.067 km², its overlaps from 0.36 km² to
  0.015 km². The full ingest takes ~10 min (run with
  `node --max-old-space-size=6000`); `UBOS_REUSE_CLEAN=1` reuses the last
  run's cleaned pieces (gitignored cache) when iterating on later steps.
- **Refugee settlements split between host subcounties, not gaps.** The
  15 UBOS refugee-settlement census units (Nakivale, Kyangwali, Rwamwanja,
  Kyaka II, Palabek, Rhino Camp, Imvepi, Palorinya, Lobule, Kiryandongo,
  Adjumani's settlements) were 11 subcounty-level gaps; their land is now
  split between the touching host subcounties of the same district by the
  same equidistant method — inferred — and each outline is published as an
  informational layer, `data/geo/settlements.geojson` (`id`
  `settlement:<ubos code>`, `name`, `ubos_code`, `district_id`,
  `host_subcounty_ids`, `note`) — `geo.settlements()`,
  `GET /api/geo/settlements`. Settlement land belongs to the host
  subcounty but to none of its parishes. No subcounty-level gaps remain.
- **Sub-region layer**: `scripts/build-region-boundaries.mjs` also
  dissolves the districts by `subregion_id` → `data/geo/subregions.geojson`
  (17 features) — `geo.subregionBoundaries()`, `GET /api/geo/subregions`.
  `scripts/validate.mjs` expects 17.
- **2024 population below district**: `data/population/ubos-nphc-2024-subcounty.csv`
  (written by the UBOS ingest) — UBOS NPHC 2024 population per UBOS
  subcounty, assigned to the EC subcounty that owns its land (name match,
  or the unit it was carved from); settlement units excluded, UBOS `#N/A`
  values skipped rather than read as 0. 2,180 subcounties, 44,986,031
  people vs 45,905,417 nationally — the ~919k difference is the settlement
  units, counted separately. Approximate where a UBOS subcounty's parishes
  were reorganised across EC units (`method`: `name_match` |
  `includes_carved_units`). `scripts/build.mjs` puts `population` on
  subcounty features and sums it to counties (`partial: true` where a
  county has a subcounty without a figure).
- **Cross-dataset boundary agreement**: `scripts/compare-boundaries.mjs` →
  `data/qa/boundary-agreement.csv` — each published subcounty's IoU with
  UBOS NPHC 2024's polygon for the same UBOS code (`ubos_nphc_iou`) and
  OCHA COD-AB 2020's for the same P-code (`hdx_iou`), over the unit's own
  district land; a clipping failure is blank, never 0. Median 0.991 vs UBOS
  NPHC (2,110 compared), 0.753 vs COD-AB (1,352 — the 2018–20 system, so
  context, not a defect). The review flag uses UBOS NPHC only: 7
  subcounties < 0.8, all refugee-settlement hosts that absorbed settlement
  land (lowest `obongi-palorinya`, 0.546) — expected. `scripts/build.mjs`
  adds `agreement: { ubos_nphc_iou, hdx_iou }` to subcounty features and a
  `boundary_agreement` section to `dist/data-quality-report.json`.
- **UBOS codes**: `external_refs.ubos_code` on 12,820 units (districts,
  cities, subcounty-tier units, parishes) and `ubos_code` on boundary
  features; `data/crosswalk/ubos-2024.csv` (shipped as
  `dist/crosswalk/ubos-2024.csv`, in the npm package).
  `dist/data-quality-report.json` gains a `ubos_2024` section and a
  `gaps` entry under `boundary_coverage`.
- **OCHA P-code crosswalk**: `scripts/ingest-hdx-cod-ab.mjs` →
  `data/crosswalk/hdx-cod-ab-uga.csv` (shipped as
  `dist/crosswalk/hdx-cod-ab-uga.csv`, in the npm package, and downloadable
  from the site). One row per COD-AB unit with a `match` of `exact`,
  `split_from`, `predecessor`, `tier_mismatch`, `no_equivalent`,
  `unmatched` or `rejected_geometry`. Every unit from region to subcounty
  tier gains `external_refs.hdx_pcode` (exact equivalent, 1,608 units) and
  `external_refs.hdx_within_pcode` (most specific containing COD-AB unit,
  all 2,663 eligible units). COD-AB is used for P-codes only; its 2020
  polygons just sanity-check each match against the UBOS districts, which
  withholds 2 P-codes (Bujenje county, Pakanyi subcounty — COD-AB puts them
  in Kiryandongo, UBOS and the EC in Masindi). `scripts/validate.mjs`
  checks P-codes are well-formed, unique, and nest within their parent's
  district code. `dist/data-quality-report.json` gains `boundary_coverage`
  and `hdx_cod_ab` sections.
- New `data/sources.json` entries: `src-ubos-nphc-2024-geo`,
  `src-ubos-bec-2025-geo`, `src-natural-earth-10m-lakes`, and
  `src-mwe-weis-geoserver-not-used` (MWE's WEIS GeoServer — deliberately not
  used: its terms forbid automated access without written permission).
- **Web (0.4.0)**: `/map` rebuilt on MapLibre GL JS 6.12.0 + OpenFreeMap
  vector tiles (no API key), replacing the d3-geo SVG map:
  - choropleth of region/district/county/subcounty/**parish** by
    population, density, unit counts, villages/km², land area or subcounty
    coverage;
  - **satellite basemap** — Esri World Imagery through a server-side tile
    proxy, `GET /api/tiles/esri/{z}/{y}/{x}` (`ESRI_API_KEY` from
    `web/.env.local` or the deployment env when set, for the ArcGIS
    Location Platform basemap service; else Esri's public tile endpoint),
    "Powered by Esri" attribution, tiles cached by browser/CDN (7 days /
    30 days) and never copied into `public/` or `dist/`, coordinates
    validated (integers inside the tile grid, z ≤ 19); a Map/Satellite
    switch and a fill-opacity slider, both kept in the URL (`base=`,
    `op=`); zoom to 18;
  - overlays for unassigned land (hatched, with a hover explaining it and
    listing candidate units) and parish lines; inferred boundaries
    drawn dashed with a hover note; hover card with P-code and UBOS code;
  - both side panels collapsible;
  - district drill panel, where picking a county, subcounty or parish
    outlines just that unit via `/api/geo/export?ids=` (no 11 MB parish
    layer load for a click);
  - URL-synced state (`?level=&metric=&layers=&focus=&at=&base=&op=&mode=&terrain=`);
    export of the view/district/country as GeoJSON, CSV or a captioned PNG;
  - frosted-glass UI (translucent with backdrop blur) for the control
    panel, hover card, status bar, right-click menu and the details panel,
    which now floats over the map on desktop instead of being a solid
    sidebar (still collapsible; phones keep panels below the map); fill
    opacity defaults to 20%; the fill **fades out as you zoom in** (per
    level — e.g. parishes from z12.5 to z15) so imagery and streets show
    through at close range while boundaries stay, and a **Colour fill**
    switch (`fill=0` in the URL) turns it off for boundaries only;
  - **click anywhere** → "This place" in the details panel, from the new
    `GET /api/geo/at?lon=&lat=`: the full hierarchy at the point (region,
    sub-region, district/city, county, subcounty, parish) with level
    colour chips, P-codes, UBOS codes, subcounty and district population,
    parish area, inferred flags, the parish's villages, whether it's in a
    refugee settlement or unassigned land, and the parish polygon
    (outlined, with a pin at the point). Clicking selects the district
    without moving the camera; copy buttons for coordinates and a text
    summary;
  - **right-click** (without dragging) → a context menu with the
    coordinates in decimal and DMS, a place summary, Inspect this place,
    Centre map here, Copy place details, and links to Google Maps, Google
    Street View, Mapillary and OpenStreetMap (street-level imagery, no API
    key needed);
  - rotate and tilt with right-drag or Ctrl+drag (max pitch 70°),
    two-finger on touch; the compass shows pitch and resets; map controls
    moved bottom-right;
  - **3D terrain** toggle — AWS Terrain Tiles (Mapzen terrarium, public, no
    key) as a terrain mesh (exaggeration 1.4) plus a hillshade layer under
    the data; turning it on tilts the camera to 55° (`terrain=1`);
  - **display modes**: Data (choropleth) and Hierarchy — every level's
    boundaries in its own colour (region orange, sub-region aqua, district
    yellow, county magenta, subcounty green, parish violet: slots 2–7 of
    the dataviz reference categorical palette, adjacent pairs validated at
    CVD ΔE ≥ 8.4 and normal-vision ΔE ≥ 19.3 in both modes, with per-level
    line weights and a labelled legend for light-mode contrast) and only a
    faint tint of the chosen level (`mode=hierarchy`); the level colours
    are used for overlay lines in Data mode too, and on satellite the
    selection outline is white;
  - a **Sub-region** level; a **Boundary agreement** metric (subcounty
    level, the UBOS NPHC IoU); population and people/km² at county and
    subcounty level; new overlays for refugee settlements and sub-region
    lines; "Unmapped land" renamed "Unassigned land". Villages still have
    no polygons — they're listed per parish in the place panel.

  New `GET /api/geo/stats` (incl. `level=parish`) and `GET /api/geo/export`
  (polygons joined with metrics, P-codes, `ubos_code`, `subcounty` and
  `geometry_source` (`ubos`/`inferred`), filterable by `within`/`bbox`/
  `ids`, incl. `level=parish`). Geo/stats URLs carry the dataset build
  timestamp (`?v=<generated_at>`) so a rebuilt dataset is never masked by
  a cached layer. `/api/geo/stats` and `/api/geo/export` also take
  `level=subregion`. `/data` lists `citys.geojson`, `subregions.geojson`,
  `gaps.geojson`, `settlements.geojson` and `crosswalk/ubos-2024.csv`; the
  coverage section and API reference show the new numbers. MapLibre's
  worker is served from `public/vendor/maplibre/<version>/` (copied by
  `scripts/sync-data.mjs`). The web API smoke test (`npm test` in `web/`)
  is now 60 tests, adding the sub-region and settlement layers and a
  `/api/geo/at` test that resolves a central-Kampala point down to its
  parish and cells.

### Fixed
- **District polygons were wrong for many districts.** geoBoundaries'
  layer matched all 136 names but only 12 of 135 districts had IoU ≥ 0.9
  with UBOS's own outlines; its Kampala (351 km²) swallowed Kira and
  Kasangati (both Wakiso), and Pader town fell inside Agago. Districts are
  now unions of UBOS parish land; geoBoundaries is used only for its
  coastline.
- **The old parish boundary layer was wrong and is replaced.** The 423
  "parish" polygons shipped since 0.9.0 came from HDX COD-AB's "admin4"
  layer, which is subcounty-tier, not parish-level (it contains Kampala's
  five divisions, `UG10080101`–`05`; COD-AB Uganda stops at ADM4 = 1,520
  subcounties). They were subcounty outlines attached to parishes sharing
  their subcounty's name. Withdrawn (`scripts/ingest-parish-boundaries.mjs`
  deleted), and replaced by the real UBOS parish layer above. The earlier
  claim in `docs/DATA_QUALITY.md` / `data/sources.json` that the layer was
  "confirmed parish-level" is corrected in place, not silently removed.
- Overlaps and sliver gaps between UBOS's own parish polygons (see
  "Tessellation cleaning" above) — previously carried straight into every
  layer, so a zoomed-in map showed wedges of land belonging to no parish.
  The small residual (Alebtong: 0.067 km² of gaps, 0.015 km² of overlaps)
  comes from the topology simplification; a coarser topology grid (1e5)
  was tried and doubled the overlaps, so 1e6 stays — now overridable via
  `TOPO_QUANTIZATION`. One UBOS parish, Lubya (Buvuma), lies entirely
  under its neighbours and loses its polygon to the overlap removal.
- Hairline gaps between neighbouring polygons (from simplifying each
  feature separately), which left ~1,513 slit holes in the dissolved
  regions. All 10,831 UBOS pieces are now simplified as one shared TopoJSON
  topology before any union (`scripts/lib/topo.mjs`), so every layer nests
  exactly inside the one above.
- Lake water no longer inflates areas: UBOS polygons follow legal
  boundaries into the lakes, so water (UBOS outline minus geoBoundaries
  land, intersected with Natural Earth lakes) is clipped out. The lake
  intersection keeps geoBoundaries' wrong western border from eating
  Bundibugyo's Semliki strip and parts of Kasese; a parish clipping would
  erase entirely keeps its legal outline with `includes_water: true` (14
  island parishes).
- Ring winding regressed during the rebuild (`turf.union` output is
  planar-wound; d3-geo then read a polygon as "the globe minus the
  polygon" and the web map framed South America). Every output feature is
  rewound for d3-geo, and `scripts/validate.mjs` now **fails** any
  boundary feature whose exterior ring is counter-clockwise.

### Changed
- **Licence of the boundary layers**: districts/regions were CC0
  (geoBoundaries); every boundary layer is now **processed UBOS data** —
  cite UBOS and keep the "processed" label (UBOS's guidelines). The P-code
  crosswalk and `hdx_*` fields are CC BY-IGO (OCHA/UBOS). geoBoundaries
  (CC0) contributes only the coastline, Natural Earth (public domain) only
  lake extents. See `LICENSE-DATA.md`.
- Every boundary feature in `dist/geo/` now carries `area_km2` (land area),
  `hdx_pcode` and `ubos_code` where they exist; districts, cities,
  counties and subcounties carry `population`; subcounties carry
  `agreement`.
- `dist/uganda-locations-full.csv`: new trailing `hdx_pcode` column (the
  village's subcounty's `hdx_within_pcode`), after `parish_id` so existing
  column positions don't shift.
- `package.json` `files` add `dist/geo/citys.geojson`,
  `dist/geo/countys.geojson`, `dist/geo/gaps.geojson`,
  `dist/geo/subregions.geojson`, `dist/geo/settlements.geojson`,
  `dist/crosswalk/hdx-cod-ab-uga.csv` and `dist/crosswalk/ubos-2024.csv`.
- Boundary pipeline is now `ingest-ubos-boundaries` →
  `build-region-boundaries` → `ingest-hdx-cod-ab` → `compare-boundaries` →
  `build` → `validate`.
  `scripts/ingest-district-boundaries.mjs` and
  `scripts/ingest-subcounty-boundaries.mjs` are deleted (an intermediate
  build that day used COD-AB's 2020 polygons for districts, counties and
  subcounties; it was superseded the same day). New build-time dev
  dependencies: `topojson-server` 3.0.1, `topojson-simplify` 3.0.3,
  `topojson-client` 3.1.0.

## 2026-09-22 — Explore: drill down to a parish, group by parent level

### Added
- **`/explore`**: County → Subcounty → Parish/ward filters cascade under
  District (each clears the ones below it), so villages can be narrowed to
  a single parish and parishes to a single subcounty. Cities are now in the
  District dropdown too. A **Group by** control sorts rows under parent
  headings (villages by parish/subcounty/county/district, parishes by
  subcounty/county/district, etc.), each showing its total across all
  pages. District/subcounty/parish cells link to their unit pages. The
  filtered/grouped view lives in the URL, so it can be shared or
  bookmarked. Search is debounced.
- **`/unit/[id]`** for a parish/ward lists its villages (cells link to their
  own pages) with a CSV download; subcounty pages show a village count next
  to each parish; every unit links to `/explore` pre-filtered to it.
- **API**: `/api/units` and `/api/units/export` accept `countyId`,
  `subcountyId`, `parishId`; `/api/units` accepts `groupBy` and adds an
  `ancestry` block to every item; `/api/units/:id` returns `villages` for a
  parish/ward. Export CSVs gain `parent_id` (units) / `parish_id` (villages).
- **`dist/uganda-locations-full.csv`**: new trailing `parish_id` column.
  Names alone can't identify a parish — Lira West Division has two wards
  both named "Teso", with adjacent villages — so joining village rows back
  to `parishs.json`/`wards.json` needs the id. Existing columns keep their
  positions. File grows from ~7.4MB to ~9.9MB.

### Fixed
- The village CSV reader split quoted fields on their inner commas
  (`"Nkongoro (Ranches 13, 14,"`), shifting later columns on those rows.
- `/explore` sent filters the current tab doesn't show (e.g. a district
  picked on Villages silently emptied the Regions tab).
- Unit pages said "Parishs"/"Subcountys" in the child-unit list.

## 2026-08-01 — `uganda-locale` published to npm

`uganda-locale@0.9.1` is live on the npm registry:
<https://www.npmjs.com/package/uganda-locale>. Install with
`npm install uganda-locale`. Installing from GitHub
(`npm install github:kakandemanwell/uganda`) still works and now means
"track unreleased master" rather than "the only way to install". README,
`docs/ROADMAP.md`, the site hero, and `/llms.txt` updated accordingly.

## 2026-07-22 (web app only — no root package version change)

### Added
- **Branding**: the flag (`web/public/country/flag.svg`) replaces the emoji
  logo in the header and doubles as the favicon (`web/app/icon.svg`); a new
  "Republic of Uganda" card on the homepage shows the flag, the coat of
  arms, official flag colors as swatches with hex/rgb values (Black
  #000000, Yellow/Gold #FCDC04, Red #D90000), country metadata, and direct
  asset downloads. The hero heading's "mapped and cited" now renders in
  the flag's yellow/red — using a *darkened* gold in light mode and a
  *lightened* red in dark mode specifically, since the true flag hex
  values fail WCAG contrast against this app's actual page backgrounds in
  one theme each (pure yellow ~1.2:1 on white; pure red ~2.1:1 on the
  near-black dark background) — documented in `app/globals.css`.
- **`/explore`**: every level of the hierarchy (region through village),
  filterable by region/sub-region/district/name and paginated, with
  CSV/JSON export of the *current filtered set* (not just the visible
  page) via the new `/api/units/export`. Villages are read from the full
  ancestry CSV (see `lib/villages.mjs`) since they aren't in the npm
  package at all; village rows have no stable id and so aren't clickable,
  unlike every other level.
- **`/unit/[id]`**: a detail page for any single unit — ancestor
  breadcrumb, population (where applicable), and direct children, each
  linking to their own detail page.
- **`/map`**: a genuinely zoomable/pannable drill-down map (`d3-zoom`),
  not just the homepage's static choropleth. Clicking a district animates
  a zoom to its bounds and loads its counties → subcounties → parishes →
  villages inline; subcounties/parishes with real boundary geometry render
  on the map itself, while every unit without boundary data (the large
  majority below district level — see `docs/DATA_QUALITY.md`'s coverage
  numbers) still shows up as a plain list item with a "no boundary" badge,
  rather than silently disappearing. Roads overlay filtered to the
  selected district's bounding box, toggleable.
- **`/data`**: a static-download page listing every per-level JSON/CSV
  export and boundary GeoJSON with live file sizes.
- **`/api/units`**, **`/api/units/:id`**, **`/api/units/export`**: new
  generic endpoints backing the above (see `web/README.md` for full
  parameters). Existing hierarchical endpoints
  (`/api/districts/:id/counties` etc.) are unchanged.
- `web/scripts/sync-data.mjs`, run automatically via `predev`/`prebuild`,
  copies `dist/`'s small/medium outputs into `public/data/` — both
  directly downloadable and readable by the village-CSV API route,
  without the API route reaching outside the app's own directory (safer
  for Vercel's serverless function file-tracing than a relative `../dist`
  path).

### Fixed — real Base UI bugs found building the above
- `/api/units/[id]` and the `/unit/[id]` page both force-loaded
  `deep.cells()` — without it, a ward's `getChildren()` silently returns
  empty even when it genuinely has cells, since every level in
  `uganda-locale` lazy-loads on first use and nothing else in these code
  paths had asked for cell data yet.
- `ToggleGroup`'s `onValueChange` payload is an array even in single-select
  mode (`Value[]`, not Radix's plain string) — the map's Population/Region
  toggle from the previous pass silently no-opped without this.
- `Select.Value` renders the raw value verbatim unless given a render-prop
  child mapping value → label — several selects (map explorer's district
  picker) were showing raw ids/`"all"` instead of names.
- The API response shape mismatch between `/api/units` (paginated,
  `{ total, items }`) and the plain-array hierarchical endpoints caused a
  `villageData.map is not a function` crash the first time a parish with
  villages was selected on `/map` — fixed by unwrapping `.items`
  explicitly rather than assuming a consistent shape across endpoints.

## [0.9.1] - 2026-07-22

### Fixed
- **All four boundary GeoJSON files** (`data/geo/districts.geojson`,
  `regions.geojson`, `subcountys.geojson`, `parishs.geojson`) had polygon
  rings wound in the direction opposite to what d3-geo's spherical
  (RFC 7946) convention expects. The geometry was structurally valid and
  passed every schema/coverage check already in place, but any consumer
  actually *rendering* these polygons with d3-geo (as the new web UI's map
  does — see below) would get an extra ring tracing the full clip
  rectangle around every feature, making the whole country render as one
  solid block instead of 136 distinct district shapes. Root-caused to
  geoBoundaries' and HDX's source data both using the opposite winding
  convention from what d3-geo needs (confirmed empirically, not just by
  spec-reading — see the comment in `scripts/ingest-district-boundaries.mjs`
  for the full story). Fixed at the source in all four
  `scripts/ingest-*-boundaries.mjs` / `build-region-boundaries.mjs` scripts
  via `turf.rewind(feature, { reverse: true })`, applied uniformly so it's
  a no-op for any feature that happened to already be correctly wound.
- A second, separate d3-geo edge case: a feature whose vertex lands exactly
  on the fitted projection's boundary (guaranteed to happen at least once
  per `fitSize()` call, since fitting is edge-to-edge with zero padding)
  can trigger the same full-canvas-ring artifact independent of winding.
  Fixed in `components/uganda-map.jsx` by switching to `fitExtent()` with a
  small inset padding instead of `fitSize()`.

### Added (web app, `web/` — not part of the published npm package)
- Rebuilt the demo site from a bare-bones cascading-dropdown page into a
  full interactive UI: shadcn/ui (Base UI primitives) + Tailwind v4, dark
  mode by default, Geist fonts.
- **Interactive district map** (`components/uganda-map.jsx`): renders all
  136 district boundaries as an SVG choropleth via `d3-geo`, computed
  client-side from `/api/geo/districts` (no tile server, no API key).
  Toggle between coloring by 2024 population (sqrt-scaled, `color-mix()`
  against the theme's primary color) or by administrative region. Hover
  for a tooltip, click to select — syncs with search and the hierarchy
  explorer via lifted state. Keyboard-navigable (tab through districts,
  Enter/Space to select).
- **Global search** (`components/command-search.jsx`): Cmd/Ctrl+K command
  palette over `/api/search`, debounced, grouped by level.
- **Hierarchy explorer** (`components/hierarchy-explorer.jsx`): redesigned
  cascading picker — Region/Sub-region filters (in-memory, no extra
  fetch) narrow a District select, then County → Subcounty → Parish load
  live from the API as before, now with loading skeletons and a
  breadcrumb trail.
- Stat cards, a boundary-coverage section surfacing the real
  verified/partial numbers from `docs/DATA_QUALITY.md` (not just a clean
  claim), and a tabbed (Data/Geo) API reference table.
- Pinned dev/start scripts to port 3002 (3000 was blocked by another local
  service).

Three real Base UI integration bugs found and fixed while building this
(none are npm-package bugs — all in the generated `web/components/ui/*`
shadcn output or this app's own usage of it):
- `shadcn add`'s generated `CommandDialog` never wrapped its children in
  the `cmdk` `<Command>` root, so the search palette crashed the instant
  it opened (`Cannot read properties of undefined (reading 'subscribe')`).
  Fixed directly in `components/ui/command.jsx`.
- Base UI's `ToggleGroup` takes/returns arrays (`value: Value[]`,
  `onValueChange: (values: Value[]) => void`) even in single-select mode,
  unlike Radix's string-based `type="single"` API the component's own
  prop names suggest — the map's Population/Region toggle silently did
  nothing until this was fixed in `uganda-map.jsx`.
- Base UI's `Select.Value` shows the raw value verbatim unless given a
  render-prop child to map value → label (Radix auto-resolves this from
  matching `SelectItem` children) — every select in the hierarchy explorer
  was displaying raw ids/`"all"` instead of names until fixed.
- Also: Base UI components compose via a `render` prop
  (`<Button render={<a href=... />} />`), not Radix's `asChild` + children
  — using `asChild` silently produces two nested `<button>`s and a
  hydration mismatch.

## [0.9.0] - 2026-07-21

### Added
- `data/geo/subcountys.geojson` (1,249/2,191 subcounty/town_council/division
  boundaries, 57.0% coverage) and `data/geo/parishs.geojson` (423/10,717
  parish/ward boundaries, 3.95% coverage) — deliberately partial, shipped
  anyway rather than withheld, per an explicit decision to surface all
  available data now and treat accuracy/completeness as future work. See
  `docs/DATA_QUALITY.md` and `data/legacy/provenance/geo/README.md` for the
  full matching/exclusion story (including resolving a naming collision
  between geoBoundaries' and HDX's differently-scoped-but-similarly-sized
  "ADM4" layers).
- `data/geo/roads.geojson` — the major Uganda road network (motorway
  through tertiary, 10,721 features) from OpenStreetMap via HDX's HOTOSM
  export. A fundamentally different kind of layer from the boundary
  files: not tied to any administrative unit (no district_id/region_id —
  computing one would need a spatial join against the partial boundary
  layers, not attempted here). Residential/unclassified streets and
  informal paths/tracks are excluded (98.8% of the raw 681,317-feature
  export has no name tag at all) — see
  `data/legacy/provenance/roads/README.md`.
- `schema/road.schema.json` for the new roads layer;
  `schema/boundary.schema.json` extended with `level`/`district_id` for
  the subcounty/parish tier.
- `geo.subcountyBoundaries()`, `geo.parishBoundaries()`, `geo.roads()` in
  the `uganda-locale/geo` opt-in module; `/api/geo/subcounties`,
  `/api/geo/parishes`, `/api/geo/roads` web routes.
- `shapefile` and `@turf/turf` (already present) as dev-only dependencies
  used to parse/simplify the new sources — never shipped in the published
  package.

### Changed
- `web/package.json`: dev/start scripts pinned to port 3002 (3000 was
  blocked by another local service).

## [0.8.0] - 2026-07-21

### Added
- `data/population/uganda-nphc-2024-population.csv` and a new `population`
  field (`{ year, male, female, total }`) on every district/city record and
  on `data/geo/districts.geojson` features — sourced from UBOS's National
  Population and Housing Census 2024 Final Report (the actual final count,
  not the 2023 HDX projection originally considered), extracted with
  `pdftotext -table` mode and cross-checked three independent ways
  (per-row arithmetic, the report's own prose, and an independent
  national-total reconciliation), all with zero discrepancies. See
  `data/legacy/provenance/population/README.md` for the full extraction
  story, including how a plain `curl -k` request succeeded where the
  WebFetch tool's TLS handling had failed against ubos.org in an earlier
  pass.
- `schema/administrative-unit.schema.json` and `schema/boundary.schema.json`
  updated with the new `population` property.
- `scripts/validate.mjs` now checks population coverage (136 districts +
  10 cities) and that `male + female === total` for every record.

## [0.7.0] - 2026-07-21

### Added
- `data/geo/districts.geojson` (136 district boundary polygons, CC0, from
  geoBoundaries' Uganda ADM3 release — already includes Terego) and
  `data/geo/regions.geojson` (4 region polygons, dissolved from the district
  geometry by `region_id` using `@turf/turf`, a dev-only dependency).
  Nothing below district level: county/subcounty/parish/village boundary
  data was evaluated and found too incomplete, too stale, or unlicensed —
  see `docs/DATA_QUALITY.md` for the full list of sources checked (HDX
  COD-AB, GADM, geoBoundaries ADM2/ADM4, OpenStreetMap, a 2010 UBOS parish
  shapefile, and an unlicensed village shapefile) and why each was or
  wasn't used.
- `uganda.subregions()`-style opt-in module `uganda-locale/geo`:
  `districtBoundaries()` and `regionBoundaries()`, mirroring the
  `uganda-locale/deep` pattern (not bundled in the default import).
- `/api/geo/districts` and `/api/geo/regions` web routes.
- `scripts/ingest-district-boundaries.mjs` and
  `scripts/build-region-boundaries.mjs`; `scripts/validate.mjs` now checks
  feature counts, id uniqueness, and id resolution for both GeoJSON files.
- `schema/boundary.schema.json` describing the FeatureCollection properties
  shape used by both files.

## [0.6.0] - 2026-07-21

### Added
- `data/subregions.csv` and a new `subregion_id` field on every district/city
  (and everything beneath them, down to village/cell): Uganda's 17
  cultural/traditional sub-regions (Acholi, Ankole, Buganda, Bugisu, Bukedi,
  Bunyoro, Busoga, Kampala, Karamoja, Kigezi, Lango, Madi, Rwenzori, Sebei,
  Teso, Tooro, West Nile) — the taxonomy UBOS itself uses for census
  reporting, distinct from and parallel to the 4 administrative regions
  (several sub-regions, e.g. Busoga/Bukedi/Bugisu/Sebei/Teso, all sit inside
  the single "Eastern" administrative region). See
  `docs/DATA_QUALITY.md` for sourcing and its caveats.
- `uganda.subregions()` export (bundled by default alongside `regions()`).
- `sub_region` column in `dist/uganda-locations-full.csv`.
- `subregionId` query param on the `/api/districts` route; new
  `/api/subregions` route.
- `"subregion"` added to `schema/administrative-unit.schema.json`'s `level`
  enum, plus the `subregion_id` property description.

## [0.5.0] - 2026-07-12

### Added
- `uganda-locale` npm package: `src/index.mjs` bundles
  region→district/city→county→subcounty/town_council/division (~1.3MB) with
  a small query API (`regions()`, `districts()`, `cities()`, `counties()`,
  `subcounties()`, `getUnit()`, `getChildren()`, `getAncestors()`,
  `search()`, `country()`, `dataQualityReport()`). `src/deep.mjs` is an
  opt-in extension adding parish/ward/cell (~5MB more) without weighing
  down the default import.
- `package.json` `exports`/`files` fields so `npm pack` ships only the data
  actually needed (795KB compressed, 7.1MB unpacked) — verified with
  `npm pack --dry-run`, excludes the two large regenerable files as before.
- `scripts/smoke-test.mjs` (`npm run test`): checks the public API against
  known record counts (136 districts, 322 counties, etc.) before publishing.

### Noted
- Not yet published to the npm registry — `npm publish` is public and
  effectively irreversible, so it's held pending explicit confirmation, same
  as `vercel deploy` will be. Installable now via
  `npm install github:kakandemanwell/uganda`.
- Village-level data (71,230 records) is intentionally not bundled in the
  package (~33MB as JSON) — use `dist/uganda-locations-full.csv` or the
  planned API instead.

## [0.4.0] - 2026-07-12

### Added
- Country-level metadata (`data/country/uganda.json`): ISO 3166 codes,
  currency (UGX), calling code (+256), capital, region/subregion,
  languages, TLD, timezone (Africa/Kampala, UTC+3, no DST), driving side,
  demonym, motto, independence date, area, borders, flag emoji. Sourced
  from mledoze/countries (MIT licensed), cross-checked for timezone/
  driving-side against independent sources.
- Flag and coat-of-arms images (`data/country/assets/`), SVG and PNG,
  from Wikimedia Commons, visually verified before use (not just trusted
  by filename).
- `schema/country.schema.json` and validation coverage in
  `scripts/validate.mjs`.
- Wired into the build: `dist/country/uganda.json` + `dist/country/assets/`.

### Noted
- The coat-of-arms file is CC BY-SA 3.0, not this project's default
  CC-BY 4.0 — documented as an explicit exception in `LICENSE-DATA.md`
  rather than silently blanket-licensed.

## [0.3.1] - 2026-07-12

### Added
- `dist/uganda-locations-full.csv` — full ancestry (region/district/county/
  constituency/subcounty/parish/village), one row per village, 71,230 rows,
  ~6.6MB, meant to be opened directly in Excel/Google Sheets by non-technical
  users.
- Committed most of `dist/` to the repo so the data is usable directly from
  GitHub without running the build. Excluded the two files that are just
  heavier restatements of what's already covered (`uganda-locations.json`,
  ~39MB, and `villages.json`, ~33MB) — run `npm run build` for those.

## [0.3.0] - 2026-07-12

### Added
- **County layer, reconstructed from the EC gazetteer's constituency data**:
  322 counties, `confidence: verified`, covering 135/136 rural districts
  (Kampala structurally has no county tier, like cities). Replaces the
  2015-vintage legacy list (112/136 matched, now fully retired from the
  build) with current (2022), verified data — a materially better outcome
  than the originally-planned 2015-lineage-tracing approach.
- Independent validation: spot-checked against separately-sourced research
  (UBOS NPHC census drilldowns, Wikipedia district pages) across 13
  districts — 11 exact matches, 2 cases where this data is more granular
  than the independent source (not a contradiction), 0 conflicts.

### Fixed
- Retracted an incorrect flag from Phase 0: "Ik County" under Kaabong
  District, previously called a likely Wikipedia data error, is confirmed
  real by the independent EC data.
- `scripts/build.mjs`'s coverage report and flattened CSV export both
  assumed a subcounty's parent was always its district directly; fixed to
  walk the tree properly now that most subcounties sit under a county.

## [0.2.0] - 2026-07-09

### Added
- Found and ingested the EC's actual bulk village-level gazetteer
  ("Verified Administrative Units, July 2022," 3,019 pages, at
  `ec.or.ug/admin-units`), which turned out to be reachable all along —
  earlier HTTP 403s were specific to the WebFetch tool's request pattern,
  not the resource itself.
- Built a coordinate-aware PDF parser (`data/legacy/provenance/ec/parse_admin_units.mjs`)
  since plain text extraction destroys the nested district > constituency >
  subcounty > parish > village table structure.
- New verified data: 2,191 subcounties/town councils/divisions, 10,717
  parishes/wards, 71,230 villages/cells — all 146 district-equivalent units,
  `confidence: verified`. Validated against ~2,198 checksums embedded in the
  source document (100% match) and an independent EC summary-statistics
  document (584/584 per-district field checks match, zero discrepancies).
- Retired the old `location.csv`-derived subcounty layer from the build
  (superseded on every dimension: coverage, county-tier reliability, and
  currency); kept on disk for reference only.

### Fixed
- **Terego District was missing** from the original 135-district baseline —
  all three sources used to establish that baseline (Statoids, Wikipedia,
  the MoLG-style PDF list) shared the same gap. Caught by cross-referencing
  the EC's independently-published district count (146 = 136 districts + 10
  cities). District count corrected to 136.
- Two CSV rows (Kampala, Tororo) had unquoted commas in their `notes` field
  that silently truncated data during parsing — caught by inspecting the
  compiled output, not just checking row counts.
- Kampala's `type` was originally set to `kcca`, conflating the governing
  *authority* (Kampala Capital City Authority) with the unit's
  classification. Corrected to `type: capital_city`, with KCCA's role
  documented in `notes` instead.

## [0.1.0] - 2026-07-09

### Added
- Project scaffold: schema, build pipeline, validator, docs.
- Verified layer: 4 regions, 135 districts (incl. Kampala/KCCA), 10 cities —
  cross-checked against Statoids, Wikipedia, and an official-style
  Ministry/local-government list.
- Legacy layer: 194 county/municipal-council rows mechanically parsed from a
  ~2015 Wikipedia/Statoids table (112/135 districts matched to current
  structure); ~1,372 subcounty/town-council rows migrated from the project's
  original `location.csv` (110/135 districts covered).
- Auto-generated data-quality report surfacing exactly which districts lack
  county/subcounty data and which legacy rows failed to reconcile.
- `data/sources.json` documenting every source consulted, including sources
  evaluated and rejected (HDX/OCHA COD-AB) and sources blocked during
  research (EC website, Daily Monitor — both returned HTTP 403).

### Not yet included
- Parish, ward, village, cell, zone levels.
- Reconciliation of the 23–25 post-2015 districts against legacy
  county/subcounty data.
- Unverified 2025/2026 news reports of new town councils / district splits.
