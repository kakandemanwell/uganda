// Compiles data/*.csv into dist/ artifacts: a unified JSON dataset, a flattened
// backward-compatible CSV, per-level exports, and a data-quality coverage report.
//
// Design intent: every record carries `confidence` (verified | legacy | unverified)
// and `status` (operational | pending | proposed | ...) so a consuming application
// can choose to trust only verified/operational data, or opt into legacy rows while
// they await reconciliation. Nothing here is silently upgraded to "verified" without
// being cross-checked against 2+ independent current sources.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseCsvObjects, writeCsv } from "./lib/csv.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(ROOT, "data");
const DIST = path.join(ROOT, "dist");

function readCsv(rel) {
  return parseCsvObjects(readFileSync(path.join(DATA, rel), "utf-8"));
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function splitList(s) {
  return (s || "")
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
}

const units = [];
const districtBySlug = new Map(); // slug of bare district name -> unit

// ---- regions ----
for (const r of readCsv("regions.csv")) {
  units.push({
    id: r.id,
    name: r.name,
    slug: r.slug,
    level: "region",
    type: "region",
    parent_id: null,
    region_id: r.id,
    status: r.status || "operational",
    confidence: "verified",
    effective_date: null,
    source_ids: [],
    notes: r.notes || null,
  });
}

// ---- districts (incl. Kampala/KCCA) ----
for (const r of readCsv("districts.csv")) {
  const unit = {
    id: r.id,
    name: r.name,
    slug: r.slug,
    aliases: splitList(r.aliases),
    level: "district",
    type: r.type || "district",
    parent_id: r.region_id,
    region_id: r.region_id,
    status: r.status || "operational",
    confidence: "verified",
    effective_date: r.effective_date || null,
    source_ids: splitList(r.source_ids),
    notes: r.notes || null,
  };
  units.push(unit);
  districtBySlug.set(slugify(r.name), unit);
  for (const alias of unit.aliases) districtBySlug.set(slugify(alias), unit);
}

// ---- cities ----
for (const r of readCsv("cities.csv")) {
  units.push({
    id: r.id,
    name: r.name,
    slug: r.slug,
    level: "city",
    type: "city",
    parent_id: r.parent_district_id,
    region_id: r.region_id,
    status: r.status || "operational",
    confidence: "verified",
    effective_date: r.effective_date || null,
    source_ids: splitList(r.source_ids),
    notes: r.notes || null,
  });
}

// ---- legacy counties (2015 Statoids vintage) are NOT ingested into the build ----
// Superseded entirely by the EC-derived county layer below: that one covers
// all 136 rural districts (vs. 112/136 here) with current (2022, verified)
// data reconstructed from EC constituency names — see
// scripts/ingest-ec-admin-units.mjs for the county-promotion logic and
// docs/DATA_QUALITY.md for the validation behind treating constituency names
// as county names outside city/Kampala divisions. The raw file remains at
// data/legacy/counties_2015_statoids.csv for provenance/reference only.

// ---- EC-verified county -> subcounty/town_council/division -> parish/ward -> village/cell ----
// Superseded the old user-supplied location.csv as the subcounty source: this
// data is cross-validated twice (every "TOTAL VILLAGES IN X" checksum in the
// source document, and full per-district totals against the EC's own summary
// statistics — see data/sources.json -> src-ec-admin-units-2022) and covers
// all 146 districts/cities at village level, not just 110 at subcounty level.
// Pre-built into final AdministrativeUnit shape by scripts/ingest-ec-admin-units.mjs.
const ecUnits = JSON.parse(readFileSync(path.join(DATA, "ec/administrative_units_ec2022.json"), "utf-8"));
for (const u of ecUnits) units.push(u);

mkdirSync(DIST, { recursive: true });

// ---- unified JSON ----
writeFileSync(path.join(DIST, "uganda-locations.json"), JSON.stringify(units, null, 2) + "\n");

// ---- per-level JSON exports ----
const byLevel = {};
for (const u of units) (byLevel[u.level] ||= []).push(u);
for (const [level, list] of Object.entries(byLevel)) {
  writeFileSync(path.join(DIST, `${level}s.json`), JSON.stringify(list, null, 2) + "\n");
}

const SUBCOUNTY_LEVELS = ["subcounty", "town_council", "division"];
const PARISH_LEVELS = ["parish", "ward"];
const VILLAGE_LEVELS = ["village", "cell"];

const idOf = new Map(units.map((u) => [u.id, u]));
// Most subcounties now sit under a county (see ingest-ec-admin-units.mjs's
// county-promotion pass); city/Kampala divisions and the one known rural
// exception (Katikamu, Luwero) still sit directly under their district/city.
// So "nearest district/city ancestor" needs an actual walk, not a direct
// parent_id read — used both for the flattened CSV below and the coverage
// report further down.
function ancestorDistrictId(unit) {
  let u = unit;
  while (u && u.level !== "district" && u.level !== "city") u = idOf.get(u.parent_id);
  return u?.id;
}

// ---- flattened CSV, backward-compatible with the original location.csv shape ----
// (id, district, county, subcounty, location_id, code) — "county" is the
// real EC-derived county name where the subcounty has one (see
// docs/DATA_QUALITY.md for how that's established), blank for city/Kampala
// divisions and the rare rural exception that spans multiple constituencies.
const flatRows = [];
let seq = 1;
for (const u of units) {
  if (!SUBCOUNTY_LEVELS.includes(u.level)) continue;
  const parent = u.parent_id ? idOf.get(u.parent_id) : null;
  const county = parent && parent.level === "county" ? parent.name : "";
  const districtId = ancestorDistrictId(u);
  const district = districtId ? idOf.get(districtId) : null;
  flatRows.push({
    id: seq++,
    district: district ? district.name : "",
    county,
    subcounty: u.name,
    confidence: u.confidence,
    legacy_location_id: u.external_refs?.legacy_location_id || "",
    legacy_code: u.external_refs?.legacy_code || "",
  });
}
writeFileSync(
  path.join(DIST, "uganda-locations.csv"),
  writeCsv(["id", "district", "county", "subcounty", "confidence", "legacy_location_id", "legacy_code"], flatRows)
);

// ---- data quality report ----
// Counties (EC-derived, 2022) only exist for rural districts — cities/KCCA
// have divisions directly under them instead, per Uganda's Local Governments
// Act — so county coverage is checked against districts alone. Subcounty/
// parish/village exist for all 146 district-equivalent units including
// cities, so those are checked against districts+cities together. Most
// subcounties now sit under a county rather than directly under their
// district (see scripts/ingest-ec-admin-units.mjs's county-promotion pass),
// so all three of subcounty/parish/village coverage need the same
// walk-up-to-nearest-district/city logic, not a direct parent_id check.
const districts = units.filter((u) => u.level === "district");
const districtsAndCities = units.filter((u) => u.level === "district" || u.level === "city");

function parentIdsWithLevel(levels) {
  return new Set(units.filter((u) => levels.includes(u.level) && u.parent_id).map((u) => u.parent_id));
}
const subcountyDistrictIds = new Set(
  units.filter((u) => SUBCOUNTY_LEVELS.includes(u.level)).map((u) => ancestorDistrictId(u)).filter(Boolean)
);
const parishDistrictIds = new Set(
  units.filter((u) => PARISH_LEVELS.includes(u.level)).map((u) => ancestorDistrictId(u)).filter(Boolean)
);
const villageDistrictIds = new Set(
  units.filter((u) => VILLAGE_LEVELS.includes(u.level)).map((u) => ancestorDistrictId(u)).filter(Boolean)
);

const countyDistrictIds = parentIdsWithLevel(["county", "municipality"]);
const districtsMissingSubcounties = districtsAndCities.filter((d) => !subcountyDistrictIds.has(d.id)).map((d) => d.name).sort();
const districtsMissingCounties = districts.filter((d) => !countyDistrictIds.has(d.id)).map((d) => d.name).sort();

const confidenceCounts = {};
for (const u of units) confidenceCounts[u.confidence] = (confidenceCounts[u.confidence] || 0) + 1;

const report = {
  generated_at: new Date().toISOString(),
  totals: {
    regions: byLevel.region?.length || 0,
    districts: districts.length,
    cities: byLevel.city?.length || 0,
    counties: byLevel.county?.length || 0,
    subcounties: (byLevel.subcounty?.length || 0) + (byLevel.town_council?.length || 0) + (byLevel.division?.length || 0),
    parishes: (byLevel.parish?.length || 0) + (byLevel.ward?.length || 0),
    villages: (byLevel.village?.length || 0) + (byLevel.cell?.length || 0),
  },
  by_confidence: confidenceCounts,
  coverage: {
    districts_total: districts.length,
    districts_with_county_data: districts.length - districtsMissingCounties.length,
    districts_missing_county_data: districtsMissingCounties.length,
    district_equivalents_total: districtsAndCities.length,
    district_equivalents_with_subcounty_data: districtsAndCities.length - districtsMissingSubcounties.length,
    district_equivalents_missing_subcounty_data: districtsMissingSubcounties.length,
    district_equivalents_with_parish_data: parishDistrictIds.size,
    district_equivalents_with_village_data: villageDistrictIds.size,
  },
  districts_missing_subcounties: districtsMissingSubcounties,
  districts_missing_counties: districtsMissingCounties,
  subcounties_without_a_matched_county: units
    .filter((u) => SUBCOUNTY_LEVELS.includes(u.level) && u.notes)
    .map((u) => u.name),
  ec_admin_units_2022: "Verified county -> subcounty/town_council/division -> parish/ward -> village/cell for all 146 district-equivalent units, sourced from the EC's July 2022 gazetteer (county layer reconstructed from EC constituency names, cross-validated against independent research — see docs/DATA_QUALITY.md). See data/sources.json -> src-ec-admin-units-2022. Dated 2022-07; does not reflect any changes since.",
};
writeFileSync(path.join(DIST, "data-quality-report.json"), JSON.stringify(report, null, 2) + "\n");

console.log(`Built ${units.length} records -> dist/`);
console.log(
  `District-equivalents with subcounty data: ${report.coverage.district_equivalents_with_subcounty_data}/${report.coverage.district_equivalents_total}`
);
console.log(
  `Districts with county data: ${report.coverage.districts_with_county_data}/${report.coverage.districts_total}`
);
console.log(
  `District-equivalents with parish data: ${report.coverage.district_equivalents_with_parish_data}/${report.coverage.district_equivalents_total}`
);
console.log(
  `District-equivalents with village data: ${report.coverage.district_equivalents_with_village_data}/${report.coverage.district_equivalents_total}`
);
