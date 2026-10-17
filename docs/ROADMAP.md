# Roadmap

## Phase 0 — done
- [x] Verified region + district (136, incl. Kampala/KCCA and Terego) + city
      (10) layer, cross-checked against 3 independent current sources.
- [x] Schema (`schema/administrative-unit.schema.json`) with `confidence`/`status` so gaps are visible instead of silently absent.
- [x] Build pipeline (`scripts/build.mjs`) + structural validator (`scripts/validate.mjs`).
- [x] Legacy county table (2015 vintage) mechanically parsed from Wikipedia/Statoids wikitext.

## Phase 1 — village-level data (done, ahead of schedule)
- [x] Located the EC's actual bulk gazetteer (`ec.or.ug/admin-units`) — a
      3,019-page PDF covering district > constituency > subcounty/town/division
      > parish/ward > village for all 146 district-equivalent units.
- [x] Built a coordinate-aware parser (plain text extraction destroys the
      nested table structure) — `data/legacy/provenance/ec/parse_admin_units.mjs`.
- [x] Validated against ~2,198 embedded checksums (100% match) and an
      independent EC summary-statistics document (584/584 field checks match
      across all 146 districts/cities) — see
      `data/legacy/provenance/ec/README.md`.
- [x] Ingested into the schema (`scripts/ingest-ec-admin-units.mjs` →
      `data/ec/administrative_units_ec2022.json`): 2,191 subcounties/towns/
      divisions, 10,717 parishes/wards, 71,230 villages/cells, all
      `confidence: verified`.
- [x] Retired the old legacy `location.csv`-derived subcounty layer from the
      build (superseded; kept on disk for reference).
- [x] Caught and fixed: Terego District missing from the original
      135-district baseline (all three sources used shared the same gap).

## Phase 2 — county layer (done, superseded the original plan)
- [x] Rather than tracing 24 gap districts back through the 2015 legacy
      list, reconstructed county directly from the EC's own constituency
      data: outside city/Kampala divisions, a constituency name in the 2022
      gazetteer *is* the county name (verified — see `docs/DATA_QUALITY.md`).
      Covers 135/136 rural districts (322 counties), all `confidence:
      verified`, current to 2022 rather than 2015.
- [x] Spot-checked against independent research (UBOS NPHC drilldowns,
      Wikipedia district pages) across 13 districts — 11 exact matches, 2
      refinements (EC data more granular), 0 contradictions.
- [x] Retired the 2015 legacy county list from the build entirely
      (superseded on coverage, currency, and confidence); kept on disk for
      provenance.
- [x] Retracted an earlier wrong flag: "Ik County" under Kaabong, previously
      called a likely Wikipedia error, confirmed real.
- [ ] Still open: county for Katikamu subcounty (Luwero) — the one non-city
      exception that spans two constituencies like a division does. Left
      unassigned rather than guessed; see `dist/data-quality-report.json` →
      `subcounties_without_a_matched_county`.
- [ ] Get a primary-source confirmation of the reported 2025/2026 new town
      councils and any Tororo-area district/city split before adding them —
      do not merge the unverified news summary in as fact.

## Phase 2.5 — publish (done)
- [x] Pushed to GitHub: [github.com/kakandemanwell/uganda](https://github.com/kakandemanwell/uganda).
- [x] Committed most of `dist/` (~13MB) so the data is usable directly from
      the repo without running the build, including
      `dist/uganda-locations-full.csv` (one row per village, full ancestry,
      6.6MB) specifically for non-technical users to open in Excel/Sheets.
      Excluded only the two files that just restate the same data more
      heavily (`uganda-locations.json` ~39MB, `villages.json` ~33MB).
- [x] Made the full-CSV download the first thing in the README, above the
      fold, after an earlier pass had it buried below other sections.

## Phase 2.6 — country metadata (done)
- [x] Added `data/country/uganda.json` (ISO codes, currency, calling code,
      capital, languages, timezone, driving side, demonym, motto,
      independence date, borders, area) sourced from mledoze/countries
      (downloaded and parsed with a script, not summarized, to avoid
      truncation on the ~1.4MB source file) and cross-checked timezone/
      driving-side against independent current sources.
- [x] Added `data/country/assets/` — flag and coat-of-arms in SVG and PNG,
      downloaded from Wikimedia Commons and visually verified (not just
      trusted by filename) before use.
- [x] Flagged a real licensing wrinkle: the coat of arms is CC BY-SA 3.0,
      stricter than this project's default CC-BY 4.0 — documented as an
      explicit exception in `LICENSE-DATA.md`, not glossed over.
- [x] Wired into the build (`dist/country/`) and validator.

## Phase 3 — zone / polling-station layer (not started)
- [ ] The EC's polling-station-level data (50,739 stations for the 2025/26
      elections) is a *separate* publication from the administrative-unit
      gazetteer used in Phase 1 — locate and evaluate it the same way (check
      `ec.or.ug` for a similar bulk PDF/page before assuming per-district
      files are the only option; that assumption turned out to be wrong for
      the village-level data, so re-check it here too).
