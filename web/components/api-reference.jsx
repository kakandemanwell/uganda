import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DATA_ROUTES = [
  ["/api/regions", "All 4 administrative regions"],
  ["/api/subregions", "All 17 cultural/traditional sub-regions"],
  ["/api/districts", "136 districts + population (?regionId=, ?subregionId=)"],
  ["/api/cities", "10 second-generation cities + population"],
  ["/api/districts/:id/counties", "Counties/municipalities under a district"],
  ["/api/counties/:id/subcounties", "Subcounties/town councils/divisions under a county"],
  ["/api/subcounties/:id/parishes", "Parishes/wards under a subcounty"],
  ["/api/search", "Name/alias search (?q=, &level=, &limit=)"],
  ["/api/country", "Country metadata — ISO codes, currency, flag, etc."],
];

const GEO_ROUTES = [
  ["/api/geo/regions", "4 region boundary polygons"],
  ["/api/geo/districts", "136 district boundary polygons + population"],
  ["/api/geo/subcounties", "1,249/2,191 subcounty boundaries (57.0%)"],
  ["/api/geo/parishes", "423/10,717 parish boundaries (3.95%)"],
  ["/api/geo/roads", "10,721 major road network segments"],
];

function RouteTable({ routes }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Route</TableHead>
          <TableHead>Description</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {routes.map(([path, desc]) => (
          <TableRow key={path}>
            <TableCell className="font-mono text-xs whitespace-nowrap">
              <Badge variant="outline" className="mr-2 font-mono text-[10px]">
                GET
              </Badge>
              {path}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{desc}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ApiReference() {
  return (
    <Card className="py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-lg">API reference</CardTitle>
        <CardDescription>
          Every route returns JSON with edge caching. Same data is available as the{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">uganda-locale</code> npm package.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        <Tabs defaultValue="data">
          <TabsList>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="geo">Geo</TabsTrigger>
          </TabsList>
          <TabsContent value="data" className="mt-3">
            <RouteTable routes={DATA_ROUTES} />
          </TabsContent>
          <TabsContent value="geo" className="mt-3">
            <RouteTable routes={GEO_ROUTES} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
