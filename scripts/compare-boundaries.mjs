// Cross-dataset boundary agreement: how closely each subcounty polygon we
// publish matches the other sources that draw the same unit.
//
// Our subcounties are built bottom-up from UBOS's 2025 parishes (see
// scripts/ingest-ubos-boundaries.mjs). Two independent drawings of the same
// units exist:
//   ubos_nphc_iou  UBOS's own NPHC 2024 subcounty polygon (same UBOS code)
//   hdx_iou        OCHA COD-AB's 2020 subcounty polygon (same P-code)
// Each is intersection-over-union, computed over the unit's own district's
// land (both sources run into lakes and spill a little across district
// lines; that isn't disagreement about the unit). 1 = identical; under ~0.8
// = the sources draw this unit materially differently — a boundary worth a
// look, an outdated source, or a unit reorganised since.
//
// Output: data/qa/boundary-agreement.csv (one row per subcounty with a
// polygon) — merged into the subcounty GeoJSON (agreement_*) and the data-
// quality report by scripts/build.mjs, and coloured on the map.
//
// Inputs (raw, gitignored): data/legacy/provenance/ubos/ubos-nphc-2024/
// subcounties/*.json and data/legacy/provenance/geo/hdx-cod-ab/uga_admin4.geojson.
// Either missing -> that column is left blank.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as turf from "@turf/turf";
import { parseCsvObjects, writeCsv } from "./lib/csv.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(ROOT, "data");
const readJson = (p) => JSON.parse(readFileSync(p, "utf-8"));
const fc = (features) => turf.featureCollection(features);
const trunc = (f) => turf.truncate(f, { precision: 6, coordinates: 2 });
const FAILED = Symbol("failed");
function attempt(fn) {
  try {
    return fn();
  } catch {
    return FAILED;
  }
}
const safe = (fn) => {
  const r = attempt(fn);
  return r === FAILED ? null : r;
};

const ours = readJson(path.join(DATA, "geo/subcountys.geojson")).features;
const districts = new Map(readJson(path.join(DATA, "geo/districts.geojson")).features.map((f) => [f.properties.id, f]));
const cities = new Map(readJson(path.join(DATA, "geo/citys.geojson")).features.map((f) => [f.properties.id, f]));

const ubosDir = path.join(DATA, "legacy/provenance/ubos/ubos-nphc-2024/subcounties");
const nphc = new Map();
if (existsSync(ubosDir)) {
  for (const file of readdirSync(ubosDir)) {
    const raw = readJson(path.join(ubosDir, file));
    const features = (typeof raw.geojson === "string" ? JSON.parse(raw.geojson) : raw.geojson).features;
    for (const f of features) {
      const code = String(f.properties.population_data?.code ?? "");
      if (!code) continue;
      nphc.set(code, nphc.has(code) ? safe(() => turf.union(fc([nphc.get(code), f]))) ?? nphc.get(code) : f);
    }
  }
}
const hdxFile = path.join(DATA, "legacy/provenance/geo/hdx-cod-ab/uga_admin4.geojson");
const hdx = existsSync(hdxFile) ? new Map(readJson(hdxFile).features.map((f) => [f.properties.adm4_pcode, f])) : new Map();
// P-codes are attached to features only at build time; read them from the
// crosswalk (exact matches) instead.
const pcodeOf = new Map(
  parseCsvObjects(readFileSync(path.join(DATA, "crosswalk/hdx-cod-ab-uga.csv"), "utf-8"))
    .filter((r) => r.match === "exact" && r.hdx_level === "adm4")
    .map((r) => [r.unit_id, r.hdx_pcode])
);

// IoU of a and b, both restricted to `frame`. A clipping failure (polyclip
// on a malformed source ring) is "couldn't compare" — null — never a 0,
// which would read as total disagreement.
function iou(a, b, frame) {
  let bb = attempt(() => turf.intersect(fc([trunc(b), frame])));
  if (bb === FAILED) bb = attempt(() => turf.intersect(fc([turf.buffer(trunc(b), 0), frame])));
  if (bb === FAILED) return null;
  if (!bb) return 0; // genuinely no overlap within the district
  const inter = attempt(() => turf.intersect(fc([a, bb])));
  if (inter === FAILED) return null;
  const ia = inter ? turf.area(inter) : 0;
  const ua = turf.area(a) + turf.area(bb) - ia;
  return ua > 0 ? ia / ua : 0;
}

const rows = [];
let n = 0;
for (const f of ours) {
  const p = f.properties;
  const frame = cities.get(p.district_id) ?? districts.get(p.district_id);
  if (!frame) continue;
  const a = trunc(f);
  const fr = trunc(frame);
  const u = p.ubos_code && nphc.get(p.ubos_code) ? iou(a, nphc.get(p.ubos_code), fr) : null;
  const pcode = pcodeOf.get(p.id);
  const h = pcode && hdx.get(pcode) ? iou(a, hdx.get(pcode), fr) : null;
  rows.push({
    id: p.id,
    name: p.name,
    district_id: p.district_id,
    ubos_nphc_iou: u === null ? "" : u.toFixed(3),
    hdx_iou: h === null ? "" : h.toFixed(3),
    // The review flag uses UBOS NPHC 2024 only: COD-AB is the 2018-20 system,
    // so a low hdx_iou mostly means "this unit was split or redrawn since",
    // which is expected, not a problem with our polygon.
    flag: u !== null && u < 0.8 ? "review" : "",
  });
  if (++n % 250 === 0) process.stdout.write(`  ${n}/${ours.length}\n`);
}

mkdirSync(path.join(DATA, "qa"), { recursive: true });
writeFileSync(
  path.join(DATA, "qa/boundary-agreement.csv"),
  writeCsv(["id", "name", "district_id", "ubos_nphc_iou", "hdx_iou", "flag"], rows)
);
const med = (key) => {
  const v = rows.filter((r) => r[key] !== "").map((r) => Number(r[key])).sort((x, y) => x - y);
  return v.length ? v[Math.floor(v.length / 2)].toFixed(3) : "—";
};
console.log(`compared ${rows.length} subcounties`);
console.log(`median IoU vs UBOS NPHC 2024: ${med("ubos_nphc_iou")} (${rows.filter((r) => r.ubos_nphc_iou !== "").length} compared)`);
console.log(`median IoU vs OCHA COD-AB 2020: ${med("hdx_iou")} (${rows.filter((r) => r.hdx_iou !== "").length} compared)`);
console.log(`flagged for review (IoU vs UBOS NPHC < 0.8): ${rows.filter((r) => r.flag).length}`);
