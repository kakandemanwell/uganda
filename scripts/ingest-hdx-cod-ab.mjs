// Crosswalks OCHA's COD-AB for Uganda (HDX `cod-ab-uga`, UBOS-sourced,
// valid_on 2020-08-24, CC BY-IGO — see data/sources.json -> src-hdx-cod-ab-uga)
// onto this project's own unit ids, and extracts the county (ADM3) boundary
// layer from it.
//
// Why bother, given docs/DATA_QUALITY.md already rejected COD-AB's *names*
// as stale below district level: its P-codes (UG / UG1 / UG3064 / UG306601
// / UG30670101 — each code is its parent's code plus a fixed-width suffix)
// are the join key for essentially every humanitarian dataset on Uganda
// (OCHA 3W, population, health facilities, IPC, ...). Carrying them on our
// records makes this dataset joinable with all of that without anyone
// re-doing name matching. What COD-AB actually contains:
//
//   ADM1 region (4) · ADM2 district (135, the pre-Terego system, no cities)
//   ADM3 county/municipality (203) · ADM4 subcounty/town council/division (1,520)
//
// There is NO parish or village level — HDX's "admin4" is subcounty-tier
// (Kampala's five divisions are in it, and its codes are 8 digits under a
// 6-digit county). An earlier version of this project misread that layer as
// parish-level and shipped it as data/geo/parishs.geojson; that has been
// retracted — see docs/DATA_QUALITY.md.
//
// Matching is always scoped to a district (COD-AB carries every parent
// code/name per feature), never by bare name: a 2018 subcounty name is only
// matched to a 2022 unit in the same district "family" — the district
// itself, any city carved out of it (cities have parent_district_id), and
// any district split from it since (Terego, from Arua, 2020). Within that
// family, a name must match on both its base name AND its tier (subcounty
// vs town council vs division), so "Kangulumira" never lands on
// "Kangulumira Town Council". Anything still ambiguous is left unmatched
// rather than guessed.
//
// Inputs (raw, not committed — re-fetch per data/sources.json):
//   data/legacy/provenance/geo/hdx-cod-ab/uga_admin{1,2,3,4}.geojson
// Output: data/crosswalk/hdx-cod-ab-uga.csv, one row per COD-AB unit.
//
// COD-AB is used for its P-codes only. Boundary geometry comes from UBOS's
// own 2024/2025 polygons (scripts/ingest-ubos-boundaries.mjs, run first);
// COD-AB's 2020 polygons are only used here to sanity-check each match
// against those districts.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as turf from "@turf/turf";
import { parseCsvObjects, writeCsv } from "./lib/csv.mjs";
import { loadDistrictPolygons, fitToDistrict } from "./lib/fit-to-district.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(ROOT, "data");
const RAW = path.join(DATA, "legacy/provenance/geo/hdx-cod-ab");

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function readCsv(rel) {
  return parseCsvObjects(readFileSync(path.join(DATA, rel), "utf-8"));
}

function readRaw(level) {
  return JSON.parse(readFileSync(path.join(RAW, `uga_admin${level}.geojson`), "utf-8")).features;
}

// Splits a unit name into its tier and a bare base name, so "Kasawo Town
// Council", "Kasawo TC" and "Kasawo Town" all compare equal to each other —
// and not to plain "Kasawo". COD-AB misspells "Division" as "Divison" 9 times.
const TIER_PATTERNS = [
  ["town_council", /\b(town council|town board|town|tc)\b/g],
  ["division", /\b(division|divison)\b/g],
  ["municipality", /\b(municipality|municipal council)\b/g],
  ["city", /\bcity\b/g],
  ["county", /\bcounty\b/g],
  ["subcounty", /\b(sub ?county|s\/c)\b/g],
];
function parseName(name, fallbackTier) {
  let s = String(name).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[-_/]/g, " ");
  let tier = null;
  for (const [t, re] of TIER_PATTERNS) {
    if (re.test(s)) {
      tier ??= t;
      s = s.replace(re, " ");
    }
  }
  return { tier: tier === "county" || tier === "subcounty" || !tier ? fallbackTier : tier, base: s.replace(/[^a-z0-9]/g, "") };
}

