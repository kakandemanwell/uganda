# Provenance: boundary geometry (parish → subcounty → county → city/district → region / sub-region)

Rewritten 2026-10-17, when the boundary layers were rebuilt bottom-up from
UBOS's own current polygons. (An intermediate build earlier the same day
used OCHA's COD-AB release for geometry; it is superseded, and COD-AB now
supplies P-codes only — see "COD-AB: P-codes only" below.) The short
version:

| File | Source | Coverage |
|---|---|---|
| `data/geo/parishs.geojson` | UBOS BEC 2025 parish polygons, matched to EC parishes | 10,634 / 10,717 (99.2%) — 73 inferred, 14 include water |
| `data/geo/subcountys.geojson` | union of the UBOS land each EC subcounty owns | 2,190 / 2,191 — 3 inferred |
| `data/geo/countys.geojson` | union of each county's subcounties | 322 / 322 |
| `data/geo/citys.geojson` | all the land in each city | 10 / 10 |
| `data/geo/districts.geojson` | all the land in each district, plus any city carved from it | 136 / 136 |
| `data/geo/regions.geojson` | dissolved from the district layer by `region_id` | 4 / 4 |
| `data/geo/subregions.geojson` | dissolved from the district layer by `subregion_id` | 17 / 17 |
| `data/geo/gaps.geojson` | land no single unit can be given yet, with candidates | 23 features, ~722 km², all parish-level |
| `data/geo/settlements.geojson` | UBOS refugee-settlement census units' outlines — informational; the land is split between host subcounties | 15 features, ~870 km² |
| `data/crosswalk/ubos-2024.csv` | UBOS code ↔ this project's unit ids, per level | one row per UBOS unit (parish: one per surviving piece) |
| `data/crosswalk/hdx-cod-ab-uga.csv` | COD-AB ADM1–ADM4 P-codes ↔ this project's unit ids | one row per COD-AB unit |
| `data/population/ubos-nphc-2024-subcounty.csv` | UBOS NPHC 2024 population per UBOS subcounty, assigned to EC subcounties | 2,180 subcounties |
| `data/qa/boundary-agreement.csv` | IoU of each published subcounty vs UBOS NPHC 2024 and COD-AB 2020 | 2,190 rows |

