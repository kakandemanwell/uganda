"use client";

// "What is here?" UI for /map: the place card (the full hierarchy at a
// clicked point, from /api/geo/at) and the right-click menu (coordinates,
// copy, inspect, open in other maps / street-level imagery).

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Crosshair, ExternalLink, MapPin, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LEVEL_COLORS, formatMetric } from "@/lib/map-config";
import { formatCompact, formatExact } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Frosted-glass surface for everything floating over the map: the map stays visible through it. */
export const GLASS =
  "border border-white/20 bg-background/55 shadow-lg backdrop-blur-md backdrop-saturate-150 dark:border-white/10 dark:bg-background/45";

export const LEVEL_ROWS = [
  ["region", "Region"],
  ["subregion", "Sub-region"],
  ["district", "District"],
  ["city", "City"],
  ["county", "County"],
  ["subcounty", "Subcounty"],
  ["parish", "Parish"],
];

export function toDms(value, pos, neg) {
  const hemi = value >= 0 ? pos : neg;
  const v = Math.abs(value);
  const d = Math.floor(v);
  const mFloat = (v - d) * 60;
  const m = Math.floor(mFloat);
  const s = ((mFloat - m) * 60).toFixed(1);
  return `${d}°${String(m).padStart(2, "0")}′${s.padStart(4, "0")}″${hemi}`;
}

export function placeSummary(place) {
  if (!place) return "";
  const { lat, lon } = place.point;
  const lines = [`${lat.toFixed(6)}, ${lon.toFixed(6)}  (${toDms(lat, "N", "S")} ${toDms(lon, "E", "W")})`];
  for (const [key, label] of LEVEL_ROWS) {
    const u = place.levels[key];
    if (u) lines.push(`${label}: ${u.name}${u.hdx_pcode ? ` [${u.hdx_pcode}]` : ""}`);
  }
  if (place.villages?.length) lines.push(`Villages (${place.villages.length}): ${place.villages.join(", ")}`);
  if (place.settlement) lines.push(`Refugee settlement: ${place.settlement.name}`);
  return lines.join("\n");
}

function useCopy() {
  const [copied, setCopied] = useState(null);
  const copy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 1400);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };
  return [copied, copy];
}

function LevelSwatch({ level, theme }) {
  const color = LEVEL_COLORS[theme === "dark" ? "dark" : "light"][level === "city" ? "district" : level];
  return <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background/60" style={{ background: color ?? "var(--muted-foreground)" }} />;
}

