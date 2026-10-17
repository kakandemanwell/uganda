"use client";

// /map: a MapLibre choropleth of Uganda's administrative units. Colour any
// boundary level (region -> parish) by any metric that applies to it, on a
// vector or Esri satellite basemap; layer other levels' outlines, roads,
// names and still-unmapped land on top; drill into a district; and export
// exactly what's on screen — as GeoJSON/CSV with OCHA P-codes and UBOS
// codes, or as a captioned PNG.
//
// All state lives here and is mirrored into the URL (?level=&metric=
// &layers=&base=&op=&focus=&at=), so any view is a shareable link. The map
// itself (components/map-canvas.jsx) is a controlled view of this state.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { geoBounds, geoCentroid } from "d3-geo";
import {
  ChevronLeft,
  Download,
  Image as ImageIcon,
  Layers,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { MapCanvas } from "@/components/map-canvas";
import { MapDrillPanel } from "@/components/map-drill-panel";
import { GLASS, PlaceCard, PlaceMenu } from "@/components/map-place";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BASEMAPS,
  BASEMAP_ATTRIBUTION,
  LEVEL_COLORS,
  MODES,
  DATA_ATTRIBUTION,
  MAP_LEVELS,
  NO_DATA,
  OVERLAYS,
  OVERLAY_KEYS,
  RAMPS,
  SATELLITE_ATTRIBUTION,
  UGANDA_BBOX,
  classColors,
  formatMetric,
  levelInfo,
  metricInfo,
  metricsForLevel,
  quantileBreaks,
} from "@/lib/map-config";
import { exportMapPng } from "@/lib/map-export";
import { formatCompact, formatExact } from "@/lib/format";
import { cn } from "@/lib/utils";

const GEO_URLS = Object.fromEntries([
  ...MAP_LEVELS.map((l) => [l.key, l.source]),
  ["roads", "/api/geo/roads"],
  ["gaps", "/api/geo/gaps"],
  ["settlements", "/api/geo/settlements"],
]);
const NOT_ADMIN = new Set(["roads", "gaps", "settlements"]);

