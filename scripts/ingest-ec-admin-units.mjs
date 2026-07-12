// Transforms the coordinate-parsed EC "Verified Administrative Units, July
// 2022" village-level data (data/legacy/provenance/ec/parsed_admin_units_2022.json)
// into AdministrativeUnit records at constituency/subcounty/parish/village
// level, resolved against the existing district/city records.
//
// This is treated as `confidence: verified` because it has been cross-checked
// twice: every one of the ~2,198 "TOTAL VILLAGES IN X" checksums embedded in
// the source document matches the parser's accumulated count, AND the fully
// aggregated per-district totals (villages/subcounties/parishes/constituencies)
// match the EC's own independently-published summary statistics document
// exactly, for all 146 districts/cities with zero discrepancies. See
// data/legacy/provenance/ec/ for the parser and both validation passes.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsvObjects } from "./lib/csv.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(ROOT, "data");

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

// ---- resolve district/city name -> id, region_id ----
const districtBySlug = new Map();
for (const r of readCsv("districts.csv")) {
  districtBySlug.set(slugify(r.name), { id: r.id, region_id: r.region_id });
  for (const alias of (r.aliases || "").split(";").map((x) => x.trim()).filter(Boolean)) {
    districtBySlug.set(slugify(alias), { id: r.id, region_id: r.region_id });
  }
}
const cityBySlug = new Map();
for (const r of readCsv("cities.csv")) {
  cityBySlug.set(slugify(r.name), { id: r.id, region_id: r.region_id });
}

function resolveDistrictOrCity(ecDistrictName) {
  const slug = slugify(ecDistrictName);
  if (cityBySlug.has(slug)) return cityBySlug.get(slug);
  if (districtBySlug.has(slug)) return districtBySlug.get(slug);
  return null;
}

// ---- load parsed village-level records ----
const records = JSON.parse(
  readFileSync(path.join(DATA, "legacy/provenance/ec/parsed_admin_units_2022.json"), "utf-8")
);

const SOURCE = ["src-ec-admin-units-2022"];
const units = [];
const usedIds = new Set();

function makeId(prefix, parts) {
  let id = `${prefix}:${parts.map(slugify).join("-")}`;
  let n = 2;
  while (usedIds.has(id)) {
    id = `${prefix}:${parts.map(slugify).join("-")}-${n}`;
    n++;
  }
  usedIds.add(id);
  return id;
}

function subcountyLevel(name) {
  if (/town council/i.test(name)) return "town_council";
  if (/division/i.test(name)) return "division";
  return "subcounty";
}
function parishLevel(name) {
  return /ward/i.test(name) ? "ward" : "parish";
}
function villageLevel(name) {
  return /\bcell\b/i.test(name) ? "cell" : "village";
}

// "Constituency" (353 nationally) is an electoral concept, not the
// region/district/county/subcounty/parish/village hierarchy this project
// targets, and some subcounties (e.g. city divisions) are genuinely split
// across two constituencies for electoral purposes while remaining one
// physical subcounty. Modeling constituency as a tree level between
// district and subcounty would force that one subcounty into two parents
// (or silently merge distinct rural subcounties that happen to reuse a
// code under a different constituency). So subcounty's parent is the
// district/city directly; the constituency name(s) it was listed under are
// kept as metadata on the subcounty instead (external_refs.ec_constituencies).
const subcountyMap = new Map(); // districtId|subcounty_code|subcounty_name -> unit
const parishMap = new Map(); // subcountyUnitId|constituency_code|parish_code -> unit

let unresolvedDistricts = new Set();

