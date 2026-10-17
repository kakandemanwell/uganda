// Shared by the map UI (components/map-explorer.jsx) and the API routes
// behind it (app/api/geo/stats, app/api/geo/export), so both sides agree on
// which boundary levels exist, which metrics each level can be coloured by,
// and how a metric reads.

export const MAP_LEVELS = [
  { key: "region", label: "Region", plural: "regions", source: "/api/geo/regions" },
  { key: "subregion", label: "Sub-region", short: "Sub-reg.", plural: "sub-regions", source: "/api/geo/subregions" },
  { key: "district", label: "District", plural: "districts", source: "/api/geo/districts" },
  { key: "county", label: "County", plural: "counties", source: "/api/geo/counties" },
  { key: "subcounty", label: "Subcounty", short: "Subcty", plural: "subcounties", source: "/api/geo/subcounties" },
  { key: "parish", label: "Parish", plural: "parishes", source: "/api/geo/parishes" },
];
export const MAP_LEVEL_KEYS = MAP_LEVELS.map((l) => l.key);
export const levelInfo = (key) => MAP_LEVELS.find((l) => l.key === key);

// `levels` = the boundary levels a metric is meaningful on. Population is
// only published down to district/city (NPHC 2024), so it and density stop
// there; the unit counts work at every level that has units below it.
export const METRICS = [
  {
    key: "population",
    label: "Population (2024)",
    levels: ["region", "subregion", "district", "county", "subcounty"],
    format: "compact",
    note: "NPHC 2024. A district's figure includes any city carved out of it. Subcounty figures are UBOS's, matched to EC units (refugee settlements counted separately); counties sum their subcounties.",
  },
  {
    key: "density",
    label: "People per km²",
    levels: ["region", "subregion", "district", "county", "subcounty"],
    format: "integer",
    note: "2024 population over land area.",
  },
  { key: "subcounties", label: "Subcounties", levels: ["region", "subregion", "district", "county"], format: "integer", note: "Subcounties, town councils and divisions (EC, July 2022)." },
  { key: "parishes", label: "Parishes", levels: ["region", "subregion", "district", "county", "subcounty"], format: "integer", note: "Parishes and wards (EC, July 2022)." },
  { key: "villages", label: "Villages", levels: ["region", "subregion", "district", "county", "subcounty", "parish"], format: "integer", note: "Villages and cells (EC, July 2022)." },
  {
    key: "villages_per_km2",
    label: "Villages per km²",
    levels: ["region", "subregion", "district", "county", "subcounty", "parish"],
    format: "decimal",
    note: "How finely the land is divided — high in towns and dense farmland.",
  },
  { key: "area_km2", label: "Land area (km²)", levels: ["region", "subregion", "district", "county", "subcounty", "parish"], format: "decimal" },
  {
    key: "agreement",
    label: "Boundary agreement",
    levels: ["subcounty"],
    format: "percent",
    note: "Overlap (IoU) between this subcounty's polygon — built from UBOS's 2025 parishes — and UBOS's own 2024 census subcounty polygon. Pale = they disagree: usually a refugee-settlement host that absorbed settlement land, or a unit reorganised between the two censuses. OCHA's 2020 overlap is in data/qa/boundary-agreement.csv.",
  },
  {
    key: "subcounty_coverage",
    label: "Subcounty map coverage",
    levels: ["region", "subregion", "district"],
    format: "percent",
    note: "Share of subcounties with a boundary polygon in this dataset — where the subcounty layer has gaps.",
  },
];
export const metricInfo = (key) => METRICS.find((m) => m.key === key);
export const metricsForLevel = (level) => METRICS.filter((m) => m.levels.includes(level));

/** Overlay layers that can be toggled, in draw order (bottom to top). */
export const OVERLAYS = [
  { key: "gaps", label: "Unassigned land" },
  { key: "settlements", label: "Refugee settlements" },
  { key: "parishes", label: "Parish lines", level: "parish" },
  { key: "subcounties", label: "Subcounty lines", level: "subcounty" },
  { key: "counties", label: "County lines", level: "county" },
  { key: "districts", label: "District lines", level: "district" },
  { key: "subregions", label: "Sub-region lines", level: "subregion" },
  { key: "regions", label: "Region lines", level: "region" },
  { key: "roads", label: "Major roads" },
  { key: "labels", label: "Names" },
];
export const OVERLAY_KEYS = OVERLAYS.map((o) => o.key);

export const DEFAULT_STATE = {
  level: "district",
  metric: "population",
  overlays: ["districts", "regions", "labels"],
  basemap: "map",
  opacity: 0.2,
  fill: true,
  mode: "data",
  terrain: false,
};

/**
 * Display modes: "data" colours the chosen level by a metric (choropleth);
 * "hierarchy" colours every level's boundaries by level — region down to
 * parish — so it's clear which line is a county and which a parish, with
 * only a faint tint, leaving the basemap the main thing on screen.
 */
