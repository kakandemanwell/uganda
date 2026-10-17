// uganda-locale/geo — opt-in: boundary polygons and road-network geometry
// (GeoJSON), for map visualization. Not loaded by the default import since
// most consumers building dropdowns/lookups don't need geometry payloads.
//
// Every boundary layer is built bottom-up from UBOS's own current polygons
// (NPHC 2024 subcounties, BEC 2025 parishes), keyed to this project's EC
// unit ids: a subcounty is exactly the union of its parishes, a county of
// its subcounties, a district of everything in it (including any city
// carved from it), a region of its districts — so the layers nest
// exactly. All are clipped to land, apart from a few island parishes whose
// islands the land mask lacks (properties.includes_water). See
// scripts/ingest-ubos-boundaries.mjs and docs/DATA_QUALITY.md.
//
// Coverage is near-complete: every district, city and county; all but a
// handful of subcounties and ~1% of parishes (see
// dist/data-quality-report.json -> boundary_coverage). A few polygons are
// INFERRED from the "no new land" rule — a unit's only unmapped child gets
// the parent's remaining land — and say so (properties.inferred). Land no
// unit could be given (mostly UBOS refugee-settlement census units, which
// the EC doesn't have) is in gaps(), with the candidate units listed.
//
// Every boundary feature carries area_km2, hdx_pcode (OCHA COD-AB, or null)
// and ubos_code where UBOS has the same unit; districts and cities also
// carry population.
//
// Roads are a genuinely different kind of data: an independent
// OpenStreetMap-derived layer of the major road network (motorway through
// tertiary only — see schema/road.schema.json), NOT tied to any
// AdministrativeUnit (no district_id/region_id on road features — a road
// crosses many admin units, and OSM carries no such tagging at all).
import { readFileSync } from "node:fs";
import path from "node:path";
import { DIST } from "./store.mjs";

const cache = {};
function loadGeo(name, file) {
  if (!cache[name]) cache[name] = JSON.parse(readFileSync(path.join(DIST, "geo", file), "utf-8"));
  return cache[name];
}

/** GeoJSON FeatureCollection of all 136 district boundaries (each including any city carved from it). properties.id matches a district record's id. */
export function districtBoundaries() {
  return loadGeo("districts", "districts.geojson");
}

/** GeoJSON FeatureCollection of all 4 region boundaries. Each feature's properties.id matches a region record's id. */
export function regionBoundaries() {
  return loadGeo("regions", "regions.geojson");
}

/** GeoJSON FeatureCollection of the 17 cultural/traditional sub-regions, dissolved from districts by subregion_id. */
export function subregionBoundaries() {
  return loadGeo("subregions", "subregions.geojson");
}

/** GeoJSON FeatureCollection of refugee-settlement outlines (UBOS census units); their land is split between host subcounties. */
export function settlements() {
  return loadGeo("settlements", "settlements.geojson");
}

/** GeoJSON FeatureCollection of all 10 city boundaries. */
export function cityBoundaries() {
  return loadGeo("citys", "citys.geojson");
}

/** GeoJSON FeatureCollection of subcounty/town_council/division boundaries — all but a handful, see module doc. */
export function subcountyBoundaries() {
  return loadGeo("subcountys", "subcountys.geojson");
}

/** GeoJSON FeatureCollection of all 322 county/municipality boundaries (each the union of its subcounties). */
export function countyBoundaries() {
  return loadGeo("countys", "countys.geojson");
}

/** GeoJSON FeatureCollection of parish/ward boundaries (UBOS BEC 2025) — ~99% coverage, see module doc. */
export function parishBoundaries() {
  return loadGeo("parishs", "parishs.geojson");
}

/** GeoJSON FeatureCollection of land no unit could be assigned, each with candidate_ids — see module doc. */
export function gaps() {
  return loadGeo("gaps", "gaps.geojson");
}

/** GeoJSON FeatureCollection of the major road network (motorway-tertiary). Not tied to any AdministrativeUnit — see module doc. */
export function roads() {
  return loadGeo("roads", "roads.geojson");
}
