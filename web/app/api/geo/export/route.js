import { geoBounds, geoCentroid } from "d3-geo";
import { badRequest, CACHE_HEADERS } from "../../../../lib/respond.mjs";
import * as uganda from "@/lib/uganda-data.mjs";
import { statsFor, STATS_LEVELS } from "@/lib/geo-stats.mjs";
import { metricsForLevel, DATA_ATTRIBUTION } from "@/lib/map-config.js";
import { toCsv } from "../../../../lib/csv.mjs";

const BOUNDARIES = {
  region: () => uganda.regionBoundaries(),
  subregion: () => uganda.subregionBoundaries(),
  district: () => uganda.districtBoundaries(),
  county: () => uganda.countyBoundaries(),
  subcounty: () => uganda.subcountyBoundaries(),
  parish: () => uganda.parishBoundaries(),
};

const round = (n, d) => (typeof n === "number" ? Math.round(n * 10 ** d) / 10 ** d : null);

function bboxesOverlap(a, b) {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

// Boundary polygons joined with their map statistics, for download — the
// map's "export what you see". Filters (all optional, combinable):
//   within=<unit id>   only polygons inside that region/district/city/county
//   bbox=w,s,e,n       only polygons touching that box (the map viewport)
//   ids=a,b,c          only these polygons
// format=geojson (default) keeps geometry; format=csv drops it and adds a
// centroid instead, for spreadsheets. Every row carries the unit's OCHA
// COD-AB P-code where one exists (hdx_pcode) and the most specific P-code
// containing it (hdx_within_pcode), so exports join onto humanitarian data.
export function GET(request) {
  const params = new URL(request.url).searchParams;
  const level = params.get("level") || "district";
  if (!BOUNDARIES[level]) return badRequest(`Unknown level '${level}'. Expected one of: ${STATS_LEVELS.join(", ")}`);
  const format = params.get("format") === "csv" ? "csv" : "geojson";

  const within = params.get("within") || null;
  if (within && !uganda.getUnit(within)) return badRequest(`Unknown unit '${within}' for within=`);
  let bbox = null;
  if (params.get("bbox")) {
    bbox = params.get("bbox").split(",").map(Number);
    if (bbox.length !== 4 || bbox.some((n) => !Number.isFinite(n))) return badRequest("bbox must be w,s,e,n");
  }
  const ids = params.get("ids") ? new Set(params.get("ids").split(",")) : null;

  uganda.parishes(); // ancestry walks below need parishes indexed
  const stats = statsFor(level);
  const metricKeys = metricsForLevel(level).map((m) => m.key);

  const features = [];
  for (const f of BOUNDARIES[level]().features) {
    const p = f.properties;
    if (ids && !ids.has(p.id)) continue;
    const ancestors = uganda.getAncestors(p.id);
    if (within && p.id !== within && p.region_id !== within && !ancestors.some((a) => a.id === within)) continue;
    if (bbox && !bboxesOverlap(geoBounds(f).flat(), bbox)) continue;

    const unit = uganda.getUnit(p.id);
    const nameAt = (levels) => ancestors.find((a) => levels.includes(a.level))?.name ?? "";
    const s = stats.values[p.id] ?? {};
    const [lon, lat] = geoCentroid(f);
    const props = {
      id: p.id,
      name: p.name,
      level: unit?.level ?? level,
      region: level === "region" ? "" : uganda.getUnit(unit?.region_id ?? p.region_id)?.name ?? "",
      district: nameAt(["district", "city"]),
      county: nameAt(["county", "municipality"]),
      subcounty: nameAt(["subcounty", "town_council", "division"]),
      hdx_pcode: unit?.external_refs?.hdx_pcode ?? p.hdx_pcode ?? "",
      hdx_within_pcode: unit?.external_refs?.hdx_within_pcode ?? "",
      ubos_code: p.ubos_code ?? unit?.external_refs?.ubos_code ?? "",
      geometry_source: p.inferred ? "inferred" : "ubos",
    };
    for (const key of metricKeys) {
      props[key] = key === "density" || key === "villages_per_km2" ? round(s[key], 2) : key === "subcounty_coverage" ? round(s[key], 3) : s[key] ?? null;
    }
    props.centroid_lon = round(lon, 5);
    props.centroid_lat = round(lat, 5);
    props.source_ids = (p.source_ids ?? []).join(";");
    features.push({ type: "Feature", properties: props, geometry: f.geometry });
  }

  const suffix = within ? `-in-${within.split(":").pop()}` : bbox ? "-in-view" : "";
  const filename = `uganda-${level}-boundaries${suffix}.${format === "csv" ? "csv" : "geojson"}`;
  const headers = { ...CACHE_HEADERS, "Content-Disposition": `attachment; filename="${filename}"` };

  if (format === "csv") {
    const rows = features.map((f) => f.properties);
    const columns = rows.length ? Object.keys(rows[0]) : ["id", "name", "level"];
    return new Response(toCsv(rows, columns), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
  }

  const body = {
    type: "FeatureCollection",
    name: `uganda-${level}-boundaries`,
    attribution: DATA_ATTRIBUTION,
    license: "Boundaries CC BY-IGO (OCHA COD-AB / UBOS); compiled data CC BY 4.0 (uganda-locale) — see LICENSE-DATA.md",
    filters: { level, within, bbox, ids: ids ? [...ids] : null },
    features,
  };
  return new Response(JSON.stringify(body), { headers: { ...headers, "Content-Type": "application/geo+json" } });
}
