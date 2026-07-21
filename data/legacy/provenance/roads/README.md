# Provenance: road network (`data/geo/roads.geojson`)

Sourced from HDX's **HOTOSM Uganda Roads** export (Humanitarian OpenStreetMap
Team, via HDX's Raw Data API / `oex` export tool), itself a Geofabrik
snapshot of OpenStreetMap dated 2026-06-22. See `data/sources.json` →
`src-hotosm-uga-roads`, and `config.yaml`/`metadata.json`/`README.txt` in
this folder (the small provenance files from the original export bundle;
the multi-hundred-MB shapefile itself is not committed — re-fetch from the
URL in `src-hotosm-uga-roads` if needed).

## What was actually shipped, and what wasn't

The raw export is 681,317 features (lines/points/polygons combined). This
project only ingests the **lines** layer, and only a subset of it:

| Cut | Features | Size | Shipped? |
|---|---|---|---|
| All lines (every `highway=*` value, incl. path/track/footway/service/steps) | 678,054 | huge | No |
| "Classified" roads (adds unclassified+residential, drops path/track/footway/service/steps/cycleway/etc) | 278,185 | 77.8MB | No — evaluated, too heavy and still ~89% unnamed |
| **Major road network** (motorway/trunk/primary/secondary/tertiary + `_link` variants) | **10,721** | **~3.6MB (simplified)** | **Yes — this is `data/geo/roads.geojson`** |

The two biggest categories in the raw data are `path` (237,482 features) and
`track` (95,304) — informal footpaths and tracks, not roads. **98.8% of all
681,317 features have no `name` tag at all** (only 4,072 distinct names
across the whole country) — this is a real, confirmed gap in Uganda's OSM
coverage, not an extraction artifact. Even the "classified roads" cut
(which still includes `residential`/`unclassified`, i.e. most informally
mapped neighborhood streets) is only about 11% named. The major-road-only
cut shipped here is about 29% named (3,078 of 10,721) — every real
motorway/trunk/primary road segment plus a meaningful fraction of secondary/
tertiary roads have a name; most residential streets don't.

## How it was processed

1. Downloaded `hotosm_uga_roads_osm_shp.zip` (181MB) via the HDX Raw Data
   API URL in `src-hotosm-uga-roads` (a plain `curl`, no auth/TLS issues
   this time — unlike ubos.org, this host was directly reachable).
2. No `ogr2ogr`/GDAL available in this environment, so the shapefile was
   parsed directly with the pure-JS `shapefile` npm package (a dev-only
   dependency — see `package.json`, never shipped in the published
   package) via `scripts/ingest-roads.mjs`, streaming through all 678,054
   line records (the `.dbf` attribute table alone is ~1.3GB) without
   loading the whole thing into memory at once.
3. Filtered to `highway` values in `{motorway, motorway_link, trunk,
   trunk_link, primary, primary_link, secondary, secondary_link, tertiary,
   tertiary_link}`.
4. Simplified (`@turf/turf`, tolerance 0.0005° ≈ 55m at the equator — finer
   than the boundary layers' 0.001° since thin road lines visibly distort
   more from aggressive simplification than area polygons do).

## What's NOT in this dataset

- **No street addressing** (`addr:housenumber`/`addr:street`) — essentially
  absent from OSM's Uganda coverage entirely, not just filtered out here.
- **No link to administrative units.** OSM road features carry no
  district/subcounty/parish tag, and computing one would require a spatial
  join against this project's own (partial) boundary layers — not
  attempted in this pass; roads ship as an independent layer.
- **No residential/unclassified streets** in the shipped file (see table
  above) — the full 278,185-feature classified-roads cut and the complete
  681,317-feature raw export remain available directly from the source URL
  for anyone who needs the full street/track graph; re-running
  `scripts/ingest-roads.mjs` against a re-downloaded extract with a wider
  `MAJOR_HIGHWAY` set would reproduce it.
