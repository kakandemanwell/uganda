// Transforms the raw geoBoundaries ADM4-for-Uganda release (labeled
// "Sub-county" by geoBoundaries; confirmed by cross-checking a sample of its
// 1,521 shapeName values against this project's own subcounty/town_council/
// division AND parish/ward name lists — the overwhelming majority matched
// the subcounty-tier list, not parish, so the ADM4 label is accurate) into a
// FeatureCollection keyed to this project's own subcounty/town_council/
// division ids.
//
// Unlike the district layer, this one is NOT expected to reach full
// coverage: geoBoundaries' 1,521 features cover roughly 60-70% of this
// project's 2,191 verified subcounty-tier units (see the printed summary
// for the exact number), and geoBoundaries carries no parent-district
// attribute at all, so ~5% of this project's own subcounty names are
// ambiguous (the same name reused in more than one district, e.g. multiple
// "Central Division"s) and can't be safely matched by name alone — those
// are excluded rather than guessed. Per project policy (see conversation/
// docs/DATA_QUALITY.md): ship what's real and verifiable now, document the
// gap precisely, don't wait for a perfect source.

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

const SUBCOUNTY_LEVELS = new Set(["subcounty", "town_council", "division"]);
const ecUnits = JSON.parse(readFileSync(path.join(DATA, "ec/administrative_units_ec2022.json"), "utf-8"));
// ancestorDistrictId needs to walk past county all the way to district/city,
// and district/city records live in their own CSVs, not in the EC-derived
// JSON — build.mjs merges everything into one `units` array before doing
// this same walk; this script needs the same merge, not just ecUnits alone,
// or the walk silently dead-ends at county's parent_id and returns undefined.
const districtsAndCities = [
  ...parseCsvObjects(readFileSync(path.join(DATA, "districts.csv"), "utf-8")).map((r) => ({
    id: r.id,
    level: "district",
    parent_id: r.region_id,
  })),
  ...parseCsvObjects(readFileSync(path.join(DATA, "cities.csv"), "utf-8")).map((r) => ({
    id: r.id,
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

const bySlug = new Map(); // slug -> [unit]
for (const u of ecUnits) {
  if (!SUBCOUNTY_LEVELS.has(u.level)) continue;
  const slug = slugify(u.name);
  if (!bySlug.has(slug)) bySlug.set(slug, []);
  bySlug.get(slug).push(u);
}
const totalOurUnits = [...bySlug.values()].reduce((s, v) => s + v.length, 0);

const raw = JSON.parse(
  readFileSync(path.join(DATA, "legacy/provenance/geo/geoBoundaries-UGA-ADM4.geojson"), "utf-8")
);

const features = [];
const matchedUnitIds = new Set();
let noNameMatch = 0;
let ambiguousExcluded = 0;
const ambiguousNames = new Set();

for (const f of raw.features) {
  const slug = slugify(f.properties.shapeName);
  const candidates = bySlug.get(slug);
  if (!candidates) {
    noNameMatch++;
    continue;
  }
  if (candidates.length > 1) {
    ambiguousExcluded++;
    ambiguousNames.add(f.properties.shapeName);
    continue;
  }
  const unit = candidates[0];
  if (matchedUnitIds.has(unit.id)) continue; // geoBoundaries has no dupes we've seen, but guard anyway
  matchedUnitIds.add(unit.id);
  const districtId = ancestorDistrictId(unit);
  const district = districtId ? idOf.get(districtId) : null;
  features.push({
    type: "Feature",
    properties: {
      id: unit.id,
      name: unit.name,
      slug: unit.slug,
      level: unit.level,
      district_id: districtId || null,
      region_id: unit.region_id || null,
      subregion_id: unit.subregion_id || null,
      source_ids: ["src-geoboundaries-uga-adm4"],
    },
    geometry: f.geometry,
  });
}

// Simplified (tolerance 0.001deg, ~111m at the equator) — the raw match was
// 36MB for 1,249 features, too heavy to ship in an npm package. This is a
// visualization/thumbnail-map precision tradeoff, not survey-grade; anyone
// needing full-precision geometry should go back to the raw geoBoundaries
// ADM4 release directly (see data/sources.json -> src-geoboundaries-uga-adm4).
const fc = turf.simplify(
  { type: "FeatureCollection", features },
  { tolerance: 0.001, highQuality: true }
);

mkdirSync(path.join(DATA, "geo"), { recursive: true });
writeFileSync(path.join(DATA, "geo/subcountys.geojson"), JSON.stringify(fc));

console.log("geoBoundaries ADM4 features:", raw.features.length);
console.log("matched to a unique subcounty/town_council/division:", features.length);
console.log("no name match at all in our data:", noNameMatch);
console.log("ambiguous (name shared by 2+ districts), excluded:", ambiguousExcluded, `(${ambiguousNames.size} distinct names)`);
console.log(
  `coverage of this project's own ${totalOurUnits} subcounty-tier units: ${features.length}/${totalOurUnits} ` +
    `(${((features.length / totalOurUnits) * 100).toFixed(1)}%)`
);
