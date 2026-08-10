import * as uganda from "@/lib/uganda-data.mjs";
import { SITE_URL } from "@/lib/site";

// The emerging llms.txt convention (llmstxt.org): a plain-markdown map of the
// site for LLMs/answer engines to fetch instead of parsing rendered HTML.
// Generated from the same totals the rest of the site reads, so it can't
// drift out of sync with the data the way a hand-written static file would.
export async function GET() {
  const totals = uganda.dataQualityReport().totals;

  const body = `# uganda-locale

> Uganda's administrative units — region, sub-region, district, county, subcounty, parish, and village — plus boundaries, roads, and 2024 census population, served as JSON, CSV, and GeoJSON under CC BY 4.0 (roads layer ODbL).

Coverage: ${totals.regions} regions, ${totals.subregions} sub-regions, ${totals.districts} districts (incl. Kampala/KCCA), ${totals.cities} cities, ${totals.counties} counties, ${totals.subcounties} subcounties, ${totals.parishes} parishes, and ${totals.villages} villages, all with ancestry back to region.

Every record cites its source (UBOS, the Electoral Commission of Uganda, geoBoundaries, OCHA/HDX, or OpenStreetMap) and its confidence level. Kampala is modeled as both a district and its own sub-region-equivalent, per UBOS convention (it is not nested under Buganda) — see the unit page for the full note.

## Data

- [Download every file](${SITE_URL}/data): per-level JSON, one-row-per-village CSV, and boundary GeoJSON
- [Browse and filter the dataset](${SITE_URL}/explore)
- [Interactive map](${SITE_URL}/map)
- [Sitemap of every unit page](${SITE_URL}/sitemap.xml)

## API

- \`GET /api/regions\`, \`/api/subregions\`, \`/api/districts\`, \`/api/cities\` — full lists
- \`GET /api/districts/:id/counties\`, \`/api/counties/:id/subcounties\`, \`/api/subcounties/:id/parishes\` — children of a unit
- \`GET /api/units/:id\` — a single unit with its ancestors and children
- \`GET /api/units?level=village&districtId=...&subcountyName=...&parishName=...\` — villages, matched by name (villages have no stable id)
- \`GET /api/search?q=...\` — name/alias search across all loaded levels
- \`GET /api/units/export\` — bulk export
- \`GET /api/geo/districts\`, \`/api/geo/regions\`, \`/api/geo/subcounties\`, \`/api/geo/parishes\`, \`/api/geo/roads\` — GeoJSON boundaries

## Code

- [npm package](https://www.npmjs.com/package/uganda-locale) — \`npm install uganda-locale\` (or \`npm install github:kakandemanwell/uganda\` for unreleased master)
- [Source on GitHub](https://github.com/kakandemanwell/uganda)
- [Data license](https://github.com/kakandemanwell/uganda/blob/master/LICENSE-DATA.md) (CC BY 4.0, roads ODbL)
`;

  return new Response(body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
