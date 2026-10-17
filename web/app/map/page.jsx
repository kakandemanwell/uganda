import * as uganda from "@/lib/uganda-data.mjs";
import { MapExplorer } from "@/components/map-explorer";
import { BASEMAPS, DEFAULT_STATE, MAP_LEVEL_KEYS, MODES, OVERLAY_KEYS, metricsForLevel } from "@/lib/map-config";

const TITLE = "Map";
const DESCRIPTION =
  "Colour Uganda's regions, districts, counties, subcounties and parishes by population, density or unit counts, on a map or satellite basemap; drill into any district, and export the boundaries with OCHA P-codes and UBOS codes.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/map" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/map" },
  twitter: { title: TITLE, description: DESCRIPTION },
};

// URL state is user-editable, so every piece is validated here and falls
// back to the default rather than reaching the client malformed.
function parseInitial(sp) {
  const level = MAP_LEVEL_KEYS.includes(sp.level) ? sp.level : DEFAULT_STATE.level;
  const metrics = metricsForLevel(level).map((m) => m.key);
  const metric = metrics.includes(sp.metric) ? sp.metric : metrics.includes(DEFAULT_STATE.metric) ? DEFAULT_STATE.metric : metrics[0];
  const overlays =
    typeof sp.layers === "string" ? OVERLAY_KEYS.filter((k) => sp.layers.split(",").includes(k)) : DEFAULT_STATE.overlays;
  const focusUnit = typeof sp.focus === "string" ? uganda.getUnit(sp.focus) : null;
  const focus = focusUnit?.level === "district" ? focusUnit.id : focusUnit?.level === "city" ? focusUnit.parent_id : null;
  let at = null;
  if (typeof sp.at === "string") {
    const [lon, lat, zoom] = sp.at.split(",").map(Number);
    if ([lon, lat, zoom].every(Number.isFinite) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      at = { center: [lon, lat], zoom: Math.min(18, Math.max(4, zoom)) };
    }
  }
  const basemap = BASEMAPS.some((b) => b.key === sp.base) ? sp.base : DEFAULT_STATE.basemap;
  const op = Number(sp.op);
  const opacity = Number.isFinite(op) && sp.op !== undefined ? Math.min(1, Math.max(0, op / 100)) : DEFAULT_STATE.opacity;
  const fill = sp.fill !== "0" && sp.fill !== "false";
  const mode = MODES.some((m) => m.key === sp.mode) ? sp.mode : DEFAULT_STATE.mode;
  const terrain = sp.terrain === "1" || sp.terrain === "true";
  return { level, metric, overlays, focus, at, basemap, opacity, fill, mode, terrain };
}

export default async function MapPage({ searchParams }) {
  const sp = await searchParams;
  const dqr = uganda.dataQualityReport();
  const report = dqr.boundary_coverage;
  const coverage = {
    region: report.regions,
    subregion: report.subregions,
    district: report.districts,
    county: report.countys,
    subcounty: report.subcountys,
    parish: report.parishs,
    gaps: report.gaps,
    settlements: uganda.settlements().features.length,
  };

  return (
    <MapExplorer
      regions={uganda.regions()}
      subregions={uganda.subregions()}
      districts={uganda.districts()}
      cities={uganda.cities()}
      coverage={coverage}
      initial={parseInitial(sp)}
      dataVersion={dqr.generated_at}
    />
  );
}
