// Builds every administrative boundary layer — parish, subcounty, county,
// city and district — bottom-up from UBOS's own current polygons, keyed to
// this project's EC (July 2022) unit ids.
//
// Sources (raw API responses, gitignored under data/legacy/provenance/ubos/;
// re-fetch per data/sources.json -> src-ubos-nphc-2024-geo and
// src-ubos-bec-2025-geo):
//   UBOS NPHC 2024 API  — district and subcounty polygons, UBOS codes
//                         (district 3 digits, county +1, subcounty +2)
//   UBOS BEC 2025 API   — parish polygons, 8-digit codes (subcounty code + 2)
//
// The governing rule (see docs/DATA_QUALITY.md, "Territorial rule"): no
// land is ever created. A new district, county, subcounty or parish is
// always carved out of existing units, so every level is exactly the union
// of the level below, and an unmapped area inside a mapped parent IS the
// missing unit(s). This script applies that literally:
//
// 1. Each UBOS parish polygon is matched to an EC parish (same district,
//    same name; repeats inside a district disambiguated by subcounty).
// 2. Each piece of UBOS land is given an OWNER — the EC subcounty-tier unit
//    it belongs to — in order of evidence:
//      a. its matched EC parish's subcounty;
//      b. else its UBOS subcounty, when that matches an EC subcounty by name;
//      c. else (a UBOS subcounty created after the EC's 2022 gazetteer) the
//         EC subcounty most of its sibling parishes came from — the unit it
//         was carved out of.
//    Land with no owner is kept as an explicit gap (data/geo/gaps.geojson)
//    listing the EC units that could be it — never dropped, never guessed.
// 3. Every level is then a union of the one below: subcounty = its owned
//    land, county = its subcounties, district = everything in it (plus any
//    city carved from it), region = its districts (build-region-boundaries).
//    Parish polygons are the matched UBOS parishes; where a subcounty has
//    exactly one unmatched EC parish and owned land left over, that land is
//    the parish (marked inferred).
//
// All pieces are clipped to land (UBOS polygons run out into the lakes)
// and simplified as ONE topology before any union, so every layer nests
// exactly inside the one above (scripts/lib/topo.mjs).
//
// Outputs: data/geo/{parishs,subcountys,countys,citys,districts,gaps,settlements}.geojson
//          data/population/ubos-nphc-2024-subcounty.csv
//          data/crosswalk/ubos-2024.csv (UBOS code <-> EC id, per level)

