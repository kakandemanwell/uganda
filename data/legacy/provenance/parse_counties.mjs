import { readFileSync, writeFileSync } from "node:fs";

const raw = readFileSync(new URL("./counties_raw.wikitext", import.meta.url), "utf-8");
const lines = raw.split("\n");

const startIdx = lines.findIndex((l) => l.trim() === "==List==");
const endIdx = lines.findIndex((l, i) => i > startIdx && l.trim() === "|}");
const tableLines = lines.slice(startIdx + 1, endIdx);

// Drop the header block: "{|class..." "!County!!District" "|-"
const bodyStart = tableLines.findIndex((l) => l.trim() === "|-") + 1;
const body = tableLines.slice(bodyStart);

function extractLink(cell) {
  // strip leading '|' and optional rowspan="N" |
  let s = cell.replace(/^\|/, "").trim();
  let rowspan = 1;
  const rs = s.match(/rowspan="(\d+)"\s*\|/);
  if (rs) {
    rowspan = parseInt(rs[1], 10);
    s = s.replace(/rowspan="(\d+)"\s*\|/, "").trim();
  }
  // [[Target|Display]] or [[Target]]
  const m = s.match(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/);
  const display = m ? (m[3] || m[1]) : s;
  return { text: display.trim(), rowspan };
}

// group lines into row-blocks separated by '|-'
const rows = [];
let cur = [];
for (const line of body) {
  if (line.trim() === "|-") {
    if (cur.length) rows.push(cur);
    cur = [];
  } else if (line.trim().startsWith("|")) {
    cur.push(line);
  }
}
if (cur.length) rows.push(cur);

let currentDistrict = null;
let remainingRowspan = 0;
const out = [];

for (const row of rows) {
  if (row.length === 2) {
    const county = extractLink(row[0]);
    const district = extractLink(row[1]);
    currentDistrict = district.text;
    remainingRowspan = district.rowspan - 1;
    out.push({ county: county.text, district: currentDistrict });
  } else if (row.length === 1) {
    const county = extractLink(row[0]);
    out.push({ county: county.text, district: currentDistrict });
    remainingRowspan -= 1;
  } else {
    console.error("Unexpected row shape:", row);
  }
}

console.log(`Parsed ${out.length} rows`);

const csv = ["county_name_2015,district_name_2015"]
  .concat(out.map((r) => `"${r.county.replace(/"/g, '""')}","${(r.district || "").replace(/"/g, '""')}"`))
  .join("\n");

writeFileSync(new URL("./counties_2015_parsed.csv", import.meta.url), csv, "utf-8");
console.log("Wrote counties_2015_parsed.csv");
