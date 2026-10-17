// Compiles data/*.csv into dist/ artifacts: a unified JSON dataset, a flattened
// backward-compatible CSV, per-level exports, and a data-quality coverage report.
//
// Design intent: every record carries `confidence` (verified | legacy | unverified)
// and `status` (operational | pending | proposed | ...) so a consuming application
// can choose to trust only verified/operational data, or opt into legacy rows while
// they await reconciliation. Nothing here is silently upgraded to "verified" without
// being cross-checked against 2+ independent current sources.

import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { area as turfArea } from "@turf/turf";
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

// ---- population (NPHC 2024, district/city level only — see
// data/legacy/provenance/population/README.md) ----
const populationById = new Map();
for (const r of readCsv("population/uganda-nphc-2024-population.csv")) {
  populationById.set(r.id, { year: 2024, male: Number(r.male), female: Number(r.female), total: Number(r.total) });
}
function populationFor(id) {
  return populationById.get(id) || null;
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
    population: null,
  });
}

// ---- subregions (cultural/traditional groupings, parallel to the admin tree) ----
for (const r of readCsv("subregions.csv")) {
  units.push({
    id: r.id,
    name: r.name,
    slug: r.slug,
    level: "subregion",
    type: "subregion",
    parent_id: r.region_id,
    region_id: r.region_id,
    status: r.status || "operational",
    confidence: "verified",
    effective_date: null,
    source_ids: [],
    notes: r.notes || null,
    population: null,
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
    subregion_id: r.subregion_id || null,
    status: r.status || "operational",
    confidence: "verified",
    effective_date: r.effective_date || null,
    source_ids: splitList(r.source_ids),
    notes: r.notes || null,
    population: populationFor(r.id),
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
    subregion_id: r.subregion_id || null,
    status: r.status || "operational",
    confidence: "verified",
    effective_date: r.effective_date || null,
    source_ids: splitList(r.source_ids),
    notes: r.notes || null,
    population: populationFor(r.id),
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

// ---- OCHA COD-AB P-codes (see scripts/ingest-hdx-cod-ab.mjs) ----
// external_refs.hdx_pcode: this unit's exact COD-AB equivalent, where one
//   exists (region, district, and the counties/subcounties COD-AB's 2020
//   snapshot still has under the same name, tier and district).
// external_refs.hdx_within_pcode: the most specific COD-AB unit that
//   contains this one — its own P-code if it has one, else the nearest
//   ancestor's (or, for a district split off since 2020, the district it
//   was split from). Set on everything from region down to subcounty-tier,
//   so any of these records can be joined to OCHA/humanitarian data keyed
//   by P-code, even ones COD-AB doesn't know about (cities, Terego, units
//   created since 2020). Parish/village records inherit theirs from their
//   subcounty — see the hdx_pcode column of uganda-locations-full.csv.
const crosswalk = readCsv("crosswalk/hdx-cod-ab-uga.csv");
const hdxExact = new Map(crosswalk.filter((r) => r.match === "exact").map((r) => [r.unit_id, r.hdx_pcode]));
const hdxSplitFrom = new Map(crosswalk.filter((r) => r.match === "split_from").map((r) => [r.unit_id, r.hdx_pcode]));
const PCODE_LEVELS = new Set(["region", "district", "city", "county", "municipality", "subcounty", "town_council", "division"]);
{
  const byId = new Map(units.map((u) => [u.id, u]));
  const within = new Map();
  const withinOf = (u) => {
    if (!u) return null;
    if (within.has(u.id)) return within.get(u.id);
    const pcode = hdxExact.get(u.id) || hdxSplitFrom.get(u.id) || withinOf(byId.get(u.parent_id));
    within.set(u.id, pcode);
    return pcode;
  };
  for (const u of units) {
    if (!PCODE_LEVELS.has(u.level)) continue;
    const refs = { ...(u.external_refs || {}) };
    if (hdxExact.has(u.id)) refs.hdx_pcode = hdxExact.get(u.id);
    refs.hdx_within_pcode = withinOf(u);
    u.external_refs = refs;
  }
}

// ---- UBOS codes (see scripts/ingest-ubos-boundaries.mjs) ----
// external_refs.ubos_code: the unit's code in UBOS's 2024 census / 2025
// education census frame (district 3 digits, subcounty 6, parish 8), where
// UBOS has the same unit under a matching name — the key for joining
// UBOS's own tables (NPHC 2024 subcounty and parish profiles, etc.).
const ubosCrosswalk = readCsv("crosswalk/ubos-2024.csv");
{
  const byId = new Map(units.map((u) => [u.id, u]));
  for (const r of ubosCrosswalk) {
    if (r.match !== "exact" && r.match !== "fuzzy") continue;
    const u = byId.get(r.unit_id);
    if (u) u.external_refs = { ...(u.external_refs || {}), ubos_code: r.ubos_code };
  }
}

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

// ---- full-ancestry CSV, one row per village, for non-technical users ----
// (region, district, county, constituency, subcounty, parish, village) —
// meant to be opened directly in Excel/Google Sheets, not just consumed by
// code. "constituency" is included as its own column per the two-fold
// county+constituency model (see docs/DATA_QUALITY.md); blank county/
// constituency for city/Kampala divisions, which don't have a county tier.
// "parish_id" is the stable id of the village's parish/ward, appended last
// so existing column positions don't shift — names alone can't identify a
// parish (Lira West Division has two wards both named "Teso", with their
// villages adjacent in this file), so anything joining these rows back to
// parishs.json/wards.json needs the id. "hdx_pcode", appended after it for
// the same reason, is the most specific OCHA COD-AB P-code containing the
// village (its subcounty's hdx_within_pcode) — the key for joining these
// rows to humanitarian datasets. Its length tells its level: UG + 1 digit
// region, +3 district, +2 county, +2 subcounty.
const fullRows = [];
let fullSeq = 1;
for (const u of units) {
  if (!VILLAGE_LEVELS.includes(u.level)) continue;
  const parish = idOf.get(u.parent_id);
  const subcounty = idOf.get(parish.parent_id);
  const subcountyParent = idOf.get(subcounty.parent_id);
  const county = subcountyParent?.level === "county" ? subcountyParent : null;
  const districtId = ancestorDistrictId(subcounty);
  const district = districtId ? idOf.get(districtId) : null;
  const region = district?.region_id ? idOf.get(district.region_id) : null;
  const subregion = u.subregion_id ? idOf.get(u.subregion_id) : null;
  fullRows.push({
    id: fullSeq++,
    region: region ? region.name : "",
    sub_region: subregion ? subregion.name : "",
    district: district ? district.name : "",
    county: county ? county.name : "",
    constituency: (subcounty.external_refs?.ec_constituencies || []).join(" / "),
    subcounty: subcounty.name,
    parish: parish.name,
    village: u.name,
    confidence: u.confidence,
    parish_id: parish.id,
    hdx_pcode: subcounty.external_refs?.hdx_within_pcode || "",
  });
}
writeFileSync(
  path.join(DIST, "uganda-locations-full.csv"),
  writeCsv(
    ["id", "region", "sub_region", "district", "county", "constituency", "subcounty", "parish", "village", "confidence", "parish_id", "hdx_pcode"],
    fullRows
  )
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
    subregions: byLevel.subregion?.length || 0,
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
// (written after the boundary section below, which adds its coverage to it)

// ---- country metadata (currency, calling code, timezone, flag/coat-of-arms assets, etc.) ----
mkdirSync(path.join(DIST, "country"), { recursive: true });
writeFileSync(
  path.join(DIST, "country", "uganda.json"),
  readFileSync(path.join(DATA, "country/uganda.json"), "utf-8")
);
cpSync(path.join(DATA, "country/assets"), path.join(DIST, "country", "assets"), { recursive: true });

// ---- boundary geometry ----
// Prebuilt into data/geo/ by the boundary scripts, run in this order:
// ingest-ubos-boundaries (parish -> subcounty -> county -> city/district,
// built bottom-up from UBOS's 2024/2025 polygons), build-region-boundaries,
// ingest-hdx-cod-ab (P-codes). The checked-in files stay geometry-plus-ids;
// the build adds what a choropleth or an export needs, so the GeoJSON is
// self-sufficient without a second lookup:
//   area_km2      every polygon layer (land area — polygons are clipped to
//                 land except the few island parishes flagged includes_water)
//   population    district and city features (NPHC 2024)
//   hdx_pcode     every polygon layer, from the unit's own record
// gaps.geojson holds land no EC unit could be given — see
// docs/DATA_QUALITY.md.
mkdirSync(path.join(DIST, "geo"), { recursive: true });
const boundaryCoverage = {};
{
  const tierTotals = {
    regions: byLevel.region?.length || 0,
    subregions: byLevel.subregion?.length || 0,
    districts: districts.length,
    citys: byLevel.city?.length || 0,
    countys: units.filter((u) => u.level === "county" || u.level === "municipality").length,
    subcountys: units.filter((u) => SUBCOUNTY_LEVELS.includes(u.level)).length,
    parishs: units.filter((u) => PARISH_LEVELS.includes(u.level)).length,
  };
  // 2024 population below district: UBOS NPHC per subcounty (assigned to
  // EC subcounties by scripts/ingest-ubos-boundaries.mjs), summed up to
  // counties — partial where a county has a subcounty UBOS doesn't count.
  const subPop = new Map(
    readCsv("population/ubos-nphc-2024-subcounty.csv").map((r) => [
      r.id,
      { year: 2024, male: Number(r.male), female: Number(r.female), total: Number(r.total), ...(r.method === "includes_carved_units" ? { note: "includes units carved out since 2022" } : {}) },
    ])
  );
  // Cross-dataset agreement per subcounty (scripts/compare-boundaries.mjs),
  // when that QA step has been run.
  const agreementFile = path.join(DATA, "qa/boundary-agreement.csv");
  const agreement = existsSync(agreementFile) ? new Map(readCsv("qa/boundary-agreement.csv").map((r) => [r.id, r])) : new Map();
  const countyPop = new Map();
  for (const u of units) {
    if (!SUBCOUNTY_LEVELS.includes(u.level)) continue;
    const parent = idOf.get(u.parent_id);
    if (!parent || (parent.level !== "county" && parent.level !== "municipality")) continue;
    const c = countyPop.get(parent.id) ?? { year: 2024, male: 0, female: 0, total: 0, missing: 0 };
    const pop = subPop.get(u.id);
    if (pop) {
      c.male += pop.male;
      c.female += pop.female;
      c.total += pop.total;
    } else c.missing++;
    countyPop.set(parent.id, c);
  }
  for (const layer of Object.keys(tierTotals)) {
    const fc = JSON.parse(readFileSync(path.join(DATA, "geo", `${layer}.geojson`), "utf-8"));
    for (const f of fc.features) {
      f.properties.hdx_pcode = idOf.get(f.properties.id)?.external_refs?.hdx_pcode ?? null;
      f.properties.area_km2 = Math.round(turfArea(f) / 1e4) / 100;
      if (layer === "districts" || layer === "citys") f.properties.population = populationFor(f.properties.id);
      if (layer === "subcountys") {
        f.properties.population = subPop.get(f.properties.id) ?? null;
        const a = agreement.get(f.properties.id);
        if (a) {
          f.properties.agreement = {
            ubos_nphc_iou: a.ubos_nphc_iou === "" ? null : Number(a.ubos_nphc_iou),
            hdx_iou: a.hdx_iou === "" ? null : Number(a.hdx_iou),
          };
        }
      }
      if (layer === "countys") {
        const c = countyPop.get(f.properties.id);
        f.properties.population = c ? { year: c.year, male: c.male, female: c.female, total: c.total, ...(c.missing ? { partial: true } : {}) } : null;
      }
    }
    writeFileSync(path.join(DIST, "geo", `${layer}.geojson`), JSON.stringify(fc));
    boundaryCoverage[layer] = { with_polygon: fc.features.length, total: tierTotals[layer] };
  }
  {
    const settlements = JSON.parse(readFileSync(path.join(DATA, "geo/settlements.geojson"), "utf-8"));
    for (const f of settlements.features) f.properties.area_km2 = Math.round(turfArea(f) / 1e4) / 100;
    writeFileSync(path.join(DIST, "geo", "settlements.geojson"), JSON.stringify(settlements));
  }
  {
    const gaps = JSON.parse(readFileSync(path.join(DATA, "geo/gaps.geojson"), "utf-8"));
    for (const f of gaps.features) f.properties.area_km2 = Math.round(turfArea(f) / 1e4) / 100;
    writeFileSync(path.join(DIST, "geo", "gaps.geojson"), JSON.stringify(gaps));
    boundaryCoverage.gaps = { features: gaps.features.length, area_km2: Math.round(gaps.features.reduce((a, f) => a + f.properties.area_km2, 0)) };
  }
  // roads: an independent, non-admin-unit layer (see schema/road.schema.json)
  writeFileSync(path.join(DIST, "geo", "roads.geojson"), readFileSync(path.join(DATA, "geo/roads.geojson"), "utf-8"));
}

// ---- crosswalks (OCHA COD-AB, UBOS), shipped as-is for joining the other way ----
mkdirSync(path.join(DIST, "crosswalk"), { recursive: true });
for (const file of ["hdx-cod-ab-uga.csv", "ubos-2024.csv"]) {
  writeFileSync(path.join(DIST, "crosswalk", file), readFileSync(path.join(DATA, "crosswalk", file), "utf-8"));
}

report.boundary_coverage = boundaryCoverage;
{
  const file = path.join(DATA, "qa/boundary-agreement.csv");
  if (existsSync(file)) {
    const rows = readCsv("qa/boundary-agreement.csv");
    const median = (key) => {
      const v = rows.filter((r) => r[key] !== "").map((r) => Number(r[key])).sort((a, b) => a - b);
      return v.length ? v[Math.floor(v.length / 2)] : null;
    };
    report.boundary_agreement = {
      method: "IoU of each published subcounty polygon against UBOS NPHC 2024's and OCHA COD-AB 2020's polygon for the same unit, over the unit's district land — see scripts/compare-boundaries.mjs and data/qa/boundary-agreement.csv",
      compared: rows.length,
      median_iou_ubos_nphc: median("ubos_nphc_iou"),
      median_iou_hdx: median("hdx_iou"),
      flagged_for_review: rows.filter((r) => r.flag === "review").length,
    };
  }
}
{
  const eligible = units.filter((u) => PCODE_LEVELS.has(u.level));
  const byCodLevel = {};
  for (const r of crosswalk) {
    byCodLevel[r.hdx_level] ||= {};
    byCodLevel[r.hdx_level][r.match] = (byCodLevel[r.hdx_level][r.match] || 0) + 1;
  }
  report.hdx_cod_ab = {
    source: "OCHA COD-AB Uganda (HDX cod-ab-uga), UBOS-sourced, valid_on 2020-08-24 — see data/sources.json -> src-hdx-cod-ab-uga and dist/crosswalk/hdx-cod-ab-uga.csv",
    units_eligible: eligible.length,
    units_with_exact_pcode: eligible.filter((u) => u.external_refs?.hdx_pcode).length,
    units_with_within_pcode: eligible.filter((u) => u.external_refs?.hdx_within_pcode).length,
    crosswalk_matches_by_cod_ab_level: byCodLevel,
  };
  const byUbosLevel = {};
  for (const r of ubosCrosswalk) {
    byUbosLevel[r.level] ||= {};
    byUbosLevel[r.level][r.match] = (byUbosLevel[r.level][r.match] || 0) + 1;
  }
  report.ubos_2024 = {
    source: "UBOS NPHC 2024 (district/subcounty) and BEC 2025 (parish) polygons — see data/sources.json -> src-ubos-nphc-2024-geo, src-ubos-bec-2025-geo and dist/crosswalk/ubos-2024.csv",
    units_with_ubos_code: units.filter((u) => u.external_refs?.ubos_code).length,
    crosswalk_matches_by_level: byUbosLevel,
  };
}
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