export const MODES = [
  { key: "data", label: "Data" },
  { key: "hierarchy", label: "Hierarchy" },
];

/**
 * One colour per administrative level, used for that level's boundary lines
 * everywhere (and its faint fill in hierarchy mode). Slots 2-7 of the
 * dataviz reference categorical palette, in hierarchy order — validated with
 * its validate_palette.js: every adjacent pair passes the CVD (>= 8.4) and
 * normal-vision (>= 19.3) separation floors in both modes. Blue (slot 1) is
 * left out because the choropleth ramp is blue. Light-mode yellow/aqua/
 * magenta sit under 3:1 on the surface, so every level also has its own line
 * weight and a labelled legend (the palette's "relief rule").
 */
export const LEVEL_COLORS = {
  light: { region: "#eb6834", subregion: "#1baf7a", district: "#eda100", county: "#e87ba4", subcounty: "#008300", parish: "#6250d6" },
  dark: { region: "#d95926", subregion: "#199e70", district: "#c98500", county: "#d55181", subcounty: "#008300", parish: "#9085e9" },
};
export const BASEMAPS = [
  { key: "map", label: "Map" },
  { key: "satellite", label: "Satellite" },
];

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function formatMetric(metricKey, value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  switch (metricInfo(metricKey)?.format) {
    case "compact":
      return compact.format(value);
    case "percent":
      return `${Math.round(value * 100)}%`;
    case "decimal":
      return decimal.format(value);
    default:
      return integer.format(value);
  }
}

// Sequential single-hue ramp (blue — the site's primary hue), five classes,
// light -> dark for magnitude. Dark mode gets its own steps rather than a
// flip of the light ones: low values recede toward the dark surface, high
// values come forward. Steps are from the dataviz reference ramp.
export const RAMPS = {
  light: ["#b7d3f6", "#86b6ef", "#5598e7", "#2a78d6", "#1c5cab"],
  dark: ["#104281", "#1c5cab", "#2a78d6", "#5598e7", "#9ec5f4"],
};
export const NO_DATA = { light: "#e7e5e1", dark: "#2f2f2c" };

/**
 * Quantile class breaks: the lower bounds of classes 2..n (so at most n-1
 * numbers). With few polygons (4 regions) or many ties, plain quantiles
 * produce empty or zero-width classes, so the class count is capped at the
 * number of distinct values and a break never equals the minimum or
 * repeats.
 */
export function quantileBreaks(values, classes = 5) {
  const sorted = values.filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return [];
  const n = Math.min(classes, new Set(sorted).size);
  const breaks = [];
  for (let i = 1; i < n; i++) {
    const b = sorted[Math.min(sorted.length - 1, Math.floor((i * sorted.length) / n))];
    if (b > sorted[0] && (!breaks.length || b > breaks[breaks.length - 1])) breaks.push(b);
  }
  return breaks;
}

/**
 * The colour of each class for `breaks` (from quantileBreaks), spreading the
 * ramp across however many classes the data actually has — quantile breaks
 * collapse when many polygons share a value. Shared by the map's fill
 * expression and its legend, so the two can never disagree.
 */
export function classColors(breaks, ramp) {
  const classes = breaks.length + 1;
  if (classes === 1) return [ramp[ramp.length - 1]];
  return Array.from({ length: classes }, (_, i) => ramp[Math.round((i * (ramp.length - 1)) / (classes - 1))]);
}

/** Basemaps: OpenFreeMap vector styles — no API key, and free for commercial use (CARTO's free tier is not). */
export const BASEMAP_STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};
export const BASEMAP_ATTRIBUTION = "Basemap © OpenFreeMap, © OpenMapTiles, © OpenStreetMap contributors";
export const SATELLITE_ATTRIBUTION = "Powered by Esri · Imagery: Esri, Maxar, Earthstar Geographics, and the GIS User Community";

/**
 * The satellite basemap: Esri World Imagery through this app's own tile
 * proxy (app/api/tiles/esri — keeps the ArcGIS key server-side), with
 * OpenFreeMap's glyphs so the map's own labels still render. Rural Uganda
 * has no imagery past z18.
 */
export function satelliteStyle(origin) {
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      esri: {
        type: "raster",
        tiles: [`${origin}/api/tiles/esri/{z}/{y}/{x}`],
        tileSize: 256,
        maxzoom: 18,
        attribution: SATELLITE_ATTRIBUTION,
      },
    },
    layers: [{ id: "esri-imagery", type: "raster", source: "esri" }],
  };
}
export const DATA_ATTRIBUTION_SHORT = "Boundaries: UBOS / OCHA COD-AB (CC BY-IGO) · uganda-locale";
export const DATA_ATTRIBUTION =
  "Boundaries: UBOS via OCHA COD-AB (CC BY-IGO) · Units: Electoral Commission 2022 · Population: UBOS NPHC 2024 · uganda-locale";

/** Uganda's bounding box, [west, south, east, north]. */
export const UGANDA_BBOX = [29.57, -1.48, 35.04, 4.23];
