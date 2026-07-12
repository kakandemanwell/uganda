// uganda-locale/deep — opt-in extension of the default export that also
// loads parish/ward and cell data (~5MB combined) into the same in-memory
// index, so getUnit/getChildren/getAncestors/search cover those levels too.
//
// Village-level data still isn't included here — the full per-record JSON
// is ~33MB and isn't published with this package. Use
// dist/uganda-locations-full.csv from the repo (one row per village, full
// ancestry) or the hosted API for that.
export * from "./index.mjs";

import { loadLevel } from "./store.mjs";

const DEEP_LEVELS = ["parish", "ward", "cell"];
for (const level of DEEP_LEVELS) loadLevel(level);

/** Parishes and wards — the tier under subcounty/town_council/division. Pass { parentId } to filter. */
export function parishes({ parentId } = {}) {
  const all = [...loadLevel("parish"), ...loadLevel("ward")];
  return parentId ? all.filter((u) => u.parent_id === parentId) : all;
}

/** Cells — the village-equivalent tier under city/Kampala wards. Pass { parentId } to filter. Rural villages are NOT included (see module doc). */
export function cells({ parentId } = {}) {
  const all = loadLevel("cell");
  return parentId ? all.filter((u) => u.parent_id === parentId) : all;
}
