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

// Parishes/wards are lazy-loaded (see lib/uganda-data.mjs), but village
// filtering and grouping resolve every row through its parish_id — so if a
// village query were the first thing this server process handled, every
// lookup would miss. Load them up front, same as app/api/units/[id].
uganda.parishes();

// The /explore levels are coarser than the data's own levels — "subcounty"
// also covers town councils and divisions, "parish" also covers wards, and
// a city counts as a district-equivalent.
const UNIT_LEVELS = {
  region: ["region"],
  subregion: ["subregion"],
  district: ["district", "city"],
  county: ["county"],
  subcounty: ["subcounty", "town_council", "division"],
  parish: ["parish", "ward"],
};

// A unit's lineage: itself, then parent_id up to the region. Cached since
// filtering/grouping 10k parishes (or 71k villages, which share their
// parish's lineage) would otherwise re-walk the same chains every request.
const lineageCache = new Map();
function lineage(id) {
  let chain = lineageCache.get(id);
  if (!chain) {
    const self = uganda.getUnit(id);
    if (!self) return [];
    chain = [self, ...uganda.getAncestors(id)];
    lineageCache.set(id, chain);
  }
  return chain;
}

// Village rows aren't units themselves (no entry in the unit index), so
// their lineage starts at their parish.
function lineageOf(item, level) {
  return lineage(level === "village" ? item.parish_id : item.id);
}

/** Nearest ancestor-or-self at an /explore level (e.g. "district" also matches a city), or null. */
function ancestorAt(chain, targetLevel) {
  const levels = UNIT_LEVELS[targetLevel] ?? [targetLevel];
  const hit = chain.find((u) => levels.includes(u.level));
  if (hit) return hit;
  // Sub-regions aren't in the parent_id chain (a district's parent is its
  // region), only referenced by subregion_id.
  const refId = targetLevel === "region" ? chain[0]?.region_id : targetLevel === "subregion" ? chain[0]?.subregion_id : null;
  return refId ? uganda.getUnit(refId) ?? null : null;
}

function within(chain, id) {
  return chain.some((u) => u.id === id);
}

/** Shared by /api/units (paginated) and /api/units/export (unpaginated) — same filter semantics either way. */
export function queryUnits({ level, regionId, subregionId, districtId, countyId, subcountyId, parishId, subcountyName, parishName, q }) {
  const query = (q || "").trim().toLowerCase();

  let items;
  if (level === "village") {
    items = loadVillages();
    if (regionId) {
      const regionName = uganda.getUnit(regionId)?.name;
      items = items.filter((r) => r.region === regionName);
    }
    if (subregionId) {
      const subregionName = uganda.getUnit(subregionId)?.name;
      items = items.filter((r) => r.sub_region === subregionName);
    }
    // Name-based scoping from before villages carried a parish_id — still
    // used by the map drill-down, which only knows subcounty/parish names.
    if (subcountyName) items = items.filter((r) => r.subcounty === subcountyName);
    if (parishName) items = items.filter((r) => r.parish === parishName);
    if (query) items = items.filter((r) => r.village.toLowerCase().includes(query));
  } else {
    const loader = LEVEL_LOADERS[level];
    if (!loader) return null;
    items = loader();
    if (regionId) items = items.filter((u) => u.region_id === regionId);
    if (subregionId) items = items.filter((u) => u.subregion_id === subregionId);
    if (query) items = items.filter((u) => u.name.toLowerCase().includes(query) || u.slug.includes(query));
  }

  // "Within this unit" — the same test at every level, villages included.
  // Note a city's parent is its namesake district (city:arua -> district:arua),
  // so filtering by a district also takes in that city's divisions/wards/cells.
  for (const id of [districtId, countyId, subcountyId, parishId]) {
    if (id) items = items.filter((item) => within(lineageOf(item, level), id));
  }
  return items;
}

function ref(unit) {
  return unit ? { id: unit.id, name: unit.name } : null;
}

/**
 * Adds an `ancestry` block ({district, county, subcounty, parish} → {id, name}
 * or null) so a table row can show and link its parents without a second
 * request. Excludes the item itself.
 */
export function withAncestry(item, level) {
  const chain = lineageOf(item, level);
  const parents = level === "village" ? chain : chain.slice(1);
  const at = (target) => ref(parents.find((u) => UNIT_LEVELS[target].includes(u.level)));
  return {
    ...item,
    ancestry: {
      district: at("district"),
      county: at("county"),
      subcounty: at("subcounty"),
      parish: at("parish"),
    },
  };
}

/** The nearest district-equivalent, county, subcounty and parish ids for a unit — for building /explore deep links. */
export function lineageIds(unitId) {
  const chain = lineage(unitId);
  const idAt = (target) => chain.find((u) => UNIT_LEVELS[target].includes(u.level))?.id ?? null;
  return {
    districtId: idAt("district"),
    countyId: idAt("county"),
    subcountyId: idAt("subcounty"),
    parishId: idAt("parish"),
  };
}

/**
 * Stable-sorts items into contiguous groups by their ancestor at `groupBy`
 * (alphabetical by that ancestor's name; items with none — e.g. a city
 * division has no county — last), and returns one page plus the group
 * boundaries within it. Each group reports its total size across the whole
 * result, not just this page, and whether it started on an earlier page.
 */
export function paginateGrouped(items, level, groupBy, page, pageSize) {
  const counts = new Map();
  const decorated = items.map((item) => {
    const group = ancestorAt(lineageOf(item, level), groupBy);
    const key = group?.id ?? null;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const parent = group?.parent_id ? uganda.getUnit(group.parent_id) : null;
    const sortKey = group ? `0${group.name.toLowerCase()}\u0000${(parent?.name ?? "").toLowerCase()}\u0000${group.id}` : "1";
    return { item, group, parent, sortKey };
  });
  decorated.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));

  const start = (page - 1) * pageSize;
  const slice = decorated.slice(start, start + pageSize);
  const groups = [];
  slice.forEach((d, i) => {
    const key = d.group?.id ?? null;
    const last = groups.at(-1);
    if (last && last.id === key) {
      last.count++;
      return;
    }
    const prev = i === 0 && start > 0 ? decorated[start - 1] : null;
    groups.push({
      id: key,
      name: d.group?.name ?? null,
      type: d.group?.type ?? null,
      parent: ref(d.parent),
      total: counts.get(key),
      continued: Boolean(prev && (prev.group?.id ?? null) === key),
      count: 1,
    });
  });

  return { items: slice.map((d) => d.item), groups, groupCount: counts.size };
}
