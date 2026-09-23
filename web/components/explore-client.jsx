"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Download, ChevronLeft, ChevronRight, X } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatExact } from "@/lib/format";
import { FILTERS_FOR_LEVEL, GROUP_BY_FOR_LEVEL, FILTER_PARAM, NOUN, pluralize } from "@/lib/explore-config";

const ALL = "all";
const NONE = "none";
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

// Top-down; changing one filter clears every filter after it, since a
// subcounty picked under one district means nothing under another.
const FILTER_KEYS = ["region", "subregion", "district", "county", "subcounty", "parish"];

const FILTER_LABEL = {
  region: { label: "Region", all: "All regions" },
  subregion: { label: "Sub-region", all: "All sub-regions" },
  district: { label: "District", all: "All districts & cities" },
  county: { label: "County", all: "All counties", needs: "Select a district", empty: "No counties here" },
  subcounty: { label: "Subcounty", all: "All subcounties", needs: "Select a district", empty: "No subcounties here" },
  parish: { label: "Parish / ward", all: "All parishes", needs: "Select a subcounty", empty: "No parishes here" },
};

const GROUP_LABEL = {
  region: "Region",
  subregion: "Sub-region",
  district: "District",
  county: "County",
  subcounty: "Subcounty",
  parish: "Parish",
};

const TYPE_LABEL = {
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
};

function initialState(params = {}) {
  const level = LEVELS.some((l) => l.value === params.level) ? params.level : "district";
  return {
    level,
    filters: Object.fromEntries(FILTER_KEYS.map((k) => [k, params[FILTER_PARAM[k]] || ALL])),
    q: (params.q || "").trim(),
    page: Math.max(1, Number(params.page) || 1),
    groupBy: GROUP_BY_FOR_LEVEL[level].includes(params.groupBy) ? params.groupBy : NONE,
  };
}

/** Only the filters that apply at this level go out — a district picked on the Villages tab must not silently empty the Regions tab. */
function buildParams({ level, filters, q, groupBy, page }, { withPage = true, withGroup = true } = {}) {
  const params = new URLSearchParams({ level });
  for (const key of FILTERS_FOR_LEVEL[level]) {
    if (filters[key] !== ALL) params.set(FILTER_PARAM[key], filters[key]);
  }
  if (q) params.set("q", q);
  if (withGroup && groupBy !== NONE) params.set("groupBy", groupBy);
  if (withPage && page > 1) params.set("page", String(page));
  return params;
}

const optionsCache = new Map();