import { readFileSync, writeFileSync, readdirSync, mkdirSync, writeSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as turf from "@turf/turf";
import { parseCsvObjects, writeCsv } from "./lib/csv.mjs";
import { simplifyShared } from "./lib/topo.mjs";
import { dropSlivers, fillSmallHoles } from "./lib/fit-to-district.mjs";
import { tessellate, splitEquidistant, clipFailures } from "./lib/tessellate.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(ROOT, "data");
const RAW = path.join(DATA, "legacy/provenance/ubos");

const readJson = (p) => JSON.parse(readFileSync(p, "utf-8"));
const featuresOf = (o) => (typeof o.geojson === "string" ? JSON.parse(o.geojson) : o.geojson ?? o).features;
const readCsv = (rel) => parseCsvObjects(readFileSync(path.join(DATA, rel), "utf-8"));

// ---------------------------------------------------------------- names --
// Tier + base name, so "Kasawo TC", "KASAWO TOWNCOUNCIL" and "Kasawo Town
// Council" compare equal to each other and not to plain "Kasawo".
function nameKey(name, fallbackTier = "") {
  let s = String(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[-_/().,']/g, " ");
  let tier = fallbackTier;
  const strip = (re, t) => {
    if (re.test(s)) {
      if (t && (!tier || tier === "subcounty")) tier = t;
      s = s.replace(re, " ");
    }
  };
  strip(/\btown\s*council\b|\btowncouncil\b|\btown\s*board\b|\btc\b/g, "town_council");
  strip(/\bdivision\b|\bdivison\b/g, "division");
  strip(/\bmunicipality\b|\bmunicipal council\b/g, "municipality");
  strip(/\bsub\s*county\b|\bs\/?c\b/g, "");
  strip(/\bcounty\b/g, "");
  strip(/\bcity\b/g, "");
  strip(/\bward\b|\bparish\b/g, "");
  return { tier, base: s.replace(/[^a-z0-9]/g, "") };
}

// Damerau-free Levenshtein, capped — only used to accept a unique near-miss.
function editDistance(a, b, cap = 3) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}
const fuzzyCap = (base) => (base.length >= 10 ? 2 : base.length >= 6 ? 1 : 0);

// ------------------------------------------------------------- EC units --
const ecUnits = readJson(path.join(DATA, "ec/administrative_units_ec2022.json"));
const districts = readCsv("districts.csv").map((r) => ({
  id: r.id, name: r.name, slug: r.slug, level: "district", parent_id: r.region_id, region_id: r.region_id,
  subregion_id: r.subregion_id || null, aliases: (r.aliases || "").split(";").map((x) => x.trim()).filter(Boolean),
}));
const cities = readCsv("cities.csv").map((r) => ({
  id: r.id, name: r.name, slug: r.slug, level: "city", parent_id: r.parent_district_id, region_id: r.region_id,
  subregion_id: r.subregion_id || null, aliases: [],
}));
const units = [...districts, ...cities, ...ecUnits];
const idOf = new Map(units.map((u) => [u.id, u]));
const SUBCOUNTY_LEVELS = new Set(["subcounty", "town_council", "division"]);
const PARISH_LEVELS = new Set(["parish", "ward"]);
const COUNTY_LEVELS = new Set(["county", "municipality"]);

function districtOf(u) {
  while (u && u.level !== "district" && u.level !== "city") u = idOf.get(u.parent_id);
  return u;
}
const ecTier = (u) => (u.level === "town_council" || u.level === "division" ? u.level : nameKey(u.name, "subcounty").tier || "subcounty");

const ecSubByDistrict = new Map(); // district/city id -> [{unit, tier, base}]
const ecParByDistrict = new Map(); // district/city id -> [{unit, base, subcounty}]
for (const u of ecUnits) {
  const d = districtOf(u);
  if (!d) continue;
  if (SUBCOUNTY_LEVELS.has(u.level)) {
    const k = nameKey(u.name, "subcounty");
    (ecSubByDistrict.get(d.id) ?? ecSubByDistrict.set(d.id, []).get(d.id)).push({ unit: u, tier: ecTier(u), base: k.base });
  } else if (PARISH_LEVELS.has(u.level)) {
    (ecParByDistrict.get(d.id) ?? ecParByDistrict.set(d.id, []).get(d.id)).push({ unit: u, base: nameKey(u.name).base, subcounty: idOf.get(u.parent_id) });
  }
}

// ---------------------------------------------------------- UBOS input --
const ubosDistricts = featuresOf(readJson(path.join(RAW, "ubos-nphc-2024/districts.json")));
const ubosSubcounties = readdirSync(path.join(RAW, "ubos-nphc-2024/subcounties")).flatMap((f) =>
  featuresOf(readJson(path.join(RAW, "ubos-nphc-2024/subcounties", f)))
);
const ubosParishes = readdirSync(path.join(RAW, "ubos-bec-2025/parishes")).flatMap((f) =>
  featuresOf(readJson(path.join(RAW, "ubos-bec-2025/parishes", f)))
);
const subCode = (f) => String(f.properties.population_data?.code ?? `${f.properties.DCode}${f.properties.CCode}${f.properties.SCode}`);
const ubosSubByCode = new Map();
for (const f of ubosSubcounties) {
  const c = subCode(f);
  // Kampala Central comes as two features under one code; keep both pieces.
  if (!ubosSubByCode.has(c)) ubosSubByCode.set(c, { code: c, name: f.properties.Sub_County, dcode: f.properties.DCode, features: [] });
  ubosSubByCode.get(c).features.push(f);
}

const crosswalk = [];

// ----------------------------------------------------- 1. districts --
const districtByKey = new Map();
for (const d of [...districts, ...cities]) {
  for (const n of [d.name, ...d.aliases]) districtByKey.set(`${d.level === "city" ? "city:" : ""}${nameKey(n).base}`, d);
}
const dcodeUnit = new Map(); // UBOS DCode -> EC district/city
for (const f of ubosDistricts) {
  const p = f.properties;
  if (dcodeUnit.has(p.DCode)) continue; // Kampala is split into two features
  const isCity = /\bcity\b/i.test(p.District);
  const u = districtByKey.get(`${isCity ? "city:" : ""}${nameKey(p.District).base}`);
  crosswalk.push({ level: "district", ubos_code: p.DCode, ubos_name: p.District, unit_id: u?.id ?? "", match: u ? "exact" : "unmatched", note: "" });
  if (u) dcodeUnit.set(p.DCode, u);
}
const unmatchedDistricts = [...districts, ...cities].filter((d) => ![...dcodeUnit.values()].includes(d));
if (unmatchedDistricts.length) {
  console.error("EC districts/cities with no UBOS district:", unmatchedDistricts.map((d) => d.id));
  process.exit(1);
}

// -------------------------------------------- 2. subcounty name matches --
// UBOS subcounty code -> EC subcounty unit, by name+tier within the
// district (exact, then a unique near-miss).
const subMatch = new Map();
const claimedSub = new Map();
function matchSubcounty(s) {
  const d = dcodeUnit.get(s.dcode);
  const cands = ecSubByDistrict.get(d?.id) ?? [];
  const k = nameKey(s.name, "subcounty");
  let hits = cands.filter((c) => c.base === k.base && c.tier === k.tier);
  let how = "exact";
  if (!hits.length && fuzzyCap(k.base)) {
    hits = cands.filter((c) => c.tier === k.tier && editDistance(c.base, k.base) <= fuzzyCap(k.base));
    how = "fuzzy";
  }
  return hits.length === 1 ? { unit: hits[0].unit, how } : { unit: null, how: hits.length ? "ambiguous" : "unmatched" };
}
for (const s of ubosSubByCode.values()) {
  const r = matchSubcounty(s);
  if (r.unit && claimedSub.has(r.unit.id)) {
    // two UBOS subcounties onto one EC unit (a 2022 unit split since):
    // neither gets it by name; parish evidence decides below.
    subMatch.delete(claimedSub.get(r.unit.id));
    continue;
  }
  if (r.unit) {
    subMatch.set(s.code, { unit: r.unit, how: r.how });
    claimedSub.set(r.unit.id, s.code);
  }
}

// -------------------------------------------------- 3. parish matches --
const parishMatch = new Map(); // UBOS parish code -> EC parish unit
const claimedParish = new Map();
const parishHow = new Map();
for (const f of ubosParishes) {
  const p = f.properties;
  const d = dcodeUnit.get(p.DCode);
  const cands = ecParByDistrict.get(d?.id) ?? [];
  const base = nameKey(p.Parish ?? p.name).base;
  const ownerGuess = subMatch.get(String(p.code).slice(0, 6))?.unit;
  let hits = cands.filter((c) => c.base === base);
  let how = "exact";
  if (hits.length > 1 && ownerGuess) hits = hits.filter((c) => c.subcounty?.id === ownerGuess.id);
  if (!hits.length && ownerGuess && fuzzyCap(base)) {
    // near-miss spellings, only inside the subcounty the parish should be in
    hits = cands.filter((c) => c.subcounty?.id === ownerGuess.id && editDistance(c.base, base) <= fuzzyCap(base));
    how = "fuzzy";
  }
  if (hits.length !== 1) continue;
  const unit = hits[0].unit;
  if (claimedParish.has(unit.id)) {
    parishMatch.delete(claimedParish.get(unit.id)); // two UBOS parishes -> one EC parish: drop both
    claimedParish.set(unit.id, null);
    continue;
  }
  if (claimedParish.get(unit.id) === null) continue;
  parishMatch.set(String(p.code), unit);
  parishHow.set(String(p.code), how);
  claimedParish.set(unit.id, String(p.code));
}

// ------------------------------------- 4. land pieces, clipped to land --
// UBOS polygons follow legal boundaries into the lakes. Water = UBOS's
// country outline minus geoBoundaries' land (fine coastline), but ONLY
// where that difference is actually lake: it's intersected with Natural
// Earth's lakes (public domain, buffered 3 km to reach geoBoundaries'
// finer shoreline). Without that, geoBoundaries' wrong western border made
// Bundibugyo's whole Semliki strip and parts of Kasese "water", and 41
// parishes vanished.
console.log("building land/water mask…");
const gb = readJson(path.join(DATA, "legacy/provenance/geo/geoBoundaries-UGA-ADM3.geojson")).features.filter(
  (f) => !/lake victoria/i.test(f.properties.shapeName)
);
const land = fillSmallHoles(turf.union(turf.featureCollection(gb.map((f) => turf.simplify(f, { tolerance: 0.001 })))));
const country = turf.union(turf.featureCollection(ubosDistricts.map((f) => turf.simplify(f, { tolerance: 0.0005 }))));
const lakes = turf.union(
  turf.featureCollection(
    readJson(path.join(DATA, "legacy/provenance/geo/ne-10m-lakes-uganda.geojson")).features.map((f) => turf.buffer(f, 3, { units: "kilometers" }))
  )
);
const waterAll = turf.intersect(turf.featureCollection([turf.difference(turf.featureCollection([country, land])), lakes]));
const LAKE_M2 = 1e6;
const water = [];
for (const rings of waterAll.geometry.type === "Polygon" ? [waterAll.geometry.coordinates] : waterAll.geometry.coordinates) {
  const poly = turf.polygon(rings);
  if (turf.area(poly) >= LAKE_M2) water.push({ poly, bbox: turf.bbox(poly) });
}
const overlaps = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
// Never drops a unit: a parish that clipping would erase entirely is an
// island parish whose islands the land mask doesn't know about — it keeps
// its full legal outline (lake included) and says so. One with any land
// left (an island parish whose island the mask has) keeps just the land.
let keptWithWater = 0;
function toLand(feature) {
  let f = feature;
  const bb = turf.bbox(f);
  for (const w of water) {
    if (!overlaps(bb, w.bbox)) continue;
    const next = turf.difference(turf.featureCollection([f, w.poly]));
    f = next;
    if (!f) break;
  }
  const clipped = f && dropSlivers(f);
  if (!clipped) {
    keptWithWater++;
    const whole = dropSlivers(feature) ?? feature;
    whole.properties = { ...(whole.properties ?? {}), includes_water: true };
    return whole;
  }
  return clipped;
}

console.log("clipping parishes…");
const pieces = []; // { id, geometry, dcode, subcode, parishCode|null, name }
let pieceSeq = 0;
for (const f of ubosParishes) {
  const p = f.properties;
  const clipped = toLand(f);
  if (!clipped) continue;
  pieces.push({ pid: `p${pieceSeq++}`, feature: clipped, dcode: p.DCode, subcode: String(p.code).slice(0, 6), parishCode: String(p.code), name: p.Parish ?? p.name, water: Boolean(clipped.properties?.includes_water) });
}
// Where a UBOS subcounty's parishes don't cover it (BEC lacks a parish
// polygon), keep the uncovered remainder as an unnamed piece of that
// subcounty, so no land goes missing.
console.log("checking parish cover of each subcounty…");
const parishesBySub = new Map();
for (const pc of pieces) (parishesBySub.get(pc.subcode) ?? parishesBySub.set(pc.subcode, []).get(pc.subcode)).push(pc);
let remainderPieces = 0;
for (const s of ubosSubByCode.values()) {
  for (const sf of s.features) {
    const subLand = toLand(sf);
    if (!subLand) continue;
    const ps = parishesBySub.get(s.code) ?? [];
    const covered = ps.reduce((a, pc) => a + turf.area(pc.feature), 0);
    if (covered / turf.area(subLand) > 0.98) continue;
    const rest = ps.length ? turf.difference(turf.featureCollection([subLand, ...ps.map((pc) => pc.feature)])) : subLand;
    const piece = rest && dropSlivers(rest);
    if (!piece || turf.area(piece) < 0.05e6) continue;
    pieces.push({ pid: `p${pieceSeq++}`, feature: piece, dcode: s.dcode, subcode: s.code, parishCode: null, name: null });
    remainderPieces++;
  }
}

// ----------------------------------- 4b. clean each district's tessellation --
// UBOS's parishes overlap and leave sliver gaps (scripts/lib/tessellate.mjs
// has the measurements); per district, clip to the district outline,
// de-overlap, and hand every sliver to a neighbour, so the layers built
// from them below tile each district exactly.
const tessStats = { overlap_m2: 0, gap_m2: 0, slivers: 0, splits: 0, dropped: 0, unassigned: 0 };
const chunkPieces = []; // big unassigned chunks, kept as land with no owner
// The cleaning is the slow part (~10 min); UBOS_REUSE_CLEAN=1 reuses the
// last run's result (gitignored, next to the raw files) when iterating on
// the steps after it. Never used by a normal run.
const CLEAN_CACHE = path.join(RAW, "cleaned-pieces.json");
if (process.env.UBOS_REUSE_CLEAN && existsSync(CLEAN_CACHE)) {
  console.log("reusing cleaned pieces from", path.relative(ROOT, CLEAN_CACHE));
  const cached = readJson(CLEAN_CACHE);
  pieces.length = 0;
  pieces.push(...cached.pieces);
  pieceSeq = cached.pieceSeq;
  Object.assign(tessStats, cached.tessStats);
} else {
console.log("cleaning overlaps and sliver gaps per district…");
{
  const byD = new Map();
  for (const pc of pieces) (byD.get(pc.dcode) ?? byD.set(pc.dcode, []).get(pc.dcode)).push(pc);
  const districtFeatures = new Map();
  for (const f of ubosDistricts) (districtFeatures.get(f.properties.DCode) ?? districtFeatures.set(f.properties.DCode, []).get(f.properties.DCode)).push(f);
  for (const [dcode, pcs] of byD) {
    const feats = districtFeatures.get(dcode) ?? [];
    if (!feats.length) continue;
    let frame = toLand(feats.length === 1 ? feats[0] : turf.union(turf.featureCollection(feats)));
    // island parishes kept with their water stay whole, and widen the frame
    const wet = pcs.filter((pc) => pc.water);
    if (wet.length) frame = turf.union(turf.featureCollection([frame, ...wet.map((pc) => pc.feature)]));
    pcs.sort((a, b) => String(a.parishCode ?? a.pid).localeCompare(String(b.parishCode ?? b.pid)));
    // 6 dp (~0.1 m) keeps polyclip away from near-degenerate float input
    const trunc = (f) => turf.truncate(f, { precision: 6, coordinates: 2 });
    const t0 = Date.now();
    if (process.env.UBOS_VERBOSE) writeSync(2, `  ${dcode} (${pcs.length} parishes)… `);
    const { items, stats, unassigned } = tessellate(
      trunc(frame),
      pcs.map((pc) => ({ id: pc.pid, feature: trunc(pc.feature), keepWhole: pc.water }))
    );
    for (const pc of pcs) {
      const f = items.get(pc.pid);
      if (f) pc.feature = f;
      else pc.dropped = true;
    }
    for (const k of Object.keys(tessStats)) tessStats[k] += stats[k];
    for (const u of unassigned) {
      chunkPieces.push({ pid: `p${pieceSeq++}`, feature: u.feature, dcode, subcode: null, parishCode: null, name: null, chunk: true, neighbourPids: u.neighbours });
    }
    if (process.env.UBOS_VERBOSE) writeSync(2, `${Date.now() - t0} ms, ${stats.slivers} slivers, ${stats.splits} splits
`);
  }
  for (let i = pieces.length - 1; i >= 0; i--) if (pieces[i].dropped) pieces.splice(i, 1);
  pieces.push(...chunkPieces);
}
writeFileSync(CLEAN_CACHE, JSON.stringify({ pieces, pieceSeq, tessStats }));
}

// --------------------------------------------------- 6. ownership --
// owner = EC subcounty-tier unit each piece of land belongs to (see header)
const majorityOwner = new Map(); // UBOS subcounty code -> EC subcounty id, from its matched parishes
{
  const votes = new Map();
  for (const pc of pieces) {
    const e = pc.parishCode && parishMatch.get(pc.parishCode);
    if (!e) continue;
    const v = votes.get(pc.subcode) ?? new Map();
    v.set(e.parent_id, (v.get(e.parent_id) ?? 0) + 1);
    votes.set(pc.subcode, v);
  }
  for (const [code, v] of votes) {
    const [[best, n], second] = [...v].sort((a, b) => b[1] - a[1]);
    if (!second || n > second[1]) majorityOwner.set(code, best);
  }
}
const ownerHow = { parish: 0, subcounty_name: 0, carved_from: 0, none: 0 };
for (const pc of pieces) {
  const e = pc.parishCode && parishMatch.get(pc.parishCode);
  if (e) {
    pc.owner = e.parent_id;
    ownerHow.parish++;
  } else if (subMatch.has(pc.subcode)) {
    pc.owner = subMatch.get(pc.subcode).unit.id;
    ownerHow.subcounty_name++;
  } else if (majorityOwner.has(pc.subcode)) {
    pc.owner = majorityOwner.get(pc.subcode);
    ownerHow.carved_from++;
  } else {
    pc.owner = null;
    ownerHow.none++;
  }
  // an owner must be in the same district/city the piece is in (or, for a
  // district split since 2022, any of them would have to agree by name
  // already); anything else is a bad vote — leave it as a gap
  if (pc.owner && districtOf(idOf.get(pc.owner))?.id !== dcodeUnit.get(pc.dcode)?.id) {
    pc.owner = null;
    ownerHow.none++;
  }
}

// ----------------------------------------- 6b. refugee-settlement land --
// UBOS enumerates refugee settlements as their own subcounty-level census
// units; the EC (and local government) has no such units — the land is
// administered by the host subcounties around it. By the territorial rule
// it belongs to them, so it's split between the touching host subcounties
// along equidistant lines (inferred), and each settlement's own outline is
// kept as an informational layer (data/geo/settlements.geojson).
const SETTLEMENT = /refugee|settlement|\brsc\b|\brwc\b|\bcamp\b/i;
const settlementGroups = []; // { s, district, partPids, hosts }
{
  for (const pc of pieces) pc.bbox = turf.bbox(pc.feature);
  const camps = new Map();
  for (const pc of pieces) {
    if (!pc.owner && SETTLEMENT.test(ubosSubByCode.get(pc.subcode)?.name ?? "")) {
      (camps.get(pc.subcode) ?? camps.set(pc.subcode, []).get(pc.subcode)).push(pc);
    }
  }
  for (const [subcode, pcs] of camps) {
    const s = ubosSubByCode.get(subcode);
    const d = dcodeUnit.get(s.dcode);
    const chunk = pcs.length === 1 ? pcs[0].feature : turf.union(turf.featureCollection(pcs.map((pc) => pc.feature)));
    const ring = turf.buffer(chunk, 0.05, { units: "kilometers" });
    const bb = turf.bbox(ring);
    const neighbours = pieces
      .filter((pc) => pc.owner && dcodeUnit.get(pc.dcode)?.id === d?.id && overlaps(bb, pc.bbox) && turf.booleanIntersects(ring, pc.feature))
      .map((pc) => ({ key: pc.owner, feature: pc.feature }));
    if (!neighbours.length) continue; // stays unowned -> a gap below
    for (const pc of pcs) pc.removed = true;
    const partPids = [];
    for (const { key, feature } of splitEquidistant(chunk, neighbours)) {
      const pid = `p${pieceSeq++}`;
      pieces.push({ pid, feature, bbox: turf.bbox(feature), dcode: s.dcode, subcode, parishCode: null, name: null, owner: key, settlement: true });
      partPids.push(pid);
    }
    settlementGroups.push({ s, district: d, partPids, hosts: [...new Set(neighbours.map((n) => n.key))] });
  }
  for (let i = pieces.length - 1; i >= 0; i--) if (pieces[i].removed) pieces.splice(i, 1);
}

// --------------------------------------- 6c. 2024 subcounty population --
// UBOS publishes NPHC 2024 population per UBOS subcounty. Each goes to the
// EC subcounty that owns its land (by name, or the unit it was carved
// from); settlement units are left out (their people live on land split
// between host subcounties by inference, not by any count). Approximate
// where a UBOS subcounty's parishes were reorganised across EC units.
{
  const rows = new Map();
  for (const s of ubosSubByCode.values()) {
    const pd = s.features[0].properties.population_data;
    if (!pd || SETTLEMENT.test(s.name)) continue;
    const owner = subMatch.get(s.code)?.unit.id ?? majorityOwner.get(s.code);
    if (!owner || districtOf(idOf.get(owner))?.id !== dcodeUnit.get(s.dcode)?.id) continue;
    // UBOS serves the counts as numbers or numeric strings, and "#N/A"
    // where it has none — those subcounties get no figure rather than a 0
    const num = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));
    const [male, female, total] = [num(pd.male_popn), num(pd.female_popn), num(pd.total_popn)];
    if (!Number.isFinite(total)) continue;
    const r = rows.get(owner) ?? { id: owner, male: 0, female: 0, total: 0, ubos_codes: [], method: "name_match" };
    r.male += Number.isFinite(male) ? male : 0;
    r.female += Number.isFinite(female) ? female : 0;
    r.total += total;
    r.ubos_codes.push(s.code);
    if (!subMatch.has(s.code)) r.method = "includes_carved_units";
    rows.set(owner, r);
  }
  mkdirSync(path.join(DATA, "population"), { recursive: true });
  writeFileSync(
    path.join(DATA, "population/ubos-nphc-2024-subcounty.csv"),
    writeCsv(
      ["id", "male", "female", "total", "ubos_codes", "method"],
      [...rows.values()].sort((a, b) => a.id.localeCompare(b.id)).map((r) => ({ ...r, ubos_codes: r.ubos_codes.join(";") }))
    )
  );
  console.log(`subcounty population (NPHC 2024): ${rows.size} subcounties, ${[...rows.values()].reduce((a, r) => a + r.total, 0)} people`);
}

