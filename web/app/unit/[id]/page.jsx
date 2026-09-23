import Link from "next/link";
import { notFound } from "next/navigation";
import * as uganda from "@/lib/uganda-data.mjs";
import { villagesOfParish } from "@/lib/villages.mjs";
import { lineageIds } from "@/lib/units.mjs";
import { FILTERS_FOR_LEVEL, FILTER_PARAM, pluralize } from "@/lib/explore-config";
import { SITE_URL } from "@/lib/site";
import { LEVEL_LABEL, describeUnit } from "@/lib/unit-meta";
import { ChevronRight, Download } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatExact, formatPercent } from "@/lib/format";

// Same lazy-load-on-first-use situation as the API route (see
// app/api/units/[id]/route.js) — force parish/ward and cell into the
// shared index so getAncestors/getChildren see the full hierarchy
// regardless of which page loads first in this server process.
uganda.parishes();
uganda.cells();

// /explore's ?level= only understands the 8 levels /api/units serves
// (region/subregion/district/city/county/subcounty/parish/village) — map
// town_council/division onto "subcounty" and ward onto "parish" the same
// way that API already groups them. Cell has no /explore equivalent at
// all (deepest, rarest level) — omit the link for it.
const LEVEL_LABEL_PLURAL = {
  county: "Counties",
  city: "Cities",
  municipality: "Municipalities",
  subcounty: "Subcounties",
  parish: "Parishes",
};
function pluralLabel(level) {
  return LEVEL_LABEL_PLURAL[level] ?? `${LEVEL_LABEL[level] ?? level}s`;
}

const EXPLORE_LEVEL = {
  region: "region",
  subregion: "subregion",
  district: "district",
  city: "city",
  county: "county",
  subcounty: "subcounty",
  town_council: "subcounty",
  division: "subcounty",
  parish: "parish",
  ward: "parish",
};

const PARISH_LEVELS = new Set(["parish", "ward"]);

// The /explore view one level down from this unit, pre-filtered to it — so
// "show me everything under X" is filterable, groupable and exportable, not
// just the flat list on this page. Cities have no counties, so they skip
// straight to their divisions.
const EXPLORE_CHILD_LEVEL = {
  region: "district",
  subregion: "district",
  district: "county",
  city: "subcounty",
  county: "subcounty",
  subcounty: "parish",
  town_council: "parish",
  division: "parish",
  parish: "village",
  ward: "village",
};

/** /explore?level=...&districtId=...&..., carrying only the filters that level understands. */
function exploreHref(unit, level, extra = {}) {
  const ids = {
    ...lineageIds(unit.id),
    regionId: unit.level === "region" ? unit.id : null,
    subregionId: unit.level === "subregion" ? unit.id : null,
  };
  const params = new URLSearchParams({ level });
  for (const key of FILTERS_FOR_LEVEL[level]) {
    const id = ids[FILTER_PARAM[key]];
    if (id) params.set(FILTER_PARAM[key], id);
  }
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  return `/explore?${params}`;
}

const SCHEMA_TYPE = {
  region: "AdministrativeArea",
  subregion: "AdministrativeArea",
  district: "AdministrativeArea",
  city: "City",
  county: "AdministrativeArea",
  municipality: "AdministrativeArea",
  subcounty: "AdministrativeArea",
  town_council: "AdministrativeArea",
  division: "AdministrativeArea",
  parish: "AdministrativeArea",
  ward: "AdministrativeArea",
  cell: "AdministrativeArea",
};

export async function generateMetadata({ params }) {
  const { id } = await params;
  const unit = uganda.getUnit(decodeURIComponent(id));
  if (!unit) return { title: "Not found" };

  const description = describeUnit(unit);
  const url = `/unit/${encodeURIComponent(unit.id)}`;

  return {
    title: unit.name,
    description,
    alternates: { canonical: url },
    openGraph: { title: unit.name, description, url },
    twitter: { title: unit.name, description },
  };
}