for (const r of records) {
  const districtRef = resolveDistrictOrCity(r.district_name);
  if (!districtRef) {
    unresolvedDistricts.add(r.district_name);
    continue;
  }

  const scKey = `${districtRef.id}|${r.subcounty_code}|${r.subcounty_name}`;
  let subcounty = subcountyMap.get(scKey);
  if (!subcounty) {
    const lvl = subcountyLevel(r.subcounty_name);
    subcounty = {
      id: makeId("subcounty", [districtRef.id.split(":")[1], r.subcounty_name]),
      name: titleCase(r.subcounty_name),
      slug: slugify(r.subcounty_name),
      level: lvl,
      type: lvl,
      parent_id: districtRef.id,
      region_id: districtRef.region_id,
      status: "operational",
      confidence: "verified",
      effective_date: null,
      source_ids: SOURCE,
      notes: null,
      external_refs: { ec_subcounty_code: r.subcounty_code, ec_constituencies: [] },
    };
    units.push(subcounty);
    subcountyMap.set(scKey, subcounty);
  }
  const cName = titleCase(r.constituency_name);
  if (!subcounty.external_refs.ec_constituencies.includes(cName)) {
    subcounty.external_refs.ec_constituencies.push(cName);
  }

  const pKey = `${subcounty.id}|${r.constituency_code}|${r.parish_code}`;
  let parish = parishMap.get(pKey);
  if (!parish) {
    const lvl = parishLevel(r.parish_name);
    parish = {
      id: makeId("parish", [districtRef.id.split(":")[1], r.subcounty_name, r.parish_name]),
      name: titleCase(r.parish_name),
      slug: slugify(r.parish_name),
      level: lvl,
      type: lvl,
      parent_id: subcounty.id,
      region_id: districtRef.region_id,
      status: "operational",
      confidence: "verified",
      effective_date: null,
      source_ids: SOURCE,
      notes: null,
      external_refs: { ec_parish_code: r.parish_code },
    };
    units.push(parish);
    parishMap.set(pKey, parish);
  }

  const lvl = villageLevel(r.village_name);
  const village = {
    id: makeId("village", [districtRef.id.split(":")[1], r.subcounty_name, r.parish_name, r.village_name]),
    name: titleCase(r.village_name),
    slug: slugify(r.village_name),
    level: lvl,
    type: lvl,
    parent_id: parish.id,
    region_id: districtRef.region_id,
    status: "operational",
    confidence: "verified",
    effective_date: null,
    source_ids: SOURCE,
    notes: null,
    external_refs: { ec_village_code: r.village_code },
  };
  units.push(village);
}

// ---- promote constituency -> county, wherever that's actually sound ----
// Verified independently two ways: (1) for 2,164 of 2,165 non-city subcounties,
// each carries exactly one EC constituency name, and outside city/Kampala
// divisions a constituency's name in this document IS the county name (not a
// separate electoral-only label) — e.g. "Bugahya County", "Buyanja County".
// (2) spot-checked against independent research (UBOS NPHC drilldowns,
// Wikipedia district pages) for 13 districts and matched exactly, in two
// cases (Nakapiripirit, Kikuube) with this data showing a finer split than
// the independent source mentioned, not a contradiction.
// City/Kampala divisions never get a county — that tier doesn't exist there
// (a Division sits directly under the City/KCCA per Uganda's Local
// Governments Act). The one known non-city exception (Katikamu subcounty,
// Luwero, split across "Katikamu County North"/"South" like a city division)
// is left parented directly to its district with a note, rather than forcing
// an unverified merged name.
const cityAndKccaIds = new Set([...cityBySlug.values()].map((c) => c.id).concat("district:kampala"));
const countyMap = new Map(); // districtId|constituencyName -> unit

for (const subcounty of subcountyMap.values()) {
  if (cityAndKccaIds.has(subcounty.parent_id)) continue; // no county tier under cities/KCCA
  const constituencies = subcounty.external_refs.ec_constituencies;
  if (constituencies.length !== 1) {
    subcounty.notes =
      "Listed under multiple EC constituencies like a city division, but is not one; no single county could be assigned automatically. See external_refs.ec_constituencies.";
    continue;
  }
  const districtId = subcounty.parent_id;
  const countyName = constituencies[0];
  const cKey = `${districtId}|${countyName}`;
  let county = countyMap.get(cKey);
  if (!county) {
    county = {
      id: makeId("county", [districtId.split(":")[1], countyName]),
      name: countyName,
      slug: slugify(countyName),
      level: "county",
      type: /municipality/i.test(countyName) ? "municipality" : "county",
      parent_id: districtId,
      region_id: subcounty.region_id,
      status: "operational",
      confidence: "verified",
      effective_date: null,
      source_ids: SOURCE,
      notes: null,
      external_refs: {},
    };
    units.push(county);
    countyMap.set(cKey, county);
  }
  subcounty.parent_id = county.id;
}

function titleCase(s) {
  return String(s)
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bTc\b/g, "TC")
    .replace(/\bI\b/g, "I")
    .replace(/\bIi\b/g, "II")
    .replace(/\bIii\b/g, "III");
}

if (unresolvedDistricts.size) {
  console.error("UNRESOLVED district names (no matching district/city record):", [...unresolvedDistricts]);
  process.exit(1);
}

writeFileSync(path.join(DATA, "ec/administrative_units_ec2022.json"), JSON.stringify(units));
console.log(`Wrote ${units.length} units to data/ec/administrative_units_ec2022.json`);
const exceptions = [...subcountyMap.values()].filter((s) => s.notes);
console.log({
  counties: countyMap.size,
  subcounties: subcountyMap.size,
  parishes: parishMap.size,
  villages: units.length - countyMap.size - subcountyMap.size - parishMap.size,
  subcounties_without_a_county_exception: exceptions.length,
});
