import { ok, badRequest } from "../../../lib/respond.mjs";
import { queryUnits, LEVELS } from "../../../lib/units.mjs";

// Generic browse endpoint across any single level of the hierarchy, with
// region/sub-region/district filters and a name search — powers /explore.
// Existing endpoints (/api/districts/:id/counties etc.) stay as they are
// for direct parent->child lookups (used by the cascading hierarchy
// explorer); this one is for "show me every X, optionally narrowed" instead.
export function GET(request) {
  const params = new URL(request.url).searchParams;
  const level = params.get("level");
  const page = Math.max(1, Number(params.get("page") || 1));
  const pageSize = Math.min(500, Math.max(1, Number(params.get("pageSize") || 50)));

  const items = queryUnits({
    level,
    regionId: params.get("regionId") || undefined,
    subregionId: params.get("subregionId") || undefined,
    districtId: params.get("districtId") || undefined,
    subcountyName: params.get("subcountyName") || undefined,
    parishName: params.get("parishName") || undefined,
    q: params.get("q") || undefined,
  });

  if (items === null) {
    return badRequest(`Unknown level '${level}'. Expected one of: ${LEVELS.join(", ")}`);
  }

  const total = items.length;
  const start = (page - 1) * pageSize;
  return ok({ total, page, pageSize, items: items.slice(start, start + pageSize) });
}
