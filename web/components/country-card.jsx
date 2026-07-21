import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// True flag colors (Wikimedia Commons source — see data/sources.json ->
// src-wikimedia-flag-uganda), documented here as reference swatches. These
// are deliberately literal hex/rgb values, not the theme-aware
// --color-flag-* text tokens in globals.css (which are contrast-adjusted
// per light/dark mode) — a color swatch controls its own foreground, so it
// doesn't have the same text-on-page-background contrast problem.
const FLAG_COLORS = [
  { name: "Black", hex: "#000000", rgb: "0, 0, 0" },
  { name: "Yellow (Gold)", hex: "#FCDC04", rgb: "252, 220, 4" },
  { name: "Red", hex: "#D90000", rgb: "217, 0, 0" },
];

const ASSET_DOWNLOADS = [
  ["Flag (SVG)", "/country/flag.svg"],
  ["Flag (PNG)", "/country/flag.png"],
  ["Coat of arms (SVG)", "/country/coat-of-arms.svg"],
  ["Coat of arms (PNG)", "/country/coat-of-arms.png"],
];

export function CountryCard({ country }) {
  return (
    <Card className="py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-lg">Republic of Uganda</CardTitle>
        <CardDescription>Flag, coat of arms, and country metadata — from data/country/uganda.json.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 px-5">
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex flex-col items-center gap-2">
            <Image
              src="/country/flag.svg"
              alt="Flag of Uganda"
              width={144}
              height={96}
              className="rounded-md ring-1 ring-border"
            />
            <span className="text-xs text-muted-foreground">Flag</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Image
              src="/country/coat-of-arms.svg"
              alt="Coat of arms of Uganda"
              width={96}
              height={103}
              className="rounded-md"
            />
            <span className="text-xs text-muted-foreground">Coat of arms</span>
          </div>

          <div className="flex flex-1 flex-col gap-2 min-w-[220px]">
            <span className="text-xs text-muted-foreground">Flag colors</span>
            <div className="flex flex-col gap-2">
              {FLAG_COLORS.map((c) => (
                <div key={c.hex} className="flex items-center gap-2.5 text-sm">
                  <span
                    className="size-6 shrink-0 rounded ring-1 ring-border"
                    style={{ backgroundColor: c.hex }}
                    aria-hidden
                  />
                  <span className="w-28 shrink-0">{c.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{c.hex}</span>
                  <span className="font-mono text-xs text-muted-foreground">rgb({c.rgb})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <Field label="Capital" value={country.capital} />
          <Field label="Currency" value={`${country.currency.name} (${country.currency.code})`} />
          <Field label="Calling code" value={country.calling_code} />
          <Field label="Timezone" value={`${country.timezone.name} (${country.timezone.utc_offset})`} />
          <Field label="Independence" value={country.independence_date} />
          <Field label="Area" value={`${country.area_km2.toLocaleString()} km²`} />
          <Field label="Motto" value={`"${country.motto}"`} />
          <Field label="Demonym" value={country.demonym} />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {ASSET_DOWNLOADS.map(([label, href]) => (
            <Badge key={href} variant="outline" className="font-normal">
              <a href={href} download className="hover:text-foreground">
                {label}
              </a>
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Flag: public domain. Coat of arms: CC BY-SA 3.0 (attribution + share-alike) — stricter
          than this project&apos;s default CC BY 4.0. See{" "}
          <a
            href="https://github.com/kakandemanwell/uganda/blob/master/LICENSE-DATA.md"
            className="underline underline-offset-2 hover:text-foreground"
            target="_blank"
            rel="noreferrer"
          >
            LICENSE-DATA.md
          </a>
          .
        </p>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
