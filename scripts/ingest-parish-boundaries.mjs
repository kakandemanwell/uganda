// Transforms HDX's COD-AB "admin4" layer for Uganda (this is parish-level —
// confirmed directly from its own attributes: adm2_name is a district name,
// adm3_name a subcounty name, adm4_name a parish name — a different tier
// from geoBoundaries' similarly-numbered but differently-scoped "ADM4
// Sub-county" layer used in scripts/ingest-subcounty-boundaries.mjs,
// despite both having ~1,520 features. Two different tiers, coincidentally
// similar counts — do not confuse them) into a FeatureCollection keyed to
// this project's own parish/ward ids.
//
// Matched on (district name, parish name) pairs rather than parish name
// alone: HDX gives us the district each parish sits in directly, so most of
// the name-collision ambiguity that limited the subcounty match doesn't
// apply here. Coverage is still expected to be far short of this project's
// 10,717 verified parishes/wards (HDX has ~1,520 total) and dated
// 2020-08-24 (predates several district splits), so some parishes may not
// resolve simply because their HDX-listed district name doesn't match any
// current district (e.g. a district that has since been split). Those are
// logged, not guessed.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as turf from "@turf/turf";
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

const PARISH_LEVELS = new Set(["parish", "ward"]);
const ecUnits = JSON.parse(readFileSync(path.join(DATA, "ec/administrative_units_ec2022.json"), "utf-8"));
// See the identical comment in ingest-subcounty-boundaries.mjs: district/city
// records aren't in the EC-derived JSON, so the ancestor walk needs them
// merged in separately or it silently dead-ends at county's parent_id.
const districtsAndCities = [
  ...parseCsvObjects(readFileSync(path.join(DATA, "districts.csv"), "utf-8")).map((r) => ({
    id: r.id,
    name: r.name,
    level: "district",
    parent_id: r.region_id,
  })),
  ...parseCsvObjects(readFileSync(path.join(DATA, "cities.csv"), "utf-8")).map((r) => ({
    id: r.id,
    name: r.name,
    level: "city",
    parent_id: r.parent_district_id,
  })),
];
const idOf = new Map([...ecUnits, ...districtsAndCities].map((u) => [u.id, u]));

function ancestorDistrictId(unit) {
  let u = unit;
  while (u && u.level !== "district" && u.level !== "city") u = idOf.get(u.parent_id);
  return u?.id;
}

// (district_slug|parish_slug) -> [unit] — a parish name can still repeat
// within the same district across different subcounties, so this key can
// still be ambiguous; tracked and excluded the same way as the subcounty pass.
const byDistrictAndName = new Map();
for (const u of ecUnits) {
  if (!PARISH_LEVELS.has(u.level)) continue;
  const districtId = ancestorDistrictId(u);
  const district = districtId ? idOf.get(districtId) : null;
  if (!district) continue;
  const key = `${slugify(district.name)}|${slugify(u.name)}`;
  if (!byDistrictAndName.has(key)) byDistrictAndName.set(key, []);
  byDistrictAndName.get(key).push({ unit: u, districtId });
}
const totalOurUnits = ecUnits.filter((u) => PARISH_LEVELS.has(u.level)).length;

const raw = JSON.parse(readFileSync(path.join(DATA, "legacy/provenance/geo/hdx-uga-admin4-parish.geojson"), "utf-8"));

const features = [];
const matchedUnitIds = new Set();
let noDistrictMatch = 0;
let noNameMatch = 0;
let ambiguousExcluded = 0;

for (const f of raw.features) {
  const key = `${slugify(f.properties.adm2_name)}|${slugify(f.properties.adm4_name)}`;
  const candidates = byDistrictAndName.get(key);
  if (!candidates) {
    // Distinguish "district itself doesn't resolve" from "resolves but no matching parish name"
    const districtSlugExists = [...byDistrictAndName.keys()].some((k) =>
      k.startsWith(slugify(f.properties.adm2_name) + "|")
    );
    if (districtSlugExists) noNameMatch++;
    else noDistrictMatch++;
    continue;
  }
  if (candidates.length > 1) {
    ambiguousExcluded++;
    continue;
  }
  const { unit, districtId } = candidates[0];
  if (matchedUnitIds.has(unit.id)) continue;
  matchedUnitIds.add(unit.id);
  features.push({
    type: "Feature",
    properties: {
      id: unit.id,
      name: unit.name,
      slug: unit.slug,
      level: unit.level,
      district_id: districtId,
      region_id: unit.region_id || null,
      subregion_id: unit.subregion_id || null,
      source_ids: ["src-hdx-cod-ab-uga-admin4-parish"],
    },
    geometry: f.geometry,
  });
}

// Simplified (tolerance 0.001deg, ~111m at the equator) for the same
// package-size reasons as the subcounty layer.
const fc = turf.simplify({ type: "FeatureCollection", features }, { tolerance: 0.001, highQuality: true });

mkdirSync(path.join(DATA, "geo"), { recursive: true });
writeFileSync(path.join(DATA, "geo/parishs.geojson"), JSON.stringify(fc));

console.log("HDX admin4 (parish) features:", raw.features.length);
console.log("matched to a unique parish/ward:", features.length);
console.log("district name didn't resolve at all (pre-split naming, etc):", noDistrictMatch);
console.log("district resolved but no matching parish name in it:", noNameMatch);
console.log("ambiguous (same parish name twice in one district), excluded:", ambiguousExcluded);
console.log(
  `coverage of this project's own ${totalOurUnits} parishes/wards: ${features.length}/${totalOurUnits} ` +
    `(${((features.length / totalOurUnits) * 100).toFixed(2)}%)`
);
