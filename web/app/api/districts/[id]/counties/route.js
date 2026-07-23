import * as uganda from "@/lib/uganda-data.mjs";
import { ok, notFound } from "../../../../../lib/respond.mjs";

export async function GET(_request, { params }) {
  const { id } = await params;
  const districtId = id.includes(":") ? id : `district:${id}`;
  if (!uganda.getUnit(districtId)) return notFound(`No district with id "${districtId}"`);
  return ok(uganda.counties({ districtId }));
}
