// Shared response helpers for the API routes. The data is static within a
// deploy (it only changes on a new build), so every response is safely
// cacheable at the edge.
//
// Three separate directives rather than one shared Cache-Control: Vercel's
// CDN strips s-maxage/stale-while-revalidate from what it echoes back to the
// browser once a request has gone through its edge cache, so a single header
// carrying both a long edge TTL and a browser TTL is invisible/unverifiable
// from the client side. CDN-Cache-Control/Vercel-CDN-Cache-Control give the
// edge TTL explicitly and are never forwarded downstream. See
// https://vercel.com/docs/caching/cdn-cache#cdn-cache-control.
export const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=3600",
  "CDN-Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
  "Vercel-CDN-Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
};

export function ok(data) {
  return Response.json(data, { headers: CACHE_HEADERS });
}

export function notFound(message = "Not found") {
  return Response.json({ error: message }, { status: 404 });
}

export function badRequest(message = "Bad request") {
  return Response.json({ error: message }, { status: 400 });
}
