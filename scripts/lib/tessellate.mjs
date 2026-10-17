// Turns a set of independently digitised polygons into a clean tessellation
// of a frame (a district): no overlaps, no gaps.
//
// Why it's needed: UBOS's parish polygons (BEC 2025) were not drawn as one
// topology. Per district they overlap their neighbours by ~0.3-0.4 km² in
// total and leave ~4 km² of gaps against the district outline, in 1,000+
// slivers — most microscopic, a few hundred big enough (0.1-10 ha) to show
// on a zoomed-in map as wedges of "nobody's land" between parishes. The
// territorial rule says that land belongs to someone; this assigns it.
//
// 1. Every polygon is clipped to the frame (no spill across a district
//    line).
// 2. Overlaps go to whichever polygon claimed the land first (a fixed,
//    reproducible order — the caller sorts by UBOS code).
// 3. Gaps: each sliver goes to its nearest neighbour; a bigger chunk that
//    touches several polygons is split between them along equidistant
//    lines (each point to whichever neighbour is closest) — the
//    "medial-axis" split, the least-assumption way to divide land the
//    sources leave unassigned.

import * as turf from "@turf/turf";
import { writeSync } from "node:fs";
import { dropSlivers } from "./fit-to-district.mjs";

const DEBUG = process.env.TESS_DEBUG;
const dbg = (msg) => DEBUG && writeSync(2, `    [tess] ${msg} heap=${Math.round(process.memoryUsage().heapUsed / 1e6)}MB
`);

const fc = (features) => turf.featureCollection(features);
const overlaps = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
const partsOf = (f) => {
  if (!f) return [];
  const g = f.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  return polys.map((rings) => turf.polygon(rings));
};

// polyclip (turf's clipping engine) occasionally fails to close a ring on
// near-degenerate float input. Retry once on coordinates truncated to 6 dp
// (~0.1 m); if it still fails, the caller gets the fallback and the run
// carries on — one uncleaned spot beats a crashed build.
let opFailures = 0;
export const clipFailures = () => opFailures;
function safe(op, inputs, fallback) {
  try {
    return op(fc(inputs));
  } catch {
    try {
      return op(fc(inputs.map((f) => turf.truncate(f, { precision: 6, coordinates: 2 }))));
    } catch {
      opFailures++;
      return fallback;
    }
  }
}
const union = (fs_, fallback = fs_[0]) => (fs_.length === 1 ? fs_[0] : safe(turf.union, fs_, fallback));
const difference = (fs_, fallback = fs_[0]) => safe(turf.difference, fs_, fallback);
const intersect = (fs_, fallback = null) => safe(turf.intersect, fs_, fallback);

const IGNORE_M2 = 100; // below this a gap is float noise, not land
const SLIVER_M2 = 2e4; // up to 2 ha: whole to the nearest neighbour; above: equidistant split
// Above this a chunk isn't digitising noise but real ambiguity — an unmapped
// lake (Wamala), or land the sources genuinely don't place. It's returned
// unassigned, for the caller to publish as a gap with candidates.
const SPLIT_MAX_M2 = 5e6;
const MAX_SITES = 1500;

/**
 * Splits `chunk` between `neighbours` ([{ key, feature }]) so each part of
 * it goes to the nearest neighbour. Returns [{ key, feature }], one per key
 * that receives land.
 *
 * Implemented by triangulating the chunk (earcut — triangles share their
 * vertices exactly and add no new coordinates) and giving each triangle to
 * the neighbour whose border vertex is closest to its centre, then merging
 * each neighbour's triangles. An earlier Voronoi-cell version clipped cells
 * against the chunk, which produces near-coincident float edges; unioning
 * those sent polyclip into a runaway allocation (6 GB on one Mityana
 * sliver). Triangles avoid that, at the cost of a coarser dividing line —
 * immaterial at the size of chunk this handles (≤ 5 km²).
 */
