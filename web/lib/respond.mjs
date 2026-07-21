// Shared response helpers for the API routes. The data is static within a
// deploy (it only changes on a new build), so every response is safely
// cacheable at the edge.
const CACHE_HEADER = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400";

export function ok(data) {
  return Response.json(data, { headers: { "Cache-Control": CACHE_HEADER } });
}

export function notFound(message = "Not found") {
  return Response.json({ error: message }, { status: 404 });
}

export function badRequest(message = "Bad request") {
  return Response.json({ error: message }, { status: 400 });
}
