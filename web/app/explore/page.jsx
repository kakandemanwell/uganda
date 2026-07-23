import * as uganda from "@/lib/uganda-data.mjs";
import { ExploreClient } from "@/components/explore-client";

export const metadata = {
  title: "Explore the dataset — uganda-locale",
  description: "Browse, filter, and download every level of Uganda's administrative hierarchy.",
};

export default async function ExplorePage({ searchParams }) {
  const { level } = await searchParams;
  const regions = uganda.regions();
  const subregions = uganda.subregions();
  const districts = uganda.districts();

  return <ExploreClient regions={regions} subregions={subregions} districts={districts} initialLevel={level} />;
}