Pipeline (each step reads the previous one's output):

```bash
node --max-old-space-size=6000 scripts/ingest-ubos-boundaries.mjs   # parishs, subcountys, countys, citys, districts, gaps, settlements + crosswalk/ubos-2024.csv + population/ubos-nphc-2024-subcounty.csv
node scripts/build-region-boundaries.mjs  # regions and subregions, dissolved from districts
node scripts/ingest-hdx-cod-ab.mjs        # crosswalk/hdx-cod-ab-uga.csv (P-codes)
node scripts/compare-boundaries.mjs       # qa/boundary-agreement.csv
npm run build
npm run validate
```

The UBOS ingest takes ~10 minutes, most of it the per-district cleaning
(step 3 below). `UBOS_REUSE_CLEAN=1` reuses the last run's cleaned pieces
from `data/legacy/provenance/ubos/cleaned-pieces.json` (gitignored, next to
the raw files) when iterating on the later steps; a normal run never reads
it. `TOPO_QUANTIZATION` overrides the topology grid (default 1e6 — see
step 11).

`scripts/ingest-district-boundaries.mjs`, `scripts/ingest-subcounty-boundaries.mjs`
and `scripts/ingest-parish-boundaries.mjs` no longer exist.

## The rule the build follows

The territorial rule (stated in full in `docs/DATA_QUALITY.md`):
**no new land is ever created** — country, region and district outlines
are fixed, and every level tiles its parent completely; **a new unit is
always carved out of existing ones** — a new subcounty regroups the
parishes of the old one(s), a new parish regroups villages; and **an
unmapped area inside a mapped parent is the missing unit(s)** — its
boundary already exists as the gap between its documented neighbours, to
be filled by inference or by finding data, never treated as "no land".
Everything below is that rule applied literally.

## Raw sources (not committed — re-fetch)

- **UBOS NPHC 2024 dissemination API** — `data/legacy/provenance/ubos/ubos-nphc-2024/`
  (gitignored). Districts:
  `https://statistics.ubos.org/nphc/api/get_geospatial_data.php?level=district`
  (147 features: 136 districts + the 10 cities as separate districts,
  Kampala in 2 features; also `level=county` and `level=region`, fetched
  but not used). Subcounties, one request per district:
  `…/get_geospatial_data.php?level=subcounty&district_code=<DCode>`
  (2,206 features, 2,205 codes). Features carry 2024 population. See
  `data/sources.json` → `src-ubos-nphc-2024-geo`.
- **UBOS Baseline Education Census 2025 API** — `data/legacy/provenance/ubos/ubos-bec-2025/`
  (gitignored). Parishes, one request per district:
  `https://statistics.ubos.org/bec/api/get_geo.php?level=parish&indicator=primary_schools_total&parent_level=district&parent_code=<DCode>`
  (10,831 features, with school/learner counts). See
  `src-ubos-bec-2025-geo`.
- Both were snapshotted 2026-10-17 by the research/observatory session —
  `scripts/observatory/fetch-public-sources.mjs` on branch
  `research/observatory`, 303 files, no failures, one request per second —
  and copied into `data/legacy/provenance/ubos/`, whose
  `manifest-observatory.json` records each file's URL, size and sha256.
- **geoBoundaries Uganda ADM3** (`geoBoundaries-UGA-ADM3.geojson`, CC0, in
  this directory) — used only for its coastline (the land mask, below).
  See `src-geoboundaries-uga-adm3`.
- **Natural Earth 10m lakes**, Uganda subset (`ne-10m-lakes-uganda.geojson`,
  public domain, **committed** in this directory; 7 features, from
  nvkelso/natural-earth-vector v5.1.2). See `src-natural-earth-10m-lakes`.
- **OCHA COD-AB Uganda** — HDX `cod-ab-uga`, resource
  `uga_admin_boundaries.geojson.zip`, unzipped to `hdx-cod-ab/`
  (`uga_admin0`…`uga_admin4.geojson`; gitignored). UBOS-sourced,
  `valid_on: 2020-08-24`, CC BY-IGO. Get the current resource URL from the
  CKAN API: `https://data.humdata.org/api/3/action/package_show?id=cod-ab-uga`.
  HDX may answer 403 to non-browser user agents; `curl` with a browser
  `User-Agent` works. See `src-hdx-cod-ab-uga`.
- No longer read by anything, if present locally (gitignored):
  `geoBoundaries-UGA-ADM4.geojson` and `hdx-uga-admin4-parish.geojson`.

UBOS codes nest by prefix: district 3 digits, county 4 (district + 1),
subcounty 6 (county + 2), parish 8 (subcounty + 2) — every parish code's
first 6 digits is its UBOS subcounty code. That's what lets a parish say
which subcounty it's in without any geometry test.

**Licence.** UBOS data may be reproduced with citation to UBOS and a link;
processed data must be labelled as processed. Every layer in `data/geo/`
except `roads.geojson` is processed UBOS data — see `LICENSE-DATA.md`.
Deliberately **not** used: MWE's WEIS GeoServer, whose terms forbid
automated access without written permission (`src-mwe-weis-geoserver-not-used`).

## How `scripts/ingest-ubos-boundaries.mjs` works

1. **Parish matching.** Each UBOS parish polygon is matched to an EC (July
   2022) parish: same district, same name, with tier words ("ward", "town
   council", "TC", "TOWNCOUNCIL") normalised. A name repeated inside a
   district is disambiguated by subcounty; a unique near-miss spelling
   (edit distance ≤ 1 for names of 6+ characters, ≤ 2 for 10+) is
   accepted only inside the expected subcounty; two UBOS parishes claiming
   one EC parish are both dropped rather than one picked. Result: 10,466
   exact, 98 fuzzy, 267 UBOS parishes unmatched. The crosswalk lists only
   the parish pieces that reach the output — 10,465 exact, 98 fuzzy, 144
   unmatched: the 123 parishes of the refugee-settlement units are split
   between host subcounties (step 7), and Lubya (Buvuma, `12010603`) lost
   all its land in the overlap removal (step 3), so
   `parish:buvuma-lubya-town-council-lubya` has no polygon or `ubos_code`.
2. **Subcounty matching.** UBOS subcounties are matched to EC
   subcounty-tier units (subcounty, town council, division) by name and
   tier within the district: 2,105 exact, 7 fuzzy, 75 `carved_from`, 18
   unmatched. `carved_from` = a UBOS subcounty created after the EC's 2022
   gazetteer; its land is assigned to the EC subcounty most of its parishes
   came from. Of the 18 unmatched, 15 are refugee-settlement census units;
   the other 3 are Iceme, Nyakabungo and Kiryandongo Town Councils.
3. **Cleaning each district's tessellation** (`scripts/lib/tessellate.mjs`,
   step "4b" in the script). UBOS's BEC 2025 parish polygons aren't one
   topology: per district they overlap their neighbours by ~0.3–0.4 km²
   (65–99 overlapping pairs) and leave ~4 km² of gaps against the district
   outline in 1,000–1,800 slivers (Alebtong: 4.25 km² in ~1,854 parts —
   ~1,258 under 100 m², ~420 between 0.01 and 10 ha, the visible wedges).
   UBOS's NPHC subcounty layer has similar gaps (~3.5 km² per district).
   Per district, with the UBOS district polygon clipped to land as the
   frame: (a) every parish is clipped to the frame; (b) overlaps go to the
   parish earlier in UBOS-code order; (c) gaps under 100 m² are ignored as
   float noise, gaps up to 2 ha go whole to the nearest neighbour, gaps of
   2 ha–5 km² are split between the parishes they touch by nearest-
   neighbour ("equidistant") allocation — triangulated with earcut
   (`turf.tesselate`), each triangle to the neighbour whose border vertex
   is nearest its centroid — and anything over 5 km² is not assigned but
   published as a gap (`kind: "unassigned_chunk"`, candidates = the
   touching units; e.g. an unmapped lake). A Voronoi-cell split was tried
   first and abandoned: clipping the cells produced near-coincident float
   edges that sent polyclip into a runaway allocation (6 GB on one Mityana
   sliver). Coordinates are truncated to 6 dp (~0.1 m) before clipping;
   every clipping op retries once on truncated input and falls back rather
   than crashing (0 fallbacks in the final run). National totals: 53.2 km²
   of overlaps removed, 409.5 km² of gaps filled (43,157 slivers to the
   nearest neighbour, 5,307 equidistant splits), 1 piece fully overlapped
   (Lubya, step 1), 0 unassigned chunks. Measured on the published layers,
   Alebtong's gaps went from 4.25 km² to 0.067 km² (16 parts over 100 m²)
   and its overlaps from 0.36 km² to 0.015 km²; the residual comes from the
   topology simplification (step 11 — clipping output sometimes carries an
   extra vertex on one side of a shared border). A coarser topology grid
   (1e5) was tried and was worse — overlaps doubled — so 1e6 stays.
4. **Land ownership.** Every piece of UBOS land gets an owner — an EC
   subcounty-tier unit — in order of evidence: its matched EC parish's
   subcounty (10,564 pieces); else its UBOS subcounty's name match (84);
   else the carved-from majority (52); else none (131 pieces: 123 are the
   refugee-settlement units' parishes, split in step 7; the rest become
   gaps). The build also checks that each UBOS subcounty is covered by its
   parishes: where it isn't (BEC lacking a parish polygon), the uncovered
   remainder is kept as an unnamed piece of that subcounty, so no land can
   be lost between the two APIs.
5. **Union upward.** Subcounty = its owned land; county = union of its
   subcounties; city = all the land in it; district = all the land in it
   plus any city carved from it; region = union of its districts, and
   sub-region likewise by `subregion_id` (`scripts/build-region-boundaries.mjs`).
6. **Inference.** A subcounty with exactly one unmatched EC parish and
   owned land left over: that land is the parish (73 parishes,
   `inferred: true`, `inference: "sole unmapped parish of its subcounty;
   this is the subcounty's remaining land"`). A district with exactly one
   subcounty without land and unowned land remaining: that land is the
   subcounty (3 — `kanungu-nyakabungo-town`, `kiryandongo-kiryandongo-town`,
   `oyam-icheme-town-council`; by name these are the 3 non-settlement
   unmatched UBOS subcounties in step 2, which the inference never looks at).
7. **Refugee settlements.** UBOS's 15 settlement census units — Nakivale
   (3 units), Kyangwali, Rwamwanja, Kyaka II, Palabek, Rhino Camp (Madi-
   Okollo and Terego), Imvepi, Palorinya, Lobule, Kiryandongo, and
   Adjumani's settlements (2 units) — have no EC or local-government
   counterpart; the land is administered by the host subcounties around
   it. Each settlement's land is split between the touching host
   subcounties of the same district by the equidistant method of step 3
   (inferred — no source here records the real lines), and its outline is
   written to `data/geo/settlements.geojson` (`id` `settlement:<ubos code>`,
   `name`, `ubos_code`, `district_id`, `host_subcounty_ids`, `note`,
   `source_ids`; `area_km2` added by the build). Settlement land belongs to
   the host subcounty but to none of its parishes, so it's excluded from
   the parish-leftover inference in step 6. Until this step existed the
   settlements were 11 subcounty-level gaps (~869 km²).
8. **Gaps.** Unowned land goes to `data/geo/gaps.geojson`: 23 parish-level
   features (~722 km²) where a subcounty's leftover land has 2+ unmatched
   EC parishes, listed as candidates. No subcounty-level gaps remain; the
   code would still write one for an unassigned chunk over 5 km² (step 3)
   or a settlement with no host to split it between (`kind:
   "refugee_settlement"`) — neither occurs now.
9. **Subcounty population.** Each UBOS subcounty's NPHC 2024 population
   goes to the EC subcounty that owns its land (name match, or the unit it
   was carved from) → `data/population/ubos-nphc-2024-subcounty.csv`
   (`id`, `male`, `female`, `total`, `ubos_codes`, `method` =
   `name_match` | `includes_carved_units`). Settlement units are excluded
   and UBOS's `#N/A` values skipped (no figure rather than 0): 2,180
   subcounties, 44,986,031 people vs 45,905,417 nationally — the ~919k
   difference is the settlement units, counted separately. Approximate
   where a UBOS subcounty's parishes were reorganised across EC units.
   `scripts/build.mjs` puts it on subcounty features and sums it to
   counties (`partial: true` where a subcounty has no figure).
10. **Water.** UBOS's polygons follow legal boundaries into the lakes.
    Water = UBOS's country outline minus the union of geoBoundaries' ADM3
    land (its "Lake Victoria" polygon removed, small gaps filled),
    *intersected with* the Natural Earth lakes buffered 3 km. The
    intersection matters: geoBoundaries' western border is wrong, and
    without it Bundibugyo's Semliki strip and parts of Kasese became
    "water" and 41 parishes vanished. A parish that clipping would erase
    entirely keeps its full legal outline with `includes_water: true` (14
    island parishes); nothing is dropped by clipping.
11. **One topology.** All the cleaned pieces are simplified together as one
    TopoJSON topology (`scripts/lib/topo.mjs`: quantization 1e6, a ~0.6 m
    grid; Visvalingam, minimum weight 2.5e-6 deg²; coordinates rounded to
    5 decimal places) *before* any union, so every shared border is one arc
    and every layer nests exactly inside the one above. Parts collapsed to
    zero area are dropped; a parish that collapses entirely is left out (2
    islet parishes). This is visualization precision, not survey-grade — go
    back to the raw UBOS responses for full precision.
12. **Winding.** Every output feature is rewound for d3-geo's spherical
    convention (exterior rings clockwise in lon/lat). `turf.union` returns
    planar-wound rings, which d3-geo reads as "the globe minus this
    polygon" — during this rebuild that made the web map frame South
    America. `scripts/validate.mjs` now fails any boundary feature with a
    counter-clockwise exterior ring.

Every feature carries `id`, `area_km2` (land), `hdx_pcode` (where COD-AB
has an exact equivalent) and `ubos_code` (where UBOS has the same unit);
districts and cities carry `population`, subcounties too (where UBOS has a
figure) and counties the sum of theirs (`partial: true` when one is
missing); subcounties carry `agreement: { ubos_nphc_iou, hdx_iou }` (see
below); counties carry `complete`, `subcounties_mapped`,
`subcounties_total`. Gap features carry `level`, `parent_id`,
`district_id`, `candidate_ids`, `candidate_names` and `area_km2`.

The one subcounty without a polygon is `subcounty:kampala-makerere-university`:
UBOS has no separate unit for it — its land is within Kawempe Division.

## Regions and sub-regions

`scripts/build-region-boundaries.mjs` unions the topology-clean district
polygons by `region_id`, and again by `subregion_id` for the 17 sub-regions
(`data/geo/subregions.geojson`). Neither is an independent source, so
neither can drift from the ids in `data/districts.csv`. Measured on the
current build: 215,511 km² of regions and 215,530 km² of sub-regions
against 215,579 km² of districts (within 0.03%).

## Cross-dataset boundary agreement

`scripts/compare-boundaries.mjs` writes `data/qa/boundary-agreement.csv`
(`id`, `name`, `district_id`, `ubos_nphc_iou`, `hdx_iou`, `flag`): for each
published subcounty, the intersection-over-union with UBOS NPHC 2024's
polygon for the same UBOS code and with COD-AB 2020's for the same P-code,
both restricted to the unit's own district land (both sources run into
lakes and spill slightly across district lines). A clipping failure leaves
the cell blank — "couldn't compare", never 0. Median IoU vs UBOS NPHC:
0.991 (2,110 compared); vs COD-AB: 0.753 (1,352 compared — COD-AB is the
2018–20 system and many units have split since, so this is context, not a
defect). `flag: review` uses UBOS NPHC only, at IoU < 0.8: 7 subcounties,
all refugee-settlement hosts that absorbed settlement land in step 7
(lowest: `subcounty:obongi-palorinya`, 0.546) — expected. `scripts/build.mjs`
copies both values onto the subcounty features and summarises them in
`dist/data-quality-report.json` → `boundary_agreement`. Raw inputs (both
gitignored): `data/legacy/provenance/ubos/ubos-nphc-2024/subcounties/` and
`hdx-cod-ab/uga_admin4.geojson`; either missing leaves its column blank.

