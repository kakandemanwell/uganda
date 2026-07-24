import { ImageResponse } from "next/og";

export const alt = "uganda-locale — Uganda's administrative data, mapped and cited.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", background: "#0a0a0a" }}>
        <div style={{ display: "flex", height: 14 }}>
          <div style={{ display: "flex", flex: 1, background: "#fcdc04" }} />
          <div style={{ display: "flex", flex: 1, background: "#d90000" }} />
        </div>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", padding: "0 90px", gap: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", width: 12, height: 36, background: "#fcdc04" }} />
            <div style={{ display: "flex", width: 12, height: 36, background: "#d90000" }} />
            <div style={{ display: "flex", fontSize: 28, color: "#9ca3af", letterSpacing: 3, textTransform: "uppercase" }}>
              Uganda
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 74, fontWeight: 700, color: "#fff", lineHeight: 1.08 }}>
              Administrative data,
            </div>
            <div style={{ display: "flex", fontSize: 74, fontWeight: 700, color: "#fcdc04", lineHeight: 1.08 }}>
              mapped
            </div>
            <div style={{ display: "flex", fontSize: 74, fontWeight: 700, color: "#d90000", lineHeight: 1.08 }}>
              and cited.
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#a3a3a3", maxWidth: 900 }}>
            Region → sub-region → district → county → subcounty → parish → village, plus boundaries, roads, and 2024
            census population.
          </div>
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
