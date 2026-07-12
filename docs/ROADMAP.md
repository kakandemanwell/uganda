# Roadmap

## Phase 0 — done
- [x] Verified region + district (136, incl. Kampala/KCCA and Terego) + city
      (10) layer, cross-checked against 3 independent current sources.
- [x] Schema (`schema/administrative-unit.schema.json`) with `confidence`/`status` so gaps are visible instead of silently absent.
- [x] Build pipeline (`scripts/build.mjs`) + structural validator (`scripts/validate.mjs`).
- [x] Legacy county table (2015 vintage) mechanically parsed from Wikipedia/Statoids wikitext.

## Phase 1 — village-level data (done, ahead of schedule)
- [x] Located the EC's actual bulk gazetteer (`ec.or.ug/admin-units`) — a
      3,019-page PDF covering district > constituency > subcounty/town/division
      > parish/ward > village for all 146 district-equivalent units.
- [x] Built a coordinate-aware parser (plain text extraction destroys the
      nested table structure) — `data/legacy/provenance/ec/parse_admin_units.mjs`.
- [x] Validated against ~2,198 embedded checksums (100% match) and an
      independent EC summary-statistics document (584/584 field checks match
      across all 146 districts/cities) — see
      `data/legacy/provenance/ec/README.md`.
- [x] Ingested into the schema (`scripts/ingest-ec-admin-units.mjs` →
      `data/ec/administrative_units_ec2022.json`): 2,191 subcounties/towns/
      divisions, 10,717 parishes/wards, 71,230 villages/cells, all
      `confidence: verified`.
- [x] Retired the old legacy `location.csv`-derived subcounty layer from the
      build (superseded; kept on disk for reference).
- [x] Caught and fixed: Terego District missing from the original
      135-district baseline (all three sources used shared the same gap).

## Phase 2 — county layer (done, superseded the original plan)
- [x] Rather than tracing 24 gap districts back through the 2015 legacy
      list, reconstructed county directly from the EC's own constituency
      data: outside city/Kampala divisions, a constituency name in the 2022
      gazetteer *is* the county name (verified — see `docs/DATA_QUALITY.md`).
      Covers 135/136 rural districts (322 counties), all `confidence:
      verified`, current to 2022 rather than 2015.
- [x] Spot-checked against independent research (UBOS NPHC drilldowns,
      Wikipedia district pages) across 13 districts — 11 exact matches, 2
      refinements (EC data more granular), 0 contradictions.
- [x] Retired the 2015 legacy county list from the build entirely
      (superseded on coverage, currency, and confidence); kept on disk for
      provenance.
- [x] Retracted an earlier wrong flag: "Ik County" under Kaabong, previously
      called a likely Wikipedia error, confirmed real.
- [ ] Still open: county for Katikamu subcounty (Luwero) — the one non-city
      exception that spans two constituencies like a division does. Left
      unassigned rather than guessed; see `dist/data-quality-report.json` →
      `subcounties_without_a_matched_county`.
- [ ] Get a primary-source confirmation of the reported 2025/2026 new town
      councils and any Tororo-area district/city split before adding them —
      do not merge the unverified news summary in as fact.

## Phase 3 — zone / polling-station layer
- [ ] The EC's polling-station-level data (50,739 stations for the 2025/26
      elections) is a *separate* publication from the administrative-unit
      gazetteer used in Phase 1 — locate and evaluate it the same way (check
      `ec.or.ug` for a similar bulk PDF/page before assuming per-district
      files are the only option; that assumption turned out to be wrong for
      the village-level data, so re-check it here too).
- [ ] If it does turn out to be per-district, build an incremental ingestion
      pipeline and land it district-by-district, each verified against the
      source before being marked `confidence: verified`.

## Phase 4 — serving mechanism
- [ ] Publish this repo to GitHub (held back per user's request until the
      data above is reviewed).
- [ ] npm package wrapping `dist/uganda-locations.json` for direct
      JS/TS consumption. Given the dataset is now ~84,500 records / ~30-40MB,
      consider shipping per-level or per-district lazy-loadable chunks rather
      than one monolithic JSON.
- [ ] Minimal Next.js app on Vercel exposing `/api/districts`,
      `/api/districts/:id/subcounties`, etc., plus a simple search UI —
      "serve the website forever" per the original ask. Deploy only with
      explicit go-ahead, since it's a public, shared action.
- [ ] Consider a Python package mirroring the same `dist/` JSON for
      non-JS consumers.

## Explicitly out of scope for now
- Geometries/shapefiles — this project is name/hierarchy-focused; GIS
  boundary data (HDX, geoBoundaries) is a separate concern with its own
  licensing and could be a later add-on, not a blocker for the naming
  dataset.
- Keeping the EC gazetteer current past July 2022 — that requires either a
  newer EC publication (worth checking for one before assuming none exists,
  per the Phase 3 lesson above) or manual district-by-district updates as
  changes are confirmed.
