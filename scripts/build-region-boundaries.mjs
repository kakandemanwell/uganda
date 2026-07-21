// Derives the 4 region boundary polygons by dissolving data/geo/districts.geojson
// (itself ingested from geoBoundaries' CC0 district layer — see
// scripts/ingest-district-boundaries.mjs) grouped by region_id, using each
// district's own region_id assignment from data/districts.csv.
//
// Deliberately NOT pulling geoBoundaries' own ADM1 region layer: that file
// is ODbL-licensed (share-alike), a second license to track alongside this
// project's CC0 district source, and dissolving our own district polygons
// guarantees the region shapes always agree exactly with region_id as
// assigned in data/districts.csv — there's no way for the two to drift out
// of sync. @turf/turf is a devDependency used only here, at data-prep time;
// it never ships in the published package (see package.json "files").

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as turf from "@turf/turf";
import { parseCsvObjects } from "./lib/csv.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(ROOT, "data");

const regions = parseCsvObjects(readFileSync(path.join(DATA, "regions.csv"), "utf-8"));
const districtsFc = JSON.parse(readFileSync(path.join(DATA, "geo/districts.geojson"), "utf-8"));

const byRegion = new Map();
for (const f of districtsFc.features) {
  const rid = f.properties.region_id;
  if (!byRegion.has(rid)) byRegion.set(rid, []);
  byRegion.get(rid).push(f);
}

const features = [];
for (const r of regions) {
  const group = byRegion.get(r.id);
  if (!group || !group.length) {
    console.error(`No district geometry found for region ${r.id}`);
    process.exit(1);
  }
  const dissolved =
    group.length === 1
      ? group[0].geometry
      : turf.union(turf.featureCollection(group)).geometry;
  // turf.union (like all turf output) normalizes to turf's own canonical
  // ring winding regardless of its inputs' winding — which is the OPPOSITE
  // of what d3-geo's spherical convention expects (see the detailed
  // comment in scripts/ingest-district-boundaries.mjs). So this needs the
  // same reverse-rewind treatment even though the input districts were
  // already corrected; it's not simply inherited through the union.
  const geometry = turf.rewind(turf.feature(dissolved), { reverse: true }).geometry;
  features.push({
    type: "Feature",
    properties: {
      id: r.id,
      name: r.name,
      slug: r.slug,
      source: "Dissolved from data/geo/districts.geojson by region_id — see scripts/build-region-boundaries.mjs",
    },
    geometry,
  });
}

writeFileSync(
  path.join(DATA, "geo/regions.geojson"),
  JSON.stringify({ type: "FeatureCollection", features })
);
console.log(`Wrote ${features.length} region boundary features to data/geo/regions.geojson`);
