// Minimal CSV serializer for the export endpoint — deliberately not sharing
// the root project's scripts/lib/csv.mjs (a build-time-only script helper);
// this is small enough to duplicate rather than reach across the package
// boundary for one function.
function toCsvCell(v) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows, columns) {
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((c) => toCsvCell(row[c])).join(","));
  return lines.join("\n") + "\n";
}
