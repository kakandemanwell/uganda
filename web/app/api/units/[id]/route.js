import * as uganda from "@/lib/uganda-data.mjs";
import { ok, notFound } from "../../../../lib/respond.mjs";

// Every level is lazy-loaded on first use (see lib/uganda-data.mjs) — parish/
// ward load as soon as anything calls parishes(), but cell only loads once
// something calls cells(). Without this, a ward's getChildren() would come
// back empty even when it genuinely has cells, just because nothing had
// asked for cell data yet in this process.
uganda.parishes();
uganda.cells();

// Single-unit detail: the unit itself, its ancestor chain (immediate parent
// up to region), and its direct children. Not available for villages —
// the CSV they come from (see web/lib/villages.mjs) has no stable ids to
// look up by, only names.
export async function GET(request, { params }) {
  const { id } = await params;
  const unit = uganda.getUnit(id);
  if (!unit) return notFound(`No unit found for id '${id}'`);

  return ok({
    unit,
    ancestors: uganda.getAncestors(id),
    children: uganda.getChildren(id),
  });
}
