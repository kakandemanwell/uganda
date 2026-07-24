import * as uganda from "@/lib/uganda-data.mjs";

export const LEVEL_LABEL = {
  region: "Region",
  subregion: "Sub-region",
  district: "District",
  city: "City",
  county: "County",
  municipality: "Municipality",
  subcounty: "Subcounty",
  town_council: "Town council",
  division: "Division",
  parish: "Parish",
  ward: "Ward",
  cell: "Cell",
};

/**
 * "{name} — a {level} in {place}, population N (2024 census)." — shared by
 * /unit/[id]'s own metadata and the homepage's ?district= deep link, so a
 * link shared for either unfurls with the same district-specific title/OG
 * instead of the generic homepage card.
 */
export function describeUnit(unit) {
  const region = unit.region_id ? uganda.getUnit(unit.region_id) : null;
  const subregion = unit.subregion_id ? uganda.getUnit(unit.subregion_id) : null;
  const levelLabel = (LEVEL_LABEL[unit.level] ?? unit.level).toLowerCase();
  const place =
    [subregion, region]
      .filter((p) => p && p.name !== unit.name)
      .map((p) => p.name)
      .join(", ") || "Uganda";
  const description = `${unit.name} — a ${levelLabel} in ${place}${
    unit.population ? `, population ${unit.population.total.toLocaleString()} (2024 census)` : ""
  }.`;
  return description;
}
