import { ok, badRequest } from "../../../lib/respond.mjs";
import { queryUnits, withAncestry, paginateGrouped, LEVELS } from "../../../lib/units.mjs";
import { GROUP_BY_FOR_LEVEL } from "../../../lib/explore-config.js";

// Generic browse endpoint across any single level of the hierarchy, with
// region/sub-region/district/county/subcounty/parish filters, a name search,
// and optional grouping by a parent level — powers /explore. Existing
// endpoints (/api/districts/:id/counties etc.) stay as they are for direct
// parent->child lookups (used by the cascading hierarchy explorer); this one
// is for "show me every X, optionally narrowed" instead.
export function GET(request) {
  const params = new URL(request.url).searchParams;
  const level = params.get("level");
  const groupBy = params.get("groupBy") || undefined;
  const page = Math.max(1, Number(params.get("page") || 1));
  const pageSize = Math.min(500, Math.max(1, Number(params.get("pageSize") || 50)));

  const items = queryUnits({
    level,
    regionId: params.get("regionId") || undefined,
    subregionId: params.get("subregionId") || undefined,
    districtId: params.get("districtId") || undefined,
    countyId: params.get("countyId") || undefined,
    subcountyId: params.get("subcountyId") || undefined,
    parishId: params.get("parishId") || undefined,
    subcountyName: params.get("subcountyName") || undefined,
    parishName: params.get("parishName") || undefined,
    q: params.get("q") || undefined,
  });

  if (items === null) {
    return badRequest(`Unknown level '${level}'. Expected one of: ${LEVELS.join(", ")}`);
  }

  const total = items.length;

  if (groupBy) {
    const allowed = GROUP_BY_FOR_LEVEL[level];
    if (!allowed.includes(groupBy)) {
      return badRequest(
        `Can't group ${level} records by '${groupBy}'. Expected one of: ${allowed.join(", ") || "(none — this level has no parent to group by)"}`,
      );
    }
    const grouped = paginateGrouped(items, level, groupBy, page, pageSize);
    return ok({
      total,
      page,
      pageSize,
      groupBy,
      groupCount: grouped.groupCount,
      groups: grouped.groups,
      items: grouped.items.map((item) => withAncestry(item, level)),
    });
  }

  const start = (page - 1) * pageSize;
  return ok({ total, page, pageSize, items: items.slice(start, start + pageSize).map((item) => withAncestry(item, level)) });
}
