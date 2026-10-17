// Per-polygon statistics for the map's choropleth and its exports: for one
// boundary level, every polygon's metric values, keyed by unit id (the same
// id the GeoJSON features carry, so the client can join them with
// MapLibre's feature-state without re-downloading geometry).
//
// Two rules decide which polygon a unit counts toward:
// - On the district layer a city counts toward the district it was carved
//   from: each district polygon includes its cities' territory (cities
//   also have their own layer, /api/geo/cities, which this map doesn't
//   colour separately).
// - Region/district/county/subcounty membership comes from the unit's own
//   ancestry (EC data), never from geometry: a village counts toward the
//   subcounty it's administratively in, whether or not that subcounty has a
//   polygon.
//
// Computed once per server instance and cached; the inputs only change on
// a redeploy.
import * as uganda from "@/lib/uganda-data.mjs";
import { loadVillages } from "@/lib/villages.mjs";

const BOUNDARIES = {
  region: () => uganda.regionBoundaries(),
  subregion: () => uganda.subregionBoundaries(),
  district: () => uganda.districtBoundaries(),
  county: () => uganda.countyBoundaries(),
  subcounty: () => uganda.subcountyBoundaries(),
  parish: () => uganda.parishBoundaries(),
};
export const STATS_LEVELS = Object.keys(BOUNDARIES);

const SUBCOUNTY_LEVELS = new Set(["subcounty", "town_council", "division"]);
const COUNTY_LEVELS = new Set(["county", "municipality"]);
const PARISH_LEVELS = new Set(["parish", "ward"]);

/** The polygon id a unit belongs to at `level`, from its ancestry. */
function ownerAt(chain, level) {
  if (level === "region") return chain[0]?.region_id ?? null;
  if (level === "subregion") return chain.find((u) => u.subregion_id)?.subregion_id ?? null;
  if (level === "district") {
    const d = chain.find((u) => u.level === "district" || u.level === "city");
    return d?.level === "city" ? d.parent_id : d?.id ?? null;
  }
  if (level === "county") return chain.find((u) => COUNTY_LEVELS.has(u.level))?.id ?? null;
  if (level === "parish") return chain.find((u) => PARISH_LEVELS.has(u.level))?.id ?? null;
  return chain.find((u) => SUBCOUNTY_LEVELS.has(u.level))?.id ?? null;
}

const chainCache = new Map();
function chainOf(id) {
  let chain = chainCache.get(id);
  if (!chain) {
    const self = uganda.getUnit(id);
    chain = self ? [self, ...uganda.getAncestors(id)] : [];
    chainCache.set(id, chain);
  }
  return chain;
}

const cache = new Map();

/**
 * @returns {{ level, values: Record<string, object>, totals: object }}
 *   values[id] holds every metric in lib/map-config.js that applies to the
 *   level (others are absent), plus the feature's name/hdx_pcode.
 */
export function statsFor(level) {
  if (cache.has(level)) return cache.get(level);
  if (!BOUNDARIES[level]) return null;
  uganda.parishes(); // lazy-loaded; ancestry walks need them indexed

  const fc = BOUNDARIES[level]();
  const values = {};
  for (const f of fc.features) {
    const p = f.properties;
    values[p.id] = {
      name: p.name,
      hdx_pcode: p.hdx_pcode ?? null,
      ...(p.inferred ? { inferred: true } : {}),
      area_km2: p.area_km2 ?? null,
      subcounties: 0,
      parishes: 0,
      villages: 0,
    };
  }
  const bump = (id, key, by = 1) => {
    if (id && values[id]) values[id][key] += by;
  };

  for (const u of uganda.subcounties()) bump(ownerAt(chainOf(u.id), level), "subcounties");
  for (const u of uganda.parishes()) bump(ownerAt(chainOf(u.id), level), "parishes");
  for (const row of loadVillages()) bump(ownerAt(chainOf(row.parish_id), level), "villages");

  if (level === "region" || level === "subregion" || level === "district") {
    for (const u of [...uganda.districts(), ...uganda.cities()]) {
      if (!u.population) continue;
      const owner = ownerAt([u], level);
      if (values[owner]) values[owner].population = (values[owner].population ?? 0) + u.population.total;
    }
    // Subcounty map coverage: polygons present / subcounties that exist.
    const mapped = new Set(uganda.subcountyBoundaries().features.map((f) => f.properties.id));
    const withPolygon = {};
    for (const u of uganda.subcounties()) {
      const owner = ownerAt(chainOf(u.id), level);
      if (mapped.has(u.id) && owner) withPolygon[owner] = (withPolygon[owner] ?? 0) + 1;
    }
    for (const [id, v] of Object.entries(values)) {
      v.subcounty_coverage = v.subcounties ? (withPolygon[id] ?? 0) / v.subcounties : null;
    }
  }

  // Below district, 2024 population comes with the polygons (UBOS NPHC per
  // subcounty, summed to counties by scripts/build.mjs).
  if (level === "county" || level === "subcounty") {
    for (const f of fc.features) {
      const pop = f.properties.population;
      if (pop?.total != null && values[f.properties.id]) values[f.properties.id].population = pop.total;
      const a = f.properties.agreement?.ubos_nphc_iou;
      if (level === "subcounty" && typeof a === "number" && values[f.properties.id]) values[f.properties.id].agreement = a;
    }
  }

  for (const v of Object.values(values)) {
    if (v.area_km2) {
      if (v.population != null) v.density = v.population / v.area_km2;
      v.villages_per_km2 = v.villages / v.area_km2;
    }
    // Nothing below a subcounty is a subcounty, nothing below a parish a parish.
    if (level === "subcounty" || level === "parish") delete v.subcounties;
    if (level === "parish") delete v.parishes;
  }

  const totals = { features: fc.features.length };
  for (const key of ["population", "subcounties", "parishes", "villages", "area_km2"]) {
    const nums = Object.values(values).map((v) => v[key]).filter((x) => typeof x === "number");
    if (nums.length) totals[key] = nums.reduce((a, b) => a + b, 0);
  }

  const result = { level, values, totals };
  cache.set(level, result);
  return result;
}