## Why not geoBoundaries' or COD-AB's districts

The district layer used to be geoBoundaries ADM3 alone. It matched this
project's 136 districts by name, and nothing more was checked. Compared
polygon by polygon against UBOS-sourced outlines (COD-AB), it was
materially wrong for many districts: only 12 of 135 had
intersection-over-union ≥ 0.9 with their UBOS counterpart; its Kampala was
351 km² (official ~189 km²; the current layer has 179 km² of land) because
it swallowed Kira and Kasangati, both in Wakiso; Pader town fell inside
Agago; Wakiso came out at 1,747 km². geoBoundaries' internal lines are
wrong; its coastline is fine, which is the only thing it's used for now.

COD-AB fixed the districts but is the 2018–2020 system: its counties
could be matched for only 118 of 322 counties and its subcounties for
1,351 of 2,191 (units split or renamed since 2020 have no honest pre-split
polygon), and it has no parish level. UBOS's 2024/2025 polygons are newer
than the EC's 2022 gazetteer rather than older, which is what makes the
bottom-up build possible.

## COD-AB: P-codes only

`scripts/ingest-hdx-cod-ab.mjs` matches COD-AB ADM1–ADM4 against
`data/ec/administrative_units_ec2022.json` and writes
`data/crosswalk/hdx-cod-ab-uga.csv` (copied to `dist/crosswalk/`): one row
per COD-AB unit — `hdx_level`, `hdx_pcode`, `hdx_name`, `hdx_parent_pcode`,
`unit_id`, `match`, `note`.

