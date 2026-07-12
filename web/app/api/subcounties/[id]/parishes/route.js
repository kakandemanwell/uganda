import * as deep from "uganda-locale/deep";
import { ok, notFound } from "../../../../../lib/respond.mjs";

export async function GET(_request, { params }) {
  const { id } = await params;
  const subcountyId = id.includes(":") ? id : `subcounty:${id}`;
  if (!deep.getUnit(subcountyId)) return notFound(`No subcounty/town council/division with id "${subcountyId}"`);
  return ok(deep.parishes({ parentId: subcountyId }));
}
