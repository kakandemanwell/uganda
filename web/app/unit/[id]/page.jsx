import Link from "next/link";
import { notFound } from "next/navigation";
import * as uganda from "@/lib/uganda-data.mjs";
import { ChevronRight } from "lucide-react";
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

const LEVEL_LABEL = {
  region: "Region",
  subregion: "Sub-region",
  district: "District",
  city: "City",
  county: "County",
  municipality: "Municipality",
  subcounty: "Subcounty",
  town_council: "Town council",
  division: "Division",
  parish: "Parish",
  ward: "Ward",
  cell: "Cell",
};

// /explore's ?level= only understands the 8 levels /api/units serves
// (region/subregion/district/city/county/subcounty/parish/village) — map
// town_council/division onto "subcounty" and ward onto "parish" the same
// way that API already groups them. Cell has no /explore equivalent at
// all (deepest, rarest level) — omit the link for it.
const LEVEL_LABEL_PLURAL = {
  county: "Counties",
  city: "Cities",
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

export async function generateMetadata({ params }) {
  const { id } = await params;
  const unit = uganda.getUnit(decodeURIComponent(id));
  return { title: unit ? `${unit.name} — uganda-locale` : "Not found — uganda-locale" };
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

  return (
    <div className="min-h-screen bg-background">
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

        {children.length > 0 && (
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
                      <ChevronRight className="size-3.5 text-muted-foreground" />
                    </Link>
                  ))}
              </div>
            </CardContent>
          </Card>
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
