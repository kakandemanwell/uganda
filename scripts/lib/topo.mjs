// Topology-preserving simplification for boundary layers.
//
// Simplifying each polygon on its own (turf.simplify per feature) moves
// the two copies of every shared border independently, leaving hairline
// gaps and overlaps between neighbours — invisible at country zoom, but
// they show up as slivers in a zoomed-in map and as ~1,500 slit-shaped
// holes when districts are unioned into regions. Building a TopoJSON
// topology first stores each shared border once (as an arc), so it's
// simplified once and both neighbours keep using the identical line.

import { topology } from "topojson-server";
import { presimplify, simplify, filter, filterAttachedWeight } from "topojson-simplify";
import { feature } from "topojson-client";
import * as turf from "@turf/turf";

// 1e6 quantization over Uganda's ~5.5° extent is a ~0.6 m grid: fine enough
// to lose nothing visible, coarse enough to snap together vertices that are
// meant to coincide but differ in the 10th decimal place.
const QUANTIZATION = Number(process.env.TOPO_QUANTIZATION) || 1e6;

// Visvalingam effective-area threshold, in square degrees (1 km² ≈ 8.1e-5).
// 2.5e-6 (~0.03 km²) lands the district layer near its previous size with
// no visible loss at the zoom levels the map allows.
export const DEFAULT_MIN_WEIGHT = 2.5e-6;
// Rings (islands, holes) under ~0.01 km² that touch nothing else are dropped.
const MIN_RING_WEIGHT = 1e-6;

/** Simplifies every polygon in `fc` together, keeping shared borders shared. Rings come out wound for d3-geo. */
export function simplifyShared(fc, { minWeight = DEFAULT_MIN_WEIGHT } = {}) {
  let topo = topology({ layer: fc }, QUANTIZATION);
  topo = presimplify(topo);
  topo = filter(topo, filterAttachedWeight(topo, MIN_RING_WEIGHT));
  topo = simplify(topo, minWeight);
  const out = feature(topo, topo.objects.layer);
  out.features = out.features
    .filter((f) => f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"))
    .map((f) => ({ ...f, geometry: roundCoords(turf.rewind(f, { reverse: true }).geometry) }));
  return out;
}

// 5 decimal places is ~1.1 m — far below the simplification error — and
// roughly halves file size versus the 15-17 digit doubles otherwise
// written. Both copies of a shared border round identically, so they stay
// shared.
const round5 = (n) => Math.round(n * 1e5) / 1e5;
function roundCoords(geometry) {
  const ring = (r) => r.map(([x, y]) => [round5(x), round5(y)]);
  return geometry.type === "Polygon"
    ? { ...geometry, coordinates: geometry.coordinates.map(ring) }
    : { ...geometry, coordinates: geometry.coordinates.map((p) => p.map(ring)) };
}
