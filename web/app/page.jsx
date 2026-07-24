import * as uganda from "@/lib/uganda-data.mjs";
import { HomeClient } from "@/components/home-client";
import { SITE_URL } from "@/lib/site";
import { describeUnit } from "@/lib/unit-meta";

// A shared /?district=<id> link should unfurl (Slack/WhatsApp/Twitter/etc.)
// with that district's own title, description, and OG image — the same ones
// /unit/[id] already has — rather than the generic homepage card. Canonical
// still points at the dedicated /unit/[id] page: the query-param view and
// the unit page describe the same entity, and /unit/[id] is the one meant
// to be indexed.
export async function generateMetadata({ searchParams }) {
  const { district } = await searchParams;
  const unit = district ? uganda.getUnit(district) : null;
  if (!unit) return { alternates: { canonical: "/" } };

  const description = describeUnit(unit);
  const unitUrl = `/unit/${encodeURIComponent(unit.id)}`;
  // Hardcoded rather than relying on the root layout's title template: on
  // this exact route (the "/" segment itself) Next 15.5.20 doesn't apply
  // it to a generateMetadata-returned title, even though the identical
  // shape works correctly on /unit/[id].
  return {
    title: `${unit.name} — uganda-locale`,
    description,
    alternates: { canonical: unitUrl },
    openGraph: {
      title: unit.name,
      description,
      url: `/?district=${encodeURIComponent(unit.id)}`,
      images: [`${unitUrl}/opengraph-image`],
    },
    twitter: { title: unit.name, description, images: [`${unitUrl}/opengraph-image`] },
  };
}

export default async function Home({ searchParams }) {
  const { district } = await searchParams;
  // Resolved generically (not just against `districts`) so a shared link to
  // a city selected via search still restores on reload.
  const initialUnit = district ? (uganda.getUnit(district) ?? null) : null;
  const regions = uganda.regions();
  const subregions = uganda.subregions();
  const districts = uganda.districts();
  const cities = uganda.cities();
  const totals = uganda.dataQualityReport().totals;
  const country = uganda.country();

  const regionsById = Object.fromEntries(regions.map((r) => [r.id, r]));
  const subregionsById = Object.fromEntries(subregions.map((s) => [s.id, s]));
  const totalPopulation = [...districts, ...cities].reduce((sum, u) => sum + (u.population?.total ?? 0), 0);

  const datasetJsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "uganda-locale",
    description:
      "Uganda's administrative units — region, sub-region, district, county, subcounty, parish, village — plus boundaries, roads, and 2024 census population.",
    url: SITE_URL,
    license: "https://creativecommons.org/licenses/by/4.0/",
    creator: {
      "@type": "Person",
      name: "Manwell Kakande",
      url: "https://github.com/kakandemanwell",
    },
    spatialCoverage: {
      "@type": "Place",
      name: "Uganda",
      address: { "@type": "PostalAddress", addressCountry: "UG" },
    },
    temporalCoverage: "2024",
    variableMeasured: ["region", "sub-region", "district", "county", "subcounty", "parish", "village", "population"],
    distribution: [
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE_URL}/data/regions.json` },
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE_URL}/data/districts.json` },
      {
        "@type": "DataDownload",
        encodingFormat: "text/csv",
        contentUrl: `${SITE_URL}/data/uganda-locations-full.csv`,
      },
      {
        "@type": "DataDownload",
        encodingFormat: "application/geo+json",
        contentUrl: `${SITE_URL}/data/geo/districts.geojson`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }}
      />
      <HomeClient
        regions={regions}
        subregions={subregions}
        districts={districts}
        regionsById={regionsById}
        subregionsById={subregionsById}
        totals={totals}
        totalPopulation={totalPopulation}
        country={country}
        initialDistrict={initialUnit}
      />
    </>
  );
}
