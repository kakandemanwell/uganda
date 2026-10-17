# Observatory: research pass (2026-10-17)

Exploratory branch `research/observatory`. Nothing here changes the shipped
dataset; it records what uganda-locale could grow into and what data exists
to get there.

## Thesis

Global and regional platforms (Global Forest Watch, Digital Earth Africa,
Copernicus EMS/GloFAS, ICPAC, RCMRD) publish strong signals for Uganda but
aggregate them to GADM or a raw grid. None sums them to Uganda's *current*
districts, subcounties and parishes, and most Ugandan agencies publish PDFs
or have offline portals. This project's EC-derived hierarchy (71,230
villages, stable ids) is the missing join key. The observatory is that
hierarchy plus versioned, sourced, per-unit time series for weather,
floods, water, terrain, vegetation, people and services, land and history.

## Files

| File | What |
|---|---|
| [`USER-ACTIONS.md`](USER-ACTIONS.md) | Manual downloads, permission letters, ATI requests, and exposures to report |
| [`../../data/observatory/catalog.json`](../../data/observatory/catalog.json) | Every candidate source with access route and licence tier. Not `data/sources.json`: a source moves there only when an ingest consumes it |
| [`../../scripts/observatory/fetch-public-sources.mjs`](../../scripts/observatory/fetch-public-sources.mjs) | Fetch-only snapshot of the open UBOS and MLHUD endpoints |
| [`../../data/legacy/provenance/observatory/`](../../data/legacy/provenance/observatory/) | The snapshots, with `manifest.json` (URL, bytes, sha256) |

## Licence tiers

The dataset is CC BY 4.0 (commercial reuse allowed), so every source gets a
tier:

- **core**: may merge into the dataset (UBOS with citation, Copernicus,
  NASA/USGS, CHIRPS, DE Africa, WorldCover, Hansen, Open Buildings under
  its CC BY option, WorldPop, Glottolog, Wikidata).
- **sharealike**: separate files under their own licence (OSM, Protomaps
  tiles, WPdx).
- **licensed**: used under a licence the project already holds (Esri World
  Imagery/Wayback). Cache and analyse privately; publish only derived
  vectors.
- **displayonly**: view or link only (WDPA, FABDEM, Global Flood Database,
  FAO Locust Hub).
- **citeonly** / **unknown**: cite facts, ask before re-hosting.

Esri imagery in particular: the project already holds an Esri licence from
another running project, so World Imagery and Wayback can be cached
(PMTiles/MBTiles for the local-first viewer, offline packs) and analysed
(building and flood-mark extraction, before/after change detection) with
our own credentials. Keep the key in an untracked env file (`ESRI_API_KEY`
in `.env.local`) and the tile cache in a gitignored folder. Two limits
remain: the pixels themselves stay out of the CC BY dataset and `dist/`
(derived vectors are fine, with an Esri-imagery provenance field), and it
is RGB only, so vegetation and water indices still come from
Sentinel/Landsat.

## Highest-value next ingest

UBOS's own 2024 polygons, which now exist as open API responses:
subcounties from the NPHC 2024 API and parishes from the Baseline Education
Census 2025 API, all keyed by UBOS codes. Matching those codes to EC ids
(the same name-and-hierarchy matching `scripts/ingest-hdx-cod-ab.mjs`
does) would replace the fitted geoBoundaries/HDX geometry and lift parish
coverage from 3.95%.

## First ten layers

1. Official 2024 subcounty and parish boundaries (UBOS)
2. Parish census profiles (NPHC 2024 tables 1-15)
3. Rainfall anomaly per subcounty (CHIRPS v3 + Open-Meteo outlook)
4. Terrain tiles, hillshade, contours (Copernicus GLO-30)
5. Catchment crosswalk (HydroBASINS, MWE catchments once permitted)
6. Flood extent per event (Sentinel-1 change detection, checked against CEMS GFM)
7. River-flood outlook (GloFAS v4, "not a flood warning")
8. Forest loss 2001-2025 (Hansen v1.13)
9. Vegetation condition (DE Africa NDVI anomaly)
10. Exposure: buildings and people at risk (Open Buildings, WorldPop)

## Guardrails

No personal data (owners, licence holders, facility contacts, tax records)
even where an endpoint serves it. No critical-infrastructure detail beyond
licensed releases. Forecast layers are labelled as not being warnings. A
licence-tier gate in `scripts/validate.mjs` should stop unknown or
display-only sources reaching `dist/`.