// ------------------------------------------------ 6d. one topology --
console.log(`simplifying ${pieces.length} pieces as one topology…`);
const simplified = simplifyShared({
  type: "FeatureCollection",
  features: pieces.map((pc) => ({ type: "Feature", properties: { pid: pc.pid }, geometry: pc.feature.geometry })),
});
const geomOf = new Map(simplified.features.map((f) => [f.properties.pid, f]));

// subcounty crosswalk rows: by name, else by the parish evidence
for (const s of ubosSubByCode.values()) {
  const m = subMatch.get(s.code);
  const carved = !m && majorityOwner.get(s.code);
  crosswalk.push({
    level: "subcounty",
    ubos_code: s.code,
    ubos_name: s.name,
    unit_id: m?.unit.id ?? carved ?? "",
    match: m ? m.how : carved ? "carved_from" : "unmatched",
    note: carved ? "not in the EC 2022 gazetteer; its land belongs to this unit (most of its parishes do)" : "",
  });
}
for (const pc of pieces) {
  if (!pc.parishCode) continue;
  const e = parishMatch.get(pc.parishCode);
  crosswalk.push({
    level: "parish",
    ubos_code: pc.parishCode,
    ubos_name: pc.name,
    unit_id: e?.id ?? "",
    match: e ? parishHow.get(pc.parishCode) : "unmatched",
    note: e ? "" : pc.owner ? `land assigned to ${pc.owner}` : "land not assigned (see gaps)",
  });
}

