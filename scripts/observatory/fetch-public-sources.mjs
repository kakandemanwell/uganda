// Snapshots the openly published, non-personal government datasets found
// during the 2026-10-17 observatory research pass (see
// docs/observatory/SOURCES.md and data/observatory/catalog.json) into
// data/legacy/provenance/observatory/, for later ingestion against this
// project's own EC-derived hierarchy.
//
// Fetch-only by design: nothing here touches data/geo/, data/ec/ or dist/.
// Matching UBOS codes to this project's unit ids is a separate ingest step
// (the same split as scripts/ingest-hdx-cod-ab.mjs vs. its raw release).
//
// Sources, all reachable without login on 2026-10-17:
//   - UBOS NPHC 2024 dissemination API (statistics.ubos.org/nphc/api/):
//     official 2024 region/district/county polygons in one call each,
//     subcounty polygons one district per call, each feature carrying
//     2024 male/female/total population.
//   - UBOS Baseline Education Census 2025 API (statistics.ubos.org/bec/api/):
//     the only official *parish* polygons found anywhere, one district per
//     call, carrying school/learner counts.
//   - UBOS NPHC 2024 Subcounty Profiles workbook (parish-level tables 1-15).
//   - MLHUD UgNLIS reference dictionaries: Ministry Zonal Offices and the
//     District Land Board -> MZO mapping. Internal `ip` fields are dropped
//     before writing (they are private LAN addresses, not data).
//
// Deliberately NOT fetched, though reachable: MWE's WEIS GeoServer (its
// terms forbid automated access without written permission), MoH NHFR
// (carries contact names/phones), KCCA services (some hold property-tax
// records), UCC's staff-account layers (critical infrastructure, no
// licence). See docs/observatory/USER-ACTIONS.md.
//
// Usage: node scripts/observatory/fetch-public-sources.mjs [--only=nphc,bec,xlsx,mlhud]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const OUT = path.join(ROOT, "data/legacy/provenance/observatory");
const DELAY_MS = 1000; // one request a second: these are small public servers

const NPHC = "https://statistics.ubos.org/nphc/api";
const BEC = "https://statistics.ubos.org/bec/api";
const MLHUD = "https://api.mlhud.go.ug/ugnlis-api/v1/nalisep-api/dictionary";
const XLSX_URL =
  "https://www.ubos.org/wp-content/uploads/statistics/NPHC-2024-Subcounty-Profiles-Excel-Tables.xlsx";

const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7);
const wanted = (key) => !only || only.split(",").includes(key);

const manifest = { fetched_at: new Date().toISOString(), files: [], failures: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "uganda-locale-observatory/0.1 (+https://github.com/kakandemanwell/uganda)" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (i === attempts) return curlFallback(url, err);
      await sleep(DELAY_MS * 4 * i);
    }
  }
}

// Node's fetch fails outright ("fetch failed") on www.ubos.org's 9MB
// workbook while curl downloads it fine, so try the system curl before
// giving up.
function curlFallback(url, err) {
  try {
    return execFileSync("curl", ["-sSfL", "--max-time", "300", url], { maxBuffer: 256 * 1024 * 1024 });
  } catch {
    throw err;
  }
}

function save(rel, buf, url, extra = {}) {
  const file = path.join(OUT, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, buf);
  manifest.files.push({
    path: rel.replaceAll("\\", "/"),
    url,
    bytes: buf.length,
    sha256: createHash("sha256").update(buf).digest("hex"),
    ...extra,
  });
}

async function fetchJson(rel, url, count) {
  try {
    const buf = await get(url);
    const json = JSON.parse(buf.toString("utf8"));
    save(rel, buf, url, count ? { features: count(json) } : {});
    return json;
  } catch (err) {
    manifest.failures.push({ path: rel, url, error: String(err.message || err) });
    console.warn(`  ! ${rel}: ${err.message || err}`);
    return null;
  } finally {
    await sleep(DELAY_MS);
  }
}

const nphcFeatures = (j) => (j.geojson || j).features?.length ?? 0;
const becFeatures = (j) => j.features?.length ?? 0;

