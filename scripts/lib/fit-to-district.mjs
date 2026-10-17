// Checks that a sub-district polygon really belongs to the district it was
// matched to, and clips it to that district's outline.
//
// Why not a simple point-in-polygon test: COD-AB polygons include open
// water (Entebbe Municipality is 245 km², most of it Lake Victoria), while
// this project's district layer is clipped to land — so
// a single interior point routinely lands in the lake and fails a test the
// match should pass. Instead: the expected district must be the one the
// polygon overlaps MOST, among every district whose bbox it touches. That
// rejects a name match that's right on paper but wrong on the ground
// (the reason this check exists) while tolerating coastline/vintage drift.
//
// Clipping to the district outline then makes every lower layer nest
// exactly inside the district layer on a map, instead of spilling across
// lakes and neighbouring districts by a few hundred metres.

import { readFileSync } from "node:fs";
import path from "node:path";
import * as turf from "@turf/turf";

export function loadDistrictPolygons(dataDir) {
  const features = JSON.parse(readFileSync(path.join(dataDir, "geo/districts.geojson"), "utf-8")).features;
  return features.map((f) => ({ id: f.properties.id, feature: f, bbox: turf.bbox(f) }));
}

function bboxesOverlap(a, b) {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function overlapArea(a, b) {
  const inter = turf.intersect(turf.featureCollection([a, b]));
  return inter ? { area: turf.area(inter), inter } : { area: 0, inter: null };
}

/**
 * @returns {{ geometry: object, share: number } | { reject: string }}
 *   geometry is clipped to the district and wound for d3-geo (see
 *   scripts/ingest-district-boundaries.mjs for why rings are reversed);
 *   share is the fraction of the polygon's land area inside the district.
 */
export function fitToDistrict(feature, expectedDistrictId, districtPolys, { clip = true } = {}) {
  const expected = districtPolys.find((d) => d.id === expectedDistrictId);
  if (!expected) return { reject: `no polygon for ${expectedDistrictId}` };
  // Simplify before intersecting — the raw COD-AB rings are survey-dense
  // and the output is simplified to the same tolerance afterwards anyway.
  const simple = turf.simplify(feature, { tolerance: 0.0005, highQuality: false });
  const bbox = turf.bbox(simple);
  let best = null;
  let expectedHit = null;
  let total = 0;
  for (const d of districtPolys) {
    if (!bboxesOverlap(bbox, d.bbox)) continue;
    const hit = overlapArea(simple, d.feature);
    total += hit.area;
    if (!best || hit.area > best.area) best = { id: d.id, area: hit.area };
    if (d.id === expectedDistrictId) expectedHit = hit;
  }
  if (!expectedHit?.inter) return { reject: "does not overlap its district" };
  if (best.id !== expectedDistrictId) return { reject: `mostly inside ${best.id}` };
  if (!clip) return { share: total ? expectedHit.area / total : 0 };
  // The test above ran on a simplified copy for speed; the clip itself uses
  // the full-detail polygon, so the caller can simplify the whole layer as
  // one topology afterwards (scripts/lib/topo.mjs) and neighbours still
  // share their borders.
  const full = turf.intersect(turf.featureCollection([feature, expected.feature]));
  const clipped = full && dropSlivers(full);
  if (!clipped) return { reject: "only slivers inside its district" };
  return {
    geometry: turf.rewind(clipped, { reverse: true }).geometry,
    share: total ? expectedHit.area / total : 0,
  };
}

// Clipping two independently-drawn boundary sets against each other leaves
// hairline slivers along shared edges — real area of a few m², and too few
// vertices to survive simplification. Anything under 0.01 km² is noise.
const MIN_PART_M2 = 10_000;
export function dropSlivers(feature) {
  const g = feature.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  const kept = polys
    .map((rings) => rings.filter((ring) => ring.length >= 4))
    .filter((rings) => rings.length && turf.area(turf.polygon(rings)) >= MIN_PART_M2);
  if (!kept.length) return null;
  return kept.length === 1 ? turf.polygon(kept[0]) : turf.multiPolygon(kept);
}

/**
 * Fills interior holes under 1 km². Real lakes inside Uganda are orders of
 * magnitude bigger; anything that small is a gap between polygons that were
 * meant to touch (a union of not-quite-tiling sources leaves hundreds).
 */
const MIN_LAKE_M2 = 1e6;
export function fillSmallHoles(feature) {
  const g = feature.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  const filled = polys.map(([outer, ...holes]) => [outer, ...holes.filter((h) => turf.area(turf.polygon([h])) >= MIN_LAKE_M2)]);
  return filled.length === 1 ? turf.polygon(filled[0], feature.properties) : turf.multiPolygon(filled, feature.properties);
}

/** turf.simplify, falling back to the unsimplified feature if simplification degenerates a ring. */
export function safeSimplify(feature, options) {
  try {
    return turf.simplify(feature, options);
  } catch {
    return feature;
  }
}
