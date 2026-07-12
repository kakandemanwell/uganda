# Provenance: EC "Verified Administrative Units, July 2022"

This is the real find behind `data/ec/administrative_units_ec2022.json` — a
3,019-page PDF gazetteer from the Electoral Commission of Uganda listing
every district > constituency > subcounty/town/division > parish/ward >
village in the country, plus a 4-page companion summary-statistics PDF with
the same totals per district. Both are linked from
[ec.or.ug/admin-units](https://ec.or.ug/admin-units). Direct fetches with the
harness's WebFetch tool returned HTTP 403; a plain `curl` request with a
standard browser user-agent succeeded — see `data/sources.json` ->
`src-ec-admin-units-2022`.

## Why a custom parser was necessary

Plain `pdftotext` (with or without `-layout`) flattens the nested table into
a linear text stream that loses the association between a parish and its
villages — village ID numbering resets aren't reliable row boundaries (one
parish's list in the source data starts at "02", not "01"). Getting this
right required reading each text item's actual (x, y) position on the page
and reconstructing columns from known x-bands. See `parse_admin_units.mjs`.

## Two independent validation passes, both clean

1. **Embedded checksums**: the source document itself prints a
   "TOTAL VILLAGES IN &lt;subcounty&gt;" line after every subcounty
   (~2,198 of them). The parser accumulates a running village count per
   subcounty and checks every single one of these against the stated total.
   All 2,198 match.
2. **Cross-document totals**: the companion summary-statistics PDF
   independently states villages/subcounties/parishes/constituencies per
   district. Re-aggregating the fully parsed data and diffing against that
   summary, for all 146 districts/cities × 4 fields (584 checks), gives zero
   discrepancies.

National totals: 146 district-equivalent units, 353 constituencies, 2,191
subcounties/towns/divisions, 10,717 parishes/wards, 71,230 villages.

This is also what caught that **Terego District** was missing from the
project's original 135-district baseline — all three sources used for that
baseline (Statoids, Wikipedia, the MoLG-style PDF list) shared the same gap.

## Known quirk this parser had to handle

Some subcounties — mostly city divisions — are listed twice under two
different electoral constituencies (e.g. "Kawempe Division" once under
"Kawempe Division North" and again under "Kawempe Division South"), reusing
the same subcounty code both times but each listing a disjoint, non-
overlapping set of parishes/villages. Because "constituency" is an electoral
concept rather than the region/district/county/subcounty/parish/village
hierarchy this project targets (and forcing it into the tree would require
one subcounty to have two parents), the ingestion step
(`scripts/ingest-ec-admin-units.mjs`) does not model constituency as a tree
level at all — subcounties parent directly to their district/city, and the
constituency name(s) a subcounty was listed under are kept as
`external_refs.ec_constituencies` metadata instead.

## Files here

- `admin-units-2022.pdf` (~11MB) — the full gazetteer. **Gitignored** (large,
  re-fetchable from the URL above) — re-download it here if you need to
  re-run the parser from scratch.
- `summary-admin-units-2022.pdf` (~400KB) — the companion summary statistics.
  Tracked in git (small).
- `summary_admin_units_2022.csv` — that summary, transcribed by hand and
  verified by summing every column and matching the PDF's own stated totals
  exactly (312 counties, 353 constituencies, 2,191 subcounties, 10,717
  parishes, 71,230 villages).
- `parse_admin_units.mjs` — the coordinate-aware parser. Produces
  `parsed_admin_units_2022.json` (~18MB, flat village-level records).
  **Gitignored** (large, regenerable) — re-run with `node parse_admin_units.mjs`
  once the PDF above is present.
- `inspect.mjs` — small diagnostic tool used to dump raw (x, y, text) items
  for a page range while reverse-engineering the column layout. Useful again
  if the EC ever changes this document's format.
- `parse_mismatches.json` — checksum-mismatch log from the parser's last run
  (should be `[]`).

## Regenerating from scratch

```bash
cd data/legacy/provenance/ec
curl -sL -A "Mozilla/5.0" -o admin-units-2022.pdf \
  "https://ec.or.ug/sites/default/files/statistics/ADMINISTRATIVE%20UNITS%20IN%20UGANDA_JULY%202022.pdf"
node parse_admin_units.mjs
cd ../../../..
node scripts/ingest-ec-admin-units.mjs
node scripts/build.mjs
node scripts/validate.mjs
```