// ---- this project's units ----
const ecUnits = JSON.parse(readFileSync(path.join(DATA, "ec/administrative_units_ec2022.json"), "utf-8"));
const regions = readCsv("regions.csv").map((r) => ({ id: r.id, name: r.name, level: "region" }));
const districts = readCsv("districts.csv").map((r) => ({
  id: r.id,
  name: r.name,
  level: "district",
  parent_id: r.region_id,
  aliases: (r.aliases || "").split(";").map((x) => x.trim()).filter(Boolean),
  notes: r.notes || "",
}));
const cities = readCsv("cities.csv").map((r) => ({
  id: r.id,
  name: r.name,
  level: "city",
  parent_id: r.parent_district_id,
}));
const units = [...regions, ...districts, ...cities, ...ecUnits];
const idOf = new Map(units.map((u) => [u.id, u]));

function ancestorDistrictId(unit) {
  let u = unit;
  while (u && u.level !== "district" && u.level !== "city") u = idOf.get(u.parent_id);
  return u?.id;
}

// Districts split off from a COD-AB-era district after its 2020 snapshot.
// Every other current district matches a COD-AB ADM2 feature by name (the
// script prints any that don't, so a new split shows up loudly here rather
// than silently dropping that district's subcounties).
const SPLIT_FROM = { "district:terego": "district:arua" };

// The same unit under two different names, confirmed by hand — matched by
// P-code instead of name. Still subject to the district-fit geometry check
// like every other match. Keep this short: anything not certain stays
// unmatched.
const PCODE_OVERRIDES = {
  // COD-AB "Central Division"; the EC gazetteer calls it "Kampala Central".
  // Kampala's other four divisions match by name.
  UG10080101: "subcounty:kampala-kampala-central",
};

// district/city id -> the COD-AB-era district its territory sat in
function familyRoot(districtOrCityId) {
  const u = idOf.get(districtOrCityId);
  if (u?.level === "city") return u.parent_id;
  return SPLIT_FROM[districtOrCityId] || districtOrCityId;
}

const COUNTY_LEVELS = new Set(["county", "municipality"]);
const SUBCOUNTY_LEVELS = new Set(["subcounty", "town_council", "division"]);

// family root district id -> { counties: [...], subcounties: [...] }
const families = new Map();
function family(rootId) {
  if (!families.has(rootId)) families.set(rootId, { counties: [], subcounties: [], cities: [] });
  return families.get(rootId);
}
for (const u of units) {
  if (u.level === "city") family(u.parent_id).cities.push(u);
  if (!COUNTY_LEVELS.has(u.level) && !SUBCOUNTY_LEVELS.has(u.level)) continue;
  const root = familyRoot(ancestorDistrictId(u));
  const fallbackTier = COUNTY_LEVELS.has(u.level) ? u.level : u.level === "subcounty" ? "subcounty" : u.level;
  const parsed = parseName(u.name, fallbackTier);
  // Our level is authoritative for our own records' tier; the name only
  // refines it (some subcounty-level records are named "... Town Council").
  const tier = SUBCOUNTY_LEVELS.has(u.level) && u.level !== "subcounty" ? u.level : parsed.tier;
  family(root)[COUNTY_LEVELS.has(u.level) ? "counties" : "subcounties"].push({ unit: u, tier, base: parsed.base });
}

const rows = [];
function row(level, p, unit, match, note = "") {
  rows.push({
    hdx_level: `adm${level}`,
    hdx_pcode: p[`adm${level}_pcode`],
    hdx_name: p[`adm${level}_name`],
    hdx_parent_pcode: level > 0 ? p[`adm${level - 1}_pcode`] : "",
    unit_id: unit?.id || "",
    match,
    note,
  });
}

// ---- ADM1: region ----
const pcodeToUnit = new Map(); // matched (exact) pcode -> unit id
for (const f of readRaw(1)) {
  const p = f.properties;
  const unit = idOf.get(`region:${slugify(p.adm1_name)}`);
  row(1, p, unit, unit ? "exact" : "unmatched");
  if (unit) pcodeToUnit.set(p.adm1_pcode, unit.id);
}

