"use client";

// The MapLibre GL map behind /map. Owns nothing but the WebGL map itself:
// everything it draws comes in through props (boundary GeoJSON already
// fetched by the parent, per-polygon values, class breaks, which overlays
// are on, basemap and fill opacity), and everything that happens on it goes
// back out through callbacks. That keeps all page state in
// components/map-explorer.jsx and lets this component re-sync idempotently
// whenever anything changes.
//
// How values reach the map: each boundary level is one GeoJSON source with
// promoteId "id", and the choropleth value is written per feature with
// setFeatureState — so switching metric only rewrites numbers, never
// re-uploads geometry (the same join pattern the SIIMS insights map and
// osirisai.live use).

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  BASEMAP_STYLES,
  DATA_ATTRIBUTION_SHORT,
  LEVEL_COLORS,
  MAP_LEVELS,
  NO_DATA,
  UGANDA_BBOX,
  classColors,
  satelliteStyle,
} from "@/lib/map-config";

// Colour sets per basemap. On imagery everything flips to light ink with
// dark halos — nothing dark reads on a satellite photo of green land — and
// selection is white, since yellow is the district level's colour.
const PALETTES = {
  light: { ink: "#3f3f3c", surface: "#ffffff", road: "#c0773a", selected: "#111110", halo: "#ffffff", hatch: [63, 63, 60] },
  dark: { ink: "#d4d4d0", surface: "#141414", road: "#d9965c", selected: "#fafaf9", halo: "#141414", hatch: [212, 212, 208] },
  satellite: { ink: "#ffffff", surface: "rgba(255,255,255,0.7)", road: "#ffb347", selected: "#ffffff", halo: "#000000", hatch: [255, 255, 255] },
};
const paletteFor = (theme, basemap) => PALETTES[basemap === "satellite" ? "satellite" : theme];
// Level colours: the brighter (dark-mode) steps on imagery and dark maps.
const levelColorsFor = (theme, basemap) => LEVEL_COLORS[basemap === "satellite" || theme === "dark" ? "dark" : "light"];

// Elevation for the 3D view: AWS Terrain Tiles (Mapzen terrarium encoding,
// public, no key), 0-15. Two sources over the same tiles, as MapLibre
// recommends: one drives the terrain mesh, one the hillshading.
const DEM_TILES = ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"];
const DEM_SOURCE = { type: "raster-dem", tiles: DEM_TILES, encoding: "terrarium", tileSize: 256, maxzoom: 15, attribution: "Elevation: AWS Terrain Tiles (Mapzen)" };

// Line weight per level when drawn as an overlay (thicker = coarser).
const LINE_WIDTH = {
  region: [5, 1.6, 10, 3],
  subregion: [5, 1.2, 10, 2.4],
  district: [5, 0.6, 10, 1.6],
  county: [6, 0.4, 11, 1.2],
  subcounty: [7, 0.3, 12, 1],
  parish: [8, 0.25, 13, 0.9],
};
// The fill clears like cloud on the way down: full strength until the first
// zoom, gone by the second — by then the screen sits inside a handful of
// units and the imagery/streets underneath are the information. Lines stay.
const FILL_FADE = {
  region: [8, 10],
  subregion: [8.5, 10.5],
  district: [9.5, 12],
  county: [10.5, 13],
  subcounty: [11.5, 14],
  parish: [12.5, 15],
};
const LABEL_MINZOOM ={ region: 4, subregion: 5, district: 6.6, county: 8, subcounty: 9.4, parish: 10.6 };

function blankStyle(theme) {
  return {
    version: 8,
    sources: {},
    layers: [{ id: "background", type: "background", paint: { "background-color": theme === "dark" ? "#141414" : "#f4f3ef" } }],
  };
}

const src = (level) => `ul-${level}`;
const zoomInterp = ([z0, w0, z1, w1]) => ["interpolate", ["linear"], ["zoom"], z0, w0, z1, w1];

function fillColor(breaks, ramp, noData) {
  const colors = classColors(breaks, ramp);
  const step = ["step", ["feature-state", "v"], colors[0]];
  breaks.forEach((b, i) => step.push(b, colors[i + 1]));
  return ["case", ["==", ["typeof", ["feature-state", "v"]], "number"], breaks.length ? step : colors[0], noData];
}

