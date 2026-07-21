// Copies the small/medium dist/ outputs into web/public/data/ so they're
// directly downloadable as static files (the "download the data" feature)
// and so web/lib/villages.mjs can read the village CSV from somewhere
// unambiguously inside the app's own directory tree (safer for Vercel's
// serverless function file-tracing than reaching outside the app root via
// a relative "../dist" path).
//
// Deliberately excludes dist/uganda-locations.json (~42MB) and
// dist/villages.json (~36MB) — the same two files the npm package itself
// omits for size; dist/uganda-locations-full.csv (~7MB) already covers
// village-level data far more compactly.
//
// Run automatically before `next dev`/`next build` (see package.json
// "predev"/"prebuild") so this can never silently go stale.

import { readdirSync, copyFileSync, mkdirSync, statSync } from "node:fs";
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
const totalCopied = top.copied + geo.copied;
const totalBytes = top.totalBytes + geo.totalBytes;

console.log(`Synced ${totalCopied} files (${(totalBytes / 1024 / 1024).toFixed(1)}MB) from dist/ to web/public/data/`);
