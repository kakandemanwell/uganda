import * as deep from "@/lib/uganda-data.mjs";
import { ok, badRequest } from "../../../lib/respond.mjs";
import { LEVELS } from "../../../lib/units.mjs";

// deep.search() loads each candidate level via loadLevel(), which throws
// for anything not in its FILES map — that must be caught here, since
// letting it reach `level` unvalidated crashes the request with a 500
// instead of a clean 400 (villages aren't included: they're read from a
// separate CSV, not indexed by uganda-data.mjs's byLevel, so search()
// doesn't support them regardless of this check).
const SEARCHABLE_LEVELS = LEVELS.filter((level) => level !== "village");

export function GET(request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q") ?? "";
  const level = params.get("level") ?? undefined;
  if (level && !SEARCHABLE_LEVELS.includes(level)) {
    return badRequest(`Unknown level '${level}'. Expected one of: ${SEARCHABLE_LEVELS.join(", ")}`);
  }
  const limit = Number(params.get("limit") ?? 20);
  return ok(deep.search(q, { level, limit }));
}