export default async function UnitPage({ params }) {
  const { id } = await params;
  const unit = uganda.getUnit(decodeURIComponent(id));
  if (!unit) notFound();

  const ancestors = uganda.getAncestors(unit.id).reverse(); // region-first, matching reading order
  const children = uganda.getChildren(unit.id);
  const region = unit.region_id ? uganda.getUnit(unit.region_id) : null;
  const subregion = unit.subregion_id ? uganda.getUnit(unit.subregion_id) : null;
  const pop = unit.population;
  const malePct = pop ? pop.male / pop.total : 0;

  const breadcrumb = [...ancestors, unit];
  const parent = unit.parent_id ? uganda.getUnit(unit.parent_id) : null;

  // Villages aren't units in the index (see lib/villages.mjs), so a parish's
  // getChildren() is empty — they come from the village CSV instead, by
  // parish_id. A ward's cells *are* units (with their own pages), and also
  // appear in that CSV, so link the ones that match a cell child by name.
  const isParish = PARISH_LEVELS.has(unit.level);
  const villages = isParish ? villagesOfParish(unit.id) : [];
  const cellsByName = new Map();
  for (const child of children) {
    if (!cellsByName.has(child.name)) cellsByName.set(child.name, []);
    cellsByName.get(child.name).push(child);
  }
  const villageEntries = villages
    .map((v) => ({ name: v.village, cell: cellsByName.get(v.village)?.shift() ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const cellCount = villageEntries.filter((v) => v.cell).length;
  const villageNoun = cellCount === 0 ? ["village", "villages"] : cellCount === villageEntries.length ? ["cell", "cells"] : ["village or cell", "villages & cells"];
  const childVillageCounts = children.some((c) => PARISH_LEVELS.has(c.level))
    ? new Map(children.map((c) => [c.id, villagesOfParish(c.id).length]))
    : null;
  const childExploreLevel = EXPLORE_CHILD_LEVEL[unit.level];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": SCHEMA_TYPE[unit.level] ?? "AdministrativeArea",
    name: unit.name,
    url: `${SITE_URL}/unit/${encodeURIComponent(unit.id)}`,
    containedInPlace: parent
      ? { "@type": "AdministrativeArea", name: parent.name, url: `${SITE_URL}/unit/${encodeURIComponent(parent.id)}` }
      : { "@type": "Country", name: "Uganda" },
    address: { "@type": "PostalAddress", addressCountry: "UG" },
    ...(pop && {
      additionalProperty: [
        { "@type": "PropertyValue", name: "population (2024 census)", value: pop.total },
        { "@type": "PropertyValue", name: "population (male)", value: pop.male },
        { "@type": "PropertyValue", name: "population (female)", value: pop.female },
      ],
    }),
  };

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {breadcrumb.map((a, i) => (
            <span key={a.id} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3" />}
              {a.id === unit.id ? (
                <span className="text-foreground">{a.name}</span>
              ) : (
                <Link href={`/unit/${encodeURIComponent(a.id)}`} className="hover:text-foreground hover:underline">
                  {a.name}
                </Link>
              )}
            </span>
          ))}
        </div>

        <Card className="py-5">
          <CardHeader className="px-5">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-2xl">{unit.name}</CardTitle>
              <Badge>{LEVEL_LABEL[unit.level] ?? unit.level}</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {region && <Badge variant="secondary">{region.name}</Badge>}
              {subregion && <Badge variant="outline">{subregion.name}</Badge>}
              <Badge variant="outline" className="font-mono text-[10px]">
                {unit.confidence}
              </Badge>
            </div>
            {unit.notes && <CardDescription className="pt-2">{unit.notes}</CardDescription>}
          </CardHeader>
          <CardContent className="px-5">
            {pop && (
              <>
                <div className="text-sm text-muted-foreground">2024 census population</div>
                <div className="font-mono-tabular mt-1 text-3xl font-semibold tracking-tight">
                  {formatExact(pop.total)}
                </div>
                <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: formatPercent(malePct, 2) }} />
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>Male · {formatExact(pop.male)} ({formatPercent(malePct)})</span>
                  <span>Female · {formatExact(pop.female)} ({formatPercent(1 - malePct)})</span>
                </div>
                <Separator className="my-4" />
              </>
            )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
              <Field label="ID" value={<span className="font-mono text-xs">{unit.id}</span>} />
              <Field label="Status" value={unit.status} />
              {unit.effective_date && <Field label="Effective date" value={unit.effective_date} />}
              {isParish && <Field label={villageNoun[1][0].toUpperCase() + villageNoun[1].slice(1)} value={formatExact(villages.length)} />}
            </div>
            {unit.level === "district" && (
              <p className="mt-4 text-xs text-muted-foreground">
                <Link href={`/map?focus=${encodeURIComponent(unit.id)}`} className="underline underline-offset-2 hover:text-foreground">
                  View this district on the map →
                </Link>
              </p>
            )}
          </CardContent>
        </Card>

        {villageEntries.length > 0 && (
          <Card className="py-5">
            <CardHeader className="px-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-1.5">
                  <CardTitle className="text-lg">
                    {formatExact(villageEntries.length)} {villageEntries.length === 1 ? villageNoun[0] : villageNoun[1]}
                  </CardTitle>
                  <CardDescription>
                    Every {villageNoun[0]} in this {LEVEL_LABEL[unit.level]?.toLowerCase()}, from the EC&apos;s 2022 gazetteer.
                  </CardDescription>
                </div>
                <a
                  href={`/api/units/export?level=village&parishId=${encodeURIComponent(unit.id)}&format=csv`}
                  download
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted"
                >
                  <Download className="size-3.5" />
                  CSV
                </a>
              </div>
            </CardHeader>
            <CardContent className="px-5">
              <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {villageEntries.map((v, i) =>
                  v.cell ? (
                    <li key={v.cell.id}>
                      <Link
                        href={`/unit/${encodeURIComponent(v.cell.id)}`}
                        className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        <span>{v.name}</span>
                        <ChevronRight className="size-3.5 text-muted-foreground" />
                      </Link>
                    </li>
                  ) : (
                    <li key={`${v.name}-${i}`} className="px-2 py-1.5 text-sm">
                      {v.name}
                    </li>
                  )
                )}
              </ul>
            </CardContent>
          </Card>
        )}

        {children.length > 0 && villageEntries.length === 0 && (
          <Card className="py-5">
            <CardHeader className="px-5">
              <CardTitle className="text-lg">
                {children.length} direct {children.length === 1 ? "child unit" : "child units"}
              </CardTitle>
              <CardDescription>
                {pluralLabel(children[0].level)}
                {new Set(children.map((c) => c.level)).size > 1 ? " (mixed)" : ""} under {unit.name}.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5">
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {children
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((child) => (
                    <Link
                      key={child.id}
                      href={`/unit/${encodeURIComponent(child.id)}`}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <span>{child.name}</span>
                      <span className="flex items-center gap-2">
                        {childVillageCounts && (
                          <span className="text-xs text-muted-foreground">
                            {formatExact(childVillageCounts.get(child.id))} {pluralize("village", childVillageCounts.get(child.id))}
                          </span>
                        )}
                        <ChevronRight className="size-3.5 text-muted-foreground" />
                      </span>
                    </Link>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {childExploreLevel && (
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <Link href={exploreHref(unit, childExploreLevel)} className="underline underline-offset-2 hover:text-foreground">
              Filter, search or download the {pluralize(childExploreLevel, 2)} in {unit.name} →
            </Link>
            {["subcounty", "parish"].includes(childExploreLevel) && (
              <Link
                href={exploreHref(unit, "village", { groupBy: "parish" })}
                className="underline underline-offset-2 hover:text-foreground"
              >
                All villages in {unit.name}, grouped by parish →
              </Link>
            )}
            {["county", "subcounty"].includes(childExploreLevel) && (
              <Link
                href={exploreHref(unit, "parish", { groupBy: "subcounty" })}
                className="underline underline-offset-2 hover:text-foreground"
              >
                All parishes in {unit.name}, grouped by subcounty →
              </Link>
            )}
          </div>
        )}

        {EXPLORE_LEVEL[unit.level] && (
          <p className="text-xs text-muted-foreground">
            Looking for something broader?{" "}
            <Link
              href={`/explore?level=${EXPLORE_LEVEL[unit.level]}`}
              className="underline underline-offset-2 hover:text-foreground"
            >
              Browse all {LEVEL_LABEL[unit.level]?.toLowerCase() ?? unit.level}-level records →
            </Link>
          </p>
        )}
      </main>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
