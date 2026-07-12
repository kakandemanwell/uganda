# Changelog

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