function bboxesOverlap(a, b) {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

// Array properties come back from MapLibre's feature queries as JSON strings.
function listProp(v) {
  if (Array.isArray(v)) return v;
  try {
    return JSON.parse(v ?? "[]");
  } catch {
    return [];
  }
}

export function MapExplorer({ regions, subregions, districts, cities, coverage, initial, dataVersion }) {
  // Geo and stats responses are cacheable for an hour (lib/respond.mjs);
  // keying their URLs to the dataset build means a rebuilt dataset is
  // never masked by a stale cached layer.
  const v = `v=${encodeURIComponent(dataVersion ?? "")}`;
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";
  // next-themes only knows the real theme after mount; creating the map
  // before that would load the light basemap and immediately swap it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [level, setLevel] = useState(initial.level);
  const [metric, setMetric] = useState(initial.metric);
  const [overlays, setOverlays] = useState(initial.overlays);
  const [basemap, setBasemap] = useState(initial.basemap);
  const [opacity, setOpacity] = useState(initial.opacity);
  const [fill, setFill] = useState(initial.fill ?? true);
  const [mode, setMode] = useState(initial.mode);
  const [terrain, setTerrain] = useState(initial.terrain);
  // "what is here": the inspected point, its /api/geo/at answer, and the
  // right-click menu
  const [place, setPlace] = useState(null);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placePoint, setPlacePoint] = useState(null);
  const [menu, setMenu] = useState(null);
  const placeReq = useRef(0);
  const [selectedId, setSelectedId] = useState(initial.focus);
  const [focusFeature, setFocusFeature] = useState(null);
  const [view, setView] = useState(null);
  const [hover, setHover] = useState(null);
  const [pointer, setPointer] = useState(null);
  const [fitRequest, setFitRequest] = useState(null);
  const [exportScope, setExportScope] = useState(initial.focus ? "district" : "view");
  const [exporting, setExporting] = useState(false);
  // Both side panels fold away to give the map the whole screen.
  const [controlsOpen, setControlsOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const mapRef = useRef(null);
  const mapBoxRef = useRef(null);

  // ---- boundary GeoJSON, fetched once per layer, only when first needed ----
  const [geo, setGeo] = useState({});
  const geoPromises = useRef({});
  const ensureGeo = useCallback((key) => {
    if (!geoPromises.current[key]) {
      geoPromises.current[key] = fetch(`${GEO_URLS[key]}?${v}`)
        .then((r) => {
          if (!r.ok) throw new Error(`${GEO_URLS[key]}: HTTP ${r.status}`);
          return r.json();
        })
        .then((fc) => {
          setGeo((g) => ({ ...g, [key]: fc }));
          return fc;
        })
        .catch((err) => {
          // forget the failure so the next toggle/zoom-to retries
          delete geoPromises.current[key];
          console.error("[map] boundary layer failed to load", err);
          return { type: "FeatureCollection", features: [] };
        });
    }
    return geoPromises.current[key];
  }, [v]);
  useEffect(() => {
    const needed = new Set(["district", level]);
    for (const o of overlays) {
      const lvl = OVERLAYS.find((x) => x.key === o)?.level;
      if (lvl) needed.add(lvl);
      if (NOT_ADMIN.has(o)) needed.add(o);
    }
    needed.forEach((k) => ensureGeo(k));
  }, [level, overlays, ensureGeo]);

  // ---- per-polygon statistics ----
  const [stats, setStats] = useState({});
  const statsInFlight = useRef(new Set());
  useEffect(() => {
    for (const lvl of new Set([level, "district"])) {
      if (stats[lvl] || statsInFlight.current.has(lvl)) continue;
      statsInFlight.current.add(lvl);
      fetch(`/api/geo/stats?level=${lvl}&${v}`)
        .then((r) => {
          if (!r.ok) throw new Error(`stats ${lvl}: HTTP ${r.status}`);
          return r.json();
        })
        .then((s) => setStats((prev) => ({ ...prev, [lvl]: s })))
        .catch((err) => console.error("[map] statistics failed to load", err))
        .finally(() => statsInFlight.current.delete(lvl));
    }
  }, [level, stats, v]);

  const values = stats[level]?.values ?? null;
  const breaks = useMemo(
    () => (values ? quantileBreaks(Object.values(values).map((v) => v[metric]), 5) : []),
    [values, metric]
  );
  const ramp = RAMPS[theme];

  // Feature bboxes (in-view counts, zoom-to) and label points, per level.
  const bboxes = useMemo(() => {
    const out = {};
    for (const [key, fc] of Object.entries(geo)) {
      if (NOT_ADMIN.has(key)) continue;
      out[key] = new Map(fc.features.map((f) => [f.properties.id, geoBounds(f).flat()]));
    }
    return out;
  }, [geo]);
  const labelPoints = useMemo(() => {
    const out = {};
    for (const [key, fc] of Object.entries(geo)) {
      if (NOT_ADMIN.has(key)) continue;
      out[key] = {
        type: "FeatureCollection",
        features: fc.features.map((f) => ({
          type: "Feature",
          properties: { id: f.properties.id, name: f.properties.name },
          geometry: { type: "Point", coordinates: geoCentroid(f) },
        })),
      };
    }
    return out;
  }, [geo]);

  // ---- level/metric changes keep the metric valid for the level ----
  function changeLevel(next) {
    setLevel(next);
    if (!metricsForLevel(next).some((m) => m.key === metric)) setMetric(metricsForLevel(next)[0].key);
  }
  function toggleOverlay(key) {
    setOverlays((cur) => {
      const set = new Set(cur);
      set.has(key) ? set.delete(key) : set.add(key);
      return OVERLAY_KEYS.filter((k) => set.has(k));
    });
  }

  // ---- selection & camera ----
  const districtOf = useCallback(
    (id) => {
      if (!id) return null;
      if (id.startsWith("city:")) return cities.find((c) => c.id === id)?.parent_id ?? null;
      return id;
    },
    [cities]
  );
  const fitTo = useCallback(
    async (key, id, maxZoom) => {
      const fc = await ensureGeo(key);
      const f = fc.features.find((x) => x.properties.id === id);
      if (f) setFitRequest({ bbox: geoBounds(f).flat(), maxZoom });
      return Boolean(f);
    },
    [ensureGeo]
  );
  function selectDistrict(id) {
    const d = districtOf(id);
    setSelectedId(d);
    setFocusFeature(null);
    if (d) fitTo("district", d);
  }
  // A click inspects the place under the cursor — the full hierarchy there
  // goes into the details panel — and selects its district, without moving
  // the camera (the user is looking at it already).
  async function inspectAt([lng, lat]) {
    const req = ++placeReq.current;
    setPlacePoint([lng, lat]);
    setPlaceLoading(true);
    setDetailsOpen(true);
    try {
      const r = await fetch(`/api/geo/at?lon=${lng}&lat=${lat}`);
      const p = await r.json();
      if (req !== placeReq.current) return;
      setPlace(p);
      setFocusFeature(p.feature ? { type: "FeatureCollection", features: [p.feature] } : null);
      const d = p.levels?.district?.id ?? districtOf(p.levels?.city?.id);
      if (d) setSelectedId(d);
    } catch (err) {
      console.error("[map] place lookup failed", err);
    } finally {
      if (req === placeReq.current) setPlaceLoading(false);
    }
  }
  function clearPlace() {
    placeReq.current++;
    setPlace(null);
    setPlacePoint(null);
    setFocusFeature(null);
    setPlaceLoading(false);
  }
  function onPick({ lngLat }) {
    if (lngLat) inspectAt(lngLat);
  }
  // Drill-panel picks below district: fetch just that one polygon (the
  // whole parish layer is 11 MB), outline it and frame it.
  async function zoomToUnit(id, lvl) {
    try {
      const r = await fetch(`/api/geo/export?level=${lvl}&ids=${encodeURIComponent(id)}`);
      const fc = await r.json();
      if (!fc.features?.length) {
        setFocusFeature(null);
        return;
      }
      setFocusFeature(fc);
      setFitRequest({ bbox: geoBounds(fc).flat(), maxZoom: lvl === "parish" ? 14.5 : 13 });
    } catch (err) {
      console.error("[map] could not load boundary for", id, err);
    }
  }
  function resetView() {
    setSelectedId(null);
    clearPlace();
    setFitRequest({ bbox: UGANDA_BBOX, maxZoom: 7 });
  }

  // ?focus= on first load (when ?at= didn't already fix the camera).
  const focusedOnce = useRef(false);
  useEffect(() => {
    if (focusedOnce.current || !geo.district || !initial.focus || initial.at) return;
    focusedOnce.current = true;
    fitTo("district", initial.focus);
  }, [geo.district, initial.focus, initial.at, fitTo]);

  // ---- URL mirror (debounced; replaceState, not navigation) ----
  useEffect(() => {
    const t = setTimeout(() => {
      const q = new URLSearchParams();
      q.set("level", level);
      q.set("metric", metric);
      q.set("layers", overlays.join(","));
      if (basemap !== "map") q.set("base", basemap);
      if (mode !== "data") q.set("mode", mode);
      if (terrain) q.set("terrain", "1");
      q.set("op", String(Math.round(opacity * 100)));
      if (!fill) q.set("fill", "0");
      if (selectedId) q.set("focus", selectedId);
      if (view) q.set("at", `${view.center[0].toFixed(4)},${view.center[1].toFixed(4)},${view.zoom.toFixed(2)}`);
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?${q}`);
    }, 600);
    return () => clearTimeout(t);
  }, [level, metric, overlays, basemap, opacity, fill, mode, terrain, selectedId, view]);

  // On desktop the control panel floats over the map's left edge, so camera
  // fits leave room for it (when it's open) instead of framing districts
  // underneath it.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const fitPadding = isDesktop ? { top: 32, bottom: 48, left: controlsOpen ? 352 : 56, right: detailsOpen ? 392 : 56 } : 32;

  // ---- derived display data ----
  const levelMeta = levelInfo(level);
  const metricMeta = metricInfo(metric);
  const colors = classColors(breaks, ramp);
  const legend = useMemo(() => {
    if (!values) return [];
    const nums = Object.values(values).map((v) => v[metric]).filter((n) => typeof n === "number");
    if (!nums.length) return [];
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const bounds = [min, ...breaks, max];
    return colors.map((color, i) => {
      const lo = formatMetric(metric, bounds[i]);
      const hi = formatMetric(metric, bounds[i + 1]);
      const last = i === colors.length - 1;
      return { color, label: last ? (lo === hi ? lo : `${lo} – ${hi}`) : `${lo} – <${hi}` };
    });
  }, [values, metric, breaks, colors]);
  const noDataCount = useMemo(() => {
    if (!values || !geo[level]) return 0;
    return geo[level].features.filter((f) => typeof values[f.properties.id]?.[metric] !== "number").length;
  }, [values, geo, level, metric]);
  const inferredCount = useMemo(() => geo[level]?.features.filter((f) => f.properties.inferred).length ?? 0, [geo, level]);

  const inView = useMemo(() => {
    if (!view || !bboxes[level] || !values) return null;
    let count = 0;
    let population = 0;
    let villages = 0;
    for (const [id, bb] of bboxes[level]) {
      if (!bboxesOverlap(bb, view.bounds)) continue;
      count++;
      population += values[id]?.population ?? 0;
      villages += values[id]?.villages ?? 0;
    }
    return { count, population, villages };
  }, [view, bboxes, level, values]);

  const selectedDistrict = districts.find((d) => d.id === selectedId) ?? null;
  const mappedSubcounties = useMemo(() => (geo.subcounty ? new Set(geo.subcounty.features.map((f) => f.properties.id)) : null), [geo.subcounty]);

  // How many polygons each export scope holds — shown in the export menu,
  // and an empty scope disables the download rather than handing over an
  // empty file. Mirrors the server's within= rule: a city's units count
  // toward the district it was carved from.
  const scopeCounts = useMemo(() => {
    const fc = geo[level];
    if (!fc) return null;
    const inDistrict = selectedId
      ? fc.features.filter((f) => f.properties.id === selectedId || districtOf(f.properties.district_id) === selectedId).length
      : 0;
    return { all: fc.features.length, district: inDistrict, view: inView?.count ?? 0 };
  }, [geo, level, selectedId, districtOf, inView]);

  const cov = coverage[level];
  const coverageNote =
    cov && cov.with_polygon < cov.total
      ? `${formatExact(cov.with_polygon)} of ${formatExact(cov.total)} ${levelMeta.plural} mapped (${((cov.with_polygon / cov.total) * 100).toFixed(1)}%). Land no unit could be given is under “Unmapped land”.`
      : null;
  const inferredNote = inferredCount
    ? `${formatExact(inferredCount)} ${inferredCount === 1 ? "boundary is" : "boundaries are"} inferred (dashed): the only unmapped unit in its parent gets the parent's remaining land.`
    : null;

  // ---- export ----
  const exportParams = () => {
    const q = new URLSearchParams({ level });
    if (exportScope === "district" && selectedId) q.set("within", selectedId);
    if (exportScope === "view" && view) q.set("bbox", view.bounds.map((n) => n.toFixed(4)).join(","));
    return q;
  };
  const scopeLabel =
    exportScope === "district" && selectedDistrict
      ? `${selectedDistrict.name} District`
      : exportScope === "view"
        ? "Current view"
        : "All of Uganda";
  async function exportPng() {
    if (!mapRef.current) return;
    setExporting(true);
    try {
      await exportMapPng({
        map: mapRef.current,
        title: `${metricMeta.label} by ${levelMeta.label.toLowerCase()}`,
        subtitle: `Uganda${selectedDistrict ? ` · ${selectedDistrict.name} District` : ""} · ${new Date().toISOString().slice(0, 10)}`,
        legend: [
          ...legend,
          ...(noDataCount ? [{ color: NO_DATA[theme], label: "No data" }] : []),
          ...(coverageNote ? [{ color: "rgba(0,0,0,0)", label: "Unshaded: no boundary polygon" }] : []),
        ],
        attribution: `${DATA_ATTRIBUTION} · ${basemap === "satellite" ? SATELLITE_ATTRIBUTION : BASEMAP_ATTRIBUTION}`,
        filename: `uganda-${level}-${metric}${basemap === "satellite" ? "-satellite" : ""}.png`,
      });
    } finally {
      setExporting(false);
    }
  }

  const controls = (
    <ControlPanel
      level={level}
      onLevel={changeLevel}
      metric={metric}
      onMetric={setMetric}
      basemap={basemap}
      onBasemap={setBasemap}
      opacity={opacity}
      onOpacity={setOpacity}
      fill={fill}
      onFill={setFill}
      mode={mode}
      onMode={setMode}
      terrain={terrain}
      onTerrain={setTerrain}
      theme={theme}
      legend={legend}
      noDataCount={noDataCount}
      noDataColor={NO_DATA[theme]}
      loading={mode === "data" && (!values || !geo[level])}
      metricNote={metricMeta?.note}
      coverageNote={coverageNote}
      inferredNote={inferredNote}
      partial={Boolean(coverageNote)}
      overlays={overlays}
      onToggleOverlay={toggleOverlay}
      coverage={coverage}
      gapCount={coverage.gaps?.features}
      exportProps={{
        scope: exportScope,
        onScope: setExportScope,
        hasDistrict: Boolean(selectedId),
        scopeLabel,
        geojsonHref: () => `/api/geo/export?${exportParams()}&format=geojson`,
        csvHref: () => `/api/geo/export?${exportParams()}&format=csv`,
        onPng: exportPng,
        exporting,
        levelPlural: levelMeta.plural,
        counts: scopeCounts,
      }}
      onReset={resetView}
    />
  );

  const details = (
    <div className="flex min-h-0 flex-col gap-5">
      {(place || placeLoading) && (
        <PlaceCard place={place} loading={placeLoading} theme={basemap === "satellite" ? "dark" : theme} onClose={clearPlace} onZoom={zoomToUnit} />
      )}
      {!place && !placeLoading && (
        <p className="text-xs text-muted-foreground">
          Click anywhere for everything known about that spot — its region, district, county, subcounty, parish and
          villages. Right-click for coordinates and links.
        </p>
      )}
      <div className={cn(place && "border-t border-border/60 pt-4")}>
        <MapDrillPanel
          district={selectedDistrict}
          region={regions.find((r) => r.id === selectedDistrict?.region_id)}
          subregion={subregions.find((s) => s.id === selectedDistrict?.subregion_id)}
          stats={selectedId ? stats.district?.values?.[selectedId] : null}
          subcountyHasBoundary={mappedSubcounties ? (id) => mappedSubcounties.has(id) : null}
          onZoomToUnit={zoomToUnit}
          onClose={() => {
            setSelectedId(null);
            clearPlace();
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <SiteHeader onSelectDistrict={(item) => selectDistrict(item.id)} />
      <main className="flex flex-1 flex-col lg:min-h-0">
        <div ref={mapBoxRef} className="relative h-[62dvh] min-h-[420px] w-full overflow-hidden bg-muted lg:h-auto lg:min-h-0 lg:flex-1">
          {mounted ? (
            <MapCanvas
              theme={theme}
              basemap={basemap}
              opacity={opacity}
              fill={fill}
              mode={mode}
              terrain={terrain}
              placePoint={placePoint}
              geo={geo}
              labelPoints={labelPoints}
              level={level}
              metric={metric}
              values={values}
              breaks={breaks}
              ramp={ramp}
              overlays={overlays}
              selectedId={selectedId}
              focusFeature={focusFeature}
              fitRequest={fitRequest}
              initialView={initial.at}
              layoutKey={`${isDesktop}`}
              onHover={setHover}
              onPick={onPick}
              onView={setView}
              onPointer={setPointer}
              onContextMenu={setMenu}
              onMap={(m) => (mapRef.current = m)}
              padding={fitPadding}
            />
          ) : (
            <Skeleton className="absolute inset-0 rounded-none" />
          )}

          {/* Desktop: both panels float over the map as frosted glass, so
              the map stays visible through them, and each folds to a button. */}
          {controlsOpen ? (
            <div className={cn("absolute top-3 left-3 z-10 hidden max-h-[calc(100%-1.5rem)] w-80 overflow-y-auto rounded-xl p-4 lg:block", GLASS)}>
              <PanelHeader title="Map controls" onCollapse={() => setControlsOpen(false)} collapseLabel="Hide map controls" />
              {controls}
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className={cn("absolute top-3 left-3 z-10 hidden lg:inline-flex", GLASS)}
              onClick={() => setControlsOpen(true)}
            >
              <SlidersHorizontal className="size-3.5" />
              Map controls
            </Button>
          )}
          {detailsOpen ? (
            <div className={cn("absolute top-3 right-3 bottom-3 z-10 hidden w-[360px] flex-col gap-4 overflow-y-auto rounded-xl p-4 lg:flex", GLASS)}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold tracking-tight">Details</span>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => setDetailsOpen(false)} aria-label="Hide details panel" title="Hide details panel">
                  <PanelRightClose className="size-4" />
                </Button>
              </div>
              {details}
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className={cn("absolute top-3 right-3 z-10 hidden lg:inline-flex", GLASS)}
              onClick={() => setDetailsOpen(true)}
              aria-label="Show details panel"
            >
              <PanelRightOpen className="size-3.5" />
              {place?.levels?.parish?.name ?? selectedDistrict?.name ?? "Details"}
            </Button>
          )}

          {hover && !menu && (
            <HoverCard
              hover={hover}
              boxWidth={mapBoxRef.current?.clientWidth ?? 0}
              level={level}
              mode={mode}
              metric={metric}
              value={values?.[hover.id]?.[metric]}
              pcode={values?.[hover.id]?.hdx_pcode}
              parentName={hover.properties.district_id ? nameOf(hover.properties.district_id, districts, cities) : null}
            />
          )}

          <PlaceMenu
            menu={menu}
            boxWidth={mapBoxRef.current?.clientWidth ?? 0}
            boxHeight={mapBoxRef.current?.clientHeight ?? 0}
            onInspect={(m) => {
              setMenu(null);
              inspectAt([m.lng, m.lat]);
            }}
            onCentre={(m) => {
              setMenu(null);
              mapRef.current?.easeTo({ center: [m.lng, m.lat], duration: 500 });
            }}
            onClose={() => setMenu(null)}
          />

          {/* Top-left on phones: MapLibre keeps its attribution expanded
              along the bottom edge on narrow screens until the first drag. */}
          <div className={cn("pointer-events-none absolute top-2 left-2 z-10 flex flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-[11px] text-muted-foreground lg:top-auto lg:bottom-2", GLASS)}>
            {inView && (
              <span className="text-foreground">
                <span className="font-mono-tabular font-medium">{formatExact(inView.count)}</span> {levelMeta.plural} in view
                {inView.population > 0 && (
                  <>
                    {" · "}
                    <span className="font-mono-tabular font-medium">{formatCompact(inView.population)}</span> people
                  </>
                )}
                {" · "}
                <span className="font-mono-tabular font-medium">{formatCompact(inView.villages)}</span> villages
              </span>
            )}
            <span className="font-mono-tabular">
              {pointer ? `${pointer.lat.toFixed(5)}°, ${pointer.lng.toFixed(5)}°` : "—"}
              {view && ` · z${view.zoom.toFixed(1)}`}
              <span className="hidden lg:inline"> · right-click for this spot · right-drag to tilt</span>
            </span>
          </div>
        </div>

        {/* Phones: controls and details below the map. */}
        <aside className="flex w-full flex-col gap-6 border-t border-border p-4 lg:hidden">
          <div>
            {controlsOpen ? (
              <>
                <PanelHeader title="Map controls" onCollapse={() => setControlsOpen(false)} collapseLabel="Hide map controls" />
                {controls}
              </>
            ) : (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setControlsOpen(true)}>
                <SlidersHorizontal className="size-3.5" />
                Show map controls
              </Button>
            )}
          </div>
          {details}
        </aside>
      </main>
    </div>
  );
}

function PanelHeader({ title, onCollapse, collapseLabel }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="text-sm font-semibold tracking-tight">{title}</span>
      <Button variant="ghost" size="icon" className="size-7" onClick={onCollapse} aria-label={collapseLabel} title={collapseLabel}>
        <ChevronLeft className="size-4" />
      </Button>
    </div>
  );
}

function nameOf(id, districts, cities) {
  return (id.startsWith("city:") ? cities : districts).find((u) => u.id === id)?.name ?? null;
}

function HoverCard({ hover, boxWidth, level, mode, metric, value, pcode, parentName }) {
  const flip = hover.x > boxWidth - 280;
  const style = { left: flip ? hover.x - 14 : hover.x + 14, top: hover.y + 14, transform: flip ? "translateX(-100%)" : undefined };
  const p = hover.properties;
  if (hover.level === "gap") {
    const candidates = listProp(p.candidate_names);
    const ubos = listProp(p.ubos_names);
    return (
      <div className={cn("pointer-events-none absolute z-20 w-max max-w-72 rounded-lg px-3 py-2", GLASS)} style={style}>
        <div className="text-sm font-medium">
          {p.kind === "refugee_settlement" ? "Refugee settlement land" : p.kind === "unassigned_chunk" ? "Unassigned land" : "Unmapped land"}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {parentName ? `${parentName} · ` : ""}
          {p.level === "parish" ? "parish level" : "subcounty level"}
        </div>
        {ubos.length > 0 && <div className="mt-1 text-[11px]">UBOS: {ubos.join(", ")}</div>}
        {candidates.length > 0 && (
          <div className="mt-1.5 text-[11px] leading-snug">
            <span className="text-muted-foreground">{p.kind === "refugee_settlement" ? "Host subcounties: " : "Belongs to one or more of: "}</span>
            {candidates.slice(0, 8).join(", ")}
            {candidates.length > 8 && ` +${candidates.length - 8} more`}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className={cn("pointer-events-none absolute z-20 w-max max-w-64 rounded-lg px-3 py-2", GLASS)} style={style}>
      <div className="text-sm font-medium">{p.name}</div>
      <div className="text-[11px] text-muted-foreground">
        {levelInfo(level).label}
        {parentName && level !== "district" && ` · ${parentName}`}
      </div>
      {mode === "data" && (
        <div className="mt-1.5 flex items-baseline justify-between gap-4">
          <span className="text-[11px] text-muted-foreground">{metricInfo(metric).label}</span>
          <span className="font-mono-tabular text-sm font-semibold">{formatMetric(metric, value)}</span>
        </div>
      )}
      <div className="mt-1 text-[10px] text-muted-foreground">Click for everything here</div>
      {(p.inferred === true || p.inferred === "true") && (
        <div className="mt-1 text-[11px] text-muted-foreground">Inferred boundary — the parent&apos;s remaining land</div>
      )}
      {pcode && <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">P-code {pcode}</div>}
      {p.ubos_code && <div className="font-mono text-[10px] text-muted-foreground">UBOS {p.ubos_code}</div>}
    </div>
  );
}

function ControlPanel({
  level,
  onLevel,
  metric,
  onMetric,
  basemap,
  onBasemap,
  opacity,
  onOpacity,
  fill,
  onFill,
  mode,
  onMode,
  terrain,
  onTerrain,
  theme,
  legend,
  noDataCount,
  noDataColor,
  loading,
  metricNote,
  coverageNote,
  inferredNote,
  partial,
  overlays,
  onToggleOverlay,
  coverage,
  gapCount,
  exportProps,
  onReset,
}) {
  const metrics = metricsForLevel(level);
  const countFor = (o) => {
    if (o.key === "gaps") return gapCount ? formatExact(gapCount) : null;
    if (o.key === "settlements") return coverage.settlements ? formatExact(coverage.settlements) : null;
    const c = o.level && coverage[o.level];
    if (!c) return null;
    return c.with_polygon === c.total ? formatExact(c.total) : `${formatExact(c.with_polygon)}/${formatExact(c.total)}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Basemap</h2>
        <Tabs value={basemap} onValueChange={onBasemap}>
          <TabsList className="w-full">
            {BASEMAPS.map((b) => (
              <TabsTrigger key={b.key} value={b.key} className="text-xs">
                {b.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Switch label="Colour fill" checked={fill} onChange={() => onFill(!fill)} />
        <label className={cn("flex items-center gap-3 text-xs text-muted-foreground", !fill && "opacity-40")}>
          <span className="w-20 shrink-0">Fill opacity</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(opacity * 100)}
            onChange={(e) => onOpacity(Number(e.target.value) / 100)}
            disabled={!fill}
            className="h-1.5 flex-1 cursor-pointer accent-[var(--primary)] disabled:cursor-not-allowed"
            aria-label="Fill opacity"
          />
          <span className="font-mono-tabular w-9 text-right text-foreground">{Math.round(opacity * 100)}%</span>
        </label>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {fill ? "The fill fades out as you zoom in, so imagery and streets show through; boundaries stay." : "Boundaries only — no colour over the map."}
        </p>
        <Switch label="3D terrain" checked={terrain} onChange={() => onTerrain(!terrain)} />
        <p className="text-[11px] leading-snug text-muted-foreground">Right-drag (or Ctrl+drag) to rotate and tilt; the compass resets the view.</p>
      </section>

      <section className="flex flex-col gap-2 border-t border-border pt-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Colour</h2>
          <Tabs value={mode} onValueChange={onMode}>
            <TabsList className="h-7">
              {MODES.map((m) => (
                <TabsTrigger key={m.key} value={m.key} className="px-2 text-[11px]">
                  {m.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <Tabs value={level} onValueChange={onLevel}>
          <TabsList className="w-full">
            {MAP_LEVELS.map((l) => (
              <TabsTrigger key={l.key} value={l.key} className="px-0.5 text-[10.5px]" title={l.label}>
                {l.short ?? l.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {mode === "hierarchy" ? (
          <>
            <ul className="flex flex-col gap-1 pt-1" aria-label="Boundary colours">
              {MAP_LEVELS.map((l, i) => (
                <li key={l.key} className="flex items-center gap-2 text-xs">
                  <span
                    className="w-5 shrink-0 rounded-full"
                    style={{ background: LEVEL_COLORS[theme === "dark" || basemap === "satellite" ? "dark" : "light"][l.key], height: Math.max(1.5, 4 - i * 0.5) }}
                  />
                  <span className={cn(l.key === level && "font-medium")}>{l.label}</span>
                  {l.key === level && <span className="text-[10px] text-muted-foreground">tinted</span>}
                </li>
              ))}
            </ul>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Each level&apos;s boundaries in its own colour; turn levels on under Layers. The chosen level is tinted —
              adjust with Fill opacity. Villages have no boundaries; click a place to list them.
            </p>
          </>
        ) : (
        <>
        <Select value={metric} onValueChange={onMetric}>
          <SelectTrigger className="h-9 w-full" aria-label="Metric">
            <SelectValue>{(v) => metricInfo(v)?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {metrics.map((m) => (
              <SelectItem key={m.key} value={m.key}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <ul className="flex flex-col gap-1 pt-1" aria-label="Legend">
            {legend.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-xs">
                <span className="h-3 w-5 shrink-0 rounded-[3px]" style={{ background: item.color }} />
                <span className="font-mono-tabular">{item.label}</span>
              </li>
            ))}
            {partial && (
              <li className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-3 w-5 shrink-0 rounded-[3px] border border-dashed border-muted-foreground/60" />
                Unshaded: no boundary polygon
              </li>
            )}
            {noDataCount > 0 && (
              <li className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-3 w-5 shrink-0 rounded-[3px] ring-1 ring-border ring-inset" style={{ background: noDataColor }} />
                No data ({formatExact(noDataCount)})
              </li>
            )}
          </ul>
        )}
        {metricNote && <p className="text-[11px] leading-snug text-muted-foreground">{metricNote}</p>}
        </>
        )}
        {coverageNote && <p className="text-[11px] leading-snug text-muted-foreground">{coverageNote}</p>}
        {inferredNote && <p className="text-[11px] leading-snug text-muted-foreground">{inferredNote}</p>}
      </section>

      <section className="flex flex-col gap-1.5 border-t border-border pt-3">
        <h2 className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          <Layers className="size-3" /> Layers
        </h2>
        <ul className="flex flex-col">
          {OVERLAYS.map((o) => {
            const on = overlays.includes(o.key);
            const count = countFor(o);
            return (
              <li key={o.key}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => onToggleOverlay(o.key)}
                  className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors",
                      on ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 size-3 rounded-full bg-background shadow-sm transition-transform",
                        on ? "translate-x-3.5" : "translate-x-0.5"
                      )}
                    />
                  </span>
                  <span className="flex flex-1 items-center gap-1.5">
                    {o.level && (
                      <span
                        className="h-0.5 w-3 rounded-full"
                        style={{ background: LEVEL_COLORS[theme === "dark" || basemap === "satellite" ? "dark" : "light"][o.level] }}
                      />
                    )}
                    {o.label}
                  </span>
                  {count && <span className="font-mono-tabular text-[11px] text-muted-foreground">{count}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex gap-2 border-t border-border pt-3">
        <ExportMenu {...exportProps} />
        <Button variant="outline" size="sm" onClick={onReset} aria-label="Reset view">
          <RotateCcw className="size-3.5" />
          Reset
        </Button>
      </section>
    </div>
  );
}

function Switch({ label, checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left text-sm transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className={cn("relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-muted-foreground/30")}>
        <span className={cn("absolute top-0.5 size-3 rounded-full bg-background shadow-sm transition-transform", checked ? "translate-x-3.5" : "translate-x-0.5")} />
      </span>
      <span className="flex-1">{label}</span>
    </button>
  );
}

function ExportMenu({ scope, onScope, hasDistrict, scopeLabel, geojsonHref, csvHref, onPng, exporting, levelPlural, counts }) {
  const count = counts?.[scope] ?? null;
  const empty = count === 0;
  const scopes = [
    ["view", "Current view"],
    ["district", "Selected district"],
    ["all", "All of Uganda"],
  ];
  return (
    <Popover>
      <PopoverTrigger render={<Button size="sm" className="flex-1" />}>
        <Download className="size-3.5" />
        Export
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-72 gap-3 p-3">
        <div>
          <p className="text-sm font-medium">Export {levelPlural}</p>
          <p className="text-xs text-muted-foreground">Boundaries with this map&apos;s figures, OCHA P-codes and UBOS codes.</p>
        </div>
        <div role="radiogroup" aria-label="Export scope" className="flex flex-col gap-0.5">
          {scopes.map(([key, label]) => {
            const disabled = key === "district" && !hasDistrict;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={scope === key}
                disabled={disabled}
                onClick={() => onScope(key)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40",
                  scope === key && "bg-muted font-medium"
                )}
              >
                <span
                  className={cn(
                    "size-3 shrink-0 rounded-full border border-muted-foreground/50",
                    scope === key && "border-[3px] border-primary"
                  )}
                />
                {label}
                <span className="ml-auto font-mono-tabular text-[11px] text-muted-foreground">
                  {disabled ? "none selected" : counts ? formatExact(counts[key]) : ""}
                </span>
              </button>
            );
          })}
        </div>
        {empty ? (
          <p className="rounded-md bg-muted px-2.5 py-2 text-xs text-muted-foreground">
            No {levelPlural} with a boundary polygon in this scope — try another scope or level.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" nativeButton={false} render={<a href={geojsonHref()} download />}>
              GeoJSON
            </Button>
            <Button variant="outline" size="sm" nativeButton={false} render={<a href={csvHref()} download />}>
              CSV
            </Button>
          </div>
        )}
        <Button variant="secondary" size="sm" onClick={onPng} disabled={exporting}>
          <ImageIcon className="size-3.5" />
          {exporting ? "Rendering…" : "PNG image of the map"}
        </Button>
        <p className="text-[11px] text-muted-foreground">Scope: {scopeLabel}. The image is always the current view.</p>
      </PopoverContent>
    </Popover>
  );
}
