// Minimal smoke test for the src/index.mjs and src/deep.mjs public API —
// not a full test suite, just a guard against obvious breakage before
// publishing (e.g. a renamed dist file, a broken export).
import assert from "node:assert/strict";
import * as ug from "../src/index.mjs";
import * as deep from "../src/deep.mjs";

assert.equal(ug.regions().length, 4, "expected 4 regions");
assert.equal(ug.subregions().length, 17, "expected 17 subregions");
assert.equal(ug.districts().length, 136, "expected 136 districts");
assert.equal(ug.cities().length, 10, "expected 10 cities");

const mbarara = ug.districts().find((d) => d.slug === "mbarara");
assert.ok(mbarara, "Mbarara district should exist");
assert.equal(mbarara.subregion_id, "subregion:ankole", "Mbarara should be in the Ankole subregion");

const mbararaCounties = ug.counties({ districtId: mbarara.id });
assert.ok(mbararaCounties.length > 0, "Mbarara should have counties");

const someCounty = mbararaCounties[0];
const subcounties = ug.subcounties({ parentId: someCounty.id });
assert.ok(subcounties.length > 0, `${someCounty.name} should have subcounties`);

const ancestors = ug.getAncestors(someCounty.id);
assert.equal(ancestors[0].id, mbarara.id, "county's first ancestor should be its district");
assert.equal(ancestors.at(-1).level, "region", "ancestor chain should terminate at region");

assert.ok(ug.search("kampala").length > 0, "search should find Kampala");
assert.equal(ug.getUnit(mbarara.id).id, mbarara.id, "getUnit should resolve by id");

const country = ug.country();
assert.equal(country.iso.alpha2, "UG");
assert.equal(country.currency.code, "UGX");

const dqr = ug.dataQualityReport();
assert.equal(dqr.totals.districts, 136);

// deep.mjs: parish/ward/cell
const someSubcounty = subcounties[0];
const parishes = deep.parishes({ parentId: someSubcounty.id });
assert.ok(Array.isArray(parishes), "deep.parishes should return an array");
assert.ok(deep.getUnit(mbarara.id), "deep re-exports index.mjs functions");

console.log("smoke test passed:", {
  regions: ug.regions().length,
  subregions: ug.subregions().length,
  districts: ug.districts().length,
  cities: ug.cities().length,
  counties: ug.counties().length,
  subcounties: ug.subcounties().length,
  parishesAndWards: deep.parishes().length,
  cells: deep.cells().length,
});