- **Within each district family only** — the district, any city carved from
  it, and any district split from it since — because a 2018 subcounty may
  now sit under a newer district or a city.
- **Base name and tier must both match** — subcounty vs. town council vs.
  division. No tier-insensitive fallback, deliberately: a first pass that
  allowed one mapped the "Ibanda" county onto Ibanda Municipality and the
  2018 "Bitooma" subcounty onto today's Bitooma Town Council. Those land in
  the crosswalk as `tier_mismatch`.
- **District-fit test** (`scripts/lib/fit-to-district.mjs`, `{ clip: false }`):
  each matched COD-AB polygon must overlap the UBOS-derived district of its
  matched unit more than any other. It's a test only — no COD-AB geometry
  is clipped, kept or published. Failures become `rejected_geometry` and
  get no P-code: today just 2, both on the Masindi–Kiryandongo line —
  county Bujenje (`UG412501`) and subcounty Pakanyi (`UG41250103`), which
  COD-AB places mostly inside Kiryandongo while UBOS and the EC have them
  in Masindi. Bundingoma and Busunga Town Council (Bundibugyo), rejected
  by the intermediate build, now pass.
- COD-AB's ADM4 polygons are also read by `scripts/compare-boundaries.mjs`
  for the `hdx_iou` column of the agreement check above — again a
  comparison only, nothing published.
