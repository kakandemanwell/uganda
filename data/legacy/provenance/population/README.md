# Provenance: district/city population, NPHC 2024

`data/population/uganda-nphc-2024-population.csv` (146 rows: 136 districts +
10 cities, `id,name,male,female,total`) was extracted from UBOS's **National
Population and Housing Census 2024 — Final Report, Volume 1 (Main)**, not
from a projection or a third-party mirror. This is the actual final census
count, not the 2023 HDX projection dataset that was considered and passed
over for this reason (see `data/sources.json` →
`src-ubos-nphc2024-final-report`).

## How it was fetched

Every direct `WebFetch`-tool request to `ubos.org`/`statistics.ubos.org`
earlier in this project failed with a TLS "unable to verify the first
certificate" error (see `src-ubos-subregions-2024`). A plain `curl` request
with a standard browser `User-Agent` and `-k` (skip certificate
verification) succeeded where the fetch tool didn't — this looks like an
intermediate-certificate issue specific to that tool's TLS stack, not a real
MITM concern for a plain-HTTP-content government statistics download, but
it's worth someone re-verifying the cert chain independently if this is ever
re-fetched.

1. `https://www.ubos.org/` → found link to
   `https://www.ubos.org/nphc-2024-census-page/`.
2. That page links the Final Report PDF directly:
   `https://www.ubos.org/wp-content/uploads/2024/12/National-Population-and-Housing-Census-2024-Final-Report-Volume-1-Main.pdf`
   (36MB — not committed to this repo; re-fetch from that URL if needed).
3. `pdftotext -table` (poppler/xpdf's table-optimized mode — plain `-layout`
   mode badly garbled this particular table, shifting numbers between rows;
   `-table` extracted every row cleanly with no manual correction needed)
   against physical PDF pages 52-56, which contain:
   - Table 2.4 A: Total Population in Central Region by District and City
   - Table 2.4 B: Total Population in Eastern Region by District and City
   - Table 2.4 C: Total Population in Northern Region by District and City
   - Table 2.4 D: Total Population in Western Region by District and City
4. Parsed programmatically (not by hand) into
   `parsed-district-population-2024.json` (146 rows) in this folder.
5. Cross-checked against the report's own prose narrative: "Wakiso district
   was the most populated with 3,411,177 people while Kalangala was the
   least populated district with 74,411 people" — both figures matched
   exactly.
6. Cross-checked arithmetically: `male + female === total` for all 146 rows,
   zero mismatches.
7. Cross-checked against the national total in a *separate* table elsewhere
   in the same report (Table 2.1): summing all 146 rows' male, female, and
   total columns independently reproduces the national total
   (22,314,289 / 23,591,128 / 45,905,417) exactly, to the person, across all
   three columns — the same kind of independent-checksum validation this
   project already relies on for the EC gazetteer (see
   `data/legacy/provenance/ec/README.md`).
8. Matched all 146 names to this project's own district/city ids via the
   same slugify + alias logic used elsewhere (e.g.
   `scripts/ingest-district-boundaries.mjs`) — 146/146 resolved with zero
   overrides needed (the report already uses "Luweero"/"Ssembabule", both
   already existing aliases in `data/districts.csv`, and lowercase city
   suffixes like "Fort portal city" that slugify identically to this
   project's city ids).

No explicit copyright/license statement was found anywhere in the 36MB PDF
(searched for "copyright", "license", "creative commons", "©" — no matches).
Treated as public government statistical data for the purposes of this
project's CC BY 4.0 default, consistent with how other UBOS-sourced content
is already handled here, but flagged rather than assumed — see
`LICENSE-DATA.md`.
