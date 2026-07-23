"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronRight } from "lucide-react";

function useChildren(url, unwrap = (data) => data) {
  const [items, setItems] = useState(null); // null = not loaded yet, [] = loaded empty
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!url) {
      setItems(null);
      return;
    }
    let cancelled = false;
    setItems(null); // clear the previous parent's children immediately — otherwise they stay
    // selectable for a moment after switching selections, before the new fetch resolves.
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setItems(unwrap(data));
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return { items, loading };
}

function LevelSelect({ label, placeholder, value, onValueChange, options, disabled, loading }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {loading ? (
        <Skeleton className="h-9 w-full" />
      ) : (
        <Select value={value ?? ""} onValueChange={onValueChange} disabled={disabled || !options?.length}>
          <SelectTrigger className="w-full">
            {/* Base UI's Select.Value shows the raw value by default (no
                Radix-style "look up the matching SelectItem's children"
                behavior) — it needs an explicit render function to map
                value -> label. */}
            <SelectValue placeholder={placeholder}>
              {(v) => options?.find((o) => o.id === v)?.name ?? placeholder}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options?.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

const ALL = "all";

/**
 * Region/sub-region narrow the district list in-memory (both lists are
 * already fully in hand as props — no need to re-fetch). County ->
 * subcounty -> parish/ward stay live API calls per selection, same as the
 * package's own lazy-loading design (county/subcounty/parish aren't
 * bundled by default either).
 */
export function HierarchyExplorer({ regions, subregions, districts, selectedDistrictId, onSelectDistrict }) {
  const [regionId, setRegionId] = useState(ALL);
  const [subregionId, setSubregionId] = useState(ALL);
  const [districtId, setDistrictId] = useState("");
  const [countyId, setCountyId] = useState("");
  const [subcountyId, setSubcountyId] = useState("");
  const [parishId, setParishId] = useState("");
  const [villageId, setVillageId] = useState("");

  // Stay in sync when a district is picked elsewhere (map click, search).
  useEffect(() => {
    if (selectedDistrictId && selectedDistrictId !== districtId) {
      setDistrictId(selectedDistrictId);
      setCountyId("");
      setSubcountyId("");
      setParishId("");
      setVillageId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDistrictId]);

  const filteredSubregions = useMemo(() => {
    return subregions
      .filter((s) => regionId === ALL || s.region_id === regionId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [subregions, regionId]);

  const filteredDistricts = useMemo(() => {
    return districts
      .filter((d) => regionId === ALL || d.region_id === regionId)
      .filter((d) => subregionId === ALL || d.subregion_id === subregionId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [districts, regionId, subregionId]);

  const { items: counties, loading: countiesLoading } = useChildren(
    districtId ? `/api/districts/${districtId}/counties` : null
  );
  const { items: subcounties, loading: subcountiesLoading } = useChildren(
    countyId ? `/api/counties/${countyId}/subcounties` : null
  );
  const { items: parishes, loading: parishesLoading } = useChildren(
    subcountyId ? `/api/subcounties/${subcountyId}/parishes` : null
  );

  const selectedDistrict = districts.find((d) => d.id === districtId);
  const selectedCounty = counties?.find((c) => c.id === countyId);
  const selectedSubcounty = subcounties?.find((s) => s.id === subcountyId);
  const selectedParish = parishes?.find((p) => p.id === parishId);

  // Villages have no stable admin-unit id (see web/lib/villages.mjs) — matched
  // by district/subcounty/parish *name* instead, same as the map drill-down.
  const villagesUrl =
    parishId && selectedSubcounty && selectedParish
      ? `/api/units?level=village&districtId=${encodeURIComponent(districtId)}&subcountyName=${encodeURIComponent(selectedSubcounty.name)}&parishName=${encodeURIComponent(selectedParish.name)}&pageSize=500`
      : null;
  const { items: villageRows, loading: villagesLoading } = useChildren(villagesUrl, (data) => data.items);
  const villages = useMemo(
    () => villageRows?.map((v) => ({ id: v.id, name: v.village })).sort((a, b) => a.name.localeCompare(b.name)),
    [villageRows]
  );
  const selectedVillage = villages?.find((v) => v.id === villageId);

  const breadcrumb = [selectedDistrict, selectedCounty, selectedSubcounty, selectedParish, selectedVillage].filter(
    Boolean
  );

  return (
    <Card className="py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-lg">Explore the hierarchy</CardTitle>
        <CardDescription>
          Drill down from region to village — county, subcounty, parish, and village load live from the API as
          you go.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-5">
        {breadcrumb.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {breadcrumb.map((item, i) => (
              <span key={item.id} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="size-3 text-muted-foreground" />}
                <Badge variant="secondary" className="font-normal">
                  {item.name}
                </Badge>
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <LevelSelect
            label="Region"
            placeholder="All regions"
            value={regionId}
            onValueChange={(v) => {
              setRegionId(v);
              // A previously-picked sub-region may not belong to the newly
              // picked region at all — reset rather than silently AND-ing
              // two filters that can't both match anything.
              setSubregionId(ALL);
              setDistrictId("");
              setCountyId("");
              setSubcountyId("");
              setParishId("");
              setVillageId("");
            }}
            options={[{ id: ALL, name: "All regions" }, ...regions]}
          />
          <LevelSelect
            label="Sub-region"
            placeholder="All sub-regions"
            value={subregionId}
            onValueChange={(v) => {
              setSubregionId(v);
              setDistrictId("");
              setCountyId("");
              setSubcountyId("");
              setParishId("");
              setVillageId("");
            }}
            options={[{ id: ALL, name: "All sub-regions" }, ...filteredSubregions]}
          />
        </div>

        <LevelSelect
          label="District"
          placeholder={`Select a district… (${filteredDistricts.length})`}
          value={districtId}
          onValueChange={(v) => {
            setDistrictId(v);
            setCountyId("");
            setSubcountyId("");
            setParishId("");
            setVillageId("");
            onSelectDistrict?.(districts.find((d) => d.id === v));
          }}
          options={filteredDistricts}
        />

        <LevelSelect
          label="County / Municipality"
          placeholder={districtId ? "Select a county…" : "Pick a district first"}
          value={countyId}
          onValueChange={(v) => {
            setCountyId(v);
            setSubcountyId("");
            setParishId("");
            setVillageId("");
          }}
          options={counties}
          disabled={!districtId}
          loading={countiesLoading}
        />

        <LevelSelect
          label="Subcounty / Town council / Division"
          placeholder={countyId ? "Select a subcounty…" : "Pick a county first"}
          value={subcountyId}
          onValueChange={(v) => {
            setSubcountyId(v);
            setParishId("");
            setVillageId("");
          }}
          options={subcounties}
          disabled={!countyId}
          loading={subcountiesLoading}
        />

        <LevelSelect
          label="Parish / Ward"
          placeholder={subcountyId ? "Select a parish…" : "Pick a subcounty first"}
          value={parishId}
          onValueChange={(v) => {
            setParishId(v);
            setVillageId("");
          }}
          options={parishes}
          disabled={!subcountyId}
          loading={parishesLoading}
        />

        <LevelSelect
          label="Village"
          placeholder={
            !parishId
              ? "Pick a parish first"
              : !villagesLoading && villages?.length === 0
                ? "No village records for this parish"
                : "Select a village…"
          }
          value={villageId}
          onValueChange={setVillageId}
          options={villages}
          disabled={!parishId}
          loading={villagesLoading}
        />
      </CardContent>
    </Card>
  );
}