/** Child-unit options for the county/subcounty/parish dropdowns, which depend on what's picked above them. */
function useOptions(url) {
  const [state, setState] = useState({ url: null, items: [] });
  useEffect(() => {
    if (!url) return;
    if (optionsCache.has(url)) {
      setState({ url, items: optionsCache.get(url) });
      return;
    }
    let cancelled = false;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        const items = (d.items ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
        optionsCache.set(url, items);
        if (!cancelled) setState({ url, items });
      })
      .catch(() => {
        if (!cancelled) setState({ url, items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  if (!url) return { items: [], loading: false };
  return state.url === url ? { items: state.items, loading: false } : { items: [], loading: true };
}

export function ExploreClient({ regions, subregions, districts, initialParams }) {
  const router = useRouter();
  const [state, setState] = useState(() => initialState(initialParams));
  const [qInput, setQInput] = useState(state.q);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { level, filters, page, groupBy } = state;

  const activeFilters = FILTERS_FOR_LEVEL[level];
  const groupOptions = GROUP_BY_FOR_LEVEL[level];

  // Debounce typing so every keystroke doesn't refetch (and re-filter 71k villages).
  useEffect(() => {
    const t = setTimeout(() => {
      const q = qInput.trim();
      setState((s) => (s.q === q ? s : { ...s, q, page: 1 }));
    }, 250);
    return () => clearTimeout(t);
  }, [qInput]);

  const apiQuery = useMemo(() => {
    const params = buildParams(state);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    return params.toString();
  }, [state, page]);

  const urlQuery = useMemo(() => buildParams(state).toString(), [state]);
  const exportQuery = useMemo(() => buildParams(state, { withPage: false, withGroup: false }).toString(), [state]);

  // Keep the address bar in step so a filtered/grouped view can be shared
  // or bookmarked. replaceState, not router.replace — no server round-trip
  // needed just to rewrite the query string.
  useEffect(() => {
    window.history.replaceState(null, "", `/explore?${urlQuery}`);
  }, [urlQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/units?${apiQuery}`)
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
  }, [apiQuery]);

  const districtId = filters.district;
  const countyUrl =
    activeFilters.includes("county") && districtId !== ALL
      ? `/api/units?level=county&districtId=${encodeURIComponent(districtId)}&pageSize=500`
      : null;
  const subcountyUrl =
    activeFilters.includes("subcounty") && districtId !== ALL
      ? `/api/units?level=subcounty&districtId=${encodeURIComponent(districtId)}${
          filters.county !== ALL ? `&countyId=${encodeURIComponent(filters.county)}` : ""
        }&pageSize=500`
      : null;
  const parishUrl =
    activeFilters.includes("parish") && filters.subcounty !== ALL
      ? `/api/units?level=parish&subcountyId=${encodeURIComponent(filters.subcounty)}&pageSize=500`
      : null;
  const countyOptions = useOptions(countyUrl);
  const subcountyOptions = useOptions(subcountyUrl);
  const parishOptions = useOptions(parishUrl);

  const filteredSubregions = useMemo(
    () => subregions.filter((s) => filters.region === ALL || s.region_id === filters.region),
    [subregions, filters.region]
  );
  const filteredDistricts = useMemo(
    () =>
      districts
        .filter((d) => filters.region === ALL || d.region_id === filters.region)
        .filter((d) => filters.subregion === ALL || d.subregion_id === filters.subregion),
    [districts, filters.region, filters.subregion]
  );
  const regionsMap = useMemo(() => Object.fromEntries(regions.map((r) => [r.id, r])), [regions]);
  const subregionsMap = useMemo(() => Object.fromEntries(subregions.map((s) => [s.id, s])), [subregions]);

  const filterOptions = {
    region: { items: regions, loading: false, enabled: true },
    subregion: { items: filteredSubregions, loading: false, enabled: true },
    district: { items: filteredDistricts, loading: false, enabled: true },
    county: { ...countyOptions, enabled: Boolean(countyUrl) },
    subcounty: { ...subcountyOptions, enabled: Boolean(subcountyUrl) },
    parish: { ...parishOptions, enabled: Boolean(parishUrl) },
  };

  function setLevel(next) {
    setState((s) => ({
      ...s,
      level: next,
      page: 1,
      groupBy: GROUP_BY_FOR_LEVEL[next].includes(s.groupBy) ? s.groupBy : NONE,
    }));
  }

  function setFilter(key, value) {
    setState((s) => {
      const filters = { ...s.filters, [key]: value };
      for (const later of FILTER_KEYS.slice(FILTER_KEYS.indexOf(key) + 1)) filters[later] = ALL;
      return { ...s, filters, page: 1 };
    });
  }

  function resetFilters() {
    setQInput("");
    setState((s) => ({ ...s, filters: Object.fromEntries(FILTER_KEYS.map((k) => [k, ALL])), q: "", page: 1 }));
  }

  const hasActiveFilters = activeFilters.some((k) => filters[k] !== ALL) || state.q !== "";
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const columns = COLUMNS[level];
  const grouped = groupBy !== NONE && Array.isArray(data?.groups);

  const renderRow = (row) => (
    <UnitRow
      key={row.id ?? `${row.village}-${row.parish_id}`}
      row={row}
      columns={columns}
      level={level}
      regionsById={regionsMap}
      subregionsById={subregionsMap}
      onNavigate={(id) => router.push(`/unit/${encodeURIComponent(id)}`)}
    />
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Explore the dataset</h1>
          <p className="text-sm text-muted-foreground">
            Every level of Uganda&apos;s administrative hierarchy. Narrow down to a single parish, group by any parent level,
            and download what you see.
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
              {activeFilters.map((key) => (
                <FilterSelect
                  key={key}
                  {...FILTER_LABEL[key]}
                  value={filters[key]}
                  onValueChange={(v) => setFilter(key, v)}
                  {...filterOptions[key]}
                />
              ))}
              <div className="flex w-full flex-col gap-1.5 sm:w-auto">
                <Label htmlFor="explore-search" className="text-xs text-muted-foreground">
                  Search
                </Label>
                <div className="relative">
                  <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="explore-search"
                    type="search"
                    value={qInput}
                    onChange={(e) => setQInput(e.target.value)}
                    placeholder={`${NOUN[level][0][0].toUpperCase()}${NOUN[level][0].slice(1)} name…`}
                    className="h-9 w-full pl-8 sm:w-48"
                  />
                </div>
              </div>
              {groupOptions.length > 0 && (
                <div className="flex w-full flex-col gap-1.5 sm:w-auto">
                  <Label className="text-xs text-muted-foreground">Group by</Label>
                  <Select value={groupBy} onValueChange={(v) => setState((s) => ({ ...s, groupBy: v, page: 1 }))}>
                    <SelectTrigger className="h-9 w-full sm:w-36">
                      <SelectValue>{(v) => (v === NONE ? "No grouping" : GROUP_LABEL[v])}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No grouping</SelectItem>
                      {groupOptions.map((g) => (
                        <SelectItem key={g} value={g}>
                          {GROUP_LABEL[g]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-9" onClick={resetFilters}>
                  <X className="size-3.5" />
                  Clear
                </Button>
              )}
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
            ) : data && data.items?.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No {NOUN[level][1]} match these filters.</div>
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
                    {grouped
                      ? groupSlices(data).map(({ group, rows }) => (
                          <Fragment key={`${group.id ?? "none"}-${rows[0]?.id ?? ""}`}>
                            <GroupHeader group={group} groupBy={groupBy} level={level} colSpan={columns.length} />
                            {rows.map(renderRow)}
                          </Fragment>
                        ))
                      : data?.items?.map(renderRow)}
                  </TableBody>
                </Table>
              </div>
            )}

            {data?.items && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
                <span>
                  Showing {data.items.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{(page - 1) * PAGE_SIZE + data.items.length} of{" "}
                  {formatExact(data.total)} {pluralize(level, data.total)}
                  {grouped && data.groupCount > 0 && (
                    <>
                      {" "}
                      in {formatExact(data.groupCount)} {pluralize(groupBy, data.groupCount)}
                    </>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Previous page"
                    disabled={page <= 1}
                    onClick={() => setState((s) => ({ ...s, page: s.page - 1 }))}
                  >
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  <span className="font-mono-tabular text-xs">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Next page"
                    disabled={page >= totalPages}
                    onClick={() => setState((s) => ({ ...s, page: s.page + 1 }))}
                  >
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

/** Splits a page of items into the consecutive runs the API's `groups` describe. */
function groupSlices(data) {
  let offset = 0;
  return data.groups.map((group) => {
    const rows = data.items.slice(offset, offset + group.count);
    offset += group.count;
    return { group, rows };
  });
}

function GroupHeader({ group, groupBy, level, colSpan }) {
  return (
    <TableRow className="bg-muted/50 hover:bg-muted/50">
      <TableCell colSpan={colSpan} className="py-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <div className="flex flex-wrap items-baseline gap-x-2">
            {group.id ? (
              <Link href={`/unit/${encodeURIComponent(group.id)}`} className="font-medium hover:underline">
                {group.name}
              </Link>
            ) : (
              <span className="font-medium text-muted-foreground">Not in a {GROUP_LABEL[groupBy].toLowerCase()}</span>
            )}
            {group.id && (
              <span className="text-xs text-muted-foreground">
                {TYPE_LABEL[group.type] ?? GROUP_LABEL[groupBy]}
                {group.parent ? ` · ${group.parent.name}` : ""}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {formatExact(group.total)} {pluralize(level, group.total)}
            {group.continued ? " · continued" : ""}
          </span>
        </div>
      </TableCell>
    </TableRow>
  );
}

function FilterSelect({ label, all, needs, empty, value, onValueChange, items, loading, enabled }) {
  const disabled = !enabled || (!loading && items.length === 0);
  const placeholder = !enabled ? needs : !loading && items.length === 0 ? empty : all;
  return (
    <div className="flex w-full flex-col gap-1.5 sm:w-auto">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="h-9 w-full sm:w-44">
          <SelectValue>
            {(v) =>
              v === ALL || disabled ? placeholder : items.find((o) => o.id === v)?.name ?? (loading ? "Loading…" : v)
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{all}</SelectItem>
          {items.map((o) => (
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
    { key: "type", label: "Type" },
    { key: "district", label: "District" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" },
  ],
  subcounty: [
    { key: "name", label: "Name" },
    { key: "type", label: "Type" },
    { key: "district", label: "District" },
    { key: "county", label: "County" },
    { key: "status", label: "Status" },
  ],
  parish: [
    { key: "name", label: "Name" },
    { key: "type", label: "Type" },
    { key: "district", label: "District" },
    { key: "subcounty", label: "Subcounty" },
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

const ANCESTRY_KEYS = new Set(["district", "county", "subcounty", "parish"]);

// Stops the row's own onClick from also firing (it would navigate to the
// row's unit instead of the parent that was actually clicked).
function CellLink({ id, children }) {
  return (
    <Link
      href={`/unit/${encodeURIComponent(id)}`}
      onClick={(e) => e.stopPropagation()}
      className="underline-offset-2 hover:underline"
    >
      {children}
    </Link>
  );
}

function UnitRow({ row, columns, level, regionsById, subregionsById, onNavigate }) {
  const isVillage = level === "village";
  const cells = columns.map((c) => {
    let content;
    if (ANCESTRY_KEYS.has(c.key)) {
      const parent = row.ancestry?.[c.key];
      content = parent ? <CellLink id={parent.id}>{parent.name}</CellLink> : (row[c.key] || "—");
    } else if (c.key === "name" && !isVillage) {
      content = <CellLink id={row.id}>{row.name}</CellLink>;
    } else if (c.key === "region") {
      content = regionsById[row.region_id]?.name ?? "—";
    } else if (c.key === "subregion") {
      content = subregionsById[row.subregion_id]?.name ?? "—";
    } else if (c.key === "population") {
      content = row.population ? formatExact(row.population.total) : "—";
    } else if (c.key === "type") {
      content = TYPE_LABEL[row.type] ?? TYPE_LABEL[row.level] ?? row.level;
    } else {
      content = row[c.key] || "—";
    }
    return (
      <TableCell key={c.key} className={c.key === "population" ? "font-mono-tabular" : ""}>
        {content}
      </TableCell>
    );
  });

  if (isVillage) {
    // Villages have no /unit/[id] page of their own (see web/lib/villages.mjs)
    // — the row is informational, but its parish/subcounty/district cells
    // link up the hierarchy.
    return <TableRow>{cells}</TableRow>;
  }

  return (
    <TableRow className="cursor-pointer" onClick={() => onNavigate(row.id)}>
      {cells}
    </TableRow>
  );
}
