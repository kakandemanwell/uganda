"use client";

// Side panel of /map: the selected district's headline figures, then a
// drill-down through its counties -> subcounties -> parishes -> villages.
// Selecting a subcounty with a boundary polygon zooms the map to it.

import { useEffect, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMetric } from "@/lib/map-config";
import { cn } from "@/lib/utils";

function useChildren(url) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    setItems(null);
    if (!url) return;
    let cancelled = false;
    fetch(url)
      .then((r) => r.json())
      .then((d) => !cancelled && setItems(d))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [url]);
  return items;
}

export function MapDrillPanel({ district, region, subregion, stats, subcountyHasBoundary, onZoomToUnit, onClose }) {
  const [countyId, setCountyId] = useState(null);
  const [subcountyId, setSubcountyId] = useState(null);
  const [parish, setParish] = useState(null);

  useEffect(() => {
    setCountyId(null);
    setSubcountyId(null);
    setParish(null);
  }, [district?.id]);

  const counties = useChildren(district ? `/api/districts/${district.id}/counties` : null);
  const subcounties = useChildren(countyId ? `/api/counties/${countyId}/subcounties` : null);
  const parishes = useChildren(subcountyId ? `/api/subcounties/${subcountyId}/parishes` : null);
  // /api/units is paginated ({ total, page, pageSize, items }), unlike the
  // hierarchy endpoints above, which return a plain array.
  const villageResponse = useChildren(parish ? `/api/units?level=village&parishId=${encodeURIComponent(parish.id)}&pageSize=200` : null);
  const villages = villageResponse?.items ?? null;

  if (!district) {
    return (
      <div className="flex h-full min-h-40 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border px-6 py-10 text-center">
        <p className="text-sm font-medium">No district selected</p>
        <p className="text-xs text-muted-foreground">Click any polygon on the map to drill into its district.</p>
      </div>
    );
  }

  const figures = [
    ["Population", stats?.population != null ? formatMetric("population", stats.population) : null],
    ["People / km²", stats?.density != null ? formatMetric("density", stats.density) : null],
    ["Land area", stats?.area_km2 != null ? `${formatMetric("area_km2", stats.area_km2)} km²` : null],
    ["Villages", stats?.villages != null ? formatMetric("villages", stats.villages) : null],
  ].filter(([, v]) => v);

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight">{district.name}</h2>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {region && <Badge variant="secondary">{region.name}</Badge>}
            {subregion && <Badge variant="outline">{subregion.name}</Badge>}
            {district.external_refs?.hdx_pcode && (
              <Badge variant="outline" className="font-mono font-normal" title="OCHA COD-AB P-code">
                {district.external_refs.hdx_pcode}
              </Badge>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose} aria-label="Close district">
          <X className="size-4" />
        </Button>
      </div>

      {figures.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          {figures.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] text-muted-foreground">{label}</dt>
              <dd className="font-mono-tabular text-base font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {stats?.population != null && (
        <p className="-mt-2 text-[11px] text-muted-foreground">2024 census; includes any city inside the district.</p>
      )}

      <a
        href={`/unit/${encodeURIComponent(district.id)}`}
        className="-mt-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Full district record →
      </a>

      <DrillLevel
        title="County / Municipality"
        items={counties}
        selectedId={countyId}
        onSelect={(item) => {
          setCountyId(item.id);
          setSubcountyId(null);
          setParish(null);
          onZoomToUnit(item.id, "county");
        }}
      />

      {countyId && (
        <DrillLevel
          title="Subcounty / Town council / Division"
          items={subcounties}
          selectedId={subcountyId}
          hasBoundary={subcountyHasBoundary ? (item) => subcountyHasBoundary(item.id) : null}
          onSelect={(item) => {
            setSubcountyId(item.id);
            setParish(null);
            onZoomToUnit(item.id, "subcounty");
          }}
        />
      )}

      {subcountyId && (
        <DrillLevel
          title="Parish / Ward"
          items={parishes}
          selectedId={parish?.id}
          onSelect={(item) => {
            setParish(item);
            onZoomToUnit(item.id, "parish");
          }}
        />
      )}

      {parish && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Villages in {parish.name}</span>
          {!villages ? (
            <Skeleton className="h-16 w-full" />
          ) : villages.length === 0 ? (
            <p className="text-xs text-muted-foreground">No villages found for this parish.</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {villages.map((v) => (
                <Badge key={v.id} variant="secondary" className="font-normal">
                  {v.village}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DrillLevel({ title, note, items, selectedId, hasBoundary, onSelect }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{title}</span>
        {note && <span className="text-[10px] text-muted-foreground">{note}</span>}
      </div>
      {!items ? (
        <Skeleton className="h-9 w-full" />
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">None found.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  selectedId === item.id && "bg-muted font-medium"
                )}
              >
                <span className="truncate">{item.name}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {hasBoundary && !hasBoundary(item) && (
                    <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                      no boundary
                    </Badge>
                  )}
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
