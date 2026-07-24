import * as uganda from "@/lib/uganda-data.mjs";
import { MapExplorer } from "@/components/map-explorer";

const TITLE = "Map";
const DESCRIPTION = "Zoom into any Ugandan district for its counties, subcounties, parishes, villages, and roads.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/map" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/map" },
  twitter: { title: TITLE, description: DESCRIPTION },
};

export default async function MapPage({ searchParams }) {
  const { focus } = await searchParams;
  const regions = uganda.regions();
  const subregions = uganda.subregions();
  const districts = uganda.districts();

  return <MapExplorer regions={regions} subregions={subregions} districts={districts} initialFocus={focus} />;
}