// ------------------------------------------------ 7. assemble layers --
const unionOf = (feats) => {
  const list = feats.filter(Boolean);
  if (!list.length) return null;
  const u = list.length === 1 ? list[0] : turf.union(turf.featureCollection(list));
  return u && fillSmallHoles(u);
};
const props = (u, extra = {}) => ({
  id: u.id,
  name: u.name,
  slug: u.slug,
  ...(u.level === "district" || u.level === "city" ? {} : { level: u.level, district_id: districtOf(u)?.id ?? null }),
  region_id: u.region_id ?? null,
  subregion_id: u.subregion_id ?? null,
  ...extra,
});
const UBOS_PARISH = ["src-ubos-bec-2025-geo"];
const UBOS_BOTH = ["src-ubos-bec-2025-geo", "src-ubos-nphc-2024-geo"];

// parishes: matched UBOS parish; else the sole-remainder inference
const parishFeatures = [];
const ownedBy = new Map(); // EC subcounty id -> pieces
for (const pc of pieces) if (pc.owner) (ownedBy.get(pc.owner) ?? ownedBy.set(pc.owner, []).get(pc.owner)).push(pc);
const mappedParishIds = new Set();
{
  // a UBOS parish can arrive as several features under one code (an island
  // group, say): one polygon per EC parish, so union them
  const piecesOf = new Map();
  for (const pc of pieces) {
    const e = pc.parishCode && parishMatch.get(pc.parishCode);
    if (e && geomOf.get(pc.pid)) (piecesOf.get(e.id) ?? piecesOf.set(e.id, []).get(e.id)).push(pc);
  }
  for (const [id, pcs] of piecesOf) {
    const geom = unionOf(pcs.map((pc) => geomOf.get(pc.pid)));
    if (!geom) continue;
    parishFeatures.push({
      type: "Feature",
      properties: props(idOf.get(id), {
        ubos_code: pcs[0].parishCode,
        ...(pcs.some((pc) => pc.water) ? { includes_water: true } : {}),
        source_ids: UBOS_PARISH,
      }),
      geometry: geom.geometry,
    });
    mappedParishIds.add(id);
  }
}
const gapFeatures = [];
let inferredParishes = 0;
for (const [subId, pcs] of ownedBy) {
  // settlement land belongs to the host subcounty but to none of its parishes
  const leftovers = pcs.filter((pc) => !(pc.parishCode && parishMatch.get(pc.parishCode)) && !pc.settlement);
  if (!leftovers.length) continue;
  const missing = ecUnits.filter((u) => PARISH_LEVELS.has(u.level) && u.parent_id === subId && !mappedParishIds.has(u.id));
  const geom = unionOf(leftovers.map((pc) => geomOf.get(pc.pid)));
  if (!geom) continue;
  if (missing.length === 1) {
    parishFeatures.push({
      type: "Feature",
      properties: props(missing[0], { inferred: true, inference: "sole unmapped parish of its subcounty; this is the subcounty's remaining land", source_ids: UBOS_PARISH }),
      geometry: geom.geometry,
    });
    mappedParishIds.add(missing[0].id);
    inferredParishes++;
  } else if (missing.length > 1) {
    gapFeatures.push({
      type: "Feature",
      properties: { id: `gap:${subId}`, level: "parish", parent_id: subId, district_id: districtOf(idOf.get(subId))?.id, candidate_ids: missing.map((u) => u.id), candidate_names: missing.map((u) => u.name) },
      geometry: geom.geometry,
    });
  }
}

