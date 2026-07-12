// uganda-locale — region -> district/city -> county/municipality ->
// subcounty/town council/division, plus country metadata.
//
// Bundled by default: region, district, city, county, subcounty,
// town_council, division (~1.3MB). Parish/ward/cell are opt-in via
// "uganda-locale/deep" so a plain `import "uganda-locale"` stays light.
// Village-level data (71,230 records) isn't bundled at all — it's ~33MB
// as JSON; use dist/uganda-locations-full.csv from the repo, or the API,
// instead. See README.md.
import { loadLevel, getById, getChildren as childrenOf, loadCountry, loadDataQualityReport } from "./store.mjs";

const DEFAULT_LEVELS = [
  "region",
  "district",
  "city",
  "county",
  "subcounty",
  "town_council",
  "division",
];

for (const level of DEFAULT_LEVELS) loadLevel(level);

export function regions() {
  return loadLevel("region");
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

/**
 * Subcounties, town councils, and divisions — the tier directly under
 * county/municipality (or directly under district/city where there's no
 * county tier, e.g. Kampala's divisions). Pass { parentId } to filter.
 */
export function subcounties({ parentId } = {}) {
  const all = [
    ...loadLevel("subcounty"),
    ...loadLevel("town_council"),
    ...loadLevel("division"),
  ];
  return parentId ? all.filter((u) => u.parent_id === parentId) : all;
}

/** Look up any bundled unit by its id, e.g. "district:mbarara". */
export function getUnit(id) {
  return getById(id);
}

/** Direct children of a unit, among bundled levels (and deep levels if src/deep.mjs was also imported). */
export function getChildren(id) {
  return childrenOf(id);
}

/** Walk parent_id up to the region. Returns an array from immediate parent to region. */
export function getAncestors(id) {
  const chain = [];
  let current = getById(id);
  while (current?.parent_id) {
    const parent = getById(current.parent_id);
    if (!parent) break;
    chain.push(parent);
    current = parent;
  }
  return chain;
}

/**
 * Case-insensitive substring search over name/slug/aliases across whichever
 * levels are currently loaded (bundled by default; also parish/ward/cell if
 * "uganda-locale/deep" was imported first).
 */
export function search(query, { level, limit = 20 } = {}) {
  if (!query || typeof query !== "string") return [];
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const levels = level ? [level] : DEFAULT_LEVELS;
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

/** Uganda's country-level metadata: ISO codes, currency, calling code, timezone, flag/coat-of-arms paths, etc. */
export function country() {
  return loadCountry();
}

/** The auto-generated coverage/gaps report, regenerated on every `npm run build`. */
export function dataQualityReport() {
  return loadDataQualityReport();
}

export const LEVELS = Object.freeze([...DEFAULT_LEVELS]);
