# Provenance: subcounty and parish boundary geometry

Two separate sources, covering two separate tiers. Despite both being
labeled "ADM4" by their respective publishers, **they are not the same
data** — confirmed directly by inspecting attributes, not assumed from the
label:

## `data/geo/subcountys.geojson` — geoBoundaries ADM4 ("Sub-county")

Source: `geoBoundaries-UGA-ADM4.geojson` (1,521 features, CC BY 3.0 IGO,
2019 vintage — see `data/sources.json` → `src-geoboundaries-uga-adm4`; the
raw ~47.7MB file is not committed, re-fetch from the URL in that source
entry). geoBoundaries carries no parent-district attribute at all — just a
bare `shapeName` per feature — so matching had to be done by name alone
against `data/ec/administrative_units_ec2022.json`'s subcounty/town_council/
division records (`scripts/ingest-subcounty-boundaries.mjs`).

- 1,249 of geoBoundaries' 1,521 features matched a **unique** subcounty-tier
  unit by name (confirmed sample: "Bar Dege Division", "Laroo Division",
  "Pece Division" — genuine Gulu City divisions — and other near-misses in
  the "no match" bucket are naming variants, not a different admin tier).
- 165 had no name match in this project's data at all.
- 102 features (42 distinct names) were **excluded** as ambiguous: the same
  subcounty/division name is reused across 2+ districts in ~5% of this
  project's own 2,191 subcounty-tier units (e.g. multiple districts each
  have their own "Central Division"), and geoBoundaries gives no way to
  tell which one a given polygon belongs to. Rather than guess, these are
  dropped.
- **Net coverage: 1,249 / 2,191 = 57.0%** of this project's verified
  subcounty/town_council/division units.
- Simplified (tolerance 0.001°, ~111m at the equator) from a raw 36.4MB
  match down to ~3.2MB — a visualization-precision tradeoff, not
  survey-grade; go back to the raw geoBoundaries release for full
  precision.

## `data/geo/parishs.geojson` — HDX COD-AB "admin4" (genuinely parish-level)

Source: HDX's Uganda admin-boundaries GeoJSON bundle
(`uga_admin_boundaries.geojson.zip` → `uga_admin4.geojson`, 1,520 features,
CC BY-IGO, `valid_on: 2020-08-24` — see `data/sources.json` →
`src-hdx-cod-ab-uga-admin4-parish`; raw file not committed, re-fetch via the
CKAN API URL in that source entry). Unlike geoBoundaries, this file carries
the **full hierarchy per feature** (`adm1_name`=region, `adm2_name`=district,
`adm3_name`=subcounty, `adm4_name`=parish), confirmed directly from sample
records (e.g. `adm2_name: "Zombo"`, `adm4_name: "Abanga"` — Zombo is a real
current district) — this is what let `scripts/ingest-parish-boundaries.mjs`
match on (district, parish name) pairs instead of name alone, avoiding most
of the ambiguity the subcounty match had to exclude.

- Matched by building a `(district_slug, parish_slug)` key from this
  project's own `data/ec/administrative_units_ec2022.json` parish/ward
  records (walking each parish's ancestor chain up to its district — note
  this walk needs district/city records merged in from `districts.csv`/
  `cities.csv`, not just the EC-derived JSON alone, which was the actual
  bug caught and fixed during this ingestion: the first attempt silently
  produced 0 matches because the ancestor walk dead-ended at county's
  `parent_id` without district records present to resolve against).
- Of HDX's 1,520 parish features: **423 matched a unique parish/ward**
  (**3.95%** of this project's 10,717 verified parishes/wards), 8 didn't
  resolve to any current district name at all (likely referencing a
  district that has since been renamed or split), 1,083 resolved to a real
  current district but no parish name in it matched (the 2020-08-24
  vintage predates significant parish-level reorganization in many
  districts), and 6 were excluded as ambiguous (same parish name twice in
  one district).
- This is a genuinely thin layer — 3.95% coverage is real and should not be
  mistaken for a data quality bug in this project's own ingestion; it
  reflects how sparse/stale the best available free parish-level geometry
  for Uganda actually is. Shipped anyway per the project's "surface what
  exists, document the gap precisely" policy rather than withheld pending a
  better source that doesn't currently exist.
- Simplified the same way as the subcounty layer (tolerance 0.001°).
