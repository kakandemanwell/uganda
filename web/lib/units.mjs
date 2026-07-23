import * as uganda from "@/lib/uganda-data.mjs";
import { loadVillages } from "./villages.mjs";

export const LEVEL_LOADERS = {
  region: () => uganda.regions(),
  subregion: () => uganda.subregions(),
  district: () => uganda.districts(),
  city: () => uganda.cities(),
  county: () => uganda.counties(),
  subcounty: () => uganda.subcounties(),
  parish: () => uganda.parishes(),
};

export const LEVELS = [...Object.keys(LEVEL_LOADERS), "village"];

function matchesDistrict(unit, districtId) {
  if (!districtId) return true;
  if (unit.id === districtId) return true;
  return uganda.getAncestors(unit.id).some((a) => a.id === districtId);
}

/** Shared by /api/units (paginated) and /api/units/export (unpaginated) — same filter semantics either way. */
export function queryUnits({ level, regionId, subregionId, districtId, subcountyName, parishName, q }) {
  const query = (q || "").trim().toLowerCase();

  if (level === "village") {
    let rows = loadVillages();
    if (regionId) {
      const regionName = uganda.getUnit(regionId)?.name;
      rows = rows.filter((r) => r.region === regionName);
    }
    if (subregionId) {
      const subregionName = uganda.getUnit(subregionId)?.name;
      rows = rows.filter((r) => r.sub_region === subregionName);
    }
    if (districtId) {
      const districtName = uganda.getUnit(districtId)?.name;
      rows = rows.filter((r) => r.district === districtName);
    }
    // Villages have no stable ids at all (see web/lib/villages.mjs), so
    // deeper scoping within a district has to go by name too — used by the
    // map drill-down, which knows a subcounty/parish's *name* from the
    // regular hierarchical API (/api/counties/:id/subcounties etc.) but has
    // nothing else to match village rows against.
    if (subcountyName) rows = rows.filter((r) => r.subcounty === subcountyName);
    if (parishName) rows = rows.filter((r) => r.parish === parishName);
    if (query) rows = rows.filter((r) => r.village.toLowerCase().includes(query));
    return rows;
  }

  const loader = LEVEL_LOADERS[level];
  if (!loader) return null;

  let items = loader();
  if (regionId) items = items.filter((u) => u.region_id === regionId);
  if (subregionId) items = items.filter((u) => u.subregion_id === subregionId);
  if (districtId) items = items.filter((u) => matchesDistrict(u, districtId));
  if (query) items = items.filter((u) => u.name.toLowerCase().includes(query) || u.slug.includes(query));
  return items;
}
