import * as uganda from "uganda-locale";
import { HomeClient } from "@/components/home-client";

export default function Home() {
  const regions = uganda.regions();
  const subregions = uganda.subregions();
  const districts = uganda.districts();
  const cities = uganda.cities();
  const totals = uganda.dataQualityReport().totals;

  const regionsById = Object.fromEntries(regions.map((r) => [r.id, r]));
  const subregionsById = Object.fromEntries(subregions.map((s) => [s.id, s]));
  const totalPopulation = [...districts, ...cities].reduce((sum, u) => sum + (u.population?.total ?? 0), 0);

  return (
    <HomeClient
      regions={regions}
      subregions={subregions}
      districts={districts}
      regionsById={regionsById}
      subregionsById={subregionsById}
      totals={totals}
      totalPopulation={totalPopulation}
    />
  );
}
