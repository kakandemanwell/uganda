// uganda-locale/geo — opt-in: region/district boundary polygons (GeoJSON),
// for map visualization. Not loaded by the default import since most
// consumers building dropdowns/lookups don't need geometry payloads.
//
// District boundaries are geoBoundaries' CC0 Uganda ADM3 release, remapped
// onto this project's own district ids (see
// scripts/ingest-district-boundaries.mjs). Region boundaries are dissolved
// from that same district geometry by region_id, not sourced independently
// (see scripts/build-region-boundaries.mjs) — this keeps them exactly
// consistent with region_id as assigned in data/districts.csv. Nothing
// below district level (county/subcounty/parish/village) is included: no
// free, current, sufficiently-complete boundary source was found for those
// tiers — see docs/DATA_QUALITY.md for what was evaluated and rejected.
import { readFileSync } from "node:fs";
import path from "node:path";
import { DIST } from "./store.mjs";

let districtsCache;
let regionsCache;

/** GeoJSON FeatureCollection of all 136 district boundaries. Each feature's properties.id matches a district record's id. */
export function districtBoundaries() {
  if (!districtsCache) {
    districtsCache = JSON.parse(readFileSync(path.join(DIST, "geo/districts.geojson"), "utf-8"));
  }
  return districtsCache;
}

/** GeoJSON FeatureCollection of all 4 region boundaries. Each feature's properties.id matches a region record's id. */
export function regionBoundaries() {
  if (!regionsCache) {
    regionsCache = JSON.parse(readFileSync(path.join(DIST, "geo/regions.geojson"), "utf-8"));
  }
  return regionsCache;
}
