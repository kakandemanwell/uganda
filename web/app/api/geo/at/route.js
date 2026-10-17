import { geoBounds, geoContains } from "d3-geo";
import { badRequest, CACHE_HEADERS } from "../../../../lib/respond.mjs";
import * as uganda from "@/lib/uganda-data.mjs";
import { villagesOfParish } from "@/lib/villages.mjs";

// "What is here?" — everything known about one point: its full hierarchy
// (region -> sub-region -> district/city -> county -> subcounty -> parish),
// each level's codes, population and land area, the parish's villages, and
// whether the point falls in a refugee settlement or in land no unit has
// been assigned. Powers the map's place panel and right-click menu.
//
// Lookup is point-in-polygon on the parish layer first (the finest), then
// up the levels for points no parish covers. Polygons are wound for d3-geo
// (see scripts/validate.mjs), so d3's spherical geoContains is used.

const LAYERS = {
  parish: () => uganda.parishBoundaries(),
  subcounty: () => uganda.subcountyBoundaries(),
  county: () => uganda.countyBoundaries(),
  district: () => uganda.districtBoundaries(),
  city: () => uganda.cityBoundaries(),
  settlement: () => uganda.settlements(),
  gap: () => uganda.gaps(),
};
const index = new Map();
function indexed(layer) {
  if (!index.has(layer)) index.set(layer, LAYERS[layer]().features.map((f) => ({ f, bb: geoBounds(f).flat() })));
  return index.get(layer);
}
function hit(layer, pt) {
  const [x, y] = pt;
  return indexed(layer).find(({ f, bb }) => x >= bb[0] && x <= bb[2] && y >= bb[1] && y <= bb[3] && geoContains(f, pt))?.f ?? null;
}

function describe(unit, feature) {
  if (!unit) return null;
  const p = feature?.properties ?? {};
  return {
    id: unit.id,
    name: unit.name,
    level: unit.level,
    hdx_pcode: unit.external_refs?.hdx_pcode ?? p.hdx_pcode ?? null,
    ubos_code: unit.external_refs?.ubos_code ?? p.ubos_code ?? null,
    population: unit.population?.total ?? p.population?.total ?? null,
    area_km2: p.area_km2 ?? null,
    ...(p.inferred ? { inferred: true, inference: p.inference } : {}),
  };
}

export function GET(request) {
  const params = new URL(request.url).searchParams;
  const lon = Number(params.get("lon"));
  const lat = Number(params.get("lat"));
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return badRequest("lon and lat must be numbers");
  }
  const pt = [lon, lat];
  uganda.parishes(); // ancestry walks need parishes indexed

  // deepest polygon that contains the point
  let feature = null;
  for (const layer of ["parish", "subcounty", "county", "district"]) {
    feature = hit(layer, pt);
    if (feature) break;
  }
  const base = feature ? uganda.getUnit(feature.properties.id) : null;
  const chain = base ? [base, ...uganda.getAncestors(base.id)] : [];
  const at = (levels) => chain.find((u) => levels.includes(u.level)) ?? null;
  const featureFor = (layer, unit) => (unit ? indexed(layer).find(({ f }) => f.properties.id === unit.id)?.f : null);

  const parish = at(["parish", "ward"]);
  const subcounty = at(["subcounty", "town_council", "division"]);
  const county = at(["county", "municipality"]);
  const city = at(["city"]);
  const district = at(["district"]) ?? (city ? uganda.getUnit(city.parent_id) : null);
  const region = at(["region"]) ?? (district ? uganda.getUnit(district.region_id) : null);
  const subregionId = (district ?? city ?? base)?.subregion_id;
  const subregion = subregionId ? uganda.getUnit(subregionId) : null;
  const settlement = hit("settlement", pt);
  const gap = hit("gap", pt);
  const villages = parish ? villagesOfParish(parish.id).map((v) => v.village) : [];

  const body = {
    point: { lon, lat },
    inside_uganda: Boolean(feature) || Boolean(gap),
    levels: {
      region: describe(region),
      subregion: subregion ? { id: subregion.id, name: subregion.name, level: "subregion" } : null,
      district: describe(district, featureFor("district", district)),
      city: describe(city, featureFor("city", city)),
      county: describe(county, featureFor("county", county)),
      subcounty: describe(subcounty, featureFor("subcounty", subcounty)),
      parish: describe(parish, featureFor("parish", parish)),
    },
    villages,
    settlement: settlement
      ? {
          name: settlement.properties.name,
          host_subcounties: (settlement.properties.host_subcounty_ids ?? []).map((id) => uganda.getUnit(id)?.name ?? id),
        }
      : null,
    gap: gap
      ? { kind: gap.properties.kind, level: gap.properties.level, candidates: gap.properties.candidate_names ?? [] }
      : null,
    // the deepest polygon, so the map can outline where the answer applies
    feature: feature ? { type: "Feature", properties: { id: feature.properties.id, name: feature.properties.name }, geometry: feature.geometry } : null,
  };
  return Response.json(body, { headers: CACHE_HEADERS });
}
