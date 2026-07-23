// Local re-implementation of the uganda-locale package's public surface
// (src/store.mjs + src/deep.mjs + src/geo.mjs), reading from public/data/
// instead of the installed package's own dist/.
//
// Why this duplication exists: store.mjs/geo.mjs locate their data files
// via `path.dirname(fileURLToPath(import.meta.url))`. Next.js bundles small
// ESM dependencies directly into each route's compiled output, and webpack
// statically resolves import.meta.url to a literal absolute path AT BUILD
// TIME. On Vercel that literal is the *build* machine's path (e.g.
// /vercel/path0/web/node_modules/uganda-locale/src/store.mjs) — which does
// not exist on the *runtime* Lambda filesystem, so every uganda-locale-backed
// route 500'd in production despite working fine locally and at build time.
// (See CHANGELOG for the full trail — outputFileTracingRoot and a
// materialized-copy postinstall step were tried first and didn't fix this;
// this is a different, more fundamental bundling issue than either of those
// addressed.)
//
// process.cwd() is re-evaluated at actual runtime (not frozen at build
// time), which is exactly why web/lib/villages.mjs already reads its CSV
// this way — this module applies the same fix to everything else the app
// needs from the package.
import { readFileSync } from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "public", "data");

const FILES = {
  region: "regions.json",
  subregion: "subregions.json",
  district: "districts.json",
  city: "citys.json",
  county: "countys.json",
  subcounty: "subcountys.json",
  town_council: "town_councils.json",
  division: "divisions.json",
  parish: "parishs.json",
  ward: "wards.json",
  cell: "cells.json",
};

const DEFAULT_LEVELS = [
  "region",
  "subregion",
  "district",
  "city",
  "county",
  "subcounty",
  "town_council",
  "division",
];

const byLevel = new Map();
const byId = new Map();
const childrenOf = new Map();

function indexUnits(units) {
  for (const unit of units) {
    byId.set(unit.id, unit);
    if (unit.parent_id) {
      if (!childrenOf.has(unit.parent_id)) childrenOf.set(unit.parent_id, []);
      childrenOf.get(unit.parent_id).push(unit);
    }
  }
}

function loadLevel(level) {
  if (byLevel.has(level)) return byLevel.get(level);
  const file = FILES[level];
  if (!file) throw new Error(`Unknown level: ${level}`);
  const units = JSON.parse(readFileSync(path.join(DATA_DIR, file), "utf-8"));
  byLevel.set(level, units);
  indexUnits(units);
  return units;
}

for (const level of DEFAULT_LEVELS) loadLevel(level);

export function regions() {
  return loadLevel("region");
}

export function subregions() {
  return loadLevel("subregion");
}

export function districts() {
  return loadLevel("district");
}

export function cities() {
  return loadLevel("city");
}

/** Counties/municipalities. Pass { districtId } to filter to one district. */
export function counties({ districtId } = {}) {
  const all = loadLevel("county");
  return districtId ? all.filter((u) => u.parent_id === districtId) : all;
}

/** Subcounties, town councils, and divisions. Pass { parentId } to filter. */
export function subcounties({ parentId } = {}) {
  const all = [...loadLevel("subcounty"), ...loadLevel("town_council"), ...loadLevel("division")];
  return parentId ? all.filter((u) => u.parent_id === parentId) : all;
}

/** Parishes and wards — opt-in, mirrors uganda-locale/deep. Pass { parentId } to filter. */
export function parishes({ parentId } = {}) {
  const all = [...loadLevel("parish"), ...loadLevel("ward")];
  return parentId ? all.filter((u) => u.parent_id === parentId) : all;
}

/** Cells — opt-in, mirrors uganda-locale/deep. Pass { parentId } to filter. */
export function cells({ parentId } = {}) {
  const all = loadLevel("cell");
  return parentId ? all.filter((u) => u.parent_id === parentId) : all;
}

export function getUnit(id) {
  return byId.get(id);
}

export function getChildren(id) {
  return childrenOf.get(id) ?? [];
}

/** Walk parent_id up to the region. Returns an array from immediate parent to region. */
export function getAncestors(id) {
  const chain = [];
  let current = byId.get(id);
  while (current?.parent_id) {
    const parent = byId.get(current.parent_id);
    if (!parent) break;
    chain.push(parent);
    current = parent;
  }
  return chain;
}

/** Case-insensitive substring search over name/slug/aliases across whichever levels are currently loaded. */
export function search(query, { level, limit = 20 } = {}) {
  if (!query || typeof query !== "string") return [];
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const levels = level ? [level] : [...byLevel.keys()];
  const results = [];
  for (const lvl of levels) {
    for (const unit of loadLevel(lvl)) {
      const haystack = [unit.name, unit.slug, ...(unit.aliases ?? [])]
        .filter(Boolean)
        .map((s) => s.toLowerCase());
      if (haystack.some((s) => s.includes(q))) {
        results.push(unit);
        if (results.length >= limit) return results;
      }
    }
  }
  return results;
}

let countryCache;
export function country() {
  if (!countryCache) {
    countryCache = JSON.parse(readFileSync(path.join(DATA_DIR, "country", "uganda.json"), "utf-8"));
  }
  return countryCache;
}

let dqrCache;
export function dataQualityReport() {
  if (!dqrCache) {
    dqrCache = JSON.parse(readFileSync(path.join(DATA_DIR, "data-quality-report.json"), "utf-8"));
  }
  return dqrCache;
}

const geoCache = {};
function loadGeo(name, file) {
  if (!geoCache[name]) {
    geoCache[name] = JSON.parse(readFileSync(path.join(DATA_DIR, "geo", file), "utf-8"));
  }
  return geoCache[name];
}

export function districtBoundaries() {
  return loadGeo("districts", "districts.geojson");
}

export function regionBoundaries() {
  return loadGeo("regions", "regions.geojson");
}

export function subcountyBoundaries() {
  return loadGeo("subcountys", "subcountys.geojson");
}

export function parishBoundaries() {
  return loadGeo("parishs", "parishs.geojson");
}

export function roads() {
  return loadGeo("roads", "roads.geojson");
}