- [ ] If it does turn out to be per-district, build an incremental ingestion
      pipeline and land it district-by-district, each verified against the
      source before being marked `confidence: verified`.

## Phase 4 — serving mechanism (in progress)
Decision made 2026-07-12: npm package + Vercel API, in that order.
- [x] npm package (`src/index.mjs`, `package.json` `exports`/`files`)
      wrapping the compiled data for direct JS/TS consumption. Bundles
      region→district/city→county→subcounty/town_council/division by
      default (~1.3MB); parish/ward/cell (~5MB more) is opt-in via
      `uganda-locale/deep`. Village-level data (71,230 records, ~33MB as
      JSON) is deliberately **not** bundled — too heavy for an npm
      install; use `dist/uganda-locations-full.csv` or the API instead.
      Verified with `npm pack --dry-run`: 795KB compressed / 7.1MB
      unpacked, no stray files. `npm run test` runs a smoke test
      (`scripts/smoke-test.mjs`) against known record counts.
- [x] Published to the npm registry as
      [`uganda-locale`](https://www.npmjs.com/package/uganda-locale) —
      `npm install uganda-locale`. Unreleased master remains installable via
      `npm install github:kakandemanwell/uganda`.
- [ ] Minimal Next.js app on Vercel exposing `/api/districts`,
      `/api/districts/:id/counties`, `/api/counties/:id/subcounties`, etc.,
      plus a simple cascading-dropdown demo and a search endpoint — "serve
      the website forever" per the original ask. Build and test locally
      first; hold off on the actual `vercel deploy` (creates a public URL
      under the user's account) until explicitly confirmed, same as the
      GitHub push was.
- [ ] Consider a Python package mirroring the same data for non-JS
      consumers, after the JS one is working.

## Phase 5 — boundary geometry, roads, and population for map visualization (in progress — region to parish essentially complete, no village)
- [x] Evaluated every free/open boundary source found for Uganda (HDX
      COD-AB, GADM, geoBoundaries at ADM1-4, OpenStreetMap, a 2010 UBOS
      parish shapefile, an unlicensed village shapefile, and — on
      2026-10-17 — UBOS's own NPHC 2024 and BEC 2025 APIs and MWE's WEIS
      GeoServer) — see `docs/DATA_QUALITY.md` and `data/sources.json` for
      the full verdict on each, used or rejected.
- [x] Shipped `data/geo/districts.geojson` (136 features) and
      `data/geo/regions.geojson` (4 features, dissolved from the district
      geometry by `region_id`, not sourced independently, so it can never
      drift out of sync). Districts were originally geoBoundaries ADM3
      (CC0), which turned out to be wrong for many districts once compared
      against UBOS's own outlines (12 of 135 with IoU ≥ 0.9; Kampala had
      swallowed Kira and Kasangati). Re-sourced 2026-10-17 — see below.
- [x] **Territorial rule** adopted (2026-10-17) as the basis of all
      boundary work: no new land is ever created; a new unit is always
      carved out of existing ones; an unmapped area inside a mapped parent
      *is* the missing unit(s) — see `docs/DATA_QUALITY.md`.
- [x] **Every boundary level rebuilt bottom-up from UBOS (2026-10-17)**
      — `scripts/ingest-ubos-boundaries.mjs`, from UBOS NPHC 2024
      (district/subcounty) and BEC 2025 (parish) polygons matched onto the
      EC tree, each level the union of the one below: districts 136/136,
      cities 10/10 (new `citys.geojson`, `cityBoundaries()`, `/api/geo/cities`),
      counties **322/322**, subcounties **2,190/2,191**, parishes
      **10,634/10,717 (99.2%)**. 73 parishes and 3 subcounties inferred from
      leftover land; 23 unassignable parish-level areas (~722 km²) shipped
      as `gaps.geojson` with candidates (`gaps()`, `/api/geo/gaps`). Lakes
      clipped out with a geoBoundaries coastline × Natural Earth lakes
      mask. `external_refs.ubos_code` on 12,820 units and
      `data/crosswalk/ubos-2024.csv`. Replaced the same-day intermediate
      build on OCHA COD-AB's 2020 polygons (districts from ADM2, counties
      118/322, subcounties 1,351/2,191), whose
      `ingest-district-boundaries.mjs` / `ingest-subcounty-boundaries.mjs`
      are deleted.
