"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatExact } from "@/lib/format";

const ALL = "all";
const PAGE_SIZE = 25;

const LEVELS = [
  { value: "region", label: "Regions" },
  { value: "subregion", label: "Sub-regions" },
  { value: "district", label: "Districts" },
  { value: "city", label: "Cities" },
  { value: "county", label: "Counties" },
  { value: "subcounty", label: "Subcounties" },
  { value: "parish", label: "Parishes" },
  { value: "village", label: "Villages" },
];

// Which filters make sense at each level — a region can't be "in" a
// district, but a village can be narrowed by region/sub-region/district all
// at once.
const FILTERS_FOR_LEVEL = {
  region: [],
  subregion: ["region"],
  district: ["region", "subregion"],
  city: ["region", "subregion"],
  county: ["region", "subregion", "district"],
  subcounty: ["region", "subregion", "district"],
  parish: ["region", "subregion", "district"],
  village: ["region", "subregion", "district"],
};

const TYPE_LABEL = {
  subcounty: "Subcounty",
  town_council: "Town council",
  division: "Division",
  parish: "Parish",
  ward: "Ward",
};

function buildQuery({ level, regionId, subregionId, districtId, q, page, pageSize }) {
  const params = new URLSearchParams({ level });
  if (regionId && regionId !== ALL) params.set("regionId", regionId);
  if (subregionId && subregionId !== ALL) params.set("subregionId", subregionId);
  if (districtId && districtId !== ALL) params.set("districtId", districtId);
  if (q) params.set("q", q);
  if (page) params.set("page", page);
  if (pageSize) params.set("pageSize", pageSize);
  return params.toString();
}

