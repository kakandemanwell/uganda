// Esri World Imagery tiles for the map's satellite basemap, proxied so the
// ArcGIS key never reaches the browser (ESRI_API_KEY in web/.env.local or
// the deployment's environment). With a key, tiles come from the ArcGIS
// Location Platform basemap service; without one (local development), from
// Esri's public tile endpoint. Either way the map shows "Powered by Esri"
// attribution (components/map-canvas.jsx).
//
// Imagery is display-only here: tiles are cached by the browser/CDN for
// speed, never copied into public/ or dist/ — the CC BY dataset carries no
// Esri pixels.

const KEYED = "https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile";
const PUBLIC = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";

// Imagery changes rarely; a week in the browser, a month at the edge.
const CACHE = {
  "Cache-Control": "public, max-age=604800",
  "CDN-Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=86400",
  "Vercel-CDN-Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=86400",
};

export async function GET(_request, { params }) {
  const { z, y, x } = await params;
  const [zi, yi, xi] = [z, y, x].map(Number);
  // Integers only, within the tile grid — this is a fixed-upstream proxy,
  // not an open relay.
  if (![zi, yi, xi].every(Number.isInteger) || zi < 0 || zi > 19 || xi < 0 || yi < 0 || xi >= 2 ** zi || yi >= 2 ** zi) {
    return new Response("Bad tile coordinates", { status: 400 });
  }
  const key = process.env.ESRI_API_KEY;
  const url = key ? `${KEYED}/${zi}/${yi}/${xi}?token=${encodeURIComponent(key)}` : `${PUBLIC}/${zi}/${yi}/${xi}`;
  const upstream = await fetch(url, { headers: { "User-Agent": "uganda-locale-map" } });
  if (!upstream.ok) return new Response(null, { status: upstream.status === 404 ? 404 : 502 });
  return new Response(upstream.body, {
    headers: { ...CACHE, "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg" },
  });
}
