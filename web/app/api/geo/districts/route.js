import * as geo from "uganda-locale/geo";
import { ok } from "../../../../lib/respond.mjs";

export function GET() {
  return ok(geo.districtBoundaries());
}