- `PCODE_OVERRIDES` holds hand-confirmed renames — currently Central
  Division `UG10080101` → `subcounty:kampala-kampala-central`.

| Level | Result |
|---|---|
| adm1 | 4 exact |
| adm2 | 135 exact, 1 `split_from` (Terego → Arua, `UG3072`) |
| adm3 | 117 exact, 10 `predecessor`, 66 unmatched, 5 `tier_mismatch`, 4 `no_equivalent`, 1 `rejected_geometry` |
| adm4 | 1,352 exact, 146 unmatched, 21 `tier_mismatch`, 1 `rejected_geometry` |

`predecessor` = the 10 pre-2020 municipalities that became cities (never an
exact equivalence — each city is larger). `no_equivalent` = COD-AB's "KCCA"
counties: Kampala's, plus three COD-AB mislabels as "KCCA" in Buikwe,
Mityana and Mukono. `scripts/build.mjs` turns the crosswalk into
`external_refs.hdx_pcode` / `hdx_within_pcode` on every unit and the
`hdx_pcode` column of `dist/uganda-locations-full.csv`; see
`docs/DATA_QUALITY.md` for how those are defined and validated.

COD-AB Uganda has exactly five levels — ADM0 country, ADM1 4 regions, ADM2
135 districts, ADM3 203 counties, ADM4 1,520 subcounties. **There is no
parish or village level in it.** Each feature carries its full ancestry
(`adm1_name`…`adm4_name` with matching `adm*_pcode`), e.g. the first ADM4
record is `adm4_name: "Abako"`, `adm3_name: "Moroto"` (Alebtong's Moroto
County), `adm2_name: "Alebtong"`, `adm4_pcode: "UG30670101"`.

