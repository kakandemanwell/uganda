import * as uganda from "@/lib/uganda-data.mjs";
import { ExploreClient } from "@/components/explore-client";

const TITLE = "Explore the dataset";
const DESCRIPTION = "Browse, filter, group, and download every level of Uganda's administrative hierarchy — region, sub-region, district, county, subcounty, parish, and village.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/explore" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/explore" },
  twitter: { title: TITLE, description: DESCRIPTION },
};

export default async function ExplorePage({ searchParams }) {
  const params = await searchParams;
  const regions = uganda.regions();
  const subregions = uganda.subregions();
  // Cities are district-equivalents (their divisions/wards/cells hang off
  // the city, not a district), so they belong in the same filter dropdown.
  const districts = [...uganda.districts(), ...uganda.cities()].sort((a, b) => a.name.localeCompare(b.name));

  return <ExploreClient regions={regions} subregions={subregions} districts={districts} initialParams={params} />;
}
