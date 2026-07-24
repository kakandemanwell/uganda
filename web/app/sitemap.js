import * as uganda from "@/lib/uganda-data.mjs";
import { SITE_URL } from "@/lib/site";

// Down through subcounty — county, subcounty, town council, and division all
// have a stable unit id and a real /unit/[id] page, same as region/district.
// Parish, ward, and cell are deliberately left out here even though they too
// have real unit pages: at 10,000+ parishes alone, listing every one blows
// past what a sitemap should reasonably prioritize for a data project this
// size (and loading every level at once during static generation is what
// was OOM-ing the build). They're still fully crawlable via the children
// links on each district/county/subcounty page — a sitemap just isn't the
// right discovery mechanism for that tier. Villages are excluded outright:
// per web/lib/villages.mjs they have no stable admin-unit id (matched by
// name within a parish instead), so there's no canonical URL for them at all.
export default function sitemap() {
  const units = [
    ...uganda.regions(),
    ...uganda.subregions(),
    ...uganda.districts(),
    ...uganda.cities(),
    ...uganda.counties(),
    ...uganda.subcounties(),
  ];

  const staticRoutes = ["", "/explore", "/map", "/data"].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.7,
  }));

  const unitRoutes = units.map((unit) => ({
    url: `${SITE_URL}/unit/${encodeURIComponent(unit.id)}`,
    changeFrequency: "yearly",
    priority: unit.level === "region" || unit.level === "district" ? 0.6 : 0.3,
  }));

  return [...staticRoutes, ...unitRoutes];
}
