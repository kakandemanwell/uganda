"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatCompact, formatExact } from "@/lib/format";
import { cn } from "@/lib/utils";

const VIEW_WIDTH = 720;
const VIEW_HEIGHT = 780;
// d3-geo's Mercator projection can mis-clip a ring that touches the exact
// edge of the fitted extent (observed on Uganda's dissolved region
// boundaries, where the westernmost vertex landed at x=0 precisely and
// triggered an extra full-canvas ring) — fitSize() fits edge-to-edge with
// zero padding, so *something* in the data will always touch that edge.
// fitExtent() with a small inset avoids the geometry ever touching the
// true boundary, sidestepping the bug entirely.
const PROJECTION_PADDING = 8;

// Fixed categorical palette for "by region" mode — matches the chart-2..5
// theme tokens (teal/orange/green/purple), deliberately skipping chart-1
// (== --primary, the high end of the population choropleth) so the two
// color modes never look visually related.
const REGION_COLOR_VAR = {
  "region:central": "var(--chart-2)",
  "region:eastern": "var(--chart-3)",
  "region:northern": "var(--chart-4)",
  "region:western": "var(--chart-5)",
};
const REGION_ORDER = ["region:central", "region:eastern", "region:northern", "region:western"];

function sqrtNormalize(value, min, max) {
  if (max === min) return 0;
  const t = (Math.sqrt(value) - Math.sqrt(min)) / (Math.sqrt(max) - Math.sqrt(min));
  return Math.min(1, Math.max(0, t));
}

export function UgandaMap({ regionsById, subregionsById, selectedId, onSelect }) {
  const [geojson, setGeojson] = useState(null);
  const [error, setError] = useState(false);
  const [mode, setMode] = useState("population");
  const [hover, setHover] = useState(null); // { feature, x, y }
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/geo/districts")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setGeojson(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { paths, populationRange } = useMemo(() => {
    if (!geojson) return { paths: [], populationRange: [0, 1] };
    const projection = geoMercator().fitExtent(
      [
        [PROJECTION_PADDING, PROJECTION_PADDING],
        [VIEW_WIDTH - PROJECTION_PADDING, VIEW_HEIGHT - PROJECTION_PADDING],
      ],
      geojson
    );
    const pathGenerator = geoPath(projection);
    const totals = geojson.features.map((f) => f.properties.population?.total ?? 0);
    const range = [Math.min(...totals), Math.max(...totals)];
    const built = geojson.features.map((f) => ({
      id: f.properties.id,
      name: f.properties.name,
      regionId: f.properties.region_id,
      subregionId: f.properties.subregion_id,
      population: f.properties.population,
      d: pathGenerator(f),
    }));
    return { paths: built, populationRange: range };
  }, [geojson]);

  function fillFor(item) {
    if (mode === "region") {
      return REGION_COLOR_VAR[item.regionId] ?? "var(--muted)";
    }
    const total = item.population?.total ?? 0;
    const t = sqrtNormalize(total, populationRange[0], populationRange[1]);
    const pct = Math.round(10 + t * 85); // keep even the lowest district visibly tinted
    return `color-mix(in oklch, var(--primary) ${pct}%, var(--muted))`;
  }

  function handlePointerMove(e, item) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ item, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  // Keyboard focus has no pointer position (FocusEvent carries no
  // clientX/clientY) — position the tooltip at the focused shape's own
  // center instead of trying to read coordinates that don't exist there.
  function handleFocus(e, item) {
    const rect = containerRef.current?.getBoundingClientRect();
    const targetRect = e.currentTarget.getBoundingClientRect();
    if (!rect) return;
    setHover({
      item,
      x: targetRect.left + targetRect.width / 2 - rect.left,
      y: targetRect.top + targetRect.height / 2 - rect.top,
    });
  }

  function select(item) {
    onSelect?.({
      id: item.id,
      name: item.name,
      region_id: item.regionId,
      subregion_id: item.subregionId,
      population: item.population,
    });
  }

  if (error) {
    return (
      <div className="flex aspect-[9/10] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        Couldn&apos;t load district boundaries. Try refreshing.
      </div>
    );
  }

  if (!geojson) {
    return <Skeleton className="aspect-[9/10] w-full rounded-lg" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Legend mode={mode} populationRange={populationRange} regionsById={regionsById} />
        {/* Base UI's ToggleGroup always deals in arrays (single-select is
            just "an array capped at one item" via multiple=false), unlike
            Radix's string-based type="single" API this component's
            variant names might suggest. */}
        <ToggleGroup
          value={[mode]}
          onValueChange={(values) => {
            if (values[0]) setMode(values[0]);
          }}
          size="sm"
          variant="outline"
          aria-label="Map color mode"
        >
          <ToggleGroupItem value="population">Population</ToggleGroupItem>
          <ToggleGroupItem value="region">Region</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div ref={containerRef} className="relative">
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          role="img"
          aria-label="Map of Uganda's 136 districts"
          className="w-full rounded-lg border border-border bg-card"
        >
          {paths.map((item) => {
            const isSelected = item.id === selectedId;
            const isHovered = hover?.item.id === item.id;
            return (
              <path
                key={item.id}
                d={item.d}
                tabIndex={0}
                role="button"
                aria-label={`${item.name} district`}
                onMouseMove={(e) => handlePointerMove(e, item)}
                onMouseLeave={() => setHover((h) => (h?.item.id === item.id ? null : h))}
                onFocus={(e) => handleFocus(e, item)}
                onBlur={() => setHover((h) => (h?.item.id === item.id ? null : h))}
                onClick={() => select(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    select(item);
                  }
                }}
                style={{ fill: fillFor(item) }}
                className={cn(
                  "cursor-pointer stroke-background/80 stroke-[0.75] outline-none transition-[stroke,filter] duration-100",
                  isHovered && "brightness-110",
                  isSelected && "stroke-primary stroke-2"
                )}
              />
            );
          })}
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-md border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md"
            style={{ left: hover.x, top: hover.y }}
          >
            <div className="font-medium">{hover.item.name}</div>
            <div className="text-xs text-muted-foreground">
              {regionsById[hover.item.regionId]?.name}
              {subregionsById[hover.item.subregionId] ? ` · ${subregionsById[hover.item.subregionId].name}` : ""}
            </div>
            {hover.item.population && (
              <div className="mt-1 font-mono-tabular text-xs">{formatExact(hover.item.population.total)} people</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Legend({ mode, populationRange, regionsById }) {
  if (mode === "region") {
    return (
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {REGION_ORDER.map((id) => (
          <span key={id} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: REGION_COLOR_VAR[id] }} />
            {regionsById[id]?.name}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{formatCompact(populationRange[0])}</span>
      <span
        className="h-2 w-24 rounded-full"
        style={{ background: "linear-gradient(to right, color-mix(in oklch, var(--primary) 10%, var(--muted)), var(--primary))" }}
      />
      <span>{formatCompact(populationRange[1])} people</span>
    </div>
  );
}