// Diagonal hatching for land no unit could be assigned (the gaps layer),
// drawn as a pattern image so it reads as "unknown", not as a value.
function hatchImage([r, g, b]) {
  const size = 10;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const on = (x + y) % size < 2;
      const i = (y * size + x) * 4;
      data.set(on ? [r, g, b, 200] : [r, g, b, 28], i);
    }
  }
  return { width: size, height: size, data };
}

export function MapCanvas({
  theme,
  basemap = "map",
  opacity = 0.2,
  fill = true,
  mode = "data",
  terrain = false,
  placePoint,
  geo,
  labelPoints,
  level,
  metric,
  values,
  breaks,
  ramp,
  overlays,
  selectedId,
  focusFeature,
  fitRequest,
  initialView,
  layoutKey,
  onHover,
  onPick,
  onView,
  onPointer,
  onContextMenu,
  onMap,
  onReady,
  padding = 24,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  // Latest props, read by map event handlers and the style.load re-sync
  // (both outlive any one render).
  const props = useRef({});
  props.current = {
    padding, theme, basemap, opacity, fill, mode, terrain, placePoint, geo, labelPoints, level, metric, values, breaks, ramp, overlays, selectedId,
    focusFeature, onHover, onPick, onView, onPointer, onContextMenu,
  };
  const runtime = useRef({ styleReady: false, fellBack: false, styleGen: 0, applied: {}, hovered: null, selected: null, fonts: null });

  function styleFor(theme, basemap) {
    if (basemap === "satellite") return satelliteStyle(window.location.origin);
    return runtime.current.fellBack ? blankStyle(theme) : BASEMAP_STYLES[theme];
  }

  // ---- create the map once ----
  useEffect(() => {
    let cancelled = false;
    let map;
    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      // See web/scripts/sync-data.mjs: the worker can't be resolved from a
      // webpack bundle, so it's served from public/vendor.
      maplibre.setWorkerUrl(`/vendor/maplibre/${maplibre.getVersion()}/maplibre-gl-worker.mjs`);
      map = new maplibre.Map({
        container: containerRef.current,
        style: styleFor(props.current.theme, props.current.basemap),
        ...(initialView ? { center: initialView.center, zoom: initialView.zoom } : { bounds: UGANDA_BBOX, fitBoundsOptions: { padding: props.current.padding } }),
        minZoom: 4,
        // imagery goes to z18 even in rural Uganda; the data itself is fine
        // to look at that close
        maxZoom: 18,
        // Point of view: right-drag (or Ctrl+drag) rotates and tilts, two-
        // finger twist/drag on touch; the compass resets north and pitch.
        dragRotate: true,
        pitchWithRotate: true,
        touchPitch: true,
        maxPitch: 70,
        attributionControl: { compact: true, customAttribution: DATA_ATTRIBUTION_SHORT },
      });
      // Controls sit bottom-right, clear of the floating panels.
      map.addControl(new maplibre.NavigationControl({ showCompass: true, visualizePitch: true }), "bottom-right");
      map.addControl(new maplibre.FullscreenControl({ container: containerRef.current.parentElement }), "bottom-right");
      map.addControl(new maplibre.ScaleControl({ unit: "metric" }), "bottom-right");
      mapRef.current = map;
      onMap?.(map);
      if (process.env.NODE_ENV !== "production") window.__ulMap = map; // dev-only debugging handle
      // Compact attribution still starts expanded on wide screens, where its
      // one long line runs under the status readout; start it collapsed
      // (the "i" button expands it, as usual).
      map.once("load", () => map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"));

      // Vector basemap unreachable (offline, blocked, provider down): fall
      // back to a plain background so the data layers still render.
      map.on("error", (e) => {
        const rt = runtime.current;
        if (!rt.styleReady && !rt.fellBack && props.current.basemap !== "satellite") {
          rt.fellBack = true;
          console.warn("[map] basemap style failed to load, using a blank background", e?.error);
          map.setStyle(blankStyle(props.current.theme));
        }
      });
      map.on("style.load", () => {
        const rt = runtime.current;
        rt.styleReady = true;
        rt.styleGen++;
        rt.applied = {};
        rt.hovered = null;
        rt.selected = null;
        rt.labelData = null;
        rt.focusData = null;
        rt.fonts = findBasemapFonts(map);
        const pal = paletteFor(props.current.theme, props.current.basemap);
        if (map.hasImage("ul-hatch")) map.removeImage("ul-hatch");
        map.addImage("ul-hatch", hatchImage(pal.hatch));
        sync(map);
        onReady?.();
      });

      let frame = 0;
      map.on("mousemove", (e) => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          handleHover(map, e);
        });
      });
      map.on("mouseout", () => {
        setHovered(map, null);
        props.current.onHover?.(null);
        props.current.onPointer?.(null);
      });
      map.on("click", (e) => {
        const hit = hitTest(map, e.point);
        props.current.onPick?.({ id: hit?.id, level: hit?.level, properties: hit?.properties ?? {}, lngLat: [e.lngLat.lng, e.lngLat.lat] });
      });
      // Right button: a drag rotates/tilts (above); a click without moving
      // opens the place menu. Windows fires contextmenu after the drag, so
      // the distance from the press decides which one it was.
      let rightDown = null;
      map.on("mousedown", (e) => {
        if (e.originalEvent.button === 2) rightDown = { x: e.point.x, y: e.point.y };
      });
      map.on("contextmenu", (e) => {
        e.preventDefault();
        const moved = rightDown ? Math.hypot(e.point.x - rightDown.x, e.point.y - rightDown.y) : 0;
        rightDown = null;
        if (moved > 5) return;
        props.current.onContextMenu?.({ x: e.point.x, y: e.point.y, lng: e.lngLat.lng, lat: e.lngLat.lat });
      });
      map.on("movestart", () => props.current.onContextMenu?.(null));
      map.on("moveend", () => emitView(map));
      map.once("load", () => {
        runtime.current.mapLoaded = true;
        // opened with terrain on (?terrain=1): tilt so the relief shows
        if (props.current.terrain && map.getPitch() < 20) map.easeTo({ pitch: 55, duration: 800 });
        if (pendingFit.current) applyFit(map, pendingFit.current);
        pendingFit.current = null;
        emitView(map);
      });
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // initialView/onMap/onReady are read once, at creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- theme / basemap: swap the style, then re-add our layers on style.load ----
  const lastStyle = useRef(`${theme}|${basemap}`);
  useEffect(() => {
    const map = mapRef.current;
    const key = `${theme}|${basemap}`;
    if (!map || lastStyle.current === key) return;
    lastStyle.current = key;
    runtime.current.styleReady = false;
    map.setStyle(styleFor(theme, basemap), { diff: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, basemap]);

  // ---- terrain on: tilt the camera so the relief is visible ----
  const lastTerrain = useRef(terrain);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || lastTerrain.current === terrain) return;
    lastTerrain.current = terrain;
    if (terrain && map.getPitch() < 20) map.easeTo({ pitch: 55, duration: 800 });
    if (!terrain && map.getPitch() > 0) map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
  }, [terrain]);

  // ---- the container changed size (a side panel opened or closed) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const id = requestAnimationFrame(() => map.resize());
    return () => cancelAnimationFrame(id);
  }, [layoutKey]);

  // ---- everything else: idempotent re-sync ----
  useEffect(() => {
    const map = mapRef.current;
    if (map && runtime.current.styleReady) sync(map);
  });

  // ---- camera requests from the parent ----
  // A request can arrive before the map exists (boundary data often loads
  // faster than maplibre-gl's own chunk, e.g. for ?focus=), so it's parked
  // until the map's first "load".
  const pendingFit = useRef(null);
  function applyFit(map, req) {
    map.fitBounds(req.bbox, { padding: props.current.padding, duration: 700, maxZoom: req.maxZoom ?? 11.5 });
  }
  useEffect(() => {
    if (!fitRequest?.bbox) return;
    const map = mapRef.current;
    if (map && runtime.current.mapLoaded) applyFit(map, fitRequest);
    else pendingFit.current = fitRequest;
  }, [fitRequest]);

  function emitView(map) {
    const b = map.getBounds();
    const c = map.getCenter();
    props.current.onView?.({
      center: [c.lng, c.lat],
      zoom: map.getZoom(),
      bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
    });
  }

  // Unmapped land answers hover/click before the choropleth under it.
  function hitTest(map, point) {
    const { level, overlays } = props.current;
    if (overlays.includes("gaps") && map.getLayer("ul-gaps-fill")) {
      const g = map.queryRenderedFeatures(point, { layers: ["ul-gaps-fill"] })[0];
      if (g) return { id: g.properties.id, level: "gap", properties: g.properties };
    }
    const layer = `${src(level)}-fill`;
    if (!map.getLayer(layer)) return null;
    const f = map.queryRenderedFeatures(point, { layers: [layer] })[0];
    return f ? { id: f.id ?? f.properties.id, level, properties: f.properties } : null;
  }

  function setHovered(map, next) {
    const rt = runtime.current;
    const key = next ? `${next.level}|${next.id}` : null;
    const prevKey = rt.hovered ? `${rt.hovered.level}|${rt.hovered.id}` : null;
    if (key === prevKey) return;
    if (rt.hovered && rt.hovered.level !== "gap" && map.getSource(src(rt.hovered.level))) {
      map.setFeatureState({ source: src(rt.hovered.level), id: rt.hovered.id }, { hover: false });
    }
    if (next && next.level !== "gap" && map.getSource(src(next.level))) {
      map.setFeatureState({ source: src(next.level), id: next.id }, { hover: true });
    }
    rt.hovered = next;
  }

  function handleHover(map, e) {
    props.current.onPointer?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    const hit = hitTest(map, e.point);
    setHovered(map, hit);
    map.getCanvas().style.cursor = hit ? "pointer" : "";
    props.current.onHover?.(hit ? { ...hit, x: e.point.x, y: e.point.y } : null);
  }

  // Adds whatever sources/layers are missing and sets every paint/visibility
  // property from current props. Safe to call any number of times.
  function sync(map) {
    const p = props.current;
    const rt = runtime.current;
    const pal = paletteFor(p.theme, p.basemap);
    const levelColor = levelColorsFor(p.theme, p.basemap);
    const satellite = p.basemap === "satellite";
    const hierarchy = p.mode === "hierarchy";
    ensureAnchors(map);
    syncTerrain(map, p.terrain);

    for (const { key: lvl } of MAP_LEVELS) {
      const fc = p.geo[lvl];
      const isChoropleth = lvl === p.level;
      const isOverlay = p.overlays.includes(overlayFor(lvl));
      if (!fc) continue;
      const s = src(lvl);
      if (!map.getSource(s)) {
        map.addSource(s, { type: "geojson", data: fc, promoteId: "id" });
        rt.applied[lvl] = null;
      }
      if (!map.getLayer(`${s}-fill`)) {
        map.addLayer({ id: `${s}-fill`, type: "fill", source: s, paint: { "fill-opacity": 0 } }, "ul-anchor-fill");
        map.addLayer({ id: `${s}-line`, type: "line", source: s, layout: { "line-join": "round" } }, `ul-anchor-line-${lvl}`);
        // Boundaries inferred from the "no new land" rule rather than read
        // from a source: dashed, so they never pass for surveyed lines.
        map.addLayer(
          { id: `${s}-inferred`, type: "line", source: s, filter: ["==", ["get", "inferred"], true], layout: { "line-join": "round" } },
          `ul-anchor-line-${lvl}`
        );
      }
      if (!map.getLayer(`${s}-focus`)) {
        // hover + selection outlines sit above every level's lines
        map.addLayer({ id: `${s}-focus`, type: "line", source: s, layout: { "line-join": "round" }, paint: { "line-width": 0 } }, "ul-anchor-focus");
      }

      map.setLayoutProperty(`${s}-fill`, "visibility", isChoropleth ? "visible" : "none");
      if (isChoropleth) {
        // hierarchy mode: a faint tint in the level's own colour instead of
        // the metric ramp — the boundaries carry the information
        map.setPaintProperty(`${s}-fill`, "fill-color", hierarchy ? levelColor[lvl] : fillColor(p.breaks, p.ramp, NO_DATA[p.theme]));
        // fill switched off: the layer stays (it's what hover/click hit) but
        // draws nothing, leaving just the boundaries
        const op = p.fill ? p.opacity : 0;
        const hoverOp = p.fill ? Math.min(1, op + 0.14) : 0;
        const [fadeFrom, fadeTo] = FILL_FADE[lvl];
        map.setPaintProperty(`${s}-fill`, "fill-opacity", [
          "interpolate", ["linear"], ["zoom"],
          fadeFrom, ["case", ["boolean", ["feature-state", "hover"], false], hoverOp, op],
          // a trace of hover survives the fade, so the pointer still finds
          // its unit over the imagery
          fadeTo, ["case", ["boolean", ["feature-state", "hover"], false], p.fill ? 0.06 : 0, 0],
        ]);
      }

      // Lines: the choropleth level gets a thin surface-coloured gap between
      // its fills; overlay levels draw in ink on top of that.
      // Every level's lines are drawn in that level's colour, so a county
      // line never passes for a parish line. The choropleth level without
      // its overlay switched on gets only a thin separating line.
      const showLine = isChoropleth || isOverlay;
      map.setLayoutProperty(`${s}-line`, "visibility", showLine ? "visible" : "none");
      if (showLine) {
        const coloured = isOverlay || hierarchy;
        map.setPaintProperty(`${s}-line`, "line-color", coloured ? levelColor[lvl] : pal.surface);
        map.setPaintProperty(`${s}-line`, "line-opacity", coloured ? (satellite ? 0.95 : 0.85) : 0.9);
        map.setPaintProperty(`${s}-line`, "line-width", zoomInterp(LINE_WIDTH[lvl]));
        // undefined resets to the default solid line ([1, 0] doesn't render
        // reliably solid)
        map.setPaintProperty(`${s}-line`, "line-dasharray", undefined);
      }
      map.setLayoutProperty(`${s}-inferred`, "visibility", showLine ? "visible" : "none");
      map.setPaintProperty(`${s}-inferred`, "line-color", pal.ink);
      map.setPaintProperty(`${s}-inferred`, "line-width", 1.4);
      map.setPaintProperty(`${s}-inferred`, "line-dasharray", [2, 2]);

      map.setLayoutProperty(`${s}-focus`, "visibility", "visible");
      map.setPaintProperty(`${s}-focus`, "line-color", ["case", ["boolean", ["feature-state", "selected"], false], pal.selected, pal.ink]);
      map.setPaintProperty(`${s}-focus`, "line-width", [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        3,
        ["boolean", ["feature-state", "hover"], false],
        isChoropleth ? 1.8 : 0,
        0,
      ]);

      // Choropleth values -> feature-state, only when something changed.
      if (isChoropleth && p.values) {
        const key = `${p.metric}|${rt.styleGen}`;
        if (rt.applied[lvl]?.key !== key || rt.applied[lvl]?.values !== p.values) {
          for (const f of fc.features) {
            const v = p.values[f.properties.id]?.[p.metric];
            map.setFeatureState({ source: s, id: f.properties.id }, { v: typeof v === "number" ? v : null });
          }
          rt.applied[lvl] = { key, values: p.values };
        }
      }
    }

    // Selection (a district, from the drill-down panel).
    const sel = p.selectedId && p.geo.district ? { level: "district", id: p.selectedId } : null;
    const selKey = sel ? `${sel.id}|${rt.styleGen}` : null;
    if (selKey !== rt.selected?.key) {
      if (rt.selected && map.getSource(src(rt.selected.level))) {
        map.setFeatureState({ source: src(rt.selected.level), id: rt.selected.id }, { selected: false });
      }
      if (sel && map.getSource(src(sel.level))) map.setFeatureState({ source: src(sel.level), id: sel.id }, { selected: true });
      rt.selected = sel ? { ...sel, key: selKey } : null;
    }

    // The unit drilled into below district (a county, subcounty or parish
    // picked in the side panel), outlined without loading its whole layer.
    const focusData = p.focusFeature ?? { type: "FeatureCollection", features: [] };
    if (!map.getSource("ul-focus-unit")) {
      map.addSource("ul-focus-unit", { type: "geojson", data: focusData });
      map.addLayer({ id: "ul-focus-unit", type: "line", source: "ul-focus-unit", layout: { "line-join": "round" } }, "ul-anchor-focus");
    } else if (rt.focusData !== focusData) {
      map.getSource("ul-focus-unit").setData(focusData);
    }
    rt.focusData = focusData;
    map.setPaintProperty("ul-focus-unit", "line-color", pal.selected);
    map.setPaintProperty("ul-focus-unit", "line-width", 2.4);

    // Pin at the inspected place (left-click / "inspect here").
    const pinData = p.placePoint
      ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: p.placePoint } }] }
      : { type: "FeatureCollection", features: [] };
    if (!map.getSource("ul-pin")) {
      map.addSource("ul-pin", { type: "geojson", data: pinData });
      map.addLayer({ id: "ul-pin", type: "circle", source: "ul-pin" });
    } else if (rt.pinData !== pinData) {
      map.getSource("ul-pin").setData(pinData);
    }
    rt.pinData = pinData;
    map.setPaintProperty("ul-pin", "circle-radius", 6);
    map.setPaintProperty("ul-pin", "circle-color", pal.selected);
    map.setPaintProperty("ul-pin", "circle-stroke-color", pal.halo);
    map.setPaintProperty("ul-pin", "circle-stroke-width", 2);

    // Refugee settlements (informational): outlined, dotted.
    if (p.geo.settlements) {
      if (!map.getSource("ul-settlements")) {
        map.addSource("ul-settlements", { type: "geojson", data: p.geo.settlements });
        map.addLayer({ id: "ul-settlements-line", type: "line", source: "ul-settlements", layout: { "line-join": "round" } }, "ul-anchor-gaps");
      }
      map.setLayoutProperty("ul-settlements-line", "visibility", p.overlays.includes("settlements") ? "visible" : "none");
      map.setPaintProperty("ul-settlements-line", "line-color", pal.ink);
      map.setPaintProperty("ul-settlements-line", "line-width", 1.6);
      map.setPaintProperty("ul-settlements-line", "line-dasharray", [0.5, 1.5]);
    }

    // Unmapped land (the gaps layer): hatched, dashed edge.
    if (p.geo.gaps) {
      if (!map.getSource("ul-gaps")) {
        map.addSource("ul-gaps", { type: "geojson", data: p.geo.gaps });
        map.addLayer({ id: "ul-gaps-fill", type: "fill", source: "ul-gaps", paint: { "fill-pattern": "ul-hatch" } }, "ul-anchor-gaps");
        map.addLayer({ id: "ul-gaps-line", type: "line", source: "ul-gaps", layout: { "line-join": "round" } }, "ul-anchor-gaps");
      }
      const on = p.overlays.includes("gaps") ? "visible" : "none";
      map.setLayoutProperty("ul-gaps-fill", "visibility", on);
      map.setLayoutProperty("ul-gaps-line", "visibility", on);
      map.setPaintProperty("ul-gaps-line", "line-color", pal.ink);
      map.setPaintProperty("ul-gaps-line", "line-width", 1.2);
      map.setPaintProperty("ul-gaps-line", "line-dasharray", [3, 2]);
    }

    // Roads.
    if (p.geo.roads) {
      if (!map.getSource("ul-roads")) map.addSource("ul-roads", { type: "geojson", data: p.geo.roads });
      if (!map.getLayer("ul-roads-line")) {
        map.addLayer(
          { id: "ul-roads-line", type: "line", source: "ul-roads", minzoom: 5.5, layout: { "line-join": "round", "line-cap": "round" } },
          "ul-anchor-roads"
        );
      }
      map.setLayoutProperty("ul-roads-line", "visibility", p.overlays.includes("roads") ? "visible" : "none");
      map.setPaintProperty("ul-roads-line", "line-color", pal.road);
      map.setPaintProperty("ul-roads-line", "line-opacity", 0.85);
      map.setPaintProperty("ul-roads-line", "line-width", [
        "interpolate", ["linear"], ["zoom"],
        6, ["match", ["get", "highway"], ["motorway", "trunk"], 1.2, "primary", 0.8, 0.4],
        12, ["match", ["get", "highway"], ["motorway", "trunk"], 3, "primary", 2.2, 1.2],
      ]);
    }

    // Names of the choropleth level's polygons. Needs glyphs, so there are
    // none on the blank fallback style.
    const pts = p.labelPoints[p.level];
    if (pts && rt.fonts) {
      if (!map.getSource("ul-labels")) map.addSource("ul-labels", { type: "geojson", data: pts });
      else if (rt.labelData !== pts) map.getSource("ul-labels").setData(pts);
      rt.labelData = pts;
      if (!map.getLayer("ul-labels")) {
        map.addLayer({
          id: "ul-labels",
          type: "symbol",
          source: "ul-labels",
          layout: {
            "text-field": ["get", "name"],
            "text-font": rt.fonts,
            "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10, 10, 13],
            "text-max-width": 8,
            "text-padding": 4,
          },
        });
      }
      map.setLayerZoomRange("ul-labels", LABEL_MINZOOM[p.level], 24);
      map.setLayoutProperty("ul-labels", "visibility", p.overlays.includes("labels") ? "visible" : "none");
      map.setPaintProperty("ul-labels", "text-color", pal.ink);
      map.setPaintProperty("ul-labels", "text-halo-color", pal.halo);
      map.setPaintProperty("ul-labels", "text-halo-width", satellite ? 1.6 : 1.4);
    }
  }

  // Inline, not a utility class: maplibre-gl.css sets .maplibregl-map to
  // position: relative and loads after Tailwind, which would collapse an
  // absolute inset-0 container to zero height.
  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}