export function ExploreClient({ regions, subregions, districts, initialLevel }) {
  const router = useRouter();
  const [level, setLevel] = useState(initialLevel && LEVELS.some((l) => l.value === initialLevel) ? initialLevel : "district");
  const [regionId, setRegionId] = useState(ALL);
  const [subregionId, setSubregionId] = useState(ALL);
  const [districtId, setDistrictId] = useState(ALL);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Any filter/level/search change starts back at page 1.
  useEffect(() => setPage(1), [level, regionId, subregionId, districtId, q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query = buildQuery({ level, regionId, subregionId, districtId, q, page, pageSize: PAGE_SIZE });
    fetch(`/api/units?${query}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [level, regionId, subregionId, districtId, q, page]);

  const activeFilters = FILTERS_FOR_LEVEL[level] ?? [];
  const filteredDistricts = useMemo(
    () => districts.filter((d) => regionId === ALL || d.region_id === regionId).filter((d) => subregionId === ALL || d.subregion_id === subregionId),
    [districts, regionId, subregionId]
  );
  const regionsMap = useMemo(() => Object.fromEntries(regions.map((r) => [r.id, r])), [regions]);
  const subregionsMap = useMemo(() => Object.fromEntries(subregions.map((s) => [s.id, s])), [subregions]);

  const exportQuery = buildQuery({ level, regionId, subregionId, districtId, q });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const columns = COLUMNS[level];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Explore the dataset</h1>
          <p className="text-sm text-muted-foreground">
            Every level of Uganda&apos;s administrative hierarchy, filterable and downloadable.
          </p>
        </div>

        <Tabs value={level} onValueChange={setLevel}>
          <TabsList className="flex-wrap">
            {LEVELS.map((l) => (
              <TabsTrigger key={l.value} value={l.value}>
                {l.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Card className="py-5">
          <CardContent className="flex flex-col gap-4 px-5">
            <div className="flex flex-wrap items-end gap-3">
              {activeFilters.includes("region") && (
                <FilterSelect label="Region" value={regionId} onValueChange={(v) => { setRegionId(v); setDistrictId(ALL); }} options={regions} />
              )}
              {activeFilters.includes("subregion") && (
                <FilterSelect label="Sub-region" value={subregionId} onValueChange={(v) => { setSubregionId(v); setDistrictId(ALL); }} options={subregions} />
              )}
              {activeFilters.includes("district") && (
                <FilterSelect label="District" value={districtId} onValueChange={setDistrictId} options={filteredDistricts} />
              )}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Search</Label>
                <div className="relative">
                  <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Name…"
                    className="h-9 w-48 pl-8"
                  />
                </div>
              </div>
              <div className="flex-1" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" nativeButton={false} render={<a href={`/api/units/export?${exportQuery}&format=csv`} download><Download className="size-3.5" />CSV</a>} />
                <Button variant="outline" size="sm" nativeButton={false} render={<a href={`/api/units/export?${exportQuery}&format=json`} download><Download className="size-3.5" />JSON</a>} />
              </div>
            </div>

            {loading && !data ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : data && data.items.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No {level} records match these filters.
              </div>
            ) : (
              <div className={loading ? "opacity-50 transition-opacity" : "transition-opacity"}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((c) => (
                        <TableHead key={c.key}>{c.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.items.map((row) => (
                      <UnitRow
                        key={row.id ?? `${row.village}-${row.parish}`}
                        row={row}
                        columns={columns}
                        level={level}
                        regionsById={regionsMap}
                        subregionsById={subregionsMap}
                        onNavigate={(id) => router.push(`/unit/${encodeURIComponent(id)}`)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {data && (
              <div className="flex items-center justify-between border-t border-border pt-3 text-sm text-muted-foreground">
                <span>
                  Showing {data.items.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{(page - 1) * PAGE_SIZE + data.items.length} of{" "}
                  {formatExact(data.total)}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  <span className="font-mono-tabular text-xs">
                    {page} / {totalPages}
                  </span>
                  <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Prefer whole files? See the static downloads at{" "}
          <a href="/data" className="underline underline-offset-2 hover:text-foreground">
            /data
          </a>{" "}
          — every per-level export, the full village CSV, and boundary GeoJSON, no filtering required.
        </p>
      </main>
    </div>
  );
}

function FilterSelect({ label, value, onValueChange, options }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-9 w-44">
          <SelectValue>{(v) => (v === ALL ? `All ${label.toLowerCase()}s` : options.find((o) => o.id === v)?.name ?? v)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All {label.toLowerCase()}s</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const COLUMNS = {
  region: [
    { key: "name", label: "Name" },
    { key: "slug", label: "Slug" },
    { key: "status", label: "Status" },
  ],
  subregion: [
    { key: "name", label: "Name" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" },
  ],
  district: [
    { key: "name", label: "Name" },
    { key: "region", label: "Region" },
    { key: "subregion", label: "Sub-region" },
    { key: "population", label: "Population (2024)" },
    { key: "status", label: "Status" },
  ],
  city: [
    { key: "name", label: "Name" },
    { key: "region", label: "Region" },
    { key: "subregion", label: "Sub-region" },
    { key: "population", label: "Population (2024)" },
    { key: "status", label: "Status" },
  ],
  county: [
    { key: "name", label: "Name" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" },
  ],
  subcounty: [
    { key: "name", label: "Name" },
    { key: "type", label: "Type" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" },
  ],
  parish: [
    { key: "name", label: "Name" },
    { key: "type", label: "Type" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" },
  ],
  village: [
    { key: "village", label: "Village" },
    { key: "district", label: "District" },
    { key: "subcounty", label: "Subcounty" },
    { key: "parish", label: "Parish" },
    { key: "confidence", label: "Confidence" },
  ],
};

function UnitRow({ row, columns, level, regionsById, subregionsById, onNavigate }) {
  const isVillage = level === "village";
  const content = columns.map((c) => {
    switch (c.key) {
      case "region":
        return regionsById[row.region_id]?.name ?? "—";
      case "subregion":
        return subregionsById[row.subregion_id]?.name ?? "—";
      case "population":
        return row.population ? formatExact(row.population.total) : "—";
      case "type":
        return TYPE_LABEL[row.level] ?? row.level;
      default:
        return row[c.key] ?? "—";
    }
  });

  const cells = columns.map((c, i) => (
    <TableCell key={c.key} className={c.key === "population" ? "font-mono-tabular" : ""}>
      {content[i]}
    </TableCell>
  ));

  if (isVillage) {
    // No stable id in the village CSV — see web/lib/villages.mjs — so
    // there's no /unit/[id] page to link to; rows are informational only.
    return <TableRow>{cells}</TableRow>;
  }

  return (
    <TableRow className="cursor-pointer" onClick={() => onNavigate(row.id)}>
      {cells}
    </TableRow>
  );
}