// subcounties: everything they own
const subcountyFeatures = [];
for (const [subId, pcs] of ownedBy) {
  const u = idOf.get(subId);
  const geom = unionOf(pcs.map((pc) => geomOf.get(pc.pid)));
  if (!geom) continue;
  const m = [...subMatch].find(([, v]) => v.unit.id === subId);
  const viaCarving = pcs.some((pc) => !(pc.parishCode && parishMatch.get(pc.parishCode)) && !subMatch.has(pc.subcode));
  subcountyFeatures.push({
    type: "Feature",
    properties: props(u, {
      ubos_code: m?.[0] ?? null,
      ...(viaCarving ? { includes_carved_units: true } : {}),
      source_ids: UBOS_BOTH,
    }),
    geometry: geom.geometry,
  });
}
const mappedSubIds = new Set(subcountyFeatures.map((f) => f.properties.id));

// district-level gaps: land nobody owns, per district/city
{
  const byD = new Map();
  for (const pc of pieces) if (!pc.owner) (byD.get(pc.dcode) ?? byD.set(pc.dcode, []).get(pc.dcode)).push(pc);
  // UBOS enumerates refugee settlements as their own subcounty-level census
  // units; the EC (and local government) has no such units — the land is
  // administered by the host subcounties around it. Kept apart so it can't
  // be mistaken for a missing subcounty below.
  const SETTLEMENT = /refugee|settlement|\brsc\b|\brwc\b|\bcamp\b/i;
  const settlementGaps = [];
  for (const [dcode, pcs] of byD) {
    const d = dcodeUnit.get(dcode);
    if (!d) continue;
    const ubosName = (pc) => ubosSubByCode.get(pc.subcode)?.name ?? "";
    // Big chunks the cleaning step couldn't assign (an unmapped lake, land
    // no parish covers): one gap each, candidates = the subcounties of the
    // parishes touching it. Never fed to the sole-subcounty inference — a
    // lake isn't a missing town council.
    for (const pc of pcs.filter((x) => x.chunk)) {
      const geom = geomOf.get(pc.pid);
      if (!geom) continue;
      const ownerOfPid = new Map(pieces.map((x) => [x.pid, x.owner]));
      const candIds = [...new Set((pc.neighbourPids ?? []).map((pid) => ownerOfPid.get(pid)).filter(Boolean))];
      gapFeatures.push({
        type: "Feature",
        properties: {
          id: `gap:${d.id}:${pc.pid}`,
          kind: "unassigned_chunk",
          level: "subcounty",
          parent_id: d.id,
          district_id: d.id,
          candidate_ids: candIds,
          candidate_names: candIds.map((id) => idOf.get(id)?.name ?? id),
          ubos_names: [],
          note: "Land inside the district that no parish polygon covers and is too large to assign by proximity (e.g. an unmapped lake); it belongs to one or more of the candidate subcounties",
        },
        geometry: geom.geometry,
      });
    }
    const camps = pcs.filter((pc) => !pc.chunk && SETTLEMENT.test(ubosName(pc)));
    const rest = pcs.filter((pc) => !pc.chunk && !SETTLEMENT.test(ubosName(pc)));
    if (camps.length) {
      const geom = unionOf(camps.map((pc) => geomOf.get(pc.pid)));
      if (geom) settlementGaps.push({ d, geom, names: [...new Set(camps.map(ubosName))] });
    }
    const geom = unionOf(rest.map((pc) => geomOf.get(pc.pid)));
    if (!geom) continue;
    const cands = (ecSubByDistrict.get(d.id) ?? []).map((c) => c.unit).filter((u) => !mappedSubIds.has(u.id));
    // The rule in action: if exactly one subcounty of this district has no
    // land yet, the unowned land is that subcounty.
    if (cands.length === 1) {
      subcountyFeatures.push({
        type: "Feature",
        properties: props(cands[0], { inferred: true, inference: "sole unmapped subcounty of its district; this is the district's remaining land", source_ids: UBOS_BOTH }),
        geometry: geom.geometry,
      });
      mappedSubIds.add(cands[0].id);
      continue;
    }
    gapFeatures.push({
      type: "Feature",
      properties: {
        id: `gap:${d.id}`,
        kind: "unassigned",
        level: "subcounty",
        parent_id: d.id,
        district_id: d.id,
        candidate_ids: cands.map((u) => u.id),
        candidate_names: cands.map((u) => u.name),
        ubos_names: [...new Set(rest.map(ubosName).filter(Boolean))],
      },
      geometry: geom.geometry,
    });
  }
  // A settlement's candidates are the subcounties actually touching it.
  for (const { d, geom, names } of settlementGaps) {
    const ring = turf.buffer(geom, 0.3, { units: "kilometers" });
    const bb = turf.bbox(ring);
    const hosts = subcountyFeatures.filter(
      (f) => f.properties.district_id === d.id && overlaps(bb, turf.bbox(f)) && turf.booleanIntersects(ring, f)
    );
    gapFeatures.push({
      type: "Feature",
      properties: {
        id: `gap:${d.id}:settlement`,
        kind: "refugee_settlement",
        level: "subcounty",
        parent_id: d.id,
        district_id: d.id,
        candidate_ids: hosts.map((f) => f.properties.id),
        candidate_names: hosts.map((f) => f.properties.name),
        ubos_names: names,
        note: "UBOS census unit for a refugee settlement; the land belongs to the host subcounties listed, split between them in ways no source here records",
      },
      geometry: geom.geometry,
    });
  }
}