- [x] All boundary layers simplified as one shared topology
      (`scripts/lib/topo.mjs`) before any union, so neighbours share
      identical borders and every layer nests exactly inside the one above
      (previously ~1,513 slit holes in the dissolved regions).
- [x] **Tessellation cleaning** (`scripts/lib/tessellate.mjs`): UBOS's
      BEC 2025 parishes overlap their neighbours and leave ~4 km² of
      sliver gaps per district. Each district's parishes are now clipped
      to the district, de-overlapped (earlier UBOS code wins) and their
      gaps filled (slivers to the nearest neighbour, bigger chunks split
      equidistantly; over 5 km² left as a gap) — nationally 53.2 km² of
      overlaps removed and 409.5 km² of gaps filled. Alebtong's gaps went
      from 4.25 km² to 0.067 km². See `docs/DATA_QUALITY.md`.
- [x] **Refugee settlements split, not gaps**: the 15 UBOS settlement
      census units' land is divided between the touching host subcounties
      along equidistant lines (inferred), and each outline is published as
      `settlements.geojson` (`settlements()`, `/api/geo/settlements`). No
      subcounty-level gaps remain.
- [x] **Sub-region layer**: `subregions.geojson` (17 features), dissolved
      from the districts by `subregion_id` (`subregionBoundaries()`,
      `/api/geo/subregions`).
- [x] **Cross-dataset boundary agreement** (`scripts/compare-boundaries.mjs`
      → `data/qa/boundary-agreement.csv`): every published subcounty's IoU
      against UBOS NPHC 2024 (median 0.991, 2,110 compared) and OCHA
      COD-AB 2020 (median 0.753, 1,352 compared — the older system, so
      context only). 7 subcounties flagged below 0.8 against UBOS, all
      refugee-settlement hosts that absorbed settlement land — expected.
- [x] `scripts/validate.mjs` fails any boundary feature whose exterior ring
      is counter-clockwise — the d3-geo winding bug bit twice (0.9.1, and
      `turf.union` output during the 2026-10-17 rebuild).
- [x] `uganda-locale/geo` opt-in module (`districtBoundaries()`,
      `cityBoundaries()`, `regionBoundaries()`, `subregionBoundaries()`,
      `countyBoundaries()`, `subcountyBoundaries()`, `parishBoundaries()`,
      `gaps()`, `settlements()`, `roads()`)
      and matching `/api/geo/*` web routes.
- [x] ~~Parish-level boundaries: ingested HDX's admin4 layer, 423/10,717
      (3.95%).~~ **Retracted 2026-10-17** — that layer is subcounty-tier,
      not parish-level (it contains Kampala's five divisions; COD-AB has no
      parish level at all), so the 423 polygons were subcounty outlines
      attached to same-named parishes. Replaced the same day by real UBOS
      BEC 2025 parish polygons (above); see `docs/DATA_QUALITY.md`.
