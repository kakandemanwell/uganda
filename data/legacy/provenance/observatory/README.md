# Observatory raw snapshots

Written by `scripts/observatory/fetch-public-sources.mjs`. Fetch-only: nothing
here is consumed by `scripts/build.mjs` yet. `manifest.json` records the URL,
byte count, sha256 and feature/row count of every file, plus any failures.

| Folder | Source | Notes |
|---|---|---|
| `ubos-nphc-2024/` | UBOS NPHC 2024 dissemination API (`statistics.ubos.org/nphc/api/`) and the Subcounty Profiles workbook | `districts.json`, `regions.json`, `countys.json` (the repo's own plural), `subcounties/<DCode>.json`. Features carry UBOS codes (district 3 digits, county 4, subcounty 6) and 2024 population. Responses are wrapped: `{ geojson, level, population_data, indicator }`. |
| `ubos-bec-2025/` | UBOS Baseline Education Census 2025 API (`statistics.ubos.org/bec/api/`) | `parishes/<DCode>.json`: official parish polygons with 8-digit parish codes (`code`, e.g. `30410601`) and school/learner counts. |
| `mlhud-ugnlis/` | MLHUD UgNLIS reference dictionaries | `mzo.json` (Ministry Zonal Offices), `dlb.json` (District Land Boards -> MZO). Internal `ip` fields stripped. Small and tracked. |

Licence: UBOS data may be reproduced with citation to UBOS and a link, and
processed data must be labelled as processed (UBOS guidelines on usage and
reproduction of data). MLHUD dictionaries carry no stated licence; they are
non-personal reference lists, cite MLHUD.

Raw geometry is git-ignored (re-fetchable); see `.gitignore`.
