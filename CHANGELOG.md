# Changelog

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
