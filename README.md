# uganda-locale

An open, versioned dataset (and eventually a small serving library) of Uganda's
administrative units — **region → district/city → county/municipality →
subcounty/town council/division → parish/ward → village/cell → zone** — built
because no single free, current, machine-readable source of this hierarchy
existed for software integration (form dropdowns, address validation,
reporting, etc.), and Uganda's units change often enough that hand-maintained
copies go stale fast. Every district/city also carries a `subregion_id`
pointing into a second, parallel classification — Uganda's 17
cultural/traditional sub-regions (Buganda, Acholi, Ankole, Busoga, ...), the
grouping UBOS itself uses for census reporting — since the 4 administrative
regions don't map onto historical/cultural boundaries.

> **Just want the data, not the code?** Download
> **[`dist/uganda-locations-full.csv`](dist/uganda-locations-full.csv)**
> and open it in Excel or Google Sheets — one row per village (71,230 rows),
> with region/sub_region/district/county/constituency/subcounty/parish/village columns.
> That's the whole dataset in one file. (On the file's GitHub page, use the
> download/raw button to save it directly — GitHub doesn't fully render a
> spreadsheet preview for a file this size.)

## Why this exists

Uganda's Electoral Commission is the most tactically complete government body
for this data — it maps down to the village level for every election. Most
free sources (Wikipedia, HDX/OCHA, Statoids) turned out to be either scoped to
district level only or several years stale below that — see
[`docs/DATA_QUALITY.md`](docs/DATA_QUALITY.md) for the full source-by-source
breakdown, including what was checked and rejected.

The EC does in fact publish the real thing: a full village-level gazetteer
(`ec.or.ug/admin-units`), just not advertised as a "dataset" — it's a
3,019-page PDF. It's now been parsed, and validated twice over (see below).

## What's actually in here right now

Run `npm run build` to compile `data/` into `dist/`:

| Level | Count | Confidence |
|---|---|---|
| Region | 4 | verified |
| Sub-region (cultural/traditional, e.g. Buganda, Acholi, Ankole) | 17 | verified — see caveat in [`docs/DATA_QUALITY.md`](docs/DATA_QUALITY.md) |
| District (incl. Kampala/KCCA) | 136 | verified — cross-checked against 3 independent current sources |
| City | 10 | verified |
| County / Municipality | 322 | **verified** — reconstructed from the EC gazetteer's constituency data, July 2022, 135/136 rural districts (Kampala has no county tier, like cities) |
| Subcounty / Town Council / Division | 2,191 | **verified** — EC gazetteer, July 2022, all 146 district-equivalent units |
| Parish / Ward | 10,717 | **verified** — EC gazetteer, July 2022, all 146 district-equivalent units |
| Village / Cell | 71,230 | **verified** — EC gazetteer, July 2022, all 146 district-equivalent units |
| Zone | 0 | not yet ingested — EC polling-station data is a separate source from the admin-unit gazetteer, see [Roadmap](docs/ROADMAP.md) |

Plus boundary polygons for map visualization at **every level from region
down to parish** (`dist/geo/`), built bottom-up from the Uganda Bureau of
Statistics' own current polygons — 2024 census (NPHC) districts and
subcounties, and 2025 Baseline Education Census parishes — attached to the
EC's units:

| Layer | Polygons |
|---|---|
| Region | 4 / 4 (dissolved from the districts, so they can never drift out of sync with `region_id`) |
| Sub-region | 17 / 17 (dissolved from the districts by `subregion_id`, the same way) |
| District | 136 / 136 (each includes any city carved out of it) |
| City | 10 / 10 |
| County / municipality | 322 / 322 |
| Subcounty / town council / division | 2,190 / 2,191 |
| Parish / ward | 10,634 / 10,717 (99.2%) |
| Refugee settlement (informational) | 15 outlines — not admin units; their land is part of the host subcounties |

