import * as uganda from "uganda-locale";
import { MapExplorer } from "@/components/map-explorer";

export const metadata = {
  title: "Map — uganda-locale",
  description: "Zoom into any Ugandan district for its counties, subcounties, parishes, villages, and roads.",
};

export default async function MapPage({ searchParams }) {
  const { focus } = await searchParams;
  const regions = uganda.regions();
  const subregions = uganda.subregions();
  const districts = uganda.districts();

  return <MapExplorer regions={regions} subregions={subregions} districts={districts} initialFocus={focus} />;
}
