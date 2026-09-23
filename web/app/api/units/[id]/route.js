import * as uganda from "@/lib/uganda-data.mjs";
import { ok, notFound, badRequest } from "../../../../lib/respond.mjs";
import { villagesOfParish } from "../../../../lib/villages.mjs";

// Every level is lazy-loaded on first use (see lib/uganda-data.mjs) — parish/
// ward load as soon as anything calls parishes(), but cell only loads once
// something calls cells(). Without this, a ward's getChildren() would come
// back empty even when it genuinely has cells, just because nothing had
// asked for cell data yet in this process.
uganda.parishes();
uganda.cells();

// Single-unit detail: the unit itself, its ancestor chain (immediate parent
// up to region), its direct children, and (for a parish/ward) its villages.
// Not available for villages themselves — the CSV they come from (see
// web/lib/villages.mjs) has no stable per-village ids to look up by.
//
// Unlike /api/districts/:id/counties etc., a bare slug is NOT accepted here
// and can't safely be guessed: slugs are only unique within a level (~13%
// collide across levels in this dataset — e.g. "kampala" is both
// district:kampala and subregion:kampala, "abim" is both district:abim and
// subcounty:abim-abim), and this route has no implied parent level to scope
// the guess to. Callers must pass the fully-qualified id.
export async function GET(request, { params }) {
  const { id } = await params;
  if (!id.includes(":")) {
    return badRequest(
      `'${id}' is a bare slug, not a fully-qualified unit id. Slugs aren't unique across levels — pass the full id instead, e.g. 'district:${id}'.`,
    );
  }
  const unit = uganda.getUnit(id);
  if (!unit) return notFound(`No unit found for id '${id}'`);

  return ok({
    unit,
    ancestors: uganda.getAncestors(id),
    children: uganda.getChildren(id),
    // Parishes/wards only: their village rows from the full-ancestry CSV
    // (villages aren't in the unit index, so `children` can't include
    // them). A ward's cells appear both here and in `children`.
    ...((unit.level === "parish" || unit.level === "ward") && { villages: villagesOfParish(id) }),
  });
}