export function splitEquidistant(chunk, neighbours) {
  const keys = [...new Set(neighbours.map((n) => n.key))];
  if (keys.length === 0) return [];
  if (keys.length === 1) return [{ key: keys[0], feature: chunk }];
  const frame = turf.bbox(turf.buffer(chunk, 0.5, { units: "kilometers" }));
  const sites = [];
  for (const n of neighbours) {
    const coords = turf.coordAll(n.feature).filter(([x, y]) => x >= frame[0] && x <= frame[2] && y >= frame[1] && y <= frame[3]);
    const stride = Math.max(1, Math.ceil(coords.length / Math.max(50, MAX_SITES / neighbours.length)));
    for (let i = 0; i < coords.length; i += stride) sites.push({ x: coords[i][0], y: coords[i][1], key: n.key });
  }
  const present = [...new Set(sites.map((s) => s.key))];
  if (present.length <= 1) return [{ key: present[0] ?? keys[0], feature: chunk }];

  // planar nearest-site is fine at this scale (a few km, near the equator)
  const nearestKey = ([x, y]) => {
    let best = null;
    let bestD = Infinity;
    for (const s of sites) {
      const d = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s.key;
      }
    }
    return best;
  };
  let triangles;
  try {
    triangles = turf.tesselate(chunk).features;
  } catch {
    triangles = [];
  }
  if (!triangles.length) return [{ key: nearestKey(turf.pointOnFeature(chunk).geometry.coordinates), feature: chunk }];

  const byKey = new Map();
  for (const t of triangles) {
    const [a, b, c] = t.geometry.coordinates[0];
    const key = nearestKey([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3]);
    (byKey.get(key) ?? byKey.set(key, []).get(key)).push(t);
  }
  const out = [];
  for (const [key, ts] of byKey) {
    const merged = union(ts, null);
    out.push({ key, feature: merged ?? turf.multiPolygon(ts.map((t) => t.geometry.coordinates)) });
  }
  return out;
}

/**
 * @param {object} frame      the district polygon (land)
 * @param {object[]} items    [{ id, feature }] in priority order (overlaps go to the earlier one)
 * @returns {{ items: Map<string, object>, stats: object, unassigned: object[] }}
 *   items: id -> cleaned feature; unassigned: chunks too big to assign
 */
export function tessellate(frame, items) {
  const stats = { overlap_m2: 0, gap_m2: 0, slivers: 0, splits: 0, dropped: 0, unassigned: 0 };
  const unassigned = []; // [{ feature, neighbours: [id] }]
  const kept = [];
  for (const it of items) {
    let f = it.keepWhole ? it.feature : intersect([it.feature, frame], it.feature);
    if (!f) {
      stats.dropped++;
      continue;
    }
    const bb = turf.bbox(f);
    const hits = kept.filter((k) => overlaps(bb, k.bbox));
    if (hits.length) {
      const before = turf.area(f);
      const rest = difference([f, ...hits.map((h) => h.feature)], f);
      if (!rest) {
        stats.dropped++;
        continue;
      }
      stats.overlap_m2 += before - turf.area(rest);
      f = rest;
    }
    f = dropSlivers(f);
    if (!f) {
      stats.dropped++;
      continue;
    }
    kept.push({ id: it.id, feature: f, bbox: turf.bbox(f) });
  }

  dbg(`kept ${kept.length}, frame pts ${turf.coordAll(frame).length}, kept pts ${kept.reduce((a, k) => a + turf.coordAll(k.feature).length, 0)}`);
  const all = union(kept.map((k) => k.feature), null);
  dbg("union done");
  // if the union failed there's no reliable gap set: skip gap filling here
  const gaps = all ? difference([frame, all], null) : null;
  const extra = new Map(); // id -> [parts]
  dbg(`gaps: ${partsOf(gaps).length} parts`);
  for (const part of partsOf(gaps)) {
    const a = turf.area(part);
    if (a > 2e4) dbg(`part ${Math.round(a)} m2, ${part.geometry.coordinates[0].length} pts`);
    if (a < IGNORE_M2) continue;
    stats.gap_m2 += a;
    const bb = turf.bbox(turf.buffer(part, 0.05, { units: "kilometers" }));
    const near = kept.filter((k) => overlaps(bb, k.bbox));
    if (!near.length) continue;
    if (a <= SLIVER_M2) {
      const pt = turf.pointOnFeature(part);
      let best = null;
      for (const k of near) {
        const d = Math.abs(turf.pointToPolygonDistance(pt, k.feature, { units: "meters" }));
        if (!best || d < best.d) best = { id: k.id, d };
      }
      (extra.get(best.id) ?? extra.set(best.id, []).get(best.id)).push(part);
      stats.slivers++;
      continue;
    }
    const ring = turf.buffer(part, 0.03, { units: "kilometers" });
    const touching = near.filter((k) => turf.booleanIntersects(ring, k.feature));
    if (a > SPLIT_MAX_M2) {
      stats.unassigned++;
      unassigned.push({ feature: part, neighbours: touching.map((k) => k.id) });
      continue;
    }
    for (const { key, feature } of splitEquidistant(part, (touching.length ? touching : near).map((k) => ({ key: k.id, feature: k.feature })))) {
      (extra.get(key) ?? extra.set(key, []).get(key)).push(feature);
    }
    stats.splits++;
  }

  dbg("assigning parts");
  const items_ = new Map();
  for (const k of kept) {
    const add = extra.get(k.id);
    items_.set(k.id, add ? union([k.feature, ...add], k.feature) ?? k.feature : k.feature);
  }
  return { items: items_, stats, unassigned };
}
