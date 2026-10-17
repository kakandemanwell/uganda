# Data License: CC BY 4.0

The contents of `data/` and `dist/` (the administrative-unit dataset itself)
are licensed under the [Creative Commons Attribution 4.0 International
license (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

You are free to share and adapt this data for any purpose, including
commercially, as long as you give appropriate attribution.

## Attribution

When using this dataset, credit both this project and the upstream sources
it compiles, per record provenance in `data/sources.json`. A reasonable
attribution line:

> Administrative unit data: uganda-locale project
> (https://github.com/<org>/uganda-locale), compiling data from the Uganda
> Bureau of Statistics, the Electoral Commission of Uganda, OCHA/HDX, and
> Wikipedia/Statoids. See NOTICE and data/sources.json for full source list.

Individual upstream sources may carry their own attribution expectations
(e.g. UBOS's citation-and-"processed"-label requirement for the boundary
polygons, OCHA/HDX Common Operational Datasets for the P-codes — both
below); consult `data/sources.json` for
the specific source(s) backing any given record via its `source_ids` field.

## Exception: `data/country/assets/coat-of-arms.svg` and `coat-of-arms.png`

These two files are **not** covered by the CC BY 4.0 license above. They are
sourced from Wikimedia Commons under **CC BY-SA 3.0 Unported**, which is
stricter: it requires both attribution *and* that derivative works using
this specific file be shared under the same or a compatible license. See
`data/sources.json` → `src-wikimedia-coa-uganda`.

`data/country/assets/flag.svg` and `flag.png` are public domain (see
`data/sources.json` → `src-wikimedia-flag-uganda`), but national symbols
carry usage restrictions independent of copyright in many jurisdictions
(e.g. rules against implying official government endorsement) — check your
own jurisdiction's rules on flag/emblem use before using these in a product.

## Note: boundary polygons — `data/geo/parishs.geojson`, `subcountys.geojson`, `countys.geojson`, `citys.geojson`, `districts.geojson`, `regions.geojson`, `subregions.geojson`, `gaps.geojson`, `settlements.geojson`

**Changed 2026-10-17.** These were described here first as CC0
(districts/regions, from geoBoundaries) and then, briefly, as CC BY-IGO
(OCHA COD-AB geometry). Neither applies any more. Every boundary layer is
now **processed Uganda Bureau of Statistics (UBOS) data**: built
bottom-up from the parish polygons of UBOS's Baseline Education Census
2025 and the district/subcounty polygons of its National Population and
Housing Census 2024 (`data/sources.json` → `src-ubos-bec-2025-geo`,
`src-ubos-nphc-2024-geo`), matched onto the Electoral Commission's units,
clipped to land, cleaned of UBOS's own overlaps and sliver gaps between
parishes, simplified, with some units inferred from leftover land,
refugee-settlement land split between host subcounties by inference, and
some land left as explicit gaps — see `docs/DATA_QUALITY.md`. The region
and sub-region files are derived entirely from the district geometry
(dissolved by `region_id` / `subregion_id`), and the settlement outlines
from UBOS's settlement census units, so they carry the same terms.

UBOS's guidelines allow its data to be reproduced with **citation to UBOS
and a link to the source**, and require **processed data to be labelled as
processed**. These files are processed, not UBOS's originals — the shapes,
the cleaning, the unit each polygon is attached to, the inferences (the
settlement splits among them) and the gaps are this project's work, and
errors in them are this project's, not UBOS's. When
you use or redistribute them, cite UBOS and keep that label. A reasonable
attribution line:

> Administrative boundaries: processed from Uganda Bureau of Statistics
> (UBOS) data — National Population and Housing Census 2024 and Baseline
> Education Census 2025 (https://statistics.ubos.org) — by the
> uganda-locale project. Not an official UBOS product.

Two other sources contribute to the land mask only, neither adding an
obligation beyond the above: [geoBoundaries](https://www.geoboundaries.org)'
Uganda ADM3 release, **CC0 1.0** (public domain, `src-geoboundaries-uga-adm3`),
for the coastline; and [Natural Earth](https://www.naturalearthdata.com)'s
10m lakes, **public domain** (`src-natural-earth-10m-lakes`), for the lake
extents. geoBoundaries' ADM4 layer and OCHA COD-AB's geometry are no longer
used in any published polygon.

## Note: `dist/crosswalk/hdx-cod-ab-uga.csv` and the `hdx_pcode` / `hdx_within_pcode` fields

These come from OCHA's Common Operational Dataset for Uganda's
administrative boundaries (COD-AB, HDX `cod-ab-uga`, sourced from UBOS),
licensed **[CC BY-IGO](https://creativecommons.org/licenses/by/3.0/igo/)**
— see `data/sources.json` → `src-hdx-cod-ab-uga`. COD-AB is used for its
P-codes (and names, in the crosswalk) only — the same terms cover the
`hdx_pcode` property on boundary features. CC BY-IGO is attribution-only,
like this project's own CC BY 4.0 default (not share-alike, not more
restrictive), but **attribution to OCHA and UBOS is required** when you use
or redistribute the crosswalk or the P-code fields:

> P-codes: Uganda Bureau of Statistics (UBOS), via OCHA Common Operational
> Dataset (COD-AB), Humanitarian Data Exchange
> (https://data.humdata.org/dataset/cod-ab-uga), CC BY-IGO.

`dist/crosswalk/ubos-2024.csv` and the `ubos_code` fields are UBOS codes —
cite UBOS, as for the boundary polygons above.

## Note: `data/qa/boundary-agreement.csv` and the `agreement` field

Generated by this project (`scripts/compare-boundaries.mjs`): per
subcounty, the overlap (IoU) between this project's polygon and UBOS NPHC
2024's and OCHA COD-AB 2020's polygons for the same unit. Only the
resulting numbers are published, no geometry from either source. They are
derived from both, so cite UBOS (as above) and, for `hdx_iou`, OCHA/UBOS
under CC BY-IGO (as for the P-codes above).

## Note: `data/geo/parishs.geojson` — earlier retraction

Releases 0.9.0–0.9.1 shipped 423 polygons in this file described as parish
boundaries (HDX/UBOS, CC BY-IGO, `src-hdx-cod-ab-uga-admin4-parish`). They
turned out to be subcounty polygons misattached to parishes and were
withdrawn on 2026-10-17 — see `docs/DATA_QUALITY.md`. None of that geometry
remains; the file now holds the processed UBOS parish polygons covered by
the note above.

## Note: satellite imagery and terrain on the website are not part of this dataset

The `/map` page's satellite basemap is Esri World Imagery, shown under
Esri's terms with "Powered by Esri" attribution and fetched through a
server-side tile proxy. The tiles are only cached by browsers/CDN for
display; they are never copied into `public/`, `data/` or `dist/`, so
nothing covered by this license contains Esri imagery.

The same goes for the map's optional 3D terrain and hillshade: elevation
comes from AWS Terrain Tiles (Mapzen terrarium encoding, public, no key),
fetched by the viewer's browser straight from the public bucket and
attributed on the map ("Elevation: AWS Terrain Tiles (Mapzen)"). Nothing
from it is stored in this repo. The right-click menu's links to Google
Maps, Street View, Mapillary and OpenStreetMap are plain links to those
sites; no imagery from them is fetched or kept.

## Exception: `data/geo/roads.geojson`

Sourced from OpenStreetMap (via HDX's HOTOSM export) — see
`data/sources.json` → `src-hotosm-uga-roads`. OSM data is licensed
**ODbL 1.0 (Open Database License)**, which is **stricter** than this
project's CC BY 4.0 default: it requires attribution AND that any produced
work using this specific data be shared under ODbL or a compatible
share-alike license (not simply CC BY). If you redistribute or build on
`data/geo/roads.geojson` specifically, comply with ODbL's share-alike terms
for that file, separately from the CC BY 4.0 terms covering the rest of
this dataset.

## Note: `data/population/uganda-nphc-2024-population.csv`, `ubos-nphc-2024-subcounty.csv` and the `population` field

Sourced from UBOS's National Population and Housing Census 2024 Final
Report -- see `data/sources.json` -> `src-ubos-nphc2024-final-report`. No
explicit copyright or license statement was found anywhere in that report
(searched directly for "copyright", "license", "creative commons", and the
copyright symbol -- no matches). This is treated as public government
statistical data for the purposes of this project's CC BY 4.0 default,
consistent with how other UBOS-sourced content is already handled here
(e.g. the sub-region taxonomy), but this is a judgment call, not a
confirmed license -- flagged here rather than silently assumed. (Update
2026-10-17: UBOS's general usage guidelines, identified while sourcing the
boundary polygons above, allow reproduction with citation to UBOS and a
link, with processed data labelled as processed -- consistent with how
this file is treated. Cite UBOS's NPHC 2024 Final Report.)

`data/population/ubos-nphc-2024-subcounty.csv` and the `population` on
subcounty and county boundary features come from UBOS's NPHC 2024
dissemination API (`src-ubos-nphc-2024-geo`) instead, under the same UBOS
guidelines, and are **processed**: each UBOS subcounty's count is assigned
to the EC subcounty that owns its land, and county figures are sums. Cite
UBOS's NPHC 2024 and keep the "processed" label, as for the boundary
polygons above.
