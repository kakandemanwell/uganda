import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatExact, formatPercent } from "@/lib/format";

const ROWS = [
  {
    label: "District boundaries",
    have: 136,
    total: 136,
    note: "geoBoundaries CC0, 2020 — includes Terego",
  },
  {
    label: "Region boundaries",
    have: 4,
    total: 4,
    note: "Dissolved from district boundaries",
  },
  {
    label: "Subcounty / town council / division boundaries",
    have: 1249,
    total: 2191,
    note: "geoBoundaries ADM4 — ambiguous name matches excluded",
  },
  {
    label: "Parish / ward boundaries",
    have: 423,
    total: 10717,
    note: "HDX admin4, 2020 vintage — genuinely thin coverage",
  },
];

export function CoverageSection() {
  return (
    <Card className="py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-lg">Boundary coverage — honestly reported</CardTitle>
        <CardDescription>
          Every layer below is real, sourced, and cited — but not every layer is complete. Gaps are
          surfaced, not hidden.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-5">
        {ROWS.map((row) => {
          const fraction = row.have / row.total;
          const complete = fraction >= 0.999;
          return (
            <div key={row.label} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{row.label}</span>
                <span className="font-mono-tabular shrink-0 text-xs text-muted-foreground">
                  {formatExact(row.have)} / {formatExact(row.total)} · {formatPercent(fraction)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={complete ? "h-full bg-primary" : "h-full bg-amber-500"}
                  style={{ width: formatPercent(fraction) }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{row.note}</span>
            </div>
          );
        })}

        <div className="flex flex-col gap-1.5 border-t border-border pt-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium">Major road network</span>
            <Badge variant="outline" className="text-xs font-normal">
              not tied to admin units
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            10,721 OpenStreetMap segments (motorway–tertiary). A road crosses many districts and
            subcounties, so it isn&apos;t scored against a unit count the way boundaries are.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
