import * as uganda from "@/lib/uganda-data.mjs";
import { ok, notFound } from "../../../../../lib/respond.mjs";

export async function GET(_request, { params }) {
  const { id } = await params;
  const countyId = id.includes(":") ? id : `county:${id}`;
  if (!uganda.getUnit(countyId)) return notFound(`No county with id "${countyId}"`);
  return ok(uganda.subcounties({ parentId: countyId }));
}
