// "Export as image": the map exactly as it's drawn, framed with a title,
// its legend and the data/basemap attribution, so a downloaded PNG still
// says what it shows and where it came from once it's pasted into a report.

/** Grabs the WebGL canvas right after a fresh frame — no preserveDrawingBuffer needed. */
function snapshot(map) {
  return new Promise((resolve) => {
    map.once("render", () => resolve(map.getCanvas()));
    map.triggerRepaint();
  });
}

/**
 * @param {object} opts
 * @param {import("maplibre-gl").Map} opts.map
 * @param {string} opts.title
 * @param {string} opts.subtitle
 * @param {{color: string, label: string}[]} opts.legend
 * @param {string} opts.attribution
 * @param {string} opts.filename
 */
export async function exportMapPng({ map, title, subtitle, legend, attribution, filename }) {
  const mapCanvas = await snapshot(map);
  const dpr = mapCanvas.width / mapCanvas.clientWidth || 1;
  const pad = 24 * dpr;
  const headerH = 64 * dpr;
  const footerH = 30 * dpr;
  const legendRowH = 20 * dpr;
  const legendH = legend.length ? legendRowH * Math.ceil(legend.length / 3) + 12 * dpr : 0;

  const out = document.createElement("canvas");
  out.width = mapCanvas.width + pad * 2;
  out.height = headerH + mapCanvas.height + legendH + footerH + pad;
  const ctx = out.getContext("2d");

  const isDark = document.documentElement.classList.contains("dark");
  const bg = isDark ? "#141414" : "#ffffff";
  const ink = isDark ? "#ededeb" : "#1a1a19";
  const muted = isDark ? "#a3a3a0" : "#6b6b67";
  // The page's own (next/font-loaded) family, so the image matches the site.
  const fontFamily = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, out.width, out.height);

  ctx.fillStyle = ink;
  ctx.font = `600 ${18 * dpr}px ${fontFamily}`;
  ctx.textBaseline = "top";
  ctx.fillText(title, pad, pad * 0.8);
  ctx.fillStyle = muted;
  ctx.font = `${12 * dpr}px ${fontFamily}`;
  ctx.fillText(subtitle, pad, pad * 0.8 + 26 * dpr);

  ctx.drawImage(mapCanvas, pad, headerH);

  let y = headerH + mapCanvas.height + 12 * dpr;
  const colW = (out.width - pad * 2) / 3;
  legend.forEach((item, i) => {
    const x = pad + (i % 3) * colW;
    const rowY = y + Math.floor(i / 3) * legendRowH;
    if (item.color === "rgba(0,0,0,0)") {
      // "unshaded" swatch: an outline, since a transparent fill shows nothing
      ctx.setLineDash([3 * dpr, 2 * dpr]);
      ctx.strokeStyle = muted;
      ctx.lineWidth = dpr;
      ctx.strokeRect(x + 0.5 * dpr, rowY + 3.5 * dpr, 13 * dpr, 9 * dpr);
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = item.color;
      ctx.fillRect(x, rowY + 3 * dpr, 14 * dpr, 10 * dpr);
    }
    ctx.fillStyle = ink;
    ctx.font = `${12 * dpr}px ${fontFamily}`;
    ctx.fillText(item.label, x + 20 * dpr, rowY + 1 * dpr);
  });

  ctx.fillStyle = muted;
  ctx.font = `${10 * dpr}px ${fontFamily}`;
  ctx.fillText(attribution, pad, out.height - footerH, out.width - pad * 2);

  const blob = await new Promise((resolve) => out.toBlob(resolve, "image/png"));
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
