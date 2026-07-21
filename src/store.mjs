// Internal in-memory index over the compiled dist/ JSON exports.
// Loading is lazy and cached per level: importing "uganda-locale" doesn't
// pay for parish/ward/cell data unless something actually asks for it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", "dist");

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

const byLevel = new Map(); // level -> array
const byId = new Map(); // id -> unit
const childrenOf = new Map(); // parent_id -> array of units

function indexUnits(units) {
  for (const unit of units) {
    byId.set(unit.id, unit);
    if (unit.parent_id) {
      if (!childrenOf.has(unit.parent_id)) childrenOf.set(unit.parent_id, []);
      childrenOf.get(unit.parent_id).push(unit);
    }
  }
}

export function loadLevel(level) {
  if (byLevel.has(level)) return byLevel.get(level);
  const file = FILES[level];
  if (!file) throw new Error(`Unknown level: ${level}`);
  const units = JSON.parse(readFileSync(path.join(DIST, file), "utf-8"));
  byLevel.set(level, units);
  indexUnits(units);
  return units;
}

export function getById(id) {
  return byId.get(id);
}

export function getChildren(id) {
  return childrenOf.get(id) ?? [];
}

export function loadedLevels() {
  return [...byLevel.keys()];
}

let countryCache;
export function loadCountry() {
  if (!countryCache) {
    countryCache = JSON.parse(
      readFileSync(path.join(DIST, "country", "uganda.json"), "utf-8")
    );
  }
  return countryCache;
}

let dqrCache;
export function loadDataQualityReport() {
  if (!dqrCache) {
    dqrCache = JSON.parse(
      readFileSync(path.join(DIST, "data-quality-report.json"), "utf-8")
    );
  }
  return dqrCache;
}

export { DIST };
