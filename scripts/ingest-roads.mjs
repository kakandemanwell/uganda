// Transforms HOTOSM's Uganda roads export (OpenStreetMap-derived, ODbL,
// Geofabrik snapshot 2026-06-22 — see data/sources.json ->
// src-hotosm-uga-roads) into a lightweight GeoJSON of the major road
// network.
//
// The raw export is 681,317 features (lines/points/polygons combined),
// overwhelmingly informal and unnamed: 98.8% of all features have no
// `name` tag at all, and the two biggest highway=* categories are `path`
// (237,482) and `track` (95,304) — footpaths and tracks, not roads. Even
// restricting to "classified" OSM road tags including residential/
// unclassified streets is 278,185 features / 77.8MB, still too heavy for
// an npm package and still ~89% unnamed (most "residential"/"unclassified"
// tags are informal neighborhood tracks in OSM's Uganda coverage, not
// named streets).
//
// This keeps only the MAJOR_HIGHWAY tiers (motorway through tertiary,
// national/inter-town road hierarchy) — 10,721 features, 3.6MB, of which
// ~29% are named. That full 278k/77.8MB classified-roads set (and the
// complete 681k-feature raw export) is NOT shipped, but remains directly
// available from the cited source URL for anyone who needs the full
// street/track graph — see docs/DATA_QUALITY.md.
//
// Deliberately NOT tied to any administrative unit (district/subcounty/
// etc.) in this pass: OSM carries no such tagging, and computing it would
// mean a spatial join against this project's own (partial) boundary
// layers — a separate, future piece of work, not attempted here. Roads
// ship as their own standalone layer.

import { readFileSync, writeFileSync, mkdirSync, createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as turf from "@turf/turf";
import shapefile from "shapefile";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(ROOT, "data");
const RAW_DIR = process.argv[2] || path.join(DATA, "legacy/provenance/roads/extracted");

const MAJOR_HIGHWAY = new Set([
  "motorway",
  "motorway_link",
  "trunk",
  "trunk_link",
  "primary",
  "primary_link",
  "secondary",
  "secondary_link",
  "tertiary",
  "tertiary_link",
]);

async function run() {
  const source = await shapefile.open(
    path.join(RAW_DIR, "roads_lines.shp"),
    path.join(RAW_DIR, "roads_lines.dbf")
  );

  const features = [];
  const highwayCounts = {};
  let total = 0;
  let result;
  while (!(result = await source.read()).done) {
    total++;
    const p = result.value.properties;
    highwayCounts[p.highway] = (highwayCounts[p.highway] || 0) + 1;
    if (!MAJOR_HIGHWAY.has(p.highway)) continue;
    features.push({
      type: "Feature",
      properties: {
        id: p.id ? `road:${p.id}` : undefined,
        name: p.name || null,
        highway: p.highway,
        surface: p.surface || null,
        oneway: p.oneway || null,
        source_ids: ["src-hotosm-uga-roads"],
      },
      geometry: result.value.geometry,
    });
  }

  console.log("total raw features (lines/points/polygons layer: lines only here):", total);
  console.log("highway value counts:", highwayCounts);
  console.log("kept (major road network, motorway-tertiary):", features.length);

  // Simplified (tolerance 0.0005deg, ~55m at the equator — finer than the
  // subcounty/parish tolerance since roads are thin lines where
  // over-simplifying visibly distorts curves) to keep package size sane.
  const fc = turf.simplify({ type: "FeatureCollection", features }, { tolerance: 0.0005, highQuality: true });

  mkdirSync(path.join(DATA, "geo"), { recursive: true });
  writeFileSync(path.join(DATA, "geo/roads.geojson"), JSON.stringify(fc));
  console.log("Wrote", features.length, "road features to data/geo/roads.geojson");
}

run();