// ---- ADM2: district ----
const districtBySlug = new Map();
for (const d of districts) {
  districtBySlug.set(slugify(d.name), d);
  for (const a of d.aliases) districtBySlug.set(slugify(a), d);
}
const unmatchedAdm2 = [];
for (const f of readRaw(2)) {
  const p = f.properties;
  const d = districtBySlug.get(slugify(p.adm2_name)) || districtBySlug.get(slugify(p.adm2_ref_name || ""));
  if (!d) unmatchedAdm2.push(p.adm2_name);
  row(2, p, d, d ? "exact" : "unmatched");
  if (d) pcodeToUnit.set(p.adm2_pcode, d.id);
}
const matchedDistrictIds = new Set(pcodeToUnit.values());
const districtsWithoutPcode = districts.filter((d) => !matchedDistrictIds.has(d.id)).map((d) => d.id);
for (const id of districtsWithoutPcode) {
  if (!SPLIT_FROM[id]) {
    console.warn(`WARNING: ${id} matched no COD-AB district and has no SPLIT_FROM entry`);
    continue;
  }
  // Recorded so the build can give the new district the P-code of the
  // COD-AB district that still contains it (hdx_within_pcode) — never as
  // its own hdx_pcode.
  const parentRow = rows.find((r) => r.hdx_level === "adm2" && r.unit_id === SPLIT_FROM[id]);
  rows.push({ ...parentRow, unit_id: id, match: "split_from", note: `${id} was split from ${SPLIT_FROM[id]} after COD-AB's snapshot` });
}

// Matches one COD-AB feature against a list of {unit, tier, base} candidates
// already scoped to its district family. Returns { unit, match, note }.
//
// Deliberately NO tier-insensitive fallback: a first pass that accepted a
// unique same-base-name candidate of a different tier mapped "Ibanda"
// (county) onto Ibanda Municipality and the 2018 "Bitooma" subcounty onto
// today's Bitooma Town Council — different units with different footprints,
// so the polygon would be wrong. Those are recorded as tier_mismatch
// instead, naming the candidate for anyone reviewing by hand.
function matchWithin(candidates, tier, base, { preferParent } = {}) {
  let hits = candidates.filter((c) => c.base === base && c.tier === tier);
  if (hits.length > 1 && preferParent) {
    const narrowed = hits.filter((c) => c.unit.parent_id === preferParent);
    if (narrowed.length === 1) hits = narrowed;
  }
  if (hits.length === 1) return { unit: hits[0].unit, match: "exact", note: "" };
  if (hits.length > 1) return { unit: null, match: "ambiguous", note: hits.map((h) => h.unit.id).join(" | ") };
  const otherTier = candidates.filter((c) => c.base === base);
  if (otherTier.length) {
    return { unit: null, match: "tier_mismatch", note: otherTier.map((c) => `${c.unit.id} (${c.tier})`).join(" | ") };
  }
  return { unit: null, match: "unmatched", note: "" };
}

// ---- ADM3: county / municipality ----
const adm3 = readRaw(3);
const adm3ByPcode = new Map(adm3.map((f) => [f.properties.adm3_pcode, f]));
const countyGeometry = new Map(); // unit id -> COD-AB feature
for (const f of adm3) {
  const p = f.properties;
  const districtId = pcodeToUnit.get(p.adm2_pcode);
  if (!districtId) {
    row(3, p, null, "unmatched", "parent district unmatched");
    continue;
  }
  const fam = family(districtId);
  const { tier, base } = parseName(p.adm3_name, "county");
  if (/^kcca$/i.test(p.adm3_name.trim())) {
    // Kampala's single ADM3 is KCCA itself: Kampala has no county tier in
    // this project (its divisions sit directly under the district).
    // COD-AB also labels three other counties "KCCA" — in Buikwe, Mityana
    // and Mukono, each holding a lone "Central Division" — a labelling
    // error upstream (those are the old municipalities' divisions), so
    // there's no name to match them on.
    row(
      3,
      p,
      null,
      "no_equivalent",
      districtId === "district:kampala"
        ? "Kampala has no county tier; KCCA = district:kampala"
        : "mislabelled 'KCCA' upstream outside Kampala; no name to match on"
    );
    continue;
  }
  let result = matchWithin(fam.counties, tier, base);
  if (!result.unit && tier === "municipality") {
    // A pre-2020 municipality that became one of the 10 cities in 2020.
    // The city is a different (larger) unit, so this is recorded as a
    // predecessor, never as an exact P-code equivalence or geometry.
    const city = fam.cities.find((c) => parseName(c.name, "city").base === base);
    if (city) result = { unit: city, match: "predecessor", note: "municipality upgraded to city 2020-07-01; city boundary is larger" };
  }
  row(3, p, result.unit, result.match, result.note);
  if (result.unit && result.match === "exact") {
    if (countyGeometry.has(result.unit.id)) {
      // two COD-AB counties onto one of ours: keep neither
      countyGeometry.set(result.unit.id, null);
    } else {
      countyGeometry.set(result.unit.id, f);
      pcodeToUnit.set(p.adm3_pcode, result.unit.id);
    }
  }
}

