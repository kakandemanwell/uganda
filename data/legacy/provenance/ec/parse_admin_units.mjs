// Coordinate-aware parser for the EC's "Uganda's Verified Administrative Units,
// July 2022" PDF (3,019 pages). Plain text extraction destroys the nested
// District > Constituency/County > Subcounty/Town > Parish/Ward > Village table
// (village numbering resets aren't reliable row boundaries). This instead reads
// each text item's (x, y) position and reconstructs columns from known x-bands,
// carrying "current subcounty/parish" state across rows and page breaks, and
// validates every single "TOTAL VILLAGES IN <subcounty>" checksum the document
// itself provides (~2,191 of them) against the accumulated count. Any mismatch
// is logged, not silently swallowed.

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync, writeFileSync } from "node:fs";

const PDF_PATH = new URL("./admin-units-2022.pdf", import.meta.url);
const OUT_PATH = new URL("./parsed_admin_units_2022.json", import.meta.url);
const MISMATCH_LOG = new URL("./parse_mismatches.json", import.meta.url);

const X = {
  districtName: [230, 250],
  districtCode: [215, 230],
  constituencyName: [265, 400],
  constituencyCode: [248, 262],
  subcountyCode: [50, 58],
  subcountyName: [60, 175],
  // 3-digit parish codes (100+, which occurs in any district with >99 total
  // parishes) render ~5-6pt further left than 2-digit codes (observed: "107"
  // at x=227.3 vs "94" at x=232.8), so this must be wide enough to catch both.
  parishCode: [218, 238],
  parishName: [242, 253],
  villageCode: [373, 382],
  villageName: [386, 398],
  totalLabel: [60, 70],
  totalSubcountyConfirm: [178, 200],
  totalCount: [400, 430],
};

function inRange(x, [lo, hi]) {
  return x >= lo && x <= hi;
}

const data = new Uint8Array(readFileSync(PDF_PATH));
const doc = await getDocument({ data, disableWorker: true }).promise;
console.log(`Loaded ${doc.numPages} pages`);

const records = [];
const mismatches = [];

let current = {
  districtCode: null,
  districtName: null,
  constituencyCode: null,
  constituencyName: null,
  subcountyCode: null,
  subcountyName: null,
  parishCode: null,
  parishName: null,
};
let accumulatedVillages = 0;
let subcountyStartConstituency = null;
let totalChecks = 0;
let totalOk = 0;

const t0 = Date.now();

for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
  const page = await doc.getPage(pageNum);
  const content = await page.getTextContent();
  const items = content.items
    .filter((it) => it.str && it.str.trim() !== "")
    .map((it) => ({ x: it.transform[4], y: it.transform[5], str: it.str.trim() }));

  // header fields (district/constituency) - present near top of every page
  for (const it of items) {
    if (it.y > 750 && inRange(it.x, X.districtName)) current.districtName = it.str;
    if (it.y > 750 && inRange(it.x, X.districtCode)) current.districtCode = it.str;
    if (it.y > 735 && it.y <= 750 && inRange(it.x, X.constituencyName)) current.constituencyName = it.str;
    if (it.y > 735 && it.y <= 750 && inRange(it.x, X.constituencyCode)) current.constituencyCode = it.str;
  }

  // data rows: y strictly below the column-header row (~717) and above the footer (~50)
  const dataItems = items.filter((it) => it.y < 710 && it.y > 50);

  // Gap-based row clustering: items whose y is within 2.0 of the running
  // cluster start belong to the same visual row. Fixed-bucket rounding isn't
  // safe here — a single row's label/value pieces can differ by up to ~1.6
  // (e.g. a "TOTAL VILLAGES IN" row's three pieces sit at y=611.1/611.4/612.7),
  // which straddles naive 0.5-wide rounding buckets and silently splits one
  // row into two, breaking column association.
  dataItems.sort((a, b) => b.y - a.y);
  const rowGroups = [];
  for (const it of dataItems) {
    const last = rowGroups[rowGroups.length - 1];
    if (last && last.y0 - it.y <= 2.0) {
      last.items.push(it);
      last.y0 = Math.max(last.y0, it.y); // anchor stays near the top of the cluster
    } else {
      rowGroups.push({ y0: it.y, items: [it] });
    }
  }

  for (const { items: row } of rowGroups) {
    const isTotalRow = row.some((it) => it.str === "TOTAL VILLAGES IN");
    if (isTotalRow) {
      const countItem = row.find((it) => inRange(it.x, X.totalCount));
      const stated = countItem ? parseInt(countItem.str.replace(/,/g, ""), 10) : NaN;
      totalChecks++;
      if (stated === accumulatedVillages) {
        totalOk++;
      } else {
        mismatches.push({
          district: current.districtName,
          constituency: current.constituencyName,
          subcounty: current.subcountyName,
          stated,
          accumulated: accumulatedVillages,
          page: pageNum,
        });
      }
      continue; // total row carries no new data
    }

    const scCodeItem = row.find((it) => inRange(it.x, X.subcountyCode));
    const scNameItem = row.find((it) => inRange(it.x, X.subcountyName));
    const pCodeItem = row.find((it) => inRange(it.x, X.parishCode));
    const pNameItem = row.find((it) => inRange(it.x, X.parishName));
    const vCodeItem = row.find((it) => inRange(it.x, X.villageCode));
    const vNameItem = row.find((it) => inRange(it.x, X.villageName));

    if (scCodeItem && scNameItem) {
      // Some city divisions are split across two electoral constituencies
      // (e.g. "KAWEMPE DIVISION" listed once under KAWEMPE DIVISION NORTH and
      // again under KAWEMPE DIVISION SOUTH), reusing the same subcounty code
      // both times. Keying the reset on subcounty code alone let village
      // counts bleed across that boundary, so the reset key must also
      // include the constituency active when this subcounty was last started.
      const changed =
        current.subcountyCode !== scCodeItem.str || subcountyStartConstituency !== current.constituencyCode;
      if (changed) {
        accumulatedVillages = 0;
        subcountyStartConstituency = current.constituencyCode;
      }
      current.subcountyCode = scCodeItem.str;
      current.subcountyName = scNameItem.str;
    }
    if (pCodeItem && pNameItem) {
      current.parishCode = pCodeItem.str;
      current.parishName = pNameItem.str;
    }
    if (vCodeItem && vNameItem) {
      records.push({
        district_code: current.districtCode,
        district_name: current.districtName,
        constituency_code: current.constituencyCode,
        constituency_name: current.constituencyName,
        subcounty_code: current.subcountyCode,
        subcounty_name: current.subcountyName,
        parish_code: current.parishCode,
        parish_name: current.parishName,
        village_code: vCodeItem.str,
        village_name: vNameItem.str,
      });
      accumulatedVillages++;
    }
  }

  if (pageNum % 500 === 0) {
    console.log(`... page ${pageNum}/${doc.numPages}, ${records.length} villages so far, ${Date.now() - t0}ms elapsed`);
  }
}

writeFileSync(OUT_PATH, JSON.stringify(records));
writeFileSync(MISMATCH_LOG, JSON.stringify(mismatches, null, 2));

console.log(`\nDone in ${Date.now() - t0}ms`);
console.log(`Villages parsed: ${records.length} (EC summary total: 71230)`);
console.log(`Subcounty checksum rows: ${totalChecks}, matched: ${totalOk}, mismatched: ${mismatches.length}`);
