import { badRequest } from "../../../../lib/respond.mjs";
import { queryUnits, LEVELS } from "../../../../lib/units.mjs";
import { toCsv } from "../../../../lib/csv.mjs";

const VILLAGE_COLUMNS = [
  "id",
  "region",
  "sub_region",
  "district",
  "county",
  "constituency",
  "subcounty",
  "parish",
  "village",
  "confidence",
];
const UNIT_COLUMNS = [
  "id",
  "name",
  "slug",
  "level",
  "region_id",
  "subregion_id",
  "status",
  "confidence",
  "population_total",
  "population_male",
  "population_female",
];

function flattenForExport(unit) {
  return {
    ...unit,
    population_total: unit.population?.total ?? "",
    population_male: unit.population?.male ?? "",
    population_female: unit.population?.female ?? "",
  };
}

// Same filters as /api/units, but returns every matching row (not just one
// page) as a downloadable file — "download the filtered data," not just
// "download everything" (the static files under /data/ already cover that).
export function GET(request) {
  const params = new URL(request.url).searchParams;
  const level = params.get("level");
  const format = params.get("format") === "json" ? "json" : "csv";

  const items = queryUnits({
    level,
    regionId: params.get("regionId") || undefined,
    subregionId: params.get("subregionId") || undefined,
    districtId: params.get("districtId") || undefined,
    q: params.get("q") || undefined,
  });

  if (items === null) {
    return badRequest(`Unknown level '${level}'. Expected one of: ${LEVELS.join(", ")}`);
  }

  const filename = `uganda-locale-${level}${format === "json" ? ".json" : ".csv"}`;

  if (format === "json") {
    return new Response(JSON.stringify(items, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const isVillage = level === "village";
  const columns = isVillage ? VILLAGE_COLUMNS : UNIT_COLUMNS;
  const rows = isVillage ? items : items.map(flattenForExport);
  return new Response(toCsv(rows, columns), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
