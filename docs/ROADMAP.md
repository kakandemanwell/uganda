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
- [ ] Not yet published to the npm registry (`npm publish` is a public,
      hard-to-reverse action — holding until explicitly confirmed, same
      caution as the Vercel deploy below). Installable today via
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

## Phase 5 — boundary geometry, roads, and population for map visualization (in progress — district level complete, below-district intentionally partial)
- [x] Evaluated every free/open boundary source found for Uganda (HDX
      COD-AB, GADM, geoBoundaries at ADM1-4, OpenStreetMap, a 2010 UBOS
      parish shapefile, and an unlicensed village shapefile) — see
      `docs/DATA_QUALITY.md` and `data/sources.json` for the full verdict
      on each, used or rejected.
- [x] Shipped `data/geo/districts.geojson` (136 features, CC0, from
      geoBoundaries' ADM3 release — already includes Terego) and
      `data/geo/regions.geojson` (4 features, dissolved from the district
      geometry by `region_id`, not sourced independently, so it can never
      drift out of sync).
- [x] `uganda-locale/geo` opt-in module (`districtBoundaries()`,
      `regionBoundaries()`) and `/api/geo/districts` /
      `/api/geo/regions` web routes.
- [x] Subcounty-level boundaries: ingested geoBoundaries ADM4, 1,249/2,191
      (57.0%) matched to a unique current subcounty/town_council/division
      by name (102 excluded as ambiguous — same name reused across
      districts). Deliberately partial, shipped anyway.
- [x] Parish-level boundaries: ingested HDX's admin4 layer (genuinely
      parish-level, confirmed via its own district/parish attributes —
      distinct from geoBoundaries' similarly-numbered subcounty layer
      despite a near-identical feature count), 423/10,717 (3.95%) matched.
      Deliberately partial, shipped anyway — see `docs/DATA_QUALITY.md`.
- [x] Major road network: ingested OSM/HOTOSM roads (motorway-tertiary,
      10,721 features), independent of the admin-unit tree — no
      district/region tagging exists in OSM for Uganda. Residential/
      unclassified streets and informal paths/tracks excluded (98.8% of
      the raw 681K-feature export is unnamed).
      County/village boundaries: still no usable free source found at all
      (see `docs/DATA_QUALITY.md` for why each was rejected).
- [x] "Aggregated values per district": added 2024 census population
      (`population` field, `{ year, male, female, total }`) on every
      district/city record and on `data/geo/districts.geojson` features,
      sourced from UBOS's actual Final Report (not the 2023 HDX
      projection originally considered) — see `docs/DATA_QUALITY.md` and
      `data/legacy/provenance/population/README.md` for the extraction and
      three-way validation story. WorldPop's gridded raster remains a
      future option for anything below district level.
- [ ] Not attempted: a spatial join tying `data/geo/roads.geojson` back to
      the district/subcounty it runs through (roads carry no admin-unit
      tagging from OSM, and subcounty coverage is itself only 57%, so any
      join would inherit that gap). Would need `@turf/booleanIntersects`
      or similar against the boundary layers, run once at build time.
- [ ] Subcounty/parish coverage could be pushed higher with more effort
      (fuzzy/phonetic name matching instead of exact-slug matching, or
      tracing pre-split parent names for parishes in districts that have
      since reorganized) — not attempted in this pass; the exact-match
      results are honestly reported instead as a documented gap.

## Explicitly out of scope for now
- Keeping the EC gazetteer current past July 2022 — that requires either a
  newer EC publication (worth checking for one before assuming none exists,
  per the Phase 3 lesson above) or manual district-by-district updates as
  changes are confirmed.
