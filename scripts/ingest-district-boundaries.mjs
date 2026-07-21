// Transforms the raw geoBoundaries ADM3-for-Uganda release
// (data/legacy/provenance/geo/geoBoundaries-UGA-ADM3.geojson, CC0, 2020
// vintage — see data/sources.json -> src-geoboundaries-uga-adm3) into a
// FeatureCollection keyed to this project's own district ids, so consumers
// never have to deal with geoBoundaries' own shapeName spelling quirks.
//
// geoBoundaries' 137 features = our 136 districts + one extraneous
// "Lake Victoria" water-body polygon (dropped). Of the 136 real districts,
// 133 name-match this project's district slugs directly (or via an existing
// alias, e.g. "Ssembabule" -> district:sembabule); 3 have typos not worth
// carrying as permanent aliases on the district record itself (Kalanga,
// Kitagwenga, Rubirzi) and are corrected here instead.

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

function readCsv(rel) {
  return parseCsvObjects(readFileSync(path.join(DATA, rel), "utf-8"));
}

const districtBySlug = new Map();
for (const r of readCsv("districts.csv")) {
  const ref = { id: r.id, name: r.name, slug: r.slug, region_id: r.region_id, subregion_id: r.subregion_id || null };
  districtBySlug.set(slugify(r.name), ref);
  for (const alias of (r.aliases || "").split(";").map((x) => x.trim()).filter(Boolean)) {
    districtBySlug.set(slugify(alias), ref);
  }
}

// Typo corrections in the upstream geoBoundaries shapeName field — confirmed
// by inspecting all 137 shapeName values directly; every other name matches
// a district slug or existing alias with no override needed.
const SHAPE_NAME_OVERRIDES = {
  kalanga: "kalangala",
  kitagwenga: "kitagwenda",
  rubirzi: "rubirizi",
};
const DROP_SHAPE_NAMES = new Set(["lake-victoria"]);

const raw = JSON.parse(
  readFileSync(path.join(DATA, "legacy/provenance/geo/geoBoundaries-UGA-ADM3.geojson"), "utf-8")
);

const seenDistrictIds = new Set();
const features = [];
const unresolved = [];

for (const f of raw.features) {
  const rawSlug = slugify(f.properties.shapeName);
  if (DROP_SHAPE_NAMES.has(rawSlug)) continue;
  const slug = SHAPE_NAME_OVERRIDES[rawSlug] || rawSlug;
  const district = districtBySlug.get(slug);
  if (!district) {
    unresolved.push(f.properties.shapeName);
    continue;
  }
  seenDistrictIds.add(district.id);
  features.push({
    type: "Feature",
    properties: {
      id: district.id,
      name: district.name,
      slug: district.slug,
      region_id: district.region_id,
      subregion_id: district.subregion_id,
      source_ids: ["src-geoboundaries-uga-adm3"],
    },
    // geoBoundaries' rings are wound opposite to what d3-geo (and the
    // GeoJSON/RFC 7946 spherical right-hand rule) expects — left as-is,
    // every feature renders correctly on its own but with an extra
    // full-canvas-tracing ring when projected with d3-geo, since d3
    // interprets "outside" and "inside" backwards for these rings and
    // draws the clip rectangle to compensate. turf.rewind's *default*
    // (reverse: false) targets the PLANAR convention (flat x/y shoelace),
    // which is the OPPOSITE handedness from the spherical convention d3-geo
    // uses — confirmed empirically (reverse: true is what actually fixes
    // rendering; reverse: false left the artifact in place). Applied
    // uniformly to every feature regardless of its current winding, so
    // features that happened to already be correctly wound are unaffected
    // (rewind to a fixed target orientation is idempotent).
    geometry: turf.rewind(f, { reverse: true }).geometry,
  });
}

if (unresolved.length) {
  console.error("UNRESOLVED shapeName values (no matching district):", unresolved);
  process.exit(1);
}

const allDistrictIds = new Set(readCsv("districts.csv").map((r) => r.id));
const missing = [...allDistrictIds].filter((id) => !seenDistrictIds.has(id));
if (missing.length) {
  console.error("Districts with NO boundary geometry found:", missing);
  process.exit(1);
}

mkdirSync(path.join(DATA, "geo"), { recursive: true });
const fc = { type: "FeatureCollection", features };
// Compact (no pretty-print): this is coordinate data, not something meant to
// be hand-read, and indenting would multiply the file size for no benefit.
writeFileSync(path.join(DATA, "geo/districts.geojson"), JSON.stringify(fc));
console.log(`Wrote ${features.length} district boundary features to data/geo/districts.geojson`);
