import { ImageResponse } from "next/og";
import * as uganda from "@/lib/uganda-data.mjs";
import { LEVEL_LABEL } from "@/lib/unit-meta";

uganda.parishes();
uganda.cells();

export const alt = "uganda-locale unit detail";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }) {
  const { id } = await params;
  const unit = uganda.getUnit(decodeURIComponent(id));

  const region = unit?.region_id ? uganda.getUnit(unit.region_id) : null;
  const subregion = unit?.subregion_id ? uganda.getUnit(unit.subregion_id) : null;
  const levelLabel = unit ? (LEVEL_LABEL[unit.level] ?? unit.level) : "";
  const place = [subregion?.name, region?.name].filter(Boolean).join(", ");

  return new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", background: "#0a0a0a" }}>
        <div style={{ display: "flex", height: 14 }}>
          <div style={{ display: "flex", flex: 1, background: "#fcdc04" }} />
          <div style={{ display: "flex", flex: 1, background: "#d90000" }} />
        </div>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", padding: "0 90px", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                display: "flex",
                fontSize: 26,
                color: "#0a0a0a",
                background: "#fcdc04",
                borderRadius: 999,
                padding: "8px 22px",
                fontWeight: 600,
              }}
            >
              {levelLabel}
            </div>
            {place && (
              <div style={{ display: "flex", fontSize: 28, color: "#9ca3af" }}>{place}</div>
            )}
          </div>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 700, color: "#fff", lineHeight: 1.05 }}>
            {unit?.name ?? "Not found"}
          </div>
          {unit?.population && (
            <div style={{ display: "flex", fontSize: 32, color: "#a3a3a3" }}>
              {unit.population.total.toLocaleString()} people · 2024 census
            </div>
          )}
        </div>
        <div style={{ display: "flex", height: 14 }}>
          <div style={{ display: "flex", flex: 1, background: "#fcdc04" }} />
          <div style={{ display: "flex", flex: 1, background: "#d90000" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
