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
}

if (errors) {
  console.error(`\n${errors} validation error(s) in ${units.length} records.`);
  process.exit(1);
} else {
  console.log(`OK: ${units.length} records pass structural validation.`);
}
