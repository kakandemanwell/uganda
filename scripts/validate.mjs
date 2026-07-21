// Lightweight structural validation of dist/uganda-locations.json against the
// shape described in schema/administrative-unit.schema.json. Not a full JSON
// Schema engine (kept dependency-free) — checks required fields, enums, and
// referential integrity (parent_id / region_id must point at a real record).

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const schema = JSON.parse(readFileSync(path.join(ROOT, "schema/administrative-unit.schema.json"), "utf-8"));
const units = JSON.parse(readFileSync(path.join(ROOT, "dist/uganda-locations.json"), "utf-8"));

const ids = new Set(units.map((u) => u.id));
let errors = 0;

function fail(msg) {
  errors++;
  console.error(`✗ ${msg}`);
}

// ---- country metadata ----
const countrySchema = JSON.parse(readFileSync(path.join(ROOT, "schema/country.schema.json"), "utf-8"));
const country = JSON.parse(readFileSync(path.join(ROOT, "dist/country/uganda.json"), "utf-8"));
for (const req of countrySchema.required) {
  if (country[req] === undefined || country[req] === null || country[req] === "") {
    fail(`country: missing required field '${req}'`);
  }
}
if (!countrySchema.properties.confidence.enum.includes(country.confidence)) {
  fail(`country: invalid confidence '${country.confidence}'`);
}
for (const [key, rel] of Object.entries(country.assets || {})) {
  if (!existsSync(path.join(ROOT, "dist/country", rel))) {
    fail(`country.assets.${key}: file '${rel}' does not exist in dist/country/`);
  }
}

const seenIds = new Set();
for (const u of units) {
  for (const req of schema.required) {
    if (u[req] === undefined || u[req] === null || u[req] === "") {
      fail(`${u.id || "(no id)"}: missing required field '${req}'`);
    }
  }
  if (seenIds.has(u.id)) fail(`duplicate id: ${u.id}`);
  seenIds.add(u.id);

  const levelEnum = schema.properties.level.enum;
  if (!levelEnum.includes(u.level)) fail(`${u.id}: invalid level '${u.level}'`);

  const statusEnum = schema.properties.status.enum;
  if (!statusEnum.includes(u.status)) fail(`${u.id}: invalid status '${u.status}'`);

  const confidenceEnum = schema.properties.confidence.enum;
  if (!confidenceEnum.includes(u.confidence)) fail(`${u.id}: invalid confidence '${u.confidence}'`);

  if (u.parent_id && !ids.has(u.parent_id)) {
    fail(`${u.id}: parent_id '${u.parent_id}' does not resolve to any record`);
  }
  if (u.region_id && !ids.has(u.region_id)) {
    fail(`${u.id}: region_id '${u.region_id}' does not resolve to any record`);
  }

  if (u.level === "district" || u.level === "city") {
    const p = u.population;
    if (!p || typeof p.male !== "number" || typeof p.female !== "number" || typeof p.total !== "number") {
      fail(`${u.id}: missing/malformed population data`);
    } else if (p.male + p.female !== p.total) {
      fail(`${u.id}: population male (${p.male}) + female (${p.female}) != total (${p.total})`);
    }
  } else if (u.population !== undefined && u.population !== null) {
    fail(`${u.id}: level '${u.level}' should not carry population data`);
  }
}

// ---- boundary geometry (region/district polygons) ----
const GEO_EXPECTED_COUNT = { "dist/geo/districts.geojson": 136, "dist/geo/regions.geojson": 4 };
for (const [rel, expectedCount] of Object.entries(GEO_EXPECTED_COUNT)) {
  const fc = JSON.parse(readFileSync(path.join(ROOT, rel), "utf-8"));
  if (fc.type !== "FeatureCollection") fail(`${rel}: expected a FeatureCollection`);
  if (fc.features.length !== expectedCount) {
    fail(`${rel}: expected ${expectedCount} features, got ${fc.features.length}`);
  }
  const seenGeoIds = new Set();
  for (const f of fc.features) {
    const p = f.properties || {};
    if (!p.id || !p.name || !p.slug) fail(`${rel}: feature missing id/name/slug (${JSON.stringify(p)})`);
    if (seenGeoIds.has(p.id)) fail(`${rel}: duplicate feature id '${p.id}'`);
    seenGeoIds.add(p.id);
    if (!ids.has(p.id)) fail(`${rel}: feature id '${p.id}' does not resolve to any record in uganda-locations.json`);
    if (!["Polygon", "MultiPolygon"].includes(f.geometry?.type)) {
      fail(`${rel}: feature '${p.id}' has unexpected geometry type '${f.geometry?.type}'`);
    }
  }
}

// ---- partial-coverage boundary layers (subcounty/parish) — no fixed
// expected count (coverage is intentionally partial, see
// docs/DATA_QUALITY.md), just structural + referential integrity ----
const PARTIAL_GEO_FILES = ["dist/geo/subcountys.geojson", "dist/geo/parishs.geojson"];
for (const rel of PARTIAL_GEO_FILES) {
  const fc = JSON.parse(readFileSync(path.join(ROOT, rel), "utf-8"));
  if (fc.type !== "FeatureCollection") fail(`${rel}: expected a FeatureCollection`);
  if (!fc.features.length) fail(`${rel}: expected at least some features`);
  const seenGeoIds = new Set();
  for (const f of fc.features) {
    const p = f.properties || {};
    if (!p.id || !p.name || !p.slug || !p.district_id) {
      fail(`${rel}: feature missing id/name/slug/district_id (${JSON.stringify(p)})`);
    }
    if (seenGeoIds.has(p.id)) fail(`${rel}: duplicate feature id '${p.id}'`);
    seenGeoIds.add(p.id);
    if (p.id && !ids.has(p.id)) fail(`${rel}: feature id '${p.id}' does not resolve to any record in uganda-locations.json`);
    if (p.district_id && !ids.has(p.district_id)) {
      fail(`${rel}: feature district_id '${p.district_id}' does not resolve to any record`);
    }
    if (!["Polygon", "MultiPolygon"].includes(f.geometry?.type)) {
      fail(`${rel}: feature '${p.id}' has unexpected geometry type '${f.geometry?.type}'`);
    }
  }
}

// ---- roads: an independent layer, not tied to any AdministrativeUnit ----
{
  const rel = "dist/geo/roads.geojson";
  const fc = JSON.parse(readFileSync(path.join(ROOT, rel), "utf-8"));
  if (fc.type !== "FeatureCollection") fail(`${rel}: expected a FeatureCollection`);
  if (!fc.features.length) fail(`${rel}: expected at least some features`);
  for (const f of fc.features) {
    if (!f.properties?.highway) fail(`${rel}: feature missing 'highway' property`);
    if (!["LineString", "MultiLineString"].includes(f.geometry?.type)) {
      fail(`${rel}: feature has unexpected geometry type '${f.geometry?.type}'`);
    }
  }
}

if (errors) {
  console.error(`\n${errors} validation error(s) in ${units.length} records.`);
  process.exit(1);
} else {
  console.log(`OK: ${units.length} records pass structural validation.`);
}
