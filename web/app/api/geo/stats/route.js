import { ok, badRequest } from "../../../../lib/respond.mjs";
import { statsFor, STATS_LEVELS } from "@/lib/geo-stats.mjs";

// Per-polygon metric values for one boundary level, keyed by unit id —
// joined client-side onto the GeoJSON from /api/geo/<level> (see
// lib/geo-stats.mjs for what counts toward which polygon).
export function GET(request) {
  const level = new URL(request.url).searchParams.get("level") || "district";
  const stats = statsFor(level);
  if (!stats) return badRequest(`Unknown level '${level}'. Expected one of: ${STATS_LEVELS.join(", ")}`);
  return ok(stats);
}