// counties: union of their subcounties (county = its subcounties, exactly)
const subGeom = new Map(subcountyFeatures.map((f) => [f.properties.id, f]));
const countyFeatures = [];
for (const c of ecUnits.filter((u) => COUNTY_LEVELS.has(u.level))) {
  const subs = ecUnits.filter((u) => SUBCOUNTY_LEVELS.has(u.level) && u.parent_id === c.id);
  const have = subs.filter((s) => subGeom.has(s.id));
  if (!have.length) continue;
  const geom = unionOf(have.map((s) => subGeom.get(s.id)));
  countyFeatures.push({
    type: "Feature",
    properties: props(c, { complete: have.length === subs.length, subcounties_mapped: have.length, subcounties_total: subs.length, source_ids: UBOS_BOTH }),
    geometry: geom.geometry,
  });
}

// cities and districts: all land in them. A district's polygon includes
// any city carved out of it (the territorial "parent" view, unchanged from
// earlier releases); cities are also published on their own.
const piecesByDistrict = new Map();
for (const pc of pieces) {
  const d = dcodeUnit.get(pc.dcode);
  if (d) (piecesByDistrict.get(d.id) ?? piecesByDistrict.set(d.id, []).get(d.id)).push(pc);
}
const cityFeatures = cities.map((c) => ({
  type: "Feature",
  properties: props(c, { ubos_code: [...dcodeUnit].find(([, u]) => u.id === c.id)?.[0] ?? null, source_ids: UBOS_BOTH }),
  geometry: unionOf((piecesByDistrict.get(c.id) ?? []).map((pc) => geomOf.get(pc.pid))).geometry,
}));
const districtFeatures = districts.map((d) => {
  const own = piecesByDistrict.get(d.id) ?? [];
  const fromCities = cities.filter((c) => c.parent_id === d.id).flatMap((c) => piecesByDistrict.get(c.id) ?? []);
  return {
    type: "Feature",
    properties: props(d, { ubos_code: [...dcodeUnit].find(([, u]) => u.id === d.id)?.[0] ?? null, source_ids: UBOS_BOTH }),
    geometry: unionOf([...own, ...fromCities].map((pc) => geomOf.get(pc.pid))).geometry,
  };
});

