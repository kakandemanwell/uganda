// Smoke test for the API routes — mirrors the root package's
// scripts/smoke-test.mjs (plain node:assert, no framework). Boots its own
// `next dev` on a dedicated port so it doesn't collide with one you might
// already have running, waits for it to come up, runs assertions against
// every documented route (plus edge cases), then tears the server down.
//
// Every case is registered with test(name, fn) and run independently —
// one failing assertion doesn't stop the rest, so a single run surfaces
// every regression instead of one at a time.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";

const PORT = 3099;
const BASE = `http://localhost:${PORT}`;

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`);
  const body = await res.json();
  return { res, body };
}

// ---- regions / subregions / districts / cities / country ----

test("GET /api/regions", async () => {
  const { res, body } = await getJson("/api/regions");
  assert.equal(res.status, 200);
  assert.equal(body.length, 4, "expected 4 regions");
  assert.equal(res.headers.get("cache-control"), "public, max-age=3600");
  assert.equal(res.headers.get("cdn-cache-control"), "public, s-maxage=86400, stale-while-revalidate=86400");
  assert.equal(res.headers.get("vercel-cdn-cache-control"), "public, s-maxage=86400, stale-while-revalidate=86400");
});

test("GET /api/subregions", async () => {
  const { res, body } = await getJson("/api/subregions");
  assert.equal(res.status, 200);
  assert.equal(body.length, 17, "expected 17 subregions");
});

test("GET /api/districts", async () => {
  const { res, body } = await getJson("/api/districts");
  assert.equal(res.status, 200);
  assert.equal(body.length, 136, "expected 136 districts");
});

test("GET /api/districts?regionId=", async () => {
  const { body } = await getJson("/api/districts?regionId=region:western");
  assert.ok(body.length > 0, "expected at least one Western district");
  assert.ok(body.every((d) => d.region_id === "region:western"), "all results should be in region:western");
});

test("GET /api/districts?subregionId=", async () => {
  const { body } = await getJson("/api/districts?subregionId=subregion:ankole");
  assert.ok(body.length > 0, "expected at least one Ankole district");
  assert.ok(body.every((d) => d.subregion_id === "subregion:ankole"), "all results should be in subregion:ankole");
});

test("GET /api/cities", async () => {
  const { res, body } = await getJson("/api/cities");
  assert.equal(res.status, 200);
  assert.equal(body.length, 10, "expected 10 cities");
  assert.ok(
    body.every((c) => typeof c.population?.total === "number"),
    "every city should carry a population.total",
  );
});

test("GET /api/country", async () => {
  const { res, body } = await getJson("/api/country");
  assert.equal(res.status, 200);
  assert.equal(body.iso.alpha2, "UG");
  assert.equal(body.currency.code, "UGX");
});

// ---- scoped drill-down: district -> county -> subcounty -> parish ----

test("GET /api/districts/:id/counties (full id and bare slug agree)", async () => {
  const [full, slug] = await Promise.all([
    getJson("/api/districts/district:mbarara/counties"),
    getJson("/api/districts/mbarara/counties"),
  ]);
  assert.equal(full.res.status, 200);
  assert.equal(slug.res.status, 200);
  assert.ok(full.body.length > 0, "Mbarara should have counties");
  assert.deepEqual(full.body, slug.body, "full id and bare slug should return identical results");
});

test("GET /api/districts/:id/counties (unknown district -> 404)", async () => {
  const res = await fetch(`${BASE}/api/districts/not-a-real-district/counties`);
  assert.equal(res.status, 404);
});

test("GET /api/counties/:id/subcounties -> /api/subcounties/:id/parishes chain", async () => {
  const { body: counties } = await getJson("/api/districts/mbarara/counties");
  const countyId = counties[0].id;
  const { res: scRes, body: subcounties } = await getJson(`/api/counties/${countyId}/subcounties`);
  assert.equal(scRes.status, 200);
  assert.ok(subcounties.length > 0, `${countyId} should have subcounties`);

  const subcountyId = subcounties[0].id;
  const { res: pRes, body: parishes } = await getJson(`/api/subcounties/${subcountyId}/parishes`);
  assert.equal(pRes.status, 200);
  assert.ok(parishes.length > 0, `${subcountyId} should have parishes`);
  assert.ok(
    parishes.every((p) => p.parent_id === subcountyId),
    "every parish should belong to the requested subcounty",
  );
});

// ---- /api/units: every level, pagination, filters ----

const LEVEL_TOTALS = {
  region: 4,
  subregion: 17,
  district: 136,
  city: 10,
  county: 322,
  subcounty: 2191,
  parish: 10717,
  village: 71230,
};

for (const [level, total] of Object.entries(LEVEL_TOTALS)) {
  test(`GET /api/units?level=${level}`, async () => {
    const { res, body } = await getJson(`/api/units?level=${level}`);
    assert.equal(res.status, 200);
    assert.equal(body.total, total, `expected ${total} ${level} records`);
    assert.equal(body.page, 1);
    assert.equal(body.pageSize, 50);
    assert.equal(body.items.length, Math.min(50, total));
  });
}

test("GET /api/units pagination", async () => {
  const { res, body } = await getJson("/api/units?level=district&page=2&pageSize=10");
  assert.equal(res.status, 200);
  assert.equal(body.total, 136);
  assert.equal(body.page, 2);
  assert.equal(body.items.length, 10);
});

test("GET /api/units regionId filter", async () => {
  const { body } = await getJson("/api/units?level=district&regionId=region:western");
  assert.ok(body.total > 0 && body.total < 136);
  assert.ok(body.items.every((d) => d.region_id === "region:western"));
});

test("GET /api/units q filter", async () => {
  const { body } = await getJson("/api/units?level=district&q=mbar");
  assert.equal(body.total, 1);
  assert.equal(body.items[0].name, "Mbarara");
});

test("GET /api/units?level=<invalid> -> 400", async () => {
  const res = await fetch(`${BASE}/api/units?level=notalevel`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /Unknown level/);
});

// ---- /api/units/:id ----

test("GET /api/units/:id (full id)", async () => {
  const { res, body } = await getJson("/api/units/district:mbarara");
  assert.equal(res.status, 200);
  assert.equal(body.unit.id, "district:mbarara");
  assert.ok(body.ancestors.length >= 1, "district should have at least one ancestor (its region)");
  assert.equal(body.ancestors.at(-1).level, "region", "ancestor chain should terminate at region");
  assert.ok(body.children.length > 0, "Mbarara should have children");
});

test("GET /api/units/:id (bare slug -> 400, not a silent guess)", async () => {
  const res = await fetch(`${BASE}/api/units/mbarara`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /bare slug/);
});

test("GET /api/units/:id (unknown full id -> 404)", async () => {
  const res = await fetch(`${BASE}/api/units/district:does-not-exist`);
  assert.equal(res.status, 404);
});

test("GET /api/units/:id (village id has no ':' -> 400, not a false-positive 200)", async () => {
  const { body: villages } = await getJson("/api/units?level=village&pageSize=1");
  const villageId = villages.items[0].id;
  const res = await fetch(`${BASE}/api/units/${villageId}`);
  // Villages have no stable prefixed id (see lib/villages.mjs), so this
  // should never resolve to a real unit — pinning it at 400 so a future
  // change to the bare-slug guard can't silently start returning 200 with
  // the wrong unit for a numeric-looking id.
  assert.equal(res.status, 400);
});

// ---- /api/units/export ----

test("GET /api/units/export?format=csv", async () => {
  const res = await fetch(`${BASE}/api/units/export?format=csv&level=region`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.match(res.headers.get("content-disposition") ?? "", /attachment; filename="uganda-locale-region\.csv"/);
  assert.equal(res.headers.get("cdn-cache-control"), "public, s-maxage=86400, stale-while-revalidate=86400");
  const text = await res.text();
  assert.equal(text.trim().split("\n").length, 5, "header row + 4 regions");
});

test("GET /api/units/export?format=json", async () => {
  const res = await fetch(`${BASE}/api/units/export?format=json&level=region`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/json");
  const body = await res.json();
  assert.equal(body.length, 4);
});

test("GET /api/units/export?level=<invalid> -> 400", async () => {
  const res = await fetch(`${BASE}/api/units/export?format=csv&level=notalevel`);
  assert.equal(res.status, 400);
});

// ---- /api/search ----

test("GET /api/search?q=", async () => {
  const { res, body } = await getJson("/api/search?q=kampala");
  assert.equal(res.status, 200);
  assert.ok(body.length > 0, "expected at least one Kampala match");
});

test("GET /api/search with level + limit", async () => {
  const { res, body } = await getJson("/api/search?q=kampala&level=district&limit=2");
  assert.equal(res.status, 200);
  assert.ok(body.length <= 2);
  assert.ok(body.every((u) => u.level === "district"));
});

test("GET /api/search with no q -> empty array, not an error", async () => {
  const { res, body } = await getJson("/api/search");
  assert.equal(res.status, 200);
  assert.deepEqual(body, []);
});

test("GET /api/search?level=<invalid> -> clean 400, not a 500", async () => {
  // deep.search()'s level loop calls loadLevel(level) per level, which
  // throws "Unknown level: X" for anything not in FILES — unlike
  // /api/units and /api/units/export, this route never validates `level`
  // before calling into it, so a bad value should crash the handler.
  const res = await fetch(`${BASE}/api/search?q=kampala&level=notalevel`);
  assert.equal(res.status, 400, `expected 400, got ${res.status}`);
});

test("GET /api/search?level=village -> clean 400, not a 500", async () => {
  // "village" is a valid /api/units level, but uganda-data.mjs's FILES map
  // (what search's loadLevel() indexes into) has no "village" entry —
  // villages are read from a separate CSV via lib/villages.mjs — so this
  // is the same crash as the invalid-level case above, just reachable
  // through a level name that looks legitimate.
  const res = await fetch(`${BASE}/api/search?q=kampala&level=village`);
  assert.equal(res.status, 400, `expected 400, got ${res.status}`);
});

// ---- /api/geo/* ----

const GEO_ENDPOINTS = {
  districts: 136,
  regions: 4,
};

for (const [name, count] of Object.entries(GEO_ENDPOINTS)) {
  test(`GET /api/geo/${name}`, async () => {
    const { res, body } = await getJson(`/api/geo/${name}`);
    assert.equal(res.status, 200);
    assert.equal(body.type, "FeatureCollection");
    assert.equal(body.features.length, count);
  });
}

test("GET /api/geo/subcounties (partial coverage)", async () => {
  const { res, body } = await getJson("/api/geo/subcounties");
  assert.equal(res.status, 200);
  assert.equal(body.type, "FeatureCollection");
  assert.ok(body.features.length > 1000 && body.features.length < 2191);
});

test("GET /api/geo/parishes (partial coverage)", async () => {
  const { res, body } = await getJson("/api/geo/parishes");
  assert.equal(res.status, 200);
  assert.equal(body.type, "FeatureCollection");
  assert.ok(body.features.length > 0 && body.features.length < 10717);
});

test("GET /api/geo/roads", async () => {
  const { res, body } = await getJson("/api/geo/roads");
  assert.equal(res.status, 200);
  assert.equal(body.type, "FeatureCollection");
  assert.ok(body.features.length > 10000);
});

// ---- runner ----

function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (async function poll() {
      try {
        await fetch(url);
        resolve();
      } catch {
        if (Date.now() > deadline) reject(new Error(`server didn't come up within ${timeoutMs}ms`));
        else setTimeout(poll, 300);
      }
    })();
  });
}

// next dev's own predev hook only fires under `npm run dev`; run it
// directly since this script spawns `next dev` itself.
spawnSync("npm run sync-data", { stdio: "ignore", shell: true });

const server = spawn(`npx next dev -p ${PORT}`, { stdio: "ignore", shell: true });

let failures = 0;
try {
  await waitForServer(`${BASE}/api/regions`);

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  ok  ${name}`);
    } catch (err) {
      failures++;
      console.error(`FAIL  ${name}`);
      console.error(`      ${err.message}`);
    }
  }
} finally {
  server.kill();
}

if (failures > 0) {
  console.error(`\n${failures}/${tests.length} tests failed`);
  process.exit(1);
} else {
  console.log(`\nall ${tests.length} tests passed`);
  process.exit(0);
}
