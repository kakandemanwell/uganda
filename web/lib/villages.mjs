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
let byParish;

function parseCsvLine(line) {
  // Fast path for the ~all rows with no quoting at all.
  if (!line.includes('"')) return line.split(",");
  // A handful of EC village names contain commas and come quoted, e.g.
  // "Nkongoro (Ranches 13, 14," — a plain split would shift every later
  // column (including parish_id) on those rows.
  const cells = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      cells.push(field);
      field = "";
    } else {
      field += c;
    }
  }
  cells.push(field);
  return cells;
}

export function loadVillages() {
  if (cache) return cache;
  const csvPath = path.join(process.cwd(), "public", "data", "uganda-locations-full.csv");
  const text = readFileSync(csvPath, "utf-8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  cache = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};
    header.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
  return cache;
}

/**
 * Every village/cell row under one parish or ward, by its stable id (the
 * CSV's parish_id column — names alone are ambiguous, see
 * scripts/build.mjs). Indexed once on first use.
 */
export function villagesOfParish(parishId) {
  if (!byParish) {
    byParish = new Map();
    for (const row of loadVillages()) {
      if (!byParish.has(row.parish_id)) byParish.set(row.parish_id, []);
      byParish.get(row.parish_id).push(row);
    }
  }
  return byParish.get(parishId) ?? [];
}