// ---------------------------------------------------------- 8. write --
const write = (name, features) => {
  features.sort((a, b) => a.properties.id.localeCompare(b.properties.id));
  // turf.union output is wound for the planar convention; d3-geo (the web
  // app's bounds/centroids) reads that as "the whole globe minus this
  // polygon". Rewinding to a fixed orientation is idempotent, so every
  // feature gets it here regardless of where its geometry came from.
  // Simplification can collapse a hairline sliver into a zero-area
  // 4-point part; those are dropped first (dropSlivers: parts < 0.01 km²).
  // A feature that's nothing BUT such slivers (a tiny islet parish the
  // simplification erased) has no boundary to publish and is left out.
  for (let i = features.length - 1; i >= 0; i--) {
    const clean = dropSlivers(features[i]);
    if (!clean) {
      console.warn(`  ${name}: dropped ${features[i].properties.id} (collapsed to zero area)`);
      features.splice(i, 1);
      continue;
    }
    features[i].geometry = turf.rewind(clean, { reverse: true }).geometry;
  }
  writeFileSync(path.join(DATA, "geo", `${name}.geojson`), JSON.stringify({ type: "FeatureCollection", features }));
};
mkdirSync(path.join(DATA, "geo"), { recursive: true });
write("parishs", parishFeatures);
write("subcountys", subcountyFeatures);
write("countys", countyFeatures);
write("citys", cityFeatures);
write("districts", districtFeatures);
write("gaps", gapFeatures);
// settlement outlines, rebuilt from their host-assigned parts after
// simplification so they line up exactly with the subcounties around them
write(
  "settlements",
  settlementGroups
    .map(({ s, district, partPids, hosts }) => {
      const geom = unionOf(partPids.map((pid) => geomOf.get(pid)));
      if (!geom) return null;
      const name = s.name.toLowerCase().replace(/[a-z]/g, (c) => c.toUpperCase()).replace(/(Rsc|Rwc|Iii)/g, (m) => m.toUpperCase());
      return {
        type: "Feature",
        properties: {
          id: `settlement:${s.code}`,
          name,
          ubos_code: s.code,
          district_id: district?.id ?? null,
          host_subcounty_ids: hosts,
          note: "UBOS census unit for a refugee settlement; its land is split between the host subcounties along equidistant lines (inferred)",
          source_ids: UBOS_BOTH,
        },
        geometry: geom.geometry,
      };
    })
    .filter(Boolean)
);
mkdirSync(path.join(DATA, "crosswalk"), { recursive: true });
writeFileSync(
  path.join(DATA, "crosswalk/ubos-2024.csv"),
  writeCsv(["level", "ubos_code", "ubos_name", "unit_id", "match", "note"], crosswalk)
);

