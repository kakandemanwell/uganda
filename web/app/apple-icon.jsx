import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", flex: 1, background: "#000" }} />
        <div style={{ display: "flex", flex: 1, background: "#fcdc04" }} />
        <div style={{ display: "flex", flex: 1, background: "#d90000" }} />
        <div style={{ display: "flex", flex: 1, background: "#000" }} />
        <div style={{ display: "flex", flex: 1, background: "#fcdc04" }} />
        <div style={{ display: "flex", flex: 1, background: "#d90000" }} />
      </div>
    ),
    { ...size }
  );
}
