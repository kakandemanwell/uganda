import { MapPin, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatExact, formatPercent } from "@/lib/format";

export function DistrictDetailPanel({ district, regionsById, subregionsById }) {
  if (!district) {
    return (
      <Card className="flex h-full items-center justify-center border-dashed py-12 text-center">
        <CardContent className="flex flex-col items-center gap-2 px-6">
          <MapPin className="size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Click a district on the map, or search for one, to see its details here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const region = regionsById[district.region_id];
  const subregion = subregionsById[district.subregion_id];
  const pop = district.population;
  const malePct = pop ? pop.male / pop.total : 0;

  return (
    <Card className="py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-lg">{district.name}</CardTitle>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {region && <Badge variant="secondary">{region.name}</Badge>}
          {subregion && <Badge variant="outline">{subregion.name}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="px-5">
        {pop ? (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-3.5" />
              2024 census population
            </div>
            <div className="font-mono-tabular mt-1 text-3xl font-semibold tracking-tight">
              {formatExact(pop.total)}
            </div>
            <Separator className="my-3" />
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: formatPercent(malePct, 2) }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>Male · {formatExact(pop.male)} ({formatPercent(malePct)})</span>
              <span>Female · {formatExact(pop.female)} ({formatPercent(1 - malePct)})</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No population data for this unit.</p>
        )}
        <Separator className="my-3" />
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted-foreground">{district.id}</span>
          <div className="flex gap-3 text-xs">
            <a href={`/map?focus=${encodeURIComponent(district.id)}`} className="underline underline-offset-2 hover:text-foreground">
              Zoom in →
            </a>
            <a
              href={`/unit/${encodeURIComponent(district.id)}`}
              className="underline underline-offset-2 hover:text-foreground"
            >
              Full record →
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
