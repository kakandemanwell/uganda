// Minimal smoke test for the API routes — mirrors the root package's
// scripts/smoke-test.mjs (plain node:assert, no framework, just a guard
// against obvious breakage). Boots its own `next dev` on a dedicated port
// so it doesn't collide with one you might already have running, waits for
// it to come up, runs a handful of HTTP assertions against real routes,
// then tears the server down.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";

const PORT = 3099;
const BASE = `http://localhost:${PORT}`;

// next dev's own predev hook only fires under `npm run dev`; run it
// directly since this script spawns `next dev` itself.
spawnSync("npm run sync-data", { stdio: "ignore", shell: true });

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

const server = spawn(`npx next dev -p ${PORT}`, {
  stdio: "ignore",
  shell: true,
});

let exitCode = 0;
try {
  await waitForServer(`${BASE}/api/regions`);

  // Cache headers: browser gets a short max-age, edge gets the long one via
  // the Vercel-specific + generic CDN headers (see web/lib/respond.mjs for
  // why these are three separate directives instead of one).
  {
    const res = await fetch(`${BASE}/api/regions`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.length, 4, "expected 4 regions");
    assert.equal(res.headers.get("cache-control"), "public, max-age=3600");
    assert.equal(
      res.headers.get("cdn-cache-control"),
      "public, s-maxage=86400, stale-while-revalidate=86400",
    );
    assert.equal(
      res.headers.get("vercel-cdn-cache-control"),
      "public, s-maxage=86400, stale-while-revalidate=86400",
    );
  }

  // /api/units/export sends the same cache headers alongside its
  // Content-Disposition (it builds a raw Response, not via ok(), so this
  // regresses independently of the check above).
  {
    const res = await fetch(`${BASE}/api/units/export?format=csv&level=region`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cdn-cache-control"), "public, s-maxage=86400, stale-while-revalidate=86400");
    assert.match(res.headers.get("content-disposition") ?? "", /attachment; filename="uganda-locale-region\.csv"/);
  }

  // Scoped drill-down routes accept a bare slug (unaffected by today's
  // change — regression guard so a future edit doesn't quietly break this).
  {
    const res = await fetch(`${BASE}/api/districts/mbarara/counties`);
    assert.equal(res.status, 200);
    const counties = await res.json();
    assert.ok(counties.length > 0, "Mbarara should have counties");
  }

  // /api/units/:id requires the fully-qualified id and works when given one.
  {
    const res = await fetch(`${BASE}/api/units/district:mbarara`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.unit.id, "district:mbarara");
  }

  // /api/units/:id rejects a bare slug with a 400 explaining why, instead of
  // silently guessing — slugs collide across levels (~13% of this dataset),
  // so a guess here could return the wrong unit (e.g. "kampala" is both
  // district:kampala and subregion:kampala).
  {
    const res = await fetch(`${BASE}/api/units/mbarara`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /bare slug/);
  }

  // Existing error handling: unknown district still 404s cleanly.
  {
    const res = await fetch(`${BASE}/api/districts/not-a-real-district/counties`);
    assert.equal(res.status, 404);
  }

  console.log("api smoke test passed");
} catch (err) {
  exitCode = 1;
  console.error("api smoke test FAILED:", err.message);
} finally {
  server.kill();
}
process.exit(exitCode);
