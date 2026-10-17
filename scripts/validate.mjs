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

// Every boundary file is wound for d3-geo's spherical convention: exterior
// rings CLOCKWISE in plain lon/lat (the reverse of RFC 7946's planar rule).
// Get it backwards and nothing errors — d3 just reads each polygon as "the
// whole globe minus this shape", so the web map frames South America and
// draws clip-rectangle artefacts. That has slipped through twice (see
// docs/DATA_QUALITY.md), hence an explicit check.
function exteriorIsClockwise(geometry) {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polys.every(([outer]) => {
    let sum = 0;
    for (let i = 0; i < outer.length - 1; i++) sum += (outer[i + 1][0] - outer[i][0]) * (outer[i + 1][1] + outer[i][1]);
    return sum > 0;
  });
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

// ---- OCHA COD-AB P-codes (see scripts/ingest-hdx-cod-ab.mjs) ----
// Unique per unit, well-formed, and properly nested: COD-AB codes are
// hierarchical (each is its parent's code plus a fixed-width suffix), so a
// unit's code must start with the code of whatever contains it. A failure
// here means a match that's right by name but in the wrong place in the
// tree — e.g. a district assigned to a different region than UBOS has it.
const PCODE_RE = /^UG(\d|\d{4}|\d{6}|\d{8})$/;
const pcodeOf = new Map();
const unitById = new Map(units.map((u) => [u.id, u]));
for (const u of units) {
  const refs = u.external_refs || {};
  for (const key of ["hdx_pcode", "hdx_within_pcode"]) {
    if (refs[key] && !PCODE_RE.test(refs[key])) fail(`${u.id}: malformed ${key} '${refs[key]}'`);
  }
  if (refs.hdx_pcode) {
    if (pcodeOf.has(refs.hdx_pcode)) fail(`${u.id}: hdx_pcode '${refs.hdx_pcode}' also on ${pcodeOf.get(refs.hdx_pcode)}`);
    pcodeOf.set(refs.hdx_pcode, u.id);
    if (refs.hdx_within_pcode !== refs.hdx_pcode) fail(`${u.id}: hdx_within_pcode should equal its own hdx_pcode`);
  }
  // Checked down to district level (UG + 4 digits) only: below that, a
  // subcounty can legitimately sit under a different county now than in
  // COD-AB's 2020 snapshot (e.g. Kachomo, Budaka), and COD-AB itself files
  // Buikwe's and Mityana's Central Divisions under counties it mislabels
  // "KCCA" — the subcounty's own code is still the right join key.
  const parentWithin = unitById.get(u.parent_id)?.external_refs?.hdx_within_pcode?.slice(0, 6);
  if (refs.hdx_within_pcode && parentWithin && !refs.hdx_within_pcode.startsWith(parentWithin)) {
    fail(`${u.id}: P-code ${refs.hdx_within_pcode} does not nest under its parent's ${parentWithin}`);
  }
}

// ---- boundary geometry (region/district polygons) ----
const GEO_EXPECTED_COUNT = {
  "dist/geo/districts.geojson": 136,
  "dist/geo/citys.geojson": 10,
  "dist/geo/regions.geojson": 4,
  "dist/geo/subregions.geojson": 17,
  "dist/geo/countys.geojson": 322,
};
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
    if (["Polygon", "MultiPolygon"].includes(f.geometry?.type) && !exteriorIsClockwise(f.geometry)) {
      fail(`${rel}: feature '${p.id}' is wound counter-clockwise (d3-geo will read it inverted)`);
    }
    if (!["Polygon", "MultiPolygon"].includes(f.geometry?.type)) {
      fail(`${rel}: feature '${p.id}' has unexpected geometry type '${f.geometry?.type}'`);
    }
  }
}

// ---- partial-coverage boundary layers (subcounty/parish) — no fixed
// expected count (coverage is intentionally partial, see
// docs/DATA_QUALITY.md), just structural + referential integrity ----
// (subcounty/parish: all but a handful of units have a polygon — see
// dist/data-quality-report.json -> boundary_coverage)
const PARTIAL_GEO_FILES = {
  "dist/geo/subcountys.geojson": { allowEmpty: false },
  "dist/geo/parishs.geojson": { allowEmpty: false },
};
for (const [rel, { allowEmpty }] of Object.entries(PARTIAL_GEO_FILES)) {
  const fc = JSON.parse(readFileSync(path.join(ROOT, rel), "utf-8"));
  if (fc.type !== "FeatureCollection") fail(`${rel}: expected a FeatureCollection`);
  if (!fc.features.length && !allowEmpty) fail(`${rel}: expected at least some features`);
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
    if (["Polygon", "MultiPolygon"].includes(f.geometry?.type) && !exteriorIsClockwise(f.geometry)) {
      fail(`${rel}: feature '${p.id}' is wound counter-clockwise (d3-geo will read it inverted)`);
    }
    if (!["Polygon", "MultiPolygon"].includes(f.geometry?.type)) {
      fail(`${rel}: feature '${p.id}' has unexpected geometry type '${f.geometry?.type}'`);
    }
    if (p.hdx_pcode && !pcodeOf.has(p.hdx_pcode)) {
      fail(`${rel}: feature '${p.id}' carries hdx_pcode '${p.hdx_pcode}' that no record does`);
    }
  }
}

// ---- gaps: land no EC unit could be given (see scripts/ingest-ubos-boundaries.mjs) ----
{
  const rel = "dist/geo/gaps.geojson";
  const fc = JSON.parse(readFileSync(path.join(ROOT, rel), "utf-8"));
  for (const f of fc.features) {
    const p = f.properties || {};
    if (!p.id?.startsWith("gap:") || !["subcounty", "parish"].includes(p.level)) fail(`${rel}: malformed gap ${JSON.stringify(p).slice(0, 120)}`);
    if (!ids.has(p.parent_id)) fail(`${rel}: ${p.id} parent '${p.parent_id}' does not resolve`);
    for (const c of p.candidate_ids || []) if (!ids.has(c)) fail(`${rel}: ${p.id} candidate '${c}' does not resolve`);
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
