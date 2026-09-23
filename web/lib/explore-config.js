// Shared by /api/units (validation, grouping) and the /explore client
// (which filters/group-by options to show) — no server-only imports here,
// so it's safe to pull into a client component.

// Which ancestor filters make sense at each level, top-down. A region can't
// be "in" a district, but a village can be narrowed all the way down to a
// single parish.
export const FILTERS_FOR_LEVEL = {
  region: [],
  subregion: ["region"],
  district: ["region", "subregion"],
  city: ["region", "subregion"],
  county: ["region", "subregion", "district"],
  subcounty: ["region", "subregion", "district", "county"],
  parish: ["region", "subregion", "district", "county", "subcounty"],
  village: ["region", "subregion", "district", "county", "subcounty", "parish"],
};

// Which parent level each level's rows can be grouped under.
export const GROUP_BY_FOR_LEVEL = {
  region: [],
  subregion: ["region"],
  district: ["region", "subregion"],
  city: ["region", "subregion"],
  county: ["region", "district"],
  subcounty: ["district", "county"],
  parish: ["district", "county", "subcounty"],
  village: ["district", "county", "subcounty", "parish"],
};

// Query-string names for each filter level, e.g. ?subcountyId=...
export const FILTER_PARAM = {
  region: "regionId",
  subregion: "subregionId",
  district: "districtId",
  county: "countyId",
  subcounty: "subcountyId",
  parish: "parishId",
};

export const NOUN = {
  region: ["region", "regions"],
  subregion: ["sub-region", "sub-regions"],
  district: ["district", "districts"],
  city: ["city", "cities"],
  county: ["county", "counties"],
  subcounty: ["subcounty", "subcounties"],
  parish: ["parish", "parishes"],
  village: ["village", "villages"],
};

export function pluralize(level, count) {
  const [one, many] = NOUN[level] ?? [level, `${level}s`];
  return count === 1 ? one : many;
}