async function run() {
  mkdirSync(OUT, { recursive: true });
  let districtCodes = [];

  if (wanted("nphc") || wanted("bec")) {
    // The district layer doubles as the authoritative list of 2024 district
    // codes for the per-district subcounty and parish calls below.
    const districts = await fetchJson(
      "ubos-nphc-2024/districts.json",
      `${NPHC}/get_geospatial_data.php?level=district`,
      nphcFeatures
    );
    if (!districts) throw new Error("could not fetch the UBOS district layer; nothing else can proceed");
    districtCodes = districts.geojson.features.map((f) => f.properties.DCode).sort();
    console.log(`UBOS NPHC 2024: ${districtCodes.length} district codes`);
  }

  if (wanted("nphc")) {
    for (const level of ["region", "county"]) {
      await fetchJson(`ubos-nphc-2024/${level}s.json`, `${NPHC}/get_geospatial_data.php?level=${level}`, nphcFeatures);
    }
    await fetchJson("ubos-nphc-2024/indicators.json", `${NPHC}/get_indicators.php`);
    await fetchJson("ubos-nphc-2024/subregions.json", `${NPHC}/get_subregions.php`);
    for (const [i, d] of districtCodes.entries()) {
      process.stdout.write(`\r  nphc subcounties ${i + 1}/${districtCodes.length}`);
      await fetchJson(
        `ubos-nphc-2024/subcounties/${d}.json`,
        `${NPHC}/get_geospatial_data.php?level=subcounty&district_code=${d}`,
        nphcFeatures
      );
    }
    console.log();
  }

  if (wanted("bec")) {
    await fetchJson("ubos-bec-2025/indicators.json", `${BEC}/get_indicators.php`);
    for (const [i, d] of districtCodes.entries()) {
      process.stdout.write(`\r  bec parishes ${i + 1}/${districtCodes.length}`);
      await fetchJson(
        `ubos-bec-2025/parishes/${d}.json`,
        `${BEC}/get_geo.php?level=parish&indicator=primary_schools_total&parent_level=district&parent_code=${d}`,
        becFeatures
      );
    }
    console.log();
  }

  if (wanted("xlsx")) {
    try {
      save("ubos-nphc-2024/NPHC-2024-Subcounty-Profiles-Excel-Tables.xlsx", await get(XLSX_URL), XLSX_URL);
    } catch (err) {
      manifest.failures.push({ path: "ubos-nphc-2024/NPHC-2024-Subcounty-Profiles-Excel-Tables.xlsx", url: XLSX_URL, error: String(err.message || err) });
    }
  }

  if (wanted("mlhud")) {
    for (const dict of ["mzo", "dlb"]) {
      const url = `${MLHUD}/${dict}`;
      try {
        const rows = JSON.parse((await get(url)).toString("utf8"));
        const clean = rows.map(({ ip, ...rest }) => rest);
        save(`mlhud-ugnlis/${dict}.json`, Buffer.from(JSON.stringify(clean, null, 2) + "\n"), url, {
          rows: clean.length,
          note: "internal `ip` field removed before writing",
        });
      } catch (err) {
        manifest.failures.push({ path: `mlhud-ugnlis/${dict}.json`, url, error: String(err.message || err) });
      }
      await sleep(DELAY_MS);
    }
  }

  // A partial run (--only=...) merges into the existing manifest instead of
  // replacing it, so re-fetching one source keeps the others' records.
  if (only) {
    try {
      const prev = JSON.parse(readFileSync(path.join(OUT, "manifest.json"), "utf8"));
      const fresh = new Set(manifest.files.map((f) => f.path));
      manifest.files = [...prev.files.filter((f) => !fresh.has(f.path)), ...manifest.files];
      manifest.failures = [...prev.failures.filter((f) => !fresh.has(f.path) && !manifest.failures.some((g) => g.path === f.path)), ...manifest.failures];
    } catch {}
  }
  writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  const totals = manifest.files.reduce((n, f) => n + (f.features || 0), 0);
  console.log(`wrote ${manifest.files.length} files (${totals} features), ${manifest.failures.length} failures -> ${path.relative(ROOT, OUT)}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