- [x] OCHA P-code crosswalk (2026-10-17):
      `scripts/ingest-hdx-cod-ab.mjs` → `data/crosswalk/hdx-cod-ab-uga.csv`
      (shipped in the npm package), `external_refs.hdx_pcode` (1,608 exact)
      and `external_refs.hdx_within_pcode` (all 2,663 eligible units) on
      every record from region to subcounty tier, an `hdx_pcode` column in
      the full CSV, P-code nesting checks in `scripts/validate.mjs`. COD-AB
      geometry is only a match test now; it withholds 2 P-codes (Bujenje,
      Pakanyi — Masindi/Kiryandongo).
- [x] Web `/map` rebuilt on MapLibre GL + OpenFreeMap vector tiles
      (2026-10-17): choropleth of region/district/county/subcounty/parish
      by population, density and unit counts, overlay toggles (incl.
      unassigned land and parish lines), satellite basemap (Esri World
      Imagery via a server-side tile proxy) with a fill-opacity slider,
      collapsible panels, district drill panel, URL-synced state, and
      GeoJSON/CSV/PNG export via `/api/geo/export` and `/api/geo/stats` —
      see `web/README.md`. Then: frosted-glass panels floating over the
      map; click anywhere for the full hierarchy at that point
      (`/api/geo/at`); a right-click menu with coordinates and links out to
      street-level imagery; rotate/tilt and a 3D terrain toggle (AWS
      Terrain Tiles); a "Hierarchy" display mode drawing every level in
      its own colour; a sub-region level, a boundary-agreement metric, and
      population at county and subcounty level.
- [x] Major road network: ingested OSM/HOTOSM roads (motorway-tertiary,
      10,721 features), independent of the admin-unit tree — no
      district/region tagging exists in OSM for Uganda. Residential/
      unclassified streets and informal paths/tracks excluded (98.8% of
      the raw 681K-feature export is unnamed).
- [x] "Aggregated values per district": added 2024 census population
      (`population` field, `{ year, male, female, total }`) on every
      district/city record and on `data/geo/districts.geojson` features,
      sourced from UBOS's actual Final Report (not the 2023 HDX
      projection originally considered) — see `docs/DATA_QUALITY.md` and
      `data/legacy/provenance/population/README.md` for the extraction and
      three-way validation story. WorldPop's gridded raster remains a
      future option for anything below district level.
- [ ] Close the remaining boundary gaps: 83 parishes, 1 subcounty
      (Makerere University — no separate UBOS unit, it's within Kawempe),
      and the 23 parish-level areas in `gaps.geojson`, which need a source
      that separates their 2+ candidate parishes — inference can't, since
      the candidates have no land of their own to split from. The 15
      refugee-settlement splits are inferred, not sourced: a record of how
      each settlement divides between its host subcounties would replace
      them (and clear the 7 review flags in
      `data/qa/boundary-agreement.csv`). `data/crosswalk/ubos-2024.csv`'s
      144 unmatched UBOS parishes and 18 unmatched subcounties are the
      place to start any manual review.
- [x] Subcounty population: UBOS NPHC 2024 per-subcounty counts assigned
      to 2,180 EC subcounties (`data/population/ubos-nphc-2024-subcounty.csv`,
      44,986,031 people; the settlement units are counted separately) and
      summed to counties (`partial: true` where one is missing) — on the
      `dist/geo/` features, not yet on the unit records themselves.
- [ ] Not attempted: a spatial join tying `data/geo/roads.geojson` back to
      the district/subcounty it runs through (roads carry no admin-unit
      tagging from OSM). Now that the boundary layers are essentially
      complete it's feasible — `@turf/booleanIntersects` or similar against
      the boundary layers, run once at build time.
- [ ] Village boundaries: no usable source. MWE's WEIS GeoServer has
      village polygons, but its terms require written permission first.

## Explicitly out of scope for now
- Keeping the EC gazetteer current past July 2022 — that requires either a
  newer EC publication (worth checking for one before assuming none exists,
  per the Phase 3 lesson above) or manual district-by-district updates as
  changes are confirmed.
