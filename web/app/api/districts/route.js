import * as uganda from "@/lib/uganda-data.mjs";
import { ok } from "../../../lib/respond.mjs";

export function GET(request) {
  const params = new URL(request.url).searchParams;
  const regionId = params.get("regionId");
  const subregionId = params.get("subregionId");
  let all = uganda.districts();
  if (regionId) all = all.filter((d) => d.region_id === regionId);
  if (subregionId) all = all.filter((d) => d.subregion_id === subregionId);
  return ok(all);
}