// Layers are added lazily (each level's data arrives when it's first
// needed), so insertion order can't be what decides stacking — a region
// outline loaded first would end up under the district fills. Instead every
// layer is inserted under one of these empty, invisible anchors, which fix
// the order once per style: fills, unmapped-land hatching, roads, then
// lines finest-to-coarsest, then hover/selection outlines — all below the
// basemap's own place-name labels.
const ANCHORS = ["hillshade", "fill", "gaps", "roads", "line-parish", "line-subcounty", "line-county", "line-district", "line-subregion", "line-region", "focus"];

// 3D terrain + hillshading, switched as one.
function syncTerrain(map, on) {
  if (on && !map.getSource("ul-dem")) {
    map.addSource("ul-dem", DEM_SOURCE);
    map.addSource("ul-dem-shade", DEM_SOURCE);
    map.addLayer(
      { id: "ul-hillshade", type: "hillshade", source: "ul-dem-shade", paint: { "hillshade-exaggeration": 0.35 } },
      "ul-anchor-hillshade"
    );
  }
  if (map.getLayer("ul-hillshade")) map.setLayoutProperty("ul-hillshade", "visibility", on ? "visible" : "none");
  const current = map.getTerrain();
  if (on && !current) map.setTerrain({ source: "ul-dem", exaggeration: 1.4 });
  if (!on && current) map.setTerrain(null);
}
function ensureAnchors(map) {
  if (map.getLayer("ul-anchor-focus")) return;
  if (!map.getSource("ul-empty")) map.addSource("ul-empty", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  const beforeId = firstSymbolLayer(map);
  for (const name of ANCHORS) {
    map.addLayer({ id: `ul-anchor-${name}`, type: "line", source: "ul-empty", layout: { visibility: "none" } }, beforeId);
  }
}

function overlayFor(level) {
  return { region: "regions", subregion: "subregions", district: "districts", county: "counties", subcounty: "subcounties", parish: "parishes" }[level];
}

/**
 * Where our layers go: above every basemap fill/line (roads, boundaries —
 * otherwise they'd draw across the choropleth), below the basemap's labels
 * so place names stay readable. Styles interleave a few early label layers
 * (water names) before their roads, so this is the first label layer after
 * the last non-label one, not simply the first label layer.
 */
function firstSymbolLayer(map) {
  const layers = map.getStyle().layers.filter((l) => !l.id.startsWith("ul-"));
  let lastShape = -1;
  layers.forEach((l, i) => {
    if (l.type !== "symbol") lastShape = i;
  });
  return layers.slice(lastShape + 1).find((l) => l.type === "symbol")?.id;
}

/**
 * A text-font stack the style's glyph server actually has (preferring an
 * upright regular face — the first label layer in most styles is water,
 * set in italic), or null on a style without glyphs. The satellite style
 * has glyphs but no label layers of its own, so it gets OpenFreeMap's
 * regular face.
 */
function findBasemapFonts(map) {
  const style = map.getStyle();
  if (!style.glyphs) return null;
  const stacks = style.layers
    .map((l) => l.layout?.["text-font"])
    .filter((font) => Array.isArray(font) && font.every((f) => typeof f === "string"));
  return (
    stacks.find((font) => font.some((f) => /regular/i.test(f))) ??
    stacks.find((font) => !font.some((f) => /italic/i.test(f))) ??
    stacks[0] ??
    ["Noto Sans Regular"]
  );
}
