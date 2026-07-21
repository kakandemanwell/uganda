// Villages aren't bundled in the uganda-locale npm package (71,230 records,
// deliberately excluded to keep installs light — see the root README).
// This app runs from the same repo checkout as the data itself though, so
// it can read the full-ancestry CSV directly rather than going through the
// package's public API. Read from public/data/ (synced from ../dist by
// scripts/sync-data.mjs, predev/prebuild) rather than reaching outside the
// app's own root via a relative "../dist" path — safer for Vercel's
// serverless function file-tracing, and it's the same file already served
// as a static download at /data/uganda-locations-full.csv. Parsed once per
// server instance and cached in memory (mirrors the lazy-load-once pattern
// in uganda-locale's own src/store.mjs), not re-parsed per request.
import { readFileSync } from "node:fs";
import path from "node:path";

let cache;

function parseCsvLine(line) {
  // No embedded commas/quotes in this specific file's columns (place names,
  // no free text), so a plain split is fine — avoids pulling in a CSV
  // parser dependency for one file with a known-simple shape.
  return line.split(",");
}

export function loadVillages() {
  if (cache) return cache;
  const csvPath = path.join(process.cwd(), "public", "data", "uganda-locations-full.csv");
  const text = readFileSync(csvPath, "utf-8");
  const lines = text.split("\n").filter(Boolean);
  const header = parseCsvLine(lines[0]);
  cache = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};
    header.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
  return cache;
}