// ---- ADM4: subcounty / town council / division ----
const claimed = new Map(); // unit id -> row index
const adm4 = readRaw(4);
const adm4ByPcode = new Map(adm4.map((f) => [f.properties.adm4_pcode, f]));
for (const f of adm4) {
  const p = f.properties;
  const districtId = pcodeToUnit.get(p.adm2_pcode);
  if (!districtId) {
    row(4, p, null, "unmatched", "parent district unmatched");
    continue;
  }
  const { tier, base } = parseName(p.adm4_name, "subcounty");
  const override = PCODE_OVERRIDES[p.adm4_pcode];
  const result = override
    ? { unit: idOf.get(override), match: "exact", note: "name differs; matched by PCODE_OVERRIDES" }
    : matchWithin(family(districtId).subcounties, tier, base, { preferParent: pcodeToUnit.get(p.adm3_pcode) });
  if (result.unit && claimed.has(result.unit.id)) {
    // Two COD-AB features resolved to the same unit of ours (a 2018 unit
    // merged since, or a near-duplicate name): mark both ambiguous.
    const prev = rows[claimed.get(result.unit.id)];
    if (prev.match !== "ambiguous") {
      prev.match = "ambiguous";
      prev.note = `shares ${prev.unit_id} with ${p.adm4_pcode}`;
      prev.unit_id = "";
    }
    row(4, p, null, "ambiguous", `shares ${result.unit.id} with ${prev.hdx_pcode}`);
    continue;
  }
  row(4, p, result.unit, result.match, result.note);
  if (result.unit) {
    claimed.set(result.unit.id, rows.length - 1);
  }
}

// ---- geometry check of every exact match (see scripts/lib/fit-to-district.mjs) ----
// A match whose COD-AB polygon sits mostly in some other (current, UBOS)
// district is right on paper but wrong on the ground: its row is
// downgraded to rejected_geometry, so it gets no P-code. Test only — no
// COD-AB geometry is published.
const districtPolys = loadDistrictPolygons(DATA);
rows.forEach((r) => {
  if (r.match !== "exact" || (r.hdx_level !== "adm3" && r.hdx_level !== "adm4")) return;
  const unit = idOf.get(r.unit_id);
  const f = (r.hdx_level === "adm3" ? adm3ByPcode : adm4ByPcode).get(r.hdx_pcode);
  // district polygons include any city carved from the district
  const d = idOf.get(ancestorDistrictId(unit));
  const fit = fitToDistrict(f, d?.level === "city" ? d.parent_id : d?.id, districtPolys, { clip: false });
  if (fit.reject) {
    r.note = `${r.unit_id}: ${fit.reject}`;
    r.unit_id = "";
    r.match = "rejected_geometry";
  }
});

mkdirSync(path.join(DATA, "crosswalk"), { recursive: true });
writeFileSync(
  path.join(DATA, "crosswalk/hdx-cod-ab-uga.csv"),
  writeCsv(["hdx_level", "hdx_pcode", "hdx_name", "hdx_parent_pcode", "unit_id", "match", "note"], rows)
);

// ---- summary ----
const count = (lvl, m) => rows.filter((r) => r.hdx_level === lvl && (!m || r.match === m)).length;
const ourCounties = ecUnits.filter((u) => COUNTY_LEVELS.has(u.level)).length;
const ourSubcounties = ecUnits.filter((u) => SUBCOUNTY_LEVELS.has(u.level)).length;
for (const lvl of ["adm1", "adm2", "adm3", "adm4"]) {
  const tally = {};
  for (const r of rows) if (r.hdx_level === lvl) tally[r.match] = (tally[r.match] || 0) + 1;
  console.log(lvl, count(lvl), JSON.stringify(tally));
}
if (unmatchedAdm2.length) console.log("unmatched COD-AB districts:", unmatchedAdm2.join(", "));
console.log("our districts with no COD-AB equivalent:", districtsWithoutPcode.join(", ") || "none");
const pct = (n, d) => `${n}/${d} (${((n / d) * 100).toFixed(1)}%)`;
console.log(`county P-codes: ${pct(count("adm3", "exact"), ourCounties)}`);
console.log(`subcounty-tier P-codes: ${pct(count("adm4", "exact"), ourSubcounties)}`);
for (const r of rows.filter((x) => x.match === "rejected_geometry")) console.log(`  rejected: ${r.hdx_pcode} ${r.hdx_name} — ${r.note}`);
