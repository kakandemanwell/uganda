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
(e.g. OCHA/HDX Common Operational Datasets); consult `data/sources.json` for
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

## Note: `data/geo/districts.geojson` and `data/geo/regions.geojson`

The underlying district boundary geometry is sourced from
[geoBoundaries](https://www.geoboundaries.org)' Uganda ADM3 release, itself
licensed **CC0 1.0** (public domain) — see `data/sources.json` →
`src-geoboundaries-uga-adm3`. This is *more* permissive than this project's
own CC BY 4.0, not stricter, so no separate exception applies; it's noted
here only for transparency about where the raw geometry comes from. The
region-level file is derived entirely from that same district geometry
(dissolved by `region_id`, not sourced independently — see
`scripts/build-region-boundaries.mjs`), so the same CC0 origin applies to
it too.

## Note: `data/geo/subcountys.geojson` and `data/geo/parishs.geojson`

Sourced from geoBoundaries (CC BY 3.0 IGO) and HDX/UBOS (CC BY-IGO)
respectively — see `data/sources.json` → `src-geoboundaries-uga-adm4` and
`src-hdx-cod-ab-uga-admin4-parish`. Both are attribution-only licenses, like
this project's own CC BY 4.0 default (not share-alike, not more
restrictive) — noted here for transparency and attribution completeness,
not as a stricter exception.

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

## Note: `data/population/uganda-nphc-2024-population.csv` and the `population` field

Sourced from UBOS's National Population and Housing Census 2024 Final
Report -- see `data/sources.json` -> `src-ubos-nphc2024-final-report`. No
explicit copyright or license statement was found anywhere in that report
(searched directly for "copyright", "license", "creative commons", and the
copyright symbol -- no matches). This is treated as public government
statistical data for the purposes of this project's CC BY 4.0 default,
consistent with how other UBOS-sourced content is already handled here
(e.g. the sub-region taxonomy), but this is a judgment call, not a
confirmed license -- flagged here rather than silently assumed.