// ------------------------------------------------------------ summary --
const ecCount = (levels) => ecUnits.filter((u) => levels.has(u.level)).length;
const pct = (n, d) => `${n}/${d} (${((n / d) * 100).toFixed(1)}%)`;
const tally = (lvl) => crosswalk.filter((r) => r.level === lvl).reduce((t, r) => ((t[r.match] = (t[r.match] ?? 0) + 1), t), {});
console.log("UBOS subcounty matches:", JSON.stringify(tally("subcounty")));
console.log("UBOS parish matches:", JSON.stringify(tally("parish")));
console.log("land pieces:", pieces.length, `(${remainderPieces} subcounty remainders BEC didn't cover; ${keptWithWater} kept whole as island/lake units)`, "owner via", JSON.stringify(ownerHow));
console.log("parish polygons:", pct(parishFeatures.length, ecCount(PARISH_LEVELS)), `(${inferredParishes} inferred)`);
console.log("subcounty polygons:", pct(subcountyFeatures.length, ecCount(SUBCOUNTY_LEVELS)), `(${subcountyFeatures.filter((f) => f.properties.inferred).length} inferred)`);
console.log("county polygons:", pct(countyFeatures.length, ecCount(COUNTY_LEVELS)), `(${countyFeatures.filter((f) => f.properties.complete).length} complete)`);
console.log(
  `cleaning: ${(tessStats.overlap_m2 / 1e6).toFixed(1)} km² of overlaps removed, ${(tessStats.gap_m2 / 1e6).toFixed(1)} km² of gaps filled (${tessStats.slivers} slivers to nearest neighbour, ${tessStats.splits} equidistant splits), ${tessStats.dropped} pieces fully overlapped`
);
console.log("settlements split between host subcounties:", settlementGroups.length, `· clipping ops that fell back: ${clipFailures()}`);
console.log("gaps:", gapFeatures.length, `(${gapFeatures.filter((g) => g.properties.level === "subcounty").length} subcounty-level, ${gapFeatures.filter((g) => g.properties.level === "parish").length} parish-level)`);
const km2 = (fs) => Math.round(fs.reduce((s, f) => s + turf.area(f), 0) / 1e6);
console.log(`land: districts ${km2(districtFeatures)} km², sanity kampala ${Math.round(turf.area(districtFeatures.find((f) => f.properties.id === "district:kampala")) / 1e6)} km²`);
