// Copies the small/medium dist/ outputs into web/public/data/ so they're
// directly downloadable as static files (the "download the data" feature)
// and so web/lib/villages.mjs can read the village CSV from somewhere
// unambiguously inside the app's own directory tree (safer for Vercel's
// serverless function file-tracing than reaching outside the app root via
// a relative "../dist" path).
//
// Deliberately excludes dist/uganda-locations.json (~42MB) and
// dist/villages.json (~36MB) — the same two files the npm package itself
// omits for size; dist/uganda-locations-full.csv (~10MB) already covers
// village-level data far more compactly.
//
// Run automatically before `next dev`/`next build` (see package.json
// "predev"/"prebuild") so this can never silently go stale.

import { readdirSync, readFileSync, copyFileSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(WEB_ROOT, "..", "dist");
const OUT = path.join(WEB_ROOT, "public", "data");

const EXCLUDE = new Set(["uganda-locations.json", "villages.json"]);

function copyDir(srcDir, outDir) {
  mkdirSync(outDir, { recursive: true });
  let copied = 0;
  let totalBytes = 0;
  for (const entry of readdirSync(srcDir)) {
    const srcPath = path.join(srcDir, entry);
    if (!statSync(srcPath).isFile()) continue;
    if (EXCLUDE.has(entry)) continue;
    copyFileSync(srcPath, path.join(outDir, entry));
    totalBytes += statSync(srcPath).size;
    copied++;
  }
  return { copied, totalBytes };
}

const top = copyDir(DIST, OUT);
const geo = copyDir(path.join(DIST, "geo"), path.join(OUT, "geo"));

// dist/country/uganda.json (country metadata read by lib/uganda-data.mjs's
// country()) lives in a subdirectory copyDir() doesn't recurse into — the
// flag/coat-of-arms images alongside it are already separately committed at
// web/public/country/, so only the JSON needs syncing here.
mkdirSync(path.join(OUT, "country"), { recursive: true });
copyFileSync(path.join(DIST, "country", "uganda.json"), path.join(OUT, "country", "uganda.json"));

// dist/crosswalk/ (the OCHA COD-AB P-code crosswalk) — a static download.
const crosswalk = copyDir(path.join(DIST, "crosswalk"), path.join(OUT, "crosswalk"));

const totalCopied = top.copied + geo.copied + crosswalk.copied + 1;
const totalBytes =
  top.totalBytes + geo.totalBytes + crosswalk.totalBytes + statSync(path.join(DIST, "country", "uganda.json")).size;

// MapLibre GL 6 starts its web worker from a URL relative to its own
// module's import.meta.url — which webpack rewrites to a build-machine
// file:// path, so the worker never loads from a Next bundle. The map sets
// setWorkerUrl() to this copy instead (components/maplibre-map.jsx). The
// worker imports ./maplibre-gl-shared.mjs, so that ships alongside it.
// Versioned directory, so a dependency bump can't serve a stale worker.
{
  const mlDir = path.join(WEB_ROOT, "node_modules", "maplibre-gl");
  const { version } = JSON.parse(readFileSync(path.join(mlDir, "package.json"), "utf-8"));
  const vendorDir = path.join(WEB_ROOT, "public", "vendor", "maplibre", version);
  mkdirSync(vendorDir, { recursive: true });
  for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
    copyFileSync(path.join(mlDir, "dist", file), path.join(vendorDir, file));
  }
}

console.log(`Synced ${totalCopied} files (${(totalBytes / 1024 / 1024).toFixed(1)}MB) from dist/ to web/public/data/`);
