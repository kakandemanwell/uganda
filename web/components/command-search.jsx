"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

const LEVEL_LABEL = {
  region: "Region",
  subregion: "Sub-region",
  district: "District",
  city: "City",
  county: "County",
  municipality: "Municipality",
  subcounty: "Subcounty",
  town_council: "Town council",
  division: "Division",
  parish: "Parish",
  ward: "Ward",
};

/**
 * Global Cmd/Ctrl+K search over the bundled hierarchy. Selecting a
 * district or city hands it to onSelectDistrict so the map (and hierarchy
 * explorer) can jump to it — every other level just closes the dialog,
 * since there's no standalone detail view for county/subcounty/parish yet.
 */
export function CommandSearch({ onSelectDistrict }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    const handle = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20`)
        .then((r) => r.json())
        .then((data) => {
          if (requestId.current === id) {
            setResults(data);
            setLoading(false);
          }
        })
        .catch(() => {
          if (requestId.current === id) setLoading(false);
        });
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  function handleSelect(item) {
    setOpen(false);
    setQuery("");
    if ((item.level === "district" || item.level === "city") && onSelectDistrict) {
      onSelectDistrict(item);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className="h-9 w-full justify-start gap-2 text-muted-foreground sm:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search districts, parishes…</span>
        <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
          {typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "⌘K" : "Ctrl K"}
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search Uganda's administrative units">
        <CommandInput placeholder="Search by name — e.g. Kampala, Wakiso, Bugolobi…" value={query} onValueChange={setQuery} />
        <CommandList>
          {!loading && query.trim() && results.length === 0 && (
            <CommandEmpty>No matches for &ldquo;{query}&rdquo;.</CommandEmpty>
          )}
          {!query.trim() && (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              Start typing to search across regions, districts, counties, subcounties, parishes, and wards.
            </div>
          )}
          {results.length > 0 && (
            <CommandGroup heading="Results">
              {results.map((item) => (
                <CommandItem key={item.id} value={item.id} onSelect={() => handleSelect(item)}>
                  <span className="flex-1 truncate">{item.name}</span>
                  <Badge variant="secondary" className="ml-2 text-xs font-normal">
                    {LEVEL_LABEL[item.level] ?? item.level}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
