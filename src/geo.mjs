// uganda-locale/geo — opt-in: boundary polygons and road-network geometry
// (GeoJSON), for map visualization. Not loaded by the default import since
// most consumers building dropdowns/lookups don't need geometry payloads.
//
// District boundaries are geoBoundaries' CC0 Uganda ADM3 release, remapped
// onto this project's own district ids (see
// scripts/ingest-district-boundaries.mjs). Region boundaries are dissolved
// from that same district geometry by region_id, not sourced independently
// (see scripts/build-region-boundaries.mjs) — this keeps them exactly
// consistent with region_id as assigned in data/districts.csv.
//
// Subcounty and parish boundaries are INTENTIONALLY PARTIAL — 57% and ~4%
// coverage respectively (see docs/DATA_QUALITY.md and
// data/legacy/provenance/geo/README.md for the full story, including why
// coverage caps out where it does). Shipped anyway rather than withheld,
// per this project's "surface what exists, document the gap" policy — do
// not assume every subcounty/parish has a matching feature.
//
// Roads are a genuinely different kind of data: an independent
// OpenStreetMap-derived layer of the major road network (motorway through
// tertiary only — see schema/road.schema.json), NOT tied to any
// AdministrativeUnit (no district_id/region_id on road features — a road
// crosses many admin units, and OSM carries no such tagging at all).
//
// No boundary layer exists at all for county or village level — see
// docs/DATA_QUALITY.md for every source evaluated and why each was
// rejected or deferred.
import { readFileSync } from "node:fs";
import path from "node:path";
import { DIST } from "./store.mjs";

const cache = {};
function loadGeo(name, file) {
  if (!cache[name]) cache[name] = JSON.parse(readFileSync(path.join(DIST, "geo", file), "utf-8"));
  return cache[name];
}

/** GeoJSON FeatureCollection of all 136 district boundaries. Each feature's properties.id matches a district record's id. */
export function districtBoundaries() {
  return loadGeo("districts", "districts.geojson");
}

/** GeoJSON FeatureCollection of all 4 region boundaries. Each feature's properties.id matches a region record's id. */
export function regionBoundaries() {
  return loadGeo("regions", "regions.geojson");
}

/** GeoJSON FeatureCollection of subcounty/town_council/division boundaries. Partial coverage (~57%) — see module doc. */
export function subcountyBoundaries() {
  return loadGeo("subcountys", "subcountys.geojson");
}

/** GeoJSON FeatureCollection of parish/ward boundaries. Partial coverage (~4%) — see module doc. */
export function parishBoundaries() {
  return loadGeo("parishs", "parishs.geojson");
}

/** GeoJSON FeatureCollection of the major road network (motorway-tertiary). Not tied to any AdministrativeUnit — see module doc. */
export function roads() {
  return loadGeo("roads", "roads.geojson");
}
