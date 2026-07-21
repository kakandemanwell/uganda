import { statSync, existsSync } from "node:fs";
import path from "node:path";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Download the data — uganda-locale",
  description: "Every file behind uganda-locale, ready to download directly — no code required.",
};

const GROUPS = [
  {
    title: "One row per village (recommended for Excel/Sheets)",
    files: [
      ["uganda-locations-full.csv", "Full ancestry — region → district → county → constituency → subcounty → parish → village, one row each (71,230 rows)."],
      ["uganda-locations.csv", "Flattened, loosely backward-compatible with the original location.csv shape."],
    ],
  },
  {
    title: "Per-level JSON",
    files: [
      ["regions.json", "4 administrative regions"],
      ["subregions.json", "17 cultural/traditional sub-regions"],
      ["districts.json", "136 districts, incl. Kampala/KCCA, with 2024 population"],
      ["citys.json", "10 second-generation cities, with 2024 population"],
      ["countys.json", "322 counties/municipalities"],
      ["subcountys.json", "2,061 rural subcounties"],
      ["town_councils.json", "Town councils"],
      ["divisions.json", "City/KCCA divisions"],
      ["parishs.json", "Rural parishes"],
      ["wards.json", "City/KCCA wards"],
      ["cells.json", "City/KCCA cells (256)"],
    ],
  },
  {
    title: "Boundary polygons (GeoJSON)",
    files: [
      ["geo/districts.geojson", "136 district boundaries, CC0"],
      ["geo/regions.geojson", "4 region boundaries, dissolved from districts"],
      ["geo/subcountys.geojson", "1,249/2,191 subcounty boundaries (57.0% — partial by design)"],
      ["geo/parishs.geojson", "423/10,717 parish boundaries (3.95% — partial by design)"],
      ["geo/roads.geojson", "10,721 major road network segments"],
    ],
  },
  {
    title: "Metadata",
    files: [["data-quality-report.json", "Live coverage/gaps report, regenerated every build"]],
  },
];

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DataPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Download the data</h1>
          <p className="text-sm text-muted-foreground">
            Every file behind this project, ready to download directly. Looking for a filtered
            subset instead?{" "}
            <a href="/explore" className="underline underline-offset-2 hover:text-foreground">
              Use the filters on /explore →
            </a>
          </p>
        </div>

        {GROUPS.map((group) => (
          <Card key={group.title} className="py-5">
            <CardHeader className="px-5">
              <CardTitle className="text-base">{group.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 px-5">
              {group.files.map(([file, description]) => {
                const filePath = path.join(process.cwd(), "public", "data", file);
                const size = existsSync(filePath) ? formatBytes(statSync(filePath).size) : null;
                return (
                  <a
                    key={file}
                    href={`/data/${file}`}
                    download
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
                  >
                    <span className="flex flex-col">
                      <span className="font-mono text-xs">{file}</span>
                      <span className="text-xs text-muted-foreground">{description}</span>
                    </span>
                    {size && (
                      <Badge variant="outline" className="shrink-0 font-mono text-[10px] font-normal">
                        {size}
                      </Badge>
                    )}
                  </a>
                );
              })}
            </CardContent>
          </Card>
        ))}

        <p className="text-xs text-muted-foreground">
          CC BY 4.0 (roads layer ODbL) — see{" "}
          <a
            href="https://github.com/kakandemanwell/uganda/blob/master/LICENSE-DATA.md"
            className="underline underline-offset-2 hover:text-foreground"
            target="_blank"
            rel="noreferrer"
          >
            LICENSE-DATA.md
          </a>{" "}
          for full attribution.
        </p>
      </main>
    </div>
  );
}
