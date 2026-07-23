import * as geo from "@/lib/uganda-data.mjs";
import { ok } from "../../../../lib/respond.mjs";

export function GET() {
  return ok(geo.parishBoundaries());
}