/** The full hierarchy at the inspected point. */
export function PlaceCard({ place, loading, theme, onClose, onZoom }) {
  const [copied, copy] = useCopy();
  if (loading && !place) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }
  if (!place) return null;
  const { lat, lon } = place.point;
  if (!place.inside_uganda) {
    return (
      <div className="flex items-start justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {lat.toFixed(5)}, {lon.toFixed(5)} is outside Uganda's mapped units.
        </span>
        <Button variant="ghost" size="icon" className="size-7" onClick={onClose} aria-label="Close place">
          <X className="size-4" />
        </Button>
      </div>
    );
  }
  const deepest = [...LEVEL_ROWS].reverse().map(([k]) => place.levels[k]).find(Boolean);
  const sub = place.levels.subcounty;
  const par = place.levels.parish;
  const figures = [
    ["Subcounty pop.", sub?.population != null ? formatCompact(sub.population) : null],
    ["District pop.", place.levels.district?.population != null ? formatCompact(place.levels.district.population) : null],
    ["Parish area", par?.area_km2 != null ? `${formatMetric("area_km2", par.area_km2)} km²` : null],
    ["Villages", place.villages?.length ? formatExact(place.villages.length) : null],
  ].filter(([, v]) => v);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <MapPin className="size-3" /> This place
          </div>
          <h2 className="truncate text-lg font-semibold tracking-tight">{deepest?.name ?? "—"}</h2>
          <button
            type="button"
            onClick={() => copy("coords", `${lat.toFixed(6)}, ${lon.toFixed(6)}`)}
            className="group flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
            title="Copy coordinates"
          >
            {lat.toFixed(5)}, {lon.toFixed(5)}
            {copied === "coords" ? <Check className="size-3" /> : <Copy className="size-3 opacity-0 group-hover:opacity-100" />}
          </button>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button variant="ghost" size="icon" className="size-7" onClick={() => copy("all", placeSummary(place))} aria-label="Copy place details" title="Copy place details">
            {copied === "all" ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={onClose} aria-label="Close place">
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <ol className="flex flex-col gap-1">
        {LEVEL_ROWS.map(([key, label]) => {
          const u = place.levels[key];
          if (!u) return null;
          return (
            <li key={key} className="flex items-start gap-2 text-sm">
              <LevelSwatch level={key} theme={theme} />
              <span className="w-20 shrink-0 text-[11px] leading-5 text-muted-foreground">{label}</span>
              <button
                type="button"
                disabled={!onZoom || key === "region" || key === "subregion"}
                onClick={() => onZoom?.(u.id, key)}
                className="min-w-0 flex-1 truncate text-left font-medium hover:underline disabled:no-underline"
              >
                {u.name}
              </button>
              {u.inferred && (
                <Badge variant="outline" className="h-5 text-[10px] font-normal" title={u.inference}>
                  inferred
                </Badge>
              )}
              {u.hdx_pcode && <span className="font-mono text-[10px] leading-5 text-muted-foreground">{u.hdx_pcode}</span>}
            </li>
          );
        })}
      </ol>

      {figures.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border/60 pt-2.5">
          {figures.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] text-muted-foreground">{label}</dt>
              <dd className="font-mono-tabular text-sm font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {place.settlement && (
        <p className="rounded-md bg-muted/60 px-2.5 py-2 text-xs">
          In <span className="font-medium">{place.settlement.name}</span> refugee settlement — land administered by{" "}
          {place.settlement.host_subcounties.join(", ")}.
        </p>
      )}
      {place.gap && (
        <p className="rounded-md bg-muted/60 px-2.5 py-2 text-xs">
          Unassigned land — belongs to one of: {place.gap.candidates.join(", ") || "units not yet identified"}.
        </p>
      )}

      {place.villages?.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border/60 pt-2.5">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Villages in {par?.name ?? "this parish"}
          </span>
          <div className="flex flex-wrap gap-1">
            {place.villages.map((v, i) => (
              <Badge key={`${v}-${i}`} variant="secondary" className="bg-secondary/70 font-normal">
                {v}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Right-click menu: coordinates, a short place summary, and actions. */
export function PlaceMenu({ menu, boxWidth, boxHeight, onInspect, onCentre, onClose }) {
  const [copied, copy] = useCopy();
  const [place, setPlace] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    setPlace(null);
    if (!menu) return;
    let cancelled = false;
    fetch(`/api/geo/at?lon=${menu.lng}&lat=${menu.lat}`)
      .then((r) => r.json())
      .then((p) => !cancelled && setPlace(p))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [menu, onClose]);
  if (!menu) return null;

  const { lat, lng } = menu;
  const W = 288;
  const left = Math.min(menu.x + 8, Math.max(8, boxWidth - W - 8));
  const top = Math.min(menu.y + 8, Math.max(8, boxHeight - 360));
  const decimal = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  const dms = `${toDms(lat, "N", "S")} ${toDms(lng, "E", "W")}`;
  const where = place?.levels
    ? [place.levels.parish, place.levels.subcounty, place.levels.district ?? place.levels.city].filter(Boolean).map((u) => u.name).join(", ")
    : null;
  const links = [
    ["Google Maps", `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`],
    ["Street View", `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`],
    ["Mapillary", `https://www.mapillary.com/app/?lat=${lat}&lng=${lng}&z=17`],
    ["OpenStreetMap", `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`],
  ];

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Place menu"
      className={cn("absolute z-30 flex w-72 flex-col gap-2 rounded-xl p-3 text-sm", GLASS)}
      style={{ left, top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[13px] font-medium">{decimal}</span>
          <Button variant="ghost" size="icon" className="size-6" onClick={() => copy("dec", decimal)} aria-label="Copy decimal coordinates">
            {copied === "dec" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">{dms}</span>
          <Button variant="ghost" size="icon" className="size-6" onClick={() => copy("dms", dms)} aria-label="Copy degrees-minutes-seconds">
            {copied === "dms" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
        <span className="min-h-4 text-xs text-muted-foreground">
          {place ? (place.inside_uganda ? where : "Outside Uganda") : "Looking up…"}
        </span>
      </div>
      <div className="flex flex-col border-t border-border/60 pt-1.5">
        <MenuItem icon={MapPin} onClick={() => onInspect(menu)}>
          Inspect this place
        </MenuItem>
        <MenuItem icon={Crosshair} onClick={() => onCentre(menu)}>
          Centre map here
        </MenuItem>
        <MenuItem icon={Copy} onClick={() => place && copy("all", placeSummary(place))} disabled={!place?.inside_uganda}>
          {copied === "all" ? "Copied" : "Copy place details"}
        </MenuItem>
      </div>
      <div className="flex flex-col border-t border-border/60 pt-1.5">
        {links.map(([label, href]) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noreferrer"
            role="menuitem"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-foreground/10"
          >
            <ExternalLink className="size-3.5 text-muted-foreground" />
            {label}
          </a>
        ))}
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, children, onClick, disabled }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-foreground/10 disabled:pointer-events-none disabled:opacity-40"
    >
      <Icon className="size-3.5 text-muted-foreground" />
      {children}
    </button>
  );
}
