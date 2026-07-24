import * as uganda from "@/lib/uganda-data.mjs";
import { ExploreClient } from "@/components/explore-client";

const TITLE = "Explore the dataset";
const DESCRIPTION = "Browse, filter, and download every level of Uganda's administrative hierarchy — region, sub-region, district, county, subcounty, parish, and village.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/explore" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/explore" },
  twitter: { title: TITLE, description: DESCRIPTION },
};

export default async function ExplorePage({ searchParams }) {
  const { level } = await searchParams;
  const regions = uganda.regions();
  const subregions = uganda.subregions();
  const districts = uganda.districts();

  return <ExploreClient regions={regions} subregions={subregions} districts={districts} initialLevel={level} />;
}