The build follows one **territorial rule**: no land is ever created; a new
unit is always carved out of existing ones (a new subcounty regroups old
parishes, a new parish regroups villages); and an unmapped area inside a
mapped parent *is* the missing unit — see
[`docs/DATA_QUALITY.md` → Territorial rule](docs/DATA_QUALITY.md#territorial-rule).
So every level is exactly the union of the level below; a few units are
inferred from leftover land (73 parishes, 3 subcounties — marked
`inferred: true`); the 15 refugee settlements UBOS counts as census units
of their own (the EC and local government don't) have their land split
between the touching host subcounties along equidistant lines — inferred,
with each settlement's outline kept in `dist/geo/settlements.geojson` so
the inference stays visible; and land that still can't be pinned to one
unit is shipped as explicit gaps listing the candidate units
(`dist/geo/gaps.geojson`, 23 parish-level areas, ~722 km²) rather than
dropped or guessed. UBOS's parish polygons aren't one clean topology —
neighbours overlap slightly and leave thousands of sliver gaps — so each
district's parishes are first cleaned into an exact tessellation (overlaps
removed, slivers handed to their neighbours). Lake water is clipped out
(UBOS's polygons follow legal boundaries into the lakes), and every layer
is simplified as one shared topology, so neighbouring polygons share
identical borders and each layer nests exactly inside the one above. Each
published subcounty is checked against UBOS's own NPHC 2024 polygon for
the same unit: median intersection-over-union 0.991 (`data/qa/boundary-agreement.csv`).

Getting here took two corrections, both documented in
[`docs/DATA_QUALITY.md`](docs/DATA_QUALITY.md): the original district layer
(geoBoundaries) matched all 136 names but was materially wrong on the
ground — its Kampala swallowed Kira and Kasangati, which are in Wakiso —
and an earlier "parish" layer turned out to be subcounty-tier and was
retracted. An intermediate rebuild on OCHA's 2020 COD-AB polygons was
superseded the same day by the UBOS build; COD-AB is still used for its
P-codes (see "Joining humanitarian data" below). No village polygons: no
usable source exists — see [`docs/DATA_QUALITY.md`](docs/DATA_QUALITY.md)
for the full list of sources checked and why each was or wasn't used.

Plus **2024 census population** for every district and city (`population`
field: `{ year, male, female, total }`), from UBOS's National Population
and Housing Census 2024 Final Report — the actual final count, not a
projection. Cross-checked three independent ways (per-row arithmetic, the
report's own prose, and an independent national-total reconciliation) with
zero discrepancies; see [`docs/DATA_QUALITY.md`](docs/DATA_QUALITY.md) for
the full validation story. Below district, the same census's per-subcounty
counts (from UBOS's NPHC 2024 API) are attached to 2,180 subcounty
features and summed to counties (`partial: true` where a county has a
subcounty without a figure) — 44,986,031 people against the 45,905,417
national total, the difference being the refugee-settlement census units,
which are counted separately (`data/population/ubos-nphc-2024-subcounty.csv`).

Plus, shipped deliberately limited rather than withheld (see
[`docs/DATA_QUALITY.md`](docs/DATA_QUALITY.md) for why):
- **Major road network** (`dist/geo/roads.geojson`) — 10,721 OpenStreetMap
  road segments (motorway through tertiary only; residential streets and
  informal paths/tracks excluded as too heavy and ~90%+ unnamed). Not tied
  to any administrative unit — a road crosses many districts/subcounties.

Plus country-level metadata (`dist/country/uganda.json`): ISO codes,
currency (UGX), calling code (+256), timezone (Africa/Kampala, UTC+3, no
DST), driving side, capital, languages, and flag/coat-of-arms images in SVG
and PNG (`dist/country/assets/`) — sourced from
[mledoze/countries](https://github.com/mledoze/countries) and Wikimedia
Commons, see `docs/DATA_QUALITY.md`. **Note:** the coat-of-arms image is
CC BY-SA 3.0, not this project's default CC-BY 4.0 — see
[`LICENSE-DATA.md`](LICENSE-DATA.md) before reusing it.

Every record has a `confidence` (`verified` / `legacy` / `unverified`) and a
`status` (`operational` / `pending` / ...) field. Consuming code should
filter on `confidence` explicitly rather than assume completeness — the one
remaining structural gap is one subcounty (Katikamu, Luwero) that spans two
constituencies like a city division and wasn't force-assigned a county name.

The subcounty → village layer is sourced from the EC's own "Verified
Administrative Units, July 2022" gazetteer and cross-validated twice: every
one of the ~2,198 "TOTAL VILLAGES IN X" checksums printed in the source
document itself matches, and fully re-aggregated per-district totals match
the EC's independently-published summary statistics exactly, for all 146
districts/cities with zero discrepancies. The county layer is reconstructed
from that same gazetteer's constituency data (outside city/Kampala
divisions, a constituency name in this document *is* the county name) and
was independently spot-checked against separate research across 13
districts, 11 exact matches and 2 refinements, 0 contradictions. Full story
in [`data/legacy/provenance/ec/README.md`](data/legacy/provenance/ec/README.md)
and [`docs/DATA_QUALITY.md`](docs/DATA_QUALITY.md). All of it is dated July
2022, so it doesn't reflect any changes since (see `docs/DATA_QUALITY.md`
for what's unverified from 2023-2026, e.g. reported new town councils).

Run `node scripts/build.mjs` and check `dist/data-quality-report.json` for a
live coverage report — regenerated every build, not hand-maintained.

## Repo layout

```
src/
  index.mjs              # npm package entry point (region..division)
  deep.mjs                # opt-in: adds parish/ward/cell
  store.mjs                # shared lazy-loading index over dist/*.json
web/
  # minimal Next.js app / API — see web/README.md
data/
  regions.csv           # 4 regions
  subregions.csv        # 17 cultural/traditional sub-regions (Buganda, Acholi, Ankole, ...), parallel to regions
  districts.csv         # 136 districts + Kampala/KCCA, verified; carries both region_id and subregion_id
  cities.csv            # 10 second-generation cities, verified
  sources.json          # every source cited, with access date + what it was used/rejected for
  ec/
    administrative_units_ec2022.json   # EC-verified county->subcounty->parish->village, all 146 units
  geo/                    # boundary layers: processed UBOS data (NPHC 2024 + BEC 2025), built bottom-up, land-clipped
    parishs.geojson        # 10,634/10,717 parish/ward polygons (73 inferred, 14 island parishes include water)
    subcountys.geojson    # 2,190/2,191 subcounty/town council/division polygons (3 inferred)
    countys.geojson       # 322/322 county/municipality polygons, each the union of its subcounties
    citys.geojson          # 10 city polygons
    districts.geojson    # 136 district polygons, each including any city carved from it
    regions.geojson       # 4 region polygons, dissolved from districts.geojson by region_id
    subregions.geojson    # 17 sub-region polygons, dissolved from districts.geojson by subregion_id
    settlements.geojson   # 15 refugee-settlement outlines, informational (their land is in the host subcounties)
    gaps.geojson           # 23 parish-level areas of land no single unit can yet be given, with candidates
    roads.geojson          # 10,721 major-road-network segments, OSM-derived, not tied to any admin unit
  crosswalk/
    ubos-2024.csv          # UBOS code <-> unit id crosswalk, per level (district/subcounty/parish), generated
    hdx-cod-ab-uga.csv    # OCHA COD-AB P-code <-> unit id crosswalk, one row per COD-AB unit (generated)
  qa/
    boundary-agreement.csv # per subcounty: IoU vs UBOS NPHC 2024 and vs OCHA COD-AB 2020 polygons (generated)
  population/
    uganda-nphc-2024-population.csv   # 146 rows (136 districts + 10 cities), 2024 census male/female/total
    ubos-nphc-2024-subcounty.csv      # 2,180 EC subcounties, 2024 census male/female/total (generated by the UBOS ingest)
  country/
    uganda.json          # ISO codes, currency, calling code, timezone, etc.
    assets/               # flag + coat of arms, SVG and PNG
  legacy/
    counties_2015_statoids.csv       # superseded by data/ec/; kept for provenance only, ~2015 vintage
    subcounties_legacy_source.csv    # the project's original location.csv, kept for reference (superseded by data/ec/)
    provenance/
      ec/               # the EC PDF parser, validation logs, and regeneration instructions
schema/
  administrative-unit.schema.json    # the record shape everything compiles to
  country.schema.json                # the shape of data/country/uganda.json
scripts/
  build.mjs                          # data/*.csv + data/ec/*.json + data/geo/*.geojson -> dist/
  ingest-ec-admin-units.mjs          # parsed EC village data -> schema-shaped units
  ingest-ubos-boundaries.mjs         # raw UBOS NPHC 2024 + BEC 2025 polygons -> data/geo/{parishs,subcountys,countys,citys,districts,gaps,settlements}.geojson + data/crosswalk/ubos-2024.csv + data/population/ubos-nphc-2024-subcounty.csv
  build-region-boundaries.mjs        # dissolves data/geo/districts.geojson by region_id / subregion_id -> data/geo/{regions,subregions}.geojson
  ingest-hdx-cod-ab.mjs              # raw COD-AB ADM1-4 -> data/crosswalk/hdx-cod-ab-uga.csv (P-codes only; COD-AB geometry used as a match test, not published)
  compare-boundaries.mjs             # published subcounties vs UBOS NPHC 2024 and COD-AB 2020 polygons -> data/qa/boundary-agreement.csv
  ingest-roads.mjs                   # raw HOTOSM roads shapefile -> data/geo/roads.geojson (major road network)
  lib/tessellate.mjs                 # per-district cleaning: de-overlap, sliver gaps to neighbours, equidistant splits
  lib/topo.mjs                       # one-topology simplification shared by every boundary layer
  lib/fit-to-district.mjs            # district-fit test for COD-AB matches; sliver/pinhole helpers
  validate.mjs                       # structural + referential-integrity check of the build output (incl. ring winding)
dist/                    # generated by `npm run build`; mostly committed for direct use — see "Using the data" below
docs/
  ROADMAP.md
  DATA_QUALITY.md
  CONTRIBUTING.md
```

## Using the data

**Not writing code?** Download [`dist/uganda-locations-full.csv`](dist/uganda-locations-full.csv)
directly from this repo and open it in Excel or Google Sheets — one row per
village (71,230 rows), with region/sub_region/district/county/constituency/
subcounty/parish/village columns plus a confidence flag, a `parish_id`
column that joins each village to its parish in `parishs.json`/
`wards.json`, and a final `hdx_pcode` column (the OCHA P-code of the
village's subcounty — see "Joining humanitarian data" below). That's the
whole dataset in one file.

**Writing JS/TS?**

```bash
npm install uganda-locale
```

Or install straight from GitHub to track unreleased master:

```bash
npm install github:kakandemanwell/uganda
```

```js
import * as uganda from "uganda-locale";

uganda.regions();                              // 4 administrative regions
uganda.subregions();                            // 17 cultural/traditional sub-regions (Buganda, Acholi, Ankole, ...)
uganda.districts();                             // 136 districts (incl. Kampala) — each has region_id, subregion_id, population
uganda.districts().filter((d) => d.subregion_id === "subregion:acholi");
uganda.districts().find((d) => d.slug === "wakiso").population; // { year: 2024, male, female, total: 3411177 }
uganda.counties({ districtId: "district:mbarara" });
uganda.subcounties({ parentId: "county:mbarara-kashari-north-county" });
uganda.getAncestors("subcounty:hoima-buhanika"); // walk up to region
uganda.search("kampala");                        // name/alias search
uganda.country();                                // ISO codes, currency, flag paths, etc.
```

The default import bundles region → district/city → county/municipality →
subcounty/town council/division (~1.3MB), plus the 17-record subregion
lookup table (`subregion_id` on every district/city points into it). Parish/ward/cell data (~5MB more)
is opt-in, so plain installs stay light:

```js
import * as uganda from "uganda-locale/deep";

uganda.parishes({ parentId: "subcounty:hoima-buhanika" });
uganda.cells({ parentId: "parish:some-ward" }); // urban wards only
```

Boundary polygons (for map visualization) are a separate opt-in too, since
most consumers building dropdowns/lookups don't need geometry payloads:

```js
import * as geo from "uganda-locale/geo";

geo.districtBoundaries();  // GeoJSON FeatureCollection, 136 features (each includes any city carved from it)
geo.cityBoundaries();      // GeoJSON FeatureCollection, 10 features
geo.regionBoundaries();    // GeoJSON FeatureCollection, 4 features
geo.subregionBoundaries(); // GeoJSON FeatureCollection, 17 features (dissolved from the districts by subregion_id)
geo.countyBoundaries();    // GeoJSON FeatureCollection, 322 features
geo.subcountyBoundaries(); // GeoJSON FeatureCollection, 2,190 features (of 2,191)
geo.parishBoundaries();    // GeoJSON FeatureCollection, 10,634 features (of 10,717)
geo.gaps();                // GeoJSON FeatureCollection, 23 features — land not yet assignable to one unit, with candidates
geo.settlements();         // GeoJSON FeatureCollection, 15 features — refugee-settlement outlines (informational, not admin units)
geo.roads();               // GeoJSON FeatureCollection, 10,721 features (major road network; not tied to any admin unit)
```

Every boundary feature carries `properties.id` (the unit id), `area_km2`
(land area), `hdx_pcode` (see below) and `ubos_code` where UBOS has the same
unit; district and city features also carry `population`, as do
subcounties (2024 census, where UBOS has a figure) and counties (the sum of
their subcounties, `partial: true` when one is missing). Subcounty features
also carry `agreement: { ubos_nphc_iou, hdx_iou }` — how closely the
polygon matches UBOS's NPHC 2024 and OCHA's COD-AB 2020 drawing of the
same unit (see [`docs/DATA_QUALITY.md`](docs/DATA_QUALITY.md)). Some
features say how they were derived: `inferred: true` plus an `inference`
note (a unit deduced from leftover land under the territorial rule), and
`includes_water: true` on island parishes that keep their full legal
outline. Each gap feature lists `candidate_ids`/`candidate_names` — the
units it could be; each settlement feature lists the `host_subcounty_ids`
its land was split between. Check `properties.id` against your own unit
list rather than assuming a layer is complete.

Rural village-level data (71,230 records, ~33MB as JSON) is **not** bundled
in the npm package — use `dist/uganda-locations-full.csv` from this repo, or
the API (below), instead. Every function returns plain objects shaped like
[`schema/administrative-unit.schema.json`](schema/administrative-unit.schema.json).

**Just want an HTTP API?** A minimal Next.js app in [`web/`](web/) exposes
the same data as JSON endpoints — see its README for routes once deployed.

**Writing in another language, or want the raw files directly?** Most of
`dist/` is committed too, so you can use the data straight from a
clone/download without running anything:
- `uganda-locations-full.csv` — full ancestry, one row per village, with its `parish_id` and its subcounty's `hdx_pcode` (~10.6MB)
- `uganda-locations.csv` — flattened, loosely backward-compatible with the original `location.csv` shape
- `regions.json`, `subregions.json`, `districts.json`, `citys.json`, `countys.json`, `subcountys.json`, `town_councils.json`, `divisions.json`, `parishs.json`, `wards.json`, `cells.json` — per-level exports
- `geo/regions.geojson`, `geo/subregions.geojson`, `geo/districts.geojson`, `geo/citys.geojson`, `geo/countys.geojson`, `geo/subcountys.geojson`, `geo/parishs.geojson`, `geo/gaps.geojson`, `geo/settlements.geojson` — boundary polygons for map visualization (processed UBOS data — cite UBOS, see [`LICENSE-DATA.md`](LICENSE-DATA.md)); `geo/roads.geojson` is ODbL
- `crosswalk/ubos-2024.csv` — UBOS code ↔ unit id crosswalk; `crosswalk/hdx-cod-ab-uga.csv` — OCHA COD-AB P-code ↔ unit id crosswalk (both also in the npm package)
- `data-quality-report.json` — coverage/gaps, regenerated every build
- `country/uganda.json` + `country/assets/` — country metadata and flag/coat-of-arms images

Two files are **not** committed because they're just heavier restatements of
the above (39MB and 33MB respectively, mostly redundant with the full CSV
and the smaller per-level files): the full unified `uganda-locations.json`
and the per-level `villages.json`. Get either by running:

```bash
npm run build
```

which regenerates all of `dist/` from `data/`.

`npm run build` doesn't touch the boundary geometry — the curated
`data/geo/*.geojson` files are committed. Rebuilding those from the raw
sources (UBOS API snapshots and the COD-AB release, both gitignored and
re-fetchable per [`data/sources.json`](data/sources.json)) runs, in order:

```bash
node --max-old-space-size=6000 scripts/ingest-ubos-boundaries.mjs   # parish -> subcounty -> county -> city/district, + settlements, gaps, subcounty population and the UBOS crosswalk
node scripts/build-region-boundaries.mjs  # regions and sub-regions, dissolved from the districts
node scripts/ingest-hdx-cod-ab.mjs        # OCHA P-code crosswalk
node scripts/compare-boundaries.mjs       # cross-dataset agreement -> data/qa/boundary-agreement.csv
npm run build
npm run validate
```

The UBOS ingest takes ~10 minutes, mostly the per-district tessellation
cleaning; `UBOS_REUSE_CLEAN=1` reuses the last run's cleaned pieces (a
gitignored cache next to the raw files) when iterating on the steps after
it. See [`data/legacy/provenance/geo/README.md`](data/legacy/provenance/geo/README.md).

## Joining humanitarian data (OCHA P-codes)

Most humanitarian and development datasets for Uganda (OCHA, UN agencies,
NGO 3W/4W reports, HDX) key their rows by OCHA **P-codes** from the COD-AB
administrative boundaries, not by name — names are spelled inconsistently,
and the same subcounty name recurs across districts. To make those joinable,
every record from region down to subcounty tier carries two P-code fields
in `external_refs`:

- **`hdx_pcode`** — the unit's *exact* COD-AB equivalent, where one exists
  (1,608 units). Only set when the name and the tier (subcounty vs. town
  council vs. division) both match within the right district.
- **`hdx_within_pcode`** — the most specific COD-AB unit that *contains*
  this one (all 2,663 eligible units). Units with no exact equivalent —
  the 10 cities, Terego, units created or split since 2020 — inherit it
  from their nearest ancestor (or, for Terego, from Arua, which it was
  split from). Use this one when you need *a* code for every unit and can
  live with some units rolling up to their parent.

P-codes nest: `UG` + 1 digit region, + 3 digits district, + 2 county, + 2
subcounty — e.g. `UG3` (Northern) → `UG3067` (Alebtong) → `UG306701`
(Moroto County) → `UG30670101` (Abako subcounty).

The full mapping, including COD-AB units that have *no* current
equivalent and why, is
[`dist/crosswalk/hdx-cod-ab-uga.csv`](dist/crosswalk/hdx-cod-ab-uga.csv)
(one row per COD-AB unit: `hdx_level`, `hdx_pcode`, `hdx_name`,
`hdx_parent_pcode`, `unit_id`, `match`, `note`). `match` is one of
`exact`, `split_from`, `predecessor` (the pre-2020 municipalities that
became cities — the cities are larger, so this is never treated as an
exact equivalence), `tier_mismatch`, `no_equivalent`, `unmatched`, or
`rejected_geometry` (a name match whose COD-AB polygon sits mostly in a
different district than ours — just two today, Bujenje county and Pakanyi
subcounty on the Masindi–Kiryandongo line, whose P-codes are withheld).
COD-AB is used for these codes only — none of its geometry is published.
It is the 2020 (`valid_on: 2020-08-24`) system, so any unit created since
has no exact code — that's expected, not a bug. See
[`docs/DATA_QUALITY.md`](docs/DATA_QUALITY.md) for the match counts.

## Joining UBOS data (UBOS codes)

UBOS's own tables — the 2024 census, the 2025 Baseline Education Census —
are keyed by UBOS's numeric codes, which nest by prefix: district 3 digits,
county 4, subcounty 6, parish 8. **12,820 units** carry
`external_refs.ubos_code`: every district and city, and the subcounty-tier
units and parishes where UBOS has the same unit under a matching name.
Boundary features carry the same value as `ubos_code`. The per-level
mapping, including UBOS units with no EC counterpart (e.g. subcounties
created after the EC's July 2022 gazetteer, recorded as `carved_from` the
unit they were carved out of, and refugee-settlement census units), is
[`dist/crosswalk/ubos-2024.csv`](dist/crosswalk/ubos-2024.csv) (`level`,
`ubos_code`, `ubos_name`, `unit_id`, `match`, `note`).

## License

- Code (`scripts/`, `schema/`): [MIT](LICENSE-CODE.md)
- Data (`data/`, `dist/`): [CC-BY 4.0](LICENSE-DATA.md) — attribute UBOS, the
  Electoral Commission of Uganda, OCHA/HDX, and Wikipedia/Statoids as
  applicable per [`data/sources.json`](data/sources.json). The boundary
  polygons are processed UBOS data (cite UBOS), the P-code crosswalk is
  CC BY-IGO (OCHA/UBOS) and the roads ODbL — see
  [`LICENSE-DATA.md`](LICENSE-DATA.md) for the per-file terms.

## Status

Early stage. Region through village is now verified for all (or nearly all)
district-equivalent units, and the compiled data is usable directly from
this repo (see "Using the data" above) or via the `uganda-locale` package
on npm (`npm install uganda-locale`). See
[`docs/ROADMAP.md`](docs/ROADMAP.md) for what's next — the zone/polling-station
layer and the hosted Vercel API.
