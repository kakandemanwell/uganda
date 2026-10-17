import * as uganda from "@/lib/uganda-data.mjs";
import { SITE_URL } from "@/lib/site";

// The emerging llms.txt convention (llmstxt.org): a plain-markdown map of the
// site for LLMs/answer engines to fetch instead of parsing rendered HTML.
// Generated from the same totals the rest of the site reads, so it can't
// drift out of sync with the data the way a hand-written static file would.
export async function GET() {
  const totals = uganda.dataQualityReport().totals;

  const body = `# uganda-locale

> Uganda's administrative units — region, sub-region, district, county, subcounty, parish, and village — plus boundaries, roads, and 2024 census population, served as JSON, CSV, and GeoJSON under CC BY 4.0 (boundary geometry from UBOS; roads ODbL).

Coverage: ${totals.regions} regions, ${totals.subregions} sub-regions, ${totals.districts} districts (incl. Kampala/KCCA), ${totals.cities} cities, ${totals.counties} counties, ${totals.subcounties} subcounties, ${totals.parishes} parishes, and ${totals.villages} villages, all with ancestry back to region.

Every record cites its source (UBOS, the Electoral Commission of Uganda, geoBoundaries, OCHA/HDX, or OpenStreetMap) and its confidence level. Kampala is modeled as both a district and its own sub-region-equivalent, per UBOS convention (it is not nested under Buganda) — see the unit page for the full note.

## Data

- [Download every file](${SITE_URL}/data): per-level JSON, one-row-per-village CSV, and boundary GeoJSON
- [Browse and filter the dataset](${SITE_URL}/explore)
- [Interactive map](${SITE_URL}/map): choropleth of any level by population, density or unit counts; exports boundaries as GeoJSON/CSV
- [OCHA P-code crosswalk](${SITE_URL}/data/crosswalk/hdx-cod-ab-uga.csv): every OCHA COD-AB region/district/county/subcounty P-code mapped to a uganda-locale id — records also carry it as external_refs.hdx_pcode / hdx_within_pcode, for joining humanitarian datasets
- [Sitemap of every unit page](${SITE_URL}/sitemap.xml)

## API

- \`GET /api/regions\`, \`/api/subregions\`, \`/api/districts\`, \`/api/cities\` — full lists
- \`GET /api/districts/:id/counties\`, \`/api/counties/:id/subcounties\`, \`/api/subcounties/:id/parishes\` — children of a unit
- \`GET /api/units/:id\` — a single unit with its ancestors and children (a parish/ward also lists its \`villages\`)
- \`GET /api/units?level=...&districtId=...&countyId=...&subcountyId=...&parishId=...&q=...\` — any level, narrowed to everything inside a unit; e.g. \`level=village&parishId=parish:koboko-abuku-gborokolongo\` for one parish's villages
- \`GET /api/units?...&groupBy=parish\` — the same, sorted into groups by a parent level (region/subregion/district/county/subcounty/parish) with per-group totals
- \`GET /api/search?q=...\` — name/alias search across all loaded levels
- \`GET /api/units/export\` — bulk export
- \`GET /api/geo/districts\`, \`/api/geo/regions\`, \`/api/geo/cities\`, \`/api/geo/counties\`, \`/api/geo/subcounties\`, \`/api/geo/parishes\`, \`/api/geo/gaps\`, \`/api/geo/roads\` — GeoJSON boundaries down to parish, built from UBOS's 2024/2025 polygons (every polygon carries area_km2, its OCHA hdx_pcode and its UBOS code)
- \`GET /api/geo/stats?level=district\` — per-polygon metrics (population, density, unit counts) keyed by unit id
- \`GET /api/geo/export?level=subcounty&format=csv&within=district:gulu\` — boundaries joined with metrics and P-codes, as GeoJSON or CSV, filterable by \`within=\`, \`bbox=\` or \`ids=\`

## Code

- [npm package](https://www.npmjs.com/package/uganda-locale) — \`npm install uganda-locale\` (or \`npm install github:kakandemanwell/uganda\` for unreleased master)
- [Source on GitHub](https://github.com/kakandemanwell/uganda)
- [Data license](https://github.com/kakandemanwell/uganda/blob/master/LICENSE-DATA.md) (CC BY 4.0; boundaries from UBOS, cite UBOS; roads ODbL)
`;

  return new Response(body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
