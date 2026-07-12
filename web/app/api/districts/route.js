import * as uganda from "uganda-locale";
import { ok } from "../../../lib/respond.mjs";

export function GET(request) {
  const regionId = new URL(request.url).searchParams.get("regionId");
  const all = uganda.districts();
  return ok(regionId ? all.filter((d) => d.region_id === regionId) : all);
}