## Retracted: the old COD-AB "parish" layer

Until 2026-10-17, `data/geo/parishs.geojson` held 423 polygons from COD-AB's
"admin4" layer, matched on (district, name) against this project's parishes
by the now-deleted `scripts/ingest-parish-boundaries.mjs`. This file used to
say that layer was "genuinely parish-level", reading `adm3_name` as
subcounty and `adm4_name` as parish. **That was wrong by one tier:** `adm3`
is the county and `adm4` the subcounty. The layer contains Kampala's five
divisions (Central, Kawempe, Makindye, Nakawa, Rubaga Division,
`UG10080101`–`05`); its P-codes are 8-digit subcounty codes under 6-digit
county codes; and its 1,520 features are the same tier as geoBoundaries'
1,521-feature subcounty layer — not a coincidence, as this file claimed.
The 423 "matches" were subcounty outlines attached to parishes that share
their subcounty's name (e.g. `parish:alebtong-abia-abia` got all of Abia
subcounty).

The file was briefly an empty FeatureCollection; it now holds the real
UBOS BEC 2025 parish polygons described above, and nothing from the
retracted layer. The old raw download (`hdx-uga-admin4-parish.geojson`,
gitignored, if present locally) is just COD-AB's ADM4 under another name
and is read by nothing. See `data/sources.json` → `src-hdx-cod-ab-uga-admin4-parish`.
