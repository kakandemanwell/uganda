// Derives the 4 region boundary polygons by dissolving data/geo/districts.geojson
// (built bottom-up from UBOS's 2024/2025 polygons — see
// scripts/ingest-ubos-boundaries.mjs) grouped by region_id, using each
// district's own region_id assignment from data/districts.csv.
//
// Deliberately NOT pulling a separate region layer (COD-AB's ADM1, or
// geoBoundaries' ODbL one): dissolving our own district polygons guarantees
// the region shapes always agree exactly with region_id as assigned in
// data/districts.csv — there's no way for the two to drift out of sync.
// @turf/turf is a devDependency used only at data-prep time;
// it never ships in the published package (see package.json "files").

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as turf from "@turf/turf";
import { parseCsvObjects } from "./lib/csv.mjs";
import { fillSmallHoles } from "./lib/fit-to-district.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(ROOT, "data");

const regions = parseCsvObjects(readFileSync(path.join(DATA, "regions.csv"), "utf-8"));
const districtsFc = JSON.parse(readFileSync(path.join(DATA, "geo/districts.geojson"), "utf-8"));

// Dissolved with a polygon union. That's only sliver-free because the
// district layer is simplified as one topology (scripts/lib/topo.mjs), so
// neighbouring districts share byte-identical borders; on independently
// simplified districts the same union left ~1,500 slit-shaped holes.
// Districts carry both a region_id (the 4 administrative regions) and a
// subregion_id (the 17 cultural/traditional sub-regions UBOS reports by),
// so the same dissolve produces both layers.
function dissolveBy(key) {
  const groups = new Map();
  for (const f of districtsFc.features) {
    const k = f.properties[key];
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(f);
  }
  return new Map(
    [...groups].map(([k, group]) => [
      k,
      // turf output is wound for the planar convention; d3-geo needs the
      // reverse (scripts/validate.mjs checks). fillSmallHoles: the union
      // still leaves a handful of sub-km² pinholes where three or more
      // districts meet.
      turf.rewind(fillSmallHoles(group.length === 1 ? group[0] : turf.union(turf.featureCollection(group))), { reverse: true }).geometry,
    ])
  );
}

function writeLayer(file, rows, dissolved, label) {
  const features = [];
  for (const r of rows) {
    const geometry = dissolved.get(r.id);
    if (!geometry) {
      console.error(`No district geometry found for ${label} ${r.id}`);
      process.exit(1);
    }
    features.push({
      type: "Feature",
      properties: {
        id: r.id,
        name: r.name,
        slug: r.slug,
        ...(r.region_id ? { region_id: r.region_id } : {}),
        source: `Dissolved from data/geo/districts.geojson by ${label === "region" ? "region_id" : "subregion_id"} — see scripts/build-region-boundaries.mjs`,
      },
      geometry,
    });
  }
  writeFileSync(path.join(DATA, "geo", file), JSON.stringify({ type: "FeatureCollection", features }));
  console.log(`Wrote ${features.length} ${label} boundary features to data/geo/${file}`);
}

writeLayer("regions.geojson", regions, dissolveBy("region_id"), "region");
writeLayer("subregions.geojson", parseCsvObjects(readFileSync(path.join(DATA, "subregions.csv"), "utf-8")), dissolveBy("subregion_id"), "subregion");
