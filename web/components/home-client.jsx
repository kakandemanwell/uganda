"use client";

import { useState } from "react";
import { Landmark, Layers, MapPin, Building2, Users, Home as HomeIcon } from "lucide-react";
import { GithubIcon } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { StatCard } from "@/components/stat-card";
import { UgandaMap } from "@/components/uganda-map";
import { DistrictDetailPanel } from "@/components/district-detail-panel";
import { HierarchyExplorer } from "@/components/hierarchy-explorer";
import { CoverageSection } from "@/components/coverage-section";
import { ApiReference } from "@/components/api-reference";
import { Button } from "@/components/ui/button";
import { formatCompact, formatExact } from "@/lib/format";

export function HomeClient({ regions, subregions, districts, regionsById, subregionsById, totals, totalPopulation }) {
  const [selectedDistrict, setSelectedDistrict] = useState(null);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader onSelectDistrict={setSelectedDistrict} />

      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-12 sm:px-6 sm:py-16">
        {/* Hero */}
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Uganda&apos;s administrative data,
              <span className="text-primary"> mapped and cited.</span>
            </h1>
            <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
              Region → sub-region → district → county → subcounty → parish → village, plus
              boundaries, roads, and 2024 census population — every record sourced, every gap
              documented.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              nativeButton={false}
              render={
                <a href="https://github.com/kakandemanwell/uganda" target="_blank" rel="noreferrer">
                  <GithubIcon className="size-4" />
                  View on GitHub
                </a>
              }
            />
            <code className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
              npm install github:kakandemanwell/uganda
            </code>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard icon={Landmark} label="Regions" value={totals.regions} />
          <StatCard icon={Layers} label="Sub-regions" value={totals.subregions} />
          <StatCard icon={MapPin} label="Districts" value={totals.districts} />
          <StatCard icon={Building2} label="Cities" value={totals.cities} />
          <StatCard icon={Users} label="Population" value={formatCompact(totalPopulation)} hint="2024 census" />
          <StatCard icon={HomeIcon} label="Villages" value={formatCompact(totals.villages)} />
        </section>

        {/* Map + detail */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Every district, on the map</h2>
            <p className="text-sm text-muted-foreground">
              Click a district to see its details. Colors reflect 2024 census population by
              default — toggle to see administrative regions instead.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
            <UgandaMap
              regionsById={regionsById}
              subregionsById={subregionsById}
              selectedId={selectedDistrict?.id}
              onSelect={setSelectedDistrict}
            />
            <DistrictDetailPanel district={selectedDistrict} regionsById={regionsById} subregionsById={subregionsById} />
          </div>
        </section>

        {/* Hierarchy explorer */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <HierarchyExplorer
            regions={regions}
            subregions={subregions}
            districts={districts}
            selectedDistrictId={selectedDistrict?.id}
            onSelectDistrict={setSelectedDistrict}
          />
          <CoverageSection />
        </section>

        {/* API reference */}
        <section>
          <ApiReference />
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:px-6">
          <p>
            Data licensed CC BY 4.0 (roads layer ODbL) — see{" "}
            <a
              href="https://github.com/kakandemanwell/uganda/blob/master/LICENSE-DATA.md"
              className="underline underline-offset-2 hover:text-foreground"
              target="_blank"
              rel="noreferrer"
            >
              LICENSE-DATA.md
            </a>{" "}
            for full attribution. Compiled from UBOS, the Electoral Commission of Uganda,
            geoBoundaries, OCHA/HDX, and OpenStreetMap.
          </p>
          <p>{formatExact(totals.parishes)} parishes/wards · {formatExact(totals.subcounties)} subcounties · {formatExact(totals.counties)} counties, all verified.</p>
        </div>
      </footer>
    </div>
  );
}
