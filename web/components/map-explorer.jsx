"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { geoMercator, geoPath, geoBounds } from "d3-geo";
import { select } from "d3-selection";
import { zoom as d3zoom, zoomIdentity } from "d3-zoom";
import { ChevronRight, ChevronLeft, RotateCcw, Route } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { formatCompact, formatExact } from "@/lib/format";
import { cn } from "@/lib/utils";

const VIEW_WIDTH = 900;
const VIEW_HEIGHT = 820;
const PROJECTION_PADDING = 8;

function bboxesOverlap(a, b) {
  // a, b: [minLon, minLat, maxLon, maxLat]
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

export function MapExplorer({ regions, subregions, districts, initialFocus }) {
  const svgRef = useRef(null);
  const gRef = useRef(null);
  const zoomBehaviorRef = useRef(null);

  const [districtsGeo, setDistrictsGeo] = useState(null);
  const [subcountiesGeo, setSubcountiesGeo] = useState(null);
  const [parishesGeo, setParishesGeo] = useState(null);
  const [roadsGeo, setRoadsGeo] = useState(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [selectedDistrictId, setSelectedDistrictId] = useState(initialFocus || null);
  const [showRoads, setShowRoads] = useState(true);
  const [hover, setHover] = useState(null);

  const loading = !districtsGeo || !subcountiesGeo || !parishesGeo || !roadsGeo;

  useEffect(() => {
    Promise.all([
      fetch("/api/geo/districts").then((r) => r.json()),
      fetch("/api/geo/subcounties").then((r) => r.json()),
      fetch("/api/geo/parishes").then((r) => r.json()),
      fetch("/api/geo/roads").then((r) => r.json()),
    ]).then(([d, s, p, r]) => {
      setDistrictsGeo(d);
      setSubcountiesGeo(s);
      setParishesGeo(p);
      setRoadsGeo(r);
    });
  }, []);

  const projection = useMemo(() => {
    if (!districtsGeo) return null;
    return geoMercator().fitExtent(
      [
        [PROJECTION_PADDING, PROJECTION_PADDING],
        [VIEW_WIDTH - PROJECTION_PADDING, VIEW_HEIGHT - PROJECTION_PADDING],
      ],
      districtsGeo
    );
  }, [districtsGeo]);

  const pathGenerator = useMemo(() => (projection ? geoPath(projection) : null), [projection]);

  const districtPaths = useMemo(() => {
    if (!districtsGeo || !pathGenerator) return [];
    return districtsGeo.features.map((f) => ({
      id: f.properties.id,
      name: f.properties.name,
      regionId: f.properties.region_id,
      subregionId: f.properties.subregion_id,
      population: f.properties.population,
      d: pathGenerator(f),
      bbox: geoBounds(f).flat(), // [minLon, minLat, maxLon, maxLat]
    }));
  }, [districtsGeo, pathGenerator]);

  const selectedDistrict = districtPaths.find((d) => d.id === selectedDistrictId) ?? null;

  const subcountyPaths = useMemo(() => {
    if (!subcountiesGeo || !pathGenerator || !selectedDistrictId) return [];
    return subcountiesGeo.features
      .filter((f) => f.properties.district_id === selectedDistrictId)
      .map((f) => ({ id: f.properties.id, name: f.properties.name, d: pathGenerator(f) }));
  }, [subcountiesGeo, pathGenerator, selectedDistrictId]);

  const parishPaths = useMemo(() => {
    if (!parishesGeo || !pathGenerator || !selectedDistrictId) return [];
    return parishesGeo.features
      .filter((f) => f.properties.district_id === selectedDistrictId)
      .map((f) => ({ id: f.properties.id, name: f.properties.name, d: pathGenerator(f) }));
  }, [parishesGeo, pathGenerator, selectedDistrictId]);

  const roadPaths = useMemo(() => {
    if (!roadsGeo || !pathGenerator || !selectedDistrict) return [];
    return roadsGeo.features
      .filter((f) => bboxesOverlap(geoBounds(f).flat(), selectedDistrict.bbox))
      .map((f, i) => ({ id: f.properties.id ?? `road-${i}`, name: f.properties.name, d: pathGenerator(f) }));
  }, [roadsGeo, pathGenerator, selectedDistrict]);

  // d3-zoom drives the transform; React just reads it out for rendering
  // (via the state set in the 'zoom' handler), so panning/wheel-zoom stay
  // buttery even though the paths themselves are React-rendered.
  //
  // Depends on `loading`, not []: the <svg ref={svgRef}> only exists in the
  // DOM once loading finishes (it's behind a conditional Skeleton while
  // the four geo fetches are in flight — see the render below), so binding
  // once on mount would silently attach to a still-null ref and never
  // fire. Re-running when loading flips to false is what actually attaches
  // the behavior to the real, now-mounted <svg> element.
  useEffect(() => {
    if (loading || !svgRef.current) return;
    const zoomBehavior = d3zoom()
      .scaleExtent([1, 60])
      .on("zoom", (event) => setTransform(event.transform));
    zoomBehaviorRef.current = zoomBehavior;
    select(svgRef.current).call(zoomBehavior);
    return () => select(svgRef.current).on(".zoom", null);
  }, [loading]);

  const zoomTo = useCallback((bbox, padding = 0.15) => {
    if (!svgRef.current || !zoomBehaviorRef.current || !bbox) return;
    const [x0, y0, x1, y1] = bbox;
    const w = x1 - x0 || 1;
    const h = y1 - y0 || 1;
    const scale = Math.min(60, Math.max(1, (1 - padding) * Math.min(VIEW_WIDTH / w, VIEW_HEIGHT / h)));
    const tx = VIEW_WIDTH / 2 - scale * (x0 + x1) / 2;
    const ty = VIEW_HEIGHT / 2 - scale * (y0 + y1) / 2;
    select(svgRef.current)
      .transition()
      .duration(600)
      .call(zoomBehaviorRef.current.transform, zoomIdentity.translate(tx, ty).scale(scale));
  }, []);

  function pixelBounds(feature) {
    if (!pathGenerator) return null;
    const [[x0, y0], [x1, y1]] = pathGenerator.bounds(feature);
    return [x0, y0, x1, y1];
  }

  function selectDistrict(item) {
    setSelectedDistrictId(item.id);
    const feature = districtsGeo.features.find((f) => f.properties.id === item.id);
    if (feature) zoomTo(pixelBounds(feature));
  }

  function resetView() {
    setSelectedDistrictId(null);
    if (svgRef.current && zoomBehaviorRef.current) {
      select(svgRef.current).transition().duration(500).call(zoomBehaviorRef.current.transform, zoomIdentity);
    }
  }

  // Jump straight to the district named in ?focus= once geometry is loaded.
  useEffect(() => {
    if (initialFocus && districtsGeo) {
      const feature = districtsGeo.features.find((f) => f.properties.id === initialFocus);
      if (feature) zoomTo(pixelBounds(feature));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [districtsGeo]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Map</h1>
            <p className="text-sm text-muted-foreground">
              Scroll or pinch to zoom, drag to pan. Click a district to drill into its counties,
              subcounties, parishes, villages, and roads.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Toggle pressed={showRoads} onPressedChange={setShowRoads} size="sm" variant="outline" aria-label="Toggle roads">
              <Route className="size-3.5" />
              Roads
            </Toggle>
            <Button variant="outline" size="sm" onClick={resetView}>
              <RotateCcw className="size-3.5" />
              Reset
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          {loading ? (
            <Skeleton className="aspect-[9/8] w-full rounded-lg" />
          ) : (
            <div className="relative">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
                className="w-full touch-none rounded-lg border border-border bg-card"
              >
                <g ref={gRef} transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
                  {districtPaths.map((d) => (
                    <path
                      key={d.id}
                      d={d.d}
                      onClick={() => selectDistrict(d)}
                      onMouseEnter={() => setHover(d.name)}
                      onMouseLeave={() => setHover((h) => (h === d.name ? null : h))}
                      style={{
                        fill:
                          d.id === selectedDistrictId
                            ? "color-mix(in oklch, var(--primary) 35%, var(--muted))"
                            : "var(--muted)",
                        strokeWidth: 0.75 / transform.k,
                      }}
                      className="cursor-pointer stroke-background/80 transition-[filter] duration-100 hover:brightness-110"
                    />
                  ))}
                  {subcountyPaths.map((s) => (
                    <path
                      key={s.id}
                      d={s.d}
                      style={{ strokeWidth: 1.2 / transform.k }}
                      className="pointer-events-none fill-none stroke-primary/70"
                    />
                  ))}
                  {parishPaths.map((p) => (
                    <path
                      key={p.id}
                      d={p.d}
                      style={{ strokeWidth: 0.6 / transform.k, strokeDasharray: `${2 / transform.k},${2 / transform.k}` }}
                      className="pointer-events-none fill-none stroke-[var(--chart-3)]"
                    />
                  ))}
                  {showRoads &&
                    roadPaths.map((r) => (
                      <path
                        key={r.id}
                        d={r.d}
                        style={{ strokeWidth: 1 / transform.k }}
                        className="pointer-events-none fill-none stroke-[var(--chart-5)]"
                      />
                    ))}
                </g>
              </svg>
              {hover && (
                <div className="pointer-events-none absolute top-2 left-2 rounded-md border border-border bg-popover px-2.5 py-1 text-xs text-popover-foreground shadow-md">
                  {hover}
                </div>
              )}
              <div className="pointer-events-none absolute bottom-2 left-2 flex flex-col gap-1 rounded-md border border-border bg-popover/90 px-2.5 py-1.5 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3 bg-primary/70" /> Subcounty boundary
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3 border-t border-dashed border-[var(--chart-3)]" /> Parish boundary
                </span>
                {showRoads && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-3 bg-[var(--chart-5)]" /> Major road
                  </span>
                )}
              </div>
            </div>
          )}

          <DrillPanel
            selectedDistrict={selectedDistrict}
            regions={regions}
            subregions={subregions}
            subcountiesGeo={subcountiesGeo}
            parishesGeo={parishesGeo}
            onZoomToBounds={(bbox) => zoomTo(bbox, 0.25)}
            pathGenerator={pathGenerator}
          />
        </div>
      </main>
    </div>
  );
}

function useChildren(url) {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!url) {
      setItems(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setItems(d);
          setLoading(false);
        }
      })
      .catch(() => cancelled || setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [url]);
  return { items, loading };
}

function DrillPanel({ selectedDistrict, regions, subregions, subcountiesGeo, parishesGeo, onZoomToBounds, pathGenerator }) {
  const [countyId, setCountyId] = useState(null);
  const [subcountyId, setSubcountyId] = useState(null);
  const [subcountyName, setSubcountyName] = useState(null);
  const [parishName, setParishName] = useState(null);

  useEffect(() => {
    setCountyId(null);
    setSubcountyId(null);
    setSubcountyName(null);
    setParishName(null);
  }, [selectedDistrict?.id]);

  const { items: counties } = useChildren(selectedDistrict ? `/api/districts/${selectedDistrict.id}/counties` : null);
  const { items: subcounties } = useChildren(countyId ? `/api/counties/${countyId}/subcounties` : null);
  const { items: parishes } = useChildren(subcountyId ? `/api/subcounties/${subcountyId}/parishes` : null);
  const villageQuery = selectedDistrict
    ? `/api/units?level=village&districtId=${selectedDistrict.id}${subcountyName ? `&subcountyName=${encodeURIComponent(subcountyName)}` : ""}${parishName ? `&parishName=${encodeURIComponent(parishName)}` : ""}&pageSize=200`
    : null;
  // Unlike the hierarchical endpoints above (which return a plain array),
  // /api/units is paginated — its response is { total, page, pageSize,
  // items }, so the actual village rows are one level deeper.
  const { items: villageResponse } = useChildren(parishName ? villageQuery : null);
  const villageData = villageResponse?.items ?? null;

  if (!selectedDistrict) {
    return (
      <Card className="flex h-full min-h-64 items-center justify-center border-dashed py-12 text-center">
        <CardContent className="px-6 text-sm text-muted-foreground">
          Click any district on the map to drill into its counties, subcounties, parishes, and
          villages.
        </CardContent>
      </Card>
    );
  }

  const region = regions.find((r) => r.id === selectedDistrict.regionId);
  const subregion = subregions.find((s) => s.id === selectedDistrict.subregionId);
  const subcountyHasBoundary = (name) => subcountiesGeo?.features.some((f) => f.properties.name === name && f.properties.district_id === selectedDistrict.id);
  const parishHasBoundary = (name) => parishesGeo?.features.some((f) => f.properties.name === name && f.properties.district_id === selectedDistrict.id);

  function boundsForName(geo, name) {
    const feature = geo?.features.find((f) => f.properties.name === name && f.properties.district_id === selectedDistrict.id);
    if (!feature || !pathGenerator) return null;
    const [[x0, y0], [x1, y1]] = pathGenerator.bounds(feature);
    return [x0, y0, x1, y1];
  }

  return (
    <Card className="flex max-h-[820px] flex-col py-5">
      <CardContent className="flex flex-1 flex-col gap-4 overflow-y-auto px-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{selectedDistrict.name}</h2>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {region && <Badge variant="secondary">{region.name}</Badge>}
            {subregion && <Badge variant="outline">{subregion.name}</Badge>}
          </div>
          {selectedDistrict.population && (
            <div className="font-mono-tabular mt-2 text-2xl font-semibold">
              {formatCompact(selectedDistrict.population.total)}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">people (2024)</span>
            </div>
          )}
          <a
            href={`/unit/${encodeURIComponent(selectedDistrict.id)}`}
            className="mt-1 inline-block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            View full district record →
          </a>
        </div>

        <DrillLevel
          title="County / Municipality"
          items={counties}
          selectedId={countyId}
          onSelect={(item) => {
            setCountyId(item.id);
            setSubcountyId(null);
            setSubcountyName(null);
            setParishName(null);
          }}
        />

        {countyId && (
          <DrillLevel
            title="Subcounty / Town Council / Division"
            items={subcounties}
            selectedId={subcountyId}
            hasBoundary={(item) => subcountyHasBoundary(item.name)}
            onSelect={(item) => {
              setSubcountyId(item.id);
              setSubcountyName(item.name);
              setParishName(null);
              const bounds = boundsForName(subcountiesGeo, item.name);
              if (bounds) onZoomToBounds(bounds);
            }}
          />
        )}

        {subcountyId && (
          <DrillLevel
            title="Parish / Ward"
            items={parishes}
            selectedId={parishName ? "selected" : null}
            hasBoundary={(item) => parishHasBoundary(item.name)}
            onSelect={(item) => {
              setParishName(item.name);
              const bounds = boundsForName(parishesGeo, item.name);
              if (bounds) onZoomToBounds(bounds);
            }}
          />
        )}

        {parishName && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Villages</span>
              <Badge variant="outline" className="font-normal">
                no boundary data
              </Badge>
            </div>
            {!villageData ? (
              <Skeleton className="h-20 w-full" />
            ) : villageData.length === 0 ? (
              <p className="text-xs text-muted-foreground">No villages found for this parish.</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {villageData.map((v) => (
                  <Badge key={v.id} variant="secondary" className="font-normal">
                    {v.village}
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Villages have no boundary geometry in this dataset — listed by name only. See{" "}
              <a href="/explore?level=village" className="underline underline-offset-2 hover:text-foreground">
                /explore
              </a>{" "}
              to browse all of them.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DrillLevel({ title, items, selectedId, hasBoundary, onSelect }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border pt-3">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
      {!items ? (
        <Skeleton className="h-9 w-full" />
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">None found.</p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className={cn(
                "flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                selectedId === item.id && "bg-muted"
              )}
            >
              <span>{item.name}</span>
              <span className="flex items-center gap-1.5">
                {hasBoundary && !hasBoundary(item) && (
                  <Badge variant="outline" className="text-[10px] font-normal">
                    no boundary
                  </Badge>
                )}
                <ChevronRight className="size-3.5 text-muted-foreground" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
